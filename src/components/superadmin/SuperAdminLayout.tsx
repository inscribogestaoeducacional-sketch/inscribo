// src/components/superadmin/SuperAdminLayout.tsx
import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Home, Building2, DollarSign, FileText, Settings,
  Bell, LogOut, UserCog, ChevronDown, X, Menu,
  TrendingUp, Shield, AlertCircle, CheckCircle2,
  Info, AlertTriangle, Users
} from 'lucide-react'

// ─── tipos ────────────────────────────────────────────────────────────────
interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'urgent'
  read: boolean
  created_at: string
}

// ─── menu items ───────────────────────────────────────────────────────────
const ADMIN_MENU = [
  { path: '/super-admin',              label: 'Dashboard',      icon: Home,       exact: true },
  { path: '/super-admin/crm',          label: 'CRM Comercial',  icon: TrendingUp  },
  { path: '/super-admin/schools',      label: 'Escolas',        icon: Building2   },
  { path: '/super-admin/financial',    label: 'Financeiro',     icon: DollarSign  },
  { path: '/super-admin/contracts',    label: 'Contratos',      icon: FileText    },
  { path: '/super-admin/settings',     label: 'Configurações',  icon: Settings    },
]

const CONSULTANT_MENU = [
  { path: '/super-admin/consultant',           label: 'Dashboard',        icon: Home,      exact: true },
  { path: '/super-admin/consultant/pipeline',  label: 'Meu Pipeline',     icon: TrendingUp },
  { path: '/super-admin/consultant/schools',   label: 'Minhas Escolas',   icon: Building2  },
  { path: '/super-admin/consultant/contracts', label: 'Meus Contratos',   icon: FileText   },
]

// ─── notif icon ──────────────────────────────────────────────────────────
function NotifIcon({ type }: { type: string }) {
  if (type === 'urgent')  return <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0"    />
  if (type === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
  return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, signOut } = useAuth()

  const [sidebarOpen, setSidebarOpen]       = useState(() => localStorage.getItem('sa-sidebar') !== 'false')
  const [profileOpen, setProfileOpen]       = useState(false)
  const [notifOpen, setNotifOpen]           = useState(false)
  const [notifications, setNotifications]   = useState<Notification[]>([])
  const [unread, setUnread]                 = useState(0)
  const [overdueFollowups, setOverdueFollowups] = useState(0)

  const profileRef = useRef<HTMLDivElement>(null)
  const notifRef   = useRef<HTMLDivElement>(null)

  const isConsultant = user?.user_type === 'consultant'
  const menuItems    = isConsultant ? CONSULTANT_MENU : ADMIN_MENU

  const initials = (user?.full_name || 'A').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

  // ── load data ────────────────────────────────────────────
  useEffect(() => {
    loadNotifications()
    if (!isConsultant) loadOverdueFollowups()
  }, [])

  // ── click outside ────────────────────────────────────────
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

  const loadNotifications = async () => {
    try {
      const { data } = await supabase
        .from('system_notifications')
        .select('*')
        .is('institution_id', null)          // notificações globais do admin
        .order('created_at', { ascending: false })
        .limit(20)
      const list = data || []
      setNotifications(list)
      setUnread(list.filter((n: Notification) => !n.read).length)
    } catch {
      // tabela pode não existir ainda
    }
  }

  const loadOverdueFollowups = async () => {
    try {
      const { count } = await supabase
        .from('crm_leads')
        .select('id', { count: 'exact', head: true })
        .lt('next_followup', new Date().toISOString())
        .not('stage', 'in', '("fechado","cliente")')
      setOverdueFollowups(count || 0)
    } catch {}
  }

  const markAllRead = async () => {
    const ids = notifications.filter(n => !n.read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('system_notifications').update({ read: true }).in('id', ids)
    loadNotifications()
  }

  const handleLogout = async () => {
    try {
      // limpa localStorage
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith('inscribo') || k.startsWith('aion') || k.startsWith('sa-')) {
          // mantém preferências de layout
          if (k !== 'sa-sidebar') localStorage.removeItem(k)
        }
      })
      if (signOut) {
        await signOut()
      } else {
        await supabase.auth.signOut()
      }
      navigate('/login', { replace: true })
    } catch (e) {
      console.error('Logout error:', e)
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    }
  }

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path)

  const totalBadge = unread + overdueFollowups

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ── SIDEBAR ──────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-[68px]'} flex flex-col bg-white border-r border-gray-200 shadow-sm transition-all duration-200 flex-shrink-0`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Shield className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">Áion Edu</p>
                <p className="text-xs text-gray-400 truncate">
                  {isConsultant ? 'Consultor' : 'Admin Geral'}
                </p>
              </div>
            )}
          </div>
          <button onClick={toggleSidebar} className="p-1.5 hover:bg-gray-100 rounded-lg flex-shrink-0 text-gray-400 hover:text-gray-600">
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {menuItems.map(item => {
            const active = isActive(item.path, item.exact)
            const Icon   = item.icon
            const isCRM  = item.path === '/super-admin/crm'
            return (
              <Link key={item.path} to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group
                  ${active
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {sidebarOpen && (
                  <span className="text-sm font-semibold truncate flex-1">{item.label}</span>
                )}
                {/* CRM overdue badge */}
                {isCRM && overdueFollowups > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0
                    ${active ? 'bg-white text-cyan-600' : 'bg-red-500 text-white'}`}>
                    {overdueFollowups}
                  </span>
                )}
                {/* Tooltip quando fechado */}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {item.label}
                    {isCRM && overdueFollowups > 0 && ` (${overdueFollowups})`}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-2 pb-3 border-t border-gray-100 pt-2 flex-shrink-0">
          <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors`}
            onClick={() => navigate('/super-admin/profile')}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.full_name || 'Admin'}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div>
            <p className="text-sm font-bold text-gray-900">
              {menuItems.find(m => isActive(m.path, m.exact))?.label || 'Admin Geral'}
            </p>
            <p className="text-xs text-gray-400">
              {new Date().toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long' })}
            </p>
          </div>

          <div className="flex items-center gap-3">

            {/* ── Notificações ── */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => { setNotifOpen(v => !v); setProfileOpen(false) }}
                className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
                {totalBadge > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {totalBadge > 99 ? '99+' : totalBadge}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[300] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <p className="font-bold text-gray-900 text-sm">Notificações</p>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-cyan-600 font-semibold hover:text-cyan-700">
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  {/* Follow-ups vencidos */}
                  {overdueFollowups > 0 && (
                    <Link to="/super-admin/crm" onClick={() => setNotifOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 bg-red-50 border-b border-red-100 hover:bg-red-100 transition-colors">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700">
                          {overdueFollowups} follow-up{overdueFollowups > 1 ? 's' : ''} vencido{overdueFollowups > 1 ? 's' : ''} no CRM
                        </p>
                        <p className="text-xs text-red-500 mt-0.5">Clique para ver no CRM →</p>
                      </div>
                    </Link>
                  )}

                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-gray-400">
                        <Bell className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                        <p className="text-sm">Nenhuma notificação</p>
                      </div>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50' : ''}`}>
                        <NotifIcon type={n.type} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(n.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Perfil ── */}
            <div className="relative" ref={profileRef}>
              <button onClick={() => { setProfileOpen(v => !v); setNotifOpen(false) }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-xl transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs font-bold">
                  {initials}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[300] overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-4 border-b border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold">
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

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}