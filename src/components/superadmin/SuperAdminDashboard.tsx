import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Building2, Users, LogOut, Plus } from 'lucide-react'

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState({
    totalInstitutions: 0,
    totalUsers: 0,
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

      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })

      setStats({
        totalInstitutions: instCount || 0,
        totalUsers: userCount || 0,
      })
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Super Admin</h1>
              <p className="text-gray-600 mt-1">Painel de Gerenciamento</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              <LogOut className="h-5 w-5" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Instituições</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.totalInstitutions}
                </p>
              </div>
              <Building2 className="h-12 w-12 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.totalUsers}
                </p>
              </div>
              <Users className="h-12 w-12 text-green-600" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/super-admin/institutions"
            className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg hover:shadow-xl transition-all p-8 text-white"
          >
            <Building2 className="h-12 w-12 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Gerenciar Instituições</h3>
            <p className="text-blue-100">
              Ver todas as instituições, criar novas e gerenciar usuários de cada uma
            </p>
          </Link>

          <div className="bg-gradient-to-r from-gray-400 to-gray-500 rounded-xl shadow-lg p-8 text-white opacity-50 cursor-not-allowed">
            <Users className="h-12 w-12 mb-4" />
            <h3 className="text-2xl font-bold mb-2">Relatórios</h3>
            <p className="text-gray-100">Em breve</p>
          </div>
        </div>
      </div>
    </div>
  )
}
