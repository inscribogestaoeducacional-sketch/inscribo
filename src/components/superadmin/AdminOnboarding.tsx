// src/components/superadmin/AdminOnboarding.tsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Calendar, CheckCircle2, Clock, Plus, X,
  ChevronRight, ChevronDown, AlertCircle, Edit2, Trash2,
  RefreshCw, ExternalLink, Video, Check, MoreHorizontal,
  Flag, Zap, Users, BookOpen, TrendingUp, Star,
  Bell, ArrowRight, Info, Link as LinkIcon
} from 'lucide-react'

// ─── tipos ────────────────────────────────────────────────────────────────
type Phase = 'contract' | 'implementation' | 'training' | 'campaign' | 'monthly'
type MeetingType = 'kickoff' | 'implementation' | 'training' | 'monthly' | 'extra'
type MeetingStatus = 'scheduled' | 'done' | 'cancelled' | 'rescheduled'

interface Institution { id: string; name: string; city: string; state: string; email: string }
interface Process {
  id: string
  institution_id: string
  status: 'pending' | 'in_progress' | 'completed' | 'paused'
  current_phase: Phase
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  institution?: Institution
  tasks?: Task[]
  meetings?: Meeting[]
}
interface Task {
  id: string
  process_id: string
  phase: Phase
  title: string
  description: string | null
  done: boolean
  done_at: string | null
  sort_order: number
}
interface Meeting {
  id: string
  process_id: string
  institution_id: string
  type: MeetingType
  title: string
  scheduled_at: string
  duration_min: number
  meet_link: string | null
  notes: string | null
  status: MeetingStatus
  institution?: Institution
}

// ─── constantes ───────────────────────────────────────────────────────────
const PHASES: { id: Phase; label: string; icon: any; color: string; bg: string }[] = [
  { id: 'contract',       label: 'Contrato',         icon: Flag,        color: '#6366F1', bg: '#EEF2FF' },
  { id: 'implementation', label: 'Implantação',      icon: Zap,         color: '#0891B2', bg: '#ECFEFF' },
  { id: 'training',       label: 'Treinamento',      icon: BookOpen,    color: '#D97706', bg: '#FFFBEB' },
  { id: 'campaign',       label: 'Campanha',         icon: TrendingUp,  color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'monthly',        label: 'Acompanhamento',   icon: Star,        color: '#16A34A', bg: '#F0FDF4' },
]

const MEETING_TYPES: { id: MeetingType; label: string; color: string; bg: string; defaultTitle: string; defaultDuration: number }[] = [
  { id: 'kickoff',        label: 'Kickoff',             color: '#6366F1', bg: '#EEF2FF', defaultTitle: 'Reunião de Kickoff',           defaultDuration: 90  },
  { id: 'implementation', label: 'Implantação',         color: '#0891B2', bg: '#ECFEFF', defaultTitle: 'Sessão de Implantação',        defaultDuration: 120 },
  { id: 'training',       label: 'Treinamento',         color: '#D97706', bg: '#FFFBEB', defaultTitle: 'Treinamento da Equipe',        defaultDuration: 120 },
  { id: 'monthly',        label: 'Reunião Mensal',      color: '#16A34A', bg: '#F0FDF4', defaultTitle: 'Reunião de Acompanhamento',    defaultDuration: 60  },
  { id: 'extra',          label: 'Extra',               color: '#6B7280', bg: '#F3F4F6', defaultTitle: 'Reunião Adicional',            defaultDuration: 60  },
]

