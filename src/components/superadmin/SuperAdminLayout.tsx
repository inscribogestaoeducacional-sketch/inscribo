import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Building2,
  Users,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  Settings,
  Shield,
  ChevronDown,
  Home,
  UserCog,
  BarChart3,
  MessageSquare,
  KanbanSquare,
  DollarSign,
  UserCheck
} from 'lucide-react'

interface SuperAdminLayoutProps {
  children: React.ReactNode
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_super_admin?: boolean
  user_type?: 'school_user' | 'consultant' | 'admin_geral'
}

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  created_at: string
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    loadUserData()
    loadNotifications()
  }, [])

  const loadUserData = async () => {
    try {
      const storedUser = localStorage.getItem('inscribo-user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        setUser(userData)
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error)
    }
  }

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_role', 'super_admin')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('Erro ao carregar notificações:', error)
        return
      }
      
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
      
      loadNotifications()
    } catch (error) {
      console.error('Erro ao marcar notificação:', error)
    }
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      localStorage.removeItem('inscribo-user')
      localStorage.removeItem('inscribo-auth-token')
      navigate('/login')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const isConsultant = user?.user_type === 'consultant'
  const isAdminGeral = user?.is_super_admin || user?.user_type === 'admin_geral'

  const consultantMenuItems = [
    { path: '/super-admin/consultant', icon: Home, label: 'Dashboard', exact: true },
    { path: '/super-admin/consultant/pipeline', icon: KanbanSquare, label: 'Meu Pipeline' },
    { path: '/super-admin/consultant/schools', icon: Building2, label: 'Minhas Escolas' },
    { path: '/super-admin/profile', icon: UserCog, label: 'Perfil' },
  ]

  const adminMenuItems = [
    { path: '/super-admin', icon: Home, label: 'Dashboard', exact: true },
    { path: '/super-admin/institutions', icon: Building2, label: 'Instituições' },
    { path: '/super-admin/financial', icon: DollarSign, label: 'Financeiro' },
    { path: '/super-admin/consultants', icon: UserCheck, label: 'Consultores' },
    { path: '/super-admin/super-admins', icon: Shield, label: 'Super Admins' },
    { path: '/super-admin/users', icon: Users, label: 'Todos Usuários' },
    { path: '/super-admin/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/super-admin/notifications', icon: MessageSquare, label: 'Notificações' },
    { path: '/super-admin/settings', icon: Settings, label: 'Configurações' },
  ]

  const menuItems = isConsultant ? consultantMenuItems : adminMenuItems

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-72' : 'w-20'
        } bg-white border-r border-gray-200 transition-all duration-300 flex flex-col shadow-lg flex-shrink-0`}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200 flex-shrink-0">
          {sidebarOpen ? (
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Áion Edu</h1>
                <p className="text-xs text-gray-500">Super Admin</p>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mx-auto">
              <Shield className="w-6 h-6 text-white" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-600" />
            ) : (
              <Menu className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                isActive(item.path, item.exact)
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 flex-shrink-0">
          <div
            className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {user?.full_name?.charAt(0) || 'S'}
            </div>
            {sidebarOpen && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.full_name || 'Super Admin'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-20 bg-white border-b border-gray-200 px-8 flex items-center justify-between shadow-sm flex-shrink-0">
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar instituições, usuários, configurações..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4 ml-8">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-6 h-6 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-96 overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900">Notificações</h3>
                  </div>
                  <div className="overflow-y-auto max-h-80">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => markAsRead(notif.id)}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                            !notif.read ? 'bg-blue-50' : ''
                          }`}
                        >
                          <p className="font-semibold text-sm text-gray-900">
                            {notif.title}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notif.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-gray-500">
                        <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                        <p>Nenhuma notificação</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                  {user?.full_name?.charAt(0) || 'S'}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                  <div className="p-4 border-b border-gray-200">
                    <p className="font-bold text-gray-900">{user?.full_name}</p>
                    <p className="text-sm text-gray-500">{user?.email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                      {isConsultant ? 'Consultor' : isAdminGeral ? 'Admin Geral' : 'Super Admin'}
                    </span>
                  </div>
                  <div className="p-2">
                    <Link
                      to="/super-admin/profile"
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <UserCog className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Meu Perfil</span>
                    </Link>
                    <Link
                      to="/super-admin/settings"
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-700">Configurações</span>
                    </Link>
                  </div>
                  <div className="p-2 border-t border-gray-200">
                    <button
                      onClick={handleLogout}
                      className="flex items-center space-x-2 px-4 py-2 hover:bg-red-50 rounded-lg transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4 text-red-600" />
                      <span className="text-sm text-red-600 font-semibold">Sair</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Page Content - SCROLLABLE */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
