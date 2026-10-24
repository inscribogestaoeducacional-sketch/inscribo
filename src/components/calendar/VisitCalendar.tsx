import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, X, Search, Check, Trash2,
  Calendar, Clock, History, CalendarCheck, MessageCircle, Settings2, AlertCircle, UserX, Percent,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { DatabaseService, Visit, Lead, supabase } from '../../lib/supabase'
import { logAudit } from '../../hooks/useAudit'
import { advanceLeadTo, isPastVisit } from '../../lib/visitOutcome'
import { normalizeBrazilianInput } from '../../lib/phone'
import { BRAND } from '../../lib/brand'
import PageHeader from '../ui/PageHeader'
import { CountUp } from '../campanha/CampaignCharts'
import { sendVisitMessages, isVisitAutoMessageOn, setVisitAutoMessage } from '../../lib/visitMessages'
import VisitOutcomePicker from '../visits/VisitOutcomePicker'
import { DEFAULT_REASONS, useVisitReasons, type ReasonKind } from '../../lib/visitReasons'
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

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#2DCBA4] focus:border-[#2DCBA4] outline-none transition-all'
const btnPrimary = 'px-4 py-2 bg-gradient-to-r from-[#2DCBA4] to-[#1e2d6b] text-white rounded-lg hover:from-[#0d9488] hover:to-[#151b4e] transition-all font-semibold text-sm flex items-center gap-2'

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

