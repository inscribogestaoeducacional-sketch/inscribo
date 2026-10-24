import React, { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import { useBaseModuleEnabled } from '../../lib/baseModule'
import { X } from 'lucide-react'
import {
  House, Funnel, AddressBook, WhatsappLogo, CalendarCheck, Megaphone, Storefront, PaperPlaneTilt, Flag,
  GraduationCap, ArrowsLeftRight, ChartLineUp, ClipboardText, UsersThree, GearSix, List,
} from '@phosphor-icons/react'
import type { Icon as PhIcon } from '@phosphor-icons/react'

const GRAD = 'var(--aion-grad)'

type NavItem = { path: string; label: string; iconBg: string; iconColor: string; Icon: PhIcon; roles: string[]; module: string; group?: string; solid?: boolean }

// Ícone do item: duotone em verde; ativo = preenchido e branco (sobre a pílula em degradê)
function NavTile({ item, active }: { item: NavItem; active?: boolean }) {
  const Icon = item.Icon
  return <Icon size={22} weight={active ? 'fill' : 'duotone'} color={active ? '#FFFFFF' : '#05907B'} style={{ flexShrink: 0 }} />
}

const NAV_CFG: NavItem[] = [
  { path: '/home',            label: 'Início',          iconBg: '#E6F7F5', iconColor: '#05907B', Icon: House, roles: ['admin','manager'],        module: 'inicio' },
  { path: '/atendente',       label: 'Início',          iconBg: '#E6F7F5', iconColor: '#05907B', Icon: House, roles: ['user'],                   module: 'inicio' },
  // Comercial
  { path: '/leads',           label: 'Leads',           iconBg: '#EDE9FE', iconColor: '#7C3AED', Icon: Funnel,           roles: ['admin','manager','user'], module: 'leads',        group: 'Comercial' },
  { path: '/visits',          label: 'Visitas',         iconBg: '#FEF3C7', iconColor: '#D97706', Icon: CalendarCheck,   roles: ['admin','manager','user'], module: 'visitas',      group: 'Comercial' },
  { path: '/contacts',        label: 'Contatos',        iconBg: '#DBEAFE', iconColor: '#2563EB', Icon: AddressBook,        roles: ['admin','manager','user'], module: 'contatos',     group: 'Comercial' },
  { path: '/whatsapp',        label: 'WhatsApp',        iconBg: '#D1FAE5', iconColor: '#16A34A', Icon: WhatsappLogo, roles: ['admin','manager','user'], module: 'whatsapp', group: 'Comercial' },
  { path: '/captacao',        label: 'Captação',        iconBg: '#FCE7F3', iconColor: '#DB2777', Icon: Megaphone,       roles: ['admin','manager','user'], module: 'captacao',     group: 'Comercial' },
  { path: '/vitrine',         label: 'Vitrine',         iconBg: '#CCFBF1', iconColor: '#0D9488', Icon: Storefront,           roles: ['admin','manager','user'], module: 'vitrine',      group: 'Comercial' },
  { path: '/transmissoes',    label: 'Transmissões',    iconBg: '#E0F2FE', iconColor: '#0284C7', Icon: PaperPlaneTilt,            roles: ['admin','manager','user'], module: 'transmissoes', group: 'Comercial' },
  // Matrículas
  { path: '/campanha',       label: 'Campanha de Matrículas', iconBg: '#FFEDD5', iconColor: '#EA580C', Icon: Flag,       roles: ['admin','manager'],        module: 'campanha',     group: 'Matrículas' },
  { path: '/base-alunos',     label: 'Base de alunos',  iconBg: '#D1FAE5', iconColor: '#059669', Icon: GraduationCap,   roles: ['admin','manager','user'], module: 'base_alunos',  group: 'Matrículas' },
  { path: '/transferencias',  label: 'Transferências',  iconBg: '#FEE2E2', iconColor: '#DC2626', Icon: ArrowsLeftRight,  roles: ['admin','manager','user'], module: 'transferencias', group: 'Matrículas' },
  // Análise
  { path: '/reports',         label: 'Relatórios',      iconBg: '#DBEAFE', iconColor: '#3B82F6', Icon: ChartLineUp,       roles: ['admin','manager'], module: 'relatorios', group: 'Análise' },
  { path: '/pesquisas',       label: 'Pesquisas',       iconBg: '#FFEDD5', iconColor: '#F97316', Icon: ClipboardText,  roles: ['admin','manager'], module: 'pesquisas',  group: 'Análise' },
  // Administração
  { path: '/users',           label: 'Usuários',        iconBg: '#E0E7FF', iconColor: '#4F46E5', Icon: UsersThree,      roles: ['admin'], module: 'usuarios',      group: 'Administração' },
  { path: '/settings',        label: 'Configurações',   iconBg: '#E2E8F0', iconColor: '#334155', Icon: GearSix,        roles: ['admin','manager'], module: 'configuracoes', group: 'Administração' },
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
  // Sem contadores no menu: a central de notificações terá o seu próprio lugar.
  const badgeCountByPath: Record<string, number> = {}

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

  const TAB_PATHS = ['/home', '/atendente', '/leads', '/whatsapp', '/visits']
  const tabItems = navItems.filter(i => TAB_PATHS.includes(i.path)).slice(0, 4)

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
              cursor: 'pointer', color: '#05907B',
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
                background: active ? GRAD : 'transparent', boxShadow: active ? '0 10px 20px -12px #05907B' : 'none',
                border: '1.5px solid transparent',
                textDecoration: 'none', boxSizing: 'border-box', flexShrink: 0, position: 'relative',
              }}>
                <NavTile item={item} active={active} />
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#FFFFFF' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>
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

        {/* Barra de abas flutuante (celular) */}
        <nav aria-label="Navegação principal" style={{
          position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: 30,
          background: '#fff', border: '1px solid #E3E8F0', borderRadius: 24,
          boxShadow: '0 16px 36px -16px rgba(5,144,123,.5)',
          display: 'flex', justifyContent: 'space-around', padding: 6,
        }}>
          {tabItems.map(item => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
            const Icon = item.Icon
            return (
              <Link key={item.path} to={item.path} aria-label={item.label} style={{
                flex: 1, maxWidth: 76, height: 48, borderRadius: 16, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 1, textDecoration: 'none',
                background: active ? GRAD : 'transparent', transition: 'background .2s',
              }}>
                <Icon size={22} weight={active ? 'fill' : 'duotone'} color={active ? '#fff' : '#05907B'} />
                <span style={{ fontSize: 9.5, fontWeight: 700, color: active ? '#fff' : '#5B6B86' }}>{item.label === 'Início' ? 'Início' : item.label.split(' ')[0]}</span>
              </Link>
            )
          })}
          <button onClick={() => setMobileOpen(true)} aria-label="Mais opções" style={{
            flex: 1, maxWidth: 76, height: 48, borderRadius: 16, border: 'none', background: 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
          }}>
            <List size={22} weight="duotone" color="#05907B" />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#5B6B86' }}>Mais</span>
          </button>
        </nav>
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
      overflowY: 'auto',
      overflowX: 'hidden',
      scrollbarWidth: 'thin',
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
            cursor: 'pointer', flexShrink: 0, color: '#05907B',
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
            cursor: 'pointer', color: '#05907B',
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
                background: active ? GRAD : 'transparent', boxShadow: active ? '0 10px 20px -12px #05907B' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1.5px solid transparent',
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
                <NavTile item={item} active={active} />
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
              background: active ? GRAD : 'transparent', boxShadow: active ? '0 10px 20px -12px #05907B' : 'none',
              border: '1.5px solid transparent',
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
            <NavTile item={item} active={active} />

            {/* Label */}
            <span style={{
              fontSize: 13, fontWeight: active ? 700 : 500,
              color: active ? '#FFFFFF' : '#475569',
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
