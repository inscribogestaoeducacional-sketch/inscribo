import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, Search, Phone, RefreshCw, Filter } from 'lucide-react'
import ContactDrawer from '../whatsapp/ContactDrawer'

// ─── Types ────────────────────────────────────────────────────
interface UnifiedContact {
  id: string
  name: string
  student_name: string | null
  phone: string | null
  email: string | null
  grade: string | null
  source: string | null
  status_lead: string | null
  status_whatsapp: string | null
  has_lead: boolean
  has_whatsapp: boolean
  lead_id: string | null
  remote_jid: string | null
  contact_type: string | null
  assigned_user_name: string | null
  tags: string[]
  last_contact: string
  origin_label: string
  origin_color: string
  origin_bg: string
}

// ─── Helpers ─────────────────────────────────────────────────
const HEX_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']
const TW_COLORS  = ['bg-cyan-500','bg-blue-500','bg-violet-500','bg-orange-500','bg-red-500','bg-emerald-500','bg-amber-500','bg-pink-500']

function nameHash(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff
  return Math.abs(h)
}

const hexColor = (name: string) => HEX_COLORS[nameHash(name) % HEX_COLORS.length]
const twColor  = (name: string) => TW_COLORS[nameHash(name) % TW_COLORS.length]

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
  if (hasLead && hasWa) return { label: 'Lead + WhatsApp', color: '#065F46', bg: '#D1FAE5' }
  if (hasLead)          return { label: 'Lead',            color: '#7C3AED', bg: '#EDE9FE' }
  return                       { label: 'WhatsApp',        color: '#D97706', bg: '#FEF3C7' }
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

