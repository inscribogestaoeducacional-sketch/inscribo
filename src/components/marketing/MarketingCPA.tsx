import React, { useState } from 'react'
import { TrendingUp, DollarSign, Users, AlertTriangle, Plus, Edit, Eye } from 'lucide-react'

interface Campaign {
  id: string
  month: string
  investment: number
  leadsGenerated: number
  targetCPA: number
  actualCPA: number
  status: 'success' | 'warning' | 'danger'
}

const SAMPLE_CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    month: 'Janeiro 2024',
    investment: 5000,
    leadsGenerated: 25,
    targetCPA: 180,
    actualCPA: 200,
    status: 'warning'
  },
  {
    id: '2',
    month: 'Dezembro 2023',
    investment: 4500,
    leadsGenerated: 30,
    targetCPA: 180,
    actualCPA: 150,
    status: 'success'
  },
  {
    id: '3',
    month: 'Novembro 2023',
    investment: 6000,
    leadsGenerated: 20,
    targetCPA: 180,
    actualCPA: 300,
    status: 'danger'
  }
]

export default function MarketingCPA() {
  const [campaigns] = useState<Campaign[]>(SAMPLE_CAMPAIGNS)
  const [showNewCampaignModal, setShowNewCampaignModal] = useState(false)

  const totalInvestment = campaigns.reduce((sum, c) => sum + c.investment, 0)
  const totalLeads = campaigns.reduce((sum, c) => sum + c.leadsGenerated, 0)
  const averageCPA = totalInvestment / totalLeads

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing & CPA</h1>
          <p className="text-gray-600">Análise de custo por aquisição</p>
        </div>
        <button
          onClick={() => setShowNewCampaignModal(true)}
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
                R$ {totalInvestment.toLocaleString()}
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
                const deviation = ((campaign.actualCPA - campaign.targetCPA) / campaign.targetCPA * 100)
                
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {campaign.month}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.investment.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {campaign.leadsGenerated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.targetCPA}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      R$ {campaign.actualCPA}
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
                        <button className="text-blue-600 hover:text-blue-900">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* CPA Evolution Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Evolução do CPA</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Gráfico de evolução do CPA</p>
              <p className="text-sm text-gray-400">Últimos 12 meses</p>
            </div>
          </div>
        </div>

        {/* Investment vs Results */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Investimento vs Resultados</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Comparativo investimento/leads</p>
              <p className="text-sm text-gray-400">Eficiência por período</p>
            </div>
          </div>
        </div>
      </div>

      {/* New Campaign Modal */}
      {showNewCampaignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Nova Campanha</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Período (Mês/Ano)
                </label>
                <input
                  type="month"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Investimento (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leads Gerados
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CPA Meta (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="180,00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button 
                onClick={() => setShowNewCampaignModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Salvar Campanha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}