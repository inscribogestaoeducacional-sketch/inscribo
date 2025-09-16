import React, { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Users, AlertTriangle, Plus, Edit, Eye, X } from 'lucide-react'
import { DatabaseService, MarketingCampaign } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface Campaign extends MarketingCampaign {
  actualCPA: number
  status: 'success' | 'warning' | 'danger'
}

interface NewCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (campaignData: Partial<MarketingCampaign>) => void
  editingCampaign?: Campaign | null
}

function NewCampaignModal({ isOpen, onClose, onSave, editingCampaign }: NewCampaignModalProps) {
  const [formData, setFormData] = useState({
    month_year: '',
    investment: 0,
    leads_generated: 0,
    cpa_target: 200
  })

  useEffect(() => {
    if (editingCampaign) {
      setFormData({
        month_year: editingCampaign.month_year,
        investment: editingCampaign.investment,
        leads_generated: editingCampaign.leads_generated,
        cpa_target: editingCampaign.cpa_target || 200
      })
    } else {
      setFormData({
        month_year: '',
        investment: 0,
        leads_generated: 0,
        cpa_target: 200
      })
    }
  }, [editingCampaign, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período (Mês/Ano) *
            </label>
            <input
              type="month"
              required
              value={formData.month_year}
              onChange={(e) => setFormData({ ...formData, month_year: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Investimento (R$) *
            </label>
            <input
              type="number"
              required
              step="0.01"
              min="0"
              value={formData.investment}
              onChange={(e) => setFormData({ ...formData, investment: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Leads Gerados *
            </label>
            <input
              type="number"
              required
              min="0"
              value={formData.leads_generated}
              onChange={(e) => setFormData({ ...formData, leads_generated: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CPA Meta (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.cpa_target}
              onChange={(e) => setFormData({ ...formData, cpa_target: parseFloat(e.target.value) || 200 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="200,00"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editingCampaign ? 'Atualizar' : 'Salvar'} Campanha
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function MarketingCPA() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadCampaigns()
    }
  }, [user])

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getMarketingCampaigns(user!.institution_id)
      
      // Calculate CPA and status for each campaign
      const campaignsWithCPA = data.map(campaign => {
        const actualCPA = campaign.leads_generated > 0 ? campaign.investment / campaign.leads_generated : 0
        const targetCPA = campaign.cpa_target || 200
        
        let status: 'success' | 'warning' | 'danger' = 'success'
        if (actualCPA > targetCPA * 1.2) {
          status = 'danger'
        } else if (actualCPA > targetCPA) {
          status = 'warning'
        }

        return {
          ...campaign,
          actualCPA,
          status
        }
      })

      setCampaigns(campaignsWithCPA)
    } catch (error) {
      console.error('Error loading campaigns:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCampaign = async (campaignData: Partial<MarketingCampaign>) => {
    try {
      const dataWithInstitution = {
        ...campaignData,
        institution_id: user!.institution_id
      }

      if (editingCampaign) {
        // Update existing campaign
        // Implementation would update in Supabase
      } else {
        await DatabaseService.createMarketingCampaign(dataWithInstitution)
      }

      await loadCampaigns()
      setEditingCampaign(null)
    } catch (error) {
      console.error('Error saving campaign:', error)
    }
  }

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign)
    setShowNewCampaignModal(true)
  }

  const handleNewCampaign = () => {
    setEditingCampaign(null)
    setShowNewCampaignModal(true)
  }

  const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leads_generated, 0)
  const averageCPA = totalLeads > 0 ? totalInvestment / totalLeads : 0

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing & CPA</h1>
          <p className="text-gray-600">Análise de custo por aquisição</p>
        </div>
        <button
          onClick={handleNewCampaign}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Investimento Total</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {totalInvestment.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Leads Gerados</p>
              <p className="text-2xl font-bold text-gray-900">{totalLeads}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">CPA Médio</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {averageCPA.toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CPA Analysis Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Análise de CPA por Período</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Investimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Leads
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPA Meta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CPA Real
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Desvio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const deviation = campaign.cpa_target ? ((campaign.actualCPA - campaign.cpa_target) / campaign.cpa_target * 100) : 0
                
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(campaign.month_year + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.investment.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.leads_generated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.cpa_target?.toFixed(0) || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.actualCPA.toFixed(0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          campaign.status === 'success'
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'warning'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {campaign.status === 'success' ? 'Meta atingida' : 
                           campaign.status === 'warning' ? 'Atenção' : 'Acima da meta'}
                        </span>
                        {campaign.status !== 'success' && (
                          <AlertTriangle className="ml-2 h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`font-medium ${
                        deviation > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleEditCampaign(campaign)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {campaigns.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma campanha cadastrada. Clique em "Nova Campanha" para começar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* CPA Evolution Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução do CPA</h3>
          <div className="h-64">
            {campaigns.length > 0 ? (
              <div className="h-full flex items-end justify-between space-x-2">
                {campaigns.slice(-6).map((campaign, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div 
                      className={`w-full rounded-t-lg transition-all duration-500 ${
                        campaign.status === 'success' ? 'bg-green-500' :
                        campaign.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${(campaign.actualCPA / 400) * 200}px` }}
                    ></div>
                    <div className="mt-2 text-xs text-gray-600 text-center">
                      <div className="font-semibold">R$ {campaign.actualCPA.toFixed(0)}</div>
                      <div>{new Date(campaign.month_year + '-01').toLocaleDateString('pt-BR', { month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Adicione campanhas para ver a evolução</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Investment vs Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Investimento vs Resultados</h3>
          <div className="h-64">
            {campaigns.length > 0 ? (
              <div className="h-full flex items-end justify-between space-x-2">
                {campaigns.slice(-6).map((campaign, index) => (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div className="w-full relative">
                      <div 
                        className="w-full bg-blue-500 rounded-t-lg"
                        style={{ height: `${(campaign.investment / Math.max(...campaigns.map(c => c.investment))) * 150}px` }}
                      ></div>
                      <div 
                        className="w-full bg-green-500 rounded-t-lg mt-1"
                        style={{ height: `${(campaign.leads_generated / Math.max(...campaigns.map(c => c.leads_generated))) * 50}px` }}
                      ></div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 text-center">
                      <div className="font-semibold">{campaign.leads_generated}</div>
                      <div>{new Date(campaign.month_year + '-01').toLocaleDateString('pt-BR', { month: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Dados aparecerão aqui</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New/Edit Campaign Modal */}
      <NewCampaignModal
        isOpen={showNewCampaignModal}
        onClose={() => {
          setShowNewCampaignModal(false)
          setEditingCampaign(null)
        }}
        onSave={handleSaveCampaign}
        editingCampaign={editingCampaign}
      />
    </div>
  )
}