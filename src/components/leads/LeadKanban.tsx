import React, { useState, useEffect } from 'react'
import { Plus, Phone, Mail, User, Calendar, Edit, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead } from '../../lib/supabase'

const statusConfig = {
  new: { label: 'Novos', color: 'bg-blue-500' },
  contact: { label: 'Contato', color: 'bg-yellow-500' },
  scheduled: { label: 'Agendado', color: 'bg-purple-500' },
  visit: { label: 'Visita', color: 'bg-orange-500' },
  proposal: { label: 'Proposta', color: 'bg-indigo-500' },
  enrolled: { label: 'Matriculado', color: 'bg-green-500' },
  lost: { label: 'Perdido', color: 'bg-red-500' }
}

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
    notes: ''
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
        status: 'new' as const,
        institution_id: user!.institution_id!
      }

      if (editingLead) {
        await DatabaseService.updateLead(editingLead.id, leadData)
      } else {
        await DatabaseService.createLead(leadData)
      }

      await loadLeads()
      setShowForm(false)
      setEditingLead(null)
      setFormData({
        student_name: '',
        responsible_name: '',
        phone: '',
        email: '',
        grade_interest: '',
        source: '',
        notes: ''
      })
    } catch (error) {
      console.error('Error saving lead:', error)
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
      notes: lead.notes || ''
    })
    setShowForm(true)
  }

  const handleDelete = async (leadId: string) => {
    if (confirm('Tem certeza que deseja excluir este lead?')) {
      try {
        await DatabaseService.deleteLead(leadId)
        await loadLeads()
      } catch (error) {
        console.error('Error deleting lead:', error)
      }
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      await DatabaseService.updateLead(leadId, { status: newStatus })
      await loadLeads()
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
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
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
              <h3 className="font-semibold text-gray-900">{config.label}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                {getLeadsByStatus(status as Lead['status']).length}
              </span>
            </div>

            <div className="space-y-3">
              {getLeadsByStatus(status as Lead['status']).map((lead) => (
                <div
                  key={lead.id}
                  className="bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">{lead.student_name}</h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(lead)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-600">
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
                        <span>{lead.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{lead.grade_interest}</span>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t">
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingLead ? 'Editar Lead' : 'Novo Lead'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                  Telefone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Série de Interesse *
                </label>
                <input
                  type="text"
                  required
                  value={formData.grade_interest}
                  onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origem *
                </label>
                <select
                  required
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Selecione...</option>
                  <option value="site">Site</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="google">Google</option>
                  <option value="indicacao">Indicação</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observações
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    setEditingLead(null)
                    setFormData({
                      student_name: '',
                      responsible_name: '',
                      phone: '',
                      email: '',
                      grade_interest: '',
                      source: '',
                      notes: ''
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
                  {editingLead ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}