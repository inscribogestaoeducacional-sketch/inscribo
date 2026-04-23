import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, ArrowLeft, ArrowRightLeft, Clock, Check, Loader2,
  MessageCircle, Plus, Eye, Trash2,
} from 'lucide-react'

// ── Constants ─────────────────────────────────────────────────────────────────

const GRADES = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º Ano EF','2º Ano EF','3º Ano EF','4º Ano EF','5º Ano EF',
  '6º Ano EF','7º Ano EF','8º Ano EF','9º Ano EF',
  'Ensino Médio 1','Ensino Médio 2','Ensino Médio 3',
]
const TURNS   = ['Manhã','Tarde','Integral']
const ORIGINS = ['WhatsApp','Indicação','Instagram','Facebook','Site','Outros']

const CONTACT_TYPES = [
  { key: 'lead',     label: 'Nova Família',    icon: '👨‍👩‍👧' },
  { key: 'client',   label: 'Família da Casa',  icon: '🏠' },
  { key: 'supplier', label: 'Fornecedor',       icon: '🏢' },
  { key: 'other',    label: 'Outro',            icon: '👤' },
]

const STATUS_BADGE: Record<string, string> = {
  waiting: 'bg-[#FEF3C7] text-[#D97706]',
  open:    'bg-[#D1FAE5] text-[#059669]',
  closed:  'bg-[#E2E8F0] text-[#64748B]',
}
const STATUS_LABEL: Record<string, string> = {
  waiting: 'Aguardando',
  open:    'Em Atendimento',
  closed:  'Concluído',
}

const AVATAR_COLORS = [
  'bg-violet-500','bg-blue-500','bg-rose-500','bg-amber-500',
  'bg-emerald-500','bg-teal-500','bg-pink-500','bg-indigo-500',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function nameHash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}
