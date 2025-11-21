import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { 
  ArrowLeft, 
  Users, 
  GraduationCap, 
  Calendar, 
  TrendingUp, 
  DollarSign,
  Eye,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Save,
  X
} from 'lucide-react'

interface Institution {
  id: string
  name: string
  primary_color: string
  secondary_color: string
  active: boolean
  created_at: string
}

interface InstitutionUser {
  id: string
  email: string
  full_name: string
  role: string
  active: boolean
}

interface KPICardProps {
  title: string
  value: string | number
  change?: number
  icon: React.ReactNode
  color: string
}

function KPICard({ title, value, change, icon, color }: KPICardProps) {
  const isPositive = change ? change >= 0 : true
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
          {change !== undefined && (
            <div className="flex items-center">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? '+' : ''}{change}%
              </span>
              <span className="text-xs text-gray-500 ml-2">vs. mês anterior</span>
            </div>
          )}
        </div>
        <div className={`p-4 rounded-2xl ${color} flex-shrink-0 shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default function InstitutionDetails() {
  const { id } = useParams<{ id: string }>()
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [users, setUsers] = useState<InstitutionUser[]>([])
  const [stats, setStats] = useState({
    totalLeads: 0,
    visitsToday: 0,
    enrollmentsMonth: 0,
    conversionRate: 0,
    cpa: 0,
    reEnrollmentRate: 92.5
  })
  const [funnelData, setFunnelData] = useState({
    leads: 0,
    contacts: 0,
    scheduled: 0,
    visits: 0,
    proposals: 0,
    enrollments: 0
  })
  const [loading, setLoading] = useState(true)
  const [showEditUser, setShowEditUser] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  const [editUser, setEditUser] = useState<InstitutionUser | null>(null)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })

  useEffect(() => {
    if (id) {
      loadInstitutionData()
    }
  }, [id])

  const loadInstitutionData = async () => {
    try {
      // Carregar instituição
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', id)
        .single()

      if (instError) throw instError
      setInstitution(instData)

      // Carregar usuários
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', id)
        .order('created_at', { ascending: false })

      if (usersError) throw usersError
      setUsers(usersData || [])

      // Carregar estatísticas
      const [leads, visits, enrollments] = await Promise.all([
        supabase.from('leads').select('*').eq('institution_id', id),
        supabase.from('visits').select('*').eq('institution_id', id),
        supabase.from('enrollments').select('*').eq('institution_id', id)
      ])

      const today = new Date().toISOString().split('T')[0]
      const thisMonth = new Date().toISOString().slice(0, 7)

      const totalLeads = leads.data?.length || 0
      const visitsToday = visits.data?.filter(v => v.scheduled_date.startsWith(today)).length || 0
      const enrollmentsMonth = enrollments.data?.filter(e => e.created_at.startsWith(thisMonth)).length || 0
      const enrolledLeads = leads.data?.filter(l => l.status === 'enrolled').length || 0
      const conversionRate = totalLeads > 0 ? (enrolledLeads / totalLeads) * 100 : 0

      setStats({
        totalLeads,
        visitsToday,
        enrollmentsMonth,
        conversionRate: Math.round(conversionRate * 10) / 10,
        cpa: 23,
        reEnrollmentRate: 92.5
      })

      // Funil
      const leadsData = leads.data || []
      setFunnelData({
        leads: leadsData.length,
        contacts: leadsData.filter(l => ['contact', 'scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length,
        scheduled: leadsData.filter(l => ['scheduled', 'visit', 'proposal', 'enrolled'].includes(l.status)).length,
        visits: leadsData.filter(l => ['visit', 'proposal', 'enrolled'].includes(l.status)).length,
        proposals: leadsData.filter(l => ['proposal', 'enrolled'].includes(l.status)).length,
        enrollments: leadsData.filter(l => l.status === 'enrolled').length
      })

    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!institution) return

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      })

      if (authError) throw authError

      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user?.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          institution_id: institution.id,
          active: true,
        }])

      if (userError) throw userError

      alert('✅ Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'user' })
      loadInstitutionData()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editUser) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editUser.full_name,
          role: editUser.role,
        })
        .eq('id', editUser.id)

      if (error) throw error
      
      alert('✅ Usuário atualizado!')
      setShowEditUser(false)
      setEditUser(null)
      loadInstitutionData()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleToggleUser = async (user: InstitutionUser) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !user.active })
        .eq('id', user.id)

      if (error) throw error
      
      alert(`✅ Usuário ${user.active ? 'desativado' : 'ativado'}!`)
      loadInstitutionData()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteUser = async (user: InstitutionUser) => {
    if (!confirm(`⚠️ Excluir "${user.full_name}"?`)) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (error) throw error
      
      alert('✅ Usuário excluído!')
      loadInstitutionData()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  if (loading || !institution) {
    return (
      <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <Link
              to="/super-admin/institutions"
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Sparkles className="w-8 h-8 mr-3" style={{ color: institution.primary_color }} />
                {institution.name}
              </h1>
              <p className="text-lg text-gray-600 mt-1">Dashboard e Usuários</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div
              className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-sm"
              style={{ backgroundColor: institution.primary_color }}
              title={institution.primary_color}
            />
            <div
              className="w-10 h-10 rounded-lg border-2 border-gray-200 shadow-sm"
              style={{ backgroundColor: institution.secondary_color }}
              title={institution.secondary_color}
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
        <KPICard
          title="Total de Leads"
          value={stats.totalLeads}
          change={-41}
          icon={<Users className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <KPICard
          title="Visitas Hoje"
          value={stats.visitsToday}
          icon={<Calendar className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <KPICard
          title="Matrículas Mês"
          value={stats.enrollmentsMonth}
          change={0}
          icon={<GraduationCap className="h-6 w-6 text-purple-600" />}
          color="bg-purple-100"
        />
        <KPICard
          title="Taxa Conversão"
          value={`${stats.conversionRate}%`}
          change={100}
          icon={<TrendingUp className="h-6 w-6 text-orange-600" />}
          color="bg-orange-100"
        />
        <KPICard
          title="CPA Atual"
          value={`R$ ${stats.cpa}`}
          change={-2.1}
          icon={<DollarSign className="h-6 w-6 text-red-600" />}
          color="bg-red-100"
        />
        <KPICard
          title="Taxa Rematrícula"
          value={`${stats.reEnrollmentRate}%`}
          change={2.1}
          icon={<RefreshCw className="h-6 w-6 text-teal-600" />}
          color="bg-teal-100"
        />
      </div>

      {/* Funil e Usuários */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Funil */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Funil de Conversão</h3>
          <div className="space-y-6">
            {[
              { etapa: 'Leads Cadastrados', valor: funnelData.leads, percentual: 100, cor: 'bg-blue-500', icon: Users },
              { etapa: 'Contatos Realizados', valor: funnelData.contacts, percentual: funnelData.leads > 0 ? (funnelData.contacts / funnelData.leads) * 100 : 0, cor: 'bg-green-500', icon: Users },
              { etapa: 'Visitas Agendadas', valor: funnelData.scheduled, percentual: funnelData.leads > 0 ? (funnelData.scheduled / funnelData.leads) * 100 : 0, cor: 'bg-yellow-500', icon: Calendar },
              { etapa: 'Visitas Realizadas', valor: funnelData.visits, percentual: funnelData.leads > 0 ? (funnelData.visits / funnelData.leads) * 100 : 0, cor: 'bg-orange-500', icon: Eye },
              { etapa: 'Propostas Enviadas', valor: funnelData.proposals, percentual: funnelData.leads > 0 ? (funnelData.proposals / funnelData.leads) * 100 : 0, cor: 'bg-indigo-500', icon: Target },
              { etapa: 'Matrículas', valor: funnelData.enrollments, percentual: funnelData.leads > 0 ? (funnelData.enrollments / funnelData.leads) * 100 : 0, cor: 'bg-purple-500', icon: GraduationCap }
            ].map((item, index) => {
              const Icon = item.icon
              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Icon className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-sm font-medium text-gray-700">{item.etapa}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{item.valor}</span>
                      <span className="text-xs text-gray-500">({item.percentual.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${item.cor} transition-all duration-500 shadow-sm`}
                      style={{ width: `${Math.max(item.percentual, 2)}%` }}
                    ></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Usuários */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900">Usuários ({users.length})</h3>
            <button
              onClick={() => setShowNewUser(true)}
              className="flex items-center space-x-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-semibold"
            >
              <Plus className="h-4 w-4" />
              <span>Novo</span>
            </button>
          </div>
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {users.map((user) => (
              <div key={user.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{user.full_name}</p>
                    <p className="text-xs text-gray-600">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 font-medium">
                    {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : 'Usuário'}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setEditUser(user)
                      setShowEditUser(true)
                    }}
                    className="flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs"
                  >
                    <Edit className="h-3 w-3" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleToggleUser(user)}
                    className={`flex-1 flex items-center justify-center space-x-1 px-2 py-1.5 rounded-lg transition-colors text-xs ${
                      user.active
                        ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {user.active ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user)}
                    className="px-2 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Novo Usuário */}
      {showNewUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Novo Usuário</h3>
              <button onClick={() => setShowNewUser(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Senha *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Perfil *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Criar</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Usuário */}
      {showEditUser && editUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Editar Usuário</h3>
              <button onClick={() => {
                setShowEditUser(false)
                setEditUser(null)
              }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={editUser.full_name}
                  onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  value={editUser.email}
                  className="w-full px-4 py-3 border rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Perfil *</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Salvar</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
