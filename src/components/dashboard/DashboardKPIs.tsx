import React from 'react'
import { Users, Calendar, GraduationCap, TrendingUp, RefreshCw } from 'lucide-react'

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          <div className="flex items-center mt-2">
            <span
              className={`text-xs font-medium ${
                isPositive ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {isPositive ? '+' : ''}{change}%
            </span>
            <span className="text-xs text-gray-500 ml-1">vs. mês anterior</span>
          </div>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function DashboardKPIs() {
  const kpis = [
    {
      title: 'Total de Leads',
      value: '1,234',
      change: 12.5,
      icon: <Users className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      title: 'Visitas Hoje',
      value: '18',
      change: 5.2,
      icon: <Calendar className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      title: 'Matrículas',
      value: '89',
      change: 8.1,
      icon: <GraduationCap className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      title: 'Taxa Conversão',
      value: '7.2%',
      change: 1.4,
      icon: <TrendingUp className="h-6 w-6 text-orange-600" />,
      color: 'bg-orange-100'
    },
    {
      title: 'Rematrículas',
      value: '92.5%',
      change: 2.1,
      icon: <RefreshCw className="h-6 w-6 text-teal-600" />,
      color: 'bg-teal-100'
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {kpis.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  )
}