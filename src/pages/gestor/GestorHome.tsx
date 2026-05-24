import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar
} from 'recharts'
import {
  Users, TrendingUp, RefreshCw, AlertTriangle, BarChart3,
  Target, Sparkles, ArrowRight, Upload, MessageCircle, Info, Lock,
  MapPin, Activity, Settings, Calendar, Trophy, Medal,
  GraduationCap, ArrowUpRight, ArrowDownRight, Zap,
  Building2, CheckCircle, Bell, ChevronRight, Star,
  TrendingDown, Eye, Clock, Award
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CampaignGeneratorModal from '../../components/reports/CampaignGeneratorModal'
import SchoolSetupModal from '../../components/onboarding/SchoolSetupModal'
import type { FunnelMetrics } from '../../lib/supabase'
import { createNotification } from '../../lib/notifications'

// ─── tipos ────────────────────────────────────────────────────────────────────
interface HistoricalEntry {
  detected_year?: number; year?: number
  total_students?: number; total?: number
  new_students?: number; novatos?: number
  returning_students?: number; veterans?: number
  avg_monthly_fee?: number; fee?: number
  error?: boolean; historical_funnel?: Record<string, number> | null
}

interface CampaignCycle {
  id: string; institution_id: string; year: number; label: string
  start_date: string; end_date: string; target_new_students: number
  target_reenrollment_rate: number; base_students: number
  projected_cpa: number | null; created_at: string
  campaign_start_month?: number | null
  erp_files?: HistoricalEntry[] | null
  historical_data?: HistoricalEntry[] | null
  school_data?: { city?: string; state?: string; name?: string; avg_monthly_fee?: number; current_students?: number; grades?: string[]; [key: string]: unknown } | null
  status?: string | null; applied_at?: string | null
  market_data?: MarketData | null; market_data_fetched_at?: string | null
  score?: number | null; score_calculated_at?: string | null
}

interface MarketData {
  city?: string; state?: string
  school_age_population?: number; private_school_rate?: number
  sector_growth?: number; sector_growth_rate?: number
  avg_students_per_school?: number; average_students_per_school?: number
  confidence?: string; notes?: string; novatos_rate?: number
  total_private_schools?: number
  inep_data?: {
    school_classification?: string
    main_competitors?: string[]
    market_opportunity?: string
    risk_factors?: string
    strengths?: string[]
    weaknesses?: string[]
  }
  [key: string]: unknown
}

interface UserRanking {
  user_id: string; full_name: string; role: string
  enrollments_count: number; leads_count: number
}

interface StudentTransfer {
  id: string; student_name: string; course_grade: string
  transfer_date: string; reason_category: string | null
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTH_SHORT: Record<number, string> = { 1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez' }

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }
function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function calcCampaignTiming(startMonth = 8) {
  const today = new Date()
  const campaignYear = today.getFullYear() + 1
  const campaignDate = new Date(today.getFullYear(), startMonth - 1, 1)
  const monthsUntil = Math.max(0, (campaignDate.getFullYear() - today.getFullYear()) * 12 + campaignDate.getMonth() - today.getMonth())
  return { monthsUntil, campaignStartMonth: `${MONTH_NAMES_PT[startMonth - 1]}/${today.getFullYear()}`, campaignYear }
}

function getCampaignMonthsList(startDate?: string, endDate?: string): number[] {
  if (!startDate || !endDate) return [8, 9, 10, 11, 12, 1, 2]
  const months: number[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const cur = new Date(start)
  while (cur <= end && months.length < 12) { months.push(cur.getMonth() + 1); cur.setMonth(cur.getMonth() + 1) }
  return months.length > 0 ? months : [8, 9, 10, 11, 12, 1, 2]
}

function entryYear(e: HistoricalEntry) { return e.detected_year ?? e.year ?? 0 }
function entryTotal(e: HistoricalEntry) { return e.total_students ?? e.total ?? 0 }
function entryNew(e: HistoricalEntry) { return e.new_students ?? e.novatos ?? 0 }
function entryReturning(e: HistoricalEntry) { return e.returning_students ?? e.veterans ?? 0 }

function calculateScore(data: { growthTrend: number; reenrollRate: number; marketShare: number; conversionRate: number; hasHistorical: boolean }) {
  let score = 50
  if (data.growthTrend > 5) score += 15
  else if (data.growthTrend > 0) score += 8
  else if (data.growthTrend > -10) score -= 5
  else score -= 15
  if (data.reenrollRate >= 90) score += 15
  else if (data.reenrollRate >= 80) score += 8
  else if (data.reenrollRate < 70) score -= 10
  if (data.marketShare >= 20) score += 10
  else if (data.marketShare >= 10) score += 5
  else score -= 5
  if (data.conversionRate >= 25) score += 10
  else if (data.conversionRate >= 15) score += 5
  if (data.hasHistorical) score += 5
  return Math.min(100, Math.max(0, score))
}

const REASON_LABELS: Record<string, string> = {
  financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Distância',
  competition: 'Outra escola', relocation: 'Mudança de cidade', other: 'Outro'
}

// ─── sub-componentes ──────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, variation, sub, onClick }: {
  label: string; value: string; icon: React.ReactNode; iconBg: string
  variation?: number | null; sub?: string; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0',
        padding: '16px 18px', cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.15s'
      }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {variation !== null && variation !== undefined && (
        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: variation >= 0 ? '#f0fdf4' : '#fef2f2', color: variation >= 0 ? '#16a34a' : '#dc2626' }}>
          {variation >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />} {Math.abs(variation)}% vs. ano anterior
        </div>
      )}
      {sub && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}

