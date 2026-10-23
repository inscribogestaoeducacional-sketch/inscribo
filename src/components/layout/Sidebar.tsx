import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useNotifications } from '../../hooks/useNotifications'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import { useBaseModuleEnabled } from '../../lib/baseModule'
import {
  LayoutDashboard, Users, BookUser,
  BarChart3, UsersRound, Settings, ArrowRightLeft, ClipboardCheck, CalendarCheck, X, Megaphone, Send, Store, GraduationCap, Flag
} from 'lucide-react'

type NavItem = { path: string; label: string; iconBg: string; iconColor: string; Icon: typeof Users; roles: string[]; module: string; group?: string; solid?: boolean }

// Logo do WhatsApp (o lucide não tem marcas)
function WhatsAppIcon({ size = 16, color = '#fff' }: { size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.23-.17-.48-.29Z" />
    </svg>
  )
}

// Quadradinho colorido do item (igual nas três versões do menu)
function NavTile({ item }: { item: NavItem }) {
  const Icon = item.Icon
  return (
    <span style={{
      width: 30, height: 30, borderRadius: 10, flexShrink: 0,
      background: item.solid ? 'linear-gradient(135deg,#34D96B,#16A34A)' : `linear-gradient(135deg, ${item.iconBg}, ${item.iconBg}cc)`,
      boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon size={16} color={item.solid ? '#FFFFFF' : item.iconColor} strokeWidth={2.1} />
    </span>
  )
}

const NAV_CFG: NavItem[] = [
  { path: '/home',            label: 'Início',          iconBg: '#E6F7F5', iconColor: '#00A896', Icon: LayoutDashboard, roles: ['admin','manager'],        module: 'inicio' },
  { path: '/atendente',       label: 'Início',          iconBg: '#E6F7F5', iconColor: '#00A896', Icon: LayoutDashboard, roles: ['user'],                   module: 'inicio' },
  // Comercial
  { path: '/leads',           label: 'Leads',           iconBg: '#EDE9FE', iconColor: '#7C3AED', Icon: Users,           roles: ['admin','manager','user'], module: 'leads',        group: 'Comercial' },
  { path: '/visits',          label: 'Visitas',         iconBg: '#FEF3C7', iconColor: '#D97706', Icon: CalendarCheck,   roles: ['admin','manager','user'], module: 'visitas',      group: 'Comercial' },
  { path: '/contacts',        label: 'Contatos',        iconBg: '#DBEAFE', iconColor: '#2563EB', Icon: BookUser,        roles: ['admin','manager','user'], module: 'contatos',     group: 'Comercial' },
  { path: '/whatsapp',        label: 'WhatsApp',        iconBg: '#D1FAE5', iconColor: '#16A34A', Icon: WhatsAppIcon as unknown as typeof Users, roles: ['admin','manager','user'], module: 'whatsapp', group: 'Comercial', solid: true },
  { path: '/captacao',        label: 'Captação',        iconBg: '#FCE7F3', iconColor: '#DB2777', Icon: Megaphone,       roles: ['admin','manager','user'], module: 'captacao',     group: 'Comercial' },
  { path: '/vitrine',         label: 'Vitrine',         iconBg: '#CCFBF1', iconColor: '#0D9488', Icon: Store,           roles: ['admin','manager','user'], module: 'vitrine',      group: 'Comercial' },
  { path: '/transmissoes',    label: 'Transmissões',    iconBg: '#E0F2FE', iconColor: '#0284C7', Icon: Send,            roles: ['admin','manager','user'], module: 'transmissoes', group: 'Comercial' },
  // Matrículas
  { path: '/campanha',       label: 'Campanha de Matrículas', iconBg: '#FFEDD5', iconColor: '#EA580C', Icon: Flag,       roles: ['admin','manager'],        module: 'campanha',     group: 'Matrículas' },
  { path: '/base-alunos',     label: 'Base de alunos',  iconBg: '#D1FAE5', iconColor: '#059669', Icon: GraduationCap,   roles: ['admin','manager','user'], module: 'base_alunos',  group: 'Matrículas' },
  { path: '/transferencias',  label: 'Transferências',  iconBg: '#FEE2E2', iconColor: '#DC2626', Icon: ArrowRightLeft,  roles: ['admin','manager','user'], module: 'transferencias', group: 'Matrículas' },
  // Análise
  { path: '/reports',         label: 'Relatórios',      iconBg: '#DBEAFE', iconColor: '#3B82F6', Icon: BarChart3,       roles: ['admin','manager'], module: 'relatorios', group: 'Análise' },
  { path: '/pesquisas',       label: 'Pesquisas',       iconBg: '#FFEDD5', iconColor: '#F97316', Icon: ClipboardCheck,  roles: ['admin','manager'], module: 'pesquisas',  group: 'Análise' },
  // Administração
  { path: '/users',           label: 'Usuários',        iconBg: '#E0E7FF', iconColor: '#4F46E5', Icon: UsersRound,      roles: ['admin'], module: 'usuarios',      group: 'Administração' },
  { path: '/settings',        label: 'Configurações',   iconBg: '#E2E8F0', iconColor: '#334155', Icon: Settings,        roles: ['admin','manager'], module: 'configuracoes', group: 'Administração' },
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
  const { isModuleEnabled } = usePermissions()
  const { unreadCount } = useNotifications(user?.institution_id || null)
  const badgeCountByPath: Record<string, number> = { '/reports': unreadCount }

  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem('sidebar-expanded') === 'true'
  })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    ;(window as any).__toggleMobileSidebar = () => setMobileOpen(v => !v)
    return () => { delete (window as any).__toggleMobileSidebar }
  }, [])

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    localStorage.setItem('sidebar-expanded', String(next))
  }

  // Transmissões só aparece com o módulo liberado pela Áion pra escola.
  const broadcastEnabled = useBroadcastEnabled(user?.institution_id)
  // Base de alunos só com o módulo liberado pela Áion pra escola.
  const baseEnabled = useBaseModuleEnabled(user?.institution_id)
  const navItems = NAV_CFG.filter(item =>
    item.roles.includes(user?.role || 'user') && isModuleEnabled(item.module)
    && (item.module !== 'transmissoes' || broadcastEnabled === true)
    && (item.module !== 'base_alunos' || baseEnabled === true)
  )
  // Título do grupo antes do primeiro sub-item visível (sem sub-item visível, sem título)
  const navEntries: (NavItem | { header: string })[] = navItems.flatMap((it, i) =>
    it.group && navItems[i - 1]?.group !== it.group ? [{ header: it.group }, it] : [it])
  const groupHeader = (h: string) => (
    <div key={'grp-' + h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '10px 10px 2px', flexShrink: 0 }}>{h}</div>
  )

  // ── Mobile drawer ───────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }}
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside className="h-viewport" style={{
          position: 'fixed', left: 0, top: 0, zIndex: 50,
          width: 240, background: '#FFFFFF', borderRight: '0.5px solid #D1FAE5',
          display: 'flex', flexDirection: 'column', alignItems: 'stretch',
          padding: '12px 10px', gap: 2, overflowY: 'auto', overflowX: 'hidden',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* Logo + fechar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px', flexShrink: 0 }}>
            <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 36, objectFit: 'contain', maxWidth: 150 }} />
            <button onClick={() => setMobileOpen(false)} style={{
              width: 28, height: 28, borderRadius: 8,
              border: '0.5px solid #D1FAE5', background: '#F0FDFB',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#00A896',
            }}>
              <X size={14} />
            </button>
          </div>

          {/* Nav */}
          {navEntries.map(entry => {
            if ('header' in entry) return groupHeader(entry.header)
            const item = entry
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            const Icon = item.Icon
            const badgeCount = badgeCountByPath[item.path] || 0
            const showBadge = badgeCount > 0
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: item.group ? '9px 10px 9px 20px' : '9px 10px', width: '100%', height: 44, borderRadius: 12,
                background: active ? '#F0FDFB' : 'transparent',
                border: active ? '1.5px solid #99E6DC' : '1.5px solid transparent',
                textDecoration: 'none', boxSizing: 'border-box', flexShrink: 0, position: 'relative',
              }}>
                <NavTile item={item} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#1A2B4A' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>
                  {item.label}
                </span>
                {showBadge && (
                  <div style={{ minWidth: 16, height: 16, borderRadius: 999, background: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 4px' }}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </div>
                )}
              </Link>
            )
          })}

        </aside>
      </>
    )
  }

  return (
    <aside className="h-viewport" style={{
      width: expanded ? 220 : 64,
      minWidth: expanded ? 220 : 64,
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
      {expanded ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 12px', flexShrink: 0 }}>
          <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 36, width: 'auto', objectFit: 'contain', maxWidth: 150 }} />
          <button onClick={toggle} style={{
            width: 24, height: 24, borderRadius: 6,
            border: '0.5px solid #D1FAE5', background: '#F0FDFB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0, color: '#00A896',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 12, flexShrink: 0, width: '100%' }}>
          {/* Ícone centralizado */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0' }}>
            <img src="/aion-logo-icon.png" alt="Áion" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10 }} />
          </div>
          {/* Botão de expandir separado abaixo */}
          <button onClick={toggle} style={{
            width: 24, height: 24, borderRadius: 6,
            border: '0.5px solid #D1FAE5', background: '#F0FDFB',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#00A896',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Nav items */}
      {navEntries.map(entry => {
        if ('header' in entry) return expanded ? groupHeader(entry.header) : <div key={'sep-' + entry.header} style={{ height: 1, background: '#E2E8F0', margin: '8px 12px', width: 36, flexShrink: 0 }} />
        const item = entry
        const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
        const Icon = item.Icon

        const badgeCount = badgeCountByPath[item.path] || 0
        const showBadge = badgeCount > 0

        if (!expanded) {
          return (
            <Tooltip key={item.path} text={item.group ? `${item.group} › ${item.label}` : item.label}>
              <Link to={item.path} style={{
                width: 44, height: 44, borderRadius: 14,
                background: active ? '#F0FDFB' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: active ? '1.5px solid #99E6DC' : '1.5px solid transparent',
                textDecoration: 'none', position: 'relative',
                transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = '#F8FAFC'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}>
                <NavTile item={item} />
                {showBadge && (
                  <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 14, height: 14, borderRadius: 999, background: '#F43F5E', border: '1.5px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: 'white', padding: '0 2px' }}>
                    {badgeCount > 9 ? '9+' : badgeCount}
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
              padding: item.group ? '9px 10px 9px 20px' : '9px 10px',
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: active ? '#F0FDFB' : 'transparent',
              border: active ? '1.5px solid #99E6DC' : '1.5px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s',
              flexShrink: 0,
              cursor: 'pointer',
              boxSizing: 'border-box',
              position: 'relative',
            }}
            onMouseEnter={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = '#F8FAFC'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
              }
            }}
          >
            <NavTile item={item} />

            {/* Label */}
            <span style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? '#1A2B4A' : '#475569',
              whiteSpace: 'nowrap', overflow: 'hidden', flex: 1,
            }}>
              {item.label}
            </span>
            {showBadge && (
              <div style={{ minWidth: 16, height: 16, borderRadius: 999, background: '#F43F5E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white', padding: '0 4px' }}>
                {badgeCount > 9 ? '9+' : badgeCount}
              </div>
            )}
          </Link>
        )
      })}

    </aside>
  )
}
