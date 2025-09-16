import React from 'react'
import { Link, useLocation } from 'react-router-dom'
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

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Agenda', href: '/calendar', icon: Calendar },
  { name: 'Marketing', href: '/marketing', icon: TrendingUp },
  { name: 'Funil', href: '/funnel', icon: Target },
  { name: 'Matrículas', href: '/enrollments', icon: UserCheck },
  { name: 'Rematrículas', href: '/reenrollments', icon: GraduationCap },
  { name: 'Ações', href: '/actions', icon: CheckSquare },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Configurações', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <div className="flex flex-col w-64 bg-gray-900">
      <div className="flex items-center justify-center h-16 px-4 bg-gray-800">
        <h1 className="text-xl font-bold text-white">EduCRM</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}