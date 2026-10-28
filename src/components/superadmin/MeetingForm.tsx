// Reunião do lead (CRM comercial): agenda no Google Agenda com Meet, convida os participantes por e-mail
// (o próprio Google envia, no formato padrão) e gera o checklist de lembretes (feito no banco).
// Cada reunião tem a sua configuração: tipo, participantes, enviar convite ou não e mensagem do convite.
import { useState } from 'react'
import { X, Video, Phone, Users, AlertCircle, CheckCircle2, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useIsMobile } from '../mobile/MobileShell'
import { createGoogleMeet, buildEndDatetime } from '../../lib/googleMeet'
import AttendeesPicker from '../shared/AttendeesPicker'
import { BRAND } from '../../lib/brand'
import { toLocalInput, type Lead } from '../shared/LeadModal'

export const MEETING_KINDS = [
  { v: 'apresentacao', l: 'Apresentação' },
  { v: 'implantacao', l: 'Implantação' },
  { v: 'acompanhamento', l: 'Acompanhamento' },
  { v: 'outro', l: 'Outra' },
] as const
export type MeetingKind = (typeof MEETING_KINDS)[number]['v']

export interface Meeting {
  id: string; lead_id: string; title: string; type: 'video' | 'phone' | 'presential'
  kind?: MeetingKind; scheduled_at: string; duration_min: number
  meet_link?: string | null; google_event_id?: string | null; calendar_link?: string | null
  attendees: string[]; status: 'scheduled' | 'completed' | 'cancelled'; notes?: string | null
  send_invite?: boolean; invite_message?: string | null
  confirmation?: 'pending' | 'confirmed' | 'no_answer' | 'reschedule'; confirmed_at?: string | null
}

const kindLabel = (k?: string) => MEETING_KINDS.find(x => x.v === k)?.l || 'Reunião'
const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, fontSize: 16, color: BRAND.ink, background: '#fff', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 5 }

/** Cancela o evento no Google (o Google avisa os participantes). Não falha a ação principal. */
export async function cancelGoogleEvent(m: Pick<Meeting, 'google_event_id' | 'send_invite'>): Promise<string | null> {
  if (!m.google_event_id) return null
  const r = await createGoogleMeet({ action: 'cancel', event_id: m.google_event_id, send_updates: m.send_invite !== false })
  return r.error || null
}

