import React, { useState, useEffect } from 'react'
import { Plus, Filter, User, Phone, Mail, Calendar, Edit, Trash2, X, Search, Clock, MapPin, DollarSign, Tag, Users, TrendingUp, Eye, MessageSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead, User as AppUser } from '../../lib/supabase'

const statusConfig = {
  new: { label: 'Novo', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  contact: { label: 'Contato', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  scheduled: { label: 'Agendado', color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  visit: { label: 'Visita', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  proposal: { label: 'Proposta', color: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
  enrolled: { label: 'Matriculado', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  lost: { label: 'Perdido', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' }
}

const sourceOptions = [
  'Facebook',
  'Instagram', 
  'Google',
  'Site',
  'Indicação',
  'WhatsApp',
  'Outros'
]

const gradeOptions = [
  'Educação Infantil',
  '1º Ano',
  '2º Ano', 
  '3º Ano',
  '4º Ano',
  '5º Ano',
  '6º Ano',
  '7º Ano',
  '8º Ano',
  '9º Ano',
  '1º Ano EM',
  '2º Ano EM',
  '3º Ano EM'
]

interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Lead>) => void
  editingLead?: Lead | null
}

function NewLeadModal({ isOpen, onClose, onSave, editingLead }: NewLeadModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    student_name: '',
    grade_interest: '',
    cpf: '',
    responsible_name: '',
    phone: '',
    email: '',
    address: '',
    budget_range: '',
    source: '',
    notes: ''
  })

  useEffect(() => {
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name,
        grade_interest: editingLead.grade_interest,
        cpf: editingLead.cpf || '',
        responsible_name: editingLead.responsible_name,
        phone: editingLead.phone || '',
        email: editingLead.email || '',
        address: editingLead.address || '',
        budget_range: editingLead.budget_range || '',
        source: editingLead.source,
        notes: editingLead.notes || ''
      })
    } else {
      setFormData({
        student_name: '',
        grade_interest: '',
        cpf: '',
        responsible_name: '',
        phone: '',
        email: '',
        address: '',
        budget_range: '',
        source: '',
        notes: ''
      })
    }
    setCurrentStep(1)
  }, [editingLead, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
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
      <div className="bg-white rounded-2xl p-8 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === currentStep 
                  ? 'bg-blue-600 text-white shadow-lg' 
                  : step < currentStep 
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-600'
              }`}>
                {step}
              </div>
              {step < 3 && (
                <div className={`w-16 h-1 mx-3 rounded-full transition-all ${
                  step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                }`}></div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {currentStep === 1 && 'Dados do Aluno'}
            {currentStep === 2 && 'Dados do Responsável'}
            {currentStep === 3 && 'Informações Adicionais'}
          </h3>
          <p className="text-gray-600">
            {currentStep === 1 && 'Preencha as informações básicas do aluno'}
            {currentStep === 2 && 'Dados de contato do responsável'}
            {currentStep === 3 && 'Origem e observações do lead'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Student Data */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nome do Aluno *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Nome completo do aluno"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Série/Ano de Interesse *
                  </label>
                  <select
                    required
                    value={formData.grade_interest}
                    onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Selecione a série</option>
                    {gradeOptions.map(grade => (
                      <option key={grade} value={grade}>{grade}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF do Aluno
                  </label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Responsible Data */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome do Responsável *
                </label>
                <input
                  type="text"
                  required
                  value={formData.responsible_name}
                  onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Nome completo do responsável"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefone *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Endereço
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Endereço completo"
                />
              </div>
            </div>
          )}

          {/* Step 3: Additional Info */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Faixa de Orçamento
                  </label>
                  <select
                    value={formData.budget_range}
                    onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Selecione a faixa</option>
                    <option value="Até R$ 500">Até R$ 500</option>
                    <option value="R$ 500 - R$ 1.000">R$ 500 - R$ 1.000</option>
                    <option value="R$ 1.000 - R$ 1.500">R$ 1.000 - R$ 1.500</option>
                    <option value="R$ 1.500 - R$ 2.000">R$ 1.500 - R$ 2.000</option>
                    <option value="Acima de R$ 2.000">Acima de R$ 2.000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Origem do Lead *
                  </label>
                  <select
                    required
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Selecione a origem</option>
                    {sourceOptions.map(source => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  rows={4}
                  placeholder="Informações adicionais sobre o lead"
                />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <button 
                  type="button"
                  onClick={prevStep}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
                >
                  Anterior
                </button>
              )}
            </div>
            <div className="space-x-3">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium"
              >
                Cancelar
              </button>
              {currentStep < 3 ? (
                <button 
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg"
                >
                  Próximo
                </button>
              ) : (
                <button 
                  type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium shadow-lg"
                >
                  {editingLead ? 'Atualizar' : 'Salvar'} Lead
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      console.log('🔄 Carregando dados dos leads...')
      
      const [leadsData, usersData] = await Promise.all([
        DatabaseService.getLeads(user!.institution_id),
        DatabaseService.getUsers(user!.institution_id)
      ])
      
      console.log('✅ Dados carregados:', { leads: leadsData.length, users: usersData.length })
      setLeads(leadsData)
      setUsers(usersData)
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error)
      setError('Erro ao carregar dados dos leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Lead>) => {
    try {
      setError('')
      console.log('💾 Salvando lead:', data)
      
      const leadData = {
        ...data,
        institution_id: user!.institution_id,
        status: editingLead ? editingLead.status : 'new' as Lead['status']
      }

      if (editingLead) {
        console.log('✏️ Atualizando lead existente:', editingLead.id)
        await DatabaseService.updateLead(editingLead.id, leadData)
      } else {
        console.log('➕ Criando novo lead')
        await DatabaseService.createLead(leadData)
      }

      console.log('✅ Lead salvo com sucesso!')
      await loadData()
      setEditingLead(null)
    } catch (error) {
      console.error('❌ Erro ao salvar lead:', error)
      setError('Erro ao salvar lead: ' + (error as Error).message)
    }
  }

  const handleEdit = (lead: Lead) => {
    console.log('✏️ Editando lead:', lead.id)
    setEditingLead(lead)
    setShowNewLeadModal(true)
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      console.log('🔄 Alterando status do lead:', leadId, 'para:', newStatus)
      await DatabaseService.updateLead(leadId, { status: newStatus })
      await loadData()
      console.log('✅ Status alterado com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error)
      setError('Erro ao atualizar status do lead')
    }
  }

  const handleNew = () => {
    console.log('➕ Criando novo lead')
    setEditingLead(null)
    setShowNewLeadModal(true)
  }

  const getLeadsByStatus = (status: Lead['status']) => {
    return leads.filter(lead => {
      const matchesStatus = lead.status === status
      const matchesSearch = searchTerm === '' || 
        lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = filterSource === '' || lead.source === filterSource
      
      return matchesStatus && matchesSearch && matchesSource
    })
  }

  const handleViewHistory = (lead: Lead) => {
    setSelectedLead(lead)
    setShowHistory(true)
  }

  const getLeadHistory = (lead: Lead) => {
    // Mock history data - em produção viria do banco
    return [
      {
        id: '1',
        action: 'Lead criado',
        user: 'Victor Almeida',
        date: lead.created_at,
        details: `Lead ${lead.student_name} foi criado via ${lead.source}`
      },
      {
        id: '2',
        action: 'Status alterado',
        user: 'Victor Almeida',
        date: lead.updated_at,
        details: `Status alterado para ${statusConfig[lead.status]?.label}`
      }
    ]
  }
  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user ? user.full_name : 'Não atribuído'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const getLeadStats = () => {
    const total = leads.length
    const thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = leads.filter(l => l.created_at.startsWith(thisMonth)).length
    const converted = leads.filter(l => l.status === 'enrolled').length
    const conversionRate = total > 0 ? (converted / total) * 100 : 0
    
    return { total, newThisMonth, converted, conversionRate }
  }

  const stats = getLeadStats()

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Kanban de Leads</h1>
            <p className="text-gray-600">Gerencie seus leads de forma visual e eficiente</p>
          </div>
          <button
            onClick={handleNew}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5 mr-2" />
            Novo Lead
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Leads</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Novos (Mês)</p>
                <p className="text-3xl font-bold text-green-600">{stats.newThisMonth}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Convertidos</p>
                <p className="text-3xl font-bold text-purple-600">{stats.converted}</p>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Taxa Conversão</p>
                <p className="text-3xl font-bold text-orange-600">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Buscar por nome do aluno ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          >
            <option value="">Todas as origens</option>
            {sourceOptions.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl mb-6 flex items-center">
          <X className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
        {Object.entries(statusConfig).map(([status, config]) => {
          const statusLeads = getLeadsByStatus(status as Lead['status'])
          
          return (
            <div key={status} className={`${config.bgColor} rounded-2xl p-6 min-h-96 ${config.borderColor} border-2`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full ${config.color} mr-3`}></div>
                  <h3 className={`font-bold ${config.textColor}`}>{config.label}</h3>
                </div>
                <span className={`${config.color} text-white text-sm px-3 py-1 rounded-full font-medium`}>
                  {statusLeads.length}
                </span>
              </div>

              <div className="space-y-4">
                {statusLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                        {lead.student_name}
                      </h4>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleViewHistory(lead)
                          }}
                          className="text-gray-400 hover:text-green-600 p-1"
                          title="Ver histórico"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(lead)
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1"
                          title="Editar lead"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-gray-600 flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {lead.grade_interest}
                      </p>
                      <p className="text-xs text-gray-600 flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {lead.responsible_name}
                      </p>
                      {lead.phone && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <Phone className="w-3 h-3 mr-1" />
                          {lead.phone}
                        </p>
                      )}
                      {lead.email && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <Mail className="w-3 h-3 mr-1" />
                          <span className="truncate">{lead.email}</span>
                        </p>
                      )}
                      {lead.address && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <MapPin className="w-3 h-3 mr-1" />
                          <span className="truncate">{lead.address}</span>
                        </p>
                      )}
                      {lead.budget_range && (
                        <p className="text-xs text-gray-600 flex items-center">
                          <DollarSign className="w-3 h-3 mr-1" />
                          {lead.budget_range}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center text-gray-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(lead.created_at)}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        lead.source === 'Facebook' ? 'bg-blue-100 text-blue-700' :
                        lead.source === 'Instagram' ? 'bg-pink-100 text-pink-700' :
                        lead.source === 'Google' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {lead.source}
                      </span>
                    </div>

                    {lead.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-600 flex items-start">
                          <MessageSquare className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{lead.notes}</span>
                        </p>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <select
                        value={lead.status}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleStatusChange(lead.id, e.target.value as Lead['status'])
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

                {statusLeads.length === 0 && (
                  <div className="text-center py-8">
                    <div className={`w-12 h-12 ${config.color} rounded-full flex items-center justify-center mx-auto mb-3 opacity-20`}>
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <p className="text-sm text-gray-500">Nenhum lead nesta etapa</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      <NewLeadModal
        isOpen={showNewLeadModal}
        onClose={() => {
          setShowNewLeadModal(false)
          setEditingLead(null)
        }}
        onSave={handleSave}
        editingLead={editingLead}
      />

      {/* History Modal */}
      {showHistory && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Histórico - {selectedLead.student_name}
              </h2>
              <button 
                onClick={() => setShowHistory(false)} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Lead Info */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Responsável:</span>
                  <p className="text-gray-900">{selectedLead.responsible_name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Série:</span>
                  <p className="text-gray-900">{selectedLead.grade_interest}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Telefone:</span>
                  <p className="text-gray-900">{selectedLead.phone}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Origem:</span>
                  <p className="text-gray-900">{selectedLead.source}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline de Ações</h3>
              {getLeadHistory(selectedLead).map((item, index) => (
                <div key={item.id} className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{item.action}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(item.date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">{item.details}</p>
                    <p className="text-xs text-gray-500 mt-1">por {item.user}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-6 border-t border-gray-200 mt-6">
              <button
                onClick={() => setShowHistory(false)}
                className="px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}