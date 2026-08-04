// src/components/shared/LeadModal.tsx
// Extraído de AdminCRM.tsx para ser reaproveitado também pelo Inbox Áion
// (AionInboxHub.tsx) — mesma tabela crm_leads, mesmo modal completo.
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { createGoogleMeet, buildEndDatetime } from '../../lib/googleMeet'
import AttendeesPicker from './AttendeesPicker'
import {
  Plus, X, Phone, Mail, Calendar, AlertCircle, CheckCircle2,
  MessageCircle, Edit2, Trash2, StickyNote, Send, Zap, Video, Users, ExternalLink,
} from 'lucide-react'

export type Stage = 'interesse' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado' | 'cliente'

export interface Lead {
  id: string; name: string; school_name: string; city: string; state: string
  phone: string; email: string; stage: Stage; origin: string
  monthly_value?: number; implementation_value?: number
  consultant_id?: string; notes?: string; next_followup?: string
  converted_institution_id?: string; has_proposal?: boolean
  created_at: string; updated_at: string
}

export interface Interaction {
  id: string; lead_id: string; type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note'
  content: string; created_at: string
}

export interface CRMeeting {
  id: string; lead_id: string; title: string
  type: 'video' | 'phone' | 'presential'
  scheduled_at: string; duration_min: number
  meet_link?: string; google_event_id?: string; calendar_link?: string
  attendees: string[]; status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string; created_at: string
}

