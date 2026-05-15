// src/components/superadmin/AdminCRM.tsx
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { useNavigate } from 'react-router-dom'
import { createGoogleMeet, buildEndDatetime } from '../../lib/googleMeet'
import {
  Plus, X, Search, Phone, Mail, MapPin,
  Calendar, Clock, ChevronRight, AlertCircle, CheckCircle2,
  MessageCircle, Edit2, Trash2, Building2, DollarSign,
  RefreshCw, Eye, Star, TrendingUp,
  Bell, ChevronDown, StickyNote, Send, Zap, EyeOff,
  Video, Users, ExternalLink, Link2,
} from 'lucide-react'

type Stage = 'interesse' | 'qualificacao' | 'proposta' | 'negociacao' | 'fechado' | 'cliente'

interface Lead {
  id: string; name: string; school_name: string; city: string; state: string
  phone: string; email: string; stage: Stage; origin: string
  monthly_value?: number; implementation_value?: number
  consultant_id?: string; notes?: string; next_followup?: string
  converted_institution_id?: string; created_at: string; updated_at: string
}

interface Interaction {
  id: string; lead_id: string; type: 'call' | 'whatsapp' | 'email' | 'meeting' | 'note'
  content: string; created_at: string
}

interface CRMeeting {
  id: string; lead_id: string; title: string
  type: 'video' | 'phone' | 'presential'
  scheduled_at: string; duration_min: number
  meet_link?: string; google_event_id?: string; calendar_link?: string
  attendees: string[]; status: 'scheduled' | 'completed' | 'cancelled'
  notes?: string; created_at: string
}

