import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { LogOut, Settings, User, Menu } from 'lucide-react'
import NotificationBell from './NotificationBell'

export default function TopBar() {
  const { user, signOut } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const initials = (user?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('')
  const roleLabel = user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gestor' : 'Consultor'

  return (
    <header style={{
      height: 58, background: '#FFFFFF',
      borderBottom: '0.5px solid #D1FAE5',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 12, flexShrink: 0,
    }}>
      {/* Hambúrguer — mobile only */}
      {isMobile && (
        <button
          onClick={() => (window as any).__toggleMobileSidebar?.()}
          style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: '#1A2B4A', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <Menu size={22} />
        </button>
      )}

      {/* Search */}
      <div style={{ flex: 1, maxWidth: isMobile ? 'none' : 440, position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar leads, visitas, matrículas..."
          style={{
            width: '100%', height: 38, paddingLeft: 38, paddingRight: 14,
            background: '#F0FDFB', border: '1.5px solid #D1FAE5',
            borderRadius: 9999, fontSize: 13, color: '#1A2B4A',
            outline: 'none', transition: 'all 0.18s ease',
          }}
          onFocus={e => { e.target.style.background = '#fff'; e.target.style.borderColor = '#00A896'; e.target.style.boxShadow = '0 0 0 3px rgba(0,168,150,0.10)' }}
          onBlur={e => { e.target.style.background = '#F0FDFB'; e.target.style.borderColor = '#D1FAE5'; e.target.style.boxShadow = 'none' }}
        />
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8', pointerEvents: 'none' }}
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Bell */}
        <NotificationBell institutionId={user?.institution_id || null} isSuperAdmin={user?.user_type === 'admin_geral'} />

        {/* User pill */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setShowMenu(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 6px', borderRadius: 12, background: '#F0FDFB', border: '0.5px solid #D1FAE5', cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#00A896,#0DD3BF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
              {initials}
            </div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{user?.full_name}</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>{roleLabel}</div>
            </div>
            <svg width="12" height="12" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 2 }}><polyline points="6 9 12 15 18 9" /></svg>
          </div>

          {showMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowMenu(false)} />
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#fff', borderRadius: 14, border: '0.5px solid #D1FAE5', boxShadow: '0 8px 32px rgba(0,168,150,0.12)', zIndex: 50, minWidth: 200, overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E2E8F0', background: '#F0FDFB' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{user?.full_name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{user?.email}</div>
                </div>
                <div style={{ padding: '4px 0' }}>
                  <Link to="/profile" onClick={() => setShowMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, color: '#1A2B4A', textDecoration: 'none', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FDFB'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <User size={14} color="#64748B" /> Meu Perfil
                  </Link>
                  <Link to="/settings" onClick={() => setShowMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, color: '#1A2B4A', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0FDFB'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <Settings size={14} color="#64748B" /> Configurações
                  </Link>
                  <div style={{ borderTop: '0.5px solid #E2E8F0', margin: '4px 0' }} />
                  <button onClick={async () => { try { await signOut() } catch {} }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', fontSize: 13, color: '#F43F5E', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FFE4E6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <LogOut size={14} /> Sair da Conta
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