export const STAGES: { id: Stage; label: string; color: string; bg: string; border: string }[] = [
  { id: 'interesse',    label: 'Interesse',    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  { id: 'qualificacao', label: 'Qualificação', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  { id: 'proposta',     label: 'Proposta',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'negociacao',   label: 'Negociação',   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'fechado',      label: 'Fechado ✓',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'cliente',      label: 'Cliente 🏫',   color: '#00523C', bg: '#ECFDF5', border: '#6EE7B7' },
]

export const ORIGINS = ['Indicação', 'Google', 'Instagram', 'Facebook', 'Evento', 'LinkedIn', 'Site', 'Outro']

const INTERACTION_TYPES: { v: Interaction['type']; l: string; icon: React.ElementType; color: string }[] = [
  { v: 'call',     l: 'Ligação',  icon: Phone,         color: '#3B82F6' },
  { v: 'whatsapp', l: 'WhatsApp', icon: MessageCircle, color: '#10B981' },
  { v: 'email',    l: 'E-mail',   icon: Mail,          color: '#8B5CF6' },
  { v: 'meeting',  l: 'Reunião',  icon: Calendar,      color: '#F59E0B' },
  { v: 'note',     l: 'Nota',     icon: StickyNote,    color: '#6B7280' },
]

const MEETING_TYPES = [
  { v: 'video',       l: 'Videoconferência', icon: Video   },
  { v: 'phone',       l: 'Telefone',         icon: Phone   },
  { v: 'presential',  l: 'Presencial',       icon: Users   },
] as const

export const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
export const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

export function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

// ─── CRM Meeting Modal ────────────────────────────────────────────────────
function CRMeetingModal({ lead, meeting, consultants, onClose, onSave }: {
  lead: Lead; meeting?: CRMeeting | null; consultants: any[]
  onClose: () => void; onSave: () => void
}) {
  const isNew = !meeting?.id
  const [form, setForm] = useState({
    title:        meeting?.title        || `Reunião — ${lead.school_name}`,
    type:         meeting?.type         || 'video' as CRMeeting['type'],
    scheduled_at: meeting?.scheduled_at?.slice(0, 16) || '',
    duration_min: meeting?.duration_min ?? 30,
    meet_link:    meeting?.meet_link    || '',
    attendees:    (meeting?.attendees   || []) as string[],
    notes:        meeting?.notes        || '',
    status:       meeting?.status       || 'scheduled' as CRMeeting['status'],
  })
  const [saving, setSaving]   = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError]     = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const handleGenerateMeet = async () => {
    if (!form.scheduled_at) { setError('Defina a data/hora antes de gerar o link.'); return }
    setGenerating(true)
    setError('')
    const start = new Date(form.scheduled_at).toISOString()
    const end   = buildEndDatetime(start, form.duration_min)
    const result = await createGoogleMeet({
      title: form.title,
      start_datetime: start,
      end_datetime: end,
      attendees: form.attendees,
    })
    if (result.meet_link) {
      set('meet_link', result.meet_link)
    } else {
      setError(result.error || 'Não foi possível gerar o link. Configure o Google Meet nas Configurações ou insira manualmente.')
    }
    setGenerating(false)
  }

  const handleSave = async () => {
    if (!form.scheduled_at) { setError('Data/hora obrigatória.'); return }
    setSaving(true)
    const payload = {
      lead_id:      lead.id,
      title:        form.title,
      type:         form.type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_min: form.duration_min,
      meet_link:    form.meet_link || null,
      attendees:    form.attendees,
      notes:        form.notes || null,
      status:       form.status,
      updated_at:   new Date().toISOString(),
    }
    if (isNew) {
      await supabase.from('crm_meetings').insert({ ...payload, created_at: new Date().toISOString() })
    } else {
      await supabase.from('crm_meetings').update(payload).eq('id', meeting!.id)
    }
    setSaving(false)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[300] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">{isNew ? 'Nova reunião' : 'Editar reunião'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{lead.school_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div>
            <label className={lbl}>Título</label>
            <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div>
            <label className={lbl}>Tipo</label>
            <div className="flex gap-2">
              {MEETING_TYPES.map(t => {
                const Icon = t.icon
                return (
                  <button key={t.v} onClick={() => set('type', t.v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border-2 transition-all
                      ${form.type === t.v ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                    <Icon className="w-3.5 h-3.5" />{t.l}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data e hora *</label>
              <input type="datetime-local" className={inp} value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Duração (min)</label>
              <select className={inp} value={form.duration_min} onChange={e => set('duration_min', Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120].map(m => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={lbl}>Link da reunião</label>
            <div className="flex gap-2">
              <input className={inp + ' flex-1'} placeholder="https://meet.google.com/..." value={form.meet_link} onChange={e => set('meet_link', e.target.value)} />
              {form.type === 'video' && (
                <button onClick={handleGenerateMeet} disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap">
                  {generating ? <div className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" /> : <Video className="w-3.5 h-3.5" />}
                  Gerar Meet
                </button>
              )}
            </div>
          </div>

          <div>
            <label className={lbl}>Participantes</label>
            <AttendeesPicker clientEmail={lead.email} consultants={consultants} value={form.attendees} onChange={v => set('attendees', v)} />
          </div>

          <div>
            <label className={lbl}>Observações</label>
            <textarea rows={2} className={inp + ' resize-none'} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {!isNew && (
            <div>
              <label className={lbl}>Status</label>
              <select className={inp} value={form.status} onChange={e => set('status', e.target.value as CRMeeting['status'])}>
                <option value="scheduled">Agendada</option>
                <option value="completed">Realizada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              : <><CheckCircle2 className="w-4 h-4" /> {isNew ? 'Agendar reunião' : 'Salvar'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Lead Modal (completo) ─────────────────────────────────────────────────
export default function LeadModal({ lead: initialLead, consultants, onClose, onSave, onStartOnboarding }: {
  lead: Lead | null; consultants: any[]
  onClose: () => void; onSave: (lead: Partial<Lead>) => Promise<void>
  onStartOnboarding: (lead: Lead) => void
}) {
  const isNew = !initialLead?.id
  const [form, setForm] = useState<Partial<Lead>>(initialLead || { stage: 'interesse', origin: 'Indicação' })
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [meetings, setMeetings]         = useState<CRMeeting[]>([])
  const [newInt, setNewInt] = useState({ type: 'note' as Interaction['type'], content: '' })
  const [saving, setSaving]     = useState(false)
  const [addingInt, setAddingInt] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'meetings'>('info')
  const [meetingModal, setMeetingModal] = useState<CRMeeting | null | 'new'>(null)

  const set = (k: keyof Lead, v: any) => setForm(f => ({ ...f, [k]: v }))

  const loadInteractions = async () => {
    if (!initialLead?.id) return
    const { data } = await supabase.from('crm_interactions').select('*').eq('lead_id', initialLead.id).order('created_at', { ascending: false })
    setInteractions(data || [])
  }
  const loadMeetings = async () => {
    if (!initialLead?.id) return
    const { data } = await supabase.from('crm_meetings').select('*').eq('lead_id', initialLead.id).order('scheduled_at', { ascending: false })
    setMeetings(data || [])
  }
  useEffect(() => { loadInteractions(); loadMeetings() }, [initialLead?.id])

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false) }

  const handleAddInteraction = async () => {
    if (!initialLead?.id || !newInt.content.trim()) return
    setAddingInt(true)
    await supabase.from('crm_interactions').insert({ lead_id: initialLead.id, type: newInt.type, content: newInt.content.trim() })
    setNewInt(n => ({ ...n, content: '' }))
    await loadInteractions()
    setAddingInt(false)
  }

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Excluir esta reunião?')) return
    await supabase.from('crm_meetings').delete().eq('id', id)
    loadMeetings()
  }

  const stage = STAGES.find(s => s.id === form.stage) || STAGES[0]
  const isClientOrClosed  = form.stage === 'cliente' || form.stage === 'fechado'
  const alreadyConverted  = !!form.converted_institution_id
  const tabs = isNew
    ? []
    : [
        { id: 'info'     as const, label: 'Dados'                      },
        { id: 'history'  as const, label: `Histórico (${interactions.length})` },
        { id: 'meetings' as const, label: `Reuniões (${meetings.length})`      },
      ]

  const statusColor = (s: CRMeeting['status']) =>
    s === 'completed' ? 'text-green-600 bg-green-50' :
    s === 'cancelled' ? 'text-red-500 bg-red-50'     : 'text-blue-600 bg-blue-50'

  return (
    <>
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[94vh]">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: stage.color, background: stage.bg, border: `1px solid ${stage.border}` }}>
                  {stage.label}
                </span>
                {form.origin && <span className="text-xs text-gray-400">{form.origin}</span>}
              </div>
              <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo lead' : (form.school_name || 'Lead')}</h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
          </div>

          {!isNew && (
            <div className="flex border-b border-gray-100 px-6">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors
                    ${activeTab === tab.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isClientOrClosed && !isNew && !alreadyConverted && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-800">Pronto para virar cliente!</p>
                    <p className="text-xs text-green-600 mt-0.5">Inicie o onboarding para criar a escola no sistema.</p>
                  </div>
                </div>
                <button onClick={() => { onStartOnboarding(form as Lead); onClose() }}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm whitespace-nowrap flex-shrink-0">
                  🏫 Iniciar onboarding
                </button>
              </div>
            )}

            {alreadyConverted && !isNew && (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                Escola já criada. Gerencie em <strong className="text-gray-800 ml-1">Escolas →</strong>
              </div>
            )}

            {/* ── Aba: Dados ── */}
            {(isNew || activeTab === 'info') && (
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Estágio no funil</label>
                  <div className="grid grid-cols-3 gap-2">
                    {STAGES.map(s => (
                      <button key={s.id} onClick={() => set('stage', s.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all
                          ${form.stage === s.id ? 'border-current' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                        style={form.stage === s.id ? { color: s.color, background: s.bg, borderColor: s.border } : {}}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Nome da escola *</label>
                    <input className={inp} placeholder="Colégio..." value={form.school_name || ''} onChange={e => set('school_name', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Nome do contato *</label>
                    <input className={inp} placeholder="Nome do diretor..." value={form.name || ''} onChange={e => set('name', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Cidade</label>
                    <input className={inp} placeholder="João Pessoa" value={form.city || ''} onChange={e => set('city', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>UF</label>
                    <input className={inp} placeholder="PB" maxLength={2} value={form.state || ''} onChange={e => set('state', e.target.value.toUpperCase())} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Telefone / WhatsApp</label>
                    <input className={inp} placeholder="(83) 99999-9999" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>E-mail</label>
                    <input type="email" className={inp} value={form.email || ''} onChange={e => set('email', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Origem</label>
                    <select className={inp} value={form.origin || 'Indicação'} onChange={e => set('origin', e.target.value)}>
                      {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Consultor</label>
                    <select className={inp} value={form.consultant_id || ''} onChange={e => set('consultant_id', e.target.value)}>
                      <option value="">Sem consultor</option>
                      {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Mensalidade proposta (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" className={inp + ' pl-9'} placeholder="550" value={form.monthly_value || ''} onChange={e => set('monthly_value', Number(e.target.value))} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>Implantação proposta (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                      <input type="number" className={inp + ' pl-9'} placeholder="550" value={form.implementation_value || ''} onChange={e => set('implementation_value', Number(e.target.value))} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={lbl}>Próximo follow-up</label>
                  <input type="datetime-local" className={inp} value={form.next_followup?.slice(0, 16) || ''} onChange={e => set('next_followup', e.target.value)} />
                </div>

                <div>
                  <label className={lbl}>Observações</label>
                  <textarea rows={3} className={inp + ' resize-none'} placeholder="Notas sobre este lead..." value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
                </div>
              </div>
            )}

            {/* ── Aba: Histórico ── */}
            {!isNew && activeTab === 'history' && (
              <div className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-xs font-bold text-gray-500 mb-3">Registrar interação</p>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {INTERACTION_TYPES.map(t => {
                      const Icon = t.icon
                      return (
                        <button key={t.v} onClick={() => setNewInt(n => ({ ...n, type: t.v }))}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all
                            ${newInt.type === t.v ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                          style={newInt.type === t.v ? { background: t.color, borderColor: t.color } : {}}>
                          <Icon className="w-3.5 h-3.5" /> {t.l}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2">
                    <textarea rows={2} className={inp + ' flex-1 resize-none text-xs'} placeholder="Descreva o contato..."
                      value={newInt.content} onChange={e => setNewInt(n => ({ ...n, content: e.target.value }))} />
                    <button onClick={handleAddInteraction} disabled={addingInt || !newInt.content.trim()}
                      className="px-4 bg-cyan-500 text-white rounded-xl text-xs font-bold hover:bg-cyan-600 disabled:opacity-50 flex items-center gap-1.5 self-end py-2.5">
                      {addingInt ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Salvar
                    </button>
                  </div>
                </div>

                {interactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <StickyNote className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhuma interação registrada</p>
                  </div>
                ) : interactions.map(int => {
                  const tType = INTERACTION_TYPES.find(t => t.v === int.type) || INTERACTION_TYPES[4]
                  const Icon = tType.icon
                  return (
                    <div key={int.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${tType.color}15` }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: tType.color }} />
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold" style={{ color: tType.color }}>{tType.l}</span>
                          <span className="text-xs text-gray-400">{timeAgo(int.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{int.content}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── Aba: Reuniões ── */}
            {!isNew && activeTab === 'meetings' && (
              <div className="space-y-3">
                <button onClick={() => setMeetingModal('new')}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-cyan-200 text-cyan-600 rounded-xl text-sm font-semibold hover:border-cyan-400 hover:bg-cyan-50 transition-all">
                  <Plus className="w-4 h-4" /> Nova reunião
                </button>

                {meetings.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Video className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhuma reunião agendada</p>
                  </div>
                ) : meetings.map(m => {
                  const mType = MEETING_TYPES.find(t => t.v === m.type) || MEETING_TYPES[0]
                  const MIcon = mType.icon
                  return (
                    <div key={m.id} className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <MIcon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{m.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(m.scheduled_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                              {' · '}{m.duration_min}min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColor(m.status)}`}>
                            {m.status === 'scheduled' ? 'Agendada' : m.status === 'completed' ? 'Realizada' : 'Cancelada'}
                          </span>
                          <button onClick={() => setMeetingModal(m)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteMeeting(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {m.meet_link && (
                        <a href={m.meet_link} target="_blank" rel="noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-3.5 h-3.5" /> Abrir reunião
                        </a>
                      )}
                      {m.notes && <p className="mt-2 text-xs text-gray-500 italic">{m.notes}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-wrap">
            {isClientOrClosed && !isNew && !alreadyConverted && (
              <button onClick={() => { onStartOnboarding(form as Lead); onClose() }}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm shadow-sm">
                🏫 Iniciar onboarding
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
              {isNew ? 'Cancelar' : 'Fechar'}
            </button>
            <button onClick={handleSave} disabled={saving || !form.school_name || !form.name}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                : <><CheckCircle2 className="w-4 h-4" /> {isNew ? 'Criar lead' : 'Salvar alterações'}</>}
            </button>
          </div>
        </div>
      </div>

      {meetingModal !== null && initialLead && (
        <CRMeetingModal
          lead={initialLead}
          meeting={meetingModal === 'new' ? null : meetingModal}
          consultants={consultants}
          onClose={() => setMeetingModal(null)}
          onSave={() => { setMeetingModal(null); loadMeetings() }}
        />
      )}
    </>
  )
}
