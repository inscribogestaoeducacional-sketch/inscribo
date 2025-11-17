import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Shield, 
  User, 
  UserCheck, 
  Search,
  Eye,
  EyeOff,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  Key,
  X,
  Building2,
  AlertTriangle
} from 'lucide-react'

interface AppUser {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  institution_id: string
  active: boolean
  created_at: string
  updated_at: string
  institutions?: { name: string }
}

interface NewUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => void
  editingUser?: AppUser | null
}

function NewUserModal({ isOpen, onClose, onSave, editingUser }: NewUserModalProps) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'user' as 'admin' | 'manager' | 'user',
    password: '',
    confirmPassword: '',
    active: true
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingUser) {
      setFormData({
        full_name: editingUser.full_name,
        email: editingUser.email,
        role: editingUser.role,
        password: '',
        confirmPassword: '',
        active: editingUser.active
      })
    } else {
      setFormData({
        full_name: '',
        email: '',
        role: 'user',
        password: '',
        confirmPassword: '',
        active: true
      })
    }
    setError('')
  }, [editingUser, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!editingUser) {
      if (formData.password !== formData.confirmPassword) {
        setError('As senhas não coincidem')
        return
      }
      
      if (formData.password.length < 6) {
        setError('A senha deve ter pelo menos 6 caracteres')
        return
      }
    }
    
    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error: any) {
      setError(error.message || 'Erro ao salvar usuário')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            {editingUser ? <Edit className="w-8 h-8 mr-3 text-blue-600" /> : <Plus className="w-8 h-8 mr-3 text-green-600" />}
            {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center text-red-700">
            <AlertTriangle className="w-5 h-5 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome Completo *
              </label>
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                placeholder="Nome completo do usuário"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                E-mail *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingUser}
                  className={`pl-10 w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#00D4C4] transition-all ${
                    editingUser ? 'bg-gray-100 border-gray-300 cursor-not-allowed' : 'border-gray-300 focus:border-[#00D4C4]'
                  }`}
                  placeholder="usuario@email.com"
                />
              </div>
              {editingUser && (
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  O email não pode ser alterado
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Perfil de Acesso *
            </label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
            >
              <option value="user">👤 Consultor - Leads, visitas e matrículas</option>
              <option value="manager">👨‍💼 Gestor - Marketing, funil e relatórios</option>
              <option value="admin">🛡️ Administrador - Acesso completo</option>
            </select>
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
              <p className="font-semibold text-blue-900 mb-2">Permissões do perfil:</p>
              <div className="space-y-1 text-blue-700">
                {formData.role === 'user' && (
                  <>
                    <p>✓ Leads: visualizar e gerenciar</p>
                    <p>✓ Visitas: agendar e acompanhar</p>
                    <p>✓ Matrículas: registrar</p>
                  </>
                )}
                {formData.role === 'manager' && (
                  <>
                    <p>✓ Tudo do Consultor +</p>
                    <p>✓ Marketing: campanhas e investimentos</p>
                    <p>✓ Funil: métricas e metas</p>
                    <p>✓ Relatórios: análises completas</p>
                  </>
                )}
                {formData.role === 'admin' && (
                  <>
                    <p>✓ Tudo do Gestor +</p>
                    <p>✓ Usuários: criar e gerenciar</p>
                    <p>✓ Configurações: sistema completo</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {!editingUser && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00D4C4] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirmar Senha *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                    placeholder="Confirme a senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00D4C4] transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1 flex items-center">
                    <XCircle className="w-3 h-3 mr-1" />
                    As senhas não coincidem
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="w-5 h-5 text-[#00D4C4] border-gray-300 rounded focus:ring-[#00D4C4]"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700 flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
              Usuário ativo no sistema
            </label>
          </div>

          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-8 py-3 bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white rounded-xl hover:from-[#00B8AA] hover:to-[#252F7E] transition-all font-medium shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {editingUser ? 'Atualizando...' : 'Criando...'}
                </div>
              ) : (
                editingUser ? 'Atualizar Usuário' : 'Criar Usuário'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal de Alterar Senha
interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
  user: AppUser
  onSave: (newPassword: string) => void
}

function ChangePasswordModal({ isOpen, onClose, user, onSave }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)
    try {
      await onSave(newPassword)
      onClose()
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      setError(error.message || 'Erro ao alterar senha')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Key className="w-7 h-7 mr-3 text-[#00D4C4]" />
            Alterar Senha
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
            <X className="w-6 w-6" />
          </button>
        </div>

        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Usuário:</strong> {user.full_name}
          </p>
          <p className="text-sm text-blue-700">{user.email}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center text-red-700">
            <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nova Senha *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#00D4C4]"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Confirmar Nova Senha *
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
              placeholder="Confirme a nova senha"
            />
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1 flex items-center">
                <XCircle className="w-3 h-3 mr-1" />
                As senhas não coincidem
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white rounded-xl hover:from-[#00B8AA] hover:to-[#252F7E] transition-all font-medium shadow-lg ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function UserManagement() {
  const { user } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AppUser | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => {
    if (user?.role === 'admin' || user?.is_super_admin) {
      loadUsers()
    }
  }, [user])

  const loadUsers = async () => {
    try {
      setLoading(true)
      console.log('🔄 Carregando usuários da instituição:', user?.institution_id)
      
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          institutions(name)
        `)
        .eq('institution_id', user!.institution_id)
        .order('created_at', { ascending: false })

      if (error) throw error
      
      console.log('✅ Usuários carregados:', data?.length || 0)
      setUsers(data || [])
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (formData: any) => {
    try {
      if (editingUser) {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('users')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            active: formData.active
          })
          .eq('id', editingUser.id)

        if (error) throw error
        console.log('✅ Usuário atualizado')
      } else {
        // Criar novo usuário
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name,
              role: formData.role
            }
          }
        })

        if (authError) throw authError

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              email: formData.email,
              full_name: formData.full_name,
              role: formData.role,
              institution_id: user!.institution_id,
              active: formData.active
            })

          if (profileError) throw profileError
          console.log('✅ Usuário criado')
        }
      }

      await loadUsers()
      setEditingUser(null)
    } catch (error: any) {
      console.error('❌ Erro ao salvar usuário:', error)
      throw new Error(error.message || 'Erro ao salvar usuário')
    }
  }

  const handleChangePassword = async (newPassword: string) => {
    if (!selectedUserForPassword) return

    try {
      const { error } = await supabase.auth.admin.updateUserById(
        selectedUserForPassword.id,
        { password: newPassword }
      )

      if (error) throw error
      
      alert('Senha alterada com sucesso!')
      setSelectedUserForPassword(null)
    } catch (error: any) {
      console.error('❌ Erro ao alterar senha:', error)
      throw new Error(error.message || 'Erro ao alterar senha')
    }
  }

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ active: !currentStatus })
        .eq('id', userId)

      if (error) throw error
      await loadUsers()
    } catch (error) {
      console.error('Error updating user status:', error)
      alert('Erro ao atualizar status do usuário')
    }
  }

  const handleDelete = async (userId: string) => {
    const userToDelete = users.find(u => u.id === userId)
    if (!userToDelete) return

    if (!confirm(`⚠️ Tem certeza que deseja EXCLUIR permanentemente o usuário "${userToDelete.full_name}"?\n\nEsta ação não pode ser desfeita.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error
      
      await loadUsers()
      alert('Usuário excluído com sucesso!')
    } catch (error: any) {
      console.error('❌ Erro ao excluir usuário:', error)
      alert('Erro ao excluir usuário: ' + error.message)
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-5 h-5 text-red-500" />
      case 'manager': return <UserCheck className="w-5 h-5 text-blue-500" />
      default: return <User className="w-5 h-5 text-gray-500" />
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'manager': return 'Gestor'
      default: return 'Consultor'
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200'
      case 'manager': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = searchTerm === '' || 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === '' || u.role === filterRole
    const matchesStatus = filterStatus === '' || 
      (filterStatus === 'active' && u.active) ||
      (filterStatus === 'inactive' && !u.active)
    
    return matchesSearch && matchesRole && matchesStatus
  })

  const getUserStats = () => {
    const total = users.length
    const active = users.filter(u => u.active).length
    const admins = users.filter(u => u.role === 'admin').length
    const managers = users.filter(u => u.role === 'manager').length
    
    return { total, active, admins, managers }
  }

  const stats = getUserStats()

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4C4] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando usuários...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <Users className="w-10 h-10 text-[#00D4C4] mr-4" />
              Gestão de Usuários
            </h1>
            <p className="text-gray-600 text-lg">Controle de acesso e permissões do sistema</p>
          </div>
          <button
            onClick={() => {
              setEditingUser(null)
              setShowModal(true)
            }}
            className="bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white px-8 py-4 rounded-2xl hover:from-[#00B8AA] hover:to-[#252F7E] transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Usuário
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Usuários</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Usuários Ativos</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Administradores</p>
                <p className="text-3xl font-bold text-red-600">{stats.admins}</p>
              </div>
              <Shield className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Gestores</p>
                <p className="text-3xl font-bold text-purple-600">{stats.managers}</p>
              </div>
              <UserCheck className="h-8 w-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 w-full border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
            />
          </div>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
          >
            <option value="">Todos os perfis</option>
            <option value="admin">Administradores</option>
            <option value="manager">Gestores</option>
            <option value="user">Consultores</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Perfil
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Instituição
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Criado em
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-12 w-12">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#00D4C4] to-[#2D3E9E] flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-lg">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-semibold text-gray-900">{user.full_name}</div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <Mail className="w-4 h-4 mr-1" />
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      {getRoleIcon(user.role)}
                      <span className={`ml-2 px-3 py-1 text-xs font-semibold rounded-full border ${getRoleBadge(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Building2 className="w-4 h-4 mr-1 text-gray-400" />
                      {user.institutions?.name || 'Sem instituição'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(user.id, user.active)}
                      className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                        user.active 
                          ? 'bg-green-100 text-green-800 border border-green-200 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 border border-red-200 hover:bg-red-200'
                      }`}
                    >
                      {user.active ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Inativo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 flex items-center">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setEditingUser(user)
                          setShowModal(true)
                        }}
                        className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-all"
                        title="Editar usuário"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUserForPassword(user)
                          setShowPasswordModal(true)
                        }}
                        className="text-purple-600 hover:text-purple-900 p-2 hover:bg-purple-50 rounded-lg transition-all"
                        title="Alterar senha"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir usuário"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {users.length === 0 ? 'Nenhum usuário cadastrado' : 'Nenhum usuário encontrado'}
              </h3>
              <p className="text-gray-500">
                {users.length === 0 
                  ? 'Comece criando o primeiro usuário da instituição'
                  : 'Tente ajustar os filtros de busca'
                }
              </p>
              {users.length === 0 && (
                <button
                  onClick={() => {
                    setEditingUser(null)
                    setShowModal(true)
                  }}
                  className="mt-4 px-6 py-2 bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white rounded-lg hover:from-[#00B8AA] hover:to-[#252F7E] transition-colors"
                >
                  Criar Primeiro Usuário
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <NewUserModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingUser(null)
        }}
        onSave={handleSave}
        editingUser={editingUser}
      />

      {selectedUserForPassword && (
        <ChangePasswordModal
          isOpen={showPasswordModal}
          onClose={() => {
            setShowPasswordModal(false)
            setSelectedUserForPassword(null)
          }}
          user={selectedUserForPassword}
          onSave={handleChangePassword}
        />
      )}
    </div>
  )
}
