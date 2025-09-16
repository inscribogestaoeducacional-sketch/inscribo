import React, { useState, useEffect } from 'react'
import { Plus, CheckCircle, Clock, AlertCircle, User, Calendar, Edit } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Action, User as AppUser } from '../../lib/supabase'

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-gray-500' },
  medium: { label: 'Média', color: 'bg-yellow-500' },
  high: { label: 'Alta', color: 'bg-orange-500' },
  urgent: { label: 'Urgente', color: 'bg-red-500' }
}

const statusConfig = {
  pending: { label: 'Pendente', color: 'bg-gray-500', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500', icon: Clock },
  completed: { label: 'Concluída', color: 'bg-green-500', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-500', icon: AlertCircle }
}

const typeConfig = {
  marketing: { label: 'Marketing', color: 'bg-purple-100 text-purple-800' },
  sales: { label: 'Vendas', color: 'bg-blue-100 text-blue-800' },
  retention: { label: 'Retenção', color: 'bg-green-100 text-green-800' },
  operations: { label: 'Operações', color: 'bg-orange-100 text-orange-800' }
}

export default function ActionsManager() {
  const { user } = useAuth()
  const [actions, setActions] = useState<Action[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    action_type: 'marketing' as Action['action_type'],
    priority: 'medium' as Action['priority'],
    assigned_to: '',
    due_date: ''
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [actionsData, usersData] = await Promise.all([
        DatabaseService.getActions(user!.institution_id!),
        DatabaseService.getUsers(user!.institution_id!)
      ])
      setActions(actionsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const actionData = {
        ...formData,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        institution_id: user!.institution_id!
      }

      if (editingAction) {
        await DatabaseService.updateAction(editingAction.id, actionData)
      } else {
        await DatabaseService.createAction(actionData)
      }

      await loadData()
      setShowForm(false)
      setEditingAction(null)
      setFormData({
        title: '',
        description: '',
        action_type: 'marketing',
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      })
    } catch (error) {
      console.error('Error saving action:', error)
    }
  }

  const handleEdit = (action: Action) => {
    setEditingAction(action)
    setFormData({
      title: action.title,
      description: action.description,
      action_type: action.action_type,
      priority: action.priority,
      assigned_to: action.assigned_to || '',
      due_date: action.due_date?.slice(0, 10) || ''
    })
    setShowForm(true)
  }

  const handleStatusChange = async (actionId: string, newStatus: Action['status']) => {
    try {
      await DatabaseService.updateAction(actionId, { status: newStatus })
      await loadData()
    } catch (error) {
      console.error('Error updating action status:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getActionsByStatus = (status: Action['status']) => {
    return actions.filter(action => action.status === status)
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user ? user.full_name : 'Não atribuído'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Plano de Ações</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Ação
        </button>
      </div>

      {/* Status Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
              <h3 className="font-semibold text-gray-900">{config.label}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                {getActionsByStatus(status as Action['status']).length}
              </span>
            </div>

            <div className="space-y-3">
              {getActionsByStatus(status as Action['status']).map((action) => (
                <div
                  key={action.id}
                  className="bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{action.title}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(action)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 mb-2">{action.description}</p>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs ${typeConfig[action.action_type].color}`}>
                        {typeConfig[action.action_type].label}
                      </span>
                      <div className={`w-2 h-2 rounded-full ${priorityConfig[action.priority].color}`}></div>
                    </div>

                    {action.assigned_to && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        <span>{getUserName(action.assigned_to)}</span>
                      </div>
                    )}

                    {action.due_date && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(action.due_date)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t">
                    <select
                      value={action.status}
                      onChange={(e) => handleStatusChange(action.id, e.target.value as Action['status'])}
                      className="w-full text-xs border rounded px-2 py-1"
                    >
                      {Object.entries(statusConfig).map(([value, config]) => (
                        <option key={value} value={value}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingAction ? 'Editar Ação' : 'Nova Ação'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  required
                  value={formData.action_type}
                  onChange={(e) => setFormData({ ...formData, action_type: e.target.value as Action['action_type'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {Object.entries(typeConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade *
                </label>
                <select
                  required
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as Action['priority'] })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {Object.entries(priorityConfig).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável
                </label>
                <select
                  value={formData.assigned_to}
                  onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Não atribuído</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data de Vencimento
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingAction(null)
                    setFormData({
                      title: '',
                      description: '',
                      action_type: 'marketing',
                      priority: 'medium',
                      assigned_to: '',
                      due_date: ''
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  {editingAction ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}