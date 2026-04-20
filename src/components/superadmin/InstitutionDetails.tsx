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
  ArrowLeft, ChevronRight, AlertCircle
} from 'lucide-react'

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

const CONTRACT_STATUS: Record<string, { l: string; c: string; bg: string }> = {
  draft:     { l: 'Rascunho',  c: '#6b7280', bg: '#f3f4f6' },
  sent:      { l: 'Enviado — aguardando assinatura', c: '#d97706', bg: '#fffbeb' },
  signed:    { l: 'Assinado ✓', c: '#16a34a', bg: '#f0fdf4' },
  cancelled: { l: 'Cancelado', c: '#dc2626', bg: '#fef2f2' },
}

export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [institution, setInstitution] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'info' | 'contract' | 'financial' | 'users'>('info')
  const [financialTab, setFinancialTab] = useState<'implementation' | 'monthly'>('implementation')
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  // Modal novo usuário
  const [showNewUser, setShowNewUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'admin' })
  const [showPw, setShowPw] = useState(false)
  const [savingUser, setSavingUser] = useState(false)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => { if (id) loadData() }, [id])

  const loadData = async () => {
    setLoading(true)
    const [instRes, usersRes, paymentsRes, contractsRes] = await Promise.all([
      supabase.from('institutions').select('*').eq('id', id).single(),
      supabase.from('users').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('institution_id', id).order('created_at', { ascending: false }),
      supabase.from('contracts').select('*').eq('institution_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    setInstitution(instRes.data)
    setUsers(usersRes.data || [])
    setPayments(paymentsRes.data || [])
    setContract(contractsRes.data)
    setLoading(false)
  }

  const handleSuspend = async () => {
    if (!confirm(`Suspender acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', id)
    showToast('Escola suspensa.')
    loadData()
  }

  const handleReactivate = async () => {
    if (!confirm(`Reativar acesso de "${institution?.name}"?`)) return
    await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
    showToast('Escola reativada!')
    loadData()
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copiado!')
  }

  const sendWhatsApp = (link: string) => {
    const phone = institution?.phone?.replace(/\D/g, '')
    if (!phone) { showToast('Escola sem telefone cadastrado.', false); return }
    const msg = encodeURIComponent(`Olá! Segue o link de pagamento:\n\n${link}`)
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
      const fnRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
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
      const fnData = await fnRes.json()
      if (!fnRes.ok || fnData?.error) throw new Error(fnData?.error || 'Erro ao criar usuário')
      showToast('Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'admin' })
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro.', false)
    } finally {
      setSavingUser(false)
    }
  }

  const handleToggleUser = async (user: any) => {
    await supabase.from('users').update({ active: !user.active }).eq('id', user.id)
    showToast(user.active ? 'Usuário desativado.' : 'Usuário ativado!')
    loadData()
  }

  const handleDeleteUser = async (user: any) => {
    if (!confirm(`Excluir "${user.full_name}"?`)) return
    await supabase.from('users').delete().eq('id', user.id)
    showToast('Usuário excluído.')
    loadData()
  }

  if (loading) return (
    <SuperAdminLayout>
      <div className="p-8 flex items-center justify-center">
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
  const contractSt = contract ? (CONTRACT_STATUS[contract.status] || CONTRACT_STATUS.draft) : null

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6 max-w-5xl">

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
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{institution.name}</h1>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.c, background: st.bg }}>{st.l}</span>
              </div>
              <p className="text-sm text-gray-400">{[institution.city, institution.state].filter(Boolean).join('/')} · {institution.plan || 'escola'}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
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

        {/* Tabs */}
        <div className="flex border-b border-gray-200 gap-0">
          {[
            { id: 'info' as const, label: 'Dados' },
            { id: 'contract' as const, label: 'Contrato' },
            { id: 'financial' as const, label: 'Financeiro' },
            { id: 'users' as const, label: `Usuários (${users.length})` },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors
                ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── TAB: Dados ── */}
        {tab === 'info' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {[
                ['Nome',        institution.name],
                ['CNPJ',        institution.cnpj || '—'],
                ['Cidade/UF',   [institution.city, institution.state].filter(Boolean).join('/') || '—'],
                ['E-mail',      institution.email || '—'],
                ['Telefone',    institution.phone || '—'],
                ['Plano',       institution.plan || '—'],
                ['Status',      st.l],
                ['Mensalidade', institution.monthly_value ? fmtBRL(institution.monthly_value) : '—'],
                ['Implantação', institution.implementation_value ? fmtBRL(institution.implementation_value) : '—'],
                ['Criado em',   fmtDate(institution.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-400 font-medium">{k}</span>
                  <span className="text-sm text-gray-900 font-semibold text-right">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: Contrato ── */}
        {tab === 'contract' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            {!contract ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">Nenhum contrato gerado</p>
                <p className="text-xs text-gray-400 mt-1">Envie o contrato pelo painel de Onboarding</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: contractSt?.c, background: contractSt?.bg }}>
                      {contractSt?.l}
                    </span>
                    <p className="text-xs text-gray-400 mt-2">Enviado em {fmtDate(contract.created_at)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Signatário',  contract.signer_name || '—'],
                    ['E-mail',      contract.signer_email || '—'],
                    ['Plano',       contract.plan || '—'],
                    ['Mensalidade', contract.monthly_value ? fmtBRL(contract.monthly_value) : '—'],
                    ['Início',      fmtDate(contract.start_date)],
                    ['Vencimento',  fmtDate(contract.end_date)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                      <span className="text-sm text-gray-400">{k}</span>
                      <span className="text-sm text-gray-900 font-semibold">{v}</span>
                    </div>
                  ))}
                </div>

                {contract.sign_url && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 mb-2">Link de assinatura</p>
                    <div className="flex items-center gap-2">
                      <input readOnly className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={contract.sign_url} />
                      <button onClick={() => copyLink(contract.sign_url)} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                        {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                      <a href={contract.sign_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                        <ExternalLink className="w-4 h-4 text-cyan-600" />
                      </a>
                    </div>
                  </div>
                )}

                {contract.status !== 'signed' && (
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        const { error } = await supabase.from('contracts').update({ status: 'signed' }).eq('id', contract.id)
                        if (!error) { showToast('Contrato marcado como assinado!'); loadData() }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Marcar como assinado
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('Excluir este contrato?')) return
                        await supabase.from('contracts').delete().eq('id', contract.id)
                        showToast('Contrato excluído.')
                        loadData()
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl font-semibold text-sm">
                      <X className="w-4 h-4" /> Excluir contrato
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Financeiro ── */}
        {tab === 'financial' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {[
                { id: 'implementation' as const, label: 'Implantação' },
                { id: 'monthly' as const, label: `Mensalidades (${monthlyPayments.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setFinancialTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all
                    ${financialTab === t.id ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Implantação */}
            {financialTab === 'implementation' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                {!implPayment ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500">Nenhuma cobrança de implantação gerada</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ color: PAYMENT_STATUS[implPayment.status]?.c, background: PAYMENT_STATUS[implPayment.status]?.bg }}>
                        {PAYMENT_STATUS[implPayment.status]?.l || implPayment.status}
                      </span>
                      {implPayment.status === 'paid' && implPayment.paid_at && (
                        <span className="text-xs text-green-600 font-semibold">Pago em {fmtDate(implPayment.paid_at)}</span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {[
                        ['Valor',      fmtBRL(implPayment.amount)],
                        ['Vencimento', fmtDate(implPayment.due_date)],
                        ['Descrição',  implPayment.description || '—'],
                        ['ID Asaas',   implPayment.asaas_payment_id || '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between py-2 border-b border-gray-50">
                          <span className="text-sm text-gray-400">{k}</span>
                          <span className="text-sm text-gray-900 font-semibold text-right truncate max-w-[60%]">{v}</span>
                        </div>
                      ))}
                    </div>

                    {implPayment.asaas_charge_url && (
                      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                        <p className="text-xs font-bold text-gray-500 mb-2">Link de pagamento</p>
                        <div className="flex items-center gap-2">
                          <input readOnly className="flex-1 text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-700 truncate" value={implPayment.asaas_charge_url} />
                          <button onClick={() => copyLink(implPayment.asaas_charge_url)} className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                            {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                          </button>
                          <a href={implPayment.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg">
                            <ExternalLink className="w-4 h-4 text-cyan-600" />
                          </a>
                          <button onClick={() => sendWhatsApp(implPayment.asaas_charge_url)} className="p-2 bg-green-50 border border-green-200 rounded-lg">
                            <MessageCircle className="w-4 h-4 text-green-600" />
                          </button>
                        </div>
                      </div>
                    )}

                    {implPayment.status === 'pending' && (
                      <button
                        onClick={async () => {
                          if (!confirm('Marcar como pago manualmente?')) return
                          await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', implPayment.id)
                          await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', id)
                          showToast('Pagamento confirmado! Escola ativada.')
                          loadData()
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white rounded-xl font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4" /> Marcar como pago manualmente
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mensalidades */}
            {financialTab === 'monthly' && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {monthlyPayments.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                    <p className="text-gray-500">Nenhuma mensalidade registrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Descrição','Valor','Vencimento','Pago em','Status',''].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {monthlyPayments.map(p => {
                          const pst = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending
                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 text-sm text-gray-700">{p.description || 'Mensalidade'}</td>
                              <td className="px-5 py-3 text-sm font-semibold text-gray-900">{fmtBRL(p.amount)}</td>
                              <td className="px-5 py-3 text-sm text-gray-500">{fmtDate(p.due_date)}</td>
                              <td className="px-5 py-3 text-sm text-gray-500">{p.paid_at ? fmtDate(p.paid_at) : '—'}</td>
                              <td className="px-5 py-3">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: pst.c, background: pst.bg }}>{pst.l}</span>
                              </td>
                              <td className="px-5 py-3">
                                {p.asaas_charge_url && (
                                  <a href={p.asaas_charge_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-cyan-600">
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Usuários ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-500">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
              <button onClick={() => setShowNewUser(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">
                <Plus className="w-4 h-4" /> Novo usuário
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.map(user => (
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
                        ${user.active ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100' : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'}`}>
                      {user.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {user.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleDeleteUser(user)}
                      className="p-2 bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal novo usuário */}
            {showNewUser && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-gray-900">Novo usuário</h2>
                    <button onClick={() => setShowNewUser(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
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
                      {savingUser ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</> : 'Criar usuário'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </SuperAdminLayout>
  )
}