const STAGES: { id: Stage; label: string; color: string; bg: string; border: string }[] = [
  { id: 'interesse',    label: 'Interesse',    color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  { id: 'qualificacao', label: 'Qualificação', color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC' },
  { id: 'proposta',     label: 'Proposta',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'negociacao',   label: 'Negociação',   color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { id: 'fechado',      label: 'Fechado ✓',    color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { id: 'cliente',      label: 'Cliente 🏫',   color: '#00523C', bg: '#ECFDF5', border: '#6EE7B7' },
]

const ORIGINS = ['Indicação', 'Google', 'Instagram', 'Facebook', 'Evento', 'LinkedIn', 'Site', 'Outro']

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

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n?: number) {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}
function isOverdue(d?: string) { return !!d && new Date(d) < new Date() }
function isDueSoon(d?: string) {
  if (!d) return false
  const ms = new Date(d).getTime() - Date.now()
  return ms > 0 && ms < 48 * 3600000
}

// ─── CRM Meeting Modal ────────────────────────────────────────────────────
function CRMeetingModal({ lead, meeting, onClose, onSave }: {
  lead: Lead; meeting?: CRMeeting | null
  onClose: () => void; onSave: () => void
}) {
  const isNew = !meeting?.id
  const [form, setForm] = useState({
    title:        meeting?.title        || `Reunião — ${lead.school_name}`,
    type:         meeting?.type         || 'video' as CRMeeting['type'],
    scheduled_at: meeting?.scheduled_at?.slice(0, 16) || '',
    duration_min: meeting?.duration_min ?? 30,
    meet_link:    meeting?.meet_link    || '',
    attendees:    (meeting?.attendees   || []).join(', '),
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
      attendees: form.attendees.split(',').map(s => s.trim()).filter(Boolean),
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
      attendees:    form.attendees.split(',').map(s => s.trim()).filter(Boolean),
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
            <label className={lbl}>Participantes (e-mails separados por vírgula)</label>
            <input className={inp} placeholder="contato@escola.com.br, gerente@aionedu.com.br" value={form.attendees} onChange={e => set('attendees', e.target.value)} />
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

// ─── Lead Card ────────────────────────────────────────────────────────────
function LeadCard({ lead, stage, consultants, meetingCount, onClick, onMoveStage, onDelete }: {
  lead: Lead; stage: typeof STAGES[0]; consultants: any[]
  meetingCount: number
  onClick: () => void; onMoveStage: (to: Stage) => void; onDelete: () => void
}) {
  const [menu, setMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const overdue = isOverdue(lead.next_followup)
  const soon    = isDueSoon(lead.next_followup)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 cursor-pointer hover:shadow-md transition-all hover:border-gray-200 group" onClick={onClick}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm leading-tight truncate">{lead.school_name}</p>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenu(!menu)} className="p-1 hover:bg-gray-100 rounded">
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            {menu && (
              <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-xl shadow-xl z-50 w-44 py-1 overflow-hidden">
                <p className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mover para</p>
                {STAGES.filter(s => s.id !== lead.stage).map(s => (
                  <button key={s.id} onClick={() => { onMoveStage(s.id); setMenu(false) }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-semibold" style={{ color: s.color }}>
                    → {s.label}
                  </button>
                ))}
                <div className="border-t border-gray-100 mt-1" />
                <button onClick={() => { onDelete(); setMenu(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50 font-semibold flex items-center gap-1.5">
                  <Trash2 className="w-3 h-3" /> Excluir lead
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(lead.city || lead.state) && (
        <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {[lead.city, lead.state].filter(Boolean).join('/')}
        </div>
      )}

      {lead.monthly_value && (
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 mb-2">
          <DollarSign className="w-3 h-3 text-green-500" />
          {fmtBRL(lead.monthly_value)}/mês
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        {lead.origin && (
          <span className="inline-block text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: stage.bg, color: stage.color, border: `1px solid ${stage.border}` }}>
            {lead.origin}
          </span>
        )}
        {meetingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 border border-blue-100">
            <Video className="w-3 h-3" />{meetingCount}
          </span>
        )}
        {lead.converted_institution_id && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
            <Building2 className="w-3 h-3" />Escola
          </span>
        )}
      </div>

      {lead.next_followup && (
        <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg mt-1 font-medium
          ${overdue ? 'bg-red-50 text-red-600' : soon ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-500'}`}>
          {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          {new Date(lead.next_followup).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
        </div>
      )}

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-400">{timeAgo(lead.updated_at || lead.created_at)}</span>
      </div>

      {(lead.stage === 'fechado' || lead.stage === 'cliente') && !lead.converted_institution_id && (
        <div className="mt-2 w-full py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-xs font-bold rounded-lg text-center"
          onClick={e => { e.stopPropagation(); onClick() }}>
          🏫 Iniciar onboarding →
        </div>
      )}

      {lead.converted_institution_id && (
        <div className="mt-2 w-full py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg text-center">
          ✓ Escola criada
        </div>
      )}
    </div>
  )
}

// ─── Lead Modal ───────────────────────────────────────────────────────────
function LeadModal({ lead: initialLead, consultants, onClose, onSave, onStartOnboarding }: {
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
          onClose={() => setMeetingModal(null)}
          onSave={() => { setMeetingModal(null); loadMeetings() }}
        />
      )}
    </>
  )
}

// ─── Onboarding Modal — 3-step wizard ────────────────────────────────────
function OnboardingFromLeadModal({ lead, consultants, onClose, onSuccess }: {
  lead: Lead; consultants: any[]; onClose: () => void; onSuccess: (institutionId: string) => void
}) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name:               lead.school_name || '',
    cnpj:               '',
    city:               lead.city  || '',
    state:              lead.state || '',
    phone:              lead.phone || '',
    plan:               'escola',
    consultantId:       lead.consultant_id || '',
    isFree:             false,
    implementationValue: String(lead.implementation_value || 550),
    monthlyValue:       String(lead.monthly_value || 550),
    billingDueDay:      '10',
    managerName:        lead.name  || '',
    email:              lead.email || '',
    password:           '',
  })
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const validateStep = (s: number) => {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!form.name.trim())  e.name  = 'Obrigatório'
      if (!form.city.trim())  e.city  = 'Obrigatório'
      if (!form.state.trim()) e.state = 'Obrigatório'
    }
    if (s === 3) {
      if (!form.managerName.trim()) e.managerName = 'Obrigatório'
      if (!form.email.trim())       e.email       = 'Obrigatório'
      if (form.password.length < 8) e.password    = 'Mínimo 8 caracteres'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => { if (validateStep(step)) setStep(s => s + 1) }

  const handleCreate = async () => {
    if (!validateStep(3)) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada.')

      const { data: institution, error: instErr } = await supabase.from('institutions').insert({
        name:                 form.name.trim(),
        cnpj:                 form.cnpj.trim() || null,
        city:                 form.city.trim(),
        state:                form.state.trim().toUpperCase(),
        phone:                form.phone.trim() || null,
        email:                form.email.trim().toLowerCase(),
        consultant_id:        form.consultantId || null,
        plan:                 form.plan,
        plan_status:          form.isFree ? 'active' : 'pending_contract',
        monthly_value:        form.isFree ? 0 : Number(form.monthlyValue),
        implementation_value: form.isFree ? 0 : Number(form.implementationValue),
      }).select().single()
      if (instErr) throw new Error(instErr.message)

      const fnRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password, full_name: form.managerName.trim(), role: 'admin', user_type: 'school_user', institution_id: institution.id }),
      })
      const fnData = await fnRes.json()
      if (!fnRes.ok || fnData?.error) {
        await supabase.from('institutions').delete().eq('id', institution.id)
        throw new Error(fnData?.error || 'Erro ao criar usuário')
      }

      if (!form.isFree) {
        try {
          const { data: asaasData } = await supabase.functions.invoke('asaas-create-charge', {
            body: {
              institution_id: institution.id, name: form.name.trim(),
              email: form.email.trim().toLowerCase(), cpfCnpj: form.cnpj.replace(/\D/g, '') || null,
              value: Number(form.implementationValue),
              description: `Taxa de implantação — ${form.name.trim()}`,
              dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
            },
          })
          if (asaasData?.paymentLink) {
            await supabase.functions.invoke('send-email', {
              body: {
                type: 'payment_link', to: form.email.trim().toLowerCase(),
                data: {
                  institution_name: form.name.trim(),
                  value: Number(form.implementationValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
                  due_date: new Date(Date.now() + 7 * 86400000).toLocaleDateString('pt-BR'),
                  billing_type: 'PIX/Boleto', payment_link: asaasData.paymentLink,
                },
              },
            })
          }
        } catch {}
      } else {
        try {
          await supabase.functions.invoke('send-email', {
            body: { type: 'new_institution', to: form.email.trim().toLowerCase(), data: { institution_name: form.name.trim(), login_url: 'https://aionedu.com.br/login' } },
          })
        } catch {}
      }

      await supabase.from('crm_leads').update({ stage: 'cliente', converted_institution_id: institution.id, updated_at: new Date().toISOString() }).eq('id', lead.id)
      onSuccess(institution.id)
    } catch (e: any) {
      setErrors({ _global: e?.message || 'Erro ao criar escola.' })
    } finally {
      setSaving(false)
    }
  }

  const inp2 = (err?: string) => `${inp} ${err ? 'border-red-400' : ''}`

  const STEPS = ['Dados da escola', 'Plano e financeiro', 'Acesso do gestor']

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between">
          <div>
            <span className="text-xs font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">🏫 Onboarding de lead</span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">Criar escola — {lead.school_name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors
                ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold hidden sm:block ${step === i + 1 ? 'text-cyan-700' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${step > i + 1 ? 'bg-green-300' : 'bg-gray-100'}`} />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-5 space-y-4">
          {errors._global && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{errors._global}
            </div>
          )}

          {/* ── Step 1: Dados da escola ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={lbl}>Nome da escola *</label>
                <input className={inp2(errors.name)} value={form.name} onChange={e => set('name', e.target.value)} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>CNPJ</label>
                  <input className={inp} value={form.cnpj} onChange={e => set('cnpj', e.target.value)} placeholder="00.000.000/0001-00" />
                </div>
                <div>
                  <label className={lbl}>Telefone</label>
                  <input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
                <div>
                  <label className={lbl}>Cidade *</label>
                  <input className={inp2(errors.city)} value={form.city} onChange={e => set('city', e.target.value)} />
                  {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className={lbl}>UF *</label>
                  <input className={inp2(errors.state)} maxLength={2} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} />
                  {errors.state && <p className="text-xs text-red-500 mt-1">{errors.state}</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Plano e financeiro ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Plano</label>
                  <select className={inp} value={form.plan} onChange={e => set('plan', e.target.value)}>
                    <option value="escola">Escola Padrão</option>
                    <option value="rede">Rede</option>
                    <option value="gratuito">Gratuito</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Consultor</label>
                  <select className={inp} value={form.consultantId} onChange={e => set('consultantId', e.target.value)}>
                    <option value="">Sem consultor</option>
                    {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div>
                  <p className="text-sm font-semibold text-gray-700">Acesso gratuito</p>
                  <p className="text-xs text-gray-400">Sem cobrança de implantação ou mensalidade</p>
                </div>
                <button onClick={() => set('isFree', !form.isFree)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.isFree ? 'bg-purple-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {!form.isFree && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={lbl}>Implantação (R$)</label>
                    <input type="number" className={inp} value={form.implementationValue} onChange={e => set('implementationValue', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Mensalidade (R$)</label>
                    <input type="number" className={inp} value={form.monthlyValue} onChange={e => set('monthlyValue', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Vencimento (dia)</label>
                    <select className={inp} value={form.billingDueDay} onChange={e => set('billingDueDay', e.target.value)}>
                      {['5','10','15','20','25'].map(d => <option key={d} value={d}>Dia {d}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Acesso do gestor ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Acesso do gestor</p>
                <div>
                  <label className={lbl}>Nome do gestor *</label>
                  <input className={inp2(errors.managerName)} value={form.managerName} onChange={e => set('managerName', e.target.value)} />
                  {errors.managerName && <p className="text-xs text-red-500 mt-1">{errors.managerName}</p>}
                </div>
                <div>
                  <label className={lbl}>E-mail *</label>
                  <input type="email" className={inp2(errors.email)} value={form.email} onChange={e => set('email', e.target.value)} />
                  {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                </div>
                <div>
                  <label className={lbl}>Senha inicial *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className={inp2(errors.password) + ' pr-10'}
                      placeholder="Mínimo 8 caracteres" value={form.password} onChange={e => set('password', e.target.value)} />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
                </div>
              </div>

              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-4">
                <p className="text-xs font-bold text-cyan-700 uppercase tracking-wide mb-2">Resumo — o que será feito</p>
                <div className="space-y-1.5">
                  <p className="text-xs text-cyan-700">✅ Criar escola <strong>{form.name}</strong> ({form.city}/{form.state})</p>
                  <p className="text-xs text-cyan-700">✅ Criar usuário gestor para <strong>{form.email}</strong></p>
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Gerar cobrança de implantação no Asaas (R$ {form.implementationValue})</p>}
                  {!form.isFree && <p className="text-xs text-cyan-700">✅ Enviar e-mail com link de pagamento ao gestor</p>}
                  {form.isFree && <p className="text-xs text-cyan-700">✅ Enviar e-mail de acesso imediato ao gestor</p>}
                  <p className="text-xs text-cyan-700">✅ Converter lead para cliente no CRM</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={step > 1 ? () => setStep(s => s - 1) : onClose}
            className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
            {step > 1 ? '← Voltar' : 'Cancelar'}
          </button>
          {step < 3 ? (
            <button onClick={nextStep}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-sm">
              Próximo →
            </button>
          ) : (
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</> : <>🏫 Criar escola e iniciar onboarding</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminCRM() {
  const navigate = useNavigate()
  const [leads, setLeads]               = useState<Lead[]>([])
  const [consultants, setConsultants]   = useState<any[]>([])
  const [meetingCounts, setMeetingCounts] = useState<Record<string, number>>({})
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [filterStage, setFilterStage]   = useState<Stage | 'all'>('all')
  const [filterConsultant, setFilterConsultant] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('')
  const [showOverdueOnly, setShowOverdueOnly] = useState(false)
  const [view, setView]                 = useState<'kanban' | 'list'>('kanban')
  const [selectedLead, setSelectedLead] = useState<Lead | null | 'new'>(null)
  const [onboardingLead, setOnboardingLead] = useState<Lead | null>(null)
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [leadsRes, consultRes, meetingsRes] = await Promise.all([
      supabase.from('crm_leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant'),
      supabase.from('crm_meetings').select('lead_id').eq('status', 'scheduled'),
    ])
    setLeads(leadsRes.data || [])
    setConsultants(consultRes.data || [])

    const counts: Record<string, number> = {}
    for (const m of (meetingsRes.data || [])) {
      counts[m.lead_id] = (counts[m.lead_id] || 0) + 1
    }
    setMeetingCounts(counts)
    setLoading(false)
  }

  const filteredLeads = leads.filter(l => {
    const matchSearch     = !search || [l.school_name, l.name, l.city, l.email, l.phone].some(f => f?.toLowerCase().includes(search.toLowerCase()))
    const matchStage      = filterStage === 'all' || l.stage === filterStage
    const matchConsultant = !filterConsultant || l.consultant_id === filterConsultant
    const matchOrigin     = !filterOrigin || l.origin === filterOrigin
    const matchOverdue    = !showOverdueOnly || isOverdue(l.next_followup)
    return matchSearch && matchStage && matchConsultant && matchOrigin && matchOverdue
  })

  const overdueCount = leads.filter(l => isOverdue(l.next_followup) && !['fechado','cliente'].includes(l.stage)).length

  const handleSaveLead = async (form: Partial<Lead>) => {
    try {
      if (form.id) {
        const { error } = await supabase.from('crm_leads').update({ ...form, updated_at: new Date().toISOString() }).eq('id', form.id)
        if (error) throw error
        showToast('Lead atualizado!')
      } else {
        const { error } = await supabase.from('crm_leads').insert({ ...form, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        if (error) throw error
        showToast('Lead criado!')
      }
      setSelectedLead(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    }
  }

  const handleMoveStage = async (lead: Lead, to: Stage) => {
    await supabase.from('crm_leads').update({ stage: to, updated_at: new Date().toISOString() }).eq('id', lead.id)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este lead?')) return
    await supabase.from('crm_leads').delete().eq('id', id)
    showToast('Lead excluído.')
    loadData()
  }

  const handleOnboardingSuccess = (institutionId: string) => {
    setOnboardingLead(null)
    showToast('🎉 Escola criada! Lead convertido.')
    loadData()
    navigate('/super-admin/onboarding')
  }

  const kpis = {
    total:        leads.length,
    active:       leads.filter(l => !['fechado','cliente'].includes(l.stage)).length,
    closed:       leads.filter(l => l.stage === 'fechado').length,
    clients:      leads.filter(l => l.stage === 'cliente').length,
    mrr_pipeline: leads.filter(l => l.monthly_value).reduce((s, l) => s + (l.monthly_value || 0), 0),
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">CRM Comercial</h1>
            <p className="text-sm text-gray-500 mt-1">Pipeline de prospecção e fechamento</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {overdueCount > 0 && (
              <button onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all
                  ${showOverdueOnly ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'}`}>
                <AlertCircle className="w-4 h-4" /> {overdueCount} vencido{overdueCount > 1 ? 's' : ''}
              </button>
            )}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView('kanban')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'kanban' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Kanban</button>
              <button onClick={() => setView('list')} className={`px-3 py-2 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Lista</button>
            </div>
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => setSelectedLead('new')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm">
              <Plus className="w-4 h-4" /> Novo lead
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total leads',  value: kpis.total,   icon: TrendingUp, color: 'text-blue-600',    bg: 'bg-blue-50'    },
            { label: 'Em andamento', value: kpis.active,  icon: Clock,      color: 'text-cyan-600',    bg: 'bg-cyan-50'    },
            { label: 'Fechados',     value: kpis.closed,  icon: Star,       color: 'text-green-600',   bg: 'bg-green-50'   },
            { label: 'Clientes',     value: kpis.clients, icon: Building2,  color: 'text-emerald-700', bg: 'bg-emerald-50' },
            { label: 'MRR pipeline', value: kpis.mrr_pipeline > 0 ? kpis.mrr_pipeline.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—', icon: DollarSign, color: 'text-purple-600', bg: 'bg-purple-50' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <div className={`w-7 h-7 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${k.color}`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900">{loading ? '—' : k.value}</p>
              </div>
            )
          })}
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder="Buscar escola, contato, cidade..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterStage} onChange={e => setFilterStage(e.target.value as any)}>
            <option value="all">Todos os estágios</option>
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterConsultant} onChange={e => setFilterConsultant(e.target.value)}>
            <option value="">Todos os consultores</option>
            {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
            value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}>
            <option value="">Todas as origens</option>
            {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        {view === 'kanban' && (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map(stage => {
              const stageLeads = filteredLeads.filter(l => l.stage === stage.id)
              const stageValue = stageLeads.reduce((s, l) => s + (l.monthly_value || 0), 0)
              return (
                <div key={stage.id} className="flex-shrink-0 w-64">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: stage.color }}>{stage.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: stage.bg, color: stage.color }}>{stageLeads.length}</span>
                    </div>
                    {stageValue > 0 && <span className="text-xs text-gray-400 font-semibold">{stageValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>}
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {stageLeads.map(lead => (
                      <LeadCard key={lead.id} lead={lead} stage={stage} consultants={consultants}
                        meetingCount={meetingCounts[lead.id] || 0}
                        onClick={() => setSelectedLead(lead)}
                        onMoveStage={to => handleMoveStage(lead, to)}
                        onDelete={() => handleDelete(lead.id)}
                      />
                    ))}
                    {stageLeads.length === 0 && (
                      <div className="border-2 border-dashed border-gray-100 rounded-xl py-8 text-center text-gray-300">
                        <p className="text-xs">Sem leads</p>
                      </div>
                    )}
                    <button onClick={() => setSelectedLead({ stage: stage.id } as any)}
                      className="w-full py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-cyan-300 hover:text-cyan-500 transition-colors font-medium">
                      + Adicionar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {view === 'list' && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Escola','Contato','Localização','Estágio','Valores','Follow-up','Ações'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLeads.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm">Nenhum lead encontrado</p>
                    </td></tr>
                  ) : filteredLeads.map(lead => {
                    const stage   = STAGES.find(s => s.id === lead.stage) || STAGES[0]
                    const overdue = isOverdue(lead.next_followup)
                    return (
                      <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedLead(lead)}>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-gray-900 text-sm">{lead.school_name}</p>
                          {(meetingCounts[lead.id] || 0) > 0 && (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-500 mt-0.5">
                              <Video className="w-3 h-3" />{meetingCounts[lead.id]} reunião
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm text-gray-700">{lead.name}</p>
                          {lead.phone && <p className="text-xs text-gray-400">{lead.phone}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-gray-500">{[lead.city, lead.state].filter(Boolean).join('/')}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: stage.color, background: stage.bg }}>{stage.label}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-gray-600">
                          {lead.monthly_value && <p className="font-semibold">{fmtBRL(lead.monthly_value)}/mês</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          {lead.next_followup ? (
                            <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                              {overdue && '⚠️ '}{new Date(lead.next_followup).toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {(lead.stage === 'fechado' || lead.stage === 'cliente') && !lead.converted_institution_id && (
                              <button onClick={() => setOnboardingLead(lead)} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg font-bold hover:bg-green-100">🏫</button>
                            )}
                            <button onClick={() => handleDelete(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {selectedLead !== null && (
        <LeadModal
          lead={selectedLead === 'new' ? null : selectedLead}
          consultants={consultants}
          onClose={() => setSelectedLead(null)}
          onSave={handleSaveLead}
          onStartOnboarding={lead => { setSelectedLead(null); setOnboardingLead(lead) }}
        />
      )}

      {onboardingLead && (
        <OnboardingFromLeadModal
          lead={onboardingLead}
          consultants={consultants}
          onClose={() => setOnboardingLead(null)}
          onSuccess={handleOnboardingSuccess}
        />
      )}

    </SuperAdminLayout>
  )
}
