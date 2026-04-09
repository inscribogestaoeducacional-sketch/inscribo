// src/components/superadmin/AdminFinancial.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import {
  DollarSign, Building2, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, X, RefreshCw, ExternalLink,
  ChevronRight, AlertCircle, Send, Plus, Filter,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'

// ─── helpers ──────────────────────────────────────────────────────────────
function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function isThisMonth(d: string | null) {
  if (!d) return false
  const dt = new Date(d), now = new Date()
  return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()
}
function daysLate(dueDate: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDate + 'T12:00:00').getTime()) / 86400000))
}

type Tab = 'overview' | 'payments' | 'overdue'

const STATUS_MAP: Record<string, { l: string; c: string; bg: string }> = {
  pending:   { l: 'Pendente',  c: '#6b7280', bg: '#f3f4f6' },
  paid:      { l: 'Pago',      c: '#16a34a', bg: '#f0fdf4' },
  overdue:   { l: 'Atrasado',  c: '#dc2626', bg: '#fef2f2' },
  cancelled: { l: 'Cancelado', c: '#9ca3af', bg: '#f9fafb' },
  refunded:  { l: 'Estornado', c: '#7c3aed', bg: '#f5f3ff' },
}

const TYPE_MAP: Record<string, string> = {
  implementation: 'Implantação',
  monthly:        'Mensalidade',
  extra_conversations: 'Conversas extras',
}

export default function AdminFinancial() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [payments,     setPayments]     = useState<any[]>([])
  const [settings,     setSettings]     = useState<Record<string, string>>({})
  const [loading,      setLoading]      = useState(true)
  const [tab,          setTab]          = useState<Tab>('overview')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterInst,   setFilterInst]   = useState('')
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [actionModal,  setActionModal]  = useState<any | null>(null) // escola com inadimplência

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, payRes, cfgRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, plan, plan_status, asaas_customer_id, monthly_value').order('name'),
      supabase.from('payments').select('*, institutions(name)').order('created_at', { ascending: false }),
      supabase.from('platform_settings').select('key, value'),
    ])
    setInstitutions(instRes.data || [])
    setPayments(payRes.data || [])
    const cfg: Record<string, string> = {}
    for (const s of cfgRes.data || []) cfg[s.key] = s.value
    setSettings(cfg)
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────
  const now = new Date()

  const mrr = payments
    .filter(p => p.status === 'paid' && isThisMonth(p.paid_at))
    .reduce((s, p) => s + (p.amount || 0), 0)

  const mrrProjected = institutions
    .filter(i => i.plan_status === 'active' && i.plan !== 'gratuito')
    .reduce((s, i) => s + (i.monthly_value || 550), 0)

  const overdueList  = payments.filter(p => p.status === 'overdue')
  const overdueTotal = overdueList.reduce((s, p) => s + (p.amount || 0), 0)
  const pendingTotal = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0)
  const churnCount   = institutions.filter(i => ['cancelled','suspended'].includes(i.plan_status)).length

  // MRR dos últimos 6 meses
  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthPaid = payments.filter(p => {
      if (p.status !== 'paid' || !p.paid_at) return false
      const pd = new Date(p.paid_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      mrr:   monthPaid.reduce((s, p) => s + (p.amount || 0), 0),
    }
  })

  // ── Filtros pagamentos ────────────────────────────────────
  const filteredPayments = payments.filter(p => {
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchInst   = !filterInst || p.institution_id === filterInst
    return matchStatus && matchInst
  })

  // ── Ação: reenviar cobrança ────────────────────────────────
  const handleResendCharge = async (payment: any) => {
    try {
      await supabase.functions.invoke('send-email', {
        body: { institution_id: payment.institution_id, template: 'overdue_1' },
      })
      showToast('E-mail de cobrança enviado!')
    } catch {
      showToast('Configure o Resend em Configurações.', false)
    }
  }

  // ── Suspender manualmente ─────────────────────────────────
  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    if (error) showToast('Erro ao suspender.', false)
    else { showToast(`${inst.name} suspenso.`); loadData() }
  }

  const handleReactivate = async (inst: any) => {
    if (!confirm(`Reativar acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', inst.id)
    if (error) showToast('Erro ao reativar.', false)
    else { showToast(`${inst.name} reativado!`); loadData() }
  }

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'

  const overdueByInst = overdueList.reduce((acc, p) => {
    const id = p.institution_id
    if (!acc[id]) acc[id] = { institution: p.institutions, payments: [], total: 0, maxDays: 0 }
    acc[id].payments.push(p)
    acc[id].total += (p.amount || 0)
    const days = daysLate(p.due_date)
    if (days > acc[id].maxDays) acc[id].maxDays = days
    return acc
  }, {} as Record<string, any>)

  const overdueGroups = Object.values(overdueByInst).sort((a: any, b: any) => b.maxDays - a.maxDays)

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
            <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
            <p className="text-sm text-gray-500 mt-1">Receita, cobranças e inadimplência</p>
          </div>
          <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'MRR este mês',    value: fmtBRL(mrr),          sub: `Projeção: ${fmtBRL(mrrProjected)}`, icon: DollarSign,    grad: 'from-green-500 to-emerald-600', trend: mrr > 0 },
            { label: 'Escolas ativas',  value: institutions.filter(i => i.plan_status === 'active').length, sub: `${churnCount} churn`, icon: Building2, grad: 'from-cyan-500 to-blue-600' },
            { label: 'Inadimplência',   value: fmtBRL(overdueTotal), sub: `${overdueList.length} cobranças`, icon: AlertTriangle,  grad: overdueTotal > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
            { label: 'A receber',       value: fmtBRL(pendingTotal), sub: 'cobranças pendentes', icon: Clock, grad: 'from-amber-500 to-orange-500' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{k.label}</p>
                    {loading
                      ? <div className="h-7 w-20 bg-gray-100 rounded animate-pulse" />
                      : <p className="text-xl font-bold text-gray-900">{k.value}</p>
                    }
                    {k.sub && !loading && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${k.grad} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 gap-0">
          {[
            { id: 'overview' as Tab, label: 'Visão geral' },
            { id: 'payments' as Tab, label: `Histórico (${payments.length})` },
            { id: 'overdue'  as Tab, label: `Inadimplência${overdueGroups.length > 0 ? ` (${overdueGroups.length})` : ''}`, alert: overdueGroups.length > 0 },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors
                ${tab === t.id ? 'border-cyan-500 text-cyan-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {t.label}
              {t.alert && <span className="w-2 h-2 rounded-full bg-red-500" />}
            </button>
          ))}
        </div>

        {/* ── TAB: Visão geral ── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Gráfico MRR */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-bold text-gray-900 mb-5">Evolução do MRR — últimos 6 meses</h2>
              {loading
                ? <div className="h-52 bg-gray-50 rounded-xl animate-pulse" />
                : <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={mrrChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9ca3af' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <Tooltip formatter={v => [fmtBRL(Number(v)), 'MRR']} />
                      <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
              }
            </div>

            {/* Status das escolas */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900">Escolas por situação financeira</h2>
              </div>
              {loading
                ? <div className="p-6 space-y-3">{Array(4).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}</div>
                : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Escola','Plano','Status','MRR','Asaas'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {institutions.map(i => {
                          const stMap: Record<string, { l: string; c: string; bg: string }> = {
                            active:           { l: 'Ativo',              c: '#16a34a', bg: '#f0fdf4' },
                            pending_contract: { l: 'Aguard. contrato',   c: '#6366f1', bg: '#eef2ff' },
                            pending_payment:  { l: 'Aguard. pagamento',  c: '#d97706', bg: '#fffbeb' },
                            suspended:        { l: 'Suspenso',           c: '#dc2626', bg: '#fef2f2' },
                            cancelled:        { l: 'Cancelado',          c: '#9ca3af', bg: '#f3f4f6' },
                          }
                          const st = stMap[i.plan_status] || { l: i.plan_status, c: '#6b7280', bg: '#f3f4f6' }
                          return (
                            <tr key={i.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-semibold text-gray-900 text-sm">{i.name}</td>
                              <td className="px-5 py-3 text-sm text-gray-500 capitalize">{i.plan || '—'}</td>
                              <td className="px-5 py-3">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ color: st.c, background: st.bg }}>{st.l}</span>
                              </td>
                              <td className="px-5 py-3 text-sm font-semibold text-gray-700">
                                {i.plan === 'gratuito' ? <span className="text-purple-600">Gratuito</span> : fmtBRL(i.monthly_value || 550)}
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-400">
                                {i.asaas_customer_id
                                  ? <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Vinculado</span>
                                  : <span className="text-gray-400">Não vinculado</span>
                                }
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* ── TAB: Histórico ── */}
        {tab === 'payments' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex gap-3 flex-wrap">
              <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">Todos os status</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
              </select>
              <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-cyan-500 outline-none"
                value={filterInst} onChange={e => setFilterInst(e.target.value)}>
                <option value="">Todas as escolas</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {loading
                ? <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded animate-pulse" />)}</div>
                : filteredPayments.length === 0
                ? <div className="p-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-sm">Nenhum pagamento encontrado</p>
                  </div>
                : <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          {['Escola','Tipo','Valor','Vencimento','Pago em','Status'].map(h => (
                            <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredPayments.slice(0, 50).map(p => {
                          const st = STATUS_MAP[p.status] || STATUS_MAP.pending
                          return (
                            <tr key={p.id} className="hover:bg-gray-50">
                              <td className="px-5 py-3 font-medium text-gray-900 text-sm">{(p as any).institutions?.name || '—'}</td>
                              <td className="px-5 py-3 text-xs text-gray-500">{TYPE_MAP[p.payment_type] || p.payment_type || '—'}</td>
                              <td className="px-5 py-3 font-semibold text-gray-700 text-sm">{fmtBRL(p.amount)}</td>
                              <td className="px-5 py-3 text-sm text-gray-500">
                                {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                              </td>
                              <td className="px-5 py-3 text-sm text-gray-500">
                                {p.paid_at ? new Date(p.paid_at).toLocaleDateString('pt-BR') : '—'}
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                                  style={{ color: st.c, background: st.bg }}>{st.l}</span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
              }
            </div>
          </div>
        )}

        {/* ── TAB: Inadimplência ── */}
        {tab === 'overdue' && (
          <div className="space-y-4">
            {overdueGroups.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <CheckCircle2 className="w-14 h-14 mx-auto mb-4 text-green-400" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">Tudo em dia!</h3>
                <p className="text-gray-500">Nenhuma escola com pagamentos em atraso.</p>
              </div>
            ) : (
              <>
                {/* Resumo */}
                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-800">{overdueGroups.length} escola{overdueGroups.length > 1 ? 's' : ''} inadimplente{overdueGroups.length > 1 ? 's' : ''}</p>
                      <p className="text-sm text-red-600">Total em atraso: <strong>{fmtBRL(overdueTotal)}</strong></p>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <div className="text-center px-4 py-2 bg-white rounded-xl border border-red-200">
                      <p className="text-xs text-gray-500">Fluxo automático</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">
                        D+{settings.overdue_warning1_days || 3} → D+{settings.overdue_warning2_days || 7} → D+{settings.overdue_warning3_days || 15} → Suspensão D+{settings.overdue_suspend_days || 20}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cards por escola */}
                {overdueGroups.map((group: any, i: number) => {
                  const inst = institutions.find(ii => ii.id === group.payments[0]?.institution_id)
                  const isSuspended = inst?.plan_status === 'suspended'
                  const days = group.maxDays
                  const urgency = days >= (Number(settings.overdue_suspend_days) || 20) ? 'red'
                    : days >= (Number(settings.overdue_warning3_days) || 15) ? 'orange'
                    : days >= (Number(settings.overdue_warning2_days) || 7) ? 'amber'
                    : 'yellow'

                  const urgencyColors = {
                    red:    { bg: 'bg-red-50',    border: 'border-red-300',   badge: 'bg-red-500 text-white',    text: 'text-red-700' },
                    orange: { bg: 'bg-orange-50', border: 'border-orange-300', badge: 'bg-orange-500 text-white', text: 'text-orange-700' },
                    amber:  { bg: 'bg-amber-50',  border: 'border-amber-300', badge: 'bg-amber-500 text-white',  text: 'text-amber-700' },
                    yellow: { bg: 'bg-yellow-50', border: 'border-yellow-300', badge: 'bg-yellow-400 text-white', text: 'text-yellow-700' },
                  }
                  const uc = urgencyColors[urgency]

                  return (
                    <div key={i} className={`${uc.bg} border ${uc.border} rounded-2xl p-5`}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-bold text-gray-900 text-sm">{group.institution?.name || inst?.name || '—'}</p>
                              {isSuspended && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-600 text-white rounded-full">SUSPENSO</span>}
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className={`font-bold px-2 py-0.5 rounded-full ${uc.badge}`}>
                                {days}d em atraso
                              </span>
                              <span className={`font-semibold ${uc.text}`}>
                                Total: {fmtBRL(group.total)}
                              </span>
                              <span className="text-gray-500">
                                {group.payments.length} cobrança{group.payments.length > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Ações */}
                        <div className="flex gap-2 flex-wrap">
                          <button onClick={() => handleResendCharge(group.payments[0])}
                            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors">
                            <Send className="w-3.5 h-3.5" /> Enviar cobrança
                          </button>
                          {isSuspended
                            ? <button onClick={() => handleReactivate(inst)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-colors">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Reativar
                              </button>
                            : <button onClick={() => handleSuspend(inst)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-bold hover:bg-red-600 transition-colors">
                                <AlertTriangle className="w-3.5 h-3.5" /> Suspender
                              </button>
                          }
                        </div>
                      </div>

                      {/* Linha do tempo da inadimplência */}
                      <div className="mt-4 flex items-center gap-0">
                        {[
                          { label: `D+${settings.overdue_warning1_days || 3}`, desc: '1º aviso', days: Number(settings.overdue_warning1_days || 3) },
                          { label: `D+${settings.overdue_warning2_days || 7}`, desc: '2º aviso', days: Number(settings.overdue_warning2_days || 7) },
                          { label: `D+${settings.overdue_warning3_days || 15}`, desc: 'Aviso final', days: Number(settings.overdue_warning3_days || 15) },
                          { label: `D+${settings.overdue_suspend_days || 20}`, desc: 'Suspensão', days: Number(settings.overdue_suspend_days || 20) },
                        ].map((step, idx, arr) => {
                          const passed = days >= step.days
                          return (
                            <div key={idx} className="flex items-center flex-1">
                              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                <div className={`w-3 h-3 rounded-full ${passed ? 'bg-red-500 ring-2 ring-red-200' : 'bg-gray-200'}`} />
                                <p className="text-[9px] font-bold text-gray-600">{step.label}</p>
                                <p className="text-[8px] text-gray-400 whitespace-nowrap">{step.desc}</p>
                              </div>
                              {idx < arr.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-1 mb-4 ${days >= arr[idx + 1].days ? 'bg-red-400' : 'bg-gray-200'}`} />
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {/* Cobranças individuais */}
                      <div className="mt-3 space-y-2">
                        {group.payments.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between bg-white rounded-xl px-3 py-2 border border-gray-100 text-xs">
                            <span className="text-gray-500">{TYPE_MAP[p.payment_type] || 'Mensalidade'}</span>
                            <span className="font-semibold text-gray-700">{fmtBRL(p.amount)}</span>
                            <span className="text-gray-400">
                              Venceu {p.due_date ? new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                            </span>
                            <span className="font-bold text-red-600">{daysLate(p.due_date)}d</span>
                          </div>
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