import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus, Phone, Calendar, Edit, Edit2, Trash2, X, Search,
  Clock, Users, Send, CheckCircle, Save,
  MessageCircle, AlertTriangle, ChevronDown, ChevronRight
} from 'lucide-react'
import { logAudit } from '../../hooks/useAudit'
import AuditModal from '../common/AuditModal'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { DatabaseService, Lead, ActivityLog } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'

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

// ─── Motivos de recusa ────────────────────────────────────────────────────────
const LOST_REASONS = [
  { value: 'preco_alto',        label: 'Valor da mensalidade alto',           fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_retornou',      label: 'Não retornou nosso contato',          fator: 'Externo', subfator: null },
  { value: 'outra_escola',      label: 'Escolheu outra escola',               fator: 'Externo', subfator: null },
  { value: 'sem_vaga',          label: 'Sem vaga na série de interesse',      fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_oferece_serie', label: 'Escola não oferece a série desejada', fator: 'Interno', subfator: 'Administrativo' },
  { value: 'nao_gostou',        label: 'Não gostou da escola',                fator: 'Interno', subfator: 'Administrativo' },
  { value: 'mudou_cidade',      label: 'Mudou de cidade',                     fator: 'Externo', subfator: null },
  { value: 'dificuldade_fin',   label: 'Dificuldade financeira',              fator: 'Externo', subfator: null },
  { value: 'desistiu',          label: 'Desistiu sem informar motivo',        fator: 'Externo', subfator: null },
  { value: 'outro',             label: 'Outro motivo',                        fator: 'Interno', subfator: 'Administrativo' },
]

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

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] transition-all outline-none'
const btnPrimary = 'px-5 py-2.5 bg-gradient-to-r from-[#14b8a6] to-[#1e2d6b] text-white rounded-lg hover:from-[#0d9488] hover:to-[#151b4e] transition-all font-semibold flex items-center gap-2 text-sm'
const btnSecondary = 'px-5 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all font-semibold text-sm'

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
}

// ─── LostReasonModal ──────────────────────────────────────────────────────────
interface LostReasonModalProps {
  isOpen: boolean
  lead: Lead | null
  onConfirm: (reason: string, detail: string) => Promise<void>
  onCancel: () => void
}

function LostReasonModal({ isOpen, lead, onConfirm, onCancel }: LostReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) { setSelectedReason(''); setDetail('') }
  }, [isOpen])

  if (!isOpen || !lead) return null

  const handleConfirm = async () => {
    if (!selectedReason) return
    setSaving(true)
    try {
      await onConfirm(selectedReason, detail)
    } finally {
      setSaving(false)
    }
  }

  const selected = LOST_REASONS.find(r => r.value === selectedReason)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 520,
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #fee2e2'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: '#FEE2E2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <AlertTriangle style={{ width: 18, height: 18, color: '#EF4444' }} />
          </div>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
              Por que este lead foi perdido?
            </h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
              {lead.student_name} · {lead.responsible_name}
            </p>
          </div>
          <button onClick={onCancel} style={{
            marginLeft: 'auto', width: 28, height: 28, borderRadius: 8,
            border: '1px solid #E2E8F0', background: '#F8FAFC',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        {/* Motivos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {LOST_REASONS.map(reason => {
            const active = selectedReason === reason.value
            return (
              <button
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: active ? '2px solid #EF4444' : '1.5px solid #E2E8F0',
                  background: active ? '#FEF2F2' : '#F8FAFC',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#DC2626' : '#475569' }}>
                  {reason.label}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                    background: reason.fator === 'Externo' ? '#EFF6FF' : '#FFF7ED',
                    color: reason.fator === 'Externo' ? '#1D4ED8' : '#9A3412'
                  }}>
                    {reason.fator}
                  </span>
                  {active && <CheckCircle style={{ width: 14, height: 14, color: '#EF4444' }} />}
                </div>
              </button>
            )
          })}
        </div>

        {/* Fator identificado */}
        {selected && (
          <div style={{
            background: selected.fator === 'Externo' ? '#EFF6FF' : '#FFF7ED',
            border: `1px solid ${selected.fator === 'Externo' ? '#BFDBFE' : '#FED7AA'}`,
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: selected.fator === 'Externo' ? '#1E40AF' : '#9A3412'
          }}>
            <strong>Fator {selected.fator}</strong>
            {selected.subfator && ` · ${selected.subfator}`}
            {selected.fator === 'Externo'
              ? ' — Fatores fora do controle da escola'
              : ' — Pontos que a escola pode melhorar'}
          </div>
        )}

        {/* Detalhe opcional */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Observações adicionais (opcional)
          </label>
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="Descreva o que o responsável disse ou qualquer contexto relevante..."
            rows={2}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 9, fontSize: 13,
              border: '1.5px solid #E2E8F0', background: '#F8FAFC', outline: 'none',
              resize: 'none', boxSizing: 'border-box', color: '#1A2B4A'
            }}
          />
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0',
            background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B', fontWeight: 500
          }}>
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 20px', borderRadius: 9, background: selectedReason ? '#EF4444' : '#E2E8F0',
              color: selectedReason ? '#fff' : '#94A3B8', border: 'none',
              fontSize: 13, fontWeight: 600, cursor: selectedReason ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            {saving
              ? <><div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />Salvando...</>
              : <><AlertTriangle style={{ width: 13, height: 13 }} />Confirmar perda</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── NewLeadModal ─────────────────────────────────────────────────────────────
interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Lead>) => Promise<void>
  editingLead?: Lead | null
}

