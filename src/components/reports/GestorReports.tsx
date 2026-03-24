import React, { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts'
import {
  TrendingUp, Target, RefreshCw, AlertTriangle,
  Loader2, Sparkles, BarChart3, Users, MapPin,
  Check, X, Edit2, Plus, Settings
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { FunnelMetrics, MarketingCampaign, ReEnrollment } from '../../lib/supabase'
import CampaignGeneratorModal from './CampaignGeneratorModal'
import MonthlyChart from './MonthlyChart'

// ─── Interfaces ──────────────────────────────────────────────
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
  erp_files?: unknown[] | null
  historical_data?: unknown[] | null
  status?: string | null
  school_data?: { exits?: Record<string, number>; total_exits?: number; current_students?: number } | null
  ai_reasoning?: string | null
  insight_generated_at?: string | null
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
  status?: string
  deleted_at?: string | null
}

interface HistEntry {
  detected_year?: number; year?: number
  total_students?: number; total?: number
  new_students?: number; novatos?: number
  returning_students?: number; veterans?: number
}

interface MarketData {
  city?: string; state?: string
  school_age_population?: number
  private_school_rate?: number
  sector_growth_rate?: number
  average_students_per_school?: number
  confidence?: string
  data_source?: string
  notes?: string
}

// ─── Helpers ────────────────────────────────────────────────
function pct(a: number, b: number) { if (!b) return 0; return Math.round((a / b) * 100) }
function dev(a: number, b: number) { if (!b) return 0; return Math.round((a / b * 100) - 100) }
function fmt(n: number) { return new Intl.NumberFormat('pt-BR').format(n) }
function fmtCurrency(n: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n) }
function fmtMonth(m?: number | null) {
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return m ? names[(m - 1) % 12] : '—'
}

const MONTH_NAMES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function linearRegression(points: { x: number; y: number }[]) {
  const n = points.length
  if (n < 2) return { slope: 0, intercept: points[0]?.y || 0 }
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

function SkeletonCard() {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0', height: 100 }}>
      <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, width: '40%', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 28, background: '#e2e8f0', borderRadius: 6, width: '60%', marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 12, background: '#e2e8f0', borderRadius: 6, width: '70%', animation: 'pulse 1.5s ease-in-out infinite' }} />
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
    }}>{message}</div>
  )
}

const PIE_COLORS = ['#0d9488', '#7c3aed', '#f97316', '#0ea5e9', '#84cc16', '#f43f5e']

