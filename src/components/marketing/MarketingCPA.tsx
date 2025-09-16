import React, { useState, useEffect } from 'react'
import { Plus, TrendingUp, DollarSign, Users, Edit } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, MarketingCampaign } from '../../lib/supabase'

export default function MarketingCPA() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<MarketingCampaign | null>(null)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Marketing & CPA</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Investimento Total</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalInvestment)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total de Leads</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">CPA Médio</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(averageCPA)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Campanhas de Marketing</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Investimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leads Gerados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPA Real
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPA Meta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const realCPA = calculateCPA(campaign.investment, campaign.leads_generated)
                const isOnTarget = campaign.cpa_target ? realCPA <= campaign.cpa_target : true
                
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {campaign.month_year}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {formatCurrency(campaign.investment)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{campaign.leads_generated}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(realCPA)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {campaign.cpa_target ? formatCurrency(campaign.cpa_target) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        isOnTarget 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {isOnTarget ? 'Na Meta' : 'Acima da Meta'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleEdit(campaign)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {campaigns.length === 0 && (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Nenhuma campanha encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Período (Mês/Ano) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Janeiro/2024"
                  value={formData.month_year}
                  onChange={(e) => setFormData({ ...formData, month_year: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investimento (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.investment}
                  onChange={(e) => setFormData({ ...formData, investment: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leads Gerados *
                </label>
                <input
                  type="number"
                  required
                  value={formData.leads_generated}
                  onChange={(e) => setFormData({ ...formData, leads_generated: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPA Meta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cpa_target}
                  onChange={(e) => setFormData({ ...formData, cpa_target: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              {formData.investment && formData.leads_generated && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">
                    CPA Calculado: <span className="font-semibold">
                      {formatCurrency(parseFloat(formData.investment) / parseInt(formData.leads_generated))}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingCampaign ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}