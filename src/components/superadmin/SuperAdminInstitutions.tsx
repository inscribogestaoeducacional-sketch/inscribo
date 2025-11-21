import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Building2, Users, Plus, Save, X } from 'lucide-react'

interface Institution {
  id: string
  name: string
  primary_color: string
  secondary_color: string
  created_at: string
}

interface InstitutionUser {
  id: string
  email: string
  full_name: string
  role: string
  active: boolean
}

export default function SuperAdminInstitutions() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [institutionUsers, setInstitutionUsers] = useState<InstitutionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewInstitution, setShowNewInstitution] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)

  const [newInst, setNewInst] = useState({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })

  useEffect(() => {
    loadInstitutions()
  }, [])

  const loadInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setInstitutions(data || [])
    } catch (error) {
      console.error('Erro:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInstitutionUsers = async (institutionId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setInstitutionUsers(data || [])
    } catch (error) {
      console.error('Erro:', error)
    }
  }

  const handleSelectInstitution = (inst: Institution) => {
    setSelectedInstitution(inst)
    loadInstitutionUsers(inst.id)
  }

  const handleCreateInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('institutions')
        .insert([newInst])

      if (error) throw error
      
      alert('Instituição criada!')
      setShowNewInstitution(false)
      setNewInst({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
      loadInstitutions()
    } catch (error: any) {
      alert('Erro: ' + error.message)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedInstitution) return

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
          institution_id: selectedInstitution.id,
          active: true,
        }])

      if (userError) throw userError

      alert('Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'user' })
      loadInstitutionUsers(selectedInstitution.id)
    } catch (error: any) {
      alert('Erro: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Link to="/super-admin" className="text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-6 w-6" />
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Instituições</h1>
                <p className="text-gray-600 mt-1">Gerenciar instituições e usuários</p>
              </div>
            </div>
            <button
              onClick={() => setShowNewInstitution(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              <span>Nova Instituição</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Todas as Instituições</h2>
            </div>
            <div className="divide-y max-h-[600px] overflow-y-auto">
              {institutions.map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => handleSelectInstitution(inst)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedInstitution?.id === inst.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{inst.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(inst.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: inst.primary_color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            {selectedInstitution ? (
              <>
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedInstitution.name}</h2>
                      <p className="text-sm text-gray-600 mt-1">Usuários</p>
                    </div>
                    <button
                      onClick={() => setShowNewUser(true)}
                      className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Novo</span>
                    </button>
                  </div>
                </div>
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {institutionUsers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">Nenhum usuário</div>
                  ) : (
                    institutionUsers.map((user) => (
                      <div key={user.id} className="p-4">
                        <div className="flex items-center space-x-3">
                          <Users className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="font-semibold text-gray-900">{user.full_name}</p>
                            <p className="text-sm text-gray-600">{user.email}</p>
                            <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p>Selecione uma instituição</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showNewInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Nova Instituição</h3>
              <button onClick={() => setShowNewInstitution(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateInstitution} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={newInst.name}
                  onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Cor Primária</label>
                <input
                  type="color"
                  value={newInst.primary_color}
                  onChange={(e) => setNewInst({ ...newInst, primary_color: e.target.value })}
                  className="w-full h-10 border rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="h-5 w-5" />
                <span>Criar</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {showNewUser && selectedInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Novo Usuário</h3>
              <button onClick={() => setShowNewUser(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Senha</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Perfil</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Save className="h-5 w-5" />
                <span>Criar</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
