import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  Bell, User, Settings, LogOut, ChevronDown,
  Search, Shield, Building2
} from 'lucide-react'

export default function TopBar() {
  const { user, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleSignOut = async () => {
    try { await signOut() } catch (e) { console.error(e) }
  }

  const getRoleInfo = (role: string) => {
    switch (role) {
      case 'admin':   return { label: 'Administrador', color: '#dc2626', bg: '#FEF2F2', icon: Shield }
      case 'manager': return { label: 'Gestor',        color: '#2563eb', bg: '#EFF6FF', icon: User   }
      default:        return { label: 'Consultor',     color: '#64748B', bg: '#F8FAFC', icon: User   }
    }
  }

  const roleInfo = getRoleInfo(user?.role || 'user')
  const RoleIcon = roleInfo.icon
  const initials = user?.full_name?.charAt(0).toUpperCase() || 'U'

  return (
    <header className="flex-shrink-0 flex items-center justify-between px-6 h-14 bg-white"
      style={{ borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-faint)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar leads, visitas, matrículas..."
            className="w-full h-9 pl-9 pr-4 text-sm transition-all outline-none"
            style={{
              background: 'var(--color-bg)',
              border: '1.5px solid transparent',
              borderRadius: 'var(--radius-full)',
              color: 'var(--color-text)',
            }}
            onFocus={e => {
              e.target.style.background = '#fff'
              e.target.style.borderColor = 'var(--color-primary)'
              e.target.style.boxShadow = '0 0 0 3px rgba(0,168,150,0.12)'
            }}
            onBlur={e => {
              e.target.style.background = 'var(--color-bg)'
              e.target.style.borderColor = 'transparent'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 ml-4">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg transition-colors hover:bg-gray-50"
          style={{ color: 'var(--color-muted)' }}>
          <Bell className="w-4.5 h-4.5 w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(v => !v)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg transition-all hover:bg-gray-50"
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#00A896,#1A2B4A)' }}>
              {initials}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--color-navy)' }}>
                {user?.full_name || 'Usuário'}
              </p>
              <p className="text-[11px] leading-tight" style={{ color: 'var(--color-muted)' }}>{roleInfo.label}</p>
            </div>
            <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--color-faint)' }} />
          </button>

          {showUserMenu && (
            <>
              {/* Backdrop */}
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              {/* Dropdown */}
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl z-50 overflow-hidden"
                style={{ border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>

                {/* Profile header */}
                <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)', background: '#F8FAFB' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-base font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#00A896,#1A2B4A)' }}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--color-navy)' }}>{user?.full_name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>{user?.email}</p>
                    </div>
                  </div>
                  <div className="rounded-lg px-3 py-2.5" style={{ background: roleInfo.bg, border: '1px solid var(--color-border)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <RoleIcon className="w-3.5 h-3.5" style={{ color: roleInfo.color }} />
                      <span className="text-xs font-bold" style={{ color: roleInfo.color }}>{roleInfo.label}</span>
                      {user?.is_super_admin && (
                        <span className="ml-auto text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold">SUPER</span>
                      )}
                    </div>
                    {user?.institution_name && (
                      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--color-border)' }}>
                        <Building2 className="w-3 h-3" style={{ color: 'var(--color-faint)' }} />
                        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--color-muted)' }}>
                          {user.institution_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <Link to="/profile" onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 no-underline"
                    style={{ color: 'var(--color-text)' }}>
                    <User className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    Meu Perfil
                  </Link>
                  <Link to="/settings" onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 no-underline"
                    style={{ color: 'var(--color-text)' }}>
                    <Settings className="w-4 h-4" style={{ color: 'var(--color-muted)' }} />
                    Configurações
                  </Link>
                  <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
                  <button onClick={handleSignOut}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors hover:bg-red-50 text-left"
                    style={{ color: '#dc2626' }}>
                    <LogOut className="w-4 h-4" />
                    Sair da Conta
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
