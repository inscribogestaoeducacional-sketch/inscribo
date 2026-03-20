import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine
} from 'recharts'
import {
  TrendingUp, Target, RefreshCw, Upload, Settings, ChevronDown,
  ChevronUp, Plus, Edit2, Check, X, Copy, Trash2, AlertTriangle,
  FileText, Download, Loader2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { FunnelMetrics, MarketingCampaign, ReEnrollment } from '../../lib/supabase'

// ─── tipos locais ────────────────────────────────────────────
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
}

interface StudentTransfer {
  id: string
  institution_id: string
  student_name: string
  course_grade: string
  transfer_date: string
  reason_category: string | null
  reason_detail: string | null
  survey_token: string
  survey_completed_at: string | null
  survey_responses: Record<string, unknown> | null
  ai_diagnosis: string | null
  ai_risk_factors: string[] | null
  created_at: string
}

interface ErpImport {
  id: string
  institution_id: string
  import_date: string
  import_type: string
  file_name: string | null
  file_type: string | null
  processed_rows: number
  error_rows: number
  status: string
  ai_extraction_confidence: number | null
  created_at: string
}

interface ExtractedData {
  file_type_detected: 'enrollments' | 'active_students' | 'historical' | 'unknown'
  confidence: number
  enrollments: { student_name: string; course_grade: string; enrollment_date: string; enrollment_value: number }[]
  active_students: { student_name: string; course_grade: string; enrollment_year: number }[]
  historical_funnel: { period: string; registrations: number; schedules: number; visits: number; enrollments: number }[]
  summary: { total_records: number; date_range: string; notes: string }
}

// ─── helpers ────────────────────────────────────────────────
function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}
function dev(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b * 100) - 100)
}
function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm animate-pulse">
      <div className="h-3 bg-gray-200 rounded w-1/3 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-2/3" />
    </div>
  )
}

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? '#0d9488' : '#dc2626',
      color: 'white', padding: '12px 20px', borderRadius: 12,
      fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      animation: 'slideUp 0.2s ease'
    }}>
      {message}
    </div>
  )
}

const GRADE_OPTIONS = [
  'Infantil I', 'Infantil II', 'Infantil III', 'Infantil IV', 'Infantil V',
  '1º Ano EF', '2º Ano EF', '3º Ano EF', '4º Ano EF', '5º Ano EF',
  '6º Ano EF', '7º Ano EF', '8º Ano EF', '9º Ano EF',
  '1ª Série EM', '2ª Série EM', '3ª Série EM'
]

const REASON_LABELS: Record<string, string> = {
  financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Distância',
  competition: 'Outra escola', relocation: 'Mudança de cidade', other: 'Outro'
}

const PIE_COLORS = ['#0d9488', '#7c3aed', '#f97316', '#0ea5e9', '#84cc16', '#f43f5e']

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function GestorReports() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // dados
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [marketingData, setMarketingData] = useState<MarketingCampaign[]>([])
  const [reEnrollData, setReEnrollData] = useState<ReEnrollment[]>([])
  const [cycle, setCycle] = useState<CampaignCycle | null>(null)
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [erpImports, setErpImports] = useState<ErpImport[]>([])

  // IA insight
  const [insight, setInsight] = useState('')
  const [insightLoading, setInsightLoading] = useState(false)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // ─── carga inicial ───────────────────────────────────────
  const loadAll = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    try {
      const [f, m, r, cy, tr, imp] = await Promise.all([
        supabase.from('funnel_metrics').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('marketing_campaigns').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('re_enrollments').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('campaign_cycles').select('*').eq('institution_id', institutionId).eq('year', new Date().getFullYear()).maybeSingle(),
        supabase.from('student_transfers').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false }),
        supabase.from('erp_imports').select('*').eq('institution_id', institutionId).order('created_at', { ascending: false })
      ])
      setFunnelData(f.data || [])
      setMarketingData(m.data || [])
      setReEnrollData(r.data || [])
      setCycle(cy.data || null)
      setTransfers(tr.data || [])
      setErpImports(imp.data || [])
    } finally {
      setLoading(false)
    }
  }, [institutionId])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── insight IA ──────────────────────────────────────────
  const fetchInsight = useCallback(async () => {
    if (!funnelData.length) return
    setInsightLoading(true)
    const latest = funnelData[funnelData.length - 1]
    const previous = funnelData.length > 1 ? funnelData[funnelData.length - 2] : null
    const lastRe = reEnrollData[reEnrollData.length - 1] || null
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly_insight',
          payload: {
            funnel: latest,
            previousFunnel: previous,
            reenrollments: lastRe,
            campaignWeek: latest.period
          }
        })
      })
      const data = await res.json()
      if (data.result) setInsight(data.result)
    } catch {
      setInsight('Não foi possível carregar a análise. Verifique a configuração da API de IA.')
    } finally {
      setInsightLoading(false)
    }
  }, [funnelData, reEnrollData])

  useEffect(() => {
    if (!loading && funnelData.length > 0 && !insight) {
      fetchInsight()
    }
  }, [loading, funnelData.length]) // eslint-disable-line

  // ─── tabs config ─────────────────────────────────────────
  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: TrendingUp },
    { id: 'funnel', label: 'Funil', icon: Target },
    { id: 'marketing', label: 'Marketing & CPA', icon: TrendingUp },
    { id: 'reenrollments', label: 'Rematrículas', icon: RefreshCw },
    { id: 'transfers', label: 'Transferências', icon: AlertTriangle },
    { id: 'import', label: 'Importar Dados', icon: Upload },
  ]

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: '#f8f9fb' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatórios & Inteligência</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Análise de campanha de matrículas</p>
        </div>
        {cycle && (
          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid #bfdbfe' }}>
            {cycle.label} · Meta: {cycle.target_new_students} alunos
          </span>
        )}
      </div>

      {/* tabs */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 18px', fontSize: 13, fontWeight: 500,
                  whiteSpace: 'nowrap', border: 'none', cursor: 'pointer',
                  borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
                  color: active ? '#0d9488' : '#6b7280',
                  background: active ? '#f0fdfa' : 'transparent',
                  transition: 'all 0.15s'
                }}
              >
                <Icon style={{ width: 14, height: 14 }} />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <>
              {activeTab === 'overview' && <TabOverview funnelData={funnelData} marketingData={marketingData} reEnrollData={reEnrollData} cycle={cycle} insight={insight} insightLoading={insightLoading} onRefreshInsight={fetchInsight} />}
              {activeTab === 'funnel' && <TabFunnel funnelData={funnelData} cycle={cycle} />}
              {activeTab === 'marketing' && <TabMarketing marketingData={marketingData} institutionId={institutionId} onRefresh={loadAll} showToast={showToast} />}
              {activeTab === 'reenrollments' && <TabReenrollments reEnrollData={reEnrollData} institutionId={institutionId} onRefresh={loadAll} showToast={showToast} />}
              {activeTab === 'transfers' && <TabTransfers transfers={transfers} institutionId={institutionId} onRefresh={loadAll} showToast={showToast} />}
              {activeTab === 'import' && <TabImport erpImports={erpImports} institutionId={institutionId} cycle={cycle} onRefresh={loadAll} showToast={showToast} />}
            </>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 1 — VISÃO GERAL
