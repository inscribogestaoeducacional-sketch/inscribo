import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Phone, Calendar, Edit, Edit2, Trash2, X, Search,
  Clock, Users, Send, CheckCircle, Save,
  MessageCircle, AlertTriangle, ChevronDown, ChevronRight, ChevronUp,
  Bell, UserCog, SlidersHorizontal,
  LayoutGrid, Rows3, Tag, Megaphone, MapPin, GraduationCap,
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
import { DatabaseService, Lead, supabase } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { getLeadReminderInfo, REMINDER_COLORS, NO_CONTACT_DAYS } from '../../lib/leadReminders'
import NewLeadModal from './NewLeadModal'
import { saveLead } from '../../lib/leadSave'
import {
  type SimpleUser, type AuditEntry, type StudentEntry,
  statusConfig, sourceOptions, LEAD_TEMPERATURES,
} from './leadFormShared'

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

// Séries — antes existiam DUAS listas hardcoded divergentes aqui mesmo
// (gradeOptions usada pra salvar, GRADES usada só pro filtro, com Ensino
// Médio em nomenclaturas diferentes — o filtro nunca encontrava nada).
// Agora vêm de school_grade_levels via useGradeLevels(), configurável por
// escola (Configurações → Escola). Ver hooks/useGradeLevels.ts.

// Lógica de lembrete (manual + automático "sem contato") vive em
// lib/leadReminders.ts — reaproveitada aqui, no GestorHome e no AttendantHome.

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

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


// ─── ScheduleVisitModal ────────────────────────────────────────────────────────
interface ScheduleVisitModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
  onSchedule: (data: { scheduled_date: string; scheduled_time: string; notes: string }) => void
}

// Redesenhado (item 12) — mesmo padrão inline style + header colorido dos
// outros modais deste arquivo (LostReasonModal = vermelho, NewLeadModal =
// teal); antes era o único construído em Tailwind puro, com header sem
// nenhuma cor de destaque, destoando visualmente do resto do fluxo.
function ScheduleVisitModal({ isOpen, onClose, lead, onSchedule }: ScheduleVisitModalProps) {
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) { setScheduledDate(''); setScheduledTime(''); setNotes(''); setError('') }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!scheduledDate || !scheduledTime) { setError('Selecione data e horário.'); return }
    onSchedule({ scheduled_date: scheduledDate, scheduled_time: scheduledTime, notes })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 560, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #BFDBFE' }}>
        {/* Header — azul, pra diferenciar de "criar" (teal) e "perder" (vermelho) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Calendar style={{ width: 18, height: 18, color: '#2563EB' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Agendar visita</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.student_name} · {lead.responsible_name}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        {/* Resumo do lead */}
        <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '12px 16px', marginBottom: 20, border: '1px solid #BFDBFE', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
          <div><span style={{ fontWeight: 700, color: '#1D4ED8' }}>Série:</span> <span style={{ color: '#1E3A8A' }}>{lead.grade_interest || '—'}</span></div>
          <div><span style={{ fontWeight: 700, color: '#1D4ED8' }}>Telefone:</span> <span style={{ color: '#1E3A8A' }}>{lead.phone || 'Não informado'}</span></div>
          <div><span style={{ fontWeight: 700, color: '#1D4ED8' }}>Origem:</span> <span style={{ color: '#1E3A8A' }}>{lead.source || '—'}</span></div>
          <div><span style={{ fontWeight: 700, color: '#1D4ED8' }}>Status:</span> <span style={{ color: '#1E3A8A' }}>{statusConfig[lead.status]?.label}</span></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Data *</label>
            <input type="date" value={scheduledDate} min={new Date().toISOString().split('T')[0]} onChange={e => { setScheduledDate(e.target.value); setError('') }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Horário *</label>
            <select value={scheduledTime} onChange={e => { setScheduledTime(e.target.value); setError('') }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
              <option value="">Selecione</option>
              {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {scheduledDate && scheduledTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <CheckCircle style={{ width: 16, height: 16, color: '#16A34A', flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: '#166534' }}>
              {new Date(scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })} às {scheduledTime}
            </p>
          </div>
        )}

        <div style={{ marginBottom: error ? 8 : 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Observações</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Informações importantes sobre a visita..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1A2B4A' }} />
        </div>

        {error && <p style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>Cancelar</button>
          <button onClick={handleSubmit}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, background: '#2563EB', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Save style={{ width: 14, height: 14 }} />Confirmar agendamento
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ReminderModal — lembrete manual (nota livre + data), item 2d ─────────────
interface ReminderModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead | null
  onSave: (date: string, note: string) => Promise<void>
}

function ReminderModal({ isOpen, onClose, lead, onSave }: ReminderModalProps) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && lead) {
      setDate(lead.next_followup ? lead.next_followup.slice(0, 10) : '')
      setNote('')
    }
  }, [isOpen, lead])

  if (!isOpen || !lead) return null

  const handleSave = async () => {
    if (!date) return
    setSaving(true)
    try { await onSave(date, note) } finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #FDE68A' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Bell style={{ width: 18, height: 18, color: '#D97706' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Definir lembrete</h2>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.student_name} · {lead.responsible_name}</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Data do follow-up *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nota (opcional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Ex: Ligar pra confirmar visita, aguardar retorno sobre bolsa..."
            style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1A2B4A' }} />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#64748B', fontWeight: 500 }}>Cancelar</button>
          <button onClick={handleSave} disabled={!date || saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 9, background: !date ? '#E2E8F0' : '#D97706', color: !date ? '#94A3B8' : '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: !date || saving ? 'not-allowed' : 'pointer' }}>
            {saving ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" /> : <Bell style={{ width: 14, height: 14 }} />}
            Salvar lembrete
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
  compact?: boolean
  assignedUser?: SimpleUser | null
  siblings?: Lead[]
  onSchedule: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Lead['status']) => void
  onWhatsApp: (lead: Lead) => void
  onReminder: (lead: Lead) => void
}

