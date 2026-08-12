import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, TrendingUp, Users, Target, DollarSign,
  RefreshCw, AlertTriangle, CheckCircle, ChevronRight,
  Sparkles, ArrowUp, ArrowDown, Minus, Save, Loader2,
  FileText, Clock, Activity, PieChart, ArrowUpRight,
  ArrowDownRight, Info, X, Edit3, Settings, Rocket
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  PieChart as RechartsPie, Pie, Cell, Funnel, FunnelChart,
  LabelList
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import CampaignGeneratorModal from './CampaignGeneratorModal'

// ─── Tipos ────────────────────────────────────────────────────────────────────
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
  projected_cpa: number
  status: string
  finished_at?: string
  monthly_targets: MonthlyTarget[]
  market_data: Record<string, unknown>
  school_data: SchoolData
}

interface SchoolData {
  current_students: number
  exits?: Record<string, number>
}

interface MonthlyTarget {
  month: string
  year: number
  registrations: number
  schedules: number
  visits: number
  enrollments: number
  enrollments_new?: number
  enrollments_returning?: number
  investment_suggested: number
  cpa_target: number
}

interface FunnelMetric {
  id: string
  period: string
  registrations: number
  registrations_target: number
  schedules: number
  schedules_target: number
  visits: number
  visits_target: number
  enrollments: number
  enrollments_target: number
}

interface MonthlyReenrollment {
  id?: string
  institution_id: string
  period: string
  confirmed: number
  target: number
  base_total: number
  notes?: string
}

interface MarketingEntry {
  id?: string
  institution_id: string
  month_year: string
  investment: number
  leads_generated: number
  cpa_target: number
  channel?: string
}

interface Transfer {
  id: string
  student_name: string
  grade: string
  reason?: string
  transfer_date: string
  destination?: string
}

interface AIReport {
  id: string
  period: string
  content: string
  created_at: string
}

interface Props {
  institutionId: string
  institutionName: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const fmt = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n))
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

function periodLabel(period: string): string {
  if (!period) return ''
  if (period.includes('/')) return period
  const [y, m] = period.split('-')
  return `${MONTH_NAMES[(parseInt(m) - 1)]}/${y}`
}

function desvioColor(pct: number): string {
  if (pct >= 0) return '#16a34a'
  if (pct >= -15) return '#f59e0b'
  return '#dc2626'
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon, color, desvio, loading }: {
  label: string; value: string; sub?: string; icon: React.ReactNode
  color: string; desvio?: number; loading?: boolean
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
      padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {React.cloneElement(icon as React.ReactElement, { size: 15, color })}
        </div>
      </div>
      {loading
        ? <div style={{ height: 28, background: '#F1F5F9', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
        : <span style={{ fontSize: 26, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}>{value}</span>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {desvio !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
            background: desvio >= 0 ? '#F0FDF4' : desvio >= -15 ? '#FFFBEB' : '#FEF2F2',
            color: desvioColor(desvio),
            display: 'flex', alignItems: 'center', gap: 3
          }}>
            {desvio >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {Math.abs(desvio).toFixed(1)}% vs meta
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</span>}
      </div>
    </div>
  )
}

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontSize: 13, color: '#94A3B8', margin: '4px 0 0' }}>{sub}</p>}
    </div>
  )
}

function DesvioTag({ value, suffix = '%' }: { value: number; suffix?: string }) {
  const color = desvioColor(value)
  const bg = value >= 0 ? '#F0FDF4' : value >= -15 ? '#FFFBEB' : '#FEF2F2'
  const Icon = value >= 0 ? ArrowUp : ArrowDown
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: bg, color }}>
      <Icon size={9} />{value >= 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  )
}

