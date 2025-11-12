import React, { useState, useEffect } from 'react'
import { Plus, Filter, User, Phone, Mail, Calendar, Edit, Trash2, X, Search, Clock, MapPin, DollarSign, Tag, Users, TrendingUp, Eye, MessageSquare, Send, CheckCircle, Save } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead, User as AppUser } from '../../lib/supabase'
import ScheduleVisitModal from './ScheduleVisitModal'

const statusConfig = {
  new: { label: 'Novo', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
  contact: { label: 'Contato', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-200' },
  scheduled: { label: 'Agendado', color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-200' },
  visit: { label: 'Visita', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  proposal: { label: 'Proposta', color: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-200' },
  enrolled: { label: 'Matriculado', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-200' },
  lost: { label: 'Perdido', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-200' }
}

const sourceOptions = ['Facebook', 'Instagram', 'Google', 'Site', 'Indicação', 'WhatsApp', 'Outros']

const gradeOptions = [
  'Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
  '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
  '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
  '1ª Série EM', '2ª Série EM', '3ª Série EM'
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
    student_name: '', grade_interest: '', cpf: '', responsible_name: '',
    phone: '', email: '', address: '', budget_range: '', source: '', notes: ''
  })

  useEffect(() => {
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name, grade_interest: editingLead.grade_interest,
        cpf: editingLead.cpf || '', responsible_name: editingLead.responsible_name,
        phone: editingLead.phone || '', email: editingLead.email || '',
        address: editingLead.address || '', budget_range: editingLead.budget_range || '',
        source: editingLead.source, notes: editingLead.notes || ''
      })
    } else {
      setFormData({
        student_name: '', grade_interest: '', cpf: '', responsible_name: '',
        phone: '', email: '', address: '', budget_range: '', source: '', notes: ''
      })
    }
    setCurrentStep(1)
  }, [editingLead, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === currentStep ? 'bg-blue-600 text-white shadow-lg' : 
                step < currentStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>{step}</div>
              {step < 3 && <div className={`w-16 h-1 mx-3 rounded-full transition-all ${step < currentStep ? 'bg-green-500' : 'bg-gray-200'}`}></div>}
            </div>
          ))}
        </div>

        <div className="text-center mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            {currentStep === 1 && 'Dados do Aluno'}
            {currentStep === 2 && 'Dados do Responsável'}
            {currentStep === 3 && 'Informações Adicionais'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Aluno *</label>
                  <input type="text" required value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="Nome completo do aluno" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Série/Ano de Interesse *</label>
                  <select required value={formData.grade_interest}
                    onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                    <option value="">Selecione a série</option>
                    {gradeOptions.map(grade => <option key={grade} value={grade}>{grade}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CPF do Aluno</label>
                <input type="text" value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="000.000.000-00" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Responsável *</label>
                <input type="text" required value={formData.responsible_name}
                  onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Nome completo do responsável" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone *</label>
                  <input type="tel" required value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    placeholder="email@exemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
                <input type="text" value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  placeholder="Endereço completo" />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Faixa de Orçamento</label>
                  <select value={formData.budget_range}
                    onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                    <option value="">Selecione a faixa</option>
                    <option value="Até R$ 500">Até R$ 500</option>
                    <option value="R$ 500 - R$ 1.000">R$ 500 - R$ 1.000</option>
                    <option value="R$ 1.000 - R$ 1.500">R$ 1.000 - R$ 1.500</option>
                    <option value="R$ 1.500 - R$ 2.000">R$ 1.500 - R$ 2.000</option>
                    <option value="Acima de R$ 2.000">Acima de R$ 2.000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Origem do Lead *</label>
                  <select required value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                    <option value="">Selecione a origem</option>
                    {sourceOptions.map(source => <option key={source} value={source}>{source}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  rows={4} placeholder="Informações adicionais sobre o lead" />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-6 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <button type="button" onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium">
                  Anterior
                </button>
              )}
            </div>
            <div className="space-x-3">
              <button type="button" onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium">
                Cancelar
              </button>
              {currentStep < 3 ? (
                <button type="button" onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium shadow-lg">
                  Próximo
                </button>
              ) : (
                <button type="submit"
                  className="px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all font-medium shadow-lg">
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
  
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)

  useEffect(() => {
    if (user?.institution_id) loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const [leadsData, usersData] = await Promise.all([
        DatabaseService.getLeads(user!.institution_id),
        DatabaseService.getUsers(user!.institution_id)
      ])
      setLeads(leadsData)
      setUsers(usersData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      setError('Erro ao carregar dados dos leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Lead>) => {
    try {
      setError('')
      const leadData = { ...data, institution_id: user!.institution_id, status: editingLead ? editingLead.status : 'new' as Lead['status'] }
      
      if (editingLead) {
        await DatabaseService.updateLead(editingLead.id, leadData)
        const changes: any = {}, previousData: any = {}
        Object.keys(data).forEach(key => {
          const newValue = (data as any)[key], oldValue = (editingLead as any)[key]
          if (newValue !== oldValue && newValue !== undefined && newValue !== null && newValue !== '') {
            changes[key] = newValue
            previousData[key] = oldValue
          }
        })
        if (Object.keys(changes).length > 0) {
          await DatabaseService.logActivity({
            user_id: user!.id, action: 'Lead editado', entity_type: 'lead', entity_id: editingLead.id,
            details: { changes, previous: previousData, student_name: data.student_name || editingLead.student_name, responsible_name: data.responsible_name || editingLead.responsible_name },
            institution_id: user!.institution_id
          })
        }
      } else {
        const newLead = await DatabaseService.createLead(leadData)
        await DatabaseService.logActivity({
          user_id: user!.id, action: 'Lead criado', entity_type: 'lead', entity_id: newLead.id,
          details: { student_name: newLead.student_name, responsible_name: newLead.responsible_name, source: newLead.source, grade_interest: newLead.grade_interest, phone: newLead.phone || '', email: newLead.email || '', address: newLead.address || '', budget_range: newLead.budget_range || '', notes: newLead.notes || '' },
          institution_id: user!.institution_id
        })
      }
      await loadData()
      setEditingLead(null)
    } catch (error) {
      console.error('Erro ao salvar lead:', error)
      setError('Erro ao salvar lead: ' + (error as Error).message)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      const currentLead = leads.find(l => l.id === leadId)
      const previousStatus = currentLead?.status
      
      if (newStatus === 'scheduled' && currentLead) {
        setLeadToSchedule(currentLead)
        setShowScheduleModal(true)
        return
      }
      
      await DatabaseService.updateLead(leadId, { status: newStatus })
      
      if (currentLead && previousStatus !== newStatus) {
        await DatabaseService.logActivity({
          user_id: user!.id, action: 'Status alterado', entity_type: 'lead', entity_id: leadId,
          details: { previous_status: previousStatus, new_status: newStatus, student_name: currentLead.student_name, responsible_name: currentLead.responsible_name },
          institution_id: user!.institution_id
        })
      }
      
      await loadData()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      setError('Erro ao atualizar status do lead')
    }
  }

  const handleScheduleVisit = async (data: {
    scheduled_date: string
    scheduled_time: string
    notes: string
  }) => {
    if (!leadToSchedule) return
    
    try {
      const scheduledDateTime = `${data.scheduled_date}T${data.scheduled_time}:00.000Z`
      
      const newVisit = await DatabaseService.createVisit({
        lead_id: leadToSchedule.id,
        student_name: leadToSchedule.student_name,
        scheduled_date: scheduledDateTime,
        notes: data.notes,
        status: 'scheduled',
        institution_id: user!.institution_id
      })
      
      await DatabaseService.updateLead(leadToSchedule.id, {
        status: 'scheduled'
      })
      
      await DatabaseService.logActivity({
        user_id: user!.id,
        action: 'Visita agendada',
        entity_type: 'lead',
        entity_id: leadToSchedule.id,
        details: {
          visit_id: newVisit.id,
          scheduled_date: scheduledDateTime,
          scheduled_time: data.scheduled_time,
          student_name: leadToSchedule.student_name,
          responsible_name: leadToSchedule.responsible_name,
          phone: leadToSchedule.phone,
          grade_interest: leadToSchedule.grade_interest,
          notes: data.notes
        },
        institution_id: user!.institution_id
      })
      
      setShowScheduleModal(false)
      setLeadToSchedule(null)
      await loadData()
      
      alert('✅ Visita agendada com sucesso!')
    } catch (error) {
      console.error('❌ Erro ao agendar visita:', error)
      alert('❌ Erro ao agendar visita: ' + (error as Error).message)
    }
  }

  const handleDelete = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || !confirm(`Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`)) return
    try {
      await DatabaseService.deleteLead(leadId)
      await loadData()
    } catch (error) {
      console.error('Erro ao excluir lead:', error)
      setError('Erro ao excluir lead: ' + (error as Error).message)
    }
  }

  const loadLeadHistory = async (leadId: string) => {
    try {
      setLoadingHistory(true)
      const history = await DatabaseService.getActivityLogs(user!.institution_id, leadId)
      
      const historyWithUsers = history.map(item => {
        const userName = users.find(u => u.id === item.user_id)?.full_name || user?.full_name || 'Sistema'
        return { ...item, user_name: userName }
      })
      
      setLeadHistory(historyWithUsers)
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      setLeadHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAddAction = async () => {
    if (!newAction.trim() || !selectedLead) return
    try {
      setSavingAction(true)
      await DatabaseService.logActivity({
        user_id: user!.id, action: 'Ação manual adicionada', entity_type: 'lead', entity_id: selectedLead.id,
        details: { description: newAction.trim(), student_name: selectedLead.student_name, responsible_name: selectedLead.responsible_name },
        institution_id: user!.institution_id
      })
      await loadLeadHistory(selectedLead.id)
      setNewAction('')
    } catch (error) {
      console.error('Erro ao salvar ação:', error)
      setError('Erro ao adicionar ação ao histórico')
    } finally {
      setSavingAction(false)
    }
  }

  const handleSaveEditAction = async (actionId: string) => {
    if (!editingActionText.trim()) return
    try {
      await DatabaseService.updateActivityLog(actionId, {
        details: { ...leadHistory.find(h => h.id === actionId)?.details, description: editingActionText.trim() }
      })
      await loadLeadHistory(selectedLead!.id)
      setEditingAction(null)
      setEditingActionText('')
    } catch (error) {
      console.error('Erro ao atualizar ação:', error)
      setError('Erro ao atualizar ação')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ação?\n\nEsta ação não pode ser desfeita.')) return
    try {
      await DatabaseService.deleteActivityLog(actionId)
      await loadLeadHistory(selectedLead!.id)
    } catch (error) {
      console.error('Erro ao excluir ação:', error)
      setError('Erro ao excluir ação')
    }
  }

  const getLeadsByStatus = (status: Lead['status']) => {
    return leads.filter(lead => {
      const matchesStatus = lead.status === status
      const matchesSearch = searchTerm === '' || lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = filterSource === '' || lead.source === filterSource
      let matchesDate = true
      if (filterStartDate || filterEndDate) {
        const leadDate = new Date(lead.created_at).setHours(0, 0, 0, 0)
        if (filterStartDate) matchesDate = matchesDate && leadDate >= new Date(filterStartDate).setHours(0, 0, 0, 0)
        if (filterEndDate) matchesDate = matchesDate && leadDate <= new Date(filterEndDate).setHours(23, 59, 59, 999)
      }
      return matchesStatus && matchesSearch && matchesSource && matchesDate
    })
  }

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR')
  const formatDateTime = (dateString: string) => new Date(dateString).toLocaleString('pt-BR')

  const getLeadStats = () => {
    const total = leads.length, thisMonth = new Date().toISOString().slice(0, 7)
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
            {[1, 2, 3, 4].map(i => <div key={i} className="h-96 bg-gray-200 rounded-2xl"></div>)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* CONTEÚDO DO KANBAN - uso o código do arquivo original */}
      <NewLeadModal 
        isOpen={showNewLeadModal}
        onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }}
        onSave={handleSave} 
        editingLead={editingLead} 
      />

      {showScheduleModal && leadToSchedule && (
        <ScheduleVisitModal
          isOpen={showScheduleModal}
          onClose={() => {
            setShowScheduleModal(false)
            setLeadToSchedule(null)
          }}
          lead={leadToSchedule}
          onSchedule={handleScheduleVisit}
        />
      )}
      
      {/* Resto do código do Kanban aqui */}
    </div>
  )
}