function deviationBadge(actual: number, target: number) {
  if (!target) return null
  const d = dev(actual, target)
  const color = d >= 0 ? '#16a34a' : d >= -15 ? '#d97706' : '#dc2626'
  const bg = d >= 0 ? '#f0fdf4' : d >= -15 ? '#fffbeb' : '#fef2f2'
  return <span style={{ background: bg, color, padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>{d > 0 ? '+' : ''}{d}%</span>
}

// ═══════════════════════════════════════════════════════════
//  PRÉ-CAMPANHA: TAB HISTÓRICO
// ═══════════════════════════════════════════════════════════
function TabHistorico({ setupCycle, institutionId }: { setupCycle: CampaignCycle | null; institutionId: string }) {
  const raw = (setupCycle?.historical_data as HistEntry[] | null | undefined)?.length
    ? (setupCycle!.historical_data as HistEntry[])
    : ((setupCycle?.erp_files as HistEntry[] | null | undefined) ?? [])

  const sorted = [...raw].sort((a, b) => (a.detected_year ?? a.year ?? 0) - (b.detected_year ?? b.year ?? 0))

  const getNew = (e: HistEntry) => e.new_students ?? e.novatos ?? 0
  const getRet = (e: HistEntry) => e.returning_students ?? e.veterans ?? 0
  const getTotal = (e: HistEntry) => e.total_students ?? e.total ?? (getNew(e) + getRet(e))
  const getYear = (e: HistEntry) => String(e.detected_year ?? e.year ?? '?')

  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]

  const deltaNew = previous && getNew(previous) > 0
    ? ((getNew(latest ?? {}) - getNew(previous)) / getNew(previous) * 100).toFixed(1)
    : null

  // Trend from regression
  const regrPoints = sorted.map((e, i) => ({ x: i, y: getNew(e) }))
  const { slope } = linearRegression(regrPoints)
  const trendLabel = slope > 5 ? 'crescimento forte' : slope > 0 ? 'crescimento leve' : slope < -5 ? 'queda' : 'estável'

  if (sorted.length === 0) return (
    <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
      <BarChart3 style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: 0.3 }} />
      <p style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Nenhum histórico importado</p>
      <p style={{ fontSize: 13, margin: '6px 0 0' }}>Configure a escola e importe os dados do ERP para ver o histórico.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

      {/* KPI cards */}
      {latest && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[
            { label: 'Total de alunos', value: fmt(getTotal(latest)), delta: previous ? dev(getTotal(latest), getTotal(previous)) : null },
            { label: 'Alunos novatos', value: fmt(getNew(latest)), delta: previous ? dev(getNew(latest), getNew(previous)) : null },
            { label: 'Veteranos', value: fmt(getRet(latest)), delta: previous ? dev(getRet(latest), getRet(previous)) : null },
            { label: '% Novatos', value: `${pct(getNew(latest), getTotal(latest))}%`, delta: previous ? pct(getNew(latest), getTotal(latest)) - pct(getNew(previous), getTotal(previous)) : null, isPoints: true },
          ].map(({ label, value, delta, isPoints }) => (
            <div key={label} style={{ background: 'white', borderRadius: 16, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>{value}</p>
              {delta !== null && (
                <p style={{ fontSize: 12, color: delta >= 0 ? '#16a34a' : '#dc2626', margin: 0 }}>
                  {delta > 0 ? '▲' : delta < 0 ? '▼' : '—'} {Math.abs(delta)}{isPoints ? ' p.p.' : '%'} vs ano anterior
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Insight tendência */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 18px' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a' }}>
          📊 Tendência dos últimos {sorted.length} anos: <strong>{trendLabel}</strong>
          {deltaNew !== null && ` — novatos variaram ${Number(deltaNew) > 0 ? '+' : ''}${deltaNew}% no último ciclo`}.
        </p>
      </div>

      {/* Tabela histórica */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Histórico completo</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Ano', 'Total', 'Novatos', 'Veteranos', '% Novatos', 'Δ Novatos'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((e, i) => {
                const prev = sorted[i - 1]
                const dNov = prev && getNew(prev) > 0
                  ? ((getNew(e) - getNew(prev)) / getNew(prev) * 100)
                  : null
                return (
                  <tr key={getYear(e)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#374151' }}>{getYear(e)}</td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{fmt(getTotal(e))}</td>
                    <td style={{ padding: '12px 16px', color: '#0d9488', fontWeight: 600 }}>{fmt(getNew(e))}</td>
                    <td style={{ padding: '12px 16px', color: '#6366f1' }}>{fmt(getRet(e))}</td>
                    <td style={{ padding: '12px 16px', color: '#374151' }}>{pct(getNew(e), getTotal(e))}%</td>
                    <td style={{ padding: '12px 16px' }}>
                      {dNov !== null ? (
                        <span style={{ color: dNov >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                          {dNov > 0 ? '+' : ''}{dNov.toFixed(1)}%
                        </span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MonthlyChart */}
      <MonthlyChart institutionId={institutionId} editable={false} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  PRÉ-CAMPANHA: TAB COMPARATIVO
// ═══════════════════════════════════════════════════════════
function TabComparativoPre({
  setupCycle, institutionId, marketData, loadingMarket, onFetchMarket
}: {
  setupCycle: CampaignCycle | null
  institutionId: string
  marketData: MarketData
  loadingMarket: boolean
  onFetchMarket: () => void
}) {
  const raw = (setupCycle?.historical_data as HistEntry[] | null | undefined)?.length
    ? (setupCycle!.historical_data as HistEntry[])
    : ((setupCycle?.erp_files as HistEntry[] | null | undefined) ?? [])

  const seen = new Set<number>()
  const allEntries: HistEntry[] = []
  for (const e of raw) {
    const yr = (e as HistEntry).detected_year ?? (e as HistEntry).year ?? 0
    if (yr > 0 && !seen.has(yr)) { seen.add(yr); allEntries.push(e) }
  }
  allEntries.sort((a, b) => (a.detected_year ?? a.year ?? 0) - (b.detected_year ?? b.year ?? 0))

  const getNew = (e: HistEntry) => e.new_students ?? e.novatos ?? 0
  const getRet = (e: HistEntry) => e.returning_students ?? e.veterans ?? 0
  const getTotal = (e: HistEntry) => e.total_students ?? e.total ?? (getNew(e) + getRet(e))
  const getYear = (e: HistEntry) => String(e.detected_year ?? e.year ?? '?')

  const barData = allEntries.map(e => ({ ano: getYear(e), Novatos: getNew(e), Veteranos: getRet(e) }))

  // School vs market benchmark
  const latest = allEntries[allEntries.length - 1]
  const schoolNewPct = latest ? pct(getNew(latest), getTotal(latest)) : 0
  const marketNewPct = marketData.private_school_rate ? Math.round(marketData.private_school_rate * 100 * 0.18) : null

  const hasData = Object.keys(marketData).length > 0
  const sd = setupCycle?.school_data as { city?: string; state?: string } | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {allEntries.length < 2 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8' }}>
          <BarChart3 style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontSize: 14, margin: 0 }}>São necessários dados de pelo menos 2 anos para o comparativo.</p>
        </div>
      ) : (
        <>
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Novatos vs Veteranos — por ano letivo</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip formatter={(val) => fmt(Number(val))} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Novatos" fill="#8B5CF6" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="Veteranos" fill="#00A896" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Evolução total de alunos</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="ano" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip formatter={(val, name) => [fmt(Number(val)), name]} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Novatos" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Veteranos" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* Benchmark vs mercado local */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Benchmark vs mercado local</h3>
          {!hasData && (
            <button
              onClick={onFetchMarket}
              disabled={loadingMarket}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#0d9488', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {loadingMarket ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <MapPin style={{ width: 13, height: 13 }} />}
              {loadingMarket ? 'Buscando...' : `Buscar dados de ${sd?.city || 'sua cidade'}`}
            </button>
          )}
        </div>
        {hasData ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '14px 16px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 6px', fontWeight: 600 }}>% Novatos — sua escola</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#0d9488', margin: '0 0 4px' }}>{schoolNewPct}%</p>
              {marketNewPct !== null && (
                <span style={{
                  background: schoolNewPct >= marketNewPct ? '#dcfce7' : '#fef9c3',
                  color: schoolNewPct >= marketNewPct ? '#16a34a' : '#854d0e',
                  padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700
                }}>
                  {schoolNewPct >= marketNewPct ? 'Acima da média' : 'Abaixo da média'} do setor
                </span>
              )}
            </div>
            <div style={{ padding: '14px 16px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe' }}>
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 6px', fontWeight: 600 }}>Crescimento do setor em {sd?.city}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#1d4ed8', margin: '0 0 4px' }}>
                {marketData.sector_growth_rate ? `${(marketData.sector_growth_rate * 100).toFixed(1)}%/ano` : 'N/D'}
              </p>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                {marketData.average_students_per_school ? `Média regional: ${fmt(marketData.average_students_per_school)} alunos/escola` : ''}
              </p>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
            Clique em "Buscar dados" para comparar sua escola com o mercado local.
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  PRÉ-CAMPANHA: TAB MERCADO
// ═══════════════════════════════════════════════════════════
function TabMercado({
  marketData, loadingMarket, onFetchMarket, setupCycle
}: {
  marketData: MarketData
  loadingMarket: boolean
  onFetchMarket: () => void
  setupCycle: CampaignCycle | null
}) {
  const sd = setupCycle?.school_data as { city?: string; state?: string; current_students?: number } | null
  const hasData = Object.keys(marketData).length > 0
  const schoolStudents = sd?.current_students ?? 0

  const opportunityStudents = marketData.school_age_population && marketData.private_school_rate
    ? Math.round(marketData.school_age_population * marketData.private_school_rate - schoolStudents)
    : null

  const avgSchoolSize = marketData.average_students_per_school ?? 0
  const competitiveness = schoolStudents > 0 && avgSchoolSize > 0
    ? schoolStudents / avgSchoolSize
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {!hasData && (
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <MapPin style={{ width: 48, height: 48, margin: '0 auto 12px', color: '#cbd5e1' }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Dados de mercado não carregados</h3>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 20px' }}>
            Buscaremos dados demográficos e educacionais de {sd?.city || 'sua cidade'}.
          </p>
          <button
            onClick={onFetchMarket}
            disabled={loadingMarket}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: '#0d9488', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', margin: '0 auto' }}>
            {loadingMarket ? <Loader2 style={{ width: 15, height: 15, animation: 'spin 1s linear infinite' }} /> : <MapPin style={{ width: 15, height: 15 }} />}
            {loadingMarket ? 'Buscando dados...' : 'Analisar mercado local'}
          </button>
        </div>
      )}

      {hasData && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {[
              { label: `Crianças em idade escolar em ${sd?.city}`, value: marketData.school_age_population?.toLocaleString('pt-BR') ?? 'N/D', color: '#3B82F6', bg: '#EFF6FF' },
              { label: 'Estudam em escola particular', value: marketData.private_school_rate ? `${(marketData.private_school_rate * 100).toFixed(1)}%` : 'N/D', color: '#10B981', bg: '#ECFDF5' },
              { label: 'Crescimento do setor ao ano', value: marketData.sector_growth_rate ? `${(marketData.sector_growth_rate * 100).toFixed(1)}%` : 'N/D', color: '#00A896', bg: '#E6F7F5' },
              { label: 'Média de alunos por escola', value: marketData.average_students_per_school?.toLocaleString('pt-BR') ?? 'N/D', color: '#6B7280', bg: '#F9FAFB' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 12, padding: '14px 16px' }}>
                <p style={{ fontSize: 11, color, fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 800, color, margin: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {opportunityStudents !== null && (
            <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 12, padding: '14px 18px' }}>
              <p style={{ margin: 0, fontSize: 14, color: '#4c1d95' }}>
                🎯 <strong>Oportunidade:</strong> Com a taxa de escolarização privada atual, há potencial para{' '}
                <strong>{fmt(Math.max(0, opportunityStudents))} novos alunos</strong> no mercado de {sd?.city}.
              </p>
            </div>
          )}

          {competitiveness !== null && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 14px' }}>Competitividade da escola</h3>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, competitiveness * 100)}%`, background: competitiveness >= 1 ? '#0d9488' : '#f97316', borderRadius: 999 }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>
                    Sua escola tem <strong>{fmt(schoolStudents)} alunos</strong> vs média regional de <strong>{fmt(avgSchoolSize)}</strong>
                  </p>
                </div>
                <span style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: competitiveness >= 1 ? '#f0fdf4' : '#fff7ed',
                  color: competitiveness >= 1 ? '#16a34a' : '#d97706'
                }}>
                  {competitiveness >= 1.2 ? 'Acima da média' : competitiveness >= 0.8 ? 'Na média' : 'Abaixo da média'}
                </span>
              </div>
            </div>
          )}

          {marketData.notes && (
            <p style={{ fontSize: 12, color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: 9, lineHeight: 1.6 }}>
              💡 {marketData.notes}
            </p>
          )}
          <p style={{ fontSize: 11, color: '#94a3b8' }}>Fonte: {marketData.data_source || 'IBGE Censo / Censo Escolar MEC'}</p>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  CAMPANHA ATIVA: TAB VISÃO GERAL
// ═══════════════════════════════════════════════════════════
function TabVisaoGeral({
  funnelData, reEnrollData, activeCycle, institutionId, leads, onEditCampaign
}: {
  funnelData: FunnelMetrics[]
  reEnrollData: ReEnrollment[]
  activeCycle: CampaignCycle | null
  institutionId: string
  leads: { id: string; created_at: string }[]
  onEditCampaign: () => void
}) {
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [localInsight, setLocalInsight] = useState(activeCycle?.ai_reasoning ?? '')
  const [localInsightDate, setLocalInsightDate] = useState(activeCycle?.insight_generated_at ?? '')

  useEffect(() => {
    setLocalInsight(activeCycle?.ai_reasoning ?? '')
    setLocalInsightDate(activeCycle?.insight_generated_at ?? '')
  }, [activeCycle?.id])

  const latest = funnelData[funnelData.length - 1]
  const lastRe = reEnrollData[reEnrollData.length - 1]

  const totalEnrolled = funnelData.reduce((s, f) => s + (f.enrollments ?? 0), 0)
  const metaProgress = (latest?.registrations_target ?? 0) > 0
    ? Math.min(1, (latest?.registrations ?? 0) / (latest?.registrations_target ?? 1))
    : 0
  const conversionRate = (latest?.registrations ?? 0) > 0
    ? (latest?.enrollments ?? 0) / (latest?.registrations ?? 1)
    : 0
  const reenrollRate = ((lastRe?.re_enrolled ?? 0) / Math.max(1, lastRe?.total_base ?? 1))
  const thisWeekLeads = leads.filter(l =>
    new Date(l.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length

  const daysLeft = Math.max(1, Math.floor(
    (new Date(activeCycle?.end_date ?? Date.now()).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  ))
  const weeksLeft = Math.max(1, Math.floor(daysLeft / 7))
  const remainingTarget = Math.max(0, (activeCycle?.target_new_students ?? 0) - totalEnrolled)
  const requiredWeekly = Math.ceil(remainingTarget / weeksLeft)
  const weeklyRhythm = requiredWeekly > 0 ? Math.min(1, thisWeekLeads / requiredWeekly) : 0.5
  const onTrack = thisWeekLeads >= requiredWeekly

  const healthScore = Math.round(
    metaProgress * 40 +
    conversionRate * 30 +
    weeklyRhythm * 20 +
    reenrollRate * 10
  )

  const radius = 54
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (healthScore / 100) * circumference
  const gaugeColor = healthScore >= 75 ? '#0F6E56' : healthScore >= 50 ? '#BA7517' : '#E24B4A'

  const generateInsight = async () => {
    if (!activeCycle) return
    setLoadingInsight(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly_insight',
          payload: {
            funnel: latest,
            previousFunnel: funnelData.length > 1 ? funnelData[funnelData.length - 2] : null,
            reenrollments: lastRe,
            campaignWeek: latest?.period,
            healthScore,
            totalEnrolled,
            target: activeCycle.target_new_students,
          }
        })
      })
      const data = await res.json()
      const insight = data.result ?? ''
      setLocalInsight(insight)
      const now = new Date().toISOString()
      setLocalInsightDate(now)
      await supabase.from('campaign_cycles').update({
        ai_reasoning: insight,
        insight_generated_at: now
      }).eq('id', activeCycle.id)
    } catch { /* ignore */ }
    finally { setLoadingInsight(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 24 }}>
        {/* Gauge */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', margin: 0 }}>Índice de Saúde</p>
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="12"/>
            <circle cx="70" cy="70" r={radius} fill="none" stroke={gaugeColor} strokeWidth="12"
              strokeDasharray={circumference} strokeDashoffset={offset}
              strokeLinecap="round" transform="rotate(-90 70 70)"/>
            <text x="70" y="68" textAnchor="middle" dominantBaseline="central"
              fontSize="24" fontWeight="700" fill={gaugeColor}>{healthScore}</text>
            <text x="70" y="90" textAnchor="middle" fontSize="11" fill="#6b7280">saúde</text>
          </svg>
          <p style={{ fontSize: 12, color: healthScore >= 75 ? '#16a34a' : healthScore >= 50 ? '#d97706' : '#dc2626', fontWeight: 600, margin: 0, textAlign: 'center' }}>
            {healthScore >= 75 ? '🟢 Campanha saudável' : healthScore >= 50 ? '🟡 Atenção necessária' : '🔴 Em risco'}
          </p>
        </div>

        {/* Velocity + KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Velocidade semanal */}
          <div style={{ background: onTrack ? '#f0fdf4' : '#fffbeb', border: `1px solid ${onTrack ? '#bbf7d0' : '#fde68a'}`, borderRadius: 12, padding: '14px 18px' }}>
            <p style={{ margin: 0, fontSize: 13, color: onTrack ? '#166534' : '#92400e' }}>
              {onTrack ? '✓' : '⚠'} <strong>Ritmo necessário: {requiredWeekly}/semana</strong>
              {' '}· Esta semana: <strong>{thisWeekLeads} leads</strong>
              {' '}· {weeksLeft} semana{weeksLeft !== 1 ? 's' : ''} restante{weeksLeft !== 1 ? 's' : ''}
              {' '}· {onTrack ? 'No ritmo' : 'Abaixo — intensifique a captação'}
            </p>
          </div>

          {/* 4 KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {[
              { label: 'Cadastros', actual: latest?.registrations ?? 0, target: latest?.registrations_target ?? 0 },
              { label: 'Visitas', actual: latest?.visits ?? 0, target: latest?.visits_target ?? 0 },
              { label: 'Matrículas', actual: latest?.enrollments ?? 0, target: latest?.enrollments_target ?? 0 },
            ].map(({ label, actual, target }) => (
              <div key={label} style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, margin: '0 0 6px' }}>{label}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>{fmt(actual)}</p>
                {target > 0 && deviationBadge(actual, target)}
              </div>
            ))}
            <div style={{ background: 'white', borderRadius: 12, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, margin: '0 0 6px' }}>Total matrículas</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>{fmt(totalEnrolled)}</p>
              {(activeCycle?.target_new_students ?? 0) > 0 && (
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>meta: {fmt(activeCycle?.target_new_students ?? 0)}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Análise IA */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles style={{ width: 16, height: 16, color: '#7c3aed' }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Análise da IA</h3>
          </div>
          {!localInsight && (
            <button
              onClick={generateInsight}
              disabled={loadingInsight || !latest}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#7c3aed', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: loadingInsight ? 0.7 : 1 }}>
              {loadingInsight ? <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 13, height: 13 }} />}
              {loadingInsight ? 'Gerando...' : 'Gerar análise'}
            </button>
          )}
          {localInsight && (
            <button onClick={generateInsight} disabled={loadingInsight}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', fontSize: 12, cursor: 'pointer' }}>
              <RefreshCw style={{ width: 11, height: 11 }} /> Regerar
            </button>
          )}
        </div>
        {localInsight ? (
          <div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, margin: '0 0 8px' }}>{localInsight}</p>
            {localInsightDate && (
              <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
                Gerado em {new Date(localInsightDate).toLocaleDateString('pt-BR')}
              </p>
            )}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
            {!latest ? 'Registre dados de funil para gerar análise.' : 'Clique em "Gerar análise" para obter insights sobre a campanha.'}
          </p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  CAMPANHA ATIVA: TAB FUNIL
// ═══════════════════════════════════════════════════════════
function TabFunil({
  funnelData, activeCycle, institutionId
}: {
  funnelData: FunnelMetrics[]
  activeCycle: CampaignCycle | null
  institutionId: string
}) {
  const latest = funnelData[funnelData.length - 1]
  const reg = latest?.registrations ?? 0
  const vis = latest?.visits ?? 0
  const enr = latest?.enrollments ?? 0

  const steps = [
    { label: 'Cadastros', value: reg, target: latest?.registrations_target ?? 0, color: '#6366f1' },
    { label: 'Visitas', value: vis, target: latest?.visits_target ?? 0, color: '#0d9488', pct: reg > 0 ? pct(vis, reg) : 0 },
    { label: 'Matrículas', value: enr, target: latest?.enrollments_target ?? 0, color: '#0F6E56', pct: vis > 0 ? pct(enr, vis) : 0 },
  ]

  const sortedFunnelData = [...funnelData].sort((a, b) => a.period.localeCompare(b.period))

  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-')
    const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${monthNames[parseInt(month) - 1]}/${year}`
  }

  const tableData = sortedFunnelData.map(f => {
    const dReg = (f.registrations_target ?? 0) > 0 ? dev(f.registrations ?? 0, f.registrations_target!) : null
    const dEnr = (f.enrollments_target ?? 0) > 0 ? dev(f.enrollments ?? 0, f.enrollments_target!) : null
    return { ...f, dReg, dEnr }
  })

  const chartData = sortedFunnelData.map(f => ({
    period: formatPeriod(f.period),
    real: f.registrations ?? 0,
    meta: f.registrations_target ?? 0,
    matriculas: f.enrollments ?? 0,
    meta_matriculas: f.enrollments_target ?? 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Funnel cascade */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 20px' }}>Funil do mês atual</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 480 }}>
          {steps.map((s, i) => (
            <div key={s.label}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', color: '#94a3b8', fontSize: 12 }}>
                  <div style={{ width: 1, height: 16, background: '#e2e8f0', marginLeft: 16 }} />
                  {s.pct}% conversão
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  flex: 1, background: s.color + '18', borderRadius: 10, padding: '12px 16px',
                  border: `1.5px solid ${s.color}30`,
                  width: `${100 - i * 15}%`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.label}</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{fmt(s.value)}</span>
                  </div>
                  {s.target > 0 && (
                    <div style={{ marginTop: 6, height: 4, background: '#e2e8f0', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${Math.min(100, pct(s.value, s.target))}%`, background: s.color, borderRadius: 999 }} />
                    </div>
                  )}
                </div>
                {s.target > 0 && deviationBadge(s.value, s.target)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico real vs meta */}
      {chartData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 20px' }}>Cadastros reais vs meta</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="real" fill="#1D9E75" name="Cadastros reais" radius={[4,4,0,0]} />
              <Line dataKey="meta" stroke="#BA7517" strokeWidth={2} strokeDasharray="4 3" name="Meta cadastros" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* MonthlyChart editável */}
      <MonthlyChart institutionId={institutionId} editable={true} />

      {/* Tabela mensal */}
      {tableData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Detalhamento mensal</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Mês', 'Cadastros', 'Meta', 'Desvio', 'Visitas', 'Matrículas', 'Desvio Matr.'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151' }}>{formatPeriod(f.period)}</td>
                    <td style={{ padding: '10px 14px' }}>{fmt(f.registrations ?? 0)}</td>
                    <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{f.registrations_target ? fmt(f.registrations_target) : '—'}</td>
                    <td style={{ padding: '8px 14px' }}>
                      {f.dReg !== null ? (
                        <span style={{
                          background: f.dReg >= 0 ? '#f0fdf4' : f.dReg >= -15 ? '#fffbeb' : '#fef2f2',
                          color: f.dReg >= 0 ? '#16a34a' : f.dReg >= -15 ? '#d97706' : '#dc2626',
                          padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700
                        }}>{f.dReg > 0 ? '+' : ''}{f.dReg}%</span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 14px' }}>{fmt(f.visits ?? 0)}</td>
                    <td style={{ padding: '10px 14px', color: '#0d9488', fontWeight: 600 }}>{fmt(f.enrollments ?? 0)}</td>
                    <td style={{ padding: '8px 14px' }}>
                      {f.dEnr !== null ? (
                        <span style={{
                          background: f.dEnr >= 0 ? '#f0fdf4' : f.dEnr >= -15 ? '#fffbeb' : '#fef2f2',
                          color: f.dEnr >= 0 ? '#16a34a' : f.dEnr >= -15 ? '#d97706' : '#dc2626',
                          padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700
                        }}>{f.dEnr > 0 ? '+' : ''}{f.dEnr}%</span>
                      ) : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
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

// ═══════════════════════════════════════════════════════════
//  CAMPANHA ATIVA: TAB MARKETING & ROI
// ═══════════════════════════════════════════════════════════
const DEFAULT_CHANNELS = ['Google Ads', 'Facebook/Instagram', 'Indicação', 'Outdoor/Rádio', 'WhatsApp', 'Outros']

function TabMarketingROI({
  marketingData, institutionId, onRefresh, showToast
}: {
  marketingData: MarketingCampaign[]
  institutionId: string
  onRefresh: () => void
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState({ investment: '', leads_generated: '', cpa_target: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [newRow, setNewRow] = useState({ month_year: '', investment: '', leads_generated: '', cpa_target: '' })
  const [saving, setSaving] = useState(false)

  const totalInv = marketingData.reduce((s, m) => s + (m.investment || 0), 0)
  const totalLeads = marketingData.reduce((s, m) => s + (m.leads_generated || 0), 0)
  const cpaGeral = totalLeads > 0 ? totalInv / totalLeads : 0

  const chartData = marketingData.map(m => ({
    month: m.month_year,
    cpa_real: m.leads_generated > 0 ? Math.round(m.investment / m.leads_generated) : 0,
    cpa_alvo: m.cpa_target || 0,
  }))

  const saveEdit = async (id: string) => {
    setSaving(true)
    try {
      await supabase.from('marketing_campaigns').update({
        investment: parseFloat(editVals.investment) || 0,
        leads_generated: parseInt(editVals.leads_generated) || 0,
        cpa_target: editVals.cpa_target ? parseFloat(editVals.cpa_target) : null,
      }).eq('id', id)
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
      await supabase.from('marketing_campaigns').upsert({
        month_year: newRow.month_year,
        investment: parseFloat(newRow.investment) || 0,
        leads_generated: parseInt(newRow.leads_generated) || 0,
        cpa_target: newRow.cpa_target ? parseFloat(newRow.cpa_target) : null,
        institution_id: institutionId,
      }, { onConflict: 'month_year,institution_id' })
      setShowAdd(false)
      setNewRow({ month_year: '', investment: '', leads_generated: '', cpa_target: '' })
      onRefresh()
      showToast('Registro adicionado!')
    } catch { showToast('Erro ao adicionar', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Investimento Total', value: fmtCurrency(totalInv), sub: `${marketingData.length} meses` },
          { label: 'Leads Gerados', value: fmt(totalLeads), sub: 'acumulado' },
          { label: 'CPA Geral', value: fmtCurrency(cpaGeral), sub: 'custo por lead', hl: true },
        ].map(({ label, value, sub, hl }) => (
          <div key={label} style={{ background: hl ? '#0d9488' : 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: hl ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: hl ? 'white' : '#1e2d6b', margin: '0 0 4px' }}>{value}</p>
            <p style={{ fontSize: 11, color: hl ? 'rgba(255,255,255,0.7)' : '#94a3b8', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Benchmark */}
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 18px' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a' }}>
          📊 <strong>Benchmark:</strong> CPA médio de escolas similares é R$ 350.
          {cpaGeral > 0 && (
            <> Seu CPA atual é {fmtCurrency(cpaGeral)} —{' '}
              <strong style={{ color: cpaGeral <= 350 ? '#16a34a' : '#dc2626' }}>
                {cpaGeral <= 350 ? 'abaixo' : 'acima'} do benchmark
              </strong>.
            </>
          )}
        </p>
      </div>

      {/* CPA chart */}
      {chartData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>CPA Real vs Alvo</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tickFormatter={v => `R$${v}`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v, n) => [fmtCurrency(Number(v)), String(n) === 'cpa_real' ? 'CPA Real' : 'CPA Alvo']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={v => v === 'cpa_real' ? 'CPA Real' : 'CPA Alvo'} />
              <Line type="monotone" dataKey="cpa_real" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="cpa_alvo" stroke="#94a3b8" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela editável */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Campanhas mensais</h3>
          <button onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0d9488', color: 'white', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Plus style={{ width: 13, height: 13 }} /> Novo Mês
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Mês/Ano', 'Investimento', 'Leads', 'CPA Real', 'CPA Alvo', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showAdd && (
                <tr style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <td style={{ padding: '8px 12px' }}><input value={newRow.month_year} onChange={e => setNewRow({ ...newRow, month_year: e.target.value })} placeholder="MM/AAAA" style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} /></td>
                  {(['investment', 'leads_generated', 'cpa_target'] as const).map(f => (
                    <td key={f} style={{ padding: '8px 12px' }}><input type="number" value={newRow[f]} onChange={e => setNewRow({ ...newRow, [f]: e.target.value })} placeholder="0" style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} /></td>
                  ))}
                  <td /><td style={{ padding: '8px 12px' }}>
                    <button onClick={saveNew} disabled={saving} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, marginRight: 4 }}>Salvar</button>
                    <button onClick={() => setShowAdd(false)} style={{ background: '#f1f5f9', color: '#6b7280', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Cancelar</button>
                  </td>
                </tr>
              )}
              {marketingData.map(m => {
                const cpaReal = m.leads_generated > 0 ? m.investment / m.leads_generated : 0
                const isEditing = editingId === m.id
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#374151' }}>{m.month_year}</td>
                    <td style={{ padding: '10px 16px' }}>{isEditing ? <input type="number" value={editVals.investment} onChange={e => setEditVals({ ...editVals, investment: e.target.value })} style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} /> : fmtCurrency(m.investment)}</td>
                    <td style={{ padding: '10px 16px' }}>{isEditing ? <input type="number" value={editVals.leads_generated} onChange={e => setEditVals({ ...editVals, leads_generated: e.target.value })} style={{ width: 70, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} /> : fmt(m.leads_generated)}</td>
                    <td style={{ padding: '10px 16px', color: '#f97316' }}>{fmtCurrency(cpaReal)}</td>
                    <td style={{ padding: '10px 16px' }}>{isEditing ? <input type="number" value={editVals.cpa_target} onChange={e => setEditVals({ ...editVals, cpa_target: e.target.value })} style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }} /> : (m.cpa_target ? fmtCurrency(m.cpa_target) : '—')}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(m.id)} disabled={saving} style={{ background: '#0d9488', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><Check style={{ width: 12, height: 12 }} /></button>
                          <button onClick={() => setEditingId(null)} style={{ background: '#f1f5f9', color: '#6b7280', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}><X style={{ width: 12, height: 12 }} /></button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(m.id); setEditVals({ investment: String(m.investment), leads_generated: String(m.leads_generated), cpa_target: String(m.cpa_target || '') }) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><Edit2 style={{ width: 14, height: 14 }} /></button>
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
                <td /><td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  CAMPANHA ATIVA: TAB RETENÇÃO
// ═══════════════════════════════════════════════════════════
function TabRetencao({
  reEnrollData, transfers, activeCycle, institutionId, surveyResponses
}: {
  reEnrollData: ReEnrollment[]
  transfers: StudentTransfer[]
  activeCycle: CampaignCycle | null
  institutionId: string
  surveyResponses: { answers?: { reenrollment?: string } }[]
}) {
  const highRisk = surveyResponses.filter(r =>
    ['Provavelmente não', 'Não vou rematricular'].includes(r.answers?.reenrollment ?? '')
  ).length
  const undecided = surveyResponses.filter(r =>
    r.answers?.reenrollment === 'Ainda não decidi'
  ).length
  const confirmedTransfers = transfers.filter(t => t.status === 'confirmed' && !t.deleted_at).length

  const exits = activeCycle?.school_data?.total_exits ?? 0
  const currentStudents = activeCycle?.school_data?.current_students ?? 0
  const eligible = Math.max(0, currentStudents - exits - confirmedTransfers)

  const lastRe = reEnrollData[reEnrollData.length - 1]
  const taxaAtual = lastRe ? pct(lastRe.re_enrolled, lastRe.total_base) : 0
  const regrPoints = reEnrollData.map((r, i) => ({ x: i, y: pct(r.re_enrolled, r.total_base) }))
  const { slope, intercept } = linearRegression(regrPoints)
  const n = regrPoints.length
  const proj = n > 0 ? Math.min(100, Math.max(0, Math.round(slope * n + intercept))) : taxaAtual
  const trendLabel = slope > 0.5 ? 'crescimento' : slope < -0.5 ? 'queda' : 'estável'

  const chartData = reEnrollData.map(r => ({
    period: r.period,
    pct_real: pct(r.re_enrolled, r.total_base),
    target: r.target_percentage,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Risk radar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <div style={{ background: highRisk > 0 ? '#fef2f2' : '#f8fafc', border: `1px solid ${highRisk > 0 ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 16, padding: '18px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Alto Risco</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: highRisk > 0 ? '#dc2626' : '#94a3b8', margin: '0 0 4px' }}>{highRisk}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>famílias não vão rematricular</p>
        </div>
        <div style={{ background: undecided > 0 ? '#fffbeb' : '#f8fafc', border: `1px solid ${undecided > 0 ? '#fde68a' : '#e2e8f0'}`, borderRadius: 16, padding: '18px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Indecisos</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: undecided > 0 ? '#d97706' : '#94a3b8', margin: '0 0 4px' }}>{undecided}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>oportunidade de retenção</p>
        </div>
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '18px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>Transferências</p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#374151', margin: '0 0 4px' }}>{confirmedTransfers}</p>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>confirmadas este ciclo</p>
        </div>
      </div>

      {/* Base elegível */}
      {currentStudents > 0 && (exits > 0 || confirmedTransfers > 0) && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '12px 18px' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#1e3a8a' }}>
            <strong>Base elegível para rematrícula: {fmt(eligible)} alunos</strong>
            {' '}(total: {currentStudents}
            {exits > 0 ? ` − formandos: ${exits}` : ''}
            {confirmedTransfers > 0 ? ` − transferências: ${confirmedTransfers}` : ''})
          </p>
        </div>
      )}

      {/* Taxa de rematrícula */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {[
          { label: 'Taxa Atual', value: `${taxaAtual}%`, sub: `${lastRe?.re_enrolled ?? 0} de ${lastRe?.total_base ?? 0}` },
          { label: 'Meta', value: `${lastRe?.target_percentage ?? 85}%`, sub: 'fidelização' },
          { label: 'Projeção', value: `${proj}%`, sub: `Tendência: ${trendLabel}`, hl: proj >= (lastRe?.target_percentage ?? 85) },
        ].map(({ label, value, sub, hl }) => (
          <div key={label} style={{ background: hl ? '#0d9488' : 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: hl ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', margin: '0 0 8px' }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: hl ? 'white' : '#1e2d6b', margin: '0 0 4px' }}>{value}</p>
            <p style={{ fontSize: 11, color: hl ? 'rgba(255,255,255,0.7)' : '#94a3b8', margin: 0 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Gráfico rematrícula */}
      {chartData.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Evolução das rematrículas</h3>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v, n) => [`${Number(v)}%`, String(n) === 'pct_real' ? '% Rematric.' : 'Meta']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  CAMPANHA ATIVA: TAB INTELIGÊNCIA
// ═══════════════════════════════════════════════════════════
function TabInteligencia({
  funnelData, marketingData, reEnrollData, activeCycle, institutionId, showToast
}: {
  funnelData: FunnelMetrics[]
  marketingData: MarketingCampaign[]
  reEnrollData: ReEnrollment[]
  activeCycle: CampaignCycle | null
  institutionId: string
  showToast: (msg: string, type?: 'success' | 'error') => void
}) {
  const [reportLoading, setReportLoading] = useState(false)
  const [report, setReport] = useState('')
  const [showReport, setShowReport] = useState(false)

  const totalEnrolled = funnelData.reduce((s, f) => s + (f.enrollments ?? 0), 0)
  const totalNew = funnelData.reduce((s, f) => s + (f.enrollments ?? 0), 0)
  const baseStudents = activeCycle?.base_students ?? 0
  const newPct = baseStudents > 0 ? Math.round(totalNew / baseStudents * 100) : 0

  const totalInv = marketingData.reduce((s, m) => s + (m.investment || 0), 0)
  const totalLeads = marketingData.reduce((s, m) => s + (m.leads_generated || 0), 0)
  const avgCPA = totalLeads > 0 ? Math.round(totalInv / totalLeads) : 0

  const latest = funnelData[funnelData.length - 1]
  const convPct = (latest?.registrations ?? 0) > 0
    ? Math.round((latest?.enrollments ?? 0) / (latest?.registrations ?? 1) * 100)
    : 0

  const lastRe = reEnrollData[reEnrollData.length - 1]
  const reenrollPct = lastRe ? pct(lastRe.re_enrolled, lastRe.total_base) : 0

  const benchmarks = [
    { label: '% de novatos', escola: newPct, setor: 18, unit: '%', reverse: false },
    { label: 'CPA médio', escola: avgCPA, setor: 350, unit: 'R$', reverse: true },
    { label: 'Conversão lead→matrícula', escola: convPct, setor: 18, unit: '%', reverse: false },
    { label: 'Taxa de rematrícula', escola: reenrollPct, setor: 85, unit: '%', reverse: false },
  ]

  // Heat map data
  const monthlyEnrolls = funnelData.map(f => ({
    period: f.period,
    enrollments: f.enrollments ?? 0,
  }))
  const maxEnrolls = Math.max(1, ...monthlyEnrolls.map(m => m.enrollments))

  const interpolateColor = (val: number, max: number) => {
    const t = max > 0 ? val / max : 0
    const r1 = 0x9F, g1 = 0xE1, b1 = 0xCB
    const r2 = 0x08, g2 = 0x50, b2 = 0x41
    const r = Math.round(r1 + (r2 - r1) * t)
    const g = Math.round(g1 + (g2 - g1) * t)
    const b = Math.round(b1 + (b2 - b1) * t)
    return `rgb(${r},${g},${b})`
  }

  const generateReport = async () => {
    setReportLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'weekly_insight',
          payload: {
            funnel: latest,
            previousFunnel: funnelData.length > 1 ? funnelData[funnelData.length - 2] : null,
            reenrollments: lastRe,
            campaignWeek: latest?.period,
            benchmarks,
            totalEnrolled,
            target: activeCycle?.target_new_students,
            reportType: 'executive'
          }
        })
      })
      const data = await res.json()
      setReport(data.result ?? '')
      setShowReport(true)
    } catch { showToast('Erro ao gerar relatório', 'error') }
    finally { setReportLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Benchmark table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Benchmark nacional</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Métrica', 'Sua escola', 'Setor', 'Resultado'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {benchmarks.map(({ label, escola, setor, unit, reverse }) => {
              const isAbove = reverse ? escola <= setor : escola >= setor
              const diff = reverse ? setor - escola : escola - setor
              return (
                <tr key={label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#374151', fontWeight: 500 }}>{label}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e2d6b' }}>
                    {unit === 'R$' ? fmtCurrency(escola) : `${escola}${unit}`}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#6b7280' }}>
                    {unit === 'R$' ? fmtCurrency(setor) : `${setor}${unit}`}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      background: isAbove ? '#f0fdf4' : Math.abs(diff) < setor * 0.1 ? '#fffbeb' : '#fef2f2',
                      color: isAbove ? '#16a34a' : Math.abs(diff) < setor * 0.1 ? '#d97706' : '#dc2626',
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700
                    }}>
                      {isAbove ? 'Acima da média' : Math.abs(diff) < setor * 0.1 ? 'Na média' : 'Abaixo da média'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Heat map */}
      {monthlyEnrolls.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Mapa de calor — matrículas por mês</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {monthlyEnrolls.map(m => (
              <div key={m.period} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 10,
                  background: m.enrollments > 0 ? interpolateColor(m.enrollments, maxEnrolls) : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: m.enrollments > maxEnrolls * 0.5 ? 'white' : '#374151' }}>
                    {m.enrollments}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{m.period?.slice(5)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Relatório executivo */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>Relatório executivo</h3>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Resumo executivo com pontos fortes, riscos e recomendações</p>
          </div>
          <button
            onClick={generateReport}
            disabled={reportLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: '#1e2d6b', color: 'white', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: reportLoading ? 0.7 : 1 }}>
            {reportLoading ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <Sparkles style={{ width: 14, height: 14 }} />}
            {reportLoading ? 'Gerando...' : 'Gerar relatório'}
          </button>
        </div>
        {report && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '16px 20px', lineHeight: 1.7 }}>
            <p style={{ fontSize: 13, color: '#374151', margin: '0 0 14px', whiteSpace: 'pre-wrap' }}>{report}</p>
            <button
              onClick={() => window.print()}
              style={{ padding: '6px 14px', borderRadius: 8, background: '#0d9488', color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Imprimir
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function GestorReports() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!

  const [activeTab, setActiveTab] = useState('historico')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [modalPreload, setModalPreload] = useState<{ openAtStep?: number } | null>(null)

  // Dados
  const [funnelData, setFunnelData] = useState<FunnelMetrics[]>([])
  const [marketingData, setMarketingData] = useState<MarketingCampaign[]>([])
  const [reEnrollData, setReEnrollData] = useState<ReEnrollment[]>([])
  const [allCycles, setAllCycles] = useState<CampaignCycle[]>([])
  const [transfers, setTransfers] = useState<StudentTransfer[]>([])
  const [leads, setLeads] = useState<{ id: string; created_at: string }[]>([])
  const [surveyResponses, setSurveyResponses] = useState<{ answers?: { reenrollment?: string } }[]>([])
  const [marketData, setMarketData] = useState<MarketData>({})
  const [loadingMarket, setLoadingMarket] = useState(false)

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadAll = useCallback(async () => {
    if (!institutionId) return
    setLoading(true)
    try {
      const [f, m, r] = await Promise.all([
        supabase.from('funnel_metrics').select('*').eq('institution_id', institutionId).order('period', { ascending: true }),
        supabase.from('marketing_campaigns').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
        supabase.from('re_enrollments').select('*').eq('institution_id', institutionId).order('created_at', { ascending: true }),
      ])
      setFunnelData(f.data || [])
      setMarketingData(m.data || [])
      setReEnrollData(r.data || [])
    } catch (err) { console.error('loadAll error:', err) }

    try {
      const { data: cyclesData } = await supabase
        .from('campaign_cycles').select('*')
        .eq('institution_id', institutionId).order('created_at', { ascending: false })
      setAllCycles((cyclesData || []) as CampaignCycle[])
    } catch { /* ignore */ }

    try {
      const { data } = await supabase
        .from('student_transfers').select('*')
        .eq('institution_id', institutionId).order('created_at', { ascending: false })
      setTransfers(data || [])
    } catch { /* ignore */ }

    try {
      const { data } = await supabase
        .from('leads').select('id, created_at')
        .eq('institution_id', institutionId).order('created_at', { ascending: false })
      setLeads(data || [])
    } catch { /* ignore */ }

    try {
      const { data } = await supabase
        .from('satisfaction_responses').select('answers')
        .eq('institution_id', institutionId)
      setSurveyResponses(data || [])
    } catch { /* ignore */ }

    setLoading(false)
  }, [institutionId])

  useEffect(() => { loadAll() }, [loadAll])

  const fetchMarket = useCallback(async () => {
    const setupCycle = allCycles.find(c => c.status === 'setup')
    const sd = setupCycle?.school_data as { city?: string; state?: string } | null
    if (!sd?.city) return
    setLoadingMarket(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch_ibge', payload: { city: sd.city, state: sd.state } })
      })
      const data = await res.json()
      if (data.result) setMarketData(data.result)
    } catch { /* ignore */ }
    finally { setLoadingMarket(false) }
  }, [allCycles])

  // Phase logic
  const setupCycle = allCycles.find(c => c.status === 'setup')
  const activeCycle = allCycles.find(c => c.status === 'active' || !!(c as CampaignCycle & { applied_at?: string }).applied_at)
  const hasSetup = !!setupCycle
  const hasCampaign = !!activeCycle

  type Phase = 'no_setup' | 'pre_campaign' | 'campaign_active'
  const phase: Phase = !hasSetup ? 'no_setup' : !hasCampaign ? 'pre_campaign' : 'campaign_active'

  const PRE_TABS = [
    { id: 'historico', label: 'Histórico', icon: BarChart3 },
    { id: 'comparativo', label: 'Comparativo', icon: TrendingUp },
    { id: 'mercado', label: 'Mercado', icon: MapPin },
  ]

  const ACTIVE_TABS = [
    { id: 'visao_geral', label: 'Visão Geral', icon: TrendingUp },
    { id: 'funil', label: 'Funil', icon: Target },
    { id: 'marketing', label: 'Marketing & ROI', icon: BarChart3 },
    { id: 'retencao', label: 'Retenção', icon: RefreshCw },
    { id: 'inteligencia', label: 'Inteligência', icon: Sparkles },
  ]

  const tabs = phase === 'campaign_active' ? ACTIVE_TABS : PRE_TABS
  const cycleForModal = activeCycle ?? setupCycle ?? null

  // Reset tab when phase changes
  useEffect(() => {
    if (phase === 'campaign_active' && !ACTIVE_TABS.find(t => t.id === activeTab)) {
      setActiveTab('visao_geral')
    } else if (phase !== 'campaign_active' && !PRE_TABS.find(t => t.id === activeTab)) {
      setActiveTab('historico')
    }
  }, [phase]) // eslint-disable-line

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100%', background: '#f8f9fb' }}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}} @keyframes slideUp{from{transform:translateY(10px);opacity:0}to{transform:translateY(0);opacity:1}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Relatórios & Inteligência</h1>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
            {phase === 'no_setup' ? 'Configure sua escola para começar' : phase === 'pre_campaign' ? 'Pré-campanha — visualizando histórico' : `Campanha ativa — Ano letivo ${activeCycle?.year ?? ''}`}
          </p>
        </div>
        <button
          onClick={() => setShowCampaignModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: hasCampaign ? '#f0fdf4' : '#00A896', color: hasCampaign ? '#065f46' : '#fff', border: hasCampaign ? '1px solid #bbf7d0' : 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          <Settings style={{ width: 13, height: 13 }} />
          {hasCampaign ? 'Regerar campanha' : 'Configurar campanha'}
        </button>
      </div>

      {/* Phase banner */}
      {phase === 'pre_campaign' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16 }}>ℹ</span>
          <p style={{ fontSize: 13, color: '#1e40af', margin: 0 }}>
            <strong>Fase pré-campanha</strong> — visualizando histórico da escola. A campanha {new Date().getFullYear() + 1} será configurada pelo seu administrador.
          </p>
        </div>
      )}
      {phase === 'campaign_active' && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16 }}>✓</span>
          <p style={{ fontSize: 13, color: '#166534', margin: 0 }}>
            <strong>Campanha ativa</strong> — ano letivo {activeCycle?.year}. Início: {fmtMonth(activeCycle?.campaign_start_month)}/{new Date().getFullYear()}
          </p>
        </div>
      )}

      {/* No setup state */}
      {phase === 'no_setup' && (
        <div style={{ textAlign: 'center', padding: '64px 0' }}>
          <BarChart3 style={{ width: 56, height: 56, margin: '0 auto 16px', color: '#cbd5e1' }} />
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Configure sua escola primeiro</h2>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>Importe o histórico do ERP para liberar os relatórios.</p>
          <button
            onClick={() => setShowCampaignModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 10, background: '#00A896', color: 'white', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <Settings style={{ width: 16, height: 16 }} />
            Configurar escola
          </button>
        </div>
      )}

      {/* Tabs */}
      {phase !== 'no_setup' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #e2e8f0' }}>
            {tabs.map(tab => {
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
                  }}>
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
                {/* Pre-campaign tabs */}
                {activeTab === 'historico' && phase === 'pre_campaign' && (
                  <TabHistorico setupCycle={setupCycle ?? null} institutionId={institutionId} />
                )}
                {activeTab === 'comparativo' && phase === 'pre_campaign' && (
                  <TabComparativoPre
                    setupCycle={setupCycle ?? null}
                    institutionId={institutionId}
                    marketData={marketData}
                    loadingMarket={loadingMarket}
                    onFetchMarket={fetchMarket}
                  />
                )}
                {activeTab === 'mercado' && phase === 'pre_campaign' && (
                  <TabMercado
                    marketData={marketData}
                    loadingMarket={loadingMarket}
                    onFetchMarket={fetchMarket}
                    setupCycle={setupCycle ?? null}
                  />
                )}

                {/* Active campaign tabs */}
                {activeTab === 'visao_geral' && phase === 'campaign_active' && (
                  <TabVisaoGeral
                    funnelData={funnelData}
                    reEnrollData={reEnrollData}
                    activeCycle={activeCycle ?? null}
                    institutionId={institutionId}
                    leads={leads}
                    onEditCampaign={() => { setModalPreload({ openAtStep: 5 }); setShowCampaignModal(true) }}
                  />
                )}
                {activeTab === 'funil' && phase === 'campaign_active' && (
                  <TabFunil
                    funnelData={funnelData}
                    activeCycle={activeCycle ?? null}
                    institutionId={institutionId}
                  />
                )}
                {activeTab === 'marketing' && phase === 'campaign_active' && (
                  <TabMarketingROI
                    marketingData={marketingData}
                    institutionId={institutionId}
                    onRefresh={loadAll}
                    showToast={showToast}
                  />
                )}
                {activeTab === 'retencao' && phase === 'campaign_active' && (
                  <TabRetencao
                    reEnrollData={reEnrollData}
                    transfers={transfers}
                    activeCycle={activeCycle ?? null}
                    institutionId={institutionId}
                    surveyResponses={surveyResponses}
                  />
                )}
                {activeTab === 'inteligencia' && phase === 'campaign_active' && (
                  <TabInteligencia
                    funnelData={funnelData}
                    marketingData={marketingData}
                    reEnrollData={reEnrollData}
                    activeCycle={activeCycle ?? null}
                    institutionId={institutionId}
                    showToast={showToast}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} />}

      <CampaignGeneratorModal
        isOpen={showCampaignModal}
        onClose={() => { setShowCampaignModal(false); setModalPreload(null) }}
        onApply={() => { loadAll(); showToast('Campanha aplicada com sucesso!') }}
        existingCycle={cycleForModal as Parameters<typeof CampaignGeneratorModal>[0]['existingCycle']}
        institutionId={institutionId}
        institutionName={user?.institution_name || 'Escola'}
        openAtStep={modalPreload?.openAtStep}
      />
    </div>
  )
}
