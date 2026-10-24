// Cartão "Sequência" no painel da conversa: o atendente/gestor coloca o lead na sequência de
// mensagens, vê em que passo está e pode pausar, pular, enviar agora ou tirar.
import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Repeat, Pause, Play, SkipForward, Send, X, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { SEQ_DEFAULT_STEPS, SEQ_MAX_STEPS, type SeqStep } from '../../lib/leadSequence'

type Enr = { id: string; status: string; step: number; next_due_at: string; last_sent_at: string | null; end_reason: string | null; ended_at: string | null }
const card: CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, boxShadow: '0 1px 2px rgba(26,43,74,.04)', flexShrink: 0 }
const btn = (tone: string = BRAND.primaryDark): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 5, border: `1px solid ${BRAND.line}`, background: '#fff', color: tone, borderRadius: 10, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })
const DAY = 86400000

export default function LeadSequenceCard({ institutionId, leadId, phone, leadStatus, userId }: { institutionId: string; leadId: string; phone: string; leadStatus?: string; userId?: string }) {
  const [enr, setEnr] = useState<Enr | null>(null)
  const [cfg, setCfg] = useState<{ enabled: boolean; steps: SeqStep[] } | null | undefined>(undefined)
  const [sentTotal, setSentTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [c, e, l] = await Promise.all([
      supabase.from('lead_sequence_config').select('enabled, steps').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('lead_sequence_enrollments').select('id, status, step, next_due_at, last_sent_at, end_reason, ended_at').eq('lead_id', leadId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('lead_sequence_log').select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('status', 'sent'),
    ])
    if (c.error || e.error) { setCfg(null); return }
    setCfg(c.data ? { enabled: !!c.data.enabled, steps: Array.isArray(c.data.steps) && c.data.steps.length ? c.data.steps : SEQ_DEFAULT_STEPS } : { enabled: false, steps: SEQ_DEFAULT_STEPS })
    setEnr((e.data as Enr) || null); setSentTotal(l.count || 0)
  }, [institutionId, leadId])
  useEffect(() => { setMsg(''); load() }, [load])

  if (cfg === undefined || cfg === null) return null
  const steps = cfg.steps.slice(0, SEQ_MAX_STEPS)
  const open = enr && (enr.status === 'active' || enr.status === 'paused')
  const closedLead = leadStatus === 'enrolled' || leadStatus === 'lost'
  if (!cfg.enabled && !open) return null

  const run = async (fn: () => Promise<any>) => { setBusy(true); setMsg(''); try { await fn() } catch (e: any) { setMsg(e?.message || 'Não foi possível') } await load(); setBusy(false) }
  const due = (days: number) => new Date(Date.now() + days * DAY).toISOString()
  const left = Math.max(0, SEQ_MAX_STEPS - sentTotal)

  const enroll = () => run(async () => {
    const { error } = await supabase.from('lead_sequence_enrollments').insert({ institution_id: institutionId, lead_id: leadId, phone, status: 'active', step: 0, started_by: userId || null, next_due_at: due(steps[0].days) })
    if (error) throw new Error(error.code === '23505' ? 'Este lead já está na sequência.' : error.message)
  })
  const upd = (patch: Record<string, any>) => run(async () => { const { error } = await supabase.from('lead_sequence_enrollments').update(patch).eq('id', enr!.id); if (error) throw error })
  const stop = () => upd({ status: 'stopped', end_reason: 'retirado pela equipe', ended_at: new Date().toISOString() })
  const pause = () => upd({ status: 'paused' })
  const resume = () => upd({ status: 'active', next_due_at: due(steps[enr!.step]?.days || 1) })
  const skip = () => {
    const n = enr!.step + 1
    return n >= steps.length ? upd({ step: n, status: 'finished', end_reason: 'sequência concluída', ended_at: new Date().toISOString() }) : upd({ step: n, next_due_at: due(steps[n].days) })
  }
  const sendNow = () => run(async () => {
    const { data, error } = await supabase.functions.invoke('lead-sequence', { body: { enrollment_id: enr!.id } })
    if (error) throw error
    const r = data?.out?.[0]
    if (data?.error) throw new Error(data.error)
    setMsg(r?.sent ? 'Mensagem enviada.' : r?.skip ? `Não enviou: ${r.skip}.` : r?.failed ? 'A Meta recusou o envio.' : 'Nada foi enviado.')
  })

  const when = (iso: string) => { const d = Math.ceil((new Date(iso).getTime() - Date.now()) / DAY); return d <= 0 ? 'hoje' : d === 1 ? 'amanhã' : `em ${d} dias` }
  const ended: Record<string, string> = { replied: 'O lead respondeu e saiu da sequência.', finished: 'Sequência concluída.', stopped: enr?.end_reason ? `Saiu da sequência: ${enr.end_reason}.` : 'Saiu da sequência.' }

  return (
    <div className="ld-in" style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: BRAND.softer, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Repeat size={15} /></span>
        <b style={{ flex: 1, fontSize: 13.5, color: BRAND.ink }}>Sequência de mensagens</b>
        {busy && <Loader2 size={14} className="animate-spin" color={BRAND.primary} />}
      </div>
      {open ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: BRAND.ink }}>
            <b>Passo {Math.min(enr!.step + 1, steps.length)} de {steps.length}</b>
            {enr!.status === 'paused' ? <span style={{ color: '#B45309' }}> · pausada</span> : <span style={{ color: '#64748B' }}> · próximo envio {when(enr!.next_due_at)}</span>}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>{sentTotal} de {SEQ_MAX_STEPS} mensagens já enviadas a este lead. Se ele responder, sai da sequência sozinho.</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {enr!.status === 'active' ? <button style={btn()} disabled={busy} onClick={pause}><Pause size={13} /> Pausar</button> : <button style={btn()} disabled={busy} onClick={resume}><Play size={13} /> Retomar</button>}
            {enr!.status === 'active' && <button style={btn()} disabled={busy} onClick={sendNow}><Send size={13} /> Enviar agora</button>}
            <button style={btn()} disabled={busy} onClick={skip}><SkipForward size={13} /> Pular passo</button>
            <button style={btn('#DC2626')} disabled={busy} onClick={stop}><X size={13} /> Tirar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {enr && ended[enr.status] && <div style={{ fontSize: 12, color: '#64748B' }}>{ended[enr.status]}</div>}
          {closedLead ? <div style={{ fontSize: 12, color: '#64748B' }}>Lead {leadStatus === 'enrolled' ? 'matriculado' : 'perdido'}: não entra na sequência.</div>
            : left <= 0 ? <div style={{ fontSize: 12, color: '#64748B' }}>Este lead já recebeu as {SEQ_MAX_STEPS} mensagens da sequência.</div>
            : <>
              <div style={{ fontSize: 12, color: '#64748B' }}>Para lead que parou de responder: {steps.length} {steps.length === 1 ? 'mensagem' : 'mensagens'}, a primeira {steps[0].days === 1 ? 'em 1 dia' : `em ${steps[0].days} dias`}.</div>
              <button style={{ ...btn('#fff'), background: BRAND.primary, border: 'none', alignSelf: 'flex-start' }} disabled={busy} onClick={enroll}><Repeat size={13} /> Colocar na sequência</button>
            </>}
        </div>
      )}
      {msg && <div style={{ marginTop: 8, fontSize: 12, color: BRAND.primaryDark }}>{msg}</div>}
    </div>
  )
}
