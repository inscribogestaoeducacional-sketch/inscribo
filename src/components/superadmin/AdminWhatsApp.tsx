// src/components/superadmin/AdminWhatsApp.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  MessageCircle, Building2, AlertCircle,
  RefreshCw, Search, DollarSign, Wifi, WifiOff, TrendingUp
} from 'lucide-react'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

interface SchoolWA {
  id: string
  name: string
  plan_status: string
  conversations: number
  limit: number
  extra: number
  extraRevenue: number
}

export default function AdminWhatsApp() {
  const [schools,    setSchools]    = useState<SchoolWA[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [convLimit,  setConvLimit]  = useState(1000)
  const [extraPrice, setExtraPrice] = useState(0.5)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // settings
      const { data: settingsData } = await supabase
        .from('platform_settings')
        .select('key, value')
        .in('key', ['whatsapp_conversation_limit', 'whatsapp_extra_conversation_price'])
      const sm: Record<string, string> = {}
      settingsData?.forEach((r: any) => { sm[r.key] = r.value })
      const limit = Number(sm.whatsapp_conversation_limit  || 1000)
      const price = Number(sm.whatsapp_extra_conversation_price || 0.5)
      setConvLimit(limit)
      setExtraPrice(price)

      // institutions
      const { data: insts } = await supabase
        .from('institutions')
        .select('id, name, plan_status')
        .not('plan_status', 'in', '("cancelled")')
        .order('name')

      if (!insts?.length) { setSchools([]); setLoading(false); return }

      // conversations count this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: convData } = await supabase
        .from('whatsapp_conversations')
        .select('institution_id')
        .gte('created_at', startOfMonth.toISOString())

      const convMap: Record<string, number> = {}
      convData?.forEach((c: any) => {
        convMap[c.institution_id] = (convMap[c.institution_id] || 0) + 1
      })

      setSchools(insts.map(inst => {
        const convs = convMap[inst.id] || 0
        const extra = Math.max(0, convs - limit)
        return {
          id:           inst.id,
          name:         inst.name,
          plan_status:  inst.plan_status,
          conversations: convs,
          limit,
          extra,
          extraRevenue: extra * price,
        }
      }))
    } catch {
      setSchools([])
    }
    setLoading(false)
  }

  const filtered = schools.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const kpis = {
    total:             schools.length,
    withConversations: schools.filter(s => s.conversations > 0).length,
    overLimit:         schools.filter(s => s.extra > 0).length,
    totalConversations: schools.reduce((sum, s) => sum + s.conversations, 0),
    totalExtraRevenue:  schools.reduce((sum, s) => sum + s.extraRevenue, 0),
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
            <p className="text-sm text-gray-500 mt-1">Uso por escola — mês atual</p>
          </div>
          <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Escolas ativas',    value: loading ? '—' : kpis.total,             icon: Building2,      color: 'text-gray-700',  bg: 'bg-gray-50'  },
            { label: 'Com conversas',     value: loading ? '—' : kpis.withConversations,  icon: MessageCircle,  color: 'text-cyan-700',  bg: 'bg-cyan-50'  },
            { label: 'Acima do limite',   value: loading ? '—' : kpis.overLimit,          icon: AlertCircle,    color: 'text-red-700',   bg: 'bg-red-50'   },
            { label: 'Receita extras',    value: loading ? '—' : fmtBRL(kpis.totalExtraRevenue), icon: DollarSign, color: 'text-green-700', bg: 'bg-green-50' },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-200 p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${k.color}`} />
                  <p className="text-xs font-semibold text-gray-500">{k.label}</p>
                </div>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            )
          })}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <TrendingUp className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Limite incluso no plano</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Cada escola tem <strong>{convLimit.toLocaleString('pt-BR')} conversas/mês</strong> inclusas.
              Conversas extras custam <strong>{fmtBRL(extraPrice)} cada</strong>.
              Configure em <strong>Configurações → Financeiro</strong>.
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Buscar escola..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Escola', 'Status', 'Conversas (mês)', 'Limite', 'Extras', 'Receita extra'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>{Array(6).fill(0).map((_, j) => (
                      <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">
                        {search ? 'Nenhuma escola encontrada' : 'Nenhum dado de WhatsApp disponível ainda'}
                      </p>
                    </td>
                  </tr>
                ) : filtered.map(s => {
                  const pct       = s.limit > 0 ? Math.round((s.conversations / s.limit) * 100) : 0
                  const overLimit = s.extra > 0
                  const isActive  = s.plan_status === 'active'
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-cyan-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-cyan-500" />
                          </div>
                          <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full
                          ${isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                          {isActive ? 'Ativo' : s.plan_status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-bold ${overLimit ? 'text-red-600' : 'text-gray-700'}`}>
                            {s.conversations.toLocaleString('pt-BR')}
                          </span>
                          {s.conversations > 0 && (
                            <div className="flex-1 max-w-[80px]">
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${overLimit ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-cyan-500'}`}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5 text-right">{pct}%</p>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {s.limit.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-5 py-4">
                        {s.extra > 0
                          ? <span className="text-sm font-bold text-red-600">+{s.extra.toLocaleString('pt-BR')}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                      <td className="px-5 py-4">
                        {s.extraRevenue > 0
                          ? <span className="text-sm font-bold text-green-700">{fmtBRL(s.extraRevenue)}</span>
                          : <span className="text-xs text-gray-300">—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>{filtered.length} escola{filtered.length !== 1 ? 's' : ''}</span>
              <span>
                Total de conversas este mês:{' '}
                <strong className="text-gray-600">{kpis.totalConversations.toLocaleString('pt-BR')}</strong>
              </span>
            </div>
          )}
        </div>

      </div>
    </SuperAdminLayout>
  )
}