// ─── Aba 1 — Visão Geral ──────────────────────────────────────────────────────
function TabVisaoGeral({ cycle, metrics, reenrollments, loading }: {
  cycle: CampaignCycle | null
  metrics: FunnelMetric[]
  reenrollments: MonthlyReenrollment[]
  loading: boolean
}) {
  if (!cycle) return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94A3B8' }}>
      <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
      <p style={{ fontSize: 15, fontWeight: 600 }}>Nenhuma campanha ativa encontrada</p>
      <p style={{ fontSize: 13, margin: '6px 0 0' }}>Configure a campanha para ver os relatórios</p>
    </div>
  )

  // Totais acumulados do ciclo
  const totalRegistrations = metrics.reduce((s, m) => s + m.registrations, 0)
  const totalRegTarget = metrics.reduce((s, m) => s + m.registrations_target, 0)
  const totalVisits = metrics.reduce((s, m) => s + m.visits, 0)
  const totalVisitTarget = metrics.reduce((s, m) => s + m.visits_target, 0)
  const totalEnrollments = metrics.reduce((s, m) => s + m.enrollments, 0)
  const totalEnrollTarget = metrics.reduce((s, m) => s + m.enrollments_target, 0)
  const totalReenroll = reenrollments.reduce((s, r) => s + r.confirmed, 0)
  const totalReenrollTarget = reenrollments.reduce((s, r) => s + r.target, 0)

  const pctReg = totalRegTarget > 0 ? ((totalRegistrations - totalRegTarget) / totalRegTarget) * 100 : 0
  const pctVisit = totalVisitTarget > 0 ? ((totalVisits - totalVisitTarget) / totalVisitTarget) * 100 : 0
  const pctEnroll = totalEnrollTarget > 0 ? ((totalEnrollments - totalEnrollTarget) / totalEnrollTarget) * 100 : 0
  const pctReenroll = totalReenrollTarget > 0 ? ((totalReenroll - totalReenrollTarget) / totalReenrollTarget) * 100 : 0

  // Health score (média ponderada dos 4 KPIs, 0-100)
  const clamp = (v: number) => Math.max(0, Math.min(100, v))
  const scoreReg = clamp(totalRegTarget > 0 ? (totalRegistrations / totalRegTarget) * 100 : 0)
  const scoreVisit = clamp(totalVisitTarget > 0 ? (totalVisits / totalVisitTarget) * 100 : 0)
  const scoreEnroll = clamp(totalEnrollTarget > 0 ? (totalEnrollments / totalEnrollTarget) * 100 : 0)
  const scoreReenroll = clamp(totalReenrollTarget > 0 ? (totalReenroll / totalReenrollTarget) * 100 : 0)
  const health = Math.round(scoreReg * 0.2 + scoreVisit * 0.2 + scoreEnroll * 0.35 + scoreReenroll * 0.25)

  const healthColor = health >= 75 ? '#16a34a' : health >= 50 ? '#f59e0b' : '#dc2626'
  const healthLabel = health >= 75 ? 'Campanha saudável' : health >= 50 ? 'Atenção necessária' : 'Campanha em risco'

  // Esta semana
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
  const thisWeekLeads = 0 // simplificado — seria calculado dos leads diretos

  // Velocidade necessária
  const cycleEnd = new Date(cycle.end_date)
  const daysLeft = Math.max(0, Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7))
  const enrollsLeft = Math.max(0, cycle.target_new_students - totalEnrollments)
  const velocidadeNecessaria = Math.ceil(enrollsLeft / weeksLeft)

  // Timeline mensal
  const timelineData = metrics.map(m => ({
    name: periodLabel(m.period),
    cadastros: m.registrations,
    meta_cad: m.registrations_target,
    matriculas: m.enrollments,
    meta_mat: m.enrollments_target,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Health Score + KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Health Score */}
        <div style={{
          background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0',
          padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 12 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle cx="50" cy="50" r="42" fill="none" stroke={healthColor} strokeWidth="10"
                strokeDasharray={`${2 * Math.PI * 42 * health / 100} ${2 * Math.PI * 42 * (1 - health / 100)}`}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: healthColor, lineHeight: 1 }}>{health}</span>
              <span style={{ fontSize: 9, color: '#94A3B8', fontWeight: 600 }}>SCORE</span>
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: healthColor, textAlign: 'center' }}>{healthLabel}</span>
          <span style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, textAlign: 'center' }}>{daysLeft} dias restantes</span>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <KpiCard label="Cadastros" value={fmt(totalRegistrations)} sub={`meta: ${fmt(totalRegTarget)}`}
            icon={<Users />} color="#3B82F6" desvio={pctReg} loading={loading} />
          <KpiCard label="Visitas" value={fmt(totalVisits)} sub={`meta: ${fmt(totalVisitTarget)}`}
            icon={<Activity />} color="#8B5CF6" desvio={pctVisit} loading={loading} />
          <KpiCard label="Matrículas Novas" value={fmt(totalEnrollments)} sub={`meta: ${fmt(totalEnrollTarget)}`}
            icon={<Target />} color="#00A896" desvio={pctEnroll} loading={loading} />
          <KpiCard label="Rematrículas" value={fmt(totalReenroll)} sub={`meta: ${fmt(totalReenrollTarget)}`}
            icon={<RefreshCw />} color="#F59E0B" desvio={pctReenroll} loading={loading} />
        </div>
      </div>

      {/* Velocidade */}
      <div style={{
        background: velocidadeNecessaria > 10 ? '#FEF2F2' : '#F0FDF4',
        border: `1px solid ${velocidadeNecessaria > 10 ? '#FECACA' : '#BBF7D0'}`,
        borderRadius: 14, padding: '14px 20px',
        display: 'flex', alignItems: 'center', gap: 16
      }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: velocidadeNecessaria > 10 ? '#FEE2E2' : '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {velocidadeNecessaria > 10 ? <AlertTriangle size={16} color="#DC2626" /> : <CheckCircle size={16} color="#16A34A" />}
        </div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>
            Velocidade necessária: <span style={{ color: velocidadeNecessaria > 10 ? '#DC2626' : '#16A34A' }}>{velocidadeNecessaria} matrículas/semana</span>
          </p>
          <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
            Faltam {enrollsLeft} matrículas em {weeksLeft} semanas · {daysLeft} dias até o fim da campanha
          </p>
        </div>
      </div>

      {/* Gráfico evolução mensal */}
      {timelineData.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <SectionTitle sub="Cadastros e matrículas reais vs meta mês a mês">Evolução da Campanha</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={timelineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} width={36} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="cadastros" name="Cadastros" fill="#93C5FD" radius={[4, 4, 0, 0]} />
              <Bar dataKey="matriculas" name="Matrículas" fill="#00A896" radius={[4, 4, 0, 0]} />
              <Line dataKey="meta_cad" name="Meta Cadastros" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              <Line dataKey="meta_mat" name="Meta Matrículas" stroke="#047857" strokeWidth={2} strokeDasharray="5 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ─── Item 3d — conversão por família vs. por aluno ─────────────────────────────
// A cascata acima (TabFunil) vem inteira de funnel_metrics, uma tabela de
// snapshots agregados (populada por import/ERP) — não tem granularidade de
// lead individual, então não dá pra "contar por família" ali sem mudar como
// funnel_metrics é alimentada (fora do escopo). Esse card é aditivo: busca
// leads + lead_families ao vivo só pra taxa de conversão, que foi o KPI
// explicitamente citado no pedido como fazendo sentido por família.
//
// Regra de família "otimista" (decisão do gestor via pergunta direta): uma
// família conta como convertida se QUALQUER filho matriculou, mesmo que outro
// tenha sido perdido. Etapa do funil da família = etapa mais avançada entre
// os filhos.
const FUNNEL_STAGE_ORDER = ['new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost'] as const
function mostAdvancedStatus(statuses: string[]): string {
  const nonLost = statuses.filter(s => s !== 'lost')
  if (nonLost.length === 0) return 'lost'
  const order: readonly string[] = FUNNEL_STAGE_ORDER
  return nonLost.reduce((best, s) => order.indexOf(s) > order.indexOf(best) ? s : best, nonLost[0])
}

function FamilyConversionCard({ institutionId, cycle }: { institutionId: string; cycle: CampaignCycle | null }) {
  const [mode, setMode] = useState<'aluno' | 'familia'>('aluno')
  const [loading, setLoading] = useState(true)
  const [leadsData, setLeadsData] = useState<{ id: string; status: string; family_id: string | null }[]>([])

  useEffect(() => {
    if (!institutionId) return
    ;(async () => {
      setLoading(true)
      let q = supabase.from('leads').select('id, status, family_id').eq('institution_id', institutionId)
      if (cycle) q = q.gte('created_at', cycle.start_date).lte('created_at', cycle.end_date)
      const { data } = await q
      setLeadsData((data ?? []) as { id: string; status: string; family_id: string | null }[])
      setLoading(false)
    })()
  }, [institutionId, cycle?.id])

  const perStudent = { total: leadsData.length, converted: leadsData.filter(l => l.status === 'enrolled').length }

  const families = new Map<string, string[]>()
  leadsData.forEach(l => {
    const key = l.family_id ?? `solo:${l.id}` // lead avulso conta como família de 1
    if (!families.has(key)) families.set(key, [])
    families.get(key)!.push(l.status)
  })
  const perFamily = { total: families.size, converted: 0 }
  families.forEach(statuses => { if (mostAdvancedStatus(statuses) === 'enrolled') perFamily.converted++ })

  const active = mode === 'aluno' ? perStudent : perFamily
  const rate = active.total > 0 ? (active.converted / active.total) * 100 : 0

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <SectionTitle sub="Item 3 — famílias com mais de um filho contam uma vez; matrícula de qualquer filho já converte a família">Taxa de conversão — por aluno ou por família</SectionTitle>
        <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 3, gap: 2 }}>
          {(['aluno', 'familia'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: mode === m ? '#fff' : 'transparent', color: mode === m ? '#00A896' : '#64748B',
                boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>
              {m === 'aluno' ? 'Por aluno' : 'Por família'}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 64, borderRadius: 10, background: '#F1F5F9' }} />
      ) : (
        <div style={{ display: 'flex', gap: 32, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#00A896', lineHeight: 1 }}>{rate.toFixed(1)}%</div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>taxa de conversão ({mode === 'aluno' ? 'por aluno' : 'por família'})</div>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2B4A' }}>{fmt(active.converted)} <span style={{ color: '#94A3B8', fontWeight: 500 }}>/ {fmt(active.total)}</span></div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>{mode === 'aluno' ? 'matrículas / leads' : 'famílias matriculadas / famílias'}</div>
          </div>
          {mode === 'familia' && perStudent.total !== perFamily.total && (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>({fmt(perStudent.total)} alunos ao todo, agrupados em {fmt(perFamily.total)} famílias)</div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Aba 2 — Funil ────────────────────────────────────────────────────────────
function TabFunil({ metrics, loading, institutionId, cycle }: { metrics: FunnelMetric[]; loading: boolean; institutionId: string; cycle: CampaignCycle | null }) {
  const total = {
    reg: metrics.reduce((s, m) => s + m.registrations, 0),
    regT: metrics.reduce((s, m) => s + m.registrations_target, 0),
    sch: metrics.reduce((s, m) => s + m.schedules, 0),
    schT: metrics.reduce((s, m) => s + m.schedules_target, 0),
    vis: metrics.reduce((s, m) => s + m.visits, 0),
    visT: metrics.reduce((s, m) => s + m.visits_target, 0),
    enr: metrics.reduce((s, m) => s + m.enrollments, 0),
    enrT: metrics.reduce((s, m) => s + m.enrollments_target, 0),
  }

  const taxaRegSch = total.reg > 0 ? (total.sch / total.reg) * 100 : 0
  const taxaSchVis = total.sch > 0 ? (total.vis / total.sch) * 100 : 0
  const taxaVisEnr = total.vis > 0 ? (total.enr / total.vis) * 100 : 0

  const funnelSteps = [
    { label: 'Cadastros', real: total.reg, meta: total.regT, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Agendamentos', real: total.sch, meta: total.schT, color: '#8B5CF6', bg: '#F5F3FF' },
    { label: 'Visitas', real: total.vis, meta: total.visT, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Matrículas', real: total.enr, meta: total.enrT, color: '#00A896', bg: '#E6F7F5' },
  ]

  const chartData = metrics.map(m => ({
    name: periodLabel(m.period),
    cadastros: m.registrations,
    agendas: m.schedules,
    visitas: m.visits,
    matriculas: m.enrollments,
    meta_cad: m.registrations_target,
    meta_mat: m.enrollments_target,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle sub="Cascata de conversão completa do ciclo">Funil de Vendas</SectionTitle>

      {/* Funil cascata */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {funnelSteps.map((step, i) => {
          const desvio = step.meta > 0 ? ((step.real - step.meta) / step.meta) * 100 : 0
          const maxVal = funnelSteps[0].meta || 1
          const widthPct = Math.max(30, (step.meta / maxVal) * 100)
          const realWidthPct = step.meta > 0 ? Math.min(100, (step.real / step.meta) * widthPct) : 0

          return (
            <div key={step.label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: 16, position: 'relative', overflow: 'hidden' }}>
              {/* Barra de fundo */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: '#F1F5F9' }}>
                <div style={{ height: '100%', width: `${realWidthPct}%`, background: step.color, borderRadius: 2, transition: 'width 1s ease' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: step.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: step.color }}>{i + 1}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{step.label}</span>
              </div>

              <div style={{ fontSize: 32, fontWeight: 900, color: step.color, lineHeight: 1, marginBottom: 6 }}>
                {fmt(step.real)}
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 8 }}>meta: {fmt(step.meta)}</div>

              <DesvioTag value={desvio} />

              {i < 3 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F1F5F9', fontSize: 11, color: '#94A3B8' }}>
                  {i === 0 && taxaRegSch > 0 && `→ ${taxaRegSch.toFixed(0)}% agendaram`}
                  {i === 1 && taxaSchVis > 0 && `→ ${taxaSchVis.toFixed(0)}% visitaram`}
                  {i === 2 && taxaVisEnr > 0 && `→ ${taxaVisEnr.toFixed(0)}% matricularam`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <FamilyConversionCard institutionId={institutionId} cycle={cycle} />

      {/* Taxas de conversão */}
      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center' }}>
        {[
          { label: 'Cadastro → Agenda', value: taxaRegSch, ideal: 76 },
          { label: 'Agenda → Visita', value: taxaSchVis, ideal: 63 },
          { label: 'Visita → Matrícula', value: taxaVisEnr, ideal: 40 },
        ].map(t => (
          <div key={t.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.value >= t.ideal ? '#16a34a' : t.value >= t.ideal * 0.7 ? '#F59E0B' : '#DC2626' }}>
              {t.value.toFixed(1)}%
            </div>
            <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{t.label}</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>ideal: {t.ideal}%</div>
          </div>
        ))}
      </div>

      {/* Gráfico mensal detalhado */}
      {chartData.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <SectionTitle sub="Todas as etapas do funil mês a mês">Detalhe Mensal</SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} width={36} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="cadastros" name="Cadastros" fill="#93C5FD" radius={[3, 3, 0, 0]} />
              <Bar dataKey="agendas" name="Agendas" fill="#C4B5FD" radius={[3, 3, 0, 0]} />
              <Bar dataKey="visitas" name="Visitas" fill="#FCD34D" radius={[3, 3, 0, 0]} />
              <Bar dataKey="matriculas" name="Matrículas" fill="#00A896" radius={[3, 3, 0, 0]} />
              <Line dataKey="meta_cad" name="Meta Cad." stroke="#3B82F6" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              <Line dataKey="meta_mat" name="Meta Mat." stroke="#047857" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela detalhe */}
      {metrics.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Tabela Comparativa</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Mês', 'Cad. Real', 'Cad. Meta', 'Desvio', 'Vis. Real', 'Vis. Meta', 'Desvio', 'Mat. Real', 'Mat. Meta', 'Desvio'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => {
                  const dReg = m.registrations_target > 0 ? ((m.registrations - m.registrations_target) / m.registrations_target) * 100 : 0
                  const dVis = m.visits_target > 0 ? ((m.visits - m.visits_target) / m.visits_target) * 100 : 0
                  const dEnr = m.enrollments_target > 0 ? ((m.enrollments - m.enrollments_target) / m.enrollments_target) * 100 : 0
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1A2B4A' }}>{periodLabel(m.period)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{fmt(m.registrations)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94A3B8' }}>{fmt(m.registrations_target)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}><DesvioTag value={dReg} /></td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{fmt(m.visits)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94A3B8' }}>{fmt(m.visits_target)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}><DesvioTag value={dVis} /></td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#00A896' }}>{fmt(m.enrollments)}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94A3B8' }}>{fmt(m.enrollments_target)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center' }}><DesvioTag value={dEnr} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Aba 3 — Marketing & CPA ──────────────────────────────────────────────────
// ─── SUBSTITUA TODA A FUNÇÃO TabMarketing NO GestorReports.tsx ───────────────
// Localizar: "function TabMarketing({" até o próximo "// ─── Aba 4"
// e substituir por este bloco completo:

function TabMarketing({ institutionId, cycle, metrics }: {
  institutionId: string; cycle: CampaignCycle | null; metrics: FunnelMetric[]
}) {
  const [entries, setEntries] = useState<MarketingEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!cycle) return
    loadEntries()
  }, [cycle, metrics]) // ← metrics na dependência para sincronizar automaticamente

  const loadEntries = async () => {
    if (!cycle) return
    const { data } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .eq('institution_id', institutionId)
      .order('month_year')

    // ✅ Leads SEMPRE vêm do funil real (registrations) — gestor só insere investimento
    const base: MarketingEntry[] = (cycle?.monthly_targets || []).map((mt, i) => {
      const existing = data?.find(d => d.month_year === `${mt.month}-${mt.year}`)
      return {
        institution_id: institutionId,
        month_year: `${mt.month}-${mt.year}`,
        investment: existing?.investment || 0,
        leads_generated: metrics[i]?.registrations || 0,
        cpa_target: mt.cpa_target || 0,
        id: existing?.id,
        channel: existing?.channel,
      }
    })
    setEntries(base)
  }

  // ✅ Só atualiza investment — leads vêm automaticamente do funil
  const updateInvestment = (idx: number, value: number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, investment: value } : e))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const entry of entries) {
        await supabase.from('marketing_campaigns').upsert({
          institution_id: entry.institution_id,
          month_year: entry.month_year,
          investment: entry.investment,
          leads_generated: entry.leads_generated,
          cpa_target: entry.cpa_target,
        }, { onConflict: 'month_year,institution_id' })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await loadEntries()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const totalInvestment = entries.reduce((s, e) => s + (e.investment || 0), 0)
  const totalLeads = entries.reduce((s, e) => s + (e.leads_generated || 0), 0)
  const cpaGeral = totalLeads > 0 ? totalInvestment / totalLeads : 0
  const cpaProjetado = cycle?.projected_cpa || 0
  const cpaStatus = cpaProjetado > 0 ? ((cpaGeral - cpaProjetado) / cpaProjetado) * 100 : 0

  const chartData = entries.map((e, i) => {
    const cpa = e.leads_generated > 0 ? e.investment / e.leads_generated : 0
    const mt = cycle?.monthly_targets?.[i]
    return {
      name: e.month_year ? `${MONTH_NAMES[(parseInt(e.month_year.split('-')[0]) - 1) % 12]}` : `M${i + 1}`,
      investimento: e.investment,
      leads: e.leads_generated,
      cpa: Math.round(cpa),
      cpa_meta: mt?.cpa_target || 0,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle sub="Insira o investimento mensal — leads sincronizados automaticamente do funil">Marketing & CPA</SectionTitle>

      {/* KPIs de marketing */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <KpiCard label="Investimento Total" value={fmtBRL(totalInvestment)} icon={<DollarSign />} color="#8B5CF6" />
        <KpiCard label="CPA Geral" value={fmtBRL(cpaGeral)} sub={`projetado: ${fmtBRL(cpaProjetado)}`} icon={<Target />} color={cpaStatus > 20 ? '#DC2626' : '#00A896'} desvio={cpaStatus} />
        <KpiCard label="Total de Leads" value={fmt(totalLeads)} sub="sincronizado do funil" icon={<Users />} color="#3B82F6" />
      </div>

      {/* Status do CPA */}
      {cpaProjetado > 0 && cpaGeral > 0 && (
        <div style={{
          background: cpaStatus > 20 ? '#FEF2F2' : '#F0FDF4',
          border: `1px solid ${cpaStatus > 20 ? '#FECACA' : '#BBF7D0'}`,
          borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12
        }}>
          {cpaStatus > 20
            ? <AlertTriangle size={16} color="#DC2626" />
            : <CheckCircle size={16} color="#16A34A" />}
          <p style={{ fontSize: 13, color: '#1A2B4A', margin: 0, fontWeight: 600 }}>
            {cpaStatus > 0
              ? `CPA ${cpaStatus.toFixed(1)}% acima do projetado — campanha gerando leads acima do custo esperado`
              : `CPA dentro do projetado — campanha eficiente`}
          </p>
          {cpaStatus > 20 && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#DC2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
              Avaliar canais e investimento
            </span>
          )}
        </div>
      )}

      {/* Gráfico CPA */}
      {chartData.length > 0 && chartData.some(d => d.investimento > 0) && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <SectionTitle sub="CPA real vs meta por mês">Evolução do CPA</SectionTitle>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94A3B8' }} width={60} tickFormatter={v => `R$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94A3B8' }} width={40} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }}
                formatter={(val, name) => {
                  if (name === 'investimento' || name === 'cpa' || name === 'cpa_meta') return [fmtBRL(Number(val)), name]
                  return [fmt(Number(val)), name]
                }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="investimento" name="Investimento" fill="#C4B5FD" radius={[4, 4, 0, 0]} />
              <Line yAxisId="left" dataKey="cpa" name="CPA Real" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="left" dataKey="cpa_meta" name="CPA Meta" stroke="#DC2626" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
              <Bar yAxisId="right" dataKey="leads" name="Leads" fill="#93C5FD" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela — apenas investimento editável */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Inserir Investimento Mensal</span>
            <span style={{ fontSize: 11, color: '#3B82F6', background: '#EFF6FF', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
              Leads sincronizados do funil
            </span>
          </div>
          <button onClick={saveAll} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 9, background: saved ? '#16a34a' : '#00A896', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            opacity: saving ? 0.7 : 1
          }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle size={12} /> : <Save size={12} />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar tudo'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Mês', '% Leads', 'Leads (funil)', 'Investimento (R$)', 'CPA Real', 'CPA Meta', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const cpa = e.leads_generated > 0 ? Math.round(e.investment / e.leads_generated) : 0
                const mt = cycle?.monthly_targets?.[i]
                const cpaMeta = mt?.cpa_target || 0
                const pctLeads = totalLeads > 0 ? (e.leads_generated / totalLeads) * 100 : 0
                const cpaStatusRow = cpaMeta > 0 && cpa > 0 ? ((cpa - cpaMeta) / cpaMeta) * 100 : null

                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1A2B4A' }}>
                      {e.month_year ? `${MONTH_NAMES[(parseInt(e.month_year.split('-')[0]) - 1) % 12]}/${e.month_year.split('-')[1]}` : `M${i + 1}`}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748B' }}>{pctLeads.toFixed(1)}%</td>
                    {/* ✅ Leads: somente leitura, vem do funil */}
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#3B82F6', fontSize: 13 }}>
                        {fmt(e.leads_generated || 0)}
                      </span>
                    </td>
                    {/* ✅ Apenas investimento é editável */}
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <input
                        type="number"
                        value={e.investment || 0}
                        onChange={ev => updateInvestment(i, parseFloat(ev.target.value) || 0)}
                        style={{ width: 90, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #C4B5FD', textAlign: 'center', fontSize: 12, outline: 'none', background: '#F5F3FF' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: cpaStatusRow && cpaStatusRow > 20 ? '#DC2626' : '#1A2B4A' }}>
                      {cpa > 0 ? fmtBRL(cpa) : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94A3B8' }}>{cpaMeta > 0 ? fmtBRL(cpaMeta) : '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {cpaStatusRow !== null
                        ? <DesvioTag value={-cpaStatusRow} />
                        : <span style={{ color: '#94A3B8', fontSize: 11 }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#F0FDF4', borderTop: '2px solid #BBF7D0' }}>
                <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1A2B4A' }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>100%</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#3B82F6' }}>{fmt(totalLeads)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{fmtBRL(totalInvestment)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: cpaStatus > 20 ? '#DC2626' : '#00A896' }}>{cpaGeral > 0 ? fmtBRL(cpaGeral) : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>{cpaProjetado > 0 ? fmtBRL(cpaProjetado) : '—'}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                  {cpaStatus !== 0 && cpaGeral > 0 && <DesvioTag value={-cpaStatus} />}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
// ─── Aba 4 — Rematrículas ─────────────────────────────────────────────────────
function TabRematriculas({ institutionId, cycle }: { institutionId: string; cycle: CampaignCycle | null }) {
  const [entries, setEntries] = useState<MonthlyReenrollment[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cycle) return
    load()
  }, [cycle])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('monthly_reenrollments')
      .select('*')
      .eq('institution_id', institutionId)
      .order('period')

    if (data && data.length > 0) {
      setEntries(data)
    } else {
// Gerar entradas vazias a partir das metas do ciclo
      const months = cycle?.monthly_targets?.map((mt, i) => {
        const monthNum = typeof mt.month === 'number' ? mt.month :
          ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].indexOf(String(mt.month)) + 1 || (i < 4 ? i + 9 : i - 3)
        const period = `${mt.year}-${String(monthNum).padStart(2, '0')}`
        return {
          institution_id: institutionId,
          period,
          confirmed: 0,
          target: mt.enrollments_returning || 0,
          base_total: cycle.base_students || 0,
        }
      }) || []
      setEntries(months)
    }
    setLoading(false)
  }

  const update = (idx: number, field: keyof MonthlyReenrollment, value: number | string) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const entry of entries) {
        await supabase.from('monthly_reenrollments').upsert({
          institution_id: entry.institution_id,
          period: entry.period,
          confirmed: entry.confirmed,
          target: entry.target,
          base_total: entry.base_total,
          notes: entry.notes,
        }, { onConflict: 'institution_id,period' })
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      await load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const baseElegivel = (cycle?.base_students || 0) - Object.values(cycle?.school_data?.exits || {}).reduce((s, v) => s + (Number(v) || 0), 0)
  const totalConfirmed = entries.reduce((s, e) => s + e.confirmed, 0)
  const totalTarget = entries.reduce((s, e) => s + e.target, 0)
  const taxaFidelizacao = baseElegivel > 0 ? (totalConfirmed / baseElegivel) * 100 : 0
  const taxaMeta = cycle ? cycle.target_reenrollment_rate * 100 : 0

  const chartData = entries.map(e => ({
    name: periodLabel(e.period),
    confirmadas: e.confirmed,
    meta: e.target,
    pctConfirmed: baseElegivel > 0 ? parseFloat(((e.confirmed / baseElegivel) * 100).toFixed(2)) : 0,
    pctMeta: baseElegivel > 0 ? parseFloat(((e.target / baseElegivel) * 100).toFixed(2)) : 0,
  }))

  // Acumulado
  let accConfirmed = 0
  let accTarget = 0
  const accData = entries.map(e => {
    accConfirmed += e.confirmed
    accTarget += e.target
    return {
      name: periodLabel(e.period),
      acumulado: accConfirmed,
      meta_acum: accTarget,
      pct: baseElegivel > 0 ? parseFloat(((accConfirmed / baseElegivel) * 100).toFixed(1)) : 0,
      pct_meta: baseElegivel > 0 ? parseFloat(((accTarget / baseElegivel) * 100).toFixed(1)) : 0,
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle sub="Insira as rematrículas confirmadas mês a mês">Rematrículas</SectionTitle>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="Rematriculados" value={fmt(totalConfirmed)} sub={`meta total: ${fmt(totalTarget)}`} icon={<RefreshCw />} color="#F59E0B" desvio={totalTarget > 0 ? ((totalConfirmed - totalTarget) / totalTarget) * 100 : 0} />
        <KpiCard label="Base Elegível" value={fmt(baseElegivel)} sub="total - formandos" icon={<Users />} color="#64748B" />
        <KpiCard label="Taxa Fidelização" value={`${taxaFidelizacao.toFixed(1)}%`} sub={`meta: ${taxaMeta.toFixed(1)}%`} icon={<Target />} color={taxaFidelizacao >= taxaMeta ? '#16a34a' : '#DC2626'} desvio={taxaFidelizacao - taxaMeta} />
        <KpiCard label="A Rematricular" value={fmt(Math.max(0, baseElegivel - totalConfirmed))} sub="ainda elegíveis" icon={<Clock />} color="#8B5CF6" />
      </div>

      {/* Gráfico % acumulado */}
      {accData.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
          <SectionTitle sub="% de rematrícula acumulada vs meta mês a mês">Evolução de Rematrículas</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={accData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis yAxisId="vol" tick={{ fontSize: 11, fill: '#94A3B8' }} width={40} />
              <YAxis yAxisId="pct" orientation="right" tick={{ fontSize: 11, fill: '#94A3B8' }} width={40} tickFormatter={v => `${v}%`} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="vol" dataKey="acumulado" name="Confirmadas" fill="#FCD34D" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="vol" dataKey="meta_acum" name="Meta" fill="#E2E8F0" radius={[4, 4, 0, 0]} />
              <Line yAxisId="pct" dataKey="pct" name="% Real" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line yAxisId="pct" dataKey="pct_meta" name="% Meta" stroke="#DC2626" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela editável */}
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Inserir Rematrículas Mensais</span>
          <button onClick={saveAll} disabled={saving} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
            borderRadius: 9, background: saved ? '#16a34a' : '#F59E0B', color: '#fff',
            border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <CheckCircle size={12} /> : <Save size={12} />}
            {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Mês', '% Remat.', 'Meta Acum.', 'Confirmadas', 'Desvio Vol.', 'Desvio %', 'Observações'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const pct = baseElegivel > 0 ? (e.confirmed / baseElegivel) * 100 : 0
                const desvioVol = e.confirmed - e.target
                const desvioPct = e.target > 0 ? ((e.confirmed - e.target) / e.target) * 100 : 0
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1A2B4A' }}>{periodLabel(e.period)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: pct >= taxaMeta ? '#16a34a' : '#F59E0B' }}>
                      {pct.toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', color: '#94A3B8' }}>
  {fmt(entries.slice(0, i + 1).reduce((s, x) => s + x.target, 0))}
</td>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <input type="number" value={e.confirmed} onChange={ev => update(i, 'confirmed', parseInt(ev.target.value) || 0)}
                        style={{ width: 80, padding: '4px 8px', borderRadius: 7, border: '1.5px solid #FCD34D', textAlign: 'center', fontSize: 12, outline: 'none', background: '#FFFBEB' }} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, color: desvioVol >= 0 ? '#16a34a' : '#DC2626' }}>
                        {desvioVol >= 0 ? '+' : ''}{desvioVol}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {e.target > 0 ? <DesvioTag value={desvioPct} /> : <span style={{ color: '#94A3B8' }}>—</span>}
                    </td>
                    <td style={{ padding: '6px 12px' }}>
                      <input type="text" value={e.notes || ''} onChange={ev => update(i, 'notes', ev.target.value)}
                        placeholder="Observações..." style={{ width: '100%', padding: '4px 8px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 11, outline: 'none', background: '#F8FAFC' }} />
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: '#FFFBEB', borderTop: '2px solid #FCD34D' }}>
                <td style={{ padding: '10px 12px', fontWeight: 800 }}>TOTAL</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: taxaFidelizacao >= taxaMeta ? '#16a34a' : '#DC2626' }}>{taxaFidelizacao.toFixed(2)}%</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: '#94A3B8' }}>{fmt(totalTarget)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, color: '#F59E0B' }}>{fmt(totalConfirmed)}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, color: totalConfirmed >= totalTarget ? '#16a34a' : '#DC2626' }}>
                  {totalConfirmed >= totalTarget ? '+' : ''}{totalConfirmed - totalTarget}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Aba 5 — Transferências & Recusas ────────────────────────────────────────
function TabTransferencias({ institutionId }: { institutionId: string }) {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [lostLeads, setLostLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: tr }, { data: ll }] = await Promise.all([
      supabase.from('student_transfers').select('*').eq('institution_id', institutionId).order('transfer_date', { ascending: false }),
      supabase.from('leads').select('id,student_name,responsible_name,lost_reason,lost_reason_detail,created_at,source,grade_interest').eq('institution_id', institutionId).eq('status', 'lost').not('lost_reason', 'is', null),
    ])
    setTransfers(tr || [])
    setLostLeads(ll || [])
    setLoading(false)
  }

  // Pareto de recusas
  const reasonCounts: Record<string, number> = {}
  lostLeads.forEach(l => {
    const r = l.lost_reason || 'Não informado'
    reasonCounts[r] = (reasonCounts[r] || 0) + 1
  })

  const LOST_REASON_LABELS: Record<string, string> = {
    preco_alto: 'Valor alto', nao_retornou: 'Não retornou', outra_escola: 'Outra escola',
    sem_vaga: 'Sem vaga', nao_oferece_serie: 'Série não ofertada', nao_gostou: 'Não gostou',
    mudou_cidade: 'Mudou de cidade', dificuldade_fin: 'Dificuldade financeira',
    desistiu: 'Desistiu', outro: 'Outro'
  }
  const FATOR_MAP: Record<string, string> = {
    preco_alto: 'Interno', nao_retornou: 'Externo', outra_escola: 'Externo',
    sem_vaga: 'Interno', nao_oferece_serie: 'Interno', nao_gostou: 'Interno',
    mudou_cidade: 'Externo', dificuldade_fin: 'Externo', desistiu: 'Externo', outro: 'Interno'
  }

  const paretoData = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      name: LOST_REASON_LABELS[key] || key,
      count,
      fator: FATOR_MAP[key] || 'Externo',
      pct: lostLeads.length > 0 ? (count / lostLeads.length * 100).toFixed(1) : '0',
    }))

  const totalInterno = lostLeads.filter(l => FATOR_MAP[l.lost_reason] === 'Interno').length
  const totalExterno = lostLeads.filter(l => FATOR_MAP[l.lost_reason] === 'Externo').length

  const PARETO_COLORS = ['#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FFF1F2', '#DC2626', '#EF4444', '#F87171']

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Loader2 size={28} color="#00A896" className="animate-spin" style={{ margin: '0 auto' }} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <SectionTitle sub="Transferências e motivos de perda de leads">Transferências & Desistências</SectionTitle>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KpiCard label="Transferências" value={fmt(transfers.length)} sub="saídas confirmadas" icon={<ArrowUpRight />} color="#6B7280" />
        <KpiCard label="Leads Perdidos" value={fmt(lostLeads.length)} sub="com motivo registrado" icon={<X />} color="#DC2626" />
        <KpiCard label="Fator Interno" value={fmt(totalInterno)} sub={`${lostLeads.length > 0 ? ((totalInterno / lostLeads.length) * 100).toFixed(0) : 0}% das recusas`} icon={<AlertTriangle />} color="#F59E0B" />
        <KpiCard label="Fator Externo" value={fmt(totalExterno)} sub={`${lostLeads.length > 0 ? ((totalExterno / lostLeads.length) * 100).toFixed(0) : 0}% das recusas`} icon={<Info />} color="#3B82F6" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Pareto de recusas */}
        {paretoData.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24 }}>
            <SectionTitle sub="Motivos de perda por frequência">Recusas (Pareto)</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {paretoData.map((item, i) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 130, fontSize: 12, color: '#475569', flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  <div style={{ flex: 1, height: 20, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4, transition: 'width 0.8s ease',
                      width: `${(item.count / paretoData[0].count) * 100}%`,
                      background: item.fator === 'Interno' ? '#F59E0B' : '#3B82F6'
                    }} />
                  </div>
                  <span style={{ width: 30, fontSize: 12, fontWeight: 700, color: '#1A2B4A', textAlign: 'right', flexShrink: 0 }}>{item.count}</span>
                  <span style={{ width: 38, fontSize: 10, color: '#94A3B8', textAlign: 'right', flexShrink: 0 }}>{item.pct}%</span>
                  <span style={{
                    fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 999, flexShrink: 0,
                    background: item.fator === 'Interno' ? '#FFFBEB' : '#EFF6FF',
                    color: item.fator === 'Interno' ? '#92400E' : '#1D4ED8'
                  }}>{item.fator}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B' }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>Fator Interno (escola pode melhorar)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#3B82F6' }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>Fator Externo</span>
              </div>
            </div>
          </div>
        )}

        {/* Lista de leads perdidos recentes */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Leads Perdidos Recentes</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {lostLeads.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                <CheckCircle size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
                <p style={{ fontSize: 13 }}>Nenhum lead perdido com motivo registrado</p>
              </div>
            ) : lostLeads.slice(0, 10).map(l => (
              <div key={l.id} style={{ padding: '12px 16px', borderBottom: '1px solid #F8FAFC', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>{l.student_name}</span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{l.grade_interest}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    background: FATOR_MAP[l.lost_reason] === 'Interno' ? '#FFFBEB' : '#FEF2F2',
                    color: FATOR_MAP[l.lost_reason] === 'Interno' ? '#92400E' : '#DC2626'
                  }}>
                    {LOST_REASON_LABELS[l.lost_reason] || l.lost_reason}
                  </span>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{l.source}</span>
                </div>
                {l.lost_reason_detail && (
                  <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>{l.lost_reason_detail}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Transferências */}
      {transfers.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A' }}>Histórico de Transferências</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  {['Aluno', 'Série', 'Data', 'Destino', 'Motivo'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid #F8FAFC', background: i % 2 === 0 ? '#fff' : '#FAFAFA' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1A2B4A' }}>{t.student_name}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{t.grade}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{t.transfer_date ? new Date(t.transfer_date).toLocaleDateString('pt-BR') : '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#64748B' }}>{t.destination || '—'}</td>
                    <td style={{ padding: '10px 14px', color: '#94A3B8', fontStyle: 'italic' }}>{t.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FinalReportCard ──────────────────────────────────────────────────────────
function FinalReportCard({ institutionId, cycle }: { institutionId: string; cycle: CampaignCycle }) {
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('ai_monthly_reports')
      .select('content, created_at')
      .eq('institution_id', institutionId)
      .eq('period', `${cycle.year}-final`)
      .single()
      .then(({ data }) => {
        if (data) setReport(data.content)
        setLoading(false)
      })
  }, [])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando relatório...</div>
  if (!report) return null

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A2B4A, #2D4A7A)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Sparkles size={20} color="#fff" />
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Relatório Final — Campanha {cycle.year}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Diagnóstico completo gerado pela IA</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          📄 Exportar PDF
        </button>
      </div>
      <div style={{ padding: 28 }}>
        <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
          {report}
        </div>
      </div>
    </div>
  )
}

// ─── Aba 6 — Diagnóstico IA ───────────────────────────────────────────────────
function TabDiagnosticoIA({ institutionId, cycle, metrics, reenrollments }: {
  institutionId: string
  cycle: CampaignCycle | null
  metrics: FunnelMetric[]
  reenrollments: MonthlyReenrollment[]
}) {
  const [reports, setReports] = useState<AIReport[]>([])
  const [generating, setGenerating] = useState(false)
  const [selectedReport, setSelectedReport] = useState<AIReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [avgTime, setAvgTime] = useState<number | null>(null)
  const [showFinishModal, setShowFinishModal] = useState(false)
  const [finishConfirmed, setFinishConfirmed] = useState(false)
  const [generatingFinal, setGeneratingFinal] = useState(false)

  useEffect(() => { loadReports(); calcAvgTime() }, [])

  const loadReports = async () => {
    const { data } = await supabase
      .from('ai_monthly_reports')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    if (data) {
      setReports(data)
      if (data.length > 0) setSelectedReport(data[0])
    }
    setLoading(false)
  }

  const calcAvgTime = async () => {
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('lead_id, created_at')
      .eq('institution_id', institutionId)
      .not('lead_id', 'is', null)
      .limit(50)

    if (!enrollments || enrollments.length === 0) return

    const leadIds = enrollments.map(e => e.lead_id)
    const { data: leads } = await supabase
      .from('leads')
      .select('id, created_at')
      .in('id', leadIds)

    if (!leads) return

    const times: number[] = []
    enrollments.forEach(enr => {
      const lead = leads.find(l => l.id === enr.lead_id)
      if (lead) {
        const diff = (new Date(enr.created_at).getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
        if (diff >= 0 && diff < 365) times.push(diff)
      }
    })

    if (times.length > 0) setAvgTime(Math.round(times.reduce((s, t) => s + t, 0) / times.length))
  }

  const generateReport = async () => {
    if (!cycle) return

    // Regra: 1 diagnóstico por mês
    const currentPeriod = new Date().toISOString().slice(0, 7)
    const alreadyGenerated = reports.some(r => r.period === currentPeriod)
    if (alreadyGenerated) {
      const existing = reports.find(r => r.period === currentPeriod)
      if (existing) setSelectedReport(existing)
      const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('pt-BR')
      alert(`Já existe um diagnóstico gerado para este mês. O próximo poderá ser gerado em ${nextMonth}`)
      return
    }

    setGenerating(true)
    try {
      const period = currentPeriod
      const totalReg = metrics.reduce((s, m) => s + m.registrations, 0)
      const totalRegT = metrics.reduce((s, m) => s + m.registrations_target, 0)
      const totalVis = metrics.reduce((s, m) => s + m.visits, 0)
      const totalVisT = metrics.reduce((s, m) => s + m.visits_target, 0)
      const totalEnr = metrics.reduce((s, m) => s + m.enrollments, 0)
      const totalEnrT = metrics.reduce((s, m) => s + m.enrollments_target, 0)
      const totalReen = reenrollments.reduce((s, r) => s + r.confirmed, 0)
      const totalReenT = reenrollments.reduce((s, r) => s + r.target, 0)

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'monthly_report',
          payload: {
            institutionName: cycle.label,
            period,
            cycle: { year: cycle.year, target_new: cycle.target_new_students, target_reenroll: cycle.target_reenrollment_rate, base_students: cycle.base_students },
            funnel: { registrations: totalReg, registrations_target: totalRegT, visits: totalVis, visits_target: totalVisT, enrollments: totalEnr, enrollments_target: totalEnrT },
            reenrollments: { confirmed: totalReen, target: totalReenT },
            avg_time_days: avgTime,
            monthly_data: metrics.map(m => ({ period: m.period, registrations: m.registrations, visits: m.visits, enrollments: m.enrollments })),
          }
        })
      })

      const data = await res.json()
      const content = data.result || data.content || 'Relatório gerado.'

      const { data: saved } = await supabase.from('ai_monthly_reports').insert({
        institution_id: institutionId,
        period,
        content,
      }).select().single()

      if (saved) {
        setReports(prev => [saved, ...prev])
        setSelectedReport(saved)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const handleFinishCampaign = async () => {
    if (!cycle || !finishConfirmed) return
    setGeneratingFinal(true)
    try {
      const { data: inst } = await supabase
        .from('institutions')
        .select('name, city, state')
        .eq('id', institutionId)
        .single()

      const totalReg  = metrics.reduce((s, m) => s + m.registrations, 0)
      const totalRegT = metrics.reduce((s, m) => s + m.registrations_target, 0)
      const totalVis  = metrics.reduce((s, m) => s + m.visits, 0)
      const totalVisT = metrics.reduce((s, m) => s + m.visits_target, 0)
      const totalEnr  = metrics.reduce((s, m) => s + m.enrollments, 0)
      const totalEnrT = metrics.reduce((s, m) => s + m.enrollments_target, 0)
      const totalReen  = reenrollments.reduce((s, r) => s + r.confirmed, 0)
      const totalReenT = reenrollments.reduce((s, r) => s + r.target, 0)

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'final_campaign_report',
          payload: {
            institutionName: inst?.name || cycle.label,
            city: inst?.city || '',
            state: inst?.state || '',
            year: cycle.year,
            cycle: { target_new: cycle.target_new_students, target_reenroll: cycle.target_reenrollment_rate, base_students: cycle.base_students, start_date: cycle.start_date, end_date: cycle.end_date },
            funnel: { registrations: totalReg, registrations_target: totalRegT, visits: totalVis, visits_target: totalVisT, enrollments: totalEnr, enrollments_target: totalEnrT },
            reenrollments: { confirmed: totalReen, target: totalReenT },
            avg_time_days: avgTime,
            monthly_data: metrics.map(m => ({ period: m.period, registrations: m.registrations, visits: m.visits, enrollments: m.enrollments })),
          }
        })
      })

      const data = await res.json()
      const content = data.result || data.content || 'Relatório final gerado.'

      await supabase.from('ai_monthly_reports').insert({
        institution_id: institutionId,
        period: `${cycle.year}-final`,
        content,
      })

      await supabase.from('campaign_cycles')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('id', cycle.id)

      setShowFinishModal(false)
      setFinishConfirmed(false)
      setTimeout(() => window.location.reload(), 1500)
    } catch (e) {
      console.error('Erro ao finalizar campanha:', e)
    } finally {
      setGeneratingFinal(false)
    }
  }

  const MONTH_NAMES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const currentPeriod = new Date().toISOString().slice(0, 7)
  const alreadyThisMonth = reports.some(r => r.period === currentPeriod)
  const thisMonthReport = reports.find(r => r.period === currentPeriod)

  function reportLabel(period: string) {
    if (period.endsWith('-final')) return `Relatório Final ${period.split('-')[0]}`
    const parts = period.split('-')
    return `${MONTH_NAMES_FULL[parseInt(parts[1]) - 1]}/${parts[0]}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <SectionTitle sub="Análise mensal gerada por IA com ações recomendadas">Diagnóstico IA</SectionTitle>
        <button
          onClick={alreadyThisMonth ? () => { if (thisMonthReport) setSelectedReport(thisMonthReport) } : generateReport}
          disabled={generating || !cycle || alreadyThisMonth}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 12,
            background: generating ? '#E2E8F0' : alreadyThisMonth ? '#F1F5F9' : 'linear-gradient(135deg, #00A896, #1A2B4A)',
            color: generating || alreadyThisMonth ? '#94A3B8' : '#fff',
            border: 'none', fontSize: 13, fontWeight: 700,
            cursor: generating || alreadyThisMonth ? 'not-allowed' : 'pointer',
            boxShadow: generating || alreadyThisMonth ? 'none' : '0 4px 14px rgba(0,168,150,0.3)'
          }}
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {generating
            ? 'Gerando relatório...'
            : alreadyThisMonth && thisMonthReport
              ? `Diagnóstico gerado em ${new Date(thisMonthReport.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
              : 'Gerar diagnóstico do mês'}
        </button>
      </div>

      {/* Tempo médio de matrícula */}
      {avgTime !== null && (
        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 12, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Clock size={20} color="#1D4ED8" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF', margin: 0 }}>
              Tempo médio de matrícula: <span style={{ fontSize: 20, fontWeight: 900 }}>{avgTime} dias</span>
            </p>
            <p style={{ fontSize: 12, color: '#3B82F6', margin: '2px 0 0' }}>
              Média entre o cadastro do lead e a confirmação da matrícula.
              {avgTime <= 14 ? ' ✅ Conversão rápida — time está eficiente.' : avgTime <= 30 ? ' ⚠ Moderado — há espaço para acelerar o fechamento.' : ' 🔴 Lento — considere ações de urgência com os leads em proposta.'}
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>
        {/* Coluna esquerda — histórico */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Histórico</span>
          {loading && <div style={{ height: 40, background: '#F1F5F9', borderRadius: 8, animation: 'pulse 1.5s infinite' }} />}
          {!loading && reports.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 12px', color: '#94A3B8', fontSize: 12 }}>
              <FileText size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>Nenhum diagnóstico gerado</p>
            </div>
          )}
          {reports.map(r => {
            const isSelected = selectedReport?.id === r.id
            const isCurrent = r.period === currentPeriod
            return (
              <button key={r.id} onClick={() => setSelectedReport(r)} style={{
                padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer',
                border: isSelected ? '2px solid #00A896' : '1px solid #E2E8F0',
                background: isSelected ? '#E6F7F5' : '#fff',
                transition: 'all 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#00A896' : '#1A2B4A' }}>
                    {reportLabel(r.period)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: isCurrent ? '#D1FAE5' : '#F1F5F9', color: isCurrent ? '#16A34A' : '#94A3B8' }}>
                    {isCurrent ? 'Este mês' : 'Anterior'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  {new Date(r.created_at).toLocaleDateString('pt-BR')}
                </div>
              </button>
            )
          })}
        </div>

        {/* Coluna direita — conteúdo */}
        <div style={{ minHeight: 300 }}>
          {generating && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} color="#00A896" className="animate-spin" />
              </div>
              <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>Analisando todos os dados da campanha...</p>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Isso pode levar até 20 segundos</p>
            </div>
          )}
          {!generating && !selectedReport && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, gap: 12, color: '#94A3B8' }}>
              <Sparkles size={36} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Gere o primeiro diagnóstico do mês</p>
              <p style={{ fontSize: 12, margin: 0 }}>A IA analisa funil, rematrículas, marketing e gera ações recomendadas</p>
            </div>
          )}
          {!generating && selectedReport && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Header do relatório */}
              <div style={{ background: 'linear-gradient(135deg, #1A2B4A, #2D4A7A)', borderRadius: 16, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles size={22} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0 }}>Diagnóstico IA — {reportLabel(selectedReport.period)}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Gerado em {new Date(selectedReport.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => window.print()} style={{ marginLeft: 'auto', padding: '8px 16px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    📄 Baixar PDF
                  </button>
                </div>
              </div>

              {/* Conteúdo */}
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 28 }}>
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {selectedReport.content}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card Finalizar Campanha */}
      {cycle && cycle.status === 'active' && (
        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 16, padding: 24, marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle size={22} color="#F59E0B" />
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#92400E', margin: 0 }}>Encerrar campanha {cycle.year}</p>
              <p style={{ fontSize: 13, color: '#B45309', margin: '2px 0 0' }}>Gera o relatório final e encerra o ciclo atual</p>
            </div>
          </div>
          <button
            onClick={() => setShowFinishModal(true)}
            style={{ width: '100%', padding: '12px', background: '#F59E0B', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <CheckCircle size={16} /> Finalizar campanha e gerar relatório final
          </button>
        </div>
      )}

      {/* Modal Finalização */}
      {showFinishModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={32} color="#F59E0B" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: '0 0 8px' }}>Finalizar Campanha {cycle?.year}</h2>
              <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>Ao finalizar, um relatório completo será gerado e o ciclo será encerrado.</p>
            </div>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20, marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', margin: '0 0 12px' }}>Termo de Ciência</p>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '0 0 12px' }}>
                Ao confirmar o encerramento da campanha de matrículas {cycle?.year}, declaro ciência de que:
              </p>
              <ul style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
                <li>O ciclo atual será encerrado e não poderá ser reaberto;</li>
                <li>Um relatório final completo será gerado pela IA com o diagnóstico da campanha;</li>
                <li>Os dados ficam salvos e serão usados como base para a próxima campanha;</li>
                <li>O painel de relatórios exibirá apenas o relatório final até o início de um novo ciclo.</li>
              </ul>
            </div>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', marginBottom: 24 }}>
              <input
                type="checkbox"
                checked={finishConfirmed}
                onChange={e => setFinishConfirmed(e.target.checked)}
                style={{ width: 18, height: 18, marginTop: 2, accentColor: '#00A896', cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                Li e concordo com os termos acima. Confirmo o encerramento da campanha {cycle?.year}.
              </span>
            </label>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setShowFinishModal(false); setFinishConfirmed(false) }}
                style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, color: '#64748B', cursor: 'pointer', fontWeight: 600 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleFinishCampaign}
                disabled={!finishConfirmed || generatingFinal}
                style={{ flex: 2, padding: '12px', borderRadius: 12, background: finishConfirmed ? '#00A896' : '#E2E8F0', color: finishConfirmed ? '#fff' : '#94A3B8', border: 'none', fontSize: 14, fontWeight: 700, cursor: finishConfirmed ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {generatingFinal ? <><Loader2 size={16} className="animate-spin" /> Gerando relatório...</> : <><Sparkles size={16} /> Confirmar e gerar relatório final</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function GestorReports({ institutionId, institutionName }: Props) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState(0)
  const [cycle, setCycle] = useState<CampaignCycle | null>(null)
  const [metrics, setMetrics] = useState<FunnelMetric[]>([])
  const [reenrollments, setReenrollments] = useState<MonthlyReenrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [isAdjustMode, setIsAdjustMode] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => { loadData() }, [institutionId])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: cycleData } = await supabase
        .from('campaign_cycles')
        .select('*')
        .eq('institution_id', institutionId)
        .in('status', ['active', 'released', 'finished'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      setCycle(cycleData)

      if (cycleData) {
        const { data: metricsData } = await supabase
          .from('funnel_metrics')
          .select('*')
          .eq('institution_id', institutionId)
          .gte('period', cycleData.start_date.slice(0, 7))
          .lte('period', cycleData.end_date.slice(0, 7))
          .order('period')

        setMetrics(metricsData?.filter(m => /^\d{4}-\d{2}$/.test(m.period)) || [])

        const { data: reenrollData } = await supabase
          .from('monthly_reenrollments')
          .select('*')
          .eq('institution_id', institutionId)
          .order('period')

        setReenrollments(reenrollData || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Ciclo liberado mas sem metas configuradas ainda
  const cycleNeedsSetup = cycle && (
    !cycle.monthly_targets ||
    cycle.monthly_targets.length === 0 ||
    cycle.target_new_students === 0
  )

  // Ciclo com metas configuradas
  const cycleIsConfigured = cycle && cycle.monthly_targets && cycle.monthly_targets.length > 0

  const TABS = [
    { label: 'Visão Geral', icon: <BarChart3 size={15} /> },
    { label: 'Funil', icon: <Activity size={15} /> },
    { label: 'Marketing & CPA', icon: <DollarSign size={15} /> },
    { label: 'Rematrículas', icon: <RefreshCw size={15} /> },
    { label: 'Transferências', icon: <ArrowUpRight size={15} /> },
    { label: 'Diagnóstico IA', icon: <Sparkles size={15} /> },
  ]

  // ─── CAMPANHA ENCERRADA ────────────────────────────────────
  if (cycle?.status === 'finished') {
    return (
      <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, minHeight: '100%', background: '#f8f9fb' }}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}.animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={24} color="#16A34A" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Campanha {cycle.year} encerrada</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
              Encerrada em {cycle.finished_at ? new Date(cycle.finished_at).toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
        </div>

        {/* Métricas finais */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'Matrículas',    val: metrics.reduce((s, m) => s + m.enrollments, 0),    target: cycle.target_new_students,                                       color: '#00A896', bg: '#E6F7F5', icon: '🎓' },
            { label: 'Visitaram',     val: metrics.reduce((s, m) => s + m.visits, 0),          target: metrics.reduce((s, m) => s + m.visits_target, 0),               color: '#F59E0B', bg: '#FEF3C7', icon: '📅' },
            { label: 'Cadastros',     val: metrics.reduce((s, m) => s + m.registrations, 0),   target: metrics.reduce((s, m) => s + m.registrations_target, 0),        color: '#3B82F6', bg: '#DBEAFE', icon: '👤' },
            { label: 'Rematrículas',  val: reenrollments.reduce((s, r) => s + r.confirmed, 0), target: reenrollments.reduce((s, r) => s + r.target, 0),                color: '#8B5CF6', bg: '#EDE9FE', icon: '🔄' },
          ].map(({ label, val, target, color, bg, icon }) => {
            const pct = target > 0 ? Math.round((val / target) * 100) : 0
            return (
              <div key={label} style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color }}>{pct}%</span>
                </div>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#1A2B4A', margin: '0 0 4px' }}>{val}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '0 0 10px' }}>{label} de {target} na meta</p>
                <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Relatório final da IA */}
        <FinalReportCard institutionId={institutionId} cycle={cycle} />

        {/* Botão iniciar nova campanha */}
        <div style={{ background: 'linear-gradient(135deg, #00523C, #00A896)', borderRadius: 16, padding: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>Pronto para a próxima campanha?</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0 }}>Os dados desta campanha serão usados como base para gerar o novo plano.</p>
          </div>
          <button
            onClick={() => setShowCampaignModal(true)}
            style={{ padding: '14px 28px', background: '#fff', color: '#00523C', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.15)', flexShrink: 0 }}
          >
            🚀 Iniciar campanha {cycle.year + 1}
          </button>
        </div>

        {showCampaignModal && (
          <CampaignGeneratorModal
            isOpen={showCampaignModal}
            onClose={() => setShowCampaignModal(false)}
            onApply={() => { loadData(); setShowCampaignModal(false) }}
            existingCycle={cycle as any}
            institutionId={institutionId}
            institutionName={institutionName}
            isAdjustMode={false}
            currentUserId={user?.id}
            currentUserName={user?.full_name}
          />
        )}
      </div>
    )
  }

  // ─── MOBILE ───────────────────────────────────────────────
  if (isMobile) {
    const latestFunnel = metrics.length > 0 ? metrics[metrics.length - 1] : null
    const mMetrics = [
      { label: 'Cadastros',    val: latestFunnel?.registrations ?? 0,   target: latestFunnel?.registrations_target ?? 0,   color: '#3B82F6' },
      { label: 'Agendamentos', val: latestFunnel?.schedules ?? 0,        target: latestFunnel?.schedules_target ?? 0,        color: '#8B5CF6' },
      { label: 'Visitas',      val: latestFunnel?.visits ?? 0,           target: latestFunnel?.visits_target ?? 0,           color: '#F59E0B' },
      { label: 'Matrículas',   val: latestFunnel?.enrollments ?? 0,      target: latestFunnel?.enrollments_target ?? 0,      color: '#00A896' },
    ]

    return (
      <div style={{ padding: 16, background: '#f8f9fb', minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BarChart3 size={18} color="#3B82F6" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatórios</h1>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{cycle?.label || 'Campanha atual'}</p>
            </div>
          </div>
          <button onClick={() => setShowCampaignModal(true)} style={{ padding: '8px 14px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            + Plano
          </button>
        </div>

        {/* Sem campanha */}
        {!cycle && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 32, textAlign: 'center' }}>
            <BarChart3 size={40} color="#E2E8F0" style={{ margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 15, fontWeight: 600, color: '#94A3B8', margin: '0 0 16px' }}>Nenhuma campanha ativa</p>
            <button onClick={() => setShowCampaignModal(true)} style={{ padding: '12px 24px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
              Gerar plano de campanha
            </button>
          </div>
        )}

        {/* KPIs 2x2 */}
        {cycle && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {mMetrics.map(({ label, val, target, color }) => {
              const pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0
              const barColor = pct >= 100 ? '#22c55e' : pct >= 70 ? '#f59e0b' : pct >= 40 ? color : '#ef4444'
              return (
                <div key={label} style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', padding: '14px 16px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 8px', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ fontSize: 28, fontWeight: 800, color: '#1e2d6b', margin: '0 0 8px', lineHeight: 1 }}>{val}</p>
                  <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, marginBottom: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.8s ease' }} />
                  </div>
                  <p style={{ fontSize: 12, color: barColor, fontWeight: 600, margin: 0 }}>{pct}% da meta ({target})</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Funil visual */}
        {cycle && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Funil da campanha</p>
            {mMetrics.map(({ label, val, target, color }) => {
              const pct = target > 0 ? Math.min(100, Math.round((val / target) * 100)) : 0
              return (
                <div key={label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1e2d6b' }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{val}<span style={{ color: '#94A3B8', fontWeight: 400 }}>/{target}</span></span>
                  </div>
                  <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Botão gerar plano */}
        <button
          onClick={() => { setIsAdjustMode(!!cycleIsConfigured); setShowCampaignModal(true) }}
          style={{ width: '100%', padding: '14px', background: '#00A896', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Sparkles size={16} /> Gerar novo plano de campanha
        </button>

        {showCampaignModal && (
          <CampaignGeneratorModal
            isOpen={showCampaignModal}
            onClose={() => { setShowCampaignModal(false); setIsAdjustMode(false) }}
            onApply={() => { loadData(); setShowCampaignModal(false); setIsAdjustMode(false) }}
            existingCycle={cycle as any}
            institutionId={institutionId}
            institutionName={institutionName}
            isAdjustMode={isAdjustMode}
            currentUserId={user?.id}
            currentUserName={user?.full_name}
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: '#f8f9fb' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .animate-spin { animation: spin 1s linear infinite }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <BarChart3 style={{ width: 18, height: 18, color: '#3B82F6' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatórios da Campanha</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>
              {cycle
                ? `${cycle.label} · ${new Date(cycle.start_date).toLocaleDateString('pt-BR')} até ${new Date(cycle.end_date).toLocaleDateString('pt-BR')}`
                : institutionName}
            </p>
          </div>
        </div>

        {/* Botões do header */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Botão Ajustar — aparece quando campanha já está configurada */}
          {cycleIsConfigured && (
            <button
              onClick={() => { setIsAdjustMode(true); setShowCampaignModal(true) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                border: '1px solid #E2E8F0', background: '#fff',
                fontSize: 12, color: '#475569', cursor: 'pointer', fontWeight: 600
              }}
            >
              <Settings size={13} /> Ajustar campanha
            </button>
          )}
          <button
            onClick={loadData}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, color: '#64748B', cursor: 'pointer' }}
          >
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── Banner: campanha liberada mas sem metas ─────────────────────────── */}
      {cycleNeedsSetup && (
        <div style={{
          background: 'linear-gradient(135deg, #1A2B4A, #2d4494)',
          borderRadius: 16, padding: 28,
          display: 'flex', alignItems: 'center', gap: 24
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Rocket size={26} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 6px' }}>
              🎉 Sua campanha foi liberada!
            </h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.6 }}>
              Configure as metas de captação e rematrícula para começar a acompanhar os resultados em tempo real. Leva menos de 5 minutos.
            </p>
          </div>
          <button
            onClick={() => { setIsAdjustMode(false); setShowCampaignModal(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: '#00A896', color: '#fff',
              border: 'none', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(0,168,150,0.4)'
            }}
          >
            <Sparkles size={15} /> Configurar agora
          </button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F8FAFC', borderRadius: 14, padding: 4, border: '1px solid #E2E8F0' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '9px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: activeTab === i ? '#fff' : 'transparent',
            color: activeTab === i ? '#00A896' : '#64748B',
            boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba */}
      <div style={{ flex: 1 }}>
        {loading && activeTab === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Loader2 size={28} color="#00A896" className="animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 0 && <TabVisaoGeral cycle={cycle} metrics={metrics} reenrollments={reenrollments} loading={loading} />}
            {activeTab === 1 && <TabFunil metrics={metrics} loading={loading} institutionId={institutionId} cycle={cycle} />}
            {activeTab === 2 && <TabMarketing institutionId={institutionId} cycle={cycle} metrics={metrics} />}
            {activeTab === 3 && <TabRematriculas institutionId={institutionId} cycle={cycle} />}
            {activeTab === 4 && <TabTransferencias institutionId={institutionId} />}
            {activeTab === 5 && <TabDiagnosticoIA institutionId={institutionId} cycle={cycle} metrics={metrics} reenrollments={reenrollments} />}
          </>
        )}
      </div>

      {/* Modal de configuração/ajuste da campanha */}
      {showCampaignModal && (
        <CampaignGeneratorModal
          isOpen={showCampaignModal}
          onClose={() => { setShowCampaignModal(false); setIsAdjustMode(false) }}
          onApply={() => { loadData(); setShowCampaignModal(false); setIsAdjustMode(false) }}
          existingCycle={cycle as any}
          institutionId={institutionId}
          institutionName={institutionName}
          isAdjustMode={isAdjustMode}
          currentUserId={user?.id}
          currentUserName={user?.full_name}
        />
      )}
    </div>
  )
}