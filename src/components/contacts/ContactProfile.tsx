import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, ArrowRightLeft, FileText, Clock, User, Plus, Check, Loader2,
  Tag as TagIcon,
} from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────
const GRADES = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º Ano EF','2º Ano EF','3º Ano EF','4º Ano EF','5º Ano EF',
  '6º Ano EF','7º Ano EF','8º Ano EF','9º Ano EF',
  'Ensino Médio 1','Ensino Médio 2','Ensino Médio 3',
]

const HEX_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']
function nameHash(s: string) {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff; return Math.abs(h)
}
const hexColor = (s: string) => HEX_COLORS[nameHash(s) % HEX_COLORS.length]
function initials(s: string) {
  const p = (s || '').trim().split(' ').filter(Boolean)
  if (!p.length) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
function lightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 0xff) * (1 - amount) + 255 * amount)
  const g = Math.round(((n >> 8)  & 0xff) * (1 - amount) + 255 * amount)
  const b = Math.round((n & 0xff)          * (1 - amount) + 255 * amount)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

// ─── Interface ────────────────────────────────────────────────
export interface UnifiedContact {
  id: string; name: string; student_name: string | null; phone: string | null
  email: string | null; grade: string | null; source: string | null
  status_lead: string | null; status_whatsapp: string | null
  has_lead: boolean; has_whatsapp: boolean; lead_id: string | null
  remote_jid: string | null; contact_type: string | null
  assigned_user_name: string | null; tags: string[]
  last_contact: string; origin_label: string; origin_color: string; origin_bg: string
  transfer_status?: string | null
  profile_picture_url?: string | null
  created_at?: string | null
  subtitle?: string | null
}

// ─── Styles ───────────────────────────────────────────────────
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0',
  fontSize: 13, outline: 'none', background: '#FAFAFA', boxSizing: 'border-box', color: '#1A2B4A',
}

// ─── Component ────────────────────────────────────────────────
interface Props {
  contact: UnifiedContact
  institutionId: string
  onClose: () => void
  onUpdate: (id: string, updates: Partial<UnifiedContact>) => void
}

function getStatusInfo(t: any) {
  if (t.status === 'retained')  return { label: 'Retido',              color: '#16a34a', bg: '#dcfce7' }
  if (t.status === 'confirmed') return { label: 'Confirmado',          color: '#dc2626', bg: '#fee2e2' }
  if (t.status === 'cancelled') return { label: 'Cancelado',           color: '#64748b', bg: '#f1f5f9' }
  if (t.ai_diagnosis)           return { label: 'Diagnóstico pronto',  color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_responses)       return { label: 'Respondido',          color: '#1d4ed8', bg: '#dbeafe' }
  if (t.survey_token)           return { label: 'Pesquisa enviada',    color: '#d97706', bg: '#fef3c7' }
  return                               { label: 'Aguardando pesquisa', color: '#64748b', bg: '#f1f5f9' }
}

