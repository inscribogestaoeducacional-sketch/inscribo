import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Users, BookUser, Search, Phone, Download, Upload, FileText, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
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

// Usa o campo `type` de whatsapp_contacts como fonte única de verdade
function typeCfg(type: string | null) {
  if (type === 'lead')   return { label: 'Lead',     color: 'bg-[#EDE9FE] text-[#7C3AED]', badgeStyle: { background: '#EDE9FE', color: '#7C3AED' } }
  if (type === 'client') return { label: 'Cliente',  color: 'bg-[#D1FAE5] text-[#065F46]', badgeStyle: { background: '#D1FAE5', color: '#065F46' } }
  return                        { label: 'WhatsApp', color: 'bg-[#FEF3C7] text-[#D97706]', badgeStyle: { background: '#FEF3C7', color: '#D97706' } }
}

const PAGE_SIZE = 20

// ─── Component ────────────────────────────────────────────────
export default function ContactsModule() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const mountedRef = useRef(true)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const [contacts, setContacts] = useState<UnifiedContact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterAttendant, setFilterAttendant] = useState('all')
  const [page, setPage] = useState(1)
  const [profileContact, setProfileContact] = useState<UnifiedContact | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importRows, setImportRows] = useState<{ nome: string; telefone: string; email: string; endereco: string }[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number } | null>(null)
  const [importLoading, setImportLoading] = useState(false)

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
    if (!institutionId) {
      console.error('Contacts load: institutionId is undefined/null — skipping query')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      // Colunas reais da tabela whatsapp_contacts:
      // id, institution_id, phone, name, type, lead_id,
      // profile_picture_url, last_seen_at, created_at, updated_at
      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('id, phone, name, profile_picture_url, type, lead_id, last_seen_at, created_at, leads(id, student_name, responsible_name, email, grade_interest, source, status)')
        .eq('institution_id', institutionId)
        .order('last_seen_at', { ascending: false })

      if (error) {
        console.error('Contacts query error:', error)
        if (mountedRef.current) setLoading(false)
        return
      }

      if (!mountedRef.current) return

      const list: UnifiedContact[] = (data || []).map((c: any) => {
        const lead     = c.leads || null
        const hasLead  = !!c.lead_id
        const rawPhone = (c.phone || '').replace(/\D/g, '')
        const fmtPhone = rawPhone ? formatPhone(rawPhone) : (c.phone || null)
        const cfg      = typeCfg(c.type)
        return {
          id:                 c.id,
          name:               c.name || fmtPhone || 'Desconhecido',
          student_name:       lead?.student_name || null,
          phone:              fmtPhone,
          email:              lead?.email || null,
          grade:              lead?.grade_interest || null,
          source:             lead?.source || null,
          status_lead:        lead?.status || null,
          status_whatsapp:    null,
          has_lead:           hasLead,
          has_whatsapp:       true,
          lead_id:            c.lead_id || null,
          remote_jid:         rawPhone ? `${rawPhone}@s.whatsapp.net` : null,
          contact_type:       c.type === 'unknown' ? null : (c.type || null),
          assigned_user_name: null,
          tags:               [],
          last_contact:       c.last_seen_at || c.created_at || new Date().toISOString(),
          origin_label:       cfg.label,
          origin_color:       cfg.color,
          origin_bg:          '',
          transfer_status:    null,
        }
      })

      if (mountedRef.current) { setContacts(list); setLoading(false) }
    } catch (e) {
      console.error('Contacts load exception:', e)
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

  function downloadTemplate() {
    const BOM = '﻿'
    const csv = BOM + 'nome,telefone,email,endereco\nJoão Silva,11999998888,joao@email.com,"Rua das Flores, 123"\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'template-contatos.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let cur = ''; let inQ = false
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++ } else inQ = !inQ }
      else if (line[i] === ',' && !inQ) { result.push(cur.trim()); cur = '' }
      else cur += line[i]
    }
    result.push(cur.trim())
    return result
  }

  function parseCSV(text: string): { nome: string; telefone: string; email: string; endereco: string }[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const idx = (col: string) => header.indexOf(col)
    const [ni, ti, ei, endi] = [idx('nome'), idx('telefone'), idx('email'), idx('endereco')]
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line)
      return {
        nome: ni >= 0 ? cols[ni] || '' : '',
        telefone: ti >= 0 ? cols[ti] || '' : '',
        email: ei >= 0 ? cols[ei] || '' : '',
        endereco: endi >= 0 ? cols[endi] || '' : '',
      }
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const all = parseCSV(text)
      const errors: string[] = []
      const valid = all.filter(r => r.telefone.replace(/\D/g, '').length >= 8)
      const skipped = all.length - valid.length
      if (all.length === 0) errors.push('Nenhuma linha encontrada. Verifique se o arquivo tem a coluna "telefone".')
      if (skipped > 0) errors.push(`${skipped} linha(s) sem telefone válido serão ignoradas.`)
      setImportRows(valid)
      setImportErrors(errors)
      setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function handleImport() {
    if (!importRows.length) return
    setImportLoading(true)
    try {
      const { data: existingLeads } = await supabase.from('leads').select('phone').eq('institution_id', institutionId).is('deleted_at', null)
      const existingPhones = new Set((existingLeads || []).map(l => (l.phone || '').replace(/\D/g, '')))
      const seen = new Set<string>()
      let duplicates = 0
      const toInsert: object[] = []
      for (const r of importRows) {
        const phone = r.telefone.replace(/\D/g, '')
        if (!phone || seen.has(phone) || existingPhones.has(phone)) { duplicates++; continue }
        seen.add(phone)
        toInsert.push({ institution_id: institutionId, student_name: r.nome || null, responsible_name: r.nome || null, phone, email: r.email || null, status: 'novo' })
      }
      let imported = 0
      if (toInsert.length > 0) {
        const { data, error } = await supabase.from('leads').insert(toInsert).select('id')
        if (error) { setImportErrors([error.message]); setImportLoading(false); return }
        imported = data?.length || 0
      }
      setImportResult({ imported, duplicates })
      if (imported > 0) load()
    } catch (e: any) {
      setImportErrors([e.message || 'Erro desconhecido'])
    } finally {
      setImportLoading(false)
    }
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
      (filterOrigin === 'lead'    && c.has_lead) ||
      (filterOrigin === 'client'  && c.contact_type === 'client') ||
      (filterOrigin === 'unknown' && !c.has_lead && c.contact_type !== 'client')
    const matchGrade     = filterGrade     === 'all' || c.grade              === filterGrade
    const matchAttendant = filterAttendant === 'all' || c.assigned_user_name === filterAttendant
    return matchSearch && matchOrigin && matchGrade && matchAttendant
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // KPIs
  const kpis = [
    { label: 'Total',    value: contacts.length,                                                    icon: '👥', color: 'text-[#3B82F6]', bg: 'bg-[#EFF6FF]' },
    { label: 'Leads',    value: contacts.filter(c => c.contact_type === 'lead').length,             icon: '🎯', color: 'text-[#7C3AED]', bg: 'bg-[#EDE9FE]' },
    { label: 'Clientes', value: contacts.filter(c => c.contact_type === 'client').length,           icon: '🏫', color: 'text-[#065F46]', bg: 'bg-[#D1FAE5]' },
    { label: 'WhatsApp', value: contacts.filter(c => !c.contact_type).length,                      icon: '💬', color: 'text-[#D97706]', bg: 'bg-[#FEF3C7]' },
  ]

  const openImport = () => { setShowImport(true); setImportRows([]); setImportErrors([]); setImportResult(null) }

  const importModal = showImport ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setShowImport(false) }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A2B4A' }}>Importar contatos</h2>
          <button onClick={() => setShowImport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        <button onClick={downloadTemplate}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1.5px dashed #CBD5E1', background: '#F8FAFC', color: '#475569', fontSize: 13, cursor: 'pointer', marginBottom: 16, width: '100%', boxSizing: 'border-box' }}>
          <FileText size={16} color="#3B82F6" /> Download template CSV (nome, telefone, email, endereco)
        </button>

        <label style={{ display: 'block', marginBottom: 16, cursor: 'pointer' }}>
          <div style={{ border: '2px dashed #CBD5E1', borderRadius: 10, padding: '24px', textAlign: 'center', background: '#F8FAFC' }}>
            <Upload size={24} color="#94A3B8" style={{ display: 'block', margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: 13, color: '#64748B', fontWeight: 500 }}>Clique para selecionar arquivo CSV</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#CBD5E1' }}>Formato: .csv com cabeçalho na primeira linha</p>
          </div>
          <input type="file" accept=".csv" onChange={handleFileChange} style={{ display: 'none' }} />
        </label>

        {importErrors.length > 0 && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            {importErrors.map((err, i) => <p key={i} style={{ margin: i > 0 ? '4px 0 0' : 0, fontSize: 12, color: '#DC2626' }}>{err}</p>)}
          </div>
        )}

        {importRows.length > 0 && !importResult && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A', margin: '0 0 8px' }}>{importRows.length} contato(s) válido(s) — pré-visualização:</p>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 8, maxHeight: 220, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', position: 'sticky', top: 0 }}>
                    {['Nome', 'Telefone', 'E-mail', 'Endereço'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: '#94A3B8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importRows.slice(0, 10).map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '7px 12px', color: '#1A2B4A' }}>{r.nome || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.telefone}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.email || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.endereco || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    </tr>
                  ))}
                  {importRows.length > 10 && (
                    <tr><td colSpan={4} style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>...e mais {importRows.length - 10} linha(s)</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <button onClick={handleImport} disabled={importLoading}
              style={{ marginTop: 12, width: '100%', padding: '12px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: importLoading ? 'not-allowed' : 'pointer', opacity: importLoading ? 0.7 : 1 }}>
              {importLoading ? 'Importando...' : `Importar ${importRows.length} contatos`}
            </button>
          </div>
        )}

        {importResult && (
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#065F46' }}>✅ {importResult.imported} importado(s)</p>
            {importResult.duplicates > 0 && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>{importResult.duplicates} duplicata(s) ignorada(s)</p>}
            <button onClick={() => setShowImport(false)}
              style={{ marginTop: 16, padding: '9px 24px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null

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

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const originFilters = [
      { value: 'all',     label: 'Todos' },
      { value: 'lead',    label: 'Leads' },
      { value: 'client',  label: 'Clientes' },
      { value: 'unknown', label: 'Novos' },
    ]
    return (
      <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#f8f9fb' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 0', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookUser size={16} color="#3B82F6" />
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Contatos</h1>
          <span style={{ background: '#EFF6FF', color: '#3B82F6', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999 }}>{contacts.length}</span>
          <button onClick={openImport}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', padding: '6px 12px', borderRadius: 9, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <Upload size={13} /> Importar
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar contato..."
              style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 16, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Origin filter chips */}
        <div style={{ padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
          {originFilters.map(({ value, label }) => (
            <button key={value} onClick={() => setFilterOrigin(value)}
              style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: filterOrigin === value ? '#3B82F6' : '#F0F9FF',
                color: filterOrigin === value ? '#fff' : '#64748B' }}>
              {label}
            </button>
          ))}
        </div>

        {/* KPIs 2x2 */}
        <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{k.icon}</span>
              <div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Contact list */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 10, background: '#fff', borderTop: '1px solid #F1F5F9' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><p style={{ fontSize: 13, color: '#94A3B8' }}>Carregando...</p></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><p style={{ fontSize: 13, color: '#94A3B8' }}>Nenhum contato encontrado</p></div>
          ) : filtered.map(c => {
            const color = hexColor(c.name)
            const hasLead = c.has_lead
            const hasWa = c.has_whatsapp
            const originBg = hasLead && hasWa ? '#D1FAE5' : hasLead ? '#EDE9FE' : '#DBEAFE'
            const originColor = hasLead && hasWa ? '#065F46' : hasLead ? '#7C3AED' : '#1D4ED8'
            const originLabel = hasLead && hasWa ? 'Ambos' : hasLead ? 'Lead' : 'WhatsApp'
            return (
              <div key={c.id} onClick={() => setProfileContact(c)}
                style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>
                  {initials(c.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{c.name}</p>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: originBg, color: originColor, flexShrink: 0, marginLeft: 6 }}>{originLabel}</span>
                  </div>
                  {(c.student_name || c.grade) && (
                    <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[c.student_name, c.grade].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {c.phone && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{c.phone}</p>}
                </div>
                <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>
      {importModal}
      </>
    )
  }

  return (
    <>
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
          <button onClick={openImport}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
            <Upload size={14} /> Importar CSV
          </button>
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16 }}>
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
          <option value="all">Todos os tipos</option>
          <option value="lead">Leads</option>
          <option value="client">Clientes</option>
          <option value="unknown">Desconhecidos</option>
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
            {isMobile ? (
              /* ── Mobile: cards ── */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pageItems.map(c => {
                  const color  = hexColor(c.name)
                  const origin = typeCfg(c.contact_type)
                  return (
                    <div key={c.id} onClick={() => setProfileContact(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                        {initials(c.name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{c.name}</p>
                          <span style={{ ...origin.badgeStyle, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999 }}>{origin.label}</span>
                        </div>
                        {c.student_name && <p style={{ fontSize: 12, color: '#64748b', margin: '1px 0 0' }}>{c.student_name}</p>}
                        {c.phone && <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={11} />{c.phone}</p>}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{fmtDate(c.last_contact)}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              /* ── Desktop: tabela ── */
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
                    const origin = typeCfg(c.contact_type)
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
            )}

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
    {importModal}
    </>
  )
}
