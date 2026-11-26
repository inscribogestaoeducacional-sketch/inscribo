// Painel "Filtros" da lista de conversas do WhatsApp: tudo que não cabe nos filtros rápidos do topo
// (Status, Atendente, Lida/Não lida). Cobre a lista inteira por cima, no mesmo visual do Hub.
import { X, SlidersHorizontal } from 'lucide-react'
import { MultiSelect, type Opt } from '../transmissoes/AudienceFilters'

export interface AdvFilters {
  assignees: string[]      // ids de atendente; 'none' = sem atendente
  tags: string[]           // nomes de etiqueta (qualquer uma)
  types: string[]          // lead | client | supplier | other
  stages: string[]         // etapa do funil do lead ligado ('x:<id>' = etapa personalizada)
  grades: string[]         // série de interesse do lead
  sources: string[]        // origem do lead
  triggers: string[]       // origem de Captação Inteligente
  waitingFor: '' | '1h' | '4h' | '24h'   // cliente falou por último e ninguém respondeu há…
  idleFor: '' | '1d' | '3d' | '7d'       // sem movimento há…
  window24: '' | 'open' | 'closed'       // janela de 24h do WhatsApp
  bot: '' | 'with' | 'without'
  survey: '' | 'with' | 'without'        // nota na pesquisa de satisfação
  visitToday: boolean
  fromBroadcast: boolean
}

export const EMPTY_ADV: AdvFilters = {
  assignees: [], tags: [], types: [], stages: [], grades: [], sources: [], triggers: [],
  waitingFor: '', idleFor: '', window24: '', bot: '', survey: '', visitToday: false, fromBroadcast: false,
}

export function advCount(a: AdvFilters): number {
  return a.assignees.length + a.tags.length + a.types.length + a.stages.length + a.grades.length + a.sources.length + a.triggers.length
    + (a.waitingFor ? 1 : 0) + (a.idleFor ? 1 : 0) + (a.window24 ? 1 : 0) + (a.bot ? 1 : 0) + (a.survey ? 1 : 0)
    + (a.visitToday ? 1 : 0) + (a.fromBroadcast ? 1 : 0)
}

/** Lê do armazenamento sem confiar no formato: o que não bate volta ao vazio. */
export function advFromSaved(raw: any): AdvFilters {
  const r = raw && typeof raw === 'object' ? raw : {}
  const arr = (v: any) => Array.isArray(v) ? v.map(String) : []
  const one = <T extends string>(v: any, ok: readonly T[], empty: T): T => ok.includes(v) ? v : empty
  return {
    assignees: arr(r.assignees), tags: arr(r.tags), types: arr(r.types), stages: arr(r.stages),
    grades: arr(r.grades), sources: arr(r.sources), triggers: arr(r.triggers),
    waitingFor: one(r.waitingFor, ['', '1h', '4h', '24h'] as const, ''),
    idleFor: one(r.idleFor, ['', '1d', '3d', '7d'] as const, ''),
    window24: one(r.window24, ['', 'open', 'closed'] as const, ''),
    bot: one(r.bot, ['', 'with', 'without'] as const, ''),
    survey: one(r.survey, ['', 'with', 'without'] as const, ''),
    visitToday: r.visitToday === true, fromBroadcast: r.fromBroadcast === true,
  }
}

export const needsLeadInfo = (a: AdvFilters) => a.stages.length + a.grades.length + a.sources.length > 0

const HOUR = 3600000

/** Cliente falou por último? (a última mensagem é dele, não nossa). */
export function customerSpokeLast(c: { lastTime: Date; last_customer_message_at?: string }): number | null {
  if (!c.last_customer_message_at) return null
  const t = new Date(c.last_customer_message_at).getTime()
  if (!Number.isFinite(t)) return null
  return Math.abs(c.lastTime.getTime() - t) < 5000 ? t : null
}

export interface LeadInfo { status: string | null; custom_stage_id: string | null; grade: string | null; source: string | null }

