import React, { useState, useEffect } from 'react'
import { Calendar, Clock, User, Plus, Edit, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Visit, Lead } from '../../lib/supabase'

const statusConfig = {
  scheduled: { label: 'Agendada', color: 'bg-blue-500' },
  completed: { label: 'Realizada', color: 'bg-green-500' },
  cancelled: { label: 'Cancelada', color: 'bg-red-500' },
  no_show: { label: 'Não Compareceu', color: 'bg-gray-500' }
}

export default function VisitCalendar() {
  const { user } = useAuth()
  const [visits, setVisits] = useState<Visit[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null)
  const [formData, setFormData] = useState({
    lead_id: '',
    scheduled_date: '',
    notes: '',
    student_name: ''
  })

  useEffect(() => {
    if (user?.institution_id) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [visitsData, leadsData] = await Promise.all([
        DatabaseService.getVisits(user!.institution_id!),
        DatabaseService.getLeads(user!.institution_id!)
      ])
      setVisits(visitsData)
      setLeads(leadsData.filter(lead => lead.status !== 'enrolled' && lead.status !== 'lost'))
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const visitData = {
        ...formData,
        status: 'scheduled' as const,
        institution_id: user!.institution_id!,
        lead_id: formData.lead_id || null,
        student_name: formData.lead_id ? undefined : formData.student_name
      }

      if (editingVisit) {
        await DatabaseService.updateVisit(editingVisit.id, visitData)
      } else {
        await DatabaseService.createVisit(visitData)
      }

      await loadData()
      setShowForm(false)
      setEditingVisit(null)
      setFormData({
        lead_id: '',
        scheduled_date: '',
        notes: '',
        student_name: ''
      })
    } catch (error) {
      console.error('Error saving visit:', error)
    }
  }

  const handleEdit = (visit: Visit) => {
    setEditingVisit(visit)
    setFormData({
      lead_id: visit.lead_id || '',
      scheduled_date: visit.scheduled_date.slice(0, 16),
      notes: visit.notes || '',
      student_name: visit.student_name || ''
    })
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

  const getVisitsByStatus = (status: Visit['status']) => {
    return visits.filter(visit => visit.status === status)
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
        <h1 className="text-2xl font-bold text-gray-900">Calendário de Visitas</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Visita
        </button>
      </div>

      {/* Status Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
              <h3 className="font-semibold text-gray-900">{config.label}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded-full">
                {getVisitsByStatus(status as Visit['status']).length}
              </span>
            </div>

            <div className="space-y-3">
              {getVisitsByStatus(status as Visit['status']).map((visit) => (
                <div
                  key={visit.id}
                  className="bg-white p-3 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {visit.student_name || 'Visita avulsa'}
                    </h4>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(visit)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                      >
                        <Edit className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(visit.scheduled_date)}</span>
                    </div>
                    {visit.notes && (
                      <div className="text-xs text-gray-500 mt-2">
                        {visit.notes}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t">
                    <select
                      value={visit.status}
                      onChange={(e) => handleStatusChange(visit.id, e.target.value as Visit['status'])}
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
              {editingVisit ? 'Editar Visita' : 'Nova Visita'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lead (opcional)
                </label>
                <select
                  value={formData.lead_id}
                  onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">Visita avulsa</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.student_name} - {lead.responsible_name}
                    </option>
                  ))}
                </select>
              </div>

              {!formData.lead_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Visitante *
                  </label>
                  <input
                    type="text"
                    required={!formData.lead_id}
                    value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data e Hora *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
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
                    setEditingVisit(null)
                    setFormData({
                      lead_id: '',
                      scheduled_date: '',
                      notes: '',
                      student_name: ''
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
                  {editingVisit ? 'Atualizar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}