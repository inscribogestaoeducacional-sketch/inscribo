// "Dia a dia": curva acumulada de matrículas do ano da campanha contra os anos anteriores, no mesmo dia do calendário
// (1º de setembro a 31 de março). Passe o mouse (ou toque) no gráfico para ver cada ano naquele dia e a diferença.
// Usa a data de matrícula que o sistema da escola informa; anos sem essa data simplesmente não aparecem.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'

type Serie = { year: number; start: string; has_split: boolean; total: number[]; rem: number[] | null; nov: number[] | null; final: number }
type Data = { year: number; hoje: string; anos: Serie[] }
type Kind = 'total' | 'rem' | 'nov'
const KINDS: [Kind, string][] = [['total', 'Todas'], ['rem', 'Rematrículas'], ['nov', 'Novatos']]
const OLD = ['#6366F1', '#F59E0B', '#EC4899', '#0EA5E9']
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pad = (n: number) => String(n).padStart(2, '0')
const addDays = (iso: string, n: number) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)) }
const mmdd = (dt: Date) => `${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
const fmt = (dt: Date) => `${dt.getUTCDate()} de ${MES[dt.getUTCMonth()]}`
const sign = (n: number) => (n > 0 ? '+' : '') + n

export default function CurvaDiaria({ institutionId, year, mobile }: { institutionId: string; year: number; mobile: boolean }) {
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [kind, setKind] = useState<Kind>('total')
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)

  useEffect(() => {
    let alive = true
    setData(null); setErr('')
    supabase.rpc('campaign_curva_diaria', { p_inst: institutionId, p_year: year, p_anos: 4 }).then(({ data: d, error }) => {
      if (!alive) return
      if (error) setErr(error.message); else setData(d as Data)
    })
    return () => { alive = false }
  }, [institutionId, year])
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(() => box.current && setW(box.current.clientWidth))
    ro.observe(box.current); setW(box.current.clientWidth)
    return () => ro.disconnect()
  }, [data])

  // cada ano vira um mapa "MM-DD" → acumulado; o eixo é o calendário de 1/set a 31/mar (1/set do ano anterior ao da campanha)
  const prep = useMemo(() => {
    if (!data) return null
    const axis: Date[] = []
    for (let i = 0; i < 213; i++) { const dt = addDays(`${year - 1}-09-01`, i); if (dt <= new Date(Date.UTC(year, 2, 31))) axis.push(dt) }
    const maps = data.anos.map(a => {
      const arr = a[kind]; const m = new Map<string, number>()
      if (arr) arr.forEach((v, i) => m.set(mmdd(addDays(a.start, i)), v))
      return { year: a.year, map: m, has: !!arr, final: a.final }
    })
    const cur = maps.find(m => m.year === year)
    const todayIdx = cur ? axis.reduce((last, dt, i) => (cur.map.has(mmdd(dt)) ? i : last), 0) : 0
    return { axis, maps, todayIdx }
  }, [data, kind, year])

  if (err) return <div style={{ ...cardS, color: '#B91C1C', fontSize: 13 }}>{err}</div>
  if (!data || !prep) return <div style={{ ...cardS, display: 'flex', justifyContent: 'center', padding: 28 }}><Loader2 size={20} className="animate-spin" color={BRAND.primary} /></div>

  const { axis, maps, todayIdx } = prep
  const shown = maps.filter(m => m.has)
  const olds = shown.filter(m => m.year !== year).sort((a, b) => b.year - a.year)
  const colorOf = (y: number) => (y === year ? BRAND.primary : OLD[(year - 1 - y) % OLD.length])
  const H = mobile ? 230 : 300, PL = 38, PR = 10, PT = 10, PB = 24
  const maxV = Math.max(10, ...shown.map(m => Math.max(...axis.map(dt => m.map.get(mmdd(dt)) ?? 0))))
  const top = Math.ceil(maxV / 100) * 100 || 100
  const X = (i: number) => PL + (i / (axis.length - 1)) * (w - PL - PR)
  const Y = (v: number) => PT + (1 - v / top) * (H - PT - PB)
  const path = (m: { map: Map<string, number> }) => {
    let s = ''
    axis.forEach((dt, i) => { const v = m.map.get(mmdd(dt)); if (v == null) return; s += `${s ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}` })
    return s
  }
  const ticks = axis.map((dt, i) => ({ dt, i })).filter(t => t.dt.getUTCDate() === 1)
  const at = hover ?? todayIdx
  const dtAt = axis[Math.min(at, axis.length - 1)]
  const valAt = (m: { map: Map<string, number> }) => m.map.get(mmdd(dtAt))
  const curV = maps.find(m => m.year === year) ? valAt(maps.find(m => m.year === year)!) : undefined
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - PL) / (w - PL - PR)) * (axis.length - 1))
    setHover(Math.max(0, Math.min(axis.length - 1, i)))
  }
  const noData = shown.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 16 }}>
      <div style={cardS}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Matrículas dia a dia</div>
        <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>
          Quantos alunos já estavam matriculados em cada dia, de setembro a março, comparando {year} com os anos anteriores. Passe o mouse (ou toque) no gráfico.
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          {KINDS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setKind(k)} style={{ padding: '7px 13px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
              border: kind === k ? 'none' : `1px solid ${BRAND.line}`, background: kind === k ? 'var(--aion-grad)' : '#fff', color: kind === k ? '#fff' : BRAND.muted }}>{l}</button>
          ))}
        </div>
        {kind !== 'total' && maps.some(m => !m.has) && <div style={{ fontSize: 11.5, color: BRAND.muted, marginTop: 8 }}>Anos sem o ano anterior na base não separam rematrícula de novato e ficam de fora desta visão.</div>}
      </div>

      {noData ? (
        <div style={{ ...cardS, fontSize: 13, color: BRAND.muted }}>Ainda não há matrículas com data para montar o gráfico.</div>
      ) : (
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>{fmt(dtAt)}{hover == null ? ' (hoje)' : ''}</div>
            {hover != null && <button type="button" onClick={() => setHover(null)} style={{ border: 'none', background: 'none', color: BRAND.primary, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>voltar para hoje</button>}
          </div>
          <div ref={box} style={{ width: '100%', touchAction: 'pan-y' }}>
            <svg width={w} height={H} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null) }} style={{ display: 'block', overflow: 'visible' }}>
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <g key={f}><line x1={PL} x2={w - PR} y1={Y(top * f)} y2={Y(top * f)} stroke="#EEF2F6" /><text x={PL - 6} y={Y(top * f) + 4} textAnchor="end" fontSize="10.5" fill={BRAND.muted}>{Math.round(top * f)}</text></g>
              ))}
              {ticks.map(t => <text key={t.i} x={X(t.i)} y={H - 6} textAnchor="middle" fontSize="10.5" fill={BRAND.muted}>{MES[t.dt.getUTCMonth()]}</text>)}
              {olds.map(m => <path key={m.year} d={path(m)} fill="none" stroke={colorOf(m.year)} strokeWidth={2} strokeLinejoin="round" opacity={0.85} />)}
              {maps.filter(m => m.year === year && m.has).map(m => <path key={m.year} d={path(m)} fill="none" stroke={colorOf(year)} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />)}
              <line x1={X(at)} x2={X(at)} y1={PT} y2={H - PB} stroke="#1A2B4A" strokeOpacity=".35" strokeDasharray="3 3" />
              {shown.map(m => { const v = valAt(m); return v == null ? null : <circle key={m.year} cx={X(at)} cy={Y(v)} r={m.year === year ? 5 : 3.5} fill={colorOf(m.year)} stroke="#fff" strokeWidth={1.5} /> })}
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
            {[...shown].sort((a, b) => (a.year === year ? -1 : b.year === year ? 1 : b.year - a.year)).map(m => {
              const v = valAt(m); const isCur = m.year === year
              const diff = !isCur && v != null && curV != null ? curV - v : null
              return (
                <div key={m.year} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 12, background: isCur ? '#ECFDF5' : BRAND.softer }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: colorOf(m.year), flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{m.year}{isCur ? ' (este ano)' : ''}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, minWidth: 40, textAlign: 'right' }}>{v ?? '—'}</span>
                  {diff != null && (
                    <span title={`${year} está ${diff >= 0 ? 'à frente' : 'atrás'} de ${m.year} neste dia`} style={{ minWidth: 74, textAlign: 'center', fontSize: 11.5, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: diff < 0 ? '#FEE2E2' : '#DCFCE7', color: diff < 0 ? '#B91C1C' : '#15803D' }}>{sign(diff)} vs {m.year}</span>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 11.5, color: BRAND.muted, marginTop: 10, lineHeight: 1.45 }}>
            Conta cada aluno uma vez, na data da primeira matrícula dele no ano. Total final de cada ano: {olds.map(m => `${m.year}: ${m.final}`).join(' · ') || '—'}.
          </div>
        </div>
      )}
    </div>
  )
}
const cardS: React.CSSProperties = { background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, padding: 16, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }
