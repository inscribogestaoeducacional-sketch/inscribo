// src/pages/gestor/AttendantHome.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import {
  Users, Calendar, MessageCircle, ArrowRightLeft,
  Plus, Phone, CheckCircle, Clock, AlertCircle, AlertTriangle,
  ExternalLink, ChevronRight, GraduationCap, Target, Bell,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'

// ─── tipos ──────────────────────────────────────────────────────────────────
interface Lead {
  id: string
  student_name: string | null
  responsible_name: string | null
  status: string
  created_at: string
  phone: string | null
  grade_interest?: string | null
}

interface LeadStatusOnly {
  id: string
  status: string
  created_at: string
}

interface Visit {
  id: string
  lead_id: string | null
  status: string
  scheduled_date: string
  created_at: string
  student_name: string | null
}

interface Transfer {
  id: string
  student_name: string
  course_grade: string
  status: string
  created_at: string
  survey_token: string | null
  ai_diagnosis: string | null
}

interface WaMessage {
  id: string
  from_me: boolean
  created_at: string
  remote_jid: string
}

interface EnrollmentRow {
  id: string
  user_id: string
  created_at: string
}

// ── Status configs (mesmo enum real de leads.status/visits.status) ──────────
const leadStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  new:       { label: 'Novo',         color: '#3b82f6', bg: '#eff6ff' },
  contact:   { label: 'Em contato',   color: '#f59e0b', bg: '#fffbeb' },
  scheduled: { label: 'Agendado',     color: '#8b5cf6', bg: '#f5f3ff' },
  visit:     { label: 'Em visita',    color: '#06b6d4', bg: '#ecfeff' },
  proposal:  { label: 'Proposta',     color: '#f97316', bg: '#fff7ed' },
  enrolled:  { label: 'Matriculado',  color: '#0F6E56', bg: '#f0fdf4' },
  lost:      { label: 'Perdido',      color: '#ef4444', bg: '#fef2f2' },
}

const visitStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  scheduled:  { label: 'Agendada',   color: '#8b5cf6', bg: '#f5f3ff' },
  completed:  { label: 'Realizada',  color: '#0F6E56', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelada',  color: '#ef4444', bg: '#fef2f2' },
  no_show:    { label: 'Não veio',   color: '#f97316', bg: '#fff7ed' },
}

