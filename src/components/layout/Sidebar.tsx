import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotifications } from '../../hooks/useNotifications'
import {
  LayoutDashboard, Users, Calendar,
  MessageCircle, BarChart3, UserCog, Settings, ArrowRightLeft
} from 'lucide-react'

const NAV_CFG = [
  { path: '/home',            label: 'Início',          iconBg: '#E6F7F5', iconColor: '#00A896', Icon: LayoutDashboard, roles: ['admin','manager','user'] },
  { path: '/leads',           label: 'Leads',           iconBg: '#EDE9FE', iconColor: '#8B5CF6', Icon: Users,           roles: ['admin','manager','user'] },
  { path: '/visits',          label: 'Visitas',         iconBg: '#FEF3C7', iconColor: '#F59E0B', Icon: Calendar,        roles: ['admin','manager','user'] },
  { path: '/whatsapp',        label: 'WhatsApp',        iconBg: '#D1FAE5', iconColor: '#10B981', Icon: MessageCircle,   roles: ['admin','manager','user'] },
  { path: '/reports',         label: 'Relatórios',      iconBg: '#DBEAFE', iconColor: '#3B82F6', Icon: BarChart3,       roles: ['admin','manager'] },
  { path: '/transferencias',  label: 'Transferências',  iconBg: '#FEE2E2', iconColor: '#DC2626', Icon: ArrowRightLeft,  roles: ['admin','manager'] },
  { path: '/users',           label: 'Usuários',        iconBg: '#F1F5F9', iconColor: '#64748B', Icon: UserCog,         roles: ['admin'] },
  { path: '/settings',        label: 'Config.',         iconBg: '#F1F5F9', iconColor: '#64748B', Icon: Settings,        roles: ['admin'] },
]

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: 'absolute', left: 52, top: '50%', transform: 'translateY(-50%)',
          background: '#1A2B4A', color: 'white', fontSize: 12, fontWeight: 500,
          padding: '5px 10px', borderRadius: 8, whiteSpace: 'nowrap',
          zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {text}
          <div style={{
            position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)',
            borderWidth: '4px', borderStyle: 'solid',
            borderColor: 'transparent #1A2B4A transparent transparent',
          }} />
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()
  const { unreadCount } = useNotifications(user?.institution_id || null)

  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem('sidebar-expanded') === 'true'
  })

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem('sidebar-expanded', String(next))
  }

  const navItems = NAV_CFG.filter(item => item.roles.includes(user?.role || 'user'))
  const initials = (user?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
  const userName = user?.full_name || 'Usuário'
  const userRole = user?.role === 'admin' ? 'Administrador' : user?.role === 'manager' ? 'Gestor' : 'Usuário'

  return (
    <aside style={{
      width: expanded ? 220 : 64,
      minWidth: expanded ? 220 : 64,
      height: '100vh',
      background: '#FFFFFF',
      borderRight: '0.5px solid #D1FAE5',
      display: 'flex',
      flexDirection: 'column',
      alignItems: expanded ? 'stretch' : 'center',
      padding: expanded ? '12px 10px' : '12px 0',
      gap: 2,
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
      flexShrink: 0,
    }}>

      {/* Logo + toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'space-between' : 'center',
        padding: expanded ? '4px 6px 12px' : '4px 0 12px',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: expanded ? 8 : 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: '#00A896', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.5)' }} />
          </div>
          {expanded && (
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              Inscribo
            </span>
          )}
        </div>

        {/* Toggle button */}
        <button onClick={toggle} style={{
          width: 24, height: 24, borderRadius: 6,
          border: '0.5px solid #D1FAE5',
          background: '#F0FDFB',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0,
          color: '#00A896',
          marginLeft: expanded ? 0 : 4,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {expanded
              ? <polyline points="15 18 9 12 15 6" />
              : <polyline points="9 18 15 12 9 6" />
            }
          </svg>
        </button>
      </div>

      {/* Nav items */}
      {navItems.map(item => {
        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
        const Icon = item.Icon

        const isReports = item.path === '/reports'
        const showBadge = isReports && unreadCount > 0

        if (!expanded) {
          return (
            <Tooltip key={item.path} text={item.label}>
              <Link to={item.path} style={{
                width: 44, height: 44, borderRadius: 14,
                background: active ? item.iconBg : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: active ? `1.5px solid ${item.iconColor}30` : '1.5px solid transparent',
                textDecoration: 'none', position: 'relative',
                transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = item.iconBg
                  ;(e.currentTarget as HTMLElement).style.opacity = '0.75'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.opacity = '1'
                }
              }}>
                <Icon size={18} color={active ? item.iconColor : '#94A3B8'} strokeWidth={active ? 2.2 : 1.8} />
                {showBadge && (
                  <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 14, height: 14, borderRadius: 999, background: '#F43F5E', border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'white', padding: '0 2px' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </Link>
            </Tooltip>
          )
        }

        return (
          <Link
            key={item.path}
            to={item.path}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 10px',
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: active ? item.iconBg : 'transparent',
              border: active ? `1.5px solid ${item.iconColor}25` : '1.5px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              flexShrink: 0,
              cursor: 'pointer',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = item.iconBg
                ;(e.currentTarget as HTMLElement).style.opacity = '0.75'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.opacity = '1'
              }
            }}
          >
            {/* Icon */}
            <div style={{
              width: 28, height: 28, borderRadius: 8, flexShrink: 0,
              background: active ? item.iconColor : item.iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={14} color={active ? '#FFFFFF' : item.iconColor} strokeWidth={active ? 2.2 : 1.8} />
            </div>

            {/* Label */}
            <span style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? item.iconColor : '#64748B',
              whiteSpace: 'nowrap', overflow: 'hidden', flex: 1,
            }}>
              {item.label}
            </span>
            {showBadge && (
              <div style={{ minWidth: 16, height: 16, borderRadius: 999, background: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 4px' }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </div>
            )}
          </Link>
        )
      })}

      {/* User avatar at bottom */}
      <div style={{ marginTop: 'auto', paddingTop: 8, borderTop: '0.5px solid #D1FAE5', flexShrink: 0 }}>
        {!expanded ? (
          <Tooltip text={userName}>
            <Link to="/profile" style={{ textDecoration: 'none' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00A896, #0DD3BF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
                margin: '0 auto',
              }}>
                {initials}
              </div>
            </Link>
          </Tooltip>
        ) : (
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 12, cursor: 'pointer',
              height: 44,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F0FDFB')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #00A896, #0DD3BF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'white',
              }}>
                {initials}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                  {userName}
                </div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{userRole}</div>
              </div>
            </div>
          </Link>
        )}
      </div>
    </aside>
  )
}
