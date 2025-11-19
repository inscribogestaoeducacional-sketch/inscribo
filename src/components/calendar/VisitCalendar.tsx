import React, { useState, useEffect } from 'react'
import { Calendar, Clock, User, Plus, Edit, Eye, MapPin, Phone, Mail, ChevronLeft, ChevronRight, Filter, Search, X, Flame, Snowflake, Sun, MessageSquare, Check, AlertCircle, Save, Trash2, DollarSign, Tag, Users as UsersIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Visit, Lead, User as AppUser } from '../../lib/supabase'

const statusConfig = {
  scheduled: { label: 'Agendada', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  completed: { label: 'Realizada', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' },
  no_show: { label: 'Não Compareceu', color: 'bg-gray-500', bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-200' }
}

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
]

interface VisitDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  visit: Visit
  lead: Lead | null
  onStatusChange: (visitId: string, status: Visit['status'], temperature?: 'hot' | 'warm' | 'cold') => void
  onUpdateVisit: (visitId: string, data: { scheduled_date: string; notes: string }) => void
  onDeleteVisit: (visitId: string) => void
}

function VisitDetailsModal({ isOpen, onClose, visit, lead, onStatusChange, onUpdateVisit, onDeleteVisit }: VisitDetailsModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<Visit['status']>(visit.status)
  const [selectedTemperature, setSelectedTemperature] = useState<'hot' | 'warm' | 'cold' | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')

  useEffect(() => {
    if (visit) {
      const dateTime = new Date(visit.scheduled_date)
      setEditDate(dateTime.toISOString().split('T')[0])
      setEditTime(dateTime.toTimeString().slice(0, 5))
      setEditNotes(visit.notes || '')
      setSelectedStatus(visit.status)
    }
  }, [visit])

  if (!isOpen) return null

  const handleComplete = () => {
    if (selectedStatus === 'completed' && !selectedTemperature) {
      alert('Por favor, selecione a temperatura do lead!')
      return
    }
    onStatusChange(visit.id, selectedStatus, selectedTemperature || undefined)
    onClose()
  }

  const handleSaveEdit = () => {
    if (!editDate || !editTime) {
      alert('Data e horário são obrigatórios!')
      return
    }
    
    const scheduledDateTime = `${editDate}T${editTime}:00.000Z`
    onUpdateVisit(visit.id, {
      scheduled_date: scheduledDateTime,
      notes: editNotes
    })
    setIsEditing(false)
  }

  const handleDelete = () => {
    if (confirm('Tem certeza que deseja excluir esta visita?\n\nEsta ação não pode ser desfeita.')) {
      onDeleteVisit(visit.id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">📋 Detalhes da Visita</h2>
            {lead && (
              <p className="text-gray-600">Lead: <span className="font-semibold">{lead.student_name}</span></p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Seção de Edição da Visita */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border-2 border-blue-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-[#00D4C4]" />
              Informações da Visita
            </h3>
            {!isEditing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-xl transition-all"
                  title="Editar visita"
                >
                  <Edit className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDelete}
                  className="text-red-600 hover:text-red-700 p-2 hover:bg-red-100 rounded-xl transition-all"
                  title="Excluir visita"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Data da Visita *</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Horário *</label>
                  <select
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                  >
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-6 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-6 py-3 bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white rounded-xl hover:from-[#00B8AA] hover:to-[#252F7E] transition-all flex items-center font-medium shadow-lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  Salvar Alterações
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-100">
                <span className="font-semibold text-gray-700 flex items-center mb-2">
                  <User className="w-4 h-4 mr-1" />
                  Visitante:
                </span>
                <p className="text-gray-900">{visit.student_name || 'Não informado'}</p>
              </div>
              <div className="bg-white p-4 rounded-xl border-2 border-gray-100">
                <span className="font-semibold text-gray-700 flex items-center mb-2">
                  <Calendar className="w-4 h-4 mr-1" />
                  Data/Hora:
                </span>
                <p className="text-gray-900">
                  {new Date(visit.scheduled_date).toLocaleString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              {visit.notes && (
                <div className="md:col-span-2 p-4 bg-white rounded-xl border-2 border-gray-100">
                  <span className="font-semibold text-gray-700 flex items-center text-sm mb-2">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Observações:
                  </span>
                  <p className="text-gray-700 text-sm">{visit.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Informações Completas do Lead */}
        {lead && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-6 mb-8 border-2 border-green-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <User className="w-6 h-6 mr-2 text-green-600" />
              Informações Completas do Lead
            </h3>
            
            {/* Dados do Aluno */}
            <div className="mb-6">
              <h4 className="font-bold text-gray-900 mb-4 text-lg border-b-2 border-green-200 pb-3">
                👨‍🎓 Dados do Aluno
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700">Nome do Aluno:</span>
                  <p className="text-gray-900 text-base mt-1">{lead.student_name}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700">Série/Ano de Interesse:</span>
                  <p className="text-gray-900 text-base mt-1">{lead.grade_interest}</p>
                </div>
                {lead.cpf && (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                    <span className="font-semibold text-gray-700">CPF:</span>
                    <p className="text-gray-900 text-base mt-1">{lead.cpf}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dados do Responsável */}
            <div className="mb-6">
              <h4 className="font-bold text-gray-900 mb-4 text-lg border-b-2 border-green-200 pb-3">
                👥 Dados do Responsável
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700">Nome do Responsável:</span>
                  <p className="text-gray-900 text-base mt-1">{lead.responsible_name}</p>
                </div>
                {lead.phone && (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                    <span className="font-semibold text-gray-700 flex items-center">
                      <Phone className="w-4 h-4 mr-1" />
                      Telefone:
                    </span>
                    <p className="text-gray-900 text-base mt-1">{lead.phone}</p>
                  </div>
                )}
                {lead.email && (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                    <span className="font-semibold text-gray-700 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      E-mail:
                    </span>
                    <p className="text-gray-900 text-base mt-1">{lead.email}</p>
                  </div>
                )}
                {lead.address && (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                    <span className="font-semibold text-gray-700 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      Endereço:
                    </span>
                    <p className="text-gray-900 text-base mt-1">{lead.address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Informações Adicionais */}
            <div>
              <h4 className="font-bold text-gray-900 mb-4 text-lg border-b-2 border-green-200 pb-3">
                📊 Informações Adicionais
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700 flex items-center">
                    <Tag className="w-4 h-4 mr-1" />
                    Origem:
                  </span>
                  <p className="text-gray-900 text-base mt-1">{lead.source}</p>
                </div>
                {lead.budget_range && (
                  <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                    <span className="font-semibold text-gray-700 flex items-center">
                      <DollarSign className="w-4 h-4 mr-1" />
                      Faixa de Orçamento:
                    </span>
                    <p className="text-gray-900 text-base mt-1">{lead.budget_range}</p>
                  </div>
                )}
                <div className="bg-white p-4 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Data de Criação:
                  </span>
                  <p className="text-gray-900 text-base mt-1">
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              
              {lead.notes && (
                <div className="mt-4 bg-white p-5 rounded-xl border-2 border-green-50">
                  <span className="font-semibold text-gray-700 flex items-center mb-2">
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Observações do Lead:
                  </span>
                  <p className="text-gray-700 text-base leading-relaxed">{lead.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Atualizar Status da Visita */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-8 border-2 border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <Check className="w-6 h-6 mr-2 text-[#00D4C4]" />
            Atualizar Status da Visita
          </h3>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Status da Visita
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as Visit['status'])}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
              >
                {Object.entries(statusConfig).map(([value, config]) => (
                  <option key={value} value={value}>{config.label}</option>
                ))}
              </select>
            </div>

            {/* Temperatura do lead após visita */}
            {selectedStatus === 'completed' && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-4">
                  🌡️ Como o lead ficou após a visita? *
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => setSelectedTemperature('hot')}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      selectedTemperature === 'hot'
                        ? 'border-red-500 bg-red-50 shadow-lg'
                        : 'border-gray-300 hover:border-red-300'
                    }`}
                  >
                    <Flame className={`w-10 h-10 mx-auto mb-3 ${
                      selectedTemperature === 'hot' ? 'text-red-500' : 'text-gray-400'
                    }`} />
                    <p className="text-sm font-bold text-center">🔥 Quente</p>
                    <p className="text-xs text-gray-600 text-center mt-2">Muito interessado</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemperature('warm')}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      selectedTemperature === 'warm'
                        ? 'border-yellow-500 bg-yellow-50 shadow-lg'
                        : 'border-gray-300 hover:border-yellow-300'
                    }`}
                  >
                    <Sun className={`w-10 h-10 mx-auto mb-3 ${
                      selectedTemperature === 'warm' ? 'text-yellow-500' : 'text-gray-400'
                    }`} />
                    <p className="text-sm font-bold text-center">☀️ Morno</p>
                    <p className="text-xs text-gray-600 text-center mt-2">Interesse moderado</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTemperature('cold')}
                    className={`p-5 rounded-2xl border-2 transition-all ${
                      selectedTemperature === 'cold'
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <Snowflake className={`w-10 h-10 mx-auto mb-3 ${
                      selectedTemperature === 'cold' ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <p className="text-sm font-bold text-center">❄️ Frio</p>
                    <p className="text-xs text-gray-600 text-center mt-2">Pouco interessado</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex justify-end gap-4 pt-6 border-t-2 border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleComplete}
            className="px-8 py-3 bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white rounded-xl hover:from-[#00B8AA] hover:to-[#252F7E] transition-all font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1 flex items-center"
          >
            <Check className="h-5 w-5 mr-2" />
            Salvar Status
          </button>
        </div>
      </div>
    </div>
  )
}

export default function VisitCalendar() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<Visit[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [visitsData, leadsData, usersData] = await Promise.all([
        DatabaseService.getVisits(user!.institution_id!),
        DatabaseService.getLeads(user!.institution_id!),
        DatabaseService.getUsers(user!.institution_id!)
      ])
      setVisits(visitsData)
      setLeads(leadsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (visitId: string, newStatus: Visit['status'], temperature?: 'hot' | 'warm' | 'cold') => {
    try {
      await DatabaseService.updateVisit(visitId, { status: newStatus })
      
      const visit = visits.find(v => v.id === visitId)
      
      if (newStatus === 'completed' && visit && visit.lead_id) {
        await DatabaseService.updateLead(visit.lead_id, { 
          status: 'visit',
          temperature: temperature || null
        })
        
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'Visita realizada',
          entity_type: 'lead',
          entity_id: visit.lead_id,
          details: {
            visit_id: visitId,
            temperature: temperature,
            temperature_label: temperature === 'hot' ? 'Quente 🔥' : temperature === 'warm' ? 'Morno ☀️' : 'Frio ❄️',
            notes: `Lead ficou ${temperature === 'hot' ? 'muito interessado' : temperature === 'warm' ? 'moderadamente interessado' : 'pouco interessado'} após a visita. Status atualizado para "Visita".`
          },
          institution_id: user!.institution_id
        })
      }
      
      await loadData()
      setShowDetailsModal(false)
      setSelectedVisit(null)
    } catch (error) {
      console.error('Error updating visit status:', error)
    }
  }

  const handleUpdateVisit = async (visitId: string, data: { scheduled_date: string; notes: string }) => {
    try {
      const [datePart, timePart] = data.scheduled_date.split('T')
      const [year, month, day] = datePart.split('-')
      const [hours, minutes] = timePart.split(':')
      
      const visitDate = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        0,
        0
      )
      
      await DatabaseService.updateVisit(visitId, {
        scheduled_date: visitDate.toISOString(),
        notes: data.notes
      })
      await loadData()
      alert('Visita atualizada com sucesso!')
    } catch (error) {
      console.error('Error updating visit:', error)
      alert('Erro ao atualizar visita')
    }
  }

  const handleDeleteVisit = async (visitId: string) => {
    try {
      await DatabaseService.deleteVisit(visitId)
      await loadData()
      alert('Visita excluída com sucesso!')
    } catch (error) {
      console.error('Error deleting visit:', error)
      alert('Erro ao excluir visita')
    }
  }

  const handleVisitClick = (visit: Visit) => {
    setSelectedVisit(visit)
    setShowDetailsModal(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getVisitsByStatus = (status: Visit['status']) => {
    return visits.filter(visit => {
      const matchesStatus = visit.status === status
      const matchesSearch = searchTerm === '' || 
        (visit.student_name && visit.student_name.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesFilter = filterStatus === '' || visit.status === filterStatus
      
      return matchesStatus && matchesSearch && matchesFilter
    })
  }

  const getVisitsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0]
    return visits.filter(visit => visit.scheduled_date.startsWith(dateStr))
  }

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day))
    }
    
    return days
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1)
      } else {
        newDate.setMonth(prev.getMonth() + 1)
      }
      return newDate
    })
  }

  const getVisitStats = () => {
    const today = new Date().toISOString().split('T')[0]
    const thisWeek = new Date()
    thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay())
    const thisWeekStr = thisWeek.toISOString().split('T')[0]

    const todayVisits = visits.filter(v => v.scheduled_date.startsWith(today)).length
    const weekVisits = visits.filter(v => v.scheduled_date >= thisWeekStr).length
    const completedVisits = visits.filter(v => v.status === 'completed').length
    const scheduledVisits = visits.filter(v => v.status === 'scheduled').length

    return { todayVisits, weekVisits, completedVisits, scheduledVisits }
  }

  const stats = getVisitStats()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00D4C4] border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Carregando visitas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center">
              <Calendar className="w-10 h-10 text-[#00D4C4] mr-4" />
              Calendário de Visitas
            </h1>
            <p className="text-gray-600 text-lg">Gerencie e acompanhe todas as visitas agendadas</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Visitas Hoje</p>
                <p className="text-3xl font-bold text-blue-600">{stats.todayVisits}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Esta Semana</p>
                <p className="text-3xl font-bold text-green-600">{stats.weekVisits}</p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Realizadas</p>
                <p className="text-3xl font-bold text-purple-600">{stats.completedVisits}</p>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Agendadas</p>
                <p className="text-3xl font-bold text-orange-600">{stats.scheduledVisits}</p>
              </div>
              <User className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-6 py-3 rounded-xl font-medium transition-all shadow-lg ${
                viewMode === 'calendar'
                  ? 'bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
              }`}
            >
              <Calendar className="h-5 w-5 inline mr-2" />
              Calendário
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-6 py-3 rounded-xl font-medium transition-all shadow-lg ${
                viewMode === 'list'
                  ? 'bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
              }`}
            >
              <Filter className="h-5 w-5 inline mr-2" />
              Lista
            </button>
          </div>

          <div className="flex gap-4 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Buscar por nome do visitante..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 w-full border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-[#00D4C4] focus:border-[#00D4C4] transition-all"
            >
              <option value="">Todos os status</option>
              {Object.entries(statusConfig).map(([status, config]) => (
                <option key={status} value={status}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' && (
        <div className="bg-white rounded-3xl shadow-lg border-2 border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#00D4C4] to-[#2D3E9E] text-white p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-3 hover:bg-white hover:bg-opacity-20 rounded-2xl transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <h2 className="text-2xl font-bold">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                className="p-3 hover:bg-white hover:bg-opacity-20 rounded-2xl transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-7 gap-4 mb-4">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 py-3">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-4">
              {getDaysInMonth(currentDate).map((date, index) => {
                if (!date) {
                  return <div key={index} className="h-28"></div>
                }

                const dayVisits = getVisitsForDate(date)
                const isToday = date.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={index}
                    className={`h-28 border-2 rounded-2xl p-3 transition-all hover:shadow-lg ${
                      isToday 
                        ? 'bg-blue-50 border-blue-300' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-2 ${
                      isToday ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayVisits.slice(0, 2).map(visit => (
                        <div
                          key={visit.id}
                          onClick={() => handleVisitClick(visit)}
                          className={`text-xs px-2 py-1 rounded-lg truncate cursor-pointer hover:opacity-75 transition-all ${
                            statusConfig[visit.status].bgColor
                          } ${statusConfig[visit.status].textColor} border ${statusConfig[visit.status].borderColor}`}
                        >
                          {formatTime(visit.scheduled_date)} - {visit.student_name}
                        </div>
                      ))}
                      {dayVisits.length > 2 && (
                        <div className="text-xs text-gray-500 px-2">
                          +{dayVisits.length - 2} mais
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(statusConfig).map(([status, config]) => {
            const statusVisits = getVisitsByStatus(status as Visit['status'])
            
            return (
              <div key={status} className={`${config.bgColor} rounded-3xl p-6 min-h-96 ${config.borderColor} border-2 shadow-lg`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full ${config.color} mr-3 shadow-sm`}></div>
                    <h3 className={`font-bold text-lg ${config.textColor}`}>{config.label}</h3>
                  </div>
                  <span className={`${config.color} text-white text-sm px-4 py-1 rounded-full font-medium shadow-lg`}>
                    {statusVisits.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {statusVisits.map((visit) => (
                    <div
                      key={visit.id}
                      onClick={() => handleVisitClick(visit)}
                      className="bg-white p-5 rounded-2xl shadow-sm border-2 border-gray-100 hover:shadow-lg transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-semibold text-gray-900 text-sm group-hover:text-[#00D4C4] transition-colors">
                          {visit.student_name || 'Visitante'}
                        </h4>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-xs text-gray-600 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(visit.scheduled_date)}
                        </p>
                        {visit.notes && (
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {visit.notes}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t-2 border-gray-100">
                        <span className={`text-xs px-3 py-1 rounded-full font-medium border-2 ${config.bgColor} ${config.textColor} ${config.borderColor}`}>
                          {config.label}
                        </span>
                      </div>
                    </div>
                  ))}

                  {statusVisits.length === 0 && (
                    <div className="text-center py-12">
                      <div className={`w-16 h-16 ${config.color} rounded-full flex items-center justify-center mx-auto mb-4 opacity-20 shadow-lg`}>
                        <Calendar className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-sm text-gray-500 font-medium">Nenhuma visita neste status</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showDetailsModal && selectedVisit && (
        <VisitDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false)
            setSelectedVisit(null)
          }}
          visit={selectedVisit}
          lead={leads.find(l => l.id === selectedVisit.lead_id) || null}
          onStatusChange={handleStatusChange}
          onUpdateVisit={handleUpdateVisit}
          onDeleteVisit={handleDeleteVisit}
        />
      )}
    </div>
  )
}
