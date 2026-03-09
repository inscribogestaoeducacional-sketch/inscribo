import React, { useState, useEffect } from 'react'
import {
  Plus, User, Phone, Calendar, Edit, Trash2, X, Search,
  Clock, Tag, Users, Send, CheckCircle, Save, MoreVertical
} from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Lead } from '../../lib/supabase'

// ─── Config ───────────────────────────────────────────────────────────────────
const statusConfig = {
  new:       { label: 'Novo',             accent: '#6b7280', headerBg: 'bg-gray-100',   headerText: 'text-gray-700',   badgeBg: 'bg-gray-500'   },
  contact:   { label: 'Em Contato',       accent: '#3b82f6', headerBg: 'bg-blue-50',    headerText: 'text-blue-800',   badgeBg: 'bg-blue-500'   },
  scheduled: { label: 'Visita Agendada',  accent: '#f59e0b', headerBg: 'bg-amber-50',   headerText: 'text-amber-800',  badgeBg: 'bg-amber-500'  },
  visit:     { label: 'Visitou',          accent: '#f97316', headerBg: 'bg-orange-50',  headerText: 'text-orange-800', badgeBg: 'bg-orange-500' },
  proposal:  { label: 'Proposta',         accent: '#8b5cf6', headerBg: 'bg-purple-50',  headerText: 'text-purple-800', badgeBg: 'bg-purple-500' },
  enrolled:  { label: 'Matriculado',      accent: '#22c55e', headerBg: 'bg-green-50',   headerText: 'text-green-800',  badgeBg: 'bg-green-500'  },
  lost:      { label: 'Perdido',          accent: '#ef4444', headerBg: 'bg-red-50',     headerText: 'text-red-800',    badgeBg: 'bg-red-500'    },
}

const sourceOptions = ['Facebook', 'Instagram', 'Google', 'Site', 'Indicação', 'WhatsApp', 'Outros']

const gradeOptions = [
  'Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
  '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
  '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
  '1ª Série EM', '2ª Série EM', '3ª Série EM'
]

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

// Shared input/button classes
const inputCls = 'w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] transition-all outline-none'
const btnPrimary = 'px-6 py-3 bg-gradient-to-r from-[#14b8a6] to-[#1e2d6b] text-white rounded-xl hover:from-[#0d9488] hover:to-[#151b4e] transition-all font-semibold shadow-md hover:shadow-lg flex items-center gap-2'

