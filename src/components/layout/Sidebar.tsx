import React from 'react'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  TrendingUp, 
  Target, 
  RefreshCw, 
  CheckSquare, 
  BarChart3,
  Settings,
  UserPlus,
  FileText,
  GraduationCap,
  BookOpen,
  UserCheck
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { user } = useAuth()

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'pedagogical_manager', 'commercial_manager', 'consultant', 'teacher', 'support'] },
    { id: 'leads', label: 'Leads', icon: UserPlus, roles: ['admin', 'commercial_manager', 'consultant', 'support'] },
    { id: 'calendar', label: 'Agenda', icon: Calendar, roles: ['admin', 'commercial_manager', 'consultant', 'support'] },
    { id: 'enrollments', label: 'Matrículas', icon: UserCheck, roles: ['admin', 'pedagogical_manager', 'commercial_manager'] },
    { id: 'marketing', label: 'Marketing & CPA', icon: TrendingUp, roles: ['admin', 'commercial_manager'] },
    { id: 'funnel', label: 'Funil', icon: Target, roles: ['admin', 'commercial_manager'] },
    { id: 'reenrollments', label: 'Rematrículas', icon: RefreshCw, roles: ['admin', 'pedagogical_manager', 'commercial_manager'] },
    { id: 'actions', label: 'Ações', icon: CheckSquare, roles: ['admin', 'pedagogical_manager', 'commercial_manager', 'consultant'] },
    { id: 'reports', label: 'Relatórios', icon: FileText, roles: ['admin', 'pedagogical_manager', 'commercial_manager'] },
    { id: 'users', label: 'Usuários', icon: Users, roles: ['admin'] },
    { id: 'settings', label: 'Configurações', icon: Settings, roles: ['admin'] },
  ]

  const filteredItems = menuItems.filter(item => 
    !user || item.roles.includes(user.role)
  )

  return (
    <div className="bg-white border-r border-gray-200 w-72 min-h-screen flex flex-col shadow-sm">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg">
            <img 
              src="/Inscribo.jpeg" 
              alt="Inscribo" 
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Inscribo</h1>
            <p className="text-sm text-gray-500">Gestão Educacional</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6">
        <ul className="space-y-2 px-4">
          {filteredItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`mr-3 h-5 w-5 transition-colors ${
                    isActive ? 'text-blue-600' : 'text-gray-500 group-hover:text-gray-700'
                  }`} />
                  {item.label}
                  {isActive && (
                    <div className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3 p-3 bg-white rounded-xl shadow-sm">
          <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {user?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.full_name || 'Usuário'}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role?.replace('_', ' ') || 'Carregando...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}