// Mesma lógica de GestorTransfers.tsx:getStatusInfo, adaptada aos campos que
// essa tela busca (sem survey_responses, que não foi pedido pra AttendantHome).
function transferStatusInfo(t: Transfer): { label: string; color: string; bg: string } {
  if (t.status === 'cancelled') return { label: 'Cancelado', color: '#64748b', bg: '#f1f5f9' }
  if (t.ai_diagnosis) return { label: 'Diagnóstico pronto', color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_token) return { label: 'Pesquisa enviada', color: '#d97706', bg: '#fef3c7' }
  return { label: 'Aguardando pesquisa', color: '#64748b', bg: '#f1f5f9' }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

function fmtTime(dateStr: string) {
  return new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
    .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  if (d.getTime() === today.getTime()) return 'Hoje'
  if (d.getTime() === tomorrow.getTime()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function digitsOnly(phone: string) { return phone.replace(/\D/g, '') }

// Mesma convenção de normalização usada em AdminAionInbox.tsx
// (normalizeContactPhone): DDI 55 na frente se ainda não tiver.
function toWhatsAppLink(phone: string): string | null {
  let digits = digitsOnly(phone)
  if (!digits) return null
  if (!digits.startsWith('55')) digits = `55${digits}`
  return `https://wa.me/${digits}`
}

// ── Stat card (KPI) — mesmo visual/comportamento do KpiCard de GestorHome.tsx ──
function StatCard({ label, value, icon, iconBg, variation, sub, onClick }: {
  label: string; value: string | number; icon: React.ReactNode; iconBg: string
  variation?: number | null; sub?: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
        padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)', transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.1 }}>{value}</div>
      {variation !== null && variation !== undefined && (
        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: variation >= 0 ? '#f0fdf4' : '#fef2f2', color: variation >= 0 ? '#16a34a' : '#dc2626' }}>
          {variation >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(variation)}% vs. mês anterior
        </div>
      )}
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function AttendantHome() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const [leadsRecent, setLeadsRecent] = useState<Lead[]>([])
  const [leadsTodayCount, setLeadsTodayCount] = useState(0)
  const [leadsMonth, setLeadsMonth] = useState<LeadStatusOnly[]>([])
  const [leadsPrevMonthCount, setLeadsPrevMonthCount] = useState(0)
  const [openLeads, setOpenLeads] = useState<Lead[]>([])
  const [visitsToday, setVisitsToday] = useState<Visit[]>([])
  const [waMessages, setWaMessages] = useState<WaMessage[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [enrollmentsMonth, setEnrollmentsMonth] = useState<EnrollmentRow[]>([])
  const [enrollmentsPrevMonthCount, setEnrollmentsPrevMonthCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const institutionId = user?.institution_id
  const userId = user?.id

  useEffect(() => {
    if (!institutionId || !userId) return
    loadAll()
  }, [institutionId, userId])

  const loadAll = async () => {
    if (!institutionId || !userId) return
    setLoading(true)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Todas independentes entre si (só dependem de institutionId/userId/datas
    // já calculadas acima) — um Promise.all só, sem round-trips em cadeia.
    const [
      leadsRecentRes, leadsTodayRes, leadsMonthRes, leadsPrevMonthRes, openLeadsRes,
      visitsRes, waRes, transfersRes, enrollMonthRes, enrollPrevMonthRes,
    ] = await Promise.all([
      // Leads recentes (lista) — não usado pra contagem, só preview.
      supabase.from('leads')
        .select('id, student_name, responsible_name, status, created_at, phone, grade_interest')
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .order('created_at', { ascending: false }).limit(10),
      // Leads hoje (KPI) — filtrado por data direto no banco (count), não
      // computado sobre a lista acima (que é limitada a 10 e subestimaria em
      // dias de alto volume).
      supabase.from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .gte('created_at', todayStart.toISOString()),
      // Leads do mês (meu desempenho: taxa de conversão + total no mês).
      supabase.from('leads')
        .select('id, status, created_at')
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .gte('created_at', monthStart.toISOString()),
      supabase.from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .gte('created_at', prevMonthStart.toISOString()).lt('created_at', monthStart.toISOString()),
      // Leads em aberto (nem matriculado nem perdido) — base dos lembretes de
      // "sem contato há X dias".
      supabase.from('leads')
        .select('id, student_name, responsible_name, status, created_at, phone')
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .not('status', 'in', '(enrolled,lost)')
        .order('created_at', { ascending: true }).limit(20),
      // Visitas de hoje — limite superior adicionado (antes só tinha .gte,
      // então visitas de amanhã em diante entravam na lista de "hoje").
      supabase.from('visits')
        .select('id, lead_id, status, scheduled_date, created_at, student_name')
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .gte('scheduled_date', todayStart.toISOString()).lt('scheduled_date', tomorrowStart.toISOString())
        .order('scheduled_date', { ascending: true }),
      // WhatsApp 24h — mesmo filtro de grupos que o GestorHome já usa.
      supabase.from('whatsapp_messages')
        .select('id, from_me, created_at, remote_jid')
        .eq('institution_id', institutionId)
        .gte('created_at', since24h.toISOString())
        .not('remote_jid', 'ilike', '%@g.us'),
      // Transferências — feed geral da escola (student_transfers não tem
      // coluna de dono; lead_id é opcional e a maioria das transferências não
      // vem de um lead do funil, então filtrar por atendente ficaria incompleto).
      supabase.from('student_transfers')
        .select('id, student_name, course_grade, status, created_at, survey_token, ai_diagnosis')
        .eq('institution_id', institutionId).is('deleted_at', null)
        .order('created_at', { ascending: false }).limit(5),
      // Matrículas fechadas por mim, no mês.
      supabase.from('enrollments')
        .select('id, user_id, created_at')
        .eq('institution_id', institutionId).eq('user_id', userId)
        .gte('created_at', monthStart.toISOString()),
      supabase.from('enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('user_id', userId)
        .gte('created_at', prevMonthStart.toISOString()).lt('created_at', monthStart.toISOString()),
    ])

    setLeadsRecent((leadsRecentRes.data as Lead[]) ?? [])
    setLeadsTodayCount(leadsTodayRes.count ?? 0)
    setLeadsMonth((leadsMonthRes.data as LeadStatusOnly[]) ?? [])
    setLeadsPrevMonthCount(leadsPrevMonthRes.count ?? 0)
    setOpenLeads((openLeadsRes.data as Lead[]) ?? [])
    setVisitsToday((visitsRes.data as Visit[]) ?? [])
    setWaMessages((waRes.data as WaMessage[]) ?? [])
    setTransfers((transfersRes.data as Transfer[]) ?? [])
    setEnrollmentsMonth((enrollMonthRes.data as EnrollmentRow[]) ?? [])
    setEnrollmentsPrevMonthCount(enrollPrevMonthRes.count ?? 0)
    setLoading(false)
  }

  // ── KPIs (os 4 originais, com as queries corrigidas) ─────────────────────
  const visitsScheduled = visitsToday.filter(v => v.status === 'scheduled').length
  const waSent = waMessages.filter(m => m.from_me).length
  const waReceived = waMessages.filter(m => !m.from_me).length
  // Mesma lógica canônica de GestorTransfers.tsx (survey_token/status agora
  // fazem parte do select — antes faltavam e o filtro virava só !ai_diagnosis).
  const transfersPending = transfers.filter(t => !t.survey_token && !t.ai_diagnosis && t.status !== 'cancelled').length

  // ── Meu desempenho (mês atual vs mês anterior, onde faz sentido) ──────────
  const enrolledMonthCount = enrollmentsMonth.length
  const enrollVariation = enrollmentsPrevMonthCount > 0
    ? Math.round((enrolledMonthCount - enrollmentsPrevMonthCount) / enrollmentsPrevMonthCount * 100)
    : null
  const leadsMonthCount = leadsMonth.length
  const leadsVariation = leadsPrevMonthCount > 0
    ? Math.round((leadsMonthCount - leadsPrevMonthCount) / leadsPrevMonthCount * 100)
    : null
  const convertedMonthCount = leadsMonth.filter(l => l.status === 'enrolled').length
  const conversionRate = leadsMonthCount > 0 ? +((convertedMonthCount / leadsMonthCount) * 100).toFixed(1) : 0

  // ── Lembretes: meus leads em aberto sem contato há mais de 5 dias ─────────
  // Não existe tabela de lembretes/tarefas no schema — aproximação combinada
  // com o gestor: mesmo critério do alerta "leads sem contato" do GestorHome
  // (status fora de enrolled/lost, sem atividade há 5+ dias), filtrado por
  // assigned_to = eu.
  const fiveDaysAgoIso = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const reminders = openLeads.filter(l => l.created_at < fiveDaysAgoIso)

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  const kpiCols = isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)'
  const twoColGrid = isMobile ? '1fr' : '1fr 1fr'

  return (
    <div style={{ padding: isMobile ? 16 : 24, display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
            {greeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
            {user?.institution_name || 'Escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 12px' }}>
          Atendente
        </span>
      </div>

      {/* ── KPIs ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 16 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
              <Skeleton h="h-3" w="w-24 mb-3" /><Skeleton h="h-8" w="w-16" />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: kpiCols, gap: 16 }}>
          <StatCard label="Leads hoje" value={leadsTodayCount} icon={<Users size={18} color="#8b5cf6" />} iconBg="#f5f3ff" onClick={() => navigate('/leads')} />
          <StatCard label="Visitas agendadas" value={visitsScheduled} icon={<Calendar size={18} color="#0F6E56" />} iconBg="#f0fdf4" onClick={() => navigate('/visits')} />
          <StatCard label="WhatsApp 24h" value={waReceived} icon={<MessageCircle size={18} color="#10B981" />} iconBg="#d1fae5" onClick={() => navigate('/whatsapp')} />
          <StatCard
            label="Transferências pendentes" value={transfersPending}
            icon={<ArrowRightLeft size={18} color={transfersPending > 0 ? '#dc2626' : '#64748b'} />}
            iconBg={transfersPending > 0 ? '#fef2f2' : '#f1f5f9'}
            onClick={() => navigate('/transferencias')}
          />
        </div>
      )}

      {/* ── Meu desempenho (mês atual) ── */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Meu desempenho no mês
        </div>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            {Array(3).fill(0).map((_, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
                <Skeleton h="h-3" w="w-24 mb-3" /><Skeleton h="h-8" w="w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 16 }}>
            <StatCard label="Matrículas fechadas" value={enrolledMonthCount} variation={enrollVariation} icon={<GraduationCap size={18} color="#7C3AED" />} iconBg="#f5f3ff" onClick={() => navigate('/leads')} />
            <StatCard label="Meus leads no mês" value={leadsMonthCount} variation={leadsVariation} icon={<Users size={18} color="#00A896" />} iconBg="#e6f7f5" onClick={() => navigate('/leads')} />
            <StatCard label="Taxa de conversão" value={`${conversionRate}%`} icon={<Target size={18} color="#F59E0B" />} iconBg="#fffbeb" sub={`${convertedMonthCount} de ${leadsMonthCount} leads`} />
          </div>
        )}
      </div>

      {/* ── Leads recentes | Visitas do dia ── */}
      <div style={{ display: 'grid', gridTemplateColumns: twoColGrid, gap: 20 }}>

        {/* Meus leads recentes */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Meus leads recentes</span>
            <button onClick={() => navigate('/leads')} style={{ fontSize: 11, color: '#8b5cf6', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver todos <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : leadsRecent.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Users size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 12 }}>Nenhum lead atribuído a você ainda</p>
            </div>
          ) : (
            <div>
              {leadsRecent.slice(0, 6).map(lead => {
                const cfg = leadStatusCfg[lead.status] || leadStatusCfg.new
                const waLink = lead.phone ? toWhatsAppLink(lead.phone) : null
                return (
                  <div key={lead.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.student_name || lead.responsible_name || '—'}
                      </div>
                      {lead.phone && (
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{lead.phone}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cfg.color, background: cfg.bg, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {cfg.label}
                    </span>
                    {lead.phone && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <a href={`tel:${digitsOnly(lead.phone)}`} title="Ligar"
                          style={{ width: 26, height: 26, borderRadius: 7, background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                          <Phone size={12} />
                        </a>
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noreferrer" title="WhatsApp"
                            style={{ width: 26, height: 26, borderRadius: 7, background: '#d1fae5', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                            <MessageCircle size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Visitas de hoje */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Minhas visitas de hoje</span>
            <button onClick={() => navigate('/visits')} style={{ fontSize: 11, color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver agenda <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(4).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : visitsToday.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 12 }}>Nenhuma visita agendada para hoje</p>
            </div>
          ) : (
            <div>
              {visitsToday.slice(0, 6).map(visit => {
                const cfg = visitStatusCfg[visit.status] || visitStatusCfg.scheduled
                return (
                  <div key={visit.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Clock size={14} color="#8b5cf6" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {visit.student_name || `Lead #${visit.lead_id?.slice(0, 6)}`}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                        {fmtDate(visit.scheduled_date)} · {fmtTime(visit.scheduled_date)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                      {visit.status === 'scheduled' && (
                        <button
                          onClick={() => navigate('/visits')}
                          style={{ fontSize: 10, fontWeight: 600, color: '#0F6E56', background: '#f0fdf4', border: 'none', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>
                          Confirmar
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Lembretes | WhatsApp 24h ── */}
      <div style={{ display: 'grid', gridTemplateColumns: twoColGrid, gap: 20 }}>

        {/* Meus lembretes */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bell size={13} color="#f59e0b" /> Meus lembretes
            </span>
            <button onClick={() => navigate('/leads')} style={{ fontSize: 11, color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
              Ver leads <ChevronRight size={12} />
            </button>
          </div>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
            </div>
          ) : reminders.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <CheckCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.4, color: '#0F6E56' }} />
              <p style={{ fontSize: 12 }}>Nenhum lead seu parado há mais de 5 dias</p>
            </div>
          ) : (
            <div>
              {reminders.slice(0, 5).map(lead => (
                <div key={lead.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertTriangle size={13} color="#d97706" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lead.student_name || lead.responsible_name || '—'}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>Sem contato desde {fmtDate(lead.created_at)}</div>
                  </div>
                  <button
                    onClick={() => navigate('/leads')}
                    style={{ fontSize: 10, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Retomar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp 24h */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>WhatsApp últimas 24h</span>
            <button
              onClick={() => navigate('/whatsapp')}
              style={{ fontSize: 11, color: '#10B981', background: '#d1fae5', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
              <ExternalLink size={11} /> Abrir
            </button>
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton h="h-12" /><Skeleton h="h-12" />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: '#f0fdf4', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0F6E56' }}>{waReceived}</div>
                <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Recebidas</div>
              </div>
              <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#64748B' }}>{waSent}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Enviadas</div>
              </div>
            </div>
          )}
          {!loading && waReceived === 0 && waSent === 0 && (
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 12 }}>Nenhuma mensagem nas últimas 24h</p>
          )}
        </div>
      </div>

      {/* ── Transferências recentes (feed geral da escola) ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>Transferências recentes</span>
          <button onClick={() => navigate('/transferencias')} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
            Ver todas <ChevronRight size={12} />
          </button>
        </div>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array(3).fill(0).map((_, i) => <Skeleton key={i} h="h-12" />)}
          </div>
        ) : transfers.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
            <CheckCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.4, color: '#0F6E56' }} />
            <p style={{ fontSize: 12 }}>Nenhuma transferência registrada</p>
          </div>
        ) : (
          <div>
            {transfers.map(t => {
              const info = transferStatusInfo(t)
              const needsLink = !t.survey_token && !t.ai_diagnosis && t.status !== 'cancelled'
              return (
                <div key={t.id} style={{ padding: '10px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {needsLink ? <AlertCircle size={13} color="#dc2626" /> : <CheckCircle size={13} color={info.color} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.student_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>{t.course_grade}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: info.color, background: info.bg, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {info.label}
                  </span>
                  {needsLink && (
                    <button
                      onClick={() => navigate('/transferencias')}
                      style={{ fontSize: 10, fontWeight: 600, color: '#dc2626', background: '#fef2f2', border: 'none', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      Gerar link
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Ações rápidas ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ações rápidas
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '+ Novo lead',              path: '/leads',          color: '#8b5cf6', bg: '#f5f3ff', icon: Plus         },
            { label: '+ Agendar visita',         path: '/visits',         color: '#0F6E56', bg: '#f0fdf4', icon: Calendar     },
            { label: 'Registrar transferência',  path: '/transferencias', color: '#dc2626', bg: '#fef2f2', icon: ArrowRightLeft },
            { label: 'Abrir WhatsApp',           path: '/whatsapp',       color: '#10B981', bg: '#d1fae5', icon: MessageCircle },
          ].map(a => (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: a.bg, color: a.color,
                border: `1px solid ${a.color}30`,
                borderRadius: 10, padding: '8px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              <a.icon size={14} />
              {a.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
