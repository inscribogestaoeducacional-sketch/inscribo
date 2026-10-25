import React, { useState, useEffect, useRef } from 'react'
import {
  Users,
  Calendar,
  GraduationCap,
  TrendingUp,
  RefreshCw,
  DollarSign,
  BarChart3,
  Target,
  Eye,
  ChevronRight
} from 'lucide-react'
import { DatabaseService } from '../../lib/supabase'
import type { Lead, Visit, Enrollment, MarketingCampaign } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { stageColumns, leadColumnKey, stageLabel } from '../../lib/stageLabels'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  iconBg?: string
  heroColor?: string
  onClick?: () => void
}

function KPICard({ title, value, change, icon, heroColor, onClick }: KPICardProps) {
  if (heroColor) {
    return (
      <div className="card-hero" style={{ background: heroColor, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
        <div className="kpi-label">{title}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-bar"><div className="kpi-bar-fill" style={{ width: '65%' }} /></div>
        {change !== undefined && (
          <div className="kpi-trend">{change >= 0 ? '↑' : '↓'} {Math.abs(change)}% vs. mês anterior</div>
        )}
      </div>
    )
  }
  return (
    <div className="card" style={{ padding: 18, cursor: onClick ? 'pointer' : undefined }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
          {change !== undefined && (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: change >= 0 ? 'var(--color-green-bg)' : 'var(--color-red-bg)', color: change >= 0 ? 'var(--color-green-dk)' : 'var(--color-red-dk)' }}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>{icon}</div>
      </div>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [kpis, setKpis] = useState({
    totalLeads: 0,
    visitasHoje: 0,
    matriculasMes: 0,
    taxaConversao: 0,
    cpaAtual: 0,
    leadsNovos: 0,
    visitasSemana: 0
  })
  const [funnelData, setFunnelData] = useState({
    leads: 0,
    contatos: 0,
    agendamentos: 0,
    visitas: 0,
    propostas: 0,
    matriculas: 0
  })
  // Leads por etapa: uma linha por etapa original e por etapa extra da escola
  const [stageRows, setStageRows] = useState<{ key: string; label: string; extra: boolean; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const [previousMonthKpis, setPreviousMonthKpis] = useState({
    totalLeads: 0,
    visitasHoje: 0,
    matriculasMes: 0,
    taxaConversao: 0
  })

  useEffect(() => {
    mountedRef.current = true
    if (user?.institution_id) loadDashboardData()
    return () => { mountedRef.current = false }
  }, [user])

  const loadDashboardData = async () => {
    if (!user?.institution_id) {
      console.warn('⚠️ Usuário sem institution_id')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError('')
      console.log('📊 Carregando dados do dashboard...')

      let leads: Lead[] = [], visits: Visit[] = [], enrollments: Enrollment[] = [], campaigns: MarketingCampaign[] = []

      try {
        leads = await DatabaseService.getLeads(user.institution_id)
      } catch (error) {
        console.error('⚠️ Erro ao carregar leads:', error)
        leads = []
      }

      try {
        visits = await DatabaseService.getVisits(user.institution_id)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar visitas:', error)
        visits = []
      }

      try {
        enrollments = await DatabaseService.getEnrollments(user.institution_id)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar matrículas:', error)
        enrollments = []
      }

      try {
        campaigns = await DatabaseService.getMarketingCampaigns(user.institution_id)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar campanhas:', error)
        campaigns = []
      }

      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const thisMonth = today.toISOString().slice(0, 7)
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7)

      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0]

      const totalLeads = leads.length
      const leadsNovos = leads.filter(l => l.created_at.startsWith(thisMonth)).length
      const visitasHoje = visits.filter(v => v.scheduled_date.startsWith(todayStr)).length
      const visitasSemana = visits.filter(v => v.scheduled_date >= startOfWeekStr).length
      const matriculasMes = enrollments.filter(e => e.created_at.startsWith(thisMonth)).length

      const leadsConvertidos = leads.filter(l => l.status === 'enrolled').length
      const taxaConversao = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0

      const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
      const totalLeadsGenerated = campaigns.reduce((sum, c) => sum + c.leads_generated, 0)
      const cpaAtual = totalLeadsGenerated > 0 ? totalInvestment / totalLeadsGenerated : 0

      const leadsLastMonth = leads.filter(l => l.created_at.startsWith(lastMonth)).length
      const enrollmentsLastMonth = enrollments.filter(e => e.created_at.startsWith(lastMonth)).length
      const taxaConversaoLastMonth = leadsLastMonth > 0 ? (enrollmentsLastMonth / leadsLastMonth) * 100 : 0

      const leadsCount = leads.length
      const contatosCount = leads.filter(l => ['contact', 'scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length
      const agendamentosCount = leads.filter(l => ['scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length
      const visitasCount = leads.filter(l => ['visit', 'proposal', 'enrolled'].includes(l.status)).length
      const propostasCount = leads.filter(l => ['proposal', 'enrolled'].includes(l.status)).length
      const matriculasCount = leads.filter(l => l.status === 'enrolled').length

      if (!mountedRef.current) return

      setKpis({
        totalLeads,
        visitasHoje,
        matriculasMes,
        taxaConversao: Math.round(taxaConversao * 10) / 10,
        cpaAtual: Math.round(cpaAtual),
        leadsNovos,
        visitasSemana
      })

      setPreviousMonthKpis({
        totalLeads: leadsLastMonth,
        visitasHoje: 0,
        matriculasMes: enrollmentsLastMonth,
        taxaConversao: Math.round(taxaConversaoLastMonth * 10) / 10
      })

      setStageRows(stageColumns().map(c => ({ key: c.key, label: c.custom ? c.custom.label : stageLabel(c.status), extra: !!c.custom, count: leads.filter(l => leadColumnKey(l) === c.key).length })))

      setFunnelData({
        leads: leadsCount,
        contatos: contatosCount,
        agendamentos: agendamentosCount,
        visitas: visitasCount,
        propostas: propostasCount,
        matriculas: matriculasCount
      })

      console.log('✅ Dashboard carregado com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error)
      setError('Erro ao carregar dados do dashboard: ' + (error as Error).message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-lead': navigate('/leads'); break
      case 'schedule-visit': navigate('/visits'); break
      case 'new-enrollment': navigate('/campanha'); break
      case 'view-reports': navigate('/reports'); break
    }
  }

  // ── Date badge ──────────────────────────────────────────────────────────────
  const dateBadge = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  })

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 sm:p-6 md:p-8" style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-gray-200 rounded-xl w-64 mb-2" />
          <div className="h-5 bg-gray-100 rounded w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-36 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center" style={{ background: 'var(--color-bg)', minHeight: '100%' }}>
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-red-200 text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Erro no Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => { setError(''); loadDashboardData() }}
            className="bg-[#2DCBA4] text-white px-6 py-2.5 rounded-xl hover:bg-[#0d9488] transition-all font-semibold"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  // ── KPI cards config ─────────────────────────────────────────────────────────
  const kpiCards = [
    {
      title: 'Total de Leads',
      value: kpis.totalLeads,
      change: calculateChange(kpis.leadsNovos, previousMonthKpis.totalLeads),
      icon: <Users className="h-5 w-5 text-white opacity-75" />,
      iconBg: 'bg-blue-50',
      heroColor: 'var(--color-primary)',
      onClick: () => navigate('/leads')
    },
    {
      title: 'Visitas Hoje',
      value: kpis.visitasHoje,
      change: undefined,
      icon: <Calendar className="h-5 w-5 text-white opacity-75" />,
      iconBg: 'bg-purple-50',
      heroColor: 'var(--color-purple)',
      onClick: () => navigate('/visits')
    },
    {
      title: 'Matrículas do Mês',
      value: kpis.matriculasMes,
      change: calculateChange(kpis.matriculasMes, previousMonthKpis.matriculasMes),
      icon: <GraduationCap className="h-5 w-5 text-purple-600" />,
      iconBg: 'bg-purple-50',
      onClick: () => navigate('/campanha')
    },
    {
      title: 'Taxa de Conversão',
      value: `${kpis.taxaConversao}%`,
      change: calculateChange(kpis.taxaConversao, previousMonthKpis.taxaConversao),
      icon: <TrendingUp className="h-5 w-5 text-orange-500" />,
      iconBg: 'bg-orange-50',
      onClick: () => navigate('/reports')
    },
    {
      title: 'CPA Atual',
      value: `R$ ${kpis.cpaAtual}`,
      icon: <DollarSign className="h-5 w-5 text-rose-500" />,
      iconBg: 'bg-rose-50',
      onClick: () => navigate('/reports')
    }
  ]

  // ── Funnel rows config ───────────────────────────────────────────────────────
  const funnelRows = [
    { etapa: 'Leads Cadastrados',    valor: funnelData.leads,         icon: Users,        pct: 100 },
    { etapa: 'Contatos Realizados',  valor: funnelData.contatos,      icon: Users,        pct: funnelData.leads > 0 ? (funnelData.contatos / funnelData.leads) * 100 : 0 },
    { etapa: 'Visitas Agendadas',    valor: funnelData.agendamentos,  icon: Calendar,     pct: funnelData.leads > 0 ? (funnelData.agendamentos / funnelData.leads) * 100 : 0 },
    { etapa: 'Visitas Realizadas',   valor: funnelData.visitas,       icon: Eye,          pct: funnelData.leads > 0 ? (funnelData.visitas / funnelData.leads) * 100 : 0 },
    { etapa: 'Propostas Enviadas',   valor: funnelData.propostas,     icon: Target,       pct: funnelData.leads > 0 ? (funnelData.propostas / funnelData.leads) * 100 : 0 },
    { etapa: 'Matrículas Efetivadas',valor: funnelData.matriculas,    icon: GraduationCap,pct: funnelData.leads > 0 ? (funnelData.matriculas / funnelData.leads) * 100 : 0 },
  ]

  // ── Quick actions config ─────────────────────────────────────────────────────
  const quickActions = [
    { action: 'new-lead',       label: 'Novo Lead',       icon: <Users className="w-6 h-6" />,          color: 'text-blue-600',    bg: 'bg-blue-50  hover:bg-blue-100' },
    { action: 'schedule-visit', label: 'Agendar Visita',  icon: <Calendar className="w-6 h-6" />,       color: 'text-[#2DCBA4]',   bg: 'bg-[#2DCBA4]/10 hover:bg-[#2DCBA4]/20' },
    { action: 'new-enrollment', label: 'Nova Matrícula',  icon: <GraduationCap className="w-6 h-6" />,  color: 'text-purple-600',  bg: 'bg-purple-50 hover:bg-purple-100' },
    { action: 'view-reports',   label: 'Ver Relatórios',  icon: <BarChart3 className="w-6 h-6" />,      color: 'text-orange-500',  bg: 'bg-orange-50 hover:bg-orange-100' },
  ]

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: 'var(--bg-page)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1A2B4A]">
            Olá, {user?.full_name?.split(' ')[0] || 'Usuário'}!
          </h1>
          <p className="text-gray-500 mt-1">Vamos matricular hoje!</p>
        </div>
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-600 shadow-sm self-start sm:self-auto capitalize">
          <Calendar className="w-4 h-4 text-[#2DCBA4]" />
          {dateBadge}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {kpiCards.map((kpi, i) => (
          <KPICard key={i} {...kpi} />
        ))}
      </div>

      {/* ── Leads por etapa (etapas extras da escola aparecem com linha própria) ── */}
      {stageRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5 sm:mb-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-[#1A2B4A]">Leads por etapa</h3>
            <span className="text-xs text-gray-400">{stageRows.reduce((a, r) => a + r.count, 0)} leads</span>
          </div>
          <div className="px-6 py-4 space-y-2.5">
            {(() => {
              const max = Math.max(1, ...stageRows.map(r => r.count))
              return stageRows.map(r => (
                <div key={r.key} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-sm text-gray-700 truncate">
                    {r.label}{r.extra && <span className="ml-1.5 text-[10px] font-bold bg-[#05907B] text-white rounded-full px-2 py-0.5 align-middle">EXTRA</span>}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${r.count ? Math.max(3, (r.count / max) * 100) : 0}%`, background: r.extra ? '#5CCBBF' : '#05907B' }} />
                  </div>
                  <span className="w-10 text-right text-sm font-bold text-[#1A2B4A]">{r.count}</span>
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* ── Bottom row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 bg-[#1A2B4A]">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#2DCBA4]" />
              <h3 className="text-base font-bold text-white">Funil de Conversão</h3>
            </div>
            <span className="text-xs text-white/60">{funnelData.leads} leads totais</span>
          </div>

          <div className="p-6 space-y-5">
            {funnelRows.map((row, i) => {
              const Icon = row.icon
              const pct = Math.round(row.pct * 10) / 10
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-700">{row.etapa}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#1A2B4A]">{row.valor}</span>
                      <span className="text-xs font-semibold bg-[#2DCBA4]/10 text-[#0d9488] px-2 py-0.5 rounded-full">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-[#2DCBA4] to-[#0d9488] transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-[#1A2B4A]">Ações Rápidas</h3>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {quickActions.map(qa => (
              <button
                key={qa.action}
                onClick={() => handleQuickAction(qa.action)}
                className={`flex flex-col items-start gap-3 p-4 rounded-xl transition-all duration-200 group ${qa.bg}`}
              >
                <div className={qa.color}>{qa.icon}</div>
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-semibold ${qa.color}`}>{qa.label}</span>
                  <ChevronRight className={`w-3.5 h-3.5 ${qa.color} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} />
                </div>
              </button>
            ))}
          </div>

          {/* Resumo Rápido */}
          <div className="mx-4 mb-4 mt-1 bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Resumo do período</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Leads Novos (mês)</span>
                <span className="text-sm font-bold text-blue-600">{kpis.leadsNovos}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Visitas (semana)</span>
                <span className="text-sm font-bold text-[#2DCBA4]">{kpis.visitasSemana}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Conversão</span>
                <span className="text-sm font-bold text-purple-600">{kpis.taxaConversao}%</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
