import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart, Line, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Users, TrendingUp, RefreshCw, AlertTriangle, BarChart3,
  Target, Sparkles, ArrowRight, Upload, MessageCircle, Info, Lock,
  MapPin, Activity, Settings, Calendar
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CampaignGeneratorModal from '../../components/reports/CampaignGeneratorModal'
import SchoolSetupModal from '../../components/onboarding/SchoolSetupModal'
import type { FunnelMetrics } from '../../lib/supabase'

// ─── types ────────────────────────────────────────────────────────────────────
interface HistoricalEntry {
  detected_year?: number
  year?: number
  total_students?: number
  total?: number
  new_students?: number
  novatos?: number
  returning_students?: number
  veterans?: number
  avg_monthly_fee?: number
  fee?: number
  error?: boolean
}

interface CampaignCycle {
  id: string
  institution_id: string
  year: number
  label: string
  start_date: string
  end_date: string
  target_new_students: number
  target_reenrollment_rate: number
  base_students: number
  projected_cpa: number | null
  created_at: string
  campaign_start_month?: number | null
  erp_files?: HistoricalEntry[] | null
  historical_data?: HistoricalEntry[] | null
  school_data?: {
    city?: string; state?: string; name?: string
    avg_monthly_fee?: number; current_students?: number
    grades?: string[]
    [key: string]: unknown
  } | null
  status?: string | null
  applied_at?: string | null
}

interface StudentTransfer {
  id: string
  student_name: string
  course_grade: string
  transfer_date: string
  reason_category: string | null
}

