// Novo Início do consultor/atendente: tudo dele numa tela só — o que precisa de ação agora,
// o mês dele, a carteira por etapa, o atendimento comparado com a média da equipe,
// visitas, lembretes e conversas. Cada bloco leva para a tela certa.
import { PillTabs, useTabSwipe } from '../../components/mobile/PillTabs'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, Calendar, MessageCircle, ArrowRightLeft, Plus, Phone, CheckCircle, Clock, AlertCircle, ChevronRight,
  GraduationCap, Target, Bell, ArrowUpRight, ArrowDownRight, Home, Inbox, UserX, CalendarX, Timer, Star, Trophy, Hourglass,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { BRAND } from '../../lib/brand'
import PageHeader from '../../components/ui/PageHeader'
import { PageSkeleton } from '../../components/ui/BrandLoader'
import { CountUp } from '../../components/campanha/CampaignCharts'
import { LEADS_CSS, waitLabel, daysSince } from '../../components/leads/LeadsAttention'
import { getLeadReminderInfo, REMINDER_COLORS } from '../../lib/leadReminders'
import { useLeadInteractions } from '../../hooks/useLeadInteractions'
import { useActiveCampaign } from '../../lib/activeCampaign'
import { statusConfig } from '../../components/leads/leadFormShared'
import { leadCustomStage } from '../../lib/stageLabels'

const REMINDERS_PAGE_SIZE = 5
const GRAD = 'var(--aion-grad)'

async function fetchAllPages<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

// ─── tipos ──────────────────────────────────────────────────────────────────
interface Lead { id: string; student_name: string | null; responsible_name: string | null; status: string; created_at: string; phone: string | null; grade_interest?: string | null; next_followup?: string | null; custom_stage_id?: string | null }
interface Visit { id: string; lead_id: string | null; status: string; scheduled_date: string; created_at: string; student_name: string | null }
interface Transfer { id: string; student_name: string; course_grade: string; status: string; created_at: string; survey_token: string | null; ai_diagnosis: string | null }
interface Conv { remote_jid: string; status: string; unread_count: number | null; last_message_at: string | null }
interface WaMessage { id: string; from_me: boolean; created_at: string; remote_jid: string }
interface Waiting { lead_id: string; side: 'us' | 'family' | null; since: string; last_text: string | null }
interface Mine { conversas: number; encerradas: number; sem_resposta: number; resp_mediana_min: number | null; resolucao_mediana_h: number | null; satisfacao: number | null; avaliacoes: number }
interface Team { atendentes: number; conversas_media: number | null; resp_mediana_min: number | null; resolucao_mediana_h: number | null; satisfacao: number | null }

const STAGE_ORDER = ['new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost'] as const
const STAGE_COLOR: Record<string, string> = {
  new: '#3b82f6', contact: '#f59e0b', scheduled: '#8b5cf6', visit: '#06b6d4', proposal: '#f97316', enrolled: '#05907B', lost: '#ef4444',
}
const stageLabel = (k: string) => (statusConfig as Record<string, { label: string }>)[k]?.label ?? k

const visitStatusCfg: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Agendada', color: '#8b5cf6', bg: '#f5f3ff' },
  completed: { label: 'Realizada', color: '#0F6E56', bg: '#f0fdf4' },
  cancelled: { label: 'Cancelada', color: '#ef4444', bg: '#fef2f2' },
  no_show: { label: 'Não veio', color: '#f97316', bg: '#fff7ed' },
}

function transferStatusInfo(t: Transfer): { label: string; color: string; bg: string } {
  if (t.status === 'cancelled') return { label: 'Cancelado', color: '#64748b', bg: '#f1f5f9' }
  if (t.ai_diagnosis) return { label: 'Diagnóstico pronto', color: '#16a34a', bg: '#dcfce7' }
  if (t.survey_token) return { label: 'Pesquisa enviada', color: '#d97706', bg: '#fef3c7' }
  return { label: 'Aguardando pesquisa', color: '#64748b', bg: '#f1f5f9' }
}

