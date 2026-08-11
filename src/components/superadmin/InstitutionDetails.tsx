import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import { createGoogleMeet, buildEndDatetime } from '../../lib/googleMeet'
import AttendeesPicker from '../shared/AttendeesPicker'
import {
  Building2, Users, DollarSign, FileText, CheckCircle2,
  Clock, AlertTriangle, ExternalLink, Copy, RefreshCw,
  CreditCard, Lock, Unlock, Send, MessageCircle, X,
  Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  ArrowLeft, Megaphone, Bell, Wifi, WifiOff,
  Edit2, Save, Phone, Mail, MapPin, Calendar,
  Zap, BookOpen, TrendingUp, Star, Ban, Video,
  CheckSquare, ChevronDown, ChevronRight, Link as LinkIcon,
  AlertCircle, Archive, Rocket, Target, ArrowRight
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
const CYCLE_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  draft:     { l: 'Rascunho',         c: '#6b7280', bg: '#f3f4f6' },
  setup:     { l: 'Em configuração',  c: '#a16207', bg: '#fef9c3' },
  active:    { l: 'Ativa',            c: '#2563eb', bg: '#eff6ff' },
  released:  { l: 'Liberada',         c: '#16a34a', bg: '#f0fdf4' },
  completed: { l: 'Concluída',        c: '#7c3aed', bg: '#f5f3ff' },
  archived:  { l: 'Arquivada',        c: '#6b7280', bg: '#f3f4f6' },
}

// 5 fases reais de onboarding_processes.current_phase — mesma taxonomia usada
// em toda a implantação (antes duplicada em AdminOnboarding.tsx, agora
// consolidada só aqui). Nada de fases virtuais/derivadas: o que a tela mostra
// é exatamente o que está gravado no banco.
type TimelinePhaseId = 'contract' | 'implementation' | 'training' | 'campaign' | 'monthly'

const TIMELINE_PHASES: Array<{ id: TimelinePhaseId; label: string; icon: any; color: string }> = [
  { id: 'contract',       label: 'Contrato',       icon: FileText,   color: '#6366F1' },
  { id: 'implementation', label: 'Implantação',    icon: Zap,        color: '#2563EB' },
  { id: 'training',       label: 'Treinamento',    icon: BookOpen,   color: '#7C3AED' },
  { id: 'campaign',       label: 'Campanha',       icon: TrendingUp, color: '#EA580C' },
  { id: 'monthly',        label: 'Acompanhamento', icon: Star,       color: '#16A34A' },
]

