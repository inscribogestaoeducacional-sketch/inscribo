import React, { useState, useEffect } from 'react'
import { Calendar, Clock, X, Save, CheckCircle } from 'lucide-react'
import { Lead } from '../../lib/supabase'
import { statusConfig } from './leadFormShared'

interface ScheduleVisitModalProps {
  isOpen: boolean
  onClose: () => void
  lead: Lead
  onSchedule: (data: { scheduled_date: string; scheduled_time: string; notes: string }) => void
}

const timeSlots = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

// Único componente de agendar visita do sistema — usado pelo Kanban de leads
// (LeadKanban.tsx) e pelo painel de Lead do WhatsApp Hub (WhatsAppHub.tsx).
// Antes existia uma cópia desatualizada aqui (Tailwind puro, sem uso real em
// nenhum lugar) enquanto o Kanban tinha sua própria versão local divergente
// — consolidado num único arquivo pra não ter dois modais de agendar visita
// com aparência e comportamento diferentes.
export default function ScheduleVisitModal({ isOpen, onClose, lead, onSchedule }: ScheduleVisitModalProps) {
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
