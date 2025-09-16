import React, { useState, useEffect } from 'react'
import { Users, Calendar, GraduationCap, TrendingUp, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { DatabaseService } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface KPICardProps {
  title: string
  value: string | number
  change: number
  icon: React.ReactNode
  color: string
  loading?: boolean
}

function KPICard({ title, value, change, icon, color, loading }: KPICardProps) {
  const isPositive = change >= 0
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded-lg w-20 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded-lg w-16"></div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${color} flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function DashboardKPIs() {
  const { user } = useAuth()
  const [kpis, setKpis] = useState({
    totalLeads: 0,
    todayVisits: 0,
    monthlyEnrollments: 0,
    conversionRate: 0
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

  const kpiData = [
    {
      title: 'Total de Leads',
      value: kpis.totalLeads.toLocaleString(),
      change: 12.5,
      icon: <Users className="h-6 w-6 text-blue-600" />,
      color: 'bg-blue-100'
    },
    {
      title: 'Visitas Hoje',
      value: kpis.todayVisits,
      change: 5.2,
      icon: <Calendar className="h-6 w-6 text-green-600" />,
      color: 'bg-green-100'
    },
    {
      title: 'Matrículas do Mês',
      value: kpis.monthlyEnrollments,
      change: 8.1,
      icon: <GraduationCap className="h-6 w-6 text-purple-600" />,
      color: 'bg-purple-100'
    },
    {
      title: 'Taxa Conversão',
      value: `${kpis.conversionRate}%`,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {kpiData.map((kpi, index) => (
        <KPICard key={index} {...kpi} loading={loading} />
      ))}
    </div>
  )
}