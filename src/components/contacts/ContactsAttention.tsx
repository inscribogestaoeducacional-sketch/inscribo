// Faixa de atenção da tela de Contatos + painéis para resolver cada pendência
// ali mesmo. Fonte: RPCs contacts_attention / contacts_suggest / contacts_apply /
// contacts_from_leads. Nada é salvo sem a pessoa confirmar.
import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, GitMerge, HelpCircle, Link2Off, Plug, UserRoundX, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

export type ContactAttentionKey = 'name' | 'dup' | 'rel' | 'nolead' | 'api'
interface Counts { sem_nome: number; duplicados: number; sem_relacao: number; sem_lead: number; api_resp: number }
interface Sug {
  contact_id: string; phone: string; name: string | null; last_seen_at: string | null
  sug_name: string | null; sug_lead_id: string | null; sug_lead_status: string | null
  sug_student: string | null; sug_source: 'lead' | 'api' | null
}

const STAGE: Record<string, string> = { new: 'Novo', contact: 'Em contato', scheduled: 'Visita agendada', visit: 'Visitou', proposal: 'Proposta', enrolled: 'Matriculado', lost: 'Perdido' }

export function useContactsAttention(institutionId: string | null | undefined) {
  const [counts, setCounts] = useState<Counts | null>(null)
  const refresh = useCallback(async () => {
    if (!institutionId) return
    const { data, error } = await supabase.rpc('contacts_attention', { p_inst: institutionId })
    if (error) { console.error('[contacts_attention]', error); return }
    setCounts(((data ?? []) as Counts[])[0] ?? null)
  }, [institutionId])
  useEffect(() => { refresh() }, [refresh])
  return { counts, refresh }
}

function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '').replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}
const num = (n: number) => n.toLocaleString('pt-BR')

