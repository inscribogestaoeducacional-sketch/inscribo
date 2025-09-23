import React, { useState, useEffect } from 'react'
import { FileText, Download, Calendar, TrendingUp, Users, DollarSign, BarChart3, Filter, Eye, Target, GraduationCap } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService } from '../../lib/supabase'

export default function Reports() {
  const { user } = useAuth()
  const [selectedPeriod, setSelectedPeriod] = useState('current-month')
  const [selectedReport, setSelectedReport] = useState('leads')
  const [reportData, setReportData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user?.institution_id) {
      loadReportData()
    }
  }, [user, selectedPeriod, selectedReport])

  const loadReportData = async () => {
    try {
      setLoading(true)
      
      const [leads, enrollments, campaigns, visits] = await Promise.all([
        DatabaseService.getLeads(user!.institution_id),
        DatabaseService.getEnrollments(user!.institution_id),
        DatabaseService.getMarketingCampaigns(user!.institution_id),
        DatabaseService.getVisits(user!.institution_id)
      ])

      // Calculate period dates
      const today = new Date()
      let startDate: Date, endDate: Date

      switch (selectedPeriod) {
        case 'current-month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1)
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
          break
        case 'last-month':
          startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          endDate = new Date(today.getFullYear(), today.getMonth(), 0)
          break
        case 'current-quarter':
          const quarter = Math.floor(today.getMonth() / 3)
          startDate = new Date(today.getFullYear(), quarter * 3, 1)
          endDate = new Date(today.getFullYear(), quarter * 3 + 3, 0)
          break
        case 'current-year':
          startDate = new Date(today.getFullYear(), 0, 1)
          endDate = new Date(today.getFullYear(), 11, 31)
          break
        default:
          startDate = new Date(today.getFullYear(), today.getMonth(), 1)
          endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      }

      const startDateStr = startDate.toISOString()
      const endDateStr = endDate.toISOString()

      // Filter data by period
      const periodLeads = leads.filter(l => l.created_at >= startDateStr && l.created_at <= endDateStr)
      const periodEnrollments = enrollments.filter(e => e.created_at >= startDateStr && e.created_at <= endDateStr)
      const periodVisits = visits.filter(v => v.created_at >= startDateStr && v.created_at <= endDateStr)

      // Generate report data based on type
      let data = {}

      switch (selectedReport) {
        case 'leads':
          data = {
            total: periodLeads.length,
            new: periodLeads.filter(l => l.status === 'new').length,
            converted: periodLeads.filter(l => l.status === 'enrolled').length,
            conversionRate: periodLeads.length > 0 ? (periodLeads.filter(l => l.status === 'enrolled').length / periodLeads.length) * 100 : 0,
            bySource: periodLeads.reduce((acc: any, lead) => {
              acc[lead.source] = (acc[lead.source] || 0) + 1
              return acc
            }, {}),
            byGrade: periodLeads.reduce((acc: any, lead) => {
              acc[lead.grade_interest] = (acc[lead.grade_interest] || 0) + 1
              return acc
            }, {}),
            timeline: periodLeads.reduce((acc: any, lead) => {
              const week = new Date(lead.created_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })
              acc[week] = (acc[week] || 0) + 1
              return acc
            }, {})
          }
          break

        case 'conversions':
          const funnelStages = {
            leads: periodLeads.length,
            contacts: periodLeads.filter(l => ['contact', 'scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length,
            visits: periodVisits.filter(v => v.status === 'completed').length,
            enrollments: periodEnrollments.length
          }
          
          data = {
            funnel: funnelStages,
            conversionRates: {
              leadToContact: funnelStages.leads > 0 ? (funnelStages.contacts / funnelStages.leads) * 100 : 0,
              contactToVisit: funnelStages.contacts > 0 ? (funnelStages.visits / funnelStages.contacts) * 100 : 0,
              visitToEnrollment: funnelStages.visits > 0 ? (funnelStages.enrollments / funnelStages.visits) * 100 : 0,
              overall: funnelStages.leads > 0 ? (funnelStages.enrollments / funnelStages.leads) * 100 : 0
            }
          }
          break

        case 'financial':
          const totalRevenue = periodEnrollments.reduce((sum, e) => sum + (e.enrollment_value || 0), 0)
          const averageTicket = periodEnrollments.length > 0 ? totalRevenue / periodEnrollments.length : 0
          const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
          const totalCampaignLeads = campaigns.reduce((sum, c) => sum + c.leads_generated, 0)
          const averageCPA = totalCampaignLeads > 0 ? totalInvestment / totalCampaignLeads : 0

          data = {
            revenue: totalRevenue,
            enrollments: periodEnrollments.length,
            averageTicket,
            totalInvestment,
            averageCPA,
            roi: totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : 0,
            revenueByMonth: periodEnrollments.reduce((acc: any, enrollment) => {
              const month = new Date(enrollment.created_at).toLocaleDateString('pt-BR', { month: 'short' })
              acc[month] = (acc[month] || 0) + (enrollment.enrollment_value || 0)
              return acc
            }, {})
          }
          break

        case 'marketing':
          data = {
            campaigns: campaigns.length,
            totalInvestment: campaigns.reduce((sum, c) => sum + c.investment, 0),
            totalLeads: campaigns.reduce((sum, c) => sum + c.leads_generated, 0),
            averageCPA: campaigns.reduce((sum, c) => sum + c.investment, 0) / campaigns.reduce((sum, c) => sum + c.leads_generated, 0),
            campaignPerformance: campaigns.map(c => ({
              period: c.month_year,
              investment: c.investment,
              leads: c.leads_generated,
              cpa: c.leads_generated > 0 ? c.investment / c.leads_generated : 0,
              target: c.cpa_target || 200
            }))
          }
          break
      }

      setReportData(data)
    } catch (error) {
      console.error('Error loading report data:', error)
    } finally {
      setLoading(false)
    }
  }

  const reportTypes = [
    { id: 'leads', name: 'Relatório de Leads', icon: Users, description: 'Análise completa dos leads por período' },
    { id: 'conversions', name: 'Relatório de Conversões', icon: TrendingUp, description: 'Taxa de conversão do funil de vendas' },
    { id: 'financial', name: 'Relatório Financeiro', icon: DollarSign, description: 'Receitas, matrículas e ROI' },
    { id: 'marketing', name: 'Relatório de Marketing', icon: BarChart3, description: 'Performance das campanhas de marketing' }
  ]

  const periods = [
    { id: 'current-month', name: 'Mês Atual' },
    { id: 'last-month', name: 'Mês Anterior' },
    { id: 'current-quarter', name: 'Trimestre Atual' },
    { id: 'last-quarter', name: 'Trimestre Anterior' },
    { id: 'current-year', name: 'Ano Atual' },
    { id: 'custom', name: 'Período Personalizado' }
  ]

  const handleGenerateReport = () => {
    const reportType = reportTypes.find(r => r.id === selectedReport)
    const period = periods.find(p => p.id === selectedPeriod)
    alert(`Gerando ${reportType?.name} para ${period?.name}`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Relatórios Gerenciais</h1>
          <p className="text-gray-600 text-lg">Análises detalhadas e insights do negócio</p>
        </div>
        <button
          onClick={handleGenerateReport}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Download className="w-5 h-5 mr-2" />
          Exportar PDF
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Report Configuration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Configurar Relatório</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Tipo de Relatório
                </label>
                <div className="space-y-3">
                  {reportTypes.map(report => (
                    <label key={report.id} className="flex items-start cursor-pointer group">
                      <input
                        type="radio"
                        name="reportType"
                        value={report.id}
                        checked={selectedReport === report.id}
                        onChange={(e) => setSelectedReport(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 mt-1"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center group-hover:text-blue-600 transition-colors">
                          <report.icon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{report.name}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Período
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  {periods.map(period => (
                    <option key={period.id} value={period.id}>{period.name}</option>
                  ))}
                </select>
              </div>

              {selectedPeriod === 'custom' && (
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Final
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center shadow-lg"
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>

        {/* Report Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-bold text-gray-900">
                {reportTypes.find(r => r.id === selectedReport)?.name}
              </h3>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  {periods.find(p => p.id === selectedPeriod)?.name}
                </span>
                <button className="text-blue-600 hover:text-blue-700 flex items-center text-sm font-medium">
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Carregando dados...</span>
              </div>
            ) : (
              <>
                {selectedReport === 'leads' && reportData && (
                  <div className="space-y-8">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                        <div className="text-3xl font-bold text-blue-600">{reportData.total}</div>
                        <div className="text-sm text-gray-600 mt-1">Total de Leads</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                        <div className="text-3xl font-bold text-green-600">{reportData.new}</div>
                        <div className="text-sm text-gray-600 mt-1">Novos Leads</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                        <div className="text-3xl font-bold text-purple-600">{reportData.converted}</div>
                        <div className="text-sm text-gray-600 mt-1">Convertidos</div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border border-orange-200">
                        <div className="text-3xl font-bold text-orange-600">{reportData.conversionRate.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">Taxa Conversão</div>
                      </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Leads by Source */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Leads por Origem</h4>
                        <div className="space-y-3">
                          {Object.entries(reportData.bySource).map(([source, count]) => {
                            const total = Object.values(reportData.bySource).reduce((a: number, b: any) => a + b, 0) as number
                            const percentage = total > 0 ? ((count as number) / total) * 100 : 0
                            
                            return (
                              <div key={source} className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{source}</span>
                                <div className="flex items-center space-x-3 flex-1 ml-4">
                                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                                    <div 
                                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-sm font-bold text-gray-900 w-12">{count as number}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Timeline */}
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 mb-4">Timeline de Leads</h4>
                        <div className="h-48 flex items-end justify-between space-x-1">
                          {Object.entries(reportData.timeline).slice(-10).map(([date, count], index) => {
                            const maxCount = Math.max(...Object.values(reportData.timeline) as number[])
                            const height = maxCount > 0 ? ((count as number) / maxCount) * 150 : 0
                            
                            return (
                              <div key={index} className="flex-1 flex flex-col items-center">
                                <div 
                                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg"
                                  style={{ height: `${height}px` }}
                                  title={`${date}: ${count} leads`}
                                ></div>
                                <div className="mt-2 text-xs text-gray-600 text-center transform -rotate-45">
                                  {date}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport === 'conversions' && reportData && (
                  <div className="space-y-8">
                    {/* Funnel Visualization */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-6">Funil de Conversão</h4>
                      <div className="space-y-4">
                        {[
                          { name: 'Leads Gerados', value: reportData.funnel.leads, rate: 100, color: 'bg-blue-500' },
                          { name: 'Contatos Realizados', value: reportData.funnel.contacts, rate: reportData.conversionRates.leadToContact, color: 'bg-green-500' },
                          { name: 'Visitas Realizadas', value: reportData.funnel.visits, rate: reportData.conversionRates.contactToVisit, color: 'bg-yellow-500' },
                          { name: 'Matrículas Efetivadas', value: reportData.funnel.enrollments, rate: reportData.conversionRates.visitToEnrollment, color: 'bg-purple-500' }
                        ].map((stage, index) => (
                          <div key={index} className="relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-bold text-gray-900">{stage.value}</span>
                                <span className="text-xs text-gray-500">({stage.rate.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                              <div 
                                className={`h-4 rounded-full ${stage.color} transition-all duration-500`}
                                style={{ width: `${Math.max(stage.rate, 2)}%` }}
                              ></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Conversion Rates */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                        <div className="text-2xl font-bold text-blue-600">{reportData.conversionRates.leadToContact.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">Lead → Contato</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                        <div className="text-2xl font-bold text-green-600">{reportData.conversionRates.contactToVisit.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">Contato → Visita</div>
                      </div>
                      <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-2xl border border-yellow-200">
                        <div className="text-2xl font-bold text-yellow-600">{reportData.conversionRates.visitToEnrollment.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">Visita → Matrícula</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                        <div className="text-2xl font-bold text-purple-600">{reportData.conversionRates.overall.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">Conversão Geral</div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport === 'financial' && reportData && (
                  <div className="space-y-8">
                    {/* Financial KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(reportData.revenue)}</div>
                        <div className="text-sm text-gray-600 mt-1">Receita Total</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                        <div className="text-3xl font-bold text-blue-600">{reportData.enrollments}</div>
                        <div className="text-sm text-gray-600 mt-1">Matrículas</div>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                        <div className="text-3xl font-bold text-purple-600">{formatCurrency(reportData.averageTicket)}</div>
                        <div className="text-sm text-gray-600 mt-1">Ticket Médio</div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border border-orange-200">
                        <div className="text-3xl font-bold text-orange-600">{reportData.roi.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600 mt-1">ROI</div>
                      </div>
                    </div>

                    {/* Revenue Evolution */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-6">Evolução da Receita</h4>
                      <div className="h-64 flex items-end justify-between space-x-2">
                        {Object.entries(reportData.revenueByMonth).map(([month, revenue], index) => {
                          const maxRevenue = Math.max(...Object.values(reportData.revenueByMonth) as number[])
                          const height = maxRevenue > 0 ? ((revenue as number) / maxRevenue) * 200 : 0
                          
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg transition-all duration-500"
                                style={{ height: `${height}px` }}
                                title={`${month}: ${formatCurrency(revenue as number)}`}
                              ></div>
                              <div className="mt-3 text-center">
                                <div className="text-xs font-bold text-gray-900">{formatCurrency(revenue as number)}</div>
                                <div className="text-xs text-gray-600">{month}</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {selectedReport === 'marketing' && reportData && (
                  <div className="space-y-8">
                    {/* Marketing KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-2xl border border-purple-200">
                        <div className="text-3xl font-bold text-purple-600">{reportData.campaigns}</div>
                        <div className="text-sm text-gray-600 mt-1">Campanhas Ativas</div>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-2xl border border-green-200">
                        <div className="text-3xl font-bold text-green-600">{formatCurrency(reportData.totalInvestment)}</div>
                        <div className="text-sm text-gray-600 mt-1">Investimento Total</div>
                      </div>
                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
                        <div className="text-3xl font-bold text-blue-600">{reportData.totalLeads}</div>
                        <div className="text-sm text-gray-600 mt-1">Leads Gerados</div>
                      </div>
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-2xl border border-orange-200">
                        <div className="text-3xl font-bold text-orange-600">{formatCurrency(reportData.averageCPA)}</div>
                        <div className="text-sm text-gray-600 mt-1">CPA Médio</div>
                      </div>
                    </div>

                    {/* Campaign Performance */}
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 mb-6">Performance das Campanhas</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Período</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Investimento</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Leads</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">CPA</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {reportData.campaignPerformance.map((campaign: any, index: number) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{campaign.period}</td>
                                <td className="px-4 py-3 text-sm text-green-600 font-semibold">{formatCurrency(campaign.investment)}</td>
                                <td className="px-4 py-3 text-sm text-blue-600 font-semibold">{campaign.leads}</td>
                                <td className="px-4 py-3 text-sm font-bold">{formatCurrency(campaign.cpa)}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    campaign.cpa <= campaign.target 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {campaign.cpa <= campaign.target ? '✅ Meta' : '⚠️ Acima'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}