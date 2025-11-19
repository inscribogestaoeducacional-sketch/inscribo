import React, { useState } from 'react'
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
  GraduationCap,
  Menu,
  X
} from 'lucide-react'

const Sidebar = () => {
  const location = useLocation()
  const { user } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      {/* Mobile Header - Só aparece no mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <img 
            src="/Inscribologo.png" 
            alt="Inscribo" 
            className="h-10 w-auto"
          />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6 text-gray-600" />
            ) : (
              <Menu className="h-6 w-6 text-gray-600" />
            )}
          </button>
        </div>
      </div>

      {/* Overlay - Só aparece quando menu mobile está aberto */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Desktop e Mobile */}
      <div className={`
        bg-white shadow-lg h-full w-64 fixed left-0 top-0 z-50 flex flex-col
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo - Desktop */}
        <div className="hidden lg:block p-6 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-center justify-center">
            <img 
              src="/Inscribologo.png" 
              alt="Inscribo" 
              className="h-16 w-auto transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>

        {/* Logo - Mobile (dentro do drawer) */}
        <div className="lg:hidden p-6 border-b border-gray-100 bg-gradient-to-br from-white to-gray-50">
          <div className="flex items-center justify-between">
            <img 
              src="/Inscribologo.png" 
              alt="Inscribo" 
              className="h-12 w-auto"
            />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 mt-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={handleLinkClick}
                    className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'bg-gradient-to-r from-[#00D4C4]/10 to-[#2D3E9E]/10 text-[#2D3E9E] shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive(item.path) ? 'text-[#00D4C4]' : ''}`} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <div className="text-center text-xs text-gray-400">
            © 2024 Inscribo
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