const DEFAULT_TASKS: Record<Phase, { title: string; description: string }[]> = {
  contract: [
    { title: 'Contrato enviado via ZapSign',          description: 'Enviar contrato para assinatura digital' },
    { title: 'Contrato assinado pela escola',         description: 'Confirmar assinatura do responsável' },
    { title: 'Pagamento da implantação confirmado',   description: 'Verificar pagamento no Asaas' },
  ],
  implementation: [
    { title: 'Kickoff agendado e realizado',           description: 'Realizar reunião de kickoff com a escola' },
    { title: 'Dados do ERP importados',               description: 'Importar histórico do sistema atual da escola' },
    { title: 'WhatsApp oficial homologado',           description: 'Configurar número via API Oficial Meta' },
    { title: 'Equipe cadastrada no sistema',          description: 'Criar usuários para todos os atendentes' },
    { title: 'Fluxos de atendimento configurados',    description: 'Personalizar bot e fluxos do WhatsApp' },
    { title: 'Formulário de captação publicado',      description: 'Integrar formulário no site da escola' },
  ],
  training: [
    { title: 'Treinamento de CRM de Leads realizado', description: 'Treinar equipe no uso do kanban de leads' },
    { title: 'Treinamento de WhatsApp realizado',     description: 'Treinar equipe no uso do WhatsApp oficial' },
    { title: 'Treinamento de Relatórios realizado',   description: 'Treinar gestor na leitura dos relatórios' },
    { title: 'Dúvidas da equipe respondidas',         description: 'Sessão de perguntas e respostas' },
  ],
  campaign: [
    { title: 'Campanha configurada pelo gestor',      description: 'Gestor preencheu os dados da campanha' },
    { title: 'IA gerou o plano de campanha',          description: 'Plano com metas mensais gerado' },
    { title: 'Metas revisadas e aprovadas',           description: 'Gestor aprovou as metas sugeridas' },
    { title: 'Campanha liberada pelo admin',          description: 'Admin liberou o acesso à campanha' },
  ],
  monthly: [
    { title: '1ª reunião mensal realizada',           description: 'Primeiro acompanhamento mensal' },
    { title: 'Relatório do mês enviado',              description: 'Relatório de performance enviado por e-mail' },
  ],
}

// ─── helpers ──────────────────────────────────────────────────────────────
const inp  = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl  = 'block text-xs font-semibold text-gray-600 mb-1.5'

