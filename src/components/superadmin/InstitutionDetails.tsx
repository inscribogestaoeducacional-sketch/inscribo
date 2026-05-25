import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { createGoogleMeet, buildEndDatetime } from '../../lib/googleMeet'
import {
  Building2, Users, DollarSign, FileText, CheckCircle2,
  Clock, AlertTriangle, ExternalLink, Copy, RefreshCw,
  CreditCard, Lock, Unlock, Send, MessageCircle, X,
  Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  ArrowLeft, Megaphone, Bell, Wifi, WifiOff,
  Edit2, Save, Phone, Mail, MapPin, Calendar,
  Zap, BookOpen, TrendingUp, Star, Ban, Video,
  CheckSquare, ChevronDown, ChevronRight, Link as LinkIcon,
  AlertCircle
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white transition-all'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}
function fmtDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function daysLate(due: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(due + 'T12:00:00').getTime()) / 86400000))
}

const STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  active:           { l: 'Ativo',             c: '#16a34a', bg: '#f0fdf4' },
  pending_contract: { l: 'Aguard. contrato',  c: '#6366f1', bg: '#eef2ff' },
  pending_payment:  { l: 'Aguard. pagamento', c: '#d97706', bg: '#fffbeb' },
  suspended:        { l: 'Suspenso',          c: '#dc2626', bg: '#fef2f2' },
  cancelled:        { l: 'Cancelado',         c: '#9ca3af', bg: '#f3f4f6' },
}
const PAYMENT_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  paid:      { l: 'Pago',      c: '#16a34a', bg: '#f0fdf4' },
  pending:   { l: 'Pendente',  c: '#d97706', bg: '#fffbeb' },
  overdue:   { l: 'Atrasado',  c: '#dc2626', bg: '#fef2f2' },
  cancelled: { l: 'Cancelado', c: '#9ca3af', bg: '#f9fafb' },
}
const CONTRACT_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  draft:     { l: 'Rascunho',              c: '#6b7280', bg: '#f3f4f6' },
  sent:      { l: 'Aguardando assinatura', c: '#d97706', bg: '#fffbeb' },
  signed:    { l: 'Assinado ✓',           c: '#16a34a', bg: '#f0fdf4' },
  cancelled: { l: 'Cancelado',            c: '#dc2626', bg: '#fef2f2' },
}

type TimelinePhaseId = 'contract' | 'payment' | 'kickoff' | 'implementation' | 'training' | 'campaign' | 'active'

const TIMELINE_PHASES: Array<{ id: TimelinePhaseId; label: string; icon: any; color: string }> = [
  { id: 'contract',       label: 'Contrato',    icon: FileText,   color: '#6366F1' },
  { id: 'payment',        label: 'Pagamento',   icon: CreditCard, color: '#D97706' },
  { id: 'kickoff',        label: 'Kickoff',     icon: Video,      color: '#0891B2' },
  { id: 'implementation', label: 'Implantação', icon: Zap,        color: '#2563EB' },
  { id: 'training',       label: 'Treinamento', icon: BookOpen,   color: '#7C3AED' },
  { id: 'campaign',       label: 'Campanha',    icon: TrendingUp, color: '#EA580C' },
  { id: 'active',         label: 'Ativo',       icon: Star,       color: '#16A34A' },
]

const DEFAULT_TASKS_IMPL = [
  { title: 'Kickoff agendado e realizado',         description: 'Realizar reunião de kickoff com a escola' },
  { title: 'Dados do ERP importados',              description: 'Importar histórico do sistema atual' },
  { title: 'WhatsApp oficial homologado',          description: 'Configurar número via API Oficial Meta' },
  { title: 'Equipe cadastrada no sistema',         description: 'Criar usuários para todos os atendentes' },
  { title: 'Fluxos de atendimento configurados',  description: 'Personalizar bot e fluxos do WhatsApp' },
  { title: 'Formulário de captação publicado',    description: 'Integrar formulário no site da escola' },
]
const DEFAULT_TASKS_TRAINING = [
  { title: 'Treinamento de CRM realizado',        description: 'Treinar equipe no kanban de leads' },
  { title: 'Treinamento de WhatsApp realizado',   description: 'Treinar equipe no WhatsApp oficial' },
  { title: 'Treinamento de Relatórios realizado', description: 'Treinar gestor na leitura dos dados' },
  { title: 'Dúvidas da equipe respondidas',       description: 'Sessão de perguntas e respostas' },
]
const DEFAULT_TASKS_CAMPAIGN = [
  { title: 'Campanha configurada pelo gestor',    description: 'Gestor preencheu os dados da campanha' },
  { title: 'IA gerou o plano de campanha',        description: 'Plano com metas mensais gerado' },
  { title: 'Metas revisadas e aprovadas',         description: 'Gestor aprovou as metas sugeridas' },
  { title: 'Campanha liberada pelo admin',        description: 'Admin liberou o acesso à campanha' },
]

const months = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
]

function getCurrentPhase(institution: any, contract: any, onboardingProcess: any, tasks: any[] = []): TimelinePhaseId {
  if (!institution) return 'contract'
  const status = institution.plan_status
  if (!contract || contract.status === 'draft') return 'contract'
  if (contract.status === 'sent') return 'contract'
  if (status === 'pending_payment') return 'payment'
  if (status === 'pending_contract') return 'contract'
  if (!onboardingProcess) return 'kickoff'
  const phase = onboardingProcess.current_phase
  if (phase === 'contract') return 'kickoff'
  if (phase === 'implementation') {
    const implTasks = tasks.filter(t => t.phase === 'implementation')
    if (implTasks.length > 0 && implTasks.every(t => t.done)) return 'training'
    return 'implementation'
  }
  if (phase === 'training') {
    const trainTasks = tasks.filter(t => t.phase === 'training')
    if (trainTasks.length > 0 && trainTasks.every(t => t.done)) return 'campaign'
    return 'training'
  }
  if (phase === 'campaign') {
    const campTasks = tasks.filter(t => t.phase === 'campaign')
    if (campTasks.length > 0 && campTasks.every(t => t.done)) return 'active'
    return 'campaign'
  }
  return 'active'
}