export default function MeetingForm({ lead, meeting, consultants, defaultKind, onClose, onSaved }: {
  lead: Lead; meeting?: Meeting | null; consultants: { id: string; full_name: string; email: string }[]
  defaultKind?: MeetingKind; onClose: () => void; onSaved: (warning?: string) => void
}) {
  const mobile = useIsMobile()
  const { user } = useAuth()
  const isNew = !meeting?.id
  const [form, setForm] = useState(() => {
    const kind = (meeting?.kind || defaultKind || 'apresentacao') as MeetingKind
    return {
      kind,
      title: meeting?.title || `${kindLabel(kind)} — ${lead.school_name}`,
      type: (meeting?.type || 'video') as Meeting['type'],
      scheduled_at: toLocalInput(meeting?.scheduled_at),
      duration_min: meeting?.duration_min ?? 30,
      meet_link: meeting?.meet_link || '',
      attendees: (meeting?.attendees || []) as string[],
      send_invite: meeting?.send_invite ?? true,
      invite_message: meeting?.invite_message || '',
      notes: meeting?.notes || '',
      status: (meeting?.status || 'scheduled') as Meeting['status'],
    }
  })
  const [titleTouched, setTitleTouched] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  const pickKind = (k: MeetingKind) => setForm(f => ({ ...f, kind: k, title: titleTouched ? f.title : `${kindLabel(k)} — ${lead.school_name}` }))
  const clientEmail = lead.email || ''
  const hasGuests = form.attendees.length > 0

  const save = async () => {
    if (!form.scheduled_at) { setError('Escolha a data e a hora da reunião.'); return }
    setSaving(true); setError('')
    const startIso = new Date(form.scheduled_at).toISOString()
    const endIso = buildEndDatetime(startIso, form.duration_min)
    let meet_link = form.meet_link || null
    let google_event_id = meeting?.google_event_id || null
    let calendar_link = meeting?.calendar_link || null
    let warning = ''

    const description = [
      form.invite_message.trim(),
      `Escola: ${lead.school_name}`,
      form.type === 'presential' ? 'Reunião presencial.' : form.type === 'phone' ? 'Reunião por telefone.' : '',
      'Reunião organizada pela equipe Áion Edu.',
    ].filter(Boolean).join('\n\n')

    // Videoconferência: Google Agenda + Meet (convite sai por e-mail para os participantes)
    if (form.type === 'video') {
      const cancelled = form.status === 'cancelled'
      if (cancelled && google_event_id) {
        const e = await cancelGoogleEvent({ google_event_id, send_invite: form.send_invite })
        if (e) warning = `Reunião salva, mas não consegui cancelar no Google Agenda: ${e}`
        google_event_id = null; calendar_link = null
      } else if (!cancelled) {
        const r = await createGoogleMeet({
          action: google_event_id ? 'update' : 'create', event_id: google_event_id,
          title: form.title, description, start_datetime: startIso, end_datetime: endIso,
          attendees: form.attendees, send_updates: form.send_invite,
        })
        if (r.error) warning = `Reunião salva, mas o Google Agenda não respondeu: ${r.error}. Abra a reunião e salve de novo para tentar outra vez, ou cole o link do Meet.`
        else { meet_link = r.meet_link || meet_link; google_event_id = r.event_id || google_event_id; calendar_link = r.calendar_link || calendar_link }
      }
    }

    const payload = {
      lead_id: lead.id, title: form.title, type: form.type, kind: form.kind, scheduled_at: startIso, duration_min: form.duration_min,
      meet_link, google_event_id, calendar_link, attendees: form.attendees, notes: form.notes || null, status: form.status,
      send_invite: form.send_invite, invite_message: form.invite_message || null, updated_at: new Date().toISOString(),
    }
    const res = isNew
      ? await supabase.from('crm_meetings').insert({ ...payload, created_by: user?.id ?? null, created_at: new Date().toISOString() })
      : await supabase.from('crm_meetings').update(payload).eq('id', meeting!.id)
    setSaving(false)
    if (res.error) { setError(`Não foi possível salvar: ${res.error.message}`); return }
    onSaved(warning || undefined)
  }

  const typeBtn = (v: Meeting['type'], l: string, Ic: any) => (
    <button key={v} type="button" onClick={() => set('type', v)} style={{ flex: 1, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: `2px solid ${form.type === v ? BRAND.primary : BRAND.line}`, background: form.type === v ? BRAND.softer : '#fff', color: form.type === v ? BRAND.primaryDark : BRAND.muted }}><Ic size={15} />{l}</button>
  )

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 300, display: 'flex', alignItems: mobile ? 'stretch' : 'center', justifyContent: 'center', padding: mobile ? 0 : 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: mobile ? '100%' : 'min(560px,100%)', maxHeight: mobile ? '100dvh' : '92vh', height: mobile ? '100dvh' : 'auto', background: '#fff', borderRadius: mobile ? 0 : 22, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 60px -20px rgba(15,23,42,.5)' }}>
        <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>{isNew ? 'Nova reunião' : 'Editar reunião'}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.9 }}>{lead.school_name}</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ display: 'flex', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 12, fontSize: 13 }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{error}</div>}

          <div>
            <label style={label}>Tipo de reunião</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {MEETING_KINDS.map(k => (
                <button key={k.v} type="button" onClick={() => pickKind(k.v)} style={{ minHeight: 40, borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `2px solid ${form.kind === k.v ? BRAND.primary : BRAND.line}`, background: form.kind === k.v ? BRAND.softer : '#fff', color: form.kind === k.v ? BRAND.primaryDark : BRAND.muted }}>{k.l}</button>
              ))}
            </div>
          </div>

          <div><label style={label}>Título</label><input style={input} value={form.title} onChange={e => { setTitleTouched(true); set('title', e.target.value) }} /></div>

          <div>
            <label style={label}>Como vai ser</label>
            <div style={{ display: 'flex', gap: 8 }}>{typeBtn('video', 'Vídeo (Meet)', Video)}{typeBtn('phone', 'Telefone', Phone)}{typeBtn('presential', 'Presencial', Users)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 140px', gap: 12 }}>
            <div><label style={label}>Data e hora *</label><input style={input} type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} /></div>
            <div><label style={label}>Duração</label>
              <select style={input} value={form.duration_min} onChange={e => set('duration_min', Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select></div>
          </div>

          <div>
            <label style={label}>Quem participa (cada um recebe o convite por e-mail)</label>
            <AttendeesPicker clientEmail={clientEmail} consultants={consultants} value={form.attendees} onChange={v => set('attendees', v)} />
            {!clientEmail && <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>Este lead não tem e-mail cadastrado. Adicione o e-mail do cliente acima ou na aba Dados para ele receber o convite.</p>}
          </div>

          {form.type === 'video' && (
            <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 12, background: BRAND.softer }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: BRAND.ink }}>
                <input type="checkbox" checked={form.send_invite} onChange={e => set('send_invite', e.target.checked)} style={{ width: 18, height: 18, accentColor: BRAND.primary }} />
                <Mail size={15} color={BRAND.primary} />Enviar convite por e-mail
              </label>
              <p style={{ margin: '4px 0 0 28px', fontSize: 12, color: BRAND.muted }}>{form.send_invite ? (hasGuests ? 'O convite sai agora para os participantes, com o link do Meet. Se você remarcar ou cancelar, eles também recebem o aviso.' : 'Adicione participantes para o convite sair.') : 'A reunião é criada no seu Google Agenda, sem avisar ninguém por e-mail.'}</p>
              {form.send_invite && (
                <div style={{ marginTop: 10 }}>
                  <label style={label}>Mensagem no convite (opcional)</label>
                  <textarea rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} value={form.invite_message} onChange={e => set('invite_message', e.target.value)} placeholder="Ex.: Vamos apresentar o Raio-X da sua escola e tirar dúvidas." />
                </div>
              )}
            </div>
          )}

          {form.type !== 'video' && (
            <div><label style={label}>Link ou local</label><input style={input} value={form.meet_link} onChange={e => set('meet_link', e.target.value)} placeholder={form.type === 'phone' ? 'Número para ligar' : 'Endereço da reunião'} /></div>
          )}
          {form.type === 'video' && meeting?.meet_link && <p style={{ margin: 0, fontSize: 12.5, color: BRAND.muted, overflowWrap: 'anywhere' }}>Link do Meet: {meeting.meet_link}</p>}

          <div><label style={label}>Observações (só para você)</label><textarea rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>

          {!isNew && (
            <div><label style={label}>Situação</label>
              <select style={input} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="scheduled">Agendada</option><option value="completed">Realizada</option><option value="cancelled">Cancelada (avisa os participantes)</option>
              </select></div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: `1px solid ${BRAND.line}`, display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={onClose} style={{ minHeight: 44, padding: '0 18px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          <button type="button" onClick={save} disabled={saving} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: saving ? 0.7 : 1 }}>
            <CheckCircle2 size={16} />{saving ? 'Salvando...' : isNew ? (form.type === 'video' && form.send_invite ? 'Agendar e enviar convite' : 'Agendar reunião') : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
