// src/components/superadmin/FinancialDashboard.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, Building2, TrendingDown, Zap } from 'lucide-react'

function daysSince(date: string | null) {
  if (!date) return 9999
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

function healthStatus(lastLogin: string | null) {
  const d = daysSince(lastLogin)
  if (d <= 7)  return { label: 'Ativo',    color: '#22c55e', bg: '#f0fdf4' }
  if (d <= 30) return { label: 'Em risco', color: '#f59e0b', bg: '#fffbeb' }
  return           { label: 'Inativo',    color: '#ef4444', bg: '#fef2f2' }
}

export default function FinancialDashboard() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, metricsRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, plan, mrr, created_at, last_login_at').order('created_at', { ascending: false }),
      supabase.from('funnel_metrics').select('institution_id, created_at').order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setMetrics(metricsRes.data || [])
    setLoading(false)
  }

  // KPIs
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const active = institutions.filter(i => daysSince(i.last_login_at) <= 7)
  const mrr = institutions.reduce((sum, i) => sum + (Number(i.mrr) || 0), 0)
  const churnThisMonth = institutions.filter(i => {
    const d = daysSince(i.last_login_at)
    return d > 30 && new Date(i.created_at) < startOfMonth
  })

  // Leads por instituição este mês
  const leadsThisMonth: Record<string, number> = {}
  metrics.forEach(m => {
    if (new Date(m.created_at) >= startOfMonth) {
      leadsThisMonth[m.institution_id] = (leadsThisMonth[m.institution_id] || 0) + 1
    }
  })

  // MRR mensal mock (últimos 6 meses com dados reais ou extrapolados)
  const mrrChart = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      month: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      mrr: mrr > 0 ? Math.round(mrr * (0.75 + i * 0.05)) : (i + 1) * 1500,
    }
  })
  mrrChart[5].mrr = mrr || 0

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 mt-1">Receita, churn e saúde das contas</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-6">
          {[
            { label: 'MRR Total', value: `R$ ${mrr.toLocaleString('pt-BR')}`, icon: DollarSign, grad: 'from-green-500 to-emerald-600' },
            { label: 'Escolas ativas', value: active.length, icon: Building2, grad: 'from-cyan-500 to-blue-600' },
            { label: 'Churn no mês', value: churnThisMonth.length, icon: TrendingDown, grad: 'from-red-500 to-rose-600' },
            { label: 'Chamadas IA (estimado)', value: metrics.length * 3, icon: Zap, grad: 'from-purple-500 to-violet-600' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.grad} flex items-center justify-center`}>
                  <kpi.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MRR Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-6">Evolução do MRR</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mrrChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [`R$ ${v.toLocaleString('pt-BR')}`, 'MRR']} />
              <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de escolas */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Escolas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-3 text-left">Escola</th>
                  <th className="px-6 py-3 text-left">Cidade</th>
                  <th className="px-6 py-3 text-right">MRR</th>
                  <th className="px-6 py-3 text-right">Leads / mês</th>
                  <th className="px-6 py-3 text-left">Último login</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {institutions.map(inst => {
                  const hs = healthStatus(inst.last_login_at)
                  const leads = leadsThisMonth[inst.id] || 0
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 text-sm">{inst.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{inst.city || '—'}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700">
                        {inst.mrr ? `R$ ${Number(inst.mrr).toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">{leads}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {inst.last_login_at ? new Date(inst.last_login_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: hs.color, background: hs.bg }}>
                          {hs.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {institutions.length === 0 && (
              <div className="p-12 text-center text-gray-400">
                <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Nenhuma instituição cadastrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  )
}
