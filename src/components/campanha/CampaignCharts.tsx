// Gráficos animados da Campanha: compensação da meta mês a mês e acumulado contra os anos anteriores.
import { useEffect, useState } from 'react'
import { BRAND } from '../../lib/brand'
import { monthName, type HistYear, type PlanMonth } from '../../lib/campaignPlan'
import { compensate, cumulative, type Kind } from '../../lib/campaignCompare'

const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const PREV_COLORS = ['#94A3B8', '#A78BFA', '#F59E0B']

export function useMounted(delay = 60) {
  const [on, setOn] = useState(false)
  useEffect(() => { const t = setTimeout(() => setOn(true), delay); return () => clearTimeout(t) }, [delay])
  return on
}

/** Número que sobe até o valor. */
export function CountUp({ value, ms = 700 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{v.toLocaleString('pt-BR')}</>
}

const Legend = ({ items }: { items: { c: string; t: string; dash?: boolean; line?: boolean }[] }) => (
  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748B', marginTop: 6 }}>
    {items.map(i => (
      <span key={i.t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {i.line ? <svg width="22" height="8"><line x1="0" x2="22" y1="4" y2="4" stroke={i.c} strokeWidth="2.5" strokeDasharray={i.dash ? '5 3' : undefined} /></svg>
          : <span style={{ width: 11, height: 11, background: i.c, borderRadius: 3 }} />}{i.t}
      </span>
    ))}
  </div>
)

export function CompensationChart({ months, cur, kind, now }: { months: PlanMonth[]; cur: HistYear | null; kind: Kind; now: string }) {
  const on = useMounted()
  const c = compensate(months, cur, kind, now)
  const W = 860, H = 230, L = 34, B = 30, T = 18
  const max = Math.max(5, ...c.plan, ...c.real.map(x => x ?? 0), ...c.adjusted.map(x => x ?? 0))
  const top = Math.ceil(max / 5) * 5
  const y = (v: number) => H - B - (v / top) * (H - B - T)
  const n = months.length, slot = (W - L - 8) / Math.max(1, n), bw = Math.min(26, slot / 3)
  const cx = (i: number) => L + slot * i + slot / 2
  const adjPts = months.map((_, i) => c.adjusted[i] != null ? `${cx(i)},${y(c.adjusted[i] as number)}` : null).filter(Boolean)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 0.5, 1].map(f => <g key={f}><line x1={L} x2={W - 4} y1={y(top * f)} y2={y(top * f)} stroke="#EEF2F1" /><text x={L - 6} y={y(top * f) + 4} fontSize="11" fill="#94A3B8" textAnchor="end">{Math.round(top * f)}</text></g>)}
        {months.map((m, i) => {
          const p = c.plan[i], r = c.real[i], open = m.m >= now
          const hh = (v: number) => (on ? (v / top) * (H - B - T) : 0)
          return (
            <g key={m.m}>
              <rect x={cx(i) - bw - 2} width={bw} y={H - B - hh(p)} height={hh(p)} rx="3" fill="#CBD5E1" style={{ transition: 'all .7s cubic-bezier(.2,.8,.2,1)' }} />
              {r != null && <rect x={cx(i) + 2} width={bw} y={H - B - hh(r)} height={hh(r)} rx="3" fill={open ? '#F59E0B' : r >= p ? '#05907B' : '#EF4444'} style={{ transition: 'all .9s cubic-bezier(.2,.8,.2,1)' }} />}
              {r != null && <text x={cx(i) + 2 + bw / 2} y={H - B - hh(r) - 4} fontSize="11" fontWeight="700" fill="#1A2B4A" textAnchor="middle" opacity={on ? 1 : 0}>{r}</text>}
              <text x={cx(i)} y={H - 10} fontSize="12" fontWeight="700" fill="#1A2B4A" textAnchor="middle">{monthName(m.m + '-01')}</text>
            </g>
          )
        })}
        {adjPts.length > 0 && <polyline points={adjPts.join(' ')} fill="none" stroke="#B45309" strokeWidth="2.5" strokeDasharray="6 4" opacity={on ? 1 : 0} style={{ transition: 'opacity 1s .5s' }} />}
        {months.map((m, i) => c.adjusted[i] != null && <g key={'a' + m.m} opacity={on ? 1 : 0} style={{ transition: 'opacity 1s .6s' }}><circle cx={cx(i)} cy={y(c.adjusted[i] as number)} r="4" fill="#B45309" /><text x={cx(i)} y={y(c.adjusted[i] as number) - 8} fontSize="11" fontWeight="800" fill="#B45309" textAnchor="middle">{c.adjusted[i]}</text></g>)}
      </svg>
      <Legend items={[{ c: '#CBD5E1', t: 'Meta do plano' }, { c: '#05907B', t: 'Realizado (bateu)' }, { c: '#EF4444', t: 'Realizado (abaixo)' }, { c: '#F59E0B', t: 'Mês em andamento' }, { c: '#B45309', t: 'Meta ajustada (compensação)', line: true, dash: true }]} />
    </div>
  )
}

