import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  LayoutDashboard, Users, Calendar, GraduationCap,
  MessageCircle, BarChart3, UserCog, Settings
} from 'lucide-react'

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

const NAV_CFG = [
  { path: '/dashboard',   label: 'Dashboard',  iconBg: '#E6F7F5', iconColor: '#00A896', Icon: LayoutDashboard, roles: ['admin','manager','user'] },
  { path: '/leads',       label: 'Leads',      iconBg: '#EDE9FE', iconColor: '#8B5CF6', Icon: Users,           roles: ['admin','manager','user'] },
  { path: '/visits',      label: 'Visitas',    iconBg: '#FEF3C7', iconColor: '#F59E0B', Icon: Calendar,        roles: ['admin','manager','user'] },
  { path: '/enrollments', label: 'Matrículas', iconBg: '#FFE4E6', iconColor: '#F43F5E', Icon: GraduationCap,   roles: ['admin','manager','user'] },
  { path: '/whatsapp',    label: 'WhatsApp',   iconBg: '#D1FAE5', iconColor: '#10B981', Icon: MessageCircle,   roles: ['admin','manager','user'] },
  { path: '/reports',     label: 'Relatórios', iconBg: '#DBEAFE', iconColor: '#3B82F6', Icon: BarChart3,       roles: ['admin','manager'] },
  { path: '/users',       label: 'Usuários',   iconBg: '#F1F5F9', iconColor: '#64748B', Icon: UserCog,         roles: ['admin'] },
  { path: '/settings',    label: 'Config.',    iconBg: '#F1F5F9', iconColor: '#64748B', Icon: Settings,        roles: ['admin'] },
]

export default function Sidebar() {
  const location = useLocation()
  const { user } = useAuth()

  const navItems = NAV_CFG.filter(item => item.roles.includes(user?.role || 'user'))
  const initials = (user?.full_name || 'U').split(' ').map((n: string) => n[0]).slice(0, 2).join('')

  return (
    <aside style={{
      width: 64, minWidth: 64, height: '100vh',
      background: '#FFFFFF',
      borderRight: '0.5px solid #D1FAE5',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 0', gap: 4, overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Logo mark */}
      <div style={{
        width: 38, height: 38, borderRadius: 12,
        background: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12, flexShrink: 0,
      }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.4)' }} />
      </div>

      {/* Nav items */}
      {navItems.map(item => {
        const active = location.pathname === item.path
        const Icon = item.Icon
        return (
          <Tooltip key={item.path} text={item.label}>
            <Link to={item.path} style={{
              position: 'relative', textDecoration: 'none',
              width: 44, height: 44, borderRadius: 14,
              background: active ? item.iconBg : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: active ? `1.5px solid ${item.iconColor}30` : '1.5px solid transparent',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
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
              <Icon size={18} color={active ? item.iconColor : '#94A3B8'} strokeWidth={active ? 2.2 : 1.8} />
            </Link>
          </Tooltip>
        )
      })}

      {/* Avatar at bottom */}
      <div style={{ marginTop: 'auto', paddingBottom: 4 }}>
        <Tooltip text={user?.full_name || 'Perfil'}>
          <Link to="/profile" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00A896, #0DD3BF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer',
            }}>
              {initials}
            </div>
          </Link>
        </Tooltip>
      </div>
    </aside>
  )
}
