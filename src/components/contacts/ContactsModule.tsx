import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Users, Search, Plus, X, ChevronLeft, Phone, Mail,
  MessageCircle, Clock, Tag, Edit3, Check, Trash2,
  StickyNote, History, GraduationCap, User, Filter
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────
type Origin = 'lead' | 'enrollment' | 'transfer'

interface Contact {
  refId: string          // 'lead:uuid' | 'enrollment:uuid' | 'transfer:uuid'
  rawId: string
  origin: Origin
  originLabel: string
  originColor: string
  originBg: string
  name: string
  phone: string | null
  email: string | null
  grade: string | null
  status: string | null
  created_at: string
}

interface Note {
  id: string
  content: string
  author_name: string
  created_at: string
}

interface CustomField {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}

interface FieldValue {
  field_id: string
  value: string
}

// ─── Config ───────────────────────────────────────────────────
const ORIGIN_CFG: Record<Origin, { label: string; color: string; bg: string }> = {
  lead:       { label: 'Lead',        color: '#7C3AED', bg: '#EDE9FE' },
  enrollment: { label: 'Matriculado', color: '#065F46', bg: '#D1FAE5' },
  transfer:   { label: 'Transferência', color: '#1E40AF', bg: '#DBEAFE' },
}

const AVATAR_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']

function avatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase()
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Styles ───────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'white', borderRadius: 16, border: '1px solid #E2E8F0',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A',
  outline: 'none', boxSizing: 'border-box', background: 'white',
}

const lbl: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 5, display: 'block',
}

