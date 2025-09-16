import React, { useState } from 'react'
import { Plus, Phone, Mail, Calendar, MoreHorizontal, User, GraduationCap, Tag } from 'lucide-react'

interface Lead {
  id: string
  studentName: string
  responsibleName: string
  gradeInterest: string
  source: string
  phone?: string
  email?: string
  assignedTo?: string
  status: string
}

const KANBAN_COLUMNS = [
  { id: 'new', title: 'Novo', color: 'bg-gray-100 border-gray-300', count: 12 },
  { id: 'contact', title: 'Contato', color: 'bg-blue-100 border-blue-300', count: 8 },
  { id: 'scheduled', title: 'Agendado', color: 'bg-yellow-100 border-yellow-300', count: 5 },
  { id: 'visit', title: 'Visita', color: 'bg-orange-100 border-orange-300', count: 3 },
  { id: 'proposal', title: 'Proposta', color: 'bg-purple-100 border-purple-300', count: 4 },
  { id: 'enrolled', title: 'Matrícula', color: 'bg-green-100 border-green-300', count: 7 },
]

const SAMPLE_LEADS: Lead[] = [
  {
    id: '1',
    studentName: 'Ana Silva',
    responsibleName: 'Maria Silva',
    gradeInterest: '1º Ano Fundamental',
    source: 'Facebook',
    phone: '(11) 99999-9999',
    email: 'maria@email.com',
    status: 'new'
  },
  {
    id: '2',
    studentName: 'João Santos',
    responsibleName: 'José Santos',
    gradeInterest: '3º Ano Médio',
    source: 'Indicação',
    phone: '(11) 88888-8888',
    status: 'contact'
  },
  {
    id: '3',
    studentName: 'Carolina Lima',
    responsibleName: 'Patricia Lima',
    gradeInterest: '5º Ano Fundamental',
    source: 'Google Ads',
    email: 'patricia@email.com',
    status: 'scheduled'
  }
]

interface LeadCardProps {
  lead: Lead
  onEdit: (lead: Lead) => void
}

function LeadCard({ lead, onEdit }: LeadCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3 hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-gray-900 text-sm">{lead.studentName}</h4>
        <button 
          onClick={() => onEdit(lead)}
          className="text-gray-400 hover:text-gray-600"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <User className="h-3 w-3 mr-2" />
          <span>{lead.responsibleName}</span>
        </div>
        <div className="flex items-center">
          <GraduationCap className="h-3 w-3 mr-2" />
          <span>{lead.gradeInterest}</span>
        </div>
        <div className="flex items-center">
          <Tag className="h-3 w-3 mr-2" />
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
            {lead.source}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <div className="flex space-x-2">
          {lead.phone && (
            <button className="text-green-600 hover:text-green-700">
              <Phone className="h-4 w-4" />
            </button>
          )}
          {lead.email && (
            <button className="text-blue-600 hover:text-blue-700">
              <Mail className="h-4 w-4" />
            </button>
          )}
        </div>
        <button className="text-orange-600 hover:text-orange-700">
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
}

function KanbanColumn({ column, leads, onEdit }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-80">
      <div className={`rounded-lg border-2 border-dashed ${column.color} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <h3 className="font-semibold text-gray-900">{column.title}</h3>
            <span className="ml-2 bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
              {column.count}
            </span>
          </div>
          <button className="text-gray-500 hover:text-gray-700">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {leads
            .filter(lead => lead.status === column.id)
            .map(lead => (
              <LeadCard key={lead.id} lead={lead} onEdit={onEdit} />
            ))
          }
        </div>
      </div>
    </div>
  )
}

export default function LeadKanban() {
  const [leads] = useState<Lead[]>(SAMPLE_LEADS)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead)
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
          onClick={() => setShowNewLeadModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
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
          />
        ))}
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Detalhes do Lead</h2>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do Aluno
                </label>
                <input
                  type="text"
                  value={selectedLead.studentName}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Responsável
                </label>
                <input
                  type="text"
                  value={selectedLead.responsibleName}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Série de Interesse
                </label>
                <input
                  type="text"
                  value={selectedLead.gradeInterest}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Origem
                </label>
                <input
                  type="text"
                  value={selectedLead.source}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  readOnly
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-2">
              <button 
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}