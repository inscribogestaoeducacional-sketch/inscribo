// src/components/superadmin/SuperAdminLayout.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { syncMissingDefaultTemplates } from '../../lib/submitDefaultTemplates'
import { useAlertNotifications } from '../../hooks/useAlertNotifications'
import AlertNotificationList from '../layout/AlertNotificationList'
import { AppDock, MenuSheet, BottomSheet, SheetRow, ProfileHero, PageAnim, goTo, useIsMobile, DOCK_SPACE } from '../mobile/MobileShell'
import {
  Home, Building2, DollarSign, FileText, Settings, Gift,
  Bell, LogOut, UserCog, ChevronDown, X, Menu,
  TrendingUp, AlertCircle, CheckCircle2,
  AlertTriangle, Info, BookOpen, Users, MessageCircle, Inbox, BarChart3, Network,
  MapPinned, MessageSquare, Send, LifeBuoy, ListChecks, Globe, Calendar,
} from 'lucide-react'
import {
  House, TrendUp, Tray, Buildings, TreeStructure, MapPinLine, GearSix, UsersThree, ChartLineUp, BookOpenText, WhatsappLogo, ChatCircleText,
  CurrencyCircleDollar, PaperPlaneTilt, FileText as PhFileText, GlobeHemisphereWest, Gift as PhGift, ListChecks as PhListChecks, Lifebuoy, UserGear, CalendarCheck,
} from '@phosphor-icons/react'

// Ícones duotone do Modelo C no lugar dos de traço
const PH_ICON: Record<string, any> = {
  Home: House, TrendingUp: TrendUp, Inbox: Tray, Building2: Buildings, Network: TreeStructure, MapPinned: MapPinLine, Settings: GearSix,
  Users: UsersThree, BarChart3: ChartLineUp, BookOpen: BookOpenText, MessageCircle: WhatsappLogo, MessageSquare: ChatCircleText,
  Globe: GlobeHemisphereWest, DollarSign: CurrencyCircleDollar, Send: PaperPlaneTilt, FileText: PhFileText,
  Gift: PhGift, ListChecks: PhListChecks, LifeBuoy: Lifebuoy, UserCog: UserGear, Calendar: CalendarCheck,
}

// ─── tipos ────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'urgent'
  read: boolean
  created_at: string
  url?: string | null
  src?: 'user' | 'system'
}

// ─── menus ────────────────────────────────────────────────────────────────
interface MenuItem { path: string; label: string; icon: any; exact?: boolean; match?: string[] }
interface MenuGroup { title: string; items: MenuItem[] }

// Menu no padrão das escolas: títulos de grupo e, embaixo, cada módulo como item do menu.
const P = '/super-admin'
const ADMIN_GROUPS: MenuGroup[] = [
  { title: 'Principal', items: [
    { path: P, label: 'Início', icon: Home, exact: true },
  ] },
  { title: 'Vendas', items: [
    { path: `${P}/crm`, label: 'CRM', icon: TrendingUp },
    { path: `${P}/agenda`, label: 'Agenda', icon: Calendar },
    { path: `${P}/indicacoes`, label: 'Indicações', icon: Gift },
    { path: `${P}/consultants`, label: 'Consultores', icon: Users },
  ] },
  { title: 'Escolas', items: [
    { path: `${P}/schools`, label: 'Escolas', icon: Building2, match: [`${P}/institutions`] },
    { path: `${P}/roteiro`, label: 'Roteiro da campanha', icon: ListChecks },
    { path: `${P}/school-groups`, label: 'Grupos', icon: Network },
  ] },
  { title: 'Financeiro', items: [
    { path: `${P}/financial`, label: 'Financeiro', icon: DollarSign },
    { path: `${P}/transmissoes/precos`, label: 'Transmissões', icon: Send },
    { path: `${P}/whatsapp`, label: 'Uso do WhatsApp', icon: BarChart3 },
  ] },
  { title: 'Atendimento', items: [
    { path: `${P}/aion-inbox`, label: 'WhatsApp', icon: Inbox },
    { path: `${P}/support`, label: 'Central de dúvidas', icon: LifeBuoy },
    { path: `${P}/whatsapp-templates`, label: 'Templates', icon: FileText },
    { path: `${P}/updates`, label: 'Atualizações', icon: BookOpen },
  ] },
  { title: 'Marketing', items: [
    { path: `${P}/site`, label: 'Site', icon: Globe },
    { path: `${P}/showcase-schools`, label: 'Escolas em destaque', icon: MessageSquare },
    { path: `${P}/market-intelligence`, label: 'Mercado', icon: MapPinned },
  ] },
  { title: 'Sistema', items: [
    { path: `${P}/settings`, label: 'Configurações', icon: Settings },
    { path: `${P}/profile`, label: 'Meu perfil', icon: UserCog },
  ] },
]

