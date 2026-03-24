import React, { useState, useEffect } from 'react'
import {
  LineChart, Line, ComposedChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface FunnelMetricRow {
  id: string
  period: string
  new_students_target?: number
  returning_students_target?: number
  new_students_actual?: number
  returning_students_actual?: number
  registrations?: number
  enrollments?: number
}

interface MonthlyChartProps {
  institutionId: string
  cycleId?: string
  editable?: boolean
}

const YEAR_COLORS: Record<string, string> = {
  '2023': '#9FE1CB',
  '2024': '#1D9E75',
  '2025': '#0F6E56',
  '2026': '#085041',
}
function yearColor(y: string, idx: number) {
  return YEAR_COLORS[y] ?? ['#9FE1CB','#1D9E75','#0F6E56','#085041','#475569'][idx % 5]
}

const CAMPAIGN_MONTHS = ['09','10','11','12','01','02']
const MONTH_LABELS: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr','05':'Mai','06':'Jun',
  '07':'Jul','08':'Ago','09':'Set','10':'Out','11':'Nov','12':'Dez'
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n)
}

function SkeletonBar() {
  return (
    <div style={{ height: 260, background: '#f1f5f9', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
  )
}

export default function MonthlyChart({ institutionId, editable = false }: MonthlyChartProps) {
  const [metrics, setMetrics] = useState<FunnelMetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingEdits, setPendingEdits] = useState<Record<string, Partial<FunnelMetricRow>>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    load()
  }, [institutionId]) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('funnel_metrics')
        .select('id, period, new_students_target, returning_students_target, new_students_actual, returning_students_actual, registrations, enrollments')
        .eq('institution_id', institutionId)
        .order('period', { ascending: true })
      setMetrics(data ?? [])
    } catch (e) {
      console.error('MonthlyChart load error:', e)
    } finally {
      setLoading(false)
    }
  }

  // Group by year → month
  const byYear: Record<string, Record<string, { new_students: number; returning_students: number }>> = {}
  for (const f of metrics) {
    const year = f.period?.substring(0, 4)
    const month = f.period?.substring(5, 7)
    if (!year || !month) continue
    if (!byYear[year]) byYear[year] = {}
    byYear[year][month] = {
      new_students: f.new_students_actual ?? f.enrollments ?? 0,
      returning_students: f.returning_students_actual ?? 0,
    }
  }
  const years = Object.keys(byYear).sort()

  // Line chart data — one row per campaign month
  const lineData = CAMPAIGN_MONTHS.map(m => {
    const row: Record<string, string | number> = { month: MONTH_LABELS[m] ?? m }
    for (const y of years) {
      row[`${y}_new`] = byYear[y]?.[m]?.new_students ?? 0
      row[`${y}_ret`] = byYear[y]?.[m]?.returning_students ?? 0
    }
    return row
  })

  // ComposedChart — metas vs real
  const monthlyData = CAMPAIGN_MONTHS.map(m => {
    // find the most recent year that has this month
    let found: FunnelMetricRow | undefined
    for (const y of [...years].reverse()) {
      const p = `${y}-${m}`
      found = metrics.find(x => x.period === p || x.period?.startsWith(p))
      if (found) break
    }
    const newTarget = found?.new_students_target ?? 0
    const retTarget = found?.returning_students_target ?? 0
    return {
      month: MONTH_LABELS[m] ?? m,
      period: found?.period,
      new_students_actual: found?.new_students_actual ?? found?.enrollments ?? 0,
      returning_students_actual: found?.returning_students_actual ?? 0,
      total_target: newTarget + retTarget,
      new_students_target: newTarget,
      returning_students_target: retTarget,
    }
  })

  const hasData = metrics.length > 0

  const handleMetaChange = (period: string, field: string, value: number) => {
    setMetrics(prev => prev.map(m =>
      m.period === period ? { ...m, [field]: value } : m
    ))
    setPendingEdits(prev => ({
      ...prev,
      [period]: { ...prev[period], [field]: value }
    }))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const [period, fields] of Object.entries(pendingEdits)) {
        await supabase
          .from('funnel_metrics')
          .update(fields)
          .eq('institution_id', institutionId)
          .eq('period', period)
      }
      setPendingEdits({})
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      console.error('saveAll error:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
        <SkeletonBar />
        <SkeletonBar />
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
        <BarChart3 style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Sem dados mensais ainda</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>Registre dados de funil mensais para ver o gráfico histórico.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>

      {/* Gráfico 1 — Comparativo anual mês a mês */}
      {years.length >= 2 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 4px' }}>Comparativo mês a mês — histórico por ano</h3>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 16px' }}>Tracejado = novatos · Sólido = veteranos</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                formatter={(val, name) => {
                  const s = String(name)
                  const label = s.endsWith('_new') ? `Novatos ${s.slice(0,4)}` : `Veteranos ${s.slice(0,4)}`
                  return [fmt(Number(val)), label]
                }} />
              <Legend wrapperStyle={{ fontSize: 11 }}
                formatter={name => {
                  const s = String(name)
                  return s.endsWith('_new') ? `Novatos ${s.slice(0,4)}` : `Veteranos ${s.slice(0,4)}`
                }} />
              {years.map((y, i) => (
                <React.Fragment key={y}>
                  <Line type="monotone" dataKey={`${y}_new`} stroke={yearColor(y, i)} strokeWidth={i === years.length - 1 ? 2.5 : 1.5} strokeDasharray="5 3" dot={{ r: 2 }} />
                  <Line type="monotone" dataKey={`${y}_ret`} stroke={yearColor(y, i)} strokeWidth={i === years.length - 1 ? 2.5 : 1.5} dot={{ r: 2 }} />
                </React.Fragment>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráfico 2 — Metas vs Real */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: '0 0 16px' }}>Metas vs Real — campanha atual</h3>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthlyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={36} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(val, name) => {
                const labels: Record<string, string> = {
                  new_students_actual: 'Novatos',
                  returning_students_actual: 'Veteranos',
                  total_target: 'Meta'
                }
                return [fmt(Number(val)), labels[String(name)] ?? String(name)]
              }} />
            <Legend wrapperStyle={{ fontSize: 12 }}
              formatter={name => ({ new_students_actual: 'Novatos', returning_students_actual: 'Veteranos', total_target: 'Meta' }[String(name)] ?? String(name))} />
            <Bar dataKey="new_students_actual" stackId="a" fill="#1D9E75" name="new_students_actual" radius={[0, 0, 0, 0]} />
            <Bar dataKey="returning_students_actual" stackId="a" fill="#0F6E56" name="returning_students_actual" radius={[4, 4, 0, 0]} />
            <Line dataKey="total_target" stroke="#BA7517" strokeWidth={2} strokeDasharray="4 3" name="total_target" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela de metas editáveis */}
      {editable && (
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Metas mensais editáveis</h3>
            <button
              onClick={saveAll}
              disabled={saving || Object.keys(pendingEdits).length === 0}
              style={{
                padding: '7px 16px', borderRadius: 8, background: saved ? '#16a34a' : '#0d9488',
                color: 'white', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: (saving || Object.keys(pendingEdits).length === 0) ? 0.5 : 1
              }}>
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar todas as metas'}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Mês', 'Meta Novatos', 'Meta Veteranos', 'Meta Total', 'Real Novatos', 'Real Veteranos', 'Desvio'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => {
                  const newT = m.new_students_target ?? 0
                  const retT = m.returning_students_target ?? 0
                  const newA = m.new_students_actual ?? m.enrollments ?? 0
                  const retA = m.returning_students_actual ?? 0
                  const totalTarget = newT + retT
                  const totalActual = newA + retA
                  const desvio = totalTarget > 0 ? totalActual - totalTarget : null
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151' }}>{m.period}</td>
                      <td style={{ padding: '6px 14px' }}>
                        <input
                          type="number"
                          value={newT}
                          onChange={e => handleMetaChange(m.period, 'new_students_target', parseInt(e.target.value) || 0)}
                          style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: '6px 14px' }}>
                        <input
                          type="number"
                          value={retT}
                          onChange={e => handleMetaChange(m.period, 'returning_students_target', parseInt(e.target.value) || 0)}
                          style={{ width: 80, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12 }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px', color: '#374151', fontWeight: 600 }}>{fmt(totalTarget)}</td>
                      <td style={{ padding: '10px 14px', color: '#0d9488' }}>{fmt(newA)}</td>
                      <td style={{ padding: '10px 14px', color: '#085041' }}>{fmt(retA)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {desvio !== null ? (
                          <span style={{
                            background: desvio >= 0 ? '#f0fdf4' : '#fef2f2',
                            color: desvio >= 0 ? '#16a34a' : '#dc2626',
                            padding: '2px 8px', borderRadius: 8, fontSize: 12, fontWeight: 700
                          }}>
                            {desvio > 0 ? '+' : ''}{fmt(desvio)}
                          </span>
                        ) : <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {metrics.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>Sem registros de funil mensal ainda.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
