'use client'

import React, { useEffect, useState } from 'react'
import { 
  Building, 
  Users, 
  GraduationCap, 
  TrendingUp, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
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
            <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
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
  const [loading, setLoading] = useState(false)

  const kpiCards = [
    {
      title: 'Instituições Ativas',
      value: 12,
      change: 15.3,
      icon: <Building className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      title: 'Usuários Totais',
      value: 247,
      change: 8.2,
      icon: <Users className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      title: 'Leads Processados',
      value: '15.2K',
      change: 12.5,
      icon: <TrendingUp className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      title: 'Matrículas do Mês',
      value: '3.8K',
      change: 5.1,
      icon: <GraduationCap className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-100'
    },
    {
      title: 'Receita Recorrente',
      value: 'R$ 24.8K',
      change: 18.9,
      icon: <DollarSign className="h-6 w-6 text-emerald-600" />,
      color: 'bg-emerald-100'
    },
    {
      title: 'Taxa de Churn',
      value: '2.1%',
      change: -0.8,
      icon: <BarChart3 className="h-6 w-6 text-red-600" />,
      color: 'bg-red-100'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">🛡️ Dashboard Super Admin</h1>
        <p className="text-gray-600 text-lg">Visão geral completa do SaaS Inscribo</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Latest Institutions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Instituições Recentes</h3>
          <div className="space-y-4">
            {[
              { name: 'Colégio Ágape Patos', plan: 'Professional', date: '2 dias atrás', status: 'active' },
              { name: 'Instituto Educacional', plan: 'Enterprise', date: '5 dias atrás', status: 'active' },
              { name: 'Escola Criativa', plan: 'Starter', date: '1 semana atrás', status: 'trial' }
            ].map((institution, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-semibold text-gray-900">{institution.name}</div>
                    <div className="text-xs text-gray-500">{institution.plan} • {institution.date}</div>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
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
              { service: 'Relatórios', status: 'online', uptime: '98.5%' }
            ].map((service, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    service.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{service.service}</div>
                    <div className="text-xs text-gray-500">Uptime: {service.uptime}</div>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Online
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
