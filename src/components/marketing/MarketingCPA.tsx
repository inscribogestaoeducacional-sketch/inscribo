import React, { useState, useEffect } from 'react'
import { Plus, TrendingUp, DollarSign, Users, Edit, Trash2, BarChart3, Calendar, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, MarketingCampaign } from '../../lib/supabase'

interface ChartData {
  month: string
  investment: number
  leads: number
  cpa: number
  target: number
}

export default function MarketingCPA() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null)
  const [chartData, setChartData] = useState<ChartData[]>([])
  const [formData, setFormData] = useState({
    month_year: '',
    investment: '',
    leads_generated: '',
    cpa_target: ''
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadCampaigns()
    }
  }, [user])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getMarketingCampaigns(user!.institution_id!)
      setCampaigns(data)
      
      // Preparar dados para gráfico
      const chartData = data.map(campaign => ({
        month: campaign.month_year,
        investment: campaign.investment,
        leads: campaign.leads_generated,
        cpa: campaign.leads_generated > 0 ? campaign.investment / campaign.leads_generated : 0,
        target: campaign.cpa_target || 200
      })).slice(-12) // Últimos 12 meses
      
      setChartData(chartData)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const campaignData = {
        ...formData,
        investment: parseFloat(formData.investment),
        leads_generated: parseInt(formData.leads_generated),
        cpa_target: formData.cpa_target ? parseFloat(formData.cpa_target) : null,
        institution_id: user!.institution_id!
      }

      if (editingCampaign) {
        await DatabaseService.updateMarketingCampaign(editingCampaign.id, campaignData)
      } else {
        await DatabaseService.createMarketingCampaign(campaignData)
      }

      await loadCampaigns()
      setShowForm(false)
      setEditingCampaign(null)
      setFormData({
        month_year: '',
        investment: '',
        leads_generated: '',
        cpa_target: ''
      })
    } catch (error) {
      console.error('Error saving campaign:', error)
    }
  }

  const handleEdit = (campaign: MarketingCampaign) => {
    setEditingCampaign(campaign)
    setFormData({
      month_year: campaign.month_year,
      investment: campaign.investment.toString(),
      leads_generated: campaign.leads_generated.toString(),
      cpa_target: campaign.cpa_target?.toString() || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (campaignId: string) => {
    if (confirm('Tem certeza que deseja excluir esta campanha?')) {
      try {
        await DatabaseService.deleteMarketingCampaign(campaignId)
        await loadCampaigns()
      } catch (error) {
        console.error('Error deleting campaign:', error)
      }
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calculateCPA = (investment: number, leads: number) => {
    return leads > 0 ? investment / leads : 0
  }

  const totalInvestment = campaigns.reduce((sum, campaign) => sum + campaign.investment, 0)
  const totalLeads = campaigns.reduce((sum, campaign) => sum + campaign.leads_generated, 0)
  const averageCPA = totalLeads > 0 ? totalInvestment / totalLeads : 0
  const currentMonth = campaigns[0]
  const previousMonth = campaigns[1]
  const cpaChange = previousMonth ? ((calculateCPA(currentMonth?.investment || 0, currentMonth?.leads_generated || 0) - calculateCPA(previousMonth.investment, previousMonth.leads_generated)) / calculateCPA(previousMonth.investment, previousMonth.leads_generated)) * 100 : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-purple-50 via-white to-blue-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Marketing & CPA</h1>
          <p className="text-gray-600 text-lg">Análise de investimento e custo por aquisição</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-2xl hover:from-purple-700 hover:to-blue-700 transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Campanha
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Investimento Total</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(totalInvestment)}</p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-sm text-green-600">+12.5% vs mês anterior</span>
              </div>
            </div>
            <DollarSign className="w-12 h-12 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Leads</p>
              <p className="text-3xl font-bold text-blue-600">{totalLeads}</p>
              <div className="flex items-center mt-2">
                <ArrowUpRight className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-sm text-blue-600">+8.3% vs mês anterior</span>
              </div>
            </div>
            <Users className="w-12 h-12 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CPA Médio</p>
              <p className="text-3xl font-bold text-purple-600">{formatCurrency(averageCPA)}</p>
              <div className="flex items-center mt-2">
                {cpaChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-red-500 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-green-500 mr-1" />
                )}
                <span className={`text-sm ${cpaChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {cpaChange >= 0 ? '+' : ''}{cpaChange.toFixed(1)}% vs mês anterior
                </span>
              </div>
            </div>
            <TrendingUp className="w-12 h-12 text-purple-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Meta CPA</p>
              <p className="text-3xl font-bold text-orange-600">R$ 200</p>
              <div className="flex items-center mt-2">
                <Target className="h-4 w-4 text-orange-500 mr-1" />
                <span className="text-sm text-orange-600">Meta definida</span>
              </div>
            </div>
            <Target className="w-12 h-12 text-orange-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* CPA Evolution Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Evolução do CPA</h3>
            <BarChart3 className="h-6 w-6 text-gray-500" />
          </div>
          <div className="h-80">
            {chartData.length > 0 ? (
              <div className="h-full flex items-end justify-between space-x-2">
                {chartData.slice(-6).map((item, index) => {
                  const maxCPA = Math.max(...chartData.map(d => d.cpa))
                  const height = (item.cpa / maxCPA) * 250
                  const isAboveTarget = item.cpa > item.target
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="relative w-full">
                        {/* Target line */}
                        <div 
                          className="absolute w-full border-2 border-dashed border-red-300"
                          style={{ bottom: `${(item.target / maxCPA) * 250}px` }}
                        ></div>
                        {/* CPA bar */}
                        <div 
                          className={`w-full rounded-t-lg transition-all duration-500 ${
                            isAboveTarget ? 'bg-gradient-to-t from-red-500 to-red-400' : 'bg-gradient-to-t from-green-500 to-green-400'
                          }`}
                          style={{ height: `${height}px` }}
                        ></div>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-xs font-semibold text-gray-900">{formatCurrency(item.cpa)}</div>
                        <div className="text-xs text-gray-600">{item.month}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum dado disponível</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>Dentro da Meta</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-red-500 rounded mr-2"></div>
              <span>Acima da Meta</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-1 border-2 border-dashed border-red-300 mr-2"></div>
              <span>Meta CPA</span>
            </div>
          </div>
        </div>

        {/* Investment vs Leads Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Investimento vs Leads</h3>
            <TrendingUp className="h-6 w-6 text-gray-500" />
          </div>
          <div className="h-80">
            {chartData.length > 0 ? (
              <div className="h-full flex items-end justify-between space-x-2">
                {chartData.slice(-6).map((item, index) => {
                  const maxInvestment = Math.max(...chartData.map(d => d.investment))
                  const maxLeads = Math.max(...chartData.map(d => d.leads))
                  const investmentHeight = (item.investment / maxInvestment) * 200
                  const leadsHeight = (item.leads / maxLeads) * 200
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="flex items-end space-x-1 w-full">
                        <div 
                          className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg"
                          style={{ height: `${investmentHeight}px` }}
                          title={`Investimento: ${formatCurrency(item.investment)}`}
                        ></div>
                        <div 
                          className="flex-1 bg-gradient-to-t from-green-500 to-green-400 rounded-t-lg"
                          style={{ height: `${leadsHeight}px` }}
                          title={`Leads: ${item.leads}`}
                        ></div>
                      </div>
                      <div className="mt-3 text-center">
                        <div className="text-xs font-semibold text-gray-900">{item.leads}</div>
                        <div className="text-xs text-gray-600">{item.month}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-xl">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhum dado disponível</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
              <span>Investimento</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-2"></div>
              <span>Leads Gerados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <h2 className="text-2xl font-bold text-gray-900">Campanhas de Marketing</h2>
          <p className="text-gray-600 mt-1">Histórico detalhado de investimentos e resultados</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Investimento
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Leads Gerados
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  CPA Real
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  CPA Meta
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const realCPA = calculateCPA(campaign.investment, campaign.leads_generated)
                const isOnTarget = campaign.cpa_target ? realCPA <= campaign.cpa_target : true
                
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {campaign.month_year}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-green-600">
                        {formatCurrency(campaign.investment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Users className="h-4 w-4 text-blue-500 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{campaign.leads_generated}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-bold ${isOnTarget ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(realCPA)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {campaign.cpa_target ? formatCurrency(campaign.cpa_target) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                        isOnTarget 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {isOnTarget ? '✅ Na Meta' : '⚠️ Acima da Meta'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(campaign)}
                          className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-all"
                          title="Editar campanha"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(campaign.id)}
                          className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-all"
                          title="Excluir campanha"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {campaigns.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma campanha encontrada</h3>
              <p className="text-gray-500 mb-4">Comece criando sua primeira campanha de marketing</p>
              <button
                onClick={() => setShowForm(true)}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Criar Primeira Campanha
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">
              {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Período (Mês/Ano) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Janeiro/2024, 2024/01"
                  value={formData.month_year}
                  onChange={(e) => setFormData({ ...formData, month_year: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Investimento (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.investment}
                    onChange={(e) => setFormData({ ...formData, investment: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Leads Gerados *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.leads_generated}
                    onChange={(e) => setFormData({ ...formData, leads_generated: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  CPA Meta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cpa_target}
                  onChange={(e) => setFormData({ ...formData, cpa_target: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                  placeholder="200,00"
                />
              </div>

              {formData.investment && formData.leads_generated && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-xl border border-purple-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Prévia dos Resultados</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">CPA Calculado:</span>
                      <p className="font-bold text-purple-600 text-lg">
                        {formatCurrency(parseFloat(formData.investment) / parseInt(formData.leads_generated))}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Status vs Meta:</span>
                      <p className={`font-bold text-lg ${
                        formData.cpa_target && (parseFloat(formData.investment) / parseInt(formData.leads_generated)) <= parseFloat(formData.cpa_target)
                          ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formData.cpa_target 
                          ? (parseFloat(formData.investment) / parseInt(formData.leads_generated)) <= parseFloat(formData.cpa_target)
                            ? '✅ Dentro da Meta' 
                            : '⚠️ Acima da Meta'
                          : '📊 Sem Meta Definida'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingCampaign(null)
                    setFormData({
                      month_year: '',
                      investment: '',
                      leads_generated: '',
                      cpa_target: ''
                    })
                  }}
                  className="px-8 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:from-purple-700 hover:to-blue-700 transition-all font-medium shadow-lg"
                >
                  {editingCampaign ? 'Atualizar' : 'Salvar'} Campanha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}