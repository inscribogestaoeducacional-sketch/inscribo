import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Calendar,
  TrendingUp,
  Target,
  UserCheck,
  CheckSquare,
  BarChart3,
  Settings,
  GraduationCap
} from 'lucide-react'

const Sidebar = () => {
  const location = useLocation()
  const { user } = useAuth()

  const getMenuItemsByRole = (role: string) => {
    const baseItems = [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { icon: Users, label: 'Leads', path: '/leads' },
      { icon: Calendar, label: 'Visitas', path: '/visits' },
      { icon: GraduationCap, label: 'Matrículas', path: '/enrollments' }
    ]

    const managerItems = [
      { icon: TrendingUp, label: 'Marketing', path: '/marketing' },
      { icon: Target, label: 'Funil', path: '/funnel' },
      { icon: CheckSquare, label: 'Rematrículas', path: '/reenrollments' },
      { icon: CheckSquare, label: 'Ações', path: '/actions' },
      { icon: BarChart3, label: 'Relatórios', path: '/reports' }
    ]

    const adminItems = [
      { icon: Users, label: 'Usuários', path: '/users' },
      { icon: Settings, label: 'Configurações', path: '/settings' }
    ]

    switch (role) {
      case 'admin':
        return [...baseItems, ...managerItems, ...adminItems]
      case 'manager':
        return [...baseItems, ...managerItems]
      case 'user':
      default:
        return baseItems
    }
  }

  const menuItems = getMenuItemsByRole(user?.role || 'user')
  const isActive = (path: string) => location.pathname === path

  return (
    <div className="bg-white shadow-lg h-full w-64 fixed left-0 top-0 z-40">
      {/* Logo - Substituído */}
      <div className="p-6 border-b border-gray-100">
        <img 
          src="/Inscribologo.png" 
          alt="Inscribo" 
          className="h-12 w-auto"
        />
      </div>
      
      <nav className="mt-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-6 py-3 text-sm font-medium transition-all duration-200 ${
                    isActive(item.path)
                      ? 'bg-gradient-to-r from-[#00D4C4]/10 to-[#2D3E9E]/10 text-[#2D3E9E] border-r-4 border-[#00D4C4]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Info na parte inferior */}
      {user && (
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200 bg-gradient-to-br from-gray-50 to-white">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00D4C4] to-[#2D3E9E] rounded-full flex items-center justify-center shadow-md">
                <span className="text-white text-sm font-bold">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize truncate">
                {user.role === 'admin' ? 'Administrador' : 
                 user.role === 'manager' ? 'Gestor' : 'Consultor'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar
