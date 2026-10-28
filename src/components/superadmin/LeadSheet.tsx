// Ficha do lead do CRM comercial (Super Admin): painel lateral no computador, tela cheia no celular.
// Tudo editável e excluível: dados, contatos registrados, reuniões e propostas.
// A aba "Atividade" mistura o que foi anotado à mão com o registro automático do banco (crm_lead_events).
import { useEffect, useMemo, useState } from 'react'
import {
  X, Phone, MessageCircle, Mail, FileText, Trash2, Edit2, Plus, Send, Video, Users, Calendar, StickyNote, ExternalLink,
  CheckCircle2, AlertCircle, Clock, Building2, Zap, Save, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useIsMobile } from '../mobile/MobileShell'
import { BRAND } from '../../lib/brand'
import { STAGES, ORIGINS, toLocalInput, type Lead, type Stage, type Interaction } from '../shared/LeadModal'
import MeetingForm, { cancelGoogleEvent, MEETING_KINDS, type Meeting } from './MeetingForm'

type Tab = 'info' | 'activity' | 'meetings' | 'proposals'
type Task = { id: string; meeting_id: string; kind: string; label: string; due_at: string; done_at: string | null }
type Ev = { id: string; event: string; detail: any; actor_name: string | null; created_at: string }
type Prop = {
  id: string; status: string; created_at: string; sent_at: string | null; view_count: number | null; pdf_url: string | null; client_email: string | null
  monthly_normal: number | null; monthly_special: number | null; implementation_normal: number | null; implementation_special: number | null
}

const stageName = (l: string) => l.replace(/[^\p{L}\s]/gu, '').trim()
const stageLabel = (id?: string) => stageName(STAGES.find(s => s.id === id)?.label || id || '')
const brl = (n?: number | null) => (n || n === 0 ? Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—')
const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const waLink = (phone: string) => { let d = String(phone || '').replace(/\D/g, ''); if (d.length === 10 || d.length === 11) d = '55' + d; return `https://wa.me/${d}` }
const FIELD: Record<string, string> = {
  name: 'Contato', school_name: 'Escola', phone: 'Telefone', email: 'E-mail', city: 'Cidade', state: 'UF', origin: 'Origem',
  monthly_value: 'Mensalidade', implementation_value: 'Implantação', consultant_id: 'Consultor', next_followup: 'Próximo retorno', notes: 'Observações',
}
const INT_TYPES: { v: Interaction['type']; l: string; icon: any; color: string }[] = [
  { v: 'call', l: 'Ligação', icon: Phone, color: '#3B82F6' },
  { v: 'whatsapp', l: 'WhatsApp', icon: MessageCircle, color: '#10B981' },
  { v: 'email', l: 'E-mail', icon: Mail, color: '#8B5CF6' },
  { v: 'meeting', l: 'Reunião', icon: Calendar, color: '#F59E0B' },
  { v: 'note', l: 'Nota', icon: StickyNote, color: '#6B7280' },
]
const PROP_STATUS: Record<string, [string, string, string]> = {
  draft: ['Rascunho', '#F1F5F9', '#475569'], sent: ['Enviada', '#DBEAFE', '#1D4ED8'], viewed: ['Aberta', '#FEF3C7', '#B45309'],
  accepted: ['Aceita', '#DCFCE7', '#15803D'], rejected: ['Recusada', '#FEE2E2', '#B91C1C'], expired: ['Vencida', '#F1F5F9', '#64748B'],
}
const propStatus = (s: string) => PROP_STATUS[s] || [s, '#F1F5F9', '#475569']

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 44, padding: '0 12px', border: `1.5px solid ${BRAND.line}`, borderRadius: 12, fontSize: 16, color: BRAND.ink, background: '#fff', outline: 'none', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 5 }
const btn = (kind: 'primary' | 'ghost' | 'danger' | 'soft', extra: React.CSSProperties = {}): React.CSSProperties => ({
  minHeight: 42, padding: '0 16px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  border: kind === 'primary' ? 'none' : kind === 'danger' ? '1px solid #FECACA' : `1px solid ${BRAND.line}`,
  background: kind === 'primary' ? 'var(--aion-grad)' : kind === 'soft' ? BRAND.softer : '#fff',
  color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#DC2626' : kind === 'soft' ? BRAND.primaryDark : BRAND.ink, ...extra,
})