interface ConvLike {
  lastTime: Date; status: string; assigned_user_id?: string; tags?: string[]; contact_type?: string; lead_id?: string
  bot_active?: boolean; satisfaction_score?: number | null; last_customer_message_at?: string
  capture_trigger_id?: string | null; broadcast_campaign_id?: string | null
}

export function matchesAdv(c: ConvLike, a: AdvFilters, ctx: { leadInfo: Record<string, LeadInfo>; visitsToday: Map<string, string> }, now = Date.now()): boolean {
  if (a.assignees.length && !a.assignees.includes(c.assigned_user_id || 'none')) return false
  if (a.tags.length && !(c.tags || []).some(t => a.tags.includes(t))) return false
  if (a.types.length && !a.types.includes(c.contact_type || 'other')) return false
  if (needsLeadInfo(a)) {
    const info = c.lead_id ? ctx.leadInfo[c.lead_id] : undefined
    if (!info) return false
    if (a.stages.length) {
      const key = info.custom_stage_id ? `x:${info.custom_stage_id}` : (info.status || '')
      if (!a.stages.includes(key)) return false
    }
    if (a.grades.length && !(info.grade && a.grades.includes(info.grade))) return false
    if (a.sources.length && !(info.source && a.sources.includes(info.source))) return false
  }
  if (a.triggers.length && !(c.capture_trigger_id && a.triggers.includes(c.capture_trigger_id))) return false
  if (a.waitingFor) {
    if (c.status === 'closed') return false
    const t = customerSpokeLast(c as any)
    const min = a.waitingFor === '1h' ? HOUR : a.waitingFor === '4h' ? 4 * HOUR : 24 * HOUR
    if (t === null || now - t < min) return false
  }
  if (a.idleFor) {
    const min = a.idleFor === '1d' ? 24 * HOUR : a.idleFor === '3d' ? 72 * HOUR : 168 * HOUR
    if (now - c.lastTime.getTime() < min) return false
  }
  if (a.window24) {
    const t = c.last_customer_message_at ? new Date(c.last_customer_message_at).getTime() : 0
    const open = t > 0 && now - t < 24 * HOUR
    if ((a.window24 === 'open') !== open) return false
  }
  if (a.bot && (a.bot === 'with') !== !!c.bot_active) return false
  if (a.survey && (a.survey === 'with') !== (c.satisfaction_score != null)) return false
  if (a.visitToday && !(c.lead_id && ctx.visitsToday.has(c.lead_id))) return false
  if (a.fromBroadcast && !c.broadcast_campaign_id) return false
  return true
}

// ── Peças visuais ───────────────────────────────────────────────────────────
const micro: React.CSSProperties = { fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 6px' }

function Pills<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void
}) {
  return (
    <div>
      <p style={micro}>{label}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(o => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v} style={{
            padding: '4px 11px', borderRadius: 9999, fontSize: 12, border: 'none', cursor: 'pointer',
            fontWeight: value === o.v ? 700 : 500, background: value === o.v ? '#05907B' : '#F0FDFB', color: value === o.v ? '#fff' : '#64748B',
          }}>{o.t}</button>
        ))}
      </div>
    </div>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#1A2B4A', cursor: 'pointer', padding: '6px 0' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#05907B' }} />
      {children}
    </label>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: '14px 16px', borderBottom: '1px solid #ECFDF5', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#00695F' }}>{title}</h3>
      {children}
    </section>
  )
}

export interface FilterOptions {
  attendants: Opt[]; tags: Opt[]; types: Opt[]; stages: Opt[]; grades: Opt[]; sources: Opt[]; triggers: Opt[]
}