// ─── helpers ────────────────────────────────────────────────────────────────
const fmtTime = (s: string) => new Date(s + (s.includes('T') ? '' : 'T12:00:00')).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
function fmtDate(s: string) {
  const d = new Date(s + (s.includes('T') ? '' : 'T12:00:00'))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  d.setHours(0, 0, 0, 0)
  if (d.getTime() === today.getTime()) return 'Hoje'
  if (d.getTime() === tomorrow.getTime()) return 'Amanhã'
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).replace('.', '')
}
const digitsOnly = (p: string) => p.replace(/\D/g, '')
function toWaLink(phone: string): string | null {
  let d = digitsOnly(phone); if (!d) return null
  if (!d.startsWith('55')) d = `55${d}`
  return `https://wa.me/${d}`
}
const fmtMin = (m: number | null | undefined) => m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
const fmtH = (h: number | null | undefined) => h == null ? '—' : h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`
const satPct = (s: number | null | undefined) => s == null ? null : Math.round(((s - 1) / 2) * 100)
const initialsOf = (n: string) => n.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
const ymd = (d: Date) => d.toLocaleDateString('sv-SE')

// ─── peças visuais ──────────────────────────────────────────────────────────
const card: CSSProperties = { background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, boxShadow: '0 1px 2px rgba(26,43,74,.04), 0 6px 18px -12px rgba(26,43,74,.18)' }

function Panel({ title, icon, color = BRAND.primary, link, onLink, children, delay = 0, pad = false }: {
  title: string; icon: ReactNode; color?: string; link?: string; onLink?: () => void; children: ReactNode; delay?: number; pad?: boolean
}) {
  return (
    <section className="ld-in" style={{ ...card, overflow: 'hidden', animationDelay: `${delay}ms`, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '13px 16px', borderBottom: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, borderRadius: 9, background: `${color}14`, color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
          {title}
        </span>
        {link && onLink && (
          <button type="button" onClick={onLink} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
            {link} <ChevronRight size={13} />
          </button>
        )}
      </header>
      <div style={pad ? { padding: 16 } : undefined}>{children}</div>
    </section>
  )
}

function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', color: BRAND.faint }}>
      <div style={{ display: 'inline-flex', width: 44, height: 44, borderRadius: 14, background: BRAND.softer, color: BRAND.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{icon}</div>
      <p style={{ fontSize: 12.5, margin: 0 }}>{text}</p>
    </div>
  )
}

function Kpi({ label, value, sub, color, icon, onClick, alert, delay = 0, suffix }: {
  label: string; value: number; sub: string; color: string; icon: ReactNode; onClick?: () => void; alert?: boolean; delay?: number; suffix?: string
}) {
  return (
    <button type="button" onClick={onClick} className={`ld-kpi ld-in ${alert ? 'ld-alert' : ''}`}
      style={{ animationDelay: `${delay}ms`, position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 18, padding: '14px 14px 13px', border: `1.5px solid ${alert ? '#FCA5A5' : BRAND.line}`, display: 'flex', flexDirection: 'column', gap: 6, cursor: onClick ? 'pointer' : 'default', textAlign: 'left' }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color, opacity: alert ? 1 : .6 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, lineHeight: 1.2 }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: `${color}14`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: alert ? '#B91C1C' : BRAND.ink, lineHeight: 1, letterSpacing: '-.02em' }}><CountUp value={value} />{suffix}</div>
      <div style={{ fontSize: 11.5, color: BRAND.muted, lineHeight: 1.3 }}>{sub}</div>
    </button>
  )
}

function Delta({ v, suffix = '% vs. mês anterior' }: { v: number | null; suffix?: string }) {
  if (v === null) return null
  const up = v >= 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: up ? '#f0fdf4' : '#fef2f2', color: up ? '#16a34a' : '#dc2626' }}>
      {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{Math.abs(v)}{suffix}
    </span>
  )
}

// Comparação eu × equipe numa linha (menor é melhor quando `lowerBetter`).
function VsRow({ label, hint, me, team, fmt, lowerBetter, delay = 0 }: {
  label: string; hint?: string; me: number | null; team: number | null; fmt: (n: number | null) => string; lowerBetter?: boolean; delay?: number
}) {
  const max = Math.max(me ?? 0, team ?? 0, 1)
  const better = me != null && team != null ? (lowerBetter ? me <= team : me >= team) : null
  const bar = (v: number | null, c: string) => (
    <span style={{ display: 'block', height: 8, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${v == null ? 0 : Math.max(4, (v / max) * 100)}%`, background: c, borderRadius: 99, transition: 'width .8s cubic-bezier(.22,1,.36,1)', transitionDelay: `${delay}ms` }} />
    </span>
  )
  return (
    <div style={{ display: 'grid', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.ink }}>{label}{hint && <span style={{ fontWeight: 500, color: BRAND.faint }}> · {hint}</span>}</span>
        {better !== null && (
          <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: better ? '#DCFCE7' : '#FEF3C7', color: better ? '#15803D' : '#B45309' }}>
            {better ? 'Melhor que a equipe' : 'Abaixo da equipe'}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr 70px', alignItems: 'center', gap: 8, fontSize: 12, color: BRAND.muted }}>
        <span style={{ fontWeight: 700, color: BRAND.primaryDark }}>Eu</span>{bar(me, BRAND.primary)}<b style={{ color: BRAND.ink, textAlign: 'right' }}>{fmt(me)}</b>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '54px 1fr 70px', alignItems: 'center', gap: 8, fontSize: 12, color: BRAND.muted }}>
        <span style={{ fontWeight: 700 }}>Equipe</span>{bar(team, '#94A3B8')}<b style={{ color: BRAND.muted, textAlign: 'right' }}>{fmt(team)}</b>
      </div>
    </div>
  )
}

function Row({ children, onClick, delay = 0 }: { children: ReactNode; onClick?: () => void; delay?: number }) {
  return (
    <div className="ld-row ld-in" onClick={onClick} style={{ animationDelay: `${delay}ms`, padding: '10px 16px', borderBottom: `1px solid #F1F5F4`, display: 'flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default' }}>{children}</div>
  )
}
const pillBtn = (color: string, bg: string): CSSProperties => ({ fontSize: 11, fontWeight: 700, color, background: bg, border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: 'inherit' })
const iconBtn = (color: string, bg: string): CSSProperties => ({ width: 28, height: 28, borderRadius: 8, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: 'none', cursor: 'pointer' })

