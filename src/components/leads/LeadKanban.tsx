import React, { useState, useEffect } from 'react'
import { Plus, Phone, Mail, Calendar, MoreHorizontal, User, GraduationCap, Tag, Edit, Trash2, X } from 'lucide-react'
import { DatabaseService, Lead } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const KANBAN_COLUMNS = [
  { id: 'new', title: 'Novo', color: 'bg-gray-100 border-gray-300' },
  { id: 'contact', title: 'Contato', color: 'bg-blue-100 border-blue-300' },
  { id: 'scheduled', title: 'Agendado', color: 'bg-yellow-100 border-yellow-300' },
  { id: 'visit', title: 'Visita', color: 'bg-orange-100 border-orange-300' },
  { id: 'proposal', title: 'Proposta', color: 'bg-purple-100 border-purple-300' },
  { id: 'enrolled', title: 'Matrícula', color: 'bg-green-100 border-green-300' },
]

interface LeadCardProps {
  lead: Lead
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

function LeadCard({ lead, onEdit, onDelete, onStatusChange }: LeadCardProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', lead.id)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-white rounded-lg border border-gray-200 p-4 mb-3 hover:shadow-md transition-all cursor-move ${
        isDragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm">{lead.student_name}</h4>
        <div className="flex items-center space-x-1">
          <button 
            onClick={() => onEdit(lead)}
            className="text-gray-400 hover:text-blue-600 transition-colors"
          >
            <Edit className="h-3 w-3" />
          </button>
          <button 
            onClick={() => onDelete(lead.id)}
            className="text-gray-400 hover:text-red-600 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <User className="h-3 w-3 mr-2 flex-shrink-0" />
          <span className="truncate">{lead.responsible_name}</span>
        </div>
        <div className="flex items-center">
          <GraduationCap className="h-3 w-3 mr-2 flex-shrink-0" />
          <span className="truncate">{lead.grade_interest}</span>
        </div>
        <div className="flex items-center">
          <Tag className="h-3 w-3 mr-2 flex-shrink-0" />
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs truncate">
            {lead.source}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex space-x-2">
          {lead.phone && (
            <button className="text-green-600 hover:text-green-700 transition-colors">
              <Phone className="h-4 w-4" />
            </button>
          )}
          {lead.email && (
            <button className="text-blue-600 hover:text-blue-700 transition-colors">
              <Mail className="h-4 w-4" />
            </button>
          )}
        </div>
        <button className="text-orange-600 hover:text-orange-700 transition-colors">
          <Calendar className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  column: typeof KANBAN_COLUMNS[0]
  leads: Lead[]
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: string) => void
}

function KanbanColumn({ column, leads, onEdit, onDelete, onStatusChange }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  
  const columnLeads = leads.filter(lead => lead.status === column.id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const leadId = e.dataTransfer.getData('text/plain')
    onStatusChange(leadId, column.id)
  }

  return (
    <div className="flex-shrink-0 w-80">
      <div 
        className={`rounded-lg border-2 border-dashed p-4 transition-all ${column.color} ${
          isDragOver ? 'border-solid bg-opacity-50' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-900">{column.title}</h3>
            <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
              {columnLeads.length}
            </span>
          </div>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {columnLeads.map(lead => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))}
          {columnLeads.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Nenhum lead</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (leadData: Partial<Lead>) => void
  editingLead?: Lead | null
}

function NewLeadModal({ isOpen, onClose, onSave, editingLead }: NewLeadModalProps) {
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
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name,
        responsible_name: editingLead.responsible_name,
        phone: editingLead.phone || '',
        email: editingLead.email || '',
        grade_interest: editingLead.grade_interest,
        source: editingLead.source,
        notes: editingLead.notes || ''
      })
    } else {
      setFormData({
        student_name: '',
        responsible_name: '',
        phone: '',
        email: '',
        grade_interest: '',
        source: '',
        notes: ''
      })
    }
  }, [editingLead, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Aluno *
              </label>
              <input
                type="text"
                required
                value={formData.student_name}
                onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Série de Interesse *
              </label>
              <select
                required
                value={formData.grade_interest}
                onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecionar série...</option>
                <option value="Infantil">Educação Infantil</option>
                <option value="1º Ano">1º Ano</option>
                <option value="2º Ano">2º Ano</option>
                <option value="3º Ano">3º Ano</option>
                <option value="4º Ano">4º Ano</option>
                <option value="5º Ano">5º Ano</option>
                <option value="6º Ano">6º Ano</option>
                <option value="7º Ano">7º Ano</option>
                <option value="8º Ano">8º Ano</option>
                <option value="9º Ano">9º Ano</option>
                <option value="1º Médio">1º Ano Médio</option>
                <option value="2º Médio">2º Ano Médio</option>
                <option value="3º Médio">3º Ano Médio</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Origem *
              </label>
              <select
                required
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Selecionar origem...</option>
                <option value="Facebook">Facebook</option>
                <option value="Instagram">Instagram</option>
                <option value="Google">Google</option>
                <option value="Indicação">Indicação</option>
                <option value="Site">Site</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Observações sobre o lead..."
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {editingLead ? 'Atualizar' : 'Criar'} Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

  useEffect(() => {
    if (user?.institution_id) {
      loadLeads()
    }
  }, [user])

  const loadLeads = async () => {
    try {
      setLoading(true)
      const data = await DatabaseService.getLeads(user!.institution_id)
      setLeads(data)
    } catch (error) {
      console.error('Error loading leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveLead = async (leadData: Partial<Lead>) => {
    try {
      const dataWithInstitution = {
        ...leadData,
        institution_id: user!.institution_id,
        status: editingLead?.status || 'new'
      }

      if (editingLead) {
        await DatabaseService.updateLead(editingLead.id, dataWithInstitution)
      } else {
        await DatabaseService.createLead(dataWithInstitution)
      }

      await loadLeads()
      setEditingLead(null)
    } catch (error) {
      console.error('Error saving lead:', error)
    }
  }

  const handleEditLead = (lead: Lead) => {
    setEditingLead(lead)
    setShowNewLeadModal(true)
  }

  const handleDeleteLead = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este lead?')) {
      try {
        // Implementation would delete from Supabase
        await loadLeads()
      } catch (error) {
        console.error('Error deleting lead:', error)
      }
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await DatabaseService.updateLead(leadId, { status: newStatus as any })
      await loadLeads()
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
  }

  const handleNewLead = () => {
    setEditingLead(null)
    setShowNewLeadModal(true)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="flex space-x-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="w-80 h-96 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kanban de Leads</h1>
          <p className="text-gray-600">Gerencie o funil de vendas</p>
        </div>
        <button 
          onClick={handleNewLead}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex space-x-6 overflow-x-auto pb-6">
        {KANBAN_COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            leads={leads}
            onEdit={handleEditLead}
            onDelete={handleDeleteLead}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>

      {/* New/Edit Lead Modal */}
      <NewLeadModal
        isOpen={showNewLeadModal}
        onClose={() => {
          setShowNewLeadModal(false)
          setEditingLead(null)
        }}
        onSave={handleSaveLead}
        editingLead={editingLead}
      />
    </div>
  )
}