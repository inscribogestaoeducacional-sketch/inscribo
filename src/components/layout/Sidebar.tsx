import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AppDock, MenuSheet, SheetRow, goTo } from '../mobile/MobileShell'
import { DockEditor, useUnreadChats } from '../mobile/NavExtras'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../contexts/PermissionsContext'
import { useBroadcastEnabled } from '../../lib/broadcasts'
import { useBaseModuleEnabled } from '../../lib/baseModule'
import { X, SlidersHorizontal, LayoutGrid, MessageSquare } from 'lucide-react'
import {
  House, Funnel, AddressBook, WhatsappLogo, CalendarCheck, Megaphone, Storefront, PaperPlaneTilt, Flag,
  GraduationCap, ArrowsLeftRight, ChartLineUp, ClipboardText, UsersThree, GearSix, List, UserCircle,
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isModuleEnabled } = usePermissions()
  // Sem contadores no menu: a central de notificações terá o seu próprio lugar.
  const badgeCountByPath: Record<string, number> = {}

  const [expanded, setExpanded] = useState(() => {
    return localStorage.getItem('sidebar-expanded') === 'true'
  })
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dockEdit, setDockEdit] = useState(false)
  const [myDock, setMyDock] = useState<string[] | null>(null)
  useEffect(() => {
    if (!user?.id) return
    supabase.from('users').select('dock_shortcuts').eq('id', user.id).maybeSingle().then(({ data }) => setMyDock(((data as any)?.dock_shortcuts as string[] | null) ?? null))
  }, [user?.id])
  const unreadChats = useUnreadChats(user?.institution_id, user?.id, isMobile && isModuleEnabled("whatsapp"), location.pathname)
  const [teamUnread, setTeamUnread] = useState(0)
  useEffect(() => {
    const h = (e: Event) => setTeamUnread((e as CustomEvent<number>).detail || 0)
    window.addEventListener('aion:team-unread', h)
    return () => window.removeEventListener('aion:team-unread', h)
  }, [])

  useEffect(() => {
    const handler = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileOpen(false)
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => { setMobileOpen(false) }, [location.pathname, location.search])
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

  // ── Celular: cara de aplicativo (barra de baixo com o WhatsApp no meio + menu em folha) ──
  if (isMobile) {
    const wa = navItems.find(i => i.path === '/whatsapp')
    const choices = navItems.filter(i => i !== wa)
    const slots = wa ? 3 : 4
    const PRIORITY = ['/home', '/atendente', '/leads', '/visits', '/contacts', '/campanha', '/captacao', '/transmissoes']
    const suggested: NavItem[] = []
    for (const p of PRIORITY) { if (suggested.length >= slots) break; const e = choices.find(x => x.path === p); if (e && !suggested.includes(e)) suggested.push(e) }
    for (const e of choices) { if (suggested.length >= slots) break; if (!suggested.includes(e)) suggested.push(e) }
    const mine = (myDock || []).map(id => choices.find(e => e.path === id)).filter(Boolean) as NavItem[]
    const picked = mine.length ? mine.slice(0, slots) : suggested
    const isAct = (e: NavItem) => location.pathname === e.path || location.pathname.startsWith(e.path + '/')
    const SHORT: Record<string, string> = { '/campanha': 'Campanha', '/base-alunos': 'Alunos', '/transferencias': 'Transf.', '/transmissoes': 'Envios' }
    const label = (e: NavItem) => SHORT[e.path] || e.label
    const go = (to: string) => { setMobileOpen(false); if (to !== location.pathname + location.search) goTo(navigate, to) }
    const onBar = (e: NavItem) => picked.includes(e) || e === wa
    const groups = Array.from(new Set(navItems.map(i => i.group || 'Principal'))).map((g, gi) => ({
      title: g,
      modules: navItems.filter(i => (i.group || 'Principal') === g && !onBar(i)).map(i => ({
        key: i.path, label: i.label, short: label(i) !== i.label ? label(i) : undefined, Icon: i.Icon as any, tint: gi, active: isAct(i), onPress: () => go(i.path),
      })),
    })).filter(g => g.modules.length)
    const onDock = picked.some(isAct) || (!!wa && isAct(wa))
    const saveDock = async (ids: string[]) => {
      const v = ids.length ? ids : null
      const { error } = await supabase.rpc('set_my_dock', { p_ids: v })
      if (error) { window.alert(`Não foi possível salvar: ${error.message}`); return }
      setMyDock(v); setDockEdit(false)
    }
    return (
      <>
        <AppDock
          items={picked.map(e => ({ key: e.path, label: label(e), Icon: e.Icon as any, active: isAct(e) && !mobileOpen, onPress: () => go(e.path) }))}
          center={wa ? { key: wa.path, label: 'WhatsApp', Icon: wa.Icon as any, active: isAct(wa) && !mobileOpen, badge: unreadChats, onPress: () => go(wa.path) } : undefined}
          menuOpen={mobileOpen} menuActive={!onDock} onMenu={() => setMobileOpen(v => !v)} />
        <MenuSheet open={mobileOpen} onClose={() => setMobileOpen(false)} groups={groups}
          action={<button onClick={() => { setMobileOpen(false); setDockEdit(true) }} className="aion-tap"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999, border: '1px solid #E3E8F0', background: '#fff', color: '#05907B', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>
            <SlidersHorizontal size={14} /> Editar barra</button>}
          footer={<div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E3E8F0', overflow: 'hidden', marginTop: 4 }}>
            <SheetRow Icon={SlidersHorizontal} label="Personalizar a barra" hint="Escolha os atalhos da barra de baixo" onPress={() => { setMobileOpen(false); setDockEdit(true) }} />
            {user?.institution_id && <SheetRow Icon={MessageSquare} label="Chat da equipe" hint="Converse com os colegas da escola" right={teamUnread > 0 ? <span style={{ minWidth: 22, height: 22, padding: '0 6px', borderRadius: 99, background: '#F43F5E', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{teamUnread}</span> : undefined} onPress={() => { setMobileOpen(false); window.dispatchEvent(new Event('aion:open-team-chat')) }} />}
            <SheetRow Icon={UserCircle} label="Meu perfil" hint="Dados, senha e status" onPress={() => go('/profile')} />
          </div>} />
        <DockEditor open={dockEdit} onClose={() => setDockEdit(false)} value={picked.map(e => e.path)}
          options={choices.map(e => ({ id: e.path, label: label(e), Icon: e.Icon as any }))}
          centerLabel={wa ? 'WhatsApp' : null} CenterIcon={wa?.Icon as any} MenuIcon={LayoutGrid} onSave={saveDock} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <img className="aion-sb-icon aion-sb-open" src="/aion-logo-icon.png" alt="Áion" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 10, flexShrink: 0 }} />
            <div className="aion-sb-name" role="img" aria-label="Áion Edu" />
          </div>
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
            <img className="aion-sb-icon aion-sb-close" src="/aion-logo-icon.png" alt="Áion" style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 10 }} />
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
