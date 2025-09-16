import React, { useState, useEffect } from 'react'
import { CheckSquare, Plus, Clock, AlertTriangle, CheckCircle, X, User, Calendar } from 'lucide-react'
import { DatabaseService, Action } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NewActionModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Action>) => void
  editingAction?: Action | null
}

function NewActionModal({ isOpen, onClose, onSave, editingAction }: NewActionModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    action_type: '',
    priority: 'medium',
    assigned_to: '',
    due_date: ''
  })

  useEffect(() => {
    if (editingAction) {
      setFormData({
        title: editingAction.title,
        description: editingAction.description,
        action_type: editingAction.action_type,
        priority: editingAction.priority,
        assigned_to: editingAction.assigned_to || '',
        due_date: editingAction.due_date ? editingAction.due_date.split('T')[0] : ''
      })
    } else {
      setFormData({
        title: '',
        description: '',
        action_type: '',
        priority: 'medium',
        assigned_to: '',
        due_date: ''
      })
    }
  }, [editingAction, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingAction ? 'Editar Ação' : 'Nova Ação'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>
        
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Título da ação"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição *
            </label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Descrição detalhada da ação"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo *
            </label>
            <select
              required
              value={formData.action_type}
              onChange={(e) => setFormData({ ...formData, action_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecionar tipo...</option>
              <option value="marketing">Marketing</option>
              <option value="sales">Vendas</option>
              <option value="retention">Retenção</option>
              <option value="operations">Operações</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Prioridade
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {editingAction ? 'Atualizar' : 'Criar'} Ação
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ActionsManager() {
  const { user } = useAuth()
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingAction, setEditingAction] = useState<Action | null>(null)
  const [filter, setFilter] = useState('all')

  // Mock data for demonstration
  const mockActions: Action[] = [
    {
      id: '1',
      title: 'Campanha Facebook Ads',
      description: 'Criar nova campanha para captação de leads do ensino médio',
      action_type: 'marketing',
      priority: 'high',
      assigned_to: user?.id || '',
      status: 'pending',
      due_date: '2024-02-15T00:00:00Z',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Follow-up Leads Perdidos',
      description: 'Entrar em contato com leads que não converteram no último mês',
      action_type: 'sales',
      priority: 'medium',
      assigned_to: user?.id || '',
      status: 'in_progress',
      due_date: '2024-02-10T00:00:00Z',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      title: 'Pesquisa de Satisfação',
      description: 'Enviar pesquisa de satisfação para alunos atuais',
      action_type: 'retention',
      priority: 'low',
      assigned_to: user?.id || '',
      status: 'completed',
      due_date: '2024-01-30T00:00:00Z',
      institution_id: user?.institution_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ]

  useEffect(() => {
    loadActions()
  }, [user])

  const loadActions = async () => {
    try {
      setLoading(true)
      // Use mock data for now
      setActions(mockActions)
    } catch (error) {
      console.error('Error loading actions:', error)
      setActions(mockActions)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Action>) => {
    try {
      if (editingAction) {
        // Update existing
        const updated = actions.map(action => 
          action.id === editingAction.id ? { ...action, ...data, updated_at: new Date().toISOString() } : action
        )
        setActions(updated)
      } else {
        // Add new
        const newAction: Action = {
          id: Date.now().toString(),
          ...data as Action,
          status: 'pending',
          assigned_to: user?.id || '',
          institution_id: user?.institution_id || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        setActions([newAction, ...actions])
      }
      setEditingAction(null)
    } catch (error) {
      console.error('Error saving action:', error)
    }
  }

  const handleEdit = (action: Action) => {
    setEditingAction(action)
    setShowModal(true)
  }

  const handleNew = () => {
    setEditingAction(null)
    setShowModal(true)
  }

  const handleStatusChange = (actionId: string, newStatus: string) => {
    const updated = actions.map(action => 
      action.id === actionId 
        ? { ...action, status: newStatus as any, updated_at: new Date().toISOString() }
        : action
    )
    setActions(updated)
  }

  const filteredActions = actions.filter(action => {
    if (filter === 'all') return true
    return action.status === filter
  })

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800'
      case 'in_progress': return 'bg-blue-100 text-blue-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'in_progress': return <Clock className="h-4 w-4" />
      case 'pending': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plano de Ações</h1>
          <p className="text-gray-600">Gerencie tarefas e ações estratégicas</p>
        </div>
        <button
          onClick={handleNew}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Ação
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Filtrar por status:</span>
          <div className="flex space-x-2">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'pending', label: 'Pendentes' },
              { key: 'in_progress', label: 'Em Andamento' },
              { key: 'completed', label: 'Concluídas' }
            ].map(option => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  filter === option.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Actions List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prioridade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredActions.map((action) => (
                <tr key={action.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{action.title}</div>
                      <div className="text-sm text-gray-500">{action.description}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {action.action_type === 'marketing' ? 'Marketing' :
                       action.action_type === 'sales' ? 'Vendas' :
                       action.action_type === 'retention' ? 'Retenção' : 'Operações'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(action.priority)}`}>
                      {action.priority === 'urgent' ? 'Urgente' :
                       action.priority === 'high' ? 'Alta' :
                       action.priority === 'medium' ? 'Média' : 'Baixa'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(action.status)}`}>
                        <span className="mr-1">{getStatusIcon(action.status)}</span>
                        {action.status === 'completed' ? 'Concluída' :
                         action.status === 'in_progress' ? 'Em Andamento' :
                         action.status === 'pending' ? 'Pendente' : 'Cancelada'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {action.due_date ? (
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        {new Date(action.due_date).toLocaleDateString('pt-BR')}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(action)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      {action.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(action.id, 'in_progress')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Iniciar
                        </button>
                      )}
                      {action.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(action.id, 'completed')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Concluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <NewActionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingAction(null)
        }}
        onSave={handleSave}
        editingAction={editingAction}
      />
    </div>
  )
}