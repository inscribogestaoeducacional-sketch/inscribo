import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Users, DollarSign, FileText, CheckCircle2,
  Clock, AlertTriangle, ExternalLink, Copy, RefreshCw,
  CreditCard, Lock, Unlock, Send, MessageCircle, X,
  Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  ArrowLeft, AlertCircle, Megaphone, Bell, Wifi, WifiOff,
  Edit2, Save, Phone, Mail, MapPin, Calendar, ChevronRight,
  Zap, BookOpen, TrendingUp, Star, Ban
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white transition-all'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
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

const TABS = [
  { id: 'info',       label: 'Visão Geral', icon: Building2    },
  { id: 'contract',   label: 'Contrato',    icon: FileText     },
  { id: 'financial',  label: 'Financeiro',  icon: DollarSign   },
  { id: 'onboarding', label: 'Onboarding',  icon: Zap          },
  { id: 'whatsapp',   label: 'WhatsApp',    icon: MessageCircle },
  { id: 'users',      label: 'Usuários',    icon: Users        },
]

const months = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
]

export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const cancelledRef = useRef(false)

  const [institution, setInstitution] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [contract, setContract] = useState<any>(null)
  const [notifications, setNotifications] = useState<any[]>([])
  const [onboardingProcess, setOnboardingProcess] = useState<any>(null)
  const [onboardingTasks, setOnboardingTasks] = useState<any[]>([])
  const [cycle, setCycle] = useState<any>(null)
  const [consultants, setConsultants] = useState<any[]>([])
  const [waUsage, setWaUsage] = useState({ count: 0, limit: 1000 })
  const [loading, setLoading] = useState(true)
  const [loadingContract, setLoadingContract] = useState(true)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [tab, setTab] = useState(() => localStorage.getItem(`tab-inst-${id}`) || 'info')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Edit info
  const [editingInfo, setEditingInfo] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [savingInfo, setSavingInfo] = useState(false)

  // New user modal
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'admin' })
  const [showPw, setShowPw] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  // New charge modal
  const [showNewCharge, setShowNewCharge] = useState(false)
  const [chargeForm, setChargeForm] = useState({
    amount: '', payment_type: 'monthly', due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    billingType: 'PIX', description: ''
  })
  const [savingCharge, setSavingCharge] = useState(false)

  // Notification form
  const [notifForm, setNotifForm] = useState({ title: '', message: '', type: 'info' })
  const [sendingNotif, setSendingNotif] = useState(false)

  // WhatsApp form
  const [waForm, setWaForm] = useState({ phone_id: '', token: '', phone_number: '', display_name: '' })
  const [savingWa, setSavingWa] = useState(false)

  // Campaign
  const [campaignForm, setCampaignForm] = useState({ startMonth: 8, startDate: '', endDate: '' })
  const [releasingCampaign, setReleasingCampaign] = useState(false)

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const handleTabChange = (newTab: string) => {
    setTab(newTab)
    if (id) localStorage.setItem(`tab-inst-${id}`, newTab)
  }

  useEffect(() => {
    console.log('[InstitutionDetails] useEffect id=', id)
    if (!id) return
    cancelledRef.current = false
    loadAll()
    return () => { cancelledRef.current = true }
  }, [id])

  const loadContractData = async () => {
    if (!id) return
    setLoadingContract(true)
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('institution_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    console.log('[loadContractData] data=', data, 'error=', error)
    setContract(data)
    setLoadingContract(false)
  }

  const loadAll = async () => {
    if (!id) return
    console.log('[InstitutionDetails] loadAll start, id=', id)
    setLoading(true)
    try {
      const [instRes, usersRes, paymentsRes, contractRes, notifsRes, processRes, cycleRes, consultantsRes] = await Promise.all([
        supabase.from('institutions').select('*').eq('id', id).single(),
        supabase.from('users').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('system_notifications').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('onboarding_processes').select('*').eq('institution_id', id).maybeSingle(),
        supabase.from('campaign_cycles').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
      ])

      if (cancelledRef.current) return

      console.log('[InstitutionDetails] payments=', paymentsRes.data, 'error=', paymentsRes.error)
      console.log('[InstitutionDetails] contract=', contractRes.data, 'error=', contractRes.error)
      console.log('[InstitutionDetails] institution=', instRes.data, 'error=', instRes.error)

      const inst = instRes.data
      setInstitution(inst)
      setUsers(usersRes.data || [])
      setPayments(paymentsRes.data || [])
      setLoadingPayments(false)
      setContract(contractRes.data)
      setLoadingContract(false)
      setNotifications(notifsRes.data || [])
      setCycle(cycleRes.data)
      setConsultants(consultantsRes.data || [])

      if (inst) {
        setEditForm({
          name: inst.name || '',
          cnpj: inst.cnpj || '',
          city: inst.city || '',
          state: inst.state || '',
          phone: inst.phone || '',
          email: inst.email || '',
          plan: inst.plan || 'escola',
          consultant_id: inst.consultant_id || '',
          monthly_value: String(inst.monthly_value || 550),
          implementation_value: String(inst.implementation_value || 550),
        })
        setWaForm({
          phone_id: inst.whatsapp_phone_id || '',
          token: inst.whatsapp_token || '',
          phone_number: inst.whatsapp_phone_number || '',
          display_name: inst.whatsapp_display_name || '',
        })
      }

      if (processRes.data) {
        setOnboardingProcess(processRes.data)
        const { data: tasks } = await supabase
          .from('onboarding_tasks')
          .select('*')
          .eq('process_id', processRes.data.id)
          .order('sort_order')
        if (!cancelledRef.current) setOnboardingTasks(tasks || [])
      }

      // WhatsApp usage — contagem via whatsapp_conversations
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const { count: waCount } = await supabase
        .from('whatsapp_conversations')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', id)
        .gte('created_at', monthStart.toISOString())
      if (!cancelledRef.current && waCount !== null) setWaUsage({ count: waCount, limit: 1000 })

    } catch (e: any) {
      if (!cancelledRef.current) showToast('Erro ao carregar dados.', false)
    }
    if (!cancelledRef.current) setLoading(false)
  }

  // ── Ações ─────────────────────────────────────────────

  const handleSaveInfo = async () => {
    setSavingInfo(true)
    try {
      const { error } = await supabase.from('institutions').update({
        name: editForm.name,
        cnpj: editForm.cnpj || null,
        city: editForm.city,
        state: editForm.state,
        phone: editForm.phone || null,
        email: editForm.email,
        plan: editForm.plan,
        consultant_id: editForm.consultant_id || null,
        monthly_value: Number(editForm.monthly_value),
        implementation_value: Number(editForm.implementation_value),
      }).eq('id', id)
      if (error) throw error
      showToast('Dados atualizados!')
      setEditingInfo(false)
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar.', false)
    } finally {
      setSavingInfo(false)
    }
  }

  const handleSuspend = async () => {
    if (!confirm(`Suspender acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'suspended',
          to: institution?.email,
          data: { institution_name: institution?.name, dias_atraso: '0' }
        }
      })
    } catch {}
    showToast('Escola suspensa.')
    loadAll()
  }

  const handleReactivate = async () => {
    if (!confirm(`Reativar acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'reactivated',
          to: institution?.email,
          data: { institution_name: institution?.name, link_acesso: 'https://app.aionedu.com.br/login' }
        }
      })
    } catch {}
    showToast('Escola reativada!')
    loadAll()
  }

  const handleResendContract = async () => {
    if (!contract?.signer_email) { showToast('Contrato sem signatário definido.', false); return }
    try {
      const { data, error } = await supabase.functions.invoke('autentique', {
        body: {
          institution_id: id,
          contract_id: contract.id,
          school_name: institution?.name,
          signer_name: contract.signer_name,
          signer_email: contract.signer_email,
          monthly_value: institution?.monthly_value,
          implementation_value: institution?.implementation_value,
        }
      })
      if (error) throw error
      showToast('Contrato reenviado via Autentique!')
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao reenviar.', false)
    }
  }

  const handleMarkContractSigned = async () => {
    if (!confirm('Marcar contrato como assinado manualmente?')) return
    await supabase.from('contracts').update({ status: 'signed' }).eq('id', contract.id)
    await supabase.from('institutions').update({ plan_status: 'pending_payment' }).eq('id', id)
    showToast('Contrato marcado como assinado!')
    loadAll()
  }

  const handleNewCharge = async () => {
    if (!chargeForm.amount) { showToast('Informe o valor.', false); return }
    setSavingCharge(true)
    try {
      const { data, error } = await supabase.functions.invoke('asaas-create-charge', {
        body: {
          institution_id: id,
          name: institution?.name,
          email: institution?.email,
          cpfCnpj: institution?.cnpj?.replace(/\D/g, '') || '',
          value: Number(chargeForm.amount),
          description: chargeForm.description || `${chargeForm.payment_type} — ${institution?.name}`,
          dueDate: chargeForm.due_date,
          billingType: chargeForm.billingType,
        }
      })
      if (error) throw error
      showToast('Cobrança gerada!')
      setShowNewCharge(false)
      setChargeForm({ amount: '', payment_type: 'monthly', due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], billingType: 'PIX', description: '' })
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao gerar cobrança.', false)
    } finally {
      setSavingCharge(false)
    }
  }

  const handleMarkPaid = async (paymentId: string, isImpl: boolean) => {
    if (!confirm('Marcar como pago manualmente?')) return
    await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', paymentId)
    if (isImpl) {
      await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'new_institution',
            to: institution?.email,
            data: { institution_name: institution?.name, login_url: 'https://app.aionedu.com.br/login' }
          }
        })
      } catch {}
    }
    showToast('Pagamento confirmado!')
    loadAll()
  }

  const handleCancelPayment = async (paymentId: string, asaasId?: string) => {
    if (!confirm('Cancelar esta cobrança?')) return
    if (asaasId) {
      try { await supabase.functions.invoke('asaas-cancel-charge', { body: { payment_id: asaasId } }) } catch {}
    }
    await supabase.from('payments').update({ status: 'cancelled' }).eq('id', paymentId)
    showToast('Cobrança cancelada.')
    loadAll()
  }

  const handleResendPaymentEmail = async (payment: any) => {
    const isMonthly = payment.payment_type === 'monthly'
    try {
      await supabase.functions.invoke('send-email', {
        body: {
          type: isMonthly ? 'monthly_payment' : 'payment_link',
          to: institution?.email,
          data: {
            institution_name: institution?.name,
            value: fmtBRL(payment.amount),
            due_date: fmtDate(payment.due_date),
            description: payment.description || (isMonthly ? 'Mensalidade' : 'Taxa de implantação'),
            billing_type: 'PIX/Boleto',
            payment_link: payment.asaas_charge_url || '',
          }
        }
      })
      showToast('Email enviado!')
    } catch { showToast('Erro ao enviar email.', false) }
  }

  const handleGenerateLink = async (paymentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('asaas-generate-monthly', {
        body: { payment_id: paymentId }
      })
      if (error) throw error
      if (data?.ok && data?.generated > 0) {
        showToast('Link gerado com sucesso!')
        await loadAll()
      } else {
        showToast('Erro ao gerar link: ' + (data?.error || 'Tente novamente'), false)
      }
    } catch { showToast('Erro ao gerar link.', false) }
  }

  const handleSendWhatsAppPayment = (payment: any) => {
    const phone = institution?.phone?.replace(/\D/g, '')
    if (!phone) { showToast('Escola sem telefone cadastrado.', false); return }
    const msg = encodeURIComponent(`Olá! Segue o link de pagamento:\n\n${payment.asaas_charge_url}`)
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
  }

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.full_name || newUser.password.length < 8) {
      showToast('Preencha todos os campos. Senha mínimo 8 caracteres.', false)
      return
    }
    setSavingUser(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: newUser.email.trim().toLowerCase(),
          password: newUser.password,
          full_name: newUser.full_name.trim(),
          role: newUser.role,
          user_type: 'school_user',
          institution_id: id,
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) throw new Error(data?.error || 'Erro ao criar usuário')
      showToast('Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'admin' })
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro.', false)
    } finally {
      setSavingUser(false)
    }
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

  const handleSendNotification = async () => {
    if (!notifForm.title || !notifForm.message) { showToast('Preencha título e mensagem.', false); return }
    setSendingNotif(true)
    try {
      await supabase.from('system_notifications').insert({
        institution_id: id,
        title: notifForm.title,
        message: notifForm.message,
        type: notifForm.type,
        read: false,
      })
      showToast('Notificação enviada!')
      setNotifForm({ title: '', message: '', type: 'info' })
      loadAll()
    } catch { showToast('Erro ao enviar.', false) }
    finally { setSendingNotif(false) }
  }

  const handleSaveWhatsApp = async () => {
    if (!waForm.phone_id || !waForm.token) { showToast('Phone ID e Token são obrigatórios.', false); return }
    setSavingWa(true)
    try {
      const testRes = await fetch(`https://graph.facebook.com/v19.0/${waForm.phone_id}?fields=display_phone_number,verified_name`, {
        headers: { Authorization: `Bearer ${waForm.token}` }
      })
      if (!testRes.ok) throw new Error('Token ou Phone ID inválido')
      const testData = await testRes.json()
      await supabase.from('institutions').update({
        whatsapp_phone_id: waForm.phone_id,
        whatsapp_token: waForm.token,
        whatsapp_phone_number: waForm.phone_number || testData.display_phone_number || '',
        whatsapp_display_name: waForm.display_name || testData.verified_name || '',
        whatsapp_connected: true,
      }).eq('id', id)
      showToast('WhatsApp configurado e verificado!')
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao verificar.', false)
    } finally {
      setSavingWa(false)
    }
  }

  const handleReleaseCampaign = async () => {
    setReleasingCampaign(true)
    try {
      const campaignYear = new Date().getFullYear() + 1
      const sd = campaignForm.startDate || `${new Date().getFullYear()}-${String(campaignForm.startMonth).padStart(2, '0')}-01`
      const ed = campaignForm.endDate || `${campaignYear}-02-28`

      if (cycle) {
        await supabase.from('campaign_cycles').update({
          status: 'released', campaign_start_month: campaignForm.startMonth, start_date: sd, end_date: ed,
        }).eq('id', cycle.id)
      } else {
        await supabase.from('campaign_cycles').insert({
          institution_id: id, status: 'released',
          campaign_start_month: campaignForm.startMonth, year: campaignYear,
          label: `Campanha ${campaignYear}`, start_date: sd, end_date: ed,
          target_new_students: 0, target_reenrollment_rate: 85,
          base_students: 0, monthly_targets: [], market_data: {},
          historical_input: [], generation_mode: 'benchmark',
          ai_reasoning: '', realism_score: 'realistic',
        })
      }

      await supabase.from('system_notifications').insert({
        institution_id: id,
        title: `Campanha ${campaignYear} liberada! 🎉`,
        message: `Sua campanha de matrículas foi liberada. Acesse o painel para configurar suas metas.`,
        type: 'info', read: false,
      })

      showToast(`Campanha ${campaignYear} liberada!`)
      loadAll()
    } catch (e: any) {
      showToast(e.message || 'Erro ao liberar campanha.', false)
    } finally {
      setReleasingCampaign(false)
    }
  }

  const handleToggleTask = async (taskId: string, done: boolean) => {
    await supabase.from('onboarding_tasks').update({ done, done_at: done ? new Date().toISOString() : null }).eq('id', taskId)
    setOnboardingTasks(prev => prev.map(t => t.id === taskId ? { ...t, done, done_at: done ? new Date().toISOString() : null } : t))
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
  const implPayment = payments.find(p => p.payment_type === 'implementation')
  const monthlyPayments = payments.filter(p => p.payment_type === 'monthly')
  const extraPayments = payments.filter(p => p.payment_type === 'extra_conversations')
  const contractSt = contract ? (CONTRACT_STATUS[contract.status] || CONTRACT_STATUS.draft) : null
  const usagePct = Math.min(100, Math.round((waUsage.count / waUsage.limit) * 100))

  // Onboarding progress
  const totalTasks = onboardingTasks.length
  const doneTasks = onboardingTasks.filter(t => t.done).length
  const progress = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0

  const PHASES = [
    { id: 'contract', label: 'Contrato', color: '#6366F1' },
    { id: 'implementation', label: 'Implantação', color: '#0891B2' },
    { id: 'training', label: 'Treinamento', color: '#D97706' },
    { id: 'campaign', label: 'Campanha', color: '#7C3AED' },
    { id: 'monthly', label: 'Mensal', color: '#16A34A' },
  ]

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-5">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
          </div>
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
              <p className="text-sm text-gray-400 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" />
                {[institution.city, institution.state].filter(Boolean).join('/') || '—'}
                {institution.email && <span className="ml-2 flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{institution.email}</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={loadAll} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            {institution.plan_status === 'suspended'
              ? <button onClick={handleReactivate} className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm">
                  <Unlock className="w-4 h-4" /> Reativar
                </button>
              : institution.plan_status === 'active'
              ? <button onClick={handleSuspend} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm">
                  <Lock className="w-4 h-4" /> Suspender
                </button>
              : null
            }
          </div>
        </div>

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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto gap-0">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => handleTabChange(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors
                  ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            )
          })}
        </div>

        {/* ── TAB: DADOS ── */}
        {tab === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Dados da instituição</h2>
              {!editingInfo
                ? <button onClick={() => setEditingInfo(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                : <div className="flex gap-2">
                    <button onClick={() => setEditingInfo(false)} className="px-3 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Cancelar</button>
                    <button onClick={handleSaveInfo} disabled={savingInfo} className="flex items-center gap-2 px-3 py-2 bg-cyan-500 text-white rounded-xl text-sm font-semibold disabled:opacity-60">
                      {savingInfo ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Salvar
                    </button>
                  </div>
              }
            </div>

            {editingInfo ? (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { k: 'name', l: 'Nome *', type: 'text' },
                  { k: 'cnpj', l: 'CNPJ', type: 'text' },
                  { k: 'city', l: 'Cidade', type: 'text' },
                  { k: 'state', l: 'UF', type: 'text' },
                  { k: 'phone', l: 'Telefone', type: 'text' },
                  { k: 'email', l: 'E-mail', type: 'email' },
                  { k: 'monthly_value', l: 'Mensalidade (R$)', type: 'number' },
                  { k: 'implementation_value', l: 'Implantação (R$)', type: 'number' },
                ].map(f => (
                  <div key={f.k}>
                    <label className={lbl}>{f.l}</label>
                    <input type={f.type} className={inp} value={editForm[f.k] || ''} onChange={e => setEditForm((prev: any) => ({ ...prev, [f.k]: e.target.value }))} />
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
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {[
                  ['Nome', institution.name],
                  ['CNPJ', institution.cnpj || '—'],
                  ['Cidade/UF', [institution.city, institution.state].filter(Boolean).join('/') || '—'],
                  ['E-mail', institution.email || '—'],
                  ['Telefone', institution.phone || '—'],
                  ['Plano', institution.plan || '—'],
                  ['Mensalidade', fmtBRL(institution.monthly_value || 0)],
                  ['Implantação', fmtBRL(institution.implementation_value || 0)],
                  ['Consultor', consultants.find(c => c.id === institution.consultant_id)?.full_name || '—'],
                  ['Criado em', fmtDate(institution.created_at)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-sm text-gray-400 font-medium">{k}</span>
                    <span className="text-sm text-gray-900 font-semibold text-right">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CONTRATO ── */}
        {tab === 'contract' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Contrato</h2>
              <button onClick={loadContractData} className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-500 hover:bg-gray-50">
                <RefreshCw className="w-3.5 h-3.5" /> Atualizar
              </button>
            </div>
            {!contract ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Nenhum contrato gerado</p>
                <p className="text-xs text-gray-400 mt-1">Envie o contrato pelo painel de Onboarding ou Contratos</p>
                <button onClick={() => navigate('/super-admin/contracts')} className="mt-4 text-sm text-cyan-600 font-semibold hover:text-cyan-700">
                  Ir para Contratos →
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: contractSt?.c, background: contractSt?.bg }}>
                      {contractSt?.l}
                    </span>
                    <p className="text-xs text-gray-400 mt-2">Enviado em {fmtDate(contract.created_at)}</p>
                  </div>
                  <div className="flex gap-2">
                    {contract.status !== 'signed' && (
                      <>
                        <button onClick={handleResendContract} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold hover:bg-indigo-100">
                          <Send className="w-3.5 h-3.5" /> Reenviar
                        </button>
                        <button onClick={handleMarkContractSigned} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 rounded-xl text-xs font-semibold hover:bg-green-100">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Marcar assinado
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-2 border-b border-gray-100">
                  {[
                    ['Plano', contract.plan || '—'],
                    ['Mensalidade', contract.monthly_value ? fmtBRL(contract.monthly_value) : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-400">{k}</span>
                      <span className="text-sm text-gray-900 font-semibold">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Per-signer status cards */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Signatários</p>
                  <div className="space-y-2">
                    {Array.isArray(contract.signers) && contract.signers.length > 0 ? (
                      contract.signers.map((s: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${s.signed ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-500">{s.role} · {s.email}</p>
                          </div>
                          <div className="text-right">
                            {s.signed ? (
                              <>
                                <span className="flex items-center gap-1 text-xs font-bold text-green-700">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Assinou
                                </span>
                                {s.signed_at && <p className="text-xs text-gray-400 mt-0.5">{fmtDate(s.signed_at)}</p>}
                              </>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-bold text-yellow-700">
                                <Clock className="w-3.5 h-3.5" /> Aguardando
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      /* Fallback for contracts created before signers column */
                      <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${contract.status === 'signed' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{contract.signer_name || '—'}</p>
                          <p className="text-xs text-gray-500">{contract.signer_email || ''}</p>
                        </div>
                        <div className="text-right">
                          {contract.status === 'signed' ? (
                            <span className="flex items-center gap-1 text-xs font-bold text-green-700">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Assinou
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-bold text-yellow-700">
                              <Clock className="w-3.5 h-3.5" /> Aguardando
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {contract.sign_url && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 mb-2">Link de assinatura</p>
                    <div className="flex items-center gap-2">
                      <input readOnly className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={contract.sign_url} />
                      <button onClick={() => copyToClipboard(contract.sign_url, 'contract')} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                        {copied === 'contract' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                      <a href={contract.sign_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <ExternalLink className="w-4 h-4 text-cyan-600" />
                      </a>
                      <button onClick={() => {
                        const phone = institution?.phone?.replace(/\D/g, '')
                        if (!phone) { showToast('Escola sem telefone.', false); return }
                        const msg = encodeURIComponent(`Olá! Segue o link para assinar o contrato:\n\n${contract.sign_url}`)
                        window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
                      }} className="p-2 bg-green-50 border border-green-200 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: FINANCEIRO ── */}
        {tab === 'financial' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Financeiro</h2>
              <button onClick={() => setShowNewCharge(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Nova cobrança
              </button>
            </div>

            {/* Implantação */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Taxa de implantação</p>
              {!implPayment ? (
                <p className="text-sm text-gray-400 italic">Nenhuma cobrança de implantação gerada.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ color: PAYMENT_STATUS[implPayment.status]?.c, background: PAYMENT_STATUS[implPayment.status]?.bg }}>
                      {PAYMENT_STATUS[implPayment.status]?.l || implPayment.status}
                    </span>
                    <span className="text-sm font-bold text-gray-900">{fmtBRL(implPayment.amount)}</span>
                    <span className="text-xs text-gray-400">Vence {fmtDate(implPayment.due_date)}</span>
                    {implPayment.status === 'paid' && <span className="text-xs text-green-600 font-semibold">Pago em {fmtDate(implPayment.paid_at)}</span>}
                  </div>

                  {implPayment.asaas_charge_url && (
                    <div className="flex items-center gap-2">
                      <input readOnly className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={implPayment.asaas_charge_url} />
                      <button onClick={() => copyToClipboard(implPayment.asaas_charge_url, 'impl')} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
                        {copied === 'impl' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
                      </button>
                      <a href={implPayment.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <ExternalLink className="w-4 h-4 text-cyan-600" />
                      </a>
                      <button onClick={() => handleResendPaymentEmail(implPayment)} className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <Send className="w-4 h-4 text-blue-600" />
                      </button>
                      <button onClick={() => handleSendWhatsAppPayment(implPayment)} className="p-2 bg-green-50 border border-green-200 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-green-600" />
                      </button>
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

            {/* Mensalidades */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Mensalidades ({monthlyPayments.length})</p>
              </div>
              {monthlyPayments.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhuma mensalidade registrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {['Descrição', 'Valor', 'Vencimento', 'Status', 'Ações'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {monthlyPayments.map(p => {
                        const pst = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending
                        const late = p.status === 'overdue' ? daysLate(p.due_date) : 0
                        return (
                          <tr key={p.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-700">{p.description || 'Mensalidade'}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmtBRL(p.amount)}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {fmtDate(p.due_date)}
                              {late > 0 && <span className="ml-1 text-xs text-red-500 font-bold">{late}d atraso</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: pst.c, background: pst.bg }}>{pst.l}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {p.asaas_charge_url && (
                                  <>
                                    <button onClick={() => handleResendPaymentEmail(p)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Send className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleSendWhatsAppPayment(p)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><MessageCircle className="w-3.5 h-3.5" /></button>
                                    <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg"><ExternalLink className="w-3.5 h-3.5" /></a>
                                  </>
                                )}
                                {!p.asaas_charge_url && p.status !== 'paid' && p.payment_type === 'monthly' && (
                                  <button
                                    onClick={() => handleGenerateLink(p.id)}
                                    style={{ padding: '4px 10px', borderRadius: 6, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    🔗 Gerar link
                                  </button>
                                )}
                                {p.status === 'pending' && (
                                  <button onClick={() => handleMarkPaid(p.id, false)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle2 className="w-3.5 h-3.5" /></button>
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

            {/* Modal nova cobrança */}
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
                      <input className={inp} value={chargeForm.description} onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Mensalidade Maio/2025" />
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setShowNewCharge(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                    <button onClick={handleNewCharge} disabled={savingCharge} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                      {savingCharge ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      Gerar cobrança
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: WHATSAPP ── */}
        {tab === 'whatsapp' && (
          <div className="space-y-4">
            {/* Status */}
            <div className={`flex items-center gap-4 p-5 rounded-2xl border ${institution.whatsapp_connected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              {institution.whatsapp_connected
                ? <><Wifi className="w-6 h-6 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-700">WhatsApp conectado</p>
                      {institution.whatsapp_display_name && <p className="text-sm text-green-600">{institution.whatsapp_display_name}</p>}
                      {institution.whatsapp_phone_number && <p className="text-xs text-green-500">{institution.whatsapp_phone_number}</p>}
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-xs text-gray-400">Conversas este mês</p>
                      <p className="text-lg font-bold text-gray-900">{waUsage.count}<span className="text-sm font-normal text-gray-400">/{waUsage.limit}</span></p>
                    </div>
                  </>
                : <><WifiOff className="w-6 h-6 text-gray-400 flex-shrink-0" /><p className="font-semibold text-gray-500">WhatsApp não configurado</p></>
              }
            </div>

            {/* Uso */}
            {institution.whatsapp_connected && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Uso do mês</p>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${usagePct}%`, background: usagePct >= 90 ? '#EF4444' : usagePct >= 70 ? '#F59E0B' : '#10B981' }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{waUsage.count} conversas usadas</span>
                  <span>{waUsage.limit - waUsage.count} restantes</span>
                </div>
                {waUsage.count > 1000 && (
                  <p className="text-xs text-red-500 font-semibold mt-2">
                    Custo extra estimado: {fmtBRL((waUsage.count - 1000) * 0.005)}
                  </p>
                )}
              </div>
            )}

            {/* Config */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Configurar número</p>
              {[
                { k: 'phone_id', l: 'Phone Number ID', placeholder: '1007880222413531' },
                { k: 'token', l: 'Token de acesso', placeholder: 'EAAOSNzt...' },
                { k: 'phone_number', l: 'Número de telefone', placeholder: '+55 83 99999-9999' },
                { k: 'display_name', l: 'Nome de exibição', placeholder: 'Colégio São João' },
              ].map(f => (
                <div key={f.k}>
                  <label className={lbl}>{f.l}</label>
                  <input className={inp} placeholder={f.placeholder}
                    value={(waForm as any)[f.k]}
                    onChange={e => setWaForm(p => ({ ...p, [f.k]: e.target.value }))} />
                </div>
              ))}
              <button onClick={handleSaveWhatsApp} disabled={savingWa}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
                {savingWa ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Salvar e verificar
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: CAMPANHA ── */}
        {tab === 'campaign' && (
          <div className="space-y-4">
            {/* Status atual */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Status da campanha</p>
              {!cycle ? (
                <div className="text-center py-6">
                  <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-gray-500 font-medium">Nenhuma campanha configurada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    ['Status', { active: 'Ativa', released: 'Liberada', setup: 'Em setup', draft: 'Rascunho', completed: 'Concluída' }[cycle.status as string] || cycle.status],
                    ['Ano', String(cycle.year || '—')],
                    ['Início', fmtDate(cycle.start_date)],
                    ['Fim', fmtDate(cycle.end_date)],
                    ['Mês início matrículas', cycle.campaign_start_month ? months.find(m => m.v === cycle.campaign_start_month)?.l || '—' : '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5 border-b border-gray-50">
                      <span className="text-sm text-gray-400">{k}</span>
                      <span className="text-sm text-gray-900 font-semibold">{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Liberar campanha */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                {cycle ? 'Atualizar campanha' : 'Liberar nova campanha'}
              </p>
              <div>
                <label className={lbl}>Mês de início das matrículas</label>
                <div className="grid grid-cols-4 gap-2">
                  {months.map(m => (
                    <button key={m.v} onClick={() => setCampaignForm(f => ({ ...f, startMonth: m.v }))}
                      className={`py-2 rounded-lg text-sm font-semibold transition-colors
                        ${campaignForm.startMonth === m.v ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Data de início</label>
                  <input type="date" className={inp} value={campaignForm.startDate} onChange={e => setCampaignForm(f => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Data de fim</label>
                  <input type="date" className={inp} value={campaignForm.endDate} onChange={e => setCampaignForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <button onClick={handleReleaseCampaign} disabled={releasingCampaign}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-sm disabled:opacity-60">
                {releasingCampaign ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Megaphone className="w-4 h-4" />}
                {cycle ? 'Atualizar campanha' : 'Liberar campanha'}
              </button>
            </div>
          </div>
        )}

        {/* ── TAB: USUÁRIOS ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{users.length} usuário{users.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowNewUser(true)} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Novo usuário
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.length === 0 ? (
                <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Nenhum usuário cadastrado</p>
                </div>
              ) : users.map(user => (
                <div key={user.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{user.full_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{user.role}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${user.active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {user.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleUser(user)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold border transition-colors
                        ${user.active ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                      {user.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {user.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleDeleteUser(user)} className="p-2 bg-red-50 text-red-500 border border-red-200 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {showNewUser && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900">Novo usuário</h2>
                    <button onClick={() => setShowNewUser(false)}><X className="w-5 h-5 text-gray-400" /></button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={lbl}>Nome completo *</label>
                      <input className={inp} value={newUser.full_name} onChange={e => setNewUser(u => ({ ...u, full_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>E-mail *</label>
                      <input type="email" className={inp} value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className={lbl}>Senha *</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} className={inp + ' pr-10'} placeholder="Mínimo 8 caracteres"
                          value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                        <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className={lbl}>Perfil</label>
                      <select className={inp} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                        <option value="admin">Admin</option>
                        <option value="manager">Gerente</option>
                        <option value="user">Usuário</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-5">
                    <button onClick={() => setShowNewUser(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
                    <button onClick={handleCreateUser} disabled={savingUser}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                      {savingUser ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar usuário'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: NOTIFICAÇÕES ── */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            {/* Enviar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Enviar notificação ao gestor</p>
              <div>
                <label className={lbl}>Tipo</label>
                <div className="flex gap-2">
                  {[{ v: 'info', l: 'Informativo', c: 'bg-blue-100 text-blue-700' }, { v: 'warning', l: 'Alerta', c: 'bg-amber-100 text-amber-700' }, { v: 'urgent', l: 'Urgente', c: 'bg-red-100 text-red-700' }].map(t => (
                    <button key={t.v} onClick={() => setNotifForm(f => ({ ...f, type: t.v }))}
                      className={`flex-1 py-2 text-xs font-bold rounded-xl border-2 transition-all
                        ${notifForm.type === t.v ? t.c + ' border-current' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={lbl}>Título *</label>
                <input className={inp} value={notifForm.title} onChange={e => setNotifForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Manutenção programada" />
              </div>
              <div>
                <label className={lbl}>Mensagem *</label>
                <textarea rows={3} className={inp + ' resize-none'} value={notifForm.message} onChange={e => setNotifForm(f => ({ ...f, message: e.target.value }))} placeholder="Descreva a notificação..." />
              </div>
              <button onClick={handleSendNotification} disabled={sendingNotif}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                {sendingNotif ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Bell className="w-4 h-4" />}
                Enviar notificação
              </button>
            </div>

            {/* Histórico */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Histórico ({notifications.length})</p>
              </div>
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">Nenhuma notificação enviada.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map(n => (
                    <div key={n.id} className="px-5 py-3 flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${n.type === 'urgent' ? 'bg-red-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                        <p className="text-xs text-gray-300 mt-1">{fmtDate(n.created_at)}</p>
                      </div>
                      {!n.read && <span className="text-xs text-blue-600 font-bold flex-shrink-0">Não lido</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: ONBOARDING ── */}
        {tab === 'onboarding' && (
          <div className="space-y-4">
            {!onboardingProcess ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Zap className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Nenhum processo de onboarding iniciado</p>
                <button onClick={() => navigate('/super-admin/onboarding')} className="mt-4 text-sm text-cyan-600 font-semibold">
                  Ir para Implantação →
                </button>
              </div>
            ) : (
              <>
                {/* Progress */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-gray-900">Progresso geral</p>
                    <span className="text-2xl font-bold text-cyan-600">{progress}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-gray-400">{doneTasks}/{totalTasks} tarefas concluídas</p>

                  {/* Fase atual */}
                  <div className="mt-4 flex gap-2 flex-wrap">
                    {PHASES.map(ph => {
                      const phaseTasks = onboardingTasks.filter(t => t.phase === ph.id)
                      const phaseDone = phaseTasks.filter(t => t.done).length
                      const isCurrent = ph.id === onboardingProcess.current_phase
                      return (
                        <div key={ph.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border
                          ${isCurrent ? 'border-current' : 'border-transparent bg-gray-100 text-gray-400'}`}
                          style={isCurrent ? { color: ph.color, background: ph.color + '15', borderColor: ph.color } : {}}>
                          {ph.label}
                          {phaseTasks.length > 0 && <span className="opacity-70">({phaseDone}/{phaseTasks.length})</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Checklist por fase */}
                {PHASES.map(ph => {
                  const phaseTasks = onboardingTasks.filter(t => t.phase === ph.id)
                  if (phaseTasks.length === 0) return null
                  return (
                    <div key={ph.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: ph.color }}>{ph.label}</p>
                      <div className="space-y-2">
                        {phaseTasks.map(task => (
                          <label key={task.id} className="flex items-start gap-3 cursor-pointer group">
                            <div onClick={() => handleToggleTask(task.id, !task.done)}
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                                ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-300 group-hover:border-cyan-400'}`}>
                              {task.done && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{task.title}</p>
                              {task.done && task.done_at && <p className="text-xs text-green-500 mt-0.5">Concluído em {fmtDate(task.done_at)}</p>}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