export function ContactsAttentionStrip({ counts, active, onPick }: { counts: Counts | null; active: ContactAttentionKey | null; onPick: (k: ContactAttentionKey | null) => void }) {
  const c = counts ?? { sem_nome: 0, duplicados: 0, sem_relacao: 0, sem_lead: 0, api_resp: 0 }
  const items: { key: ContactAttentionKey; label: string; value: number; sub: string; color: string; icon: any; alert?: boolean }[] = [
    { key: 'name', label: 'Sem nome', value: c.sem_nome, sub: 'só o número aparece', color: '#B91C1C', icon: UserRoundX, alert: c.sem_nome > 0 },
    { key: 'dup', label: 'Duplicados', value: c.duplicados, sub: 'telefones repetidos', color: '#B45309', icon: GitMerge },
    { key: 'rel', label: 'Sem relação', value: c.sem_relacao, sub: 'quem é esse contato?', color: '#6366F1', icon: HelpCircle },
    { key: 'nolead', label: 'Leads sem contato', value: c.sem_lead, sub: 'falta o WhatsApp deles', color: '#5B6B86', icon: Link2Off },
    { key: 'api', label: 'Responsáveis da API', value: c.api_resp, sub: 'já estão nos contatos', color: '#007A6E', icon: Plug },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
      {items.map((it, i) => {
        const on = active === it.key
        const Icon = it.icon
        return (
          <button key={it.key} type="button" className={`ld-kpi ld-in ${it.alert && !on ? 'ld-alert' : ''}`} data-on={on ? '1' : '0'}
            onClick={() => onPick(on ? null : it.key)} aria-pressed={on}
            style={{ animationDelay: `${i * 50}ms`, background: on ? '#F0FDFB' : '#fff', borderRadius: 14, padding: '10px 12px', border: `${it.alert || on ? 2 : 1}px solid ${on ? BRAND.primary : it.alert ? '#EF4444' : BRAND.line}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: it.color, textTransform: 'uppercase', letterSpacing: '.02em' }}><Icon size={13} />{it.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: it.alert ? '#B91C1C' : BRAND.ink, lineHeight: 1.2 }}>{num(it.value)}</div>
            <div style={{ fontSize: 11.5, color: '#5B6B86' }}>{it.sub}</div>
          </button>
        )
      })}
    </div>
  )
}

const btn = (kind: 'main' | 'ghost'): React.CSSProperties => kind === 'main'
  ? { background: BRAND.primary, color: '#fff', border: 'none', borderRadius: 9, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }
  : { background: '#fff', color: BRAND.muted, border: `1px solid ${BRAND.line}`, borderRadius: 9, padding: '6px 11px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }

export function ContactsResolvePanel({ kind, institutionId, counts, onClose, onChanged, onOpenDuplicates, onOpenLead, toast }: {
  kind: ContactAttentionKey; institutionId: string; counts: Counts | null
  onClose: () => void; onChanged: () => void; onOpenDuplicates: () => void; onOpenLead: (leadId: string) => void
  toast: (msg: string, type: 'error' | 'success') => void
}) {
  const sugKind = kind === 'name' ? 'name' : kind === 'rel' ? 'relation' : null
  const [rows, setRows] = useState<Sug[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [typed, setTyped] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!sugKind) return
    setLoading(true)
    const { data, error } = await supabase.rpc('contacts_suggest', { p_inst: institutionId, p_kind: sugKind, p_limit: 40 })
    setLoading(false)
    if (error) { toast('Não consegui carregar as sugestões: ' + error.message, 'error'); return }
    setRows((data ?? []) as Sug[])
  }, [institutionId, sugKind, toast])
  useEffect(() => { load() }, [load])

  const apply = async (r: Sug, action: string, name?: string | null, lead?: string | null, okMsg?: string) => {
    setBusy(r.contact_id)
    const { error } = await supabase.rpc('contacts_apply', { p_inst: institutionId, p_contact: r.contact_id, p_action: action, p_name: name ?? null, p_lead: lead ?? null })
    setBusy(null)
    if (error) { toast('Não consegui salvar: ' + error.message, 'error'); return }
    setRows(prev => prev.filter(x => x.contact_id !== r.contact_id))
    if (okMsg) toast(okMsg, 'success')
    onChanged()
  }

  const createFromLeads = async () => {
    setBusy('leads')
    const { data, error } = await supabase.rpc('contacts_from_leads', { p_inst: institutionId })
    setBusy(null)
    if (error) { toast('Não consegui criar os contatos: ' + error.message, 'error'); return }
    const r = ((data ?? []) as { linked: number; created: number }[])[0]
    const total = (r?.linked ?? 0) + (r?.created ?? 0)
    toast(total ? `${r?.linked ?? 0} vinculado${r?.linked === 1 ? '' : 's'} e ${r?.created ?? 0} criado${r?.created === 1 ? '' : 's'}.` : 'Nenhum lead tinha telefone válido para virar contato.', total ? 'success' : 'error')
    onChanged()
  }

  const wrap: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, overflow: 'hidden' }
  const head = (title: string, hint: string) => (
    <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderBottom: '1px solid #EEF2F1' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{title}</div>
        <div style={{ fontSize: 12, color: BRAND.muted }}>{hint}</div>
      </div>
      <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 4 }}><X size={14} />Fechar</button>
    </div>
  )

  if (kind === 'dup') return (
    <div className="ld-in" style={wrap}>
      {head('Telefones repetidos', 'Dois contatos com o mesmo número. Você escolhe qual fica e confirma a mesclagem.')}
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <AlertTriangle size={18} color="#B45309" />
        <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: BRAND.ink }}>{counts?.duplicados ?? 0} grupo{counts?.duplicados === 1 ? '' : 's'} para revisar. Fica o contato com conversa, mais etiquetas e contato mais recente; dá para trocar antes de confirmar.</div>
        <button type="button" style={btn('main')} onClick={onOpenDuplicates}>Revisar duplicados</button>
      </div>
    </div>
  )

  if (kind === 'api') return (
    <div className="ld-in" style={{ ...wrap, background: '#F0FDFB', borderColor: '#99F6E4' }}>
      {head('Responsáveis da API', 'Vêm da integração de alunos e ficam sincronizados.')}
      <div style={{ padding: 14, fontSize: 13, color: '#065F52', display: 'flex', gap: 8, alignItems: 'center' }}>
        <CheckCircle2 size={16} />{num(counts?.api_resp ?? 0)} responsáveis da integração já estão nos contatos, com a relação com a escola atualizada.
      </div>
    </div>
  )

  if (kind === 'nolead') return (
    <div className="ld-in" style={wrap}>
      {head('Leads sem contato', 'Cada lead precisa de um contato para a conversa e o histórico ficarem juntos.')}
      <div style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, fontSize: 13, color: BRAND.ink }}>{counts?.sem_lead ?? 0} lead{counts?.sem_lead === 1 ? '' : 's'} sem contato. Se o telefone já existe nos contatos, o vínculo é feito; se não, o contato é criado. Lead sem telefone válido continua de fora.</div>
        <button type="button" style={btn('main')} disabled={busy === 'leads' || !counts?.sem_lead} onClick={createFromLeads}>{busy === 'leads' ? 'Criando...' : 'Vincular e criar'}</button>
      </div>
    </div>
  )

  const isName = kind === 'name'
  return (
    <div className="ld-in" style={wrap}>
      {head(isName ? 'Completar nomes' : 'Quem é esse contato?', isName ? 'Sugestões do lead ou do responsável na integração. Nada é salvo sem confirmar.' : 'Contatos sem lead e sem relação com a escola. Os que têm sugestão aparecem primeiro.')}
      {loading && <div style={{ padding: 20, textAlign: 'center', fontSize: 13, color: BRAND.faint }}>Carregando...</div>}
      {!loading && rows.length === 0 && <div style={{ padding: 22, textAlign: 'center', fontSize: 13, color: BRAND.faint }}>Tudo resolvido por aqui.</div>}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {rows.map((r, i) => {
          const hasSug = isName ? !!r.sug_name : !!r.sug_lead_id
          const typedName = typed[r.contact_id] ?? ''
          return (
            <div key={r.contact_id} className="ld-row ld-in" style={{ animationDelay: `${Math.min(i, 10) * 25}ms`, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid #F1F5F4', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 190 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{r.name && !/^[\d+\s()-]+$/.test(r.name) ? r.name : fmtPhone(r.phone)} <span style={{ fontWeight: 400, color: BRAND.muted }}>· {fmtPhone(r.phone)}</span></div>
                {hasSug ? (
                  <div style={{ fontSize: 12, color: '#B45309' }}>
                    {r.sug_source === 'lead' ? 'Parece ser o lead' : 'Responsável na integração'}{r.sug_name ? ` ${r.sug_name}` : ''}{r.sug_student ? ` (aluno ${r.sug_student})` : ''}{r.sug_lead_status ? ` · ${STAGE[r.sug_lead_status] ?? r.sug_lead_status}` : ''}
                  </div>
                ) : <div style={{ fontSize: 12, color: BRAND.faint }}>Sem sugestão automática.</div>}
              </div>
              {isName && !r.sug_name && (
                <input value={typedName} onChange={e => setTyped(p => ({ ...p, [r.contact_id]: e.target.value }))} placeholder="Digitar o nome" style={{ border: `1px solid ${BRAND.line}`, borderRadius: 9, padding: '6px 10px', fontSize: 12.5, width: 160 }} />
              )}
              {isName && (r.sug_name || typedName.trim()) && (
                <button type="button" style={btn('main')} disabled={busy === r.contact_id} onClick={() => apply(r, 'name', r.sug_name || typedName, null, 'Nome salvo.')}>Salvar nome</button>
              )}
              {!isName && r.sug_lead_id && (
                <>
                  <button type="button" style={btn('ghost')} onClick={() => onOpenLead(r.sug_lead_id!)}>Ver lead</button>
                  <button type="button" style={btn('main')} disabled={busy === r.contact_id} onClick={() => apply(r, 'lead', r.sug_name, r.sug_lead_id, 'Contato vinculado ao lead.')}>Vincular ao lead</button>
                </>
              )}
              <button type="button" style={btn('ghost')} disabled={busy === r.contact_id} onClick={() => apply(r, isName ? 'dismiss_name' : 'dismiss_relation')}>Deixar assim</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