interface MarketData {
  city?: string
  state?: string
  school_age_population?: number
  private_school_rate?: number
  sector_growth?: number
  sector_growth_rate?: number
  avg_students_per_school?: number
  average_students_per_school?: number
  confidence?: string
  notes?: string
  novatos_rate?: number
  inep_data?: {
    school_classification?: string
    main_competitors?: string[]
    market_opportunity?: string
    risk_factors?: string
  }
  [key: string]: unknown
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const MONTH_SHORT: Record<number, string> = {
  1:'Jan',2:'Fev',3:'Mar',4:'Abr',5:'Mai',6:'Jun',
  7:'Jul',8:'Ago',9:'Set',10:'Out',11:'Nov',12:'Dez'
}

function calcCampaignTiming(startMonth = 8) {
  const today = new Date()
  const currentYear = today.getFullYear()
  const campaignYear = currentYear + 1
  const campaignDate = new Date(currentYear, startMonth - 1, 1)
  const monthsUntil = Math.max(0,
    (campaignDate.getFullYear() - today.getFullYear()) * 12 +
    campaignDate.getMonth() - today.getMonth()
  )
  const campaignStartMonth = `${MONTH_NAMES_PT[startMonth - 1]}/${currentYear}`
  const totalPrepMonths = startMonth - 1
  const currentMonthIdx = today.getMonth()
  const preCampaignProgress = totalPrepMonths > 0
    ? Math.min(100, Math.max(0, Math.round((currentMonthIdx / totalPrepMonths) * 100)))
    : 100
  return { monthsUntil, campaignStartMonth, preCampaignProgress, campaignYear }
}

function getCampaignMonthsList(startDate?: string, endDate?: string): number[] {
  if (!startDate || !endDate) return [8, 9, 10, 11, 12, 1, 2]
  const months: number[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const cur = new Date(start)
  while (cur <= end && months.length < 12) {
    months.push(cur.getMonth() + 1)
    cur.setMonth(cur.getMonth() + 1)
  }
  return months.length > 0 ? months : [8, 9, 10, 11, 12, 1, 2]
}

function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

const REASON_LABELS: Record<string, string> = {
  financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Distância',
  competition: 'Outra escola', relocation: 'Mudança de cidade', other: 'Outro'
}

function entryYear(e: HistoricalEntry) { return e.detected_year ?? e.year ?? 0 }
function entryTotal(e: HistoricalEntry) { return e.total_students ?? e.total ?? 0 }
function entryNew(e: HistoricalEntry) { return e.new_students ?? e.novatos ?? 0 }
function entryReturning(e: HistoricalEntry) { return e.returning_students ?? e.veterans ?? 0 }

// ─── score calculator ─────────────────────────────────────────────────────────
function calculateScore(data: {
  growthTrend: number
  reenrollRate: number
  marketShare: number
  conversionRate: number
  hasHistorical: boolean
}) {
  let score = 50
  if (data.growthTrend > 5) score += 15
  else if (data.growthTrend > 0) score += 8
  else if (data.growthTrend > -10) score -= 5
  else score -= 15

  if (data.reenrollRate >= 90) score += 15
  else if (data.reenrollRate >= 80) score += 8
  else if (data.reenrollRate >= 70) score += 0
  else score -= 10

  if (data.marketShare >= 20) score += 10
  else if (data.marketShare >= 10) score += 5
  else score -= 5

  if (data.conversionRate >= 25) score += 10
  else if (data.conversionRate >= 15) score += 5

  if (data.hasHistorical) score += 5

  return Math.min(100, Math.max(0, score))
}

// ─── component ────────────────────────────────────────────────────────────────
export default function GestorHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const institutionId = user?.institution_id!

  const [loading, setLoading] = useState(true)
  const [cycles, setCycles] = useState<CampaignCycle[]>([])
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showModalAtStep, setShowModalAtStep] = useState<number | undefined>(undefined)
  const [btnTooltip, setBtnTooltip] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupInitialStep, setSetupInitialStep] = useState(1)
  const [leads, setLeads] = useState<{ id: string; status: string; created_at: string }[]>([])
  const [visits, setVisits] = useState<{ id: string; status: string; created_at: string }[]>([])
  const [waMessages, setWaMessages] = useState<{ id: string; created_at: string; from_me: boolean }[]>([])
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [aiInsightLoading, setAiInsightLoading] = useState(false)
  const aiInsightFetched = useRef(false)

  useEffect(() => {
    if (!institutionId) return
    load()
  }, [institutionId])

  async function load() {
    setLoading(true)
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [cyclesRes, funnelRes, transferRes, leadsRes, visitsRes, waRes] = await Promise.all([
        supabase.from('campaign_cycles').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
        supabase.from('funnel_metrics').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('student_transfers').select('id, student_name, course_grade, transfer_date, reason_category').eq('institution_id', institutionId).is('deleted_at', null).order('transfer_date', { ascending: false }).limit(5),
        supabase.from('leads').select('id, status, created_at').eq('institution_id', institutionId),
        supabase.from('visits').select('id, status, created_at').eq('institution_id', institutionId),
        supabase.from('whatsapp_messages').select('id, created_at, from_me').eq('institution_id', institutionId).gte('created_at', thirtyDaysAgo),
      ])

      const loadedCycles = (cyclesRes.data ?? []) as CampaignCycle[]
      setCycles(loadedCycles)
      setFunnelData(funnelRes.data ?? [])
      setTransfers((transferRes.data ?? []) as StudentTransfer[])
      setLeads((leadsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      setVisits((visitsRes.data ?? []) as { id: string; status: string; created_at: string }[])
      setWaMessages((waRes.data ?? []) as { id: string; created_at: string; from_me: boolean }[])

      console.log('[Home] allCycles:', loadedCycles)
      console.log('[Home] campaignUnlocked:', loadedCycles.some(c => c.status === 'released' || c.status === 'active'))

      const alreadySetup = loadedCycles.some(c =>
        ['setup','draft','active','completed','released'].includes(c.status ?? '')
      )
      if (!alreadySetup) setShowSetup(true)

      const cycleWithLocation = loadedCycles.find(c => c.school_data?.city && c.school_data?.state)
      if (cycleWithLocation?.school_data?.city && cycleWithLocation?.school_data?.state) {
        fetchMarketData(cycleWithLocation.school_data.city as string, cycleWithLocation.school_data.state as string)
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchMarketData(city: string, state: string) {
    if (!city || !state) return
    setMarketLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_ibge', payload: { city, state } }),
      })
      const json = await res.json()
      setMarketData(json.result ?? null)
    } catch {
      // non-critical
    } finally {
      setMarketLoading(false)
    }
  }

  async function fetchAiInsight(funnel: FunnelMetrics) {
    if (aiInsightFetched.current) return
    aiInsightFetched.current = true
    setAiInsightLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly_insight',
          payload: {
            funnel: {
              registrations: funnel.registrations ?? 0,
              registrations_target: funnel.registrations_target ?? 0,
              schedules: funnel.schedules ?? 0,
              schedules_target: funnel.schedules_target ?? 0,
              visits: funnel.visits ?? 0,
              visits_target: funnel.visits_target ?? 0,
              enrollments: funnel.enrollments ?? 0,
              enrollments_target: funnel.enrollments_target ?? 0,
            },
            previousFunnel: null,
            reenrollments: null,
            campaignWeek: funnel.period ?? 'atual',
          }
        }),
      })
      const json = await res.json()
      if (json.result) setAiInsight(json.result)
    } catch {
      // non-critical
    } finally {
      setAiInsightLoading(false)
    }
  }

  // ─── derived data ─────────────────────────────────────────────────────────
  const activeCycle = cycles.find(c => c.status === 'active' || !!c.applied_at) ?? null
  const releasedCycle = cycles.find(c => c.status === 'released') ?? null
  const anyCycle = cycles[0] ?? null
  const setupCycle = cycles.find(c => c.school_data?.city) ?? null
  const campaignUnlocked = !!(activeCycle || releasedCycle)

  const cycleWithHistory = cycles.find(c =>
    c.historical_data && Array.isArray(c.historical_data) && c.historical_data.length > 0
  )
  const cycleWithErp = cycles.find(c =>
    c.erp_files && Array.isArray(c.erp_files) && (c.erp_files as HistoricalEntry[]).filter(f => !f.error).length > 0
  )
  const historicalSource = (
    cycleWithHistory?.historical_data ??
    (cycleWithErp?.erp_files as HistoricalEntry[] | null | undefined) ??
    []
  ).filter(e => !e.error)

  const sorted = [...historicalSource].sort((a, b) => entryYear(a) - entryYear(b))
  const latest = sorted[sorted.length - 1] ?? null
  const previous = sorted[sorted.length - 2] ?? null

  const totalStudents = latest ? entryTotal(latest) : 0
  const newStudents = latest ? entryNew(latest) : 0
  const returningStudents = latest ? entryReturning(latest) : 0

  const avgFee: number | null =
    (setupCycle?.school_data?.avg_monthly_fee as number | null | undefined) ||
    latest?.avg_monthly_fee || latest?.fee || null

  const latestYear = latest ? entryYear(latest) : null

  const totalVariation = previous && entryTotal(previous) > 0
    ? +((totalStudents - entryTotal(previous)) / entryTotal(previous) * 100).toFixed(1)
    : null
  const newVariation = previous && entryNew(previous) > 0
    ? +((newStudents - entryNew(previous)) / entryNew(previous) * 100).toFixed(1)
    : null

  const chartData = sorted.map(d => ({
    year: String(entryYear(d)),
    novatos: entryNew(d),
    veteranos: entryReturning(d),
  }))

  const hasHistory = sorted.length > 0
  const campaignStartMonth = activeCycle?.campaign_start_month ?? anyCycle?.campaign_start_month ?? 8
  const { monthsUntil, campaignStartMonth: campaignStartLabel, preCampaignProgress, campaignYear } =
    calcCampaignTiming(campaignStartMonth)

  const latestFunnel = funnelData.length > 0
    ? [...funnelData].sort((a, b) => a.period.localeCompare(b.period))[funnelData.length - 1]
    : null
  const funnelHasData = funnelData.some(f => (f.registrations || 0) > 0)

  // trigger AI insight once funnel data arrives
  useEffect(() => {
    if (latestFunnel && (latestFunnel.registrations ?? 0) > 0 && !aiInsightFetched.current) {
      fetchAiInsight(latestFunnel)
    }
  }, [latestFunnel?.period])

  // leads / wa metrics
  const totalLeads = leads.length
  const totalVisitsCount = visits.length
  const totalEnrolled = leads.filter(l => l.status === 'matriculado' || l.status === 'enrolled').length
  const conversionRateNum = totalLeads > 0 ? +((totalEnrolled / totalLeads) * 100).toFixed(1) : 0
  const conversionRate = conversionRateNum.toFixed(1)
  const totalMessages = waMessages.length
  const waSent     = waMessages.filter(m => m.from_me === true).length
  const waReceived = waMessages.filter(m => m.from_me === false).length

  // pie chart data
  const pieData = [
    { name: 'Matriculados', value: totalEnrolled,                              fill: '#0F6E56' },
    { name: 'Visitaram',    value: Math.max(0, totalVisitsCount - totalEnrolled), fill: '#1D9E75' },
    { name: 'Só cadastro',  value: Math.max(0, totalLeads - totalVisitsCount), fill: '#9FE1CB' },
  ].filter(d => d.value > 0)

  // market share calculations
  const marketCity = setupCycle?.school_data?.city ?? ''
  const marketState = setupCycle?.school_data?.state ?? ''
  const totalPrivateStudents = marketData
    ? (Number(marketData.school_age_population ?? 0)) * ((Number(marketData.private_school_rate ?? 18)) / 100)
    : 0
  const marketSharePct = totalPrivateStudents > 0 && totalStudents > 0
    ? +((totalStudents / totalPrivateStudents) * 100).toFixed(1)
    : null
  const avgStudentsPerSchoolVal = Number(
    marketData?.avg_students_per_school ?? marketData?.average_students_per_school ?? 500
  )
  const estimatedSchools = totalPrivateStudents > 0 && avgStudentsPerSchoolVal > 0
    ? Math.round(totalPrivateStudents / avgStudentsPerSchoolVal)
    : null
  const estimatedRank = totalPrivateStudents > 0 && totalStudents > 0 && estimatedSchools
    ? Math.max(1, Math.round((1 - totalStudents / totalPrivateStudents) * estimatedSchools))
    : null
  const marketBadge = marketSharePct !== null
    ? marketSharePct >= 25 ? { label: 'Líder de mercado', bg: '#dcfce7', color: '#15803d' }
    : marketSharePct >= 15 ? { label: 'Top 3', bg: '#dbeafe', color: '#1d4ed8' }
    : marketSharePct >= 5  ? { label: 'Top 10', bg: '#fef3c7', color: '#b45309' }
    : { label: 'Em crescimento', bg: '#f3f4f6', color: '#6b7280' }
    : null

  // school score
  const reenrollRateNum = totalStudents > 0 && newStudents < totalStudents
    ? +((returningStudents / (totalStudents - newStudents + returningStudents)) * 100).toFixed(1)
    : 75
  const score = calculateScore({
    growthTrend: newVariation ?? 0,
    reenrollRate: reenrollRateNum,
    marketShare: marketSharePct ?? 0,
    conversionRate: conversionRateNum,
    hasHistorical: hasHistory,
  })
  const scoreLabel = score >= 80 ? 'Alto Desempenho'
    : score >= 60 ? 'Desempenho Regular'
    : score >= 40 ? 'Atenção Necessária'
    : 'Situação Crítica'
  const scoreColor = score >= 80 ? '#0F6E56' : score >= 60 ? '#BA7517' : '#E24B4A'
  const scoreBg = score >= 80 ? '#f0fdf4' : score >= 60 ? '#fffbeb' : '#fef2f2'
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  // captação calendar
  const campaignMonthsList = getCampaignMonthsList(
    activeCycle?.start_date ?? anyCycle?.start_date,
    activeCycle?.end_date ?? anyCycle?.end_date
  )
  const defaultSeasonality: Record<number, number> = {
    1: 12, 2: 7, 8: 12, 9: 15, 10: 20, 11: 18, 12: 16
  }
  const calendarMax = Math.max(...campaignMonthsList.map(m => defaultSeasonality[m] ?? 10))

  const peakMonth = campaignMonthsList.reduce((best, m) =>
    (defaultSeasonality[m] ?? 0) > (defaultSeasonality[best] ?? 0) ? m : best,
    campaignMonthsList[0]
  )

  // market comparison (legacy)
  const schoolNovatosRate = totalStudents > 0 ? +((newStudents / totalStudents) * 100).toFixed(1) : null
  const marketNovatosRate = marketData?.novatos_rate
    ?? (marketData?.private_school_rate ? +(Number(marketData.private_school_rate) * 0.25).toFixed(1) : null)
  const aboveAverage = schoolNovatosRate !== null && marketNovatosRate !== null && schoolNovatosRate >= marketNovatosRate
  const privateSchoolsCount = avgStudentsPerSchoolVal > 0 && marketData?.school_age_population
    ? Math.round(Number(marketData.school_age_population) * (Number(marketData.private_school_rate ?? 18) / 100) / avgStudentsPerSchoolVal)
    : null
  const sectorGrowth = marketData?.sector_growth ?? marketData?.sector_growth_rate ?? null

  // ─── render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
            {greeting()}, {user?.full_name?.split(' ')[0] || 'Gestor'}
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '3px 0 0' }}>
            {user?.institution_name || 'Sua escola'} · {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!activeCycle && !releasedCycle && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                background: '#00A896', color: '#fff',
                border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              <Sparkles size={14} /> Gerar campanha
            </button>
          )}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => !campaignUnlocked && setBtnTooltip(true)}
            onMouseLeave={() => setBtnTooltip(false)}
          >
            <button
              onClick={() => campaignUnlocked && setShowModal(true)}
              disabled={!campaignUnlocked}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 10,
                background: activeCycle ? '#f0fdf4' : releasedCycle ? '#16a34a' : '#f1f5f9',
                color: activeCycle ? '#065f46' : releasedCycle ? '#fff' : '#94a3b8',
                border: activeCycle ? '1px solid #bbf7d0' : releasedCycle ? 'none' : '1px solid #e2e8f0',
                fontSize: 13, fontWeight: 600,
                cursor: campaignUnlocked ? 'pointer' : 'not-allowed',
              }}>
              {activeCycle ? <Sparkles size={14} /> : releasedCycle ? <Settings size={14} /> : <Lock size={14} />}
              {activeCycle ? 'Ajustar campanha' : releasedCycle ? 'Configurar campanha' : 'Campanha bloqueada'}
            </button>
            {btnTooltip && !campaignUnlocked && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 999,
                background: '#1e2d6b', color: 'white', fontSize: 12, lineHeight: 1.4,
                padding: '8px 12px', borderRadius: 8, whiteSpace: 'nowrap', maxWidth: 260,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>
                Aguardando liberação pelo administrador.
                <div style={{
                  position: 'absolute', right: 18, bottom: '100%',
                  borderWidth: '5px', borderStyle: 'solid',
                  borderColor: 'transparent transparent #1e2d6b transparent',
                }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {!loading && !hasHistory && (
        <div style={{
          background: '#fff', borderRadius: 16, border: '2px dashed #cbd5e1',
          padding: 36, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 14, textAlign: 'center',
        }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={26} color="#8B5CF6" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>Bem-vindo ao Áion Edu</h3>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b', maxWidth: 440, lineHeight: 1.6 }}>
              Para começar, importe os relatórios de matrículas dos últimos anos do seu sistema ERP (SIGA, Totvs ou similar). Isso leva menos de 2 minutos e permite que a IA analise o histórico da sua escola.
            </p>
          </div>
          <button
            onClick={() => { setSetupInitialStep(2); setShowSetup(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 10, background: '#8B5CF6', color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            <Upload size={15} /> Importar histórico agora
          </button>
        </div>
      )}

      {/* ── Score + KPI row ─────────────────────────────────────────────────── */}
      {!loading && hasHistory && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>

          {/* Score gauge card */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12"/>
              <circle cx="70" cy="70" r={radius} fill="none"
                stroke={scoreColor} strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}/>
              <text x="70" y="64" textAnchor="middle" fontSize="28" fontWeight="700" fill={scoreColor}>{score}</text>
              <text x="70" y="82" textAnchor="middle" fontSize="10" fill="#6b7280">score</text>
            </svg>
            <div style={{ minWidth: 160 }}>
              <p style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#1e2d6b', lineHeight: 1.2 }}>
                {user?.institution_name || 'Sua escola'}
              </p>
              <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: scoreBg, color: scoreColor, marginBottom: 8
              }}>
                {scoreLabel}
              </span>
              {(marketCity || marketState) && (
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={11} /> {marketCity}{marketCity && marketState ? `, ` : ''}{marketState}
                </p>
              )}
            </div>
          </div>

          {/* 4 KPI cards */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <KpiCard
              label={`Alunos ${latestYear ?? ''}`}
              value={fmt(totalStudents)}
              icon={<Users size={20} color="#00A896" />}
              iconBg="#E6F7F5"
              variation={totalVariation}
            />
            <KpiCard
              label="Novatos"
              value={fmt(newStudents)}
              icon={<TrendingUp size={20} color="#8B5CF6" />}
              iconBg="#EDE9FE"
              variation={newVariation}
              sub={totalStudents > 0 ? `${Math.round((newStudents / totalStudents) * 100)}% do total` : undefined}
            />
            <KpiCard
              label="Market share"
              value={marketSharePct !== null ? `${marketSharePct}%` : (marketLoading ? '…' : '—')}
              icon={<BarChart3 size={20} color="#F59E0B" />}
              iconBg="#FEF3C7"
              sub={estimatedSchools ? `~${estimatedSchools} escolas na cidade` : undefined}
            />
            <KpiCard
              label="Próxima campanha"
              value={monthsUntil > 0 ? `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'}` : 'Ativa'}
              icon={<Calendar size={20} color="#3B82F6" />}
              iconBg="#DBEAFE"
              sub={`Ano letivo ${campaignYear}`}
            />
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px', height: 90 }} className="animate-pulse" />
          ))}
        </div>
      )}

      {/* ── Historical chart + Market share card ────────────────────────────── */}
      {hasHistory && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>

          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>
              Histórico de alunos por ano
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip
                  formatter={(value, name) => [fmt(Number(value)), name === 'novatos' ? 'Novatos' : 'Veteranos']}
                  contentStyle={{ borderRadius: 10, fontSize: 12, border: '1px solid #e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="veteranos" name="Veteranos" stroke="#00A896" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="novatos" name="Novatos" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Market share card */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MapPin size={16} color="#F59E0B" />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>
                  Mercado local{marketCity ? ` — ${marketCity}` : ''}
                </h3>
                <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Estimado via Censo Escolar / IBGE</p>
              </div>
            </div>

            {marketLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(3)].map((_, i) => <div key={i} style={{ height: 48, borderRadius: 10, background: '#f1f5f9' }} className="animate-pulse" />)}
              </div>
            ) : marketData && marketSharePct !== null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Market share highlight */}
                <div style={{ background: '#f0fdf9', borderRadius: 12, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 2px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Market share estimado</p>
                  <p style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800, color: '#0F6E56', lineHeight: 1 }}>{marketSharePct}%</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#047857' }}>da rede privada local</p>
                </div>

                {marketBadge && (
                  <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: marketBadge.bg, color: marketBadge.color }}>
                    {marketBadge.label}
                  </span>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {estimatedRank && estimatedSchools && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Ranking estimado</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b' }}>#{estimatedRank} de ~{estimatedSchools}</span>
                    </div>
                  )}
                  {totalPrivateStudents > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Total rede privada</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e2d6b' }}>{fmt(Math.round(totalPrivateStudents))}</span>
                    </div>
                  )}
                  {sectorGrowth != null && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Crescimento setor</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0d9488' }}>+{sectorGrowth}%/ano</span>
                    </div>
                  )}
                </div>

                {marketData.notes && (
                  <p style={{ margin: 0, fontSize: 10, color: '#94a3b8', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                    <Info size={11} style={{ flexShrink: 0, marginTop: 1 }} /> {String(marketData.notes)}
                  </p>
                )}
              </div>
            ) : !marketData && !marketLoading ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#94a3b8' }}>
                <MapPin size={28} strokeWidth={1.5} />
                <p style={{ margin: '8px 0 0', fontSize: 12 }}>Dados de mercado não disponíveis.<br />Configure cidade/estado no wizard.</p>
              </div>
            ) : null}

            {/* Pre-campaign section */}
            <div style={{ background: '#f0fdf9', borderRadius: 10, padding: 14, marginTop: 4 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#065f46' }}>
                {monthsUntil === 0 ? `Campanha ativa — ${campaignStartLabel}` : `${monthsUntil} ${monthsUntil === 1 ? 'mês' : 'meses'} para a campanha`}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#047857' }}>Preparando ano letivo {campaignYear}</p>
            </div>

            <button onClick={() => navigate('/reports')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, background: 'none', border: '1px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Ver relatórios completos <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ── Calendário de captação ───────────────────────────────────────────── */}
      {(hasHistory || activeCycle) && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={16} color="#0EA5E9" />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Calendário de captação</h3>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Sazonalidade típica do mercado educacional brasileiro</p>
              </div>
            </div>
            {activeCycle && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '3px 10px', borderRadius: 999 }}>
                {activeCycle.label}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {campaignMonthsList.map(month => {
                const val = defaultSeasonality[month] ?? 10
                const pct = calendarMax > 0 ? val / calendarMax : 0
                const isPeak = pct > 0.7
                const isWarm = pct > 0.4 && !isPeak
                const barColor = isPeak ? '#0F6E56' : isWarm ? '#1D9E75' : '#9FE1CB'
                return (
                  <div key={month} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 28, fontSize: 12, fontWeight: 600, color: '#64748b', flexShrink: 0 }}>{MONTH_SHORT[month]}</span>
                    <div style={{ flex: 1, height: 28, borderRadius: 6, overflow: 'hidden', background: '#f3f4f6', position: 'relative' }}>
                      <div style={{
                        height: '100%',
                        width: `${pct * 100}%`,
                        background: `linear-gradient(to right, ${barColor}, ${barColor}cc)`,
                        borderRadius: 6,
                        transition: 'width 0.8s ease',
                      }} />
                    </div>
                    <span style={{ width: 32, fontSize: 11, fontWeight: 700, color: '#374151', textAlign: 'right', flexShrink: 0 }}>
                      {Math.round(pct * 100)}%
                    </span>
                    {isPeak && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#0F6E56', background: '#f0fdf4', padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Pico
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Strategy cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 14, border: '1px solid #bbf7d0' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#065f46', textTransform: 'uppercase' }}>
                  {MONTH_SHORT[peakMonth]} — Pico de matrículas
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#047857', lineHeight: 1.5 }}>
                  Foco total em fechamento. Equipe de vendas em modo de conversão máxima. Reduza fricção no processo.
                </p>
              </div>
              <div style={{ background: '#eff6ff', borderRadius: 12, padding: 14, border: '1px solid #bfdbfe' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>
                  Aquecimento
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>
                  Comunicação, eventos de visitação e campanhas de brand awareness para aquecer o mercado.
                </p>
              </div>
              <div style={{ background: '#fffbeb', borderRadius: 12, padding: 14, border: '1px solid #fde68a' }}>
                <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase' }}>
                  Retardatários
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#78350f', lineHeight: 1.5 }}>
                  Ofertas especiais, urgência e follow-up intensivo para indecisos no final do período.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Campanha em andamento ────────────────────────────────────────────── */}
      {activeCycle && funnelHasData && latestFunnel && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Campanha em andamento</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Período: {latestFunnel.period}</p>
            </div>
            <button onClick={() => navigate('/reports')} style={{ fontSize: 12, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver funil completo →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Cadastros', val: latestFunnel.registrations, target: latestFunnel.registrations_target },
              { label: 'Agendas', val: latestFunnel.schedules, target: latestFunnel.schedules_target },
              { label: 'Visitas', val: latestFunnel.visits, target: latestFunnel.visits_target },
              { label: 'Matrículas', val: latestFunnel.enrollments, target: latestFunnel.enrollments_target },
            ].map(({ label, val, target }) => {
              const pct = (target ?? 0) > 0 ? Math.round(((val ?? 0) / target!) * 100) : null
              const color = pct === null ? '#94a3b8' : pct >= 100 ? '#0d9488' : pct >= 75 ? '#f59e0b' : '#dc2626'
              return (
                <div key={label} style={{ background: '#f8fafc', borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ margin: '0 0 2px', fontSize: 22, fontWeight: 700, color: '#1e2d6b' }}>{fmt(val ?? 0)}</p>
                  {(target ?? 0) > 0 && <p style={{ margin: 0, fontSize: 11, color }}>{pct}% da meta ({fmt(target!)})</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Funil leads | WhatsApp ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Funil de leads */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} color="#8B5CF6" />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Funil atual</h3>
            </div>
            <button onClick={() => navigate('/leads')} style={{ fontSize: 11, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver leads →</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(3)].map((_, i) => <div key={i} style={{ height: 36, borderRadius: 8, background: '#f1f5f9' }} className="animate-pulse" />)}
            </div>
          ) : totalLeads === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <Users size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
                Nenhum lead cadastrado ainda.<br />Comece captando interessados.
              </p>
              <button onClick={() => navigate('/leads')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#EDE9FE', color: '#8B5CF6', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Ir para Leads <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <PieChart width={180} height={180}>
                <Pie data={pieData} cx={90} cy={90} innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={3} />
                <Tooltip formatter={(value, name) => [fmt(Number(value)), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
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
                <div style={{ marginTop: 4, background: '#f0fdf9', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#065f46' }}>Taxa lead → matrícula</p>
                  <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700, color: '#00A896' }}>{conversionRate}%</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp — últimos 30 dias */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageCircle size={16} color="#10B981" />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>WhatsApp</h3>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Últimos 30 dias</p>
              </div>
            </div>
            <button onClick={() => navigate('/whatsapp')} style={{ fontSize: 11, color: '#10B981', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver central →</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(3)].map((_, i) => <div key={i} style={{ height: 48, borderRadius: 10, background: '#f1f5f9' }} className="animate-pulse" />)}
            </div>
          ) : totalMessages === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', textAlign: 'center' }}>
              <MessageCircle size={28} color="#cbd5e1" strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>WhatsApp não configurado ainda.</p>
              <button onClick={() => navigate('/settings')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#D1FAE5', color: '#065f46', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <Settings size={12} /> Configurar agora
              </button>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* ── AI Insight ───────────────────────────────────────────────────────── */}
      {(aiInsightLoading || aiInsight) && (
        <div style={{ background: 'linear-gradient(135deg, #4C1D95, #6D28D9)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0 }}>Análise da IA</h3>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Baseada nos dados do funil atual</p>
            </div>
          </div>
          {aiInsightLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...Array(3)].map((_, i) => <div key={i} style={{ height: 14, borderRadius: 4, background: 'rgba(255,255,255,0.15)' }} className="animate-pulse" />)}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.7 }}>{aiInsight}</p>
          )}
        </div>
      )}

      {/* ── Transfers + Quick access ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Transferências recentes</h3>
            <button onClick={() => navigate('/reports')} style={{ fontSize: 11, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Ver todas →</button>
          </div>
          {loading ? (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>Carregando...</div>
          ) : transfers.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0', color: '#94a3b8' }}>
              <AlertTriangle size={28} strokeWidth={1.5} />
              <p style={{ margin: 0, fontSize: 13 }}>Nenhuma transferência registrada</p>
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
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 14px' }}>Acesso rápido</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Leads', desc: 'Funil de captação', icon: <Users size={18} color="#8B5CF6" />, bg: '#EDE9FE', path: '/leads' },
              { label: 'Visitas', desc: 'Agendar e acompanhar', icon: <BarChart3 size={18} color="#F59E0B" />, bg: '#FEF3C7', path: '/visits' },
              { label: 'WhatsApp', desc: 'Central de mensagens', icon: <MessageCircle size={18} color="#10B981" />, bg: '#D1FAE5', path: '/whatsapp' },
              { label: 'Relatórios', desc: 'Análise completa', icon: <TrendingUp size={18} color="#3B82F6" />, bg: '#DBEAFE', path: '/reports' },
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon, iconBg, variation, sub }: {
  label: string; value: string; icon: React.ReactNode; iconBg: string; variation?: number | null; sub?: string
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {variation !== null && variation !== undefined && (
        <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: variation >= 0 ? '#f0fdf4' : '#fef2f2', color: variation >= 0 ? '#16a34a' : '#dc2626' }}>
          {variation >= 0 ? '↑' : '↓'} {Math.abs(variation)}% vs. ano anterior
        </div>
      )}
      {sub && !variation && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94a3b8' }}>{sub}</p>}
    </div>
  )
}
