import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Plus, Phone, Calendar, Edit, Edit2, Trash2, X, Search,
  Clock, Users, Send, CheckCircle, Save,
  MessageCircle, AlertTriangle, ChevronDown, ChevronRight, ChevronUp,
  Flame, Sun, Snowflake, Bell, UserCog, SlidersHorizontal,
  LayoutGrid, Rows3, Tag, Megaphone, MapPin, GraduationCap, UserPlus2,
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
import { getLeadReminderInfo, REMINDER_COLORS } from '../../lib/leadReminders'

type AuditEntry = {
  id: string; action: string; record_id: string; module: string
  institution_id: string; user_id: string | null; user_name: string | null
  user_role: string | null; field_changed: string | null; old_value: string | null
  new_value: string | null; created_at: string
}

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

// 'Concurso de Bolsas' adicionado pra dar sentido ao campo condicional
// contest_name (item 11) — antes não existia nenhuma origem relacionada a
// concurso/bolsa na lista, então o campo nunca teria como ficar visível.
const sourceOptions = ['Facebook', 'Instagram', 'Google', 'Site', 'Indicação', 'WhatsApp', 'Concurso de Bolsas', 'Outros']

// Séries — antes existiam DUAS listas hardcoded divergentes aqui mesmo
// (gradeOptions usada pra salvar, GRADES usada só pro filtro, com Ensino
// Médio em nomenclaturas diferentes — o filtro nunca encontrava nada).
// Agora vêm de school_grade_levels via useGradeLevels(), configurável por
// escola (Configurações → Escola). Ver hooks/useGradeLevels.ts.

// ─── Temperatura do lead ──────────────────────────────────────────────────────
const LEAD_TEMPERATURES = [
  { value: 'quente', label: 'Quente', icon: Flame,     color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'morno',  label: 'Morno',  icon: Sun,       color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'frio',   label: 'Frio',   icon: Snowflake, color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
] as const

// Lógica de lembrete (manual + automático "sem contato") vive em
// lib/leadReminders.ts — reaproveitada aqui, no GestorHome e no AttendantHome.

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
interface SimpleUser { id: string; full_name: string; role?: string }

interface NewLeadModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: Partial<Lead> & { familyMatchId?: string | null }) => Promise<void>
  editingLead?: Lead | null
  onDelete?: (id: string) => void
  institutionId: string
  users: SimpleUser[]
  activeCampaignLabel?: string | null
  institutionCity?: string
}

const LEAD_STAGES = [
  { key: 'new',       label: 'Novo'      },
  { key: 'contact',   label: 'Contato'   },
  { key: 'scheduled', label: 'Ag.'       },
  { key: 'visit',     label: 'Visita'    },
  { key: 'proposal',  label: 'Proposta'  },
  { key: 'enrolled',  label: 'Matrícula' },
] as const