// ─── NewLeadModal ─────────────────────────────────────────────────────────────
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
      setFormData({ student_name: '', grade_interest: '', cpf: '', responsible_name: '', phone: '', email: '', address: '', budget_range: '', source: '', notes: '' })
    }
    setCurrentStep(1)
  }, [editingLead, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
    onClose()
  }

  if (!isOpen) return null

  const stepLabels = ['Dados do Aluno', 'Dados do Responsável', 'Informações Adicionais']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#1e2d6b]">{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                step === currentStep ? 'bg-[#14b8a6] text-white shadow-md' :
                step < currentStep ? 'bg-[#1e2d6b] text-white' : 'bg-gray-100 text-gray-400'
              }`}>{step}</div>
              {step < 3 && <div className={`w-16 h-1 mx-2 rounded-full transition-all ${step < currentStep ? 'bg-[#1e2d6b]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-semibold text-gray-500 mb-6">{stepLabels[currentStep - 1]}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Aluno *</label>
                  <input type="text" required value={formData.student_name}
                    onChange={(e) => setFormData({ ...formData, student_name: e.target.value })}
                    className={inputCls} placeholder="Nome completo do aluno" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Série/Ano de Interesse *</label>
                  <select required value={formData.grade_interest}
                    onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })}
                    className={inputCls}>
                    <option value="">Selecione a série</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">CPF do Aluno</label>
                <input type="text" value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  className={inputCls} placeholder="000.000.000-00" />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nome do Responsável *</label>
                <input type="text" required value={formData.responsible_name}
                  onChange={(e) => setFormData({ ...formData, responsible_name: e.target.value })}
                  className={inputCls} placeholder="Nome completo do responsável" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Telefone *</label>
                  <input type="tel" required value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputCls} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">E-mail</label>
                  <input type="email" value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputCls} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Endereço</label>
                <input type="text" value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className={inputCls} placeholder="Endereço completo" />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Faixa de Orçamento</label>
                  <select value={formData.budget_range}
                    onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                    className={inputCls}>
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
                    className={inputCls}>
                    <option value="">Selecione a origem</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
                <textarea value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={inputCls} rows={4} placeholder="Informações adicionais sobre o lead" />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-5 border-t border-gray-200">
            <div>
              {currentStep > 1 && (
                <button type="button" onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-semibold">
                  Anterior
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-semibold">
                Cancelar
              </button>
              {currentStep < 3 ? (
                <button type="button" onClick={() => setCurrentStep(currentStep + 1)}
                  className={btnPrimary}>
                  Próximo
                </button>
              ) : (
                <button type="submit" className={btnPrimary}>
                  <Save className="w-4 h-4" />
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

// ─── ScheduleVisitModal ────────────────────────────────────────────────────────
interface ScheduleVisitModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
  onSchedule: (data: { scheduled_date: string; scheduled_time: string; notes: string }) => void
}

function ScheduleVisitModal({ isOpen, onClose, lead, onSchedule }: ScheduleVisitModalProps) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduledDate || !scheduledTime) { alert('Por favor, selecione data e horário!'); return }
    onSchedule({ scheduled_date: scheduledDate, scheduled_time: scheduledTime, notes })
    setScheduledDate(''); setScheduledTime(''); setNotes('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-2xl shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d6b]">Agendar Visita</h2>
            <p className="text-gray-500 text-sm mt-1">Lead: <span className="font-semibold text-gray-700">{lead.student_name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[#1e2d6b]/5 rounded-xl p-5 mb-6 border border-[#1e2d6b]/10">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="font-semibold text-gray-600">Responsável:</span><p className="text-gray-900 mt-0.5">{lead.responsible_name}</p></div>
            <div><span className="font-semibold text-gray-600">Série:</span><p className="text-gray-900 mt-0.5">{lead.grade_interest}</p></div>
            <div><span className="font-semibold text-gray-600">Telefone:</span><p className="text-gray-900 mt-0.5">{lead.phone || 'Não informado'}</p></div>
            <div><span className="font-semibold text-gray-600">Origem:</span><p className="text-gray-900 mt-0.5">{lead.source}</p></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#14b8a6]" /> Data *
              </label>
              <input type="date" required value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#14b8a6]" /> Horário *
              </label>
              <select required value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={inputCls}>
                <option value="">Selecione o horário</option>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {scheduledDate && scheduledTime && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-green-900 text-sm">Visita agendada para:</p>
                <p className="text-green-700 text-sm">
                  {new Date(scheduledDate).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} às {scheduledTime}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className={inputCls} rows={3} placeholder="Informações importantes sobre a visita..." />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold transition-all">
              Cancelar
            </button>
            <button type="submit" className={btnPrimary}>
              <Save className="w-4 h-4" />
              Confirmar Agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── HistoryModal ─────────────────────────────────────────────────────────────
interface HistoryModalProps {
  isOpen: boolean; onClose: () => void; lead: Lead | null; history: any[]; loading: boolean
  newAction: string; setNewAction: (t: string) => void; savingAction: boolean
  editingAction: string | null; setEditingAction: (id: string | null) => void
  editingActionText: string; setEditingActionText: (t: string) => void
  onAddAction: () => void; onSaveEditAction: (id: string) => void; onDeleteAction: (id: string) => void
}

function HistoryModal({ isOpen, onClose, lead, history, loading, newAction, setNewAction, savingAction,
  editingAction, setEditingAction, editingActionText, setEditingActionText,
  onAddAction, onSaveEditAction, onDeleteAction }: HistoryModalProps) {
  if (!isOpen || !lead) return null

  const formatDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d6b]">Histórico do Lead</h2>
            <p className="text-gray-500 text-sm mt-1"><span className="font-semibold text-gray-700">{lead.student_name}</span> — {lead.responsible_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[#1e2d6b]/5 rounded-xl p-5 mb-6 border border-[#1e2d6b]/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="font-semibold text-gray-600">Série:</span><p className="text-gray-900 mt-0.5">{lead.grade_interest}</p></div>
            <div><span className="font-semibold text-gray-600">Origem:</span><p className="text-gray-900 mt-0.5">{lead.source}</p></div>
            {lead.phone && <div><span className="font-semibold text-gray-600">Telefone:</span><p className="text-gray-900 mt-0.5">{lead.phone}</p></div>}
            <div><span className="font-semibold text-gray-600">Status:</span><p className="text-gray-900 mt-0.5">{statusConfig[lead.status]?.label}</p></div>
          </div>
        </div>

        {/* Add action */}
        <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#14b8a6]" /> Adicionar Ação Manual
          </h3>
          <div className="flex gap-3">
            <input type="text" value={newAction} onChange={(e) => setNewAction(e.target.value)}
              placeholder="Descreva a ação realizada..."
              className={inputCls + ' flex-1'}
              onKeyDown={(e) => e.key === 'Enter' && onAddAction()} />
            <button onClick={onAddAction} disabled={!newAction.trim() || savingAction}
              className={btnPrimary + ' disabled:opacity-50 disabled:cursor-not-allowed'}>
              {savingAction ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Salvando...</> : <><Send className="w-4 h-4" />Adicionar</>}
            </button>
          </div>
        </div>

        {/* History list */}
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#14b8a6]" /> Histórico de Atividades
        </h3>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-[#14b8a6] border-t-transparent" /></div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-gray-200">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma atividade registrada ainda</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((item) => (
              <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{item.action}</span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">por {item.user_name}</span>
                    </div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{formatDateTime(item.created_at)}
                    </p>
                  </div>
                  {item.action === 'Ação manual adicionada' && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingAction(item.id); setEditingActionText(item.details?.description || '') }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteAction(item.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {editingAction === item.id ? (
                  <div className="mt-3">
                    <input type="text" value={editingActionText}
                      onChange={(e) => setEditingActionText(e.target.value)}
                      className={inputCls + ' mb-2'} />
                    <div className="flex gap-2">
                      <button onClick={() => onSaveEditAction(item.id)}
                        className="px-4 py-2 bg-[#14b8a6] text-white rounded-lg text-sm font-semibold">Salvar</button>
                      <button onClick={() => setEditingAction(null)}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {item.details?.description && <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{item.details.description}</p>}
                    {item.details?.changes && (
                      <div className="text-sm">
                        <p className="font-medium text-gray-600 mb-1 text-xs uppercase tracking-wide">Alterações:</p>
                        <ul className="list-disc list-inside text-gray-600 bg-gray-50 px-3 py-2 rounded-lg text-xs">
                          {Object.entries(item.details.changes).map(([key, value]) => (
                            <li key={key}><span className="font-medium">{key}:</span> {value as string}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {item.details?.previous_status && item.details?.new_status && (
                      <div className="flex items-center gap-2 text-xs mt-2">
                        <span className="px-2 py-1 bg-gray-100 rounded-full border border-gray-200 font-medium">
                          {statusConfig[item.details.previous_status as keyof typeof statusConfig]?.label}
                        </span>
                        <span className="font-bold text-[#14b8a6]">→</span>
                        <span className="px-2 py-1 bg-[#14b8a6]/10 text-[#0d9488] rounded-full font-medium border border-[#14b8a6]/20">
                          {statusConfig[item.details.new_status as keyof typeof statusConfig]?.label}
                        </span>
                      </div>
                    )}
                    {item.details?.scheduled_time && <p className="text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">🕐 Horário: {item.details.scheduled_time}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-6 pt-5 border-t border-gray-200">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── CardContent ──────────────────────────────────────────────────────────────
interface CardContentProps {
  lead: Lead
  config: { accent: string; headerBg: string; headerText: string; badgeBg: string; label: string }
  isFlashing: boolean
  overlay?: boolean
  openMenuId: string | null
  setOpenMenuId: (id: string | null) => void
  onSchedule: (lead: Lead) => void
  onHistory: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Lead['status']) => void
}

function CardContent({ lead, config, isFlashing, overlay, openMenuId, setOpenMenuId, onSchedule, onHistory, onEdit, onDelete, onStatusChange }: CardContentProps) {
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR')

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 group relative transition-all ${
        isFlashing
          ? 'ring-2 ring-green-400 shadow-green-100 bg-green-50/30'
          : overlay
          ? 'shadow-2xl'
          : 'hover:shadow-md hover:border-[#14b8a6]/40'
      }`}
      style={{ borderLeft: `3px solid ${config.accent}` }}
      onClick={() => !overlay && setOpenMenuId(null)}
    >
      <div className="p-4">
        {/* Card header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-[#1e2d6b] text-sm leading-tight truncate group-hover:text-[#14b8a6] transition-colors">
              {lead.student_name}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.responsible_name}</p>
          </div>

          {/* 3-dot menu */}
          {!overlay && (
            <div className="relative ml-2 flex-shrink-0">
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === lead.id ? null : lead.id) }}
                className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              {openMenuId === lead.id && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                  {[
                    { icon: <Calendar className="w-4 h-4 text-amber-500" />, label: 'Agendar Visita', action: () => { onSchedule(lead); setOpenMenuId(null) } },
                    { icon: <Clock className="w-4 h-4 text-[#14b8a6]" />, label: 'Ver Histórico', action: () => { onHistory(lead); setOpenMenuId(null) } },
                    { icon: <Edit className="w-4 h-4 text-blue-500" />, label: 'Editar', action: () => { onEdit(lead); setOpenMenuId(null) } },
                    { icon: <Trash2 className="w-4 h-4 text-red-500" />, label: 'Excluir', action: () => { onDelete(lead.id); setOpenMenuId(null) } },
                  ].map((item, i, arr) => (
                    <button key={item.label}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); item.action() }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                    >
                      {item.icon}
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grade chip */}
        {lead.grade_interest && (
          <div className="inline-flex items-center gap-1 bg-[#14b8a6]/10 text-[#0d9488] text-xs font-semibold px-2.5 py-1 rounded-full border border-[#14b8a6]/20 mb-3">
            <User className="w-3 h-3" />
            {lead.grade_interest}
          </div>
        )}

        {/* Phone */}
        {lead.phone && (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2.5 py-1.5 rounded-lg mb-2 border border-green-100">
            <Phone className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
            <span className="truncate font-medium">{lead.phone}</span>
          </div>
        )}

        {/* Source tag */}
        {lead.source && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Tag className="w-3 h-3" />
            <span>{lead.source}</span>
          </div>
        )}

        {/* Notes */}
        {lead.notes && (
          <p className="text-xs text-gray-500 bg-gray-50 px-2.5 py-2 rounded-lg mb-3 line-clamp-2 leading-relaxed border border-gray-100">
            {lead.notes}
          </p>
        )}

        {/* Footer */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400 flex items-center gap-1 mb-2">
            <Calendar className="w-3 h-3" />
            {formatDate(lead.created_at)}
          </p>
          {!overlay && (
            <select
              value={lead.status}
              onPointerDown={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); onStatusChange(lead.id, e.target.value as Lead['status']) }}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-xs font-semibold border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] bg-white hover:bg-gray-50 transition-all cursor-pointer outline-none"
              style={{ color: config.accent }}
            >
              {Object.entries(statusConfig).map(([value, cfg]) => (
                <option key={value} value={value}>{cfg.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
function SortableCard(props: Omit<CardContentProps, 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.lead.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <CardContent {...props} />
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
function DroppableColumn({ id, isOver, children }: { id: string; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto space-y-3 p-3 rounded-b-xl transition-all duration-200 ${
        isOver
          ? 'bg-[#14b8a6]/8 ring-2 ring-dashed ring-[#14b8a6] ring-inset'
          : 'bg-gray-100/60'
      }`}
      style={{ maxHeight: '72vh' }}
    >
      {children}
    </div>
  )
}

// ─── LeadKanban ───────────────────────────────────────────────────────────────
export default function LeadKanban() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
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
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  // Drag & drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [flashingLeadId, setFlashingLeadId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  useEffect(() => {
    if (user?.institution_id) loadData()
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const [leadsData, usersData] = await Promise.all([
        DatabaseService.getLeads(user!.institution_id),
        DatabaseService.getUsers(user!.institution_id)
      ])
      setLeads(leadsData)
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
          if (newValue !== oldValue && newValue !== undefined && newValue !== null && newValue !== '') { changes[key] = newValue; previousData[key] = oldValue }
        })
        if (Object.keys(changes).length > 0) {
          await DatabaseService.logActivity({ user_id: user!.id, action: 'Lead editado', entity_type: 'lead', entity_id: editingLead.id, details: { changes, previous: previousData, student_name: data.student_name || editingLead.student_name, responsible_name: data.responsible_name || editingLead.responsible_name }, institution_id: user!.institution_id })
        }
      } else {
        const newLead = await DatabaseService.createLead(leadData)
        await DatabaseService.logActivity({ user_id: user!.id, action: 'Lead criado', entity_type: 'lead', entity_id: newLead.id, details: { student_name: newLead.student_name, responsible_name: newLead.responsible_name, source: newLead.source, grade_interest: newLead.grade_interest, phone: newLead.phone || '', email: newLead.email || '', address: newLead.address || '', budget_range: newLead.budget_range || '', notes: newLead.notes || '' }, institution_id: user!.institution_id })
      }
      await loadData(); setEditingLead(null)
    } catch (error) {
      console.error('Erro ao salvar lead:', error); setError('Erro ao salvar lead: ' + (error as Error).message)
    }
  }

  const handleStatusChange = async (leadId: string, newStatus: Lead['status']) => {
    try {
      const currentLead = leads.find(l => l.id === leadId)
      const previousStatus = currentLead?.status
      await DatabaseService.updateLead(leadId, { status: newStatus })
      if (currentLead && previousStatus !== newStatus) {
        await DatabaseService.logActivity({ user_id: user!.id, action: 'Status alterado', entity_type: 'lead', entity_id: leadId, details: { previous_status: previousStatus, new_status: newStatus, student_name: currentLead.student_name, responsible_name: currentLead.responsible_name }, institution_id: user!.institution_id })
      }
      await loadData()
    } catch (error) {
      console.error('Erro ao atualizar status:', error); setError('Erro ao atualizar status do lead')
    }
  }

  const handleDelete = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || !confirm(`Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`)) return
    try {
      await DatabaseService.deleteLead(leadId); await loadData()
    } catch (error) {
      console.error('Erro ao excluir lead:', error); setError('Erro ao excluir lead: ' + (error as Error).message)
    }
  }

  const handleScheduleVisit = async (data: { scheduled_date: string; scheduled_time: string; notes: string }) => {
    if (!leadToSchedule) return
    try {
      const [hours, minutes] = data.scheduled_time.split(':')
      const [year, month, day] = data.scheduled_date.split('-')
      const visitDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes), 0, 0)
      await DatabaseService.createVisit({ institution_id: user!.institution_id, lead_id: leadToSchedule.id, student_name: leadToSchedule.student_name, scheduled_date: visitDate.toISOString(), notes: data.notes, status: 'scheduled' })
      await DatabaseService.updateLead(leadToSchedule.id, { status: 'scheduled' })
      await DatabaseService.logActivity({ user_id: user!.id, action: 'Visita agendada', entity_type: 'lead', entity_id: leadToSchedule.id, details: { scheduled_date: data.scheduled_date, scheduled_time: data.scheduled_time, notes: data.notes, student_name: leadToSchedule.student_name, responsible_name: leadToSchedule.responsible_name }, institution_id: user!.institution_id })
      await loadData(); setShowScheduleVisitModal(false); setLeadToSchedule(null)
      alert('Visita agendada com sucesso!')
    } catch (error) {
      console.error('Erro ao agendar visita:', error); setError('Erro ao agendar visita: ' + (error as Error).message)
    }
  }

  const loadLeadHistory = async (leadId: string) => {
    try {
      setLoadingHistory(true)
      const allUsers = await DatabaseService.getUsers(user!.institution_id)
      const history = await DatabaseService.getActivityLogs(user!.institution_id, leadId)
      setLeadHistory(history.map(item => {
        const foundUser = allUsers.find(u => u.id === item.user_id)
        return { ...item, user_name: foundUser ? foundUser.full_name : (item.user_id === user?.id ? user?.full_name || 'Você' : 'Usuário desconhecido') }
      }))
    } catch (error) {
      console.error('Erro ao carregar histórico:', error); setLeadHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleAddAction = async () => {
    if (!newAction.trim() || !selectedLead) return
    try {
      setSavingAction(true)
      await DatabaseService.logActivity({ user_id: user!.id, action: 'Ação manual adicionada', entity_type: 'lead', entity_id: selectedLead.id, details: { description: newAction.trim(), student_name: selectedLead.student_name, responsible_name: selectedLead.responsible_name }, institution_id: user!.institution_id })
      await loadLeadHistory(selectedLead.id); setNewAction('')
    } catch (error) {
      console.error('Erro ao salvar ação:', error); setError('Erro ao adicionar ação ao histórico')
    } finally {
      setSavingAction(false)
    }
  }

  const handleSaveEditAction = async (actionId: string) => {
    if (!editingActionText.trim()) return
    try {
      await DatabaseService.updateActivityLog(actionId, { details: { ...leadHistory.find(h => h.id === actionId)?.details, description: editingActionText.trim() } })
      await loadLeadHistory(selectedLead!.id); setEditingAction(null); setEditingActionText('')
    } catch (error) {
      console.error('Erro ao atualizar ação:', error); setError('Erro ao atualizar ação')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ação?\n\nEsta ação não pode ser desfeita.')) return
    try {
      await DatabaseService.deleteActivityLog(actionId); await loadLeadHistory(selectedLead!.id)
    } catch (error) {
      console.error('Erro ao excluir ação:', error); setError('Erro ao excluir ação')
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

  const getLeadStats = () => {
    const total = leads.length, thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = leads.filter(l => l.created_at.startsWith(thisMonth)).length
    const converted = leads.filter(l => l.status === 'enrolled').length
    const conversionRate = total > 0 ? (converted / total) * 100 : 0
    return { total, newThisMonth, converted, conversionRate }
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setOpenMenuId(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverColumnId(null); return }
    const overId = over.id as string
    if (Object.keys(statusConfig).includes(overId)) {
      setOverColumnId(overId)
    } else {
      const overLead = leads.find(l => l.id === overId)
      setOverColumnId(overLead ? overLead.status : null)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverColumnId(null)

    if (!over) return

    const overId = over.id as string
    let targetStatus: Lead['status'] | null = null

    if (Object.keys(statusConfig).includes(overId)) {
      targetStatus = overId as Lead['status']
    } else {
      const overLead = leads.find(l => l.id === overId)
      if (overLead) targetStatus = overLead.status
    }

    if (!targetStatus) return

    const draggedLead = leads.find(l => l.id === active.id as string)
    if (!draggedLead || draggedLead.status === targetStatus) return

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: targetStatus! } : l))

    // Green flash for 1 second
    setFlashingLeadId(active.id as string)
    setTimeout(() => setFlashingLeadId(null), 1000)

    // Persist to DB
    handleStatusChange(active.id as string, targetStatus)
  }

  const stats = getLeadStats()
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#14b8a6] border-t-transparent mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Carregando leads...</p>
        </div>
      </div>
    )
  }

  // ── Visible columns (filtered by status dropdown) ────────────────────────────
  const visibleStatuses = filterStatus
    ? Object.keys(statusConfig).filter(s => s === filterStatus)
    : Object.keys(statusConfig)

  // Shared card action props
  const cardActions = {
    openMenuId,
    setOpenMenuId,
    onSchedule: (lead: Lead) => { setLeadToSchedule(lead); setShowScheduleVisitModal(true) },
    onHistory: (lead: Lead) => { setSelectedLead(lead); setShowHistory(true); setNewAction(''); setEditingAction(null); setEditingActionText(''); loadLeadHistory(lead.id) },
    onEdit: (lead: Lead) => { setEditingLead(lead); setShowNewLeadModal(true) },
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1e2d6b]">Leads</h1>
          <span className="px-3 py-1 bg-[#14b8a6]/10 text-[#0d9488] text-sm font-bold rounded-full border border-[#14b8a6]/20">
            {stats.total}
          </span>
        </div>
        <button
          onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
          className={btnPrimary}
        >
          <Plus className="h-4 w-4" />
          Novo Lead
        </button>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all text-sm shadow-sm"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none text-sm shadow-sm text-gray-700"
        >
          <option value="">Todos os status</option>
          {Object.entries(statusConfig).map(([value, cfg]) => (
            <option key={value} value={value}>{cfg.label}</option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none text-sm shadow-sm text-gray-700"
        >
          <option value="">Todas as origens</option>
          {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm">
          <X className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── Kanban Board ───────────────────────────────────────────────────── */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {visibleStatuses.map((status) => {
              const config = statusConfig[status as keyof typeof statusConfig]
              const colLeads = getLeadsByStatus(status as Lead['status'])

              return (
                <div key={status} className="flex-shrink-0 w-[280px] flex flex-col">
                  {/* Column header */}
                  <div className={`${config.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between border-b-2`}
                    style={{ borderBottomColor: config.accent }}>
                    <span className={`text-sm font-bold ${config.headerText}`}>{config.label}</span>
                    <span className={`${config.badgeBg} text-white text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[24px] text-center`}>
                      {colLeads.length}
                    </span>
                  </div>

                  {/* Cards drop zone */}
                  <DroppableColumn id={status} isOver={overColumnId === status && activeId !== null}>
                    <SortableContext items={colLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                      {colLeads.map((lead) => (
                        <SortableCard
                          key={lead.id}
                          lead={lead}
                          config={config}
                          isFlashing={flashingLeadId === lead.id}
                          {...cardActions}
                        />
                      ))}
                    </SortableContext>

                    {colLeads.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 opacity-20"
                          style={{ backgroundColor: config.accent }}>
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <p className="text-xs text-gray-400">Nenhum lead</p>
                      </div>
                    )}
                  </DroppableColumn>
                </div>
              )
            })}
          </div>
        </div>

        {/* Drag overlay (ghost card) */}
        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[280px] rotate-1 cursor-grabbing">
              <CardContent
                lead={activeLead}
                config={statusConfig[activeLead.status]}
                isFlashing={false}
                overlay
                openMenuId={null}
                setOpenMenuId={() => {}}
                onSchedule={() => {}}
                onHistory={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
                onStatusChange={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <NewLeadModal
        isOpen={showNewLeadModal}
        onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }}
        onSave={handleSave}
        editingLead={editingLead}
      />

      {showScheduleVisitModal && leadToSchedule && (
        <ScheduleVisitModal
          isOpen={showScheduleVisitModal}
          onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }}
          lead={leadToSchedule}
          onSchedule={handleScheduleVisit}
        />
      )}

      <HistoryModal
        isOpen={showHistory}
        onClose={() => { setShowHistory(false); setSelectedLead(null) }}
        lead={selectedLead}
        history={leadHistory}
        loading={loadingHistory}
        newAction={newAction}
        setNewAction={setNewAction}
        savingAction={savingAction}
        editingAction={editingAction}
        setEditingAction={setEditingAction}
        editingActionText={editingActionText}
        setEditingActionText={setEditingActionText}
        onAddAction={handleAddAction}
        onSaveEditAction={handleSaveEditAction}
        onDeleteAction={handleDeleteAction}
      />
    </div>
  )
}
