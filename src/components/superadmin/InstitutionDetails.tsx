// src/components/superadmin/InstitutionDetails.tsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Users, DollarSign, FileText, CheckCircle2,
  Clock, AlertTriangle, ExternalLink, Copy, RefreshCw,
  Mail, Phone, MapPin, Calendar, CreditCard, Lock,
  Unlock, Send, MessageCircle, Edit2, X, Save,
  Plus, Trash2, ToggleLeft, ToggleRight, Eye, EyeOff,
  ArrowLeft, Zap
} from 'lucide-react'
import { sendEmail } from '../../lib/email'

// ─── helpers ──────────────────────────────────────────────────────────────
const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
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

// ─── Toast ────────────────────────────────────────────────────────────────
type ToastT = { msg: string; ok: boolean }
function ToastBar({ toast, onClose }: { toast: ToastT; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ color, background: bg, border: `1px solid ${color}30` }}
      className="px-2.5 py-1 rounded-full text-xs font-semibold">
      {label}
    </span>
  )
}

// ─── Section card wrapper ─────────────────────────────────────────────────
function SectionCard({ title, icon: Icon, action, children }: {
  title: string; icon: any; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-cyan-600" />
          <h3 className="text-sm font-bold text-gray-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────
interface Institution {
  id: string; name: string; cnpj?: string; city?: string; state?: string
  email?: string; phone?: string; plan?: string; plan_status?: string
  monthly_value?: number; implementation_value?: number
  consultant_name?: string; created_at: string
}
interface UserRow {
  id: string; email: string; full_name: string; role: string; active: boolean; created_at: string
}
interface Payment {
  id: string; institution_id: string; payment_type: string; description?: string
  amount: number; due_date?: string; paid_at?: string; status: string
  asaas_charge_url?: string; asaas_charge_id?: string
}
interface Contract {
  id: string; institution_id: string; status: string
  signer_name?: string; signer_email?: string; monthly_value?: number
  signed_at?: string; start_date?: string; end_date?: string
  zapsign_url?: string; created_at: string
}

// ══════════════════════════════════════════════════════════════════════════
export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [institution, setInstitution] = useState<Institution | null>(null)
  const [users, setUsers]             = useState<UserRow[]>([])
  const [payments, setPayments]       = useState<Payment[]>([])
  const [contracts, setContracts]     = useState<Contract[]>([])
  const [loading, setLoading]         = useState(true)
  const [toast, setToast]             = useState<ToastT | null>(null)
  const [finTab, setFinTab]           = useState<'impl' | 'monthly'>('impl')

  // modals
  const [showNewUser,  setShowNewUser]  = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)
  const [editUser,     setEditUser]     = useState<UserRow | null>(null)
  const [showNewPw,    setShowNewPw]    = useState(false)
  const [newUser,      setNewUser]      = useState({ full_name: '', email: '', password: '', role: 'admin' })
  const [saving,       setSaving]       = useState(false)

  // ── load ──────────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [instRes, usersRes, paymentsRes, contractsRes] = await Promise.all([
        supabase.from('institutions').select('*').eq('id', id).single(),
        supabase.from('users').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
        supabase.from('contracts').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
      ])
      if (instRes.error) throw instRes.error
      setInstitution(instRes.data)
      setUsers(usersRes.data || [])
      setPayments(paymentsRes.data || [])
      setContracts(contractsRes.data || [])
    } catch (err: any) {
      toast2(err.message || 'Erro ao carregar dados', false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [id])

  const toast2 = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  // ── suspend / reactivate ──────────────────────────────────────────────
  const handleSuspend = async () => {
    if (!confirm('Suspender esta instituição?')) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', id!)
    toast2('Instituição suspensa', true)
    loadData()
  }
  const handleReactivate = async () => {
    await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id!)
    toast2('Instituição reativada', true)
    loadData()
  }

  // ── copy helper ───────────────────────────────────────────────────────
  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast2('Link copiado!', true)
  }

  // ── whatsapp ──────────────────────────────────────────────────────────
  const whatsapp = (paymentLink: string) => {
    const phone = institution?.phone?.replace(/\D/g, '')
    const msg = encodeURIComponent(`Olá! Segue o link de pagamento: ${paymentLink}`)
    window.open(`https://wa.me/55${phone}?text=${msg}`, '_blank')
  }

  // ── create user ───────────────────────────────────────────────────────
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fnRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          role: newUser.role,
          user_type: 'school_user',
          institution_id: id,
        }),
      })
      const result = await fnRes.json()
      if (!fnRes.ok) throw new Error(result.error || 'Erro ao criar usuário')

      const roleLabels: Record<string, string> = {
        admin: 'Administrador', manager: 'Gestor', user: 'Atendente',
      }
      await sendEmail('user_welcome', newUser.email, {
        user_name: newUser.full_name,
        user_email: newUser.email,
        temp_password: newUser.password,
        school_name: institution?.name ?? '',
        role_label: roleLabels[newUser.role] ?? newUser.role,
      })

      toast2('Usuário criado com sucesso!', true)
      setShowNewUser(false)
      setNewUser({ full_name: '', email: '', password: '', role: 'admin' })
      loadData()
    } catch (err: any) {
      toast2(err.message, false)
    } finally {
      setSaving(false)
    }
  }

  // ── update user ───────────────────────────────────────────────────────
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return
    setSaving(true)
    try {
      const { error } = await supabase.from('users')
        .update({ full_name: editUser.full_name, role: editUser.role })
        .eq('id', editUser.id)
      if (error) throw error
      toast2('Usuário atualizado!', true)
      setShowEditUser(false)
      setEditUser(null)
      loadData()
    } catch (err: any) {
      toast2(err.message, false)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleUser = async (u: UserRow) => {
    const { error } = await supabase.from('users').update({ active: !u.active }).eq('id', u.id)
    if (error) toast2(error.message, false)
    else { toast2(`Usuário ${u.active ? 'desativado' : 'ativado'}!`, true); loadData() }
  }

  const handleDeleteUser = async (u: UserRow) => {
    if (!confirm(`Excluir "${u.full_name}"? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('users').delete().eq('id', u.id)
    if (error) toast2(error.message, false)
    else { toast2('Usuário excluído!', true); loadData() }
  }

  // ── derived ───────────────────────────────────────────────────────────
  const contract      = contracts[0] ?? null
  const implPayment   = payments.find(p => p.payment_type === 'implementation') ?? null
  const monthlyPmts   = payments.filter(p => p.payment_type === 'monthly')
  const status        = institution?.plan_status ?? 'active'
  const statusInfo    = STATUS_MAP[status] ?? STATUS_MAP.active
  const isSuspended   = status === 'suspended'

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador', manager: 'Gestor', user: 'Atendente', consultant: 'Consultor',
  }

  // ── loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SuperAdminLayout>
    )
  }

  if (!institution) {
    return (
      <SuperAdminLayout>
        <div className="p-8 text-center text-gray-500">Instituição não encontrada.</div>
      </SuperAdminLayout>
    )
  }

  // ══════════════════════════════════════════════════════════════════════
  return (
    <SuperAdminLayout>
      {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

      <div className="p-6 max-w-5xl mx-auto space-y-6">

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>

          <div className="flex-1 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{institution.name}</h1>
            <Badge label={statusInfo.l} color={statusInfo.c} bg={statusInfo.bg} />
          </div>

          <div className="flex items-center gap-2">
            {isSuspended
              ? (
                <button onClick={handleReactivate}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors">
                  <Unlock className="w-3.5 h-3.5" /> Reativar
                </button>
              ) : (
                <button onClick={handleSuspend}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors">
                  <Lock className="w-3.5 h-3.5" /> Suspender
                </button>
              )
            }
            <button onClick={loadData}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          </div>
        </div>

        {/* ── Seção 1 — Dados da escola ───────────────────────────────── */}
        <SectionCard title="Dados da escola" icon={Building2}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <InfoRow icon={Building2} label="Nome" value={institution.name} />
            <InfoRow icon={FileText}  label="CNPJ" value={institution.cnpj} />
            <InfoRow icon={MapPin}    label="Cidade / UF" value={[institution.city, institution.state].filter(Boolean).join(' / ') || undefined} />
            <InfoRow icon={Mail}      label="E-mail" value={institution.email} />
            <InfoRow icon={Phone}     label="Telefone" value={institution.phone} />
            <InfoRow icon={Zap}       label="Plano" value={institution.plan} />
            <InfoRow icon={DollarSign} label="Mensalidade" value={institution.monthly_value ? fmtBRL(institution.monthly_value) : undefined} />
            <InfoRow icon={CreditCard} label="Implantação" value={institution.implementation_value ? fmtBRL(institution.implementation_value) : undefined} />
            <InfoRow icon={Users}     label="Consultor" value={institution.consultant_name} />
            <InfoRow icon={Calendar}  label="Criada em" value={fmtDate(institution.created_at)} />
          </div>
        </SectionCard>

        {/* ── Seção 2 — Contrato ──────────────────────────────────────── */}
        <SectionCard title="Contrato" icon={FileText}>
          {!contract ? (
            <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
              <FileText className="w-8 h-8 opacity-40" />
              <p className="text-sm">Nenhum contrato gerado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* status badge */}
              <div className="flex items-center gap-2 flex-wrap">
                {contract.status === 'sent' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3 h-3" /> Aguardando assinatura
                  </span>
                )}
                {contract.status === 'signed' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                    <CheckCircle2 className="w-3 h-3" /> Assinado
                  </span>
                )}
                {contract.status === 'draft' && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    <FileText className="w-3 h-3" /> Rascunho
                  </span>
                )}
              </div>

              {/* contract details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <InfoRow icon={Users}     label="Signatário"   value={contract.signer_name} />
                <InfoRow icon={Mail}      label="E-mail"       value={contract.signer_email} />
                <InfoRow icon={DollarSign} label="Mensalidade" value={contract.monthly_value ? fmtBRL(contract.monthly_value) : undefined} />
                {contract.status === 'signed' && (
                  <>
                    <InfoRow icon={CheckCircle2} label="Assinado em" value={fmtDate(contract.signed_at)} />
                    <InfoRow icon={Calendar} label="Vigência"
                      value={contract.start_date && contract.end_date
                        ? `${fmtDate(contract.start_date)} → ${fmtDate(contract.end_date)}`
                        : undefined} />
                  </>
                )}
              </div>

              {/* actions for sent contract */}
              {contract.status === 'sent' && contract.zapsign_url && (
                <div className="flex gap-2 flex-wrap pt-1">
                  <button onClick={() => copy(contract.zapsign_url!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors">
                    <Copy className="w-3.5 h-3.5" /> Copiar link
                  </button>
                  <a href={contract.zapsign_url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir contrato
                  </a>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* ── Seção 3 — Financeiro ────────────────────────────────────── */}
        <SectionCard title="Financeiro" icon={DollarSign}>
          {/* tabs */}
          <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
            {(['impl', 'monthly'] as const).map(tab => (
              <button key={tab} onClick={() => setFinTab(tab)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${finTab === tab ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab === 'impl' ? 'Implantação' : 'Mensalidades'}
              </button>
            ))}
          </div>

          {/* tab: implantação */}
          {finTab === 'impl' && (
            !implPayment ? (
              <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                <DollarSign className="w-8 h-8 opacity-40" />
                <p className="text-sm">Nenhuma cobrança gerada</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {implPayment.status === 'paid'
                    ? <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                        <CheckCircle2 className="w-3 h-3" /> Pago em {fmtDate(implPayment.paid_at)}
                      </span>
                    : <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" /> Pendente — venc. {fmtDate(implPayment.due_date)}
                      </span>
                  }
                  <span className="text-sm font-bold text-gray-800">{fmtBRL(implPayment.amount)}</span>
                </div>

                {implPayment.status !== 'paid' && implPayment.asaas_charge_url && (
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => copy(implPayment.asaas_charge_url!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors">
                      <Copy className="w-3.5 h-3.5" /> Copiar link
                    </button>
                    <a href={implPayment.asaas_charge_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir fatura
                    </a>
                    <button onClick={() => whatsapp(implPayment.asaas_charge_url!)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </button>
                  </div>
                )}
              </div>
            )
          )}

          {/* tab: mensalidades */}
          {finTab === 'monthly' && (
            monthlyPmts.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
                <CreditCard className="w-8 h-8 opacity-40" />
                <p className="text-sm">Nenhuma mensalidade gerada</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold text-gray-500 border-b border-gray-100">
                      <th className="pb-2 pr-4">Descrição</th>
                      <th className="pb-2 pr-4">Valor</th>
                      <th className="pb-2 pr-4">Vencimento</th>
                      <th className="pb-2 pr-4">Pago em</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {monthlyPmts.map(p => {
                      const ps = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.pending
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-2.5 pr-4 text-gray-700">{p.description || 'Mensalidade'}</td>
                          <td className="py-2.5 pr-4 font-semibold text-gray-800">{fmtBRL(p.amount)}</td>
                          <td className="py-2.5 pr-4 text-gray-500">{fmtDate(p.due_date)}</td>
                          <td className="py-2.5 pr-4 text-gray-500">{fmtDate(p.paid_at)}</td>
                          <td className="py-2.5 pr-4">
                            <Badge label={ps.l} color={ps.c} bg={ps.bg} />
                          </td>
                          <td className="py-2.5">
                            {p.asaas_charge_url && (
                              <a href={p.asaas_charge_url} target="_blank" rel="noreferrer"
                                className="p-1.5 rounded-lg text-cyan-600 hover:bg-cyan-50 transition-colors inline-flex">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </SectionCard>

        {/* ── Seção 4 — Usuários ──────────────────────────────────────── */}
        <SectionCard
          title={`Usuários (${users.length})`}
          icon={Users}
          action={
            <button onClick={() => setShowNewUser(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-md transition-all">
              <Plus className="w-3.5 h-3.5" /> Novo usuário
            </button>
          }
        >
          {users.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-gray-400">
              <Users className="w-8 h-8 opacity-40" />
              <p className="text-sm">Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {users.map(u => (
                <div key={u.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:bg-white hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${u.active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditUser(u); setShowEditUser(true) }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                      <Edit2 className="w-3 h-3" /> Editar
                    </button>
                    <button onClick={() => handleToggleUser(u)}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${u.active ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                      {u.active ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                      {u.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleDeleteUser(u)}
                      className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Modal: Novo Usuário ─────────────────────────────────────────── */}
      {showNewUser && (
        <Modal title="Novo Usuário" onClose={() => { setShowNewUser(false); setNewUser({ full_name: '', email: '', password: '', role: 'admin' }) }}>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className={lbl}>Nome completo *</label>
              <input className={inp} type="text" required value={newUser.full_name}
                onChange={e => setNewUser(v => ({ ...v, full_name: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>E-mail *</label>
              <input className={inp} type="email" required value={newUser.email}
                onChange={e => setNewUser(v => ({ ...v, email: e.target.value }))} />
            </div>
            <div>
              <label className={lbl}>Senha temporária *</label>
              <div className="relative">
                <input className={inp} type={showNewPw ? 'text' : 'password'} required minLength={6}
                  value={newUser.password} onChange={e => setNewUser(v => ({ ...v, password: e.target.value }))}
                  style={{ paddingRight: 36 }} />
                <button type="button" onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className={lbl}>Perfil *</label>
              <select className={inp} value={newUser.role} onChange={e => setNewUser(v => ({ ...v, role: e.target.value }))}>
                <option value="admin">Administrador</option>
                <option value="manager">Gestor</option>
                <option value="user">Atendente</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Criando...' : 'Criar usuário'}
            </button>
          </form>
        </Modal>
      )}

      {/* ── Modal: Editar Usuário ───────────────────────────────────────── */}
      {showEditUser && editUser && (
        <Modal title="Editar Usuário" onClose={() => { setShowEditUser(false); setEditUser(null) }}>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <label className={lbl}>Nome completo *</label>
              <input className={inp} type="text" required value={editUser.full_name}
                onChange={e => setEditUser(v => v ? { ...v, full_name: e.target.value } : v)} />
            </div>
            <div>
              <label className={lbl}>E-mail</label>
              <input className={`${inp} bg-gray-50 cursor-not-allowed`} type="email" disabled value={editUser.email} />
            </div>
            <div>
              <label className={lbl}>Perfil *</label>
              <select className={inp} value={editUser.role}
                onChange={e => setEditUser(v => v ? { ...v, role: e.target.value } : v)}>
                <option value="admin">Administrador</option>
                <option value="manager">Gestor</option>
                <option value="user">Atendente</option>
              </select>
            </div>
            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-lg transition-all disabled:opacity-60">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </Modal>
      )}
    </SuperAdminLayout>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────
function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}