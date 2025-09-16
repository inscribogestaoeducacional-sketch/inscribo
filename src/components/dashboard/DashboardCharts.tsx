import React from 'react'
import { BarChart3, TrendingUp, PieChart, Plus, Calendar, Users, FileText } from 'lucide-react'

export default function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Enrollment Evolution Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de Matrículas</h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Gráfico de evolução mensal</p>
            <p className="text-sm text-gray-400">Dados carregados do Supabase</p>
          </div>
        </div>
      </div>

      {/* CPA Evolution Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Evolução de CPA</h3>
          <BarChart3 className="h-5 w-5 text-gray-500" />
        </div>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">Custo por Aquisição</p>
            <p className="text-sm text-gray-400">Dados em tempo real</p>
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
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Meta: 85%</span>
              <span className="font-bold text-green-600">Atual: 92.5%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full shadow-sm" style={{ width: '92.5%' }}></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm pt-2">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-gray-600 mb-1">Rematriculados</p>
              <p className="font-bold text-green-700 text-lg">1,248</p>
            </div>
            <div className="bg-orange-50 p-3 rounded-lg">
              <p className="text-gray-600 mb-1">Pendentes</p>
              <p className="font-bold text-orange-700 text-lg">102</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h3>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors group">
            <span className="text-sm font-medium text-blue-700">Novo Lead</span>
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-blue-600" />
              <Plus className="h-3 w-3 text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors group">
            <span className="text-sm font-medium text-green-700">Agendar Visita</span>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <Plus className="h-3 w-3 text-green-500 group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors group">
            <span className="text-sm font-medium text-purple-700">Ver Relatórios</span>
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <BarChart3 className="h-3 w-3 text-purple-500 group-hover:scale-110 transition-transform" />
            </div>
          </button>
          <button className="w-full flex items-center justify-between p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors group">
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