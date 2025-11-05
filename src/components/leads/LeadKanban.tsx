import React, { useState, useEffect } from 'react'
import { Plus, Filter, User, Phone, Mail, Calendar, Edit, Trash2, X, Search, Clock, MapPin, DollarSign, Tag, Users, TrendingUp, Eye, MessageSquare, Send, CheckCircle, Save } from 'lucide-react'
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
  'Infantil I',
  'Infantil II',
  'Infantil III',
  'Infantil IV',
  'Infantil V',
  '1º Ano EF',
  '2º Ano EF',
  '3º Ano EF',
  '4º Ano EF',
  '5º Ano EF',
  '6º Ano EF',
  '7º Ano EF',
  '8º Ano EF',
  '9º Ano EF',
  '1ª Série EM',
  '2ª Série EM',
  '3ª Série EM'
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
  const [filterStartDate, setFilterStartDate] = useState('')
  const [filterEndDate, setFilterEndDate] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [leadHistory, setLeadHistory] = useState<any[]>([])
  const [newAction, setNewAction] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editingActionText, setEditingActionText] = useState('')

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
        
        const changes: any = {}
        const previousData: any = {}
        
        Object.keys(data).forEach(key => {
          const newValue = (data as any)[key]
          const oldValue = (editingLead as any)[key]
          if (newValue !== oldValue && newValue !== undefined && newValue !== null && newValue !== '') {
            changes[key] = newValue
            previousData[key] = oldValue
          }
        })
        
        if (Object.keys(changes).length > 0) {
          try {
            await DatabaseService.logActivity({
              user_id: user!.id,
              action: 'Lead editado',
              entity_type: 'lead',
              entity_id: editingLead.id,
              details: {
                changes: changes,
                previous: previousData,
                student_name: data.student_name || editingLead.student_name,
                responsible_name: data.responsible_name || editingLead.responsible_name
              },
              institution_id: user!.institution_id
            })
            console.log('✅ Atividade de edição registrada')
          } catch (logError) {
            console.error('❌ Erro ao registrar atividade:', logError)
          }
        }
      } else {
        console.log('➕ Criando novo lead')
        const newLead = await DatabaseService.createLead(leadData)
        
        try {
          await DatabaseService.logActivity({
            user_id: user!.id,
            action: 'Lead criado',
            entity_type: 'lead',
            entity_id: newLead.id,
            details: {
              student_name: newLead.student_name,
              responsible_name: newLead.responsible_name,
              source: newLead.source,
              grade_interest: newLead.grade_interest,
              phone: newLead.phone || '',
              email: newLead.email || '',
              address: newLead.address || '',
              budget_range: newLead.budget_range || '',
              notes: newLead.notes || ''
            },
            institution_id: user!.institution_id
          })
          console.log('✅ Atividade de criação registrada')
        } catch (logError) {
          console.error('❌ Erro ao registrar atividade:', logError)
        }
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

  const handleDelete = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    const confirmMessage = `Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`
    
    if (!confirm(confirmMessage)) return

    try {
      console.log('🗑️ Excluindo lead:', leadId)
      await DatabaseService.deleteLead(leadId)
      await loadData()
      console.log('✅ Lead excluído com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao excluir lead:', error)
      setError('Erro ao excluir lead: ' + (error as Error).message)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      console.log('🔄 Alterando status do lead:', leadId, 'para:', newStatus)
       
       const currentLead = leads.find(l => l.id === leadId)
       const previousStatus = currentLead?.status
       
      await DatabaseService.updateLead(leadId, { status: newStatus })
       
       if (currentLead && previousStatus !== newStatus) {
         try {
           await DatabaseService.logActivity({
             user_id: user!.id,
             action: 'Status alterado',
             entity_type: 'lead',
             entity_id: leadId,
             details: {
               previous_status: previousStatus,
               new_status: newStatus,
               student_name: currentLead.student_name,
               responsible_name: currentLead.responsible_name
             },
             institution_id: user!.institution_id
           })
           console.log('✅ Mudança de status registrada')
         } catch (logError) {
           console.error('❌ Erro ao registrar mudança de status:', logError)
         }
       }
       
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
      
      let matchesDate = true
      if (filterStartDate || filterEndDate) {
        const leadDate = new Date(lead.created_at).setHours(0, 0, 0, 0)
        
        if (filterStartDate) {
          const startDate = new Date(filterStartDate).setHours(0, 0, 0, 0)
          matchesDate = matchesDate && leadDate >= startDate
        }
        
        if (filterEndDate) {
          const endDate = new Date(filterEndDate).setHours(23, 59, 59, 999)
          matchesDate = matchesDate && leadDate <= endDate
        }
      }
      
      return matchesStatus && matchesSearch && matchesSource && matchesDate
    })
  }

  const handleViewHistory = (lead: Lead) => {
    setSelectedLead(lead)
    setShowHistory(true)
    setNewAction('')
    setEditingAction(null)
    setEditingActionText('')
    loadLeadHistory(lead.id)
  }

  const loadLeadHistory = async (leadId: string) => {
    try {
      setLoadingHistory(true)
      console.log('📊 Carregando histórico do lead:', leadId)
      const history = await DatabaseService.getActivityLogs(user!.institution_id, leadId)
      console.log('📊 Histórico carregado:', history.length, 'registros')
      setLeadHistory(history)
    } catch (error) {
      console.error('❌ Erro ao carregar histórico:', error)
      setLeadHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAddAction = async () => {
    if (!newAction.trim() || !selectedLead) return

    try {
      setSavingAction(true)
      console.log('💾 Salvando nova ação no histórico...')
      
      await DatabaseService.logActivity({
        user_id: user!.id,
        action: 'Ação manual adicionada',
        entity_type: 'lead',
        entity_id: selectedLead.id,
        details: {
          description: newAction.trim(),
          student_name: selectedLead.student_name,
          responsible_name: selectedLead.responsible_name
        },
        institution_id: user!.institution_id
      })
      
      console.log('✅ Ação salva com sucesso!')
      
      await loadLeadHistory(selectedLead.id)
      
      setNewAction('')
    } catch (error) {
      console.error('❌ Erro ao salvar ação:', error)
      setError('Erro ao adicionar ação ao histórico')
    } finally {
      setSavingAction(false)
    }
  }

  const handleEditAction = (actionId: string, currentDescription: string) => {
    setEditingAction(actionId)
    setEditingActionText(currentDescription)
  }

  const handleSaveEditAction = async (actionId: string) => {
    if (!editingActionText.trim()) return

    try {
      console.log('💾 Atualizando ação...')
      
      await DatabaseService.updateActivityLog(actionId, {
        details: {
          ...leadHistory.find(h => h.id === actionId)?.details,
          description: editingActionText.trim()
        }
      })
      
      console.log('✅ Ação atualizada com sucesso!')
      
      await loadLeadHistory(selectedLead!.id)
      
      setEditingAction(null)
      setEditingActionText('')
    } catch (error) {
      console.error('❌ Erro ao atualizar ação:', error)
      setError('Erro ao atualizar ação')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ação?\n\nEsta ação não pode ser desfeita.')) return

    try {
      console.log('🗑️ Excluindo ação...')
      
      await DatabaseService.deleteActivityLog(actionId)
      
      console.log('✅ Ação excluída com sucesso!')
      
      await loadLeadHistory(selectedLead!.id)
    } catch (error) {
      console.error('❌ Erro ao excluir ação:', error)
      setError('Erro ao excluir ação')
    }
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    return user ? user.full_name : 'Não atribuído'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getLeadStats = () => {
    const total = leads.length
    const thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = leads.filter(l => l.created_at.startsWith(thisMonth)).length
    const converted = leads.filter(l => l.status === 'enrolled').length
    const conversionRate = total > 0 ? (converted / total) * 100 : 0
    
    return { total, newThisMonth, converted, conversionRate }
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterSource('')
    setFilterStartDate('')
    setFilterEndDate('')
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
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Users className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Novos (Mês)</p>
                <p className="text-2xl font-bold text-green-600">{stats.newThisMonth}</p>
              </div>
              <TrendingUp className="h-7 w-7 text-green-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Convertidos</p>
                <p className="text-2xl font-bold text-purple-600">{stats.converted}</p>
              </div>
              <CheckCircle className="h-7 w-7 text-purple-600" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Taxa Conversão</p>
                <p className="text-2xl font-bold text-orange-600">{stats.conversionRate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-7 w-7 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold text-gray-900 flex items-center">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </h3>
            {(searchTerm || filterSource || filterStartDate || filterEndDate) && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Limpar Filtros
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
            >
              <option value="">Todas as origens</option>
              {sourceOptions.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
            
            <div>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                placeholder="Data início"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
            </div>
            
            <div>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                placeholder="Data fim"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center text-sm">
          <X className="h-4 w-4 mr-2" />
          {error}
        </div>
      )}

      {/* Kanban Board - CONTAINER COM ALTURA FIXA E BARRAS DE ROLAGEM */}
      <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm">
        <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <p className="text-sm font-semibold text-gray-700 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
            Pipeline de Vendas
          </p>
        </div>
        
        {/* Container com scroll interno - ALTURA FIXA */}
        <div className="overflow-x-auto overflow-y-auto" style={{ height: 'calc(100vh - 450px)', minHeight: '500px' }}>
          <div className="flex gap-4 p-4 min-w-max">
            {Object.entries(statusConfig).map(([status, config]) => {
              const statusLeads = getLeadsByStatus(status as Lead['status'])
              
              return (
                <div key={status} className={`${config.bgColor} rounded-xl p-4 w-72 ${config.borderColor} border-2 transition-all hover:shadow-md flex-shrink-0`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`w-3 h-3 rounded-full ${config.color} mr-2 shadow-sm`}></div>
                      <h3 className={`font-bold text-sm ${config.textColor}`}>{config.label}</h3>
                    </div>
                    <span className={`${config.color} text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-sm`}>
                      {statusLeads.length}
                    </span>
                  </div>

                  <div className="space-y-3 max-h-full overflow-y-auto pr-1" style={{ maxHeight: 'calc(100vh - 520px)' }}>
                    {statusLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                      >
                        {/* Header do Card */}
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-gray-900 text-sm mb-1.5 group-hover:text-blue-600 transition-colors truncate">
                              {lead.student_name}
                            </h4>
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold ${
                              lead.source === 'Facebook' ? 'bg-blue-100 text-blue-700' :
                              lead.source === 'Instagram' ? 'bg-pink-100 text-pink-700' :
                              lead.source === 'Google' ? 'bg-green-100 text-green-700' :
                              lead.source === 'WhatsApp' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              <Tag className="w-3 h-3 mr-1" />
                              {lead.source}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all ml-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewHistory(lead)
                              }}
                              className="text-gray-400 hover:text-green-600 p-1.5 hover:bg-green-50 rounded-md transition-all"
                              title="Ver histórico"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEdit(lead)
                              }}
                              className="text-gray-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-md transition-all"
                              title="Editar lead"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(lead.id)
                              }}
                              className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-md transition-all"
                              title="Excluir lead"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Informações */}
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center text-xs text-gray-700 bg-gray-50 p-2 rounded-md">
                            <User className="w-3.5 h-3.5 mr-2 text-gray-500 flex-shrink-0" />
                            <span className="font-semibold truncate">{lead.grade_interest}</span>
                          </div>
                          
                          <div className="flex items-center text-xs text-gray-700 bg-gray-50 p-2 rounded-md">
                            <Users className="w-3.5 h-3.5 mr-2 text-gray-500 flex-shrink-0" />
                            <span className="truncate">{lead.responsible_name}</span>
                          </div>
                          
                          {lead.phone && (
                            <div className="flex items-center text-xs text-blue-700 bg-blue-50 p-2 rounded-md">
                              <Phone className="w-3.5 h-3.5 mr-2 text-blue-600 flex-shrink-0" />
                              <span className="font-medium">{lead.phone}</span>
                            </div>
                          )}
                          
                          {lead.budget_range && (
                            <div className="flex items-center text-xs text-green-700 bg-green-50 p-2 rounded-md">
                              <DollarSign className="w-3.5 h-3.5 mr-2 text-green-600 flex-shrink-0" />
                              <span className="font-medium">{lead.budget_range}</span>
                            </div>
                          )}
                        </div>

                        {/* Notas */}
                        {lead.notes && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
                            <p className="text-xs text-gray-700 flex items-start">
                              <MessageSquare className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0 text-amber-600" />
                              <span className="line-clamp-2 leading-relaxed">{lead.notes}</span>
                            </p>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="pt-3 border-t border-gray-100 space-y-2">
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="w-3 h-3 mr-1.5" />
                            <span>{formatDate(lead.created_at)}</span>
                          </div>
                          
                          <select
                            value={lead.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleStatusChange(lead.id, e.target.value as Lead['status'])
                            }}
                            className="w-full text-xs font-semibold border border-gray-200 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-all cursor-pointer"
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
                        <p className="text-xs font-medium text-gray-500">Nenhum lead</p>
                        <p className="text-xs text-gray-400">nesta etapa</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
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

      {/* History Modal - MESMO DA VERSÃO ANTERIOR */}
      {showHistory && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <Clock className="h-6 w-6 mr-2 text-blue-600" />
                Histórico - {selectedLead.student_name}
              </h2>
              <button 
                onClick={() => {
                  setShowHistory(false)
                  setLeadHistory([])
                  setSelectedLead(null)
                  setNewAction('')
                  setEditingAction(null)
                  setEditingActionText('')
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Lead Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 mb-6 border border-blue-200">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Responsável:</span>
                  <p className="text-gray-900">{selectedLead.responsible_name}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Série:</span>
                  <p className="text-gray-900">{selectedLead.grade_interest}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Telefone:</span>
                  <p className="text-gray-900">{selectedLead.phone || 'Não informado'}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Origem:</span>
                  <p className="text-gray-900">{selectedLead.source}</p>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Status Atual:</span>
                  <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${
                    statusConfig[selectedLead.status]?.bgColor
                  } ${statusConfig[selectedLead.status]?.textColor}`}>
                    {statusConfig[selectedLead.status]?.label}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700 block mb-1">Criado em:</span>
                  <p className="text-gray-900">{new Date(selectedLead.created_at).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            </div>

            {/* Adicionar Ação */}
            <div className="mb-6 p-5 bg-blue-50 border-2 border-blue-200 rounded-xl">
              <h3 className="text-md font-bold text-gray-900 mb-3 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-600" />
                Adicionar Nova Ação
              </h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="Descreva a ação realizada (ex: Ligação feita, E-mail enviado...)"
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !savingAction) {
                      handleAddAction()
                    }
                  }}
                />
                <button
                  onClick={handleAddAction}
                  disabled={!newAction.trim() || savingAction}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center"
                >
                  {savingAction ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Data e hora serão registradas automaticamente
              </p>
            </div>

            {/* Timeline */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-purple-600" />
                Timeline de Ações
              </h3>
              
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 font-medium">Carregando histórico...</span>
                </div>
              ) : leadHistory.length > 0 ? (
                <div className="space-y-3">
                  {leadHistory.map((item, index) => {
                    const isManualAction = item.action.includes('manual') || item.action.includes('Ação manual')
                    const isEditing = editingAction === item.id
                    
                    return (
                      <div key={item.id} className="relative">
                        {index < leadHistory.length - 1 && (
                          <div className="absolute left-5 top-12 w-0.5 h-full bg-gray-200"></div>
                        )}
                        
                        <div className="flex items-start space-x-4 p-5 bg-gradient-to-r from-gray-50 to-white rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
                          <div className="flex-shrink-0 relative z-10">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md ${
                              item.action.includes('criado') || item.action.includes('Lead criado') ? 'bg-green-500' :
                              item.action.includes('Status') || item.action.includes('status') || item.action.includes('alterado') ? 'bg-blue-500' :
                              item.action.includes('atualizado') || item.action.includes('Lead atualizado') || item.action.includes('editado') ? 'bg-yellow-500' :
                              item.action.includes('excluído') || item.action.includes('Lead excluído') ? 'bg-red-500' :
                              isManualAction ? 'bg-purple-500' :
                              'bg-gray-500'
                            }`}>
                              {item.action.includes('criado') || item.action.includes('Lead criado') ? <Plus className="w-5 h-5 text-white" /> :
                               item.action.includes('Status') || item.action.includes('status') || item.action.includes('alterado') ? <TrendingUp className="w-5 h-5 text-white" /> :
                               item.action.includes('atualizado') || item.action.includes('Lead atualizado') || item.action.includes('editado') ? <Edit className="w-5 h-5 text-white" /> :
                               item.action.includes('excluído') || item.action.includes('Lead excluído') ? <Trash2 className="w-5 h-5 text-white" /> :
                               isManualAction ? <MessageSquare className="w-5 h-5 text-white" /> :
                               <Clock className="w-5 h-5 text-white" />}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-bold text-gray-900">{item.action}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-1 rounded-lg">
                                  {formatDateTime(item.created_at)}
                                </p>
                                {isManualAction && !isEditing && (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleEditAction(item.id, item.details?.description || '')}
                                      className="text-gray-400 hover:text-blue-600 p-1 hover:bg-blue-50 rounded transition-all"
                                      title="Editar ação"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAction(item.id)}
                                      className="text-gray-400 hover:text-red-600 p-1 hover:bg-red-50 rounded transition-all"
                                      title="Excluir ação"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {item.details && (
                              <div className="text-sm text-gray-700 mb-3 bg-white p-3 rounded-lg border border-gray-200">
                                {isManualAction && isEditing ? (
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={editingActionText}
                                      onChange={(e) => setEditingActionText(e.target.value)}
                                      className="flex-1 px-3 py-2 border-2 border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSaveEditAction(item.id)}
                                      className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                                      title="Salvar"
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingAction(null)
                                        setEditingActionText('')
                                      }}
                                      className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
                                      title="Cancelar"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : isManualAction && item.details.description ? (
                                  <div className="flex items-start">
                                    <MessageSquare className="w-4 h-4 mr-2 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <p className="font-medium text-gray-800">{item.details.description}</p>
                                  </div>
                                ) : null}
                                
                                {(item.action.includes('Status') || item.action.includes('status') || item.action.includes('alterado')) && (
                                  <p className="flex items-center">
                                    <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                                    Status: <span className="font-bold mx-1">{statusConfig[item.details.previous_status as keyof typeof statusConfig]?.label || item.details.previous_status}</span> 
                                    → <span className="font-bold mx-1">{statusConfig[item.details.new_status as keyof typeof statusConfig]?.label || item.details.new_status}</span>
                                  </p>
                                )}
                                
                                {(item.action.includes('criado') || item.action.includes('Lead criado')) && (
                                  <div className="space-y-1">
                                    <p className="font-bold">Lead criado: {item.details.student_name || 'N/A'}</p>
                                    <p className="text-xs">Responsável: <span className="font-semibold">{item.details.responsible_name || 'N/A'}</span></p>
                                    <p className="text-xs">Origem: <span className="font-semibold">{item.details.source || 'N/A'}</span> | Série: <span className="font-semibold">{item.details.grade_interest || 'N/A'}</span></p>
                                  </div>
                                )}
                                
                                {(item.action.includes('atualizado') || item.action.includes('Lead atualizado') || item.action.includes('editado')) && (
                                  <div>
                                    <p className="font-semibold mb-2">Informações atualizadas:</p>
                                    {item.details.changes && Object.keys(item.details.changes).length > 0 && (
                                      <ul className="text-xs space-y-1 ml-4">
                                        {Object.entries(item.details.changes).map(([key, value]) => (
                                          <li key={key} className="flex items-center">
                                            <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                            <strong>{key === 'student_name' ? 'Nome do Aluno' : 
                                                     key === 'responsible_name' ? 'Responsável' :
                                                     key === 'phone' ? 'Telefone' :
                                                     key === 'email' ? 'Email' :
                                                     key === 'grade_interest' ? 'Série' :
                                                     key === 'source' ? 'Origem' :
                                                     key === 'address' ? 'Endereço' :
                                                     key === 'budget_range' ? 'Orçamento' : key}:</strong> 
                                            <span className="ml-1">{value as string}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-600 flex items-center font-medium">
                              <User className="w-3 h-3 mr-1" />
                              por {item.user_name || user?.full_name || 'Usuário desconhecido'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium mb-2">Nenhum histórico encontrado</p>
                  <p className="text-sm text-gray-400 mb-4">Adicione a primeira ação usando o campo acima</p>
                  <button
                    onClick={() => loadLeadHistory(selectedLead!.id)}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Tentar carregar novamente
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-6 border-t-2 border-gray-200 mt-6">
              <button
                onClick={() => {
                  setShowHistory(false)
                  setSelectedLead(null)
                  setLeadHistory([])
                  setNewAction('')
                  setEditingAction(null)
                  setEditingActionText('')
                }}
                className="px-8 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all font-semibold shadow-lg hover:shadow-xl"
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