export default function LeadSheet({ lead: initial, consultants, initialTab, onClose, onSave, onDelete, onProposal, onOnboard }: {
  lead: Lead | null; initialTab?: Tab; consultants: { id: string; full_name: string; email: string }[]
  onClose: () => void; onSave: (form: Partial<Lead>) => Promise<void>; onDelete: (id: string) => void
  onProposal: (l: Lead) => void; onOnboard: (l: Lead) => void
}) {
  const mobile = useIsMobile()
  const { user } = useAuth()
  const isNew = !initial?.id
  const base: Partial<Lead> = useMemo(() => initial || { stage: 'interesse', origin: 'Indicação' }, [initial])
  const [form, setForm] = useState<Partial<Lead>>(base)
  const [followup, setFollowup] = useState(toLocalInput(initial?.next_followup))
  const [tab, setTab] = useState<Tab>(initialTab || 'info')
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [ints, setInts] = useState<Interaction[]>([])
  const [events, setEvents] = useState<Ev[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [props, setProps] = useState<Prop[]>([])
  const [newInt, setNewInt] = useState<{ type: Interaction['type']; content: string }>({ type: 'note', content: '' })
  const [editInt, setEditInt] = useState<{ id: string; type: Interaction['type']; content: string } | null>(null)
  const [meetingModal, setMeetingModal] = useState<Meeting | null | 'new'>(null)

  const set = (k: keyof Lead, v: any) => setForm(f => ({ ...f, [k]: v }))
  const id = initial?.id
  const consultantName = (cid?: string | null) => consultants.find(c => c.id === cid)?.full_name || (cid ? 'outro consultor' : 'sem consultor')

  const load = async () => {
    if (!id) return
    const [a, b, c, d] = await Promise.all([
      supabase.from('crm_interactions').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('crm_lead_events').select('id,event,detail,actor_name,created_at').eq('lead_id', id).order('created_at', { ascending: false }),
      supabase.from('crm_meetings').select('*').eq('lead_id', id).order('scheduled_at', { ascending: false }),
      supabase.from('proposals').select('id,status,created_at,sent_at,view_count,pdf_url,client_email,monthly_normal,monthly_special,implementation_normal,implementation_special').eq('lead_id', id).order('created_at', { ascending: false }),
    ])
    setInts((a.data || []) as Interaction[]); setEvents((b.data || []) as Ev[]); setMeetings((c.data || []) as Meeting[]); setProps((d.data || []) as Prop[])
    const mids = ((c.data || []) as Meeting[]).map(m => m.id)
    if (mids.length) {
      const t = await supabase.from('crm_meeting_tasks').select('id,meeting_id,kind,label,due_at,done_at').in('meeting_id', mids).eq('superseded', false).order('due_at')
      setTasks((t.data || []) as Task[])
    } else setTasks([])
  }
  useEffect(() => { load() }, [id])

  const dirty = isNew || JSON.stringify({ ...form, next_followup: followup }) !== JSON.stringify({ ...base, next_followup: toLocalInput(base.next_followup) })
  const canSave = !!form.school_name?.trim() && !!form.name?.trim()

  const save = async () => {
    setSaving(true); setErr('')
    try {
      const payload: Partial<Lead> = { ...form, monthly_value: form.monthly_value || undefined, implementation_value: form.implementation_value || undefined, consultant_id: form.consultant_id || undefined }
      ;(payload as any).next_followup = followup ? new Date(followup).toISOString() : null
      if (!form.monthly_value) (payload as any).monthly_value = null
      if (!form.implementation_value) (payload as any).implementation_value = null
      if (!form.consultant_id) (payload as any).consultant_id = null
      await onSave(payload)
    } catch (e: any) { setErr(e?.message || 'Erro ao salvar.') }
    setSaving(false)
  }

  const addInt = async () => {
    if (!id || !newInt.content.trim()) return
    const { error } = await supabase.from('crm_interactions').insert({ lead_id: id, type: newInt.type, content: newInt.content.trim(), created_by: user?.id ?? null })
    if (error) { setErr(error.message); return }
    setNewInt(n => ({ ...n, content: '' })); setErr(''); load()
  }
  const saveInt = async () => {
    if (!editInt || !editInt.content.trim()) return
    const { error } = await supabase.from('crm_interactions').update({ type: editInt.type, content: editInt.content.trim() }).eq('id', editInt.id)
    if (error) { setErr(error.message); return }
    setEditInt(null); setErr(''); load()
  }
  const delInt = async (iid: string) => {
    if (!confirm('Excluir este registro de contato?')) return
    const { error } = await supabase.from('crm_interactions').delete().eq('id', iid)
    if (error) { setErr(error.message); return }
    load()
  }
  const delMeeting = async (m: Meeting) => {
    if (!confirm(m.google_event_id && m.send_invite !== false ? 'Excluir esta reunião? Os participantes recebem o aviso de cancelamento do Google.' : 'Excluir esta reunião?')) return
    const g = await cancelGoogleEvent(m)
    const { error } = await supabase.from('crm_meetings').delete().eq('id', m.id)
    if (error) { setErr(error.message); return }
    setNotice(g ? { text: `Reunião excluída, mas o Google Agenda não confirmou o cancelamento: ${g}`, ok: false } : { text: 'Reunião excluída.', ok: true })
    load()
  }
  const setConfirmation = async (m: Meeting, c: NonNullable<Meeting['confirmation']>) => {
    const { error } = await supabase.from('crm_meetings').update({ confirmation: c, confirmed_at: c === 'confirmed' ? new Date().toISOString() : null }).eq('id', m.id)
    if (error) { setErr(error.message); return }
    if (c === 'confirmed') await supabase.from('crm_meeting_tasks').update({ done_at: new Date().toISOString(), done_by: user?.id ?? null }).eq('meeting_id', m.id).is('done_at', null).eq('superseded', false)
    if (c === 'reschedule') setMeetingModal(m)
    load()
  }
  const toggleTask = async (t: Task) => {
    const { error } = await supabase.from('crm_meeting_tasks').update(t.done_at ? { done_at: null, done_by: null } : { done_at: new Date().toISOString(), done_by: user?.id ?? null }).eq('id', t.id)
    if (error) { setErr(error.message); return }
    load()
  }
  const delProposal = async (pid: string) => {
    if (!confirm('Excluir esta proposta?')) return
    const { error } = await supabase.from('proposals').delete().eq('id', pid)
    if (error) { setErr(error.message); return }
    load()
  }

  const stage = STAGES.find(s => s.id === form.stage) || STAGES[0]
  const closedOrClient = form.stage === 'cliente' || form.stage === 'fechado'
  const lead = { ...(initial as Lead), ...form } as Lead

  // linha do tempo: anotações feitas à mão + registro automático
  const describe = (e: Ev): { text: string; icon: any; color: string } => {
    const d = e.detail || {}
    switch (e.event) {
      case 'created': return { text: `Lead criado${d.origin ? ` (origem: ${d.origin})` : ''}`, icon: Plus, color: '#16A34A' }
      case 'stage': return { text: `Etapa: ${stageLabel(d.from)} → ${stageLabel(d.to)}`, icon: ArrowRight, color: '#6366F1' }
      case 'edited': {
        const ch = d.changes || {}
        const parts = Object.keys(ch).map(k => {
          const f = (v: any) => (v === null || v === undefined || v === '' ? 'vazio' : k === 'consultant_id' ? consultantName(v) : k === 'next_followup' ? when(v) : k.endsWith('_value') ? brl(Number(v)) : String(v).length > 40 ? String(v).slice(0, 40) + '…' : String(v))
          return `${FIELD[k] || k}: ${f(ch[k].from)} → ${f(ch[k].to)}`
        })
        return { text: parts.join(' · ') || 'Dados editados', icon: Edit2, color: '#0891B2' }
      }
      case 'meeting_created': return { text: `Reunião agendada: ${d.title} (${d.scheduled_at ? when(d.scheduled_at) : ''})`, icon: Video, color: '#2563EB' }
      case 'meeting_deleted': return { text: `Reunião excluída: ${d.title}`, icon: Trash2, color: '#DC2626' }
      case 'meeting_status': return { text: `Reunião "${d.title}": ${d.to === 'completed' ? 'realizada' : d.to === 'cancelled' ? 'cancelada' : 'agendada'}`, icon: Video, color: '#2563EB' }
      case 'meeting_rescheduled': return { text: `Reunião "${d.title}" remarcada para ${d.to ? when(d.to) : ''}`, icon: Calendar, color: '#2563EB' }
      case 'proposal_created': return { text: 'Proposta criada', icon: FileText, color: '#D97706' }
      case 'proposal_status': return { text: `Proposta: ${propStatus(d.from)[0]} → ${propStatus(d.to)[0]}`, icon: FileText, color: '#D97706' }
      default: return { text: e.event, icon: Clock, color: '#64748B' }
    }
  }
  type Row = { key: string; at: string; kind: 'int' | 'ev'; int?: Interaction; ev?: Ev }
  const timeline: Row[] = [
    ...ints.map(i => ({ key: 'i' + i.id, at: i.created_at, kind: 'int' as const, int: i })),
    ...events.map(e => ({ key: 'e' + e.id, at: e.created_at, kind: 'ev' as const, ev: e })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at))

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Dados' }, { id: 'activity', label: `Atividade (${timeline.length})` },
    { id: 'meetings', label: `Reuniões (${meetings.length})` }, { id: 'proposals', label: `Propostas (${props.length})` },
  ]
  const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 14 }
  const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 14 }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 100, display: 'flex', justifyContent: 'flex-end' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: mobile ? '100%' : 'min(660px,100vw)', height: '100dvh', background: BRAND.bg, display: 'flex', flexDirection: 'column', boxShadow: '-24px 0 48px -24px rgba(15,23,42,.35)' }}>
          {/* Cabeçalho */}
          <div style={{ background: 'var(--aion-grad)', color: '#fff', padding: mobile ? '14px 14px 12px' : '18px 22px 14px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'inline-block', background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 999, padding: '2px 11px', fontSize: 12, fontWeight: 800 }}>{stageName(stage.label)}</span>
                <h2 style={{ margin: '8px 0 2px', color: '#fff', fontSize: mobile ? 20 : 22, fontWeight: 800, letterSpacing: '-.015em', lineHeight: 1.2 }}>{isNew ? 'Novo lead' : form.school_name || 'Lead'}</h2>
                {!isNew && <p style={{ margin: 0, fontSize: 13.5, opacity: 0.9 }}>{[form.name, [form.city, form.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')}</p>}
              </div>
              <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'rgba(255,255,255,.18)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={18} /></button>
            </div>
            {!isNew && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                {form.phone && <a href={waLink(form.phone)} target="_blank" rel="noreferrer" style={{ ...btn('ghost', { background: '#fff', color: '#15803D', textDecoration: 'none', minHeight: 38 }) }}><MessageCircle size={15} />WhatsApp</a>}
                {form.phone && <a href={`tel:${form.phone.replace(/\D/g, '')}`} style={{ ...btn('ghost', { background: '#fff', color: '#1D4ED8', textDecoration: 'none', minHeight: 38 }) }}><Phone size={15} />Ligar</a>}
                {form.email && <a href={`mailto:${form.email}`} style={{ ...btn('ghost', { background: '#fff', color: '#7C3AED', textDecoration: 'none', minHeight: 38 }) }}><Mail size={15} />E-mail</a>}
                <button type="button" onClick={() => onProposal(lead)} style={btn('ghost', { background: '#fff', color: '#B45309', minHeight: 38 })}><FileText size={15} />Proposta</button>
              </div>
            )}
          </div>

          {/* Abas */}
          {!isNew && (
            <div className="aion-hscroll" style={{ display: 'flex', gap: 6, padding: '10px 14px 0', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: tab === t.id ? BRAND.primary : BRAND.softer, color: tab === t.id ? '#fff' : BRAND.muted }}>{t.label}</button>
              ))}
            </div>
          )}

          {/* Conteúdo */}
          <div style={{ flex: 1, overflowY: 'auto', padding: mobile ? 14 : 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: 12, padding: 12, fontSize: 13 }}><AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />{err}</div>}

            {notice && <div onClick={() => setNotice(null)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: notice.ok ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${notice.ok ? '#BBF7D0' : '#FDE68A'}`, color: notice.ok ? '#166534' : '#92400E', borderRadius: 12, padding: 12, fontSize: 13, cursor: 'pointer' }}>{notice.ok ? <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}{notice.text}</div>}

            {!isNew && closedOrClient && !form.converted_institution_id && (
              <div style={{ ...card, background: '#F0FDF4', borderColor: '#BBF7D0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Zap size={20} color="#16A34A" />
                <div style={{ flex: 1, minWidth: 180 }}><b style={{ color: '#166534' }}>Pronto para virar cliente</b><div style={{ fontSize: 12.5, color: '#15803D' }}>Inicie o onboarding para criar a escola no sistema.</div></div>
                <button type="button" onClick={() => onOnboard(lead)} style={btn('primary')}>Iniciar onboarding</button>
              </div>
            )}
            {!isNew && form.converted_institution_id && (
              <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: BRAND.text }}><Building2 size={17} color="#16A34A" />Escola já criada. Acompanhe em Escolas.</div>
            )}

            {(isNew || tab === 'info') && (
              <>
                <div>
                  <label style={label}>Etapa no funil</label>
                  <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: 8 }}>
                    {STAGES.map(s => (
                      <button key={s.id} type="button" onClick={() => set('stage', s.id as Stage)} style={{ minHeight: 40, borderRadius: 12, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', border: `2px solid ${form.stage === s.id ? s.color : BRAND.line}`, background: form.stage === s.id ? `${s.color}1A` : '#fff', color: form.stage === s.id ? s.color : BRAND.muted }}>{stageName(s.label)}</button>
                    ))}
                  </div>
                </div>
                <div style={grid2}>
                  <div><label style={label}>Nome da escola *</label><input style={input} value={form.school_name || ''} onChange={e => set('school_name', e.target.value)} placeholder="Colégio..." autoCapitalize="words" /></div>
                  <div><label style={label}>Nome do contato *</label><input style={input} value={form.name || ''} onChange={e => set('name', e.target.value)} placeholder="Nome do gestor" autoCapitalize="words" /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 14 }}>
                  <div><label style={label}>Cidade</label><input style={input} value={form.city || ''} onChange={e => set('city', e.target.value)} autoCapitalize="words" /></div>
                  <div><label style={label}>UF</label><input style={input} maxLength={2} value={form.state || ''} onChange={e => set('state', e.target.value.toUpperCase())} autoCapitalize="characters" /></div>
                </div>
                <div style={grid2}>
                  <div><label style={label}>WhatsApp / telefone</label><input style={input} type="tel" inputMode="tel" autoComplete="off" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="(83) 99999-9999" /></div>
                  <div><label style={label}>E-mail</label><input style={input} type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
                </div>
                <div style={grid2}>
                  <div><label style={label}>Origem</label>
                    <select style={input} value={form.origin || ''} onChange={e => set('origin', e.target.value)}>
                      {Array.from(new Set([...ORIGINS, ...(form.origin ? [form.origin] : [])])).map(o => <option key={o} value={o}>{o === 'raio_x_inep' ? 'Raio-X' : o}</option>)}
                    </select></div>
                  <div><label style={label}>Consultor</label>
                    <select style={input} value={form.consultant_id || ''} onChange={e => set('consultant_id', e.target.value)}>
                      <option value="">Sem consultor</option>
                      {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select></div>
                </div>
                <div style={grid2}>
                  <div><label style={label}>Mensalidade (R$)</label><input style={input} type="number" inputMode="decimal" min={0} value={form.monthly_value ?? ''} onChange={e => set('monthly_value', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0,00" /></div>
                  <div><label style={label}>Implantação (R$)</label><input style={input} type="number" inputMode="decimal" min={0} value={form.implementation_value ?? ''} onChange={e => set('implementation_value', e.target.value === '' ? undefined : Number(e.target.value))} placeholder="0,00" /></div>
                </div>
                <div><label style={label}>Próximo retorno</label><input style={input} type="datetime-local" value={followup} onChange={e => setFollowup(e.target.value)} /></div>
                <div><label style={label}>Observações</label><textarea rows={4} style={{ ...input, height: 'auto', padding: 12, resize: 'vertical' }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Notas sobre este lead..." /></div>
              </>
            )}

            {!isNew && tab === 'activity' && (
              <>
                <div style={card}>
                  <p style={{ margin: '0 0 8px', fontSize: 12.5, fontWeight: 800, color: BRAND.muted }}>Registrar contato</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {INT_TYPES.map(t => { const Ic = t.icon; const on = newInt.type === t.v; return (
                      <button key={t.v} type="button" onClick={() => setNewInt(n => ({ ...n, type: t.v }))} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${on ? t.color : BRAND.line}`, background: on ? t.color : '#fff', color: on ? '#fff' : BRAND.muted }}><Ic size={13} />{t.l}</button>
                    ) })}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <textarea rows={2} style={{ ...input, height: 'auto', padding: 10, resize: 'none', flex: 1 }} value={newInt.content} onChange={e => setNewInt(n => ({ ...n, content: e.target.value }))} placeholder="O que foi conversado?" />
                    <button type="button" onClick={addInt} disabled={!newInt.content.trim()} style={btn('primary', { opacity: newInt.content.trim() ? 1 : 0.5 })}><Send size={14} />Salvar</button>
                  </div>
                </div>
                {timeline.length === 0 && <p style={{ textAlign: 'center', color: BRAND.faint, fontSize: 13, padding: 24 }}>Nada registrado ainda</p>}
                {timeline.map(r => {
                  if (r.kind === 'ev' && r.ev) {
                    const d = describe(r.ev); const Ic = d.icon
                    return (
                      <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ width: 30, height: 30, borderRadius: 99, background: `${d.color}18`, color: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={14} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13.5, color: BRAND.text, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{d.text}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 11.5, color: BRAND.faint }}>{when(r.at)}{r.ev.actor_name ? ` · ${r.ev.actor_name}` : ''}</p>
                        </div>
                      </div>
                    )
                  }
                  const it = r.int!; const t = INT_TYPES.find(x => x.v === it.type) || INT_TYPES[4]; const Ic = t.icon
                  const editing = editInt?.id === it.id
                  return (
                    <div key={r.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 30, height: 30, borderRadius: 99, background: `${t.color}18`, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ic size={14} /></span>
                      <div style={{ ...card, flex: 1, minWidth: 0, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <b style={{ fontSize: 12.5, color: t.color }}>{t.l}</b>
                          <span style={{ fontSize: 11.5, color: BRAND.faint }}>{when(it.created_at)}</span>
                        </div>
                        {editing ? (
                          <>
                            <textarea rows={3} style={{ ...input, height: 'auto', padding: 10 }} value={editInt!.content} onChange={e => setEditInt(x => x && { ...x, content: e.target.value })} />
                            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                              <button type="button" onClick={saveInt} style={btn('primary', { minHeight: 36 })}><Save size={14} />Salvar</button>
                              <button type="button" onClick={() => setEditInt(null)} style={btn('ghost', { minHeight: 36 })}>Cancelar</button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p style={{ margin: 0, fontSize: 14, color: BRAND.text, whiteSpace: 'pre-wrap', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{it.content}</p>
                            <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                              <button type="button" aria-label="Editar" onClick={() => setEditInt({ id: it.id, type: it.type, content: it.content })} style={btn('ghost', { minHeight: 32, padding: '0 10px', fontSize: 12 })}><Edit2 size={13} />Editar</button>
                              <button type="button" aria-label="Excluir" onClick={() => delInt(it.id)} style={btn('danger', { minHeight: 32, padding: '0 10px', fontSize: 12 })}><Trash2 size={13} />Excluir</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {!isNew && tab === 'meetings' && (
              <>
                <button type="button" onClick={() => setMeetingModal('new')} style={btn('soft', { width: '100%', border: `2px dashed ${BRAND.softLine}` })}><Plus size={16} />Nova reunião</button>
                {meetings.length === 0 && <p style={{ textAlign: 'center', color: BRAND.faint, fontSize: 13, padding: 24 }}>Nenhuma reunião agendada</p>}
                {meetings.map(m => {
                  const st = m.status === 'completed' ? ['Realizada', '#DCFCE7', '#15803D'] : m.status === 'cancelled' ? ['Cancelada', '#FEE2E2', '#B91C1C'] : ['Agendada', '#DBEAFE', '#1D4ED8']
                  const conf = m.confirmation === 'confirmed' ? ['Cliente confirmou', '#DCFCE7', '#15803D'] : m.confirmation === 'no_answer' ? ['Sem resposta', '#FEF3C7', '#B45309'] : m.confirmation === 'reschedule' ? ['Precisa remarcar', '#FEE2E2', '#B91C1C'] : ['Aguardando confirmação', '#F1F5F9', '#475569']
                  const mt = tasks.filter(t => t.meeting_id === m.id)
                  const kindName = MEETING_KINDS.find(k => k.v === m.kind)?.l
                  return (
                    <div key={m.id} style={card}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ width: 36, height: 36, borderRadius: 11, background: '#EFF6FF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{m.type === 'phone' ? <Phone size={17} /> : m.type === 'presential' ? <Users size={17} /> : <Video size={17} />}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: BRAND.ink }}>{m.title}</p>
                          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: BRAND.muted }}>{when(m.scheduled_at)} · {m.duration_min} min{kindName ? ` · ${kindName}` : ''}</p>
                        </div>
                        <span style={{ background: st[1], color: st[2], fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99, flexShrink: 0 }}>{st[0]}</span>
                      </div>
                      {m.attendees?.length > 0 && <p style={{ margin: '8px 0 0', fontSize: 12, color: BRAND.muted, overflowWrap: 'anywhere' }}>{m.send_invite === false ? 'Participantes (sem convite por e-mail)' : 'Convite enviado a'}: {m.attendees.join(', ')}</p>}
                      {m.notes && <p style={{ margin: '6px 0 0', fontSize: 12.5, color: BRAND.muted, fontStyle: 'italic' }}>{m.notes}</p>}

                      {m.status === 'scheduled' && (
                        <div style={{ marginTop: 10, background: BRAND.bg, borderRadius: 12, padding: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: mt.length ? 8 : 0 }}>
                            <b style={{ fontSize: 12.5, color: BRAND.ink }}>Confirmação do cliente</b>
                            <span style={{ background: conf[1], color: conf[2], fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{conf[0]}</span>
                          </div>
                          {mt.map(t => (
                            <label key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', cursor: 'pointer', fontSize: 13, color: t.done_at ? BRAND.faint : BRAND.text, textDecoration: t.done_at ? 'line-through' : 'none' }}>
                              <input type="checkbox" checked={!!t.done_at} onChange={() => toggleTask(t)} style={{ width: 18, height: 18, marginTop: 1, accentColor: BRAND.primary, flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{t.label}<span style={{ display: 'block', fontSize: 11.5, color: new Date(t.due_at) < new Date() && !t.done_at ? '#B91C1C' : BRAND.faint }}>{when(t.due_at)}</span></span>
                            </label>
                          ))}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            <button type="button" onClick={() => setConfirmation(m, 'confirmed')} style={btn('ghost', { minHeight: 36, color: '#15803D', borderColor: '#BBF7D0', background: m.confirmation === 'confirmed' ? '#DCFCE7' : '#fff' })}><CheckCircle2 size={14} />Cliente confirmou</button>
                            <button type="button" onClick={() => setConfirmation(m, 'no_answer')} style={btn('ghost', { minHeight: 36 })}>Não respondeu</button>
                            <button type="button" onClick={() => setConfirmation(m, 'reschedule')} style={btn('ghost', { minHeight: 36, color: '#B91C1C', borderColor: '#FECACA' })}><Calendar size={14} />Remarcar</button>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {m.meet_link && /^https?:/.test(m.meet_link) && <a href={m.meet_link} target="_blank" rel="noreferrer" style={{ ...btn('soft', { minHeight: 36, textDecoration: 'none' }) }}><ExternalLink size={14} />Abrir reunião</a>}
                        <button type="button" onClick={() => setMeetingModal(m)} style={btn('ghost', { minHeight: 36 })}><Edit2 size={14} />Editar</button>
                        <button type="button" onClick={() => delMeeting(m)} style={btn('danger', { minHeight: 36 })}><Trash2 size={14} />Excluir</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {!isNew && tab === 'proposals' && (
              <>
                <button type="button" onClick={() => onProposal(lead)} style={btn('soft', { width: '100%', border: `2px dashed ${BRAND.softLine}` })}><Plus size={16} />Nova proposta</button>
                {props.length === 0 && <p style={{ textAlign: 'center', color: BRAND.faint, fontSize: 13, padding: 24 }}>Nenhuma proposta criada</p>}
                {props.map(p => {
                  const [sl, sbg, sc] = propStatus(p.status)
                  const mens = p.monthly_special ?? p.monthly_normal; const impl = p.implementation_special ?? p.implementation_normal
                  return (
                    <div key={p.id} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                        <b style={{ fontSize: 14, color: BRAND.ink }}>{when(p.created_at)}</b>
                        <span style={{ background: sbg, color: sc, fontSize: 11.5, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{sl}</span>
                      </div>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: BRAND.text }}>Implantação {brl(impl)} · Mensalidade {brl(mens)}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: BRAND.muted }}>{p.sent_at ? `Enviada em ${when(p.sent_at)}${p.client_email ? ` para ${p.client_email}` : ''}` : 'Ainda não enviada'}{p.view_count ? ` · aberta ${p.view_count}x` : ''}</p>
                      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                        {p.pdf_url && <a href={p.pdf_url} target="_blank" rel="noreferrer" style={{ ...btn('soft', { minHeight: 36, textDecoration: 'none' }) }}><FileText size={14} />Abrir PDF</a>}
                        <button type="button" onClick={() => delProposal(p.id)} style={btn('danger', { minHeight: 36 })}><Trash2 size={14} />Excluir</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Rodapé */}
          {(isNew || tab === 'info') && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${BRAND.line}`, background: '#fff', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
              {!isNew && <button type="button" onClick={() => onDelete(initial!.id)} style={btn('danger')}><Trash2 size={15} />{mobile ? '' : 'Excluir'}</button>}
              <button type="button" onClick={onClose} style={btn('ghost')}>{isNew ? 'Cancelar' : 'Fechar'}</button>
              <button type="button" onClick={save} disabled={saving || !canSave || !dirty} style={btn('primary', { flex: 1, opacity: saving || !canSave || !dirty ? 0.55 : 1 })}>
                <CheckCircle2 size={16} />{saving ? 'Salvando...' : isNew ? 'Criar lead' : dirty ? 'Salvar alterações' : 'Sem alterações'}
              </button>
            </div>
          )}
        </div>
      </div>

      {meetingModal !== null && initial && (
        <MeetingForm lead={lead} meeting={meetingModal === 'new' ? null : meetingModal} consultants={consultants}
          onClose={() => setMeetingModal(null)}
          onSaved={w => { setMeetingModal(null); setNotice(w ? { text: w, ok: false } : { text: 'Reunião salva.', ok: true }); load() }} />
      )}
    </>
  )
}

