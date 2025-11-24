// src/components/superadmin/SuperAdminDashboard.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { 
  Building2, 
  Users, 
  Sparkles, 
  TrendingUp, 
  ArrowUpRight, 
  Shield, 
  BarChart3,
  MessageSquare,
  Activity
} from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
  trend?: string
}

function KPICard({ title, value, icon, color, trend }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-sm text-green-600 mt-2 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {trend}
            </p>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${color} flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalInstitutions: 0,
    totalUsers: 0,
    activeInstitutions: 0,
    totalSuperAdmins: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const { count: instCount } = await supabase
        .from('institutions')
        .select('*', { count: 'exact', head: true })

      const { count: activeInst } = await supabase
        .from('institutions')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)

      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      const { count: superAdminCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')

      setStats({
        totalInstitutions: instCount || 0,
        activeInstitutions: activeInst || 0,
        totalUsers: userCount || 0,
        totalSuperAdmins: superAdminCount || 0,
      })
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded-xl w-80 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-40 bg-gray-200 rounded-2xl"></div>
              ))}
            </div>
          </div>
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
            <Sparkles className="w-8 h-8 mr-3 text-cyan-500" />
            <span>Dashboard</span>
          </h1>
          <p className="text-lg text-gray-600">Visão geral do sistema</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <KPICard
            title="Total de Instituições"
            value={stats.totalInstitutions}
            icon={<Building2 className="h-6 w-6 text-blue-600" />}
            color="bg-blue-100"
            trend="+12% este mês"
          />
          <KPICard
            title="Instituições Ativas"
            value={stats.activeInstitutions}
            icon={<TrendingUp className="h-6 w-6 text-green-600" />}
            color="bg-green-100"
            trend="+8% este mês"
          />
          <KPICard
            title="Total de Usuários"
            value={stats.totalUsers}
            icon={<Users className="h-6 w-6 text-purple-600" />}
            color="bg-purple-100"
            trend="+24% este mês"
          />
          <KPICard
            title="Super Admins"
            value={stats.totalSuperAdmins}
            icon={<Shield className="h-6 w-6 text-cyan-600" />}
            color="bg-cyan-100"
          />
        </div>

        {/* Quick Actions Grid */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Acesso Rápido</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            to="/super-admin/institutions"
            className="group bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl shadow-sm backdrop-blur-sm">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <ArrowUpRight className="h-6 w-6 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Instituições</h3>
            <p className="text-blue-100">
              Gerenciar todas as instituições cadastradas no sistema
            </p>
          </Link>

          <Link
            to="/super-admin/super-admins"
            className="group bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl shadow-sm backdrop-blur-sm">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <ArrowUpRight className="h-6 w-6 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Super Admins</h3>
            <p className="text-purple-100">
              Gerenciar administradores do sistema
            </p>
          </Link>

          <Link
            to="/super-admin/users"
            className="group bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl shadow-sm backdrop-blur-sm">
                <Users className="h-8 w-8 text-white" />
              </div>
              <ArrowUpRight className="h-6 w-6 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Todos Usuários</h3>
            <p className="text-green-100">
              Visualizar e gerenciar todos os usuários
            </p>
          </Link>

          <Link
            to="/super-admin/analytics"
            className="group bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl shadow-sm backdrop-blur-sm">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <ArrowUpRight className="h-6 w-6 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Analytics</h3>
            <p className="text-orange-100">
              Métricas e relatórios do sistema
            </p>
          </Link>

          <Link
            to="/super-admin/notifications"
            className="group bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg p-8 hover:shadow-2xl transition-all duration-200 transform hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl shadow-sm backdrop-blur-sm">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <ArrowUpRight className="h-6 w-6 text-white opacity-70 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Notificações</h3>
            <p className="text-cyan-100">
              Enviar notificações para usuários
            </p>
          </Link>

          <div className="bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl shadow-lg p-8 opacity-60 cursor-not-allowed">
            <div className="flex items-start justify-between mb-6">
              <div className="p-4 bg-white bg-opacity-20 rounded-2xl">
                <Activity className="h-8 w-8 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Atividades</h3>
            <p className="text-gray-100">Em breve - Logs do sistema</p>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Atividades Recentes
          </h2>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="space-y-4">
              {[
                {
                  action: 'Nova instituição cadastrada',
                  detail: 'Escola Exemplo XYZ',
                  time: 'Há 2 horas',
                },
                {
                  action: 'Usuário criado',
                  detail: 'João Silva - Admin',
                  time: 'Há 3 horas',
                },
                {
                  action: 'Notificação enviada',
                  detail: 'Atualização do sistema',
                  time: 'Há 5 horas',
                },
              ].map((activity, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full"></div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {activity.action}
                      </p>
                      <p className="text-sm text-gray-600">{activity.detail}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400">{activity.time}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  )
}