function CardContent({ lead, config, isFlashing, overlay, compact, assignedUser, siblings, onSchedule, onEdit, onDelete, onStatusChange, onWhatsApp, onReminder }: CardContentProps) {
  const lostReason = lead.lost_reason
  const lostLabel = lostReason ? LOST_REASONS.find(r => r.value === lostReason)?.label : null
  const temperature = lead.lead_temperature ? LEAD_TEMPERATURES.find(t => t.value === lead.lead_temperature) : null
  const reminder = getLeadReminderInfo(lead)
  const reminderColors = reminder ? REMINDER_COLORS[reminder.urgency] : null
  const assignedInitials = assignedUser ? assignedUser.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : null

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-150 overflow-hidden ${
        isFlashing ? 'bg-teal-50/40 border-teal-400 ring-2 ring-teal-500 shadow-md animate-pulse'
        : overlay ? 'bg-white border-gray-200 shadow-xl scale-105 opacity-50'
        : 'bg-white border-gray-200 shadow-sm hover:shadow-md hover:border-teal-300'
      }`}
      style={{ borderLeft: `3px solid ${config.accent}` }}
    >
      {/* Card body — clicável para editar */}
      <div className={compact ? 'p-2' : 'p-3'}>
        {/* Item 9a — responsável/família em destaque, aluno(s) como subtítulo */}
        <div className="flex items-start gap-2 mb-1.5">
          <div className={`${compact ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs'} rounded-full bg-[#1e2d6b] text-white font-bold flex items-center justify-center flex-shrink-0 mt-0.5`}>
            {(lead.responsible_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`${compact ? 'text-sm' : 'text-[15px]'} font-bold text-gray-900 leading-tight truncate`}>{lead.responsible_name}</h4>
            <p className="text-xs text-gray-500 truncate">
              🎓 {lead.student_name}
              {siblings && siblings.length > 0 && (
                <span title={siblings.map(s => `${s.student_name} (${statusConfig[s.status]?.label})`).join(', ')} style={{ marginLeft: 5, fontWeight: 600, color: '#8B5CF6' }}>
                  +{siblings.length} irmão{siblings.length === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
          {!overlay && (
            <button
              title="Excluir"
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onDelete(lead.id) }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Item 9b — badges: série, origem, temperatura, campanha */}
        {(lead.grade_interest || lead.source || temperature || lead.campaign_cycle_id) && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {lead.grade_interest && <span className="inline-flex items-center bg-[#14b8a6]/10 text-[#0d9488] text-xs font-medium px-2 py-0.5 rounded-full border border-[#14b8a6]/20">{lead.grade_interest}</span>}
            {lead.source && (
              lead.source === 'embed'
                ? <span className="inline-flex items-center gap-1 bg-sky-100 text-sky-700 text-xs font-semibold px-2 py-0.5 rounded-full border border-sky-200">Via site</span>
                : <span className="inline-flex items-center bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full">{lead.source}</span>
            )}
            {temperature && (
              <span title={temperature.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: temperature.bg, color: temperature.color, border: `1px solid ${temperature.border}` }}>
                <temperature.icon size={10} />{!compact && temperature.label}
              </span>
            )}
            {lead.campaign_cycle_id && !compact && (
              <span title="Vinculado a uma campanha" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#F5F3FF', color: '#7C3AED' }}>
                <Megaphone size={10} />
              </span>
            )}
          </div>
        )}

        {/* Tags (item 9b — antes só apareciam no modal de histórico) */}
        {!compact && lead.tags && lead.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {lead.tags.map(tag => (
              <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#EEF2FF', color: '#4338CA' }}>
                <Tag size={9} />{tag}
              </span>
            ))}
          </div>
        )}

        {/* Telefone + responsável (atendente) */}
        {!compact && (lead.phone || assignedUser) && (
          <div className="flex items-center justify-between gap-2 mb-1.5">
            {lead.phone && <span className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{lead.phone}</span>}
            {assignedUser && (
              <span title={`Responsável: ${assignedUser.full_name}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#1e2d6b', background: '#EEF2FF', padding: '2px 7px', borderRadius: 999, flexShrink: 0 }}>
                <UserCog size={10} />{assignedInitials}
              </span>
            )}
          </div>
        )}

        {/* Lembrete (item 2d) */}
        {reminder && reminderColors && (
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onReminder(lead) }}
            title="Definir/editar lembrete"
            style={{ display: 'flex', alignItems: 'center', gap: 4, width: '100%', padding: '4px 8px', borderRadius: 6, marginBottom: 4, background: reminderColors.bg, border: `1px solid ${reminderColors.border}`, cursor: 'pointer' }}>
            <Bell size={11} color={reminderColors.color} />
            <span style={{ fontSize: 11, color: reminderColors.color, fontWeight: 600 }}>{reminder.label}</span>
          </button>
        )}

        {lead.status === 'lost' && lostLabel && (
          <div style={{ background: '#FEF2F2', borderRadius: 6, padding: '4px 8px', marginBottom: 4 }}>
            <p style={{ fontSize: 11, color: '#DC2626', fontWeight: 500, margin: 0 }}>⚠ {lostLabel}</p>
          </div>
        )}
      </div>

      {/* Footer sempre visível */}
      {!overlay && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '5px 8px', display: 'flex', gap: 5 }}>
          {lead.status === 'lost' ? (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onStatusChange(lead.id, 'contact') }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#2563EB', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              🔄 Reabrir
            </button>
          ) : (
            <>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onWhatsApp(lead) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#DCFCE7', border: 'none', color: '#15803D', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <MessageCircle style={{ width: 12, height: 12 }} /> WA
              </button>
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onSchedule(lead) }}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 0', borderRadius: 7, background: '#DBEAFE', border: 'none', color: '#1D4ED8', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
              >
                <Calendar style={{ width: 12, height: 12 }} /> Visita
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── FilterDrawer ─────────────────────────────────────────────────────────────
// Item 6c — painel lateral com todos os filtros organizados (antes era uma
// fileira de selects soltos, que já não cabiam nem no desktop com os campos
// novos de responsável/temperatura). Compartilhado entre desktop e mobile.
interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filterStatus: string; setFilterStatus: (v: string) => void
  filterSource: string; setFilterSource: (v: string) => void
  periodFilter: string; setPeriodFilter: (v: any) => void
  customStart: string; setCustomStart: (v: string) => void
  customEnd: string; setCustomEnd: (v: string) => void
  gradeFilter: string; setGradeFilter: (v: string) => void
  gradeNames: string[]
  shiftFilter: string; setShiftFilter: (v: string) => void
  temperatureFilter: string; setTemperatureFilter: (v: any) => void
  ownerFilter: string; setOwnerFilter: (v: string) => void
  users: SimpleUser[]
  noContactFilter: boolean; setNoContactFilter: (v: boolean) => void
  noContactDays: number; setNoContactDays: (v: number) => void
  onClear: () => void
}

function FilterDrawer(props: FilterDrawerProps) {
  const { open, onClose, filterStatus, setFilterStatus, filterSource, setFilterSource, periodFilter, setPeriodFilter, customStart, setCustomStart, customEnd, setCustomEnd, gradeFilter, setGradeFilter, gradeNames, shiftFilter, setShiftFilter, temperatureFilter, setTemperatureFilter, ownerFilter, setOwnerFilter, users, noContactFilter, setNoContactFilter, noContactDays, setNoContactDays, onClear } = props
  if (!open) return null

  const section = (label: string) => (
    <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, marginTop: 18 }}>{label}</p>
  )
  const selCls: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', background: '#fff', boxSizing: 'border-box' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1050, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 340, height: '100%', background: '#fff', boxShadow: '-8px 0 32px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SlidersHorizontal style={{ width: 16, height: 16, color: '#1A2B4A' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Filtros</h3>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X style={{ width: 13, height: 13, color: '#94A3B8' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
          {section('Responsável')}
          <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} style={selCls}>
            <option value="mine">Meus leads</option>
            <option value="all">Todos</option>
            <option value="unassigned">Sem responsável</option>
            {users.length > 0 && <optgroup label="Atendente específico">
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </optgroup>}
          </select>

          {section('Status')}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selCls}>
            <option value="">Todos os status</option>
            {Object.entries(statusConfig).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
          </select>

          {section('Temperatura')}
          <select value={temperatureFilter} onChange={e => setTemperatureFilter(e.target.value)} style={selCls}>
            <option value="">Todas</option>
            {LEAD_TEMPERATURES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {section('Contato')}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', cursor: 'pointer' }}>
            <input type="checkbox" checked={noContactFilter} onChange={e => setNoContactFilter(e.target.checked)} />
            Somente leads sem contato
          </label>
          {noContactFilter && (
            <select value={noContactDays} onChange={e => setNoContactDays(Number(e.target.value))} style={{ ...selCls, marginTop: 8 }}>
              {[3, 5, 7, 10, 15, 30].map(d => <option key={d} value={d}>Há mais de {d} dias</option>)}
            </select>
          )}

          {section('Origem')}
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={selCls}>
            <option value="">Todas as origens</option>
            {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {section('Série de interesse')}
          <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} style={selCls}>
            <option value="all">Todas as séries</option>
            {gradeNames.map(g => <option key={g} value={g}>{g}</option>)}
          </select>

          {section('Turno')}
          <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={selCls}>
            <option value="all">Todos os turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Tarde">Tarde</option>
            <option value="Integral">Integral</option>
          </select>

          {section('Período')}
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} style={selCls}>
            <option value="all">Todos os períodos</option>
            <option value="today">Hoje</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mês</option>
            <option value="year">Este ano</option>
            <option value="custom">Personalizado</option>
          </select>
          {periodFilter === 'custom' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={selCls} />
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={selCls} />
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #F1F5F9', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={onClear} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Limpar</button>
          <button onClick={onClose} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Aplicar</button>
        </div>
      </div>
    </div>
  )
}

// ─── SortableCard ─────────────────────────────────────────────────────────────
function SortableCard(props: Omit<CardContentProps, 'overlay'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.lead.id })
  const didDrag = React.useRef(false)

  React.useEffect(() => {
    if (isDragging) didDrag.current = true
  }, [isDragging])

  const handleClick = () => {
    if (didDrag.current) { didDrag.current = false; return }
    props.onEdit(props.lead)
  }

  return (
    <div ref={setNodeRef} className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-40' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition, touchAction: 'none' }} {...attributes} {...listeners} onClick={handleClick}>
      <CardContent {...props} />
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────
// Item 13 — colunas colapsáveis (útil pra colunas com poucos cards, tipo
// "Matriculado"/"Perdido", ficarem compactas sem sumir do board).
function DroppableColumn({ id, isOver, collapsed, children }: { id: string; isOver: boolean; collapsed?: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })
  if (collapsed) return <div ref={setNodeRef} style={{ display: 'none' }}>{children}</div>
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
  const { names: gradeNames } = useGradeLevels(user?.institution_id)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [periodFilter, setPeriodFilter] = useState<'all'|'today'|'week'|'month'|'year'|'custom'>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [gradeFilter, setGradeFilter] = useState('all')
  const [shiftFilter, setShiftFilter] = useState('all')
  const [auditLeadId, setAuditLeadId] = useState<string | null>(null)
  const [showScheduleVisitModal, setShowScheduleVisitModal] = useState(false)
  const [leadToSchedule, setLeadToSchedule] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnId, setOverColumnId] = useState<string | null>(null)
  const [flashingLeadId, setFlashingLeadId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // ── Item 2: propriedade do lead / lembretes ───────────────────────────────
  const [users, setUsers] = useState<SimpleUser[]>([])
  const [ownerFilter, setOwnerFilter] = useState<string>('all') // 'mine' | 'all' | 'unassigned' | <user id>
  const [reminderModal, setReminderModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })

  // ── Item 7 — temperatura ───────────────────────────────────────────────────
  const [temperatureFilter, setTemperatureFilter] = useState<'' | 'frio' | 'morno' | 'quente'>('')

  // Filtro "sem contato" — dias configurável no FilterDrawer (default =
  // NO_CONTACT_DAYS, o mesmo usado no badge de lembrete e no alerta do
  // GestorHome, que navega aqui com ?filter=no_contact). O badge/lembrete em
  // si (getLeadReminderInfo) continua fixo em NO_CONTACT_DAYS — só o filtro
  // é ajustável, por isso a checagem abaixo não reusa mais getLeadReminderInfo.
  const [noContactFilter, setNoContactFilter] = useState(false)
  const [noContactDays, setNoContactDays] = useState(NO_CONTACT_DAYS)

  // ── Item 6c — drawer de filtros modernizado ────────────────────────────────
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  // ── Item 13 — colunas colapsáveis + view compacta ──────────────────────────
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set())
  const [compactView, setCompactView] = useState(false)

  // ── Item 10 — campanha ativa da instituição ────────────────────────────────
  const [activeCampaignCycle, setActiveCampaignCycle] = useState<{ id: string; label: string } | null>(null)
  const [institutionCity, setInstitutionCity] = useState<string>('')

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
    if (searchParams.get('filter') === 'no_contact') setNoContactFilter(true)
  }, [searchParams])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const showToast = useCallback((msg: string, type: 'error' | 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!user?.institution_id) return
    loadData()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let leadsChannel: any = null
    ;(async () => {
      const { supabase: db } = await import('../../lib/supabase')
      leadsChannel = db
        .channel(`leads-kanban-${user.institution_id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'leads',
          filter: `institution_id=eq.${user.institution_id}`,
        }, (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setLeads(prev => {
              if (prev.find(l => l.id === payload.new.id)) return prev
              return [payload.new as Lead, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            setLeads(prev => prev.map(l => l.id === payload.new.id ? { ...l, ...payload.new } : l))
          } else if (payload.eventType === 'DELETE') {
            setLeads(prev => prev.filter(l => l.id !== payload.old.id))
          }
        })
        .subscribe()
    })()
    return () => {
      ;(async () => {
        if (leadsChannel) {
          const { supabase: db } = await import('../../lib/supabase')
          db.removeChannel(leadsChannel)
        }
      })()
    }
  }, [user?.institution_id])

  const loadData = async () => {
    try {
      setLoading(true); setError('')
      const instId = user!.institution_id
      const [leadsData, usersRes, campaignRes, instRes] = await Promise.all([
        DatabaseService.getLeads(instId),
        supabase.from('users').select('id, full_name, role').eq('institution_id', instId).order('full_name'),
        supabase.from('campaign_cycles').select('id, year, label').eq('institution_id', instId).in('status', ['active', 'released']).order('year', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('institutions').select('city').eq('id', instId).maybeSingle(),
      ])
      setLeads(leadsData)
      setUsers((usersRes.data as SimpleUser[]) ?? [])
      setActiveCampaignCycle(campaignRes.data ? { id: campaignRes.data.id, label: campaignRes.data.label || String(campaignRes.data.year) } : null)
      setInstitutionCity(instRes.data?.city ?? '')
    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError('Erro ao carregar dados dos leads')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (data: Partial<Lead> & { familyMatchId?: string | null; additionalStudents?: StudentEntry[] }) => {
    setError('')
    try {
      await saveLead({
        institutionId: user!.institution_id,
        currentUser: { id: user!.id, full_name: user!.full_name, role: user!.role },
        users,
        editingLead,
        data,
        campaignCycleId: activeCampaignCycle?.id ?? null,
      })
    } catch (err) {
      console.error('[LEAD SAVE] erro:', err)
      showToast('Erro ao salvar lead. Tente novamente.', 'error')
      throw err
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
        const isReopen = previousStatus === 'lost'
        const { supabase: db } = await import('../../lib/supabase')
        await db.from('audit_logs').insert({
          institution_id: user!.institution_id, module: 'lead', record_id: leadId,
          action: isReopen ? 'Lead reaberto' : 'Status alterado',
          field_changed: isReopen
            ? 'Lead reaberto para contato'
            : `${statusConfig[previousStatus as keyof typeof statusConfig]?.label} → ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`,
          new_value: newStatus,
          user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
        })
        await logAudit({ institution_id: user!.institution_id, module: 'leads', record_id: leadId, action: 'status_changed', old_value: previousStatus, new_value: newStatus, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
        if (newStatus === 'enrolled') {
          const { supabase: db2 } = await import('../../lib/supabase')
          await db2.from('enrollments').insert({
            institution_id: user!.institution_id,
            lead_id: currentLead.id,
            student_name: currentLead.student_name || currentLead.responsible_name,
            course_grade: currentLead.grade_interest,
            enrollment_date: new Date().toISOString(),
            user_id: currentLead.assigned_to ?? user!.id,
            responsible_name: currentLead.responsible_name,
          })
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

      await db.from('audit_logs').insert({
        institution_id: user!.institution_id, module: 'lead', record_id: lead.id,
        action: 'Lead perdido',
        field_changed: LOST_REASONS.find(r => r.value === reason)?.label || reason,
        new_value: detail || '',
        user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
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
    if (!lead || !window.confirm(`Tem certeza que deseja excluir o lead "${lead.student_name}"?\n\nEsta ação não pode ser desfeita.`)) return
    try {
      const { supabase: db } = await import('../../lib/supabase')
      const instId = user!.institution_id

      // 1. Desvincular mensagens do lead
      await db.from('whatsapp_messages').update({ lead_id: null }).eq('lead_id', leadId).eq('institution_id', instId)
      // 2. Desvincular conversas do lead
      await db.from('whatsapp_conversations').update({ lead_id: null }).eq('lead_id', leadId).eq('institution_id', instId)
      // 3. Desvincular contatos do lead
      await db.from('whatsapp_contacts').update({ lead_id: null, type: 'unknown' }).eq('lead_id', leadId).eq('institution_id', instId)
      // 4. Deletar logs do lead
      await db.from('audit_logs').delete().eq('record_id', leadId).eq('institution_id', instId)

      // 5. Deletar o lead
      const { error } = await db.from('leads').delete().eq('id', leadId).eq('institution_id', instId)
      if (error) throw error

      await logAudit({ institution_id: instId, module: 'leads', record_id: leadId, action: 'deleted', old_value: lead.student_name, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
      setLeads(prev => prev.filter(l => l.id !== leadId))
      if (editingLead?.id === leadId) { setShowNewLeadModal(false); setEditingLead(null) }
      showToast('Lead excluído com sucesso', 'success')
    } catch (err) {
      console.error('[DELETE LEAD]', err)
      showToast('Erro ao excluir lead. Tente novamente.', 'error')
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
      const { supabase: db } = await import('../../lib/supabase')
      await db.from('audit_logs').insert({
        institution_id: user!.institution_id, module: 'lead', record_id: leadToSchedule.id,
        action: 'Visita agendada',
        field_changed: `${data.scheduled_date} às ${data.scheduled_time}`,
        new_value: data.notes || '',
        user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
      })
      await loadData()
      setShowScheduleVisitModal(false)
      setLeadToSchedule(null)
      showToast('Visita agendada com sucesso!', 'success')
    } catch (err) {
      console.error('Erro ao agendar visita:', err); setError('Erro ao agendar visita: ' + (err as Error).message)
    }
  }

  // ── Item 2d — lembrete manual ────────────────────────────────────────────
  const handleSaveReminder = async (date: string, note: string) => {
    const lead = reminderModal.lead
    if (!lead) return
    try {
      const { supabase: db } = await import('../../lib/supabase')
      const { error } = await db.from('leads').update({ next_followup: date }).eq('id', lead.id)
      if (error) throw error
      await db.from('audit_logs').insert({
        institution_id: user!.institution_id, module: 'lead', record_id: lead.id,
        action: 'Lembrete definido',
        field_changed: note || `Follow-up em ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR')}`,
        new_value: date,
        user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
      })
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, next_followup: date } : l))
      setReminderModal({ open: false, lead: null })
      showToast('Lembrete salvo!', 'success')
    } catch (err) {
      console.error('Erro ao salvar lembrete:', err)
      showToast('Erro ao salvar lembrete. Tente novamente.', 'error')
    }
  }

  const getPeriodDates = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    switch (periodFilter) {
      case 'today': return { start: today, end: now }
      case 'week': {
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        return { start: weekStart, end: now }
      }
      case 'month': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now }
      case 'year':  return { start: new Date(now.getFullYear(), 0, 1), end: now }
      case 'custom': return {
        start: customStart ? new Date(customStart) : null,
        end:   customEnd   ? new Date(customEnd + 'T23:59:59') : null,
      }
      default: return { start: null, end: null }
    }
  }

  // Mesma regra de elegibilidade de getLeadReminderInfo (lib/leadReminders.ts)
  // pro critério "automático" — status aberto e sem next_followup manual
  // (que já tem prioridade/rótulo próprio) — só com o número de dias
  // configurável em vez do NO_CONTACT_DAYS fixo usado no badge/lembrete.
  const isLeadNoContact = (lead: Lead, days: number) => {
    if (lead.status === 'enrolled' || lead.status === 'lost') return false
    if (lead.next_followup) return false
    const createdDays = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)
    return createdDays >= days
  }

  // Item 2b/6b — filtro de responsável ("Meus leads"/"Todos"/"Sem responsável"/
  // um atendente específico) + item 7 — filtro de temperatura. Compartilhado
  // entre a lista desktop (por coluna) e a lista mobile.
  const matchesLeadFilters = (lead: Lead, { start, end }: { start: Date | null; end: Date | null }) => {
    if (searchTerm !== '' && !lead.student_name.toLowerCase().includes(searchTerm.toLowerCase()) && !lead.responsible_name.toLowerCase().includes(searchTerm.toLowerCase())) return false
    if (filterSource !== '' && lead.source !== filterSource) return false
    if (periodFilter !== 'all') {
      const created = new Date(lead.created_at)
      if (start && created < start) return false
      if (end && created > end) return false
    }
    if (gradeFilter !== 'all' && lead.grade_interest !== gradeFilter) return false
    if (shiftFilter !== 'all' && (lead as any).shift_interest !== shiftFilter) return false
    if (temperatureFilter !== '' && lead.lead_temperature !== temperatureFilter) return false
    if (noContactFilter && !isLeadNoContact(lead, noContactDays)) return false
    if (ownerFilter === 'mine') { if (lead.assigned_to !== user?.id) return false }
    else if (ownerFilter === 'unassigned') { if (lead.assigned_to) return false }
    else if (ownerFilter !== 'all') { if (lead.assigned_to !== ownerFilter) return false }
    return true
  }

  const getLeadsByStatus = (status: Lead['status']) => {
    const { start, end } = getPeriodDates()
    return leads.filter(lead => lead.status === status && matchesLeadFilters(lead, { start, end }))
  }

  // Item 3c — agrupamento de irmãos por família, pra mostrar o chip "+N
  // irmãos" no card sem quebrar o drag-and-drop individual (cada lead
  // continua sendo arrastado independentemente, isso é só informativo).
  const familySiblingsMap = React.useMemo(() => {
    const byFamily = new Map<string, Lead[]>()
    leads.forEach(l => { if (l.family_id) { const arr = byFamily.get(l.family_id) ?? []; arr.push(l); byFamily.set(l.family_id, arr) } })
    const map = new Map<string, Lead[]>()
    byFamily.forEach(group => group.forEach(l => map.set(l.id, group.filter(s => s.id !== l.id))))
    return map
  }, [leads])

  const usersById = React.useMemo(() => new Map(users.map(u => [u.id, u])), [users])

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
    if (!lead.phone) {
      showToast('Este lead não tem telefone cadastrado', 'error')
      return
    }
    const normPhone = (p: string): string => {
      let d = p.replace(/\D/g, '')
      if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
      if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
      if (d.length === 11) d = '55' + d
      return d
    }
    navigate(`/whatsapp?phone=${normPhone(lead.phone)}`)
  }

  const stats = getLeadStats()
  const activeLead = activeId ? leads.find(l => l.id === activeId) : null
  const visibleStatuses = filterStatus ? Object.keys(statusConfig).filter(s => s === filterStatus) : Object.keys(statusConfig)
  const filteredTotal = visibleStatuses.reduce((sum, s) => sum + getLeadsByStatus(s as Lead['status']).length, 0)
  const hasActiveFilters = searchTerm !== '' || filterSource !== '' || filterStatus !== '' || periodFilter !== 'all' || gradeFilter !== 'all' || shiftFilter !== 'all' || temperatureFilter !== '' || ownerFilter !== 'all' || noContactFilter

  const cardActions = {
    onSchedule: (lead: Lead) => { setLeadToSchedule(lead); setShowScheduleVisitModal(true) },
    onEdit: (lead: Lead) => { setEditingLead(lead); setShowNewLeadModal(true) },
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
    onWhatsApp: handleWhatsApp,
    onReminder: (lead: Lead) => setReminderModal({ open: true, lead }),
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

  const clearAllFilters = () => {
    setSearchTerm(''); setFilterSource(''); setFilterStatus(''); setPeriodFilter('all')
    setCustomStart(''); setCustomEnd(''); setGradeFilter('all'); setShiftFilter('all')
    setTemperatureFilter(''); setOwnerFilter('all'); setNoContactFilter(false); setNoContactDays(NO_CONTACT_DAYS)
  }

  const filterDrawerEl = (
    <FilterDrawer
      open={filterDrawerOpen} onClose={() => setFilterDrawerOpen(false)}
      filterStatus={filterStatus} setFilterStatus={setFilterStatus}
      filterSource={filterSource} setFilterSource={setFilterSource}
      periodFilter={periodFilter} setPeriodFilter={setPeriodFilter}
      customStart={customStart} setCustomStart={setCustomStart}
      customEnd={customEnd} setCustomEnd={setCustomEnd}
      gradeFilter={gradeFilter} setGradeFilter={setGradeFilter} gradeNames={gradeNames}
      shiftFilter={shiftFilter} setShiftFilter={setShiftFilter}
      temperatureFilter={temperatureFilter} setTemperatureFilter={setTemperatureFilter}
      ownerFilter={ownerFilter} setOwnerFilter={setOwnerFilter}
      users={users}
      noContactFilter={noContactFilter} setNoContactFilter={setNoContactFilter}
      noContactDays={noContactDays} setNoContactDays={setNoContactDays}
      onClear={clearAllFilters}
    />
  )

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const { start: pStart, end: pEnd } = getPeriodDates()
    const mobileLeads = leads.filter(l => {
      if (filterStatus !== '' && l.status !== filterStatus) return false
      return matchesLeadFilters(l, { start: pStart, end: pEnd })
    })
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: 16, height: 16, color: '#8B5CF6' }} />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0, flex: 1 }}>Leads</h1>
          <span style={{ background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999 }}>{mobileLeads.length}</span>
        </div>

        {/* Search + filtros */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0, display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 16, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {/* Atalho rápido "Meus leads" — alterna direto sem abrir o drawer completo */}
          <button onClick={() => setOwnerFilter(o => o === 'mine' ? 'all' : 'mine')} title="Meus leads"
            style={{ width: 44, height: 44, borderRadius: 12, background: ownerFilter === 'mine' ? '#00A896' : '#fff', border: '1.5px solid ' + (ownerFilter === 'mine' ? '#00A896' : '#E2E8F0'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <UserCog style={{ width: 17, height: 17, color: ownerFilter === 'mine' ? '#fff' : '#64748B' }} />
          </button>
          <button onClick={() => setFilterDrawerOpen(true)} style={{ position: 'relative', width: 44, height: 44, borderRadius: 12, background: hasActiveFilters ? '#00A896' : '#fff', border: '1.5px solid ' + (hasActiveFilters ? '#00A896' : '#E2E8F0'), display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <SlidersHorizontal style={{ width: 17, height: 17, color: hasActiveFilters ? '#fff' : '#64748B' }} />
          </button>
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
            const reminder = getLeadReminderInfo(lead)
            const reminderColors = reminder ? REMINDER_COLORS[reminder.urgency] : null
            const siblings = familySiblingsMap.get(lead.id)
            return (
              <div key={lead.id} onClick={() => cardActions.onEdit(lead)}
                style={{ padding: '14px 16px', background: '#fff', borderBottom: '1px solid #F1F5F9', display: 'flex', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg?.accent ?? '#6b7280', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {(lead.responsible_name || '?').charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.responsible_name}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flexShrink: 0, marginLeft: 6,
                      background: cfg?.accent ? `${cfg.accent}22` : '#f1f5f9',
                      color: cfg?.accent ?? '#64748B' }}>
                      {cfg?.label ?? lead.status}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0' }}>
                    🎓 {lead.student_name}
                    {siblings && siblings.length > 0 && <span style={{ marginLeft: 5, fontWeight: 600, color: '#8B5CF6' }}>+{siblings.length} irmão{siblings.length === 1 ? '' : 's'}</span>}
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {lead.grade_interest && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.grade_interest}</span>}
                    {lead.source && <span style={{ fontSize: 12, color: '#94A3B8' }}>{lead.source}</span>}
                    {reminder && reminderColors && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: reminderColors.color }}>
                        <Bell size={10} />{reminder.label}
                      </span>
                    )}
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

        {filterDrawerEl}

        {/* Modals */}
        <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} onDelete={handleDelete} institutionId={user!.institution_id} users={users} activeCampaignLabel={activeCampaignCycle?.label} institutionCity={institutionCity} />
        {showScheduleVisitModal && leadToSchedule && (
          <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
        )}
        <ReminderModal isOpen={reminderModal.open} lead={reminderModal.lead} onClose={() => setReminderModal({ open: false, lead: null })} onSave={handleSaveReminder} />
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
              <span style={{ padding: '2px 10px', background: '#EDE9FE', color: '#7C3AED', fontSize: 12, fontWeight: 700, borderRadius: 999 }}>{filteredTotal}</span>
            </div>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gestão do funil de captação</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Item 13 — toggle view compacta */}
          <button
            onClick={() => setCompactView(v => !v)}
            title={compactView ? 'Cards normais' : 'Cards compactos'}
            style={{ width: 38, height: 38, borderRadius: 10, border: '1.5px solid ' + (compactView ? '#00A896' : '#E2E8F0'), background: compactView ? '#F0FDFB' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {compactView ? <Rows3 style={{ width: 16, height: 16, color: '#00A896' }} /> : <LayoutGrid style={{ width: 16, height: 16, color: '#64748B' }} />}
          </button>
          <button
            onClick={() => { setEditingLead(null); setShowNewLeadModal(true) }}
            style={{ background: '#00A896', color: 'white', border: 'none', padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,168,150,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#007A6E'; e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#00A896'; e.currentTarget.style.transform = 'translateY(0)' }}
          >
            <Plus style={{ width: 16, height: 16 }} /> Novo Lead
          </button>
        </div>
      </div>

      {/* Filter Bar — item 6c: busca + botão de filtros (drawer) */}
      <div className="flex gap-3 mb-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all text-sm shadow-sm" />
        </div>
        {/* Atalho rápido "Meus leads" — alterna direto sem abrir o drawer completo */}
        <button
          onClick={() => setOwnerFilter(o => o === 'mine' ? 'all' : 'mine')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (ownerFilter === 'mine' ? '#00A896' : '#E2E8F0'), background: ownerFilter === 'mine' ? '#00A896' : '#fff', color: ownerFilter === 'mine' ? '#fff' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <UserCog style={{ width: 14, height: 14 }} /> Meus Leads
        </button>
        <button
          onClick={() => setFilterDrawerOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, border: '1.5px solid ' + (hasActiveFilters ? '#00A896' : '#E2E8F0'), background: hasActiveFilters ? '#F0FDFB' : '#fff', color: hasActiveFilters ? '#00A896' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        >
          <SlidersHorizontal style={{ width: 14, height: 14 }} /> Filtros
          {hasActiveFilters && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#00A896' }} />}
        </button>
        {hasActiveFilters && (
          <button onClick={clearAllFilters} className="px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-all font-semibold whitespace-nowrap">
            Limpar
          </button>
        )}
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
                  {/* Item 13 — clicável pra colapsar/expandir a coluna */}
                  <div
                    onClick={() => setCollapsedColumns(prev => { const next = new Set(prev); if (next.has(status)) next.delete(status); else next.add(status); return next })}
                    className={`${config.headerBg} rounded-t-xl px-4 py-3 flex items-center justify-between border-b-2 cursor-pointer select-none`}
                    style={{ borderBottomColor: config.accent }}
                  >
                    <span className={`text-sm font-bold ${config.headerText} flex items-center gap-1.5`}>
                      {collapsedColumns.has(status) ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {config.label}
                    </span>
                    <span className={`${config.badgeBg} text-white text-xs font-bold px-2.5 py-0.5 rounded-full min-w-[24px] text-center`}>{colLeads.length}</span>
                  </div>
                  {!collapsedColumns.has(status) && (
                    <DroppableColumn id={status} isOver={overColumnId === status && activeId !== null}>
                      <SortableContext items={colLeads.map(l => l.id)} strategy={verticalListSortingStrategy}>
                        {colLeads.map((lead) => (
                          <SortableCard
                            key={lead.id} lead={lead} config={config} isFlashing={flashingLeadId === lead.id}
                            compact={compactView}
                            assignedUser={lead.assigned_to ? usersById.get(lead.assigned_to) ?? null : null}
                            siblings={familySiblingsMap.get(lead.id)}
                            {...cardActions}
                          />
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
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeLead ? (
            <div className="w-[260px] rotate-1 cursor-grabbing">
              <CardContent
                lead={activeLead} config={statusConfig[activeLead.status]} isFlashing={false} overlay
                compact={compactView}
                assignedUser={activeLead.assigned_to ? usersById.get(activeLead.assigned_to) ?? null : null}
                siblings={familySiblingsMap.get(activeLead.id)}
                onSchedule={() => {}} onEdit={() => {}} onDelete={() => {}} onStatusChange={() => {}} onWhatsApp={() => {}} onReminder={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {filterDrawerEl}

      {/* Modals */}
      <NewLeadModal isOpen={showNewLeadModal} onClose={() => { setShowNewLeadModal(false); setEditingLead(null) }} onSave={handleSave} editingLead={editingLead} institutionId={user!.institution_id} users={users} activeCampaignLabel={activeCampaignCycle?.label} institutionCity={institutionCity} />

      {showScheduleVisitModal && leadToSchedule && (
        <ScheduleVisitModal isOpen={showScheduleVisitModal} onClose={() => { setShowScheduleVisitModal(false); setLeadToSchedule(null) }} lead={leadToSchedule} onSchedule={handleScheduleVisit} />
      )}

      <ReminderModal isOpen={reminderModal.open} lead={reminderModal.lead} onClose={() => setReminderModal({ open: false, lead: null })} onSave={handleSaveReminder} />

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
