import React from 'react'
import { BarChart3, TrendingUp, PieChart } from 'lucide-react'

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Enrollment Evolution Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de Matrículas</h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Gráfico de evolução mensal</p>
            <p className="text-sm text-gray-400">Matrículas: Jan-Dez 2024</p>
          </div>
        </div>
      </div>

      {/* CPA Evolution Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de CPA</h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500">Custo por Aquisição</p>
            <p className="text-sm text-gray-400">CPA médio: R$ 245,00</p>
          </div>
        </div>
      </div>

      {/* Re-enrollment Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Progresso Rematrículas</h3>
          <PieChart className="h-5 w-5 text-gray-500" />
        </div>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Meta: 85%</span>
              <span>Atual: 92.5%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-2 rounded-full" style={{ width: '92.5%' }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Rematriculados</p>
              <p className="font-semibold text-green-600">1,248</p>
            </div>
            <div>
              <p className="text-gray-600">Pendentes</p>
              <p className="font-semibold text-orange-600">102</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
            <span className="text-sm font-medium text-blue-700">Novo Lead</span>
            <Users className="h-4 w-4 text-blue-600" />
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
            <span className="text-sm font-medium text-green-700">Agendar Visita</span>
            <Calendar className="h-4 w-4 text-green-600" />
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
            <span className="text-sm font-medium text-purple-700">Ver Relatórios</span>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors">
            <span className="text-sm font-medium text-orange-700">Importar/Exportar</span>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </button>
        </div>
      </div>
    </div>
  )
}