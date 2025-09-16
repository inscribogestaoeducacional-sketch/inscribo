import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, PieChart, Plus, Calendar, Users, FileText, DollarSign } from 'lucide-react'
import { DatabaseService } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface ChartData {
  enrollments: Array<{ month: string; count: number }>
  cpaData: Array<{ month: string; cpa: number; target: number }>
  reEnrollmentProgress: {
    current: number
    target: number
    enrolled: number
    pending: number
  }
}

export default function DashboardCharts() {
  const { user } = useAuth()
  const [chartData, setChartData] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.institution_id) {
      loadChartData()
    }
  }, [user])

  const loadChartData = async () => {
    try {
      setLoading(true)
      
      // Load enrollment data
      const enrollments = await DatabaseService.getEnrollments(user!.institution_id)
      const enrollmentsByMonth = enrollments.reduce((acc: any, enrollment) => {
        const month = new Date(enrollment.enrollment_date).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        acc[month] = (acc[month] || 0) + 1
        return acc
      }, {})

      // Load marketing campaigns for CPA data
      const campaigns = await DatabaseService.getMarketingCampaigns(user!.institution_id)
      const cpaData = campaigns.map(campaign => ({
        month: campaign.month_year,
        cpa: campaign.investment / campaign.leads_generated,
        target: campaign.cpa_target || 200
      }))

      // Mock re-enrollment data (would come from database)
      const reEnrollmentProgress = {
        current: 92.5,
        target: 85,
        enrolled: 1248,
        pending: 102
      }

      setChartData({
        enrollments: Object.entries(enrollmentsByMonth).map(([month, count]) => ({
          month,
          count: count as number
        })),
        cpaData,
        reEnrollmentProgress
      })
    } catch (error) {
      console.error('Error loading chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-64 bg-gray-100 rounded-xl"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Enrollment Evolution Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de Matrículas</h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64">
          {chartData?.enrollments && chartData.enrollments.length > 0 ? (
            <div className="h-full flex items-end justify-between space-x-2">
              {chartData.enrollments.slice(-6).map((item, index) => (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all duration-500 hover:from-blue-600 hover:to-blue-500"
                    style={{ height: `${(item.count / Math.max(...chartData.enrollments.map(e => e.count))) * 200}px` }}
                  ></div>
                  <div className="mt-2 text-xs text-gray-600 text-center">
                    <div className="font-semibold">{item.count}</div>
                    <div>{item.month}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">Dados de matrícula carregando...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CPA Evolution Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de CPA</h3>
          <DollarSign className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64">
          {chartData?.cpaData && chartData.cpaData.length > 0 ? (
            <div className="h-full">
              <div className="flex items-end justify-between space-x-2 h-48">
                {chartData.cpaData.slice(-6).map((item, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full relative">
                      <div 
                        className="w-full bg-gradient-to-t from-orange-500 to-orange-400 rounded-t-lg"
                        style={{ height: `${(item.cpa / 400) * 150}px` }}
                      ></div>
                      <div 
                        className="w-full border-2 border-dashed border-red-300 absolute top-0"
                        style={{ height: `${(item.target / 400) * 150}px` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 text-center">
                      <div className="font-semibold">R$ {item.cpa.toFixed(0)}</div>
                      <div>{item.month}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-center space-x-4 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded mr-1"></div>
                  <span>CPA Real</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-1 border-2 border-dashed border-red-300 mr-1"></div>
                  <span>Meta</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-200">
              <div className="text-center">
                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 font-medium">Dados de CPA carregando...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Re-enrollment Progress */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Progresso Rematrículas</h3>
          <PieChart className="h-5 w-5 text-gray-500" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Meta: {chartData?.reEnrollmentProgress.target}%</span>
              <span className="font-bold text-green-600">Atual: {chartData?.reEnrollmentProgress.current}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full shadow-sm transition-all duration-500" 
                style={{ width: `${chartData?.reEnrollmentProgress.current}%` }}
              ></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-2">
            <div className="bg-green-50 p-3 rounded-xl border border-green-100">
              <p className="text-gray-600 mb-1">Rematriculados</p>
              <p className="font-bold text-green-700 text-lg">{chartData?.reEnrollmentProgress.enrolled.toLocaleString()}</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
              <p className="text-gray-600 mb-1">Pendentes</p>
              <p className="font-bold text-orange-700 text-lg">{chartData?.reEnrollmentProgress.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
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
            <span className="text-sm font-medium text-purple-700">Ver Relatórios</span>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <BarChart3 className="h-3 w-3 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-xl transition-all duration-200 group hover:shadow-sm">
            <span className="text-sm font-medium text-orange-700">Cadastrar Aluno</span>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-orange-600" />
              <Plus className="h-3 w-3 text-orange-500 group-hover:scale-110 transition-transform" />
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}