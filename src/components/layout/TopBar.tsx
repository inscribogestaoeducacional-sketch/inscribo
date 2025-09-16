import React from 'react'
import { Bell, Search, LogOut, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function TopBar() {
  const { signOut, user } = useAuth()

  const handleSignOut = () => {
    signOut()
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar leads, alunos, visitas..."
              className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-80 transition-all bg-gray-50 focus:bg-white"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Notifications */}
          <button 
            className="relative p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
            title="Notificações"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User menu */}
          <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user?.full_name || 'Usuário'}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {user?.role?.replace('_', ' ') || 'Administrador'}
              </p>
            </div>
            <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-sm font-medium text-white">
                {user?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}