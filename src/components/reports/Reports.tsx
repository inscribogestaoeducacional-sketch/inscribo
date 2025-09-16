import React, { useState } from 'react'
import { FileText, Download, Calendar, TrendingUp, Users, DollarSign, BarChart3 } from 'lucide-react'

export default function Reports() {
  const [selectedPeriod, setSelectedPeriod] = useState('current-month')
  const [selectedReport, setSelectedReport] = useState('leads')

  const reportTypes = [
    { id: 'leads', name: 'Relatório de Leads', icon: Users, description: 'Análise completa dos leads por período' },
    { id: 'conversions', name: 'Relatório de Conversões', icon: TrendingUp, description: 'Taxa de conversão do funil de vendas' },
    { id: 'financial', name: 'Relatório Financeiro', icon: DollarSign, description: 'Receitas, matrículas e CPA' },
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
    // Mock report generation
    alert(`Gerando ${reportTypes.find(r => r.id === selectedReport)?.name} para ${periods.find(p => p.id === selectedPeriod)?.name}`)
  }

  const mockReportData = {
    leads: {
      total: 247,
      new: 45,
      converted: 18,
      conversionRate: 17.2
    },
    financial: {
      revenue: 125000,
      enrollments: 42,
      averageTicket: 2976,
      cpa: 185
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-600">Análises e relatórios gerenciais</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Configuration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurar Relatório</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Relatório
                </label>
                <div className="space-y-2">
                  {reportTypes.map(report => (
                    <label key={report.id} className="flex items-center">
                      <input
                        type="radio"
                        name="reportType"
                        value={report.id}
                        checked={selectedReport === report.id}
                        onChange={(e) => setSelectedReport(e.target.value)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      <div className="ml-3">
                        <div className="flex items-center">
                          <report.icon className="h-4 w-4 text-gray-500 mr-2" />
                          <span className="text-sm font-medium text-gray-900">{report.name}</span>
                        </div>
                        <p className="text-xs text-gray-500">{report.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Período
                </label>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {periods.map(period => (
                    <option key={period.id} value={period.id}>{period.name}</option>
                  ))}
                </select>
              </div>

              {selectedPeriod === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Final
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerateReport}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Relatório
              </button>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Preview - {reportTypes.find(r => r.id === selectedReport)?.name}
              </h3>
              <button className="text-blue-600 hover:text-blue-700 flex items-center text-sm">
                <Download className="h-4 w-4 mr-1" />
                Exportar PDF
              </button>
            </div>

            {selectedReport === 'leads' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{mockReportData.leads.total}</div>
                    <div className="text-sm text-gray-600">Total de Leads</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{mockReportData.leads.new}</div>
                    <div className="text-sm text-gray-600">Novos Leads</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{mockReportData.leads.converted}</div>
                    <div className="text-sm text-gray-600">Convertidos</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{mockReportData.leads.conversionRate}%</div>
                    <div className="text-sm text-gray-600">Taxa Conversão</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Leads por Origem</h4>
                  <div className="space-y-2">
                    {[
                      { source: 'Facebook', count: 89, percentage: 36 },
                      { source: 'Instagram', count: 67, percentage: 27 },
                      { source: 'Google', count: 45, percentage: 18 },
                      { source: 'Indicação', count: 32, percentage: 13 },
                      { source: 'Site', count: 14, percentage: 6 }
                    ].map(item => (
                      <div key={item.source} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{item.source}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${item.percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">{item.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedReport === 'financial' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      R$ {mockReportData.financial.revenue.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Receita Total</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{mockReportData.financial.enrollments}</div>
                    <div className="text-sm text-gray-600">Matrículas</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      R$ {mockReportData.financial.averageTicket.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Ticket Médio</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      R$ {mockReportData.financial.cpa}
                    </div>
                    <div className="text-sm text-gray-600">CPA Médio</div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Evolução Mensal</h4>
                  <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500">Gráfico de evolução mensal seria exibido aqui</p>
                  </div>
                </div>
              </div>
            )}

            {(selectedReport === 'conversions' || selectedReport === 'marketing') && (
              <div className="space-y-6">
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    {reportTypes.find(r => r.id === selectedReport)?.name}
                  </h4>
                  <p className="text-gray-500 mb-4">
                    {reportTypes.find(r => r.id === selectedReport)?.description}
                  </p>
                  <button
                    onClick={handleGenerateReport}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Gerar Relatório Completo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Reports */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Relatórios Rápidos</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Leads Hoje', value: '12', change: '+3', color: 'blue' },
            { title: 'Visitas Semana', value: '28', change: '+5', color: 'green' },
            { title: 'Matrículas Mês', value: '42', change: '+8', color: 'purple' },
            { title: 'CPA Atual', value: 'R$ 185', change: '-12', color: 'orange' }
          ].map((item, index) => (
            <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{item.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                </div>
                <div className={`text-sm font-medium ${
                  item.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {item.change}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}