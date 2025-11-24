// src/components/superadmin/AnalyticsPage.tsx
import SuperAdminLayout from './SuperAdminLayout'
import { BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react'

export default function AnalyticsPage() {
  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="w-8 h-8 mr-3 text-orange-600" />
            Analytics
          </h1>
          <p className="text-lg text-gray-600 mt-1">
            Métricas e relatórios do sistema
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Receita Total</p>
                <p className="text-3xl font-bold text-gray-900">R$ 0</p>
              </div>
              <div className="p-4 bg-green-100 rounded-2xl">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Crescimento</p>
                <p className="text-3xl font-bold text-green-600">+0%</p>
              </div>
              <div className="p-4 bg-blue-100 rounded-2xl">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Usuários Ativos</p>
                <p className="text-3xl font-bold text-purple-600">0</p>
              </div>
              <div className="p-4 bg-purple-100 rounded-2xl">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Conversões</p>
                <p className="text-3xl font-bold text-orange-600">0</p>
              </div>
              <div className="p-4 bg-orange-100 rounded-2xl">
                <BarChart3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Página em Desenvolvimento
          </h3>
          <p className="text-gray-600">
            Gráficos e relatórios analíticos estão sendo desenvolvidos.
          </p>
        </div>
      </div>
    </SuperAdminLayout>
  )
}
