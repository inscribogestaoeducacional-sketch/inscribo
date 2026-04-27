import React, { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Search, Check, Trash2,
  Calendar, Clock, TrendingUp, History
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Visit, Lead } from '../../lib/supabase'
import { logAudit } from '../../hooks/useAudit'
import AuditModal from '../common/AuditModal'

// ─── Config ───────────────────────────────────────────────────────────────────
const visitStatus = {
  scheduled: { label: 'Agendada',       dot: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700', badgeStyle: { background: '#FEF3C7', color: '#B45309' } },
  completed: { label: 'Realizada',      dot: 'bg-green-400',  badge: 'bg-green-100 text-green-700', badgeStyle: { background: '#DCFCE7', color: '#15803D' } },
  no_show:   { label: 'Não compareceu', dot: 'bg-gray-400',   badge: 'bg-gray-100 text-gray-600',   badgeStyle: { background: '#F3F4F6', color: '#4B5563' } },
  cancelled: { label: 'Cancelada',      dot: 'bg-red-400',    badge: 'bg-red-100 text-red-700',     badgeStyle: { background: '#FEE2E2', color: '#B91C1C' } },
}

const timeSlots = [
  '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
]

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none transition-all'
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#14b8a6] to-[#1e2d6b] text-white rounded-lg hover:from-[#0d9488] hover:to-[#151b4e] transition-all font-semibold text-sm flex items-center gap-2'

function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ─── Nova Visita Modal ─────────────────────────────────────────────────────────
interface NovaVisitaProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: { lead_id: string; student_name: string; date: string; time: string; notes: string }) => Promise<void>
  defaultDate: string
  leads: Lead[]
}

