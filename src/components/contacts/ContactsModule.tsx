import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, Search, Phone, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
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
  if (hasLead && hasWa) return { label: 'Lead + WhatsApp', color: 'bg-[#D1FAE5] text-[#065F46]' }
  if (hasLead)          return { label: 'Lead',            color: 'bg-[#EDE9FE] text-[#7C3AED]' }
  return                       { label: 'WhatsApp',        color: 'bg-[#FEF3C7] text-[#D97706]' }
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
  return (
    <div className="px-8 py-6 max-w-[1280px] mx-auto" style={{ background: '#f8f9fb', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-[#3B82F6]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#1A2B4A]">Contatos</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#3B82F6] text-xs font-bold">
                {contacts.length}
              </span>
            </div>
            <p className="text-sm text-[#94A3B8]">Leads e WhatsApp unificados</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={loading || filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] text-sm font-medium hover:bg-[#F8FAFB] disabled:opacity-50 transition-colors">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00A896] text-white text-sm font-semibold hover:bg-[#008f81] disabled:opacity-60 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center text-xl mb-3`}>{k.icon}</div>
            <p className={`text-3xl font-extrabold ${k.color} mb-1`}>{k.value}</p>
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#1A2B4A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#00A896] outline-none" />
        </div>
        <select value={filterOrigin} onChange={e => { setFilterOrigin(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
          <option value="all">Todas as origens</option>
          <option value="lead">Apenas Lead</option>
          <option value="whatsapp">Apenas WhatsApp</option>
          <option value="both">Lead + WhatsApp</option>
        </select>
        {grades.length > 0 && (
          <select value={filterGrade} onChange={e => { setFilterGrade(e.target.value); setPage(1) }}
            className="px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
            <option value="all">Todas as séries</option>
            {grades.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        {attendants.length > 0 && (
          <select value={filterAttendant} onChange={e => { setFilterAttendant(e.target.value); setPage(1) }}
            className="px-3 py-2.5 text-sm border border-[#E2E8F0] rounded-xl bg-white text-[#1A2B4A] focus:ring-2 focus:ring-[#00A896] outline-none">
            <option value="all">Todos os atendentes</option>
            {attendants.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-[3px] border-[#00A896] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#94A3B8]">Carregando contatos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Users className="w-12 h-12 text-[#E2E8F0]" />
            <p className="text-sm font-semibold text-[#94A3B8]">
              {contacts.length === 0 ? 'Nenhum contato ainda' : 'Nenhum resultado'}
            </p>
            {contacts.length === 0 && (
              <p className="text-xs text-[#CBD5E1] max-w-xs">Os contatos aparecem aqui quando leads ou conversas WhatsApp forem registrados.</p>
            )}
          </div>
        ) : (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC]">
                  {['Contato', 'Telefone', 'Origem', 'Série', 'Último contato', 'Ações'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide border-b border-[#E2E8F0] whitespace-nowrap">
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
                      className="border-b border-[#F8FAFC] cursor-pointer hover:bg-[#F8FAFB] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0"
                            style={{ background: color }}>
                            {initials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1A2B4A] truncate">{c.name}</p>
                            {c.student_name && (
                              <p className="text-xs text-[#94A3B8] truncate">{c.student_name}</p>
                            )}
                            {c.tags.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {c.tags.slice(0, 2).map((t, i) => (
                                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F0F9FF] text-[#0369A1] font-semibold">{t}</span>
                                ))}
                                {c.tags.length > 2 && <span className="text-[10px] text-[#94A3B8]">+{c.tags.length - 2}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.phone
                          ? <span className="flex items-center gap-1 text-xs text-[#475569]"><Phone className="w-3 h-3" />{c.phone}</span>
                          : <span className="text-[#CBD5E1] text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${origin.color}`}>
                          {origin.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#475569]">{c.grade || <span className="text-[#CBD5E1]">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-[#94A3B8] whitespace-nowrap">{fmtDate(c.last_contact)}</td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); setProfileContact(c) }}
                          className="px-3 py-1.5 text-xs font-semibold border border-[#E2E8F0] rounded-lg text-[#64748B] hover:border-[#00A896] hover:text-[#00A896] transition-colors bg-white">
                          Ver perfil
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
              <p className="text-xs text-[#94A3B8]">
                Página {safePage} de {totalPages} — {filtered.length} contatos
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#E2E8F0] rounded-lg text-[#64748B] bg-white hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-[#E2E8F0] rounded-lg text-[#64748B] bg-white hover:bg-[#F8FAFB] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Próxima <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {profileContact && (
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
      )}
    </div>
  )
}
