// Configurações › E-mails do CRM: os e-mails automáticos de cada fase do funil.
// Liga/desliga, muda o "quantos dias depois", edita o texto e manda um teste para si mesmo.
import { useEffect, useMemo, useState } from 'react'
import { Mail, X, Send, CheckCircle2, AlertCircle, Clock, Lock, Edit2, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useIsMobile } from '../mobile/MobileShell'
import { BRAND, SHADOW } from '../../lib/brand'
import { STAGES } from '../shared/LeadModal'

interface Flow {
  key: string; stage: string; label: string; description: string | null; trigger_kind: string; builtin: boolean; enabled: boolean
  delay_days: number; subject: string; body: string; button_label: string | null; button_kind: string | null; sort: number; active_since: string | null
}
interface LogRow { id: string; lead_id: string; flow_key: string; to_email: string | null; status: string; error: string | null; created_at: string; school?: string }

const VARS: [string, string][] = [['{{nome}}', 'Nome do contato'], ['{{escola}}', 'Escola'], ['{{consultor}}', 'Consultor do lead'], ['{{valido_ate}}', 'Validade da proposta']]
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, fontSize: 16, color: BRAND.ink, background: '#fff', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 5 }
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function timing(f: Flow): string {
  const d = Number(f.delay_days)
  const dias = `${d} ${d === 1 ? 'dia' : 'dias'}`
  switch (f.trigger_kind) {
    case 'lead_created': return 'Na hora em que o lead entra'
    case 'stage_idle': return `${dias} parado na fase, sem contato registrado`
    case 'meeting_created': return 'Quando a reunião é agendada'
    case 'meeting_done': return `${dias} depois da reunião`
    case 'proposal_sent': return 'Junto com o PDF da proposta'
    case 'proposal_followup': return `${dias} depois de enviar a proposta`
    case 'proposal_expiring': return `${dias} antes de a proposta vencer`
    case 'stage_fechado': return 'Quando o lead vai para Fechado'
    case 'client_welcome': return 'Quando a implantação é paga'
    default: return ''
  }
}
const delayLabel = (k: string) => k === 'proposal_expiring' ? 'Quantos dias antes de vencer' : k === 'meeting_done' || k === 'proposal_followup' ? 'Quantos dias depois' : 'Quantos dias parado'

