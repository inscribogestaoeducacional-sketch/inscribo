// Avisos no celular: liga/desliga neste aparelho e escolhe quais avisos receber.
import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { PUSH_CHANGED_EVENT, disablePush, enablePush, pushState, type PushState } from '../../lib/push'

interface Prefs { new_message: boolean; transfer: boolean; daily_reminder: number; can_reminder: boolean; role?: string; quiet_start?: number | null; quiet_end?: number | null }

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const sel: React.CSSProperties = { padding: '10px 12px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: BRAND.bg, color: BRAND.ink, fontSize: 14, fontFamily: 'inherit' }

function Switch({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="aion-tap"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', border: 'none', background: 'none', padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{label}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ width: 44, height: 26, borderRadius: 99, background: on ? 'var(--aion-grad)' : '#CBD5E1', position: 'relative', flexShrink: 0, transition: 'background .2s' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.25)', transition: 'left .2s' }} />
      </span>
    </button>
  )
}

export default function NotificationPrefs() {
  const [st, setSt] = useState<PushState>('sem_suporte')
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [off, setOff] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const refresh = useCallback(async () => { setSt(await pushState().catch(() => 'sem_suporte' as const)) }, [])
  useEffect(() => {
    refresh()
    supabase.rpc('push_prefs_get').then(({ data }) => { if (data) setPrefs(data as Prefs) })
    supabase.rpc('push_types_get').then(({ data }) => { if (Array.isArray(data)) setOff(data as string[]) })
    window.addEventListener(PUSH_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(PUSH_CHANGED_EVENT, refresh)
  }, [refresh])

  const save = async (p: Prefs) => {
    setPrefs(p)
    await supabase.rpc('push_prefs_set', { p_new_message: p.new_message, p_transfer: p.transfer, p_daily_reminder: p.daily_reminder })
  }
  const setType = async (t: string[], on: boolean) => {
    const next = on ? off.filter(x => !t.includes(x)) : Array.from(new Set([...off, ...t]))
    setOff(next)
    await supabase.rpc('push_types_set', { p_off: next })
  }
  const saveQuiet = async (start: number | null, end: number | null) => {
    if (!prefs) return
    // sem início, sem silêncio; com início e sem fim, usa 7h como padrão
    const e = start == null ? null : (end ?? 7)
    setPrefs({ ...prefs, quiet_start: start, quiet_end: e })
    await supabase.rpc('push_quiet_set', { p_start: start, p_end: e })
  }
  const toggleDevice = async () => {
    setBusy(true); setErr('')
    if (st === 'ativo') await disablePush()
    else { const r = await enablePush(); if (!r.ok) setErr(r.error || 'Não foi possível ativar.') }
    await refresh(); setBusy(false)
    window.dispatchEvent(new Event(PUSH_CHANGED_EVENT))
  }

  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 18, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }
  const msg = st === 'ativo' ? 'Este aparelho está recebendo avisos.'
    : st === 'bloqueado' ? 'As notificações estão bloqueadas neste navegador. Libere nas configurações do site.'
    : st === 'iphone_instalar' ? 'No iPhone, adicione a Áion à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá para ativar.'
    : st === 'sem_suporte' ? 'Este navegador não recebe avisos. Use o Chrome, Edge ou Safari atualizado.'
    : 'Ative para ser avisado de mensagens e transferências, mesmo com o app fechado.'

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ width: 36, height: 36, borderRadius: 12, background: BRAND.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bell size={18} color={BRAND.primaryDark} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Notificações</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>{msg}</div>
        </div>
      </div>
      {(st === 'ativo' || st === 'desligado') && (
        <button onClick={toggleDevice} disabled={busy} className="aion-tap"
          style={{ margin: '8px 0 4px', padding: '10px 16px', borderRadius: 12, border: st === 'ativo' ? `1px solid ${BRAND.line}` : 'none', background: st === 'ativo' ? '#fff' : 'var(--aion-grad)', color: st === 'ativo' ? BRAND.ink : '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? .7 : 1 }}>
          {st === 'ativo' ? 'Desligar neste aparelho' : 'Ativar neste aparelho'}
        </button>
      )}
      {err && <div style={{ fontSize: 12, color: '#B91C1C', fontWeight: 700, marginTop: 4 }}>{err}</div>}
      {prefs && (
        <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 10, paddingTop: 4 }}>
          <Switch on={prefs.new_message} onChange={v => save({ ...prefs, new_message: v })} label="Mensagem nova de cliente" sub="Quando um cliente escreve numa conversa que é sua" />
          <Switch on={prefs.transfer} onChange={v => save({ ...prefs, transfer: v })} label="Conversa transferida para mim" />
          <Switch on={!off.includes('lead_new')} onChange={v => setType(['lead_new'], v)} label="Lead novo" sub="Quando chega um lead para você (ou sem responsável, se você é gestor)" />
          <Switch on={!off.includes('visit_morning')} onChange={v => setType(['visit_morning', 'visit_soon'], v)} label="Visitas do dia" sub="De manhã e logo antes de cada visita" />
          <Switch on={!off.includes('conversation_taken')} onChange={v => setType(['conversation_taken'], v)} label="Conversa assumida" sub="Quando alguém assume uma conversa sua" />
          <Switch on={!off.includes('lead_unanswered')} onChange={v => setType(['lead_unanswered'], v)} label="Lead sem resposta" sub="Quando um lead fica mais de 2 horas sem receber mensagem da escola" />
          {prefs.role === 'admin' && (
            <Switch on={!off.includes('whatsapp_down')} onChange={v => setType(['whatsapp_down'], v)} label="WhatsApp desconectado" sub="Quando o número da escola cai" />
          )}
          {prefs.can_reminder && (
            <Switch on={!off.includes('exit_survey_answered')} onChange={v => setType(['exit_survey_answered'], v)} label="Pesquisa de saída respondida" sub="Quando uma família responde a pesquisa em Transferências" />
          )}
          {prefs.can_reminder && (
            <Switch on={!off.includes('enrolled')} onChange={v => setType(['enrolled'], v)} label="Matrícula confirmada" sub="Quando um lead vira matrícula" />
          )}
          {prefs.can_reminder && (
            <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 4, paddingTop: 12 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Lembrete “Dê uma olhadinha na Áion”</div>
              <div style={{ fontSize: 12, color: BRAND.muted, margin: '1px 0 8px' }}>Às 18h, se você não abriu a Áion no período.</div>
              <select value={prefs.daily_reminder} onChange={e => save({ ...prefs, daily_reminder: Number(e.target.value) })}
                style={{ width: '100%', maxWidth: 320, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: BRAND.bg, color: BRAND.ink, fontSize: 14, fontFamily: 'inherit' }}>
                <option value={0}>Desligado</option>
                <option value={1}>Todo dia que eu não abrir</option>
                <option value={2}>Se ficar 2 dias sem abrir</option>
                <option value={3}>Se ficar 3 dias sem abrir</option>
                <option value={5}>Se ficar 5 dias sem abrir</option>
                <option value={7}>Se ficar 7 dias sem abrir</option>
              </select>
            </div>
          )}
          <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 4, paddingTop: 12 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Horário de silêncio</div>
            <div style={{ fontSize: 12, color: BRAND.muted, margin: '1px 0 8px' }}>Neste período os avisos não tocam no celular; continuam no sino. Horário de Fortaleza.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <select aria-label="Início do silêncio" value={prefs.quiet_start ?? ''} onChange={e => saveQuiet(e.target.value === '' ? null : Number(e.target.value), prefs.quiet_end ?? null)} style={sel}>
                <option value="">Sem silêncio</option>
                {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
              </select>
              <span style={{ fontSize: 13, color: BRAND.muted }}>até</span>
              <select aria-label="Fim do silêncio" value={prefs.quiet_end ?? ''} disabled={prefs.quiet_start == null} onChange={e => saveQuiet(prefs.quiet_start ?? null, e.target.value === '' ? null : Number(e.target.value))} style={sel}>
                <option value="">--</option>
                {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