function avatarColor(name: string): string {
  const colors = ['#00A896', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981']
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return colors[Math.abs(h) % colors.length]
}

// Resultado da checagem de telefone já cadastrado (item 3b). id pode ser um
// UUID real de lead_families (família já existe) OU `retro:<leadId>` — um
// lead avulso antigo com esse telefone que ainda não foi agrupado; nesse
// caso o handleSave do componente pai cria a família na hora e promove os
// dois leads (o antigo + o novo) pra ela.
interface FamilyMatch {
  id: string
  responsible_name: string
  phone: string
  email: string | null
  address: string | null
  childrenCount: number
}

function NewLeadModal({ isOpen, onClose, onSave, editingLead, onDelete, institutionId, users, activeCampaignLabel, institutionCity }: NewLeadModalProps) {
  const { user: modalUser } = useAuth()
  const { names: gradeNames } = useGradeLevels(institutionId)
  const [activeTab, setActiveTab] = useState<'dados' | 'historico' | 'anotacoes'>('dados')
  const [saving, setSaving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [savingActivity, setSavingActivity] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<AuditEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [activityForm, setActivityForm] = useState({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
  const [familyMatch, setFamilyMatch] = useState<FamilyMatch | null>(null)
  const [checkingFamily, setCheckingFamily] = useState(false)
  const [familyMatchId, setFamilyMatchId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    student_name: '', grade_interest: '', shift_interest: '',
    responsible_name: '', phone: '', email: '', address: '', city: '',
    budget_range: '', source: '', notes: '',
    status: 'new' as Lead['status'],
    assigned_to: '' as string,
    next_followup: '' as string,
    lead_temperature: '' as '' | 'frio' | 'morno' | 'quente',
    origin_school: '', referral_source: '', contest_name: '',
  })

  useEffect(() => {
    if (!isOpen) return
    if (editingLead) {
      setFormData({
        student_name: editingLead.student_name ?? '',
        grade_interest: editingLead.grade_interest ?? '',
        shift_interest: (editingLead as any).shift_interest ?? '',
        responsible_name: editingLead.responsible_name ?? '',
        phone: editingLead.phone ?? '',
        email: editingLead.email ?? '',
        address: editingLead.address ?? '',
        city: editingLead.city ?? '',
        budget_range: editingLead.budget_range ?? '',
        source: editingLead.source ?? '',
        notes: editingLead.notes ?? '',
        status: editingLead.status ?? 'new',
        assigned_to: editingLead.assigned_to ?? '',
        next_followup: editingLead.next_followup ? editingLead.next_followup.slice(0, 10) : '',
        lead_temperature: editingLead.lead_temperature ?? '',
        origin_school: editingLead.origin_school ?? '',
        referral_source: editingLead.referral_source ?? '',
        contest_name: editingLead.contest_name ?? '',
      })
    } else {
      setFormData({
        student_name: '', grade_interest: '', shift_interest: '',
        responsible_name: '', phone: '', email: '', address: '', city: institutionCity ?? '',
        budget_range: '', source: '', notes: '',
        status: 'new',
        assigned_to: modalUser?.id ?? '',
        next_followup: '', lead_temperature: '',
        origin_school: '', referral_source: '', contest_name: '',
      })
    }
    setActiveTab('dados')
    setFieldErrors({})
    setQuickNote('')
    setHistory([])
    setFamilyMatch(null)
    setFamilyMatchId(null)
  }, [editingLead, isOpen])

  useEffect(() => {
    if (activeTab === 'historico' && editingLead?.id) {
      setLoadingHistory(true)
      ;(async () => {
        try {
          const { supabase: db } = await import('../../lib/supabase')
          const instId = (editingLead as any).institution_id ?? ''
          const { data } = await db.from('audit_logs')
            .select('*')
            .eq('institution_id', instId)
            .eq('record_id', editingLead.id)
            .eq('module', 'lead')
            .order('created_at', { ascending: true })
            .limit(50)
          setHistory((data || []) as AuditEntry[])
        } catch { setHistory([]) }
        finally { setLoadingHistory(false) }
      })()
    }
  }, [activeTab, editingLead?.id])

  // ── Item 3b: detectar família já cadastrada com esse telefone ────────────
  // Só roda ao criar (não editar) e só depois que o campo perde foco, pra não
  // consultar a cada tecla digitada.
  const checkFamilyByPhone = async () => {
    if (editingLead || familyMatchId) return
    const digits = formData.phone.replace(/\D/g, '')
    if (digits.length < 10 || !institutionId) { setFamilyMatch(null); return }
    setCheckingFamily(true)
    try {
      const { data: fam } = await supabase
        .from('lead_families')
        .select('id, responsible_name, phone, email, address')
        .eq('institution_id', institutionId)
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .maybeSingle()
      if (fam) {
        const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)
        setFamilyMatch({ id: fam.id, responsible_name: fam.responsible_name, phone: fam.phone ?? '', email: fam.email, address: fam.address, childrenCount: count ?? 0 })
        return
      }
      // Lead avulso antigo com esse telefone, nunca agrupado em família.
      const { data: soloLead } = await supabase
        .from('leads')
        .select('id, responsible_name, phone, email, address')
        .eq('institution_id', institutionId)
        .is('family_id', null)
        .ilike('phone', `%${digits}%`)
        .limit(1)
        .maybeSingle()
      if (soloLead) {
        setFamilyMatch({ id: `retro:${soloLead.id}`, responsible_name: soloLead.responsible_name, phone: soloLead.phone ?? '', email: soloLead.email ?? null, address: soloLead.address ?? null, childrenCount: 1 })
      } else {
        setFamilyMatch(null)
      }
    } catch { setFamilyMatch(null) } finally { setCheckingFamily(false) }
  }

  const acceptFamilyMatch = () => {
    if (!familyMatch) return
    setFamilyMatchId(familyMatch.id)
    setFormData(f => ({
      ...f,
      responsible_name: familyMatch.responsible_name || f.responsible_name,
      phone: familyMatch.phone || f.phone,
      email: familyMatch.email || f.email,
      address: familyMatch.address || f.address,
    }))
  }

  const dismissFamilyMatch = () => { setFamilyMatch(null); setFamilyMatchId(null) }

  // ── Etiquetas (item 9b — precisam poder ser editadas em algum lugar pra
  // aparecerem no card; portado do HistoryModal, que existia nesse arquivo
  // mas nunca era instanciado — código morto removido nessa mesma leva). ──
  const [leadTags, setLeadTags] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string; color: string }[]>([])
  const [tagToast, setTagToast] = useState('')

  useEffect(() => { setLeadTags(editingLead?.tags || []) }, [editingLead])

  useEffect(() => {
    if (!institutionId) return
    ;(async () => {
      const { data } = await supabase.from('whatsapp_tags').select('id, name, color').eq('institution_id', institutionId).order('name')
      if (data) setAvailableTags(data as { id: string; name: string; color: string }[])
    })()
  }, [institutionId])

  const handleAddLeadTag = async (tagName: string) => {
    if (!editingLead || leadTags.includes(tagName)) return
    const newTags = [...leadTags, tagName]
    setLeadTags(newTags)
    const { error } = await supabase.from('leads').update({ tags: newTags }).eq('id', editingLead.id)
    if (error) { console.error('[NewLeadModal] erro ao adicionar etiqueta:', error); setTagToast('Erro ao adicionar etiqueta') }
    else setTagToast('Etiqueta adicionada!')
    setTimeout(() => setTagToast(''), 2500)
  }

  const handleRemoveLeadTag = async (tagName: string) => {
    if (!editingLead) return
    const newTags = leadTags.filter(t => t !== tagName)
    setLeadTags(newTags)
    const { error } = await supabase.from('leads').update({ tags: newTags }).eq('id', editingLead.id)
    if (error) { console.error('[NewLeadModal] erro ao remover etiqueta:', error); setTagToast('Erro ao remover etiqueta') }
    else setTagToast('Etiqueta removida!')
    setTimeout(() => setTagToast(''), 2500)
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.student_name.trim()) errors.student_name = 'Obrigatório'
    if (!formData.responsible_name.trim()) errors.responsible_name = 'Obrigatório'
    if (!formData.phone.trim()) errors.phone = 'Obrigatório'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { setActiveTab('dados'); return }
    setSaving(true)
    try {
      await onSave({ ...formData, lead_temperature: formData.lead_temperature || null, familyMatchId })
      onClose()
    } finally { setSaving(false) }
  }

  const handleSaveNote = async () => {
    if (!editingLead) return
    const noteText = quickNote || formData.notes
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const { supabase: db } = await import('../../lib/supabase')
      await db.from('leads').update({ notes: noteText }).eq('id', editingLead.id)
      setFormData(f => ({ ...f, notes: noteText }))
    } catch {} finally { setSavingNote(false) }
  }

  const handleAddActivity = async () => {
    if (!editingLead || !activityForm.descricao.trim()) return
    setSavingActivity(true)
    try {
      const { supabase: db } = await import('../../lib/supabase')
      const instId = (editingLead as any).institution_id ?? ''
      await db.from('audit_logs').insert({
        institution_id: instId, module: 'lead', record_id: editingLead.id,
        action: activityForm.tipo,
        field_changed: activityForm.descricao,
        new_value: activityForm.data,
        user_id: modalUser?.id || null, user_name: modalUser?.full_name || 'Atendente', user_role: '',
      })
      setActivityForm({ tipo: 'Ligação', descricao: '', data: new Date().toISOString().split('T')[0] })
      const { data: h } = await db.from('audit_logs')
        .select('*').eq('institution_id', instId).eq('record_id', editingLead.id).eq('module', 'lead')
        .order('created_at', { ascending: true }).limit(50)
      setHistory((h || []) as AuditEntry[])
    } catch {} finally { setSavingActivity(false) }
  }

  if (!isOpen) return null

  const initials = (formData.responsible_name || formData.student_name || '?').charAt(0).toUpperCase()
  const bgColor = avatarColor(formData.responsible_name || formData.student_name || '?')
  const curStageIdx = LEAD_STAGES.findIndex(s => s.key === formData.status)
  const formatDT = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const showReferral = formData.source === 'Indicação'
  const showContest = formData.source === 'Concurso de Bolsas'

  const getEventIcon = (action: string) => {
    if (action === 'Lead criado') return '📝'
    if (action === 'Lead editado') return '✏️'
    if (action === 'Lead perdido') return '❌'
    if (action === 'Lead reaberto') return '🔓'
    if (action === 'Status alterado') return '🔄'
    if (action === 'Visita agendada') return '📅'
    if (action === 'Ligação') return '📞'
    if (action === 'Email' || action === 'E-mail') return '📧'
    if (action === 'WhatsApp') return '💬'
    if (action === 'Presencial') return '🤝'
    return '📌'
  }
  const getEventColor = (action: string) => {
    if (action === 'Lead criado') return '#10B981'
    if (action === 'Lead editado') return '#3B82F6'
    if (action === 'Lead perdido') return '#EF4444'
    if (action === 'Lead reaberto') return '#3B82F6'
    if (action === 'Status alterado') return '#8B5CF6'
    if (action === 'Visita agendada') return '#F59E0B'
    if (action === 'Ligação') return '#06B6D4'
    if (action === 'WhatsApp') return '#25D366'
    if (action === 'Email' || action === 'E-mail') return '#3B82F6'
    if (action === 'Presencial') return '#F97316'
    return '#94A3B8'
  }
  const buildDesc = (item: AuditEntry): string => item.field_changed || item.new_value || ''

  const tabBtn = (tab: typeof activeTab, label: string) => (
    <button onClick={() => setActiveTab(tab)} style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: activeTab === tab ? '2px solid #00A896' : '2px solid transparent', color: activeTab === tab ? '#00A896' : '#64748B', background: 'transparent', transition: 'all 0.15s' }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.2)', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #00A896 0%, #007A6E 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: bgColor, border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formData.responsible_name || 'Novo Lead'}</div>
            {formData.student_name && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Aluno: {formData.student_name}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              {formData.status && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', color: '#fff' }}>{statusConfig[formData.status]?.label}</span>}
              {formData.lead_temperature && (() => {
                const t = LEAD_TEMPERATURES.find(x => x.value === formData.lead_temperature)!
                return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.25)', color: '#fff' }}><t.icon size={11} />{t.label}</span>
              })()}
              {formData.phone && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>📞 {formData.phone}</span>}
              {formData.email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>✉ {formData.email}</span>}
            </div>
            {(activeCampaignLabel && (!editingLead || editingLead.campaign_cycle_id)) && (
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                <Megaphone size={11} /> {editingLead ? `Campanha ${activeCampaignLabel}` : `Será vinculado à campanha ${activeCampaignLabel}`}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15, color: '#fff' }} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexShrink: 0, paddingLeft: 8 }}>
          {tabBtn('dados', 'Dados')}
          {editingLead && tabBtn('historico', 'Histórico')}
          {editingLead && tabBtn('anotacoes', 'Anotações')}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ABA DADOS */}
          {activeTab === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Dados do Responsável</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome completo *</label>
                    <input value={formData.responsible_name} onChange={e => { setFormData(f => ({ ...f, responsible_name: e.target.value })); setFieldErrors(p => ({ ...p, responsible_name: '' })) }} placeholder="Nome do responsável"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.responsible_name ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.responsible_name && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.responsible_name}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Telefone / WhatsApp *</label>
                    <input value={formData.phone}
                      onChange={e => { setFormData(f => ({ ...f, phone: applyPhoneMask(e.target.value) })); setFieldErrors(p => ({ ...p, phone: '' })) }}
                      onBlur={checkFamilyByPhone}
                      placeholder="11 99999-9999"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.phone ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.phone && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.phone}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>E-mail</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Cidade</label>
                    <input value={formData.city} onChange={e => setFormData(f => ({ ...f, city: e.target.value }))} placeholder="Cidade da família"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                </div>

                {/* Item 3b — família já cadastrada com esse telefone */}
                {!editingLead && checkingFamily && (
                  <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>Verificando telefone...</p>
                )}
                {!editingLead && familyMatch && !familyMatchId && (
                  <div style={{ marginTop: 10, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserPlus2 size={16} color="#1D4ED8" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1E40AF' }}>Já existe um cadastro com esse telefone: {familyMatch.responsible_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#3B82F6' }}>{familyMatch.childrenCount} aluno{familyMatch.childrenCount === 1 ? '' : 's'} já cadastrado{familyMatch.childrenCount === 1 ? '' : 's'} nessa família</p>
                    </div>
                    <button onClick={acceptFamilyMatch} style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: '#1D4ED8', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Adicionar a essa família
                    </button>
                    <button onClick={() => setFamilyMatch(null)} title="Ignorar" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#93C5FD' }}>
                      <X size={14} />
                    </button>
                  </div>
                )}
                {!editingLead && familyMatchId && (
                  <div style={{ marginTop: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <UserPlus2 size={14} color="#16A34A" />
                    <p style={{ margin: 0, flex: 1, fontSize: 12, fontWeight: 600, color: '#15803D' }}>Vinculado à família de {formData.responsible_name} — este será mais um aluno da mesma família</p>
                    <button onClick={dismissFamilyMatch} title="Desvincular" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4ADE80' }}><X size={13} /></button>
                  </div>
                )}
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Dados do Aluno</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome do aluno *</label>
                    <input value={formData.student_name} onChange={e => { setFormData(f => ({ ...f, student_name: e.target.value })); setFieldErrors(p => ({ ...p, student_name: '' })) }} placeholder="Nome completo do aluno"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: fieldErrors.student_name ? '1.5px solid #EF4444' : '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    {fieldErrors.student_name && <p style={{ fontSize: 11, color: '#EF4444', marginTop: 3 }}>{fieldErrors.student_name}</p>}
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Série de interesse</label>
                    <select value={formData.grade_interest} onChange={e => setFormData(f => ({ ...f, grade_interest: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      {gradeNames.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Turno</label>
                    <select value={formData.shift_interest} onChange={e => setFormData(f => ({ ...f, shift_interest: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      <option value="Manhã">Manhã</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Integral">Integral</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Escola de origem</label>
                    <input value={formData.origin_school} onChange={e => setFormData(f => ({ ...f, origin_school: e.target.value }))} placeholder="Escola onde o aluno estuda/estudou (opcional)"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                </div>
              </div>

              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Informações do Lead</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Origem</label>
                    <select value={formData.source} onChange={e => setFormData(f => ({ ...f, source: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Selecione</option>
                      {sourceOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Responsável (atendente)</label>
                    <select value={formData.assigned_to} onChange={e => setFormData(f => ({ ...f, assigned_to: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A', background: '#fff' }}>
                      <option value="">Sem responsável</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                  </div>
                  {/* Item 11b — campos condicionais conforme a origem selecionada */}
                  {showReferral && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Quem indicou?</label>
                      <input value={formData.referral_source} onChange={e => setFormData(f => ({ ...f, referral_source: e.target.value }))} placeholder="Nome de quem indicou"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    </div>
                  )}
                  {showContest && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Qual concurso/bolsa?</label>
                      <input value={formData.contest_name} onChange={e => setFormData(f => ({ ...f, contest_name: e.target.value }))} placeholder="Ex: Concurso de Bolsas 2027"
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Próximo follow-up</label>
                    <input type="date" value={formData.next_followup} onChange={e => setFormData(f => ({ ...f, next_followup: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Temperatura</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {LEAD_TEMPERATURES.map(t => {
                        const active = formData.lead_temperature === t.value
                        return (
                          <button key={t.value} type="button"
                            onClick={() => setFormData(f => ({ ...f, lead_temperature: active ? '' : t.value }))}
                            title={t.label}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '7px 0', borderRadius: 9, border: `1.5px solid ${active ? t.color : '#E2E8F0'}`, background: active ? t.bg : '#fff', color: active ? t.color : '#94A3B8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            <t.icon size={13} />{t.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {editingLead && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Funil de Status</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {LEAD_STAGES.map((stage, idx) => {
                        const done = idx < curStageIdx; const active = idx === curStageIdx
                        return (
                          <React.Fragment key={stage.key}>
                            <div onClick={() => setFormData(f => ({ ...f, status: stage.key as Lead['status'] }))} title={stage.label}
                              style={{ width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done || active ? '#00A896' : '#E2E8F0', border: active ? '2.5px solid #007A6E' : '2px solid transparent', boxShadow: active ? '0 0 0 3px rgba(0,168,150,0.2)' : 'none', transition: 'all 0.15s' }}>
                              {done && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>✓</span>}
                            </div>
                            {idx < LEAD_STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? '#00A896' : '#E2E8F0', transition: 'background 0.2s' }} />}
                          </React.Fragment>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex' }}>
                      {LEAD_STAGES.map((stage, idx) => (
                        <div key={stage.key} style={{ flex: idx === 0 ? '0 0 22px' : 1, textAlign: idx === 0 ? 'left' : idx === LEAD_STAGES.length - 1 ? 'right' : 'center' }}>
                          <span style={{ fontSize: 10, color: idx === curStageIdx ? '#00A896' : '#94A3B8', fontWeight: idx === curStageIdx ? 700 : 400 }}>{stage.label}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setFormData(f => ({ ...f, status: 'lost' }))}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: formData.status === 'lost' ? '#EF4444' : '#FEF2F2', color: formData.status === 'lost' ? '#fff' : '#DC2626', transition: 'all 0.15s' }}>
                      {formData.status === 'lost' ? '🔴 Perdido' : 'Marcar como Perdido'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA HISTÓRICO */}
          {activeTab === 'historico' && editingLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Registrar atividade */}
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 14, border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', marginBottom: 10 }}>Registrar atividade</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <select value={activityForm.tipo} onChange={e => setActivityForm(f => ({ ...f, tipo: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', background: '#fff', color: '#1A2B4A' }}>
                    <option>Ligação</option><option>Email</option><option>WhatsApp</option><option>Presencial</option><option>Outro</option>
                  </select>
                  <input type="date" value={activityForm.data} onChange={e => setActivityForm(f => ({ ...f, data: e.target.value }))}
                    style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', color: '#1A2B4A' }} />
                </div>
                <textarea value={activityForm.descricao} onChange={e => setActivityForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o contato..." rows={2}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 12, outline: 'none', resize: 'none', boxSizing: 'border-box', color: '#1A2B4A', marginBottom: 8 }} />
                <button onClick={handleAddActivity} disabled={savingActivity || !activityForm.descricao.trim()}
                  style={{ padding: '6px 14px', borderRadius: 8, background: '#00A896', color: '#fff', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingActivity || !activityForm.descricao.trim() ? 0.5 : 1 }}>
                  {savingActivity ? 'Salvando...' : 'Registrar'}
                </button>
              </div>

              {/* Timeline */}
              {loadingHistory
                ? <div style={{ textAlign: 'center', padding: 32 }}><div className="animate-spin rounded-full h-7 w-7 border-4 border-[#00A896] border-t-transparent mx-auto" /></div>
                : history.length === 0
                  ? <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 13 }}>Nenhuma atividade registrada</div>
                  : (
                    <div style={{ position: 'relative', paddingLeft: 28 }}>
                      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: '#E2E8F0', borderRadius: 1 }} />
                      {history.map((item, idx) => {
                        const color = getEventColor(item.action)
                        const desc = buildDesc(item)
                        return (
                          <div key={item.id} style={{ position: 'relative', marginBottom: idx < history.length - 1 ? 12 : 0 }}>
                            <div style={{
                              position: 'absolute', left: -25, top: 13,
                              width: 12, height: 12, borderRadius: '50%',
                              background: color, border: '2.5px solid #fff',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.18)', zIndex: 1,
                            }} />
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderLeft: `3px solid ${color}`, borderRadius: 10, padding: '10px 14px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A' }}>
                                  {getEventIcon(item.action)} {item.action}
                                </span>
                                <span style={{ fontSize: 10, color: '#94A3B8', whiteSpace: 'nowrap', marginLeft: 8, flexShrink: 0 }}>{formatDT(item.created_at)}</span>
                              </div>
                              {desc && <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 4px', lineHeight: 1.5 }}>{desc}</p>}
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>por {item.user_name || 'Sistema'}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
              }
            </div>
          )}

          {/* ABA ANOTAÇÕES */}
          {activeTab === 'anotacoes' && editingLead && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={13} color="#6366F1" /> Etiquetas</h4>
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
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', marginBottom: 8 }}>Nota sobre este lead</p>
                <textarea value={quickNote || formData.notes} onChange={e => setQuickNote(e.target.value)} placeholder="Anotações importantes sobre este lead..." rows={6}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1A2B4A', lineHeight: 1.6 }} />
                <button onClick={handleSaveNote} disabled={savingNote}
                  style={{ marginTop: 8, padding: '7px 16px', borderRadius: 9, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: savingNote ? 0.6 : 1 }}>
                  {savingNote ? 'Salvando...' : 'Salvar nota'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>A nota fica visível para toda a equipe.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#F8FAFC' }}>
          {editingLead && onDelete
            ? <button onClick={() => onDelete(editingLead.id)} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#DC2626' }}>Excluir lead</button>
            : <span />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#64748B' }}>Cancelar</button>
            <button onClick={handleSubmit} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', borderRadius: 9, background: saving ? '#94A3B8' : '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}>
              {saving
                ? <><div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />Salvando...</>
                : <><Save style={{ width: 14, height: 14 }} />{editingLead ? 'Salvar alterações' : 'Criar Lead'}</>}
            </button>
          </div>
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
  onClear: () => void
}

function FilterDrawer(props: FilterDrawerProps) {
  const { open, onClose, filterStatus, setFilterStatus, filterSource, setFilterSource, periodFilter, setPeriodFilter, customStart, setCustomStart, customEnd, setCustomEnd, gradeFilter, setGradeFilter, gradeNames, shiftFilter, setShiftFilter, temperatureFilter, setTemperatureFilter, ownerFilter, setOwnerFilter, users, onClear } = props
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
  const [ownerFilter, setOwnerFilter] = useState<string>('mine') // 'mine' | 'all' | 'unassigned' | <user id>
  const [reminderModal, setReminderModal] = useState<{ open: boolean; lead: Lead | null }>({ open: false, lead: null })

  // ── Item 7 — temperatura ───────────────────────────────────────────────────
  const [temperatureFilter, setTemperatureFilter] = useState<'' | 'frio' | 'morno' | 'quente'>('')

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

  const handleSave = async (data: Partial<Lead> & { familyMatchId?: string | null }) => {
    console.log('[LEAD SAVE] iniciando...', data)
    setError('')
    const instId = user!.institution_id
    let savedLeadId: string = editingLead?.id ?? ''
    const { familyMatchId, ...leadData } = data

    try {
      const { supabase: db } = await import('../../lib/supabase')

      if (editingLead) {
        const { error } = await db.from('leads').update({
          student_name:      leadData.student_name      ?? editingLead.student_name,
          responsible_name:  leadData.responsible_name  ?? editingLead.responsible_name,
          phone:             leadData.phone              ?? editingLead.phone,
          email:             leadData.email              ?? editingLead.email,
          address:           leadData.address            ?? editingLead.address,
          city:              leadData.city               ?? editingLead.city,
          grade_interest:    leadData.grade_interest      ?? editingLead.grade_interest,
          shift_interest:    (leadData as any).shift_interest ?? (editingLead as any).shift_interest,
          source:            leadData.source              ?? editingLead.source,
          budget_range:      leadData.budget_range        ?? editingLead.budget_range,
          notes:             leadData.notes               ?? editingLead.notes,
          status:            leadData.status              || editingLead.status,
          assigned_to:       leadData.assigned_to !== undefined ? (leadData.assigned_to || null) : editingLead.assigned_to,
          next_followup:     leadData.next_followup !== undefined ? (leadData.next_followup || null) : editingLead.next_followup,
          lead_temperature:  leadData.lead_temperature !== undefined ? (leadData.lead_temperature || null) : editingLead.lead_temperature,
          origin_school:     leadData.origin_school !== undefined ? (leadData.origin_school || null) : editingLead.origin_school,
          referral_source:   leadData.referral_source !== undefined ? (leadData.referral_source || null) : editingLead.referral_source,
          contest_name:      leadData.contest_name !== undefined ? (leadData.contest_name || null) : editingLead.contest_name,
          updated_at:        new Date().toISOString(),
        }).eq('id', editingLead.id)
        if (error) throw error

        const changes: Record<string, unknown> = {}
        Object.keys(leadData).forEach(key => {
          const nv = (leadData as Record<string, unknown>)[key]
          const ov = (editingLead as unknown as Record<string, unknown>)[key]
          if (nv !== ov && nv !== undefined && nv !== null && nv !== '') { changes[key] = nv }
        })
        if (Object.keys(changes).length > 0) {
          await db.from('audit_logs').insert({
            institution_id: instId, module: 'lead', record_id: editingLead.id,
            action: 'Lead editado',
            field_changed: `Campos: ${Object.keys(changes).join(', ')}`,
            new_value: leadData.student_name || editingLead.student_name,
            user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
          })
        }
        await logAudit({ institution_id: instId, module: 'leads', record_id: editingLead.id, action: 'updated', field_changed: 'dados', old_value: editingLead.student_name, new_value: leadData.student_name || editingLead.student_name, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })

        // Item 2e — transferência de responsável, logada separadamente pra
        // ficar clara no histórico ("quem passou pra quem"), não misturada
        // no log genérico de edição.
        if (leadData.assigned_to !== undefined && (leadData.assigned_to || null) !== (editingLead.assigned_to || null)) {
          const fromName = users.find(u => u.id === editingLead.assigned_to)?.full_name || 'Sem responsável'
          const toName = users.find(u => u.id === leadData.assigned_to)?.full_name || 'Sem responsável'
          await db.from('audit_logs').insert({
            institution_id: instId, module: 'lead', record_id: editingLead.id,
            action: 'Responsável alterado',
            field_changed: `${fromName} → ${toName}`,
            new_value: toName,
            user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
          })
        }
      } else {
        // Item 3b — família com múltiplos filhos: vincula a uma família já
        // existente, ou promove um lead avulso antigo (mesmo telefone) pra
        // uma família nova, agrupando os dois.
        let familyId: string | null = null
        if (familyMatchId) {
          if (familyMatchId.startsWith('retro:')) {
            const soloLeadId = familyMatchId.slice('retro:'.length)
            const { data: newFamily, error: famErr } = await db.from('lead_families').insert({
              institution_id: instId,
              responsible_name: leadData.responsible_name,
              phone: leadData.phone,
              email: leadData.email || null,
              address: leadData.address || null,
            }).select().single()
            if (!famErr && newFamily) {
              familyId = newFamily.id
              await db.from('leads').update({ family_id: familyId }).eq('id', soloLeadId)
            }
          } else {
            familyId = familyMatchId
          }
        }

        const { data: newLead, error } = await db.from('leads').insert({
          institution_id:   instId,
          student_name:     leadData.student_name,
          responsible_name: leadData.responsible_name,
          phone:            leadData.phone,
          email:            leadData.email,
          address:          leadData.address,
          city:             leadData.city || null,
          grade_interest:   leadData.grade_interest,
          shift_interest:   (leadData as any).shift_interest || null,
          source:           leadData.source,
          budget_range:     leadData.budget_range,
          notes:            leadData.notes,
          status:           'new',
          assigned_to:      leadData.assigned_to || null,
          next_followup:    leadData.next_followup || null,
          lead_temperature: leadData.lead_temperature || null,
          origin_school:    leadData.origin_school || null,
          referral_source:  leadData.referral_source || null,
          contest_name:     leadData.contest_name || null,
          family_id:        familyId,
          campaign_cycle_id: activeCampaignCycle?.id ?? null,
        }).select().single()
        if (error) throw error
        savedLeadId = newLead.id
        await db.from('audit_logs').insert({
          institution_id: instId, module: 'lead', record_id: newLead.id,
          action: 'Lead criado',
          field_changed: `Aluno: ${newLead.student_name}${newLead.grade_interest ? ` · ${newLead.grade_interest}` : ''}${newLead.source ? ` · Origem: ${newLead.source}` : ''}`,
          new_value: newLead.phone || '',
          user_id: user!.id, user_name: user!.full_name, user_role: user!.role,
        })
        await logAudit({ institution_id: instId, module: 'leads', record_id: newLead.id, action: 'created', new_value: `${newLead.student_name} — ${newLead.grade_interest}`, user_id: user!.id, user_name: user!.full_name, user_role: user!.role })
      }
    } catch (err) {
      console.error('[LEAD SAVE] erro:', err)
      showToast('Erro ao salvar lead. Tente novamente.', 'error')
      throw err
    }

    // Sync to whatsapp_contacts (upsert) and whatsapp_conversations
    const phone = (leadData.phone || editingLead?.phone || '').trim()
    const responsibleName = leadData.responsible_name || editingLead?.responsible_name || ''
    if (phone) {
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
        await db.from('whatsapp_contacts').upsert({
          institution_id: instId, phone: normPhone, name: responsibleName || normPhone,
          type: 'lead', ...(savedLeadId ? { lead_id: savedLeadId } : {}), updated_at: new Date().toISOString(),
        }, { onConflict: 'institution_id,phone' })
        await db.from('whatsapp_conversations').update({ contact_name: responsibleName })
          .eq('institution_id', instId).eq('remote_jid', `${normPhone}@s.whatsapp.net`)
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
  const hasActiveFilters = searchTerm !== '' || filterSource !== '' || filterStatus !== '' || periodFilter !== 'all' || gradeFilter !== 'all' || shiftFilter !== 'all' || temperatureFilter !== '' || ownerFilter !== 'mine'

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
    setTemperatureFilter(''); setOwnerFilter('mine')
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