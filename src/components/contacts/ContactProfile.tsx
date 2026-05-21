import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  X, ArrowRightLeft, FileText, Clock, User, Plus, Eye, Check, Loader2,
} from 'lucide-react'

const GRADES = [
  'Infantil I','Infantil II','Infantil III','Infantil IV','Infantil V',
  '1º Ano EF','2º Ano EF','3º Ano EF','4º Ano EF','5º Ano EF',
  '6º Ano EF','7º Ano EF','8º Ano EF','9º Ano EF',
  'Ensino Médio 1','Ensino Médio 2','Ensino Médio 3',
]

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

interface Props {
  contact: UnifiedContact
  institutionId: string
  onClose: () => void
  onUpdate: (id: string, updates: Partial<UnifiedContact>) => void
}

// ─── Helpers ─────────────────────────────────────────────────
const HEX_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']
function nameHash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff; return Math.abs(h) }
const hexColor = (s: string) => HEX_COLORS[nameHash(s) % HEX_COLORS.length]
function initials(s: string) {
  const p = s.trim().split(' ').filter(Boolean)
  if (!p.length) return '?'
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function getStatusInfo(t: any) {
  if (t.status === 'retained')  return { label: 'Retido',             color: '#16a34a', bg: '#dcfce7' }
  if (t.status === 'confirmed') return { label: 'Confirmado',         color: '#dc2626', bg: '#fee2e2' }
  if (t.status === 'cancelled') return { label: 'Cancelado',          color: '#64748b', bg: '#f1f5f9' }
  if (t.ai_diagnosis)           return { label: 'Diagnóstico pronto', color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_responses)       return { label: 'Respondido',         color: '#1d4ed8', bg: '#dbeafe' }
  if (t.survey_token)           return { label: 'Pesquisa enviada',   color: '#d97706', bg: '#fef3c7' }
  return                               { label: 'Aguardando pesquisa', color: '#64748b', bg: '#f1f5f9' }
}

const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0',
  fontSize: 13, outline: 'none', background: '#FAFAFA', boxSizing: 'border-box',
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={inp} placeholder={label} />
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────
export default function ContactProfile({ contact, institutionId, onClose, onUpdate }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const mountedRef = useRef(true)
  const contactRef = contact.lead_id || contact.remote_jid || contact.id

  const [tab, setTab] = useState<'dados' | 'historico' | 'notas' | 'transferencia'>('dados')

  // Dados
  const [editName, setEditName]   = useState(contact.name)
  const [editPhone, setEditPhone] = useState(contact.phone || '')
  const [editEmail, setEditEmail] = useState(contact.email || '')
  const [editGrade, setEditGrade] = useState(contact.grade || '')
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  // Notas
  const [notes, setNotes]         = useState<any[]>([])
  const [noteText, setNoteText]   = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Histórico
  const [history, setHistory] = useState<{ icon: string; title: string; description: string; date: string }[]>([])

  // Transferência
  const [transfers, setTransfers]   = useState<any[]>([])
  const [loadingT, setLoadingT]     = useState(false)
  const [showTForm, setShowTForm]   = useState(false)
  const [tForm, setTForm]           = useState({ studentName: contact.student_name || '', grade: contact.grade || '', statedReason: '', internalNotes: '' })
  const [savingT, setSavingT]       = useState(false)
  const [tError, setTError]         = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    loadNotes()
    loadTransfers()
    buildHistory()
    return () => { mountedRef.current = false }
  }, [])

  // ── Data ──────────────────────────────────────────────────────
  async function loadNotes() {
    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('contact_ref_id', contactRef)
      .order('created_at', { ascending: false })
    if (mountedRef.current) setNotes(data || [])
  }

  async function loadTransfers() {
    if (!contact.student_name) return
    if (mountedRef.current) setLoadingT(true)
    const { data } = await supabase
      .from('student_transfers')
      .select('*')
      .eq('institution_id', institutionId)
      .ilike('student_name', `%${contact.student_name}%`)
      .is('deleted_at', null)
      .order('transfer_date', { ascending: false })
    if (mountedRef.current) {
      setTransfers(data || [])
      setLoadingT(false)
    }
  }

  async function buildHistory() {
    const items: { icon: string; title: string; description: string; date: string }[] = []

    if (contact.lead_id) {
      const { data: lead } = await supabase
        .from('leads').select('created_at, source, status').eq('id', contact.lead_id).single()
      if (lead) {
        items.push({ icon: '👤', title: 'Lead cadastrado', description: `Via ${lead.source || 'origem desconhecida'}`, date: lead.created_at })
        if (lead.status === 'lost')
          items.push({ icon: '❌', title: 'Lead perdido', description: 'Status alterado para perdido', date: lead.created_at })
      }
    }

    if (contact.remote_jid) {
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('created_at, updated_at')
        .eq('remote_jid', contact.remote_jid)
        .eq('institution_id', institutionId)
        .single()
      if (conv) {
        const d = conv.created_at || conv.updated_at
        items.push({ icon: '💬', title: 'Conversa WhatsApp iniciada', description: contact.phone || contact.name, date: d })
      }
    }

    if (contact.student_name) {
      const { data: txs } = await supabase
        .from('student_transfers')
        .select('transfer_date, course_grade, stated_reason, status')
        .eq('institution_id', institutionId)
        .ilike('student_name', `%${contact.student_name}%`)
        .is('deleted_at', null)
      for (const t of txs || []) {
        items.push({
          icon: '🔄',
          title: 'Transferência registrada',
          description: `${t.course_grade} — ${t.stated_reason || 'Motivo não informado'}`,
          date: t.transfer_date,
        })
        if (t.status === 'retained')
          items.push({ icon: '✅', title: 'Aluno retido', description: t.course_grade, date: t.transfer_date })
        if (t.status === 'confirmed')
          items.push({ icon: '🏫', title: 'Transferência confirmada', description: t.course_grade, date: t.transfer_date })
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (mountedRef.current) setHistory(items)
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  // ── Actions ───────────────────────────────────────────────────
  async function handleSaveDados() {
    setSaving(true)
    const tasks: Promise<any>[] = []
    const synced: string[] = []

    if (contact.lead_id) {
      tasks.push(supabase.from('leads').update({
        responsible_name: editName || undefined,
        phone:            editPhone || undefined,
        email:            editEmail || undefined,
        grade_interest:   editGrade || undefined,
      }).eq('id', contact.lead_id))
      synced.push('lead')
    }
    if (contact.remote_jid && editName !== contact.name) {
      tasks.push(supabase.from('whatsapp_conversations')
        .update({ contact_name: editName })
        .eq('remote_jid', contact.remote_jid)
        .eq('institution_id', institutionId))
      synced.push('WhatsApp')
    }

    await Promise.all(tasks)
    setSaving(false)
    onUpdate(contact.id, { name: editName, phone: editPhone || null, email: editEmail || null, grade: editGrade || null })
    showToast(synced.length ? `Salvo em: ${synced.join(' e ')}` : 'Salvo com sucesso')
  }

  async function handleAddNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    const { data } = await supabase.from('contact_notes').insert({
      institution_id: institutionId,
      contact_ref_id: contactRef,
      contact_ref_type: contact.lead_id ? 'lead' : 'whatsapp',
      content: noteText.trim(),
      author_name: user?.full_name || 'Usuário',
    }).select('*').single()
    if (mountedRef.current) {
      if (data) setNotes(prev => [data, ...prev])
      setNoteText('')
      setSavingNote(false)
    }
  }

  async function handleSaveTransfer() {
    if (!tForm.studentName.trim()) { setTError('Nome do aluno obrigatório.'); return }
    if (!tForm.grade)              { setTError('Selecione a série.');          return }
    setTError(null)
    setSavingT(true)
    await supabase.from('student_transfers').insert({
      institution_id: institutionId,
      student_name:   tForm.studentName.trim(),
      course_grade:   tForm.grade,
      transfer_date:  new Date().toISOString().split('T')[0],
      stated_reason:  tForm.statedReason || null,
      internal_notes: tForm.internalNotes || null,
      lead_id:        contact.lead_id || null,
    })
    if (mountedRef.current) {
      setSavingT(false)
      setShowTForm(false)
      showToast('Transferência registrada.')
      loadTransfers()
      buildHistory()
    }
  }

  // ── Render ────────────────────────────────────────────────────
  const color = hexColor(contact.name)
  const tabs = [
    { key: 'dados',        label: 'Dados',        icon: <User size={13} /> },
    { key: 'historico',    label: 'Histórico',     icon: <Clock size={13} /> },
    { key: 'notas',        label: 'Anotações',     icon: <FileText size={13} /> },
    { key: 'transferencia',label: 'Transferência', icon: <ArrowRightLeft size={13} /> },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex' }}>
      <div style={{ flex: 1, background: 'rgba(15,23,42,0.4)' }} onClick={onClose} />

      <div style={{ width: 480, height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.14)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {initials(contact.name)}
              </div>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{contact.name}</h2>
                {contact.student_name && contact.student_name !== contact.name && (
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Aluno: {contact.student_name}</p>
                )}
                <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: contact.origin_bg, color: contact.origin_color }}>
                  {contact.origin_label}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, borderRadius: 6, display: 'flex' }}>
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, marginBottom: -1 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px 9px',
                borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                background: tab === t.key ? '#fff' : 'transparent',
                color: tab === t.key ? '#00A896' : '#94A3B8',
                borderBottom: tab === t.key ? '2px solid #00A896' : '2px solid transparent',
              }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── DADOS ──────────────────────────── */}
          {tab === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Nome" value={editName} onChange={setEditName} />
              <Field label="Telefone" value={editPhone} onChange={setEditPhone} type="tel" />
              <Field label="E-mail" value={editEmail} onChange={setEditEmail} type="email" />
              <div>
                <label style={lbl}>Série</label>
                <select value={editGrade} onChange={e => setEditGrade(e.target.value)} style={inp}>
                  <option value="">Sem série</option>
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              {contact.source && (
                <div>
                  <label style={lbl}>Origem</label>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>{contact.source}</p>
                </div>
              )}
              {contact.assigned_user_name && (
                <div>
                  <label style={lbl}>Atendente</label>
                  <p style={{ margin: 0, fontSize: 13, color: '#475569', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>{contact.assigned_user_name}</p>
                </div>
              )}
              {contact.tags.length > 0 && (
                <div>
                  <label style={lbl}>Tags</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {contact.tags.map((t, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: '#F0F9FF', color: '#0369A1' }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {contact.has_whatsapp && (
                  <button onClick={() => navigate('/whatsapp')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px solid #D1FAE5', background: '#F0FDF4', fontSize: 12, fontWeight: 600, color: '#10B981', cursor: 'pointer' }}>
                    💬 WhatsApp
                  </button>
                )}
                <button onClick={handleSaveDados} disabled={saving} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, border: 'none', background: '#00A896', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                  {saving ? 'Salvando...' : 'Salvar dados'}
                </button>
              </div>
            </div>
          )}

          {/* ── HISTÓRICO ──────────────────────── */}
          {tab === 'historico' && (
            <div>
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94A3B8' }}>
                  <Clock size={32} color="#E2E8F0" style={{ margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: 14 }}>Nenhum histórico disponível</p>
                </div>
              ) : history.map((item, i) => (
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
              ))}
            </div>
          )}

          {/* ── ANOTAÇÕES ──────────────────────── */}
          {tab === 'notas' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Adicionar anotação..."
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, resize: 'vertical', minHeight: 72, outline: 'none', fontFamily: 'inherit' }} />
                <button onClick={handleAddNote} disabled={savingNote || !noteText.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, border: 'none', background: '#00A896', color: 'white', cursor: 'pointer', opacity: savingNote || !noteText.trim() ? 0.5 : 1, flexShrink: 0 }}>
                  <Plus size={16} />
                </button>
              </div>
              {notes.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '24px 0' }}>Nenhuma anotação ainda.</p>
              ) : notes.map(n => (
                <div key={n.id} style={{ padding: '12px 14px', background: '#FAFAFA', borderRadius: 10, border: '1px solid #F1F5F9' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{n.content}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>{n.author_name} · {new Date(n.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── TRANSFERÊNCIA ──────────────────── */}
          {tab === 'transferencia' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingT ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
                  <div style={{ width: 24, height: 24, border: '2px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 8px' }} />
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
                        <div style={{ display: 'flex', gap: 8 }}>
                          {t.ai_diagnosis && (
                            <button onClick={() => navigate('/transferencias')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: 'none', background: '#EDE9FE', color: '#7C3AED', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              <Eye size={12} /> Ver diagnóstico
                            </button>
                          )}
                          <button onClick={() => navigate('/transferencias')} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                            <ArrowRightLeft size={12} /> Ir para Transferências
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={() => setShowTForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1px dashed #CBD5E1', background: 'white', color: '#94A3B8', fontSize: 12, fontWeight: 600, cursor: 'pointer', justifyContent: 'center' }}>
                    <Plus size={13} /> Registrar nova transferência
                  </button>
                </>
              ) : contact.student_name ? (
                <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
                  <ArrowRightLeft size={32} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#1A2B4A' }}>Nenhuma transferência registrada</p>
                  <p style={{ margin: '0 0 16px', fontSize: 12, color: '#94A3B8' }}>Este aluno não possui transferências.</p>
                  <button onClick={() => setShowTForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: 'none', background: '#FEE2E2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    <Plus size={13} /> Registrar transferência
                  </button>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: '32px 0' }}>
                  Este contato não possui aluno vinculado para verificar transferências.
                </p>
              )}

              {/* Inline new-transfer form */}
              {showTForm && (
                <div style={{ padding: 16, background: '#FFF5F5', borderRadius: 12, border: '1px solid #FECACA' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Registrar transferência</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <Field label="Nome do aluno *" value={tForm.studentName} onChange={v => setTForm(f => ({ ...f, studentName: v }))} />
                    <div>
                      <label style={lbl}>Série *</label>
                      <select value={tForm.grade} onChange={e => setTForm(f => ({ ...f, grade: e.target.value }))} style={inp}>
                        <option value="">Selecione...</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <Field label="Motivo informado" value={tForm.statedReason} onChange={v => setTForm(f => ({ ...f, statedReason: v }))} />
                    <div>
                      <label style={lbl}>Observações internas</label>
                      <textarea value={tForm.internalNotes} onChange={e => setTForm(f => ({ ...f, internalNotes: e.target.value }))}
                        style={{ ...inp, resize: 'vertical', minHeight: 60, fontFamily: 'inherit' }} />
                    </div>
                    {tError && <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{tError}</p>}
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setShowTForm(false); setTError(null) }} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
                      <button onClick={handleSaveTransfer} disabled={savingT} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: savingT ? 0.7 : 1 }}>
                        {savingT ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={12} />}
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

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, background: '#1A2B4A', color: 'white', fontSize: 13, fontWeight: 500, padding: '10px 16px', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Check size={14} /> {toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
