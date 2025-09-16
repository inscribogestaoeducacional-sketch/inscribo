import React from 'react'
import { Target, TrendingUp, TrendingDown, Users, Calendar, Eye, GraduationCap } from 'lucide-react'

interface FunnelStage {
  name: string
  actual: number
  target: number
  conversion: number
  status: 'success' | 'warning' | 'danger'
  icon: React.ReactNode
}

const FUNNEL_DATA: FunnelStage[] = [
  {
    name: 'Cadastros',
    actual: 150,
    target: 120,
    conversion: 100,
    status: 'success',
    icon: <Users className="h-5 w-5" />
  },
  {
    name: 'Agendamentos',
    actual: 85,
    target: 90,
    conversion: 56.7,
    status: 'warning',
    icon: <Calendar className="h-5 w-5" />
  },
  {
    name: 'Visitas',
    actual: 72,
    target: 80,
    conversion: 84.7,
    status: 'warning',
    icon: <Eye className="h-5 w-5" />
  },
  {
    name: 'Matrículas',
    actual: 18,
    target: 24,
    conversion: 25.0,
    status: 'danger',
    icon: <GraduationCap className="h-5 w-5" />
  }
]

export default function FunnelAnalysis() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Análise do Funil</h1>
          <p className="text-gray-600">Planejamento e performance do funil de vendas</p>
        </div>
        <div className="flex items-center space-x-2">
          <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
            <option>Janeiro 2024</option>
            <option>Dezembro 2023</option>
            <option>Novembro 2023</option>
          </select>
        </div>
      </div>

      {/* Funnel Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Resumo do Funil Geral</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {FUNNEL_DATA.map((stage, index) => {
            const deviation = ((stage.actual - stage.target) / stage.target * 100)
            const isLast = index === FUNNEL_DATA.length - 1
            
            return (
              <div key={stage.name} className="relative">
                <div className={`rounded-lg p-6 ${
                  stage.status === 'success' ? 'bg-green-50 border border-green-200' :
                  stage.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 rounded-lg ${
                      stage.status === 'success' ? 'bg-green-100 text-green-600' :
                      stage.status === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-red-100 text-red-600'
                    }`}>
                      {stage.icon}
                    </div>
                    <div className="flex items-center">
                      {deviation >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                  
                  <h4 className="text-sm font-medium text-gray-900 mb-2">{stage.name}</h4>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Realizado</span>
                      <span className="text-lg font-bold text-gray-900">{stage.actual}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Meta</span>
                      <span className="text-sm text-gray-700">{stage.target}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-600">Desvio</span>
                      <span className={`text-sm font-medium ${
                        deviation >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {deviation >= 0 ? '+' : ''}{deviation.toFixed(1)}%
                      </span>
                    </div>
                    {index > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600">Conversão</span>
                        <span className="text-sm font-medium text-blue-600">
                          {stage.conversion}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {!isLast && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <div className="w-6 h-0.5 bg-gray-300"></div>
                    <div className="absolute right-0 top-1/2 transform -translate-y-1/2 translate-x-1">
                      <div className="w-0 h-0 border-l-4 border-r-0 border-t-2 border-b-2 border-l-gray-400 border-t-transparent border-b-transparent"></div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visualização do Funil</h3>
          <div className="space-y-4">
            {FUNNEL_DATA.map((stage, index) => {
              const width = (stage.actual / FUNNEL_DATA[0].actual) * 100
              
              return (
                <div key={stage.name} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{stage.name}</span>
                    <span className="text-sm text-gray-600">{stage.actual}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-8">
                    <div 
                      className={`h-8 rounded-full flex items-center justify-end pr-2 ${
                        stage.status === 'success' ? 'bg-green-500' :
                        stage.status === 'warning' ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-xs font-medium text-white">
                        {width.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Performance Comparison */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativo de Performance</h3>
          
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Meta vs Realizado</h4>
              <div className="space-y-2">
                {FUNNEL_DATA.map((stage) => (
                  <div key={stage.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{stage.name}</span>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-900">{stage.actual}</span>
                      <span className="text-xs text-gray-500">/</span>
                      <span className="text-sm text-gray-700">{stage.target}</span>
                      {stage.actual >= stage.target ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Taxas de Conversão</h4>
              <div className="space-y-2">
                {FUNNEL_DATA.slice(1).map((stage, index) => (
                  <div key={stage.name} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {FUNNEL_DATA[index].name} → {stage.name}
                    </span>
                    <span className={`text-sm font-medium ${
                      stage.conversion >= 70 ? 'text-green-600' :
                      stage.conversion >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {stage.conversion}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Comparativo Histórico</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Cadastros
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Agendamentos
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Visitas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Matrículas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Taxa Final
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Janeiro 2024
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">150</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">85</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">72</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">18</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">12.0%</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Dezembro 2023
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">130</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">95</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">82</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">24</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">18.5%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}