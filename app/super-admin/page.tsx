'use client'

import React from 'react'
import { 
  Building, 
  Users, 
  GraduationCap, 
  TrendingUp, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  BarChart3,
  Target
} from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  change: number
  icon: React.ReactNode
  color: string
}

function KPICard({ title, value, change, icon, color }: KPICardProps) {
  const isPositive = change >= 0
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
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
        </div>
        <div className={`p-4 rounded-2xl ${color} flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const kpiCards = [
    {
      title: 'Instituições Ativas',
      value: 47,
      change: 12.5,
      icon: <Building className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      title: 'Usuários Totais',
      value: 342,
      change: 8.3,
      icon: <Users className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      title: 'Leads Processados',
      value: '12.4K',
      change: 15.7,
      icon: <Target className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      title: 'Matrículas do Mês',
      value: '2.1K',
      change: 22.1,
      icon: <GraduationCap className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-100'
    },
    {
      title: 'Receita Recorrente',
      value: 'R$ 45.7K',
      change: 18.9,
      icon: <DollarSign className="h-6 w-6 text-emerald-600" />,
      color: 'bg-emerald-100'
    },
    {
      title: 'Taxa de Churn',
      value: '2.1%',
      change: -0.8,
      icon: <TrendingUp className="h-6 w-6 text-red-600" />,
      color: 'bg-red-100'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard Super Admin</h1>
        <p className="text-gray-600 text-lg">Visão geral completa do SaaS Inscribo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Growth Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Crescimento de Instituições</h3>
            <BarChart3 className="h-5 w-5 text-gray-500" />
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[
              { month: 'Jan', count: 12 },
              { month: 'Fev', count: 19 },
              { month: 'Mar', count: 25 },
              { month: 'Abr', count: 32 },
              { month: 'Mai', count: 38 },
              { month: 'Jun', count: 47 }
            ].map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                  style={{ height: `${(item.count / 47) * 200}px` }}
                ></div>
                <div className="mt-2 text-xs text-gray-600 text-center">
                  <div className="font-semibold">{item.count}</div>
                  <div>{item.month}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Receita Mensal (MRR)</h3>
            <DollarSign className="h-5 w-5 text-gray-500" />
          </div>
          <div className="h-64 flex items-end justify-between space-x-2">
            {[
              { month: 'Jan', revenue: 28500 },
              { month: 'Fev', revenue: 32100 },
              { month: 'Mar', revenue: 35800 },
              { month: 'Abr', revenue: 39200 },
              { month: 'Mai', revenue: 42600 },
              { month: 'Jun', revenue: 45700 }
            ].map((item, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-500 hover:from-green-600 hover:to-green-500"
                  style={{ height: `${(item.revenue / 45700) * 200}px` }}
                ></div>
                <div className="mt-2 text-xs text-gray-600 text-center">
                  <div className="font-semibold">R$ {(item.revenue / 1000).toFixed(0)}K</div>
                  <div>{item.month}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Latest Institutions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Instituições Recentes</h3>
          <div className="space-y-4">
            {[
              { name: 'Colégio São José', plan: 'Professional', date: '2 dias atrás', status: 'active' },
              { name: 'Instituto Educacional', plan: 'Enterprise', date: '5 dias atrás', status: 'active' },
              { name: 'Escola Criativa', plan: 'Starter', date: '1 semana atrás', status: 'trial' }
            ].map((institution, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-semibold text-gray-900">{institution.name}</div>
                    <div className="text-xs text-gray-500">{institution.plan} • {institution.date}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  institution.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {institution.status === 'active' ? 'Ativo' : 'Trial'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* System Health */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Status do Sistema</h3>
          <div className="space-y-4">
            {[
              { service: 'API Principal', status: 'online', uptime: '99.9%' },
              { service: 'Banco de Dados', status: 'online', uptime: '99.8%' },
              { service: 'Autenticação', status: 'online', uptime: '100%' },
              { service: 'Relatórios', status: 'maintenance', uptime: '98.5%' }
            ].map((service, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    service.status === 'online' ? 'bg-green-500' : 
                    service.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{service.service}</div>
                    <div className="text-xs text-gray-500">Uptime: {service.uptime}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  service.status === 'online' ? 'bg-green-100 text-green-800' :
                  service.status === 'maintenance' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {service.status === 'online' ? 'Online' :
                   service.status === 'maintenance' ? 'Manutenção' : 'Offline'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}