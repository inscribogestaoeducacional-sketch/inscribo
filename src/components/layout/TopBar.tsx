import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { 
  Bell, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown,
  Menu,
  Search,
  Shield,
  Building2
} from 'lucide-react'

export default function TopBar() {
  const { user, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSignOut = async () => {
    try {
      console.log('Signing out...')
      await signOut()
      console.log('Sign out successful')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'admin':
        return { label: 'Administrador', color: 'text-red-600', bg: 'bg-red-50', icon: Shield }
      case 'manager':
        return { label: 'Gestor', color: 'text-blue-600', bg: 'bg-blue-50', icon: User }
      case 'user':
      default:
        return { label: 'Consultor', color: 'text-gray-600', bg: 'bg-gray-50', icon: User }
    }
  }

  const roleInfo = getRoleInfo(user?.role || 'user')
  const RoleIcon = roleInfo.icon

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Mobile menu button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar - Novo */}
        <div className="flex-1 max-w-2xl mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar leads, visitas, matrículas..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D4C4] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Right side - Notifications and User Menu */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <button className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu - Expandido com informações do perfil */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-3 p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-[#00D4C4] to-[#2D3E9E] rounded-full flex items-center justify-center shadow-sm">
                <span className="text-white text-sm font-bold">
                  {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-900">
                  {user?.full_name || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500">{roleInfo.label}</p>
              </div>
              <ChevronDown className="w-4 h-4" />
            </button>

            {/* User Dropdown Menu - Expandido */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#00D4C4] to-[#2D3E9E] rounded-full flex items-center justify-center shadow-md">
                      <span className="text-white text-lg font-bold">
                        {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">
                        {user?.full_name}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                  </div>

                  {/* Informações do Perfil - Movidas para cá */}
                  <div className={`${roleInfo.bg} rounded-lg p-3 border border-gray-200`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <RoleIcon className={`w-4 h-4 ${roleInfo.color}`} />
                        <span className={`text-sm font-bold ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                      {user?.is_super_admin && (
                        <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                          SUPER
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-gray-600 mb-2">
                      {user?.role === 'admin' && 'Acesso completo à instituição'}
                      {user?.role === 'manager' && 'Gestão e relatórios'}
                      {user?.role === 'user' && 'Leads, visitas e matrículas'}
                    </p>

                    {user?.institution_name && (
                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-3 h-3 text-gray-500" />
                          <span className="text-xs text-gray-600">Instituição:</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-900 mt-1 bg-white px-2 py-1 rounded">
                          {user.institution_name}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="py-2">
                  <Link
                    to="/profile"
                    className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="w-4 h-4 mr-3 text-gray-500" />
                    Meu Perfil
                  </Link>
                  
                  <Link
                    to="/settings"
                    className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="w-4 h-4 mr-3 text-gray-500" />
                    Configurações
                  </Link>
                  
                  <div className="border-t border-gray-100 my-2"></div>
                  
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Sair da Conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50">
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-lg">
            <div className="p-4">
              <button
                onClick={() => setShowMobileMenu(false)}
                className="mb-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                ✕ Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
