import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Users, Search, Plus, X, ChevronRight, Phone, Mail,
  MessageCircle, Clock, FileText, Tag, Edit3, Check,
  Filter, GraduationCap, User, StickyNote, History,
  MoreVertical, Trash2, AlertCircle, ChevronLeft
} from 'lucide-react'

// ─── Tipos ───────────────────────────────────────────────────
interface Client {
  id: string
  institution_id: string
  student_name: string
  student_grade: string | null
  student_class: string | null
  guardian_name: string
  guardian_phone: string | null
  guardian_email: string | null
  guardian_cpf: string | null
  status: 'active' | 'inactive' | 'transferred' | 'lead'
  avatar_color: string
  tags: string[]
  custom_fields: Record<string, string>
  notes_count: number
  created_at: string
  updated_at: string
}

interface Note {
  id: string
  client_id: string
  institution_id: string
  content: string
  author_name: string
  created_at: string
}

interface HistoryItem {
  id: string
  type: 'lead' | 'visit' | 'enrollment' | 'survey' | 'whatsapp' | 'note' | 'status_change'
  title: string
  description: string | null
  created_at: string
  icon: string
}

interface CustomField {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  active:      { label: 'Ativo',       bg: '#D1FAE5', color: '#065F46' },
  inactive:    { label: 'Inativo',     bg: '#F1F5F9', color: '#64748B' },
  transferred: { label: 'Transferido', bg: '#DBEAFE', color: '#1E40AF' },
  lead:        { label: 'Lead',        bg: '#FEF3C7', color: '#92400E' },
}

