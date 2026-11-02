import { useState, useEffect, useRef, Fragment } from 'react'
import { submitDefaultTemplates } from '../../lib/submitDefaultTemplates'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, INSTITUTION_COLUMNS } from '../../lib/supabase'
import { fmtBRL, fmtDate, fmtDateTime, daysLate } from './escolas/format'
import MeetingModal from './escolas/MeetingModal'
import {
  BROADCAST_AUTO_RELEASE,
  CHARGE_TYPE_LABELS,
  CONTRACT_STATUS,
  DEFAULT_TASKS_CAMPAIGN,
  DEFAULT_TASKS_CONTRACT,
  DEFAULT_TASKS_IMPL,
  DEFAULT_TASKS_MONTHLY,
  DEFAULT_TASKS_TRAINING,
  PAYMENT_STATUS,
  STATUS_MAP,
  TIMELINE_PHASES,
  TimelinePhaseId,
  parsePeriodToMonth
} from './escolas/detailConsts'
import { inp, lbl } from './escolas/ui'
import DeleteCampaignModal from './escolas/DeleteCampaignModal'
import LimitedCampaignEditModal from './escolas/LimitedCampaignEditModal'
import CampaignFormModal from './escolas/CampaignFormModal'
import AdvancePhaseModal from './escolas/AdvancePhaseModal'
import BlockedRemovalModal from './escolas/BlockedRemovalModal'
import NewUserModal from './escolas/NewUserModal'
import NewChargeModal from './escolas/NewChargeModal'
import RejectChangeModal from './escolas/RejectChangeModal'
import DetailCampaignsTab from './escolas/DetailCampaignsTab'
import DetailFinancialTab from './escolas/DetailFinancialTab'
import DetailTemplatesTab from './escolas/DetailTemplatesTab'
import DetailWhatsAppTab from './escolas/DetailWhatsAppTab'
import DetailUsersTab from './escolas/DetailUsersTab'
import DetailSummaryTab from './escolas/DetailSummaryTab'
import { platformAdmin } from '../../lib/platformAdmin'
import { applyCampaignCycle, toReenrollFraction } from '../../lib/campaignApply'
import { useAuth } from '../../contexts/AuthContext'
import SuperAdminLayout from './SuperAdminLayout'
import { edgeFunctionErrorMessage } from '../../lib/edgeFunctionError'
import InstitutionBroadcastTab from './InstitutionBroadcastTab'
import InstitutionBaseModuleTab from './InstitutionBaseModuleTab'
import {
  loadSavedWhatsApp,
  resolveWabaForSave,
  auditWhatsAppSave,
  assertIsPhoneNumber,
  ownSchoolWaba,
  WABA_FIELD_LABEL,
  WABA_FIELD_PLACEHOLDER
} from '../../lib/whatsappSaveGuard'
import {
  Users,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Copy,
  RefreshCw,
  CreditCard,
  Lock,
  Unlock,
  Send,
  MessageCircle,
  X,
  Plus,
  ToggleLeft,
  ToggleRight,
  ArrowLeft,
  Megaphone,
  Wifi,
  WifiOff,
  Edit2,
  Save,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Zap,
  Ban,
  Video,
  Rocket,
  ArrowRight,
  UserX
} from 'lucide-react'