// ═══════════════════════════════════════════════════════════
function TabOverview({ funnelData, marketingData, reEnrollData, cycle, insight, insightLoading, onRefreshInsight }: {
  funnelData: FunnelMetrics[]
  marketingData: MarketingCampaign[]
  reEnrollData: ReEnrollment[]
  cycle: CampaignCycle | null
  insight: string
  insightLoading: boolean
  onRefreshInsight: () => void
}) {
  const latest = funnelData[funnelData.length - 1]
  const prev = funnelData.length > 1 ? funnelData[funnelData.length - 2] : null
  const lastRe = reEnrollData[reEnrollData.length - 1]

  // CPA dos últimos 3 meses
  const last3 = marketingData.slice(-3)
  const totalInv = last3.reduce((s, m) => s + (m.investment || 0), 0)
  const totalLeads = last3.reduce((s, m) => s + (m.leads_generated || 0), 0)
  const cpaReal = totalLeads > 0 ? totalInv / totalLeads : 0
  const avgCpaTarget = last3.filter(m => m.cpa_target).reduce((s, m, _, a) => s + (m.cpa_target || 0) / a.length, 0)

  // gráfico comparativo por anos
  const yearMap: Record<string, Record<string, number>> = {}
  funnelData.forEach(f => {
    const parts = f.period.split('/')
    const month = parts[0]?.trim()
    const year = parts[1]?.trim()
    if (!month || !year) return
    if (!yearMap[year]) yearMap[year] = {}
    yearMap[year][month] = f.registrations
  })
  const years = Object.keys(yearMap).sort()
  const months = [...new Set(funnelData.map(f => f.period.split('/')[0]?.trim()).filter(Boolean))]
  const chartData = months.map(m => {
    const row: Record<string, string | number> = { month: m }
    years.forEach(y => { row[y] = yearMap[y]?.[m] || 0 })
    return row
  })

  // desvios por fase
  const phases = [
    { label: 'Cadastros', actual: latest?.registrations || 0, target: latest?.registrations_target || 0, prevActual: prev?.registrations || 0, prevTarget: prev?.registrations_target || 0 },
    { label: 'Agendas', actual: latest?.schedules || 0, target: latest?.schedules_target || 0, prevActual: prev?.schedules || 0, prevTarget: prev?.schedules_target || 0 },
    { label: 'Visitas', actual: latest?.visits || 0, target: latest?.visits_target || 0, prevActual: prev?.visits || 0, prevTarget: prev?.visits_target || 0 },
    { label: 'Matrículas', actual: latest?.enrollments || 0, target: latest?.enrollments_target || 0, prevActual: prev?.enrollments || 0, prevTarget: prev?.enrollments_target || 0 },
  ]

  // recálculo de rota
  let routeCalc = null
  if (cycle) {
    const totalEnrollments = funnelData.reduce((s, f) => s + (f.enrollments || 0), 0)
    const remaining = cycle.target_new_students - totalEnrollments
    const endDate = new Date(cycle.end_date)
    const today = new Date()
    const weeksLeft = Math.max(1, Math.round((endDate.getTime() - today.getTime()) / (7 * 24 * 3600 * 1000)))
    const totalReg = funnelData.slice(-3).reduce((s, f) => s + (f.registrations || 0), 0)
    const totalEnrLast3 = funnelData.slice(-3).reduce((s, f) => s + (f.enrollments || 0), 0)
    const convRate = totalReg > 0 ? totalEnrLast3 / totalReg : 0.05
    const regPerWeek = convRate > 0 ? Math.ceil((remaining / convRate) / weeksLeft) : 0
    routeCalc = { remaining, weeksLeft, regPerWeek, convRate: Math.round(convRate * 100) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* IA insight */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 16, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
            <span style={{ fontWeight: 700, color: '#1e40af', fontSize: 14 }}>Análise da semana — IA</span>
          </div>
          <button
            onClick={onRefreshInsight}
            disabled={insightLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1d4ed8', background: 'transparent', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
          >
            {insightLoading ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} /> : <RefreshCw style={{ width: 12, height: 12 }} />}
            Atualizar
          </button>
        </div>
        {insightLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse" style={{ height: 14, background: '#bfdbfe', borderRadius: 4, width: i === 2 ? '60%' : '100%' }} />
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: '#1e3a8a', lineHeight: 1.6, margin: 0 }}>{insight || 'Clique em "Atualizar" para gerar análise.'}</p>
        )}
      </div>

      {/* KPI cards */}
      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Cadastros', actual: latest.registrations, target: latest.registrations_target, suffix: '' },
            { label: 'Matrículas', actual: latest.enrollments, target: latest.enrollments_target, suffix: '' },
            { label: 'CPA Atual', actual: cpaReal, target: avgCpaTarget || cpaReal, suffix: 'R$', isCpa: true },
            { label: 'Rematrículas', actual: lastRe ? pct(lastRe.re_enrolled, lastRe.total_base) : 0, target: lastRe?.target_percentage || 85, suffix: '%' },
          ].map(({ label, actual, target, suffix, isCpa }) => {
            const deviation = isCpa
              ? target > 0 ? Math.round(((actual - target) / target) * 100) : 0
              : dev(actual, target)
            const isPositive = isCpa ? deviation <= 0 : deviation >= 0
            const devColor = isPositive ? '#16a34a' : '#dc2626'
            const devBg = isPositive ? '#f0fdf4' : '#fef2f2'
            return (
              <div key={label} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: '#1e2d6b', margin: '0 0 6px', lineHeight: 1 }}>
                  {suffix === 'R$' ? fmtCurrency(actual) : suffix === '%' ? `${Math.round(actual)}%` : fmt(actual)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>Meta: {suffix === 'R$' ? fmtCurrency(target) : suffix === '%' ? `${target}%` : fmt(target)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: devColor, background: devBg, padding: '2px 6px', borderRadius: 6 }}>
                    {deviation > 0 ? '+' : ''}{deviation}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>Nenhum dado de funil cadastrado ainda.</div>
      )}

      {/* gráfico comparativo */}
      {chartData.length > 0 && years.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Cadastros — Comparativo Anual</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {years.map((y, i) => (
                <Bar key={y} dataKey={y} fill={i === years.length - 1 ? '#0d9488' : '#94a3b8'} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* desvios por fase */}
      {latest && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Desvios por fase — {latest.period}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {phases.map(({ label, actual, target, prevActual, prevTarget }) => {
              const pctVal = Math.min(100, target > 0 ? (actual / target) * 100 : 0)
              const devVal = dev(actual, target)
              const prevDev = dev(prevActual, prevTarget)
              const diff = devVal - prevDev
              const barColor = pctVal >= 100 ? '#0d9488' : pctVal >= 90 ? '#f59e0b' : '#dc2626'
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</span>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Real: {fmt(actual)} | Meta: {fmt(target)} | Desvio: {devVal > 0 ? '+' : ''}{devVal} p.p.</span>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctVal}%`, background: barColor, borderRadius: 8, transition: 'width 0.5s' }} />
                  </div>
                  {prev && (
                    <p style={{ fontSize: 11, color: diff >= 0 ? '#16a34a' : '#dc2626', margin: '4px 0 0' }}>
                      vs período anterior: {diff > 0 ? '+' : ''}{diff} p.p.
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* recálculo de rota */}
      {routeCalc ? (
        <div style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', borderRadius: 16, padding: 24, color: 'white' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>Recálculo de Rota</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {[
              { label: 'Matrículas restantes', value: routeCalc.remaining },
              { label: 'Semanas úteis restantes', value: routeCalc.weeksLeft },
              { label: 'Cadastros/semana necessários', value: routeCalc.regPerWeek },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px' }}>{value}</p>
                <p style={{ fontSize: 12, opacity: 0.85, margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, opacity: 0.75, margin: '12px 0 0' }}>
            Taxa de conversão atual: {routeCalc.convRate}% (cadastros → matrículas, últimos 3 períodos)
          </p>
        </div>
      ) : (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle style={{ width: 20, height: 20, color: '#d97706', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#92400e', margin: 0 }}>Campanha não configurada</p>
            <p style={{ fontSize: 12, color: '#b45309', margin: '2px 0 0' }}>Vá para a aba "Importar Dados" → "Configurar campanha" para definir metas e datas.</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 2 — FUNIL
// ═══════════════════════════════════════════════════════════
function TabFunnel({ funnelData, cycle }: { funnelData: FunnelMetrics[]; cycle: CampaignCycle | null }) {
  const totals = funnelData.reduce((acc, f) => ({
    reg: acc.reg + (f.registrations || 0),
    regT: acc.regT + (f.registrations_target || 0),
    sch: acc.sch + (f.schedules || 0),
    schT: acc.schT + (f.schedules_target || 0),
    vis: acc.vis + (f.visits || 0),
    visT: acc.visT + (f.visits_target || 0),
    enr: acc.enr + (f.enrollments || 0),
    enrT: acc.enrT + (f.enrollments_target || 0),
  }), { reg: 0, regT: 0, sch: 0, schT: 0, vis: 0, visT: 0, enr: 0, enrT: 0 })

  const funnelStages = [
    { label: 'Cadastros', actual: totals.reg, target: totals.regT, conv: 100, convLabel: 'entrada do funil' },
    { label: 'Agendas', actual: totals.sch, target: totals.schT, conv: pct(totals.sch, totals.reg), convLabel: `dos cadastros agendaram` },
    { label: 'Visitas', actual: totals.vis, target: totals.visT, conv: pct(totals.vis, totals.sch), convLabel: `das agendas visitaram` },
    { label: 'Matrículas', actual: totals.enr, target: totals.enrT, conv: pct(totals.enr, totals.vis), convLabel: `das visitas matricularam` },
  ]

  const last6 = [...funnelData].slice(-6)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* funil cascata */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 20px' }}>Funil Acumulado da Campanha</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {funnelStages.map(({ label, actual, target, conv, convLabel }, i) => {
            const width = i === 0 ? 100 : Math.max(20, conv)
            const devVal = dev(actual, target)
            const hasIssue = devVal < -10
            return (
              <div key={label} style={{ width: `${width}%`, transition: 'width 0.5s' }}>
                <div style={{
                  background: hasIssue ? '#fef2f2' : '#f0fdfa',
                  border: `2px solid ${hasIssue ? '#fca5a5' : '#99f6e4'}`,
                  borderRadius: 12, padding: '14px 20px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: hasIssue ? '#dc2626' : '#0d9488', margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>{conv}% {convLabel}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 20, fontWeight: 800, color: '#1e2d6b', margin: 0 }}>{fmt(actual)}</p>
                    <p style={{ fontSize: 11, color: devVal >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600, margin: 0 }}>
                      {devVal > 0 ? '+' : ''}{devVal}% vs meta ({fmt(target)})
                    </p>
                  </div>
                </div>
                {i < funnelStages.length - 1 && (
                  <div style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: `12px solid ${hasIssue ? '#fca5a5' : '#99f6e4'}`, margin: '0 auto' }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* tabela histórico */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Histórico Mensal</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Período</th>
                {['Cadastros', 'Agendas', 'Visitas', 'Matrículas'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'center', color: '#6b7280', fontWeight: 600 }} colSpan={3}>{h}</th>
                ))}
              </tr>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '6px 16px' }} />
                {['Cadastros', 'Agendas', 'Visitas', 'Matrículas'].flatMap(h => (
                  ['R', 'M', 'Δ'].map(sub => (
                    <th key={`${h}-${sub}`} style={{ padding: '6px 8px', textAlign: 'center', color: '#94a3b8', fontWeight: 500, fontSize: 11 }}>{sub}</th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {last6.map((f, i) => {
                const cells = [
                  { actual: f.registrations, target: f.registrations_target },
                  { actual: f.schedules, target: f.schedules_target },
                  { actual: f.visits, target: f.visits_target },
                  { actual: f.enrollments, target: f.enrollments_target },
                ]
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{f.period}</td>
                    {cells.flatMap(({ actual, target }, ci) => {
                      const devVal = dev(actual, target)
                      const bg = devVal < 0 ? '#fef2f2' : devVal > 0 ? '#f0fdf4' : 'transparent'
                      const fg = devVal < 0 ? '#dc2626' : devVal > 0 ? '#16a34a' : '#6b7280'
                      return [
                        <td key={`${ci}-r`} style={{ padding: '10px 8px', textAlign: 'center', color: '#374151' }}>{fmt(actual)}</td>,
                        <td key={`${ci}-m`} style={{ padding: '10px 8px', textAlign: 'center', color: '#6b7280' }}>{fmt(target)}</td>,
                        <td key={`${ci}-d`} style={{ padding: '10px 8px', textAlign: 'center', background: bg, color: fg, fontWeight: 700, borderRadius: 4 }}>
                          {devVal > 0 ? '+' : ''}{devVal}
                        </td>
                      ]
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 3 — MARKETING & CPA
// ═══════════════════════════════════════════════════════════
function TabMarketing({ marketingData, institutionId, onRefresh, showToast }: {
  marketingData: MarketingCampaign[]
  institutionId: string
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{ investment: string; leads_generated: string; cpa_target: string }>({ investment: '', leads_generated: '', cpa_target: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ month_year: '', investment: '', leads_generated: '', cpa_target: '' })
  const [saving, setSaving] = useState(false)

  const startEdit = (m: MarketingCampaign) => {
    setEditingId(m.id)
    setEditValues({ investment: String(m.investment), leads_generated: String(m.leads_generated), cpa_target: String(m.cpa_target || '') })
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('marketing_campaigns').update({
        investment: parseFloat(editValues.investment) || 0,
        leads_generated: parseInt(editValues.leads_generated) || 0,
        cpa_target: editValues.cpa_target ? parseFloat(editValues.cpa_target) : null,
      }).eq('id', id)
      if (error) throw error
      setEditingId(null)
      onRefresh()
      showToast('Dados atualizados!')
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  const saveNew = async () => {
    if (!newRow.month_year) return
    setSaving(true)
    try {
      const { error } = await supabase.from('marketing_campaigns').upsert({
        month_year: newRow.month_year,
        investment: parseFloat(newRow.investment) || 0,
        leads_generated: parseInt(newRow.leads_generated) || 0,
        cpa_target: newRow.cpa_target ? parseFloat(newRow.cpa_target) : null,
        institution_id: institutionId,
      }, { onConflict: 'month_year,institution_id' })
      if (error) throw error
      setShowAdd(false)
      setNewRow({ month_year: '', investment: '', leads_generated: '', cpa_target: '' })
      onRefresh()
      showToast('Registro adicionado!')
    } catch { showToast('Erro ao adicionar', 'error') }
    finally { setSaving(false) }
  }

  const totalInv = marketingData.reduce((s, m) => s + (m.investment || 0), 0)
  const totalLeads = marketingData.reduce((s, m) => s + (m.leads_generated || 0), 0)
  const cpaGeral = totalLeads > 0 ? totalInv / totalLeads : 0

  const chartData = marketingData.map(m => ({
    month: m.month_year,
    cpa_real: m.leads_generated > 0 ? Math.round(m.investment / m.leads_generated) : 0,
    cpa_alvo: m.cpa_target || 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* card CPA geral */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Investimento Total', value: fmtCurrency(totalInv), sub: `${marketingData.length} meses` },
          { label: 'Leads Gerados', value: fmt(totalLeads), sub: 'acumulado' },
          { label: 'CPA Geral', value: fmtCurrency(cpaGeral), sub: 'custo por lead', highlight: true },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} style={{ background: highlight ? '#0d9488' : 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: highlight ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: highlight ? 'white' : '#1e2d6b', margin: '0 0 4px' }}>{value}</p>
            <p style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.7)' : '#94a3b8', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* gráfico CPA */}
      {chartData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>CPA Real vs CPA Alvo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v: number, n: string) => [fmtCurrency(v), n === 'cpa_real' ? 'CPA Real' : 'CPA Alvo']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'cpa_real' ? 'CPA Real' : 'CPA Alvo'} />
              <Line type="monotone" dataKey="cpa_real" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cpa_alvo" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* tabela editável */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Campanhas Mensais</h3>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus style={{ width: 13, height: 13 }} /> Novo Mês
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Mês/Ano', 'Investimento', 'Leads', 'CPA Real', 'CPA Alvo', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showAdd && (
                <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <input value={newRow.month_year} onChange={e => setNewRow({ ...newRow, month_year: e.target.value })} placeholder="MM/AAAA" style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                  </td>
                  {(['investment', 'leads_generated', 'cpa_target'] as const).map(f => (
                    <td key={f} style={{ padding: '8px 12px' }} colSpan={f === 'investment' ? 1 : 1}>
                      <input type="number" value={newRow[f]} onChange={e => setNewRow({ ...newRow, [f]: e.target.value })} placeholder="0" style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                    </td>
                  ))}
                  <td /><td />
                  <td style={{ padding: '8px 12px' }}>
                    <button onClick={saveNew} disabled={saving} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginRight: 6 }}>Salvar</button>
                    <button onClick={() => setShowAdd(false)} style={{ background: '#f1f5f9', color: '#6b7280', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                  </td>
                </tr>
              )}
              {marketingData.map(m => {
                const cpaReal = m.leads_generated > 0 ? m.investment / m.leads_generated : 0
                const isEditing = editingId === m.id
                let status = '—'
                let statusBg = '#f1f5f9'
                let statusFg = '#6b7280'
                if (m.cpa_target && cpaReal > 0) {
                  const ratio = cpaReal / m.cpa_target
                  if (ratio > 1.2) { status = 'Acima'; statusBg = '#fef2f2'; statusFg = '#dc2626' }
                  else { status = 'OK'; statusBg = '#f0fdf4'; statusFg = '#16a34a' }
                }
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{m.month_year}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? <input type="number" value={editValues.investment} onChange={e => setEditValues({ ...editValues, investment: e.target.value })} style={{ width: 100, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                        : fmtCurrency(m.investment)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? <input type="number" value={editValues.leads_generated} onChange={e => setEditValues({ ...editValues, leads_generated: e.target.value })} style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                        : fmt(m.leads_generated)}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#f97316', fontWeight: 600 }}>{cpaReal > 0 ? fmtCurrency(cpaReal) : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? <input type="number" value={editValues.cpa_target} onChange={e => setEditValues({ ...editValues, cpa_target: e.target.value })} placeholder="0" style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} />
                        : m.cpa_target ? fmtCurrency(m.cpa_target) : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: statusBg, color: statusFg, padding: '3px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>{status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(m.id)} disabled={saving} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><Check style={{ width: 12, height: 12 }} /></button>
                          <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#6b7280', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><X style={{ width: 12, height: 12 }} /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(m)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}><Edit2 style={{ width: 14, height: 14 }} /></button>
                      )}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                <td style={{ padding: '12px 16px', color: '#374151' }}>Total</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{fmtCurrency(totalInv)}</td>
                <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(totalLeads)}</td>
                <td style={{ padding: '12px 16px', color: '#f97316' }}>{fmtCurrency(cpaGeral)}</td>
                <td /><td /><td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 4 — REMATRÍCULAS
// ═══════════════════════════════════════════════════════════
function TabReenrollments({ reEnrollData, institutionId, onRefresh, showToast }: {
  reEnrollData: ReEnrollment[]
  institutionId: string
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({ period: '', total_base: '', re_enrolled: '', defaulters: '', transferred: '', target_percentage: '85' })
  const [saving, setSaving] = useState(false)

  const chartData = reEnrollData.map(r => ({
    period: r.period,
    pct_real: pct(r.re_enrolled, r.total_base),
    target: r.target_percentage,
  }))

  const lastRe = reEnrollData[reEnrollData.length - 1]
  const taxaAtual = lastRe ? pct(lastRe.re_enrolled, lastRe.total_base) : 0
  const projection = reEnrollData.length >= 2
    ? Math.round(reEnrollData.reduce((s, r) => s + pct(r.re_enrolled, r.total_base), 0) / reEnrollData.length)
    : taxaAtual

  const saveReenroll = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('re_enrollments').upsert({
        period: formData.period,
        total_base: parseInt(formData.total_base) || 0,
        re_enrolled: parseInt(formData.re_enrolled) || 0,
        defaulters: parseInt(formData.defaulters) || 0,
        transferred: parseInt(formData.transferred) || 0,
        target_percentage: parseFloat(formData.target_percentage) || 85,
        institution_id: institutionId,
      }, { onConflict: 'period,institution_id' })
      if (error) throw error
      setShowModal(false)
      setFormData({ period: '', total_base: '', re_enrolled: '', defaulters: '', transferred: '', target_percentage: '85' })
      onRefresh()
      showToast('Base de rematrículas atualizada!')
    } catch { showToast('Erro ao salvar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Taxa Atual', value: `${taxaAtual}%`, sub: `${lastRe?.re_enrolled || 0} de ${lastRe?.total_base || 0}` },
          { label: 'Meta', value: `${lastRe?.target_percentage || 85}%`, sub: 'taxa de fidelização' },
          { label: 'Projeção Final', value: `${projection}%`, sub: 'média dos períodos', highlight: projection >= (lastRe?.target_percentage || 85) },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} style={{ background: highlight ? '#0d9488' : 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: highlight ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: highlight ? 'white' : '#1e2d6b', margin: '0 0 4px' }}>{value}</p>
            <p style={{ fontSize: 11, color: highlight ? 'rgba(255,255,255,0.7)' : '#94a3b8', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* gráfico */}
      {chartData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Evolução das Rematrículas</h3>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v: number, n: string) => [`${v}%`, n === 'pct_real' ? '% Rematric.' : 'Meta']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'pct_real' ? '% Rematric.' : 'Meta'} />
              <Bar dataKey="pct_real" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.pct_real >= entry.target ? '#0d9488' : '#f87171'} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* tabela */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Detalhamento por Período</h3>
          <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus style={{ width: 13, height: 13 }} /> Atualizar Base
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Período', 'Base', 'Rematric.', '% Real', 'Meta %', 'Desvio', 'Inadimp.', 'Transfer.'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reEnrollData.map((r, i) => {
                const pctReal = pct(r.re_enrolled, r.total_base)
                const devVal = pctReal - r.target_percentage
                const isOk = devVal >= 0
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{r.period}</td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(r.total_base)}</td>
                    <td style={{ padding: '12px 16px', color: '#0d9488', fontWeight: 600 }}>{fmt(r.re_enrolled)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: isOk ? '#16a34a' : '#dc2626' }}>{pctReal}%</td>
                    <td style={{ padding: '12px 16px', color: '#6b7280' }}>{r.target_percentage}%</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: isOk ? '#f0fdf4' : '#fef2f2', color: isOk ? '#16a34a' : '#dc2626', padding: '3px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                        {devVal > 0 ? '+' : ''}{devVal.toFixed(1)} p.p.
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#dc2626' }}>{fmt(r.defaulters)}</td>
                    <td style={{ padding: '12px 16px', color: '#f97316' }}>{fmt(r.transferred)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {reEnrollData.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Nenhum dado de rematrícula cadastrado ainda.</div>
          )}
        </div>
      </div>

      {/* modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Atualizar Base de Rematrículas</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X style={{ width: 18, height: 18 }} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                { field: 'period', label: 'Período', placeholder: 'Ex: Out/2025', type: 'text' },
                { field: 'total_base', label: 'Base total de alunos', placeholder: '0', type: 'number' },
                { field: 're_enrolled', label: 'Rematriculados', placeholder: '0', type: 'number' },
                { field: 'defaulters', label: 'Inadimplentes', placeholder: '0', type: 'number' },
                { field: 'transferred', label: 'Transferidos', placeholder: '0', type: 'number' },
                { field: 'target_percentage', label: 'Meta (%)', placeholder: '85', type: 'number' },
              ] as const).map(({ field, label, placeholder, type }) => (
                <div key={field}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={formData[field]}
                    onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                    placeholder={placeholder}
                    style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={saveReenroll} disabled={saving} style={{ padding: '8px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 5 — TRANSFERÊNCIAS
// ═══════════════════════════════════════════════════════════
function TabTransfers({ transfers, institutionId, onRefresh, showToast }: {
  transfers: StudentTransfer[]
  institutionId: string
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [showModal, setShowModal] = useState(false)
  const [newTransfer, setNewTransfer] = useState({ student_name: '', course_grade: '', transfer_date: new Date().toISOString().slice(0, 10), sendSurvey: true })
  const [saving, setSaving] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // pie chart data
  const reasonCounts: Record<string, number> = {}
  transfers.forEach(t => {
    const k = t.reason_category || 'other'
    reasonCounts[k] = (reasonCounts[k] || 0) + 1
  })
  const pieData = Object.entries(reasonCounts).map(([name, value]) => ({ name: REASON_LABELS[name] || name, value }))

  // série mais afetada
  const gradeCounts: Record<string, number> = {}
  transfers.forEach(t => { gradeCounts[t.course_grade] = (gradeCounts[t.course_grade] || 0) + 1 })
  const topGrade = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]

  const answered = transfers.filter(t => t.survey_completed_at).length
  const pending = transfers.filter(t => !t.survey_completed_at).length

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/survey/${token}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveTransfer = async () => {
    if (!newTransfer.student_name || !newTransfer.course_grade) return
    setSaving(true)
    try {
      const { data, error } = await supabase.from('student_transfers').insert({
        student_name: newTransfer.student_name,
        course_grade: newTransfer.course_grade,
        transfer_date: newTransfer.transfer_date,
        institution_id: institutionId,
      }).select().single()
      if (error) throw error
      if (newTransfer.sendSurvey && data?.survey_token) {
        setCreatedToken(data.survey_token)
      } else {
        setShowModal(false)
        setNewTransfer({ student_name: '', course_grade: '', transfer_date: new Date().toISOString().slice(0, 10), sendSurvey: true })
      }
      onRefresh()
      showToast('Transferência registrada!')
    } catch { showToast('Erro ao registrar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[
          { label: 'Total no Ano', value: transfers.length },
          { label: 'Pesquisas Respondidas', value: answered },
          { label: 'Pesquisas Pendentes', value: pending },
          { label: 'Série mais Afetada', value: topGrade ? `${topGrade[0]} (${topGrade[1]})` : '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 6px' }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* pie + tabela */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {pieData.length > 0 && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 12px' }}>Por Motivo</h3>
            <PieChart width={260} height={200}>
              <Pie data={pieData} cx={130} cy={90} innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false} fontSize={10}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Lista de Transferências</h3>
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Plus style={{ width: 13, height: 13 }} /> Registrar
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Aluno', 'Série', 'Data', 'Motivo', 'Pesquisa', 'Link'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <React.Fragment key={t.id}>
                    <tr
                      style={{ borderBottom: '1px solid #f1f5f9', cursor: t.ai_diagnosis ? 'pointer' : 'default' }}
                      onClick={() => t.ai_diagnosis && setExpandedId(expandedId === t.id ? null : t.id)}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#374151' }}>{t.student_name}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{t.course_grade}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{new Date(t.transfer_date).toLocaleDateString('pt-BR')}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {t.reason_category ? (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                            {REASON_LABELS[t.reason_category] || t.reason_category}
                          </span>
                        ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          background: t.survey_completed_at ? '#f0fdf4' : '#fffbeb',
                          color: t.survey_completed_at ? '#16a34a' : '#d97706',
                          padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600
                        }}>
                          {t.survey_completed_at ? 'Respondida' : 'Aguardando'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); copyLink(t.survey_token) }}
                          style={{ background: 'transparent', border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', color: '#6b7280', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Copy style={{ width: 11, height: 11 }} />
                          {copied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </td>
                    </tr>
                    {expandedId === t.id && t.ai_diagnosis && (
                      <tr>
                        <td colSpan={6} style={{ padding: '12px 24px', background: '#f0fdf4', borderBottom: '1px solid #e2e8f0' }}>
                          <p style={{ fontSize: 13, color: '#166534', margin: 0, lineHeight: 1.6 }}>
                            <strong>Diagnóstico IA:</strong> {t.ai_diagnosis}
                          </p>
                          {t.ai_risk_factors && t.ai_risk_factors.length > 0 && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {t.ai_risk_factors.map((f, i) => (
                                <span key={i} style={{ background: '#fef9c3', color: '#854d0e', padding: '2px 8px', borderRadius: 8, fontSize: 11 }}>{f}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            {transfers.length === 0 && (
              <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Nenhuma transferência registrada este ano.</div>
            )}
          </div>
        </div>
      </div>

      {/* modal de registro */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
            {createdToken ? (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Link de pesquisa gerado</h3>
                <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Compartilhe este link com o responsável do aluno:</p>
                <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#374151', wordBreak: 'break-all', marginBottom: 16 }}>
                  {`${window.location.origin}/survey/${createdToken}`}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { copyLink(createdToken); }}
                    style={{ flex: 1, background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                  >
                    {copied ? '✓ Copiado!' : 'Copiar link'}
                  </button>
                  <button onClick={() => { setCreatedToken(null); setShowModal(false); }} style={{ flex: 1, background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 13 }}>
                    Fechar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Registrar Transferência</h3>
                  <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X style={{ width: 18, height: 18 }} /></button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Nome do Aluno *</label>
                    <input value={newTransfer.student_name} onChange={e => setNewTransfer({ ...newTransfer, student_name: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Série *</label>
                    <select value={newTransfer.course_grade} onChange={e => setNewTransfer({ ...newTransfer, course_grade: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13 }}>
                      <option value="">Selecione...</option>
                      {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Data da Transferência *</label>
                    <input type="date" value={newTransfer.transfer_date} onChange={e => setNewTransfer({ ...newTransfer, transfer_date: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={newTransfer.sendSurvey} onChange={e => setNewTransfer({ ...newTransfer, sendSurvey: e.target.checked })} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 13, color: '#374151' }}>Enviar link de pesquisa ao responsável</span>
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => setShowModal(false)} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
                  <button onClick={saveTransfer} disabled={saving || !newTransfer.student_name || !newTransfer.course_grade} style={{ padding: '8px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: (!newTransfer.student_name || !newTransfer.course_grade) ? 0.5 : 1 }}>
                    {saving ? 'Salvando...' : 'Registrar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TAB 6 — IMPORTAR DADOS
// ═══════════════════════════════════════════════════════════
function TabImport({ erpImports, institutionId, cycle, onRefresh, showToast }: {
  erpImports: ErpImport[]
  institutionId: string
  cycle: CampaignCycle | null
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [openSection, setOpenSection] = useState<'import' | 'history' | 'cycle'>('import')

  // estado de importação
  const [fileState, setFileState] = useState<'idle' | 'reading' | 'extracting' | 'review' | 'confirming'>('idle')
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const [editedEnrollments, setEditedEnrollments] = useState<ExtractedData['enrollments']>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // estado do ciclo
  const [cycleForm, setCycleForm] = useState({
    year: new Date().getFullYear(),
    label: `Campanha ${new Date().getFullYear()}`,
    start_date: `${new Date().getFullYear()}-09-01`,
    end_date: `${new Date().getFullYear() + 1}-02-28`,
    target_new_students: 0,
    target_reenrollment_rate: 85,
    base_students: 0,
    projected_cpa: '',
  })
  const [savingCycle, setSavingCycle] = useState(false)

  useEffect(() => {
    if (cycle) {
      setCycleForm({
        year: cycle.year,
        label: cycle.label,
        start_date: cycle.start_date,
        end_date: cycle.end_date,
        target_new_students: cycle.target_new_students,
        target_reenrollment_rate: cycle.target_reenrollment_rate,
        base_students: cycle.base_students,
        projected_cpa: cycle.projected_cpa ? String(cycle.projected_cpa) : '',
      })
    }
  }, [cycle])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCurrentFile(file)
    setFileState('reading')

    const ext = file.name.split('.').pop()?.toLowerCase()
    const fileType = ext === 'pdf' ? 'pdf' : (ext === 'xlsx' ? 'xlsx' : 'csv')

    let fileContent = ''
    if (fileType === 'pdf') {
      fileContent = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
    } else {
      fileContent = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsText(file, 'utf-8')
      })
    }

    setFileState('extracting')
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract_file',
          payload: { fileContent: fileType === 'pdf' ? fileContent.split(',')[1] : fileContent, fileType, fileName: file.name }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const extracted = data.result as ExtractedData
      setExtractedData(extracted)
      setEditedEnrollments(extracted.enrollments || [])
      setFileState('review')
    } catch (err) {
      showToast('Erro ao extrair dados: ' + (err instanceof Error ? err.message : 'tente novamente'), 'error')
      setFileState('idle')
    }
  }

  const confirmImport = async () => {
    if (!extractedData) return
    setFileState('confirming')
    try {
      let processed = 0

      if (extractedData.file_type_detected === 'enrollments' && editedEnrollments.length > 0) {
        for (const e of editedEnrollments) {
          if (!e.student_name) continue
          const { error } = await supabase.from('enrollments').upsert({
            student_name: e.student_name,
            course_grade: e.course_grade,
            enrollment_date: e.enrollment_date || new Date().toISOString().slice(0, 10),
            enrollment_value: e.enrollment_value || null,
            institution_id: institutionId,
          }, { onConflict: 'id' })
          if (!error) processed++
        }
      }

      if (extractedData.file_type_detected === 'active_students') {
        for (const s of extractedData.active_students) {
          const { error } = await supabase.from('active_students').insert({
            student_name: s.student_name,
            course_grade: s.course_grade,
            enrollment_year: s.enrollment_year,
            institution_id: institutionId,
          })
          if (!error) processed++
        }
      }

      if (extractedData.file_type_detected === 'historical') {
        for (const f of extractedData.historical_funnel) {
          const { error } = await supabase.from('funnel_metrics').upsert({
            period: f.period,
            registrations: f.registrations,
            schedules: f.schedules,
            visits: f.visits,
            enrollments: f.enrollments,
            registrations_target: 0,
            schedules_target: 0,
            visits_target: 0,
            enrollments_target: 0,
            institution_id: institutionId,
          }, { onConflict: 'period,institution_id' })
          if (!error) processed++
        }
      }

      // registrar importação
      await supabase.from('erp_imports').insert({
        institution_id: institutionId,
        import_type: extractedData.file_type_detected === 'unknown' ? 'historical' : extractedData.file_type_detected,
        file_name: currentFile?.name,
        file_type: currentFile?.name.split('.').pop()?.toLowerCase() as 'csv' | 'xlsx' | 'pdf',
        processed_rows: processed,
        status: 'confirmed',
        ai_extraction_confidence: extractedData.confidence,
        raw_data: { summary: extractedData.summary }
      })

      onRefresh()
      setFileState('idle')
      setExtractedData(null)
      setCurrentFile(null)
      showToast(`Importados ${processed} registros com sucesso!`)
    } catch {
      showToast('Erro ao importar dados', 'error')
      setFileState('idle')
    }
  }

  const saveCycle = async () => {
    setSavingCycle(true)
    try {
      const { error } = await supabase.from('campaign_cycles').upsert({
        institution_id: institutionId,
        year: cycleForm.year,
        label: cycleForm.label,
        start_date: cycleForm.start_date,
        end_date: cycleForm.end_date,
        target_new_students: cycleForm.target_new_students,
        target_reenrollment_rate: cycleForm.target_reenrollment_rate,
        base_students: cycleForm.base_students,
        projected_cpa: cycleForm.projected_cpa ? parseFloat(cycleForm.projected_cpa) : null,
      }, { onConflict: 'institution_id,year' })
      if (error) throw error
      onRefresh()
      showToast('Campanha configurada!')
    } catch { showToast('Erro ao salvar campanha', 'error') }
    finally { setSavingCycle(false) }
  }

  const deleteImport = async (id: string) => {
    if (!confirm('Deletar este registro de importação?')) return
    await supabase.from('erp_imports').delete().eq('id', id)
    onRefresh()
    showToast('Importação removida')
  }

  const Section = ({ id, title, icon: Icon, children }: { id: typeof openSection; title: string; icon: React.ElementType; children: React.ReactNode }) => (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      <button
        onClick={() => setOpenSection(openSection === id ? 'import' : id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: openSection === id ? '1px solid #e2e8f0' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon style={{ width: 16, height: 16, color: '#0d9488' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b' }}>{title}</span>
        </div>
        {openSection === id ? <ChevronUp style={{ width: 16, height: 16, color: '#94a3b8' }} /> : <ChevronDown style={{ width: 16, height: 16, color: '#94a3b8' }} />}
      </button>
      {openSection === id && <div style={{ padding: 24 }}>{children}</div>}
    </div>
  )

  const typeLabels: Record<string, string> = { enrollments: 'Matrículas', active_students: 'Alunos Ativos', historical: 'Histórico', unknown: 'Desconhecido' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* SEÇÃO A — importar ERP */}
      <Section id="import" title="Importar dados do ERP (CSV, Excel ou PDF)" icon={Upload}>
        {fileState === 'idle' && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed #cbd5e1', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.2s', background: '#f8fafc'
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#0d9488')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
          >
            <Upload style={{ width: 36, height: 36, color: '#94a3b8', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>Arraste um arquivo ou clique para selecionar</p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>CSV, XLSX ou PDF exportado do ERP da escola</p>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        )}

        {(fileState === 'reading' || fileState === 'extracting') && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Loader2 style={{ width: 40, height: 40, color: '#0d9488', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>
              {fileState === 'reading' ? 'Lendo arquivo...' : 'IA analisando dados...'}
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Isso pode levar alguns segundos</p>
          </div>
        )}

        {fileState === 'review' && extractedData && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <span style={{ background: '#f0fdf4', color: '#16a34a', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {typeLabels[extractedData.file_type_detected] || 'Desconhecido'}
              </span>
              <span style={{ background: extractedData.confidence >= 0.8 ? '#f0fdf4' : '#fffbeb', color: extractedData.confidence >= 0.8 ? '#16a34a' : '#d97706', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                Confiança: {Math.round(extractedData.confidence * 100)}%
              </span>
              {extractedData.summary.total_records > 0 && (
                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                  {extractedData.summary.total_records} registros
                </span>
              )}
            </div>

            {extractedData.file_type_detected === 'enrollments' && editedEnrollments.length > 0 && (
              <div style={{ overflowX: 'auto', marginBottom: 20 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Nome', 'Série', 'Data Matrícula', 'Valor'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {editedEnrollments.slice(0, 10).map((e, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', background: !e.student_name ? '#fffbeb' : 'white' }}>
                          <input value={e.student_name} onChange={ev => { const n = [...editedEnrollments]; n[i] = { ...n[i], student_name: ev.target.value }; setEditedEnrollments(n) }} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input value={e.course_grade} onChange={ev => { const n = [...editedEnrollments]; n[i] = { ...n[i], course_grade: ev.target.value }; setEditedEnrollments(n) }} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
                        </td>
                        <td style={{ padding: '8px 12px', background: !e.enrollment_date ? '#fffbeb' : 'white' }}>
                          <input type="date" value={e.enrollment_date} onChange={ev => { const n = [...editedEnrollments]; n[i] = { ...n[i], enrollment_date: ev.target.value }; setEditedEnrollments(n) }} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <input type="number" value={e.enrollment_value} onChange={ev => { const n = [...editedEnrollments]; n[i] = { ...n[i], enrollment_value: parseFloat(ev.target.value) }; setEditedEnrollments(n) }} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 4, padding: '3px 6px', fontSize: 12 }} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {editedEnrollments.length > 10 && (
                  <p style={{ fontSize: 11, color: '#94a3b8', padding: '8px 12px' }}>+{editedEnrollments.length - 10} registros adicionais serão importados</p>
                )}
              </div>
            )}

            {extractedData.file_type_detected !== 'enrollments' && (
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 4px' }}>{extractedData.summary.notes || 'Dados identificados para importação'}</p>
                <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                  {extractedData.file_type_detected === 'active_students' && `${extractedData.active_students.length} alunos ativos encontrados`}
                  {extractedData.file_type_detected === 'historical' && `${extractedData.historical_funnel.length} períodos históricos encontrados`}
                </p>
              </div>
            )}

            {extractedData.confidence < 0.8 && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 16, display: 'flex', gap: 8 }}>
                <AlertTriangle style={{ width: 16, height: 16, color: '#d97706', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#92400e', margin: 0 }}>Confiança abaixo de 80%. Revise os campos destacados em amarelo antes de confirmar.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setFileState('idle'); setExtractedData(null) }} style={{ padding: '8px 18px', border: '1px solid #d1d5db', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={confirmImport} disabled={fileState === 'confirming'} style={{ padding: '8px 18px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                {fileState === 'confirming' ? <><Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> Importando...</> : <><Check style={{ width: 13, height: 13 }} /> Confirmar e importar</>}
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* SEÇÃO B — histórico de importações */}
      <Section id="history" title="Histórico de importações" icon={FileText}>
        {erpImports.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 16 }}>Nenhuma importação realizada ainda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Data', 'Tipo', 'Arquivo', 'Registros', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {erpImports.map(imp => (
                <tr key={imp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{new Date(imp.import_date).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{typeLabels[imp.import_type] || imp.import_type}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.file_name || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 600 }}>{imp.processed_rows}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: imp.status === 'confirmed' ? '#f0fdf4' : '#fffbeb', color: imp.status === 'confirmed' ? '#16a34a' : '#d97706', padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600 }}>
                      {imp.status === 'confirmed' ? 'Confirmado' : imp.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <button onClick={() => deleteImport(imp.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}>
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* SEÇÃO C — configurar campanha */}
      <Section id="cycle" title="Configurar campanha" icon={Settings}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {([
            { field: 'year', label: 'Ano', type: 'number' },
            { field: 'label', label: 'Nome da Campanha', type: 'text' },
            { field: 'start_date', label: 'Data de Início', type: 'date' },
            { field: 'end_date', label: 'Data de Término', type: 'date' },
            { field: 'target_new_students', label: 'Meta de Alunos Novos', type: 'number' },
            { field: 'target_reenrollment_rate', label: 'Meta de Rematrícula (%)', type: 'number' },
            { field: 'base_students', label: 'Base Atual de Alunos', type: 'number' },
            { field: 'projected_cpa', label: 'CPA Projetado (R$)', type: 'number' },
          ] as const).map(({ field, label, type }) => (
            <div key={field}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
              <input
                type={type}
                value={cycleForm[field]}
                onChange={e => setCycleForm({ ...cycleForm, [field]: type === 'number' && field !== 'projected_cpa' && field !== 'label' ? parseFloat(e.target.value) || 0 : e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={saveCycle} disabled={savingCycle} style={{ padding: '10px 24px', background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {savingCycle ? 'Salvando...' : cycle ? 'Atualizar Campanha' : 'Criar Campanha'}
          </button>
        </div>
      </Section>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } } @keyframes slideUp { from { transform: translateY(10px); opacity:0 } to { transform: translateY(0); opacity:1 } }`}</style>
    </div>
  )
}