export function ConversationFiltersPanel({ adv, onChange, onClose, resultCount, options, loadingLeads, canPickAttendant }: {
  adv: AdvFilters; onChange: (a: AdvFilters) => void; onClose: () => void; resultCount: number
  options: FilterOptions; loadingLeads: boolean; canPickAttendant: boolean
}) {
  const set = <K extends keyof AdvFilters>(k: K, v: AdvFilters[K]) => onChange({ ...adv, [k]: v })
  const n = advCount(adv)
  return (
    <div role="dialog" aria-label="Filtros da lista de conversas" style={{ position: 'absolute', inset: 0, zIndex: 40, background: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #D1FAE5', background: 'linear-gradient(135deg, #FFFFFF 0%, #F0FDFB 100%)' }}>
        <SlidersHorizontal size={18} color="#05907B" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>Filtros</p>
          <p style={{ margin: 0, fontSize: 11, color: '#64748B' }}>{n ? `${n} ativo${n > 1 ? 's' : ''} · ficam salvos para você` : 'Escolha o que quer ver na lista'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar filtros" style={{ display: 'flex', background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#64748B' }}><X size={20} /></button>
      </div>

      <div className="wa-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
        <Group title="Quem atende">
          {canPickAttendant && <MultiSelect label="Atendentes" options={options.attendants} value={adv.assignees} onChange={v => set('assignees', v)} placeholder="Todos" />}
          <Pills label="Robô" value={adv.bot} onChange={v => set('bot', v)} options={[{ v: '', t: 'Qualquer' }, { v: 'with', t: 'Com robô' }, { v: 'without', t: 'Sem robô' }]} />
        </Group>

        <Group title="Situação da conversa">
          <Pills label="Cliente esperando resposta há" value={adv.waitingFor} onChange={v => set('waitingFor', v)}
            options={[{ v: '', t: 'Qualquer' }, { v: '1h', t: '1 h' }, { v: '4h', t: '4 h' }, { v: '24h', t: '1 dia' }]} />
          <Pills label="Sem movimento há" value={adv.idleFor} onChange={v => set('idleFor', v)}
            options={[{ v: '', t: 'Qualquer' }, { v: '1d', t: '1 dia' }, { v: '3d', t: '3 dias' }, { v: '7d', t: '7 dias' }]} />
          <Pills label="Janela de 24 h" value={adv.window24} onChange={v => set('window24', v)}
            options={[{ v: '', t: 'Qualquer' }, { v: 'open', t: 'Aberta' }, { v: 'closed', t: 'Fechada' }]} />
        </Group>

        <Group title="Quem é a pessoa">
          <MultiSelect label="Etiquetas" options={options.tags} value={adv.tags} onChange={v => set('tags', v)} />
          <MultiSelect label="Tipo de contato" options={options.types} value={adv.types} onChange={v => set('types', v)} />
          <MultiSelect label="Etapa do funil" options={options.stages} value={adv.stages} onChange={v => set('stages', v)} />
          <MultiSelect label="Série" options={options.grades} value={adv.grades} onChange={v => set('grades', v)} />
          <MultiSelect label="Origem do lead" options={options.sources} value={adv.sources} onChange={v => set('sources', v)} />
          {loadingLeads && <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>Carregando dados dos leads…</p>}
          <Check checked={adv.visitToday} onChange={v => set('visitToday', v)}>Tem visita marcada para hoje</Check>
        </Group>

        <Group title="Como chegou">
          <MultiSelect label="Origem da Captação" options={options.triggers} value={adv.triggers} onChange={v => set('triggers', v)} />
          <Check checked={adv.fromBroadcast} onChange={v => set('fromBroadcast', v)}>Veio de uma transmissão</Check>
          <Pills label="Pesquisa de satisfação" value={adv.survey} onChange={v => set('survey', v)}
            options={[{ v: '', t: 'Qualquer' }, { v: 'with', t: 'Com nota' }, { v: 'without', t: 'Sem nota' }]} />
        </Group>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: 10, padding: '12px 16px', borderTop: '1px solid #D1FAE5', background: '#fff' }}>
        <button type="button" onClick={() => onChange(EMPTY_ADV)} disabled={!n} style={{
          padding: '10px 14px', borderRadius: 10, border: '1px solid #D1FAE5', background: '#fff', color: n ? '#1A2B4A' : '#94A3B8', fontSize: 13, fontWeight: 600, cursor: n ? 'pointer' : 'default',
        }}>Limpar tudo</button>
        <button type="button" onClick={onClose} style={{
          flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        }}>Ver {resultCount} conversa{resultCount === 1 ? '' : 's'}</button>
      </div>
    </div>
  )
}