const DEFAULT_TASKS_CONTRACT = [
  { title: 'Contrato enviado via Autentique',      description: 'Enviar contrato para assinatura digital' },
  { title: 'Contrato assinado pela escola',        description: 'Confirmar assinatura do responsável' },
  { title: 'Pagamento da implantação confirmado',  description: 'Verificar pagamento no Asaas' },
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
const DEFAULT_TASKS_MONTHLY = [
  { title: '1ª reunião mensal realizada', description: 'Primeiro acompanhamento mensal' },
  { title: 'Relatório do mês enviado',    description: 'Relatório de performance enviado' },
]

// ── MeetingModal ──────────────────────────────────────────────────────────────
function MeetingModal({
  processId, institutionId, phase, title: defaultTitle,
  attendeeEmail, consultants, onClose, onSaved,
}: {
  processId: string; institutionId: string; phase: string; title: string
  attendeeEmail?: string; consultants: any[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: defaultTitle,
    scheduled_at: '',
    duration_min: 60,
    meet_link: '',
    notes: '',
    attendees: [] as string[],
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
      attendees: form.attendees,
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
        attendees: form.attendees,
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
            <label className={lbl}>Participantes</label>
            <AttendeesPicker clientEmail={attendeeEmail || ''} consultants={consultants} value={form.attendees} onChange={v => set('attendees', v)} />
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
  const { user } = useAuth()
  const cancelledRef = useRef(false)

  const [institution,       setInstitution]       = useState<any>(null)
  const [users,             setUsers]             = useState<any[]>([])
  const [payments,          setPayments]          = useState<any[]>([])
  const [contract,          setContract]          = useState<any>(null)
  const [onboardingProcess, setOnboardingProcess] = useState<any>(null)
  const [onboardingTasks,   setOnboardingTasks]   = useState<any[]>([])
  const [meetings,          setMeetings]          = useState<any[]>([])
  const [cycles,            setCycles]            = useState<any[]>([])
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

  // Campanhas — antes havia um mini-formulário (mês + liberar) direto na fase
  // "campaign" do onboarding; consolidado na aba Campanhas nova (evita duas
  // UIs divergentes fazendo a mesma coisa, mesmo motivo da consolidação de
  // Contratos/Onboarding da rodada anterior). Criar novo ciclo:
  const [showNewCampaign, setShowNewCampaign] = useState(false)
  const [newCampaignForm, setNewCampaignForm] = useState({
    year: new Date().getFullYear() + 1,
    startDate: '', endDate: '', targetNewStudents: '',
  })
  const [savingCampaign,    setSavingCampaign]    = useState(false)
  const [releasingCycleId,  setReleasingCycleId]  = useState<string | null>(null)

  // Meeting modal
  const [meetingModal, setMeetingModal] = useState<{ phase: string; title: string } | null>(null)

  // Init process
  const [initingProcess, setInitingProcess] = useState(false)

  // Avançar fase — confirmação visual (substitui window.confirm)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [advancingPhase,     setAdvancingPhase]     = useState(false)

  // Gestão da escola tabs
  const [mgmtTab, setMgmtTab] = useState<'users' | 'whatsapp' | 'financial' | 'templates' | 'campaigns'>('users')

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
        supabase.from('campaign_cycles').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant').order('full_name'),
        supabase.from('whatsapp_phone_numbers').select('waba_id').eq('institution_id', id).maybeSingle(),
      ])

      if (cancelledRef.current) return

      console.log('[loadAll] contract:', contractRes.data, 'error:', contractRes.error)

      const inst = instRes.data
      setInstitution(inst)
      setUsers(usersRes.data || [])
      setPayments(paymentsRes.data || [])
      setContract(contractRes.data ?? null)
      setCycles(cycleRes.data || [])
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
    const { error } = await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', id)
    if (error) { showToast(`Erro ao suspender: ${error.message}`, false); return }
    try { await supabase.functions.invoke('send-email', { body: { type: 'suspended', to: institution?.email, data: { institution_name: institution?.name, dias_atraso: '0' } } }) } catch {}
    showToast('Escola suspensa.')
    loadAll()
  }

  const handleReactivate = async () => {
    if (!confirm(`Reativar acesso de "${institution?.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
    if (error) { showToast(`Erro ao reativar: ${error.message}`, false); return }
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
    const { error: contractErr } = await supabase.from('contracts').update({ status: 'signed' }).eq('id', contract.id)
    if (contractErr) { showToast(`Erro ao marcar contrato: ${contractErr.message}`, false); return }
    const { error: instErr } = await supabase.from('institutions').update({ plan_status: 'pending_payment' }).eq('id', id)
    if (instErr) { showToast(`Contrato marcado, mas erro ao atualizar status da escola: ${instErr.message}`, false); loadAll(); return }
    showToast('Contrato marcado como assinado!')
    loadAll()
  }

  const handleMarkPaid = async (paymentId: string, isImpl: boolean) => {
    if (!confirm('Marcar como pago manualmente?')) return
    const { error } = await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', paymentId)
    if (error) { showToast(`Erro ao marcar pagamento: ${error.message}`, false); return }
    if (isImpl) {
      const { error: instErr } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
      if (instErr) { showToast(`Pagamento confirmado, mas erro ao ativar escola: ${instErr.message}`, false); loadAll(); return }
      try { await supabase.functions.invoke('send-email', { body: { type: 'new_institution', to: institution?.email, data: { institution_name: institution?.name, login_url: 'https://app.aionedu.com.br/login' } } }) } catch {}
    }
    showToast('Pagamento confirmado!')
    loadAll()
  }

  const handleCancelPayment = async (paymentId: string, asaasId?: string) => {
    if (!confirm('Cancelar esta cobrança?')) return
    if (asaasId) { try { await supabase.functions.invoke('asaas-cancel-charge', { body: { payment_id: asaasId } }) } catch {} }
    const { error } = await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId)
    if (error) { showToast(`Erro ao cancelar cobrança: ${error.message}`, false); return }
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
    const { data: wabaRow } = await supabase
      .from('platform_settings').select('value').eq('key', 'wa_waba_id').maybeSingle()
    const AION_WABA = wabaRow?.value || ''
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

      if (id) {
        // Limpa o cache antigo antes de recriar — evita templates órfãos
        // sobrando de uma sincronização anterior contra um WABA diferente
        // (ex.: waba_id da instituição corrigido depois de estar errado),
        // já que upsert sozinho só insere/atualiza, nunca remove o que não
        // veio na resposta atual da Graph API.
        const { error: delErr } = await supabase.from('whatsapp_templates').delete().eq('institution_id', id)
        if (delErr) console.error('[templates] erro ao limpar cache antigo:', delErr)

        if (metaTemplates.length > 0) {
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
          const { error: upsertErr } = await supabase
            .from('whatsapp_templates')
            .upsert(toUpsert, { onConflict: 'institution_id,name' })
          if (upsertErr) console.error('[templates] erro ao salvar cache:', upsertErr)
        }
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
      const { data: settingsRows } = await supabase
        .from('platform_settings').select('key, value').in('key', ['wa_access_token', 'wa_waba_id'])
      const settingsMap: Record<string, string> = {}
      settingsRows?.forEach((r: any) => { settingsMap[r.key] = r.value })
      const globalToken = settingsMap['wa_access_token'] || ''
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
      const AION_WABA_ID = settingsMap['wa_waba_id'] || ''
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

  // Cria um novo ciclo de campanha (aba Campanhas → "Criar Nova Campanha").
  // Sempre nasce em status='draft' — "Liberar para a escola" é uma ação
  // separada e explícita (handleReleaseCampaign), não acontece na criação.
  const handleCreateCampaign = async () => {
    if (!id) return
    const { year, startDate, endDate, targetNewStudents } = newCampaignForm
    if (!startDate || !endDate) { showToast('Preencha as datas de início e fim.', false); return }
    if (new Date(endDate) <= new Date(startDate)) { showToast('A data de fim precisa ser depois da de início.', false); return }
    setSavingCampaign(true)
    try {
      const { error } = await supabase.from('campaign_cycles').insert({
        institution_id: id, status: 'draft',
        year, label: `Campanha ${year}`,
        start_date: startDate, end_date: endDate,
        campaign_start_month: new Date(startDate + 'T12:00:00').getMonth() + 1,
        target_new_students: Number(targetNewStudents) || 0, target_reenrollment_rate: 85,
        base_students: 0, monthly_targets: [], market_data: {},
        historical_input: [], generation_mode: 'benchmark', ai_reasoning: '', realism_score: 'realistic',
      })
      if (error) throw error
      showToast(`Campanha ${year} criada como rascunho!`)
      setShowNewCampaign(false)
      setNewCampaignForm({ year: new Date().getFullYear() + 1, startDate: '', endDate: '', targetNewStudents: '' })
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar campanha.', false)
    } finally {
      setSavingCampaign(false)
    }
  }

  // Libera um ciclo específico pra escola (aba Campanhas, ação por linha).
  const handleReleaseCampaign = async (cycleId: string) => {
    const target = cycles.find(c => c.id === cycleId)
    if (!target) return
    setReleasingCycleId(cycleId)
    try {
      const { error } = await supabase.from('campaign_cycles').update({
        status: 'released',
        released_at: new Date().toISOString(),
        released_by: user?.id || null,
      }).eq('id', cycleId)
      if (error) throw error

      const { error: notifErr } = await supabase.from('system_notifications').insert({
        institution_id: id, title: `Campanha ${target.year} liberada! 🎉`,
        message: 'Sua campanha de matrículas foi liberada.', type: 'info', read: false,
      })
      if (notifErr) console.error('[handleReleaseCampaign] erro ao notificar escola:', notifErr.message)

      showToast(`Campanha ${target.year} liberada!`)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao liberar campanha.', false)
    } finally {
      setReleasingCycleId(null)
    }
  }

  const handleToggleTask = async (taskId: string, done: boolean) => {
    const done_at = done ? new Date().toISOString() : null
    const { error } = await supabase.from('onboarding_tasks').update({ done, done_at }).eq('id', taskId)
    if (error) { showToast(`Erro ao salvar tarefa: ${error.message}`, false); return }
    setOnboardingTasks(prev => prev.map(t => t.id === taskId ? { ...t, done, done_at } : t))
    loadAll(true)
  }

  const handleMarkMeetingDone = async (meetingId: string) => {
    const { error } = await supabase.from('onboarding_meetings').update({ status: 'done' }).eq('id', meetingId)
    if (error) { showToast(`Erro ao marcar reunião: ${error.message}`, false); return }
    showToast('Reunião marcada como realizada!')
    loadAll()
  }

  // Checklist é sempre manual (item 5) — o avanço de fase é uma ação
  // explícita do admin, não é derivado automaticamente da conclusão das
  // tarefas. Confirmação visual (showAdvanceConfirm) substitui o window.confirm
  // antigo pra deixar claro de/para qual fase a escola está indo.
  const handleAdvancePhase = () => {
    if (!onboardingProcess) return
    setShowAdvanceConfirm(true)
  }

  const confirmAdvancePhase = async () => {
    if (!onboardingProcess) return
    const idx = TIMELINE_PHASES.findIndex(p => p.id === onboardingProcess.current_phase)
    const next = TIMELINE_PHASES[idx + 1]
    if (!next) { setShowAdvanceConfirm(false); return }
    setAdvancingPhase(true)
    try {
      const { error } = await supabase.from('onboarding_processes').update({ current_phase: next.id }).eq('id', onboardingProcess.id)
      if (error) { showToast(`Erro ao avançar fase: ${error.message}`, false); return }
      setOnboardingProcess((p: any) => p ? { ...p, current_phase: next.id } : p)
      showToast(`Fase avançada para "${next.label}"!`)
      setShowAdvanceConfirm(false)
    } finally {
      setAdvancingPhase(false)
    }
  }

  const handleInitProcess = async () => {
    if (!id) return
    setInitingProcess(true)
    try {
      const { data: proc, error } = await supabase.from('onboarding_processes').insert({ institution_id: id, current_phase: 'contract', status: 'active' }).select().single()
      if (error) throw error
      const allTasks: any[] = []
      let order = 0
      const tasksByPhase = [
        { phase: 'contract', tasks: DEFAULT_TASKS_CONTRACT },
        { phase: 'implementation', tasks: DEFAULT_TASKS_IMPL },
        { phase: 'training', tasks: DEFAULT_TASKS_TRAINING },
        { phase: 'campaign', tasks: DEFAULT_TASKS_CAMPAIGN },
        { phase: 'monthly', tasks: DEFAULT_TASKS_MONTHLY },
      ]
      for (const { phase, tasks } of tasksByPhase) {
        for (const t of tasks) {
          allTasks.push({ process_id: proc.id, phase, title: t.title, description: t.description, done: false, sort_order: order++ })
        }
      }
      const { error: tasksErr } = await supabase.from('onboarding_tasks').insert(allTasks)
      if (tasksErr) throw tasksErr
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
  // Sempre o valor real gravado em onboarding_processes.current_phase — sem
  // heurística derivada (a tela mostra exatamente o que está no banco).
  const currentPhase: TimelinePhaseId = (onboardingProcess?.current_phase as TimelinePhaseId) || 'contract'
  const currentPhaseIdx = TIMELINE_PHASES.findIndex(p => p.id === currentPhase)

  const phaseState = (phaseId: TimelinePhaseId): 'done' | 'active' | 'pending' => {
    const idx = TIMELINE_PHASES.findIndex(p => p.id === phaseId)
    if (idx < currentPhaseIdx) return 'done'
    if (idx === currentPhaseIdx) return 'active'
    return 'pending'
  }

  const tasksForPhase = (phase: string) => onboardingTasks.filter(t => t.phase === phase)
  const meetingsForPhase = (phase: string) => meetings.filter(m => m.type === phase)

  // Tarefa "Campanha liberada pelo admin" é derivada, não manual — é
  // literalmente a mesma ação do botão "Liberar" na aba Campanhas, então em
  // vez de o admin marcar à mão, ela reflete sozinha se já existe algum ciclo
  // liberado pra essa escola.
  const campaignReleasedByAdmin = cycles.some(c => c.status === 'released')
  const isDerivedTask = (phaseId: TimelinePhaseId, task: any) => phaseId === 'campaign' && task.title === 'Campanha liberada pelo admin'
  const isTaskDone = (phaseId: TimelinePhaseId, task: any) => isDerivedTask(phaseId, task) ? (task.done || campaignReleasedByAdmin) : task.done

  // Checklist da fase em formato de cards + indicador "X de Y concluídas",
  // reaproveitado nas 5 fases (Part 1 do pedido: reforma visual sem tocar na
  // lógica de dados já corrigida).
  const renderTaskChecklist = (phaseId: TimelinePhaseId) => {
    const tasks = tasksForPhase(phaseId)
    if (tasks.length === 0) return null
    const doneCount = tasks.filter(t => isTaskDone(phaseId, t)).length
    const color = TIMELINE_PHASES.find(p => p.id === phaseId)?.color || '#6b7280'
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Checklist da fase</p>
          <span className="text-xs font-bold text-gray-400">{doneCount} de {tasks.length} concluídas</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(doneCount / tasks.length) * 100}%`, background: color }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {tasks.map(task => {
            const derived = isDerivedTask(phaseId, task)
            const done = isTaskDone(phaseId, task)
            return (
              <div key={task.id}
                onClick={() => !derived && handleToggleTask(task.id, !task.done)}
                className={`flex items-start gap-3 rounded-xl border p-3 transition-all ${derived ? 'cursor-default' : 'cursor-pointer group'} ${done ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-gray-400'}`}>
                  {done && <CheckCircle2 className="w-3 h-3 text-white" />}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-gray-700'}`}>{task.title}</p>
                  {done && !derived && task.done_at && <p className="text-xs text-green-500 mt-0.5">Concluído em {fmtDate(task.done_at)}</p>}
                  {derived && done && <p className="text-xs text-green-600 mt-0.5 flex items-center gap-1 font-medium"><Rocket className="w-3 h-3" /> Automático — campanha liberada</p>}
                  {derived && !done && <p className="text-xs text-gray-400 mt-0.5">Automático — libere um ciclo na aba Campanhas</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Reuniões da fase, sempre em cards — reaproveitado nas fases com reunião.
  const renderMeetingList = (phaseType: string) => {
    const list = meetingsForPhase(phaseType)
    if (list.length === 0) return <p className="text-sm text-gray-400 italic">Nenhuma reunião agendada.</p>
    return (
      <div className="space-y-2">
        {list.map(m => (
          <div key={m.id} className={`rounded-xl border p-3.5 ${m.status === 'done' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{fmtDateTime(m.scheduled_at)}{m.duration_min ? ` · ${m.duration_min}min` : ''}</p>
                {m.meet_link && <a href={m.meet_link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 font-semibold mt-1 flex items-center gap-1"><Video className="w-3 h-3" /> Entrar no Meet</a>}
              </div>
              {m.status !== 'done'
                ? <button onClick={() => handleMarkMeetingDone(m.id)} className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold flex-shrink-0">Realizado</button>
                : <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-lg font-semibold flex-shrink-0 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Feita</span>
              }
            </div>
          </div>
        ))}
      </div>
    )
  }

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
            consultants={consultants}
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
            <button onClick={() => loadAll()} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
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

        {/* ── Jornada de implantação: stepper horizontal compacto ── */}
        {onboardingProcess && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold text-gray-900">Jornada de implantação</p>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: TIMELINE_PHASES[currentPhaseIdx]?.color, background: TIMELINE_PHASES[currentPhaseIdx]?.color + '18' }}>
                Fase {currentPhaseIdx + 1} de {TIMELINE_PHASES.length} · {TIMELINE_PHASES[currentPhaseIdx]?.label}
              </span>
            </div>
            <div className="flex items-center">
              {TIMELINE_PHASES.map((phase, idx) => {
                const state = phaseState(phase.id)
                const Icon = phase.icon
                return (
                  <Fragment key={phase.id}>
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0" style={{ width: 76 }}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${state === 'done' ? 'bg-green-500' : state === 'active' ? 'ring-4' : 'bg-gray-100'}`}
                        style={state === 'active' ? { background: phase.color, boxShadow: `0 0 0 4px ${phase.color}22` } : {}}>
                        {state === 'done'
                          ? <CheckCircle2 className="w-4.5 h-4.5 text-white" />
                          : <Icon className="w-4 h-4" style={{ color: state === 'active' ? '#fff' : '#9ca3af' }} />
                        }
                      </div>
                      <span className={`text-[11px] font-semibold text-center leading-tight ${state === 'active' ? 'text-gray-900' : state === 'done' ? 'text-gray-500' : 'text-gray-300'}`}>{phase.label}</span>
                    </div>
                    {idx < TIMELINE_PHASES.length - 1 && <div className={`flex-1 h-0.5 -mt-5 ${idx < currentPhaseIdx ? 'bg-green-300' : 'bg-gray-200'}`} />}
                  </Fragment>
                )
              })}
            </div>
          </div>
        )}

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
                    ${state === 'done' ? 'bg-green-500' : state === 'active' ? 'ring-4 shadow-md' : 'bg-gray-100'}`}
                    style={state === 'active' ? { background: phase.color, boxShadow: `0 0 0 4px ${phase.color}22` } : {}}>
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
                    {state === 'done' && <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Concluído</span>}
                    {/* Avanço de fase é sempre manual (item 5) — nunca derivado da
                        conclusão das tarefas, só por clique explícito do admin,
                        com confirmação visual (modal showAdvanceConfirm). */}
                    {state === 'active' && onboardingProcess && idx < TIMELINE_PHASES.length - 1 && (
                      <button onClick={handleAdvancePhase}
                        className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold text-white transition-colors shadow-sm"
                        style={{ background: phase.color }}>
                        Avançar fase <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
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

                          {/* Taxa de implantação — antes fase própria "Pagamento", agora
                              parte da fase Contrato (o pagamento é uma das 3 tarefas
                              dessa fase, não um passo separado) */}
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-sm font-semibold text-gray-700 mb-3">Taxa de implantação</p>
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

                          {/* Checklist da fase — semeado junto com o processo de onboarding */}
                          {tasksForPhase('contract').length > 0 && (
                            <div className="border-t border-gray-100 pt-4">
                              {renderTaskChecklist('contract')}
                            </div>
                          )}

                          {/* Escola legada sem processo de implantação — fallback manual
                              (item 3 já cobre escolas novas automaticamente) */}
                          {!onboardingProcess && (
                            <div className="border-t border-gray-100 pt-4 text-center">
                              <p className="text-sm text-gray-500 mb-3">Esta escola ainda não tem um processo de implantação.</p>
                              <button onClick={handleInitProcess} disabled={initingProcess}
                                className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500 text-white rounded-xl font-semibold text-sm mx-auto disabled:opacity-60">
                                {initingProcess ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Zap className="w-4 h-4" />}
                                Iniciar onboarding
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Phase: Implementation (inclui kickoff — 1ª tarefa da fase) ── */}
                      {phase.id === 'implementation' && (
                        <div className="p-5 space-y-4">
                          {/* Reunião de kickoff — antes fase própria, agora vinculada à
                              1ª tarefa da fase Implantação */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">Reunião de kickoff</p>
                              <button onClick={() => setMeetingModal({ phase: 'kickoff', title: `Kickoff — ${institution.name}` })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-semibold">
                                <Plus className="w-3 h-3" /> Agendar
                              </button>
                            </div>
                            {renderMeetingList('kickoff')}
                          </div>

                          <div className="border-t border-gray-100 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">Reunião de implantação</p>
                              <button onClick={() => setMeetingModal({ phase: 'implementation', title: `Reunião de Implantação — ${institution.name}` })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-semibold">
                                <Calendar className="w-3 h-3" /> Agendar reunião
                              </button>
                            </div>
                            {renderMeetingList('implementation')}
                          </div>

                          <div className="border-t border-gray-100 pt-4">
                            {renderTaskChecklist('implementation')}
                          </div>
                        </div>
                      )}

                      {/* ── Phase 5: Training ── */}
                      {phase.id === 'training' && (
                        <div className="p-5 space-y-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-gray-700">Sessões de treinamento</p>
                              <button onClick={() => setMeetingModal({ phase: 'training', title: `Treinamento — ${institution.name}` })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold">
                                <Calendar className="w-3 h-3" /> Agendar sessão
                              </button>
                            </div>
                            {renderMeetingList('training')}
                          </div>
                          <div className="border-t border-gray-100 pt-4">
                            {renderTaskChecklist('training')}
                          </div>
                        </div>
                      )}

                      {/* ── Phase: Campaign — o mini-form (mês + liberar) que existia
                          direto aqui foi consolidado na aba "Campanhas" nova, que lista
                          todos os ciclos (não só o mais recente) e libera um por vez. */}
                      {phase.id === 'campaign' && (
                        <div className="p-5 space-y-4">
                          {renderTaskChecklist('campaign')}
                          <div className="border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-orange-900">
                                  {cycles.length === 0 ? 'Nenhum ciclo de campanha criado' : `${cycles.length} ciclo${cycles.length > 1 ? 's' : ''} de campanha`}
                                </p>
                                <p className="text-xs text-orange-700 mt-0.5">
                                  {campaignReleasedByAdmin ? 'Campanha já liberada para a escola.' : 'Crie e libere um ciclo na aba Campanhas.'}
                                </p>
                              </div>
                              <button
                                onClick={() => { setMgmtTab('campaigns'); document.getElementById('mgmt-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
                                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 text-white rounded-xl text-xs font-semibold flex-shrink-0 hover:bg-orange-600 transition-colors">
                                <Megaphone className="w-3.5 h-3.5" /> Ir para Campanhas
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* ── Phase: Monthly (acompanhamento contínuo, antes "Ativo") ── */}
                      {phase.id === 'monthly' && (
                        <div className="divide-y divide-gray-100">
                          {/* Checklist + reunião mensal */}
                          <div className="p-5 space-y-4">
                            {renderTaskChecklist('monthly')}
                            <div className="border-t border-gray-100 pt-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-gray-700">Reuniões mensais</p>
                                <button onClick={() => setMeetingModal({ phase: 'monthly', title: `Reunião Mensal — ${institution.name}` })}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold">
                                  <Calendar className="w-3 h-3" /> Agendar reunião
                                </button>
                              </div>
                              {renderMeetingList('monthly')}
                            </div>
                          </div>
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
                                { k: 'waba_id',      l: 'WABA ID (deixe vazio se usar o WABA da Áion)', placeholder: '2812701862456294' },
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
                    <p className="text-xs text-gray-400">
                      Contrato {contractSt?.l} em {fmtDate(contract.created_at)}
                      {implPayment?.status === 'paid' && ` · Implantação paga em ${fmtDate(implPayment.paid_at)}`}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Gestão da escola ── */}
        {(institution.plan_status === 'active' || institution.plan_status === 'pending_payment') && (
          <div id="mgmt-section" className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-4">
            <div className="px-6 pt-5 pb-0 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 mb-4">Gestão da escola</h2>
              <div className="flex gap-1">
                {([
                  { id: 'users',     label: 'Usuários' },
                  { id: 'whatsapp',  label: 'WhatsApp' },
                  { id: 'templates', label: 'Templates' },
                  { id: 'financial', label: 'Financeiro' },
                  { id: 'campaigns', label: 'Campanhas' },
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
                        { k: 'waba_id',      label: 'WABA ID (deixe vazio se usar o WABA da Áion)', placeholder: '2812701862456294' },
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

              {/* Tab: Campanhas */}
              {mgmtTab === 'campaigns' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Ciclos de campanha ({cycles.length})</p>
                    <button
                      onClick={() => setShowNewCampaign(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-xl text-xs font-semibold hover:bg-orange-100"
                    >
                      <Plus className="w-3 h-3" /> Criar nova campanha
                    </button>
                  </div>

                  {cycles.length === 0 ? (
                    <p className="text-sm text-gray-400 italic text-center py-8">Nenhum ciclo de campanha criado ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {cycles.map(c => {
                        const cst = CYCLE_STATUS[c.status] || CYCLE_STATUS.draft
                        const canRelease = c.status === 'draft' || c.status === 'setup' || c.status === 'active'
                        return (
                          <div key={c.id} className="rounded-xl border border-gray-200 p-4">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <p className="text-sm font-bold text-gray-900">{c.label || `Campanha ${c.year}`}</p>
                                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: cst.c, background: cst.bg }}>{cst.l}</span>
                                </div>
                                <p className="text-xs text-gray-500">
                                  {fmtDate(c.start_date)} — {fmtDate(c.end_date)}
                                  {c.released_at && <span className="ml-2 text-green-600 font-medium">· Liberada em {fmtDate(c.released_at)}</span>}
                                </p>
                              </div>
                              {canRelease && (
                                <button
                                  onClick={() => handleReleaseCampaign(c.id)}
                                  disabled={releasingCycleId === c.id}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-xs font-semibold disabled:opacity-60 flex-shrink-0"
                                >
                                  {releasingCycleId === c.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                                  Liberar para a escola
                                </button>
                              )}
                            </div>

                            {/* Métricas já coletadas, quando existirem */}
                            {(c.target_new_students || c.base_students || c.projected_cpa) ? (
                              <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100">
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">Meta de novos alunos</p>
                                  <p className="text-sm font-bold text-gray-900">{c.target_new_students || '—'}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">Base de alunos</p>
                                  <p className="text-sm font-bold text-gray-900">{c.base_students || '—'}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-400">CPA projetado</p>
                                  <p className="text-sm font-bold text-gray-900">{c.projected_cpa ? fmtBRL(c.projected_cpa) : '—'}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 italic mt-3 pt-3 border-t border-gray-100">Métricas ainda não preenchidas pela escola.</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

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

        {/* ── Modal: Confirmar avanço de fase ── */}
        {showAdvanceConfirm && onboardingProcess && (() => {
          const curIdx = TIMELINE_PHASES.findIndex(p => p.id === onboardingProcess.current_phase)
          const cur = TIMELINE_PHASES[curIdx]
          const next = TIMELINE_PHASES[curIdx + 1]
          if (!cur || !next) return null
          const CurIcon = cur.icon
          const NextIcon = next.icon
          const pending = tasksForPhase(cur.id).filter(t => !isTaskDone(cur.id, t)).length
          return (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">Avançar fase</h2>
                  <button onClick={() => setShowAdvanceConfirm(false)}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: cur.color + '18' }}>
                      <CurIcon className="w-5 h-5" style={{ color: cur.color }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500">{cur.label}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: next.color }}>
                      <NextIcon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-gray-900">{next.label}</span>
                  </div>
                </div>
                {pending > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-center">
                    {pending} tarefa{pending > 1 ? 's' : ''} pendente{pending > 1 ? 's' : ''} na fase "{cur.label}" — dá pra avançar mesmo assim.
                  </p>
                )}
                <p className="text-sm text-gray-500 text-center mb-5">
                  A escola passará da fase <strong className="text-gray-700">{cur.label}</strong> para <strong className="text-gray-700">{next.label}</strong>.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowAdvanceConfirm(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                  <button onClick={confirmAdvancePhase} disabled={advancingPhase}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-white rounded-xl font-semibold text-sm disabled:opacity-60"
                    style={{ background: next.color }}>
                    {advancingPhase ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <>Avançar <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── Modal: Criar nova campanha ── */}
        {showNewCampaign && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Criar nova campanha</h2>
                <button onClick={() => setShowNewCampaign(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Ano *</label>
                  <input type="number" className={inp} value={newCampaignForm.year} onChange={e => setNewCampaignForm(f => ({ ...f, year: Number(e.target.value) }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Data início *</label>
                    <input type="date" className={inp} value={newCampaignForm.startDate} onChange={e => setNewCampaignForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Data fim *</label>
                    <input type="date" className={inp} value={newCampaignForm.endDate} onChange={e => setNewCampaignForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Meta de novos alunos</label>
                  <input type="number" className={inp} value={newCampaignForm.targetNewStudents} onChange={e => setNewCampaignForm(f => ({ ...f, targetNewStudents: e.target.value }))} placeholder="Ex: 50" />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowNewCampaign(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                <button onClick={handleCreateCampaign} disabled={savingCampaign} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                  {savingCampaign ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar campanha'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
