import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, BookUser, Search, Phone, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import ContactCard from './ContactCard'
import { UnifiedContact } from './ContactProfile'

// ─── Helpers ─────────────────────────────────────────────────
const HEX_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']

function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

const hexColor = (name: string) => HEX_COLORS[nameHash(name) % HEX_COLORS.length]

function initials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  if (!parts.length) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function normalizePhone(s: string): string {
  if (!s) return ''
  return s.replace(/\D/g, '').slice(-9)
}

function phoneFromJid(jid: string): string {
  return jid.split('@')[0]
}

function formatPhone(digits: string): string {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

function fmtDate(s: string): string {
  const d = new Date(s)
  const diff = Date.now() - d.getTime()
  if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400000) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function originCfg(hasLead: boolean, hasWa: boolean) {
  if (hasLead && hasWa) return { label: 'Lead + WhatsApp', color: 'bg-[#D1FAE5] text-[#065F46]', badgeStyle: { background: '#D1FAE5', color: '#065F46' } }
  if (hasLead)          return { label: 'Lead',            color: 'bg-[#EDE9FE] text-[#7C3AED]', badgeStyle: { background: '#EDE9FE', color: '#7C3AED' } }
  return                       { label: 'WhatsApp',        color: 'bg-[#FEF3C7] text-[#D97706]', badgeStyle: { background: '#FEF3C7', color: '#D97706' } }
}

const PAGE_SIZE = 20

// ─── Component ────────────────────────────────────────────────
export default function ContactsModule() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const mountedRef = useRef(true)

  const [contacts, setContacts] = useState<UnifiedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterAttendant, setFilterAttendant] = useState('all')
  const [page, setPage] = useState(1)
  const [profileContact, setProfileContact] = useState<UnifiedContact | null>(null)

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data loading ────────────────────────────────────────────
  async function load() {
    if (!mountedRef.current) return
    setLoading(true)
    try {
      const [leadsRes, convsRes, transfersRes] = await Promise.all([
        supabase.from('leads')
          .select('id, student_name, responsible_name, phone, email, grade_interest, source, status, created_at')
          .eq('institution_id', institutionId).is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('whatsapp_conversations')
          .select('remote_jid, contact_name, contact_type, assigned_user_name, tags, status, updated_at, lead_id')
          .eq('institution_id', institutionId).order('updated_at', { ascending: false }),
        supabase.from('student_transfers')
          .select('student_name, status, course_grade')
          .eq('institution_id', institutionId).is('deleted_at', null),
      ])
      if (!mountedRef.current) return

      const leads  = leadsRes.data  || []
      const convs  = convsRes.data  || []
      const txData = transfersRes.data || []

      const txMap = new Map<string, string>()
      for (const t of txData) {
        const key = (t.student_name || '').toLowerCase().trim()
        if (key && !txMap.has(key)) txMap.set(key, t.status || 'pending')
      }

      const map = new Map<string, UnifiedContact>()

      for (const l of leads) {
        const phoneKey = normalizePhone(l.phone || '')
        const mapKey   = phoneKey || `lead:${l.id}`
        const existing = map.get(mapKey)
        const cfg = originCfg(true, false)
        const txKey = (l.student_name || '').toLowerCase().trim()
        const transferStatus = txMap.get(txKey) || null

        if (existing) {
          existing.has_lead      = true
          existing.lead_id       = l.id
          existing.student_name  = existing.student_name || l.student_name || null
          existing.email         = existing.email || l.email || null
          existing.grade         = existing.grade || l.grade_interest || null
          existing.source        = existing.source || l.source || null
          existing.status_lead   = l.status
          existing.transfer_status = existing.transfer_status || transferStatus
          const c2 = originCfg(true, existing.has_whatsapp)
          existing.origin_label  = c2.label
          existing.origin_color  = c2.color
          existing.origin_bg     = ''
          if (new Date(l.created_at) > new Date(existing.last_contact)) existing.last_contact = l.created_at
        } else {
          map.set(mapKey, {
            id: l.id, name: l.responsible_name || l.student_name || 'Sem nome',
            student_name: l.student_name || null, phone: l.phone || null,
            email: l.email || null, grade: l.grade_interest || null,
            source: l.source || null, status_lead: l.status, status_whatsapp: null,
            has_lead: true, has_whatsapp: false, lead_id: l.id, remote_jid: null,
            contact_type: null, assigned_user_name: null, tags: [],
            last_contact: l.created_at, origin_label: cfg.label,
            origin_color: cfg.color, origin_bg: '', transfer_status: transferStatus,
          })
        }
      }

      for (const c of convs) {
        const rawPhone = phoneFromJid(c.remote_jid || '')
        const phoneKey = normalizePhone(rawPhone)
        const mapKey   = phoneKey || `wa:${c.remote_jid}`
        const existing = map.get(mapKey)

        if (existing) {
          existing.has_whatsapp       = true
          existing.remote_jid         = c.remote_jid
          existing.status_whatsapp    = c.status
          existing.contact_type       = existing.contact_type || c.contact_type || null
          existing.assigned_user_name = existing.assigned_user_name || c.assigned_user_name || null
          existing.tags               = (c.tags?.length ? c.tags : existing.tags)
          if (c.lead_id && !existing.lead_id) existing.lead_id = c.lead_id
          const cfg = originCfg(existing.has_lead, true)
          existing.origin_label = cfg.label
          existing.origin_color = cfg.color
          existing.origin_bg    = ''
          if (!existing.name || existing.name === 'Sem nome') existing.name = c.contact_name || existing.name
          if (c.updated_at && new Date(c.updated_at) > new Date(existing.last_contact)) existing.last_contact = c.updated_at
        } else {
          const cfg = originCfg(false, true)
          const fmtPhone = formatPhone(rawPhone)
          map.set(mapKey, {
            id: c.remote_jid, name: c.contact_name || fmtPhone || 'Desconhecido',
            student_name: null, phone: fmtPhone || null, email: null, grade: null,
            source: null, status_lead: null, status_whatsapp: c.status,
            has_lead: false, has_whatsapp: true, lead_id: c.lead_id || null,
            remote_jid: c.remote_jid, contact_type: c.contact_type || null,
            assigned_user_name: c.assigned_user_name || null, tags: c.tags || [],
            last_contact: c.updated_at || new Date().toISOString(),
            origin_label: cfg.label, origin_color: cfg.color, origin_bg: '',
            transfer_status: null,
          })
        }
      }

      const list = Array.from(map.values())
        .sort((a, b) => new Date(b.last_contact).getTime() - new Date(a.last_contact).getTime())

      if (mountedRef.current) { setContacts(list); setLoading(false) }
    } catch {
      if (mountedRef.current) setLoading(false)
    }
  }

  function handleProfileUpdate(id: string, updates: Record<string, any>) {
    if (updates.deleted) {
      setContacts(prev => prev.filter(c => c.id !== id))
      setProfileContact(null)
      return
    }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (profileContact?.id === id) setProfileContact(prev => prev ? { ...prev, ...updates } : prev)
  }

  function exportCSV() {
    const BOM = '\uFEFF'
    const header = 'Nome,Telefone,E-mail,Aluno,Série,Origem,Último contato'
    const rows = filtered.map(c =>
      [c.name, c.phone || '', c.email || '', c.student_name || '', c.grade || '', c.origin_label, fmtDate(c.last_contact)]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
    const csv = BOM + [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'contatos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Derived filters ─────────────────────────────────────────
  const grades     = [...new Set(contacts.map(c => c.grade).filter(Boolean))] as string[]
  const attendants = [...new Set(contacts.map(c => c.assigned_user_name).filter(Boolean))] as string[]

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      c.name.toLowerCase().includes(q) ||
      (c.student_name?.toLowerCase().includes(q) ?? false) ||
      (c.phone?.includes(search) ?? false) ||
      (c.email?.toLowerCase().includes(q) ?? false)
    const matchOrigin =
      filterOrigin === 'all' ||
      (filterOrigin === 'lead'     && c.has_lead  && !c.has_whatsapp) ||
      (filterOrigin === 'whatsapp' && !c.has_lead &&  c.has_whatsapp) ||
      (filterOrigin === 'both'     && c.has_lead  &&  c.has_whatsapp)
    const matchGrade     = filterGrade     === 'all' || c.grade              === filterGrade
    const matchAttendant = filterAttendant === 'all' || c.assigned_user_name === filterAttendant
    return matchSearch && matchOrigin && matchGrade && matchAttendant
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // KPIs
  const kpis = [
    { label: 'Total',        value: contacts.length,                                                               icon: '👥', color: 'text-[#3B82F6]', bg: 'bg-[#EFF6FF]' },
    { label: 'Leads ativos', value: contacts.filter(c => c.has_lead && c.status_lead !== 'lost').length,           icon: '🎯', color: 'text-[#7C3AED]', bg: 'bg-[#EDE9FE]' },
    { label: 'WhatsApp',     value: contacts.filter(c => c.has_whatsapp && c.status_whatsapp !== 'closed').length, icon: '💬', color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]' },
    { label: 'Unificados',   value: contacts.filter(c => c.has_lead && c.has_whatsapp).length,                     icon: '🔗', color: 'text-[#065F46]', bg: 'bg-[#D1FAE5]' },
  ]

  // ─── Render ────────────────────────────────────────────────
  if (profileContact) {
    return (
      <ContactCard
        mode="page"
        onClose={() => setProfileContact(null)}
        institutionId={institutionId}
        initialData={{
          lead_id:            profileContact.lead_id,
          remote_jid:         profileContact.remote_jid,
          name:               profileContact.name,
          phone:              profileContact.phone   ?? undefined,
          email:              profileContact.email   ?? undefined,
          student_name:       profileContact.student_name ?? undefined,
          grade_interest:     profileContact.grade   ?? undefined,
          contact_type:       profileContact.contact_type ?? undefined,
          tags:               profileContact.tags,
          source:             profileContact.source  ?? undefined,
          assigned_user_name: profileContact.assigned_user_name ?? undefined,
        }}
        onUpdate={updates => handleProfileUpdate(profileContact.id, updates)}
      />
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BookUser size={18} color="#3B82F6" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Contatos</h1>
              <span style={{ padding: '2px 9px', background: '#EFF6FF', color: '#3B82F6', fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{contacts.length}</span>
            </div>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Leads e WhatsApp unificados</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={exportCSV} disabled={loading || filtered.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', opacity: (loading || filtered.length === 0) ? 0.5 : 1 }}>
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={load} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>{k.value}</p>
            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome, telefone ou e-mail..."
            style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px 9px 36px', outline: 'none', width: '100%', color: '#1A2B4A', boxSizing: 'border-box' }} />
        </div>
        <select value={filterOrigin} onChange={e => { setFilterOrigin(e.target.value); setPage(1) }}
          style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', outline: 'none', color: '#1A2B4A' }}>
          <option value="all">Todas as origens</option>
          <option value="lead">Apenas Lead</option>
          <option value="whatsapp">Apenas WhatsApp</option>
          <option value="both">Lead + WhatsApp</option>
        </select>
        {grades.length > 0 && (
          <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(1) }}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', outline: 'none', color: '#1A2B4A' }}>
            <option value="all">Todas as séries</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {attendants.length > 0 && (
          <select value={filterAttendant} onChange={e => { setFilterAttendant(e.target.value); setPage(1) }}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', outline: 'none', color: '#1A2B4A' }}>
            <option value="all">Todos os atendentes</option>
            {attendants.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
            <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%' }} />
            <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>Carregando contatos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, textAlign: 'center' }}>
            <Users size={48} color="#e2e8f0" />
            <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
              {contacts.length === 0 ? 'Nenhum contato ainda' : 'Nenhum contato encontrado'}
            </p>
            {contacts.length === 0 && (
              <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0, maxWidth: 280 }}>Os contatos aparecem aqui quando leads ou conversas WhatsApp forem registrados.</p>
            )}
          </div>
        ) : (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Contato', 'Telefone', 'Origem', 'Série', 'Último contato', 'Ações'].map(h => (
                    <th key={h} style={{ background: '#f8fafc', padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageItems.map(c => {
                  const color  = hexColor(c.name)
                  const origin = originCfg(c.has_lead, c.has_whatsapp)
                  return (
                    <tr key={c.id} onClick={() => setProfileContact(c)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {initials(c.name)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                            {c.student_name && (
                              <p style={{ fontSize: 12, color: '#64748b', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.student_name}</p>
                            )}
                            {c.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                                {c.tags.slice(0, 2).map((t, i) => (
                                  <span key={i} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 999, background: '#F0F9FF', color: '#0369A1', fontWeight: 600 }}>{t}</span>
                                ))}
                                {c.tags.length > 2 && <span style={{ fontSize: 10, color: '#94a3b8' }}>+{c.tags.length - 2}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {c.phone
                          ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#475569' }}><Phone size={12} />{c.phone}</span>
                          : <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ ...origin.badgeStyle, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          {origin.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{c.grade || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>{fmtDate(c.last_contact)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <button onClick={e => { e.stopPropagation(); setProfileContact(c) }}
                          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer' }}>
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Mostrando {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} contatos
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, color: '#64748b' }}>
                  <ChevronLeft size={13} /> Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, border: '1px solid #e2e8f0', background: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, color: '#64748b' }}>
                  Próxima <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
