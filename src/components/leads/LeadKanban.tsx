import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Phone, Mail, Calendar, User, MapPin, DollarSign, Clock, MessageSquare, Search, Filter, X, CheckCircle, AlertCircle, Eye, FileText, History, GripVertical } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead, ActivityLog } from '../../lib/supabase'

const statusConfig = {
  new: { 
    label: 'Novo', 
    color: 'bg-blue-500', 
    bgColor: 'bg-blue-50', 
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    count: 0
  },
  contact: { 
    label: 'Contato', 
    color: 'bg-yellow-500', 
    bgColor: 'bg-yellow-50', 
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    count: 0
  },
  scheduled: { 
    label: 'Agendado', 
    color: 'bg-purple-500', 
    bgColor: 'bg-purple-50', 
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    count: 0
  },
  visit: { 
    label: 'Visita', 
    color: 'bg-orange-500', 
    bgColor: 'bg-orange-50', 
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    count: 0
  },
  proposal: { 
    label: 'Proposta', 
    color: 'bg-indigo-500', 
    bgColor: 'bg-indigo-50', 
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    count: 0
  },
  enrolled: { 
    label: 'Matriculado', 
    color: 'bg-green-500', 
    bgColor: 'bg-green-50', 
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    count: 0
  },
  lost: { 
    label: 'Perdido', 
    color: 'bg-red-500', 
    bgColor: 'bg-red-50', 
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    count: 0
  }
}

const gradeOptions = [
  'Berçário', 'Maternal I', 'Maternal II', 'Jardim I', 'Jardim II', 'Pré I', 'Pré II',
  '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
  '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
  '1º Ano EM', '2º Ano EM', '3º Ano EM',
  'Curso Técnico', 'Pré-Vestibular', 'EJA', 'Curso Livre', 'Graduação', 'Pós-Graduação'
]

const sourceOptions = [
  'Facebook', 'Instagram', 'Google Ads', 'Site', 'Indicação', 'WhatsApp',
  'Panfleto', 'Outdoor', 'Rádio', 'TV', 'Jornal', 'Revista',
  'Evento', 'Feira', 'Parceria', 'Telemarketing', 'Outros'
]

const budgetRanges = [
  'Até R$ 500',
  'R$ 500 - R$ 1.000',
  'R$ 1.000 - R$ 2.000',
  'R$ 2.000 - R$ 3.000',
  'Acima de R$ 3.000'
]

const periods = [
  'Manhã',
  'Tarde', 
  'Noite',
  'Integral'
]

interface LeadDetailsModalProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onEdit: (lead: Lead) => void
}

