import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  MessageSquare,
  Plus,
  Send,
  X,
  Users,
  Building2,
  Shield,
  Calendar,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

interface Notification {
  id: string
  title: string
  message: string
  target_role: string
  institution_id?: string
  read: boolean
  created_at: string
}

interface Institution {
  id: string
  name: string
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newNotification, setNewNotification] = useState({
    title: '',
    message: '',
    target: 'all', // all, institution, super_admin
    institution_id: '',
  })

  useEffect(() => {
    loadNotifications()
    loadInstitutions()
  }, [])

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setNotifications(data || [])
    } catch (error) {
      console.error('Erro ao carregar notificações:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadInstitutions = async () => {
    try {
      const { data, error } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('active', true)
        .order('name')

      if (error) throw error
      setInstitutions(data || [])
    } catch (error) {
      console.error('Erro ao carregar instituições:', error)
    }
  }

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      let notificationData: any = {
        title: newNotification.title,
        message: newNotification.message,
        read: false,
      }

      if (newNotification.target === 'all') {
        notificationData.target_role = 'all'
      } else if (newNotification.target === 'super_admin') {
        notificationData.target_role = 'super_admin'
      } else if (newNotification.target === 'institution') {
        notificationData.target_role = 'institution'
        notificationData.institution_id = newNotification.institution_id
      }

      const { error } = await supabase
        .from('notifications')
        .insert([notificationData])

      if (error) throw error

      alert('✅ Notificação enviada com sucesso!')
      setShowNewModal(false)
      setNewNotification({
        title: '',
        message: '',
        target: 'all',
        institution_id: '',
      })
      loadNotifications()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Excluir esta notificação?')) return

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('✅ Notificação excluída!')
      loadNotifications()
    } catch (error: any) {
      alert('❌ Erro: ' + error.message)
    }
  }

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto"></div>
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <MessageSquare className="w-8 h-8 mr-3 text-cyan-600" />
                Central de Notificações
              </h1>
              <p className="text-lg text-gray-600 mt-1">
                Enviar notificações para usuários e instituições
              </p>
            </div>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:shadow-xl transition-all"
            >
              <Plus className="h-5 w-5" />
              <span className="font-semibold">Nova Notificação</span>
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Enviadas</p>
                <p className="text-3xl font-bold text-gray-900">
                  {notifications.length}
                </p>
              </div>
              <div className="p-4 bg-blue-100 rounded-2xl">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Lidas</p>
                <p className="text-3xl font-bold text-green-600">
                  {notifications.filter(n => n.read).length}
                </p>
              </div>
              <div className="p-4 bg-green-100 rounded-2xl">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Não Lidas</p>
                <p className="text-3xl font-bold text-orange-600">
                  {notifications.filter(n => !n.read).length}
                </p>
              </div>
              <div className="p-4 bg-orange-100 rounded-2xl">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Hoje</p>
                <p className="text-3xl font-bold text-purple-600">
                  {notifications.filter(n => {
                    const today = new Date().toDateString()
                    return new Date(n.created_at).toDateString() === today
                  }).length}
                </p>
              </div>
              <div className="p-4 bg-purple-100 rounded-2xl">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-bold text-gray-900">
              Notificações Enviadas
            </h3>
          </div>
          <div className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-bold text-gray-900">{notif.title}</h4>
                      {notif.target_role === 'all' && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                          Todos
                        </span>
                      )}
                      {notif.target_role === 'super_admin' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full flex items-center">
                          <Shield className="w-3 h-3 mr-1" />
                          Super Admins
                        </span>
                      )}
                      {notif.target_role === 'institution' && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          Instituição
                        </span>
                      )}
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          notif.read
                            ? 'bg-gray-100 text-gray-600'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {notif.read ? 'Lida' : 'Não Lida'}
                      </span>
                    </div>
                    <p className="text-gray-600 mb-3">{notif.message}</p>
                    <p className="text-sm text-gray-400 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {new Date(notif.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteNotification(notif.id)}
                    className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {notifications.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Nenhuma notificação enviada</p>
            </div>
          )}
        </div>

        {/* Modal: Nova Notificação */}
        {showNewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  Enviar Notificação
                </h3>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Título *
                  </label>
                  <input
                    type="text"
                    required
                    value={newNotification.title}
                    onChange={(e) =>
                      setNewNotification({ ...newNotification, title: e.target.value })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    placeholder="Título da notificação"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mensagem *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={newNotification.message}
                    onChange={(e) =>
                      setNewNotification({
                        ...newNotification,
                        message: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
                    placeholder="Escreva sua mensagem aqui..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Enviar Para *
                  </label>
                  <select
                    value={newNotification.target}
                    onChange={(e) =>
                      setNewNotification({
                        ...newNotification,
                        target: e.target.value,
                        institution_id: '',
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                  >
                    <option value="all">Todos os Usuários</option>
                    <option value="super_admin">Apenas Super Admins</option>
                    <option value="institution">Instituição Específica</option>
                  </select>
                </div>
                {newNotification.target === 'institution' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Selecionar Instituição *
                    </label>
                    <select
                      required
                      value={newNotification.institution_id}
                      onChange={(e) =>
                        setNewNotification({
                          ...newNotification,
                          institution_id: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none"
                    >
                      <option value="">Selecione uma instituição</option>
                      {institutions.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  type="submit"
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:shadow-xl transition-all font-semibold"
                >
                  <Send className="h-5 w-5" />
                  <span>Enviar Notificação</span>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