// ─── Component ────────────────────────────────────────────────
export default function ContactsModule() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const mountedRef = useRef(true)

  const [contacts, setContacts] = useState<UnifiedContact[]>([])
  const [rawConvs, setRawConvs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterAttendant, setFilterAttendant] = useState('all')

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerConv, setDrawerConv] = useState<any>(null)
  const [drawerAllConvs, setDrawerAllConvs] = useState<any[]>([])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [])

  // ── Data loading ────────────────────────────────────────────
  async function load() {
    if (!mountedRef.current) return
    setLoading(true)
    try {
      const [leadsRes, convsRes] = await Promise.all([
        supabase.from('leads')
          .select('id, student_name, responsible_name, phone, email, grade_interest, source, status, created_at')
          .eq('institution_id', institutionId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase.from('whatsapp_conversations')
          .select('remote_jid, contact_name, contact_type, assigned_user_name, tags, status, updated_at, lead_id')
          .eq('institution_id', institutionId)
          .order('updated_at', { ascending: false }),
      ])

      if (!mountedRef.current) return

      const leads = leadsRes.data || []
      const convs = convsRes.data || []
      setRawConvs(convs)

      // Build map keyed by normalized phone (last 9 digits)
      const map = new Map<string, UnifiedContact>()

      for (const l of leads) {
        const phoneKey = normalizePhone(l.phone || '')
        const mapKey   = phoneKey || `lead:${l.id}`
        const existing = map.get(mapKey)
        const cfg = originCfg(true, false)

        if (existing) {
          existing.has_lead      = true
          existing.lead_id       = l.id
          existing.student_name  = existing.student_name || l.student_name || null
          existing.email         = existing.email || l.email || null
          existing.grade         = existing.grade || l.grade_interest || null
          existing.source        = existing.source || l.source || null
          existing.status_lead   = l.status
          const c2 = originCfg(true, existing.has_whatsapp)
          existing.origin_label  = c2.label
          existing.origin_color  = c2.color
          existing.origin_bg     = c2.bg
          if (new Date(l.created_at) > new Date(existing.last_contact)) {
            existing.last_contact = l.created_at
          }
        } else {
          map.set(mapKey, {
            id:                 l.id,
            name:               l.responsible_name || l.student_name || 'Sem nome',
            student_name:       l.student_name || null,
            phone:              l.phone || null,
            email:              l.email || null,
            grade:              l.grade_interest || null,
            source:             l.source || null,
            status_lead:        l.status,
            status_whatsapp:    null,
            has_lead:           true,
            has_whatsapp:       false,
            lead_id:            l.id,
            remote_jid:         null,
            contact_type:       null,
            assigned_user_name: null,
            tags:               [],
            last_contact:       l.created_at,
            origin_label:       cfg.label,
            origin_color:       cfg.color,
            origin_bg:          cfg.bg,
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
          existing.origin_bg    = cfg.bg
          if (!existing.name || existing.name === 'Sem nome') {
            existing.name = c.contact_name || existing.name
          }
          if (c.updated_at && new Date(c.updated_at) > new Date(existing.last_contact)) {
            existing.last_contact = c.updated_at
          }
        } else {
          const cfg = originCfg(false, true)
          const fmtPhone = formatPhone(rawPhone)
          map.set(mapKey, {
            id:                 c.remote_jid,
            name:               c.contact_name || fmtPhone || 'Desconhecido',
            student_name:       null,
            phone:              fmtPhone || null,
            email:              null,
            grade:              null,
            source:             null,
            status_lead:        null,
            status_whatsapp:    c.status,
            has_lead:           false,
            has_whatsapp:       true,
            lead_id:            c.lead_id || null,
            remote_jid:         c.remote_jid,
            contact_type:       c.contact_type || null,
            assigned_user_name: c.assigned_user_name || null,
            tags:               c.tags || [],
            last_contact:       c.updated_at || new Date().toISOString(),
            origin_label:       cfg.label,
            origin_color:       cfg.color,
            origin_bg:          cfg.bg,
          })
        }
      }

      const list = Array.from(map.values())
        .sort((a, b) => new Date(b.last_contact).getTime() - new Date(a.last_contact).getTime())

      if (mountedRef.current) {
        setContacts(list)
        setLoading(false)
      }
    } catch {
      if (mountedRef.current) setLoading(false)
    }
  }

  // ── Open drawer ─────────────────────────────────────────────
  function openDrawer(contact: UnifiedContact) {
    const conv = {
      id:          contact.remote_jid || `${contact.phone?.replace(/\D/g, '')}@s.whatsapp.net`,
      name:        contact.name,
      phone:       contact.phone || '',
      avatarColor: twColor(contact.name),
      contact_type: contact.contact_type || undefined,
      lead_id:      contact.lead_id || undefined,
      tags:         contact.tags,
      status:       contact.status_whatsapp || 'waiting',
      lastTime:     new Date(contact.last_contact),
      lastMessage:  '',
    }

    // All convs as DrawerConversation for "Conversas" tab
    const allDC = rawConvs.map(c => ({
      id:           c.remote_jid,
      name:         c.contact_name || phoneFromJid(c.remote_jid),
      phone:        formatPhone(phoneFromJid(c.remote_jid)),
      avatarColor:  twColor(c.contact_name || c.remote_jid),
      contact_type: c.contact_type,
      lead_id:      c.lead_id,
      tags:         c.tags || [],
      status:       c.status || 'waiting',
      lastTime:     new Date(c.updated_at || Date.now()),
      lastMessage:  '',
    }))

    setDrawerConv(conv)
    setDrawerAllConvs(allDC)
    setDrawerOpen(true)
  }

  function handleDrawerUpdate(jid: string, updates: Record<string, any>) {
    setContacts(prev => prev.map(c => {
      if (c.remote_jid === jid || c.id === jid) {
        return {
          ...c,
          name:         updates.name         ?? c.name,
          contact_type: updates.contact_type ?? c.contact_type,
          lead_id:      updates.lead_id      ?? c.lead_id,
          has_lead:     updates.lead_id ? true : c.has_lead,
        }
      }
      return c
    }))
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
      (filterOrigin === 'lead'      && c.has_lead  && !c.has_whatsapp) ||
      (filterOrigin === 'whatsapp'  && !c.has_lead &&  c.has_whatsapp) ||
      (filterOrigin === 'both'      && c.has_lead  &&  c.has_whatsapp)
    const matchGrade     = filterGrade     === 'all' || c.grade                === filterGrade
    const matchAttendant = filterAttendant === 'all' || c.assigned_user_name   === filterAttendant
    return matchSearch && matchOrigin && matchGrade && matchAttendant
  })

  // ── KPIs ────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total de contatos',    value: contacts.length,                                        color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Leads ativos',         value: contacts.filter(c => c.has_lead && c.status_lead !== 'lost').length,   color: '#7C3AED', bg: '#EDE9FE' },
    { label: 'WhatsApp ativo',       value: contacts.filter(c => c.has_whatsapp && c.status_whatsapp !== 'closed').length, color: '#D97706', bg: '#FEF3C7' },
    { label: 'Lead + WhatsApp',      value: contacts.filter(c => c.has_lead && c.has_whatsapp).length, color: '#065F46', bg: '#D1FAE5' },
  ]

  // ─── Render ────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Contatos</h1>
          <p style={{ fontSize: 14, color: '#94A3B8', margin: '4px 0 0' }}>
            {contacts.length} contatos únicos — leads e WhatsApp unificados
          </p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: 'white', fontSize: 13, color: '#64748B', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Atualizar
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
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} style={{ ...inp, width: 180 }}>
          <option value="all">Todas as origens</option>
          <option value="lead">Apenas Lead</option>
          <option value="whatsapp">Apenas WhatsApp</option>
          <option value="both">Lead + WhatsApp</option>
        </select>
        {grades.length > 0 && (
          <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ ...inp, width: 160 }}>
            <option value="all">Todas as séries</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {attendants.length > 0 && (
          <select value={filterAttendant} onChange={e => setFilterAttendant(e.target.value)} style={{ ...inp, width: 180 }}>
            <option value="all">Todos os atendentes</option>
            {attendants.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
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
            {contacts.length === 0 && (
              <p style={{ fontSize: 13, color: '#CBD5E1', margin: '8px 0 0' }}>
                Os contatos aparecem aqui quando leads ou conversas WhatsApp forem registrados.
              </p>
            )}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Contato', 'Telefone', 'Origem', 'Série', 'Atendente', 'Último contato', ''].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const color = hexColor(c.name)
                return (
                  <tr key={c.id} onClick={() => openDrawer(c)}
                    style={{ borderBottom: '1px solid #F8FAFC', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>

                    {/* Nome + aluno + tags */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: 'white', flexShrink: 0 }}>
                          {initials(c.name)}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>{c.name}</p>
                          {c.student_name && (
                            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{c.student_name}</p>
                          )}
                          {c.tags.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                              {c.tags.slice(0, 2).map((t, i) => (
                                <span key={i} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: '#F0F9FF', color: '#0369A1', fontWeight: 600 }}>{t}</span>
                              ))}
                              {c.tags.length > 2 && <span style={{ fontSize: 10, color: '#94A3B8' }}>+{c.tags.length - 2}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Telefone */}
                    <td style={{ padding: '14px 16px' }}>
                      {c.phone
                        ? <span style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{c.phone}</span>
                        : <span style={{ color: '#CBD5E1', fontSize: 13 }}>—</span>}
                    </td>

                    {/* Origem */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.origin_bg, color: c.origin_color, whiteSpace: 'nowrap' }}>
                        {c.origin_label}
                      </span>
                    </td>

                    {/* Série */}
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>{c.grade || '—'}</td>

                    {/* Atendente */}
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
                      {c.assigned_user_name || <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>

                    {/* Último contato */}
                    <td style={{ padding: '14px 16px', fontSize: 12, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                      {fmtDate(c.last_contact)}
                    </td>

                    {/* Chevron */}
                    <td style={{ padding: '14px 16px' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* ContactDrawer */}
      <ContactDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversation={drawerConv}
        allConversations={drawerAllConvs}
        institutionId={institutionId}
        onUpdate={handleDrawerUpdate}
      />
    </div>
  )
}