const ADMIN_MENU_FLAT = ADMIN_GROUPS.flatMap(g => g.items)

const CONSULTANT_MENU: MenuItem[] = [
  { path: '/super-admin/consultant',           label: 'Dashboard',      icon: Home,      exact: true },
  { path: '/super-admin/crm',                  label: 'CRM Comercial',  icon: TrendingUp            },
  { path: '/super-admin/agenda',               label: 'Agenda',         icon: Calendar              },
  { path: '/super-admin/consultant/schools',   label: 'Minhas Escolas', icon: Building2             },
  { path: '/super-admin/consultant/contracts', label: 'Contratos',      icon: FileText              },
]

// ─── notif icon ──────────────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  if (type === 'urgent')  return <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0"    />
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => { syncMissingDefaultTemplates() }, [])
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [sidebarOpen, setSidebarOpen]     = useState(() => localStorage.getItem('sa-sidebar') !== 'false')
  const [openGroups,  setOpenGroups]      = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ADMIN_GROUPS.map(g => [g.title, true]))
  )
  const [profileOpen, setProfileOpen]     = useState(false)
  const [notifOpen,   setNotifOpen]       = useState(false)
  const [menuOpen,    setMenuOpen]        = useState(false)
  // Central de notificações (queda/silêncio do WhatsApp) — notification_alerts
  const { alerts, unread: alertsUnread, markRead: markAlertsRead } = useAlertNotifications()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread]               = useState(0)
  const [overdueFollowups, setOverdueFollowups] = useState(0)
  const [todayMeetings, setTodayMeetings] = useState(0)
  // Dúvidas da Academia esperando a equipe (selo do menu "Suporte (dúvidas)")
  const [supportOpen, setSupportOpen] = useState(0)
  // Indicações novas esperando abordagem (selo do menu "Indicações")
  const [refNovas, setRefNovas] = useState(0)
  useEffect(() => {
    if (user?.user_type !== 'admin_geral') return
    const load = () => { supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('status', 'indicado').then(({ count }) => setRefNovas(count ?? 0), () => {}) }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [user?.user_type])
  useEffect(() => {
    if (user?.user_type !== 'admin_geral') return
    const load = () => { supabase.rpc('support_open_count').then(({ data }) => setSupportOpen(typeof data === 'number' ? data : 0), () => {}) }
    load()
    const ch = supabase.channel('sa_support_badge').on('postgres_changes', { event: '*', schema: 'public', table: 'support_threads' }, load).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [user?.user_type])

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef   = useRef<HTMLDivElement>(null)

  const isConsultant = user?.user_type === 'consultant'
  const flatMenuItems = isConsultant ? CONSULTANT_MENU : ADMIN_MENU_FLAT
  const initials     = (user?.full_name || 'A').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

  // ── load ─────────────────────────────────────────────
  useEffect(() => {
    loadNotifications()
    if (!isConsultant) {
      loadOverdueFollowups()
      loadTodayMeetings()
    }
  }, [])

  // ── click outside ────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleSidebar = () => {
    setSidebarOpen(v => {
      localStorage.setItem('sa-sidebar', String(!v))
      return !v
    })
  }

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }))
  }

  // Sino: avisos pessoais (lembretes de reunião etc.) + avisos gerais da plataforma
  const loadNotifications = async () => {
    try {
      const [mine, sys] = await Promise.all([
        supabase.from('user_notifications').select('id, title, body, url, created_at, read_at').order('created_at', { ascending: false }).limit(30),
        supabase.from('system_notifications').select('id, title, message, severity, created_at, read_at, action_url').is('institution_id', null).order('created_at', { ascending: false }).limit(20),
      ])
      const a: Notification[] = (mine.data || []).map((n: any) => ({ id: n.id, title: n.title, message: n.body || '', type: 'info' as const, read: !!n.read_at, created_at: n.created_at, url: n.url, src: 'user' as const }))
      const b: Notification[] = (sys.data || []).map((n: any) => ({ id: n.id, title: n.title, message: n.message || '', type: (n.severity === 'urgent' || n.severity === 'warning' ? n.severity : 'info') as Notification['type'], read: !!n.read_at, created_at: n.created_at, url: n.action_url, src: 'system' as const }))
      const list = [...a, ...b].sort((x, y) => +new Date(y.created_at) - +new Date(x.created_at)).slice(0, 40)
      setNotifications(list)
      setUnread(list.filter(n => !n.read).length)
    } catch { /* tabela pode não existir ainda */ }
  }

  const loadOverdueFollowups = async () => {
    try {
      const { count } = await supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .lt('next_followup', new Date().toISOString())
        .not('stage', 'in', '(fechado,cliente)')
      setOverdueFollowups(count || 0)
    } catch { /* tabela pode não existir ainda */ }
  }

  const loadTodayMeetings = async () => {
    try {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const end   = new Date(); end.setHours(23, 59, 59, 999)
      const { count } = await supabase
        .from('onboarding_meetings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
      const crm = await supabase
        .from('crm_meetings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .gte('scheduled_at', start.toISOString())
        .lte('scheduled_at', end.toISOString())
      setTodayMeetings((count || 0) + (crm.count || 0))
    } catch { /* tabela pode não existir ainda */ }
  }

  const markAllRead = async () => {
    if (alertsUnread) markAlertsRead(null)
    const now = new Date().toISOString()
    const mine = notifications.filter(n => !n.read && n.src === 'user').map(n => n.id)
    const sys = notifications.filter(n => !n.read && n.src === 'system').map(n => n.id)
    if (mine.length) await supabase.from('user_notifications').update({ read_at: now }).in('id', mine)
    if (sys.length) await supabase.from('system_notifications').update({ read_at: now }).in('id', sys)
    loadNotifications()
  }

  const openNotif = async (n: Notification) => {
    if (!n.read) {
      await supabase.from(n.src === 'system' ? 'system_notifications' : 'user_notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
      loadNotifications()
    }
    if (n.url && n.url.startsWith('/')) { setNotifOpen(false); setMenuOpen(false); navigate(n.url) }
  }

  const handleLogout = async () => {
    try {
      if (typeof signOut === 'function') {
        await signOut()
      } else {
        await supabase.auth.signOut()
      }
    } catch (e) {
      console.error('Logout error:', e)
      await supabase.auth.signOut()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : (location.pathname === path || location.pathname.startsWith(path + '/'))
  const itemActive = (m: MenuItem) =>
    [m.path, ...(m.match || [])].some(t => isActive(t, m.exact && t === m.path))
  const tabBadge = (path: string) => path === '/super-admin/crm' ? overdueFollowups : path === '/super-admin/support' ? supportOpen : path === '/super-admin/indicacoes' ? refNovas : 0
  const itemBadge = (m: MenuItem) => tabBadge(m.path)
  const hubBar = null

  // badges totais no sino
  const totalBadge = unread + overdueFollowups + todayMeetings + alertsUnread

  // label da página atual
  const currentLabel = flatMenuItems.find(m => itemActive(m))?.label || 'Admin Geral'

  const renderNavItem = (item: MenuItem) => {
    const active = itemActive(item)
    const Icon   = item.icon

    // badge por item
    const badge = itemBadge(item)

    return (
      <Link key={item.path} to={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group
          ${active
            ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
        {(() => { const Ph = PH_ICON[Icon.displayName || '']; return Ph ? <Ph size={21} weight={active ? 'fill' : 'duotone'} className="flex-shrink-0" /> : <Icon className="w-4 h-4 flex-shrink-0" /> })()}
        {sidebarOpen && (
          <span className="text-sm font-semibold truncate flex-1">{item.label}</span>
        )}
        {badge > 0 && (
          <span className={`min-w-[18px] h-[18px] text-[10px] font-bold px-1 rounded-full flex items-center justify-center flex-shrink-0
            ${active ? 'bg-white text-cyan-600' : 'bg-red-500 text-white'}`}>
            {badge}
          </span>
        )}
        {/* Tooltip quando sidebar fechada */}
        {!sidebarOpen && (
          <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
            {item.label}{badge > 0 ? ` (${badge})` : ''}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
          </div>
        )}
      </Link>
    )
  }


  // ── Celular: mesma cara de aplicativo da escola (barra de baixo + menu em folha) ──
  const isMobile = useIsMobile()
  if (isMobile) {
    const ico = (it: MenuItem) => PH_ICON[it.icon.displayName || ''] || it.icon
    const wanted = isConsultant
      ? CONSULTANT_MENU
      : ['/super-admin', '/super-admin/crm', '/super-admin/schools'].map(pp => ADMIN_MENU_FLAT.find(m => m.path === pp)!).filter(Boolean)
    const inbox = isConsultant ? undefined : ADMIN_MENU_FLAT.find(m => m.path === '/super-admin/aion-inbox')
    const bar = wanted.slice(0, inbox ? 3 : 4)
    const onBar = (m: MenuItem) => bar.includes(m) || m === inbox
    const act = (m: MenuItem) => itemActive(m)
    const go = (to: string) => { setMenuOpen(false); setProfileOpen(false); setNotifOpen(false); if (to !== location.pathname) goTo(navigate, to) }
    const groups = (isConsultant ? [{ title: 'Menu', items: CONSULTANT_MENU }] : ADMIN_GROUPS).map((g, gi) => ({
      title: g.title,
      modules: g.items.filter(m => !onBar(m)).map(m => ({ key: m.path, label: m.label, Icon: ico(m) as any, tint: gi, active: act(m), badge: isConsultant ? (m.path === '/super-admin/crm' ? overdueFollowups : 0) : itemBadge(m), onPress: () => go(m.path) })),
    })).filter(g => g.modules.length)
    const onDock = ADMIN_MENU_FLAT.concat(CONSULTANT_MENU).some(m => onBar(m) && act(m))
    const empty = notifications.length === 0 && overdueFollowups === 0 && todayMeetings === 0 && alerts.length === 0
    return (
      <div className="h-viewport" style={{ display: 'flex', flexDirection: 'column', width: '100vw', overflow: 'hidden', background: 'var(--bg-page)' }}>
        <header className="aion-topbar" style={{ height: 58, background: '#fff', borderBottom: '0.5px solid #D1FAE5', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
          <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 34, width: 'auto', maxWidth: 140, objectFit: 'contain', minWidth: 0 }} />
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#00695F', background: '#E6F7F5', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{isConsultant ? 'Consultor' : 'Admin Geral'}</span>
          <button type="button" aria-label="Notificações" className="aion-tap" onClick={() => { setNotifOpen(true); setProfileOpen(false) }}
            style={{ marginLeft: 'auto', position: 'relative', width: 38, height: 38, borderRadius: 12, border: '1px solid #D1FAE5', background: '#F0FDFB', color: '#05907B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Bell size={18} />
            {totalBadge > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 99, background: '#F43F5E', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalBadge > 99 ? '99+' : totalBadge}</span>}
          </button>
          <button type="button" aria-label="Meu perfil" className="aion-tap" onClick={() => { setProfileOpen(true); setNotifOpen(false) }}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'var(--aion-grad)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>{initials}</button>
        </header>
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', background: 'var(--bg-page)', paddingBottom: DOCK_SPACE }}>
          {hubBar && <div style={{ padding: '10px 12px 0' }}>{hubBar}</div>}
          <PageAnim pathKey={location.pathname}>{children}</PageAnim>
        </main>
        <AppDock
          items={bar.map(m => ({ key: m.path, label: m.label.replace('CRM Comercial', 'CRM').replace('Minhas Escolas', 'Escolas'), Icon: ico(m) as any, active: act(m) && !menuOpen, badge: (isConsultant ? (m.path === '/super-admin/crm' ? overdueFollowups : 0) : itemBadge(m)) || undefined, onPress: () => go(m.path) }))}
          center={inbox ? { key: inbox.path, label: 'Atender', Icon: ico(inbox) as any, active: act(inbox) && !menuOpen, badge: itemBadge(inbox) || undefined, onPress: () => go(inbox.path) } : undefined}
          menuOpen={menuOpen} menuActive={!onDock} onMenu={() => setMenuOpen(v => !v)} />
        <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} groups={groups} />
        <BottomSheet open={notifOpen} onClose={() => setNotifOpen(false)} label="Notificações" height="82dvh">
          <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(unread > 0 || alertsUnread > 0) && <button type="button" onClick={markAllRead} className="aion-tap" style={{ alignSelf: 'flex-end', border: 'none', background: 'none', color: '#05907B', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Marcar tudo como lido</button>}
            <AlertNotificationList alerts={alerts} onMarkRead={markAlertsRead} onNavigate={() => setNotifOpen(false)} />
            {overdueFollowups > 0 && <SheetRow Icon={AlertCircle} label={`${overdueFollowups} follow-up${overdueFollowups > 1 ? 's' : ''} vencido${overdueFollowups > 1 ? 's' : ''} no CRM`} hint="Ver no CRM" onPress={() => go('/super-admin/crm')} />}
            {todayMeetings > 0 && <SheetRow Icon={AlertCircle} label={`${todayMeetings} reunião${todayMeetings > 1 ? 'ões' : ''} hoje`} hint="Ver na agenda" onPress={() => go('/super-admin/agenda')} />}
            {notifications.map(n => (
              <div key={n.id} onClick={() => openNotif(n)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #E8EDF5', borderRadius: 16, padding: '12px 14px', cursor: n.url ? 'pointer' : 'default' }}>
                <NotifIcon type={n.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{n.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748B', lineHeight: 1.4 }}>{n.message}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8' }}>{new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#05907B', marginTop: 6, flexShrink: 0 }} />}
              </div>
            ))}
            {empty && <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}><Bell size={30} style={{ margin: '0 auto 8px', opacity: .4 }} /><p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Tudo em dia</p></div>}
          </div>
        </BottomSheet>
        <BottomSheet open={profileOpen} onClose={() => setProfileOpen(false)} label="Meu perfil">
          <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <ProfileHero avatar={<span style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--aion-grad)', color: '#fff', fontSize: 20, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials}</span>}
              name={user?.full_name || 'Admin'} line1={user?.email || ''} line2={isConsultant ? 'Consultor' : 'Admin Geral'} />
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #E3E8F0', overflow: 'hidden' }}>
              <SheetRow Icon={UserCog} label="Meu perfil" hint="Dados e senha" onPress={() => go('/super-admin/profile')} />
              {!isConsultant && <SheetRow Icon={Settings} label="Configurações" hint="Ajustes da plataforma" onPress={() => go('/super-admin/settings')} />}
              <SheetRow Icon={LogOut} label="Sair do sistema" danger onPress={handleLogout} />
            </div>
          </div>
        </BottomSheet>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-page)" }}>

      {/* ── SIDEBAR ──────────────────────────────────── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-[68px]'} flex flex-col bg-white border-r border-gray-200 shadow-sm transition-all duration-200 flex-shrink-0 z-10`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            {sidebarOpen
              ? <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 28, objectFit: 'contain' }} />
              : <img src="/aion-logo-icon.png" alt="Aion" style={{ width: 44, height: 44, objectFit: 'contain', transform: 'scale(1.3)' }} />
            }
          </div>
          <button onClick={toggleSidebar}
            className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-3 overflow-y-auto">
          {isConsultant ? (
            <div className="space-y-0.5">
              {CONSULTANT_MENU.map(item => renderNavItem(item))}
            </div>
          ) : (
            ADMIN_GROUPS.map(group => {
              const groupOpen = openGroups[group.title] !== false
              return (
                <div key={group.title}>
                  {sidebarOpen && (
                    <button onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-left group">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-gray-600 transition-colors">
                        {group.title}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-transform duration-200 ${groupOpen ? '' : '-rotate-90'}`} />
                    </button>
                  )}
                  {(!sidebarOpen || groupOpen) && (
                    <div className="space-y-0.5">
                      {group.items.map(item => renderNavItem(item))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </nav>

        {/* User footer */}
        <div className="px-2 pb-3 border-t border-gray-100 pt-2 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors group relative"
            onClick={() => navigate('/super-admin/profile')}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{user?.full_name || 'Admin'}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
            {!sidebarOpen && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                {user?.full_name || 'Perfil'}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            <p className="text-sm font-bold text-gray-900">{currentLabel}</p>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
            </p>
          </div>

          <div className="flex items-center gap-2">

            {/* Notificações */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }}
                className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
                {totalBadge > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                    {totalBadge > 99 ? '99+' : totalBadge}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[300] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="font-bold text-gray-900 text-sm">Notificações</p>
                    {(unread > 0 || alertsUnread > 0) && (
                      <button onClick={markAllRead} className="text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                        Marcar tudo como lido
                      </button>
                    )}
                  </div>

                  {/* Alertas da Central (queda/silêncio do WhatsApp) */}
                  <AlertNotificationList alerts={alerts} onMarkRead={markAlertsRead} onNavigate={() => setNotifOpen(false)} />

                  {/* Alertas de sistema */}
                  {overdueFollowups > 0 && (
                    <Link to="/super-admin/crm" onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 bg-red-50 border-b border-red-100 hover:bg-red-100 transition-colors">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">
                          {overdueFollowups} follow-up{overdueFollowups > 1 ? 's' : ''} vencido{overdueFollowups > 1 ? 's' : ''} no CRM
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">Ver no CRM →</p>
                      </div>
                    </Link>
                  )}

                  {todayMeetings > 0 && (
                    <Link to="/super-admin/agenda" onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 bg-cyan-50 border-b border-cyan-100 hover:bg-cyan-100 transition-colors">
                      <AlertCircle className="w-4 h-4 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-cyan-700">
                          {todayMeetings} reunião{todayMeetings > 1 ? 'ões' : ''} hoje
                        </p>
                        <p className="text-xs text-cyan-500 mt-0.5">Ver na agenda →</p>
                      </div>
                    </Link>
                  )}

                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 && overdueFollowups === 0 && todayMeetings === 0 && alerts.length === 0 ? (
                      <div className="py-10 text-center text-gray-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        <p className="text-sm">Tudo em ordem!</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} onClick={() => openNotif(n)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${n.url ? 'cursor-pointer' : ''} ${!n.read ? 'bg-blue-50/60' : ''}`}>
                        <NotifIcon type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(n.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Perfil */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[300] overflow-hidden">
                  {/* Info */}
                  <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-700 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{user?.full_name || 'Admin'}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">
                          {isConsultant ? 'Consultor' : 'Admin Geral'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="p-2">
                    <Link to="/super-admin/profile" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-sm text-gray-700 font-medium">
                      <UserCog className="w-4 h-4 text-gray-400" />
                      Meu Perfil
                    </Link>
                    <Link to="/super-admin/settings" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-100 rounded-xl transition-colors text-sm text-gray-700 font-medium">
                      <Settings className="w-4 h-4 text-gray-400" />
                      Configurações
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="p-2 border-t border-gray-100">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-red-50 rounded-xl transition-colors text-sm text-red-600 font-semibold">
                      <LogOut className="w-4 h-4" />
                      Sair do sistema
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <div className="flex-1 overflow-auto">
          {hubBar && <div className="px-6 pt-4">{hubBar}</div>}
          {children}
        </div>
      </div>
    </div>
  )
}