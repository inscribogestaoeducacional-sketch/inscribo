import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Building2, Users, LogOut, Sparkles, TrendingUp, ArrowUpRight } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  color: string
}

function KPICard({ title, value, icon, color }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
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

      setStats({
        totalInstitutions: instCount || 0,
        activeInstitutions: activeInst || 0,
        totalUsers: userCount || 0,
      })
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem('inscribo-user')
    localStorage.removeItem('inscribo-auth-token')
    window.location.href = '/login'
  }

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded-xl w-80 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
              <Sparkles className="w-8 h-8 mr-3 text-[#00D4C4]" />
              <span>Super Admin</span>
            </h1>
            <p className="text-lg text-gray-600">Painel de Gerenciamento do Sistema</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg hover:shadow-xl"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-semibold">Sair</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
        <KPICard
          title="Total de Instituições"
          value={stats.totalInstitutions}
          icon={<Building2 className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <KPICard
          title="Instituições Ativas"
          value={stats.activeInstitutions}
          icon={<TrendingUp className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <KPICard
          title="Total de Usuários"
          value={stats.totalUsers}
          icon={<Users className="h-6 w-6 text-purple-600" />}
          color="bg-purple-100"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Link
          to="/super-admin/institutions"
          className="group bg-white rounded-2xl shadow-lg border border-gray-100 p-8 hover:shadow-xl transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="p-4 bg-blue-100 rounded-2xl shadow-sm">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <ArrowUpRight className="h-6 w-6 text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">Gerenciar Instituições</h3>
          <p className="text-gray-600 mb-4">
            Ver, criar, editar e gerenciar todas as instituições e seus usuários
          </p>
          <div className="flex items-center text-blue-600 font-semibold">
            <span>Acessar</span>
            <ArrowUpRight className="h-4 w-4 ml-1" />
          </div>
        </Link>

        <div className="bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl shadow-lg p-8 opacity-50 cursor-not-allowed">
          <div className="flex items-start justify-between mb-6">
            <div className="p-4 bg-gray-300 rounded-2xl">
              <Users className="h-8 w-8 text-gray-500" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-700 mb-3">Relatórios do Sistema</h3>
          <p className="text-gray-600 mb-4">
            Métricas e análises gerais - Em breve
          </p>
        </div>
      </div>
    </div>
  )
}