function Switch({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 48, height: 28, borderRadius: 99, border: 'none', padding: 3, background: on ? BRAND.primary : '#CBD5E1', cursor: disabled ? 'default' : 'pointer', transition: 'background .15s', flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
      <span style={{ display: 'block', width: 22, height: 22, borderRadius: 99, background: '#fff', transform: on ? 'translateX(20px)' : 'none', transition: 'transform .15s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

export default function CrmEmailFlows() {
  const mobile = useIsMobile()
  const { user } = useAuth()
  const [flows, setFlows] = useState<Flow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Flow | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const flash = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const load = async () => {
    const [f, l] = await Promise.all([
      supabase.from('crm_email_flows').select('*').order('sort'),
      supabase.from('crm_email_log').select('id,lead_id,flow_key,to_email,status,error,created_at').order('created_at', { ascending: false }).limit(15),
    ])
    setFlows((f.data as Flow[]) || [])
    const rows = (l.data as LogRow[]) || []
    if (rows.length) {
      const { data: leads } = await supabase.from('crm_leads').select('id,school_name').in('id', [...new Set(rows.map(r => r.lead_id))])
      const m = new Map((leads || []).map((x: any) => [x.id, x.school_name]))
      rows.forEach(r => { r.school = m.get(r.lead_id) as string })
    }
    setLogs(rows); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggle = async (f: Flow, on: boolean) => {
    setFlows(p => p.map(x => x.key === f.key ? { ...x, enabled: on } : x))
    const { error } = await supabase.from('crm_email_flows').update({ enabled: on, updated_by: user?.id ?? null }).eq('key', f.key)
    if (error) { flash(error.message, false); load(); return }
    flash(on ? 'E-mail ligado. Vale para leads e eventos a partir de agora.' : 'E-mail desligado.')
    load()
  }

  const groups = useMemo(() => STAGES.map(s => ({ stage: s, items: flows.filter(f => f.stage === s.id) })).filter(g => g.items.length), [flows])
  const total = flows.filter(f => !f.builtin).length
  const onCount = flows.filter(f => !f.builtin && f.enabled).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {toast && (
        <div role="status" style={{ position: 'fixed', top: 20, right: 20, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 14, background: toast.ok ? '#16A34A' : '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, boxShadow: SHADOW }}>
          {toast.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{toast.msg}
        </div>
      )}

      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, boxShadow: SHADOW }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color={BRAND.primary} />
          <b style={{ fontSize: 15, color: BRAND.ink }}>{onCount} de {total} e-mails automáticos ligados</b>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: BRAND.muted, lineHeight: 1.55 }}>
          Só envia se o lead tiver e-mail, no máximo 1 por dia para o mesmo lead, de segunda a sábado, das 8h às 18h. Para sozinho se o lead mudar de fase ou se alguém registrar contato com ele. Cada e-mail só vale para leads e eventos criados depois de ligado.
        </p>
      </div>

      {loading && <p style={{ color: BRAND.muted, fontSize: 14 }}>Carregando...</p>}

      {groups.map(({ stage, items }) => (
        <div key={stage.id} style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: SHADOW }}>
          <div style={{ padding: '10px 16px', background: stage.bg, borderBottom: `1px solid ${stage.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 99, background: stage.color }} />
            <b style={{ fontSize: 14, color: stage.color }}>{stage.label.replace(/ ?[✓🏫]/g, '')}</b>
          </div>
          {items.map((f, i) => (
            <div key={f.key} style={{ display: 'flex', alignItems: mobile ? 'flex-start' : 'center', gap: 12, padding: '14px 16px', borderTop: i ? `1px solid ${BRAND.line}` : 'none', flexDirection: mobile ? 'column' : 'row' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15, color: BRAND.ink }}>{f.label}</b>
                  {f.builtin && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: BRAND.muted, background: '#F1F5F9', borderRadius: 99, padding: '2px 8px' }}><Lock size={10} />Texto fixo</span>}
                </div>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={13} />{timing(f)}</p>
                {f.description && <p style={{ margin: '3px 0 0', fontSize: 12.5, color: BRAND.faint }}>{f.description}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: mobile ? '100%' : 'auto', justifyContent: mobile ? 'space-between' : 'flex-end' }}>
                {!f.builtin && <button type="button" onClick={() => setEdit(f)} style={{ minHeight: 40, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${BRAND.softLine}`, background: BRAND.softer, color: BRAND.primaryDark, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}><Edit2 size={14} />Editar</button>}
                {f.builtin
                  ? <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D' }}>Sempre ativo</span>
                  : <Switch on={f.enabled} onChange={v => toggle(f, v)} />}
              </div>
            </div>
          ))}
        </div>
      ))}

      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, boxShadow: SHADOW }}>
        <b style={{ fontSize: 15, color: BRAND.ink }}>Últimos envios</b>
        {logs.length === 0 && <p style={{ margin: '8px 0 0', fontSize: 13, color: BRAND.muted }}>Nenhum e-mail automático saiu ainda.</p>}
        {logs.map(r => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderTop: `1px solid ${BRAND.line}`, fontSize: 13, marginTop: 8 }}>
            <span style={{ color: BRAND.text, minWidth: 0 }}><b>{flows.find(f => f.key === r.flow_key)?.label || r.flow_key}</b> · {r.school || 'lead'}<br /><span style={{ color: BRAND.muted }}>{r.to_email}</span></span>
            <span style={{ textAlign: 'right', flexShrink: 0, color: r.status === 'error' ? '#B91C1C' : BRAND.muted }}>{r.status === 'error' ? 'Erro' : r.status === 'sent' ? 'Enviado' : 'Enviando'}<br />{when(r.created_at)}</span>
          </div>
        ))}
      </div>

      {edit && <FlowEditor flow={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); flash('E-mail salvo.'); load() }} />}
    </div>
  )
}