// ─── Main component ───────────────────────────────────────────
export default function ContactsModule() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const mountedRef = useRef(true)

  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOrigin, setFilterOrigin] = useState<string>('all')
  const [selected, setSelected] = useState<Contact | null>(null)
  const [activeTab, setActiveTab] = useState<'dados' | 'timeline' | 'anotacoes'>('dados')
  const [showFieldsModal, setShowFieldsModal] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [editingFields, setEditingFields] = useState(false)
  const [savingFields, setSavingFields] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [timeline, setTimeline] = useState<Array<{ id: string; icon: string; title: string; desc: string | null; date: string }>>([])
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    loadAll()
    loadCustomFields()
    return () => { mountedRef.current = false }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Load & merge contacts ─────────────────────────────────
  async function loadAll() {
    setLoading(true)
    const [leadsRes, enrollRes, transferRes] = await Promise.all([
      supabase.from('leads')
        .select('id, student_name, responsible_name, phone, email, status, source, grade_interest, created_at')
        .eq('institution_id', institutionId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('enrollments')
        .select('id, student_name, course_grade, created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false }),
      supabase.from('student_transfers')
        .select('id, student_name, course_grade, created_at')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false }),
    ])

    const merged: Contact[] = []

    for (const l of leadsRes.data || []) {
      const cfg = ORIGIN_CFG.lead
      merged.push({
        refId: `lead:${l.id}`,
        rawId: l.id,
        origin: 'lead',
        originLabel: cfg.label,
        originColor: cfg.color,
        originBg: cfg.bg,
        name: l.student_name || l.responsible_name || 'Sem nome',
        phone: l.phone || null,
        email: l.email || null,
        grade: l.grade_interest || null,
        status: l.status || null,
        created_at: l.created_at,
      })
    }

    for (const e of enrollRes.data || []) {
      const cfg = ORIGIN_CFG.enrollment
      merged.push({
        refId: `enrollment:${e.id}`,
        rawId: e.id,
        origin: 'enrollment',
        originLabel: cfg.label,
        originColor: cfg.color,
        originBg: cfg.bg,
        name: e.student_name || 'Sem nome',
        phone: null,
        email: null,
        grade: e.course_grade || null,
        status: null,
        created_at: e.created_at,
      })
    }

    for (const t of transferRes.data || []) {
      const cfg = ORIGIN_CFG.transfer
      merged.push({
        refId: `transfer:${t.id}`,
        rawId: t.id,
        origin: 'transfer',
        originLabel: cfg.label,
        originColor: cfg.color,
        originBg: cfg.bg,
        name: t.student_name || 'Sem nome',
        phone: null,
        email: null,
        grade: t.course_grade || null,
        status: null,
        created_at: t.created_at,
      })
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (mountedRef.current) {
      setContacts(merged)
      setLoading(false)
    }
  }

  async function loadCustomFields() {
    const { data } = await supabase
      .from('contact_custom_fields')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at')
    if (mountedRef.current && data) setCustomFields(data)
  }

  async function loadNotes(refId: string) {
    const { data } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('contact_ref_id', refId)
      .order('created_at', { ascending: false })
    if (mountedRef.current) setNotes(data || [])
  }

  async function loadFieldValues(refId: string) {
    const { data } = await supabase
      .from('contact_field_values')
      .select('field_id, value')
      .eq('institution_id', institutionId)
      .eq('contact_ref_id', refId)
    if (mountedRef.current && data) {
      const map: Record<string, string> = {}
      for (const r of data) map[r.field_id] = r.value || ''
      setFieldValues(map)
    }
  }

  async function loadTimeline(contact: Contact) {
    const items: typeof timeline = []

    // entry event
    items.push({
      id: 'created',
      icon: '✅',
      title: `${contact.originLabel} cadastrado`,
      desc: contact.grade ? `Série: ${contact.grade}` : null,
      date: contact.created_at,
    })

    // notes
    const { data: noteItems } = await supabase
      .from('contact_notes')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('contact_ref_id', contact.refId)
      .order('created_at', { ascending: false })

    for (const n of noteItems || []) {
      items.push({
        id: `note-${n.id}`,
        icon: '📝',
        title: `Anotação de ${n.author_name}`,
        desc: n.content.length > 80 ? n.content.slice(0, 80) + '...' : n.content,
        date: n.created_at,
      })
    }

    // if lead, look for linked enrollment by name
    if (contact.origin === 'lead') {
      const { data: linked } = await supabase
        .from('enrollments')
        .select('id, created_at, course_grade')
        .eq('institution_id', institutionId)
        .ilike('student_name', `%${contact.name}%`)
        .limit(3)
      for (const e of linked || []) {
        items.push({
          id: `enroll-${e.id}`,
          icon: '🎓',
          title: 'Matrícula realizada',
          desc: e.course_grade || null,
          date: e.created_at,
        })
      }
    }

    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    if (mountedRef.current) setTimeline(items)
  }

  function openContact(c: Contact) {
    setSelected(c)
    setActiveTab('dados')
    setEditingFields(false)
    setNotes([])
    setTimeline([])
    setFieldValues({})
    loadNotes(c.refId)
    loadFieldValues(c.refId)
    loadTimeline(c)
  }

  async function saveNote() {
    if (!newNote.trim() || !selected) return
    setSavingNote(true)
    await supabase.from('contact_notes').insert({
      institution_id: institutionId,
      contact_ref_id: selected.refId,
      contact_ref_type: selected.origin,
      content: newNote.trim(),
      author_name: user?.full_name || 'Usuário',
    })
    setNewNote('')
    await loadNotes(selected.refId)
    await loadTimeline(selected)
    showToast('Anotação salva!')
    setSavingNote(false)
  }

  async function deleteNote(id: string) {
    if (!confirm('Excluir esta anotação?')) return
    await supabase.from('contact_notes').delete().eq('id', id)
    if (selected) {
      await loadNotes(selected.refId)
      await loadTimeline(selected)
    }
  }

  async function saveFieldValues() {
    if (!selected) return
    setSavingFields(true)
    for (const [fieldId, value] of Object.entries(fieldValues)) {
      await supabase.from('contact_field_values').upsert({
        institution_id: institutionId,
        contact_ref_id: selected.refId,
        field_id: fieldId,
        value,
      }, { onConflict: 'contact_ref_id,field_id' })
    }
    setSavingFields(false)
    setEditingFields(false)
    showToast('Campos salvos!')
  }

  // ── Filters ───────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      c.phone?.includes(search) ||
      c.email?.toLowerCase().includes(q)
    const matchOrigin = filterOrigin === 'all' || c.origin === filterOrigin
    return matchSearch && matchOrigin
  })

  const kpis = [
    { label: 'Total', value: contacts.length, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Leads', value: contacts.filter(c => c.origin === 'lead').length, color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'Matriculados', value: contacts.filter(c => c.origin === 'enrollment').length, color: '#065F46', bg: '#D1FAE5' },
    { label: 'Transferências', value: contacts.filter(c => c.origin === 'transfer').length, color: '#1E40AF', bg: '#DBEAFE' },
  ]

  // ─── CONTACT PROFILE ─────────────────────────────────────
  if (selected) {
    const color = avatarColor(selected.name)
    const waUrl = selected.phone ? `https://wa.me/55${selected.phone.replace(/\D/g, '')}` : null

    return (
      <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>
        {toast && <Toast msg={toast} />}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => setSelected(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Voltar
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {initials(selected.name)}
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{selected.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: selected.originBg, color: selected.originColor }}>
                  {selected.originLabel}
                </span>
                {selected.grade && <span style={{ fontSize: 12, color: '#94A3B8' }}>{selected.grade}</span>}
                <span style={{ fontSize: 12, color: '#CBD5E1' }}>desde {fmtDate(selected.created_at)}</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {waUrl && (
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#D1FAE5', color: '#065F46', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {[
            { id: 'dados', label: 'Dados', icon: User },
            { id: 'timeline', label: 'Timeline', icon: History },
            { id: 'anotacoes', label: 'Anotações', icon: StickyNote },
          ].map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#fff' : '#64748B', background: active ? '#1A2B4A' : 'transparent', border: 'none', cursor: 'pointer' }}>
                <Icon size={13} />{tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab: Dados */}
        {activeTab === 'dados' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Informações principais */}
            <div style={{ ...card, padding: 24, gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <User size={16} color="#64748B" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Informações do contato</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                {[
                  { label: 'Nome', value: selected.name },
                  { label: 'Origem', value: selected.originLabel },
                  { label: 'Série', value: selected.grade || '—' },
                  { label: 'Telefone', value: selected.phone || '—' },
                  { label: 'E-mail', value: selected.email || '—' },
                  { label: 'Primeiro contato', value: fmtDate(selected.created_at) },
                ].map(f => (
                  <div key={f.label}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 4px' }}>{f.label}</p>
                    <p style={{ fontSize: 14, color: '#1A2B4A', fontWeight: 600, margin: 0 }}>{f.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Campos personalizados */}
            {customFields.length > 0 && (
              <div style={{ ...card, padding: 24, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={16} color="#64748B" />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Campos personalizados</span>
                  </div>
                  {!editingFields
                    ? <button onClick={() => setEditingFields(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, color: '#64748B', cursor: 'pointer' }}><Edit3 size={12} /> Editar</button>
                    : <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setEditingFields(false)} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', fontSize: 12, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
                        <button onClick={saveFieldValues} disabled={savingFields} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 8, background: '#00A896', color: 'white', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          <Check size={12} /> Salvar
                        </button>
                      </div>
                  }
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {customFields.map(f => (
                    <div key={f.id}>
                      <label style={lbl}>{f.label}</label>
                      {editingFields ? (
                        f.type === 'select' ? (
                          <select style={inp} value={fieldValues[f.id] || ''} onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))}>
                            <option value="">Selecione...</option>
                            {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} style={inp}
                            value={fieldValues[f.id] || ''}
                            onChange={e => setFieldValues(v => ({ ...v, [f.id]: e.target.value }))} />
                        )
                      ) : (
                        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{fieldValues[f.id] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Timeline */}
        {activeTab === 'timeline' && (
          <div style={{ ...card, padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 20px' }}>Timeline de interações</p>
            {timeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Clock size={36} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Nenhum evento registrado.</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#E2E8F0' }} />
                {timeline.map(item => (
                  <div key={item.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F8FAFC', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1, paddingTop: 8 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>{item.title}</p>
                      {item.desc && <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 4px', lineHeight: 1.5 }}>{item.desc}</p>}
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{fmtDateTime(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Anotações */}
        {activeTab === 'anotacoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 12px' }}>Nova anotação</p>
              <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                placeholder="Registre observações, demandas ou qualquer informação relevante..."
                rows={4} style={{ ...inp, resize: 'vertical', minHeight: 90, marginBottom: 10 }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={saveNote} disabled={!newNote.trim() || savingNote}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newNote.trim() ? 0.6 : 1 }}>
                  {savingNote ? 'Salvando...' : <><Check size={13} /> Salvar</>}
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center' }}>
                <StickyNote size={36} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Nenhuma anotação ainda.</p>
              </div>
            ) : notes.map(note => (
              <div key={note.id} style={{ ...card, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#00A896' }}>
                      {initials(note.author_name)}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{note.author_name}</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{fmtDateTime(note.created_at)}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fields modal */}
        {showFieldsModal && (
          <FieldsModal institutionId={institutionId} fields={customFields} onClose={() => setShowFieldsModal(false)} onChanged={loadCustomFields} />
        )}
      </div>
    )
  }

  // ─── LIST VIEW ────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {toast && <Toast msg={toast} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Contatos</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '4px 0 0' }}>Visão unificada de leads, matrículas e transferências</p>
        </div>
        <button onClick={() => setShowFieldsModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
          <Tag size={14} /> Campos personalizados
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '16px 20px' }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color, margin: '0 0 4px' }}>{k.value}</p>
            <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontWeight: 600 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} style={{ ...inp, width: 180 }}>
          <option value="all">Todas as origens</option>
          <option value="lead">Leads</option>
          <option value="enrollment">Matriculados</option>
          <option value="transfer">Transferências</option>
        </select>
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Carregando contatos...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <Users size={48} color="#E2E8F0" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8', margin: 0 }}>
              {contacts.length === 0 ? 'Nenhum contato ainda' : 'Nenhum resultado encontrado'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Contato', 'Telefone', 'E-mail', 'Origem', 'Série', 'Desde', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const color = avatarColor(c.name)
                return (
                  <tr key={c.refId} onClick={() => openContact(c)}
                    style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                          {initials(c.name)}
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{c.name}</p>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
                      {c.phone ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{c.phone}</span> : '—'}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#94A3B8' }}>
                      {c.email || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.originBg, color: c.originColor }}>
                        {c.originLabel}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>{c.grade || '—'}</td>
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#94A3B8' }}>{fmtDate(c.created_at)}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {showFieldsModal && (
        <FieldsModal institutionId={institutionId} fields={customFields} onClose={() => setShowFieldsModal(false)} onChanged={loadCustomFields} />
      )}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>
      {msg}
    </div>
  )
}

// ─── Fields Modal ─────────────────────────────────────────────
function FieldsModal({ institutionId, fields, onClose, onChanged }: {
  institutionId: string
  fields: CustomField[]
  onClose: () => void
  onChanged: () => void
}) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'number' | 'date' | 'select'>('text')
  const [options, setOptions] = useState('')
  const [saving, setSaving] = useState(false)

  const s: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  async function addField() {
    if (!label.trim()) return
    setSaving(true)
    await supabase.from('contact_custom_fields').insert({
      institution_id: institutionId,
      label: label.trim(),
      type,
      options: type === 'select' ? options.split(',').map(o => o.trim()).filter(Boolean) : null,
    })
    setSaving(false)
    setLabel('')
    setOptions('')
    onChanged()
  }

  async function removeField(id: string) {
    await supabase.from('contact_custom_fields').delete().eq('id', id)
    onChanged()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Campos personalizados</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>
        <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>Campos extras que aparecem no perfil de todos os contatos.</p>

        {fields.map(f => (
          <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 8 }}>
            <Tag size={13} color="#64748B" />
            <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 600 }}>{f.label}</span>
            <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>{f.type}</span>
            <button onClick={() => removeField(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}><X size={13} /></button>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase' }}>Novo campo</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome do campo" style={s} />
            <select value={type} onChange={e => setType(e.target.value as any)} style={s}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="date">Data</option>
              <option value="select">Seleção</option>
            </select>
            {type === 'select' && (
              <input value={options} onChange={e => setOptions(e.target.value)} placeholder="Opções separadas por vírgula" style={s} />
            )}
            <button onClick={addField} disabled={!label.trim() || saving}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !label.trim() ? 0.6 : 1 }}>
              <Plus size={13} /> Adicionar campo
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