function avatarColor(name: string) { return AVATAR_COLORS[nameHash(name) % AVATAR_COLORS.length] }
function initials(s: string) {
  const p = (s || '').trim().split(' ').filter(Boolean)
  if (!p.length) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function fmtDate(s: string) {
  try { return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
  catch { return s }
}
function fmtConvTime(d: Date) {
  const diff = Date.now() - d.getTime()
  if (diff < 60000) return 'agora'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}min`
  if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
function getTransferStatus(t: any) {
  if (t.status === 'retained')  return { label: 'Retido',              cls: 'bg-[#dcfce7] text-[#16a34a]' }
  if (t.status === 'confirmed') return { label: 'Confirmado',          cls: 'bg-[#fee2e2] text-[#dc2626]' }
  if (t.status === 'cancelled') return { label: 'Cancelado',           cls: 'bg-[#f1f5f9] text-[#64748b]' }
  if (t.ai_diagnosis)           return { label: 'Diagnóstico pronto',  cls: 'bg-[#dcfce7] text-[#16a34a]' }
  if (t.survey_responses)       return { label: 'Respondido',          cls: 'bg-[#dbeafe] text-[#1d4ed8]' }
  if (t.survey_token)           return { label: 'Pesquisa enviada',    cls: 'bg-[#fef3c7] text-[#d97706]' }
  return                               { label: 'Aguardando pesquisa', cls: 'bg-[#f1f5f9] text-[#64748b]' }
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'dados' | 'historico' | 'notas' | 'whatsapp' | 'transferencia' | 'conversas'

export interface ContactCardProps {
  mode: 'drawer' | 'page'
  isOpen?: boolean
  onClose: () => void
  institutionId: string
  initialData: {
    lead_id?: string | null
    remote_jid?: string | null
    name?: string
    phone?: string
    email?: string
    contact_type?: string
    tags?: string[]
    profile_picture_url?: string
    student_name?: string
    grade_interest?: string
    source?: string
    status?: string
    assigned_user_name?: string
    assigned_user_id?: string
  }
  allConversations?: any[]
  onUpdate?: (updates: Record<string, any>) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactCard({
  mode, isOpen, onClose, institutionId, initialData, allConversations = [], onUpdate,
}: ContactCardProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  // All state hooks — unconditional
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<Tab>('dados')
  const [toast, setToast]               = useState<string | null>(null)
  const [resolvedLeadId, setResolvedLeadId] = useState<string | null>(initialData.lead_id || null)
  const [form, setForm] = useState({
    contact_type:     initialData.contact_type    || '',
    responsible_name: initialData.name            || '',
    cpf:              '',
    phone:            initialData.phone           || '',
    email:            initialData.email           || '',
    student_name:     initialData.student_name    || '',
    grade_interest:   initialData.grade_interest  || '',
    shift:            '',
    source:           initialData.source          || '',
    tags:             (initialData.tags           || []) as string[],
  })
  const [tagInput, setTagInput]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [customFields, setCustomFields] = useState<any[]>([])
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({})
  const [notes, setNotes]               = useState<any[]>([])
  const [noteText, setNoteText]         = useState('')
  const [savingNote, setSavingNote]     = useState(false)
  const [history, setHistory]           = useState<{ icon: string; title: string; description: string; date: string }[]>([])
  const [transfers, setTransfers]       = useState<any[]>([])
  const [loadingT, setLoadingT]         = useState(false)
  const [showTForm, setShowTForm]       = useState(false)
  const [tForm, setTForm]               = useState({ studentName: initialData.student_name || '', grade: initialData.grade_interest || '', statedReason: '', internalNotes: '' })
  const [savingT, setSavingT]           = useState(false)
  const [tError, setTError]             = useState<string | null>(null)
  const [convData, setConvData]         = useState<any | null>(null)
  const [lastMessages, setLastMessages] = useState<any[]>([])

  // Load + reset when contact identity changes
  useEffect(() => {
    mountedRef.current = true

    // Reset for new contact
    setTab('dados')
    setLoading(true)
    setNotes([])
    setHistory([])
    setTransfers([])
    setConvData(null)
    setLastMessages([])
    setShowTForm(false)
    setTError(null)
    setTagInput('')
    setResolvedLeadId(initialData.lead_id || null)
    setForm({
      contact_type:     initialData.contact_type   || '',
      responsible_name: initialData.name           || '',
      cpf:              '',
      phone:            initialData.phone          || '',
      email:            initialData.email          || '',
      student_name:     initialData.student_name   || '',
      grade_interest:   initialData.grade_interest || '',
      shift:            '',
      source:           initialData.source         || '',
      tags:             (initialData.tags          || []) as string[],
    })
    setTForm({ studentName: initialData.student_name || '', grade: initialData.grade_interest || '', statedReason: '', internalNotes: '' })

    if (mode === 'drawer' && !isOpen) { setLoading(false); return }

    runLoad()

    return () => { mountedRef.current = false }
  }, [initialData.lead_id, initialData.remote_jid, isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ──────────────────────────────────────────────────────────

  async function runLoad() {
    try {
      await Promise.all([
        loadContactData(),
        loadCustomFields(),
        loadNotes(),
        loadHistory(),
        loadTransfers(),
        loadWhatsApp(),
      ])
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  async function loadContactData() {
    let leadId = initialData.lead_id || null
    const remoteJid = initialData.remote_jid || null
    const updates: Record<string, string> = {}

    if (leadId) {
      const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
      if (lead && mountedRef.current) {
        updates.responsible_name = lead.responsible_name || initialData.name || ''
        updates.phone            = lead.phone            || initialData.phone || ''
        updates.email            = lead.email            || ''
        updates.student_name     = lead.student_name     || initialData.student_name || ''
        updates.grade_interest   = lead.grade_interest   || ''
        updates.source           = lead.source           || ''
      }
    }

    if (remoteJid) {
      const { data: conv } = await supabase.from('whatsapp_conversations')
        .select('*').eq('remote_jid', remoteJid).eq('institution_id', institutionId).single()
      if (conv && mountedRef.current) {
        if (!leadId && conv.lead_id) {
          leadId = conv.lead_id
          setResolvedLeadId(leadId)
          const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single()
          if (lead) {
            updates.responsible_name = updates.responsible_name || lead.responsible_name || initialData.name || ''
            updates.phone            = updates.phone            || lead.phone            || initialData.phone || ''
            updates.email            = updates.email            || lead.email            || ''
            updates.student_name     = updates.student_name     || lead.student_name     || initialData.student_name || ''
            updates.grade_interest   = updates.grade_interest   || lead.grade_interest   || ''
            updates.source           = updates.source           || lead.source           || ''
          }
        }
        if (!updates.contact_type) updates.contact_type = conv.contact_type || initialData.contact_type || ''
      }
    }

    // Try to find lead by phone if still no lead
    if (!leadId) {
      const rawPhone = (initialData.phone || (initialData.remote_jid || '').split('@')[0]).replace(/\D/g, '')
      if (rawPhone.length >= 8) {
        const { data } = await supabase.from('leads')
          .select('*').eq('institution_id', institutionId)
          .ilike('phone', `%${rawPhone.slice(-8)}%`).is('deleted_at', null).limit(1).maybeSingle()
        if (data && mountedRef.current) {
          setResolvedLeadId(data.id)
          updates.responsible_name = updates.responsible_name || data.responsible_name || ''
          updates.phone            = updates.phone            || data.phone            || ''
          updates.email            = updates.email            || data.email            || ''
          updates.student_name     = updates.student_name     || data.student_name     || ''
          updates.grade_interest   = updates.grade_interest   || data.grade_interest   || ''
          updates.source           = updates.source           || data.source           || ''
        }
      }
    }

    if (mountedRef.current && Object.keys(updates).length > 0) {
      setForm(f => ({ ...f, ...updates }))
      if (updates.student_name) {
        setTForm(tf => ({ ...tf, studentName: updates.student_name, grade: updates.grade_interest || tf.grade }))
      }
    }
  }

  async function loadCustomFields() {
    const { data: fields } = await supabase.from('contact_custom_fields')
      .select('*').eq('institution_id', institutionId).order('created_at')
    if (!mountedRef.current) return
    setCustomFields(fields || [])

    const refId = initialData.lead_id || initialData.remote_jid
    if (refId && (fields || []).length > 0) {
      const { data: vals } = await supabase.from('contact_field_values')
        .select('field_id, value').eq('contact_ref_id', refId)
      const map: Record<string, string> = {}
      for (const v of (vals || [])) map[v.field_id] = v.value
      if (mountedRef.current) setCustomFieldValues(map)
    }
  }

  async function loadNotes() {
    const refId = initialData.lead_id || initialData.remote_jid
    if (!refId) return
    const { data } = await supabase.from('contact_notes')
      .select('*').eq('institution_id', institutionId).eq('contact_ref_id', refId)
      .order('created_at', { ascending: false })
    if (mountedRef.current) setNotes(data || [])
  }

  async function loadHistory() {
    const items: { icon: string; title: string; description: string; date: string }[] = []

    if (initialData.lead_id) {
      const { data: lead } = await supabase.from('leads')
        .select('created_at, source, status').eq('id', initialData.lead_id).single()
      if (lead) {
        items.push({ icon: '👤', title: 'Lead cadastrado', description: `Via ${lead.source || 'origem desconhecida'}`, date: lead.created_at })
        if (lead.status === 'lost')
          items.push({ icon: '❌', title: 'Lead perdido', description: 'Status alterado para perdido', date: lead.created_at })
      }
    }

    if (initialData.remote_jid) {
      const { data: conv } = await supabase.from('whatsapp_conversations')
        .select('created_at, updated_at').eq('remote_jid', initialData.remote_jid)
        .eq('institution_id', institutionId).single()
      if (conv) {
        items.push({ icon: '💬', title: 'Conversa WhatsApp iniciada', description: initialData.phone || initialData.name || '', date: conv.created_at || conv.updated_at })
      }
    }

    const refId = initialData.lead_id || initialData.remote_jid
    if (refId) {
      const { data: nts } = await supabase.from('contact_notes')
        .select('created_at, author_name').eq('contact_ref_id', refId).eq('institution_id', institutionId)
      for (const n of (nts || []))
        items.push({ icon: '📝', title: 'Anotação adicionada', description: `Por ${n.author_name}`, date: n.created_at })
    }

    const studentName = initialData.student_name
    if (studentName) {
      const { data: txs } = await supabase.from('student_transfers')
        .select('transfer_date, course_grade, stated_reason, status')
        .eq('institution_id', institutionId).ilike('student_name', `%${studentName}%`).is('deleted_at', null)
      for (const t of (txs || [])) {
        items.push({ icon: '🔄', title: 'Transferência registrada', description: `${t.course_grade} — ${t.stated_reason || 'Motivo não informado'}`, date: t.transfer_date })
        if (t.status === 'retained')  items.push({ icon: '✅', title: 'Aluno retido',                description: t.course_grade, date: t.transfer_date })
        if (t.status === 'confirmed') items.push({ icon: '🏫', title: 'Transferência confirmada', description: t.course_grade, date: t.transfer_date })
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (mountedRef.current) setHistory(items)
  }

  async function loadTransfers() {
    const studentName = initialData.student_name
    if (!studentName) return
    if (mountedRef.current) setLoadingT(true)
    const { data } = await supabase.from('student_transfers')
      .select('*').eq('institution_id', institutionId)
      .ilike('student_name', `%${studentName}%`).is('deleted_at', null)
      .order('transfer_date', { ascending: false })
    if (mountedRef.current) { setTransfers(data || []); setLoadingT(false) }
  }

  async function loadWhatsApp() {
    const jid = initialData.remote_jid
    if (!jid) return
    const [convRes, msgRes] = await Promise.all([
      supabase.from('whatsapp_conversations').select('*').eq('remote_jid', jid).eq('institution_id', institutionId).single(),
      supabase.from('whatsapp_messages').select('*').eq('remote_jid', jid).eq('institution_id', institutionId)
        .order('timestamp', { ascending: false }).limit(5),
    ])
    if (!mountedRef.current) return
    if (convRes.data) setConvData(convRes.data)
    setLastMessages((msgRes.data || []).reverse())
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function handleSave() {
    setSaving(true)
    try {
      const leadId = resolvedLeadId || initialData.lead_id
      const remoteJid = initialData.remote_jid

      const tasks: Promise<any>[] = []

      if (leadId) {
        tasks.push(supabase.from('leads').update({
          responsible_name: form.responsible_name || undefined,
          phone:            form.phone            || undefined,
          email:            form.email            || undefined,
          student_name:     form.student_name     || undefined,
          grade_interest:   form.grade_interest   || undefined,
          source:           form.source           || undefined,
        }).eq('id', leadId))
      } else {
        const { data: newLead } = await supabase.from('leads').insert({
          institution_id:   institutionId,
          responsible_name: form.responsible_name,
          phone:            form.phone,
          email:            form.email,
          student_name:     form.student_name,
          grade_interest:   form.grade_interest,
          source:           form.source,
          status:           'new',
        }).select('id').single()
        if (newLead) {
          setResolvedLeadId(newLead.id)
          if (remoteJid) {
            tasks.push(supabase.from('whatsapp_conversations')
              .update({ lead_id: newLead.id }).eq('remote_jid', remoteJid).eq('institution_id', institutionId))
          }
        }
      }

      if (remoteJid) {
        const waUp: Record<string, any> = {}
        if (form.responsible_name) waUp.contact_name  = form.responsible_name
        if (form.contact_type)     waUp.contact_type  = form.contact_type
        waUp.tags = form.tags
        tasks.push(supabase.from('whatsapp_conversations').update(waUp)
          .eq('remote_jid', remoteJid).eq('institution_id', institutionId))
      }

      const refId = resolvedLeadId || initialData.lead_id || remoteJid
      if (refId) {
        for (const [fieldId, value] of Object.entries(customFieldValues)) {
          tasks.push(supabase.from('contact_field_values').upsert(
            { contact_ref_id: refId, field_id: fieldId, value, institution_id: institutionId },
            { onConflict: 'contact_ref_id,field_id' }
          ))
        }
      }

      await Promise.all(tasks)
      onUpdate?.({ name: form.responsible_name, phone: form.phone, email: form.email, contact_type: form.contact_type, tags: form.tags, student_name: form.student_name, grade: form.grade_interest })
      showToast('Contato salvo com sucesso.')
    } catch {
      showToast('Erro ao salvar. Tente novamente.')
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const refId = resolvedLeadId || initialData.lead_id || initialData.remote_jid
    const { data } = await supabase.from('contact_notes').insert({
      institution_id:    institutionId,
      contact_ref_id:    refId,
      contact_ref_type:  (resolvedLeadId || initialData.lead_id) ? 'lead' : 'whatsapp',
      content:           noteText.trim(),
      author_name:       user?.full_name || 'Usuário',
    }).select('*').single()
    if (mountedRef.current) {
      if (data) setNotes(prev => [data, ...prev])
      setNoteText('')
      setSavingNote(false)
    }
  }

  async function handleDeleteNote(id: string) {
    await supabase.from('contact_notes').delete().eq('id', id)
    if (mountedRef.current) setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function handleSaveTransfer() {
    if (!tForm.studentName.trim()) { setTError('Nome do aluno obrigatório.'); return }
    if (!tForm.grade)              { setTError('Selecione a série.');          return }
    setTError(null); setSavingT(true)
    await supabase.from('student_transfers').insert({
      institution_id: institutionId,
      student_name:   tForm.studentName.trim(),
      course_grade:   tForm.grade,
      transfer_date:  new Date().toISOString().split('T')[0],
      stated_reason:  tForm.statedReason  || null,
      internal_notes: tForm.internalNotes || null,
      lead_id:        resolvedLeadId || initialData.lead_id || null,
    })
    if (mountedRef.current) {
      setSavingT(false); setShowTForm(false)
      showToast('Transferência registrada.')
      loadTransfers()
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter' || !tagInput.trim()) return
    e.preventDefault()
    const tag = tagInput.trim()
    if (!form.tags.includes(tag)) setForm(f => ({ ...f, tags: [...f.tags, tag] }))
    setTagInput('')
  }

  // ── Early return after all hooks ──────────────────────────────────────────

  if (mode === 'drawer' && !isOpen) return null

  // ── Derived display values ────────────────────────────────────────────────

  const displayName  = form.responsible_name || initialData.name || 'Sem nome'
  const displayPhone = form.phone || initialData.phone || ''
  const ctInfo       = CONTACT_TYPES.find(ct => ct.key === form.contact_type)
  const otherConvs   = allConversations.filter((c: any) => {
    const cp = (c.phone || '').replace(/\D/g, '').slice(-8)
    const mp = displayPhone.replace(/\D/g, '').slice(-8)
    return cp && mp && cp === mp && c.id !== initialData.remote_jid
  })

  const TABS: { key: Tab; label: string }[] = [
    { key: 'dados',         label: 'Dados' },
    { key: 'historico',     label: 'Histórico' },
    { key: 'notas',         label: 'Anotações' },
    { key: 'whatsapp',      label: 'WhatsApp' },
    { key: 'transferencia', label: 'Transferência' },
    { key: 'conversas',     label: 'Conversas' },
  ]

  // ── Shared UI blocks ──────────────────────────────────────────────────────

  const headerEl = (
    <div className="flex-shrink-0 flex items-center gap-4 px-6 py-5 border-b border-[#E2E8F0]">
      <div className={`w-[72px] h-[72px] rounded-full flex-shrink-0 flex items-center justify-center text-white text-2xl font-bold overflow-hidden ${!initialData.profile_picture_url ? avatarColor(displayName) : ''}`}>
        {initialData.profile_picture_url
          ? <img src={initialData.profile_picture_url} alt={displayName} className="w-full h-full object-cover" />
          : initials(displayName)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-[#1A2B4A] truncate">{displayName}</p>
        {displayPhone && <p className="text-sm text-[#64748B] mt-0.5">{displayPhone}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {ctInfo && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#E6F7F5] text-[#00A896]">
              {ctInfo.icon} {ctInfo.label}
            </span>
          )}
          {displayPhone && (
            <a href={`https://wa.me/55${displayPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#D1FAE5] text-[#059669]">
              💬 WhatsApp
            </a>
          )}
        </div>
      </div>
      <button onClick={onClose}
        className="flex-shrink-0 p-2 text-[#64748B] hover:text-[#1A2B4A] hover:bg-[#F1F5F9] rounded-lg transition-colors">
        {mode === 'page' ? <ArrowLeft className="w-5 h-5" /> : <X className="w-5 h-5" />}
      </button>
    </div>
  )

  const tabBarEl = (
    <div className="flex-shrink-0 flex border-b border-[#E2E8F0] overflow-x-auto">
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)}
          className={`flex-shrink-0 px-4 py-3 text-xs font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
            tab === t.key
              ? 'border-[#00A896] text-[#1A2B4A]'
              : 'border-transparent text-[#94A3B8] hover:text-[#1A2B4A]'
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  )

  const footerEl = tab === 'dados' ? (
    <div className="flex-shrink-0 px-6 py-4 border-t border-[#E2E8F0] space-y-2">
      <button onClick={handleSave} disabled={saving}
        className="w-full bg-[#00A896] text-white font-semibold py-3 rounded-lg hover:bg-[#008f81] disabled:opacity-50 transition-colors">
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </button>
      <button onClick={onClose}
        className="w-full border border-[#E2E8F0] text-[#64748B] py-3 rounded-lg hover:bg-[#F8FAFB] transition-colors">
        Cancelar
      </button>
    </div>
  ) : null

  const toastEl = toast ? (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-2 px-4 py-3 bg-[#1A2B4A] text-white text-sm font-medium rounded-xl shadow-2xl">
      <Check size={14} /> {toast}
    </div>
  ) : null

  const spinnerEl = (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-[#00A896] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[#94A3B8]">Carregando...</p>
    </div>
  )

  // ── Tab content ───────────────────────────────────────────────────────────

  const bodyEl = loading ? spinnerEl : (
    <div className="flex-1 overflow-y-auto">

      {/* ── DADOS ── */}
      {tab === 'dados' && (
        <div className="p-6 space-y-5">
          {/* Tipo de contato */}
          <div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Tipo de Contato</p>
            <div className="grid grid-cols-2 gap-2">
              {CONTACT_TYPES.map(ct => (
                <button key={ct.key}
                  onClick={() => setForm(f => ({ ...f, contact_type: ct.key }))}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    form.contact_type === ct.key
                      ? 'border-2 border-[#00A896] bg-[#E6F7F5] text-[#00A896]'
                      : 'border border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#00A896] hover:text-[#00A896]'
                  }`}>
                  <span>{ct.icon}</span><span>{ct.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dados do responsável */}
          <div>
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">Dados do Responsável</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Nome completo</label>
                <input value={form.responsible_name} onChange={e => setForm(f => ({ ...f, responsible_name: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">CPF</label>
                <input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Telefone / WhatsApp</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
              </div>
            </div>
          </div>

          {/* Divider aluno */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Dados do Aluno</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>

          {/* Dados do aluno */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do aluno</label>
              <input value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Série/Ano</label>
              <select value={form.grade_interest} onChange={e => setForm(f => ({ ...f, grade_interest: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
                <option value="">Selecionar...</option>
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Turno</label>
              <select value={form.shift} onChange={e => setForm(f => ({ ...f, shift: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
                <option value="">Selecionar...</option>
                {TURNS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Origem</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
                <option value="">Selecionar...</option>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Campos personalizados */}
          {customFields.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Campos Personalizados</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>
              <div className="space-y-3">
                {customFields.map((cf: any) => (
                  <div key={cf.id}>
                    <label className="block text-xs font-medium text-[#64748B] mb-1">{cf.label}</label>
                    {cf.type === 'select' ? (
                      <select value={customFieldValues[cf.id] || ''}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
                        <option value="">Selecionar...</option>
                        {(cf.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input type={cf.type || 'text'} value={customFieldValues[cf.id] || ''}
                        onChange={e => setCustomFieldValues(prev => ({ ...prev, [cf.id]: e.target.value }))}
                        className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Tags */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Tags</span>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {form.tags.map(tag => (
                <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E6F7F5] text-[#00A896]">
                  {tag}
                  <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                    className="text-[#00A896] hover:text-[#dc2626] leading-none">×</button>
                </span>
              ))}
            </div>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown}
              placeholder="Digite e pressione Enter para adicionar tag"
              className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
          </div>
        </div>
      )}

      {/* ── HISTÓRICO ── */}
      {tab === 'historico' && (
        <div className="p-6">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Clock size={32} className="text-[#E2E8F0]" />
              <p className="text-sm text-[#94A3B8]">Nenhum histórico disponível</p>
            </div>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-8 top-4 bottom-4 w-px bg-[#E2E8F0]" />
              {history.map((item, i) => (
                <div key={i} className="relative flex gap-4 mb-5">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-[#E2E8F0] flex items-center justify-center text-sm z-10">
                    {item.icon}
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm font-bold text-[#1A2B4A] mb-0.5">{item.title}</p>
                    <p className="text-xs text-[#64748B] mb-1">{item.description}</p>
                    <p className="text-[11px] text-[#CBD5E1]">{fmtDate(item.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ANOTAÇÕES ── */}
      {tab === 'notas' && (
        <div className="p-6 space-y-4">
          <div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Adicionar anotação..." rows={3}
              className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none resize-none" />
            <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
              className="mt-2 w-full bg-[#00A896] text-white font-semibold py-2.5 rounded-lg hover:bg-[#008f81] disabled:opacity-50 transition-colors text-sm">
              {savingNote ? 'Salvando...' : 'Adicionar anotação'}
            </button>
          </div>
          {notes.length === 0 ? (
            <p className="text-center text-sm text-[#94A3B8] py-8">Nenhuma anotação ainda.</p>
          ) : notes.map(n => (
            <div key={n.id} className="p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#E6F7F5] flex items-center justify-center text-[10px] font-bold text-[#00A896] flex-shrink-0">
                    {initials(n.author_name || 'U')}
                  </div>
                  <span className="text-xs font-semibold text-[#1A2B4A]">{n.author_name}</span>
                  <span className="text-[11px] text-[#94A3B8]">{fmtDate(n.created_at)}</span>
                </div>
                <button onClick={() => handleDeleteNote(n.id)} className="p-1 text-[#94A3B8] hover:text-[#dc2626] transition-colors">
                  <Trash2 size={12} />
                </button>
              </div>
              <p className="text-sm text-[#334155] leading-relaxed">{n.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── WHATSAPP ── */}
      {tab === 'whatsapp' && (
        <div className="p-6 space-y-4">
          {convData ? (
            <>
              <div className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[convData.status] || STATUS_BADGE.waiting}`}>
                  {STATUS_LABEL[convData.status] || convData.status}
                </span>
                {convData.assigned_user_name && (
                  <span className="text-xs text-[#64748B]">Atendente: <strong>{convData.assigned_user_name}</strong></span>
                )}
              </div>
              {lastMessages.length > 0 && (
                <div className="space-y-2 p-3 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                  {lastMessages.map((msg: any) => (
                    <div key={msg.id} className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${msg.from_me ? 'bg-[#1A2B4A] text-white' : 'bg-white border border-[#E2E8F0] text-[#334155]'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => navigate(`/whatsapp?phone=${displayPhone.replace(/\D/g, '')}`)}
                className="w-full border border-[#E2E8F0] text-[#64748B] py-3 rounded-lg hover:bg-[#F8FAFB] transition-colors text-sm font-medium">
                Abrir conversa completa
              </button>
              {displayPhone && (
                <a href={`https://wa.me/55${displayPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] text-white rounded-lg text-sm font-semibold hover:bg-[#1da851] transition-colors">
                  Iniciar nova conversa
                </a>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <MessageCircle size={32} className="text-[#E2E8F0]" />
              <div>
                <p className="text-sm font-semibold text-[#1A2B4A] mb-1">Nenhuma conversa vinculada</p>
                <p className="text-xs text-[#94A3B8]">Este contato ainda não possui conversa no WhatsApp.</p>
              </div>
              {displayPhone && (
                <a href={`https://wa.me/55${displayPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-[#25D366] text-white rounded-lg text-sm font-semibold hover:bg-[#1da851] transition-colors">
                  Iniciar no WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TRANSFERÊNCIA ── */}
      {tab === 'transferencia' && (
        <div className="p-6 space-y-4">
          {!form.student_name && !initialData.student_name ? (
            <p className="text-center text-sm text-[#94A3B8] py-8">
              Preencha o nome do aluno na aba Dados para verificar transferências.
            </p>
          ) : loadingT ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#00A896] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : transfers.length > 0 ? (
            <>
              {transfers.map(t => {
                const si = getTransferStatus(t)
                return (
                  <div key={t.id} className="p-4 bg-[#F8FAFB] rounded-xl border border-[#E2E8F0]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-sm font-bold text-[#1A2B4A]">{t.student_name}</p>
                        <p className="text-xs text-[#64748B]">{t.course_grade} · {fmtDate(t.transfer_date)}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${si.cls}`}>{si.label}</span>
                    </div>
                    {t.stated_reason && (
                      <p className="text-xs text-[#64748B] bg-white rounded-lg p-2 border border-[#E2E8F0] mb-2">{t.stated_reason}</p>
                    )}
                    <div className="flex gap-2">
                      {t.ai_diagnosis && (
                        <button onClick={() => navigate('/transferencias')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EDE9FE] text-[#7C3AED] rounded-lg text-xs font-semibold">
                          <Eye size={11} /> Ver diagnóstico
                        </button>
                      )}
                      <button onClick={() => navigate('/transferencias')}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] text-[#64748B] rounded-lg text-xs font-semibold bg-white">
                        <ArrowRightLeft size={11} /> Ver no módulo
                      </button>
                    </div>
                  </div>
                )
              })}
              <button onClick={() => setShowTForm(v => !v)}
                className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#CBD5E1] rounded-lg text-sm text-[#94A3B8] font-medium hover:border-[#00A896] hover:text-[#00A896] transition-colors">
                <Plus size={13} /> Registrar nova transferência
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
              <ArrowRightLeft size={32} className="text-[#E2E8F0]" />
              <div>
                <p className="text-sm font-semibold text-[#1A2B4A] mb-1">Nenhuma transferência</p>
                <p className="text-xs text-[#94A3B8]">Este aluno não possui transferências registradas.</p>
              </div>
              <button onClick={() => setShowTForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#FEE2E2] text-[#DC2626] rounded-lg text-sm font-semibold">
                <Plus size={13} /> Registrar transferência
              </button>
            </div>
          )}
          {showTForm && (
            <div className="p-4 bg-[#FFF5F5] rounded-xl border border-[#FECACA]">
              <p className="text-sm font-bold text-[#DC2626] mb-3">Registrar transferência</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Nome do aluno *</label>
                  <input value={tForm.studentName} onChange={e => setTForm(f => ({ ...f, studentName: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Série *</label>
                  <select value={tForm.grade} onChange={e => setTForm(f => ({ ...f, grade: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
                    <option value="">Selecionar...</option>
                    {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Motivo informado</label>
                  <input value={tForm.statedReason} onChange={e => setTForm(f => ({ ...f, statedReason: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Observações internas</label>
                  <textarea value={tForm.internalNotes} onChange={e => setTForm(f => ({ ...f, internalNotes: e.target.value }))} rows={3}
                    className="w-full px-3 py-2.5 text-sm bg-[#F1F5F9] border-0 rounded-lg text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none resize-none" />
                </div>
                {tError && <p className="text-xs text-[#DC2626]">{tError}</p>}
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setShowTForm(false); setTError(null) }}
                    className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-xs text-[#64748B] bg-white">Cancelar</button>
                  <button onClick={handleSaveTransfer} disabled={savingT}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#DC2626] text-white rounded-lg text-xs font-semibold disabled:opacity-50">
                    {savingT ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Registrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CONVERSAS ── */}
      {tab === 'conversas' && (
        <div className="p-6">
          {otherConvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <span className="text-4xl">💬</span>
              <p className="text-sm text-[#64748B]">Nenhuma outra conversa encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherConvs.map((c: any) => (
                <div key={c.id} className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFB]">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status] || STATUS_BADGE.waiting}`}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                    <span className="text-xs text-[#94A3B8]">{fmtConvTime(c.lastTime instanceof Date ? c.lastTime : new Date(c.lastTime))}</span>
                  </div>
                  <p className="text-xs text-[#64748B] truncate">{c.lastMessage || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  if (mode === 'drawer') {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
        <div className="fixed top-0 right-0 h-full z-50 w-[480px] bg-white shadow-2xl flex flex-col">
          {headerEl}
          {tabBarEl}
          {bodyEl}
          {footerEl}
        </div>
        {toastEl}
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[1100] flex">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="w-[560px] h-full bg-white flex flex-col shadow-2xl">
          {headerEl}
          {tabBarEl}
          {bodyEl}
          {footerEl}
        </div>
      </div>
      {toastEl}
    </>
  )
}