// ─── tela ───────────────────────────────────────────────────────────────────
type ATab = 'agora' | 'mes' | 'atend' | 'agenda'
const A_TABS: [string, string][] = [['agora', 'Agora'], ['mes', 'Meu mês'], ['atend', 'Atendimento'], ['agenda', 'Agenda']]
function AT({ id, tab, mobile, children }: { id: ATab; tab: ATab; mobile: boolean; children: ReactNode }) {
  return <div style={{ display: !mobile || tab === id ? 'contents' : 'none' }}>{children}</div>
}

export default function AttendantHomeNew() {
  const [aTab, setATab] = useState<ATab>('agora')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const aSwipe = useTabSwipe(A_TABS.map(t => t[0]), aTab, id => setATab(id as ATab), isMobile)
  const { user } = useAuth()
  const navigate = useNavigate()
  const institutionId = user?.institution_id
  const userId = user?.id
  const campaign = useActiveCampaign(institutionId)
  const { optsFor, refresh: refreshInteractions } = useLeadInteractions(institutionId)

  const [loading, setLoading] = useState(true)
  const [leadsRecent, setLeadsRecent] = useState<Lead[]>([])
  const [leadsTodayCount, setLeadsTodayCount] = useState(0)
  const [leadsMonthCount, setLeadsMonthCount] = useState(0)
  const [leadsPrevMonthCount, setLeadsPrevMonthCount] = useState(0)
  const [convertedMonth, setConvertedMonth] = useState(0)
  const [myLeads, setMyLeads] = useState<{ id: string; status: string }[]>([])
  const [openLeads, setOpenLeads] = useState<Lead[]>([])
  const [visitsToday, setVisitsToday] = useState<Visit[]>([])
  const [visitsWeek, setVisitsWeek] = useState(0)
  const [visitsNoBaixa, setVisitsNoBaixa] = useState(0)
  const [waMessages, setWaMessages] = useState<WaMessage[]>([])
  const [convs, setConvs] = useState<Conv[]>([])
  const [queueCount, setQueueCount] = useState(0)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [enrollMonth, setEnrollMonth] = useState(0)
  const [enrollPrev, setEnrollPrev] = useState(0)
  const [enrollCampaign, setEnrollCampaign] = useState<number | null>(null)
  const [waiting, setWaiting] = useState<Map<string, Waiting>>(new Map())
  const [mine, setMine] = useState<Mine | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [reminderPage, setReminderPage] = useState(0)

  useEffect(() => { if (institutionId && userId) void loadAll() }, [institutionId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Matrículas da campanha (assim que a campanha ativa carrega).
  useEffect(() => {
    if (!institutionId || !userId || !campaign) { setEnrollCampaign(null); return }
    let alive = true
    supabase.from('enrollments').select('id', { count: 'exact', head: true })
      .eq('institution_id', institutionId).eq('user_id', userId).is('cancelled_at', null)
      .gte('enrollment_date', campaign.start).then(({ count }) => { if (alive) setEnrollCampaign(count ?? 0) })
    return () => { alive = false }
  }, [institutionId, userId, campaign?.start]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    if (!institutionId || !userId) return
    setLoading(true)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart); tomorrowStart.setDate(tomorrowStart.getDate() + 1)
    const weekEnd = new Date(todayStart); weekEnd.setDate(weekEnd.getDate() + 7)
    const since24h = new Date(now.getTime() - 24 * 3600 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const ninetyAgo = new Date(todayStart); ninetyAgo.setDate(ninetyAgo.getDate() - 90)

    const [
      recentRes, todayRes, monthRes, prevMonthRes, openAll, allMine,
      visitsRes, weekRes, noBaixaRes, waAll, transfersRes, enrollMonthRes, enrollPrevRes, myConvsRes, queueRes, waitRes, statsRes,
    ] = await Promise.all([
      supabase.from('leads').select('id, student_name, responsible_name, status, custom_stage_id, created_at, phone, grade_interest')
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null).order('created_at', { ascending: false }).limit(10),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null).gte('created_at', todayStart.toISOString()),
      supabase.from('leads').select('id, status', { count: 'exact' })
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null).gte('created_at', monthStart.toISOString()),
      supabase.from('leads').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null)
        .gte('created_at', prevMonthStart.toISOString()).lt('created_at', monthStart.toISOString()),
      fetchAllPages<Lead>((from, to) => supabase.from('leads')
        .select('id, student_name, responsible_name, status, created_at, phone, next_followup')
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null)
        .not('status', 'in', '(enrolled,lost)').order('created_at', { ascending: true }).range(from, to)),
      fetchAllPages<{ id: string; status: string }>((from, to) => supabase.from('leads').select('id, status')
        .eq('institution_id', institutionId).eq('assigned_to', userId).is('deleted_at', null).order('created_at').range(from, to)),
      supabase.from('visits').select('id, lead_id, status, scheduled_date, created_at, student_name')
        .eq('institution_id', institutionId).eq('assigned_to', userId)
        .gte('scheduled_date', todayStart.toISOString()).lt('scheduled_date', tomorrowStart.toISOString()).order('scheduled_date'),
      supabase.from('visits').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId).eq('status', 'scheduled')
        .gte('scheduled_date', todayStart.toISOString()).lt('scheduled_date', weekEnd.toISOString()),
      supabase.from('visits').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('assigned_to', userId).eq('status', 'scheduled').lt('scheduled_date', now.toISOString()),
      fetchAllPages<WaMessage>((from, to) => supabase.from('whatsapp_messages').select('id, from_me, created_at, remote_jid')
        .eq('institution_id', institutionId).gte('created_at', since24h.toISOString())
        .not('remote_jid', 'ilike', '%@g.us').order('created_at').range(from, to)),
      supabase.from('student_transfers').select('id, student_name, course_grade, status, created_at, survey_token, ai_diagnosis')
        .eq('institution_id', institutionId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('enrollments').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('user_id', userId).is('cancelled_at', null).gte('enrollment_date', monthStart.toISOString()),
      supabase.from('enrollments').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('user_id', userId).is('cancelled_at', null)
        .gte('enrollment_date', prevMonthStart.toISOString()).lt('enrollment_date', monthStart.toISOString()),
      supabase.from('whatsapp_conversations').select('remote_jid, status, unread_count, last_message_at')
        .eq('institution_id', institutionId).eq('assigned_user_id', userId).neq('status', 'closed'),
      supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId).eq('status', 'waiting').is('assigned_user_id', null).not('remote_jid', 'ilike', '%@g.us'),
      supabase.rpc('lead_waiting', { p_institution_id: institutionId }),
      supabase.rpc('my_home_stats', { p_inst: institutionId, p_from: ymd(ninetyAgo), p_to: ymd(now) }),
    ])

    setLeadsRecent((recentRes.data as Lead[]) ?? [])
    setLeadsTodayCount(todayRes.count ?? 0)
    const monthRows = (monthRes.data as { id: string; status: string }[]) ?? []
    setLeadsMonthCount(monthRes.count ?? monthRows.length)
    setConvertedMonth(monthRows.filter(l => l.status === 'enrolled').length)
    setLeadsPrevMonthCount(prevMonthRes.count ?? 0)
    setOpenLeads(openAll)
    setMyLeads(allMine)
    setReminderPage(0)
    setVisitsToday((visitsRes.data as Visit[]) ?? [])
    setVisitsWeek(weekRes.count ?? 0)
    setVisitsNoBaixa(noBaixaRes.count ?? 0)
    const mc = (myConvsRes.data ?? []) as Conv[]
    setConvs(mc)
    const myJids = new Set(mc.map(c => c.remote_jid))
    setWaMessages(waAll.filter(m => myJids.has(m.remote_jid)))
    setQueueCount(queueRes.count ?? 0)
    setTransfers((transfersRes.data as Transfer[]) ?? [])
    setEnrollMonth(enrollMonthRes.count ?? 0)
    setEnrollPrev(enrollPrevRes.count ?? 0)
    const myIds = new Set(openAll.map(l => l.id))
    setWaiting(new Map(((waitRes.data ?? []) as Waiting[]).filter(w => w.side && myIds.has(w.lead_id)).map(w => [w.lead_id, w])))
    const st = statsRes.data as { eu: Mine | null; equipe: Team } | null
    setMine(st?.eu ?? null); setTeam(st?.equipe ?? null)
    refreshInteractions()
    setLoading(false)
  }

  // ── derivados ──
  const leadsById = useMemo(() => new Map(openLeads.map(l => [l.id, l])), [openLeads])
  const waitingList = useMemo(() => [...waiting.values()].sort((a, b) => +new Date(a.since) - +new Date(b.since)), [waiting])
  const waitUs = waitingList.filter(w => w.side === 'us')
  const waitFamily = waitingList.filter(w => w.side === 'family')
  const reminders = useMemo(() => openLeads
    .map(l => ({ lead: l, reminder: getLeadReminderInfo(l, optsFor(l.id)) }))
    .filter((x): x is { lead: Lead; reminder: NonNullable<ReturnType<typeof getLeadReminderInfo>> } => x.reminder !== null)
    .sort((a, b) => ({ overdue: 0, today: 1, stale: 2, upcoming: 3 } as const)[a.reminder.urgency] - ({ overdue: 0, today: 1, stale: 2, upcoming: 3 } as const)[b.reminder.urgency]),
  [openLeads, optsFor])
  const remindersDue = reminders.filter(r => r.reminder.urgency === 'overdue' || r.reminder.urgency === 'today').length
  const stageCounts = useMemo(() => {
    const m: Record<string, number> = {}
    myLeads.forEach(l => { m[l.status] = (m[l.status] || 0) + 1 })
    return m
  }, [myLeads])
  const totalLeads = myLeads.length
  const pendingLeads = openLeads.length
  const stale = openLeads.filter(l => daysSince(l.created_at) >= 0 && getLeadReminderInfo(l, optsFor(l.id))?.urgency === 'stale').length

  const waReceived = waMessages.filter(m => !m.from_me).length
  const waSent = waMessages.filter(m => m.from_me).length
  const unread = convs.reduce((s, c) => s + (c.unread_count ?? 0), 0)
  const unreadConvs = convs.filter(c => (c.unread_count ?? 0) > 0).length
  const stoppedConvs = convs.filter(c => c.last_message_at && Date.now() - +new Date(c.last_message_at) > 2 * 86400000).length
  const openConvs = convs.filter(c => c.status === 'open').length

  const enrollVar = enrollPrev > 0 ? Math.round(((enrollMonth - enrollPrev) / enrollPrev) * 100) : null
  const leadsVar = leadsPrevMonthCount > 0 ? Math.round(((leadsMonthCount - leadsPrevMonthCount) / leadsPrevMonthCount) * 100) : null
  const conversion = leadsMonthCount > 0 ? +((convertedMonth / leadsMonthCount) * 100).toFixed(1) : 0
  const goalRef = Math.max(enrollPrev, 1)
  const goalPct = Math.min(100, Math.round((enrollMonth / goalRef) * 100))

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
  const firstName = user?.full_name?.split(' ')[0]
  const todayLabel = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const needsAction = waitUs.length + remindersDue + visitsNoBaixa + unreadConvs

  const go = (p: string) => () => navigate(p)

  if (loading) return <div style={{ background: BRAND.bg, minHeight: '100%' }}><style>{LEADS_CSS}</style><PageSkeleton /></div>

  const twoCol: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 16, alignItems: 'start' }
  const kpiGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(168px, 1fr))', gap: 12 }
  const sectionTitle = (t: string, sub?: string) => (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', margin: '4px 2px 0' }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t}</h2>
      {sub && <span style={{ fontSize: 12, color: BRAND.faint }}>{sub}</span>}
    </div>
  )

  return (
    <div {...aSwipe} style={{ padding: 'clamp(12px, 3vw, 24px)', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', background: BRAND.bg }}>
      <style>{LEADS_CSS}</style>

      <PageHeader icon={Home}
        title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle={<span>{todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)} · {user?.institution_name || 'Escola'}</span>}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}><CountUp value={enrollMonth} /></div>
              <div style={{ fontSize: 10.5, fontWeight: 700, opacity: .9, marginTop: 2 }}>matrículas no mês</div>
            </span>
            <span style={{ background: needsAction ? '#fff' : 'rgba(255,255,255,.16)', color: needsAction ? '#B91C1C' : '#fff', border: needsAction ? 'none' : '1px solid rgba(255,255,255,.3)', borderRadius: 14, padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1 }}><CountUp value={needsAction} /></div>
              <div style={{ fontSize: 10.5, fontWeight: 700, opacity: .9, marginTop: 2 }}>pedem ação agora</div>
            </span>
          </div>
        } />

      {isMobile && <PillTabs tour="home-abas" tabs={A_TABS} value={aTab} onChange={id => setATab(id as ATab)} />}

      <AT id="agora" tab={aTab} mobile={isMobile}>
      {/* ── Preciso agir agora ── */}
      {sectionTitle('Preciso agir agora', 'o que está esperando por você')}
      <div className={isMobile ? 'aion-snap' : undefined} style={kpiGrid}>
        <Kpi label="Famílias esperando" value={waitUs.length} sub="mandaram mensagem e aguardam a escola" color="#B91C1C" icon={<AlertCircle size={16} />} alert={waitUs.length > 0} onClick={go('/leads?owner=mine&filter=us')} delay={0} />
        <Kpi label="Sem retorno da família" value={waitFamily.length} sub="esperando a família responder" color="#B45309" icon={<UserX size={16} />} onClick={go('/leads?owner=mine&filter=family')} delay={50} />
        <Kpi label="Lembretes vencidos" value={remindersDue} sub={`${reminders.length} no total · ${stale} sem contato`} color="#D97706" icon={<Bell size={16} />} alert={remindersDue > 0} onClick={go('/leads?owner=mine&filter=no_contact')} delay={100} />
        <Kpi label="Visitas sem baixa" value={visitsNoBaixa} sub="já passaram e faltam dar baixa" color="#8b5cf6" icon={<CalendarX size={16} />} alert={visitsNoBaixa > 0} onClick={go('/visits?pendentes=1')} delay={150} />
        <Kpi label="Conversas não lidas" value={unread} sub={`${unreadConvs} conversa${unreadConvs === 1 ? '' : 's'} · ${queueCount} na fila da escola`} color="#10B981" icon={<MessageCircle size={16} />} onClick={go('/whatsapp')} delay={200} />
      </div>

      <div style={twoCol}>
        {/* Fazer agora */}
        <Panel title="Fazer agora" icon={<Hourglass size={15} />} color="#B91C1C" link="Ver todas" onLink={go('/leads?owner=mine&filter=us')} delay={60}>
          {waitUs.length === 0 ? <Empty icon={<CheckCircle size={20} />} text="Nenhuma família esperando resposta. Tudo em dia!" /> : (
            <div>
              {waitUs.slice(0, 6).map((w, i) => {
                const l = leadsById.get(w.lead_id)
                const name = l?.responsible_name || l?.student_name || 'Família'
                const d = daysSince(w.since)
                return (
                  <Row key={w.lead_id} delay={i * 30} onClick={() => navigate(l?.phone ? `/whatsapp?phone=${digitsOnly(l.phone)}` : '/whatsapp')}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{initialsOf(name)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}{l?.student_name && l.responsible_name ? <span style={{ fontWeight: 500, color: BRAND.muted }}> · {l.student_name}</span> : null}</div>
                      {w.last_text && <div style={{ fontSize: 12, color: BRAND.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{w.last_text}”</div>}
                    </div>
                    <span style={{ background: d >= 2 ? '#FEE2E2' : '#FEF3C7', color: d >= 2 ? '#B91C1C' : '#B45309', fontSize: 11, padding: '2px 9px', borderRadius: 99, fontWeight: 800, whiteSpace: 'nowrap' }}>{waitLabel(w.since)}</span>
                    <button type="button" style={pillBtn('#15803D', '#DCFCE7')} onClick={e => { e.stopPropagation(); navigate(l?.phone ? `/whatsapp?phone=${digitsOnly(l.phone)}` : '/whatsapp') }}>Responder</button>
                  </Row>
                )
              })}
              {waitUs.length > 6 && <div style={{ padding: '9px 16px', fontSize: 12, color: BRAND.muted }}>+ {waitUs.length - 6} famílias esperando</div>}
            </div>
          )}
        </Panel>

        {/* Lembretes */}
        <Panel title="Meus lembretes" icon={<Bell size={15} />} color="#D97706" link="Ver leads" onLink={go('/leads?owner=mine&filter=no_contact')} delay={110}>
          {reminders.length === 0 ? <Empty icon={<CheckCircle size={20} />} text="Nenhum lembrete pendente" /> : (
            <div>
              {reminders.slice(reminderPage * REMINDERS_PAGE_SIZE, (reminderPage + 1) * REMINDERS_PAGE_SIZE).map(({ lead, reminder }, i) => {
                const c = REMINDER_COLORS[reminder.urgency]
                return (
                  <Row key={lead.id} delay={i * 30}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bell size={14} color={c.color} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.student_name || lead.responsible_name || '—'}</div>
                      <div style={{ fontSize: 11, color: c.color, fontWeight: 700, marginTop: 1 }}>{reminder.label}</div>
                    </div>
                    <button type="button" onClick={() => navigate(`/leads?open=${lead.id}`)} style={pillBtn(c.color, c.bg)}>Retomar</button>
                  </Row>
                )
              })}
              {reminders.length > REMINDERS_PAGE_SIZE && (
                <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5, color: BRAND.muted }}>
                  <span>{reminderPage * REMINDERS_PAGE_SIZE + 1}–{Math.min((reminderPage + 1) * REMINDERS_PAGE_SIZE, reminders.length)} de {reminders.length}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={reminderPage === 0} onClick={() => setReminderPage(p => p - 1)} style={{ ...pillBtn(BRAND.ink, '#fff'), border: `1px solid ${BRAND.line}`, opacity: reminderPage === 0 ? .4 : 1 }}>Anterior</button>
                    <button disabled={(reminderPage + 1) * REMINDERS_PAGE_SIZE >= reminders.length} onClick={() => setReminderPage(p => p + 1)} style={{ ...pillBtn(BRAND.ink, '#fff'), border: `1px solid ${BRAND.line}`, opacity: (reminderPage + 1) * REMINDERS_PAGE_SIZE >= reminders.length ? .4 : 1 }}>Próxima</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      </AT>
      <AT id="mes" tab={aTab} mobile={isMobile}>
      {/* ── Meu mês ── */}
      {sectionTitle('Meu mês', 'comparado com o mês anterior')}
      <div className={isMobile ? 'aion-snap' : undefined} style={kpiGrid}>
        <Kpi label="Matrículas no mês" value={enrollMonth} sub={enrollVar === null ? 'sem base no mês anterior' : `${enrollVar >= 0 ? '+' : ''}${enrollVar}% vs. mês anterior (${enrollPrev})`} color="#2DCBA4" icon={<GraduationCap size={16} />} onClick={go('/leads?owner=mine&filter=enrolled')} delay={0} />
        <Kpi label="Matrículas na campanha" value={enrollCampaign ?? 0} sub={campaign ? campaign.label : 'sem campanha ativa'} color="#05907B" icon={<Trophy size={16} />} onClick={go('/campanha')} delay={50} />
        <Kpi label="Meus leads no mês" value={leadsMonthCount} sub={leadsVar === null ? `${leadsTodayCount} hoje` : `${leadsVar >= 0 ? '+' : ''}${leadsVar}% vs. mês anterior · ${leadsTodayCount} hoje`} color="#3b82f6" icon={<Users size={16} />} onClick={go('/leads?owner=mine')} delay={100} />
        <Kpi label="Taxa de conversão" value={conversion} suffix="%" sub={`${convertedMonth} de ${leadsMonthCount} leads do mês`} color="#F59E0B" icon={<Target size={16} />} onClick={go('/leads?owner=mine&filter=enrolled')} delay={150} />
      </div>

      <Panel title="Meta do mês" icon={<Target size={15} />} color="#2DCBA4" delay={80} pad>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: BRAND.muted }}>Superar as <b style={{ color: BRAND.ink }}>{enrollPrev}</b> matrículas do mês passado</span>
          <Delta v={enrollVar} />
        </div>
        <div style={{ height: 12, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${enrollPrev === 0 && enrollMonth === 0 ? 0 : Math.max(goalPct, 4)}%`, background: GRAD, borderRadius: 99, transition: 'width 1s cubic-bezier(.22,1,.36,1)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: BRAND.muted }}>
          <span><b style={{ color: BRAND.ink }}>{enrollMonth}</b> fechadas</span>
          <span>{enrollMonth >= enrollPrev && enrollPrev > 0 ? 'Meta batida — continue!' : enrollPrev > 0 ? `faltam ${Math.max(enrollPrev - enrollMonth + 1, 0)} para superar` : 'sem meta de referência'}</span>
        </div>
      </Panel>

      {/* ── Minha carteira ── */}
      {sectionTitle('Minha carteira de leads', `${totalLeads} no total · ${pendingLeads} em andamento`)}
      <Panel title="Leads por etapa do funil" icon={<Users size={15} />} color="#3b82f6" link="Abrir leads" onLink={go('/leads?owner=mine')} delay={60} pad>
        {totalLeads === 0 ? <Empty icon={<Users size={20} />} text="Nenhum lead atribuído a você ainda" /> : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', height: 16, borderRadius: 99, overflow: 'hidden', background: '#EEF3F2' }}>
              {STAGE_ORDER.filter(s => stageCounts[s]).map(s => (
                <span key={s} title={`${stageLabel(s)}: ${stageCounts[s]}`} style={{ width: `${(stageCounts[s] / totalLeads) * 100}%`, background: STAGE_COLOR[s], transition: 'width .8s cubic-bezier(.22,1,.36,1)' }} />
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))', gap: 8 }}>
              {STAGE_ORDER.map(s => (
                <button key={s} type="button" onClick={go('/leads?owner=mine')} className="ld-card"
                  style={{ textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: STAGE_COLOR[s], flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: BRAND.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stageLabel(s)}</span>
                  <b style={{ fontSize: 15, color: BRAND.ink }}>{stageCounts[s] || 0}</b>
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      </AT>
      <AT id="atend" tab={aTab} mobile={isMobile}>
      {/* ── Meu atendimento × equipe ── */}
      {sectionTitle('Meu atendimento', 'últimos 90 dias · comparado com a média da equipe')}
      <div style={twoCol}>
        <Panel title="Eu × equipe" icon={<Timer size={15} />} color="#05907B" delay={60} pad>
          {!mine ? <Empty icon={<MessageCircle size={20} />} text="Ainda não há conversas suas neste período" /> : (
            <div style={{ display: 'grid', gap: 16 }}>
              <VsRow label="Primeira resposta" hint="mediana" me={mine.resp_mediana_min} team={team?.resp_mediana_min ?? null} fmt={fmtMin} lowerBetter />
              <VsRow label="Tempo até encerrar" hint="mediana" me={mine.resolucao_mediana_h} team={team?.resolucao_mediana_h ?? null} fmt={fmtH} lowerBetter delay={80} />
              <VsRow label="Conversas atendidas" me={mine.conversas} team={team?.conversas_media ?? null} fmt={n => n == null ? '—' : String(Math.round(n))} delay={160} />
            </div>
          )}
        </Panel>
        <Panel title="Satisfação dos atendimentos" icon={<Star size={15} />} color="#F59E0B" delay={110} pad>
          {!mine || mine.satisfacao == null ? <Empty icon={<Star size={20} />} text="Nenhuma avaliação recebida ainda" /> : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EEF3F2" strokeWidth="3.4" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F59E0B" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${(satPct(mine.satisfacao) ?? 0) * 0.974} 100`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}><CountUp value={satPct(mine.satisfacao) ?? 0} />%</span>
                  <span style={{ fontSize: 10.5, color: BRAND.muted, fontWeight: 700 }}>satisfeitas</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 160, display: 'grid', gap: 6, fontSize: 13, color: BRAND.muted }}>
                <div>Nota média <b style={{ color: BRAND.ink }}>{mine.satisfacao.toFixed(2)}</b> <span style={{ color: BRAND.faint }}>(de 1 a 3)</span></div>
                <div><b style={{ color: BRAND.ink }}>{mine.avaliacoes}</b> avaliações recebidas</div>
                {team?.satisfacao != null && (
                  <div>Equipe: <b style={{ color: BRAND.ink }}>{satPct(team.satisfacao)}%</b>{' '}
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: mine.satisfacao >= team.satisfacao ? '#DCFCE7' : '#FEF3C7', color: mine.satisfacao >= team.satisfacao ? '#15803D' : '#B45309' }}>
                      {mine.satisfacao >= team.satisfacao ? 'acima da média' : 'abaixo da média'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Conversas ── */}
      {sectionTitle('Minhas conversas', 'WhatsApp')}
      <div className={isMobile ? 'aion-snap' : undefined} style={kpiGrid}>
        <Kpi label="Abertas comigo" value={openConvs} sub="em atendimento agora" color="#10B981" icon={<MessageCircle size={16} />} onClick={go('/whatsapp')} />
        <Kpi label="Na fila da escola" value={queueCount} sub="sem atendente — qualquer um pode assumir" color="#D97706" icon={<Inbox size={16} />} alert={queueCount > 0} onClick={go('/whatsapp')} delay={50} />
        <Kpi label="Paradas" value={stoppedConvs} sub="sem movimento há mais de 2 dias" color="#C2410C" icon={<Clock size={16} />} onClick={go('/whatsapp')} delay={100} />
        <Kpi label="Mensagens (24h)" value={waReceived} sub={`recebidas · ${waSent} enviadas`} color="#0F6E56" icon={<ArrowRightLeft size={16} />} onClick={go('/whatsapp')} delay={150} />
      </div>

      </AT>
      <AT id="agenda" tab={aTab} mobile={isMobile}>
      {/* ── Visitas | Leads recentes ── */}
      <div style={twoCol}>
        <Panel title="Minhas visitas de hoje" icon={<Calendar size={15} />} color="#8b5cf6" link="Ver agenda" onLink={go('/visits')} delay={60}>
          <div style={{ padding: '10px 16px', borderBottom: `1px solid ${BRAND.line}`, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
            <span style={{ background: '#f5f3ff', color: '#6D28D9', fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{visitsToday.length} hoje</span>
            <span style={{ background: BRAND.softer, color: BRAND.primaryDark, fontWeight: 800, padding: '3px 10px', borderRadius: 99 }}>{visitsWeek} nos próximos 7 dias</span>
            {visitsNoBaixa > 0 && <button type="button" onClick={go('/visits?pendentes=1')} style={{ ...pillBtn('#B91C1C', '#FEE2E2'), padding: '3px 10px', borderRadius: 99 }}>{visitsNoBaixa} sem baixa</button>}
          </div>
          {visitsToday.length === 0 ? <Empty icon={<Calendar size={20} />} text="Nenhuma visita agendada para hoje" /> : (
            <div>
              {visitsToday.slice(0, 6).map((v, i) => {
                const cfg = visitStatusCfg[v.status] || visitStatusCfg.scheduled
                return (
                  <Row key={v.id} delay={i * 30}>
                    <div style={{ width: 42, textAlign: 'center', borderRadius: 11, background: '#f5f3ff', padding: '5px 0', flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#6D28D9', lineHeight: 1.1 }}>{fmtTime(v.scheduled_date)}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.student_name || `Lead #${v.lead_id?.slice(0, 6)}`}</div>
                      <div style={{ fontSize: 11.5, color: BRAND.faint }}>{fmtDate(v.scheduled_date)}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: cfg.color, background: cfg.bg }}>{cfg.label}</span>
                    {v.status === 'scheduled' && <button type="button" onClick={go('/visits')} style={pillBtn('#0F6E56', '#f0fdf4')}>Confirmar</button>}
                  </Row>
                )
              })}
            </div>
          )}
        </Panel>

        <Panel title="Meus leads recentes" icon={<Users size={15} />} color="#3b82f6" link="Ver todos" onLink={go('/leads?owner=mine')} delay={110}>
          {leadsRecent.length === 0 ? <Empty icon={<Users size={20} />} text="Nenhum lead atribuído a você ainda" /> : (
            <div>
              {leadsRecent.slice(0, 6).map((lead, i) => {
                const color = STAGE_COLOR[lead.status] || '#3b82f6'
                const wa = lead.phone ? toWaLink(lead.phone) : null
                return (
                  <Row key={lead.id} delay={i * 30} onClick={() => navigate(`/leads?open=${lead.id}`)}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: `${color}1A`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12.5, flexShrink: 0 }}>{initialsOf(lead.responsible_name || lead.student_name || '?')}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.student_name || lead.responsible_name || '—'}</div>
                      {lead.phone && <div style={{ fontSize: 11.5, color: BRAND.faint }}>{lead.phone}</div>}
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color, background: `${color}14`, flexShrink: 0, whiteSpace: 'nowrap' }}>{leadCustomStage(lead as never)?.label ?? stageLabel(lead.status)}</span>
                    {lead.phone && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <a href={`tel:${digitsOnly(lead.phone)}`} title="Ligar" style={iconBtn('#3b82f6', '#eff6ff')}><Phone size={13} /></a>
                        {wa && <a href={wa} target="_blank" rel="noreferrer" title="WhatsApp" style={iconBtn('#10B981', '#d1fae5')}><MessageCircle size={13} /></a>}
                      </div>
                    )}
                  </Row>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── Transferências recentes (feed da escola) ── */}
      <Panel title="Transferências recentes" icon={<ArrowRightLeft size={15} />} color="#dc2626" link="Ver todas" onLink={go('/transferencias')} delay={60}>
        {transfers.length === 0 ? <Empty icon={<CheckCircle size={20} />} text="Nenhuma transferência registrada" /> : (
          <div>
            {transfers.map((t, i) => {
              const info = transferStatusInfo(t)
              const needsLink = !t.survey_token && !t.ai_diagnosis && t.status !== 'cancelled'
              return (
                <Row key={t.id} delay={i * 30}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: info.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {needsLink ? <AlertCircle size={14} color="#dc2626" /> : <CheckCircle size={14} color={info.color} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.student_name}</div>
                    <div style={{ fontSize: 11.5, color: BRAND.faint }}>{t.course_grade}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, padding: '3px 9px', borderRadius: 999, color: info.color, background: info.bg, whiteSpace: 'nowrap' }}>{info.label}</span>
                  {needsLink && <button type="button" onClick={go('/transferencias')} style={pillBtn('#dc2626', '#fef2f2')}>Gerar link</button>}
                </Row>
              )
            })}
          </div>
        )}
      </Panel>

      {/* ── Ações rápidas ── */}
      <section className="ld-in" style={{ ...card, padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ações rápidas</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([
            { label: 'Novo lead', path: '/leads', color: '#2DCBA4', bg: '#f5f3ff', Icon: Plus },
            { label: 'Agendar visita', path: '/visits', color: '#0F6E56', bg: '#f0fdf4', Icon: Calendar },
            { label: 'Registrar transferência', path: '/transferencias', color: '#dc2626', bg: '#fef2f2', Icon: ArrowRightLeft },
            { label: 'Abrir WhatsApp', path: '/whatsapp', color: '#10B981', bg: '#d1fae5', Icon: MessageCircle },
          ] as const).map(a => (
            <button key={a.label} type="button" onClick={go(a.path)} className="ld-card"
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: a.bg, color: a.color, border: `1px solid ${a.color}30`, borderRadius: 12, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
              <a.Icon size={15} />{a.label}
            </button>
          ))}
        </div>
      </section>
      </AT>
    </div>
  )
}