function msUntil(dateStr: string) {
  return new Date(dateStr).getTime() - Date.now()
}
function isToday(dateStr: string) {
  const d = new Date(dateStr)
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}
function isPast(dateStr: string) { return msUntil(dateStr) < 0 }
function isSoon(dateStr: string) { const ms = msUntil(dateStr); return ms > 0 && ms < 48 * 3600 * 1000 }

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(s: string) {
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function fmtCountdown(s: string) {
  const ms = msUntil(s)
  if (ms < 0) return 'Já passou'
  const h = Math.floor(ms / 3600000)
  if (h < 24) return `em ${h}h`
  return `em ${Math.floor(h / 24)}d`
}

function ToastBar({ msg, ok, onClose }: { msg: string; ok: boolean; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[300] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

// ─── Meeting Card ─────────────────────────────────────────────────────────
function MeetingCard({ meeting, onEdit, onMarkDone, onDelete }: {
  meeting: Meeting
  onEdit: () => void
  onMarkDone: () => void
  onDelete: () => void
}) {
  const mType  = MEETING_TYPES.find(t => t.id === meeting.type) || MEETING_TYPES[4]
  const past   = isPast(meeting.scheduled_at)
  const soon   = isSoon(meeting.scheduled_at)
  const today  = isToday(meeting.scheduled_at)
  const done   = meeting.status === 'done'
  const cancelled = meeting.status === 'cancelled'

  return (
    <div className={`bg-white rounded-xl border p-4 transition-all
      ${done      ? 'opacity-60 border-gray-100' :
        cancelled ? 'opacity-50 border-gray-100 bg-gray-50' :
        today     ? 'border-cyan-300 shadow-md ring-1 ring-cyan-200' :
        soon      ? 'border-amber-300 shadow-sm' :
        past      ? 'border-red-200 bg-red-50' :
                    'border-gray-200 hover:shadow-sm'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Type badge */}
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
            style={{ color: mType.color, background: mType.bg }}>
            {mType.label}
          </span>
          <p className={`font-bold text-sm leading-snug ${done || cancelled ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {meeting.title}
          </p>
          {meeting.institution && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              <Building2 className="w-3 h-3 inline mr-1" />
              {meeting.institution.name}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!done && !cancelled && (
            <button onClick={onMarkDone} title="Marcar como realizada"
              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Date/time */}
      <div className={`flex items-center gap-1.5 mt-2.5 text-xs font-semibold
        ${done ? 'text-gray-400' :
          today ? 'text-cyan-600' :
          soon  ? 'text-amber-600' :
          past && !done ? 'text-red-500' :
          'text-gray-500'}`}>
        <Clock className="w-3 h-3" />
        {fmtDateTime(meeting.scheduled_at)}
        {!done && !cancelled && (
          <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold
            ${today ? 'bg-cyan-100 text-cyan-700' :
              soon  ? 'bg-amber-100 text-amber-700' :
              past  ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-500'}`}>
            {today ? 'HOJE' : fmtCountdown(meeting.scheduled_at)}
          </span>
        )}
      </div>

      {/* Duration */}
      <p className="text-xs text-gray-400 mt-1">{meeting.duration_min} min</p>

      {/* Meet link */}
      {meeting.meet_link && !done && !cancelled && (
        <a href={meeting.meet_link} target="_blank" rel="noopener noreferrer"
          className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-cyan-600 hover:text-cyan-700"
          onClick={e => e.stopPropagation()}>
          <Video className="w-3.5 h-3.5" />
          Entrar na reunião →
        </a>
      )}

      {/* Notes */}
      {meeting.notes && (
        <p className="text-xs text-gray-400 mt-2 italic leading-relaxed line-clamp-2">{meeting.notes}</p>
      )}
    </div>
  )
}

// ─── Meeting Modal ────────────────────────────────────────────────────────
function MeetingModal({ meeting, processes, onClose, onSave }: {
  meeting: Partial<Meeting> | null
  processes: Process[]
  onClose: () => void
  onSave: (m: Partial<Meeting>) => Promise<void>
}) {
  const isNew = !meeting?.id
  const [form, setForm] = useState<Partial<Meeting>>(meeting || {
    type: 'kickoff', status: 'scheduled', duration_min: 60,
  })
  const [saving, setSaving] = useState(false)

  const set = (k: keyof Meeting, v: any) => setForm(f => ({ ...f, [k]: v }))

  // Preenche título e duração padrão ao mudar o tipo
  const handleTypeChange = (type: MeetingType) => {
    const mType = MEETING_TYPES.find(t => t.id === type)!
    set('type', type)
    if (!form.title || MEETING_TYPES.some(t => t.defaultTitle === form.title)) {
      set('title', mType.defaultTitle)
    }
    set('duration_min', mType.defaultDuration)
  }

  const handleSave = async () => {
    if (!form.institution_id || !form.scheduled_at || !form.title) return
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Nova reunião' : 'Editar reunião'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Escola */}
          <div>
            <label className={lbl}>Escola *</label>
            <select className={inp} value={form.institution_id || ''} onChange={e => {
              set('institution_id', e.target.value)
              const proc = processes.find(p => p.institution_id === e.target.value)
              if (proc) set('process_id', proc.id)
            }}>
              <option value="">Selecionar escola...</option>
              {processes.map(p => (
                <option key={p.id} value={p.institution_id}>{p.institution?.name || p.institution_id}</option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className={lbl}>Tipo de reunião *</label>
            <div className="grid grid-cols-3 gap-2">
              {MEETING_TYPES.map(t => (
                <button key={t.id} onClick={() => handleTypeChange(t.id)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border-2 transition-all text-center
                    ${form.type === t.id ? 'border-current' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                  style={form.type === t.id ? { color: t.color, background: t.bg, borderColor: t.color + '80' } : {}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className={lbl}>Título *</label>
            <input className={inp} value={form.title || ''} onChange={e => set('title', e.target.value)} placeholder="Título da reunião" />
          </div>

          {/* Data/hora + Duração */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data e hora *</label>
              <input type="datetime-local" className={inp} value={form.scheduled_at?.slice(0, 16) || ''}
                onChange={e => set('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Duração (minutos)</label>
              <select className={inp} value={form.duration_min || 60} onChange={e => set('duration_min', Number(e.target.value))}>
                {[30, 45, 60, 90, 120, 180].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className={lbl}>Link da reunião (Meet, Zoom...)</label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className={inp + ' pl-9'} type="url" value={form.meet_link || ''} onChange={e => set('meet_link', e.target.value)} placeholder="https://meet.google.com/..." />
            </div>
          </div>

          {/* Status */}
          {!isNew && (
            <div>
              <label className={lbl}>Status</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: 'scheduled',    l: 'Agendada',     c: 'bg-blue-100 text-blue-700' },
                  { v: 'done',         l: 'Realizada',    c: 'bg-green-100 text-green-700' },
                  { v: 'cancelled',    l: 'Cancelada',    c: 'bg-red-100 text-red-700' },
                  { v: 'rescheduled',  l: 'Reagendada',   c: 'bg-amber-100 text-amber-700' },
                ].map(s => (
                  <button key={s.v} onClick={() => set('status', s.v as MeetingStatus)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all
                      ${form.status === s.v ? s.c + ' border-current' : 'bg-gray-50 text-gray-400 border-gray-100 hover:border-gray-200'}`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <label className={lbl}>Observações</label>
            <textarea rows={2} className={inp + ' resize-none'} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Pauta, pontos a discutir..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.institution_id || !form.scheduled_at || !form.title}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              : <><CheckCircle2 className="w-4 h-4" /> {isNew ? 'Agendar reunião' : 'Salvar'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Process Card (escola) ────────────────────────────────────────────────
function ProcessCard({ process, onToggleTask, onAddMeeting, onEditMeeting, onMarkMeetingDone, onDeleteMeeting }: {
  process: Process
  onToggleTask: (taskId: string, done: boolean) => void
  onAddMeeting: (process: Process) => void
  onEditMeeting: (meeting: Meeting) => void
  onMarkMeetingDone: (meetingId: string) => void
  onDeleteMeeting: (meetingId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activePhase, setActivePhase] = useState<Phase>(process.current_phase)

  const phase  = PHASES.find(p => p.id === process.current_phase) || PHASES[0]
  const PhaseIcon = phase.icon

  const allTasks     = process.tasks || []
  const doneTasks    = allTasks.filter(t => t.done)
  const progress     = allTasks.length ? Math.round((doneTasks.length / allTasks.length) * 100) : 0

  const upcomingMeetings = (process.meetings || [])
    .filter(m => m.status === 'scheduled' || m.status === 'rescheduled')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

  const nextMeeting = upcomingMeetings[0]

  const phaseTasks = allTasks.filter(t => t.phase === activePhase)

  return (
    <div className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
      ${open ? 'border-cyan-200 shadow-md' : 'border-gray-200 hover:shadow-md hover:border-gray-300'}`}>

      {/* Header */}
      <button onClick={() => setOpen(!open)} className="w-full p-5 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-cyan-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-sm leading-tight truncate">
                {process.institution?.name || '—'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {process.institution?.city}{process.institution?.state ? `/${process.institution.state}` : ''}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ color: phase.color, background: phase.bg }}>
                  <PhaseIcon className="w-2.5 h-2.5" />
                  {phase.label}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">{doneTasks.length}/{allTasks.length} tarefas</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Progress ring */}
            <div className="relative w-10 h-10">
              <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E7EB" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={phase.color} strokeWidth="3"
                  strokeDasharray={`${progress * 0.942} 94.2`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-700">
                {progress}%
              </span>
            </div>
            {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: phase.color }} />
        </div>

        {/* Next meeting alert */}
        {nextMeeting && (
          <div className={`mt-3 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg
            ${isToday(nextMeeting.scheduled_at)  ? 'bg-cyan-50 text-cyan-700' :
              isSoon(nextMeeting.scheduled_at)   ? 'bg-amber-50 text-amber-700' :
              isPast(nextMeeting.scheduled_at)   ? 'bg-red-50 text-red-600' :
                                                   'bg-gray-50 text-gray-500'}`}>
            <Calendar className="w-3.5 h-3.5" />
            {isToday(nextMeeting.scheduled_at) ? '⚡ HOJE: ' :
             isSoon(nextMeeting.scheduled_at)  ? '⏰ Em breve: ' :
             isPast(nextMeeting.scheduled_at)  ? '⚠️ Atrasada: ' : '📅 '}
            {nextMeeting.title} — {fmtDateTime(nextMeeting.scheduled_at)}
            {nextMeeting.meet_link && (
              <a href={nextMeeting.meet_link} target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()} className="ml-auto underline flex items-center gap-1">
                <Video className="w-3 h-3" /> Entrar
              </a>
            )}
          </div>
        )}
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100">
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {PHASES.map(p => {
              const PIcon = p.icon
              const phaseDone = allTasks.filter(t => t.phase === p.id && t.done).length
              const phaseTotal = allTasks.filter(t => t.phase === p.id).length
              const active = activePhase === p.id
              return (
                <button key={p.id} onClick={() => setActivePhase(p.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0
                    ${active ? 'border-current' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                  style={active ? { color: p.color, borderColor: p.color } : {}}>
                  <PIcon className="w-3.5 h-3.5" />
                  {p.label}
                  {phaseTotal > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                      ${phaseDone === phaseTotal ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {phaseDone}/{phaseTotal}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Checklist */}
            <div className="p-5 border-r border-gray-50">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Checklist</p>
              {phaseTasks.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Nenhuma tarefa nesta fase.</p>
              ) : (
                <div className="space-y-2">
                  {phaseTasks.sort((a, b) => a.sort_order - b.sort_order).map(task => (
                    <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                      <div onClick={() => onToggleTask(task.id, !task.done)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                          ${task.done
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 group-hover:border-cyan-400'}`}>
                        {task.done && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium leading-snug ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{task.description}</p>
                        )}
                        {task.done && task.done_at && (
                          <p className="text-[10px] text-green-500 mt-0.5">✓ {fmtDate(task.done_at)}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Reuniões */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Reuniões</p>
                <button onClick={() => onAddMeeting(process)}
                  className="flex items-center gap-1 text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                  <Plus className="w-3.5 h-3.5" /> Agendar
                </button>
              </div>
              {(process.meetings || []).length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                  <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  <p className="text-xs text-gray-400">Nenhuma reunião agendada</p>
                  <button onClick={() => onAddMeeting(process)} className="mt-2 text-xs text-cyan-500 font-semibold">
                    + Agendar primeira reunião
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {(process.meetings || [])
                    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())
                    .map(meeting => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onEdit={() => onEditMeeting(meeting)}
                        onMarkDone={() => onMarkMeetingDone(meeting.id)}
                        onDelete={() => onDeleteMeeting(meeting.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminOnboarding() {
  const [processes, setProcesses] = useState<Process[]>([])
  const [allMeetings, setAllMeetings] = useState<Meeting[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading]   = useState(true)
  const [view, setView]         = useState<'processes' | 'calendar'>('processes')
  const [search, setSearch]     = useState('')
  const [filterPhase, setFilterPhase] = useState<Phase | 'all'>('all')
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  const [meetingModal, setMeetingModal] = useState<{ meeting: Partial<Meeting> | null; open: boolean }>({ meeting: null, open: false })
  const [newProcessModal, setNewProcessModal] = useState(false)
  const [newProcessInstitution, setNewProcessInstitution] = useState('')
  const [creatingProcess, setCreatingProcess] = useState(false)

  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  // ── load ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [procRes, meetRes, instRes] = await Promise.all([
        supabase.from('onboarding_processes')
          .select('*, institutions(id, name, city, state, email)')
          .order('created_at', { ascending: false }),
        supabase.from('onboarding_meetings')
          .select('*, institutions(id, name, city, state)')
          .order('scheduled_at'),
        supabase.from('institutions')
          .select('id, name, city, state, email')
          .eq('plan_status', 'active')
          .order('name'),
      ])

      const procs: Process[] = (procRes.data || []).map((p: any) => ({
        ...p,
        institution: p.institutions,
      }))

      // Carrega tasks e meetings por processo
      if (procs.length > 0) {
        const [tasksRes] = await Promise.all([
          supabase.from('onboarding_tasks')
            .select('*')
            .in('process_id', procs.map(p => p.id))
            .order('sort_order'),
        ])
        const tasks: Task[] = tasksRes.data || []
        const meetings: Meeting[] = (meetRes.data || []).map((m: any) => ({
          ...m, institution: m.institutions,
        }))

        procs.forEach(p => {
          p.tasks    = tasks.filter(t => t.process_id === p.id)
          p.meetings = meetings.filter(m => m.process_id === p.id)
        })
        setAllMeetings(meetings)
      }

      setProcesses(procs)
      setInstitutions(instRes.data || [])
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar dados', false)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── alerta de reuniões hoje ao abrir ─────────────────
  useEffect(() => {
    if (!loading) {
      const todayMeetings = allMeetings.filter(m =>
        m.status === 'scheduled' && isToday(m.scheduled_at)
      )
      if (todayMeetings.length > 0) {
        showToast(`📅 Você tem ${todayMeetings.length} reunião(ões) hoje!`)
      }
    }
  }, [loading])

  // ── criar processo ────────────────────────────────────
  const handleCreateProcess = async () => {
    if (!newProcessInstitution) return
    setCreatingProcess(true)
    try {
      const { data: proc, error: procErr } = await supabase
        .from('onboarding_processes')
        .insert({
          institution_id: newProcessInstitution,
          status: 'in_progress',
          current_phase: 'contract',
          started_at: new Date().toISOString(),
        })
        .select().single()
      if (procErr) throw procErr

      // Cria todas as tasks padrão
      const allDefaultTasks: any[] = []
      let order = 0
      for (const phase of Object.keys(DEFAULT_TASKS) as Phase[]) {
        for (const task of DEFAULT_TASKS[phase]) {
          allDefaultTasks.push({
            process_id: proc.id,
            phase,
            title: task.title,
            description: task.description,
            done: false,
            sort_order: order++,
          })
        }
      }
      await supabase.from('onboarding_tasks').insert(allDefaultTasks)

      showToast('Processo de onboarding iniciado!')
      setNewProcessModal(false)
      setNewProcessInstitution('')
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar processo', false)
    } finally {
      setCreatingProcess(false)
    }
  }

  // ── toggle task ───────────────────────────────────────
  const handleToggleTask = async (taskId: string, done: boolean) => {
    await supabase.from('onboarding_tasks').update({
      done,
      done_at: done ? new Date().toISOString() : null,
    }).eq('id', taskId)

    // Atualiza estado local
    setProcesses(prev => prev.map(p => ({
      ...p,
      tasks: (p.tasks || []).map(t => t.id === taskId ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t),
    })))

    // Verifica se a fase deve avançar
    const process = processes.find(p => p.tasks?.some(t => t.id === taskId))
    if (process && done) {
      const phaseTasks = (process.tasks || []).filter(t => t.phase === process.current_phase)
      const donePhaseTasks = phaseTasks.filter(t => t.id === taskId ? done : t.done)
      if (phaseTasks.length > 0 && donePhaseTasks.length === phaseTasks.length) {
        const phaseIdx = PHASES.findIndex(p => p.id === process.current_phase)
        const nextPhase = PHASES[phaseIdx + 1]
        if (nextPhase) {
          await supabase.from('onboarding_processes').update({ current_phase: nextPhase.id }).eq('id', process.id)
          showToast(`🎉 Fase "${PHASES[phaseIdx].label}" concluída! Avançando para "${nextPhase.label}"`)
          loadData()
        }
      }
    }
  }

  // ── salvar reunião ────────────────────────────────────
  const handleSaveMeeting = async (form: Partial<Meeting>) => {
    try {
      if (form.id) {
        const { error } = await supabase.from('onboarding_meetings').update(form).eq('id', form.id)
        if (error) throw error
        showToast('Reunião atualizada!')
      } else {
        const { error } = await supabase.from('onboarding_meetings').insert(form)
        if (error) throw error
        showToast('Reunião agendada!')
      }
      setMeetingModal({ meeting: null, open: false })
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar reunião', false)
    }
  }

  const handleMarkMeetingDone = async (id: string) => {
    await supabase.from('onboarding_meetings').update({ status: 'done' }).eq('id', id)
    showToast('Reunião marcada como realizada!')
    loadData()
  }

  const handleDeleteMeeting = async (id: string) => {
    if (!confirm('Excluir esta reunião?')) return
    await supabase.from('onboarding_meetings').delete().eq('id', id)
    showToast('Reunião removida.')
    loadData()
  }

  // ── instâncias já com processo ────────────────────────
  const processedInstitutionIds = new Set(processes.map(p => p.institution_id))
  const availableInstitutions   = institutions.filter(i => !processedInstitutionIds.has(i.id))

  // ── filtro ────────────────────────────────────────────
  const filtered = processes.filter(p => {
    const matchSearch = !search || p.institution?.name?.toLowerCase().includes(search.toLowerCase())
    const matchPhase  = filterPhase === 'all' || p.current_phase === filterPhase
    return matchSearch && matchPhase
  })

  // ── KPIs ──────────────────────────────────────────────
  const kpis = {
    total:    processes.length,
    active:   processes.filter(p => p.status === 'in_progress').length,
    done:     processes.filter(p => p.status === 'completed').length,
    todayMeetings: allMeetings.filter(m => m.status === 'scheduled' && isToday(m.scheduled_at)).length,
    soonMeetings:  allMeetings.filter(m => m.status === 'scheduled' && isSoon(m.scheduled_at)).length,
  }

  // ── calendário ────────────────────────────────────────
  const calDays = (() => {
    const year  = calMonth.getFullYear()
    const month = calMonth.getMonth()
    const first = new Date(year, month, 1).getDay()
    const days  = new Date(year, month + 1, 0).getDate()
    return { first, days, year, month }
  })()

  const meetingsInMonth = allMeetings.filter(m => {
    const d = new Date(m.scheduled_at)
    return d.getFullYear() === calDays.year && d.getMonth() === calDays.month
  })

  const getMeetingsForDay = (day: number) =>
    meetingsInMonth.filter(m => new Date(m.scheduled_at).getDate() === day)

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar msg={toast.msg} ok={toast.ok} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Implantação & Treinamentos</h1>
            <p className="text-sm text-gray-500 mt-1">Acompanhe o onboarding de cada escola do início ao fim</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setView('processes')}
                className={`px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5
                  ${view === 'processes' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Users className="w-4 h-4" /> Escolas
              </button>
              <button onClick={() => setView('calendar')}
                className={`px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-1.5
                  ${view === 'calendar' ? 'bg-cyan-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Calendar className="w-4 h-4" /> Calendário
              </button>
            </div>
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setMeetingModal({ meeting: null, open: true })}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50">
              <Video className="w-4 h-4" /> Nova reunião
            </button>
            <button onClick={() => setNewProcessModal(true)} disabled={availableInstitutions.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50">
              <Plus className="w-4 h-4" /> Iniciar onboarding
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total processos', value: kpis.total,        icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Em andamento',    value: kpis.active,       icon: Zap,           color: 'text-cyan-600',   bg: 'bg-cyan-50' },
            { label: 'Concluídos',      value: kpis.done,         icon: Star,          color: 'text-green-600',  bg: 'bg-green-50' },
            { label: 'Reuniões hoje',   value: kpis.todayMeetings, icon: Calendar,     color: kpis.todayMeetings > 0 ? 'text-cyan-700' : 'text-gray-400',  bg: kpis.todayMeetings > 0 ? 'bg-cyan-50' : 'bg-gray-50' },
            { label: 'Em breve (<48h)', value: kpis.soonMeetings, icon: Bell,          color: kpis.soonMeetings > 0 ? 'text-amber-600' : 'text-gray-400',  bg: kpis.soonMeetings > 0 ? 'bg-amber-50' : 'bg-gray-50' },
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
                <p className="text-2xl font-bold text-gray-900">{loading ? '—' : k.value}</p>
              </div>
            )
          })}
        </div>

        {/* ── VIEW: ESCOLAS ── */}
        {view === 'processes' && (
          <>
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                  placeholder="Buscar escola..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={filterPhase} onChange={e => setFilterPhase(e.target.value as any)}>
                <option value="all">Todas as fases</option>
                {PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            {/* Process cards */}
            {loading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 h-24 animate-pulse" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Nenhum processo de onboarding</p>
                <p className="text-sm text-gray-400 mt-1">Inicie o onboarding de uma escola ativa</p>
                {availableInstitutions.length > 0 && (
                  <button onClick={() => setNewProcessModal(true)}
                    className="mt-4 px-4 py-2 bg-cyan-50 text-cyan-600 rounded-xl text-sm font-semibold hover:bg-cyan-100">
                    + Iniciar primeiro onboarding
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map(process => (
                  <ProcessCard
                    key={process.id}
                    process={process}
                    onToggleTask={handleToggleTask}
                    onAddMeeting={p => setMeetingModal({
                      meeting: { institution_id: p.institution_id, process_id: p.id, type: 'kickoff', status: 'scheduled', duration_min: 60 },
                      open: true,
                    })}
                    onEditMeeting={m => setMeetingModal({ meeting: m, open: true })}
                    onMarkMeetingDone={handleMarkMeetingDone}
                    onDeleteMeeting={handleDeleteMeeting}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── VIEW: CALENDÁRIO ── */}
        {view === 'calendar' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Calendar header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowRight className="w-4 h-4 text-gray-500 rotate-180" />
              </button>
              <h2 className="text-base font-bold text-gray-900 capitalize">
                {calMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Day names */}
            <div className="grid grid-cols-7 border-b border-gray-100">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
                <div key={d} className="py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wide">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7">
              {/* Empty cells */}
              {Array(calDays.first).fill(null).map((_, i) => (
                <div key={`e${i}`} className="min-h-[100px] p-2 border-b border-r border-gray-50 bg-gray-50/50" />
              ))}

              {/* Day cells */}
              {Array.from({ length: calDays.days }, (_, i) => i + 1).map(day => {
                const dayMeetings = getMeetingsForDay(day)
                const isCurrentDay = isToday(new Date(calDays.year, calDays.month, day).toISOString())
                return (
                  <div key={day} className={`min-h-[100px] p-2 border-b border-r border-gray-100 transition-colors
                    ${isCurrentDay ? 'bg-cyan-50' : 'hover:bg-gray-50'}`}>
                    <p className={`text-sm font-bold mb-1.5 w-7 h-7 flex items-center justify-center rounded-full
                      ${isCurrentDay ? 'bg-cyan-500 text-white' : 'text-gray-700'}`}>
                      {day}
                    </p>
                    <div className="space-y-1">
                      {dayMeetings.slice(0, 3).map(m => {
                        const mType = MEETING_TYPES.find(t => t.id === m.type) || MEETING_TYPES[4]
                        return (
                          <button key={m.id} onClick={() => setMeetingModal({ meeting: m, open: true })}
                            className="w-full text-left px-1.5 py-1 rounded-md text-[10px] font-semibold truncate transition-colors hover:opacity-80"
                            style={{ background: mType.bg, color: mType.color }}>
                            {new Date(m.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} {m.title}
                          </button>
                        )
                      })}
                      {dayMeetings.length > 3 && (
                        <p className="text-[10px] text-gray-400 font-medium pl-1">+{dayMeetings.length - 3} mais</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="px-6 py-4 border-t border-gray-100 flex flex-wrap gap-4">
              {MEETING_TYPES.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className="w-3 h-3 rounded-sm" style={{ background: t.bg, border: `1px solid ${t.color}` }} />
                  {t.label}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── MODAL: Nova reunião ── */}
      {meetingModal.open && (
        <MeetingModal
          meeting={meetingModal.meeting}
          processes={processes}
          onClose={() => setMeetingModal({ meeting: null, open: false })}
          onSave={handleSaveMeeting}
        />
      )}

      {/* ── MODAL: Iniciar onboarding ── */}
      {newProcessModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Iniciar onboarding</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cria checklist completo e pipeline de implantação</p>
              </div>
              <button onClick={() => setNewProcessModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={lbl}>Escola *</label>
                <select className={inp} value={newProcessInstitution} onChange={e => setNewProcessInstitution(e.target.value)}>
                  <option value="">Selecionar escola...</option>
                  {availableInstitutions.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — {i.city}</option>
                  ))}
                </select>
                {availableInstitutions.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">Todas as escolas ativas já têm processo de onboarding.</p>
                )}
              </div>

              <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-100">
                <p className="text-xs font-bold text-cyan-700 mb-2">O que será criado automaticamente</p>
                <div className="space-y-1">
                  {PHASES.map(p => {
                    const PIcon = p.icon
                    const count = DEFAULT_TASKS[p.id].length
                    return (
                      <div key={p.id} className="flex items-center gap-2 text-xs text-cyan-700">
                        <PIcon className="w-3 h-3" style={{ color: p.color }} />
                        <span style={{ color: p.color }} className="font-semibold">{p.label}</span>
                        <span className="text-cyan-500">— {count} tarefa{count > 1 ? 's' : ''}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setNewProcessModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={handleCreateProcess} disabled={creatingProcess || !newProcessInstitution}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                {creatingProcess
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                  : <><Zap className="w-4 h-4" /> Iniciar onboarding</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

    </SuperAdminLayout>
  )
}