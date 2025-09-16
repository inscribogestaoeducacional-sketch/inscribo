import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  GraduationCap, 
  TrendingUp, 
  RotateCcw, 
  BarChart3, 
  CheckSquare, 
  FileText, 
  Settings,
  UserCog,
  BookOpen
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Kanban de Leads', href: '/leads', icon: Users },
  { name: 'Calendário de Visitas', href: '/calendar', icon: Calendar },
  { name: 'Matrículas', href: '/enrollments', icon: GraduationCap },
  { name: 'Marketing & CPA', href: '/marketing', icon: TrendingUp },
  { name: 'Rematrículas', href: '/reenrollments', icon: RotateCcw },
  { name: 'Planejamento & Funil', href: '/funnel', icon: BarChart3 },
  { name: 'Ações Automáticas', href: '/actions', icon: CheckSquare },
  { name: 'Relatórios', href: '/reports', icon: FileText },
]

const managementNavigation = [
  { name: 'Usuários', href: '/users', icon: UserCog },
  { name: 'Configurações', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const { user } = useAuth()
  const currentPath = window.location.pathname

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Inscribo</h1>
          <p className="text-xs text-gray-500">Gestão Educacional</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = currentPath === item.href
          return (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </a>
          )
        })}

        {/* Management Section */}
        {user?.role === 'admin' && (
          <>
            <div className="pt-6 pb-2">
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Gerenciamento
              </h3>
            </div>
            {managementNavigation.map((item) => {
              const isActive = currentPath === item.href
              return (
                <a
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </a>
              )
            })}
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role === 'admin' ? 'Administrador' : 
               user?.role === 'manager' ? 'Gerente' : 'Usuário'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}