function LeadDetailsModal({ lead, isOpen, onClose, onEdit }: LeadDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('details')
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (isOpen && lead) {
      loadActivities()
    }
  }, [isOpen, lead])

  const loadActivities = async () => {
    if (!lead || !user?.institution_id) return
    
    try {
      setLoadingActivities(true)
      const data = await DatabaseService.getActivityLogs(user.institution_id, lead.id)
      setActivities(data)
    } catch (error) {
      console.error('Error loading activities:', error)
    } finally {
      setLoadingActivities(false)
    }
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'created': return <Plus className="w-4 h-4 text-green-600" />
      case 'updated': return <Edit className="w-4 h-4 text-blue-600" />
      case 'status_changed': return <CheckCircle className="w-4 h-4 text-purple-600" />
      case 'deleted': return <Trash2 className="w-4 h-4 text-red-600" />
      default: return <History className="w-4 h-4 text-gray-600" />
    }
  }

  const formatActivityDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (!isOpen || !lead) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{lead.student_name}</h2>
              <p className="text-blue-100">Responsável: {lead.responsible_name}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(lead)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Detalhes
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <History className="h-4 w-4 inline mr-2" />
              Histórico ({activities.length})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Student Info */}
              <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações do Aluno
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nome do Aluno</label>
                    <p className="text-gray-900 font-medium">{lead.student_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Série/Ano</label>
                    <p className="text-gray-900">{lead.grade_interest}</p>
                  </div>
                  {lead.cpf && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">CPF</label>
                      <p className="text-gray-900">{lead.cpf}</p>
                    </div>
                  )}
                  {lead.preferred_period && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Período Preferido</label>
                      <p className="text-gray-900">{lead.preferred_period}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Responsible Info */}
              <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Informações do Responsável
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Nome</label>
                    <p className="text-gray-900 font-medium">{lead.responsible_name}</p>
                  </div>
                  {lead.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Telefone</label>
                      <p className="text-gray-900">{lead.phone}</p>
                    </div>
                  )}
                  {lead.whatsapp && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">WhatsApp</label>
                      <p className="text-gray-900">{lead.whatsapp}</p>
                    </div>
                  )}
                  {lead.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">E-mail</label>
                      <p className="text-gray-900">{lead.email}</p>
                    </div>
                  )}
                  {lead.address && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Endereço</label>
                      <p className="text-gray-900">{lead.address}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Commercial Info */}
              <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Informações Comerciais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Origem</label>
                    <p className="text-gray-900">{lead.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${statusConfig[lead.status].bgColor} ${statusConfig[lead.status].textColor}`}>
                      {statusConfig[lead.status].label}
                    </span>
                  </div>
                  {lead.budget_range && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Faixa de Orçamento</label>
                      <p className="text-gray-900">{lead.budget_range}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-600">Data de Criação</label>
                    <p className="text-gray-900">{new Date(lead.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  {lead.notes && (
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-gray-600">Observações</label>
                      <p className="text-gray-900">{lead.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {loadingActivities ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : activities.length > 0 ? (
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {getActivityIcon(activity.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {activity.action === 'created' && 'Lead criado'}
                            {activity.action === 'updated' && 'Lead atualizado'}
                            {activity.action === 'status_changed' && `Status alterado para ${statusConfig[activity.details?.new_status as keyof typeof statusConfig]?.label || activity.details?.new_status}`}
                            {activity.action === 'deleted' && 'Lead excluído'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatActivityDate(activity.created_at)}
                          </p>
                        </div>
                        {activity.details && (
                          <div className="mt-1">
                            {activity.details.lead_name && (
                              <p className="text-sm text-gray-600">
                                Lead: {activity.details.lead_name}
                              </p>
                            )}
                            {activity.details.source && (
                              <p className="text-sm text-gray-600">
                                Origem: {activity.details.source}
                              </p>
                            )}
                            {activity.details.reason && (
                              <p className="text-sm text-gray-600">
                                Motivo: {activity.details.reason}
                              </p>
                            )}
                            {activity.details.changed_by && (
                              <p className="text-sm text-gray-600">
                                Por: {activity.details.changed_by}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Nenhuma atividade registrada</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [formStep, setFormStep] = useState(1)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [formData, setFormData] = useState({
    student_name: '',
    responsible_name: '',
    phone: '',
    email: '',
    grade_interest: '',
    source: '',
    cpf: '',
    whatsapp: '',
    address: '',
    budget_range: '',
    preferred_period: '',
    notes: '',
    schedule_visit: false,
    visit_date: '',
    visit_time: ''
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadLeads()
    }
  }, [user])

  useEffect(() => {
    filterLeads()
  }, [leads, searchTerm, filterSource, filterGrade])

  const loadLeads = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getLeads(user!.institution_id!)
      setLeads(data)
    } catch (error) {
      console.error('Error loading leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterLeads = () => {
    let filtered = leads

    if (searchTerm) {
      filtered = filtered.filter(lead => 
        lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.phone?.includes(searchTerm) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterSource) {
      filtered = filtered.filter(lead => lead.source === filterSource)
    }

    if (filterGrade) {
      filtered = filtered.filter(lead => lead.grade_interest === filterGrade)
    }

    setFilteredLeads(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Validate all required fields before saving
      if (!formData.student_name.trim()) {
        setError('Nome do aluno é obrigatório')
        setLoading(false)
        return
      }
      if (!formData.responsible_name.trim()) {
        setError('Nome do responsável é obrigatório')
        setLoading(false)
        return
      }
      if (!formData.phone.trim()) {
        setError('Telefone é obrigatório')
        setLoading(false)
        return
      }
      if (!formData.grade_interest.trim()) {
        setError('Série/Ano de interesse é obrigatório')
        setLoading(false)
        return
      }
      if (!formData.source.trim()) {
        setError('Origem é obrigatória')
        setLoading(false)
        return
      }

      // Prepare lead data
      const leadData = {
        student_name: formData.student_name.trim(),
        responsible_name: formData.responsible_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        grade_interest: formData.grade_interest.trim(),
        source: formData.source.trim(),
        address: formData.address.trim() || null,
        budget_range: formData.budget_range.trim() || null,
        cpf: formData.cpf.trim() || null,
        notes: formData.notes.trim() || null,
        status: 'new' as const,
        institution_id: user!.institution_id!
      }

      console.log('Saving lead with data:', leadData)

      if (editingLead) {
        await DatabaseService.updateLead(editingLead.id, leadData)
        
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'updated',
          entity_type: 'lead',
          entity_id: editingLead.id,
          details: { 
            lead_name: formData.student_name, 
            changes: 'Lead atualizado',
            changed_by: user!.full_name
          },
          institution_id: user!.institution_id!
        })
      } else {
        const newLead = await DatabaseService.createLead(leadData)
        console.log('Lead created successfully:', newLead)
        // Log creation activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'created',
          entity_type: 'lead',
          entity_id: newLead.id,
          details: { 
            lead_name: formData.student_name, 
            source: formData.source,
            created_by: user!.full_name
          },
          institution_id: user!.institution_id!
        })

        if (formData.schedule_visit && formData.visit_date && formData.visit_time) {
          const visitDateTime = `${formData.visit_date}T${formData.visit_time}:00`
          await DatabaseService.createVisit({
            lead_id: newLead.id,
            scheduled_date: visitDateTime,
            status: 'scheduled',
            notes: `Visita agendada automaticamente para ${formData.student_name}`,
            institution_id: user!.institution_id!
          })
        }
      }

      await loadLeads()
      console.log('Leads reloaded successfully')
      setShowForm(false)
      setEditingLead(null)
      setFormStep(1)
      resetForm()
    } catch (err: any) {
      console.error('Error saving lead:', err)
      
      // More detailed error handling
      if (err.message?.includes('duplicate key')) {
        setError('Já existe um lead com essas informações')
      } else if (err.message?.includes('violates foreign key')) {
        setError('Erro de referência no banco de dados')
      } else if (err.message?.includes('column') && err.message?.includes('does not exist')) {
        setError('Erro de estrutura do banco de dados. Contate o suporte.')
      } else {
        setError(err.message || 'Erro ao salvar lead. Tente novamente.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleNextStep = () => {
    setError('')
    
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!formData.student_name.trim() || !formData.grade_interest.trim()) {
        setError('Nome do aluno e série/ano são obrigatórios')
        return
      }
    } else if (currentStep === 2) {
      if (!formData.responsible_name.trim() || !formData.phone.trim()) {
        setError('Nome do responsável e telefone são obrigatórios')
        return
      }
    }
    
    setCurrentStep(currentStep + 1)
  }

  const handlePrevStep = () => {
    setError('')
    setCurrentStep(currentStep - 1)
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status'], reason?: string) => {
    try {
      await DatabaseService.updateLead(leadId, { status: newStatus })
      
      await DatabaseService.logActivity({
        user_id: user!.id,
        action: 'status_changed',
        entity_type: 'lead',
        entity_id: leadId,
        details: { 
          new_status: newStatus, 
          reason: reason || 'Status alterado via kanban',
          changed_by: user!.full_name
        },
        institution_id: user!.institution_id!
      })

      await loadLeads()
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
  }

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead)
    setFormData({
      student_name: lead.student_name,
      responsible_name: lead.responsible_name,
      phone: lead.phone || '',
      email: lead.email || '',
      grade_interest: lead.grade_interest,
      source: lead.source,
      cpf: lead.cpf || '',
      whatsapp: lead.whatsapp || '',
      address: lead.address || '',
      budget_range: lead.budget_range || '',
      preferred_period: lead.preferred_period || '',
      notes: lead.notes || '',
      schedule_visit: false,
      visit_date: '',
      visit_time: ''
    })
    setFormStep(1)
    setShowForm(true)
  }

  const handleViewDetails = (lead: Lead) => {
    setSelectedLead(lead)
    setShowDetails(true)
  }

  const resetForm = () => {
    setFormData({
      student_name: '',
      responsible_name: '',
      phone: '',
      email: '',
      grade_interest: '',
      source: '',
      cpf: '',
      whatsapp: '',
      address: '',
      budget_range: '',
      preferred_period: '',
      notes: '',
      schedule_visit: false,
      visit_date: '',
      visit_time: ''
    })
  }

  const getLeadsByStatus = (status: Lead['status']) => {
    return filteredLeads.filter(lead => lead.status === status)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterSource('')
    setFilterGrade('')
    setShowFilters(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getStatusCounts = () => {
    const counts = { ...statusConfig }
    Object.keys(counts).forEach(status => {
      counts[status as keyof typeof counts].count = getLeadsByStatus(status as Lead['status']).length
    })
    return counts
  }

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: Lead['status']) => {
    e.preventDefault()
    
    if (draggedLead && draggedLead.status !== newStatus) {
      await handleStatusChange(draggedLead.id, newStatus, `Status alterado via drag & drop de ${statusConfig[draggedLead.status].label} para ${statusConfig[newStatus].label}`)
    }
    
    setDraggedLead(null)
  }

  const statusCounts = getStatusCounts()
  const totalLeads = filteredLeads.length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kanban de Leads</h1>
          <p className="text-gray-600 mt-1">Gerencie seus leads de forma visual e eficiente</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {(searchTerm || filterSource || filterGrade) && (
              <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                {[searchTerm, filterSource, filterGrade].filter(Boolean).length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filtros</h3>
            <button
              onClick={clearFilters}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Nome, telefone, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Origem
              </label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas as origens</option>
                {sourceOptions.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Série/Ano
              </label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Todas as séries</option>
                {gradeOptions.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {Object.entries(statusCounts).map(([status, config]) => (
          <div key={status} className={`${config.bgColor} ${config.borderColor} border-2 rounded-xl p-4 text-center transition-all hover:shadow-md`}>
            <div className={`w-3 h-3 rounded-full ${config.color} mx-auto mb-2`}></div>
            <div className="text-2xl font-bold text-gray-900">{config.count}</div>
            <div className={`text-sm font-medium ${config.textColor}`}>{config.label}</div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6 overflow-x-auto">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div 
            key={status} 
            className={`${config.bgColor} rounded-xl p-4 min-h-[600px] border-2 ${config.borderColor} transition-all`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status as Lead['status'])}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
              <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full font-medium">
                {getLeadsByStatus(status as Lead['status']).length}
              </span>
            </div>

            <div className="space-y-3">
              {getLeadsByStatus(status as Lead['status']).map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition-all cursor-move group relative"
                >
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                  </div>

                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors pr-6">
                      {lead.student_name}
                    </h4>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="text-gray-400 hover:text-blue-600 p-1 rounded"
                        title="Editar"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleViewDetails(lead)}
                        className="text-gray-400 hover:text-green-600 p-1 rounded"
                        title="Ver detalhes"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{lead.responsible_name}</span>
                    </div>
                    
                    {lead.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    
                    {lead.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{lead.grade_interest}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{lead.source}</span>
                    </div>

                    {lead.budget_range && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{lead.budget_range}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 text-gray-500">
                      <Clock className="w-3 h-3 flex-shrink-0" />
                      <span>{formatDate(lead.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
                      className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
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

      {/* Enhanced Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingLead ? 'Editar Lead' : 'Novo Lead'}
                </h2>
                <p className="text-gray-600 mt-1">
                  {editingLead ? 'Atualize as informações do lead' : 'Preencha os dados para criar um novo lead'}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForm(false)
                  setEditingLead(null)
                  setFormStep(1)
                  resetForm()
                }}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map((step) => (
                  <React.Fragment key={step}>
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      formStep >= step 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'border-gray-300 text-gray-400'
                    }`}>
                      {formStep > step ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{step}</span>
                      )}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 h-0.5 ${
                        formStep > step ? 'bg-blue-600' : 'bg-gray-300'
                      }`}></div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Dados do Aluno */}
              {formStep === 1 && (
                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-xl border border-blue-200">
                    <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Dados do Aluno
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome do Aluno *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.student_name}
                          onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nome completo do aluno"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Série/Ano de Interesse *
                        </label>
                        <select
                          required
                          value={formData.grade_interest}
                          onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Selecione a série</option>
                          {gradeOptions.map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CPF do Aluno
                        </label>
                        <input
                          type="text"
                          value={formData.cpf}
                          onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="000.000.000-00"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Período Preferido
                        </label>
                        <select
                          value={formData.preferred_period}
                          onChange={(e) => setFormData({ ...formData, preferred_period: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Selecione o período</option>
                          {periods.map(period => (
                            <option key={period} value={period}>{period}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Dados do Responsável */}
              {formStep === 2 && (
                <div className="space-y-6">
                  <div className="bg-green-50 p-6 rounded-xl border border-green-200">
                    <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Dados do Responsável
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Nome do Responsável *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.responsible_name}
                          onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Nome completo do responsável"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Telefone *
                        </label>
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          WhatsApp
                        </label>
                        <input
                          type="tel"
                          value={formData.whatsapp}
                          onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="(11) 99999-9999"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          E-mail
                        </label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="email@exemplo.com"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Endereço Completo
                        </label>
                        <input
                          type="text"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Rua, número, bairro, cidade"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Informações Comerciais */}
              {formStep === 3 && (
                <div className="space-y-6">
                  <div className="bg-purple-50 p-6 rounded-xl border border-purple-200">
                    <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Informações Comerciais
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Origem do Lead *
                        </label>
                        <select
                          required
                          value={formData.source}
                          onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Selecione a origem</option>
                          {sourceOptions.map(source => (
                            <option key={source} value={source}>{source}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Faixa de Orçamento
                        </label>
                        <select
                          value={formData.budget_range}
                          onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Selecione a faixa</option>
                          {budgetRanges.map(range => (
                            <option key={range} value={range}>{range}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Observações
                        </label>
                        <textarea
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={4}
                          placeholder="Informações adicionais sobre o lead..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Agendamento de Visita */}
                  {!editingLead && (
                    <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          id="schedule_visit"
                          checked={formData.schedule_visit}
                          onChange={(e) => setFormData({ ...formData, schedule_visit: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor="schedule_visit" className="font-semibold text-orange-800 flex items-center gap-2">
                          <Calendar className="w-5 h-5" />
                          Agendar Visita Automaticamente
                        </label>
                      </div>
                      
                      {formData.schedule_visit && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Data da Visita
                            </label>
                            <input
                              type="date"
                              value={formData.visit_date}
                              onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Horário da Visita
                            </label>
                            <input
                              type="time"
                              value={formData.visit_time}
                              onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 border-t border-gray-200">
                <div>
                  {formStep > 1 && (
                    <button
                      type="button"
                      onClick={handlePrevStep}
                      className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      Anterior
                    </button>
                  )}
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false)
                      setEditingLead(null)
                      setFormStep(1)
                      resetForm()
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  
                  {formStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Próximo
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          {editingLead ? 'Atualizar' : 'Criar'} Lead
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Details Modal */}
      <LeadDetailsModal
        lead={selectedLead}
        isOpen={showDetails}
        onClose={() => {
          setShowDetails(false)
          setSelectedLead(null)
        }}
        onEdit={(lead) => {
          setShowDetails(false)
          handleEdit(lead)
        }}
      />
    </div>
  )
}