import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, PieChart, Pie, Cell,
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

  const [loading, setLoading] = useState(true)
  const [cycles, setCycles] = useState<CampaignCycle[]>([])
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [leads, setLeads] = useState<{ id: string; status: string; created_at: string }[]>([])
  const [visits, setVisits] = useState<{ id: string; status: string; created_at: string }[]>([])
  const [waMessages, setWaMessages] = useState<{ id: string; created_at: string; from_me: boolean }[]>([])
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

  useEffect(() => { if (!institutionId) return; load() }, [institutionId])

  async function load() {
    setLoading(true)
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [cyclesRes, funnelRes, transferRes, leadsRes, visitsRes, waRes, enrollRes, usersRes] = await Promise.all([
        supabase.from('campaign_cycles').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
        supabase.from('funnel_metrics').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('student_transfers').select('id,student_name,course_grade,transfer_date,reason_category').eq('institution_id', institutionId).is('deleted_at', null).order('transfer_date', { ascending: false }).limit(5),
        supabase.from('leads').select('id,status,created_at').eq('institution_id', institutionId),
        supabase.from('visits').select('id,status,created_at').eq('institution_id', institutionId),
        supabase.from('whatsapp_messages').select('id,created_at,from_me').eq('institution_id', institutionId).gte('created_at', thirtyDaysAgo),
        supabase.from('enrollments').select('id,user_id,created_at').eq('institution_id', institutionId),
        supabase.from('users').select('id,full_name,role').eq('institution_id', institutionId),
      ])

      const loadedCycles = (cyclesRes.data ?? []) as CampaignCycle[]
      setCycles(loadedCycles)
      setFunnelData(funnelRes.data ?? [])
      setTransfers((transferRes.data ?? []) as StudentTransfer[])
      setLeads((leadsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      setVisits((visitsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      setWaMessages((waRes.data ?? []) as { id: string; created_at: string; from_me: boolean }[])

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

  async function fetchAiInsight(funnel: FunnelMetrics) {
    if (aiInsightFetched.current) return
    aiInsightFetched.current = true
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
      if (json.result) setAiInsight(json.result)
    } catch { } finally { setAiInsightLoading(false) }
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

  const avgFee = (setupCycle?.school_data?.avg_monthly_fee as number | null | undefined) || latest?.avg_monthly_fee || latest?.fee || null

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Gestor'} 👋
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0' }}>
            {user?.institution_name || 'Sua escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!campaignUnlocked && (
            <div style={{ position: 'relative' }} onMouseEnter={() => setBtnTooltip(true)} onMouseLeave={() => setBtnTooltip(false)}>
              <button disabled style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, cursor: 'not-allowed' }}>
                <Lock size={14} /> Campanha bloqueada
              </button>
              {btnTooltip && (
                <div style={{ position: 'absolute', right: 0, top: '110%', zIndex: 999, background: '#1e2d6b', color: 'white', fontSize: 12, lineHeight: 1.4, padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', maxWidth: 260, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
                  Aguardando liberação pelo administrador.
                  <div style={{ position: 'absolute', right: 18, bottom: '100%', borderWidth: '5px', borderStyle: 'solid', borderColor: 'transparent transparent #1e2d6b transparent' }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Alertas inteligentes ─────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 12,
              background: a.type === 'warning' ? '#fef2f2' : a.type === 'success' ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${a.type === 'warning' ? '#fecaca' : a.type === 'success' ? '#bbf7d0' : '#bfdbfe'}`
            }}>
              {a.type === 'warning' ? <AlertTriangle size={14} color="#dc2626" /> : a.type === 'success' ? <CheckCircle size={14} color="#16a34a" /> : <Info size={14} color="#3b82f6" />}
              <span style={{ fontSize: 13, color: a.type === 'warning' ? '#991b1b' : a.type === 'success' ? '#166534' : '#1e40af', flex: 1 }}>{a.msg}</span>
              {a.action && a.path && (
                <button onClick={() => navigate(a.path!)} style={{ fontSize: 11, fontWeight: 700, color: '#1e2d6b', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  {a.action} <ArrowRight size={10} />
                </button>
              )}
            </div>
          ))}
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

      {/* ── Score + KPIs ─────────────────────────────────────────────────────── */}
      {!loading && hasHistory && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          {/* Score gauge */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
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

          {/* 4 KPIs */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KpiCard label={`Alunos ${latestYear ?? ''}`} value={fmt(totalStudents)} icon={<Users size={20} color="#00A896" />} iconBg="#E6F7F5" variation={totalVariation} />
            <KpiCard label="Novatos" value={fmt(newStudents)} icon={<TrendingUp size={20} color="#8B5CF6" />} iconBg="#EDE9FE" variation={newVariation} sub={totalStudents > 0 ? `${Math.round((newStudents / totalStudents) * 100)}% do total` : undefined} />
            <KpiCard label="Market share" value={marketSharePct !== null ? `${marketSharePct}%` : (marketLoading ? '…' : '—')} icon={<BarChart3 size={20} color="#F59E0B" />} iconBg="#FEF3C7" sub={estimatedSchools ? `~${estimatedSchools} escolas na cidade` : undefined} />
            <KpiCard label="Próxima campanha" value={monthsUntil > 0 ? `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'}` : 'Ativa'} icon={<Calendar size={20} color="#3B82F6" />} iconBg="#DBEAFE" sub={`Ano letivo ${campaignYear}`} onClick={() => navigate('/reports')} />
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', height: 90 }} />)}
        </div>
      )}

      {/* ── Linha 2: Histórico + Mercado + Diagnóstico INEP ──────────────────── */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>

          {/* Histórico de alunos */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Histórico de alunos por ano</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip formatter={(value, name) => [fmt(Number(value)), name === 'novatos' ? 'Novatos' : 'Veteranos']} contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="veteranos" name="Veteranos" stroke="#00A896" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="novatos" name="Novatos" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Mercado + Diagnóstico INEP */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Market share card */}
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

            {/* Diagnóstico INEP */}
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

      {/* ── Campanha em andamento ────────────────────────────────────────────── */}
      {activeCycle && funnelHasData && latestFunnel && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px #dcfce7' }} />
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Campanha em andamento</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Período: {latestFunnel.period}</p>
              </div>
            </div>
            <button onClick={() => navigate('/reports')} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#00A896', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}>
              Ver funil completo <ArrowRight size={12} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Cadastros', val: latestFunnel.registrations, target: latestFunnel.registrations_target, color: '#3B82F6' },
              { label: 'Agendas', val: latestFunnel.schedules, target: latestFunnel.schedules_target, color: '#8B5CF6' },
              { label: 'Visitas', val: latestFunnel.visits, target: latestFunnel.visits_target, color: '#F59E0B' },
              { label: 'Matrículas', val: latestFunnel.enrollments, target: latestFunnel.enrollments_target, color: '#00A896' },
            ].map(({ label, val, target, color }) => {
              const pct = (target ?? 0) > 0 ? Math.round(((val ?? 0) / target!) * 100) : null
              const barColor = pct === null ? '#e2e8f0' : pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
              return (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700, color: '#1e2d6b' }}>{fmt(val ?? 0)}</p>
                  {(target ?? 0) > 0 && (
                    <>
                      <div style={{ height: 4, background: '#e2e8f0', borderRadius: 2, marginBottom: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct ?? 0)}%`, background: barColor, borderRadius: 2, transition: 'width 0.8s ease' }} />
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: barColor, fontWeight: 600 }}>{pct}% da meta ({fmt(target!)})</p>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Linha 3: Funil leads + Ranking usuários ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

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
        <SectionCard title="Ranking da Equipe" subtitle="Por matrículas confirmadas" icon={<Trophy />} iconBg="#FEF3C7" iconColor="#F59E0B" action={() => navigate('/reports')} actionLabel="Ver relatórios">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(4)].map((_, i) => <div key={i} style={{ height: 44, borderRadius: 8, background: '#f1f5f9' }} />)}</div>
          ) : userRankings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#94a3b8' }}>
              <Users size={28} strokeWidth={1.5} style={{ margin: '0 auto 8px' }} />
              <p style={{ margin: 0, fontSize: 13 }}>Nenhum dado de equipe disponível</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userRankings.map((u, i) => {
                const medalColors = ['#F59E0B', '#94A3B8', '#CD7F32']
                const isTop = i < 3
                return (
                  <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: i === 0 ? '#FFFBEB' : '#F8FAFC', border: `1px solid ${i === 0 ? '#FDE68A' : '#F1F5F9'}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: isTop ? medalColors[i] : '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {i === 0 ? <Trophy size={13} color="#fff" /> : <span style={{ fontSize: 11, fontWeight: 700, color: isTop ? '#fff' : '#94a3b8' }}>{i + 1}</span>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e2d6b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{u.role}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: i === 0 ? '#F59E0B' : '#1e2d6b' }}>{u.enrollments_count}</p>
                      <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>matrículas</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Linha 4: WhatsApp + Transferências ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* WhatsApp */}
        <SectionCard title="WhatsApp" subtitle="Últimos 30 dias" icon={<MessageCircle />} iconBg="#D1FAE5" iconColor="#10B981" action={() => navigate('/whatsapp')} actionLabel="Ver central">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(2)].map((_, i) => <div key={i} style={{ height: 48, borderRadius: 10, background: '#f1f5f9' }} />)}</div>
          ) : totalMessages === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <MessageCircle size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>WhatsApp não configurado ainda.</p>
              <button onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#D1FAE5', color: '#065f46', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Settings size={12} /> Configurar agora
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total', value: totalMessages, color: '#1e2d6b', bg: '#f8fafc' },
                  { label: 'Enviadas', value: waSent, color: '#10B981', bg: '#f0fdf4' },
                  { label: 'Recebidas', value: waReceived, color: '#3B82F6', bg: '#eff6ff' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ background: bg, borderRadius: 12, padding: 12, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color }}>{fmt(value)}</p>
                  </div>
                ))}
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap size={14} color="#10B981" />
                <p style={{ margin: 0, fontSize: 12, color: '#065f46' }}>
                  Taxa de resposta: <strong>{totalMessages > 0 ? ((waReceived / totalMessages) * 100).toFixed(0) : 0}%</strong> das mensagens são inbound
                </p>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                Integração Meta API em breve — dados de atendentes, tempo de resposta e conversões por canal.
              </p>
            </div>
          )}
        </SectionCard>

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
              {transfers.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#fafafa', border: '1px solid #f1f5f9' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: '#FFE4E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AlertTriangle size={14} color="#F43F5E" />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.student_name}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{t.course_grade} · {t.reason_category ? REASON_LABELS[t.reason_category] || t.reason_category : 'Sem motivo'}</p>
                  </div>
                  <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>{new Date(t.transfer_date).toLocaleDateString('pt-BR')}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── AI Insight ───────────────────────────────────────────────────────── */}
      {(aiInsightLoading || aiInsight) && (
        <div style={{ background: 'linear-gradient(135deg, #1e2d6b, #4C1D95)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Análise da IA — Inscribo</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Baseada nos dados do funil e histórico da escola</p>
            </div>
          </div>
          {aiInsightLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[...Array(3)].map((_, i) => <div key={i} style={{ height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.15)' }} />)}</div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>{aiInsight}</p>
          )}
        </div>
      )}

      {/* ── Acesso rápido ────────────────────────────────────────────────────── */}
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