export function CumulativeChart({ months, cur, years, targetYear, kind, now }: { months: PlanMonth[]; cur: HistYear | null; years: HistYear[]; targetYear: number; kind: Kind; now: string }) {
  const on = useMounted()
  const c = cumulative(months, cur, years, targetYear, kind, now)
  const W = 860, H = 230, L = 34, B = 30, T = 14
  const max = Math.max(5, ...c.plan, ...c.real.map(x => x ?? 0), ...c.prev.flatMap(p => p.series))
  const top = Math.ceil(max / 10) * 10
  const n = months.length, slot = (W - L - 12) / Math.max(1, n - 1 || 1)
  const x = (i: number) => L + 10 + slot * i
  const y = (v: number) => H - B - (v / top) * (H - B - T)
  const pts = (a: (number | null)[]) => a.map((v, i) => v == null ? null : `${x(i)},${y(v)}`).filter(Boolean).join(' ')
  const lineStyle = { strokeDasharray: 2000, strokeDashoffset: on ? 0 : 2000, transition: 'stroke-dashoffset 1.6s ease' } as React.CSSProperties
  const lastReal = c.real.reduce<number>((a, v, i) => v != null ? i : a, -1)
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {[0, 0.5, 1].map(f => <g key={f}><line x1={L} x2={W - 4} y1={y(top * f)} y2={y(top * f)} stroke="#EEF2F1" /><text x={L - 6} y={y(top * f) + 4} fontSize="11" fill="#94A3B8" textAnchor="end">{Math.round(top * f)}</text></g>)}
        {months.map((m, i) => <text key={m.m} x={x(i)} y={H - 10} fontSize="12" fontWeight="700" fill="#1A2B4A" textAnchor="middle">{monthName(m.m + '-01')}</text>)}
        {c.prev.map((p, k) => <polyline key={p.year} points={pts(p.series)} fill="none" stroke={PREV_COLORS[k % 3]} strokeWidth="2" strokeDasharray="3 4" opacity={on ? 0.9 : 0} style={{ transition: 'opacity 1s' }} />)}
        <polyline points={pts(c.plan)} fill="none" stroke="#64748B" strokeWidth="2.5" style={lineStyle} />
        <polyline points={pts(c.real)} fill="none" stroke="#05907B" strokeWidth="3.5" strokeLinecap="round" style={lineStyle} />
        {lastReal >= 0 && <g opacity={on ? 1 : 0} style={{ transition: 'opacity .5s 1.4s' }}><circle cx={x(lastReal)} cy={y(c.real[lastReal] as number)} r="5.5" fill="#05907B" /><text x={x(lastReal) + 8} y={y(c.real[lastReal] as number) + 4} fontSize="12" fontWeight="800" fill="#00695F">{c.real[lastReal]}</text></g>}
      </svg>
      <Legend items={[{ c: '#05907B', t: `Realizado ${targetYear}`, line: true }, { c: '#64748B', t: 'Plano', line: true }, ...c.prev.map((p, k) => ({ c: PREV_COLORS[k % 3], t: `Campanha ${p.year}`, line: true, dash: true }))]} />
    </div>
  )
}

