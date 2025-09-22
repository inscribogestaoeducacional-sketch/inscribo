import React, { useState, useEffect } from 'react'
import { Calendar, Clock, User, Plus, Edit, Eye, MapPin, Phone, Mail, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react'
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

interface NewVisitModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Visit>) => void
  editingVisit?: Visit | null
  leads: Lead[]
}

function NewVisitModal({ isOpen, onClose, onSave, editingVisit, leads }: NewVisitModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_date: '',
    scheduled_time: '',
    student_name: '',
    notes: '',
    visitor_phone: '',
    visitor_email: ''
  })

  useEffect(() => {
    if (editingVisit) {
      const dateTime = new Date(editingVisit.scheduled_date)
      setFormData({
        lead_id: editingVisit.lead_id || '',
        scheduled_date: dateTime.toISOString().slice(0, 10),
        scheduled_time: dateTime.toTimeString().slice(0, 5),
        student_name: editingVisit.student_name || '',
        notes: editingVisit.notes || '',
        visitor_phone: '',
        visitor_email: ''
      })
    } else {
      setFormData({
        lead_id: '',
        scheduled_date: '',
        scheduled_time: '',
        student_name: '',
        notes: '',
        visitor_phone: '',
        visitor_email: ''
      })
    }
    setCurrentStep(1)
  }, [editingVisit, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validação dos campos obrigatórios
    if (!formData.scheduled_date || !formData.scheduled_time) {
      alert('Data e horário são obrigatórios!')
      return
    }
    
    if (!formData.lead_id && !formData.student_name) {
      alert('Selecione um lead ou informe o nome do visitante!')
      return
    }
    
    const scheduledDateTime = `${formData.scheduled_date}T${formData.scheduled_time}:00.000Z`
    
    const visitData = {
      scheduled_date: scheduledDateTime,
      lead_id: formData.lead_id || null,
      student_name: formData.student_name || null,
      notes: formData.notes || '',
      status: 'scheduled' as const
    }
    
    console.log('💾 Salvando visita:', visitData)
    onSave(visitData)
  }

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1)
  }

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-gray-900">{editingVisit ? 'Editar Visita' : 'Agendar Nova Visita'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-full">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-10">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === currentStep 
                  ? 'bg-blue-600 text-white shadow-lg scale-110' 
                  : step < currentStep 
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-20 h-1 mx-4 rounded-full transition-all ${
                  step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            {currentStep === 1 && 'Selecionar Lead ou Visitante'}
            {currentStep === 2 && 'Data e Horário'}
            {currentStep === 3 && 'Informações Adicionais'}
          </h3>
          <p className="text-gray-600">
            {currentStep === 1 && 'Escolha um lead existente ou cadastre um visitante avulso'}
            {currentStep === 2 && 'Defina quando a visita acontecerá'}
            {currentStep === 3 && 'Adicione observações e detalhes importantes'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Step 1: Lead Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Lead Existente (opcional)
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => {
                    const selectedLead = leads.find(lead => lead.id === e.target.value)
                    setFormData({ 
                      ...formData, 
                      lead_id: e.target.value,
                      student_name: selectedLead ? selectedLead.student_name : formData.student_name,
                      visitor_phone: selectedLead ? selectedLead.phone || '' : formData.visitor_phone,
                      visitor_email: selectedLead ? selectedLead.email || '' : formData.visitor_email
                    })
                  }}
                  className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                >
                  <option value="">Visita avulsa (sem lead)</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.student_name} - {lead.responsible_name} ({lead.phone})
                    </option>
                  ))}
                </select>
              </div>

              {!formData.lead_id && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Nome do Visitante *
                    </label>
                    <input
                      type="text"
                      required={!formData.lead_id}
                      value={formData.student_name}
                      onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                      className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="Nome completo do visitante"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Telefone
                    </label>
                    <input
                      type="tel"
                      value={formData.visitor_phone}
                      onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                      className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Date and Time */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Data da Visita *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Horário *
                  </label>
                  <select
                    required
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg"
                  >
                    <option value="">Selecione o horário</option>
                    {timeSlots.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                </div>
              </div>

              {formData.scheduled_date && formData.scheduled_time && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
                  <div className="flex items-center">
                    <Calendar className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <p className="font-semibold text-blue-900">Visita Agendada Para:</p>
                      <p className="text-blue-700">
                        {new Date(formData.scheduled_date).toLocaleDateString('pt-BR', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })} às {formData.scheduled_time}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Additional Info */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Observações e Notas
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-4 border border-gray-300 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  rows={6}
                  placeholder="Informações importantes sobre a visita, preparativos necessários, etc."
                />
              </div>

              {/* Summary */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-2xl p-6">
                <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                  <Eye className="h-5 w-5 mr-2 text-green-600" />
                  Resumo da Visita
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Visitante:</span>
                    <p className="text-gray-900">{formData.student_name || 'Não informado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Data:</span>
                    <p className="text-gray-900">
                      {formData.scheduled_date ? new Date(formData.scheduled_date).toLocaleDateString('pt-BR') : 'Não selecionada'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Horário:</span>
                    <p className="text-gray-900">{formData.scheduled_time || 'Não selecionado'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Tipo:</span>
                    <p className="text-gray-900">{formData.lead_id ? 'Lead existente' : 'Visita avulsa'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-8 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <button 
                  type="button"
                  onClick={prevStep}
                  className="px-8 py-4 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 transition-all font-medium flex items-center"
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Anterior
                </button>
              )}
            </div>
            <div className="space-x-4">
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-4 border border-gray-300 rounded-2xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
              >
                Cancelar
              </button>
              {currentStep < 3 ? (
                <button 
                  type="button"
                  onClick={nextStep}
                  className="px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all font-medium shadow-lg flex items-center"
                >
                  Próximo
                  <ChevronRight className="h-4 w-4 ml-2" />
                </button>
              ) : (
                <button 
                  type="submit"
                  className="px-8 py-4 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition-all font-medium shadow-lg flex items-center"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  {editingVisit ? 'Atualizar' : 'Agendar'} Visita
                </button>
              )}
            </div>
          </div>
        </form>
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
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

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
      setLeads(leadsData.filter(lead => lead.status !== 'enrolled' && lead.status !== 'lost'))
      setUsers(usersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (data: Partial<Visit>) => {
    try {
      console.log('🔄 Iniciando salvamento da visita:', data)
      
      const visitData = {
        ...data,
        institution_id: user!.institution_id!
      }

      console.log('📝 Dados finais para salvar:', visitData)

      if (editingVisit) {
        console.log('✏️ Atualizando visita existente:', editingVisit.id)
        await DatabaseService.updateVisit(editingVisit.id, visitData)
      } else {
        console.log('➕ Criando nova visita')
        await DatabaseService.createVisit(visitData)
      }

      console.log('✅ Visita salva com sucesso!')
      await loadData()
      setShowForm(false)
      setEditingVisit(null)
    } catch (error) {
      console.error('❌ Erro ao salvar visita:', error)
      alert('Erro ao salvar visita: ' + (error as Error).message)
    }
  }

  const handleEdit = (visit: Visit) => {
    setEditingVisit(visit)
    setShowForm(true)
  }

  const handleStatusChange = async (visitId: string, newStatus: Visit['status']) => {
    try {
      await DatabaseService.updateVisit(visitId, { status: newStatus })
      await loadData()
    } catch (error) {
      console.error('Error updating visit status:', error)
    }
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
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    
    // Add all days of the month
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gradient-to-br from-blue-50 via-white to-indigo-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Calendário de Visitas</h1>
            <p className="text-gray-600 text-lg">Gerencie e acompanhe todas as visitas agendadas</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-2xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-1"
          >
            <Plus className="h-5 w-5 mr-2" />
            Agendar Visita
          </button>
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

        {/* Controls */}
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Calendário
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-6 py-3 rounded-xl font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Filter className="h-4 w-4 inline mr-2" />
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
                className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            >
              <option value="">Todos os status</option>
              {Object.entries(statusConfig).map(([status, config]) => (
                <option key={status} value={status}>{config.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Calendar Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <h2 className="text-2xl font-bold">
                {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            {/* Days of week header */}
            <div className="grid grid-cols-7 gap-4 mb-4">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                <div key={day} className="text-center font-semibold text-gray-600 py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-4">
              {getDaysInMonth(currentDate).map((date, index) => {
                if (!date) {
                  return <div key={index} className="h-24"></div>
                }

                const dayVisits = getVisitsForDate(date)
                const isToday = date.toDateString() === new Date().toDateString()

                return (
                  <div
                    key={index}
                    className={`h-24 border rounded-xl p-2 transition-all hover:shadow-md ${
                      isToday 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isToday ? 'text-blue-600' : 'text-gray-700'
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayVisits.slice(0, 2).map(visit => (
                        <div
                          key={visit.id}
                          className={`text-xs px-2 py-1 rounded-lg truncate ${
                            statusConfig[visit.status].bgColor
                          } ${statusConfig[visit.status].textColor}`}
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

      {/* List View */}
      {viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(statusConfig).map(([status, config]) => {
            const statusVisits = getVisitsByStatus(status as Visit['status'])
            
            return (
              <div key={status} className={`${config.bgColor} rounded-3xl p-6 min-h-96 ${config.borderColor} border-2`}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full ${config.color} mr-3`}></div>
                    <h3 className={`font-bold text-lg ${config.textColor}`}>{config.label}</h3>
                  </div>
                  <span className={`${config.color} text-white text-sm px-3 py-1 rounded-full font-medium`}>
                    {statusVisits.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {statusVisits.map((visit) => (
                    <div
                      key={visit.id}
                      className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                          {visit.student_name || 'Visitante'}
                        </h4>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(visit)
                            }}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Editar visita"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
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

                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <select
                          value={visit.status}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleStatusChange(visit.id, e.target.value as Visit['status'])
                          }}
                          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          onClick={(e) => e.stopPropagation()}
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

                  {statusVisits.length === 0 && (
                    <div className="text-center py-8">
                      <div className={`w-12 h-12 ${config.color} rounded-full flex items-center justify-center mx-auto mb-3 opacity-20`}>
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm text-gray-500">Nenhuma visita neste status</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <NewVisitModal
        isOpen={showForm}
        onClose={() => {
          setShowForm(false)
          setEditingVisit(null)
        }}
        onSave={handleSubmit}
        editingVisit={editingVisit}
        leads={leads}
      />
    </div>
  )
}