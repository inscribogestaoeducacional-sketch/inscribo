// src/components/superadmin/AdminHome.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import {
  DollarSign, Building2, AlertTriangle, TrendingUp,
  Plus, Megaphone, UserPlus, ArrowRight, CheckCircle2, Clock,
  FileText, Activity
} from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

function isThisMonth(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export default function AdminHome() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, contractRes, payRes] = await Promise.all([
      supabase.from('institutions').select('id, name, plan, plan_status, last_login_at, created_at'),
      supabase.from('contracts').select('id, status, created_at, institution_id, monthly_value').order('created_at', { ascending: false }),
      supabase.from('payments').select('id, status, amount, paid_at, due_date').order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setContracts(contractRes.data || [])
    setPayments(payRes.data || [])
    setLoading(false)
  }

  // ── KPIs ──────────────────────────────────────────────────────
  const mrr = payments
    .filter(p => p.status === 'paid' && isThisMonth(p.paid_at))
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const activeSchools = institutions.filter(i => i.plan_status === 'active').length
  const trialSchools = institutions.filter(i => i.plan === 'trial').length
  const overduePayments = payments.filter(p => p.status === 'overdue').length

  // ── MRR últimos 6 meses ───────────────────────────────────────
  const now = new Date()
  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const monthPaid = payments.filter(p => {
      if (p.status !== 'paid' || !p.paid_at) return false
      const pd = new Date(p.paid_at)
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth()
    })
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      mrr: monthPaid.reduce((s, p) => s + (p.amount || 0), 0),
    }
  })

  // ── Escolas por status ────────────────────────────────────────
  const statusCounts = [
    { name: 'Ativas', value: activeSchools, color: '#22c55e' },
    { name: 'Trial', value: trialSchools, color: '#f59e0b' },
    { name: 'Outras', value: Math.max(0, institutions.length - activeSchools - trialSchools), color: '#e5e7eb' },
  ].filter(s => s.value > 0)

  // ── Últimas atividades ────────────────────────────────────────
  const recentContracts = contracts.slice(0, 5)

  const alerts: { msg: string; type: 'warning' | 'info' }[] = []
  if (overduePayments > 0) alerts.push({ msg: `${overduePayments} pagamento${overduePayments > 1 ? 's' : ''} em atraso`, type: 'warning' })
  if (trialSchools > 0) alerts.push({ msg: `${trialSchools} escola${trialSchools > 1 ? 's' : ''} em período trial`, type: 'info' })

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Geral · Áion Edu</h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <Skeleton h="h-3" w="w-24" />
                <Skeleton h="h-8" w="w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'MRR este mês', value: fmtBRL(mrr), icon: DollarSign, grad: 'from-green-500 to-emerald-600' },
              { label: 'Escolas ativas', value: activeSchools, icon: Building2, grad: 'from-cyan-500 to-blue-600' },
              { label: 'Em trial', value: trialSchools, icon: Clock, grad: 'from-amber-500 to-orange-500' },
              { label: 'Inadimplentes', value: overduePayments, icon: AlertTriangle, grad: overduePayments > 0 ? 'from-red-500 to-rose-600' : 'from-gray-400 to-gray-500' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.grad} flex items-center justify-center flex-shrink-0`}>
                    <kpi.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* MRR Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-6">MRR últimos 6 meses</h2>
            {loading ? <Skeleton h="h-48" /> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={mrrChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [fmtBRL(Number(v)), 'MRR']} />
                  <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h2 className="font-bold text-gray-900 mb-4">Escolas por status</h2>
            {loading ? <Skeleton h="h-48" /> : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                      {statusCounts.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip formatter={(v, name) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {statusCounts.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                        <span className="text-gray-600">{s.name}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Alertas + Últimas atividades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Alertas */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Alertas do sistema</h2>
            </div>
            <div className="p-6 space-y-3">
              {loading ? (
                Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />)
              ) : alerts.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />
                  <p className="text-sm font-medium text-gray-600">Tudo em ordem</p>
                </div>
              ) : alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg ${a.type === 'warning' ? 'bg-red-50' : 'bg-blue-50'}`}>
                  <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${a.type === 'warning' ? 'text-red-500' : 'text-blue-500'}`} />
                  <p className={`text-sm font-medium ${a.type === 'warning' ? 'text-red-700' : 'text-blue-700'}`}>{a.msg}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Últimos contratos */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Últimas atividades</h2>
              <Link to="/super-admin/contracts" className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium">
                Ver contratos <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {loading ? (
                <div className="p-6 space-y-3">{Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />)}</div>
              ) : recentContracts.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhum contrato ainda</p>
                </div>
              ) : recentContracts.map(c => {
                const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                  draft:     { label: 'Rascunho', color: '#6b7280', bg: '#f3f4f6' },
                  sent:      { label: 'Enviado',  color: '#d97706', bg: '#fffbeb' },
                  signed:    { label: 'Assinado', color: '#16a34a', bg: '#f0fdf4' },
                  cancelled: { label: 'Cancelado',color: '#dc2626', bg: '#fef2f2' },
                  expired:   { label: 'Expirado', color: '#9ca3af', bg: '#f9fafb' },
                }
                const st = statusMap[c.status] || statusMap.draft
                return (
                  <div key={c.id} className="px-6 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">Contrato #{c.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-4">Ações rápidas</h2>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/super-admin/schools"
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
            >
              <Megaphone className="w-4 h-4" /> Liberar campanha
            </Link>
            <Link
              to="/super-admin/schools"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              <Plus className="w-4 h-4" /> Nova escola
            </Link>
            <Link
              to="/super-admin/consultants"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              <UserPlus className="w-4 h-4" /> Novo consultor
            </Link>
            <Link
              to="/super-admin/contracts"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" /> Novo contrato
            </Link>
            <Link
              to="/super-admin/financial"
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
            >
              <Activity className="w-4 h-4" /> Ver financeiro
            </Link>
          </div>
        </div>

      </div>
    </SuperAdminLayout>
  )
}