/** Bloco pronto: resumo + compensação + acumulado + tabela. Usado na Visão geral, Novatos e Rematrícula. */
export default function MetaCharts({ kind, months, cur, years, targetYear, label }: { kind: Kind; months: PlanMonth[]; cur: HistYear | null; years: HistYear[]; targetYear: number; label: string }) {
  const now = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
  if (!months.length) return null
  const c = compensate(months, cur, kind, now)
  const total = c.plan.reduce((a, b) => a + b, 0)
  const feito = c.real.reduce<number>((a, v) => a + (v ?? 0), 0)
  const esperado = months.reduce((s, m, i) => s + (m.m < now ? c.plan[i] : 0), 0)
  const fechadoReal = months.reduce((s, m, i) => s + (m.m < now ? (c.real[i] ?? 0) : 0), 0)
  const restantes = months.filter(m => m.m >= now).length
  const falta = Math.max(0, total - feito)
  const ritmo = restantes ? Math.ceil(falta / restantes) : 0
  const ritmoPlano = restantes ? Math.ceil(months.filter(m => m.m >= now).reduce((s, m) => s + m[kind], 0) / restantes) : 0
  const atraso = fechadoReal - esperado
  const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'right', fontWeight: 700 }
  const td: React.CSSProperties = { padding: '8px', textAlign: 'right', fontSize: 13, borderTop: '1px solid #EEF2F1' }
  const kpi = (big: React.ReactNode, color: string, t: string) => (
    <div style={{ flex: '1 1 190px' }}><div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{big}</div><div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{t}</div></div>
  )
  return (
    <>
      <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {kpi(<><CountUp value={feito} /> <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>de {total}</span></>, '#05907B', `${label} · ${total ? Math.round(feito / total * 100) : 0}% da meta`)}
        {kpi(`${atraso >= 0 ? '+' : ''}${atraso}`, atraso >= 0 ? '#15803D' : '#B91C1C', `${atraso >= 0 ? 'Adiantado' : 'Atrasado'} frente ao plano nos meses já fechados (esperado ${esperado})`)}
        {kpi(restantes ? `${ritmo} por mês` : '—', ritmo > ritmoPlano ? '#B45309' : '#15803D', restantes ? `Ritmo para fechar a meta nos ${restantes} mês(es) que faltam (plano: ${ritmoPlano})` : 'Campanha sem meses restantes')}
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Compensação da meta, mês a mês</div>
        <div style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 8px' }}>O que faltou num mês soma na meta do mês seguinte; o que sobrou diminui. A linha tracejada é a meta do mês já com isso.</div>
        <CompensationChart months={months} cur={cur} kind={kind} now={now} />
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Acumulado: plano × realizado × anos anteriores</div>
        <div style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 8px' }}>{years.some(y => y.monthly.some(m => m[kind] > 0)) ? 'As linhas pontilhadas mostram onde a escola estava, nesta mesma época, nas campanhas passadas.' : 'Ainda não há campanhas anteriores com matrículas por mês para comparar.'}</div>
        <CumulativeChart months={months} cur={cur} years={years} targetYear={targetYear} kind={kind} now={now} />
      </div>
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Mês a mês: a meta vai acumulando</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Plano</th><th style={th}>Veio do mês anterior</th><th style={th}>Meta do mês</th><th style={th}>Realizado</th><th style={th}>Saldo p/ próximo</th>{years.filter(y => y.monthly.some(m => m[kind] > 0)).map(y => <th key={y.year} style={th}>{y.year}</th>)}</tr></thead>
            <tbody>
              {months.map((m, i) => {
                const r = c.real[i], d = r != null ? r - c.effective[i] : null, ci = c.carryIn[i]
                return (
                  <tr key={m.m} style={{ background: m.m === now ? '#FFFBEB' : undefined }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(m.m + '-01')}/{m.m.slice(0, 4)}{m.m === now ? <span style={{ color: '#94A3B8', fontWeight: 500 }}> · em curso</span> : ''}</td>
                    <td style={td}>{c.plan[i]}</td>
                    <td style={{ ...td, color: ci === 0 ? '#94A3B8' : ci > 0 ? '#B45309' : '#15803D', fontWeight: 700 }}>{ci === 0 ? '—' : `${ci > 0 ? '+' : ''}${ci}`}</td>
                    <td style={{ ...td, fontWeight: 800, color: '#0F172A' }}>{c.effective[i]}</td><td style={{ ...td, fontWeight: 700 }}>{r ?? '—'}</td>
                    <td style={{ ...td, color: d == null ? '#94A3B8' : d >= 0 ? '#15803D' : '#B91C1C', fontWeight: 700 }}>{d == null ? '—' : d === 0 ? 'bateu' : d > 0 ? `sobrou ${d}` : `faltou ${-d}`}</td>
                    {years.filter(y => y.monthly.some(mm => mm[kind] > 0)).map(y => {
                      const shift = targetYear - y.year
                      return <td key={y.year} style={{ ...td, color: '#64748B' }}>{y.monthly.find(x => `${Number(x.m.slice(0, 4)) + shift}-${x.m.slice(5, 7)}` === m.m)?.[kind] ?? 0}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
