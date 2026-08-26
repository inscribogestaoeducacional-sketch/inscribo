import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { normalizeBrazilianInput } from '../../lib/phone'
import * as XLSX from 'xlsx'
import {
  Users, BookUser, Search, Phone, Download, Upload, FileText, Plus,
  RefreshCw, MessageSquare, ChevronsUpDown, ChevronUp, ChevronDown, ChevronRight,
  GitMerge, Settings2, Trash2, Tag as TagIcon, X, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react'
import ContactProfile, { UnifiedContact } from './ContactProfile'
import { useGradeLevels } from '../../hooks/useGradeLevels'
import { statusConfig } from '../leads/leadFormShared'
import DuplicateContactsModal from './DuplicateContactsModal'
import CustomFieldsAdminModal from './CustomFieldsAdminModal'

// ─── Constants ───────────────────────────────────────────────
const HEX_COLORS = ['#00A896','#3B82F6','#8B5CF6','#F97316','#EF4444','#10B981','#F59E0B','#EC4899']
const PAGE_SIZE  = 50
// PostgREST limita a resposta a um número fixo de linhas por requisição
// (tipicamente 1000). Exportar sem paginar cortava o CSV em silêncio pra
// escolas com mais contatos que isso — busca em lotes desse tamanho até
// esgotar os resultados (ver fetchAllContactsForExport).
const EXPORT_BATCH_SIZE = 1000
// Item 4c — lista de séries antes hardcoded aqui (divergente do resto do
// sistema); agora vem de school_grade_levels via useGradeLevels().

const EXPORT_FIELD_DEFS = [
  { key: 'responsible_name', label: 'Nome do responsável' },
  { key: 'student_name',     label: 'Nome do aluno'       },
  { key: 'phone',            label: 'Telefone'            },
  { key: 'email',            label: 'E-mail'              },
  { key: 'grade',            label: 'Série'               },
  { key: 'type',             label: 'Tipo'                },
  { key: 'tags',             label: 'Etiquetas'           },
  { key: 'last_contact',     label: 'Último contato'      },
  { key: 'created_at',       label: 'Adicionado em'       },
  { key: 'status',           label: 'Status do lead'      },
] as const
type ExportFieldKey = typeof EXPORT_FIELD_DEFS[number]['key']

// Import CSV — contato só (whatsapp_contacts, type:'client'), nunca cria lead
// (import em massa não implica intenção comercial nova — ver ContactProfile
// "Converter para Lead" pra quando isso fizer sentido individualmente).
interface ImportRow {
  nome: string; telefone: string; email: string; endereco: string
  aluno: string; turma: string; parentesco: string; tags: string
}

// ─── Helpers ─────────────────────────────────────────────────
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

function formatPhone(digits: string): string {
  const d = digits.replace(/^55/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return digits
}

function fmtDate(s: string): string {
  const d    = new Date(s)
  const diff = Date.now() - d.getTime()
  if (diff < 86400000)     return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diff < 7 * 86400000) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtCreated(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtFull(s: string | null | undefined): string {
  if (!s) return ''
  return new Date(s).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function typeCfg(type: string | null) {
  if (type === 'lead')     return { label: 'Lead',       badgeStyle: { background: '#EDE9FE', color: '#7C3AED' } }
  if (type === 'client')   return { label: 'Cliente',    badgeStyle: { background: '#D1FAE5', color: '#065F46' } }
  if (type === 'supplier') return { label: 'Fornecedor', badgeStyle: { background: '#DBEAFE', color: '#1D4ED8' } }
  if (type === 'other')    return { label: 'Outro',      badgeStyle: { background: '#F1F5F9', color: '#64748B' } }
  return                          { label: 'WhatsApp',   badgeStyle: { background: '#FEF3C7', color: '#D97706' } }
}

function mapContact(c: any): UnifiedContact {
  const lead     = c.leads as any || null
  const rawPhone = (c.phone || '').replace(/\D/g, '')
  const fmtPhone = rawPhone ? formatPhone(rawPhone) : (c.phone || null)
  const cfg      = typeCfg(c.type)
  const mainName =
    lead?.responsible_name?.trim() ||
    c.name?.trim()                 ||
    lead?.student_name?.trim()     ||
    fmtPhone                       ||
    'Desconhecido'
  // Sem lead, mas com aluno vinculado (import de contato client): mostra
  // "Aluno: X" no lugar do telefone — mais útil que repetir o telefone que
  // já aparece na coluna ao lado (mesmo raciocínio do bug de endereço: dado
  // guardado mas nunca mostrado em lugar nenhum).
  const subtitle =
    lead?.responsible_name?.trim()
      ? (lead?.student_name?.trim() || '')
      : c.name?.trim()
        ? (c.linked_student_name?.trim() ? `Aluno: ${c.linked_student_name.trim()}` : (fmtPhone || ''))
        : ''
  return {
    id:                  c.id,
    name:                mainName,
    student_name:        lead?.student_name || null,
    subtitle:            subtitle || null,
    phone:               fmtPhone,
    email:               lead?.email || c.email || null,
    address:             lead?.address || c.address || null,
    linked_student_name: c.linked_student_name || null,
    student_grade:       c.student_grade || null,
    relationship:        c.relationship || null,
    grade:               lead?.grade_interest || null,
    source:              lead?.source || null,
    status_lead:         lead?.status || null,
    status_whatsapp:     null,
    has_lead:            !!c.lead_id,
    has_whatsapp:        true,
    lead_id:             c.lead_id || null,
    remote_jid:          rawPhone ? `${rawPhone}@s.whatsapp.net` : null,
    contact_type:        c.type === 'unknown' ? null : (c.type || null),
    assigned_user_name:  null,
    tags:                c.tags || [],
    last_contact:        c.last_seen_at || c.created_at || new Date().toISOString(),
    profile_picture_url: c.profile_picture_url || null,
    created_at:          c.created_at || null,
    origin_label:        cfg.label,
    origin_color:        '',
    origin_bg:           '',
    transfer_status:     null,
  }
}

// ─── ContactAvatar ───────────────────────────────────────────
function ContactAvatar({
  name, url, size = 36, onClick,
}: {
  name: string; url?: string | null; size?: number; onClick?: () => void
}) {
  const [err, setErr] = useState(false)
  const color = hexColor(name)
  if (url && !err) {
    return (
      <img
        src={url} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, cursor: onClick ? 'zoom-in' : 'default' }}
        onError={() => setErr(true)}
        onClick={e => { e.stopPropagation(); onClick?.() }}
      />
    )
  }
  return (
    <div
      style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: Math.round(size * 0.33), fontWeight: 700, flexShrink: 0 }}
      onClick={e => { e.stopPropagation() }}
    >
      {initials(name)}
    </div>
  )
}

// ─── SortIcon ────────────────────────────────────────────────
function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: 'asc' | 'desc' }) {
  if (sortCol !== col) return <ChevronsUpDown size={12} color="#CBD5E1" style={{ flexShrink: 0 }} />
  return sortDir === 'asc'
    ? <ChevronUp   size={12} color="#3B82F6" style={{ flexShrink: 0 }} />
    : <ChevronDown size={12} color="#3B82F6" style={{ flexShrink: 0 }} />
}

