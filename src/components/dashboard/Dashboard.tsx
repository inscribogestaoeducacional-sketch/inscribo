import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Calendar, 
  GraduationCap, 
  TrendingUp, 
  RefreshCw, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  BarChart3,
  Target,
  Eye,
  LogOut
} from 'lucide-react'
import { DatabaseService } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
  onClick?: () => void
}

function KPICard({ title, value, change, icon, color, onClick }: KPICardProps) {
  const isPositive = change ? change >= 0 : true
  
  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
          {change !== undefined && (
            <div className="flex items-center">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span
                className={`text-xs font-medium ${
                  isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {isPositive ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-gray-500 ml-2">vs. mês anterior</span>
            </div>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${color} flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [kpis, setKpis] = useState({
    totalLeads: 0,
    visitasHoje: 0,
    matriculasMes: 0,
    taxaConversao: 0,
    cpaAtual: 0,
    taxaRematricula: 0,
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
  const [loading, setLoading] = useState(true)
  const [previousMonthKpis, setPreviousMonthKpis] = useState({
    totalLeads: 0,
    visitasHoje: 0,
    matriculasMes: 0,
    taxaConversao: 0
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadDashboardData()
    }
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
      
      // Carregar dados em paralelo
      let leads = [], visits = [], enrollments = [], campaigns = []
      
      try {
        console.log('📈 Carregando leads...')
        leads = await DatabaseService.getLeads(user.institution_id)
        console.log('✅ Leads carregados:', leads.length)
      } catch (error) {
        console.error('⚠️ Erro ao carregar leads:', error)
        leads = []
      }
      
      try {
        console.log('📅 Carregando visitas...')
        visits = await DatabaseService.getVisits(user.institution_id)
        console.log('✅ Visitas carregadas:', visits.length)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar visitas:', error)
        visits = []
      }
      
      try {
        console.log('🎓 Carregando matrículas...')
        enrollments = await DatabaseService.getEnrollments(user.institution_id)
        console.log('✅ Matrículas carregadas:', enrollments.length)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar matrículas:', error)
        enrollments = []
      }
      
      try {
        console.log('📢 Carregando campanhas...')
        campaigns = await DatabaseService.getMarketingCampaigns(user.institution_id)
        console.log('✅ Campanhas carregadas:', campaigns.length)
      } catch (error) {
        console.warn('⚠️ Erro ao carregar campanhas:', error)
        campaigns = []
      }

      // Datas para cálculos
      const today = new Date()
      const todayStr = today.toISOString().split('T')[0]
      const thisMonth = today.toISOString().slice(0, 7)
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7)
      
      // Início da semana (domingo)
      const startOfWeek = new Date(today)
      startOfWeek.setDate(today.getDate() - today.getDay())
      const startOfWeekStr = startOfWeek.toISOString().split('T')[0]

      // KPIs atuais
      const totalLeads = leads.length
      const leadsNovos = leads.filter(l => l.created_at.startsWith(thisMonth)).length
      const visitasHoje = visits.filter(v => v.scheduled_date.startsWith(todayStr)).length
      const visitasSemana = visits.filter(v => v.scheduled_date >= startOfWeekStr).length
      const matriculasMes = enrollments.filter(e => e.created_at.startsWith(thisMonth)).length
      
      // Taxa de conversão
      const leadsConvertidos = leads.filter(l => l.status === 'enrolled').length
      const taxaConversao = totalLeads > 0 ? (leadsConvertidos / totalLeads) * 100 : 0

      // CPA
      const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
      const totalLeadsGenerated = campaigns.reduce((sum, c) => sum + c.leads_generated, 0)
      const cpaAtual = totalLeadsGenerated > 0 ? totalInvestment / totalLeadsGenerated : 0

      // KPIs do mês anterior para comparação
      const leadsLastMonth = leads.filter(l => l.created_at.startsWith(lastMonth)).length
      const enrollmentsLastMonth = enrollments.filter(e => e.created_at.startsWith(lastMonth)).length
      const taxaConversaoLastMonth = leadsLastMonth > 0 ? (enrollmentsLastMonth / leadsLastMonth) * 100 : 0

      // Dados do funil
      const leadsCount = leads.length
      const contatosCount = leads.filter(l => ['contact', 'scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length
      const agendamentosCount = leads.filter(l => ['scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length
      const visitasCount = leads.filter(l => ['visit', 'proposal', 'enrolled'].includes(l.status)).length
      const propostasCount = leads.filter(l => ['proposal', 'enrolled'].includes(l.status)).length
      const matriculasCount = leads.filter(l => l.status === 'enrolled').length

      setKpis({
        totalLeads,
        visitasHoje,
        matriculasMes,
        taxaConversao: Math.round(taxaConversao * 10) / 10,
        cpaAtual: Math.round(cpaAtual),
        taxaRematricula: 92.5, // Valor fixo por enquanto
        leadsNovos,
        visitasSemana
      })

      setPreviousMonthKpis({
        totalLeads: leadsLastMonth,
        visitasHoje: 0, // Não faz sentido comparar visitas de hoje com mês anterior
        matriculasMes: enrollmentsLastMonth,
        taxaConversao: Math.round(taxaConversaoLastMonth * 10) / 10
      })

      setFunnelData({
        leads: leadsCount,
        contatos: contatosCount,
        agendamentos: agendamentosCount,
        visitas: visitasCount,
        propostas: propostasCount,
        matriculas: matriculasCount
      })

      console.log('✅ Dashboard carregado com sucesso!')
      console.log('📊 KPIs:', { totalLeads, leadsNovos, matriculasMes, taxaConversao })
    } catch (error) {
      console.error('❌ Erro ao carregar dashboard:', error)
      setError('Erro ao carregar dados do dashboard: ' + (error as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0
    return Math.round(((current - previous) / previous) * 100)
  }

  const handleForceLogin = async () => {
    if (confirm('Tem certeza que deseja fazer logout e limpar todos os dados da sessão?')) {
      await signOut()
    }
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'new-lead':
        navigate('/leads')
        break
      case 'schedule-visit':
        navigate('/visits')
        break
      case 'new-enrollment':
        navigate('/enrollments')
        break
      case 'view-reports':
        navigate('/reports')
        break
      default:
        break
    }
  }

  // Debug info
  console.log('🔍 Dashboard render - User:', user?.full_name, 'Loading:', loading, 'Error:', error)

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-xl w-80 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-2xl"></div>
            <div className="h-96 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 bg-gradient-to-br from-red-50 via-white to-red-50 min-h-screen">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-red-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Erro no Dashboard</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-x-4">
              <button
                onClick={() => {
                  setError('')
                  loadDashboardData()
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all"
              >
                Tentar Novamente
              </button>
              <button
                onClick={handleForceLogin}
                className="bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 transition-all"
              >
                Fazer Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }
  const kpiCards = [
    {
      title: 'Total de Leads',
      value: kpis.totalLeads,
      change: calculateChange(kpis.leadsNovos, previousMonthKpis.totalLeads),
      icon: <Users className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100',
      onClick: () => navigate('/leads')
    },
    {
      title: 'Visitas Hoje',
      value: kpis.visitasHoje,
      change: undefined, // Não faz sentido comparar visitas de hoje
      icon: <Calendar className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100',
      onClick: () => navigate('/visits')
    },
    {
      title: 'Matrículas do Mês',
      value: kpis.matriculasMes,
      change: calculateChange(kpis.matriculasMes, previousMonthKpis.matriculasMes),
      icon: <GraduationCap className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100',
      onClick: () => navigate('/enrollments')
    },
    {
      title: 'Taxa de Conversão',
      value: `${kpis.taxaConversao}%`,
      change: calculateChange(kpis.taxaConversao, previousMonthKpis.taxaConversao),
      icon: <TrendingUp className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-100',
      onClick: () => navigate('/funnel')
    },
    {
      title: 'CPA Atual',
      value: `R$ ${kpis.cpaAtual}`,
      change: -2.1, // Valor fixo por enquanto
      icon: <DollarSign className="h-6 w-6 text-red-600" />,
      color: 'bg-red-100',
      onClick: () => navigate('/marketing')
    },
    {
      title: 'Taxa Rematrícula',
      value: `${kpis.taxaRematricula}%`,
      change: 2.1, // Valor fixo por enquanto
      icon: <RefreshCw className="h-6 w-6 text-teal-600" />,
      color: 'bg-teal-100',
      onClick: () => navigate('/reenrollments')
    }
  ]

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600 text-lg">Visão geral do sistema Inscribo</p>
            {user && (
              <p className="text-sm text-gray-500 mt-1">
                Bem-vindo, <strong>{user.full_name}</strong> • {user.role === 'admin' ? 'Administrador' : user.role === 'manager' ? 'Gestor' : 'Consultor'}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => loadDashboardData()}
              className="flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl border border-blue-200 hover:border-blue-300 transition-colors"
              title="Atualizar dados do dashboard"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </button>
            <button
              onClick={handleForceLogin}
              className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl border border-red-200 hover:border-red-300 transition-colors"
              title="Forçar novo login (limpa sessão e cookies)"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-bold text-gray-900">Funil de Conversão</h3>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>
          <div className="space-y-6">
            {[
              { etapa: 'Leads Cadastrados', valor: funnelData.leads, percentual: 100, cor: 'bg-blue-500', icon: Users },
              { etapa: 'Contatos Realizados', valor: funnelData.contatos, percentual: funnelData.leads > 0 ? (funnelData.contatos / funnelData.leads) * 100 : 0, cor: 'bg-green-500', icon: Users },
              { etapa: 'Visitas Agendadas', valor: funnelData.agendamentos, percentual: funnelData.leads > 0 ? (funnelData.agendamentos / funnelData.leads) * 100 : 0, cor: 'bg-yellow-500', icon: Calendar },
              { etapa: 'Visitas Realizadas', valor: funnelData.visitas, percentual: funnelData.leads > 0 ? (funnelData.visitas / funnelData.leads) * 100 : 0, cor: 'bg-orange-500', icon: Eye },
              { etapa: 'Propostas Enviadas', valor: funnelData.propostas, percentual: funnelData.leads > 0 ? (funnelData.propostas / funnelData.leads) * 100 : 0, cor: 'bg-indigo-500', icon: Target },
              { etapa: 'Matrículas Efetivadas', valor: funnelData.matriculas, percentual: funnelData.leads > 0 ? (funnelData.matriculas / funnelData.leads) * 100 : 0, cor: 'bg-purple-500', icon: GraduationCap }
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <div key={index} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Icon className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">{item.etapa}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{item.valor}</span>
                      <span className="text-xs text-gray-500">({item.percentual.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${item.cor} transition-all duration-500 shadow-sm`}
                      style={{ width: `${Math.max(item.percentual, 2)}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Ações Rápidas</h3>
          <div className="space-y-3">
            <button 
              onClick={() => handleQuickAction('new-lead')}
              className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-200 group hover:shadow-md"
            >
              <span className="text-sm font-semibold text-blue-700">Novo Lead</span>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <Plus className="h-3 w-3 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button 
              onClick={() => handleQuickAction('schedule-visit')}
              className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-all duration-200 group hover:shadow-md"
            >
              <span className="text-sm font-semibold text-green-700">Agendar Visita</span>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <Plus className="h-3 w-3 text-green-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button 
              onClick={() => handleQuickAction('new-enrollment')}
              className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all duration-200 group hover:shadow-md"
            >
              <span className="text-sm font-semibold text-purple-700">Nova Matrícula</span>
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-purple-600" />
                <Plus className="h-3 w-3 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button 
              onClick={() => handleQuickAction('view-reports')}
              className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all duration-200 group hover:shadow-md"
            >
              <span className="text-sm font-semibold text-orange-700">Ver Relatórios</span>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                <ArrowUpRight className="h-3 w-3 text-orange-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
          </div>

          {/* Resumo Rápido */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h4 className="text-lg font-bold text-gray-900 mb-4">Resumo Rápido</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Leads Novos (mês)</span>
                <span className="font-bold text-blue-600">{kpis.leadsNovos}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Visitas (semana)</span>
                <span className="font-bold text-green-600">{kpis.visitasSemana}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Conversão</span>
                <span className="font-bold text-purple-600">{kpis.taxaConversao}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}