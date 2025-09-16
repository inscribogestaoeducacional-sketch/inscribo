import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Phone, Mail, Calendar, User, MapPin, DollarSign, Clock, MessageSquare } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead } from '../../lib/supabase'

const statusConfig = {
  new: { label: 'Novo', color: 'bg-blue-500', bgColor: 'bg-blue-50', textColor: 'text-blue-700' },
  contact: { label: 'Contato', color: 'bg-yellow-500', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700' },
  scheduled: { label: 'Agendado', color: 'bg-purple-500', bgColor: 'bg-purple-50', textColor: 'text-purple-700' },
  visit: { label: 'Visita', color: 'bg-orange-500', bgColor: 'bg-orange-50', textColor: 'text-orange-700' },
  proposal: { label: 'Proposta', color: 'bg-indigo-500', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' },
  enrolled: { label: 'Matriculado', color: 'bg-green-500', bgColor: 'bg-green-50', textColor: 'text-green-700' },
  lost: { label: 'Perdido', color: 'bg-red-500', bgColor: 'bg-red-50', textColor: 'text-red-700' }
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

export default function LeadKanban() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const leadData = {
        ...formData,
        institution_id: user!.institution_id!,
        status: 'new' as const
      }

      if (editingLead) {
        await DatabaseService.updateLead(editingLead.id, leadData)
        
        // Log activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'updated',
          entity_type: 'lead',
          entity_id: editingLead.id,
          details: { lead_name: formData.student_name, changes: 'Lead atualizado' },
          institution_id: user!.institution_id!
        })
      } else {
        const newLead = await DatabaseService.createLead(leadData)
        
        // Log activity
        await DatabaseService.logActivity({
          user_id: user!.id,
          action: 'created',
          entity_type: 'lead',
          entity_id: newLead.id,
          details: { lead_name: formData.student_name, source: formData.source },
          institution_id: user!.institution_id!
        })

        // Schedule visit if requested
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
      setShowForm(false)
      setEditingLead(null)
      resetForm()
    } catch (error) {
      console.error('Error saving lead:', error)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status'], reason?: string) => {
    try {
      await DatabaseService.updateLead(leadId, { status: newStatus })
      
      // Log activity
      await DatabaseService.logActivity({
        user_id: user!.id,
        action: 'status_changed',
        entity_type: 'lead',
        entity_id: leadId,
        details: { 
          new_status: newStatus, 
          reason: reason || 'Status alterado',
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
    setShowForm(true)
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
    return leads.filter(lead => lead.status === status)
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
        <h1 className="text-2xl font-bold text-gray-900">Kanban de Leads</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 overflow-x-auto">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className={`${config.bgColor} rounded-lg p-4 min-h-[500px]`}>
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
              <h3 className={`font-semibold ${config.textColor}`}>{config.label}</h3>
              <span className="bg-white text-gray-600 text-xs px-2 py-1 rounded-full">
                {getLeadsByStatus(status as Lead['status']).length}
              </span>
            </div>

            <div className="space-y-3">
              {getLeadsByStatus(status as Lead['status']).map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-gray-900 text-sm">{lead.student_name}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{lead.responsible_name}</span>
                    </div>
                    
                    {lead.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{lead.phone}</span>
                      </div>
                    )}
                    
                    {lead.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{lead.email}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{lead.grade_interest}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      <span>{lead.source}</span>
                    </div>

                    {lead.budget_range && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        <span>{lead.budget_range}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2 border-t">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value as Lead['status'])}
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
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">
              {editingLead ? 'Editar Lead' : 'Novo Lead'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Seção do Aluno */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dados do Aluno
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Aluno *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.student_name}
                      onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Série/Ano de Interesse *
                    </label>
                    <select
                      required
                      value={formData.grade_interest}
                      onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione a série</option>
                      {gradeOptions.map(grade => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CPF do Aluno
                    </label>
                    <input
                      type="text"
                      value={formData.cpf}
                      onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Período Preferido
                    </label>
                    <select
                      value={formData.preferred_period}
                      onChange={(e) => setFormData({ ...formData, preferred_period: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione o período</option>
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noite">Noite</option>
                      <option value="Integral">Integral</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção do Responsável */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Dados do Responsável
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do Responsável *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.responsible_name}
                      onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp
                    </label>
                    <input
                      type="tel"
                      value={formData.whatsapp}
                      onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endereço Completo
                    </label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="Rua, número, bairro, cidade"
                    />
                  </div>
                </div>
              </div>

              {/* Seção Comercial */}
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Informações Comerciais
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Origem do Lead *
                    </label>
                    <select
                      required
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione a origem</option>
                      {sourceOptions.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Faixa de Orçamento
                    </label>
                    <select
                      value={formData.budget_range}
                      onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">Selecione a faixa</option>
                      <option value="Até R$ 500">Até R$ 500</option>
                      <option value="R$ 500 - R$ 1.000">R$ 500 - R$ 1.000</option>
                      <option value="R$ 1.000 - R$ 2.000">R$ 1.000 - R$ 2.000</option>
                      <option value="R$ 2.000 - R$ 3.000">R$ 2.000 - R$ 3.000</option>
                      <option value="Acima de R$ 3.000">Acima de R$ 3.000</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      rows={3}
                      placeholder="Informações adicionais sobre o lead..."
                    />
                  </div>
                </div>
              </div>

              {/* Agendamento de Visita */}
              {!editingLead && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="schedule_visit"
                      checked={formData.schedule_visit}
                      onChange={(e) => setFormData({ ...formData, schedule_visit: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor="schedule_visit" className="font-semibold text-orange-800 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Agendar Visita Automaticamente
                    </label>
                  </div>
                  
                  {formData.schedule_visit && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Data da Visita
                        </label>
                        <input
                          type="date"
                          value={formData.visit_date}
                          onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Horário da Visita
                        </label>
                        <input
                          type="time"
                          value={formData.visit_time}
                          onChange={(e) => setFormData({ ...formData, visit_time: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingLead(null)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingLead ? 'Atualizar' : 'Salvar'} Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}