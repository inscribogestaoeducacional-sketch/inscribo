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
  BarChart3
} from 'lucide-react'
import { DatabaseService } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
}

function KPICard({ title, value, change, icon, color }: KPICardProps) {
  const isPositive = change ? change >= 0 : true
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
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
  const { user } = useAuth()
  const [kpis, setKpis] = useState({
    totalLeads: 0,
    visitasHoje: 0,
    matriculasMes: 0,
    taxaConversao: 0,
    cpaAtual: 0,
    taxaRematricula: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.institution_id) {
      loadKPIs()
    }
  }, [user])

  const loadKPIs = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getDashboardKPIs(user!.institution_id)
      setKpis(data)
    } catch (error) {
      console.error('Error loading KPIs:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const kpiCards = [
    {
      title: 'Total de Leads',
      value: kpis.totalLeads,
      change: 12.5,
      icon: <Users className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      title: 'Visitas Hoje',
      value: kpis.visitasHoje,
      change: 5.2,
      icon: <Calendar className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      title: 'Matrículas do Mês',
      value: kpis.matriculasMes,
      change: 8.1,
      icon: <GraduationCap className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      title: 'Taxa de Conversão',
      value: `${kpis.taxaConversao}%`,
      change: 1.4,
      icon: <TrendingUp className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-100'
    },
    {
      title: 'CPA Atual',
      value: `R$ ${kpis.cpaAtual}`,
      change: -2.1,
      icon: <DollarSign className="h-6 w-6 text-red-600" />,
      color: 'bg-red-100'
    },
    {
      title: 'Taxa Rematrícula',
      value: `${kpis.taxaRematricula}%`,
      change: 2.1,
      icon: <RefreshCw className="h-6 w-6 text-teal-600" />,
      color: 'bg-teal-100'
    }
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Visão geral do sistema Inscribo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funil de Conversão */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Funil de Conversão</h3>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>
          <div className="space-y-4">
            {[
              { etapa: 'Leads Cadastrados', valor: kpis.totalLeads, percentual: 100, cor: 'bg-blue-500' },
              { etapa: 'Contatos Realizados', valor: Math.floor(kpis.totalLeads * 0.7), percentual: 70, cor: 'bg-green-500' },
              { etapa: 'Visitas Agendadas', valor: Math.floor(kpis.totalLeads * 0.4), percentual: 40, cor: 'bg-yellow-500' },
              { etapa: 'Matrículas Efetivadas', valor: kpis.matriculasMes, percentual: kpis.taxaConversao, cor: 'bg-purple-500' }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{item.etapa}</span>
                  <span className="text-sm text-gray-600">{item.valor}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${item.cor} transition-all duration-500`}
                    style={{ width: `${item.percentual}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all duration-200 group hover:shadow-sm">
              <span className="text-sm font-medium text-blue-700">Novo Lead</span>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-600" />
                <Plus className="h-3 w-3 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-xl transition-all duration-200 group hover:shadow-sm">
              <span className="text-sm font-medium text-green-700">Agendar Visita</span>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4 text-green-600" />
                <Plus className="h-3 w-3 text-green-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-xl transition-all duration-200 group hover:shadow-sm">
              <span className="text-sm font-medium text-purple-700">Nova Matrícula</span>
              <div className="flex items-center space-x-2">
                <GraduationCap className="h-4 w-4 text-purple-600" />
                <Plus className="h-3 w-3 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
            <button className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all duration-200 group hover:shadow-sm">
              <span className="text-sm font-medium text-orange-700">Ver Relatórios</span>
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-orange-600" />
                <ArrowUpRight className="h-3 w-3 text-orange-500 group-hover:scale-110 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}