export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cancelledRef = useRef(false)
  // Mesmo campo usado em TopBar.tsx pra "isSuperAdmin" — estritamente
  // admin_geral, exclui consultor (que também acessa esta tela via
  // /super-admin/schools/:id, mas não pode ver o botão de exclusão real).
  const isSuperAdmin = user?.user_type === 'admin_geral'

  const [institution,       setInstitution]       = useState<any>(null)
  const [users,             setUsers]             = useState<any[]>([])
  const [payments,          setPayments]          = useState<any[]>([])
  const [contract,          setContract]          = useState<any>(null)
  const [onboardingProcess, setOnboardingProcess] = useState<any>(null)
  const [onboardingTasks,   setOnboardingTasks]   = useState<any[]>([])
  const [meetings,          setMeetings]          = useState<any[]>([])
  const [cycles,            setCycles]            = useState<any[]>([])
  const [changeRequests,    setChangeRequests]    = useState<any[]>([])
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [rejectingRequest,  setRejectingRequest]  = useState<any>(null)
  const [rejectReason,      setRejectReason]      = useState('')
  const [consultants,       setConsultants]       = useState<any[]>([])
  const [waUsage,           setWaUsage]           = useState({ count: 0, limit: 1000, initiated: 0, received: 0 })
  const [updatingLimit,    setUpdatingLimit]     = useState(false)
  const [newLimit,         setNewLimit]          = useState('')
  const [loading,           setLoading]           = useState(true)
  const [toast,             setToast]             = useState<{ msg: string; ok: boolean } | null>(null)
  // Vínculos desativados (user_institutions.active=false) desta instituição —
  // "excluir usuário" virou "remover da escola" (reversível). Ver diagnóstico
  // e migration 20260922000000_deactivate_user_institution_link.
  const [removedLinks,      setRemovedLinks]      = useState<{ user_id: string; full_name: string; email: string }[]>([])
  const [showRemoved,       setShowRemoved]       = useState(false)
  const [blockedRemoval,    setBlockedRemoval]    = useState<{ user: any; pendingLeads: number; pendingConversations: number } | null>(null)
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
  // Cadastro salvo no banco (não o formulário editável) — decide entre conectar e reconectar
  const [waSaved,  setWaSaved]  = useState<{ waba_id: string | null; phone_number_id: string | null; phone_number: string | null; display_name: string | null } | null>(null)
  const [savingWa, setSavingWa] = useState(false)
  // WABA da plataforma (platform_settings.wa_waba_id = conta de TESTE): nunca
  // é conta da escola. Lido só para reconhecer um cadastro errado com ela.
  const [platformWabaId, setPlatformWabaId] = useState<string | null>(null)
  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'wa_waba_id').maybeSingle()
      .then(({ data }) => setPlatformWabaId((data as { value?: string } | null)?.value ?? null))
  }, [])

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
  // Editar (draft/setup) reaproveita showNewCampaign/newCampaignForm — só muda
  // o destino do submit (insert vs update) conforme editingCampaignId.
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [archivingCampaignId, setArchivingCampaignId] = useState<string | null>(null)
  // Edição limitada (released/active/completed) — só meta e data fim, modal
  // separado e mais simples do que o de criação/edição de rascunho.
  const [limitedEditCampaign, setLimitedEditCampaign] = useState<any | null>(null)
  const [limitedEditForm, setLimitedEditForm] = useState({ endDate: '', targetNewStudents: '' })
  const [savingLimitedEdit, setSavingLimitedEdit] = useState(false)

  // Exclusão real de campanha (released/active/completed) — só admin_geral.
  // Modal de revisão manual: lista funnel_metrics/marketing_campaigns da
  // instituição, pré-marca por sugestão do parser de período, mas quem decide
  // o que é apagado/limpo é sempre o admin (ver handleConfirmDeleteCampaign).
  type DeleteReviewRow = Record<string, any> & { _parsed: { year: number; month: number } | null; _suggested: boolean; _selected: boolean }
  const [deleteReview, setDeleteReview] = useState<{
    cycle: any
    funnelRows: DeleteReviewRow[]
    campaignRows: DeleteReviewRow[]
    showAllFunnel: boolean
    showAllCampaign: boolean
  } | null>(null)
  const [reviewLoadingCycleId, setReviewLoadingCycleId] = useState<string | null>(null)
  const [confirmUnderstood, setConfirmUnderstood] = useState(false)
  const [executingCampaignDelete, setExecutingCampaignDelete] = useState(false)

  // Meeting modal
  const [meetingModal, setMeetingModal] = useState<{ phase: string; title: string } | null>(null)

  // Init process
  const [initingProcess, setInitingProcess] = useState(false)

  // Avançar fase — confirmação visual (substitui window.confirm)
  const [showAdvanceConfirm, setShowAdvanceConfirm] = useState(false)
  const [advancingPhase,     setAdvancingPhase]     = useState(false)

  // Abas da página da escola. ?tab=whatsapp abre direto na aba WhatsApp (links dos alertas do sino)
  type PageTab = 'resumo' | 'impl' | 'equipe' | 'whatsapp' | 'financeiro' | 'campanhas' | 'modulos'
  const [pageTab, setPageTab] = useState<PageTab>(
    () => (new URLSearchParams(window.location.search).get('tab') === 'whatsapp' ? 'whatsapp' : 'resumo'))
  const [waSub, setWaSub] = useState<'conexao' | 'templates'>('conexao')
  const [modSub, setModSub] = useState<'broadcast' | 'base'>('broadcast')

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
      const [instRes, usersRes, paymentsRes, contractRes, processRes, cycleRes, consultantsRes, waPhoneRes, changeRequestsRes, removedLinksRes] = await Promise.all([
        supabase.from('institutions').select(INSTITUTION_COLUMNS).eq('id', id).single(),
        supabase.from('users').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('onboarding_processes').select('*').eq('institution_id', id).maybeSingle(),
        supabase.from('campaign_cycles').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant').order('full_name'),
        supabase.from('whatsapp_phone_numbers').select('waba_id, phone_number_id, phone_number, display_name').eq('institution_id', id).maybeSingle(),
        supabase.from('campaign_change_requests').select('*').eq('institution_id', id).eq('status', 'pending').order('created_at', { ascending: false }),
        // RPC (não select+join direto): a RLS de `users` só libera a linha se
        // users.institution_id (cache da instituição ATIVA) bater com a desta
        // tela — um removido com outro vínculo ativo em outra escola já não
        // bate mais, e o join voltaria nome/e-mail nulos. Ver migration
        // 20260922000000_deactivate_user_institution_link.
        supabase.rpc('list_institution_removed_users', { p_institution_id: id }),
      ])

      if (cancelledRef.current) return

      console.log('[loadAll] contract:', contractRes.data, 'error:', contractRes.error)

      const inst = instRes.data
      setInstitution(inst)
      setUsers(usersRes.data || [])
      setPayments(paymentsRes.data || [])
      setContract(contractRes.data ?? null)
      setCycles(cycleRes.data || [])
      setChangeRequests(changeRequestsRes.data || [])
      setConsultants(consultantsRes.data || [])
      setRemovedLinks(((removedLinksRes as any)?.data || []).map((r: any) => ({
        user_id: r.user_id,
        full_name: r.full_name || '—',
        email: r.email || '',
      })))

      if (inst) {
        setEditForm({
          name: inst.name || '', cnpj: inst.cnpj || '',
          city: inst.city || '', state: inst.state || '',
          phone: inst.phone || '', email: inst.email || '',
          plan: inst.plan || 'escola', consultant_id: inst.consultant_id || '',
          monthly_value: String(inst.monthly_value || 550),
          implementation_value: String(inst.implementation_value || 550),
          nf_issue_timing: inst.nf_issue_timing || 'after_payment',
        })
        setWaForm({
          phone_id:     inst.whatsapp_phone_id || '',
          phone_number: inst.whatsapp_phone_number || '',
          display_name: inst.whatsapp_display_name || '',
          waba_id:      (waPhoneRes as any)?.data?.waba_id || '',
        })
        setWaSaved((waPhoneRes as any)?.data ?? null)
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
        nf_issue_timing: editForm.nf_issue_timing || 'after_payment',
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
    // Trava além do botão escondido: cobrança de campanha nunca é marcada à mão.
    if (payments.find(p => p.id === paymentId)?.payment_type === 'broadcast') { showToast(BROADCAST_AUTO_RELEASE, false); return }
    if (!confirm('Marcar como pago manualmente?')) return
    const { error } = await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', paymentId)
    if (error) { showToast(`Erro ao marcar pagamento: ${error.message}`, false); return }
    // Limpeza do sino de notificações: os alertas "Mensalidade em atraso"
    // (system_notifications, type='overdue_reminder') são gravados pelo cron
    // overdue-payment-reminders e nunca são resolvidos sozinhos — sem isso
    // ficavam acumulando no sino do gestor mesmo com o pagamento já
    // confirmado. O banner do dashboard (GestorHome.tsx) já não depende mais
    // dessas linhas (calcula direto de payments.status='overdue'); isto aqui
    // é só higiene do histórico de notificações.
    try {
      await supabase.from('system_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('institution_id', id).eq('type', 'overdue_reminder').is('read_at', null)
    } catch (e) { console.error('[handleMarkPaid] erro ao limpar notificações de atraso:', e) }
    if (isImpl) {
      const { error: instErr } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
      if (instErr) { showToast(`Pagamento confirmado, mas erro ao ativar escola: ${instErr.message}`, false); loadAll(); return }
      try { await generateMonthlyPayments(id!) } catch (e) { console.error('[handleMarkPaid] erro ao gerar mensalidades:', e) }
      try { await supabase.functions.invoke('send-email', { body: { type: 'new_institution', to: institution?.email, data: { institution_name: institution?.name, login_url: 'https://app.aionedu.com.br/login' } } }) } catch {}
    }
    showToast('Pagamento confirmado!')
    loadAll()
  }

  // Espelha generateMonthlyPayments do asaas-webhook — o fluxo manual (marcar
  // implantação como paga na UI) também precisa gerar as 12 mensalidades,
  // não só o webhook automático da Asaas.
  async function generateMonthlyPayments(institutionId: string) {
    const { data: inst } = await supabase.from('institutions').select('monthly_value, billing_due_day').eq('id', institutionId).single()
    if (!inst?.monthly_value) return
    const { data: existing } = await supabase.from('payments').select('id').eq('institution_id', institutionId).eq('payment_type', 'monthly').limit(1)
    if (existing && existing.length > 0) return
    const dueDay = inst.billing_due_day || 10
    const monthlyValue = Number(inst.monthly_value)
    const now = new Date()
    const records = []
    for (let i = 1; i <= 12; i++) {
      const dueDate = new Date(now.getFullYear(), now.getMonth() + i, dueDay)
      records.push({
        institution_id: institutionId, payment_type: 'monthly', amount: monthlyValue, status: 'pending',
        due_date: dueDate.toISOString().split('T')[0],
        description: `Mensalidade ${dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Fortaleza' })}`,
      })
    }
    await supabase.from('payments').insert(records)
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
          payment_type: chargeForm.payment_type,
          description: chargeForm.description || `${CHARGE_TYPE_LABELS[chargeForm.payment_type] || chargeForm.payment_type} — ${institution?.name}`,
          dueDate: chargeForm.due_date, billingType: chargeForm.billingType,
        }
      })
      if (error) throw new Error(await edgeFunctionErrorMessage(error, 'Erro ao gerar cobrança.'))
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

  // "Excluir" virou "remover desta escola": desativa o vínculo em
  // user_institutions (reversível) em vez de DELETE FROM users — que além de
  // sempre falhar por FK (leads/comissões/mensagens/etc referenciam
  // users(id) sem ON DELETE) apagaria o acesso do usuário a QUALQUER outra
  // instituição onde ele também tenha vínculo. A checagem de lead/conversa
  // em aberto e a própria desativação acontecem atomicamente no servidor —
  // ver deactivate_user_institution_link (migration 20260922000000). Também
  // corrige o bug anterior: o `error` do delete nunca era checado, então
  // "Usuário excluído." aparecia mesmo quando a exclusão falhava.
  const handleDeleteUser = async (targetUser: any) => {
    if (!confirm(`Remover "${targetUser.full_name}" desta escola?\n\nO acesso a esta instituição é desativado (reversível a qualquer momento). A conta e o acesso a outras escolas, se houver, não são afetados.`)) return
    const { data, error } = await supabase.rpc('deactivate_user_institution_link', {
      p_user_id: targetUser.id,
      p_institution_id: id,
    })
    if (error) { showToast(error.message || 'Erro ao remover usuário.', false); return }
    const result = Array.isArray(data) ? data[0] : data
    if (!result?.success) {
      setBlockedRemoval({ user: targetUser, pendingLeads: result?.pending_leads || 0, pendingConversations: result?.pending_conversations || 0 })
      return
    }
    showToast('Usuário removido desta escola.')
    loadAll()
  }

  const handleReactivateLink = async (userId: string) => {
    const { error } = await supabase
      .from('user_institutions')
      .update({ active: true })
      .eq('user_id', userId)
      .eq('institution_id', id)
    if (error) { showToast('Erro ao reativar usuário.', false); return }
    showToast('Usuário reativado nesta escola.')
    loadAll()
  }

  // Templates padrão no WABA da escola — roda no servidor (platform-admin),
  // que pula o WABA da Áion e os que já existem lá.
  const createDefaultTemplates = async (wabaId: string): Promise<void> => {
    if (!wabaId) return
    try {
      const r = await platformAdmin<{ created: string[]; errors: string[] }>('create_default_templates', { waba_id: wabaId })
      r.created.forEach(n => console.log(`[templates] criado ${n} no WABA ${wabaId}`))
      r.errors.forEach(e => console.error('[templates] erro ao criar:', e))
    } catch (e) {
      console.error('[templates] erro ao criar templates padrão:', e)
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

      // Busca na Meta pelo servidor (platform-admin) — sem token no navegador.
      const data = { data: (await platformAdmin<{ templates: any[] }>('list_templates', { waba_id: wabaId })).templates }
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
          // TEMP DIAG — remover depois de confirmar a causa do upsert que não
          // persiste (investigação whatsapp_templates 0 linhas / Santa Teresa).
          console.log('[DIAG templates] institution_id:', id, '| metaTemplates.length:', metaTemplates.length, '| nomes:', toUpsert.map(t => t.name))
          const { data: upsertData, error: upsertErr } = await supabase
            .from('whatsapp_templates')
            .upsert(toUpsert, { onConflict: 'institution_id,name' })
            .select('id, name')
          console.log('[DIAG templates] upsert result — data:', upsertData, '| error:', upsertErr)
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

      // Criação na Meta pelo servidor (platform-admin) — erro da Meta volta na exceção.
      await platformAdmin('create_template', {
        waba_id: wabaId,
        template: {
          name: newTemplate.name.toLowerCase().replace(/\s+/g, '_'),
          language: 'pt_BR',
          category: newTemplate.category,
          components: [{ type: 'BODY', text: newTemplate.body }],
        },
      })
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

  // ── "Templates Automáticos" (Super Admin → WhatsApp → Templates
  // Automáticos): submete TODOS os template_definitions já cadastrados pra
  // ESTA instituição de uma vez — útil pra escola nova que entrou depois dos
  // templates já existirem, sem precisar recriar um por um manualmente aqui.
  // Roda no servidor (api/whatsapp/template-definitions.ts), nunca client-side
  // direto pra Meta como handleAddTemplate acima — motivo em detalhe no
  // endpoint. ──
  const [syncingDefs, setSyncingDefs] = useState(false)
  const handleSyncTemplateDefinitions = async () => {
    setSyncingDefs(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')

      const res = await fetch('/api/whatsapp/template-definitions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ action: 'submit', institution_ids: [id] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Erro ao sincronizar templates')

      const results: any[] = data.results || []
      if (!results.length) {
        showToast('Nenhum template cadastrado em Templates Automáticos ainda, ou esta escola não tem WABA configurado.', false)
      } else {
        const failed = results.filter(r => r.status === 'rejected').length
        showToast(failed > 0
          ? `${results.length - failed} template(s) submetido(s), ${failed} com erro.`
          : `${results.length} template(s) submetido(s) com sucesso!`, failed === 0)
      }
      loadWaTemplates()
    } catch (e: any) {
      showToast(e.message || 'Erro ao sincronizar templates automáticos.', false)
    } finally {
      setSyncingDefs(false)
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

  // Conta PRÓPRIA da escola = a linha dela em whatsapp_phone_numbers com WABA
  // que não é a da plataforma/teste (whatsappOwnAccount.ts). Só com número
  // próprio a ficha mostra "Conectado" e "Reconectar". Caso Colégio Áion
  // 21/10/2026: cadastro manual gravou a conta de teste e o ID da conta no
  // lugar do número → institutions.whatsapp_connected = true sem conta real.
  const ownWaba = ownSchoolWaba(waSaved, platformWabaId)
  const hasOwnNumber = !!(waSaved?.phone_number_id && ownWaba)
  const waConnected = !!institution?.whatsapp_connected && hasOwnNumber
  const waInvalidRecord = !!institution?.whatsapp_connected && !hasOwnNumber

  const handleSaveWhatsApp = async () => {
    if (!id) return
    if (!waForm.phone_id) { showToast('Phone Number ID é obrigatório.', false); return }
    setSavingWa(true)
    try {
      // Teste do número na Meta pelo servidor (platform-admin) — o token global
      // não vem pro navegador. wa_waba_id não é segredo: continua lido direto.
      const { data: wabaSetting } = await supabase
        .from('platform_settings').select('key, value').eq('key', 'wa_waba_id')
      const settingsMap: Record<string, string> = {}
      wabaSetting?.forEach((r: any) => { settingsMap[r.key] = r.value })
      const testData: any = await platformAdmin('phone_info', { phone_id: waForm.phone_id })
      assertIsPhoneNumber(waForm.phone_id, testData)
      const AION_WABA_ID = settingsMap['wa_waba_id'] || ''
      const wabaToSubscribe = waForm.waba_id?.trim() || ''
      // Lido antes de gravar qualquer coisa: se o WABA for recusado, nada muda.
      const saved = await loadSavedWhatsApp(id)
      const effectiveWabaId = resolveWabaForSave(wabaToSubscribe, saved, AION_WABA_ID)

      await supabase.from('institutions').update({
        whatsapp_phone_id: waForm.phone_id,
        whatsapp_phone_number: waForm.phone_number || testData.display_phone_number || '',
        whatsapp_display_name: waForm.display_name || testData.verified_name || '',
        whatsapp_connected: true,
      }).eq('id', id)

      const waRow = {
        phone_number_id: waForm.phone_id,
        phone_number:    waForm.phone_number || testData.display_phone_number || '',
        display_name:    waForm.display_name || testData.verified_name || '',
        waba_id:         effectiveWabaId,
        is_active:       true,
        use_meta_api:    true,
      }
      const { error: waErr } = await supabase.from('whatsapp_phone_numbers')
        .upsert({ institution_id: id, ...waRow }, { onConflict: 'institution_id' })
      if (waErr) throw new Error(waErr.message)
      await auditWhatsAppSave(id, saved, waRow)

      if (wabaToSubscribe && wabaToSubscribe !== AION_WABA_ID) {
        try {
          const subscribeData = await platformAdmin<{ success: boolean; error: string | null }>('subscribe_app', { waba_id: wabaToSubscribe })
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
      await createDefaultTemplates(effectiveWabaId)
      await submitDefaultTemplates(id)

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
        target_new_students: Number(targetNewStudents) || 0, target_reenrollment_rate: toReenrollFraction(85),
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

  // Abre o mesmo modal de "Criar nova campanha" em modo edição, pré-preenchido
  // — só pra ciclos draft/setup (a escola ainda não viu essa campanha).
  const openEditCampaign = (c: any) => {
    setEditingCampaignId(c.id)
    setNewCampaignForm({
      year: c.year ?? new Date().getFullYear() + 1,
      startDate: c.start_date ?? '',
      endDate: c.end_date ?? '',
      targetNewStudents: c.target_new_students != null ? String(c.target_new_students) : '',
    })
    setShowNewCampaign(true)
  }

  // Salva a edição de um ciclo draft/setup (mesmo form do handleCreateCampaign,
  // mas update por id em vez de insert).
  const handleUpdateCampaign = async () => {
    if (!editingCampaignId) return
    const { year, startDate, endDate, targetNewStudents } = newCampaignForm
    if (!startDate || !endDate) { showToast('Preencha as datas de início e fim.', false); return }
    if (new Date(endDate) <= new Date(startDate)) { showToast('A data de fim precisa ser depois da de início.', false); return }
    setSavingCampaign(true)
    try {
      const { error } = await supabase.from('campaign_cycles').update({
        year, label: `Campanha ${year}`,
        start_date: startDate, end_date: endDate,
        campaign_start_month: new Date(startDate + 'T12:00:00').getMonth() + 1,
        target_new_students: Number(targetNewStudents) || 0,
      }).eq('id', editingCampaignId)
      if (error) throw error
      showToast(`Campanha ${year} atualizada!`)
      setShowNewCampaign(false)
      setEditingCampaignId(null)
      setNewCampaignForm({ year: new Date().getFullYear() + 1, startDate: '', endDate: '', targetNewStudents: '' })
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao atualizar campanha.', false)
    } finally {
      setSavingCampaign(false)
    }
  }

  // Exclusão física — só draft/setup, a escola nunca viu essa campanha, nada
  // depende dela ainda (ver investigação: campaign_cycles não tem FK filha).
  const handleDeleteCampaign = async (cycleId: string) => {
    const target = cycles.find(c => c.id === cycleId)
    if (!target) return
    if (!confirm(`Excluir a campanha "${target.label || target.year}"? Essa ação não pode ser desfeita.`)) return
    setDeletingCampaignId(cycleId)
    try {
      const { error } = await supabase.from('campaign_cycles').delete().eq('id', cycleId)
      if (error) throw error
      showToast(`Campanha ${target.year} excluída.`)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir campanha.', false)
    } finally {
      setDeletingCampaignId(null)
    }
  }

  // Arquivar — equivalente a "excluir" pra released/active/completed, mas sem
  // apagar a linha: a escola já pode ter dados de funil/matrículas atrelados
  // a esse período, então só some do que conta como campanha ativa/liberada.
  const handleArchiveCampaign = async (cycleId: string) => {
    const target = cycles.find(c => c.id === cycleId)
    if (!target) return
    if (!confirm(`Arquivar a campanha "${target.label || target.year}"? Ela deixa de aparecer como ativa/liberada para a escola.`)) return
    setArchivingCampaignId(cycleId)
    try {
      const { error } = await supabase.from('campaign_cycles').update({ status: 'archived' }).eq('id', cycleId)
      if (error) throw error
      showToast(`Campanha ${target.year} arquivada.`)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao arquivar campanha.', false)
    } finally {
      setArchivingCampaignId(null)
    }
  }

  // Edição limitada — só released/active/completed. Sem year/start_date de
  // propósito: mudar o início de uma campanha que a escola já está rodando
  // bagunçaria a leitura de funnel_metrics/monthly_reenrollments já gravados
  // contra o período antigo.
  const openLimitedEdit = (c: any) => {
    setLimitedEditCampaign(c)
    setLimitedEditForm({
      endDate: c.end_date ?? '',
      targetNewStudents: c.target_new_students != null ? String(c.target_new_students) : '',
    })
  }

  const handleSaveLimitedEdit = async () => {
    if (!limitedEditCampaign) return
    const { endDate, targetNewStudents } = limitedEditForm
    if (!endDate) { showToast('Preencha a data de fim.', false); return }
    if (limitedEditCampaign.start_date && new Date(endDate) <= new Date(limitedEditCampaign.start_date)) {
      showToast('A data de fim precisa ser depois da de início.', false); return
    }
    setSavingLimitedEdit(true)
    try {
      const { error } = await supabase.from('campaign_cycles').update({
        end_date: endDate,
        target_new_students: Number(targetNewStudents) || 0,
      }).eq('id', limitedEditCampaign.id)
      if (error) throw error
      showToast('Campanha atualizada!')
      setLimitedEditCampaign(null)
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao atualizar campanha.', false)
    } finally {
      setSavingLimitedEdit(false)
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

  // Aprova um pedido de ajuste pendente — aplica requested_changes
  // reaproveitando exatamente a mesma lógica de gravação que o gestor usa ao
  // aplicar um plano (applyCampaignCycle, src/lib/campaignApply.ts), sem
  // duplicar nada aqui.
  const handleApproveChangeRequest = async (req: any) => {
    setReviewingRequestId(req.id)
    try {
      const changes = req.requested_changes || {}
      await applyCampaignCycle({
        institutionId: id!,
        cycleData: changes,
        campaignStartMonthNum: changes.campaign_start_month || 1,
        schoolDataSnapshot: changes.school_data ?? {},
        erpFiles: changes.erp_files ?? [],
        currentStudents: changes.base_students ?? 0,
        cycleId: req.campaign_cycle_id,
      })
      const { error } = await supabase.from('campaign_change_requests').update({
        status: 'approved', reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
      }).eq('id', req.id)
      if (error) throw error

      await supabase.from('system_notifications').insert({
        institution_id: id, type: 'milestone', severity: 'success',
        title: 'Ajuste de campanha aprovado!',
        message: 'O ajuste que você solicitou foi aprovado pelo administrador e já está em vigor.',
      })

      showToast('Ajuste aprovado e aplicado!')
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao aprovar o ajuste.', false)
    } finally {
      setReviewingRequestId(null)
    }
  }

  // Rejeita um pedido pendente — só marca status/motivo, nada é aplicado em
  // campaign_cycles nem nas tabelas de métrica.
  const handleRejectChangeRequest = async () => {
    if (!rejectingRequest) return
    setReviewingRequestId(rejectingRequest.id)
    try {
      const { error } = await supabase.from('campaign_change_requests').update({
        status: 'rejected', reviewed_by: user?.id || null, reviewed_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim() || null,
      }).eq('id', rejectingRequest.id)
      if (error) throw error

      await supabase.from('system_notifications').insert({
        institution_id: id, type: 'alert', severity: 'warning',
        title: 'Ajuste de campanha rejeitado',
        message: rejectReason.trim() || 'O ajuste solicitado foi rejeitado pelo administrador.',
      })

      showToast('Solicitação rejeitada.')
      setRejectingRequest(null); setRejectReason('')
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao rejeitar a solicitação.', false)
    } finally {
      setReviewingRequestId(null)
    }
  }

  // Abre o modal de revisão pra exclusão REAL de uma campanha já liberada
  // (released/active/completed) — só chamado a partir do botão que só
  // isSuperAdmin vê. Busca TODAS as linhas de funnel_metrics/marketing_campaigns
  // da instituição (tabelas pequenas, sem vínculo direto por campaign_cycle_id
  // — ver investigação) e pré-marca como sugeridas as que o parser de período
  // (parsePeriodToMonth) reconhece como caindo dentro de [start_date, end_date]
  // do ciclo. Quem decide de fato o que é apagado é o admin, no modal.
  const openDeleteCampaignReview = async (cycle: any) => {
    if (!id) return
    setReviewLoadingCycleId(cycle.id)
    setConfirmUnderstood(false)
    try {
      const [funnelRes, campaignRes] = await Promise.all([
        supabase.from('funnel_metrics').select('*').eq('institution_id', id).order('created_at'),
        supabase.from('marketing_campaigns').select('*').eq('institution_id', id).order('created_at'),
      ])
      if (funnelRes.error) throw funnelRes.error
      if (campaignRes.error) throw campaignRes.error

      const cycleStart = new Date(cycle.start_date + 'T12:00:00')
      const cycleEnd   = new Date(cycle.end_date + 'T12:00:00')
      const inCycle = (p: { year: number; month: number } | null) => {
        if (!p) return false
        const d = new Date(p.year, p.month - 1, 15)
        return d >= cycleStart && d <= cycleEnd
      }

      const funnelRows: DeleteReviewRow[] = (funnelRes.data || []).map((r: any) => {
        const parsed = parsePeriodToMonth(r.period)
        const suggested = inCycle(parsed)
        return { ...r, _parsed: parsed, _suggested: suggested, _selected: suggested }
      })
      const campaignRows: DeleteReviewRow[] = (campaignRes.data || []).map((r: any) => {
        const parsed = parsePeriodToMonth(r.month_year)
        const suggested = inCycle(parsed)
        return { ...r, _parsed: parsed, _suggested: suggested, _selected: suggested }
      })

      setDeleteReview({ cycle, funnelRows, campaignRows, showAllFunnel: false, showAllCampaign: false })
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar dados da campanha.', false)
    } finally {
      setReviewLoadingCycleId(null)
    }
  }

  const toggleReviewRow = (table: 'funnelRows' | 'campaignRows', rowId: string) => {
    setDeleteReview(prev => prev && {
      ...prev,
      [table]: prev[table].map(r => r.id === rowId ? { ...r, _selected: !r._selected } : r),
    })
  }

  const closeDeleteReview = () => {
    setDeleteReview(null)
    setConfirmUnderstood(false)
  }

  // Executa a exclusão — replica manualmente o que foi feito via SQL hoje
  // pro Ágape: linha sem NENHUM dado real (registrations/schedules/visits/
  // enrollments todos zero, ou investment/leads_generated zero) é apagada
  // inteira; linha com dado real só tem as colunas de META zeradas,
  // preservando o real. Por fim apaga o ciclo — leads.campaign_cycle_id vira
  // NULL sozinho via ON DELETE SET NULL (única FK que referencia
  // campaign_cycles, confirmado no banco), nenhum lead é tocado.
  const handleConfirmDeleteCampaign = async () => {
    if (!deleteReview) return
    const { cycle, funnelRows, campaignRows } = deleteReview
    setExecutingCampaignDelete(true)
    try {
      for (const r of funnelRows.filter(r => r._selected)) {
        const hasReal = (r.registrations || 0) > 0 || (r.schedules || 0) > 0 || (r.visits || 0) > 0 || (r.enrollments || 0) > 0
        const { error } = hasReal
          ? await supabase.from('funnel_metrics').update({
              registrations_target: null, schedules_target: null, visits_target: null, enrollments_target: null,
              annual_registrations_target: null, annual_schedules_target: null, annual_visits_target: null, annual_enrollments_target: null,
              new_students_target: null, returning_students_target: null,
            }).eq('id', r.id)
          : await supabase.from('funnel_metrics').delete().eq('id', r.id)
        if (error) throw error
      }

      for (const r of campaignRows.filter(r => r._selected)) {
        const hasReal = (r.investment || 0) > 0 || (r.leads_generated || 0) > 0
        const { error } = hasReal
          ? await supabase.from('marketing_campaigns').update({ cpa_target: null }).eq('id', r.id)
          : await supabase.from('marketing_campaigns').delete().eq('id', r.id)
        if (error) throw error
      }

      const { error: cycleErr } = await supabase.from('campaign_cycles').delete().eq('id', cycle.id)
      if (cycleErr) throw cycleErr

      showToast(`Campanha ${cycle.label || cycle.year} excluída definitivamente.`)
      closeDeleteReview()
      loadAll()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao excluir campanha.', false)
    } finally {
      setExecutingCampaignDelete(false)
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
  const manageTabs = institution?.plan_status === 'active' || institution?.plan_status === 'pending_payment'
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
        <div className="aion-band flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl border border-gray-200">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h1 className="aion-band-title">{institution.name}</h1>
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
              <div>
                <label className={lbl}>Emissão de Nota Fiscal</label>
                <select className={inp} value={editForm.nf_issue_timing} onChange={e => setEditForm((p: any) => ({ ...p, nf_issue_timing: e.target.value }))}>
                  <option value="after_payment">Depois do pagamento</option>
                  <option value="before_payment">Antes do pagamento</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">Quando gerar a linha de controle de nota (aba Financeiro → Nota Fiscal) pra cobranças desta escola.</p>
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

        {/* ── Barra de abas ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-3 pt-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {([
              { id: 'resumo', label: 'Resumo', show: true },
              { id: 'impl', label: 'Implantação', show: true },
              { id: 'equipe', label: 'Equipe', show: manageTabs },
              { id: 'whatsapp', label: 'WhatsApp', show: manageTabs },
              { id: 'financeiro', label: 'Financeiro', show: manageTabs },
              { id: 'campanhas', label: 'Campanhas', show: manageTabs },
              { id: 'modulos', label: 'Módulos', show: manageTabs },
            ] as const).filter(t => t.show).map(t => (
              <button key={t.id}
                onClick={() => { setPageTab(t.id); if (t.id === 'whatsapp' && waSub === 'templates') loadWaTemplates() }}
                className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 whitespace-nowrap ${
                  pageTab === t.id ? 'text-cyan-700 border-cyan-500 bg-cyan-50' : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {pageTab === 'resumo' && <DetailSummaryTab institution={institution} users={users} payments={payments} cycles={cycles} changeRequests={changeRequests} contract={contract} contractSt={contractSt} onboardingProcess={onboardingProcess} onboardingTasks={onboardingTasks} currentPhaseIdx={currentPhaseIdx} waConnected={waConnected} waSaved={waSaved} waUsage={waUsage} consultantName={consultants.find(c => c.id === institution.consultant_id)?.full_name || ''} goTab={t => setPageTab(t as PageTab)} />}

        {pageTab === 'impl' && institution.plan === 'gratuito' && !onboardingProcess && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <Rocket className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-800">Sem implantação</p>
            <p className="text-sm text-gray-500 mt-1">Esta escola é gratuita e não passa pela jornada de implantação.</p>
          </div>
        )}

        {pageTab === 'impl' && !(institution.plan === 'gratuito' && !onboardingProcess) && (
        <>
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
                                onClick={() => { setPageTab('campanhas'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
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
        </>
        )}

        {/* ── Gestão: cada assunto numa aba só ── */}
        {manageTabs && pageTab !== 'resumo' && pageTab !== 'impl' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6">
              {pageTab === 'equipe' && <DetailUsersTab handleDeleteUser={handleDeleteUser} handleReactivateLink={handleReactivateLink} handleToggleUser={handleToggleUser} removedLinks={removedLinks} setShowNewUser={setShowNewUser} setShowRemoved={setShowRemoved} showRemoved={showRemoved} users={users} />}
              {pageTab === 'whatsapp' && (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    {([{ id: 'conexao', label: 'Conexão' }, { id: 'templates', label: 'Templates' }] as const).map(t => (
                      <button key={t.id} onClick={() => { setWaSub(t.id); if (t.id === 'templates') loadWaTemplates() }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${waSub === t.id ? 'bg-cyan-50 text-cyan-700 border-cyan-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{t.label}</button>
                    ))}
                  </div>
                  {waSub === 'conexao' && <DetailWhatsAppTab handleSaveWhatsApp={handleSaveWhatsApp} handleUpdateLimit={handleUpdateLimit} hasOwnNumber={hasOwnNumber} id={id} institution={institution} isSuperAdmin={isSuperAdmin} loadAll={loadAll} newLimit={newLimit} ownWaba={ownWaba} savingWa={savingWa} setChargeForm={setChargeForm} setNewLimit={setNewLimit} setShowNewCharge={setShowNewCharge} setWaForm={setWaForm} updatingLimit={updatingLimit} usagePct={usagePct} waConnected={waConnected} waForm={waForm} waInvalidRecord={waInvalidRecord} waSaved={waSaved} waUsage={waUsage} />}
                  {waSub === 'templates' && <DetailTemplatesTab handleAddTemplate={handleAddTemplate} handleSyncTemplateDefinitions={handleSyncTemplateDefinitions} loadWaTemplates={loadWaTemplates} loadingTemplates={loadingTemplates} newTemplate={newTemplate} sendingNewTemplate={sendingNewTemplate} setNewTemplate={setNewTemplate} setShowAddTemplate={setShowAddTemplate} showAddTemplate={showAddTemplate} syncingDefs={syncingDefs} waTemplates={waTemplates} />}
                </div>
              )}
              {pageTab === 'financeiro' && <DetailFinancialTab copied={copied} copyToClipboard={copyToClipboard} handleCancelPayment={handleCancelPayment} handleGenerateLink={handleGenerateLink} handleMarkPaid={handleMarkPaid} handleResendPaymentEmail={handleResendPaymentEmail} handleSendWhatsAppPayment={handleSendWhatsAppPayment} payments={payments} setShowNewCharge={setShowNewCharge} />}
              {pageTab === 'modulos' && id && (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    {([{ id: 'broadcast', label: 'Transmissões' }, { id: 'base', label: 'Base de alunos' }] as const).map(t => (
                      <button key={t.id} onClick={() => setModSub(t.id)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${modSub === t.id ? 'bg-cyan-50 text-cyan-700 border-cyan-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{t.label}</button>
                    ))}
                  </div>
                  {modSub === 'broadcast' && <InstitutionBroadcastTab institutionId={id} />}
                  {modSub === 'base' && <InstitutionBaseModuleTab institutionId={id} />}
                </div>
              )}
              {pageTab === 'campanhas' && <DetailCampaignsTab archivingCampaignId={archivingCampaignId} changeRequests={changeRequests} cycles={cycles} deletingCampaignId={deletingCampaignId} handleApproveChangeRequest={handleApproveChangeRequest} handleArchiveCampaign={handleArchiveCampaign} handleDeleteCampaign={handleDeleteCampaign} handleReleaseCampaign={handleReleaseCampaign} id={id} isSuperAdmin={isSuperAdmin} openDeleteCampaignReview={openDeleteCampaignReview} openEditCampaign={openEditCampaign} openLimitedEdit={openLimitedEdit} releasingCycleId={releasingCycleId} reviewLoadingCycleId={reviewLoadingCycleId} reviewingRequestId={reviewingRequestId} setEditingCampaignId={setEditingCampaignId} setNewCampaignForm={setNewCampaignForm} setRejectReason={setRejectReason} setRejectingRequest={setRejectingRequest} setShowNewCampaign={setShowNewCampaign} users={users} />}
            </div>
          </div>
        )}

        {/* ── Modal: Rejeitar ajuste de campanha ── */}
        {rejectingRequest && <RejectChangeModal handleRejectChangeRequest={handleRejectChangeRequest} rejectReason={rejectReason} rejectingRequest={rejectingRequest} reviewingRequestId={reviewingRequestId} setRejectReason={setRejectReason} setRejectingRequest={setRejectingRequest} />}

        {/* ── Modal: Nova cobrança ── */}
        {showNewCharge && <NewChargeModal chargeForm={chargeForm} handleNewCharge={handleNewCharge} savingCharge={savingCharge} setChargeForm={setChargeForm} setShowNewCharge={setShowNewCharge} />}

        {/* ── Modal: Novo usuário ── */}
        {showNewUser && <NewUserModal handleCreateUser={handleCreateUser} newUser={newUser} savingUser={savingUser} setNewUser={setNewUser} setShowNewUser={setShowNewUser} setShowPw={setShowPw} showPw={showPw} user={user} />}

        {/* ── Modal: remoção de usuário bloqueada por lead/conversa em aberto ── */}
        {blockedRemoval && <BlockedRemovalModal blockedRemoval={blockedRemoval} setBlockedRemoval={setBlockedRemoval} />}

        {/* ── Modal: Confirmar avanço de fase ── */}
        {showAdvanceConfirm && onboardingProcess && <AdvancePhaseModal advancingPhase={advancingPhase} confirmAdvancePhase={confirmAdvancePhase} isTaskDone={isTaskDone} onboardingProcess={onboardingProcess} setShowAdvanceConfirm={setShowAdvanceConfirm} tasksForPhase={tasksForPhase} />}

        {/* ── Modal: Criar/editar campanha (draft/setup) ── */}
        {showNewCampaign && <CampaignFormModal editingCampaignId={editingCampaignId} handleCreateCampaign={handleCreateCampaign} handleUpdateCampaign={handleUpdateCampaign} newCampaignForm={newCampaignForm} savingCampaign={savingCampaign} setEditingCampaignId={setEditingCampaignId} setNewCampaignForm={setNewCampaignForm} setShowNewCampaign={setShowNewCampaign} />}

        {/* ── Modal: Editar campanha (limitado — released/active/completed) ── */}
        {limitedEditCampaign && <LimitedCampaignEditModal handleSaveLimitedEdit={handleSaveLimitedEdit} limitedEditCampaign={limitedEditCampaign} limitedEditForm={limitedEditForm} savingLimitedEdit={savingLimitedEdit} setLimitedEditCampaign={setLimitedEditCampaign} setLimitedEditForm={setLimitedEditForm} />}

        {/* ── Modal: Excluir campanha definitivamente (revisão manual, só admin_geral) ── */}
        {deleteReview && <DeleteCampaignModal closeDeleteReview={closeDeleteReview} confirmUnderstood={confirmUnderstood} deleteReview={deleteReview} executingCampaignDelete={executingCampaignDelete} handleConfirmDeleteCampaign={handleConfirmDeleteCampaign} setConfirmUnderstood={setConfirmUnderstood} setDeleteReview={setDeleteReview} toggleReviewRow={toggleReviewRow} />}

      </div>
    </SuperAdminLayout>
  )
}
