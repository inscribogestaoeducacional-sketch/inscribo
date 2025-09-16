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
  Settings
} from 'lucide-react'

const Sidebar = () => {
  const location = useLocation()
  const { user } = useAuth()

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Users, label: 'Leads', path: '/leads' },
    { icon: Calendar, label: 'Visitas', path: '/visits' },
    { icon: UserCheck, label: 'Matrículas', path: '/enrollments' },
    { icon: TrendingUp, label: 'Marketing', path: '/marketing' },
    { icon: Target, label: 'Funil', path: '/funnel' },
    { icon: CheckSquare, label: 'Rematrículas', path: '/reenrollments' },
    { icon: CheckSquare, label: 'Ações', path: '/actions' },
    { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    { icon: Settings, label: 'Configurações', path: '/settings' }
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="bg-white shadow-lg h-full w-64 fixed left-0 top-0 z-40">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800">Inscribo</h1>
        <p className="text-sm text-gray-600 mt-1">Sistema de Gestão</p>
      </div>
      
      <nav className="mt-6">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`flex items-center px-6 py-3 text-sm font-medium transition-colors duration-200 ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
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

      {user && (
        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-gray-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.full_name.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-700">{user.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar