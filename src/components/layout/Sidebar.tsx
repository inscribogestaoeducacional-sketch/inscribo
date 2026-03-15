import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard,
  Users,
  Calendar,
  GraduationCap,
  MessageCircle,
  BarChart3,
  UserCog,
  Settings,
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
      { icon: Users,           label: 'Leads',     path: '/leads'     },
      { icon: Calendar,        label: 'Visitas',   path: '/visits'    },
      { icon: GraduationCap,   label: 'Matrículas',path: '/enrollments'},
      { icon: MessageCircle,   label: 'WhatsApp',  path: '/whatsapp'  },
    ]
    const managerItems = [
      { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    ]
    const adminItems = [
      { icon: UserCog,  label: 'Usuários',       path: '/users'    },
      { icon: Settings, label: 'Configurações',  path: '/settings' },
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
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-[#1e2d6b] border-b border-[#151b4e] z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <img src="/Inscribologo.png" alt="Inscribo" className="h-8 w-auto" />
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5 text-white" />
            ) : (
              <Menu className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        bg-[#1e2d6b] shadow-lg h-full w-[220px] fixed left-0 top-0 z-50 flex flex-col
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo - Desktop */}
        <div className="hidden lg:block p-4 border-b border-[#151b4e]">
          <div className="flex items-center justify-center">
            <img
              src="/Inscribologo.png"
              alt="Inscribo"
              className="h-8 w-auto transition-transform duration-300 hover:scale-105"
            />
          </div>
        </div>

        {/* Logo - Mobile (drawer) */}
        <div className="lg:hidden p-4 border-b border-[#151b4e]">
          <div className="flex items-center justify-between">
            <img src="/Inscribologo.png" alt="Inscribo" className="h-8 w-auto" />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 mt-3 overflow-y-auto">
          <ul className="space-y-0.5 px-2">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={handleLinkClick}
                    className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive(item.path)
                        ? 'border-l-4 border-[#14b8a6] bg-white/10 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`mr-3 w-4 h-4 ${isActive(item.path) ? 'text-[#14b8a6]' : 'text-white/70'}`} />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-[#151b4e]">
          <div className="text-center text-xs text-white/40">
            © 2024 Inscribo
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