function SectionCard({ title, subtitle, icon, iconBg, iconColor, action, actionLabel, children }: {
  title: string; subtitle?: string; icon: React.ReactNode; iconBg: string; iconColor: string
  action?: () => void; actionLabel?: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {React.cloneElement(icon as React.ReactElement, { size: 16, color: iconColor })}
          </div>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{title}</h3>
            {subtitle && <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button onClick={action} style={{ fontSize: 11, color: iconColor, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            {actionLabel} <ChevronRight size={12} />
          </button>
        )}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────
export default function GestorHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const institutionId = user?.institution_id!

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  const [loading, setLoading] = useState(true)
  const [cycles, setCycles] = useState<CampaignCycle[]>([])
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [leads, setLeads] = useState<{ id: string; status: string; created_at: string; grade_interest?: string; source?: string }[]>([])
  const [visits, setVisits] = useState<{ id: string; status: string; created_at: string }[]>([])
  const [waMessages, setWaMessages] = useState<{ id: string; created_at: string; from_me: boolean; remote_jid: string }[]>([])
  const [waPhoneRecord, setWaPhoneRecord] = useState<{ phone_number: string; display_name: string } | null>(null)
  const [waConvStats, setWaConvStats] = useState<{ total: number; byBot: number; byTeam: number; closed: number; daily: { day: string; count: number }[]; avgSatisfaction: number | null } | null>(null)
  const [waTeamRanking, setWaTeamRanking] = useState<{ userId: string; count: number }[]>([])
  const [waAvgResponse, setWaAvgResponse] = useState<number | null>(null)
  const [waSatisfStats, setWaSatisfStats] = useState<{ total: number; ruim: number; regular: number; otimo: number; avgScore: number; byAttendant: { name: string; total: number; sum: number }[] } | null>(null)
  const [rankingMode, setRankingMode] = useState<'matriculas' | 'whatsapp' | 'satisfacao'>('matriculas')
  const [userRankings, setUserRankings] = useState<UserRanking[]>([])
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showModalAtStep, setShowModalAtStep] = useState<number | undefined>(undefined)
  const [showSetup, setShowSetup] = useState(false)
  const [setupInitialStep, setSetupInitialStep] = useState(1)
  const [btnTooltip, setBtnTooltip] = useState(false)
  const [scoreTooltip, setScoreTooltip] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const aiInsightFetched = useRef(false)
  const [aiExpanded, setAiExpanded] = useState(false)
  const mountedRef = useRef(true)
  const [periodFilter, setPeriodFilter] = useState('mes')
  const [waConvsRaw, setWaConvsRaw] = useState<{ id: string; created_at: string; status: string; assigned_user_name: string | null; assigned_user_id: string | null; bot_active: boolean | null; satisfaction_score: number | null; first_response_at: string | null; remote_jid: string }[]>([])
  const [surveyScoresList, setSurveyScoresList] = useState<{ satisfaction_score: number | null }[]>([])
  const [aiLastUpdated, setAiLastUpdated] = useState<number | null>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const [prevLeadsCount, setPrevLeadsCount] = useState(0)
  const [prevEnrolled, setPrevEnrolled] = useState(0)
  const [activeConvsNow, setActiveConvsNow] = useState(0)
  const [avgResponseByAttendant, setAvgResponseByAttendant] = useState<Record<string,number>>({})
  const [badgeTooltip, setBadgeTooltip] = useState(false)

  const getPeriodRange = () => {
    const now = new Date()
    const end = now.toISOString()
    let start: string
    switch (periodFilter) {
      case 'hoje':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); break
      case 'semana': {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        start = d.toISOString(); break
      }
      case 'ano':
        start = new Date(now.getFullYear(), 0, 1).toISOString(); break
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    }
    return { start, end }
  }

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => { if (!institutionId) return; load() }, [institutionId, periodFilter])

  async function load() {
    setLoading(true)
    try {
      const { start, end } = getPeriodRange()
      const [cyclesRes, funnelRes, transferRes, leadsRes, visitsRes, waRes, enrollRes, usersRes, waPhoneRes, waConvsRes] = await Promise.all([
        supabase.from('campaign_cycles').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
        supabase.from('funnel_metrics').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('student_transfers').select('id,student_name,course_grade,transfer_date,reason_category').eq('institution_id', institutionId).is('deleted_at', null).order('transfer_date', { ascending: false }).limit(5),
        supabase.from('leads').select('id,status,created_at,grade_interest,source').eq('institution_id', institutionId).gte('created_at', start),
        supabase.from('visits').select('id,status,created_at').eq('institution_id', institutionId).gte('created_at', start),
        supabase.from('whatsapp_messages').select('id,created_at,from_me,remote_jid').eq('institution_id', institutionId).gte('created_at', start),
        supabase.from('enrollments').select('id,user_id,created_at').eq('institution_id', institutionId),
        supabase.from('users').select('id,full_name,role').eq('institution_id', institutionId),
        supabase.from('whatsapp_phone_numbers').select('phone_number,display_name').eq('institution_id', institutionId).limit(1).maybeSingle(),
        supabase.from('whatsapp_conversations').select('id,created_at,status,assigned_user_name,assigned_user_id,bot_active,satisfaction_score,first_response_at,remote_jid').eq('institution_id', institutionId).gte('created_at', start).lte('created_at', end),
      ])

      const loadedCycles = (cyclesRes.data ?? []) as CampaignCycle[]
      setCycles(loadedCycles)
      setFunnelData(funnelRes.data ?? [])
      setTransfers((transferRes.data ?? []) as StudentTransfer[])
      setLeads((leadsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      setVisits((visitsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      const waMsgs = (waRes.data ?? []) as { id: string; created_at: string; from_me: boolean; remote_jid: string }[]
      setWaMessages(waMsgs)

      // Calcular ranking de usuários
      const enrollments = (enrollRes.data ?? []) as { id: string; user_id: string; created_at: string }[]
      const users = (usersRes.data ?? []) as { id: string; full_name: string; role: string }[]
      const leadsData = (leadsRes.data ?? []) as { id: string; status: string; created_at: string }[]

      const enrollCountByUser: Record<string, number> = {}
      enrollments.forEach(e => { if (e.user_id) enrollCountByUser[e.user_id] = (enrollCountByUser[e.user_id] || 0) + 1 })

      const rankings: UserRanking[] = users.map(u => ({
        user_id: u.id,
        full_name: u.full_name || 'Usuário',
        role: u.role || 'gestor',
        enrollments_count: enrollCountByUser[u.id] || 0,
        leads_count: 0,
      })).sort((a, b) => b.enrollments_count - a.enrollments_count).slice(0, 5)

      setUserRankings(rankings)

      // WhatsApp phone record (detection)
      setWaPhoneRecord((waPhoneRes.data as { phone_number: string; display_name: string } | null) ?? null)

      // WA conversation stats (last 30 days)
      const waConvs = (waConvsRes.data ?? []) as { id: string; created_at: string; status: string; assigned_user_name: string | null; assigned_user_id: string | null; bot_active: boolean | null; satisfaction_score: number | null; first_response_at: string | null; remote_jid: string }[]
      setActiveConvsNow(waConvs.filter(c => c.status === 'open' || c.status === 'waiting').length)
      const respTimes: number[] = []
      waConvs.forEach(c => {
        if (c.first_response_at && c.created_at) {
          const diff = (new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime()) / 60000
          if (diff > 0 && diff < 1440) respTimes.push(diff)
        }
      })
      setWaAvgResponse(respTimes.length > 0 ? Math.round(respTimes.reduce((s, v) => s + v, 0) / respTimes.length) : null)
      const waTotal = waConvs.length
      const waByBot = waConvs.filter(c => c.bot_active === true).length
      const waByTeam = waConvs.filter(c => c.bot_active !== true).length
      const waClosed = waConvs.filter(c => c.status === 'closed').length
      const scores = waConvs.map(c => c.satisfaction_score).filter((s): s is number => typeof s === 'number' && s >= 1 && s <= 3)
      const waAvgSatisfaction = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null
      const now7 = new Date()
      const waDaily: { day: string; count: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now7); d.setDate(d.getDate() - i)
        const dayStr = d.toISOString().slice(0, 10)
        const label = d.toLocaleDateString('pt-BR', { weekday: 'short' })
        waDaily.push({ day: label, count: waConvs.filter(c => c.created_at.slice(0, 10) === dayStr).length })
      }
      setWaConvStats({ total: waTotal, byBot: waByBot, byTeam: waByTeam, closed: waClosed, daily: waDaily, avgSatisfaction: waAvgSatisfaction })
      setWaConvsRaw(waConvs)

      // Satisfaction breakdown
      const surveyScores = waConvs.filter(c => typeof c.satisfaction_score === 'number' && c.satisfaction_score >= 1 && c.satisfaction_score <= 3)
      setSurveyScoresList(surveyScores)
      if (surveyScores.length > 0) {
        const ruim    = surveyScores.filter(c => c.satisfaction_score === 1).length
        const regular = surveyScores.filter(c => c.satisfaction_score === 2).length
        const otimo   = surveyScores.filter(c => c.satisfaction_score === 3).length
        const avgScore = surveyScores.reduce((s, c) => s + (c.satisfaction_score || 0), 0) / surveyScores.length
        const attMap: Record<string, { total: number; sum: number }> = {}
        surveyScores.forEach(c => {
          if (!c.assigned_user_id) return
          const name = c.assigned_user_name || 'Usuário'
          if (!attMap[name]) attMap[name] = { total: 0, sum: 0 }
          attMap[name].total++
          attMap[name].sum += c.satisfaction_score || 0
        })
        const byAttendant = Object.entries(attMap)
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => (b.sum / b.total) - (a.sum / a.total))
          .slice(0, 5)
        setWaSatisfStats({ total: surveyScores.length, ruim, regular, otimo, avgScore, byAttendant })
      }

      // WA team ranking by closed conversations (keyed by assigned_user_id)
      const waRankMap: Record<string, number> = {}
      waConvs.filter(c => c.status === 'closed' && c.assigned_user_id).forEach(c => {
        const uid = c.assigned_user_id!
        waRankMap[uid] = (waRankMap[uid] || 0) + 1
      })
      setWaTeamRanking(Object.entries(waRankMap).map(([userId, count]) => ({ userId, count })).sort((a, b) => b.count - a.count).slice(0, 5))

      const duration = new Date(end).getTime() - new Date(start).getTime()
      const prevStart = new Date(new Date(start).getTime() - duration).toISOString()
      const prevLeadsRes = await supabase
        .from('leads')
        .select('id,status,created_at')
        .eq('institution_id', institutionId)
        .gte('created_at', prevStart)
        .lt('created_at', start)
      setPrevLeadsCount(prevLeadsRes.data?.length ?? 0)
      setPrevEnrolled((prevLeadsRes.data ?? []).filter(l =>
        l.status === 'enrolled' || l.status === 'matriculado').length)

      const alreadySetup = loadedCycles.some(c => ['setup','draft','active','completed','released'].includes(c.status ?? ''))
      if (!alreadySetup) setShowSetup(true)

      const cycleWithLocation = loadedCycles.find(c => c.school_data?.city && c.school_data?.state)
      if (cycleWithLocation) {
        const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000
        const fetchedAt = cycleWithLocation.market_data_fetched_at ? new Date(cycleWithLocation.market_data_fetched_at).getTime() : 0
        if (cycleWithLocation.market_data && fetchedAt > thirtyDaysAgoMs) {
          setMarketData(cycleWithLocation.market_data)
        } else {
          fetchMarketData(cycleWithLocation.school_data!.city as string, cycleWithLocation.school_data!.state as string, cycleWithLocation.id)
        }
      }

      if (mountedRef.current) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const recentLeads = (leadsRes.data ?? []).filter((l: { created_at: string }) => l.created_at >= oneDayAgo)
        if (recentLeads.length > 5) {
          createNotification({
            institution_id: institutionId,
            type: 'milestone',
            title: 'Alta captação de leads!',
            message: `${recentLeads.length} novos leads cadastrados nas últimas 24h.`,
            severity: 'success',
            action_url: '/leads',
          })
        }

        const sortedFunnel = (funnelRes.data ?? []).sort((a: FunnelMetrics, b: FunnelMetrics) => a.period.localeCompare(b.period))
        const latestF = sortedFunnel[sortedFunnel.length - 1] as FunnelMetrics | undefined
        if (latestF) {
          const checks = [
            { key: 'registrations', val: latestF.registrations, target: latestF.registrations_target, label: 'Cadastros' },
            { key: 'schedules', val: latestF.schedules, target: latestF.schedules_target, label: 'Agendamentos' },
            { key: 'visits', val: latestF.visits, target: latestF.visits_target, label: 'Visitas' },
            { key: 'enrollments', val: latestF.enrollments, target: latestF.enrollments_target, label: 'Matrículas' },
          ]
          const underperforming = checks.find(c => (c.target ?? 0) > 0 && ((c.val ?? 0) / c.target!) * 100 < 60)
          if (underperforming) {
            const today = new Date(); today.setHours(0, 0, 0, 0)
            const { data: existing } = await supabase
              .from('system_notifications')
              .select('id')
              .eq('institution_id', institutionId)
              .eq('type', 'goal_deviation')
              .gte('created_at', today.toISOString())
              .limit(1)
            if (!existing || existing.length === 0) {
              createNotification({
                institution_id: institutionId,
                type: 'goal_deviation',
                title: `Meta de ${underperforming.label} abaixo de 60%`,
                message: `${underperforming.label}: ${underperforming.val ?? 0} de ${underperforming.target} (${Math.round(((underperforming.val ?? 0) / underperforming.target!) * 100)}% da meta).`,
                severity: 'warning',
                action_url: '/reports',
              })
            }
          }
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchMarketData(city: string, state: string, cycleId?: string) {
    if (!city || !state) return
    setMarketLoading(true)
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'fetch_ibge', payload: { city, state } }) })
      const json = await res.json()
      const result = json.result ?? null
      setMarketData(result)
      if (result && cycleId) {
        await supabase.from('campaign_cycles').update({ market_data: result, market_data_fetched_at: new Date().toISOString() }).eq('id', cycleId)
      }
    } catch { } finally { setMarketLoading(false) }
  }

  const AI_CACHE_KEY = `ai_insight_${institutionId}`
  const AI_CACHE_TTL = 2 * 60 * 60 * 1000

  async function fetchAiInsight(funnel: FunnelMetrics, forceRefresh = false) {
    if (aiInsightFetched.current && !forceRefresh) return
    aiInsightFetched.current = true

    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(AI_CACHE_KEY)
        if (cached) {
          const { text, timestamp } = JSON.parse(cached)
          if (Date.now() - timestamp < AI_CACHE_TTL) {
            setAiInsight(text)
            setAiLastUpdated(timestamp)
            return
          }
        }
      } catch { }
    }

    setAiInsightLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly_insight',
          payload: {
            funnel: { registrations: funnel.registrations ?? 0, registrations_target: funnel.registrations_target ?? 0, schedules: funnel.schedules ?? 0, schedules_target: funnel.schedules_target ?? 0, visits: funnel.visits ?? 0, visits_target: funnel.visits_target ?? 0, enrollments: funnel.enrollments ?? 0, enrollments_target: funnel.enrollments_target ?? 0 },
            previousFunnel: null, reenrollments: null, campaignWeek: funnel.period ?? 'atual',
          }
        }),
      })
      const json = await res.json()
      if (json.result) {
        setAiInsight(json.result)
        const ts = Date.now()
        setAiLastUpdated(ts)
        try { localStorage.setItem(AI_CACHE_KEY, JSON.stringify({ text: json.result, timestamp: ts })) } catch { }
      }
    } catch { } finally { setAiInsightLoading(false) }
  }

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  }

  function formatDate(d: Date) {
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  }

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default
    const canvas = await html2canvas(dashboardRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#F9FAFB' })
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' })
    const w = pdf.internal.pageSize.getWidth()
    const h = (canvas.height * w) / canvas.width
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h)
    pdf.save(`dashboard-${user?.institution_name ?? 'escola'}-${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // ── dados derivados ────────────────────────────────────────────────────────
  const activeCycle = cycles.find(c => c.status === 'active' || !!c.applied_at) ?? null
  const releasedCycle = cycles.find(c => c.status === 'released') ?? null
  const anyCycle = cycles[0] ?? null
  const setupCycle = cycles.find(c => c.school_data?.city) ?? null
  const campaignUnlocked = !!(activeCycle || releasedCycle)

  const historicalSource = (
    cycles.find(c => c.historical_data?.length)?.historical_data ??
    (cycles.find(c => (c.erp_files as HistoricalEntry[] | null)?.filter(f => !f.error).length)?.erp_files as HistoricalEntry[] | null) ??
    []
  ).filter((e: HistoricalEntry) => !e.error)

  const sorted = [...historicalSource].sort((a: HistoricalEntry, b: HistoricalEntry) => entryYear(a) - entryYear(b))
  const latest = sorted[sorted.length - 1] ?? null
  const previous = sorted[sorted.length - 2] ?? null

  const totalStudents = latest ? entryTotal(latest) : 0
  const newStudents = latest ? entryNew(latest) : 0
  const returningStudents = latest ? entryReturning(latest) : 0
  const latestYear = latest ? entryYear(latest) : null
  const hasHistory = sorted.length > 0

  const totalVariation = previous && entryTotal(previous) > 0 ? +((totalStudents - entryTotal(previous)) / entryTotal(previous) * 100).toFixed(1) : null
  const newVariation = previous && entryNew(previous) > 0 ? +((newStudents - entryNew(previous)) / entryNew(previous) * 100).toFixed(1) : null

  const chartData = sorted.map(d => ({ year: String(entryYear(d)), novatos: entryNew(d), veteranos: entryReturning(d) }))

  const campaignStartMonth = activeCycle?.campaign_start_month ?? anyCycle?.campaign_start_month ?? 8
  const { monthsUntil, campaignStartMonth: campaignStartLabel, campaignYear } = calcCampaignTiming(campaignStartMonth)

  const latestFunnel = funnelData.length > 0 ? [...funnelData].sort((a, b) => a.period.localeCompare(b.period))[funnelData.length - 1] : null
  const funnelHasData = funnelData.some(f => (f.registrations || 0) > 0)

  useEffect(() => {
    if (latestFunnel && (latestFunnel.registrations ?? 0) > 0 && !aiInsightFetched.current) fetchAiInsight(latestFunnel)
  }, [latestFunnel?.period])

  const totalLeads = leads.length
  const totalVisitsCount = visits.length
  const totalEnrolled = leads.filter(l => l.status === 'matriculado' || l.status === 'enrolled').length
  const conversionRateNum = totalLeads > 0 ? +((totalEnrolled / totalLeads) * 100).toFixed(1) : 0
  const totalMessages = waMessages.length
  const waSent = waMessages.filter(m => m.from_me === true).length
  const waReceived = waMessages.filter(m => m.from_me === false).length

  const pieData = [
    { name: 'Matriculados', value: totalEnrolled, fill: '#0F6E56' },
    { name: 'Visitaram', value: Math.max(0, totalVisitsCount - totalEnrolled), fill: '#1D9E75' },
    { name: 'Só cadastro', value: Math.max(0, totalLeads - totalVisitsCount), fill: '#9FE1CB' },
  ].filter(d => d.value > 0)

  const marketCity = setupCycle?.school_data?.city ?? ''
  const marketState = setupCycle?.school_data?.state ?? ''
  const totalPrivateStudents = marketData ? Number(marketData.school_age_population ?? 0) * (Number(marketData.private_school_rate ?? 18) / 100) : 0
  const marketSharePct = totalPrivateStudents > 0 && totalStudents > 0 ? +((totalStudents / totalPrivateStudents) * 100).toFixed(1) : null
  const avgStudentsPerSchoolVal = Number(marketData?.avg_students_per_school ?? marketData?.average_students_per_school ?? 500)
  const estimatedSchools = totalPrivateStudents > 0 && avgStudentsPerSchoolVal > 0 ? Math.round(totalPrivateStudents / avgStudentsPerSchoolVal) : null
  const estimatedRank = totalPrivateStudents > 0 && totalStudents > 0 && estimatedSchools ? Math.max(1, Math.round((1 - totalStudents / totalPrivateStudents) * estimatedSchools)) : null
  const sectorGrowth = marketData?.sector_growth ?? marketData?.sector_growth_rate ?? null

  const marketBadge = marketSharePct !== null
    ? marketSharePct >= 25 ? { label: 'Líder de mercado', bg: '#dcfce7', color: '#15803d' }
    : marketSharePct >= 15 ? { label: 'Top 3', bg: '#dbeafe', color: '#1d4ed8' }
    : marketSharePct >= 5 ? { label: 'Top 10', bg: '#fef3c7', color: '#b45309' }
    : { label: 'Em crescimento', bg: '#f3f4f6', color: '#6b7280' }
    : null

  const reenrollRateNum = totalStudents > 0 && newStudents < totalStudents ? +((returningStudents / (totalStudents - newStudents + returningStudents)) * 100).toFixed(1) : 75
  const score = calculateScore({ growthTrend: newVariation ?? 0, reenrollRate: reenrollRateNum, marketShare: marketSharePct ?? 0, conversionRate: conversionRateNum, hasHistorical: hasHistory })
  const scoreLabel = score >= 80 ? 'Alto Desempenho' : score >= 60 ? 'Desempenho Regular' : score >= 40 ? 'Atenção Necessária' : 'Situação Crítica'
  const scoreColor = score >= 80 ? '#0F6E56' : score >= 60 ? '#BA7517' : '#E24B4A'
  const scoreBg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2'
  const radius = 54; const circumference = 2 * Math.PI * radius; const offset = circumference - (score / 100) * circumference

  const chartDataWithTotal = chartData.map(d => ({ ...d, total: (d.veteranos || 0) + (d.novatos || 0) }))

  const gradeData = leads.filter(l => l.grade_interest).reduce((acc, l) => {
    acc[l.grade_interest!] = (acc[l.grade_interest!] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const gradeSorted = Object.entries(gradeData).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, value]) => ({ name, value }))

  const sourceData = leads.filter(l => l.source).reduce((acc, l) => {
    acc[l.source!] = (acc[l.source!] || 0) + 1; return acc
  }, {} as Record<string, number>)
  const SOURCE_COLORS: Record<string, string> = { WhatsApp: '#25D366', Instagram: '#E1306C', Facebook: '#1877F2', 'Indicação': '#F59E0B', Site: '#6366F1' }
  const sourceSorted = Object.entries(sourceData).sort(([, a], [, b]) => b - a).map(([name, value]) => ({ name, value, fill: SOURCE_COLORS[name] ?? '#9CA3AF' }))

  const schoolName = user?.institution_name || 'Sua escola'
  const avgSatisfaction = waConvStats?.avgSatisfaction ?? null
  const avgResponseTime = waAvgResponse

  const campaignMonthsList = getCampaignMonthsList(activeCycle?.start_date ?? anyCycle?.start_date, activeCycle?.end_date ?? anyCycle?.end_date)
  const defaultSeasonality: Record<number, number> = { 1: 12, 2: 7, 8: 12, 9: 15, 10: 20, 11: 18, 12: 16 }
  const calendarMax = Math.max(...campaignMonthsList.map(m => defaultSeasonality[m] ?? 10))
  const peakMonth = campaignMonthsList.reduce((best, m) => (defaultSeasonality[m] ?? 0) > (defaultSeasonality[best] ?? 0) ? m : best, campaignMonthsList[0])

  // Salvar score
  useEffect(() => {
    if (!hasHistory || !cycles.length) return
    const targetCycle = activeCycle ?? releasedCycle ?? anyCycle
    if (!targetCycle) return
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const lastCalc = targetCycle.score_calculated_at ? new Date(targetCycle.score_calculated_at).getTime() : 0
    if (targetCycle.score === score && lastCalc > sevenDaysAgo) return
    supabase.from('campaign_cycles').update({ score, score_calculated_at: new Date().toISOString() }).eq('id', targetCycle.id)
  }, [score, hasHistory])

  // ── Alertas inteligentes ──────────────────────────────────────────────────
  const alerts: { msg: string; type: 'warning' | 'info' | 'success'; action?: string; path?: string }[] = []
  if (newVariation !== null && newVariation < -20) alerts.push({ msg: `Novatos caíram ${Math.abs(newVariation)}% vs ano anterior — revisar estratégia de captação`, type: 'warning' })
  if (marketSharePct !== null && marketSharePct < 5) alerts.push({ msg: 'Market share abaixo de 5% — oportunidade de crescimento expressivo na cidade', type: 'info' })
  if (!campaignUnlocked) alerts.push({ msg: 'Campanha ainda não liberada pelo administrador', type: 'info' })
  if (activeCycle && funnelHasData && latestFunnel) {
    const regPct = latestFunnel.registrations_target ? (latestFunnel.registrations / latestFunnel.registrations_target) * 100 : 0
    if (regPct < 60) alerts.push({ msg: `Cadastros ${regPct.toFixed(0)}% da meta — intensifique captação`, type: 'warning', action: 'Ver funil', path: '/reports' })
  }
  if (score >= 75) alerts.push({ msg: `Score ${score} — escola com desempenho acima da média!`, type: 'success' })
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  const leadsNoContact = leads.filter(l => l.created_at < fiveDaysAgo && l.status !== 'matriculado' && l.status !== 'enrolled' && l.status !== 'descartado').length
  if (leadsNoContact > 0) alerts.push({ msg: `${leadsNoContact} leads sem contato há mais de 5 dias`, type: 'warning', action: 'Ver leads', path: '/leads' })
  if (avgSatisfaction !== null && avgSatisfaction < 2.5) alerts.push({ msg: `Satisfação média abaixo de 2.5 (${avgSatisfaction.toFixed(1)}/3) — atenção ao atendimento`, type: 'warning', action: 'Ver pesquisas', path: '/surveys' })

  const avgFee = (setupCycle?.school_data?.avg_monthly_fee as number | null | undefined) || latest?.avg_monthly_fee || latest?.fee || null

  // ── Mobile early return ───────────────────────────────────────────────────
  if (isMobile) {
    const quickAccess = [
      { label: 'Leads', icon: Users, path: '/leads', bg: '#EDE9FE', color: '#7C3AED' },
      { label: 'Visitas', icon: Calendar, path: '/visits', bg: '#FEF3C7', color: '#D97706' },
      { label: 'WhatsApp', icon: MessageCircle, path: '/whatsapp', bg: '#D1FAE5', color: '#059669' },
      { label: 'Relatórios', icon: BarChart3, path: '/reports', bg: '#DBEAFE', color: '#2563EB' },
      { label: 'Transferências', icon: TrendingDown, path: '/transfers', bg: '#FEE2E2', color: '#DC2626' },
      { label: 'Pesquisas', icon: Star, path: '/surveys', bg: '#F5F3FF', color: '#7C3AED' },
    ]
    const alertColors = { warning: { bg: '#FEF3C7', color: '#B45309', border: '#FDE68A' }, info: { bg: '#DBEAFE', color: '#1D4ED8', border: '#BFDBFE' }, success: { bg: '#D1FAE5', color: '#065F46', border: '#6EE7B7' } }

    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', background: '#f8f9fb', paddingBottom: 96 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Olá,</p>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{user?.full_name?.split(' ')[0]}</h1>
          </div>
          {score > 0 && (
            <div style={{ textAlign: 'center', background: scoreBg, border: `1px solid ${scoreColor}22`, borderRadius: 14, padding: '8px 16px' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: scoreColor, margin: 0 }}>{score}</p>
              <p style={{ fontSize: 10, fontWeight: 600, color: scoreColor, margin: 0, textTransform: 'uppercase', letterSpacing: '.04em' }}>Score</p>
            </div>
          )}
        </div>

        {/* Alerta mais importante */}
        {alerts.length > 0 && (() => {
          const a = alerts[0]
          const c = alertColors[a.type]
          return (
            <div onClick={() => a.path && navigate(a.path)}
              style={{ padding: '12px 16px', borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, cursor: a.path ? 'pointer' : 'default' }}>
              <p style={{ fontSize: 13, color: c.color, margin: 0, fontWeight: 500 }}>{a.msg}</p>
            </div>
          )
        })()}

        {/* KPIs 2x2 */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Alunos', value: totalStudents || 0, icon: GraduationCap, color: '#00A896', bg: '#E6F7F5' },
              { label: 'Novatos', value: newStudents || 0, icon: TrendingUp, color: '#7C3AED', bg: '#EDE9FE' },
              { label: 'Market Share', value: marketSharePct !== null ? `${marketSharePct}%` : '—', icon: Target, color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Próx. Campanha', value: monthsUntil === 0 ? 'Agora' : `${monthsUntil}m`, icon: Bell, color: '#D97706', bg: '#FEF3C7' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', fontWeight: 500 }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Campanha ativa */}
        {activeCycle && funnelHasData && latestFunnel && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Campanha ativa</p>
              <span style={{ fontSize: 11, background: '#D1FAE5', color: '#065F46', borderRadius: 9999, padding: '2px 8px', fontWeight: 600 }}>Em andamento</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: 'Cadastros', val: latestFunnel.registrations ?? 0, target: latestFunnel.registrations_target ?? 0 },
                { label: 'Agendamentos', val: latestFunnel.schedules ?? 0, target: latestFunnel.schedules_target ?? 0 },
                { label: 'Visitas', val: latestFunnel.visits ?? 0, target: latestFunnel.visits_target ?? 0 },
                { label: 'Matrículas', val: latestFunnel.enrollments ?? 0, target: latestFunnel.enrollments_target ?? 0 },
              ].map(({ label, val, target }) => {
                const pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0
                return (
                  <div key={label} style={{ padding: '10px 12px', background: '#F8FAFC', borderRadius: 10 }}>
                    <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', fontWeight: 500 }}>{label}</p>
                    <p style={{ fontSize: 18, fontWeight: 700, color: '#1A2B4A', margin: '0 0 6px' }}>{val}<span style={{ fontSize: 11, color: '#94A3B8' }}>/{target}</span></p>
                    <div style={{ height: 4, background: '#E2E8F0', borderRadius: 9999 }}>
                      <div style={{ height: 4, width: `${pct}%`, background: pct >= 80 ? '#00A896' : pct >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 9999 }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => navigate('/reports')} style={{ width: '100%', padding: '10px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Ver relatório completo
            </button>
          </div>
        )}

        {/* Acesso rápido */}
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Acesso rápido</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {quickAccess.map(({ label, icon: Icon, path, bg, color }) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, background: '#fff', border: '1px solid #E2E8F0', cursor: 'pointer', minHeight: 80 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={18} color={color} />
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: '#1A2B4A', margin: 0, textAlign: 'center' }}>{label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Alertas */}
        {alerts.length > 1 && (
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '0 0 10px' }}>Alertas</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.slice(1).map((a, i) => {
                const c = alertColors[a.type]
                return (
                  <div key={i} onClick={() => a.path && navigate(a.path)}
                    style={{ padding: '12px 14px', borderRadius: 12, background: c.bg, border: `1px solid ${c.border}`, cursor: a.path ? 'pointer' : 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <p style={{ fontSize: 13, color: c.color, margin: 0, fontWeight: 500, flex: 1 }}>{a.msg}</p>
                    {a.action && <ChevronRight size={14} color={c.color} />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modals */}
        {showModal && <CampaignGeneratorModal isOpen={showModal} onClose={() => setShowModal(false)} onApply={() => { load(); setShowModal(false) }} institutionId={institutionId} institutionName={user?.institution_name || 'Escola'} openAtStep={showModalAtStep} />}
        {showSetup && <SchoolSetupModal institutionId={institutionId} initialStep={setupInitialStep} onComplete={() => { setShowSetup(false); load() }} />}
      </div>
    )
  }

  return (
    <div ref={dashboardRef} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%', background: '#F9FAFB' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
            {getGreeting()}, {user?.full_name?.split(' ')[0] || 'Gestor'}!
          </h1>
          <p style={{ color: '#6B7280', fontSize: 14, margin: '4px 0 0' }}>
            {schoolName} • {formatDate(new Date())}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['hoje', 'semana', 'mes', 'ano'] as const).map(p => (
            <button key={p} onClick={() => setPeriodFilter(p)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', background: periodFilter === p ? '#00A896' : '#F3F4F6', color: periodFilter === p ? 'white' : '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mês' : 'Ano'}
            </button>
          ))}
          {!campaignUnlocked && (
            <div style={{ position: 'relative' }} onMouseEnter={() => setBtnTooltip(true)} onMouseLeave={() => setBtnTooltip(false)}>
              <button disabled style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 20, background: '#F3F4F6', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 500, cursor: 'not-allowed' }}>
                <Lock size={14} /> Bloqueado
              </button>
              {btnTooltip && (
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 999, background: '#1e2d6b', color: 'white', fontSize: 12, lineHeight: 1.4, padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', maxWidth: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                  Aguardando liberação pelo administrador.
                  <div style={{ position: 'absolute', right: 18, bottom: '100%', borderWidth: '5px', borderStyle: 'solid', borderColor: 'transparent transparent #1e2d6b transparent' }} />
                </div>
              )}
            </div>
          )}
          {activeConvsNow > 0 && (
            <div style={{ position: 'relative' }} onMouseEnter={() => setBadgeTooltip(true)} onMouseLeave={() => setBadgeTooltip(false)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20, background: '#F0FDF4', border: '1px solid #BBF7D0', cursor: 'default' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>{activeConvsNow} conversas abertas</span>
              </div>
              {badgeTooltip && (
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 999, background: '#1e2d6b', color: 'white', fontSize: 12, lineHeight: 1.4, padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                  Conversas WhatsApp com status aberto ou pendente agora
                  <div style={{ position: 'absolute', right: 18, bottom: '100%', borderWidth: '5px', borderStyle: 'solid', borderColor: 'transparent transparent #1e2d6b transparent' }} />
                </div>
              )}
            </div>
          )}
          <button onClick={handleExportPDF} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #E5E7EB', background: 'white', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            ↓ Exportar PDF
          </button>
        </div>
      </div>

      {/* ── Alertas inteligentes ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => {
            const cfg = {
              warning: { bg: '#FEF2F2', border: '#FECACA', color: '#991B1B', icon: <i className="ti ti-alert-triangle" />, badge: 'Atenção' },
              success: { bg: '#F0FDF4', border: '#BBF7D0', color: '#166534', icon: <i className="ti ti-circle-check" />, badge: 'Ótimo' },
              info: { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', icon: <i className="ti ti-info-circle" />, badge: 'Info' },
            }[a.type]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: cfg.bg, border: `1px solid ${cfg.border}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
                <span style={{ fontSize: 13, color: cfg.color, flex: 1, fontWeight: 500 }}>{a.msg}</span>
                {a.action && a.path && (
                  <button onClick={() => navigate(a.path!)} style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 20, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    {a.action} <ArrowRight size={10} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── KPI rápidos ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(6,1fr)', gap: 12 }}>
          {[
            { label: 'Leads no período', value: leads.length, prev: prevLeadsCount, icon: <i className="ti ti-users" />, color: '#8B5CF6', bg: '#F5F3FF', path: '/leads' },
            { label: 'Conversas WhatsApp', value: waConvsRaw.length, prev: null as number | null, icon: <i className="ti ti-message-circle" />, color: '#00A896', bg: '#F0FDFA', path: '/whatsapp' },
            { label: 'Matrículas', value: totalEnrolled, prev: prevEnrolled, icon: <i className="ti ti-school" />, color: '#F59E0B', bg: '#FFFBEB', path: '/enrollments' },
            { label: 'Taxa de conversão', value: conversionRateNum.toFixed(1) + '%', prev: null as number | null, icon: <i className="ti ti-trending-up" />, color: '#10B981', bg: '#ECFDF5', path: '/leads' },
            { label: 'Satisfação média', value: waSatisfStats ? waSatisfStats.avgScore.toFixed(1) + '/3' : '—', prev: null as number | null, icon: <i className="ti ti-star" />, color: '#F59E0B', bg: '#FFFBEB', path: '/surveys' },
            { label: 'Tempo de resposta', value: waAvgResponse !== null ? (waAvgResponse < 60 ? `${waAvgResponse}min` : `${Math.floor(waAvgResponse / 60)}h ${waAvgResponse % 60}m`) : '—', prev: null as number | null, icon: <i className="ti ti-bolt" />, color: '#EF4444', bg: '#FEF2F2', path: '/whatsapp' },
          ].map(card => {
            const variation = card.prev !== null && card.prev > 0
              ? Math.round((Number(card.value) - card.prev) / card.prev * 100)
              : null
            return (
              <div key={card.label}
                onClick={() => navigate(card.path)}
                style={{ background: card.bg, borderRadius: 16, padding: '16px 18px', border: `1px solid ${card.color}22`, cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.04)', transition: 'transform 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>{card.label}</div>
                {variation !== null && (
                  <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: variation >= 0 ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', gap: 3 }}>
                    {variation >= 0 ? '↑' : '↓'}{Math.abs(variation)}% vs anterior
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && !hasHistory && (
        <div style={{ background: '#fff', borderRadius: 16, border: '2px dashed #cbd5e1', padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={26} color="#8B5CF6" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>Bem-vindo ao Áion Edu</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440, lineHeight: 1.6 }}>
              Para começar, importe os relatórios de matrículas dos últimos anos. Leva menos de 2 minutos e permite que a IA analise o histórico da sua escola.
            </p>
          </div>
          <button onClick={() => { setSetupInitialStep(2); setShowSetup(true) }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, background: '#8B5CF6', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Upload size={15} /> Importar histórico agora
          </button>
        </div>
      )}

      {/* ── L2: Card escola + Mercado local ─────────────────────────────────── */}
      {!loading && hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: 16, alignItems: 'start' }}>

          {/* Card escola: Score + KPIs */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexDirection: isMobile ? 'column' : 'row' }}>
            <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', borderTop: `4px solid ${score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : score >= 40 ? '#EF4444' : '#7F1D1D'}` }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12"/>
                <circle cx="70" cy="70" r={radius} fill="none" stroke={scoreColor} strokeWidth="12" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 70 70)" style={{ transition: 'stroke-dashoffset 1s ease' }}/>
                <text x="70" y="64" textAnchor="middle" fontSize="28" fontWeight="700" fill={scoreColor}>{score}</text>
                <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#6b7280">score</text>
              </svg>
              <div style={{ minWidth: 160 }}>
                <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#1e2d6b', lineHeight: 1.2 }}>{user?.institution_name || 'Sua escola'}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: scoreBg, color: scoreColor }}>{scoreLabel}</span>
                  <div style={{ position: 'relative', cursor: 'default' }} onMouseEnter={() => setScoreTooltip(true)} onMouseLeave={() => setScoreTooltip(false)}>
                    <Info size={13} color="#94a3b8" />
                    {scoreTooltip && (
                      <div style={{ position: 'absolute', left: 0, top: '120%', zIndex: 999, background: '#1e2d6b', color: '#fff', fontSize: 11, lineHeight: 1.6, padding: '10px 14px', borderRadius: 10, width: 280, boxShadow: '0 4px 20px rgba(0,0,0,0.18)' }}>
                        Score baseado em crescimento de novatos, taxa de rematrícula, market share e conversão de leads.
                      </div>
                    )}
                  </div>
                </div>
                {avgFee && <p style={{ margin: '0 0 4px', fontSize: 12, color: '#64748b' }}>Mensalidade média: <strong>{fmtBRL(avgFee)}</strong></p>}
                {(marketCity || marketState) && (
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={11} /> {marketCity}{marketCity && marketState ? ', ' : ''}{marketState}
                  </p>
                )}
              </div>
            </div>
            <div style={{ ...(isMobile ? {} : { flex: 1 }), display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <KpiCard label={`Alunos ${latestYear ?? ''}`} value={fmt(totalStudents)} icon={<Users size={20} color="#00A896" />} iconBg="#E6F7F5" variation={totalVariation} />
              <KpiCard label="Novatos" value={fmt(newStudents)} icon={<TrendingUp size={20} color="#8B5CF6" />} iconBg="#EDE9FE" variation={newVariation} sub={totalStudents > 0 ? `${Math.round((newStudents / totalStudents) * 100)}% do total` : undefined} />
              <KpiCard label="Market share" value={marketSharePct !== null ? `${marketSharePct}%` : (marketLoading ? '…' : '—')} icon={<BarChart3 size={20} color="#F59E0B" />} iconBg="#FEF3C7" sub={estimatedSchools ? `~${estimatedSchools} escolas na cidade` : undefined} />
              <KpiCard label="Próxima campanha" value={monthsUntil > 0 ? `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'}` : 'Ativa'} icon={<Calendar size={20} color="#3B82F6" />} iconBg="#DBEAFE" sub={`Ano letivo ${campaignYear}`} onClick={() => navigate('/reports')} />
            </div>
          </div>

          {/* Mercado + Diagnóstico INEP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 18, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin size={14} color="#F59E0B" />
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Mercado local{marketCity ? ` — ${marketCity}` : ''}</h3>
                  <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Estimado via Censo Escolar / IBGE</p>
                </div>
              </div>
              {marketLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 36, borderRadius: 9, background: '#f1f5f9' }} />)}</div>
              ) : marketData && marketSharePct !== null ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ background: '#f0fdf9', borderRadius: 11, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Market share</p>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F6E56', lineHeight: 1 }}>{marketSharePct}%</p>
                    </div>
                    {marketBadge && <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: marketBadge.bg, color: marketBadge.color }}>{marketBadge.label}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {estimatedRank && estimatedSchools && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                        <span>Ranking estimado</span><span style={{ fontWeight: 700, color: '#1e2d6b' }}>#{estimatedRank} de ~{estimatedSchools}</span>
                      </div>
                    )}
                    {totalPrivateStudents > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                        <span>Total rede privada</span><span style={{ fontWeight: 700, color: '#1e2d6b' }}>{fmt(Math.round(totalPrivateStudents))}</span>
                      </div>
                    )}
                    {sectorGrowth != null && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                        <span>Crescimento setor</span><span style={{ fontWeight: 700, color: '#0d9488' }}>+{sectorGrowth}%/ano</span>
                      </div>
                    )}
                  </div>
                  {marketData.notes && <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', display: 'flex', gap: 4, alignItems: 'flex-start' }}><Info size={10} style={{ marginTop: 2, flexShrink: 0 }} />{String(marketData.notes)}</p>}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px 0', color: '#94a3b8' }}>
                  <MapPin size={24} strokeWidth={1.5} style={{ margin: '0 auto 8px' }} />
                  <p style={{ margin: 0, fontSize: 12 }}>Dados de mercado não disponíveis</p>
                </div>
              )}
            </div>
            {marketData?.inep_data && (
              <div style={{ background: 'linear-gradient(135deg, #1e2d6b, #2d4494)', borderRadius: 14, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <GraduationCap size={15} color="#fff" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Diagnóstico INEP</span>
                </div>
                {marketData.inep_data.school_classification && (
                  <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Classificação: </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{marketData.inep_data.school_classification}</span>
                  </div>
                )}
                {marketData.inep_data.main_competitors && marketData.inep_data.main_competitors.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Principais concorrentes</p>
                    {marketData.inep_data.main_competitors.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{c}</span>
                      </div>
                    ))}
                  </div>
                )}
                {marketData.inep_data.market_opportunity && (
                  <div style={{ background: 'rgba(0,168,150,0.2)', borderRadius: 8, padding: '7px 10px', marginTop: 8 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, fontWeight: 600, color: '#5eead4', textTransform: 'uppercase' }}>Oportunidade</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#ccfbf1', lineHeight: 1.4 }}>{marketData.inep_data.market_opportunity}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', height: 90 }} />)}
        </div>
      )}

      {/* ── L3: Histórico de alunos ──────────────────────────────────────────── */}
      {hasHistory && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Histórico de alunos por ano</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartDataWithTotal} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradVet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A896" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00A896" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradNov" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
              <XAxis dataKey="year" tick={{ fontSize: 12 }}/>
              <YAxis tick={{ fontSize: 12 }}/>
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(value, name) => [fmt(Number(value)), name === 'novatos' ? 'Novatos' : name === 'veteranos' ? 'Veteranos' : 'Total']} />
              <Legend/>
              <Area type="monotone" dataKey="veteranos" name="Veteranos" stroke="#00A896" strokeWidth={2} fill="url(#gradVet)"/>
              <Area type="monotone" dataKey="novatos" name="Novatos" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradNov)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Gráficos: Leads por dia + WhatsApp por dia ──────────────────────── */}
      {(() => {
        const { start } = getPeriodRange()
        const days: { date: string; count: number }[] = []
        const startDate = new Date(start)
        const now = new Date()
        const cur = new Date(startDate)
        while (cur <= now && days.length < 30) {
          const dateStr = cur.toISOString().slice(0, 10)
          days.push({
            date: cur.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            count: leads.filter(l => l.created_at.slice(0, 10) === dateStr).length,
          })
          cur.setDate(cur.getDate() + 1)
        }
        return (days.length > 1 || (waConvStats?.daily?.length ?? 0) > 0) ? (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
            {days.length > 1 && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Leads por dia</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={days} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(v) => [v, 'Leads']} />
                    <Area type="monotone" dataKey="count" name="Leads" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradLeads)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            {waConvStats?.daily && (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>WhatsApp por dia</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={waConvStats.daily} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} formatter={(v) => [v, 'Conversas']} />
                    <Bar dataKey="count" name="Conversas" fill="#00A896" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : null
      })()}

      {/* ── L5: Leads por origem | Insights IA compacto ─────────────────────── */}
      {(sourceSorted.length > 0 || aiInsight || aiInsightLoading) && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
          {sourceSorted.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Leads por origem</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={sourceSorted} margin={{ top: 0, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                  <YAxis tick={{ fontSize: 11 }}/>
                  <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}/>
                  <Bar dataKey="value" name="Leads" radius={[6, 6, 0, 0]}>
                    {sourceSorted.map((entry, index) => (
                      <Cell key={index} fill={entry.fill}/>
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {(aiInsightLoading || aiInsight) && (
            <div style={{ background: '#F8FAFC', borderRadius: 14, border: '1px solid #E2E8F0', padding: '10px 14px', minHeight: 64, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Sparkles size={13} color="#6366F1" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', flex: 1 }}>Análise da IA</span>
                {aiLastUpdated && !aiExpanded && (
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(aiLastUpdated).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                )}
                {latestFunnel && (
                  <button onClick={() => { aiInsightFetched.current = false; fetchAiInsight(latestFunnel, true) }} disabled={aiInsightLoading}
                    style={{ padding: '2px 4px', borderRadius: 6, background: 'none', border: '1px solid #E2E8F0', cursor: aiInsightLoading ? 'not-allowed' : 'pointer', opacity: aiInsightLoading ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
                    <RefreshCw size={16} color="#94a3b8" />
                  </button>
                )}
              </div>
              {aiInsightLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {[...Array(2)].map((_, i) => <div key={i} style={{ height: 10, borderRadius: 4, background: '#E2E8F0' }} />)}
                </div>
              ) : aiExpanded ? (
                <div style={{ marginTop: 4 }}>
                  {aiInsight?.split('\n').filter(p => p.trim()).map((para, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{para}</p>
                  ))}
                  <button onClick={() => setAiExpanded(false)} style={{ marginTop: 8, fontSize: 11, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                    Ver menos
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, textOverflow: 'ellipsis' }}>
                    {aiInsight?.split('\n').filter(p => p.trim())[0] ?? ''}
                  </p>
                  <button onClick={() => setAiExpanded(true)} style={{ fontSize: 11, color: '#6366F1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Ver análise completa
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}



      {/* ── Linha 3: Funil leads + Ranking usuários ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* Funil de leads */}
        <SectionCard title="Funil de Leads" subtitle="Conversão atual" icon={<Activity />} iconBg="#EDE9FE" iconColor="#8B5CF6" action={() => navigate('/leads')} actionLabel="Ver leads">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 36, borderRadius: 8, background: '#f1f5f9' }} />)}</div>
          ) : totalLeads === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <Users size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>Nenhum lead cadastrado ainda.<br />Comece captando interessados.</p>
              <button onClick={() => navigate('/leads')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#EDE9FE', color: '#8B5CF6', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Ir para Leads <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={160} height={160}>
                <Pie data={pieData} cx={80} cy={80} innerRadius={46} outerRadius={72} dataKey="value" paddingAngle={3}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [fmt(Number(value)), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {pieData.map(d => {
                  const pct = totalLeads > 0 ? Math.round((d.value / totalLeads) * 100) : 0
                  return (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{d.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{fmt(d.value)} · {pct}%</p>
                      </div>
                    </div>
                  )
                })}
                <div style={{ background: '#f0fdf9', borderRadius: 8, padding: '8px 12px', marginTop: 4 }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#065f46' }}>Taxa lead → matrícula</p>
                  <p style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 700, color: '#00A896' }}>{conversionRateNum.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Ranking de usuários */}
        <SectionCard title="Ranking da Equipe" subtitle={rankingMode === 'matriculas' ? 'Por matrículas confirmadas' : rankingMode === 'whatsapp' ? 'Por atendimentos WhatsApp' : 'Por satisfação'} icon={<Trophy />} iconBg="#FEF3C7" iconColor="#F59E0B" action={() => navigate('/reports')} actionLabel="Ver relatórios">
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
            {(['matriculas', 'whatsapp', 'satisfacao'] as const).map(mode => (
              <button key={mode} onClick={() => setRankingMode(mode)} style={{ flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: rankingMode === mode ? '#fff' : 'transparent', color: rankingMode === mode ? '#1e2d6b' : '#94a3b8', boxShadow: rankingMode === mode ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {mode === 'matriculas' ? 'Matrículas' : mode === 'whatsapp' ? 'WhatsApp' : 'Satisfação'}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 44, borderRadius: 8, background: '#f1f5f9' }} />)}</div>
          ) : (() => {
            const medals = [
              <i className="ti ti-trophy" style={{ fontSize: 14, color: '#F59E0B' }} />,
              <i className="ti ti-medal" style={{ fontSize: 14, color: '#94a3b8' }} />,
              <i className="ti ti-medal" style={{ fontSize: 14, color: '#CD7F32' }} />,
            ]
            const avatarColors = ['#00A896', '#8B5CF6', '#F59E0B', '#EF4444', '#3B82F6']
            const teamStats = userRankings.map(u => {
              const waData = waTeamRanking.find(w => w.userId === u.user_id)
              const satisfConvs = waConvsRaw.filter(c =>
                c.assigned_user_id === u.user_id &&
                typeof c.satisfaction_score === 'number' &&
                c.satisfaction_score >= 1 && c.satisfaction_score <= 3
              )
              const satisfScore = satisfConvs.length > 0
                ? satisfConvs.reduce((s, c) => s + (c.satisfaction_score || 0), 0) / satisfConvs.length
                : null
              const respDiffs = waConvsRaw
                .filter(c => c.assigned_user_id === u.user_id && c.first_response_at)
                .map(c => (new Date(c.first_response_at!).getTime() - new Date(c.created_at).getTime()) / 60000)
                .filter(d => d > 0 && d < 1440)
              const avgResp = respDiffs.length > 0
                ? Math.round(respDiffs.reduce((s, v) => s + v, 0) / respDiffs.length)
                : null
              return {
                ...u,
                wa_count: waData?.count ?? 0,
                satisf_score: satisfScore,
                satisf_count: satisfConvs.length,
                avg_response: avgResp,
              }
            })
            const sortedTeam = [...teamStats].sort((a, b) => {
              if (rankingMode === 'matriculas') return b.enrollments_count - a.enrollments_count
              if (rankingMode === 'whatsapp') return b.wa_count - a.wa_count
              return (b.satisf_score ?? 0) - (a.satisf_score ?? 0)
            })
            return sortedTeam.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
                <Users size={28} strokeWidth={1.5} style={{ margin: '0 auto 8px' }} />
                <p style={{ margin: 0, fontSize: 13 }}>Nenhum dado disponível</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sortedTeam.map((u, i) => {
                  const initials = u.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                  const avatarColor = avatarColors[i % avatarColors.length]
                  const satisfPct = u.satisf_score ? Math.round((u.satisf_score / 3) * 100) : null
                  const mainValue = rankingMode === 'matriculas'
                    ? u.enrollments_count
                    : rankingMode === 'whatsapp'
                    ? u.wa_count
                    : u.satisf_score ? u.satisf_score.toFixed(1) + '/3' : '—'
                  return (
                    <div key={u.user_id} style={{ padding: '12px 14px', borderRadius: 12, background: i === 0 ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${i === 0 ? '#FDE68A' : '#F1F5F9'}`, marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: satisfPct !== null ? 8 : 0 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
                          {initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {i < 3 && <span style={{ fontSize: 14 }}>{medals[i]}</span>}
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e2d6b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</p>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#6B7280' }}>{u.enrollments_count} matrículas</span>
                            <span style={{ fontSize: 11, color: '#00A896' }}><i className="ti ti-message-circle" /> {u.wa_count} conv.</span>
                            {u.satisf_score && <span style={{ fontSize: 11, color: '#F59E0B' }}><i className="ti ti-star" /> {u.satisf_score.toFixed(1)}</span>}
                            {rankingMode === 'whatsapp' && (
                              <span style={{ fontSize: 11, color: '#6366F1' }}>
                                <i className="ti ti-bolt" /> {u.avg_response !== null ? (u.avg_response < 60 ? `${u.avg_response}m` : `${Math.floor(u.avg_response / 60)}h ${u.avg_response % 60}m`) : '—'}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: i === 0 ? '#F59E0B' : '#1e2d6b' }}>{mainValue}</p>
                        </div>
                      </div>
                      {satisfPct !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <i className="ti ti-mood-smile" style={{ fontSize: 13, color: '#94a3b8', minWidth: 16, flexShrink: 0 }} />
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#F3F4F6', overflow: 'hidden' }}>
                            <div style={{ width: `${satisfPct}%`, height: '100%', background: satisfPct >= 80 ? '#10B981' : satisfPct >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 3, transition: 'width 0.8s ease' }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#374151', fontWeight: 600, minWidth: 32 }}>{satisfPct}%</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </SectionCard>
      </div>

      {/* ── L7: WhatsApp | Satisfação dos Atendimentos ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* WhatsApp */}
        <SectionCard title="WhatsApp" subtitle="Últimos 30 dias" icon={<MessageCircle />} iconBg="#D1FAE5" iconColor="#10B981" action={() => navigate('/whatsapp')} actionLabel="Ver central">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 48, borderRadius: 10, background: '#f1f5f9' }} />)}</div>
          ) : !waPhoneRecord ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <MessageCircle size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>WhatsApp não configurado ainda.</p>
              <button onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#D1FAE5', color: '#065f46', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Settings size={12} /> Configurar agora
              </button>
            </div>
          ) : waConvStats ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const hadResponseByJid: Record<string, boolean> = {}
                waMessages.forEach(m => {
                  if (m.from_me) hadResponseByJid[m.remote_jid] = true
                  else if (hadResponseByJid[m.remote_jid] === undefined) hadResponseByJid[m.remote_jid] = false
                })
                const total = waConvsRaw.length
                const botResp = waConvsRaw.filter(c => !c.assigned_user_id && hadResponseByJid[c.remote_jid] === true).length
                const teamResp = waConvsRaw.filter(c => !!c.assigned_user_id && hadResponseByJid[c.remote_jid] === true).length
                const noResp = waConvsRaw.filter(c => !hadResponseByJid[c.remote_jid]).length
                const closedCount = waConvsRaw.filter(c => c.status === 'closed').length
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
                    {([
                      { label: 'Total', value: total, color: '#1e2d6b', bg: '#f8fafc' },
                      { label: 'Bot respondeu', value: botResp, color: '#8B5CF6', bg: '#F5F3FF' },
                      { label: 'Equipe resp.', value: teamResp, color: '#3B82F6', bg: '#EFF6FF' },
                      { label: 'Sem resposta', value: noResp, color: '#EF4444', bg: '#FEF2F2' },
                      { label: 'Fechadas', value: closedCount, color: '#10B981', bg: '#F0FDF4' },
                    ]).map(({ label, value, color, bg }) => (
                      <div key={label} style={{ background: bg, borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color }}>{value}</p>
                        <p style={{ margin: '3px 0 0', fontSize: 9, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2 }}>{label}</p>
                        {total > 0 && value > 0 && <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8' }}>{Math.round(value / total * 100)}%</p>}
                      </div>
                    ))}
                  </div>
                )
              })()}
              <div>
                <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Conversas — últimos 7 dias</p>
                <ResponsiveContainer width="100%" height={72}>
                  <BarChart data={waConvStats.daily} margin={{ top: 0, right: 0, bottom: 0, left: -28 }}>
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11, border: '1px solid #e2e8f0' }} formatter={(v) => [v, 'Conversas']} />
                    <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {waAvgResponse !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F0FDF4', borderRadius: 8, padding: '5px 10px' }}>
                    <Clock size={12} color="#10B981" />
                    <p style={{ margin: 0, fontSize: 11, color: '#065f46' }}>Resp. média: <strong>{waAvgResponse < 60 ? `${waAvgResponse}min` : `${Math.round(waAvgResponse / 60)}h`}</strong></p>
                  </div>
                )}
                {waSatisfStats && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#FFFBEB', borderRadius: 8, padding: '5px 10px', border: '1px solid #FDE68A' }}>
                    <i className="ti ti-star" style={{ fontSize: 14, color: '#D97706' }} />
                    <p style={{ margin: 0, fontSize: 11, color: '#92400E', fontWeight: 600 }}>{waSatisfStats.avgScore.toFixed(1)}/3 satisfação</p>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', marginLeft: 'auto' }}>{waPhoneRecord.display_name || waPhoneRecord.phone_number}</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <MessageCircle size={28} color="#10B981" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Nenhuma conversa nos últimos 30 dias.</p>
            </div>
          )}
        </SectionCard>

        {/* Satisfação */}
        {waSatisfStats && (
          <SectionCard title="Satisfação dos Atendimentos" subtitle="Últimos 30 dias" icon={<Star />} iconBg="#FEF3C7" iconColor="#F59E0B" action={() => navigate('/surveys')} actionLabel="Ver pesquisas">
            {(() => {
              const sc = waSatisfStats.avgScore
              const pct = (sc / 3) * 100
              const scColor = sc >= 2.5 ? '#10B981' : sc >= 1.5 ? '#F59E0B' : '#EF4444'
              const scIcon = sc >= 2.5 ? 'ti-mood-smile' : sc >= 1.5 ? 'ti-mood-neutral' : 'ti-mood-sad'
              return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 16, gap: 4 }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', border: `6px solid ${scColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`ti ${scIcon}`} style={{ fontSize: 32, color: scColor }} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: scColor }}>{sc.toFixed(1)}/3</div>
                  <div style={{ color: '#6B7280', fontSize: 12 }}>{surveyScoresList.length} avaliações</div>
                </div>
              )
            })()}
            <div style={{ marginBottom: 16 }}>
              {[
                { icon: 'ti-mood-smile', label: 'Ótimo', score: 3, color: '#10B981' },
                { icon: 'ti-mood-neutral', label: 'Regular', score: 2, color: '#F59E0B' },
                { icon: 'ti-mood-sad', label: 'Ruim', score: 1, color: '#EF4444' },
              ].map(item => {
                const count = surveyScoresList.filter(c => c.satisfaction_score === item.score).length
                const pct = surveyScoresList.length > 0 ? Math.round(count / surveyScoresList.length * 100) : 0
                return (
                  <div key={item.score} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, minWidth: 68, color: item.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />{item.label}</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.8s ease' }}/>
                    </div>
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 600, minWidth: 35 }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
            {waSatisfStats.byAttendant.length > 0 && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Ranking por atendente</p>
                {waSatisfStats.byAttendant.map(({ name, total: t, sum }, i) => (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {i === 0 ? <i className="ti ti-trophy" style={{ fontSize: 13, color: '#F59E0B' }} /> : i === 1 ? <i className="ti ti-medal" style={{ fontSize: 13, color: '#94a3b8' }} /> : i === 2 ? <i className="ti ti-medal" style={{ fontSize: 13, color: '#CD7F32' }} /> : <span style={{ fontSize: 12 }}>#{i + 1}</span>}
                      <span style={{ fontSize: 12, color: '#1e2d6b', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>{(sum / t).toFixed(1)}/3</span>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>({t} av.)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        )}
      </div>

      {/* ── L8: Horários de maior movimento | Transferências recentes ────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : waConvsRaw.length > 0 ? '1fr 1fr' : '1fr', gap: 16 }}>
        {/* Mapa de calor */}
        {waConvsRaw.length > 0 && (() => {
          const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
          const heatmap = DAYS.map((day, idx) => {
            const dayConvs = waConvsRaw.filter(c => new Date(c.created_at).getDay() === idx)
            return {
              day,
              manha: dayConvs.filter(c => { const h = new Date(c.created_at).getHours(); return h >= 6 && h < 12 }).length,
              tarde: dayConvs.filter(c => { const h = new Date(c.created_at).getHours(); return h >= 12 && h < 18 }).length,
              noite: dayConvs.filter(c => { const h = new Date(c.created_at).getHours(); return h >= 18 || h < 6 }).length,
            }
          })
          const maxH = Math.max(...heatmap.flatMap(d => [d.manha, d.tarde, d.noite]), 1)
          const getColor = (val: number) => {
            const i = val / maxH
            if (i > 0.7) return { bg: '#00A896', color: '#fff' }
            if (i > 0.4) return { bg: '#7dd3ca', color: '#fff' }
            if (i > 0.1) return { bg: '#ccf2ee', color: '#0F6E56' }
            return { bg: '#F8FAFC', color: '#94a3b8' }
          }
          return (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Horários de maior movimento</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(7,1fr)', gap: 4 }}>
                <div />
                {DAYS.map(d => (
                  <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#94a3b8', padding: '4px 0' }}>{d}</div>
                ))}
                {(['manha', 'tarde', 'noite'] as const).map(period => (
                  <React.Fragment key={period}>
                    <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {period === 'manha' ? <><i className="ti ti-sunrise" /> Manhã</> : period === 'tarde' ? <><i className="ti ti-sun" /> Tarde</> : <><i className="ti ti-moon" /> Noite</>}
                    </div>
                    {heatmap.map(d => {
                      const val = d[period]
                      const { bg, color } = getColor(val)
                      return (
                        <div key={d.day}
                          title={`${d.day} — ${period === 'manha' ? 'Manhã' : period === 'tarde' ? 'Tarde' : 'Noite'}: ${val}`}
                          style={{ background: bg, borderRadius: 6, padding: '10px 4px', textAlign: 'center', fontSize: 11, fontWeight: 600, color, transition: 'all 0.2s' }}>
                          {val > 0 ? val : ''}
                        </div>
                      )
                    })}
                  </React.Fragment>
                ))}
              </div>
              <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8' }}>Baseado nas conversas do período selecionado</p>
            </div>
          )
        })()}

        {/* Transferências */}
        <SectionCard title="Transferências recentes" subtitle="Saídas registradas" icon={<AlertTriangle />} iconBg="#FFE4E6" iconColor="#F43F5E" action={() => navigate('/reports')} actionLabel="Ver todas">
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Carregando...</div>
          ) : transfers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0', color: '#94a3b8' }}>
              <CheckCircle size={28} strokeWidth={1.5} color="#22c55e" />
              <p style={{ margin: 0, fontSize: 13, color: '#166534', fontWeight: 600 }}>Nenhuma transferência registrada</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transfers.map(t => {
                const REASON_COLORS: Record<string, { bg: string; color: string }> = {
                  financial: { bg: '#FEE2E2', color: '#DC2626' },
                  competition: { bg: '#FEF3C7', color: '#D97706' },
                  pedagogical: { bg: '#DBEAFE', color: '#2563EB' },
                  relocation: { bg: '#F3F4F6', color: '#6B7280' },
                  distance: { bg: '#FEF9C3', color: '#854D0E' },
                  other: { bg: '#F3F4F6', color: '#6B7280' },
                }
                const rc = t.reason_category ? (REASON_COLORS[t.reason_category] ?? { bg: '#F3F4F6', color: '#6B7280' }) : null
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: '#fff', border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <ArrowRight size={14} color="#F43F5E" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.student_name}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{t.course_grade}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(t.transfer_date).toLocaleDateString('pt-BR')}</span>
                      {t.reason_category && rc && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: rc.bg, color: rc.color }}>
                          {REASON_LABELS[t.reason_category] || t.reason_category}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── L9: Acesso rápido ────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 14px' }}>Acesso rápido</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Leads', desc: 'Funil de captação', icon: <Users size={18} color="#8B5CF6" />, bg: '#EDE9FE', path: '/leads' },
            { label: 'Visitas', desc: 'Agendar e acompanhar', icon: <BarChart3 size={18} color="#F59E0B" />, bg: '#FEF3C7', path: '/visits' },
            { label: 'WhatsApp', desc: 'Central de mensagens', icon: <MessageCircle size={18} color="#10B981" />, bg: '#D1FAE5', path: '/whatsapp' },
            { label: 'Relatórios', desc: 'Análise completa', icon: <TrendingUp size={18} color="#3B82F6" />, bg: '#DBEAFE', path: '/reports' },
            { label: 'Matrículas', desc: 'Controle de alunos', icon: <GraduationCap size={18} color="#00A896" />, bg: '#E6F7F5', path: '/enrollments' },
          ].map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: '12px 14px', borderRadius: 12, background: item.bg, border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {item.icon}
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{item.label}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <CampaignGeneratorModal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setShowModalAtStep(undefined) }}
        onApply={() => { load(); setShowModal(false) }}
        existingCycle={(activeCycle ?? releasedCycle) as Parameters<typeof CampaignGeneratorModal>[0]['existingCycle']}
        institutionId={institutionId}
        institutionName={user?.institution_name || 'Escola'}
        openAtStep={showModalAtStep}
      />

      {showSetup && (
        <SchoolSetupModal
          institutionId={institutionId}
          initialStep={setupInitialStep}
          onComplete={() => { setShowSetup(false); setSetupInitialStep(1); load() }}
        />
      )}
    </div>
  )
}