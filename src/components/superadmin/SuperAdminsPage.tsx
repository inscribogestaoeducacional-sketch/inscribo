// src/components/superadmin/SuperAdminsPage.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Save,
  X,
  Mail,
  User,
  Calendar,
  Sparkles
} from 'lucide-react'

interface SuperAdmin {
  id: string
  email: string
  full_name: string
  active: boolean
  created_at: string
}

export default function SuperAdminsPage() {
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSuperAdmin, setEditSuperAdmin] = useState<SuperAdmin | null>(null)
  const [newSuperAdmin, setNewSuperAdmin] = useState({
    email: '',
    full_name: '',
    password: ''
  })

  useEffect(() => {
    loadSuperAdmins()
  }, [])

  const loadSuperAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'super_admin')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSuperAdmins(data || [])
    } catch (error) {
      console.error('Erro ao carregar super admins:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newSuperAdmin.email,
        password: newSuperAdmin.password,
      })

      if (authError) throw authError

      // Create user record
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user?.id,
          email: newSuperAdmin.email,
          full_name: newSuperAdmin.full_name,
          role: 'super_admin',
          active: true,
        }])

      if (userError) throw userError

      alert('✅ Super Admin criado com sucesso!')
      setShowNewModal(false)
      setNewSuperAdmin({ email: '', full_name: '', password: '' })
      loadSuperAdmins()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleUpdateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSuperAdmin) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: editSuperAdmin.full_name,
        })
        .eq('id', editSuperAdmin.id)

      if (error) throw error

      alert('✅ Super Admin atualizado!')
      setShowEditModal(false)
      setEditSuperAdmin(null)
      loadSuperAdmins()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleToggleSuperAdmin = async (admin: SuperAdmin) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !admin.active })
        .eq('id', admin.id)

      if (error) throw error

      alert(`✅ Super Admin ${admin.active ? 'desativado' : 'ativado'}!`)
      loadSuperAdmins()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteSuperAdmin = async (admin: SuperAdmin) => {
    if (!confirm(`⚠️ Excluir "${admin.full_name}"? Esta ação não pode ser desfeita.`)) return

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', admin.id)

      if (error) throw error

      alert('✅ Super Admin excluído!')
      loadSuperAdmins()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Shield className="w-8 h-8 mr-3 text-purple-600" />
              Super Admins
            </h1>
            <p className="text-lg text-gray-600 mt-1">
              Gerenciar administradores do sistema
            </p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl transition-all"
          >
            <Plus className="h-5 w-5" />
            <span className="font-semibold">Novo Super Admin</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total</p>
              <p className="text-3xl font-bold text-gray-900">
                {superAdmins.length}
              </p>
            </div>
            <div className="p-4 bg-purple-100 rounded-2xl">
              <Shield className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Ativos</p>
              <p className="text-3xl font-bold text-green-600">
                {superAdmins.filter(a => a.active).length}
              </p>
            </div>
            <div className="p-4 bg-green-100 rounded-2xl">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Inativos</p>
              <p className="text-3xl font-bold text-red-600">
                {superAdmins.filter(a => !a.active).length}
              </p>
            </div>
            <div className="p-4 bg-red-100 rounded-2xl">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Super Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {superAdmins.map((admin) => (
          <div
            key={admin.id}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                  {admin.full_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{admin.full_name}</h3>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <Mail className="w-3 h-3 mr-1" />
                    {admin.email}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  admin.active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {admin.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="flex items-center text-sm text-gray-500 mb-4">
              <Calendar className="w-4 h-4 mr-2" />
              Criado em {new Date(admin.created_at).toLocaleDateString('pt-BR')}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setEditSuperAdmin(admin)
                  setShowEditModal(true)
                }}
                className="flex items-center justify-center space-x-1 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              >
                <Edit className="h-4 w-4" />
                <span>Editar</span>
              </button>
              <button
                onClick={() => handleToggleSuperAdmin(admin)}
                className={`flex items-center justify-center space-x-1 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                  admin.active
                    ? 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {admin.active ? (
                  <ToggleRight className="h-4 w-4" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
                <span>{admin.active ? 'Desativar' : 'Ativar'}</span>
              </button>
              <button
                onClick={() => handleDeleteSuperAdmin(admin)}
                className="col-span-2 flex items-center justify-center space-x-1 px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {superAdmins.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Nenhum Super Admin cadastrado</p>
        </div>
      )}

      {/* Modal: Novo Super Admin */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">Novo Super Admin</h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newSuperAdmin.full_name}
                  onChange={(e) =>
                    setNewSuperAdmin({ ...newSuperAdmin, full_name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Nome do Super Admin"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={newSuperAdmin.email}
                  onChange={(e) =>
                    setNewSuperAdmin({ ...newSuperAdmin, email: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newSuperAdmin.password}
                  onChange={(e) =>
                    setNewSuperAdmin({ ...newSuperAdmin, password: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold"
              >
                <Save className="h-5 w-5" />
                <span>Criar Super Admin</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Super Admin */}
      {showEditModal && editSuperAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-gray-900">
                Editar Super Admin
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditSuperAdmin(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateSuperAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editSuperAdmin.full_name}
                  onChange={(e) =>
                    setEditSuperAdmin({
                      ...editSuperAdmin,
                      full_name: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  disabled
                  value={editSuperAdmin.email}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 cursor-not-allowed"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold"
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
