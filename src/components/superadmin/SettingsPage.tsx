// src/components/superadmin/SettingsPage.tsx
import SuperAdminLayout from './SuperAdminLayout'
import { Settings, Bell, Shield, Mail, Globe, Database } from 'lucide-react'

export default function SettingsPage() {
  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Settings className="w-8 h-8 mr-3 text-gray-600" />
            Configurações do Sistema
          </h1>
          <p className="text-lg text-gray-600 mt-1">
            Gerenciar configurações globais do sistema
          </p>
        </div>

        {/* Settings Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Bell className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Notificações</h3>
                <p className="text-sm text-gray-600">Configurar notificações do sistema</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Em desenvolvimento...
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-purple-100 rounded-xl">
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Segurança</h3>
                <p className="text-sm text-gray-600">Configurações de segurança</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Em desenvolvimento...
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-green-100 rounded-xl">
                <Mail className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">E-mail</h3>
                <p className="text-sm text-gray-600">Configurações de e-mail</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Em desenvolvimento...
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-orange-100 rounded-xl">
                <Globe className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Geral</h3>
                <p className="text-sm text-gray-600">Configurações gerais</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Em desenvolvimento...
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-red-100 rounded-xl">
                <Database className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Banco de Dados</h3>
                <p className="text-sm text-gray-600">Backup e manutenção</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Em desenvolvimento...
            </p>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  )
}