function NewLeadModal({ isOpen, onClose, onSave, editingLead }: NewLeadModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    student_name: '', grade_interest: '', responsible_name: '',
    phone: '', email: '', address: '', budget_range: '', source: '', notes: ''
  })

  useEffect(() => {
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name, grade_interest: editingLead.grade_interest,
        responsible_name: editingLead.responsible_name,
        phone: editingLead.phone || '', email: editingLead.email || '',
        address: editingLead.address || '', budget_range: editingLead.budget_range || '',
        source: editingLead.source, notes: editingLead.notes || ''
      })
    } else {
      setFormData({ student_name: '', grade_interest: '', responsible_name: '', phone: '', email: '', address: '', budget_range: '', source: '', notes: '' })
    }
    setCurrentStep(1)
    setFieldErrors({})
  }, [editingLead, isOpen])

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.student_name.trim()) errors.student_name = 'Nome do aluno é obrigatório'
    if (!formData.responsible_name.trim()) errors.responsible_name = 'Nome do responsável é obrigatório'
    if (!formData.phone.trim()) errors.phone = 'Telefone é obrigatório'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try { await onSave(formData); onClose() } finally { setSaving(false) }
  }

  if (!isOpen) return null

  const stepLabels = ['Dados do Aluno', 'Dados do Responsável', 'Informações Adicionais']

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,0.35)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', border: '0.5px solid #D1FAE5', boxShadow: '0 20px 60px rgba(0,168,150,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: 16, height: 16, color: '#00A896' }} />
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{editingLead ? 'Editar Lead' : 'Novo Lead'}</h2>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '0.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 15, height: 15, color: '#94A3B8' }} />
          </button>
        </div>

        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${step <= currentStep ? 'bg-[#14b8a6] text-white' : 'bg-gray-200 text-gray-500'}`}>{step}</div>
              {step < 3 && <div className={`w-12 h-0.5 mx-2 rounded-full transition-all ${step < currentStep ? 'bg-[#14b8a6]' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-semibold text-gray-500 mb-6">{stepLabels[currentStep - 1]}</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do Aluno *</label>
                  <input type="text" value={formData.student_name}
                    onChange={(e) => { setFormData({ ...formData, student_name: e.target.value }); setFieldErrors(prev => ({ ...prev, student_name: '' })) }}
                    className={inputCls + (fieldErrors.student_name ? ' border-red-400' : '')} placeholder="Nome completo do aluno" />
                  {fieldErrors.student_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.student_name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Série/Ano de Interesse</label>
                  <select value={formData.grade_interest} onChange={(e) => setFormData({ ...formData, grade_interest: e.target.value })} className={inputCls}>
                    <option value="">Selecione a série</option>
                    {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do Responsável *</label>
                <input type="text" value={formData.responsible_name}
                  onChange={(e) => { setFormData({ ...formData, responsible_name: e.target.value }); setFieldErrors(prev => ({ ...prev, responsible_name: '' })) }}
                  className={inputCls + (fieldErrors.responsible_name ? ' border-red-400' : '')} placeholder="Nome completo do responsável" />
                {fieldErrors.responsible_name && <p className="text-red-500 text-xs mt-1">{fieldErrors.responsible_name}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone *</label>
                  <input type="tel" value={formData.phone}
                    onChange={(e) => { setFormData({ ...formData, phone: applyPhoneMask(e.target.value) }); setFieldErrors(prev => ({ ...prev, phone: '' })) }}
                    className={inputCls + (fieldErrors.phone ? ' border-red-400' : '')} placeholder="11 99999-9999" />
                  {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputCls} placeholder="email@exemplo.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Endereço</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className={inputCls} placeholder="Endereço completo" />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Faixa de Orçamento</label>
                  <select value={formData.budget_range} onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })} className={inputCls}>
                    <option value="">Selecione a faixa</option>
                    <option value="Até R$ 500">Até R$ 500</option>
                    <option value="R$ 500 - R$ 1.000">R$ 500 - R$ 1.000</option>
                    <option value="R$ 1.000 - R$ 1.500">R$ 1.000 - R$ 1.500</option>
                    <option value="R$ 1.500 - R$ 2.000">R$ 1.500 - R$ 2.000</option>
                    <option value="Acima de R$ 2.000">Acima de R$ 2.000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Origem do Lead</label>
                  <select value={formData.source} onChange={(e) => setFormData({ ...formData, source: e.target.value })} className={inputCls}>
                    <option value="">Selecione a origem</option>
                    {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={inputCls} rows={4} placeholder="Informações adicionais sobre o lead" />
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-gray-100">
            <div>{currentStep > 1 && <button type="button" onClick={() => setCurrentStep(currentStep - 1)} className={btnSecondary}>Anterior</button>}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
              {currentStep < 3
                ? <button type="button" onClick={() => setCurrentStep(currentStep + 1)} className={btnPrimary}>Próximo</button>
                : <button type="submit" disabled={saving} className={btnPrimary + ' disabled:opacity-50 disabled:cursor-not-allowed'}>
                    {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Salvando...</> : <><Save className="w-4 h-4" />{editingLead ? 'Atualizar' : 'Salvar'} Lead</>}
                  </button>}
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Data *</label>
              <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Horário *</label>
              <select required value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inputCls}>
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
                <p className="text-green-700 text-sm">{new Date(scheduledDate).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} às {scheduledTime}</p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Observações</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} rows={3} placeholder="Informações importantes sobre a visita..." />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-6 py-3 border-2 border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-semibold transition-all">Cancelar</button>
            <button type="submit" className={btnPrimary}><Save className="w-4 h-4" />Confirmar Agendamento</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── HistoryModal ─────────────────────────────────────────────────────────────
interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead | null
  history: ActivityLog[]
  loading: boolean
  newAction: string
  setNewAction: (t: string) => void
  savingAction: boolean
  editingAction: string | null
  setEditingAction: (id: string | null) => void
  editingActionText: string
  setEditingActionText: (t: string) => void
  onAddAction: () => void
  onSaveEditAction: (id: string) => void
  onDeleteAction: (id: string) => void
  contactForm: { tipo: string; descricao: string; data: string }
  setContactForm: (f: { tipo: string; descricao: string; data: string }) => void
  showContactForm: boolean
  setShowContactForm: (v: boolean) => void
  savingContact: boolean
  onSaveContact: () => void
  onAudit?: (id: string) => void
}

function HistoryModal({
  isOpen, onClose, lead, history, loading, newAction, setNewAction, savingAction,
  editingAction, setEditingAction, editingActionText, setEditingActionText,
  onAddAction, onSaveEditAction, onDeleteAction,
  contactForm, setContactForm, showContactForm, setShowContactForm, savingContact, onSaveContact,
  onAudit,
}: HistoryModalProps) {
  const [leadTags, setLeadTags] = useState<string[]>(lead?.tags || [])
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [tagToast, setTagToast] = useState('')

  useEffect(() => { setLeadTags(lead?.tags || []) }, [lead])

  useEffect(() => {
    if (!lead?.institution_id) return
    ;(async () => {
      const { supabase: db } = await import('../../lib/supabase')
      const { data } = await db.from('whatsapp_tags')
        .select('id, name, color').eq('institution_id', lead.institution_id).order('name')
      if (data) setAvailableTags(data as { id: string; name: string; color: string }[])
    })()
  }, [lead?.institution_id])

  const handleAddLeadTag = async (tagName: string) => {
    if (!lead || leadTags.includes(tagName)) return
    const newTags = [...leadTags, tagName]
    setLeadTags(newTags)
    const { supabase: db } = await import('../../lib/supabase')
    await db.from('leads').update({ tags: newTags }).eq('id', lead.id)
    setTagToast('Etiqueta adicionada!'); setTimeout(() => setTagToast(''), 2500)
  }

  const handleRemoveLeadTag = async (tagName: string) => {
    if (!lead) return
    const newTags = leadTags.filter(t => t !== tagName)
    setLeadTags(newTags)
    const { supabase: db } = await import('../../lib/supabase')
    await db.from('leads').update({ tags: newTags }).eq('id', lead.id)
    setTagToast('Etiqueta removida!'); setTimeout(() => setTagToast(''), 2500)
  }

  if (!isOpen || !lead) return null

  const formatDateTime = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#1e2d6b]">Histórico — {lead.student_name}</h2>
            <p className="text-gray-500 text-sm mt-1"><span className="font-semibold text-gray-700">{lead.responsible_name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="bg-[#1e2d6b]/5 rounded-xl p-5 mb-6 border border-[#1e2d6b]/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="font-semibold text-gray-600">Série:</span><p className="text-gray-900 mt-0.5">{lead.grade_interest}</p></div>
            <div><span className="font-semibold text-gray-600">Origem:</span><p className="text-gray-900 mt-0.5">{lead.source}</p></div>
            {lead.phone && <div><span className="font-semibold text-gray-600">Telefone:</span><p className="text-gray-900 mt-0.5">{lead.phone}</p></div>}
            <div><span className="font-semibold text-gray-600">Status:</span><p className="text-gray-900 mt-0.5">{statusConfig[lead.status]?.label}</p></div>
          </div>
          {/* Motivo de perda se houver */}
          {lead.status === 'lost' && (lead as any).lost_reason && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '.05em' }}>Motivo de perda</span>
              <p style={{ fontSize: 13, color: '#7F1D1D', margin: '4px 0 0' }}>
                {LOST_REASONS.find(r => r.value === (lead as any).lost_reason)?.label || (lead as any).lost_reason}
              </p>
              {(lead as any).lost_reason_detail && (
                <p style={{ fontSize: 12, color: '#991B1B', margin: '4px 0 0', fontStyle: 'italic' }}>{(lead as any).lost_reason_detail}</p>
              )}
            </div>
          )}
        </div>

        {/* Etiquetas */}
        <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 20, border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>🏷️ Etiquetas</h4>
            {tagToast && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{tagToast}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {leadTags.length === 0 && (
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {availableTags.length === 0 ? 'Configure etiquetas em Configurações → Etiquetas' : 'Nenhuma etiqueta'}
              </span>
            )}
            {leadTags.map(tag => {
              const color = availableTags.find(t => t.name === tag)?.color || '#6366f1'
              return (
                <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: color, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  {tag}
                  <button onClick={() => handleRemoveLeadTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              )
            })}
          </div>
          {availableTags.length > 0 && (
            <select value="" onChange={e => { if (e.target.value) handleAddLeadTag(e.target.value) }}
              style={{ fontSize: 12, padding: '5px 10px', borderRadius: 8, border: '1px solid #D1FAE5', background: '#F0FDFB', color: '#1A2B4A', outline: 'none', cursor: 'pointer', maxWidth: 280 }}>
              <option value="">+ Adicionar etiqueta...</option>
              {availableTags.filter(t => !leadTags.includes(t.name)).map(t => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Plus className="w-4 h-4 text-[#14b8a6]" /> Registrar Contato</h3>
            <button onClick={() => setShowContactForm(!showContactForm)} className="text-xs text-[#14b8a6] hover:underline font-semibold">{showContactForm ? 'Ocultar' : 'Mostrar'}</button>
          </div>
          {showContactForm && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tipo</label>
                  <select value={contactForm.tipo} onChange={(e) => setContactForm({ ...contactForm, tipo: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none">
                    <option value="Ligação">Ligação</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Visita">Visita</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data</label>
                  <input type="date" value={contactForm.data} onChange={(e) => setContactForm({ ...contactForm, data: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Descrição</label>
                <textarea value={contactForm.descricao} onChange={(e) => setContactForm({ ...contactForm, descricao: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none" rows={2} placeholder="Descreva o contato realizado..." />
              </div>
              <div className="flex justify-end">
                <button onClick={onSaveContact} disabled={savingContact} className={btnPrimary + ' disabled:opacity-50 disabled:cursor-not-allowed text-sm py-2 px-4'}>
                  {savingContact ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Salvando...</> : <><Send className="w-3 h-3" />Registrar</>}
                </button>
              </div>
            </div>
          )}
          {!showContactForm && (
            <div className="flex gap-3">
              <input type="text" value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Descreva a ação realizada..." className={inputCls + ' flex-1'} onKeyDown={(e) => e.key === 'Enter' && onAddAction()} />
              <button onClick={onAddAction} disabled={!newAction.trim() || savingAction} className={btnPrimary + ' disabled:opacity-50 disabled:cursor-not-allowed'}>
                {savingAction ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Salvando...</> : <><Send className="w-4 h-4" />Adicionar</>}
              </button>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-[#14b8a6]" /> Histórico de Atividades</h3>
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
                    <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateTime(item.created_at)}</p>
                  </div>
                  {item.action === 'Ação manual adicionada' && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingAction(item.id); setEditingActionText(item.details?.description || '') }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => onDeleteAction(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
                {editingAction === item.id ? (
                  <div className="mt-3">
                    <input type="text" value={editingActionText} onChange={(e) => setEditingActionText(e.target.value)} className={inputCls + ' mb-2'} />
                    <div className="flex gap-2">
                      <button onClick={() => onSaveEditAction(item.id)} className="px-4 py-2 bg-[#14b8a6] text-white rounded-lg text-sm font-semibold">Salvar</button>
                      <button onClick={() => setEditingAction(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    {item.details?.description && <p className="text-sm text-gray-700 bg-gray-50 px-3 py-2 rounded-lg">{item.details.description}</p>}
                    {item.details?.lost_reason && (
                      <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '6px 10px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#DC2626' }}>Motivo: </span>
                        <span style={{ fontSize: 12, color: '#7F1D1D' }}>
                          {LOST_REASONS.find(r => r.value === item.details?.lost_reason)?.label || item.details?.lost_reason}
                        </span>
                      </div>
                    )}
                    {item.details?.previous_status && item.details?.new_status && (
                      <div className="flex items-center gap-2 text-xs mt-2">
                        <span className="px-2 py-1 bg-gray-100 rounded-full border border-gray-200 font-medium">{statusConfig[item.details.previous_status as keyof typeof statusConfig]?.label}</span>
                        <span className="font-bold text-[#14b8a6]">→</span>
                        <span className="px-2 py-1 bg-[#14b8a6]/10 text-[#0d9488] rounded-full font-medium border border-[#14b8a6]/20">{statusConfig[item.details.new_status as keyof typeof statusConfig]?.label}</span>
                      </div>
                    )}
                    {item.details?.scheduled_time && <p className="text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">🕐 Horário: {item.details.scheduled_time}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200">
          {onAudit && lead ? (
            <button onClick={() => { onAudit(lead.id); onClose() }} className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl font-semibold transition-all">
              Ver histórico de alterações
            </button>
          ) : <span />}
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-semibold transition-all">Fechar</button>
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
  onSchedule: (lead: Lead) => void
  onHistory: (lead: Lead) => void
  onAudit: (id: string) => void
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Lead['status']) => void
  onWhatsApp: (lead: Lead) => void
}

function CardContent({ lead, config, isFlashing, overlay, onSchedule, onHistory, onAudit, onEdit, onDelete, onWhatsApp }: CardContentProps) {
  const lostReason = (lead as any).lost_reason
  const lostLabel = lostReason ? LOST_REASONS.find(r => r.value === lostReason)?.label : null

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${
        isFlashing ? 'bg-teal-50/40 border-teal-400 ring-2 ring-teal-500 shadow-md animate-pulse'
        : overlay ? 'bg-white border-gray-200 shadow-xl scale-105 opacity-50'
        : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-teal-300 hover:bg-gray-50'
      }`}
      style={{ borderLeft: `3px solid ${config.accent}` }}
    >
      <div className="p-3">
        <div className="flex items-start gap-2 mb-1.5">
          <div className="w-8 h-8 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
            {lead.student_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-800 leading-tight truncate">{lead.student_name}</h4>
            <p className="text-xs text-gray-500 truncate">{lead.responsible_name}</p>
          </div>
          {!overlay && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0 transition-opacity">
              <button title="Editar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(lead) }} className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
              <button title="Excluir" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(lead.id) }} className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>

        {(lead.grade_interest || lead.source) && (
          <div className="flex flex-wrap gap-1 mb-2">
            {lead.grade_interest && <span className="inline-flex items-center bg-[#14b8a6]/10 text-[#0d9488] text-xs font-medium px-2 py-0.5 rounded-full border border-[#14b8a6]/20">{lead.grade_interest}</span>}
            {lead.source && (
              lead.source === 'embed'
                ? <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-200">Via site</span>
                : <span className="inline-flex items-center bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">{lead.source}</span>
            )}
          </div>
        )}

        {/* Motivo de perda no card */}
        {lead.status === 'lost' && lostLabel && (
          <div style={{ background: '#FEF2F2', borderRadius: 6, padding: '4px 8px', marginBottom: 6 }}>
            <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 500, margin: 0 }}>⚠ {lostLabel}</p>
          </div>
        )}

        {lead.phone && (
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onWhatsApp(lead) }} className="flex items-center gap-1.5 text-xs text-teal-600 font-medium hover:text-teal-700 transition-colors">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </button>
        )}
      </div>

      {!overlay && (
        <div className="hidden group-hover:flex bg-gray-50 border-t border-gray-100 rounded-b-xl px-3 py-2 gap-2">
          <button title="WhatsApp" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onWhatsApp(lead) }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors"><MessageCircle className="w-3 h-3" />WA</button>
          <button title="Agendar Visita" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onSchedule(lead) }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"><Calendar className="w-3 h-3" />Visita</button>
          <button title="Histórico" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAudit(lead.id) }} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"><Clock className="w-3 h-3" />Hist.</button>
        </div>
      )}
    </div>
  )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
function SortableCard(props: Omit<CardContentProps, 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.lead.id })
  return (
    <div ref={setNodeRef} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }} {...attributes} {...listeners}>
      <CardContent {...props} />
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
function DroppableColumn({ id, isOver, children }: { id: string; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`flex-1 overflow-y-auto space-y-3 p-3 rounded-b-xl transition-all duration-200 ${isOver ? 'bg-[#14b8a6]/8 ring-2 ring-dashed ring-[#14b8a6] ring-inset' : 'bg-gray-100/60'}`} style={{ maxHeight: '72vh' }}>
      {children}
    </div>
  )
}

// ─── LeadKanban ───────────────────────────────────────────────────────────────
export default function LeadKanban() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [auditLeadId, setAuditLeadId] = useState<string | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [leadHistory, setLeadHistory] = useState<ActivityLog[]>([])
  const [newAction, setNewAction] = useState('')
  const [savingAction, setSavingAction] = useState(false)
  const [editingAction, setEditingAction] = useState<string | null>(null)
  const [editingActionText, setEditingActionText] = useState('')
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)
  const [contactForm, setContactForm] = useState({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
  const [showContactForm, setShowContactForm] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [flashingLeadId, setFlashingLeadId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set(['new', 'contact']))

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Estado do modal de motivo de perda ───────────────────────────────────
  const [lostReasonModal, setLostReasonModal] = useState<{
    open: boolean
    lead: Lead | null
    pendingLeads: Lead[] | null // snapshot para revert
  }>({ open: false, lead: null, pendingLeads: null })

  useEffect(() => {
    const highlightId = searchParams.get('highlight')
    if (highlightId) { setFlashingLeadId(highlightId); setTimeout(() => setFlashingLeadId(null), 3000) }
  }, [searchParams])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const showToast = useCallback((msg: string, type: 'error' | 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => { if (user?.institution_id) loadData() }, [user])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const leadsData = await DatabaseService.getLeads(user!.institution_id)
      setLeads(leadsData)
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados dos leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Lead>) => {
    setError('')
    const leadData: Partial<Lead> = { ...data, institution_id: user!.institution_id, status: editingLead ? editingLead.status : 'new' }
    if (editingLead) {
      await DatabaseService.updateLead(editingLead.id, leadData)
      const changes: Record<string, unknown> = {}
      const previousData: Record<string, unknown> = {}
      Object.keys(data).forEach(key => {
        const newValue = (data as Record<string, unknown>)[key]
        const oldValue = (editingLead as unknown as Record<string, unknown>)[key]
        if (newValue !== oldValue && newValue !== undefined && newValue !== null && newValue !== '') { changes[key] = newValue; previousData[key] = oldValue }
      })
      if (Object.keys(changes).length > 0) {
        await DatabaseService.logActivity({ user_id: user!.id, action: 'Lead editado', entity_type: 'lead', entity_id: editingLead.id, details: { changes, previous: previousData, student_name: data.student_name || editingLead.student_name, responsible_name: data.responsible_name || editingLead.responsible_name }, institution_id: user!.institution_id })
      }
      await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: editingLead.id, action: 'updated', field_changed: 'dados', old_value: editingLead.student_name, new_value: data.student_name || editingLead.student_name, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    } else {
      const newLead = await DatabaseService.createLead(leadData)
      await DatabaseService.logActivity({ user_id: user!.id, action: 'Lead criado', entity_type: 'lead', entity_id: newLead.id, details: { student_name: newLead.student_name, responsible_name: newLead.responsible_name, source: newLead.source, grade_interest: newLead.grade_interest, phone: newLead.phone || '', email: newLead.email || '', address: newLead.address || '', budget_range: newLead.budget_range || '', notes: newLead.notes || '' }, institution_id: user!.institution_id })
      await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: newLead.id, action: 'created', new_value: `${newLead.student_name} — ${newLead.grade_interest}`, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    }
    // Sync responsible_name to whatsapp_contacts and whatsapp_conversations
    const phone = data.phone || (editingLead?.phone ?? '')
    const responsibleName = data.responsible_name || (editingLead?.responsible_name ?? '')
    if (phone && responsibleName) {
      try {
        const { supabase: db } = await import('../../lib/supabase')
        const normP = (p: string) => {
          let d = p.replace(/\D/g, '')
          if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
          if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
          if (d.length === 11) d = '55' + d
          return d
        }
        const normPhone = normP(phone)
        const instId = user!.institution_id
        await db.from('whatsapp_contacts')
          .update({ name: responsibleName })
          .eq('institution_id', instId)
          .eq('phone', normPhone)
        await db.from('whatsapp_conversations')
          .update({ contact_name: responsibleName })
          .eq('institution_id', instId)
          .eq('remote_jid', `${normPhone}@s.whatsapp.net`)
      } catch {}
    }

    await loadData()
    setEditingLead(null)
  }

  // ── handleStatusChange — intercept "lost" para pedir motivo ──────────────
  const handleStatusChange = async (leadId: string, newStatus: Lead['status'], skipLostModal = false) => {
    const currentLead = leads.find(l => l.id === leadId)
    if (!currentLead) return

    // Se está indo para "Perdido" e não veio do modal já confirmado, abre o modal
    if (newStatus === 'lost' && !skipLostModal) {
      const snapshot = [...leads]
      // Optimistic update visual
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'lost' } : l))
      setLostReasonModal({ open: true, lead: currentLead, pendingLeads: snapshot })
      return
    }

    // Salva normalmente
    try {
      const previousStatus = currentLead.status
      await DatabaseService.updateLead(leadId, { status: newStatus })
      if (previousStatus !== newStatus) {
        await DatabaseService.logActivity({ user_id: user!.id, action: 'Status alterado', entity_type: 'lead', entity_id: leadId, details: { previous_status: previousStatus, new_status: newStatus, student_name: currentLead.student_name, responsible_name: currentLead.responsible_name }, institution_id: user!.institution_id })
        await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: leadId, action: 'status_changed', old_value: previousStatus, new_value: newStatus, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
        if (newStatus === 'enrolled') {
          createNotification({
            institution_id: user!.institution_id,
            type: 'milestone',
            title: 'Nova matrícula confirmada!',
            message: `${currentLead.student_name} foi matriculado(a) com sucesso.`,
            severity: 'success',
            action_url: '/leads',
          })
        }
      }
      await loadData()
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
      setError('Erro ao atualizar status do lead')
      throw err
    }
  }

  // ── Confirmar perda com motivo ─────────────────────────────────────────────
  const handleConfirmLost = async (reason: string, detail: string) => {
    const lead = lostReasonModal.lead
    if (!lead) return
    try {
      const { supabase: db } = await import('../../lib/supabase')

      // Salva status + motivo
      await db.from('leads').update({
        status: 'lost',
        lost_reason: reason,
        lost_reason_detail: detail || null,
      }).eq('id', lead.id)

      // Log de atividade
      await DatabaseService.logActivity({
        user_id: user!.id,
        action: 'Lead perdido',
        entity_type: 'lead',
        entity_id: lead.id,
        details: {
          previous_status: lead.status,
          new_status: 'lost',
          lost_reason: reason,
          lost_reason_detail: detail,
          student_name: lead.student_name,
          responsible_name: lead.responsible_name,
        },
        institution_id: user!.institution_id,
      })

      await logAudit({
        institution_id: user!.institution_id,
        module: 'leads',
        record_id: lead.id,
        action: 'status_changed',
        old_value: lead.status,
        new_value: 'lost',
        user_id: user!.id,
        user_name: user!.full_name,
        user_role: user!.role,
      })

      setLostReasonModal({ open: false, lead: null, pendingLeads: null })
      await loadData()
      showToast('Lead marcado como perdido.', 'success')
    } catch (err) {
      console.error('Erro ao salvar motivo de perda:', err)
      // Revert
      if (lostReasonModal.pendingLeads) setLeads(lostReasonModal.pendingLeads)
      setLostReasonModal({ open: false, lead: null, pendingLeads: null })
      showToast('Erro ao salvar motivo. Tente novamente.', 'error')
    }
  }

  // ── Cancelar modal de perda — revert ──────────────────────────────────────
  const handleCancelLost = () => {
    if (lostReasonModal.pendingLeads) setLeads(lostReasonModal.pendingLeads)
    setLostReasonModal({ open: false, lead: null, pendingLeads: null })
  }

  const handleDelete = async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || !confirm(`Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`)) return
    try {
      const { supabase: db } = await import('../../lib/supabase')
      await db.from('leads').update({ deleted_at: new Date().toISOString(), deleted_by: user!.full_name }).eq('id', leadId)
      await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: leadId, action: 'deleted', old_value: lead.student_name, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
      await loadData()
    } catch (err) {
      console.error('Erro ao excluir lead:', err); setError('Erro ao excluir lead: ' + (err as Error).message)
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
      await loadData()
      setShowScheduleVisitModal(false)
      setLeadToSchedule(null)
      showToast('Visita agendada com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao agendar visita:', err); setError('Erro ao agendar visita: ' + (err as Error).message)
    }
  }

  const loadLeadHistory = async (leadId: string) => {
    try {
      setLoadingHistory(true)
      const history = await DatabaseService.getActivityLogs(user!.institution_id, leadId)
      setLeadHistory(history)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err); setLeadHistory([])
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
    } catch (err) {
      console.error('Erro ao salvar ação:', err); setError('Erro ao adicionar ação ao histórico')
    } finally {
      setSavingAction(false)
    }
  }

  const handleSaveContact = async () => {
    if (!selectedLead) return
    setSavingContact(true)
    try {
      await DatabaseService.logActivity({ user_id: user!.id, action: contactForm.tipo, entity_type: 'lead', entity_id: selectedLead.id, details: { description: contactForm.descricao, contact_date: contactForm.data, student_name: selectedLead.student_name, responsible_name: selectedLead.responsible_name }, institution_id: user!.institution_id })
      await loadLeadHistory(selectedLead.id)
      setContactForm({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
      setShowContactForm(false)
      showToast('Contato registrado!', 'success')
    } catch (err) {
      console.error('Erro ao registrar contato:', err); showToast('Erro ao registrar contato', 'error')
    } finally {
      setSavingContact(false)
    }
  }

  const handleSaveEditAction = async (actionId: string) => {
    if (!editingActionText.trim()) return
    try {
      await DatabaseService.updateActivityLog(actionId, { details: { ...leadHistory.find(h => h.id === actionId)?.details, description: editingActionText.trim() } })
      await loadLeadHistory(selectedLead!.id); setEditingAction(null); setEditingActionText('')
    } catch (err) {
      console.error('Erro ao atualizar ação:', err); setError('Erro ao atualizar ação')
    }
  }

  const handleDeleteAction = async (actionId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta ação?')) return
    try {
      await DatabaseService.deleteActivityLog(actionId); await loadLeadHistory(selectedLead!.id)
    } catch (err) {
      console.error('Erro ao excluir ação:', err); setError('Erro ao excluir ação')
    }
  }

  const getLeadsByStatus = (status: Lead['status']) => {
    return leads.filter(lead => {
      const matchesStatus = lead.status === status
      const matchesSearch = searchTerm === '' || lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesSource = filterSource === '' || lead.source === filterSource
      return matchesStatus && matchesSearch && matchesSource
    })
  }

  const getLeadStats = () => {
    const total = leads.length
    const thisMonth = new Date().toISOString().slice(0, 7)
    const newThisMonth = leads.filter(l => l.created_at.startsWith(thisMonth)).length
    const converted = leads.filter(l => l.status === 'enrolled').length
    const conversionRate = total > 0 ? (converted / total) * 100 : 0
    return { total, newThisMonth, converted, conversionRate }
  }

  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string) }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverColumnId(null); return }
    const overId = over.id as string
    if (Object.keys(statusConfig).includes(overId)) { setOverColumnId(overId) }
    else { const overLead = leads.find(l => l.id === overId); setOverColumnId(overLead ? overLead.status : null) }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null); setOverColumnId(null)
    if (!over) return

    const overId = over.id as string
    let targetStatus: Lead['status'] | null = null
    if (Object.keys(statusConfig).includes(overId)) { targetStatus = overId as Lead['status'] }
    else { const overLead = leads.find(l => l.id === overId); if (overLead) targetStatus = overLead.status }
    if (!targetStatus) return

    const draggedLead = leads.find(l => l.id === active.id as string)
    if (!draggedLead || draggedLead.status === targetStatus) return

    const previousLeads = [...leads]

    // Se destino é "lost", o handleStatusChange vai abrir o modal
    // com snapshot para revert se cancelar
    if (targetStatus === 'lost') {
      setLostReasonModal({ open: true, lead: draggedLead, pendingLeads: previousLeads })
      setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: 'lost' } : l))
      setFlashingLeadId(active.id as string)
      setTimeout(() => setFlashingLeadId(null), 1000)
      return
    }

    // Outros status — fluxo normal
    setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: targetStatus! } : l))
    setFlashingLeadId(active.id as string)
    setTimeout(() => setFlashingLeadId(null), 1000)

    handleStatusChange(active.id as string, targetStatus, true).catch(() => {
      setLeads(previousLeads)
      showToast('Erro ao mover o card. Tente novamente.', 'error')
    })
  }

  const handleWhatsApp = (lead: Lead) => {
    if (!lead.phone) return
    const normPhone = (p: string): string => {
      let d = p.replace(/\D/g, '')
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
      if (d.length === 11) d = '55' + d
      return d
    }
    navigate('/whatsapp', { state: { phone: normPhone(lead.phone) } })
  }

  const stats = getLeadStats()
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  const visibleStatuses = filterStatus ? Object.keys(statusConfig).filter(s => s === filterStatus) : Object.keys(statusConfig)

  const cardActions = {
    onSchedule: (lead: Lead) => { setLeadToSchedule(lead); setShowScheduleVisitModal(true) },
    onHistory: (lead: Lead) => {
      setSelectedLead(lead); setShowHistory(true); setNewAction(''); setEditingAction(null)
      setEditingActionText(''); setShowContactForm(false)
      setContactForm({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
      loadLeadHistory(lead.id)
    },
    onAudit: (id: string) => setAuditLeadId(id),
    onEdit: (lead: Lead) => { setEditingLead(lead); setShowNewLeadModal(true) },
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
    onWhatsApp: handleWhatsApp,
  }

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

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const mobileLeads = leads.filter(l =>
      (filterStatus === '' || l.status === filterStatus) &&
      (filterSource === '' || l.source === filterSource) &&
      (searchTerm === '' || l.student_name.toLowerCase().includes(searchTerm.toLowerCase()) || l.responsible_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: 16, height: 16, color: '#8B5CF6' }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Leads</h1>
          <span style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999 }}>{stats.total}</span>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 16, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Status chips */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
          {[{ value: '', label: 'Todos' }, ...Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }))].map(({ value, label }) => (
            <button key={value} onClick={() => setFilterStatus(value)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterStatus === value ? '#00A896' : '#F0FDFB',
                color: filterStatus === value ? '#fff' : '#64748B' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Lead list */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 10 }}>
          {mobileLeads.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhum lead encontrado</p>
            </div>
          ) : mobileLeads.map(lead => {
            const cfg = statusConfig[lead.status]
            return (
              <div key={lead.id} onClick={() => cardActions.onHistory(lead)}
                style={{ padding: '14px 16px', background: '#fff', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg?.accent ?? '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {lead.student_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.student_name}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flexShrink: 0, marginLeft: 6,
                      background: cfg?.accent ? `${cfg.accent}22` : '#f1f5f9',
                      color: cfg?.accent ?? '#64748B' }}>
                      {cfg?.label ?? lead.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0' }}>{lead.responsible_name}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    {lead.grade_interest && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.grade_interest}</span>}
                    {lead.source && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.source}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* FAB */}
        <button onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00A896', color: '#fff', border: 'none', fontSize: 28, cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,168,150,0.4)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus style={{ width: 26, height: 26 }} />
        </button>

        {/* Modals */}
        <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} />
        {showScheduleVisitModal && leadToSchedule && (
          <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
        )}
        <HistoryModal isOpen={showHistory} onClose={() => { setShowHistory(false); setSelectedLead(null) }}
          lead={selectedLead} history={leadHistory} loading={loadingHistory}
          newAction={newAction} setNewAction={setNewAction} savingAction={savingAction}
          editingAction={editingAction} setEditingAction={setEditingAction}
          editingActionText={editingActionText} setEditingActionText={setEditingActionText}
          onAddAction={handleAddAction} onSaveEditAction={handleSaveEditAction} onDeleteAction={handleDeleteAction}
          contactForm={contactForm} setContactForm={setContactForm}
          showContactForm={showContactForm} setShowContactForm={setShowContactForm}
          savingContact={savingContact} onSaveContact={handleSaveContact}
          onAudit={(id) => { setShowHistory(false); setSelectedLead(null); setAuditLeadId(id) }}
        />
        <LostReasonModal isOpen={lostReasonModal.open} lead={lostReasonModal.lead} onConfirm={handleConfirmLost} onCancel={handleCancelLost} />
        {auditLeadId && <AuditModal recordId={auditLeadId} moduleName="leads" isOpen={!!auditLeadId} onClose={() => setAuditLeadId(null)} />}
        {toast && (
          <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', background: '#f8f9fb' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users style={{ width: 18, height: 18, color: '#8B5CF6' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Leads</h1>
              <span style={{ padding: '2px 10px', background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{stats.total}</span>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gestão do funil de captação</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
          style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,168,150,0.25)', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#007A6E'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#00A896'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          <Plus style={{ width: 16, height: 16 }} /> Novo Lead
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all text-sm shadow-sm" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none text-sm shadow-sm text-gray-700">
          <option value="">Todos os status</option>
          {Object.entries(statusConfig).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-4 py-2.5 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none text-sm shadow-sm text-gray-700">
          <option value="">Todas as origens</option>
          {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-center gap-2 text-sm">
          <X className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Kanban Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {visibleStatuses.map((status) => {
              const config = statusConfig[status as keyof typeof statusConfig]
              const colLeads = getLeadsByStatus(status as Lead['status'])
              return (
                <div key={status} className="flex-shrink-0 min-w-[260px] max-w-[260px] flex flex-col">
                  <div className={`${config.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between border-b-2`} style={{ borderBottomColor: config.accent }}>
                    <span className={`text-sm font-bold ${config.headerText}`}>{config.label}</span>
                    <span className={`${config.badgeBg} text-white text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[24px] text-center`}>{colLeads.length}</span>
                  </div>
                  <DroppableColumn id={status} isOver={overColumnId === status && activeId !== null}>
                    <SortableContext items={colLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                      {colLeads.map((lead) => (
                        <SortableCard key={lead.id} lead={lead} config={config} isFlashing={flashingLeadId === lead.id} {...cardActions} />
                      ))}
                    </SortableContext>
                    {colLeads.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 opacity-20" style={{ backgroundColor: config.accent }}>
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

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[260px] rotate-1 cursor-grabbing">
              <CardContent lead={activeLead} config={statusConfig[activeLead.status]} isFlashing={false} overlay onSchedule={() => {}} onHistory={() => {}} onAudit={() => {}} onEdit={() => {}} onDelete={() => {}} onStatusChange={() => {}} onWhatsApp={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modals */}
      <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} />

      {showScheduleVisitModal && leadToSchedule && (
        <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
      )}

      <HistoryModal
        isOpen={showHistory} onClose={() => { setShowHistory(false); setSelectedLead(null) }}
        lead={selectedLead} history={leadHistory} loading={loadingHistory}
        newAction={newAction} setNewAction={setNewAction} savingAction={savingAction}
        editingAction={editingAction} setEditingAction={setEditingAction}
        editingActionText={editingActionText} setEditingActionText={setEditingActionText}
        onAddAction={handleAddAction} onSaveEditAction={handleSaveEditAction} onDeleteAction={handleDeleteAction}
        contactForm={contactForm} setContactForm={setContactForm}
        showContactForm={showContactForm} setShowContactForm={setShowContactForm}
        savingContact={savingContact} onSaveContact={handleSaveContact}
        onAudit={(id) => { setShowHistory(false); setSelectedLead(null); setAuditLeadId(id) }}
      />

      {/* Modal de motivo de perda */}
      <LostReasonModal
        isOpen={lostReasonModal.open}
        lead={lostReasonModal.lead}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />

      {auditLeadId && <AuditModal recordId={auditLeadId} moduleName="leads" isOpen={!!auditLeadId} onClose={() => setAuditLeadId(null)} />}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <X className="w-4 h-4 flex-shrink-0" />}
          {toast.msg}
        </div>
      )}
    </div>
  )
}