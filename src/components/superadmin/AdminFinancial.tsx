// src/components/superadmin/AdminFinancial.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DollarSign, Building2, TrendingDown, AlertTriangle, CreditCard, ExternalLink } from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function isThisMonth(dateStr: string | null) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

export default function AdminFinancial() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAsaasInstructions, setShowAsaasInstructions] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, payRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, plan, plan_status, asaas_customer_id').order('name'),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setPayments(payRes.data || [])
    setLoading(false)
  }

  const now = new Date()

  // ── KPIs ─────────────────────────────────────────────────────
  const mrr = payments
    .filter(p => p.status === 'paid' && isThisMonth(p.paid_at))
    .reduce((sum, p) => sum + (p.amount || 0), 0)

  const activeInstitutions = institutions.filter(i => i.plan_status === 'active').length

  const overdueList = payments.filter(p => p.status === 'overdue')
  const overdueTotal = overdueList.reduce((sum, p) => sum + (p.amount || 0), 0)

  const churnCount = institutions.filter(i => i.plan_status === 'cancelled' || i.plan_status === 'suspended').length

  // ── MRR últimos 6 meses ───────────────────────────────────────
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

  // ── Days overdue ──────────────────────────────────────────────
  const daysOverdue = (dueDateStr: string) => {
    const diff = Date.now() - new Date(dueDateStr + 'T12:00:00').getTime()
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-gray-500 mt-1">Receita, cobranças e inadimplência</p>
        </div>

        {/* KPIs */}
        {loading ? (
          <div className="grid grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
                <Skeleton h="h-3" w="w-24" />
                <Skeleton h="h-8" w="w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'MRR este mês', value: fmtBRL(mrr), icon: DollarSign, grad: 'from-green-500 to-emerald-600' },
              { label: 'Escolas ativas', value: activeInstitutions, icon: Building2, grad: 'from-cyan-500 to-blue-600' },
              { label: 'Churn', value: churnCount, icon: TrendingDown, grad: 'from-red-500 to-rose-600' },
              { label: 'Inadimplência', value: fmtBRL(overdueTotal), icon: AlertTriangle, grad: overdueTotal > 0 ? 'from-amber-500 to-orange-500' : 'from-gray-400 to-gray-500' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
                    <p className="text-xl font-bold text-gray-900">{kpi.value}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${kpi.grad} flex items-center justify-center flex-shrink-0`}>
                    <kpi.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Asaas Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-amber-800">Módulo de pagamento automático</p>
                <p className="text-sm text-amber-700 mt-1">
                  Integração Asaas configurada e pronta para ativar. Adicione a chave API nas
                  variáveis de ambiente para ativar cobranças automáticas de R$ 550/mês por escola.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAsaasInstructions(!showAsaasInstructions)}
              className="text-sm text-amber-700 underline whitespace-nowrap flex-shrink-0"
            >
              {showAsaasInstructions ? 'Ocultar' : 'Ver instruções'}
            </button>
          </div>

          {showAsaasInstructions && (
            <div className="mt-4 bg-white rounded-lg border border-amber-200 p-4 text-sm text-gray-700 space-y-2">
              <p className="font-semibold text-gray-800">Configuração Asaas:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600">
                <li>Acesse <strong>Configurações → API</strong> no painel Asaas</li>
                <li>Copie a chave API de produção</li>
                <li>Adicione <code className="bg-gray-100 px-1 rounded">ASAAS_API_KEY</code> nas variáveis de ambiente do Supabase</li>
                <li>Acesse <strong>Admin → Configurações</strong> neste painel para inserir a chave</li>
              </ol>
              <div className="pt-2 border-t border-gray-100 space-y-1 text-xs text-gray-500">
                <p><strong>POST</strong> https://api.asaas.com/v3/customers — criar cliente</p>
                <p><strong>POST</strong> https://api.asaas.com/v3/subscriptions — assinatura R$ 550/mês</p>
                <p><strong>Webhook</strong> /api/asaas-webhook — atualiza status de pagamento</p>
              </div>
            </div>
          )}
        </div>

        {/* MRR Chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-900 mb-6">Evolução do MRR</h2>
          {loading ? <Skeleton h="h-52" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mrrChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [fmtBRL(Number(v)), 'MRR']} />
                <Line type="monotone" dataKey="mrr" stroke="#14b8a6" strokeWidth={3} dot={{ fill: '#14b8a6', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Inadimplentes */}
        {!loading && overdueList.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="font-bold text-gray-900">Inadimplentes</h2>
              <span className="ml-auto text-sm font-semibold text-red-600">Total: {fmtBRL(overdueTotal)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">Escola</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-left">Vencimento</th>
                    <th className="px-6 py-3 text-right">Dias em atraso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {overdueList.map(p => {
                    const inst = institutions.find(i => i.id === p.institution_id)
                    const days = daysOverdue(p.due_date)
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900 text-sm">{inst?.name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-red-600">{fmtBRL(p.amount)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${days > 30 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {days}d
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All payments */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-gray-900">Histórico de pagamentos</h2>
          </div>
          {loading ? (
            <div className="p-6 space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} h="h-10" />)}</div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhum pagamento registrado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">Escola</th>
                    <th className="px-6 py-3 text-right">Valor</th>
                    <th className="px-6 py-3 text-left">Vencimento</th>
                    <th className="px-6 py-3 text-left">Método</th>
                    <th className="px-6 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payments.slice(0, 50).map(p => {
                    const inst = institutions.find(i => i.id === p.institution_id)
                    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                      pending:   { label: 'Pendente',   color: '#6b7280', bg: '#f3f4f6' },
                      paid:      { label: 'Pago',       color: '#16a34a', bg: '#f0fdf4' },
                      overdue:   { label: 'Atrasado',   color: '#dc2626', bg: '#fef2f2' },
                      cancelled: { label: 'Cancelado',  color: '#9ca3af', bg: '#f9fafb' },
                      refunded:  { label: 'Estornado',  color: '#7c3aed', bg: '#f5f3ff' },
                    }
                    const st = statusMap[p.status] || statusMap.pending
                    return (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{inst?.name || '—'}</td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700">{fmtBRL(p.amount)}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(p.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 capitalize">{p.payment_method || '—'}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </SuperAdminLayout>
  )
}