export default function ContactProfile({ contact, institutionId, onClose, onUpdate }: Props) {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const mountedRef = useRef(true)
  const contactRef = contact.lead_id || contact.remote_jid || contact.id

  type TabKey = 'dados' | 'historico' | 'notas' | 'transferencia'
  const [tab, setTab] = useState<TabKey>('dados')

  // Form — dados
  const [editName,  setEditName]  = useState(contact.name)
  const [editPhone, setEditPhone] = useState(contact.phone || '')
  const [editEmail, setEditEmail] = useState(contact.email || '')
  const [editGrade, setEditGrade] = useState(contact.grade || '')
  const [editType,  setEditType]  = useState(contact.contact_type || 'unknown')
  const [saving,    setSaving]    = useState(false)
  const [toast,     setToast]     = useState<string | null>(null)

  // Tags
  const [tags,         setTags]         = useState<string[]>(contact.tags || [])
  const [availTags,    setAvailTags]    = useState<{ id: string; name: string; color: string }[]>([])
  const [showTagDrop,  setShowTagDrop]  = useState(false)

  // Notes
  const [notes,         setNotes]         = useState<any[]>([])
  const [noteText,      setNoteText]      = useState('')
  const [savingNote,    setSavingNote]    = useState(false)
  const [notesAvailable,setNotesAvailable]= useState(true)

  // History
  const [history, setHistory] = useState<{ icon: string; title: string; description: string; date: string }[]>([])

  // Transfers
  const [transfers,        setTransfers]        = useState<any[]>([])
  const [loadingT,         setLoadingT]         = useState(false)
  const [showTForm,        setShowTForm]        = useState(false)
  const [tForm,            setTForm]            = useState({
    studentName: contact.student_name || '',
    grade:       contact.grade        || '',
    statedReason: '',
    internalNotes: '',
  })
  const [savingT,          setSavingT]          = useState(false)
  const [tError,           setTError]           = useState<string | null>(null)
  const [transfersAvailable, setTransfersAvailable] = useState(true)

  // Avatar photo
  const [imgErr, setImgErr] = useState(false)

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)

  useEffect(() => {
    mountedRef.current = true
    loadAvailTags()
    loadNotes()
    loadTransfers()
    buildHistory()
    return () => { mountedRef.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loaders ───────────────────────────────────────────────
  async function loadAvailTags() {
    try {
      const { data } = await supabase
        .from('whatsapp_tags')
        .select('id, name, color')
        .eq('institution_id', institutionId)
        .order('name')
      if (mountedRef.current && data) setAvailTags(data as { id: string; name: string; color: string }[])
    } catch (e) { console.error('loadAvailTags error:', e) }
  }

  async function loadNotes() {
    try {
      const { data, error } = await supabase
        .from('contact_notes')
        .select('id, content, author_name, created_at')
        .eq('institution_id', institutionId)
        .eq('contact_ref_id', contactRef)
        .order('created_at', { ascending: false })
      if (error) {
        // 400 = table or column doesn't exist — degrade silently
        console.warn('loadNotes:', error.code, error.message)
        if (mountedRef.current) setNotesAvailable(false)
        return
      }
      if (mountedRef.current) setNotes(data || [])
    } catch (e) {
      console.error('loadNotes error:', e)
      if (mountedRef.current) setNotesAvailable(false)
    }
  }

  async function loadTransfers() {
    if (!contact.student_name) return
    if (mountedRef.current) setLoadingT(true)
    try {
      const { data, error } = await supabase
        .from('student_transfers')
        .select('*')
        .eq('institution_id', institutionId)
        .ilike('student_name', `%${contact.student_name}%`)
        .is('deleted_at', null)
        .order('transfer_date', { ascending: false })
      if (error) throw error
      if (mountedRef.current) setTransfers(data || [])
    } catch (e) {
      console.error('loadTransfers error:', e)
      if (mountedRef.current) setTransfersAvailable(false)
    } finally {
      if (mountedRef.current) setLoadingT(false)
    }
  }

  async function buildHistory() {
    const items: { icon: string; title: string; description: string; date: string }[] = []
    try {
      if (contact.lead_id) {
        const { data: lead } = await supabase
          .from('leads').select('created_at, source, status').eq('id', contact.lead_id).maybeSingle()
        if (lead) {
          items.push({ icon: '👤', title: 'Lead cadastrado', description: `Via ${lead.source || 'origem desconhecida'}`, date: lead.created_at })
          if (lead.status === 'lost') items.push({ icon: '❌', title: 'Lead perdido', description: 'Status alterado para perdido', date: lead.created_at })
        }
      }
      if (contact.remote_jid) {
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('created_at, updated_at')
          .eq('remote_jid', contact.remote_jid)
          .eq('institution_id', institutionId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (conv) {
          items.push({ icon: '💬', title: 'Conversa WhatsApp iniciada', description: contact.phone || contact.name, date: conv.created_at || conv.updated_at })
        }
      }
      if (contact.student_name) {
        try {
          const { data: txs } = await supabase
            .from('student_transfers')
            .select('transfer_date, course_grade, stated_reason, status')
            .eq('institution_id', institutionId)
            .ilike('student_name', `%${contact.student_name}%`)
            .is('deleted_at', null)
          for (const t of txs || []) {
            items.push({ icon: '🔄', title: 'Transferência registrada', description: `${t.course_grade} — ${t.stated_reason || 'Motivo não informado'}`, date: t.transfer_date })
            if (t.status === 'retained') items.push({ icon: '✅', title: 'Aluno retido', description: t.course_grade, date: t.transfer_date })
            if (t.status === 'confirmed') items.push({ icon: '🏫', title: 'Transferência confirmada', description: t.course_grade, date: t.transfer_date })
          }
        } catch {}
      }
    } catch (e) { console.error('buildHistory error:', e) }
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (mountedRef.current) setHistory(items)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => { if (mountedRef.current) setToast(null) }, 3000) }

  // ── Actions ───────────────────────────────────────────────
  async function handleSaveDados() {
    setSaving(true)
    try {
      const synced: string[] = []
      if (contact.lead_id) {
        await supabase.from('leads').update({
          responsible_name: editName  || undefined,
          phone:            editPhone || undefined,
          email:            editEmail || undefined,
          grade_interest:   editGrade || undefined,
        }).eq('id', contact.lead_id)
        synced.push('lead')
      }
      const normP = (p: string) => {
        let d = p.replace(/\D/g, '')
        if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
        if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
        if (d.length === 11) d = '55' + d
        return d
      }
      const normPhone = normP(contact.phone || '')
      if ((contact.remote_jid || contact.phone) && normPhone) {
        // remote_jid is stored WITHOUT @s.whatsapp.net in whatsapp_conversations
        console.log('[SYNC] atualizando conversa:', normPhone, 'nome:', editName)
        const { error: convErr, count } = await supabase.from('whatsapp_conversations')
          .update({ contact_name: editName })
          .eq('institution_id', institutionId)
          .eq('remote_jid', normPhone)
        console.log('[SYNC] resultado conversa:', { convErr, count, normPhone })
        synced.push('WhatsApp')
      }
      // Update contact type and name in whatsapp_contacts
      const rawPhone = normP(editPhone || contact.phone || '')
      if (rawPhone) {
        await supabase.from('whatsapp_contacts')
          .update({ type: editType === 'unknown' ? null : editType, name: editName })
          .eq('institution_id', institutionId)
          .eq('phone', rawPhone)
        console.log('[SYNC NAME] atualizado em whatsapp_contacts:', rawPhone)
      }
      // Sync contact_type to whatsapp_conversations (remote_jid stored without @s.whatsapp.net)
      if (editType !== contact.contact_type && normPhone) {
        await supabase.from('whatsapp_conversations')
          .update({ contact_type: editType === 'unknown' ? null : editType })
          .eq('institution_id', institutionId)
          .eq('remote_jid', normPhone)
        console.log('[SYNC TYPE] atualizado em whatsapp_conversations:', normPhone)
      }
      const newContactType = editType === 'unknown' ? null : editType
      onUpdate(contact.id, {
        name: editName,
        phone: editPhone || null,
        email: editEmail || null,
        grade: editGrade || null,
        contact_type: newContactType,
        origin_label: newContactType === 'lead' ? 'Lead' : newContactType === 'client' ? 'Cliente' : 'WhatsApp',
      })
      showToast(synced.length ? `Salvo em: ${synced.join(' e ')}` : 'Salvo com sucesso')
    } catch (e: any) {
      console.error('handleSaveDados error:', e)
      showToast('Erro ao salvar: ' + (e?.message || 'tente novamente'))
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  async function handleAddTag(tagName: string) {
    if (tags.includes(tagName)) return
    const newTags = [...tags, tagName]
    setTags(newTags)
    setShowTagDrop(false)
    try {
      if (contact.lead_id) {
        await supabase.from('leads').update({ tags: newTags }).eq('id', contact.lead_id)
      }
      if (contact.remote_jid) {
        await supabase.from('whatsapp_conversations')
          .update({ tags: newTags })
          .eq('institution_id', institutionId)
          .eq('remote_jid', contact.remote_jid)
      }
      const normP = (p: string) => {
        let d = p.replace(/\D/g, '')
        if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
        if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
        if (d.length === 11) d = '55' + d
        return d
      }
      const normPhone = normP(contact.phone || '')
      if (normPhone) {
        await supabase.from('whatsapp_contacts')
          .update({ tags: newTags })
          .eq('institution_id', institutionId)
          .eq('phone', normPhone)
      }
      onUpdate(contact.id, { tags: newTags })
    } catch (e) { console.error('handleAddTag error:', e) }
  }

  async function handleRemoveTag(tagName: string) {
    const newTags = tags.filter(t => t !== tagName)
    setTags(newTags)
    try {
      if (contact.lead_id) {
        await supabase.from('leads').update({ tags: newTags }).eq('id', contact.lead_id)
      }
      if (contact.remote_jid) {
        await supabase.from('whatsapp_conversations')
          .update({ tags: newTags })
          .eq('institution_id', institutionId)
          .eq('remote_jid', contact.remote_jid)
      }
      const normP = (p: string) => {
        let d = p.replace(/\D/g, '')
        if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2)
        if (d.length === 10) d = d.slice(0, 2) + '9' + d.slice(2)
        if (d.length === 11) d = '55' + d
        return d
      }
      const normPhone = normP(contact.phone || '')
      if (normPhone) {
        await supabase.from('whatsapp_contacts')
          .update({ tags: newTags })
          .eq('institution_id', institutionId)
          .eq('phone', normPhone)
      }
      onUpdate(contact.id, { tags: newTags })
    } catch (e) { console.error('handleRemoveTag error:', e) }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const { data, error } = await supabase.from('contact_notes').insert({
        institution_id:   institutionId,
        contact_ref_id:   contactRef,
        contact_ref_type: contact.lead_id ? 'lead' : 'whatsapp',
        content:          noteText.trim(),
        author_name:      user?.full_name || 'Usuário',
      }).select('id, content, author_name, created_at').maybeSingle()
      if (error) {
        console.warn('handleAddNote:', error.code, error.message)
        if (mountedRef.current) setNotesAvailable(false)
        return
      }
      if (mountedRef.current) {
        if (data) setNotes(prev => [data, ...prev])
        setNoteText('')
      }
    } catch (e) { console.error('handleAddNote error:', e) }
    finally { if (mountedRef.current) setSavingNote(false) }
  }

  async function handleSaveTransfer() {
    if (!tForm.studentName.trim()) { setTError('Nome do aluno obrigatório.'); return }
    if (!tForm.grade)              { setTError('Selecione a série.');          return }
    setTError(null); setSavingT(true)
    try {
      await supabase.from('student_transfers').insert({
        institution_id: institutionId,
        student_name:   tForm.studentName.trim(),
        course_grade:   tForm.grade,
        transfer_date:  new Date().toISOString().split('T')[0],
        stated_reason:  tForm.statedReason || null,
        internal_notes: tForm.internalNotes || null,
        lead_id:        contact.lead_id || null,
      })
      if (mountedRef.current) { setShowTForm(false); showToast('Transferência registrada.'); loadTransfers(); buildHistory() }
    } catch (e: any) {
      console.error('handleSaveTransfer error:', e)
      if (mountedRef.current) setTError(e?.message || 'Erro ao salvar')
    } finally { if (mountedRef.current) setSavingT(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      if (contact.id) {
        await supabase.from('whatsapp_contacts').delete().eq('id', contact.id)
      }
      showToast('Contato excluído.')
      onUpdate(contact.id, {})
      onClose()
    } catch (e: any) {
      console.error('handleDelete error:', e)
      showToast('Erro ao excluir: ' + (e?.message || 'tente novamente'))
    } finally {
      if (mountedRef.current) setDeleting(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────
  const color        = hexColor(contact.name)
  const headerBg1   = lightenHex(color, 0.88)
  const headerBg2   = lightenHex(color, 0.95)
  const unaddedTags = availTags.filter(t => !tags.includes(t.name))
  const getTagColor = (name: string) => availTags.find(t => t.name === name)?.color || '#94A3B8'

  const tabs = [
    { key: 'dados',         label: 'Dados',        icon: <User           size={13} /> },
    { key: 'historico',     label: 'Histórico',    icon: <Clock          size={13} /> },
    { key: 'notas',         label: 'Anotações',    icon: <FileText       size={13} /> },
    { key: 'transferencia', label: 'Transferência', icon: <ArrowRightLeft size={13} /> },
  ] as const

  // ── Render ────────────────────────────────────────────────
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{ background: `linear-gradient(135deg, ${headerBg1} 0%, ${headerBg2} 100%)`, padding: '20px 24px 16px', flexShrink: 0, position: 'relative' }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
            <X size={16} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingRight: 20 }}>
            {/* Avatar */}
            {contact.profile_picture_url && !imgErr ? (
              <img
                src={contact.profile_picture_url} alt={contact.name}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${color}44`, flexShrink: 0 }}
                onError={() => setImgErr(true)}
              />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff', border: `3px solid ${color}66`, flexShrink: 0 }}>
                {initials(contact.name)}
              </div>
            )}
            {/* Name */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{contact.name}</h2>
              {contact.subtitle && (
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{contact.subtitle}</p>
              )}
              {contact.student_name && contact.student_name !== contact.name && !contact.subtitle && (
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Aluno: {contact.student_name}</p>
              )}
            </div>
            {/* Type badge */}
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: contact.contact_type === 'lead' ? '#EDE9FE' : contact.contact_type === 'client' ? '#D1FAE5' : '#FEF3C7',
              color:      contact.contact_type === 'lead' ? '#7C3AED' : contact.contact_type === 'client' ? '#065F46' : '#D97706',
            }}>
              {contact.origin_label || 'WhatsApp'}
            </span>
            {/* Phone + email */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
              {contact.phone && (
                <span style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>📞 {contact.phone}</span>
              )}
              {contact.email && (
                <span style={{ fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>✉️ {contact.email}</span>
              )}
            </div>
          </div>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9', background: '#fff', flexShrink: 0, overflowX: 'auto' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px',
                border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: 'transparent', transition: 'all 0.15s',
                color:         tab === t.key ? '#00A896' : '#94A3B8',
                borderBottom:  tab === t.key ? '2px solid #00A896' : '2px solid transparent',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── DADOS ───────────────────────────────── */}
          {tab === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Tipo de contato */}
              <div>
                <label style={lbl}>Tipo de contato</label>
                <select value={editType} onChange={e => setEditType(e.target.value)} style={inp}>
                  <option value="unknown">Desconhecido</option>
                  <option value="lead">Lead</option>
                  <option value="client">Cliente</option>
                  <option value="supplier">Fornecedor</option>
                  <option value="other">Outro</option>
                </select>
              </div>

              {/* Nome */}
              <div>
                <label style={lbl}>Nome do responsável</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={inp} placeholder="Nome" />
              </div>

              {/* Telefone */}
              <div>
                <label style={lbl}>Telefone</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inp} placeholder="Telefone" />
              </div>

              {/* E-mail */}
              <div>
                <label style={lbl}>E-mail</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={inp} placeholder="E-mail" />
              </div>

              {/* Série */}
              <div>
                <label style={lbl}>Série</label>
                <select value={editGrade} onChange={e => setEditGrade(e.target.value)} style={inp}>
                  <option value="">Sem série</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              {/* Origem */}
              {contact.source && (
                <div>
                  <label style={lbl}>Origem</label>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>{contact.source}</p>
                </div>
              )}

              {/* Tags */}
              <div>
                <label style={lbl}>Etiquetas</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: tags.length > 0 ? 8 : 0 }}>
                  {tags.map(tag => (
                    <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 600, background: getTagColor(tag) + '22', color: getTagColor(tag), border: `1px solid ${getTagColor(tag)}44` }}>
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 12, opacity: 0.7 }}>×</button>
                    </span>
                  ))}
                </div>
                {unaddedTags.length > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button onClick={() => setShowTagDrop(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1.5px dashed #CBD5E1', borderRadius: 9, background: '#F8FAFC', color: '#94A3B8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                      <TagIcon size={12} /> Adicionar etiqueta
                    </button>
                    {showTagDrop && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', minWidth: 180, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                        {unaddedTags.map(t => (
                          <button key={t.id} onClick={() => handleAddTag(t.name)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#1A2B4A', textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {availTags.length === 0 && tags.length === 0 && (
                  <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1' }}>Nenhuma etiqueta disponível. Configure em Configurações → WhatsApp.</p>
                )}
              </div>

              <button onClick={handleSaveDados} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 0', borderRadius: 10, border: 'none', background: '#00A896', color: 'white', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, marginTop: 4 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Salvando...' : 'Salvar dados'}
              </button>

              {/* Delete contact */}
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 10, border: '1.5px solid #FCA5A5', background: 'transparent', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 2 }}>
                  Excluir contato
                </button>
              ) : (
                <div style={{ padding: '12px 14px', background: '#FFF5F5', borderRadius: 10, border: '1px solid #FECACA', marginTop: 2 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#DC2626', fontWeight: 600 }}>Tem certeza? Esta ação não pode ser desfeita.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={handleDelete} disabled={deleting}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 0', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                      {deleting ? <Loader2 size={13} className="animate-spin" /> : null}
                      {deleting ? 'Excluindo...' : 'Confirmar exclusão'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── HISTÓRICO ───────────────────────────── */}
          {tab === 'historico' && (
            <div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                  <Clock size={36} color="#E2E8F0" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Nenhum histórico disponível</p>
                </div>
              ) : (
                history.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F8FAFC', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{item.icon}</div>
                      {i < history.length - 1 && <div style={{ width: 2, flex: 1, background: '#E2E8F0', minHeight: 16, marginTop: 4 }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{item.title}</p>
                      <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748B' }}>{item.description}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#CBD5E1' }}>{new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── ANOTAÇÕES ───────────────────────────── */}
          {tab === 'notas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!notesAvailable ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
                  <p style={{ margin: 0 }}>Módulo de anotações não disponível.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Adicionar anotação..."
                      style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, resize: 'vertical', minHeight: 72, outline: 'none', fontFamily: 'inherit', color: '#1A2B4A' }} />
                    <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: 'none', background: '#00A896', color: 'white', cursor: 'pointer', opacity: savingNote || !noteText.trim() ? 0.5 : 1, flexShrink: 0 }}>
                      <Plus size={16} />
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '24px 0' }}>Nenhuma anotação ainda.</p>
                  ) : (
                    notes.map(n => (
                      <div key={n.id} style={{ padding: '12px 14px', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F1F5F9' }}>
                        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{n.content}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{n.author_name} · {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
          )}

          {/* ── TRANSFERÊNCIA ───────────────────────── */}
          {tab === 'transferencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {!transfersAvailable ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
                  <p style={{ margin: 0 }}>Módulo de transferências não disponível.</p>
                </div>
              ) : loadingT ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
                  <div className="animate-spin" style={{ width: 24, height: 24, border: '2px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 8px' }} />
                  Carregando...
                </div>
              ) : transfers.length > 0 ? (
                <>
                  {transfers.map(t => {
                    const si = getStatusInfo(t)
                    return (
                      <div key={t.id} style={{ padding: '14px 16px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>{t.student_name}</p>
                            <p style={{ margin: 0, fontSize: 12, color: '#64748B' }}>{t.course_grade} · {new Date(t.transfer_date).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: si.bg, color: si.color, whiteSpace: 'nowrap', flexShrink: 0 }}>{si.label}</span>
                        </div>
                        {t.stated_reason && (
                          <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748B', background: '#fff', padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0' }}>{t.stated_reason}</p>
                        )}
                        <button onClick={() => navigate('/transferencias')}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                          <ArrowRightLeft size={12} /> Ir para Transferências
                        </button>
                      </div>
                    )
                  })}
                  <button onClick={() => setShowTForm(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px dashed #CBD5E1', background: 'white', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center' }}>
                    <Plus size={13} /> Registrar nova transferência
                  </button>
                </>
              ) : contact.student_name ? (
                <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
                  <ArrowRightLeft size={32} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Nenhuma transferência registrada</p>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8' }}>Este aluno não possui transferências.</p>
                  <button onClick={() => setShowTForm(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={13} /> Registrar transferência
                  </button>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '32px 0' }}>
                  Este contato não possui aluno vinculado.
                </p>
              )}

              {showTForm && (
                <div style={{ padding: 16, background: '#FFF5F5', borderRadius: 12, border: '1px solid #FECACA' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Registrar transferência</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={lbl}>Nome do aluno *</label>
                      <input value={tForm.studentName} onChange={e => setTForm(f => ({ ...f, studentName: e.target.value }))} style={inp} placeholder="Nome do aluno" />
                    </div>
                    <div>
                      <label style={lbl}>Série *</label>
                      <select value={tForm.grade} onChange={e => setTForm(f => ({ ...f, grade: e.target.value }))} style={inp}>
                        <option value="">Selecione...</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Motivo informado</label>
                      <input value={tForm.statedReason} onChange={e => setTForm(f => ({ ...f, statedReason: e.target.value }))} style={inp} placeholder="Motivo" />
                    </div>
                    <div>
                      <label style={lbl}>Observações internas</label>
                      <textarea value={tForm.internalNotes} onChange={e => setTForm(f => ({ ...f, internalNotes: e.target.value }))}
                        style={{ ...inp, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />
                    </div>
                    {tError && <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{tError}</p>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowTForm(false); setTError(null) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={handleSaveTransfer} disabled={savingT}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingT ? 0.7 : 1 }}>
                        {savingT ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        Registrar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: '#1A2B4A', color: 'white', fontSize: 13, fontWeight: 500, padding: '10px 16px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {toast}
        </div>
      )}
    </div>
  )
}