function NovaVisitaModal({ isOpen, onClose, onSave, defaultDate, leads }: NovaVisitaProps) {
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedLead(null)
      setDate(defaultDate)
      setTime('09:00')
      setNotes('')
    }
  }, [isOpen, defaultDate])

  const filtered = search.length >= 2
    ? leads.filter(l =>
        l.student_name.toLowerCase().includes(search.toLowerCase()) ||
        (l.phone && l.phone.includes(search)) ||
        l.responsible_name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead || !date || !time) return
    setSaving(true)
    try {
      await onSave({ lead_id: selectedLead.id, student_name: selectedLead.student_name, date, time, notes })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const isMobileModal = window.innerWidth < 768

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: isMobileModal ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobileModal ? 0 : 24 }}>
      <div style={{ background: '#FFFFFF', borderRadius: isMobileModal ? '20px 20px 0 0' : 20, width: '100%', maxWidth: isMobileModal ? '100%' : 440, maxHeight: '90vh', overflowY: 'auto', border: '0.5px solid #D1FAE5', boxShadow: '0 20px 60px rgba(0,168,150,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '0.5px solid #E6F7F5' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar style={{ width: 15, height: 15, color: '#F59E0B' }} />
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Nova Visita</h2>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '0.5px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Lead search */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Lead *</label>
            {selectedLead ? (
              <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-teal-50">
                <div>
                  <span className="text-sm font-medium text-teal-800">{selectedLead.student_name}</span>
                  {selectedLead.phone && (
                    <span className="text-xs text-teal-600 ml-2">{selectedLead.phone}</span>
                  )}
                </div>
                <button type="button" onClick={() => { setSelectedLead(null); setSearch('') }}
                  className="text-gray-400 hover:text-gray-600 ml-2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar por nome ou telefone..."
                  className={`${inputCls} pl-8`}
                />
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map(lead => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => { setSelectedLead(lead); setShowDropdown(false) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-800">{lead.student_name}</span>
                        {lead.phone && <span className="text-gray-400 ml-2 text-xs">{lead.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && search.length >= 2 && filtered.length === 0 && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3">
                    <p className="text-xs text-gray-400">Nenhum lead encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Horário *</label>
              <select value={time} onChange={e => setTime(e.target.value)} className={inputCls}>
                {timeSlots.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className={inputCls}
              style={{ resize: 'none' }}
              placeholder="Observações sobre a visita..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 font-medium">
              Cancelar
            </button>
            <button type="submit" disabled={!selectedLead || saving}
              className={`${btnPrimary} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {saving ? 'Salvando...' : 'Agendar Visita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── VisitCalendar ────────────────────────────────────────────────────────────
export default function VisitCalendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  const [visits, setVisits] = useState<Visit[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)

  const [auditVisitId, setAuditVisitId] = useState<string | null>(null)

  // Inline completion
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [mobileFilter, setMobileFilter] = useState(0)

  useEffect(() => {
    if (user?.institution_id) loadData()
  }, [user])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [visitsData, leadsData] = await Promise.all([
        DatabaseService.getVisits(user!.institution_id!),
        DatabaseService.getLeads(user!.institution_id!)
      ])
      setVisits(visitsData)
      setLeads(leadsData)
    } catch (err) {
      console.error('Erro ao carregar visitas:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const today = new Date()
  const todayStr = toLocalDateStr(today)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  const weekStartStr = toLocalDateStr(weekStart)

  const statsToday = visits.filter(v => toLocalDateStr(new Date(v.scheduled_date)) === todayStr).length
  const statsWeek = visits.filter(v => toLocalDateStr(new Date(v.scheduled_date)) >= weekStartStr).length
  const statsCompleted = visits.filter(v => v.status === 'completed').length
  const statsDone = visits.filter(v => v.status === 'completed' || v.status === 'no_show').length
  const statsRate = statsDone > 0 ? Math.round((statsCompleted / statsDone) * 100) : 0

  // ── Calendar helpers ────────────────────────────────────────────────────────
  const getDaysInMonth = (d: Date) => {
    const year = d.getFullYear()
    const month = d.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i))
    return days
  }

  const getVisitsForDate = (date: Date) => {
    const dateStr = toLocalDateStr(date)
    return visits.filter(v => toLocalDateStr(new Date(v.scheduled_date)) === dateStr)
  }

  const getDotColor = (dayVisitsArr: Visit[]) => {
    if (dayVisitsArr.length === 0) return null
    if (dayVisitsArr.some(v => v.status === 'scheduled')) return 'bg-amber-400'
    if (dayVisitsArr.some(v => v.status === 'completed')) return 'bg-green-400'
    if (dayVisitsArr.some(v => v.status === 'no_show')) return 'bg-gray-400'
    return 'bg-red-400'
  }

  // ── Selected day ────────────────────────────────────────────────────────────
  const selectedStr = toLocalDateStr(selectedDate)
  const dayVisits = visits
    .filter(v => toLocalDateStr(new Date(v.scheduled_date)) === selectedStr)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

  // ── Upcoming (next 7 days, scheduled only, excluding selected day) ──────────
  const next7 = new Date(today)
  next7.setDate(today.getDate() + 7)
  const next7Str = toLocalDateStr(next7)
  const upcomingVisits = visits
    .filter(v => {
      const d = toLocalDateStr(new Date(v.scheduled_date))
      return d >= todayStr && d <= next7Str && d !== selectedStr && v.status === 'scheduled'
    })
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .slice(0, 10)

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleCreateVisit = async (data: { lead_id: string; student_name: string; date: string; time: string; notes: string }) => {
    const [year, month, day] = data.date.split('-')
    const [hours, minutes] = data.time.split(':')
    const visitDate = new Date(+year, +month - 1, +day, +hours, +minutes, 0)
    const newVisit = await DatabaseService.createVisit({
      institution_id: user!.institution_id,
      lead_id: data.lead_id,
      student_name: data.student_name,
      scheduled_date: visitDate.toISOString(),
      notes: data.notes || undefined,
      status: 'scheduled',
    })
    await DatabaseService.updateLead(data.lead_id, { status: 'scheduled' })
    if (newVisit?.id) {
      await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: newVisit.id, action: 'created', new_value: `${data.student_name} — ${data.date}`, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    }
    await loadData()
  }

  const handleMarkCompleted = async (visitId: string) => {
    setSaving(true)
    try {
      await DatabaseService.updateVisit(visitId, {
        status: 'completed',
        ...(completionNotes ? { notes: completionNotes } : {}),
      })
      const visit = visits.find(v => v.id === visitId)
      if (visit?.lead_id) await DatabaseService.updateLead(visit.lead_id, { status: 'visit' })
      await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: visitId, action: 'status_changed', old_value: 'scheduled', new_value: 'completed', user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
      setCompletingId(null)
      setCompletionNotes('')
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleMarkNoShow = async (visitId: string) => {
    await DatabaseService.updateVisit(visitId, { status: 'no_show' })
    await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: visitId, action: 'status_changed', old_value: 'scheduled', new_value: 'no_show', user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    await loadData()
  }

  const handleCancel = async (visitId: string) => {
    if (!confirm('Cancelar esta visita?')) return
    await DatabaseService.updateVisit(visitId, { status: 'cancelled' })
    await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: visitId, action: 'deleted', old_value: 'scheduled', new_value: 'cancelled', user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    await loadData()
  }

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const formatSelectedDate = (d: Date) =>
    d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#14b8a6] border-t-transparent" />
      </div>
    )
  }

  const calDays = getDaysInMonth(calendarMonth)
  const weekLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const now = new Date()
    const todayStr2 = toLocalDateStr(now)
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const tomorrowStr = toLocalDateStr(tomorrow)
    const weekEnd = new Date(now); weekEnd.setDate(now.getDate() + 6)
    const weekEndStr = toLocalDateStr(weekEnd)

    const dateFilters = [
      { label: 'Hoje',        fn: (v: Visit) => toLocalDateStr(new Date(v.scheduled_date)) === todayStr2 },
      { label: 'Amanhã',      fn: (v: Visit) => toLocalDateStr(new Date(v.scheduled_date)) === tomorrowStr },
      { label: 'Essa semana', fn: (v: Visit) => { const d = toLocalDateStr(new Date(v.scheduled_date)); return d >= todayStr2 && d <= weekEndStr } },
    ]
    const mobileVisits = visits.filter(dateFilters[mobileFilter].fn).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar style={{ width: 16, height: 16, color: '#F59E0B' }} />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Visitas</h1>
            <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999 }}>{statsToday} hoje</span>
          </div>
          <button onClick={() => { setSelectedDate(new Date()); setShowModal(true) }}
            style={{ padding: '8px 14px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minHeight: 44 }}>
            <Plus style={{ width: 14, height: 14 }} /> Nova
          </button>
        </div>

        {/* Date chips */}
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, flexShrink: 0 }}>
          {dateFilters.map(({ label }, i) => (
            <button key={label} onClick={() => setMobileFilter(i)}
              style={{ padding: '8px 16px', borderRadius: 9999, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44,
                background: mobileFilter === i ? '#00A896' : '#fff',
                color: mobileFilter === i ? '#fff' : '#64748B',
                border: `1px solid ${mobileFilter === i ? '#00A896' : '#E2E8F0'}` } as React.CSSProperties}>
              {label}
            </button>
          ))}
        </div>

        {/* Visit list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {mobileVisits.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhuma visita para este período</p>
            </div>
          ) : mobileVisits.map(v => {
            const st = visitStatus[v.status as keyof typeof visitStatus]
            const dt = new Date(v.scheduled_date)
            const hora = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            return (
              <div key={v.id} style={{ padding: '14px 16px', background: '#fff', borderRadius: 14, margin: '0 16px 10px', border: '1px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{hora}</span>
                  <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 999, fontWeight: 600, background: st?.badgeStyle?.background ?? '#F1F5F9', color: st?.badgeStyle?.color ?? '#64748B' }}>{st?.label ?? v.status}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>{v.student_name}</p>
                {v.notes && <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 6, fontStyle: 'italic', margin: 0 }}>{v.notes}</p>}
              </div>
            )
          })}
        </div>

        {/* Modal */}
        <NovaVisitaModal isOpen={showModal} onClose={() => setShowModal(false)} leads={leads}
          defaultDate={toLocalDateStr(selectedDate)}
          onSave={async ({ lead_id, student_name, date, time, notes }) => {
            const [y, m, d] = date.split('-').map(Number)
            const [h, min] = time.split(':').map(Number)
            const dt = new Date(y, m - 1, d, h, min)
            await DatabaseService.createVisit({ institution_id: user!.institution_id!, lead_id, student_name, scheduled_date: dt.toISOString(), notes, status: 'scheduled' })
            await loadData()
          }}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', overflow: 'hidden', background: '#f8f9fb', height: '100%' }}>

      {/* ── Left column ──────────────────────────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderRight: '0.5px solid #D1FAE5', background: '#F0FDFB' }}>
        <div className="p-4 space-y-3">

          {/* KPI cards — Design System */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Hoje', value: statsToday, iconBg: '#FEF3C7', iconColor: '#F59E0B', Icon: Calendar },
              { label: 'Semana', value: statsWeek, iconBg: '#E6F7F5', iconColor: '#00A896', Icon: Clock },
              { label: 'Realizadas', value: statsCompleted, iconBg: '#D1FAE5', iconColor: '#10B981', Icon: Check },
              { label: 'Taxa', value: `${statsRate}%`, iconBg: '#EDE9FE', iconColor: '#8B5CF6', Icon: TrendingUp },
            ].map(({ label, value, iconBg, iconColor, Icon }) => (
              <div key={label} style={{ background: '#FFFFFF', borderRadius: 12, border: '0.5px solid #E2E8F0', padding: '12px', boxShadow: '0 1px 3px rgba(0,168,150,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>{label}</p>
                  <div style={{ width: 26, height: 26, borderRadius: 7, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 13, height: 13, color: iconColor }} />
                  </div>
                </div>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Calendar card */}
          <div style={{ background: '#FFFFFF', borderRadius: 16, border: '0.5px solid #E2E8F0', padding: 16, boxShadow: '0 1px 4px rgba(0,168,150,0.06)' }}>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(d.getMonth() - 1); return n })}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-[#1e2d6b] capitalize">
                {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCalendarMonth(d => { const n = new Date(d); n.setMonth(d.getMonth() + 1); return n })}
                className="p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Week day labels */}
            <div className="grid grid-cols-7 mb-1">
              {weekLabels.map((d, i) => (
                <div key={i} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {calDays.map((date, i) => {
                if (!date) return <div key={i} className="h-8 w-8" />
                const dayVisitsArr = getVisitsForDate(date)
                const dotColor = getDotColor(dayVisitsArr)
                const isToday = date.toDateString() === today.toDateString()
                const isSelected = date.toDateString() === selectedDate.toDateString()
                return (
                  <div key={i} className="flex flex-col items-center justify-center py-0.5">
                    <button
                      onClick={() => setSelectedDate(date)}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', fontSize: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: isSelected ? '#00A896' : isToday ? '#E6F7F5' : 'transparent',
                        color: isSelected ? '#FFFFFF' : isToday ? '#00A896' : '#1A2B4A',
                        fontWeight: isSelected || isToday ? 700 : 400,
                      }}
                    >
                      {date.getDate()}
                    </button>
                    {dotColor && (
                      <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-teal-300' : dotColor}`} />
                    )}
                    {!dotColor && <div className="h-2 mt-0.5" />}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(visitStatus).map(([, cfg]) => (
                <div key={cfg.label} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-xs text-gray-400">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right column ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', background: 'linear-gradient(135deg, #FFFFFF, #F0FDFB)', borderBottom: '0.5px solid #D1FAE5', boxShadow: '0 2px 8px rgba(0,168,150,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar style={{ width: 18, height: 18, color: '#F59E0B' }} />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Visitas</h2>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, textTransform: 'capitalize' }}>{formatSelectedDate(selectedDate)}</p>
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{ background: '#00A896', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(0,168,150,0.25)', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#007A6E' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#00A896' }}
          >
            <Plus style={{ width: 14, height: 14 }} />
            Nova Visita
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* Day visit cards */}
          {dayVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma visita neste dia</p>
              <p className="text-xs text-gray-300 mb-4">Clique em "Nova Visita" para agendar</p>
              <button
                onClick={() => setShowModal(true)}
                style={{ background: '#00A896', color: 'white', border: 'none', padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus className="w-4 h-4" />
                Agendar Visita
              </button>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {dayVisits.map(visit => {
                const lead = leads.find(l => l.id === visit.lead_id)
                const cfg = visitStatus[visit.status]
                const isCompleting = completingId === visit.id

                return (
                  <div key={visit.id} className="hover:shadow-md transition-shadow" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-teal-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                          {(visit.student_name || '?').charAt(0).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{visit.student_name || 'Visitante'}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700 font-medium flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(visit.scheduled_date)}
                            </span>
                            <span style={{ ...cfg.badgeStyle, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                              {cfg.label}
                            </span>
                          </div>
                          {lead && (
                            <p className="text-xs text-gray-500 mt-0.5">{lead.responsible_name}</p>
                          )}
                          {visit.notes && !isCompleting && (
                            <p className="text-xs text-gray-400 mt-1 italic">{visit.notes}</p>
                          )}
                        </div>

                        {/* Ver Lead button */}
                        {visit.lead_id && (
                          <button
                            onClick={() => navigate(`/leads?highlight=${visit.lead_id}`)}
                            className="flex-shrink-0 text-xs px-2 py-1 rounded-md bg-[#1e2d6b]/10 text-[#1e2d6b] hover:bg-[#1e2d6b]/20 font-medium transition-colors whitespace-nowrap"
                          >
                            Ver Lead
                          </button>
                        )}
                        <button
                          onClick={() => setAuditVisitId(visit.id)}
                          className="flex-shrink-0 text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium transition-colors flex items-center gap-1 whitespace-nowrap"
                          title="Ver histórico"
                        >
                          <History className="w-3 h-3" />
                          Histórico
                        </button>
                      </div>

                      {/* Inline completion notes */}
                      {isCompleting && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <textarea
                            value={completionNotes}
                            onChange={e => setCompletionNotes(e.target.value)}
                            placeholder="Observações sobre a visita realizada..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#14b8a6] focus:border-[#14b8a6] outline-none"
                            style={{ resize: 'none' }}
                            autoFocus
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleMarkCompleted(visit.id)}
                              disabled={saving}
                              className="px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              {saving ? 'Salvando...' : 'Confirmar Realizada'}
                            </button>
                            <button
                              onClick={() => { setCompletingId(null); setCompletionNotes('') }}
                              className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action bar — scheduled only */}
                    {visit.status === 'scheduled' && !isCompleting && (
                      <div className="flex border-t border-gray-100">
                        <button
                          onClick={() => { setCompletingId(visit.id); setCompletionNotes('') }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Realizada
                        </button>
                        <div className="w-px bg-gray-100" />
                        <button
                          onClick={() => handleMarkNoShow(visit.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Não compareceu
                        </button>
                        <div className="w-px bg-gray-100" />
                        <button
                          onClick={() => handleCancel(visit.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Upcoming visits */}
          {upcomingVisits.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Próximas visitas — 7 dias
              </h3>
              <div className="space-y-2">
                {upcomingVisits.map(visit => {
                  const visitDate = new Date(visit.scheduled_date)
                  return (
                    <div
                      key={visit.id}
                      className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-lg hover:shadow-sm transition-shadow"
                    >
                      <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {(visit.student_name || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">{visit.student_name}</p>
                        <p className="text-xs text-gray-400">
                          {visitDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                          {' · '}
                          {formatTime(visit.scheduled_date)}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDate(new Date(visitDate.getFullYear(), visitDate.getMonth(), visitDate.getDate()))
                          setCalendarMonth(new Date(visitDate.getFullYear(), visitDate.getMonth(), 1))
                        }}
                        className="text-xs text-teal-600 hover:text-teal-700 font-semibold whitespace-nowrap"
                      >
                        Ver dia
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Nova Visita modal */}
      <NovaVisitaModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleCreateVisit}
        defaultDate={selectedStr}
        leads={leads}
      />

      {/* Audit modal */}
      {auditVisitId && (
        <AuditModal
          recordId={auditVisitId}
          moduleName="visits"
          isOpen={!!auditVisitId}
          onClose={() => setAuditVisitId(null)}
        />
      )}
    </div>
  )
}