// ─── Editor dos motivos (gestor/admin) ────────────────────────────────────────
function ReasonsEditor({ institutionId, onClose, onSaved }: { institutionId: string; onClose: () => void; onSaved: () => void }) {
  const { labelsFor, rows } = useVisitReasons(institutionId)
  const [lists, setLists] = useState<Record<ReasonKind, string[]> | null>(null)
  const [draft, setDraft] = useState<Record<ReasonKind, string>>({ no_show: '', cancelled: '' })
  const [saving, setSaving] = useState(false)
  const { user: me } = useAuth()
  const [autoMsg, setAutoMsg] = useState(false)
  useEffect(() => { isVisitAutoMessageOn(institutionId).then(setAutoMsg) }, [institutionId])
  useEffect(() => { setLists({ no_show: labelsFor('no_show'), cancelled: labelsFor('cancelled') }) }, [rows.length]) // eslint-disable-line
  if (!lists) return null
  const kinds: [ReasonKind, string][] = [['no_show', 'Quando a família faltou'], ['cancelled', 'Quando a visita foi cancelada']]
  const save = async () => {
    setSaving(true)
    if (me?.id) await setVisitAutoMessage(institutionId, autoMsg, me.id).catch(() => undefined)
    for (const [k] of kinds) {
      await supabase.from('visit_reasons').delete().eq('institution_id', institutionId).eq('kind', k)
      if (lists[k].length) await supabase.from('visit_reasons').insert(lists[k].map((label, i) => ({ institution_id: institutionId, kind: k, label, sort_order: i })))
    }
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(15,23,42,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Configurar visitas</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={18} color={BRAND.muted} /></button>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: BRAND.muted }}>Essas opções aparecem para quem dá baixa na visita. “Outro” sempre existe.</p>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 12, padding: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={autoMsg} onChange={e => setAutoMsg(e.target.checked)} style={{ width: 18, height: 18, marginTop: 2, accentColor: BRAND.primary }} />
          <span style={{ fontSize: 12.5, color: BRAND.text, lineHeight: 1.45 }}><b style={{ color: BRAND.ink }}>Enviar confirmação e lembrete pelo WhatsApp ao agendar</b><br />Vale para visitas marcadas no calendário e no cartão do lead. Sai pela API oficial, com os modelos de confirmação e lembrete da escola (editáveis em Configurações).</span>
        </label>
        {kinds.map(([k, title]) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>{title}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {lists[k].map((l, i) => (
                <span key={l + i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: BRAND.soft, color: BRAND.primaryDark, fontSize: 12, fontWeight: 600, padding: '3px 6px 3px 11px', borderRadius: 999 }}>
                  {l}<button type="button" onClick={() => setLists(p => p && ({ ...p, [k]: p[k].filter((_, j) => j !== i) }))} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={13} color={BRAND.primaryDark} /></button>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={draft[k]} onChange={e => setDraft(d => ({ ...d, [k]: e.target.value }))} placeholder="Novo motivo"
                onKeyDown={e => { if (e.key === 'Enter' && draft[k].trim()) { setLists(p => p && ({ ...p, [k]: [...p[k], draft[k].trim()] })); setDraft(d => ({ ...d, [k]: '' })) } }}
                style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${BRAND.line}`, fontSize: 13, outline: 'none' }} />
              <button type="button" onClick={() => { if (!draft[k].trim()) return; setLists(p => p && ({ ...p, [k]: [...p[k], draft[k].trim()] })); setDraft(d => ({ ...d, [k]: '' })) }}
                style={{ padding: '7px 12px', borderRadius: 9, border: 'none', background: BRAND.primary, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Adicionar</button>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" onClick={() => setLists({ no_show: DEFAULT_REASONS.no_show, cancelled: DEFAULT_REASONS.cancelled })} style={{ border: 'none', background: 'none', color: BRAND.muted, cursor: 'pointer', fontSize: 12.5 }}>Voltar ao padrão</button>
          <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 18px', borderRadius: 10, border: 'none', background: BRAND.primary, color: '#fff', fontWeight: 800, cursor: 'pointer' }}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Tela de Visitas ──────────────────────────────────────────────────────────
type ViewMode = 'month' | 'week' | 'list'
type Focus = null | 'today' | 'pending' | 'unconfirmed'
interface MsgInfo { status: string; scheduled_for: string; sent_at: string | null }

const STAGE_CSS = `
@keyframes vsFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes vsPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.35)}50%{box-shadow:0 0 0 7px rgba(239,68,68,0)}}
.vs-in{animation:vsFade .32s ease both}
.vs-card{transition:transform .16s ease, box-shadow .16s ease}
.vs-card:hover{transform:translateY(-2px);box-shadow:0 10px 22px -12px rgba(0,122,110,.4)}
.vs-kpi{transition:transform .16s ease, box-shadow .16s ease;cursor:pointer;font-family:inherit;text-align:left}
.vs-kpi:hover{transform:translateY(-2px);box-shadow:0 10px 22px -14px rgba(26,43,74,.35)}
.vs-alert{animation:vsPulse 2.2s ease-in-out infinite}
.vs-day{transition:background .12s ease, transform .12s ease}
.vs-day:hover{background:#fff;transform:scale(1.06)}
@media (prefers-reduced-motion: reduce){.vs-in,.vs-alert{animation:none}.vs-card,.vs-kpi,.vs-day{transition:none}}
`

const STATUS_COLOR: Record<string, string> = { scheduled: '#8B5CF6', completed: '#10B981', no_show: '#94A3B8', cancelled: '#F87171' }

export default function VisitCalendar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [visits, setVisits] = useState<Visit[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [users, setUsers] = useState<Map<string, string>>(new Map())
  const [msgs, setMsgs] = useState<Map<string, MsgInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('month')
  const [focus, setFocus] = useState<Focus>(() => new URLSearchParams(window.location.search).get('pendentes') === '1' ? 'pending' : null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showModal, setShowModal] = useState(false)
  const [showReasons, setShowReasons] = useState(false)
  const [auditVisitId, setAuditVisitId] = useState<string | null>(null)
  const [baixaId, setBaixaId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t) }, [toast])
  const { refresh: refreshReasons } = useVisitReasons(user?.institution_id)
  const canEdit = user?.role === 'admin' || user?.role === 'manager'

  const loadData = useCallback(async () => {
    if (!user?.institution_id) return
    try {
      const inst = user.institution_id
      const [visitsData, leadsData, usersRes] = await Promise.all([
        DatabaseService.getVisits(inst),
        DatabaseService.getLeads(inst),
        supabase.from('users').select('id, full_name').eq('institution_id', inst),
      ])
      setVisits(visitsData); setLeads(leadsData)
      setUsers(new Map(((usersRes.data ?? []) as { id: string; full_name: string }[]).map(u => [u.id, u.full_name])))
      const ids = visitsData.filter(v => v.status === 'scheduled').map(v => v.id)
      if (ids.length) {
        const { data } = await supabase.from('whatsapp_scheduled_messages').select('visit_id, status, scheduled_for, sent_at')
          .in('visit_id', ids).order('scheduled_for', { ascending: false })
        const m = new Map<string, MsgInfo>()
        for (const r of (data ?? []) as (MsgInfo & { visit_id: string })[]) if (!m.has(r.visit_id)) m.set(r.visit_id, r)
        setMsgs(m)
      } else setMsgs(new Map())
    } catch (err) { console.error('Erro ao carregar visitas:', err) } finally { setLoading(false) }
  }, [user?.institution_id])
  useEffect(() => { loadData() }, [loadData])

  const leadById = useMemo(() => new Map(leads.map(l => [l.id, l])), [leads])
  const today = new Date(); const todayStr = toLocalDateStr(today)
  const dayStr = (v: Visit) => toLocalDateStr(new Date(v.scheduled_date))
  const sortAsc = (a: Visit, b: Visit) => a.scheduled_date.localeCompare(b.scheduled_date)

  const pending = useMemo(() => visits.filter(v => v.status === 'scheduled' && isPastVisit(v)).sort(sortAsc), [visits])
  const todayVisits = visits.filter(v => dayStr(v) === todayStr).sort(sortAsc)
  const in7 = toLocalDateStr(new Date(Date.now() + 7 * 86400000))
  const unconfirmed = visits.filter(v => v.status === 'scheduled' && !isPastVisit(v) && dayStr(v) <= in7 && !v.confirmed_at).sort(sortAsc)
  const monthKey = `${today.getFullYear()}-${today.getMonth()}`
  const monthDone = visits.filter(v => { const d = new Date(v.scheduled_date); return `${d.getFullYear()}-${d.getMonth()}` === monthKey && (v.status === 'completed' || v.status === 'no_show') })
  const monthRate = monthDone.length ? Math.round(monthDone.filter(v => v.status === 'completed').length / monthDone.length * 100) : 0
  const monthNoShow = monthDone.filter(v => v.status === 'no_show').length

  const calDays = (() => {
    const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth()
    const days: (Date | null)[] = []
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) days.push(null)
    for (let i = 1; i <= new Date(y, m + 1, 0).getDate(); i++) days.push(new Date(y, m, i))
    return days
  })()
  const dayColor = (arr: Visit[]) => arr.some(v => v.status === 'scheduled' && isPastVisit(v)) ? '#EF4444'
    : arr.some(v => v.status === 'scheduled') ? '#8B5CF6' : arr.some(v => v.status === 'completed') ? '#10B981' : arr.length ? '#94A3B8' : null

  const selectedStr = toLocalDateStr(selectedDate)
  const dayVisits = visits.filter(v => dayStr(v) === selectedStr).sort(sortAsc)
  const weekStart = new Date(selectedDate); weekStart.setDate(selectedDate.getDate() - selectedDate.getDay())
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d })
  const upcoming = visits.filter(v => v.status === 'scheduled' && !isPastVisit(v)).sort(sortAsc)

  const handleCreateVisit = async (data: { lead_id: string; student_name: string; date: string; time: string; notes: string }) => {
    const [year, month, day] = data.date.split('-'); const [hours, minutes] = data.time.split(':')
    const visitDate = new Date(+year, +month - 1, +day, +hours, +minutes, 0)
    const newVisit = await DatabaseService.createVisit({
      institution_id: user!.institution_id, lead_id: data.lead_id, student_name: data.student_name,
      scheduled_date: visitDate.toISOString(), notes: data.notes || undefined, status: 'scheduled',
    })
    await advanceLeadTo(data.lead_id, 'scheduled')
    if (newVisit?.id) await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: newVisit.id, action: 'created', new_value: `${data.student_name} — ${data.date}`, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    if (newVisit?.id) {
      const lead = leadById.get(data.lead_id)
      if (lead) {
        const r = await sendVisitMessages({ institutionId: user!.institution_id!, lead, visitId: newVisit.id, visitDate, userId: user!.id }).catch(() => null)
        setToast(r?.sent ? 'Visita agendada. Confirmação enviada pelo WhatsApp.' : r?.note ? 'Visita agendada. ' + r.note : 'Visita agendada.')
      }
    }
    await loadData()
  }

  const confirmVisit = async (v: Visit, on: boolean) => {
    await DatabaseService.updateVisit(v.id, { confirmed_at: on ? new Date().toISOString() : null, confirmed_via: on ? 'atendente' : null } as Partial<Visit>)
    await logAudit({ institution_id: user!.institution_id, module: 'visits', record_id: v.id, action: 'updated', field_changed: 'confirmação da família', new_value: on ? 'confirmou' : 'desfeita', user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
    await loadData()
  }

  const openChat = (v: Visit) => {
    const l = v.lead_id ? leadById.get(v.lead_id) : undefined
    if (l?.phone) navigate(`/whatsapp?phone=${normalizeBrazilianInput(l.phone)}`)
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const pill = (bg: string, color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg, color, fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999 })

  const VisitCard = ({ v, i }: { v: Visit; i: number }) => {
    const lead = v.lead_id ? leadById.get(v.lead_id) : undefined
    const owner = users.get(v.assigned_to ?? lead?.assigned_to ?? '') ?? null
    const past = v.status === 'scheduled' && isPastVisit(v)
    const stripe = past ? '#EF4444' : STATUS_COLOR[v.status] ?? '#8B5CF6'
    const msg = msgs.get(v.id)
    const name = v.student_name || lead?.student_name || 'Visitante'
    const initials = name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    return (
      <div className="vs-card vs-in" style={{ animationDelay: `${Math.min(i, 10) * 30}ms`, background: '#fff', borderRadius: 16, padding: 12, borderLeft: `4px solid ${stripe}`, boxShadow: '0 1px 2px rgba(26,43,74,.05), 0 6px 16px -10px rgba(26,43,74,.22)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: `linear-gradient(135deg, ${stripe}, ${stripe}BB)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}{lead?.grade_interest && <span style={{ fontWeight: 400, color: BRAND.muted }}> · {lead.grade_interest}</span>}</div>
            <div style={{ fontSize: 12, color: BRAND.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead?.responsible_name || 'Sem responsável'} · {owner ? `atendente ${owner}` : 'sem atendente'}</div>
          </div>
          <span style={pill(past ? '#FEE2E2' : '#EDE9FE', past ? '#B91C1C' : '#6D28D9')}><Clock size={12} />{view === 'month' ? fmtTime(v.scheduled_date) : `${new Date(v.scheduled_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${fmtTime(v.scheduled_date)}`}{past ? ' · sem baixa' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 9, flexWrap: 'wrap' }}>
          {v.status === 'completed' && <span style={pill('#DCFCE7', '#15803D')}><Check size={11} />Realizada</span>}
          {v.status === 'no_show' && <span style={pill('#F1F5F9', '#475569')}><UserX size={11} />Faltou{v.reason_label ? `: ${v.reason_label}` : ''}</span>}
          {v.status === 'cancelled' && <span style={pill('#FEE2E2', '#B91C1C')}>Cancelada{v.reason_label ? `: ${v.reason_label}` : ''}</span>}
          {v.status === 'scheduled' && !past && (v.confirmed_at
            ? <span style={pill('#DCFCE7', '#15803D')}><Check size={11} />Família confirmou</span>
            : <span style={pill('#FEF3C7', '#B45309')}>Sem confirmação</span>)}
          {v.status === 'scheduled' && msg && <span style={pill('#F1F5F9', '#475569')}>{msg.status === 'sent' ? `Lembrete enviado ${fmtTime(msg.sent_at ?? msg.scheduled_for)}` : msg.status === 'pending' ? `Lembrete às ${fmtTime(msg.scheduled_for)}` : msg.status === 'failed' ? 'Lembrete falhou' : 'Lembrete cancelado'}</span>}
          {v.status === 'scheduled' && !msg && <span style={pill('#F1F5F9', '#64748B')}>Sem lembrete agendado</span>}
        </div>
        {v.notes && <p style={{ margin: '8px 0 0', fontSize: 12, color: BRAND.muted, fontStyle: 'italic' }}>{v.notes}</p>}
        {v.reason_detail && <p style={{ margin: '4px 0 0', fontSize: 12, color: BRAND.muted }}>{v.reason_detail}</p>}
        {(past || baixaId === v.id) && v.status === 'scheduled' && (
          <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 10, marginTop: 9 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#9A3412', marginBottom: 7 }}>A visita aconteceu?</div>
            <VisitOutcomePicker visit={{ id: v.id, lead_id: v.lead_id ?? null, scheduled_date: v.scheduled_date, student_name: v.student_name }} onDone={() => { setBaixaId(null); loadData() }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 9, borderTop: '1px solid #F1F5F4', flexWrap: 'wrap' }}>
          {v.lead_id && <button type="button" onClick={() => navigate(`/leads?open=${v.lead_id}`)} style={{ background: '#EEF2FF', color: '#4338CA', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Ver lead</button>}
          {lead?.phone && <button type="button" onClick={() => openChat(v)} style={{ background: '#DCFCE7', color: '#15803D', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><MessageCircle size={13} />Conversa</button>}
          {v.status === 'scheduled' && !past && (v.confirmed_at
            ? <button type="button" onClick={() => confirmVisit(v, false)} style={{ background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Desfazer confirmação</button>
            : <button type="button" onClick={() => confirmVisit(v, true)} style={{ background: '#DCFCE7', color: '#15803D', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={13} />Família confirmou</button>)}
          {v.status === 'scheduled' && !past && baixaId !== v.id && <button type="button" onClick={() => setBaixaId(v.id)} style={{ background: '#FFF7ED', color: '#C2410C', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>Dar baixa</button>}
          <button type="button" onClick={() => setAuditVisitId(v.id)} style={{ background: '#F1F5F9', color: '#475569', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><History size={13} />Histórico</button>
        </div>
      </div>
    )
  }

  const List = ({ items, empty }: { items: Visit[]; empty: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.length === 0 && <div style={{ textAlign: 'center', padding: '30px 10px', color: BRAND.faint, fontSize: 13 }}>{empty}</div>}
      {items.map((v, i) => <VisitCard key={v.id} v={v} i={i} />)}
    </div>
  )

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2DCBA4] border-t-transparent" /></div>

  const kpi = (key: Focus, label: string, value: number, sub: string, color: string, Icon: typeof Clock, opts?: { alert?: boolean; suffix?: string; fill?: number }) => {
    const on = focus === key && key !== null
    const alert = !!opts?.alert
    const accent = alert ? '#B91C1C' : color
    return (
      <button key={label} type="button" className={`vs-kpi vs-in ${alert && !on ? 'vs-alert' : ''}`} onClick={() => key && setFocus(on ? null : key)}
        style={{ background: on ? BRAND.softer : '#fff', borderRadius: 16, padding: 0, overflow: 'hidden', border: `${alert || on ? 2 : 1}px solid ${on ? BRAND.primary : alert ? '#EF4444' : BRAND.line}`, cursor: key ? 'pointer' : 'default', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px 12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 600 }}>
            <span style={{ width: 24, height: 24, borderRadius: 7, background: accent + '1F', color: accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} /></span>{label}
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: accent, lineHeight: 1.15, marginTop: 8 }}><CountUp value={value} />{opts?.suffix}</div>
          <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>{sub}</div>
        </div>
        <div style={{ height: 4, background: '#EEF2F1' }}><div style={{ width: `${Math.max(0, Math.min(100, opts?.fill ?? (value > 0 ? 100 : 0)))}%`, height: '100%', background: accent, transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
      </button>
    )
  }

  const focusTitle = focus === 'pending' ? `Visitas que já passaram e estão sem baixa (${pending.length})`
    : focus === 'unconfirmed' ? `Próximas visitas sem confirmação da família (${unconfirmed.length})`
    : focus === 'today' ? `Visitas de hoje (${todayVisits.length})` : ''

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: '100%', background: BRAND.bg }}>
      <style>{STAGE_CSS}</style>
      <PageHeader icon={CalendarCheck} title="Visitas"
        subtitle={today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={<>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.16)', borderRadius: 10, padding: 3 }}>
            {([['month', 'Mês'], ['week', 'Semana'], ['list', 'Lista']] as [ViewMode, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setView(k); setFocus(null) }} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, background: view === k && !focus ? '#fff' : 'transparent', color: view === k && !focus ? BRAND.primaryDark : '#fff', transition: 'all .15s' }}>{l}</button>
            ))}
          </div>
          {canEdit && <button type="button" onClick={() => setShowReasons(true)} title="Motivos de não realização" style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Settings2 size={16} color="#fff" /></button>}
          <button type="button" onClick={() => { setSelectedDate(new Date()); setShowModal(true) }} style={{ background: '#fff', color: BRAND.primaryDark, border: 'none', padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Nova visita</button>
        </>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {kpi('today', 'Hoje', todayVisits.length, `${todayVisits.filter(v => v.confirmed_at).length} já confirmou`, '#D97706', Calendar, { fill: todayVisits.length ? todayVisits.filter(v => v.confirmed_at).length / todayVisits.length * 100 : 0 })}
        {kpi('pending', 'Sem baixa', pending.length, 'já passaram, falta dizer', '#B91C1C', AlertCircle, { alert: pending.length > 0 })}
        {kpi('unconfirmed', 'Sem confirmação', unconfirmed.length, 'próximos 7 dias', '#6366F1', Clock)}
        {kpi(null, 'Comparecimento', monthRate, `no mês · ${monthNoShow} falta${monthNoShow === 1 ? '' : 's'}`, BRAND.primaryDark, Percent, { suffix: '%', fill: monthRate })}
      </div>

      {focus ? (
        <div className="vs-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span id="visitas-sem-baixa" style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{focusTitle}</span>
            <button type="button" onClick={() => setFocus(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12.5, color: BRAND.muted, display: 'flex', alignItems: 'center', gap: 4 }}><X size={14} />Limpar filtro</button>
          </div>
          <List items={focus === 'pending' ? pending : focus === 'unconfirmed' ? unconfirmed : todayVisits} empty="Nada por aqui. Tudo em dia." />
        </div>
      ) : view === 'list' ? (
        <div className="vs-in"><div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Próximas visitas ({upcoming.length})</div><List items={upcoming} empty="Nenhuma visita agendada." /></div>
      ) : view === 'week' ? (
        <div className="vs-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <button type="button" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))} style={{ border: 'none', background: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, flex: 1, textAlign: 'center' }}>{weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
            <button type="button" onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))} style={{ border: 'none', background: '#fff', borderRadius: 8, padding: 6, cursor: 'pointer' }}><ChevronRight size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
            {weekDays.map(d => {
              const arr = visits.filter(v => dayStr(v) === toLocalDateStr(d)).sort(sortAsc)
              const isToday = toLocalDateStr(d) === todayStr
              return (
                <div key={d.toISOString()} style={{ background: isToday ? BRAND.softer : '#F1F5F4', borderRadius: 16, padding: 8, border: `1px solid ${isToday ? BRAND.softLine : 'transparent'}` }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: isToday ? BRAND.primaryDark : BRAND.ink, padding: '2px 4px 8px', textTransform: 'capitalize' }}>{d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })} <span style={{ color: BRAND.faint, fontWeight: 600 }}>· {arr.length}</span></div>
                  <List items={arr} empty="Livre" />
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))', gap: 14, alignItems: 'start' }}>
          <div className="vs-in" style={{ background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 16, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronLeft size={18} color={BRAND.faint} /></button>
              <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, textTransform: 'capitalize' }}>{calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
              <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><ChevronRight size={18} color={BRAND.faint} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', fontSize: 11, color: BRAND.faint, marginBottom: 3 }}>{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, textAlign: 'center' }}>
              {calDays.map((d, i) => {
                if (!d) return <span key={i} />
                const arr = visits.filter(v => dayStr(v) === toLocalDateStr(d))
                const col = dayColor(arr); const sel = toLocalDateStr(d) === selectedStr; const isT = toLocalDateStr(d) === todayStr
                return (
                  <button key={i} type="button" className="vs-day" onClick={() => setSelectedDate(d)} style={{ border: isT && !sel ? `1px solid ${BRAND.primary}` : '1px solid transparent', borderRadius: 9, padding: '4px 0', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: sel || isT ? 800 : 500, background: sel ? BRAND.primary : 'transparent', color: sel ? '#fff' : BRAND.ink }}>
                    {d.getDate()}
                    <div style={{ height: 6, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>{col && <span style={{ width: 5, height: 5, borderRadius: '50%', background: sel ? '#fff' : col }} />}{arr.length > 1 && <span style={{ fontSize: 8, color: sel ? '#fff' : BRAND.muted }}>{arr.length}</span>}</div>
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${BRAND.softLine}`, fontSize: 11, color: BRAND.muted }}>
              {[['#10B981', 'Realizada'], ['#EF4444', 'Sem baixa'], ['#94A3B8', 'Faltou'], ['#8B5CF6', 'Agendada']].map(([c, l]) => <span key={l}><i style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, marginRight: 4 }} />{l}</span>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 8, textTransform: 'capitalize' }}>{selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} <span style={{ color: BRAND.faint, fontWeight: 600, textTransform: 'none' }}>· {dayVisits.length} visita{dayVisits.length === 1 ? '' : 's'}</span></div>
            <List items={dayVisits} empty="Nenhuma visita neste dia." />
          </div>
        </div>
      )}

      <NovaVisitaModal isOpen={showModal} onClose={() => setShowModal(false)} onSave={handleCreateVisit} defaultDate={selectedStr} leads={leads} />
      {auditVisitId && <AuditModal recordId={auditVisitId} moduleName="visits" isOpen={!!auditVisitId} onClose={() => setAuditVisitId(null)} />}
      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 100, background: '#15803D', color: '#fff', padding: '12px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, maxWidth: 360, boxShadow: '0 10px 24px rgba(0,0,0,.2)' }}>{toast}</div>}
      {showReasons && user?.institution_id && <ReasonsEditor institutionId={user.institution_id} onClose={() => setShowReasons(false)} onSaved={refreshReasons} />}
    </div>
  )
}
