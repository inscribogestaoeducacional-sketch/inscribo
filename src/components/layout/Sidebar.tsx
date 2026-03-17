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
      { icon: LayoutDashboard, label: 'Dashboard',    path: '/dashboard'   },
      { icon: Users,           label: 'Leads',        path: '/leads'       },
      { icon: Calendar,        label: 'Visitas',      path: '/visits'      },
      { icon: GraduationCap,   label: 'Matrículas',   path: '/enrollments' },
      { icon: MessageCircle,   label: 'WhatsApp',     path: '/whatsapp'    },
    ]
    const managerItems = [
      { icon: BarChart3, label: 'Relatórios', path: '/reports' },
    ]
    const adminItems = [
      { icon: UserCog,  label: 'Usuários',      path: '/users'    },
      { icon: Settings, label: 'Configurações', path: '/settings' },
    ]
    switch (role) {
      case 'admin':   return [...baseItems, ...managerItems, ...adminItems]
      case 'manager': return [...baseItems, ...managerItems]
      default:        return baseItems
    }
  }

  const menuItems = getMenuItemsByRole(user?.role || 'user')
  const isActive = (path: string) => location.pathname === path

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 h-14"
        style={{ background: 'linear-gradient(90deg,#1A2B4A,#0F1E35)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
        <img src="/Inscribologo.png" alt="Inscribo" className="h-8 w-auto" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white">
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar panel */}
      <div className={`
        fixed left-0 top-0 h-full w-[220px] z-50 flex flex-col
        transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{ background: 'linear-gradient(180deg,#1A2B4A 0%,#0F1E35 100%)', boxShadow: '2px 0 12px rgba(0,0,0,0.18)' }}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <img src="/Inscribologo.png" alt="Inscribo" className="h-8 w-auto" />
          <button onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-2 overflow-y-auto px-2 py-1">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 my-0.5 rounded-lg text-[13.5px] font-medium transition-all duration-200 no-underline"
                style={{
                  color: active ? '#fff' : 'rgba(255,255,255,0.62)',
                  background: active ? 'rgba(0,168,150,0.22)' : 'transparent',
                  borderLeft: active ? '3px solid #00A896' : '3px solid transparent',
                  paddingLeft: active ? '9px' : '12px',
                  fontWeight: active ? 600 : 500,
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0"
                  style={{ color: active ? '#00A896' : 'rgba(255,255,255,0.55)' }} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-[11px] text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
            © 2025 Inscribo
          </p>
        </div>
      </div>
    </>
  )
}

export default Sidebar