// ── MeetingModal ──────────────────────────────────────────────────────────────
function MeetingModal({
  processId, institutionId, phase, title: defaultTitle,
  attendeeEmail, onClose, onSaved,
}: {
  processId: string; institutionId: string; phase: string; title: string
  attendeeEmail?: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: defaultTitle,
    scheduled_at: '',
    duration_min: 60,
    meet_link: '',
    notes: '',
    attendees_raw: attendeeEmail || '',
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [err, setErr] = useState('')

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  const handleGenerateMeet = async () => {
    if (!form.scheduled_at) { setErr('Defina a data/hora antes de gerar o link.'); return }
    setGenerating(true); setErr('')
    const start = new Date(form.scheduled_at).toISOString()
    const end = buildEndDatetime(start, form.duration_min || 60)
    const result = await createGoogleMeet({
      title: form.title,
      start_datetime: start,
      end_datetime: end,
      attendees: form.attendees_raw.split(',').map(s => s.trim()).filter(Boolean),
    })
    if (result.meet_link) set('meet_link', result.meet_link)
    else setErr(result.error || 'Erro ao criar Meet')
    setGenerating(false)
  }

  const handleSave = async () => {
    if (!form.title || !form.scheduled_at) { setErr('Título e data são obrigatórios.'); return }
    setSaving(true)
    try {
      await supabase.from('onboarding_meetings').insert({
        process_id: processId,
        institution_id: institutionId,
        type: phase,
        title: form.title,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_min: form.duration_min,
        meet_link: form.meet_link || null,
        notes: form.notes || null,
        status: 'scheduled',
        attendees: form.attendees_raw.split(',').map(s => s.trim()).filter(Boolean),
      })
      onSaved()
    } catch (e: any) { setErr(e.message || 'Erro ao agendar') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Agendar reunião</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        {err && <p className="text-xs text-red-500 mb-3 bg-red-50 px-3 py-2 rounded-lg">{err}</p>}
        <div className="space-y-3">
          <div>
            <label className={lbl}>Título *</label>
            <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Data e hora *</label>
              <input type="datetime-local" className={inp} value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>Duração (min)</label>
              <input type="number" className={inp} value={form.duration_min} onChange={e => set('duration_min', Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={lbl}>Link Google Meet</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input className={inp + ' pl-9'} value={form.meet_link} onChange={e => set('meet_link', e.target.value)} placeholder="https://meet.google.com/..." />
              </div>
              <button onClick={handleGenerateMeet} disabled={generating}
                className="px-3 py-2 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-lg text-xs font-semibold disabled:opacity-60 whitespace-nowrap">
                {generating ? <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" /> : '+ Gerar'}
              </button>
            </div>
          </div>
          <div>
            <label className={lbl}>Participantes (emails, separados por vírgula)</label>
            <input className={inp} value={form.attendees_raw} onChange={e => set('attendees_raw', e.target.value)} />
          </div>
          <div>
            <label className={lbl}>Notas</label>
            <textarea rows={2} className={inp + ' resize-none'} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Calendar className="w-4 h-4" />}
            Agendar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const cancelledRef = useRef(false)

  const [institution,       setInstitution]       = useState<any>(null)
  const [users,             setUsers]             = useState<any[]>([])
  const [payments,          setPayments]          = useState<any[]>([])
  const [contract,          setContract]          = useState<any>(null)
  const [onboardingProcess, setOnboardingProcess] = useState<any>(null)
  const [onboardingTasks,   setOnboardingTasks]   = useState<any[]>([])
  const [meetings,          setMeetings]          = useState<any[]>([])
  const [cycle,             setCycle]             = useState<any>(null)
  const [consultants,       setConsultants]       = useState<any[]>([])
  const [waUsage,           setWaUsage]           = useState({ count: 0, limit: 1000, initiated: 0, received: 0 })
  const [updatingLimit,    setUpdatingLimit]     = useState(false)
  const [newLimit,         setNewLimit]          = useState('')
  const [loading,           setLoading]           = useState(true)
  const [toast,             setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  const [copied,            setCopied]            = useState<string | null>(null)

  // Edit info
  const [editingInfo, setEditingInfo] = useState(false)
  const [editForm,    setEditForm]    = useState<any>({})
  const [savingInfo,  setSavingInfo]  = useState(false)

  // New user modal
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser,     setNewUser]     = useState({ email: '', full_name: '', password: '', role: 'admin' })
  const [showPw,      setShowPw]      = useState(false)
  const [savingUser,  setSavingUser]  = useState(false)

  // New charge modal
  const [showNewCharge, setShowNewCharge] = useState(false)
  const [chargeForm,    setChargeForm]    = useState({
    amount: '', payment_type: 'monthly',
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    billingType: 'PIX', description: '',
  })
  const [savingCharge, setSavingCharge] = useState(false)

  // Contract send form
  const [contractForm,    setContractForm]    = useState({ signer_name: '', signer_email: '', signer_cpf: '', signer_role: 'Diretor', signer_phone: '', contract_start_date: '' })
  const [sendingContract, setSendingContract] = useState(false)

  // WhatsApp form
  const [waForm,   setWaForm]   = useState({ phone_id: '', phone_number: '', display_name: '', waba_id: '' })
  const [savingWa, setSavingWa] = useState(false)

  // Campaign form
  const [campaignForm,      setCampaignForm]      = useState({ startMonth: 8, startDate: '', endDate: '' })
  const [releasingCampaign, setReleasingCampaign] = useState(false)

  // Meeting modal
  const [meetingModal, setMeetingModal] = useState<{ phase: string; title: string } | null>(null)

  // Init process
  const [initingProcess, setInitingProcess] = useState(false)

  // Gestão da escola tabs
  const [mgmtTab, setMgmtTab] = useState<'users' | 'whatsapp' | 'financial' | 'templates'>('users')

  // Templates tab state
  const [waTemplates, setWaTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [showAddTemplate, setShowAddTemplate] = useState(false)
  const [newTemplate, setNewTemplate] = useState({ name: '', category: 'UTILITY', body: '' })
  const [sendingNewTemplate, setSendingNewTemplate] = useState(false)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    if (!id) return
    cancelledRef.current = false
    loadAll()
    return () => { cancelledRef.current = true }
  }, [id])

  const loadAll = async (quiet = false) => {
    if (!id) return
    if (!quiet) setLoading(true)
    try {
      const [instRes, usersRes, paymentsRes, contractRes, processRes, cycleRes, consultantsRes, waPhoneRes] = await Promise.all([
        supabase.from('institutions').select('*').eq('id', id).single(),
        supabase.from('users').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('onboarding_processes').select('*').eq('institution_id', id).maybeSingle(),
        supabase.from('campaign_cycles').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
        supabase.from('whatsapp_phone_numbers').select('waba_id').eq('institution_id', id).maybeSingle(),
      ])

      if (cancelledRef.current) return

      console.log('[loadAll] contract:', contractRes.data, 'error:', contractRes.error)

      const inst = instRes.data
      setInstitution(inst)
      setUsers(usersRes.data || [])
      setPayments(paymentsRes.data || [])
      setContract(contractRes.data ?? null)
      setCycle(cycleRes.data ?? null)
      setConsultants(consultantsRes.data || [])

      if (inst) {
        setEditForm({
          name: inst.name || '', cnpj: inst.cnpj || '',
          city: inst.city || '', state: inst.state || '',
          phone: inst.phone || '', email: inst.email || '',
          plan: inst.plan || 'escola', consultant_id: inst.consultant_id || '',
          monthly_value: String(inst.monthly_value || 550),
          implementation_value: String(inst.implementation_value || 550),
        })
        setWaForm({
          phone_id:     inst.whatsapp_phone_id || '',
          phone_number: inst.whatsapp_phone_number || '',
          display_name: inst.whatsapp_display_name || '',
          waba_id:      (waPhoneRes as any)?.data?.waba_id || '',
        })
        setContractForm(p => ({
          ...p,
          signer_email: inst.email || '',
          signer_phone: inst.phone || '',
        }))
      }

      setOnboardingProcess(processRes.data ?? null)
      if (processRes.data) {
        const [tasksRes, meetingsRes] = await Promise.all([
          supabase.from('onboarding_tasks').select('*').eq('process_id', processRes.data.id).order('sort_order'),
          supabase.from('onboarding_meetings').select('*').eq('process_id', processRes.data.id).order('scheduled_at'),
        ])
        if (!cancelledRef.current) {
          setOnboardingTasks(tasksRes.data || [])
          setMeetings(meetingsRes.data || [])
        }
      } else {
        setOnboardingTasks([])
        setMeetings([])
      }

      const monthYear = new Date().toISOString().slice(0, 7)
      const { data: usageRow } = await supabase
        .from('whatsapp_conversation_usage')
        .select('initiated_count, received_count, limit_count')
        .eq('institution_id', id)
        .eq('month_year', monthYear)
        .maybeSingle()
      if (!cancelledRef.current) {
        setWaUsage({
          count:     usageRow?.initiated_count  ?? 0,
          limit:     usageRow?.limit_count      ?? 1000,
          initiated: usageRow?.initiated_count  ?? 0,
          received:  usageRow?.received_count   ?? 0,
        })
        setNewLimit(String(usageRow?.limit_count ?? 1000))
      }

    } catch {
      if (!cancelledRef.current) showToast('Erro ao carregar dados.', false)
    }
    if (!cancelledRef.current && !quiet) setLoading(false)
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      const { error } = await supabase.from('institutions').update({
        name: editForm.name, cnpj: editForm.cnpj || null,
        city: editForm.city, state: editForm.state,
        phone: editForm.phone || null, email: editForm.email,
        plan: editForm.plan, consultant_id: editForm.consultant_id || null,
        monthly_value: Number(editForm.monthly_value),
        implementation_value: Number(editForm.implementation_value),
      }).eq('id', id)
      if (error) throw error
      showToast('Dados atualizados!')
      setEditingInfo(false)
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao salvar.', false) }
    finally { setSavingInfo(false) }
  }

  const handleSuspend = async () => {
    if (!confirm(`Suspender acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', id)
    try { await supabase.functions.invoke('send-email', { body: { type: 'suspended', to: institution?.email, data: { institution_name: institution?.name, dias_atraso: '0' } } }) } catch {}
    showToast('Escola suspensa.')
    loadAll()
  }

  const handleReactivate = async () => {
    if (!confirm(`Reativar acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
    try { await supabase.functions.invoke('send-email', { body: { type: 'reactivated', to: institution?.email, data: { institution_name: institution?.name, link_acesso: 'https://app.aionedu.com.br/login' } } }) } catch {}
    showToast('Escola reativada!')
    loadAll()
  }

  const handleSendContract = async () => {
    if (!contractForm.signer_name || !contractForm.signer_email) { showToast('Nome e e-mail do signatário são obrigatórios.', false); return }
    setSendingContract(true)
    try {
      const { error } = await supabase.functions.invoke('autentique', {
        body: {
          institution_id: id,
          signer_name: contractForm.signer_name,
          signer_email: contractForm.signer_email,
          signer_cpf: contractForm.signer_cpf || null,
          signer_role: contractForm.signer_role || 'Diretor',
          signer_phone: contractForm.signer_phone || null,
          monthly_value: institution?.monthly_value,
          implementation_value: institution?.implementation_value,
          consultant_id: institution?.consultant_id || null,
          contract_start_date: contractForm.contract_start_date || null,
        }
      })
      if (error) throw error
      showToast('Contrato enviado para assinatura!')
      await loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao enviar contrato.', false) }
    finally { setSendingContract(false) }
  }

  const handleResendContract = async () => {
    if (!contract?.signer_email) { showToast('Contrato sem signatário.', false); return }
    try {
      await supabase.functions.invoke('autentique', {
        body: {
          institution_id: id, contract_id: contract.id,
          school_name: institution?.name,
          signer_name: contract.signer_name, signer_email: contract.signer_email,
          monthly_value: institution?.monthly_value, implementation_value: institution?.implementation_value,
        }
      })
      showToast('Contrato reenviado!')
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao reenviar.', false) }
  }

  const handleMarkContractSigned = async () => {
    if (!confirm('Marcar contrato como assinado manualmente?')) return
    await supabase.from('contracts').update({ status: 'signed' }).eq('id', contract.id)
    await supabase.from('institutions').update({ plan_status: 'pending_payment' }).eq('id', id)
    showToast('Contrato marcado como assinado!')
    loadAll()
  }

  const handleMarkPaid = async (paymentId: string, isImpl: boolean) => {
    if (!confirm('Marcar como pago manualmente?')) return
    await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', paymentId)
    if (isImpl) {
      await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
      try { await supabase.functions.invoke('send-email', { body: { type: 'new_institution', to: institution?.email, data: { institution_name: institution?.name, login_url: 'https://app.aionedu.com.br/login' } } }) } catch {}
    }
    showToast('Pagamento confirmado!')
    loadAll()
  }

  const handleCancelPayment = async (paymentId: string, asaasId?: string) => {
    if (!confirm('Cancelar esta cobrança?')) return
    if (asaasId) { try { await supabase.functions.invoke('asaas-cancel-charge', { body: { payment_id: asaasId } }) } catch {} }
    await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId)
    showToast('Cobrança cancelada.')
    loadAll()
  }

  const handleResendPaymentEmail = async (payment: any) => {
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: payment.payment_type === 'monthly' ? 'monthly_payment' : 'payment_link',
          to: institution?.email,
          data: { institution_name: institution?.name, value: fmtBRL(payment.amount), due_date: fmtDate(payment.due_date), billing_type: 'PIX/Boleto', payment_link: payment.asaas_charge_url || '' }
        }
      })
      showToast('Email enviado!')
    } catch { showToast('Erro ao enviar email.', false) }
  }

  const handleSendWhatsAppPayment = (payment: any) => {
    const phone = institution?.phone?.replace(/\D/g, '')
    if (!phone) { showToast('Escola sem telefone cadastrado.', false); return }
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá! Segue o link de pagamento:\n\n${payment.asaas_charge_url}`)}`, '_blank')
  }

  const handleGenerateLink = async (paymentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-generate-monthly', { body: { payment_id: paymentId } })
      if (error) throw error
      if (data?.ok && data?.generated > 0) { showToast('Link gerado!'); loadAll() }
      else showToast('Erro: ' + (data?.error || 'Tente novamente'), false)
    } catch { showToast('Erro ao gerar link.', false) }
  }

  const handleNewCharge = async () => {
    if (!chargeForm.amount) { showToast('Informe o valor.', false); return }
    setSavingCharge(true)
    try {
      const { error } = await supabase.functions.invoke('asaas-create-charge', {
        body: {
          institution_id: id, name: institution?.name, email: institution?.email,
          cpfCnpj: institution?.cnpj?.replace(/\D/g, '') || '',
          value: Number(chargeForm.amount),
          description: chargeForm.description || `${chargeForm.payment_type} — ${institution?.name}`,
          dueDate: chargeForm.due_date, billingType: chargeForm.billingType,
        }
      })
      if (error) throw error
      showToast('Cobrança gerada!')
      setShowNewCharge(false)
      setChargeForm({ amount: '', payment_type: 'monthly', due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], billingType: 'PIX', description: '' })
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro.', false) }
    finally { setSavingCharge(false) }
  }

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.full_name || newUser.password.length < 8) { showToast('Preencha todos os campos. Senha mínimo 8 caracteres.', false); return }
    setSavingUser(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newUser.email.trim().toLowerCase(), password: newUser.password, full_name: newUser.full_name.trim(), role: newUser.role, user_type: 'school_user', institution_id: id }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error || 'Erro ao criar usuário')
      showToast('Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'admin' })
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro.', false) }
    finally { setSavingUser(false) }
  }

  const handleToggleUser = async (user: any) => {
    await supabase.from('users').update({ active: !user.active }).eq('id', user.id)
    showToast(user.active ? 'Usuário desativado.' : 'Usuário ativado!')
    loadAll()
  }

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Excluir "${user.full_name}"?`)) return
    await supabase.from('users').delete().eq('id', user.id)
    showToast('Usuário excluído.')
    loadAll()
  }

  const createDefaultTemplates = async (wabaId: string, token: string): Promise<void> => {
    if (!wabaId || !token) return
    const AION_WABA = '1222972209822315'
    if (wabaId === AION_WABA) return

    const { data: templates } = await supabase
      .from('whatsapp_platform_templates')
      .select('*')
      .eq('is_default', true)

    for (const tpl of templates || []) {
      try {
        const checkRes = await fetch(
          `https://graph.facebook.com/v18.0/${wabaId}/message_templates?name=${tpl.name}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const checkData = await checkRes.json()
        if (checkData.data?.length > 0) continue

        await fetch(
          `https://graph.facebook.com/v18.0/${wabaId}/message_templates`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: tpl.name,
              language: tpl.language,
              category: tpl.category,
              components: [{
                type: 'BODY',
                text: tpl.body_text,
                example: {
                  body_text: [tpl.variables.map((_: string, i: number) =>
                    i === 0 ? 'João' : 'Colégio Exemplo'
                  )],
                },
              }],
            }),
          }
        )
        console.log(`[templates] criado ${tpl.name} no WABA ${wabaId}`)
      } catch (e) {
        console.error(`[templates] erro ao criar ${tpl.name}:`, e)
      }
    }
  }

  const loadWaTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const { data: waPhoneRow } = await supabase
        .from('whatsapp_phone_numbers')
        .select('waba_id')
        .eq('institution_id', id)
        .maybeSingle()
      const wabaId = waPhoneRow?.waba_id
      if (!wabaId) { setWaTemplates([]); return }

      const { data: tokenRow } = await supabase
        .from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      const token = tokenRow?.value || ''
      if (!token) return

      const res = await fetch(
        `https://graph.facebook.com/v18.0/${wabaId}/message_templates?limit=50`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      const metaTemplates: any[] = data.data || []
      setWaTemplates(metaTemplates)

      if (metaTemplates.length > 0 && id) {
        const toUpsert = metaTemplates.map((t: any) => ({
          institution_id: id,
          name: t.name,
          language: t.language || 'pt_BR',
          category: t.category || 'UTILITY',
          components: t.components || [],
          template_id: t.id,
          status: t.status?.toLowerCase() === 'approved' ? 'approved'
                : t.status?.toLowerCase() === 'rejected' ? 'rejected'
                : 'pending',
        }))
        await supabase
          .from('whatsapp_templates')
          .upsert(toUpsert, { onConflict: 'institution_id,name' })
      }
    } catch (e) {
      console.error('[templates] erro ao carregar:', e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.body) { showToast('Nome e corpo são obrigatórios.', false); return }
    setSendingNewTemplate(true)
    try {
      const { data: waPhoneRow } = await supabase
        .from('whatsapp_phone_numbers').select('waba_id').eq('institution_id', id).maybeSingle()
      const wabaId = waPhoneRow?.waba_id
      if (!wabaId) throw new Error('WABA ID não configurado')

      const { data: tokenRow } = await supabase
        .from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      const token = tokenRow?.value || ''
      if (!token) throw new Error('Token de acesso não encontrado')

      const res = await fetch(`https://graph.facebook.com/v18.0/${wabaId}/message_templates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTemplate.name.toLowerCase().replace(/\s+/g, '_'),
          language: 'pt_BR',
          category: newTemplate.category,
          components: [{ type: 'BODY', text: newTemplate.body }],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error?.message || 'Erro ao enviar template')
      showToast('Template enviado para aprovação Meta!')
      setShowAddTemplate(false)
      setNewTemplate({ name: '', category: 'UTILITY', body: '' })
      loadWaTemplates()
    } catch (e: any) {
      showToast(e.message || 'Erro ao criar template.', false)
    } finally {
      setSendingNewTemplate(false)
    }
  }

  const handleUpdateLimit = async () => {
    const lim = parseInt(newLimit, 10)
    if (isNaN(lim) || lim < 0) { showToast('Limite inválido.', false); return }
    setUpdatingLimit(true)
    try {
      const monthYear = new Date().toISOString().slice(0, 7)
      await supabase.from('whatsapp_conversation_usage')
        .upsert({
          institution_id: id,
          month_year:     monthYear,
          limit_count:    lim,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'institution_id,month_year' })
      setWaUsage(u => ({ ...u, limit: lim }))
      showToast('Limite atualizado!')
    } catch (e: any) {
      showToast(e.message || 'Erro ao atualizar limite.', false)
    } finally {
      setUpdatingLimit(false)
    }
  }

  const handleSaveWhatsApp = async () => {
    if (!waForm.phone_id) { showToast('Phone Number ID é obrigatório.', false); return }
    setSavingWa(true)
    try {
      const { data: tokenRow } = await supabase
        .from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
      const globalToken = tokenRow?.value || ''
      if (!globalToken) throw new Error('Token de acesso não encontrado. Vá em Admin → Configurações → WhatsApp e salve o Access Token.')
      const testRes = await fetch(`https://graph.facebook.com/v19.0/${waForm.phone_id}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${globalToken}` } })
      if (!testRes.ok) { const err = await testRes.json(); throw new Error((err as any)?.error?.message || 'Phone ID inválido ou token sem permissão') }
      const testData = await testRes.json()
      await supabase.from('institutions').update({
        whatsapp_phone_id: waForm.phone_id,
        whatsapp_phone_number: waForm.phone_number || testData.display_phone_number || '',
        whatsapp_display_name: waForm.display_name || testData.verified_name || '',
        whatsapp_connected: true,
      }).eq('id', id)
      const AION_WABA_ID = '1222972209822315'
      const wabaToSubscribe = waForm.waba_id?.trim() || ''
      const effectiveWabaId = wabaToSubscribe || AION_WABA_ID

      await supabase.from('whatsapp_phone_numbers').upsert({
        institution_id:  id,
        phone_number_id: waForm.phone_id,
        phone_number:    waForm.phone_number || testData.display_phone_number || '',
        display_name:    waForm.display_name || testData.verified_name || '',
        waba_id:         effectiveWabaId,
        is_active:       true,
        use_meta_api:    true,
      }, { onConflict: 'institution_id' })

      if (wabaToSubscribe && wabaToSubscribe !== AION_WABA_ID) {
        try {
          const subscribeRes = await fetch(
            `https://graph.facebook.com/v18.0/${wabaToSubscribe}/subscribed_apps`,
            { method: 'POST', headers: { Authorization: `Bearer ${globalToken}` } }
          )
          const subscribeData = await subscribeRes.json()
          if (subscribeData.success) {
            console.log('[WA] WABA inscrito com sucesso:', wabaToSubscribe)
          } else {
            console.warn('[WA] Falha ao inscrever WABA:', subscribeData)
          }
        } catch (e) {
          console.error('[WA] Erro ao inscrever WABA:', e)
        }
      }

      // Criar templates padrão no WABA da escola
      await createDefaultTemplates(effectiveWabaId, globalToken)

      showToast('WhatsApp configurado e verificado!')
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao verificar.', false) }
    finally { setSavingWa(false) }
  }

  const handleReleaseCampaign = async () => {
    setReleasingCampaign(true)
    try {
      const campaignYear = new Date().getFullYear() + 1
      const sd = campaignForm.startDate || `${new Date().getFullYear()}-${String(campaignForm.startMonth).padStart(2, '0')}-01`
      const ed = campaignForm.endDate || `${campaignYear}-02-28`
      if (cycle) {
        await supabase.from('campaign_cycles').update({ status: 'released', campaign_start_month: campaignForm.startMonth, start_date: sd, end_date: ed }).eq('id', cycle.id)
      } else {
        await supabase.from('campaign_cycles').insert({
          institution_id: id, status: 'released', campaign_start_month: campaignForm.startMonth,
          year: campaignYear, label: `Campanha ${campaignYear}`, start_date: sd, end_date: ed,
          target_new_students: 0, target_reenrollment_rate: 85,
          base_students: 0, monthly_targets: [], market_data: {},
          historical_input: [], generation_mode: 'benchmark', ai_reasoning: '', realism_score: 'realistic',
        })
      }
      await supabase.from('system_notifications').insert({ institution_id: id, title: `Campanha ${campaignYear} liberada! 🎉`, message: 'Sua campanha de matrículas foi liberada.', type: 'info', read: false })
      showToast(`Campanha ${campaignYear} liberada!`)
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro.', false) }
    finally { setReleasingCampaign(false) }
  }

  const handleToggleTask = async (taskId: string, done: boolean) => {
    await supabase.from('onboarding_tasks').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', taskId)
    setOnboardingTasks(prev => prev.map(t => t.id === taskId ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t))
    loadAll(true)
  }

  const handleMarkMeetingDone = async (meetingId: string) => {
    await supabase.from('onboarding_meetings').update({ status: 'done' }).eq('id', meetingId)
    showToast('Reunião marcada como realizada!')
    loadAll()
  }

  const handleInitProcess = async () => {
    if (!id) return
    setInitingProcess(true)
    try {
      const { data: proc, error } = await supabase.from('onboarding_processes').insert({ institution_id: id, current_phase: 'implementation', status: 'active' }).select().single()
      if (error) throw error
      const allTasks: any[] = []
      let order = 0
      const tasksByPhase = [
        { phase: 'implementation', tasks: DEFAULT_TASKS_IMPL },
        { phase: 'training', tasks: DEFAULT_TASKS_TRAINING },
        { phase: 'campaign', tasks: DEFAULT_TASKS_CAMPAIGN },
      ]
      for (const { phase, tasks } of tasksByPhase) {
        for (const t of tasks) {
          allTasks.push({ process_id: proc.id, phase, title: t.title, description: t.description, done: false, sort_order: order++ })
        }
      }
      await supabase.from('onboarding_tasks').insert(allTasks)
      showToast('Onboarding iniciado!')
      loadAll()
    } catch (e: any) { showToast(e.message || 'Erro ao iniciar onboarding.', false) }
    finally { setInitingProcess(false) }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    showToast('Copiado!')
  }

  if (loading) return (
    <SuperAdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </SuperAdminLayout>
  )

  if (!institution) return (
    <SuperAdminLayout>
      <div className="p-8 text-center text-gray-500">Escola não encontrada.</div>
    </SuperAdminLayout>
  )

  const st = STATUS_MAP[institution.plan_status] || { l: institution.plan_status, c: '#6b7280', bg: '#f3f4f6' }
  const implPayment    = payments.find(p => p.payment_type === 'implementation')
  const monthlyPayments = payments.filter(p => p.payment_type === 'monthly')
  const contractSt     = contract ? (CONTRACT_STATUS[contract.status] || CONTRACT_STATUS.draft) : null
  const usagePct       = Math.min(100, Math.round((waUsage.count / waUsage.limit) * 100))
  console.log('[InstitutionDetails] tasks:', onboardingTasks)
  const currentPhase   = getCurrentPhase(institution, contract, onboardingProcess, onboardingTasks)
  console.log('[InstitutionDetails] currentPhase:', currentPhase, 'onboardingProcess.current_phase:', onboardingProcess?.current_phase)
  const currentPhaseIdx = TIMELINE_PHASES.findIndex(p => p.id === currentPhase)

  const phaseState = (phaseId: TimelinePhaseId): 'done' | 'active' | 'pending' => {
    const idx = TIMELINE_PHASES.findIndex(p => p.id === phaseId)
    if (idx < currentPhaseIdx) return 'done'
    if (idx === currentPhaseIdx) return 'active'
    return 'pending'
  }

  const tasksForPhase = (phase: string) => onboardingTasks.filter(t => t.phase === phase)
  const meetingsForPhase = (phase: string) => meetings.filter(m => m.type === phase)

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-5">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Meeting modal */}
        {meetingModal && onboardingProcess && (
          <MeetingModal
            processId={onboardingProcess.id}
            institutionId={id!}
            phase={meetingModal.phase}
            title={meetingModal.title}
            attendeeEmail={institution.email}
            onClose={() => setMeetingModal(null)}
            onSaved={() => { setMeetingModal(null); loadAll() }}
          />
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl border border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900">{institution.name}</h1>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
              </div>
              <p className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                {[institution.city, institution.state].filter(Boolean).join('/') && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{[institution.city, institution.state].filter(Boolean).join('/')}</span>}
                {institution.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{institution.email}</span>}
                {institution.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{institution.phone}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={loadAll} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setEditingInfo(v => !v)} className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <Edit2 className="w-3.5 h-3.5" /> Editar
            </button>
            {institution.plan_status === 'suspended'
              ? <button onClick={handleReactivate} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm"><Unlock className="w-4 h-4" /> Reativar</button>
              : institution.plan_status === 'active'
              ? <button onClick={handleSuspend} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm"><Lock className="w-4 h-4" /> Suspender</button>
              : null
            }
          </div>
        </div>

        {/* Edit info panel */}
        {editingInfo && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-sm">Editar dados</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditingInfo(false)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600">Cancelar</button>
                <button onClick={handleSaveInfo} disabled={savingInfo} className="flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white rounded-xl text-xs font-semibold disabled:opacity-60">
                  {savingInfo ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: 'name', l: 'Nome *', type: 'text' }, { k: 'cnpj', l: 'CNPJ', type: 'text' },
                { k: 'city', l: 'Cidade', type: 'text' }, { k: 'state', l: 'UF', type: 'text' },
                { k: 'phone', l: 'Telefone', type: 'text' }, { k: 'email', l: 'E-mail', type: 'email' },
                { k: 'monthly_value', l: 'Mensalidade (R$)', type: 'number' },
                { k: 'implementation_value', l: 'Implantação (R$)', type: 'number' },
              ].map(f => (
                <div key={f.k}>
                  <label className={lbl}>{f.l}</label>
                  <input type={f.type} className={inp} value={editForm[f.k] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label className={lbl}>Plano</label>
                <select className={inp} value={editForm.plan} onChange={e => setEditForm((p: any) => ({ ...p, plan: e.target.value }))}>
                  <option value="escola">Escola Padrão</option>
                  <option value="rede">Rede</option>
                  <option value="gratuito">Gratuito</option>
                </select>
              </div>
              <div>
                <label className={lbl}>Consultor</label>
                <select className={inp} value={editForm.consultant_id} onChange={e => setEditForm((p: any) => ({ ...p, consultant_id: e.target.value }))}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Mensalidade', value: fmtBRL(institution.monthly_value || 0), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Implantação', value: fmtBRL(institution.implementation_value || 0), icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Usuários', value: users.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Conversas WA', value: `${waUsage.count}/${waUsage.limit}`, icon: MessageCircle, color: 'text-cyan-600', bg: 'bg-cyan-50' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 font-medium">{k.label}</p>
                    <p className="text-lg font-bold text-gray-900 mt-0.5">{k.value}</p>
                  </div>
                  <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${k.color}`} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Vertical Timeline ── */}
        <div className="space-y-0">
          {TIMELINE_PHASES.map((phase, idx) => {
            const state = phaseState(phase.id)
            const isLast = idx === TIMELINE_PHASES.length - 1
            const Icon = phase.icon

            return (
              <div key={phase.id} className="flex gap-4">
                {/* Left: connector + circle */}
                <div className="flex flex-col items-center w-10 flex-shrink-0">
                  {idx > 0 && <div className={`w-0.5 h-4 ${state === 'done' || (idx <= currentPhaseIdx) ? 'bg-green-300' : 'bg-gray-200'}`} />}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                    ${state === 'done' ? 'bg-green-500' : state === 'active' ? 'ring-4 ring-blue-100' : 'bg-gray-100'}`}
                    style={state === 'active' ? { background: phase.color } : {}}>
                    {state === 'done'
                      ? <CheckCircle2 className="w-5 h-5 text-white" />
                      : <Icon className="w-4 h-4" style={{ color: state === 'active' ? '#fff' : '#9ca3af' }} />
                    }
                  </div>
                  {!isLast && <div className={`w-0.5 flex-1 min-h-4 ${state === 'done' ? 'bg-green-300' : 'bg-gray-200'}`} />}
                </div>

                {/* Right: content */}
                <div className={`flex-1 pb-4 ${idx > 0 ? 'pt-0' : ''}`}>
                  {/* Phase header */}
                  <div className="flex items-center gap-2 h-9 mb-2">
                    <span className={`font-bold text-sm ${state === 'active' ? 'text-gray-900' : state === 'done' ? 'text-gray-500' : 'text-gray-400'}`}>{phase.label}</span>
                    {state === 'active' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: phase.color, background: phase.color + '18' }}>Fase atual</span>}
                    {state === 'done' && <span className="text-xs text-green-600 font-semibold">✓ Concluído</span>}
                  </div>

                  {/* Phase body — only show for active */}
                  {state === 'active' && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-2">

                      {/* ── Phase 1: Contract ── */}
                      {phase.id === 'contract' && (
                        <div className="p-5 space-y-4">
                          {!contract || contract.status === 'draft' ? (
                            <>
                              <p className="text-sm font-semibold text-gray-700">Enviar contrato para assinatura</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className={lbl}>Nome do signatário *</label>
                                  <input className={inp} value={contractForm.signer_name} onChange={e => setContractForm(p => ({ ...p, signer_name: e.target.value }))} placeholder="Nome completo" />
                                </div>
                                <div>
                                  <label className={lbl}>E-mail do signatário *</label>
                                  <input type="email" className={inp} value={contractForm.signer_email} onChange={e => setContractForm(p => ({ ...p, signer_email: e.target.value }))} />
                                </div>
                                <div>
                                  <label className={lbl}>CPF</label>
                                  <input className={inp} value={contractForm.signer_cpf} onChange={e => setContractForm(p => ({ ...p, signer_cpf: e.target.value }))} placeholder="000.000.000-00" />
                                </div>
                                <div>
                                  <label className={lbl}>Cargo</label>
                                  <input className={inp} value={contractForm.signer_role} onChange={e => setContractForm(p => ({ ...p, signer_role: e.target.value }))} placeholder="Diretor" />
                                </div>
                                <div>
                                  <label className={lbl}>Telefone</label>
                                  <input className={inp} value={contractForm.signer_phone} onChange={e => setContractForm(p => ({ ...p, signer_phone: e.target.value }))} />
                                </div>
                                <div>
                                  <label className={lbl}>Início do contrato</label>
                                  <input type="date" className={inp} value={contractForm.contract_start_date} onChange={e => setContractForm(p => ({ ...p, contract_start_date: e.target.value }))} />
                                </div>
                              </div>
                              <button onClick={handleSendContract} disabled={sendingContract}
                                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                                {sendingContract ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                                Enviar via Autentique
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: contractSt?.c, background: contractSt?.bg }}>{contractSt?.l}</span>
                                <div className="flex gap-2">
                                  {contract.status !== 'signed' && (
                                    <>
                                      <button onClick={handleResendContract} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold">
                                        <Send className="w-3 h-3" /> Reenviar
                                      </button>
                                      <button onClick={handleMarkContractSigned} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold">
                                        <CheckCircle2 className="w-3 h-3" /> Marcar assinado
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Signers */}
                              <div className="space-y-2">
                                {Array.isArray(contract.signers) && contract.signers.length > 0 ? contract.signers.map((s: any, i: number) => (
                                  <div key={i} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${s.signed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                                      <p className="text-xs text-gray-500">{s.role} · {s.email}</p>
                                    </div>
                                    <div className="text-right">
                                      {s.signed
                                        ? <><span className="flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Assinou</span>{s.signed_at && <p className="text-xs text-gray-400 mt-0.5">{fmtDate(s.signed_at)}</p>}</>
                                        : <span className="flex items-center gap-1 text-xs font-bold text-yellow-700"><Clock className="w-3.5 h-3.5" /> Aguardando</span>
                                      }
                                    </div>
                                  </div>
                                )) : (
                                  <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${contract.status === 'signed' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{contract.signer_name || '—'}</p>
                                      <p className="text-xs text-gray-500">{contract.signer_email || ''}</p>
                                    </div>
                                    {contract.status === 'signed'
                                      ? <span className="flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Assinou</span>
                                      : <span className="flex items-center gap-1 text-xs font-bold text-yellow-700"><Clock className="w-3.5 h-3.5" /> Aguardando</span>
                                    }
                                  </div>
                                )}
                              </div>

                              {contract.sign_url && (
                                <div className="flex items-center gap-2">
                                  <input readOnly className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={contract.sign_url} />
                                  <button onClick={() => copyToClipboard(contract.sign_url, 'contract')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">{copied === 'contract' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}</button>
                                  <a href={contract.sign_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg"><ExternalLink className="w-4 h-4 text-cyan-600" /></a>
                                  <button onClick={() => { const phone = institution?.phone?.replace(/\D/g, ''); if (!phone) { showToast('Escola sem telefone.', false); return }; window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(`Olá! Segue o link para assinar o contrato:\n\n${contract.sign_url}`)}`, '_blank') }} className="p-2 bg-green-50 border border-green-200 rounded-lg"><MessageCircle className="w-4 h-4 text-green-600" /></button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Phase 2: Payment ── */}
                      {phase.id === 'payment' && (
                        <div className="p-5 space-y-4">
                          <p className="text-sm font-semibold text-gray-700">Taxa de implantação</p>
                          {!implPayment ? (
                            <p className="text-sm text-gray-400 italic">Nenhuma cobrança de implantação gerada. O webhook criará automaticamente após a assinatura.</p>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: PAYMENT_STATUS[implPayment.status]?.c, background: PAYMENT_STATUS[implPayment.status]?.bg }}>{PAYMENT_STATUS[implPayment.status]?.l || implPayment.status}</span>
                                <span className="text-sm font-bold text-gray-900">{fmtBRL(implPayment.amount)}</span>
                                <span className="text-xs text-gray-400">Vence {fmtDate(implPayment.due_date)}</span>
                                {implPayment.status === 'paid' && <span className="text-xs text-green-600 font-semibold">Pago em {fmtDate(implPayment.paid_at)}</span>}
                              </div>
                              {implPayment.asaas_charge_url && (
                                <div className="flex items-center gap-2">
                                  <input readOnly className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={implPayment.asaas_charge_url} />
                                  <button onClick={() => copyToClipboard(implPayment.asaas_charge_url, 'impl')} className="p-2 border border-gray-200 rounded-lg">{copied === 'impl' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}</button>
                                  <a href={implPayment.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg"><ExternalLink className="w-4 h-4 text-cyan-600" /></a>
                                  <button onClick={() => handleResendPaymentEmail(implPayment)} className="p-2 bg-blue-50 border border-blue-200 rounded-lg"><Send className="w-4 h-4 text-blue-600" /></button>
                                  <button onClick={() => handleSendWhatsAppPayment(implPayment)} className="p-2 bg-green-50 border border-green-200 rounded-lg"><MessageCircle className="w-4 h-4 text-green-600" /></button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                {implPayment.status === 'pending' && (
                                  <button onClick={() => handleMarkPaid(implPayment.id, true)} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar pago
                                  </button>
                                )}
                                {implPayment.status !== 'cancelled' && implPayment.status !== 'paid' && (
                                  <button onClick={() => handleCancelPayment(implPayment.id, implPayment.asaas_payment_id)} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-xl text-xs font-semibold">
                                    <Ban className="w-3.5 h-3.5" /> Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Phase 3: Kickoff ── */}
                      {phase.id === 'kickoff' && (
                        <div className="p-5 space-y-4">
                          {!onboardingProcess ? (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-500 mb-3">Inicie o processo de onboarding para agendar o kickoff.</p>
                              <button onClick={handleInitProcess} disabled={initingProcess}
                                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 text-white rounded-xl font-semibold text-sm mx-auto disabled:opacity-60">
                                {initingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                                Iniciar onboarding
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Reunião de kickoff</p>
                                <button onClick={() => setMeetingModal({ phase: 'kickoff', title: `Kickoff — ${institution.name}` })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold">
                                  <Plus className="w-3 h-3" /> Agendar
                                </button>
                              </div>
                              {meetingsForPhase('kickoff').length === 0 ? (
                                <p className="text-sm text-gray-400 italic">Nenhuma reunião agendada.</p>
                              ) : meetingsForPhase('kickoff').map(m => (
                                <div key={m.id} className={`rounded-xl border p-4 ${m.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(m.scheduled_at)} · {m.duration_min}min</p>
                                      {m.meet_link && <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 font-semibold mt-1 flex items-center gap-1"><Video className="w-3 h-3" /> Entrar no Meet</a>}
                                    </div>
                                    {m.status !== 'done' && (
                                      <button onClick={() => handleMarkMeetingDone(m.id)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg font-semibold flex-shrink-0">Realizado</button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}

                      {/* ── Phase 4: Implementation ── */}
                      {phase.id === 'implementation' && (
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Tarefas de implantação</p>
                            <button onClick={() => setMeetingModal({ phase: 'implementation', title: `Reunião de Implantação — ${institution.name}` })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold">
                              <Calendar className="w-3 h-3" /> Agendar reunião
                            </button>
                          </div>
                          {tasksForPhase('implementation').map(task => (
                            <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                              <div onClick={() => handleToggleTask(task.id, !task.done)}
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-cyan-400'}`}>
                                {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</p>
                                {task.done && task.done_at && <p className="text-xs text-green-500 mt-0.5">Concluído em {fmtDate(task.done_at)}</p>}
                              </div>
                            </label>
                          ))}
                          {meetingsForPhase('implementation').map(m => (
                            <div key={m.id} className={`rounded-xl border p-3 ${m.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                                  <p className="text-xs text-gray-500">{fmtDateTime(m.scheduled_at)}</p>
                                  {m.meet_link && <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 font-semibold flex items-center gap-1"><Video className="w-3 h-3" /> Meet</a>}
                                </div>
                                {m.status !== 'done' && <button onClick={() => handleMarkMeetingDone(m.id)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg font-semibold">Realizado</button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Phase 5: Training ── */}
                      {phase.id === 'training' && (
                        <div className="p-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-700">Tarefas de treinamento</p>
                            <button onClick={() => setMeetingModal({ phase: 'training', title: `Treinamento — ${institution.name}` })}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold">
                              <Calendar className="w-3 h-3" /> Agendar sessão
                            </button>
                          </div>
                          {tasksForPhase('training').map(task => (
                            <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                              <div onClick={() => handleToggleTask(task.id, !task.done)}
                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-cyan-400'}`}>
                                {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                              </div>
                              <div>
                                <p className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</p>
                                {task.done && task.done_at && <p className="text-xs text-green-500 mt-0.5">Concluído em {fmtDate(task.done_at)}</p>}
                              </div>
                            </label>
                          ))}
                          {meetingsForPhase('training').map(m => (
                            <div key={m.id} className={`rounded-xl border p-3 ${m.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                                  <p className="text-xs text-gray-500">{fmtDateTime(m.scheduled_at)}</p>
                                  {m.meet_link && <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 font-semibold flex items-center gap-1"><Video className="w-3 h-3" /> Meet</a>}
                                </div>
                                {m.status !== 'done' && <button onClick={() => handleMarkMeetingDone(m.id)} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-lg font-semibold">Realizado</button>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* ── Phase 6: Campaign ── */}
                      {phase.id === 'campaign' && (
                        <div className="p-5 space-y-4">
                          {tasksForPhase('campaign').length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-semibold text-gray-700">Checklist de campanha</p>
                              {tasksForPhase('campaign').map(task => (
                                <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                                  <div onClick={() => handleToggleTask(task.id, !task.done)}
                                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-orange-400'}`}>
                                    {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                                  </div>
                                  <p className={`text-sm font-medium mt-0.5 ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</p>
                                </label>
                              ))}
                            </div>
                          )}
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{cycle ? 'Atualizar campanha' : 'Liberar campanha'}</p>
                            <div className="grid grid-cols-4 gap-2 mb-3">
                              {months.map(m => (
                                <button key={m.v} onClick={() => setCampaignForm(f => ({ ...f, startMonth: m.v }))}
                                  className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${campaignForm.startMonth === m.v ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                                  {m.l}
                                </button>
                              ))}
                            </div>
                            <button onClick={handleReleaseCampaign} disabled={releasingCampaign}
                              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                              {releasingCampaign ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Megaphone className="w-4 h-4" />}
                              {cycle ? 'Atualizar' : 'Liberar campanha'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Phase 7: Active ── */}
                      {phase.id === 'active' && (
                        <div className="divide-y divide-gray-100">
                          {/* Financial history */}
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-gray-700">Histórico financeiro</p>
                              <button onClick={() => setShowNewCharge(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold">
                                <Plus className="w-3 h-3" /> Nova cobrança
                              </button>
                            </div>
                            {monthlyPayments.length === 0 ? (
                              <p className="text-sm text-gray-400 italic">Nenhuma mensalidade registrada.</p>
                            ) : (
                              <div className="overflow-x-auto -mx-1">
                                <table className="w-full text-sm">
                                  <thead><tr className="border-b border-gray-100">{['Descrição','Valor','Vencimento','Status',''].map(h => <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>)}</tr></thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {monthlyPayments.map(p => {
                                      const pst = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending
                                      const late = p.status === 'overdue' ? daysLate(p.due_date) : 0
                                      return (
                                        <tr key={p.id} className="hover:bg-gray-50">
                                          <td className="px-2 py-2 text-gray-700">{p.description || 'Mensalidade'}</td>
                                          <td className="px-2 py-2 font-semibold text-gray-900">{fmtBRL(p.amount)}</td>
                                          <td className="px-2 py-2 text-gray-500">{fmtDate(p.due_date)}{late > 0 && <span className="ml-1 text-xs text-red-500 font-bold">{late}d</span>}</td>
                                          <td className="px-2 py-2"><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: pst.c, background: pst.bg }}>{pst.l}</span></td>
                                          <td className="px-2 py-2">
                                            <div className="flex gap-1">
                                              {p.asaas_charge_url && <><button onClick={() => handleResendPaymentEmail(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Send className="w-3.5 h-3.5" /></button><button onClick={() => handleSendWhatsAppPayment(p)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><MessageCircle className="w-3.5 h-3.5" /></button><a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a></>}
                                              {!p.asaas_charge_url && p.status !== 'paid' && <button onClick={() => handleGenerateLink(p.id)} className="px-2 py-1 text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-lg font-semibold">🔗 Link</button>}
                                              {p.status === 'pending' && <button onClick={() => handleMarkPaid(p.id, false)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /></button>}
                                              {p.status !== 'paid' && p.status !== 'cancelled' && <button onClick={() => handleCancelPayment(p.id, p.asaas_payment_id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-3.5 h-3.5" /></button>}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* WhatsApp status */}
                          <div className="p-5">
                            <p className="text-sm font-semibold text-gray-700 mb-3">WhatsApp</p>
                            <div className={`flex items-center gap-3 p-4 rounded-xl border ${institution.whatsapp_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                              {institution.whatsapp_connected
                                ? <><Wifi className="w-5 h-5 text-green-600 flex-shrink-0" /><div><p className="font-bold text-green-700 text-sm">Conectado</p>{institution.whatsapp_display_name && <p className="text-xs text-green-600">{institution.whatsapp_display_name}</p>}</div><div className="ml-auto text-right"><p className="text-xs text-gray-400">Este mês</p><p className="font-bold text-gray-900">{waUsage.count}<span className="text-xs font-normal text-gray-400">/{waUsage.limit}</span></p></div></>
                                : <><WifiOff className="w-5 h-5 text-gray-400 flex-shrink-0" /><p className="text-sm font-semibold text-gray-500">Não configurado</p></>
                              }
                            </div>
                            <div className="mt-3 space-y-3">
                              {[
                                { k: 'phone_id',     l: 'Phone Number ID',   placeholder: '1007880222413531' },
                                { k: 'phone_number', l: 'Número',            placeholder: '+55 83 99999-9999' },
                                { k: 'display_name', l: 'Nome de exibição',  placeholder: 'Colégio São João' },
                                { k: 'waba_id',      l: 'WABA ID (deixe vazio se usar o WABA da Áion)', placeholder: '1222972209822315' },
                              ].map(f => (
                                <div key={f.k}>
                                  <label className={lbl}>{f.l}</label>
                                  <input className={inp} placeholder={f.placeholder} value={(waForm as any)[f.k]} onChange={e => setWaForm(p => ({ ...p, [f.k]: e.target.value }))} />
                                </div>
                              ))}
                              <button onClick={handleSaveWhatsApp} disabled={savingWa}
                                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                                {savingWa ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Salvar e verificar
                              </button>
                            </div>
                          </div>

                          {/* Users */}
                          <div className="p-5">
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-sm font-semibold text-gray-700">Usuários ({users.length})</p>
                              <button onClick={() => setShowNewUser(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold">
                                <Plus className="w-3 h-3" /> Novo usuário
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {users.length === 0 ? <p className="text-sm text-gray-400 italic">Nenhum usuário cadastrado.</p> : users.map(u => (
                                <div key={u.id} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div><p className="font-bold text-gray-900 text-sm">{u.full_name}</p><p className="text-xs text-gray-400">{u.email}</p></div>
                                    <div className="flex gap-1">
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{u.role}</span>
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>{u.active ? 'Ativo' : 'Inativo'}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleToggleUser(u)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border ${u.active ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                                      {u.active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}{u.active ? 'Desativar' : 'Ativar'}
                                    </button>
                                    <button onClick={() => handleDeleteUser(u)} className="p-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Done phase summary */}
                  {state === 'done' && phase.id === 'contract' && contract && (
                    <p className="text-xs text-gray-400">Contrato {contractSt?.l} em {fmtDate(contract.created_at)}</p>
                  )}
                  {state === 'done' && phase.id === 'payment' && implPayment && (
                    <p className="text-xs text-gray-400">Implantação {fmtBRL(implPayment.amount)} paga em {fmtDate(implPayment.paid_at)}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Gestão da escola ── */}
        {(institution.plan_status === 'active' || institution.plan_status === 'pending_payment') && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 pt-5 pb-0 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-4">Gestão da escola</h2>
              <div className="flex gap-1">
                {([
                  { id: 'users',     label: 'Usuários' },
                  { id: 'whatsapp',  label: 'WhatsApp' },
                  { id: 'templates', label: 'Templates' },
                  { id: 'financial', label: 'Financeiro' },
                ] as const).map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setMgmtTab(t.id)
                      if (t.id === 'templates') loadWaTemplates()
                    }}
                    className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
                      mgmtTab === t.id
                        ? 'text-cyan-700 border-cyan-500 bg-cyan-50'
                        : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">

              {/* Tab: Usuários */}
              {mgmtTab === 'users' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Usuários da escola</p>
                    <button
                      onClick={() => setShowNewUser(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                    >
                      <Plus className="w-3 h-3" /> Adicionar usuário
                    </button>
                  </div>
                  {users.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum usuário cadastrado.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Nome', 'E-mail', 'Perfil', 'Tipo', 'Status', ''].map(h => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2.5 font-medium text-gray-900">{u.full_name || '—'}</td>
                              <td className="px-3 py-2.5 text-gray-500">{u.email}</td>
                              <td className="px-3 py-2.5 text-gray-600 capitalize">{u.role}</td>
                              <td className="px-3 py-2.5 text-gray-600 text-xs">{u.user_type || 'school_user'}</td>
                              <td className="px-3 py-2.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${u.active ? 'text-green-700 bg-green-100' : 'text-gray-500 bg-gray-100'}`}>
                                  {u.active ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    onClick={() => handleToggleUser(u)}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${u.active ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}
                                  >
                                    {u.active ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                    {u.active ? 'Desativar' : 'Ativar'}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: WhatsApp */}
              {mgmtTab === 'whatsapp' && (
                <div className="space-y-5">
                  {/* Connection status */}
                  <div className={`flex items-center gap-3 p-4 rounded-xl border ${institution.whatsapp_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    {institution.whatsapp_connected
                      ? <><Wifi className="w-5 h-5 text-green-600 shrink-0" /><div><p className="text-sm font-bold text-green-700">Conectado</p><p className="text-xs text-green-600">{institution.whatsapp_phone_number || institution.whatsapp_display_name || ''}</p></div></>
                      : <><WifiOff className="w-5 h-5 text-gray-400 shrink-0" /><div><p className="text-sm font-bold text-gray-600">Não conectado</p><p className="text-xs text-gray-400">Configure o WhatsApp Business abaixo.</p></div></>
                    }
                  </div>

                  {/* Usage section */}
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Uso de conversas</p>
                      <span className="text-xs text-gray-400">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Iniciadas (escola)</p>
                        <p className="text-lg font-bold text-gray-900">{waUsage.initiated}<span className="text-xs font-normal text-gray-400">/{waUsage.limit}</span></p>
                      </div>
                      <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Recebidas (gratuitas)</p>
                        <p className="text-lg font-bold text-gray-900">{waUsage.received}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">{usagePct}% do limite</p>
                        {usagePct >= 80 && (
                          <button
                            onClick={() => { setShowNewCharge(true); setChargeForm(f => ({ ...f, payment_type: 'extra_conversations' })) }}
                            className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg hover:bg-amber-100"
                          >+ Liberar extras</button>
                        )}
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${usagePct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                      <div className="flex-1">
                        <label className={lbl}>Limite mensal</label>
                        <input type="number" min="0" className={inp} value={newLimit}
                          onChange={e => setNewLimit(e.target.value)} />
                      </div>
                      <button onClick={handleUpdateLimit} disabled={updatingLimit}
                        className="mt-5 flex items-center gap-1.5 px-3 py-2.5 bg-cyan-600 text-white rounded-lg text-xs font-semibold disabled:opacity-60 hover:bg-cyan-700">
                        {updatingLimit ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Atualizar
                      </button>
                    </div>
                  </div>

                  {/* WA config form */}
                  <div className="border-t border-gray-100 pt-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Configuração</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {[
                        { k: 'phone_id',     label: 'Phone ID',     placeholder: 'ID do número (Meta)' },
                        { k: 'phone_number', label: 'Telefone',     placeholder: '+55 (00) 00000-0000' },
                        { k: 'display_name', label: 'Nome exibido', placeholder: 'Nome da conta WA' },
                        { k: 'waba_id',      label: 'WABA ID (deixe vazio se usar o WABA da Áion)', placeholder: '1222972209822315' },
                      ].map(f => (
                        <div key={f.k}>
                          <label className={lbl}>{f.label}</label>
                          <input
                            className={inp}
                            placeholder={f.placeholder}
                            value={(waForm as any)[f.k]}
                            onChange={e => setWaForm(p => ({ ...p, [f.k]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSaveWhatsApp}
                      disabled={savingWa}
                      className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                    >
                      {savingWa
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Salvar e verificar
                    </button>
                  </div>
                </div>
              )}

              {/* Tab: Templates */}
              {mgmtTab === 'templates' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Templates WhatsApp</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadWaTemplates()}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50"
                      >
                        <RefreshCw className="w-3 h-3" /> Sincronizar com Meta
                      </button>
                      <button
                        onClick={() => setShowAddTemplate(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                      >
                        <Plus className="w-3 h-3" /> Adicionar template
                      </button>
                    </div>
                  </div>

                  {loadingTemplates ? (
                    <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
                  ) : waTemplates.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum template encontrado.</p>
                  ) : (
                    <div className="space-y-3">
                      {waTemplates.map((tpl: any) => {
                        const statusColors: Record<string, { badge: string; dot: string }> = {
                          APPROVED: { badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
                          PENDING:  { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
                          REJECTED: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
                        }
                        const sc = statusColors[tpl.status] || { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
                        const bodyComp = tpl.components?.find((c: any) => c.type === 'BODY')
                        return (
                          <div key={tpl.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-gray-800">{tpl.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{tpl.category}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${sc.badge}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                                  {tpl.status}
                                </span>
                              </div>
                              {tpl.created_time && (
                                <span className="text-xs text-gray-400 shrink-0">{new Date(tpl.created_time * 1000).toLocaleDateString('pt-BR')}</span>
                              )}
                            </div>
                            {bodyComp?.text && (
                              <p className="text-xs text-gray-600 bg-white border border-gray-200 rounded-lg p-2 whitespace-pre-wrap">{bodyComp.text}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Add template modal */}
                  {showAddTemplate && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
                      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-5">
                          <h2 className="text-lg font-bold text-gray-900">Novo Template</h2>
                          <button onClick={() => setShowAddTemplate(false)}><X className="w-5 h-5 text-gray-400" /></button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className={lbl}>Nome (snake_case)</label>
                            <input className={inp} placeholder="ex: boas_vindas" value={newTemplate.name}
                              onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value.toLowerCase().replace(/\s+/g,'_') }))} />
                          </div>
                          <div>
                            <label className={lbl}>Categoria</label>
                            <select className={inp} value={newTemplate.category}
                              onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}>
                              <option value="UTILITY">UTILITY</option>
                              <option value="MARKETING">MARKETING</option>
                              <option value="AUTHENTICATION">AUTHENTICATION</option>
                            </select>
                          </div>
                          <div>
                            <label className={lbl}>Texto do corpo (use {'{{'+'1}}'} para variáveis)</label>
                            <textarea className={inp} rows={4} placeholder="Olá, {{1}}! Bem-vindo ao {{2}}."
                              value={newTemplate.body}
                              onChange={e => setNewTemplate(p => ({ ...p, body: e.target.value }))} />
                          </div>
                          {newTemplate.body && (
                            <div>
                              <label className={lbl}>Preview</label>
                              <div className="bg-[#DCF8C6] rounded-xl px-4 py-3 text-sm text-gray-800 border border-green-200">{newTemplate.body}</div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-3 mt-6">
                          <button onClick={() => setShowAddTemplate(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
                          <button onClick={handleAddTemplate} disabled={sendingNewTemplate}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                            {sendingNewTemplate ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar para aprovação
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Financeiro */}
              {mgmtTab === 'financial' && (() => {
                const allPmt = payments
                const totalPaid = allPmt.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
                const totalOpen = allPmt.filter(p => p.status === 'pending' || p.status === 'overdue').reduce((s, p) => s + (p.amount || 0), 0)
                const nextDue = allPmt.filter(p => p.status === 'pending' && p.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
                return (
                  <div>
                    {/* KPIs */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-green-600 mb-1">Total pago</p>
                        <p className="text-lg font-bold text-green-700">{fmtBRL(totalPaid)}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-amber-600 mb-1">Em aberto</p>
                        <p className="text-lg font-bold text-amber-700">{fmtBRL(totalOpen)}</p>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                        <p className="text-xs font-semibold text-blue-600 mb-1">Próx. vencimento</p>
                        <p className="text-lg font-bold text-blue-700">{nextDue ? fmtDate(nextDue.due_date) : '—'}</p>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-gray-700">Cobranças</p>
                      <button
                        onClick={() => setShowNewCharge(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold hover:bg-cyan-100"
                      >
                        <Plus className="w-3 h-3" /> Nova cobrança
                      </button>
                    </div>
                    {allPmt.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-8">Nenhuma cobrança registrada.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              {['Descrição', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                                <th key={h} className="px-2 py-2 text-left text-xs font-semibold text-gray-400 uppercase">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {allPmt.map(p => {
                              const pst = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending
                              const late = p.status === 'overdue' ? daysLate(p.due_date) : 0
                              return (
                                <tr key={p.id} className="hover:bg-gray-50">
                                  <td className="px-2 py-2 text-gray-700">{p.description || 'Cobrança'}</td>
                                  <td className="px-2 py-2 font-semibold text-gray-900">{fmtBRL(p.amount)}</td>
                                  <td className="px-2 py-2 text-gray-500">
                                    {fmtDate(p.due_date)}
                                    {late > 0 && <span className="ml-1 text-xs text-red-500 font-bold">{late}d</span>}
                                  </td>
                                  <td className="px-2 py-2">
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: pst.c, background: pst.bg }}>{pst.l}</span>
                                  </td>
                                  <td className="px-2 py-2">
                                    <div className="flex gap-1">
                                      {p.asaas_charge_url && (
                                        <>
                                          <button onClick={() => copyToClipboard(p.asaas_charge_url, `pay-${p.id}`)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                                            {copied === `pay-${p.id}` ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                          <button onClick={() => handleResendPaymentEmail(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Send className="w-3.5 h-3.5" /></button>
                                          <button onClick={() => handleSendWhatsAppPayment(p)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><MessageCircle className="w-3.5 h-3.5" /></button>
                                          <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>
                                        </>
                                      )}
                                      {!p.asaas_charge_url && p.status !== 'paid' && (
                                        <button onClick={() => handleGenerateLink(p.id)} className="px-2 py-1 text-xs bg-gray-100 border border-gray-200 text-gray-600 rounded-lg font-semibold">🔗 Link</button>
                                      )}
                                      {p.status === 'pending' && (
                                        <button onClick={() => handleMarkPaid(p.id, p.payment_type === 'implementation')} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /></button>
                                      )}
                                      {p.status !== 'paid' && p.status !== 'cancelled' && (
                                        <button onClick={() => handleCancelPayment(p.id, p.asaas_payment_id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Ban className="w-3.5 h-3.5" /></button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })()}

            </div>
          </div>
        )}

        {/* ── Modal: Nova cobrança ── */}
        {showNewCharge && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Nova cobrança</h2>
                <button onClick={() => setShowNewCharge(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Tipo</label>
                    <select className={inp} value={chargeForm.payment_type} onChange={e => setChargeForm(f => ({ ...f, payment_type: e.target.value }))}>
                      <option value="monthly">Mensalidade</option>
                      <option value="implementation">Implantação</option>
                      <option value="extra_conversations">Conversas extras</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Forma</label>
                    <select className={inp} value={chargeForm.billingType} onChange={e => setChargeForm(f => ({ ...f, billingType: e.target.value }))}>
                      <option value="PIX">PIX</option>
                      <option value="BOLETO">Boleto</option>
                      <option value="CREDIT_CARD">Cartão</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Valor (R$) *</label>
                    <input type="number" className={inp} value={chargeForm.amount} onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Vencimento</label>
                    <input type="date" className={inp} value={chargeForm.due_date} onChange={e => setChargeForm(f => ({ ...f, due_date: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Descrição</label>
                  <input className={inp} value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewCharge(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleNewCharge} disabled={savingCharge} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingCharge ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />} Gerar cobrança
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Novo usuário ── */}
        {showNewUser && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Novo usuário</h2>
                <button onClick={() => setShowNewUser(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div><label className={lbl}>Nome completo *</label><input className={inp} value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} /></div>
                <div><label className={lbl}>E-mail *</label><input type="email" className={inp} value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} /></div>
                <div>
                  <label className={lbl}>Senha *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className={inp + ' pr-10'} placeholder="Mínimo 8 caracteres" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                    <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Perfil</label>
                  <select className={inp} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                    <option value="admin">Admin</option><option value="manager">Gerente</option><option value="user">Usuário</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewUser(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleCreateUser} disabled={savingUser} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingUser ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar usuário'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