// ─── Skeleton rows ───────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
          <td style={{ padding: '12px 12px' }}>
            <div className="animate-pulse" style={{ width: 16, height: 16, borderRadius: 4, background: '#E2E8F0' }} />
          </td>
          <td style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="animate-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: '#E2E8F0', flexShrink: 0 }} />
              <div>
                <div className="animate-pulse" style={{ width: 140, height: 11, background: '#E2E8F0', borderRadius: 6, marginBottom: 5 }} />
                <div className="animate-pulse" style={{ width: 90, height: 9, background: '#F1F5F9', borderRadius: 6 }} />
              </div>
            </div>
          </td>
          {[90, 70, 60, 80, 90, 100].map((w, j) => (
            <td key={j} style={{ padding: '12px 16px' }}>
              <div className="animate-pulse" style={{ width: w, height: 11, background: '#E2E8F0', borderRadius: 6 }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ─── Main component ──────────────────────────────────────────
export default function ContactsModule() {
  const { user }       = useAuth()
  const institutionId  = user?.institution_id!
  const { names: GRADES_LIST } = useGradeLevels(institutionId)
  const schoolName     = (user as any)?.institution_name || ''
  const navigate       = useNavigate()
  const mountedRef     = useRef(true)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // ── Data state ───────────────────────────────────────────
  const [contacts,    setContacts]    = useState<UnifiedContact[]>([])
  const [total,       setTotal]       = useState(0)
  const [offset,      setOffset]      = useState(0)
  const [hasMore,     setHasMore]     = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [kpiCounts,   setKpiCounts]   = useState({ total: 0, lead: 0, client: 0, unknown: 0 })

  // ── Filter / sort state ──────────────────────────────────
  const [search,       setSearch]       = useState('')
  const [filterOrigin, setFilterOrigin] = useState('all')
  const [filterGrade,  setFilterGrade]  = useState('all')
  const [filterTag,    setFilterTag]    = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortCol,      setSortCol]      = useState('created_at')
  const [sortDir,      setSortDir]      = useState<'asc' | 'desc'>('desc')

  // ── UI state ─────────────────────────────────────────────
  const [profileContact,  setProfileContact]  = useState<UnifiedContact | null>(null)
  const [zoomedPhoto,     setZoomedPhoto]     = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportFields,    setExportFields]    = useState<Record<ExportFieldKey, boolean>>({
    responsible_name: true, student_name: true, phone: true, email: true,
    grade: true, type: true, tags: true, last_contact: true, created_at: true, status: true,
  })
  const [exportFilterOrigin, setExportFilterOrigin] = useState('all')
  const [exportFilterStatus, setExportFilterStatus] = useState('all')
  const [exportFilterGrade,  setExportFilterGrade]  = useState('all')
  const [exportSearch,       setExportSearch]       = useState('')
  const [exportCount,        setExportCount]        = useState(0)
  const [exportFetching,     setExportFetching]     = useState(false)
  const [exportLoading,      setExportLoading]      = useState(false)
  const [exportProgress,     setExportProgress]     = useState(0)
  const [availTagsFilter,    setAvailTagsFilter]    = useState<{ id: string; name: string; color: string }[]>([])

  // ── Import state ─────────────────────────────────────────
  const [showImport,    setShowImport]    = useState(false)
  const [importRows,    setImportRows]    = useState<ImportRow[]>([])
  const [importErrors,  setImportErrors]  = useState<string[]>([])
  const [importResult,  setImportResult]  = useState<{ imported: number; duplicates: number } | null>(null)
  const [importLoading, setImportLoading] = useState(false)

  // ── Seleção em massa (item 3) — mesmo padrão de AdminAionInbox.tsx ───────
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set())
  const [selectedAllFilter,  setSelectedAllFilter]  = useState(false)
  const [selectingAllFilter, setSelectingAllFilter] = useState(false)
  const [showBulkTagModal,   setShowBulkTagModal]   = useState(false)
  const [bulkTagNames,       setBulkTagNames]       = useState<string[]>([])
  const [bulkTagSaving,      setBulkTagSaving]      = useState(false)
  const [showBulkDelete,     setShowBulkDelete]     = useState(false)
  const [checkingBulkDelete, setCheckingBulkDelete] = useState(false)
  const [bulkDeleting,       setBulkDeleting]       = useState(false)
  const [bulkRelatedInfo,    setBulkRelatedInfo]    = useState<{ leadCount: number; conversationCount: number; noteCount: number } | null>(null)

  // ── Duplicados / Campos personalizados (itens 1 e 2) ─────────────────────
  const [showDuplicates,   setShowDuplicates]   = useState(false)
  const [showCustomFields, setShowCustomFields] = useState(false)

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  function showToast(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3500) }

  // ── New contact (manual, 1-a-1) state ────────────────────
  const [showNewContact,   setShowNewContact]   = useState(false)
  const [newContact,       setNewContact]       = useState({
    name: '', phone: '', email: '', address: '', linked_student_name: '', student_grade: '', relationship: '',
  })
  const [newContactTags,   setNewContactTags]   = useState<string[]>([])
  const [savingNewContact, setSavingNewContact] = useState(false)
  const [newContactError,  setNewContactError]  = useState('')

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setSearch(q)
  }, [searchParams])

  // Skip-first refs — prevent double-load on mount
  const skipFiltersRef = useRef(true)
  const skipSearchRef  = useRef(true)

  // Latest filter values for real-time handler (avoids stale closure)
  const filterStateRef = useRef({
    origin: 'all', search: '', grade: 'all', tag: 'all', status: 'all',
    sortCol: 'created_at', sortDir: 'desc' as 'asc' | 'desc',
  })
  filterStateRef.current = { origin: filterOrigin, search, grade: filterGrade, tag: filterTag, status: filterStatus, sortCol, sortDir }

  // ── KPI counts (global, unfiltered) ─────────────────────
  async function refreshKpiCounts() {
    if (!institutionId || !mountedRef.current) return
    const [t, l, c, u] = await Promise.all([
      supabase.from('whatsapp_contacts').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId),
      supabase.from('whatsapp_contacts').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('type', 'lead'),
      supabase.from('whatsapp_contacts').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).eq('type', 'client'),
      supabase.from('whatsapp_contacts').select('*', { count: 'exact', head: true }).eq('institution_id', institutionId).or('type.eq.unknown,type.is.null'),
    ])
    if (mountedRef.current) {
      setKpiCounts({ total: t.count || 0, lead: l.count || 0, client: c.count || 0, unknown: u.count || 0 })
    }
  }

  // ── Load available tags for filter dropdown ──────────────
  async function loadFilterTags() {
    try {
      const { data } = await supabase
        .from('whatsapp_tags')
        .select('id, name, color')
        .eq('institution_id', institutionId)
        .order('name')
      if (mountedRef.current && data) setAvailTagsFilter(data as { id: string; name: string; color: string }[])
    } catch (e) { /* tags filter is optional */ }
  }

  // ── Data loading ─────────────────────────────────────────
  async function load(params: {
    reset?:  boolean
    search?: string
    origin?: string
    grade?:  string
    tag?:    string
    status?: string
    sc?:     string
    sd?:     'asc' | 'desc'
    from?:   number
  } = {}) {
    const {
      reset  = true,
      search: s = search,
      origin    = filterOrigin,
      grade     = filterGrade,
      tag       = filterTag,
      status    = filterStatus,
      sc        = sortCol,
      sd        = sortDir,
      from: fromArg,
    } = params

    if (!mountedRef.current) return
    if (!institutionId) {
      console.error('Contacts load: institutionId is undefined — skipping')
      if (reset) setLoading(false)
      return
    }

    const from = fromArg ?? (reset ? 0 : offset)
    const to   = from + PAGE_SIZE - 1

    if (reset) { setLoading(true); setContacts([]) }
    else         setLoadingMore(true)

    try {
      const isSearch       = s.trim().length >= 2
      const useGrade       = grade  !== 'all'
      const useTag         = tag    !== 'all'
      const useStatus      = status !== 'all'
      const needsInnerJoin = useGrade || useStatus

      const selectStr = needsInnerJoin
        ? 'id, phone, name, email, address, linked_student_name, student_grade, relationship, profile_picture_url, type, lead_id, last_seen_at, created_at, tags, leads!lead_id!inner(id, student_name, responsible_name, email, address, grade_interest, source, status)'
        : 'id, phone, name, email, address, linked_student_name, student_grade, relationship, profile_picture_url, type, lead_id, last_seen_at, created_at, tags, leads!lead_id(id, student_name, responsible_name, email, address, grade_interest, source, status)'

      let query = supabase
        .from('whatsapp_contacts')
        .select(selectStr, { count: 'exact' })
        .eq('institution_id', institutionId)
        .not('phone', 'ilike', '%@g.us%')
        .filter('phone', 'not.ilike', '%1491304248%')
        .range(from, to)
        .order(sc, { ascending: sd === 'asc', nullsFirst: false })

      // Item 5 — filtro por turma sem UI nova: a mesma busca já cobre
      // student_grade (texto livre, direto em whatsapp_contacts, sem o
      // custo de um inner join como o filtro de série faz pra grade_interest
      // abaixo). "Ver só os contatos do 6º ano B" = digitar isso na busca.
      if (isSearch)             query = query.or(`name.ilike.%${s.trim()}%,phone.ilike.%${s.trim()}%,student_grade.ilike.%${s.trim()}%`)
      if (origin === 'lead')    query = query.eq('type', 'lead')
      if (origin === 'client')  query = query.eq('type', 'client')
      if (origin === 'unknown') query = query.or('type.eq.unknown,type.is.null')
      if (useGrade)             query = query.eq('leads.grade_interest', grade)
      if (useStatus)            query = query.eq('leads.status', status)
      if (useTag)               query = (query as any).filter('tags', 'cs', `{"${tag}"}`)

      const { data, error, count } = await query

      if (!mountedRef.current) return
      if (error) {
        console.error('Contacts query error:', JSON.stringify(error))
        reset ? setLoading(false) : setLoadingMore(false)
        return
      }

      const validData  = (data || []).filter((c: any) =>
        c.phone &&
        c.phone.replace(/\D/g, '').length <= 13 &&
        !c.phone.includes('@g.us') &&
        !c.phone.includes('-')
      )
      const newList    = validData.map(mapContact)
      const newOffset  = from + newList.length
      const totalCount = count || 0

      if (reset) {
        setContacts(newList)
      } else {
        setContacts(prev => [...prev, ...newList])
      }
      setOffset(newOffset)
      setTotal(totalCount)
      setHasMore(newOffset < totalCount)
    } catch (e) {
      console.error('Contacts load exception:', e)
    } finally {
      if (mountedRef.current) { reset ? setLoading(false) : setLoadingMore(false) }
    }
  }

  // ── Seleção em massa (item 3) — mesmo padrão de AdminAionInbox.tsx ───────
  function toggleSelect(id: string) {
    setSelectedAllFilter(false)
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAllLoaded() {
    setSelectedAllFilter(false)
    setSelectedIds(prev => prev.size === contacts.length ? new Set() : new Set(contacts.map(c => c.id)))
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setSelectedAllFilter(false)
  }

  // Mesmos filtros de load() acima, mas sem paginação — só os IDs que batem,
  // pra "selecionar todos os N contatos deste filtro" (não só a página
  // carregada na tela).
  async function selectAllMatchingFilter() {
    if (!institutionId) return
    setSelectingAllFilter(true)
    try {
      const s = search.trim()
      const isSearch  = s.length >= 2
      const useGrade  = filterGrade  !== 'all'
      const useTag    = filterTag    !== 'all'
      const useStatus = filterStatus !== 'all'
      const needsInnerJoin = useGrade || useStatus

      const selectStr = needsInnerJoin ? 'id, leads!lead_id!inner(id)' : 'id, leads!lead_id(id)'
      let query = supabase
        .from('whatsapp_contacts')
        .select(selectStr)
        .eq('institution_id', institutionId)
        .not('phone', 'ilike', '%@g.us%')
        .filter('phone', 'not.ilike', '%1491304248%')

      if (isSearch)                    query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,student_grade.ilike.%${s}%`)
      if (filterOrigin === 'lead')     query = query.eq('type', 'lead')
      if (filterOrigin === 'client')   query = query.eq('type', 'client')
      if (filterOrigin === 'unknown')  query = query.or('type.eq.unknown,type.is.null')
      if (useGrade)                    query = query.eq('leads.grade_interest', filterGrade)
      if (useStatus)                   query = query.eq('leads.status', filterStatus)
      if (useTag)                      query = (query as any).filter('tags', 'cs', `{"${filterTag}"}`)

      const { data, error } = await query
      if (error) { console.error('selectAllMatchingFilter error:', error); return }
      setSelectedIds(new Set(((data as any[]) ?? []).map(c => c.id)))
      setSelectedAllFilter(true)
    } finally {
      setSelectingAllFilter(false)
    }
  }

  async function applyBulkTags() {
    if (bulkTagNames.length === 0 || selectedIds.size === 0) return
    setBulkTagSaving(true)
    try {
      const ids = Array.from(selectedIds)
      // "Selecionar todos do filtro" pode incluir ids que não estão
      // carregados em `contacts` — busca as tags atuais de todos direto do
      // banco (em lotes) em vez de depender só do que já está na tela.
      const tagsById = new Map<string, string[]>()
      const CHUNK = 200
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        const { data } = await supabase.from('whatsapp_contacts').select('id, tags').in('id', slice)
        for (const row of (data as { id: string; tags: string[] | null }[]) ?? []) {
          tagsById.set(row.id, row.tags ?? [])
        }
      }
      // Cada contato pode precisar de um valor de tags diferente (união com
      // o que já tinha) — não dá pra fazer isso num único UPDATE do
      // supabase-js sem RPC, então é um await por id (mesmo padrão do
      // AdminAionInbox.tsx).
      for (const id of ids) {
        const merged = Array.from(new Set([...(tagsById.get(id) ?? []), ...bulkTagNames]))
        await supabase.from('whatsapp_contacts').update({ tags: merged }).eq('id', id)
      }
      showToast(`Etiqueta(s) aplicada(s) a ${ids.length} contato(s).`)
      setShowBulkTagModal(false); setBulkTagNames([]); clearSelection()
      load({ reset: true })
    } catch (e: any) {
      showToast('Erro ao aplicar etiquetas: ' + (e?.message || 'tente novamente'), false)
    } finally {
      setBulkTagSaving(false)
    }
  }

  // Mesmo aviso de vínculos órfãos da exclusão individual (ContactProfile.tsx
  // openDeleteConfirm), agregado pros N contatos selecionados.
  async function openBulkDeleteConfirm() {
    setShowBulkDelete(true)
    setCheckingBulkDelete(true)
    try {
      const ids = Array.from(selectedIds)
      const rows: { id: string; phone: string | null; lead_id: string | null }[] = []
      const CHUNK = 200
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK)
        const { data } = await supabase.from('whatsapp_contacts').select('id, phone, lead_id').in('id', slice)
        rows.push(...(((data as any[]) ?? [])))
      }
      const leadCount = rows.filter(r => r.lead_id).length

      const { data: convs } = await supabase.from('whatsapp_conversations').select('remote_jid').eq('institution_id', institutionId)
      const convPhones = new Set((convs || []).map((c: any) => (c.remote_jid || '').split('@')[0]))
      const conversationCount = rows.filter(r => convPhones.has(normalizeBrazilianInput(r.phone || ''))).length

      // Mesmo contactRef de ContactProfile.tsx/mapContact: lead_id > remote_jid > id.
      const refs = rows.map(r => r.lead_id || (r.phone ? `${r.phone}@s.whatsapp.net` : null) || r.id).filter(Boolean) as string[]
      let noteCount = 0
      if (refs.length) {
        const { count } = await supabase.from('contact_notes').select('id', { count: 'exact', head: true })
          .eq('institution_id', institutionId).in('contact_ref_id', refs)
        noteCount = count || 0
      }
      setBulkRelatedInfo({ leadCount, conversationCount, noteCount })
    } catch (e) {
      console.error('openBulkDeleteConfirm error:', e)
      setBulkRelatedInfo({ leadCount: 0, conversationCount: 0, noteCount: 0 })
    } finally {
      setCheckingBulkDelete(false)
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      const ids = Array.from(selectedIds)
      const CHUNK = 200
      for (let i = 0; i < ids.length; i += CHUNK) {
        await supabase.from('whatsapp_contacts').delete().in('id', ids.slice(i, i + CHUNK))
      }
      showToast(`${ids.length} contato(s) excluído(s).`)
      setShowBulkDelete(false); setBulkRelatedInfo(null); clearSelection()
      load({ reset: true }); refreshKpiCounts()
    } catch (e: any) {
      showToast('Erro ao excluir: ' + (e?.message || 'tente novamente'), false)
    } finally {
      setBulkDeleting(false)
    }
  }

  // ── Mount: initial load + real-time subscription ─────────
  useEffect(() => {
    mountedRef.current = true
    load()
    refreshKpiCounts()
    loadFilterTags()

    const channel = supabase
      .channel('wc_module_rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_contacts', filter: `institution_id=eq.${institutionId}` },
        (payload) => {
          const fs = filterStateRef.current
          if (payload.eventType === 'INSERT') {
            const noFilters   = fs.origin === 'all' && fs.search.trim().length < 2 && fs.grade === 'all' && fs.tag === 'all' && fs.status === 'all'
            const defaultSort = fs.sortCol === 'created_at' && fs.sortDir === 'desc'
            if (noFilters && defaultSort) {
              setContacts(prev => [mapContact(payload.new), ...prev])
            }
            refreshKpiCounts()
          } else if (payload.eventType === 'UPDATE') {
            setContacts(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...mapContact(payload.new) } : c))
            refreshKpiCounts()
          } else if (payload.eventType === 'DELETE') {
            setContacts(prev => prev.filter(c => c.id !== payload.old.id))
            setTotal(prev => prev - 1)
            refreshKpiCounts()
          }
        }
      )
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Filter/sort change → immediate reload ─────────────────
  useEffect(() => {
    if (skipFiltersRef.current) { skipFiltersRef.current = false; return }
    load({ reset: true, search, origin: filterOrigin, grade: filterGrade, tag: filterTag, status: filterStatus, sc: sortCol, sd: sortDir })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterOrigin, filterGrade, filterTag, filterStatus, sortCol, sortDir])

  // ── Search change → debounced reload ─────────────────────
  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return }
    const t = setTimeout(() => {
      load({ reset: true, search, origin: filterOrigin, grade: filterGrade, tag: filterTag, status: filterStatus, sc: sortCol, sd: sortDir })
    }, 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // ── Export modal: live count ──────────────────────────────
  useEffect(() => {
    if (!showExportModal) return
    const timer = setTimeout(async () => {
      if (!mountedRef.current) return
      setExportFetching(true)
      try {
        const useGrade   = exportFilterGrade  !== 'all'
        const useStatus  = exportFilterStatus !== 'all'
        const needsInner = useGrade || useStatus
        const joinStr    = needsInner
          ? 'leads!lead_id!inner(grade_interest, status)'
          : 'leads!lead_id(grade_interest, status)'
        let q = supabase
          .from('whatsapp_contacts')
          .select(joinStr, { count: 'exact', head: true })
          .eq('institution_id', institutionId)
        if (exportSearch.trim().length >= 2)
          q = q.or(`name.ilike.%${exportSearch.trim()}%,phone.ilike.%${exportSearch.trim()}%`)
        if (exportFilterOrigin === 'lead')    q = q.eq('type', 'lead')
        if (exportFilterOrigin === 'client')  q = q.eq('type', 'client')
        if (exportFilterOrigin === 'unknown') q = q.or('type.eq.unknown,type.is.null')
        if (useGrade)  q = q.eq('leads.grade_interest', exportFilterGrade)
        if (useStatus) q = q.eq('leads.status', exportFilterStatus)
        const { count } = await q
        if (mountedRef.current) setExportCount(count || 0)
      } catch { /* ignore */ } finally {
        if (mountedRef.current) setExportFetching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showExportModal, exportFilterOrigin, exportFilterStatus, exportFilterGrade, exportSearch])

  // ── Handlers ─────────────────────────────────────────────
  function handleLoadMore() {
    if (loadingMore || !hasMore) return
    load({ reset: false, search, origin: filterOrigin, grade: filterGrade, tag: filterTag, status: filterStatus, sc: sortCol, sd: sortDir, from: offset })
  }

  function handleSortClick(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('desc') }
  }

  function clearFilters() {
    setSearch(''); setFilterOrigin('all'); setFilterGrade('all')
    setFilterTag('all'); setFilterStatus('all')
  }

  function handleProfileUpdate(id: string, updates: Record<string, any>) {
    if (updates.deleted) {
      setContacts(prev => prev.filter(c => c.id !== id))
      setTotal(prev => Math.max(0, prev - 1))
      setProfileContact(null)
      refreshKpiCounts()
      return
    }
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    if (profileContact?.id === id) setProfileContact(prev => prev ? { ...prev, ...updates } : prev)
  }

  // ── Import / Export ──────────────────────────────────────
  function downloadTemplate() {
    const csv  = '﻿' + 'nome,telefone,email,endereco,aluno,turma,parentesco,tags\n'
      + 'Maria Silva,83999998888,maria@email.com,"Rua X, 123",João Silva,6º Ano B,Mãe,Visitante|Cliente\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'template-contatos.csv'; a.click()
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

  function parseCSV(text: string): ImportRow[] {
    const lines  = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim())
    if (lines.length < 2) return []
    const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''))
    const idx    = (col: string) => header.indexOf(col)
    const [ni, ti, ei, endi, ai, tui, pi, tgi] = [
      idx('nome'), idx('telefone'), idx('email'), idx('endereco'),
      idx('aluno'), idx('turma'), idx('parentesco'), idx('tags'),
    ]
    return lines.slice(1).map(line => {
      const cols = parseCSVLine(line)
      return {
        nome:       ni   >= 0 ? cols[ni]   || '' : '',
        telefone:   ti   >= 0 ? cols[ti]   || '' : '',
        email:      ei   >= 0 ? cols[ei]   || '' : '',
        endereco:   endi >= 0 ? cols[endi] || '' : '',
        aluno:      ai   >= 0 ? cols[ai]   || '' : '',
        turma:      tui  >= 0 ? cols[tui]  || '' : '',
        parentesco: pi   >= 0 ? cols[pi]   || '' : '',
        tags:       tgi  >= 0 ? cols[tgi]  || '' : '',
      }
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text    = ev.target?.result as string
      const all     = parseCSV(text)
      const errors: string[] = []
      const valid   = all.filter(r => r.telefone.replace(/\D/g, '').length >= 8)
      const skipped = all.length - valid.length
      if (all.length === 0)  errors.push('Nenhuma linha encontrada. Verifique se o arquivo tem a coluna "telefone".')
      if (skipped > 0)       errors.push(`${skipped} linha(s) sem telefone válido serão ignoradas.`)
      setImportRows(valid); setImportErrors(errors); setImportResult(null)
    }
    reader.readAsText(file, 'utf-8')
  }

  // Import cria só o CONTATO (whatsapp_contacts, type:'client') — nunca um
  // lead. Import em massa (pais já matriculados, listas antigas etc.) não é
  // sinal de intenção comercial nova; quem precisar virar lead de verdade
  // usa "Converter para Lead" individualmente no perfil do contato
  // (ContactProfile.tsx:handleCreateLead). Dedup por institution_id+phone
  // direto em whatsapp_contacts (mesma unique constraint que o trigger de
  // sync via WhatsApp já usa em ON CONFLICT).
  async function handleImport() {
    if (!importRows.length) return
    setImportLoading(true)
    try {
      const { data: existingContacts } = await supabase
        .from('whatsapp_contacts').select('phone').eq('institution_id', institutionId)
      // Normaliza tanto os contatos existentes quanto os da planilha pro mesmo
      // formato canônico (com/sem 55, com/sem 9º dígito) antes de comparar —
      // senão "8388887777" e "5583988887777" são tratados como diferentes e
      // o mesmo contato acaba duplicado.
      const existingPhones = new Set((existingContacts || []).map(c => normalizeBrazilianInput(c.phone || '')).filter(Boolean))
      const seen = new Set<string>()
      let duplicates = 0
      const toInsert: object[] = []
      for (const r of importRows) {
        const phone = normalizeBrazilianInput(r.telefone)
        if (!phone || seen.has(phone) || existingPhones.has(phone)) { duplicates++; continue }
        seen.add(phone)
        toInsert.push({
          institution_id: institutionId,
          phone,
          name: r.nome || null,
          email: r.email || null,
          address: r.endereco || null,
          linked_student_name: r.aluno || null,
          student_grade: r.turma || null,
          relationship: r.parentesco || null,
          // Mesmo separador usado no template baixável e no export (pipe
          // evita conflito com nomes de tag que já tenham vírgula, o
          // delimitador do CSV) — padronizado nos dois sentidos, senão um
          // arquivo exportado por aqui não reimportava as tags de volta.
          tags: r.tags ? r.tags.split('|').map(t => t.trim()).filter(Boolean) : [],
          type: 'client',
        })
      }
      let imported = 0
      if (toInsert.length > 0) {
        const { data, error } = await supabase.from('whatsapp_contacts').insert(toInsert).select('id')
        if (error) { setImportErrors([error.message]); setImportLoading(false); return }
        imported = data?.length || 0
      }
      setImportResult({ imported, duplicates })
      if (imported > 0) { load(); refreshKpiCounts() }
    } catch (e: any) {
      setImportErrors([e.message || 'Erro desconhecido'])
    } finally {
      setImportLoading(false)
    }
  }

  // Criação manual de 1 contato. Mesma regra de dedup do import CSV: chave é
  // institution_id+phone (telefone normalizado) — nunca cria duplicata. Se já
  // existir um contato com esse telefone, abre o perfil dele em vez de
  // inserir de novo.
  async function handleSaveNewContact() {
    setNewContactError('')
    const phoneDigits = newContact.phone.replace(/\D/g, '')
    const phone = normalizeBrazilianInput(newContact.phone)
    if (!phone || phoneDigits.length < 8) {
      setNewContactError('Informe um telefone válido.')
      return
    }
    setSavingNewContact(true)
    try {
      // Mesmo select de load() (sem inner join) — já vem pronto pra virar
      // UnifiedContact via mapContact() se encontrar um contato existente.
      const { data: existing, error: existingErr } = await supabase
        .from('whatsapp_contacts')
        .select('id, phone, name, email, address, linked_student_name, student_grade, relationship, profile_picture_url, type, lead_id, last_seen_at, created_at, tags, leads!lead_id(id, student_name, responsible_name, email, address, grade_interest, source, status)')
        .eq('institution_id', institutionId)
        .eq('phone', phone)
        .maybeSingle()
      if (existingErr) throw existingErr

      if (existing) {
        setShowNewContact(false)
        setProfileContact(mapContact(existing))
        alert('Já existe um contato com esse telefone — abrindo o existente.')
        return
      }

      const { error: insertErr } = await supabase.from('whatsapp_contacts').insert({
        institution_id: institutionId,
        phone,
        name: newContact.name.trim() || null,
        email: newContact.email.trim() || null,
        address: newContact.address.trim() || null,
        linked_student_name: newContact.linked_student_name.trim() || null,
        student_grade: newContact.student_grade.trim() || null,
        relationship: newContact.relationship.trim() || null,
        tags: newContactTags,
        // Mesma convenção do import CSV manual: contato criado à mão vira
        // 'client', nunca lead (sem intenção comercial implícita).
        type: 'client',
      })
      if (insertErr) throw insertErr

      setShowNewContact(false)
      load()
      refreshKpiCounts()
    } catch (e: any) {
      console.error('handleSaveNewContact error:', e)
      setNewContactError(e.message || 'Erro ao criar contato.')
    } finally {
      setSavingNewContact(false)
    }
  }

  // Busca TODOS os contatos que batem com os filtros de exportação, em lotes
  // de EXPORT_BATCH_SIZE até esgotar os resultados — uma única query sem
  // .range() ficava sujeita ao limite padrão de linhas do PostgREST (~1000)
  // e cortava o export sem avisar em escolas com mais contatos que isso.
  // Compartilhada pelos dois formatos de export (CSV e XLSX) — só muda o
  // jeito de escrever o arquivo final, não como os dados são buscados.
  async function fetchAllContactsForExport(): Promise<UnifiedContact[]> {
    const useGrade   = exportFilterGrade  !== 'all'
    const useStatus  = exportFilterStatus !== 'all'
    const needsInner = useGrade || useStatus
    const selectStr  = needsInner
      ? 'id, phone, name, type, lead_id, last_seen_at, created_at, tags, leads!lead_id!inner(id, student_name, responsible_name, email, grade_interest, source, status)'
      : 'id, phone, name, type, lead_id, last_seen_at, created_at, tags, leads!lead_id(id, student_name, responsible_name, email, grade_interest, source, status)'

    const allRows: any[] = []
    let from = 0
    while (true) {
      let q = supabase
        .from('whatsapp_contacts')
        .select(selectStr)
        .eq('institution_id', institutionId)
        .order(sortCol, { ascending: sortDir === 'asc', nullsFirst: false })
        .range(from, from + EXPORT_BATCH_SIZE - 1)

      if (exportSearch.trim().length >= 2)
        q = q.or(`name.ilike.%${exportSearch.trim()}%,phone.ilike.%${exportSearch.trim()}%`)
      if (exportFilterOrigin === 'lead')    q = q.eq('type', 'lead')
      if (exportFilterOrigin === 'client')  q = q.eq('type', 'client')
      if (exportFilterOrigin === 'unknown') q = q.or('type.eq.unknown,type.is.null')
      if (useGrade)  q = q.eq('leads.grade_interest', exportFilterGrade)
      if (useStatus) q = q.eq('leads.status', exportFilterStatus)

      const { data, error } = await q
      if (error) throw error

      allRows.push(...(data || []))
      if (mountedRef.current) setExportProgress(allRows.length)

      if (!data || data.length < EXPORT_BATCH_SIZE) break
      from += EXPORT_BATCH_SIZE
    }

    return allRows.map(mapContact)
  }

  async function exportContacts(format: 'csv' | 'xlsx') {
    const active = EXPORT_FIELD_DEFS.filter(f => exportFields[f.key])
    if (!active.length) { alert('Selecione ao menos um campo.'); return }

    setExportLoading(true)
    setExportProgress(0)
    try {
      const allContacts = await fetchAllContactsForExport()
      const fieldGetters: Record<ExportFieldKey, (c: UnifiedContact) => string> = {
        responsible_name: c => c.name,
        student_name:     c => c.student_name || '',
        phone:            c => c.phone || '',
        email:            c => c.email || '',
        grade:            c => c.grade || '',
        type:             c => c.origin_label,
        // Mesmo separador do import CSV (handleImport: split('|')) — antes
        // era '; ', então um arquivo exportado por aqui nunca reimportava as
        // tags corretas de volta (round-trip quebrado).
        tags:             c => (c.tags || []).join('|'),
        last_contact:     c => fmtDate(c.last_contact),
        created_at:       c => fmtCreated(c.created_at),
        status:           c => c.status_lead || '',
      }
      const header = active.map(f => f.label)
      const rows   = allContacts.map(c => active.map(f => fieldGetters[f.key](c)))

      if (format === 'xlsx') {
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Contatos')
        XLSX.writeFile(wb, 'contatos.xlsx')
      } else {
        const csvHeader = header.join(',')
        const csvRows   = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        const csv  = '﻿' + [csvHeader, ...csvRows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a'); a.href = url; a.download = 'contatos.csv'; a.click()
        URL.revokeObjectURL(url)
      }
      setShowExportModal(false)
    } catch (e) {
      console.error('exportContacts exception:', e)
      alert('Erro ao exportar. Tente novamente.')
    } finally {
      if (mountedRef.current) setExportLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────
  const grades     = [...new Set(contacts.map(c => c.grade).filter(Boolean))] as string[]
  const hasFilters = !!(search || filterOrigin !== 'all' || filterGrade !== 'all' || filterTag !== 'all' || filterStatus !== 'all')
  const openImport = () => { setShowImport(true); setImportRows([]); setImportErrors([]); setImportResult(null) }
  const openNewContact = () => {
    setNewContact({ name: '', phone: '', email: '', address: '', linked_student_name: '', student_grade: '', relationship: '' })
    setNewContactTags([])
    setNewContactError('')
    setShowNewContact(true)
  }
  const openExport = () => {
    setExportFilterOrigin('all'); setExportFilterStatus('all')
    setExportFilterGrade('all'); setExportSearch('')
    setExportProgress(0)
    setShowExportModal(true)
  }

  const kpiDefs = [
    { label: 'Total',    count: kpiCounts.total,   filterVal: 'all',     icon: '👥', activeColor: '#3B82F6', activeBg: '#DBEAFE', idleBg: '#EFF6FF' },
    { label: 'Leads',    count: kpiCounts.lead,    filterVal: 'lead',    icon: '🎯', activeColor: '#7C3AED', activeBg: '#C4B5FD', idleBg: '#EDE9FE' },
    { label: 'Clientes', count: kpiCounts.client,  filterVal: 'client',  icon: '🏫', activeColor: '#065F46', activeBg: '#A7F3D0', idleBg: '#D1FAE5' },
    { label: 'WhatsApp', count: kpiCounts.unknown, filterVal: 'unknown', icon: '💬', activeColor: '#D97706', activeBg: '#FDE68A', idleBg: '#FEF3C7' },
  ]

  // ── Sortable header ───────────────────────────────────────
  const SortTh = ({ col, label }: { col: string; label: string }) => (
    <th
      onClick={() => handleSortClick(col)}
      style={{ background: '#f8fafc', padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: sortCol === col ? '#3B82F6' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label}
        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
      </div>
    </th>
  )

  // ── Empty state ───────────────────────────────────────────
  const EmptyState = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12, textAlign: 'center' }}>
      <Users size={48} color="#E2E8F0" />
      <p style={{ fontSize: 15, color: '#94a3b8', margin: 0, fontWeight: 500 }}>
        {contacts.length === 0 && !hasFilters
          ? 'Nenhum contato ainda'
          : search
            ? `Nenhum resultado para "${search}"`
            : 'Nenhum contato encontrado'}
      </p>
      {contacts.length === 0 && !hasFilters && (
        <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0, maxWidth: 280 }}>
          Os contatos aparecem aqui quando leads ou conversas WhatsApp forem registrados.
        </p>
      )}
      {hasFilters && (
        <button onClick={clearFilters} style={{ marginTop: 4, padding: '7px 18px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
          Limpar filtros
        </button>
      )}
    </div>
  )

  // ── Load more footer ──────────────────────────────────────
  const LoadMoreFooter = () => (
    <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' }}>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
        Mostrando {contacts.length} de {total} contatos
      </p>
      {hasMore && (
        <button
          onClick={handleLoadMore} disabled={loadingMore}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 18px', border: '1px solid #e2e8f0', borderRadius: 9, background: '#fff', color: '#64748b', fontSize: 13, cursor: loadingMore ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loadingMore ? 0.6 : 1 }}
        >
          {loadingMore
            ? <><div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid #94a3b8', borderTopColor: 'transparent', borderRadius: '50%' }} /> Carregando...</>
            : `Carregar mais ${Math.min(PAGE_SIZE, total - contacts.length)}`}
        </button>
      )}
    </div>
  )

  // ── Modals ────────────────────────────────────────────────

  // Profile modal (overlay, not full-page replacement)
  const profileModal = profileContact ? (
    <ContactProfile
      contact={profileContact}
      institutionId={institutionId}
      onClose={() => setProfileContact(null)}
      onUpdate={(id, updates) => handleProfileUpdate(id, updates)}
    />
  ) : null

  // Import modal
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
          <FileText size={16} color="#3B82F6" /> Download template CSV (nome, telefone, email, endereco, aluno, turma, parentesco, tags)
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
                    {['Nome', 'Telefone', 'E-mail', 'Endereço', 'Aluno', 'Turma', 'Parentesco', 'Tags'].map(h => (
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
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.aluno || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.turma || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.parentesco || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                      <td style={{ padding: '7px 12px', color: '#475569' }}>{r.tags || <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    </tr>
                  ))}
                  {importRows.length > 10 && (
                    <tr><td colSpan={8} style={{ padding: '8px 12px', color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>...e mais {importRows.length - 10} linha(s)</td></tr>
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
            <button onClick={() => setShowImport(false)} style={{ marginTop: 16, padding: '9px 24px', background: '#065F46', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  ) : null

  // Export modal with independent filters + field checkboxes
  const exportModal = showExportModal ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setShowExportModal(false) }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1A2B4A' }}>Exportar contatos</h2>
          <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        {/* ── Filtros independentes ── */}
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Filtros de exportação</p>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <Search size={13} color="#94A3B8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={exportSearch} onChange={e => setExportSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            style={{ width: '100%', padding: '8px 12px 8px 30px', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select value={exportFilterOrigin} onChange={e => setExportFilterOrigin(e.target.value)}
            style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, padding: '8px 10px', outline: 'none', color: '#1A2B4A' }}>
            <option value="all">Todos os tipos</option>
            <option value="lead">Leads</option>
            <option value="client">Clientes</option>
            <option value="unknown">Desconhecidos</option>
          </select>
          <select value={exportFilterStatus} onChange={e => setExportFilterStatus(e.target.value)}
            style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, padding: '8px 10px', outline: 'none', color: '#1A2B4A' }}>
            <option value="all">Todos os status</option>
            {Object.entries(statusConfig).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
          </select>
        </div>
        <select value={exportFilterGrade} onChange={e => setExportFilterGrade(e.target.value)}
          style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: 9, fontSize: 13, padding: '8px 10px', outline: 'none', color: '#1A2B4A', marginBottom: 10, boxSizing: 'border-box' }}>
          <option value="all">Todas as séries</option>
          {GRADES_LIST.map(g => <option key={g} value={g}>{g}</option>)}
        </select>

        {/* ── Contador ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F0FDFA', borderRadius: 9, marginBottom: 18, border: '1px solid #CCFBF1' }}>
          {exportFetching && (
            <div className="animate-spin" style={{ width: 12, height: 12, border: '2px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', flexShrink: 0 }} />
          )}
          <p style={{ margin: 0, fontSize: 13, color: '#00A896', fontWeight: 600 }}>
            {exportFetching ? 'Calculando...' : `${exportCount} contato(s) com os filtros selecionados`}
          </p>
        </div>

        {/* ── Campos ── */}
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campos a exportar</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {EXPORT_FIELD_DEFS.map(f => (
            <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: '#1A2B4A', padding: '7px 10px', borderRadius: 8, border: `1px solid ${exportFields[f.key] ? '#00A896' : '#E2E8F0'}`, background: exportFields[f.key] ? '#F0FDFA' : '#fff', transition: 'all 0.12s' }}>
              <input
                type="checkbox"
                checked={exportFields[f.key]}
                onChange={e => setExportFields(prev => ({ ...prev, [f.key]: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: '#00A896', flexShrink: 0 }}
              />
              {f.label}
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setShowExportModal(false)}
            style={{ padding: '9px 18px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Cancelar
          </button>
          <button
            onClick={() => exportContacts('csv')}
            disabled={exportLoading || exportFetching || !Object.values(exportFields).some(Boolean) || exportCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: 'none', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: (exportLoading || exportFetching || !Object.values(exportFields).some(Boolean) || exportCount === 0) ? 0.5 : 1 }}>
            <Download size={14} /> {exportLoading ? (exportProgress > 0 ? `Exportando... ${exportProgress}/${exportCount}` : 'Exportando...') : `CSV (${exportCount})`}
          </button>
          <button
            onClick={() => exportContacts('xlsx')}
            disabled={exportLoading || exportFetching || !Object.values(exportFields).some(Boolean) || exportCount === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', border: 'none', borderRadius: 9, background: '#16A34A', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: (exportLoading || exportFetching || !Object.values(exportFields).some(Boolean) || exportCount === 0) ? 0.5 : 1 }}>
            <Download size={14} /> {exportLoading ? (exportProgress > 0 ? `Exportando... ${exportProgress}/${exportCount}` : 'Exportando...') : `XLSX (${exportCount})`}
          </button>
        </div>
      </div>
    </div>
  ) : null

  // New contact modal (criação manual, 1-a-1) — mesmos campos do import CSV
  // (nome, telefone, email, endereco, aluno, turma, parentesco) + etiquetas.
  const newContactLbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }
  const newContactInp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: '#1A2B4A' }

  const newContactModal = showNewContact ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setShowNewContact(false) }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1A2B4A' }}>Novo Contato</h2>
          <button onClick={() => setShowNewContact(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 22, lineHeight: 1 }}>✕</button>
        </div>

        {newContactError && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#DC2626' }}>
            {newContactError}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={newContactLbl}>Nome</label>
            <input value={newContact.name} onChange={e => setNewContact(f => ({ ...f, name: e.target.value }))} style={newContactInp} placeholder="Nome do responsável" />
          </div>
          <div>
            <label style={newContactLbl}>Telefone *</label>
            <input value={newContact.phone} onChange={e => setNewContact(f => ({ ...f, phone: e.target.value }))} style={newContactInp} placeholder="(83) 99999-8888" type="tel" />
          </div>
          <div>
            <label style={newContactLbl}>E-mail</label>
            <input value={newContact.email} onChange={e => setNewContact(f => ({ ...f, email: e.target.value }))} style={newContactInp} placeholder="email@escola.com" type="email" />
          </div>
          <div>
            <label style={newContactLbl}>Endereço</label>
            <input value={newContact.address} onChange={e => setNewContact(f => ({ ...f, address: e.target.value }))} style={newContactInp} placeholder="Rua, número, bairro" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={newContactLbl}>Aluno</label>
              <input value={newContact.linked_student_name} onChange={e => setNewContact(f => ({ ...f, linked_student_name: e.target.value }))} style={newContactInp} placeholder="Nome do aluno" />
            </div>
            <div>
              <label style={newContactLbl}>Turma</label>
              <input value={newContact.student_grade} onChange={e => setNewContact(f => ({ ...f, student_grade: e.target.value }))} style={newContactInp} placeholder="6º Ano B" />
            </div>
          </div>
          <div>
            <label style={newContactLbl}>Parentesco</label>
            <input value={newContact.relationship} onChange={e => setNewContact(f => ({ ...f, relationship: e.target.value }))} style={newContactInp} placeholder="Mãe, Pai, Responsável..." />
          </div>

          <div>
            <label style={newContactLbl}>Etiquetas</label>
            {availTagsFilter.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: '#CBD5E1' }}>Nenhuma etiqueta cadastrada. Configure em Configurações → WhatsApp.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {availTagsFilter.map(t => {
                  const active = newContactTags.includes(t.name)
                  return (
                    <button key={t.id} type="button"
                      onClick={() => setNewContactTags(prev => active ? prev.filter(x => x !== t.name) : [...prev, t.name])}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? t.color : '#E2E8F0'}`, background: active ? t.color + '22' : '#fff', color: active ? t.color : '#64748B' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                      {t.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
          <button onClick={() => setShowNewContact(false)}
            style={{ padding: '9px 18px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
            Cancelar
          </button>
          <button onClick={handleSaveNewContact} disabled={savingNewContact}
            style={{ padding: '9px 18px', border: 'none', borderRadius: 9, background: '#00A896', color: '#fff', fontSize: 13, cursor: savingNewContact ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: savingNewContact ? 0.7 : 1 }}>
            {savingNewContact ? 'Criando...' : 'Criar contato'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  const zoomModal = zoomedPhoto ? (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setZoomedPhoto(null)}>
      <div style={{ position: 'relative' }}>
        <img src={zoomedPhoto} alt="Foto do contato" style={{ width: 240, height: 240, borderRadius: 16, objectFit: 'cover', display: 'block', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        <button onClick={() => setZoomedPhoto(null)} style={{ position: 'absolute', top: -12, right: -12, background: '#fff', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: 14, color: '#64748B', lineHeight: 1 }}>✕</span>
        </button>
      </div>
    </div>
  ) : null

  // ─── MOBILE LAYOUT ────────────────────────────────────────
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
            <span style={{ background: '#EFF6FF', color: '#3B82F6', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 9999 }}>{kpiCounts.total}</span>
            <button onClick={openImport}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', padding: '6px 12px', borderRadius: 9, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              <Upload size={13} /> Importar
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: '#94A3B8' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar contato..."
                style={{ width: '100%', paddingLeft: 36, paddingRight: 12, height: 44, background: '#fff', border: '1.5px solid #E2E8F0', borderRadius: 12, fontSize: 16, color: '#1A2B4A', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {/* Origin filter chips */}
          <div style={{ padding: '10px 16px 0', flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6, scrollbarWidth: 'none' }}>
            {originFilters.map(({ value, label }) => (
              <button key={value} onClick={() => setFilterOrigin(value)}
                style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: filterOrigin === value ? '#3B82F6' : '#F0F9FF',
                  color:      filterOrigin === value ? '#fff'    : '#64748B' }}>
                {label}
              </button>
            ))}
            {/* Status filter chip row */}
            {Object.entries(statusConfig).map(([value, cfg]) => (
              <button key={value} onClick={() => setFilterStatus(filterStatus === value ? 'all' : value)}
                style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                  background: filterStatus === value ? '#00A896' : '#F0FFF4',
                  color:      filterStatus === value ? '#fff'    : '#64748B' }}>
                {cfg.label}
              </button>
            ))}
          </div>

          {/* KPIs 2×2 — clickable */}
          <div style={{ padding: '12px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flexShrink: 0 }}>
            {kpiDefs.map(k => {
              const active = filterOrigin === k.filterVal
              return (
                <button key={k.label} onClick={() => setFilterOrigin(k.filterVal)}
                  style={{ background: active ? k.activeBg : '#fff', borderRadius: 12, border: `1.5px solid ${active ? k.activeColor : '#E2E8F0'}`, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <span style={{ fontSize: 22 }}>{k.icon}</span>
                  <div>
                    <p style={{ fontSize: 18, fontWeight: 800, color: active ? k.activeColor : '#1A2B4A', margin: 0, lineHeight: 1 }}>{k.count}</p>
                    <p style={{ fontSize: 11, color: active ? k.activeColor : '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{k.label}</p>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Contact list */}
          <div style={{ flex: 1, overflowY: 'auto', marginTop: 10, background: '#fff', borderTop: '1px solid #F1F5F9' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="animate-spin" style={{ width: 28, height: 28, border: '3px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 10px' }} />
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Carregando...</p>
              </div>
            ) : contacts.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {contacts.map(c => {
                  const cfg = typeCfg(c.contact_type)
                  return (
                    <div key={c.id} onClick={() => setProfileContact(c)}
                      style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                      <ContactAvatar
                        name={c.name}
                        url={c.profile_picture_url}
                        size={44}
                        onClick={c.profile_picture_url ? () => setZoomedPhoto(c.profile_picture_url!) : undefined}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{c.name}</p>
                          <span style={{ ...cfg.badgeStyle, fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999, flexShrink: 0, marginLeft: 6 }}>{cfg.label}</span>
                        </div>
                        {(c.subtitle || c.grade) && (
                          <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[c.subtitle, c.grade].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {c.phone && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{c.phone}</p>}
                      </div>
                      <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0 }} />
                    </div>
                  )
                })}
                {/* Load more */}
                <div style={{ padding: '12px 16px', textAlign: 'center', borderTop: contacts.length > 0 ? '1px solid #F1F5F9' : 'none' }}>
                  {hasMore ? (
                    <button onClick={handleLoadMore} disabled={loadingMore}
                      style={{ width: '100%', padding: '10px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600, cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.6 : 1 }}>
                      {loadingMore ? 'Carregando...' : `Ver mais ${Math.min(PAGE_SIZE, total - contacts.length)} contatos`}
                    </button>
                  ) : contacts.length > 0 && (
                    <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0 }}>{contacts.length} contatos carregados</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        <button onClick={openNewContact}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00A896', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,168,150,0.4)', cursor: 'pointer', zIndex: 100 }}>
          <Plus size={24} />
        </button>
        {importModal}
        {exportModal}
        {newContactModal}
        {zoomModal}
        {profileModal}
      </>
    )
  }

  // ─── DESKTOP LAYOUT ───────────────────────────────────────
  return (
    <>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: '#f8f9fb' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <BookUser size={18} color="#3B82F6" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Contatos</h1>
                <span style={{ padding: '2px 9px', background: '#EFF6FF', color: '#3B82F6', fontSize: 11, fontWeight: 700, borderRadius: 999 }}>{kpiCounts.total}</span>
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Leads e WhatsApp unificados</p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={openNewContact}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: '#00A896', color: '#fff', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={14} /> Novo Contato
            </button>
            <button onClick={openImport}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              <Upload size={14} /> Importar CSV
            </button>
            <button onClick={openExport} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', opacity: (loading || contacts.length === 0) ? 0.5 : 1 }}>
              <Download size={14} /> Exportar ({contacts.length})
            </button>
            <button onClick={() => load()} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
            <button onClick={() => setShowDuplicates(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              <GitMerge size={14} /> Duplicados
            </button>
            <button onClick={() => setShowCustomFields(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              <Settings2 size={14} /> Campos Personalizados
            </button>
          </div>
        </div>

        {/* KPI cards — clickable, highlight active */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {kpiDefs.map(k => {
            const active = filterOrigin === k.filterVal
            return (
              <button key={k.label} onClick={() => setFilterOrigin(active ? 'all' : k.filterVal)}
                style={{ background: active ? k.activeBg : '#fff', borderRadius: 14, border: `1.5px solid ${active ? k.activeColor : '#e2e8f0'}`, padding: '16px 18px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                <p style={{ fontSize: 28, fontWeight: 700, color: active ? k.activeColor : '#1e2d6b', margin: '0 0 4px' }}>{k.count}</p>
                <p style={{ fontSize: 11, color: active ? k.activeColor : '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{k.label}</p>
              </button>
            )
          })}
        </div>

        {/* Busca + filtros — tudo numa linha só. Busca com largura travada
            (não cresce, encolhe até um piso) + selects com largura fixa e
            compacta (flexShrink:0 — não espremem, o texto corta com
            reticências se precisar) + nowrap. overflow-x:auto é só rede de
            segurança pra janelas de desktop bem estreitas — em 1366/1440/
            1920px tudo cabe sem precisar de scroll. */}
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: 10, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
          <div style={{ position: 'relative', flex: '0 1 260px', minWidth: 160, flexShrink: 1 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou turma..."
              style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px 9px 36px', outline: 'none', width: '100%', color: '#1A2B4A', boxSizing: 'border-box' }} />
          </div>
          <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', outline: 'none', color: '#1A2B4A', flexShrink: 0, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <option value="all">Todos os tipos</option>
            <option value="lead">Leads</option>
            <option value="client">Clientes</option>
            <option value="unknown">Desconhecidos</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ border: `1.5px solid ${filterStatus !== 'all' ? '#00A896' : '#E2E8F0'}`, borderRadius: 10, fontSize: 13, background: filterStatus !== 'all' ? '#F0FDFA' : '#fff', padding: '9px 12px', outline: 'none', color: filterStatus !== 'all' ? '#00A896' : '#1A2B4A', fontWeight: filterStatus !== 'all' ? 600 : 400, flexShrink: 0, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <option value="all">Todos os status</option>
            {Object.entries(statusConfig).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
          </select>
          {grades.length > 0 && (
            <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)}
              style={{ border: '1.5px solid #E2E8F0', borderRadius: 10, fontSize: 13, background: '#fff', padding: '9px 12px', outline: 'none', color: '#1A2B4A', flexShrink: 0, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <option value="all">Todas as séries</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          )}
          {availTagsFilter.length > 0 && (
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
              style={{ border: `1.5px solid ${filterTag !== 'all' ? '#00A896' : '#E2E8F0'}`, borderRadius: 10, fontSize: 13, background: filterTag !== 'all' ? '#F0FDFA' : '#fff', padding: '9px 12px', outline: 'none', color: filterTag !== 'all' ? '#00A896' : '#1A2B4A', fontWeight: filterTag !== 'all' ? 600 : 400, flexShrink: 0, width: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <option value="all">Todas as etiquetas</option>
              {availTagsFilter.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          )}
          {hasFilters && (
            <button onClick={clearFilters}
              style={{ border: '1.5px solid #FCA5A5', borderRadius: 10, fontSize: 13, background: '#FEF2F2', padding: '9px 14px', outline: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
              Limpar filtros
            </button>
          )}
        </div>

        {/* Barra de ação em massa (item 3) — só aparece com seleção ativa */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, background: '#F0FDFA', border: '1.5px solid #99F6E4', borderRadius: 12, padding: '10px 16px' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0F766E' }}>
              {selectedIds.size} contato(s) selecionado(s){selectedAllFilter ? ' (todos do filtro)' : ''}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {!selectedAllFilter && total > contacts.length && (
                <button onClick={selectAllMatchingFilter} disabled={selectingAllFilter}
                  style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: '1px solid #5EEAD4', borderRadius: 9, background: '#fff', color: '#0F766E', cursor: 'pointer' }}>
                  {selectingAllFilter ? 'Buscando...' : `Selecionar todos os ${total} deste filtro`}
                </button>
              )}
              <button onClick={() => { setBulkTagNames([]); setShowBulkTagModal(true) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 9, background: '#00A896', color: '#fff', cursor: 'pointer' }}>
                <TagIcon size={12} /> Aplicar etiqueta
              </button>
              <button onClick={openBulkDeleteConfirm}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, border: '1px solid #FCA5A5', borderRadius: 9, background: '#fff', color: '#DC2626', cursor: 'pointer' }}>
                <Trash2 size={12} /> Excluir
              </button>
              <button onClick={clearSelection}
                style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, border: 'none', borderRadius: 9, background: 'transparent', color: '#64748B', cursor: 'pointer' }}>
                Limpar seleção
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ background: '#f8fafc', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', width: 36 }}>
                  <input type="checkbox"
                    checked={contacts.length > 0 && selectedIds.size === contacts.length}
                    onChange={toggleSelectAllLoaded}
                    style={{ cursor: 'pointer' }} />
                </th>
                <SortTh col="name"         label="Contato" />
                <SortTh col="phone"        label="Telefone" />
                <SortTh col="type"         label="Tipo" />
                <th style={{ background: '#f8fafc', padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Série</th>
                <SortTh col="last_seen_at" label="Último contato" />
                <SortTh col="created_at"   label="Adicionado em" />
                <th style={{ background: '#f8fafc', padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : contacts.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                contacts.map(c => {
                  const cfg = typeCfg(c.contact_type)
                  return (
                    <tr key={c.id} onClick={() => setProfileContact(c)}
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <td style={{ padding: '12px 12px' }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleSelect(c.id)} style={{ cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <ContactAvatar
                            name={c.name}
                            url={c.profile_picture_url}
                            size={36}
                            onClick={c.profile_picture_url ? () => setZoomedPhoto(c.profile_picture_url!) : undefined}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                            {c.subtitle && (
                              <p style={{ fontSize: 12, color: '#64748b', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.subtitle}</p>
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
                        <span style={{ ...cfg.badgeStyle, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
                        {c.grade || <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {fmtDate(c.last_contact)}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }} title={fmtFull(c.created_at)}>
                        {fmtCreated(c.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={e => { e.stopPropagation(); setProfileContact(c) }}
                            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Ver perfil
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              navigate('/whatsapp', { state: { phone: normalizeBrazilianInput(c.phone || '') } })
                            }}
                            title="Abrir no WhatsApp"
                            style={{ padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid #BBF7D0', borderRadius: 8, background: '#F0FDF4', color: '#16A34A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                            <MessageSquare size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>

          {!loading && <LoadMoreFooter />}
        </div>
      </div>

      {importModal}
      {exportModal}
      {newContactModal}
      {zoomModal}
      {profileModal}

      {/* Aplicar etiqueta em massa */}
      {showBulkTagModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1150, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 380, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>Aplicar etiqueta</h3>
              <button onClick={() => setShowBulkTagModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#64748B' }}>{selectedIds.size} contato(s) selecionado(s)</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {availTagsFilter.length === 0 && <p style={{ fontSize: 12, color: '#CBD5E1', margin: 0 }}>Nenhuma etiqueta disponível.</p>}
              {availTagsFilter.map(t => {
                const active = bulkTagNames.includes(t.name)
                return (
                  <button key={t.id} type="button"
                    onClick={() => setBulkTagNames(prev => active ? prev.filter(n => n !== t.name) : [...prev, t.name])}
                    style={{ padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? t.color : '#E2E8F0'}`, background: active ? t.color + '22' : '#fff', color: active ? t.color : '#64748B' }}>
                    {t.name}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowBulkTagModal(false)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={applyBulkTags} disabled={bulkTagNames.length === 0 || bulkTagSaving}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: bulkTagSaving ? 'not-allowed' : 'pointer', opacity: bulkTagNames.length === 0 || bulkTagSaving ? 0.6 : 1 }}>
                {bulkTagSaving && <Loader2 size={13} className="animate-spin" />}
                {bulkTagSaving ? 'Aplicando...' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excluir em massa — mesmo aviso de vínculos órfãos da exclusão individual, agregado */}
      {showBulkDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1150, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 22 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#DC2626' }}>Excluir {selectedIds.size} contato(s)?</h3>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#64748B' }}>Esta ação não pode ser desfeita.</p>
            {checkingBulkDelete ? (
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94A3B8', margin: '0 0 14px' }}>
                <Loader2 size={12} className="animate-spin" /> Verificando vínculos...
              </p>
            ) : bulkRelatedInfo && (bulkRelatedInfo.leadCount > 0 || bulkRelatedInfo.conversationCount > 0 || bulkRelatedInfo.noteCount > 0) && (
              <p style={{ margin: '0 0 14px', fontSize: 12, color: '#7F1D1D', background: '#FEE2E2', padding: '10px 12px', borderRadius: 8, lineHeight: 1.5 }}>
                {[
                  bulkRelatedInfo.leadCount > 0 && `${bulkRelatedInfo.leadCount} lead(s)`,
                  bulkRelatedInfo.conversationCount > 0 && `${bulkRelatedInfo.conversationCount} conversa(s) de WhatsApp`,
                  bulkRelatedInfo.noteCount > 0 && `${bulkRelatedInfo.noteCount} anotaç${bulkRelatedInfo.noteCount > 1 ? 'ões' : 'ão'}`,
                ].filter(Boolean).join(', ')} vinculados a esses contatos <strong>não serão excluídos</strong>, mas ficarão órfãos (sem vínculo) depois da exclusão.
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setShowBulkDelete(false); setBulkRelatedInfo(null) }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleBulkDelete} disabled={bulkDeleting || checkingBulkDelete}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, border: 'none', background: '#DC2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: bulkDeleting || checkingBulkDelete ? 0.6 : 1 }}>
                {bulkDeleting && <Loader2 size={13} className="animate-spin" />}
                {bulkDeleting ? 'Excluindo...' : 'Confirmar exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicates && (
        <DuplicateContactsModal
          institutionId={institutionId}
          currentUserId={user?.id || null}
          onClose={() => setShowDuplicates(false)}
          onMerged={() => { load({ reset: true }); refreshKpiCounts() }}
        />
      )}

      {showCustomFields && (
        <CustomFieldsAdminModal
          institutionId={institutionId}
          onClose={() => setShowCustomFields(false)}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1300, background: toast.ok ? '#1A2B4A' : '#DC2626', color: '#fff', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          {toast.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </>
  )
}