const AVATAR_COLORS = ['#00A896', '#3B82F6', '#8B5CF6', '#F97316', '#EF4444', '#10B981', '#F59E0B', '#EC4899']

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(date: string) {
  return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

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

// ─── Componente principal ─────────────────────────────────────
export default function ClientsModule() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const mountedRef = useRef(true)

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterGrade, setFilterGrade] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState<'resumo' | 'historico' | 'anotacoes' | 'whatsapp'>('resumo')
  const [showNewModal, setShowNewModal] = useState(false)
  const [showFieldsModal, setShowFieldsModal] = useState(false)
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [toast, setToast] = useState<string | null>(null)

  // Notes
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // History
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Form novo cliente
  const [form, setForm] = useState({
    student_name: '', student_grade: '', student_class: '',
    guardian_name: '', guardian_phone: '', guardian_email: '', guardian_cpf: '',
    status: 'active' as Client['status'],
    tags: [] as string[],
    custom_fields: {} as Record<string, string>,
  })
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    loadClients()
    loadCustomFields()
    return () => { mountedRef.current = false }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('institution_id', institutionId)
      .order('student_name')
    if (mountedRef.current) {
      setClients(data || [])
      setLoading(false)
    }
  }

  async function loadCustomFields() {
    const { data } = await supabase
      .from('client_custom_fields')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at')
    if (mountedRef.current && data) setCustomFields(data)
  }

  async function loadNotes(clientId: string) {
    const { data } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
    if (mountedRef.current) setNotes(data || [])
  }

  async function loadHistory(client: Client) {
    setLoadingHistory(true)
    const items: HistoryItem[] = []

    // Busca lead relacionado
    const { data: leads } = await supabase
      .from('leads')
      .select('id, created_at, source, status')
      .eq('institution_id', institutionId)
      .ilike('name', `%${client.student_name}%`)
      .limit(5)

    for (const lead of leads || []) {
      items.push({
        id: `lead-${lead.id}`,
        type: 'lead',
        title: 'Lead cadastrado',
        description: `Origem: ${lead.source || 'Não informado'}`,
        created_at: lead.created_at,
        icon: '👤',
      })
    }

    // Busca notas
    const { data: noteItems } = await supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })

    for (const note of noteItems || []) {
      items.push({
        id: `note-${note.id}`,
        type: 'note',
        title: `Anotação de ${note.author_name}`,
        description: note.content.length > 80 ? note.content.slice(0, 80) + '...' : note.content,
        created_at: note.created_at,
        icon: '📝',
      })
    }

    // Cadastro do cliente
    items.push({
      id: `created-${client.id}`,
      type: 'status_change',
      title: 'Cliente cadastrado',
      description: `Status inicial: ${STATUS_CONFIG[client.status]?.label}`,
      created_at: client.created_at,
      icon: '✅',
    })

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (mountedRef.current) {
      setHistory(items)
      setLoadingHistory(false)
    }
  }

  async function saveNote() {
    if (!newNote.trim() || !selectedClient) return
    setSavingNote(true)
    const { error } = await supabase.from('client_notes').insert({
      client_id: selectedClient.id,
      institution_id: institutionId,
      content: newNote.trim(),
      author_name: user?.full_name || 'Usuário',
    })
    if (!error) {
      setNewNote('')
      await loadNotes(selectedClient.id)
      showToast('Anotação salva!')
    }
    setSavingNote(false)
  }

  async function deleteNote(id: string) {
    if (!confirm('Excluir esta anotação?')) return
    await supabase.from('client_notes').delete().eq('id', id)
    if (selectedClient) await loadNotes(selectedClient.id)
  }

  async function createClient() {
    if (!form.student_name.trim() || !form.guardian_name.trim()) return
    setSaving(true)
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    const { data, error } = await supabase.from('clients').insert({
      institution_id: institutionId,
      student_name: form.student_name.trim(),
      student_grade: form.student_grade.trim() || null,
      student_class: form.student_class.trim() || null,
      guardian_name: form.guardian_name.trim(),
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      guardian_cpf: form.guardian_cpf.trim() || null,
      status: form.status,
      avatar_color: color,
      tags: form.tags,
      custom_fields: form.custom_fields,
    }).select().single()

    setSaving(false)
    if (error || !data) { showToast('Erro ao cadastrar cliente.'); return }
    showToast('Cliente cadastrado!')
    setShowNewModal(false)
    setForm({ student_name: '', student_grade: '', student_class: '', guardian_name: '', guardian_phone: '', guardian_email: '', guardian_cpf: '', status: 'active', tags: [], custom_fields: {} })
    await loadClients()
  }

  async function updateClient() {
    if (!selectedClient) return
    setSaving(true)
    const { error } = await supabase.from('clients').update({
      student_name: form.student_name.trim(),
      student_grade: form.student_grade.trim() || null,
      student_class: form.student_class.trim() || null,
      guardian_name: form.guardian_name.trim(),
      guardian_phone: form.guardian_phone.trim() || null,
      guardian_email: form.guardian_email.trim() || null,
      guardian_cpf: form.guardian_cpf.trim() || null,
      status: form.status,
      tags: form.tags,
      custom_fields: form.custom_fields,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedClient.id)

    setSaving(false)
    if (error) { showToast('Erro ao salvar.'); return }
    showToast('Dados salvos!')
    setEditMode(false)
    const updated = { ...selectedClient, ...form, updated_at: new Date().toISOString() }
    setSelectedClient(updated as Client)
    await loadClients()
  }

  async function deleteClient(id: string) {
    if (!confirm('Excluir este cliente? Todos os dados serão perdidos.')) return
    await supabase.from('client_notes').delete().eq('client_id', id)
    await supabase.from('clients').delete().eq('id', id)
    setSelectedClient(null)
    showToast('Cliente excluído.')
    loadClients()
  }

  function openClient(client: Client) {
    setSelectedClient(client)
    setActiveTab('resumo')
    setEditMode(false)
    setForm({
      student_name: client.student_name,
      student_grade: client.student_grade || '',
      student_class: client.student_class || '',
      guardian_name: client.guardian_name,
      guardian_phone: client.guardian_phone || '',
      guardian_email: client.guardian_email || '',
      guardian_cpf: client.guardian_cpf || '',
      status: client.status,
      tags: client.tags || [],
      custom_fields: client.custom_fields || {},
    })
    loadNotes(client.id)
    loadHistory(client)
  }

  // Filtros
  const filtered = clients.filter(c => {
    const matchSearch = !search || c.student_name.toLowerCase().includes(search.toLowerCase()) || c.guardian_name.toLowerCase().includes(search.toLowerCase()) || c.guardian_phone?.includes(search) || c.guardian_cpf?.includes(search)
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    const matchGrade = filterGrade === 'all' || c.student_grade === filterGrade
    return matchSearch && matchStatus && matchGrade
  })

  const grades = [...new Set(clients.map(c => c.student_grade).filter(Boolean))] as string[]

  const kpis = [
    { label: 'Total', value: clients.length, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Ativos', value: clients.filter(c => c.status === 'active').length, color: '#10B981', bg: '#F0FDF4' },
    { label: 'Inativos', value: clients.filter(c => c.status === 'inactive').length, color: '#64748B', bg: '#F8FAFC' },
    { label: 'Transferidos', value: clients.filter(c => c.status === 'transferred').length, color: '#3B82F6', bg: '#EFF6FF' },
  ]

  // ─── PERFIL DO CLIENTE ────────────────────────────────────
  if (selectedClient) {
    const st = STATUS_CONFIG[selectedClient.status]
    const whatsappUrl = selectedClient.guardian_phone
      ? `https://wa.me/55${selectedClient.guardian_phone.replace(/\D/g, '')}`
      : null

    return (
      <div style={{ padding: '24px 32px', maxWidth: 1000, margin: '0 auto' }}>
        {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <button onClick={() => setSelectedClient(null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
            <ChevronLeft size={14} /> Voltar
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: selectedClient.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {getInitials(selectedClient.student_name)}
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{selectedClient.student_name}</h1>
              <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0' }}>
                {selectedClient.student_grade && `${selectedClient.student_grade}`}
                {selectedClient.student_class && ` · Turma ${selectedClient.student_class}`}
                {' · '}Responsável: {selectedClient.guardian_name}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: '#D1FAE5', color: '#065F46', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
            )}
            <button onClick={() => setEditMode(!editMode)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: editMode ? '#F0FDF4' : 'white', color: editMode ? '#16A34A' : '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Edit3 size={14} /> {editMode ? 'Editando' : 'Editar'}
            </button>
            <button onClick={() => deleteClient(selectedClient.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 2, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: 4, width: 'fit-content', marginBottom: 20 }}>
          {[
            { id: 'resumo', label: 'Dados', icon: User },
            { id: 'historico', label: 'Histórico', icon: History },
            { id: 'anotacoes', label: 'Anotações', icon: StickyNote },
            { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
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

        {/* Aba Dados */}
        {activeTab === 'resumo' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Dados do aluno */}
            <div style={{ ...card, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <GraduationCap size={16} color="#64748B" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Dados do Aluno</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Nome do aluno</label>
                  {editMode ? <input style={inp} value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} /> : <p style={{ fontSize: 14, color: '#1A2B4A', margin: 0, fontWeight: 600 }}>{selectedClient.student_name}</p>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={lbl}>Série</label>
                    {editMode ? <input style={inp} value={form.student_grade} onChange={e => setForm(f => ({ ...f, student_grade: e.target.value }))} placeholder="Ex: 3º Ano EF" /> : <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.student_grade || '—'}</p>}
                  </div>
                  <div>
                    <label style={lbl}>Turma</label>
                    {editMode ? <input style={inp} value={form.student_class} onChange={e => setForm(f => ({ ...f, student_class: e.target.value }))} placeholder="Ex: A" /> : <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.student_class || '—'}</p>}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  {editMode ? (
                    <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo</option>
                      <option value="transferred">Transferido</option>
                      <option value="lead">Lead</option>
                    </select>
                  ) : (
                    <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Dados do responsável */}
            <div style={{ ...card, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <User size={16} color="#64748B" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Dados do Responsável</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={lbl}>Nome</label>
                  {editMode ? <input style={inp} value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} /> : <p style={{ fontSize: 14, color: '#1A2B4A', margin: 0, fontWeight: 600 }}>{selectedClient.guardian_name}</p>}
                </div>
                <div>
                  <label style={lbl}>CPF</label>
                  {editMode ? <input style={inp} value={form.guardian_cpf} onChange={e => setForm(f => ({ ...f, guardian_cpf: e.target.value }))} placeholder="000.000.000-00" /> : <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.guardian_cpf || '—'}</p>}
                </div>
                <div>
                  <label style={lbl}>Telefone / WhatsApp</label>
                  {editMode ? <input style={inp} value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} placeholder="(83) 99999-9999" /> : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.guardian_phone || '—'}</p>
                      {selectedClient.guardian_phone && whatsappUrl && (
                        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#10B981', fontWeight: 600, textDecoration: 'none' }}>Abrir WhatsApp →</a>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  {editMode ? <input style={inp} value={form.guardian_email} onChange={e => setForm(f => ({ ...f, guardian_email: e.target.value }))} placeholder="email@exemplo.com" /> : <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.guardian_email || '—'}</p>}
                </div>
              </div>
            </div>

            {/* Campos dinâmicos */}
            {customFields.length > 0 && (
              <div style={{ ...card, padding: 24, gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                  <Tag size={16} color="#64748B" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Campos personalizados</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                  {customFields.map(field => (
                    <div key={field.id}>
                      <label style={lbl}>{field.label}</label>
                      {editMode ? (
                        field.type === 'select' ? (
                          <select style={inp} value={form.custom_fields[field.id] || ''} onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))}>
                            <option value="">Selecione...</option>
                            {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : (
                          <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} style={inp} value={form.custom_fields[field.id] || ''} onChange={e => setForm(f => ({ ...f, custom_fields: { ...f.custom_fields, [field.id]: e.target.value } }))} />
                        )
                      ) : (
                        <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{selectedClient.custom_fields?.[field.id] || '—'}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div style={{ ...card, padding: 24, gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Tag size={16} color="#64748B" />
                <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Tags</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(editMode ? form.tags : selectedClient.tags || []).map((tag, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1', fontSize: 12, fontWeight: 600 }}>
                    {tag}
                    {editMode && <button onClick={() => setForm(f => ({ ...f, tags: f.tags.filter((_, fi) => fi !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}><X size={10} /></button>}
                  </span>
                ))}
                {editMode && (
                  <input
                    placeholder="+ Adicionar tag"
                    style={{ ...inp, width: 140, fontSize: 12 }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        setForm(f => ({ ...f, tags: [...f.tags, e.currentTarget.value.trim()] }))
                        e.currentTarget.value = ''
                      }
                    }}
                  />
                )}
                {!editMode && (selectedClient.tags || []).length === 0 && <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Nenhuma tag</p>}
              </div>
            </div>

            {editMode && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setEditMode(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={updateClient} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Salvando...' : <><Check size={14} /> Salvar</>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Aba Histórico */}
        {activeTab === 'historico' && (
          <div style={{ ...card, padding: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 20px' }}>Timeline de interações</p>
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando histórico...</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Clock size={36} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Nenhuma interação registrada.</p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#E2E8F0' }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {history.map((item) => (
                    <div key={item.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#F8FAFC', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, zIndex: 1 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, paddingTop: 8 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 2px' }}>{item.title}</p>
                        {item.description && <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 4px', lineHeight: 1.5 }}>{item.description}</p>}
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{fmtTime(item.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aba Anotações */}
        {activeTab === 'anotacoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ ...card, padding: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 12px' }}>Nova anotação</p>
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Registre observações, demandas, reclamações ou qualquer informação relevante sobre este cliente..."
                rows={4}
                style={{ ...inp, resize: 'vertical', minHeight: 100, marginBottom: 10 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={saveNote} disabled={!newNote.trim() || savingNote}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !newNote.trim() ? 0.6 : 1 }}>
                  {savingNote ? 'Salvando...' : <><Check size={13} /> Salvar anotação</>}
                </button>
              </div>
            </div>

            {notes.length === 0 ? (
              <div style={{ ...card, padding: 40, textAlign: 'center' }}>
                <StickyNote size={36} color="#E2E8F0" style={{ margin: '0 auto 10px', display: 'block' }} />
                <p style={{ color: '#94A3B8', fontSize: 14, margin: 0 }}>Nenhuma anotação ainda.</p>
              </div>
            ) : (
              notes.map(note => (
                <div key={note.id} style={{ ...card, padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#00A896' }}>
                        {getInitials(note.author_name)}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{note.author_name}</p>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{fmtTime(note.created_at)}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteNote(note.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* Aba WhatsApp */}
        {activeTab === 'whatsapp' && (
          <div style={{ ...card, padding: 40, textAlign: 'center' }}>
            <MessageCircle size={48} color="#E2E8F0" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' }}>
              {selectedClient.guardian_phone ? 'Iniciar conversa pelo WhatsApp' : 'Número não cadastrado'}
            </p>
            {selectedClient.guardian_phone ? (
              <>
                <p style={{ fontSize: 13, color: '#CBD5E1', margin: '0 0 20px' }}>{selectedClient.guardian_phone}</p>
                <a href={whatsappUrl!} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px', borderRadius: 12, background: '#25D366', color: 'white', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                  <MessageCircle size={16} /> Abrir no WhatsApp
                </a>
              </>
            ) : (
              <p style={{ fontSize: 13, color: '#CBD5E1', margin: 0 }}>Cadastre o telefone do responsável para habilitar o WhatsApp.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── LISTA ────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      {toast && <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999 }}>{toast}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Clientes</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '4px 0 0' }}>Gerencie alunos e responsáveis cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowFieldsModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
            <Tag size={14} /> Campos
          </button>
          <button onClick={() => setShowNewModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Novo cliente
          </button>
        </div>
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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone, CPF..." style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 150 }}>
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="transferred">Transferidos</option>
          <option value="lead">Leads</option>
        </select>
        {grades.length > 0 && (
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ ...inp, width: 150 }}>
            <option value="all">Todas as séries</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
      </div>

      {/* Lista */}
      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Carregando clientes...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <Users size={48} color="#E2E8F0" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' }}>
              {clients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum resultado encontrado'}
            </p>
            {clients.length === 0 && (
              <button onClick={() => setShowNewModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
                <Plus size={14} /> Cadastrar primeiro cliente
              </button>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Cliente', 'Responsável', 'Contato', 'Série', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const st = STATUS_CONFIG[c.status]
                return (
                  <tr key={c.id} onClick={() => openClient(c)} style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                          {getInitials(c.student_name)}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{c.student_name}</p>
                          {c.tags && c.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                              {c.tags.slice(0, 2).map((tag, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#F0F9FF', color: '#0369A1', fontWeight: 600 }}>{tag}</span>
                              ))}
                              {c.tags.length > 2 && <span style={{ fontSize: 10, color: '#94A3B8' }}>+{c.tags.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>{c.guardian_name}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {c.guardian_phone && <span style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{c.guardian_phone}</span>}
                        {c.guardian_email && <span style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={11} />{c.guardian_email}</span>}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>{c.student_grade || '—'}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <ChevronRight size={16} color="#CBD5E1" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Modal novo cliente */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Novo cliente</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados do aluno</p>
              <div>
                <label style={lbl}>Nome do aluno *</label>
                <input style={inp} value={form.student_name} onChange={e => setForm(f => ({ ...f, student_name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Série</label>
                  <input style={inp} value={form.student_grade} onChange={e => setForm(f => ({ ...f, student_grade: e.target.value }))} placeholder="Ex: 3º Ano EF" />
                </div>
                <div>
                  <label style={lbl}>Turma</label>
                  <input style={inp} value={form.student_class} onChange={e => setForm(f => ({ ...f, student_class: e.target.value }))} placeholder="Ex: A" />
                </div>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select style={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="transferred">Transferido</option>
                  <option value="lead">Lead</option>
                </select>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#64748B', margin: '8px 0 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Dados do responsável</p>
              <div>
                <label style={lbl}>Nome do responsável *</label>
                <input style={inp} value={form.guardian_name} onChange={e => setForm(f => ({ ...f, guardian_name: e.target.value }))} placeholder="Nome completo" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Telefone / WhatsApp</label>
                  <input style={inp} value={form.guardian_phone} onChange={e => setForm(f => ({ ...f, guardian_phone: e.target.value }))} placeholder="(83) 99999-9999" />
                </div>
                <div>
                  <label style={lbl}>CPF</label>
                  <input style={inp} value={form.guardian_cpf} onChange={e => setForm(f => ({ ...f, guardian_cpf: e.target.value }))} placeholder="000.000.000-00" />
                </div>
              </div>
              <div>
                <label style={lbl}>E-mail</label>
                <input style={inp} value={form.guardian_email} onChange={e => setForm(f => ({ ...f, guardian_email: e.target.value }))} placeholder="email@exemplo.com" />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowNewModal(false)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={createClient} disabled={!form.student_name.trim() || !form.guardian_name.trim() || saving}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !form.student_name.trim() || !form.guardian_name.trim() ? 0.6 : 1 }}>
                  {saving ? 'Salvando...' : <><Check size={13} /> Cadastrar</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal campos dinâmicos */}
      {showFieldsModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Campos personalizados</h2>
              <button onClick={() => setShowFieldsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 20px' }}>Adicione campos extras para capturar informações específicas da sua escola.</p>
            {customFields.map(field => (
              <div key={field.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', marginBottom: 8 }}>
                <Tag size={13} color="#64748B" />
                <span style={{ flex: 1, fontSize: 13, color: '#374151', fontWeight: 600 }}>{field.label}</span>
                <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>{field.type}</span>
                <button onClick={async () => { await supabase.from('client_custom_fields').delete().eq('id', field.id); loadCustomFields() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}><X size={13} /></button>
              </div>
            ))}
            <AddFieldForm institutionId={institutionId} onAdded={loadCustomFields} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Formulário adicionar campo ───────────────────────────────
function AddFieldForm({ institutionId, onAdded }: { institutionId: string; onAdded: () => void }) {
  const [label, setLabel] = useState('')
  const [type, setType] = useState<'text' | 'number' | 'date' | 'select'>('text')
  const [options, setOptions] = useState('')
  const [saving, setSaving] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 10,
    border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  async function save() {
    if (!label.trim()) return
    setSaving(true)
    await supabase.from('client_custom_fields').insert({
      institution_id: institutionId,
      label: label.trim(),
      type,
      options: type === 'select' ? options.split(',').map(o => o.trim()).filter(Boolean) : null,
    })
    setSaving(false)
    setLabel('')
    setOptions('')
    onAdded()
  }

  return (
    <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 16, marginTop: 8 }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 12px', textTransform: 'uppercase' }}>Novo campo</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome do campo" style={inp} />
        <select value={type} onChange={e => setType(e.target.value as any)} style={inp}>
          <option value="text">Texto</option>
          <option value="number">Número</option>
          <option value="date">Data</option>
          <option value="select">Seleção</option>
        </select>
        {type === 'select' && <input value={options} onChange={e => setOptions(e.target.value)} placeholder="Opções separadas por vírgula" style={inp} />}
        <button onClick={save} disabled={!label.trim() || saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !label.trim() ? 0.6 : 1 }}>
          <Plus size={13} /> Adicionar campo
        </button>
      </div>
    </div>
  )
}
