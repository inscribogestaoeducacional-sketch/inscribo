import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Building2, Users, Plus, Save, X, Edit, Trash2, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react'

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

export default function SuperAdminInstitutions() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [institutionUsers, setInstitutionUsers] = useState<InstitutionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewInstitution, setShowNewInstitution] = useState(false)
  const [showEditInstitution, setShowEditInstitution] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  const [showEditUser, setShowEditUser] = useState(false)

  const [newInst, setNewInst] = useState({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
  const [editInst, setEditInst] = useState<Institution | null>(null)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', password: '', role: 'user' })
  const [editUser, setEditUser] = useState<InstitutionUser | null>(null)

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
        .insert([{ ...newInst, active: true }])

      if (error) throw error
      
      alert('✅ Instituição criada!')
      setShowNewInstitution(false)
      setNewInst({ name: '', primary_color: '#00C7B7', secondary_color: '#1A1F71' })
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleUpdateInstitution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editInst) return

    try {
      const { error } = await supabase
        .from('institutions')
        .update({
          name: editInst.name,
          primary_color: editInst.primary_color,
          secondary_color: editInst.secondary_color,
        })
        .eq('id', editInst.id)

      if (error) throw error
      
      alert('✅ Instituição atualizada!')
      setShowEditInstitution(false)
      setEditInst(null)
      loadInstitutions()
      if (selectedInstitution?.id === editInst.id) {
        setSelectedInstitution({ ...editInst })
      }
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleToggleInstitution = async (inst: Institution) => {
    const action = inst.active ? 'desativar' : 'ativar'
    if (!confirm(`Deseja ${action} a instituição "${inst.name}"?`)) return

    try {
      const { error } = await supabase
        .from('institutions')
        .update({ active: !inst.active })
        .eq('id', inst.id)

      if (error) throw error
      
      alert(`✅ Instituição ${inst.active ? 'desativada' : 'ativada'}!`)
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteInstitution = async (inst: Institution) => {
    if (!confirm(`⚠️ ATENÇÃO! Excluir "${inst.name}" irá remover TODOS os usuários e dados relacionados. Continuar?`)) return

    try {
      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', inst.id)

      if (error) throw error
      
      alert('✅ Instituição excluída!')
      if (selectedInstitution?.id === inst.id) {
        setSelectedInstitution(null)
        setInstitutionUsers([])
      }
      loadInstitutions()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
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

      alert('✅ Usuário criado!')
      setShowNewUser(false)
      setNewUser({ email: '', full_name: '', password: '', role: 'user' })
      loadInstitutionUsers(selectedInstitution.id)
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
      if (selectedInstitution) {
        loadInstitutionUsers(selectedInstitution.id)
      }
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleToggleUser = async (user: InstitutionUser) => {
    const action = user.active ? 'desativar' : 'ativar'
    if (!confirm(`Deseja ${action} o usuário "${user.full_name}"?`)) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !user.active })
        .eq('id', user.id)

      if (error) throw error
      
      alert(`✅ Usuário ${user.active ? 'desativado' : 'ativado'}!`)
      if (selectedInstitution) {
        loadInstitutionUsers(selectedInstitution.id)
      }
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteUser = async (user: InstitutionUser) => {
    if (!confirm(`⚠️ Deseja excluir o usuário "${user.full_name}"? Esta ação não pode ser desfeita!`)) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (error) throw error
      
      alert('✅ Usuário excluído!')
      if (selectedInstitution) {
        loadInstitutionUsers(selectedInstitution.id)
      }
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/super-admin"
              className="p-2 hover:bg-white rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Sparkles className="w-8 h-8 mr-3 text-[#00D4C4]" />
                Instituições
              </h1>
              <p className="text-lg text-gray-600 mt-1">Gerenciar instituições e usuários</p>
            </div>
          </div>
          <button
            onClick={() => setShowNewInstitution(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Nova Instituição</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lista de Instituições */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">Todas as Instituições ({institutions.length})</h2>
          </div>
          <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
            {institutions.map((inst) => (
              <div
                key={inst.id}
                className={`p-5 hover:bg-gray-50 transition-colors ${
                  selectedInstitution?.id === inst.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div 
                    className="flex items-center space-x-3 flex-1 cursor-pointer"
                    onClick={() => handleSelectInstitution(inst)}
                  >
                    <div className="p-3 bg-blue-100 rounded-xl">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{inst.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(inst.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-8 h-8 rounded-lg border-2 border-gray-200 shadow-sm"
                        style={{ backgroundColor: inst.primary_color }}
                        title={inst.primary_color}
                      />
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        inst.active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {inst.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-14">
                  <button
                    onClick={() => {
                      setEditInst(inst)
                      setShowEditInstitution(true)
                    }}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </button>
                  <button
                    onClick={() => handleToggleInstitution(inst)}
                    className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium ${
                      inst.active
                        ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {inst.active ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                    <span>{inst.active ? 'Desativar' : 'Ativar'}</span>
                  </button>
                  <button
                    onClick={() => handleDeleteInstitution(inst)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Usuários da Instituição */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          {selectedInstitution ? (
            <>
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedInstitution.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">Usuários cadastrados ({institutionUsers.length})</p>
                  </div>
                  <button
                    onClick={() => setShowNewUser(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-semibold">Novo</span>
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
                {institutionUsers.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum usuário cadastrado</p>
                  </div>
                ) : (
                  institutionUsers.map((user) => (
                    <div key={user.id} className="p-5 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start space-x-3 mb-3">
                        <div className="p-2.5 bg-purple-100 rounded-lg">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-gray-900">{user.full_name}</p>
                          <p className="text-sm text-gray-600">{user.email}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 font-medium">
                              {user.role === 'admin' ? 'Admin' : user.role === 'manager' ? 'Gerente' : 'Usuário'}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-lg font-medium ${
                              user.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {user.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-11">
                        <button
                          onClick={() => {
                            setEditUser(user)
                            setShowEditUser(true)
                          }}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium"
                        >
                          <Edit className="h-3 w-3" />
                          <span>Editar</span>
                        </button>
                        <button
                          onClick={() => handleToggleUser(user)}
                          className={`flex items-center space-x-1 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                            user.active
                              ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {user.active ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                          <span>{user.active ? 'Desativar' : 'Ativar'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          className="flex items-center space-x-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Excluir</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="p-16 text-center text-gray-500">
              <Building2 className="h-20 w-20 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">Selecione uma instituição</p>
              <p className="text-sm">Clique em uma instituição ao lado para ver seus usuários</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nova Instituição */}
      {showNewInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Nova Instituição</h3>
              <button onClick={() => setShowNewInstitution(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInstitution} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={newInst.name}
                  onChange={(e) => setNewInst({ ...newInst, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="Ex: Escola Exemplo"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Primária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newInst.primary_color}
                    onChange={(e) => setNewInst({ ...newInst, primary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInst.primary_color}
                    onChange={(e) => setNewInst({ ...newInst, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Secundária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={newInst.secondary_color}
                    onChange={(e) => setNewInst({ ...newInst, secondary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newInst.secondary_color}
                    onChange={(e) => setNewInst({ ...newInst, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Criar Instituição</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Instituição */}
      {showEditInstitution && editInst && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Editar Instituição</h3>
              <button onClick={() => {
                setShowEditInstitution(false)
                setEditInst(null)
              }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateInstitution} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome *</label>
                <input
                  type="text"
                  required
                  value={editInst.name}
                  onChange={(e) => setEditInst({ ...editInst, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Primária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={editInst.primary_color}
                    onChange={(e) => setEditInst({ ...editInst, primary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editInst.primary_color}
                    onChange={(e) => setEditInst({ ...editInst, primary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cor Secundária</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={editInst.secondary_color}
                    onChange={(e) => setEditInst({ ...editInst, secondary_color: e.target.value })}
                    className="w-16 h-12 border-2 border-gray-300 rounded-xl cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editInst.secondary_color}
                    onChange={(e) => setEditInst({ ...editInst, secondary_color: e.target.value })}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Salvar Alterações</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Novo Usuário */}
      {showNewUser && selectedInstitution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Novo Usuário</h3>
              <button onClick={() => setShowNewUser(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="usuario@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Senha *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Perfil *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Criar Usuário</span>
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
              <h3 className="text-2xl font-bold text-gray-900">Editar Usuário</h3>
              <button onClick={() => {
                setShowEditUser(false)
                setEditUser(null)
              }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={editUser.full_name}
                  onChange={(e) => setEditUser({ ...editUser, full_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  value={editUser.email}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">O email não pode ser alterado</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Perfil *</label>
                <select
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="user">Usuário</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Salvar Alterações</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