function FlowEditor({ flow, onClose, onSaved }: { flow: Flow; onClose: () => void; onSaved: () => void }) {
  const mobile = useIsMobile()
  const { user } = useAuth()
  const [f, setF] = useState({ delay: String(flow.delay_days), subject: flow.subject, body: flow.body, button_label: flow.button_label || '', button_kind: flow.button_kind || '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [testTo, setTestTo] = useState(user?.email || '')
  const hasDelay = ['stage_idle', 'meeting_done', 'proposal_followup', 'proposal_expiring'].includes(flow.trigger_kind)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))
  const addVar = (v: string) => set('body', f.body + v)
  const sample = (t: string) => t.replace(/\{\{\s*nome\s*\}\}/g, 'Maria').replace(/\{\{\s*escola\s*\}\}/g, 'Colégio Exemplo').replace(/\{\{\s*consultor\s*\}\}/g, (user as any)?.full_name || 'Seu consultor').replace(/\{\{\s*valido_ate\s*\}\}/g, '04 de novembro de 2026')

  const save = async () => {
    if (!f.subject.trim() || !f.body.trim()) { setMsg({ t: 'Preencha o assunto e o texto.', ok: false }); return }
    const d = parseFloat(f.delay.replace(',', '.'))
    if (hasDelay && !(d >= 0)) { setMsg({ t: 'Informe os dias (pode ser 0).', ok: false }); return }
    setBusy(true)
    const { error } = await supabase.from('crm_email_flows').update({
      subject: f.subject.trim(), body: f.body.trim(), delay_days: hasDelay ? d : flow.delay_days,
      button_label: f.button_label.trim() || null, button_kind: f.button_label.trim() ? (f.button_kind || null) : null, updated_by: user?.id ?? null,
    }).eq('key', flow.key)
    setBusy(false)
    if (error) { setMsg({ t: error.message, ok: false }); return }
    onSaved()
  }

  const test = async () => {
    setBusy(true); setMsg(null)
    const r = await supabase.functions.invoke('crm-email-flow', { body: { test: true, to: testTo, subject: f.subject, body: f.body, button_label: f.button_label || null, button_kind: f.button_kind || null } })
    setBusy(false)
    const err = r.error?.message || (r.data as any)?.error
    setMsg(err ? { t: `Não saiu: ${err}`, ok: false } : { t: `Teste enviado para ${testTo}. Olhe a caixa de entrada e o spam.`, ok: true })
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 300, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: mobile ? '100%' : 'min(640px,100%)', maxHeight: mobile ? '100dvh' : '94vh', height: mobile ? '100dvh' : 'auto', background: BRAND.bg, borderRadius: mobile ? 0 : 22, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(15,23,42,.5)' }}>
        <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mail size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{flow.label}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.9 }}>{timing({ ...flow, delay_days: parseFloat(f.delay.replace(',', '.')) || 0 })}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {msg && <div role="alert" style={{ display: 'flex', gap: 8, background: msg.ok ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}`, color: msg.ok ? '#15803D' : '#B91C1C', borderRadius: 12, padding: 12, fontSize: 13 }}>{msg.ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}{msg.t}</div>}

          {hasDelay && <div style={{ maxWidth: 220 }}><label style={label}>{delayLabel(flow.trigger_kind)}</label><input style={input} inputMode="decimal" value={f.delay} onChange={e => set('delay', e.target.value.replace(/[^\d.,]/g, ''))} /></div>}

          <div><label style={label}>Assunto</label><input style={input} value={f.subject} onChange={e => set('subject', e.target.value)} /></div>

          <div>
            <label style={label}>Texto do e-mail (linha em branco separa os parágrafos)</label>
            <textarea rows={9} style={{ ...input, height: 'auto', padding: 12, resize: 'vertical', lineHeight: 1.55 }} value={f.body} onChange={e => set('body', e.target.value)} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {VARS.map(([v, l]) => <button key={v} type="button" onClick={() => addVar(v)} title={l} style={{ border: `1px solid ${BRAND.softLine}`, background: BRAND.softer, color: BRAND.primaryDark, borderRadius: 99, padding: '5px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{v}</button>)}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: BRAND.muted }}>Toque numa variável para colocar no fim do texto. O e-mail termina sozinho com "Um abraço" e o nome do consultor do lead.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <div><label style={label}>Texto do botão (vazio = sem botão)</label><input style={input} value={f.button_label} onChange={e => set('button_label', e.target.value)} /></div>
            <div><label style={label}>O botão leva para</label>
              <select style={input} value={f.button_kind} onChange={e => set('button_kind', e.target.value)}>
                <option value="">Sem botão</option><option value="whatsapp">WhatsApp do consultor</option>
                {flow.trigger_kind.startsWith('proposal') && <option value="proposal">PDF da proposta</option>}
              </select></div>
          </div>

          <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: BRAND.muted }}>Como a Maria, do Colégio Exemplo, vê</p>
            <p style={{ margin: '8px 0 10px', fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{sample(f.subject)}</p>
            {sample(f.body).split(/\n\s*\n/).map((p, i) => <p key={i} style={{ margin: '0 0 10px', fontSize: 14, color: BRAND.text, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p}</p>)}
            {f.button_label.trim() && f.button_kind && <span style={{ display: 'inline-block', background: BRAND.primary, color: '#fff', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700 }}>{sample(f.button_label)}</span>}
          </div>

          <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14 }}>
            <label style={label}>Enviar um teste para</label>
            <div style={{ display: 'flex', gap: 8, flexDirection: mobile ? 'column' : 'row' }}>
              <input style={input} type="email" value={testTo} onChange={e => setTestTo(e.target.value)} />
              <button type="button" onClick={test} disabled={busy || !testTo.includes('@')} style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: `1.5px solid ${BRAND.primary}`, background: '#fff', color: BRAND.primaryDark, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap', opacity: busy ? 0.6 : 1 }}><Send size={15} />Enviar teste</button>
            </div>
            <p style={hintStyle}>O teste sai com o texto que está na tela, mesmo sem salvar.</p>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${BRAND.line}`, background: '#fff', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="button" onClick={save} disabled={busy} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.7 : 1 }}><CheckCircle2 size={16} />Salvar e-mail</button>
        </div>
      </div>
    </div>
  )
}
const hintStyle: React.CSSProperties = { margin: '6px 0 0', fontSize: 12, color: BRAND.muted }
