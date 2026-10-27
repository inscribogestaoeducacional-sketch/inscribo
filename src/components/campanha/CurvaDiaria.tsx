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

      {!noData && <MapaDias data={data} year={year} kind={kind} axis={axis} />}

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

const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const SCALE = ['#EAF4F1', '#BFE6D8', '#7FD0B5', '#2DB38E', '#05806B']

/** Mapa de calor do calendário: um quadrado por dia, mais escuro quanto mais matrículas naquele dia. */
function MapaDias({ data, year, kind, axis }: { data: Data; year: number; kind: Kind; axis: Date[] }) {
  const [sel, setSel] = useState<string | null>(null)
  const serie = data.anos.find(a => a.year === year)
  const daily = useMemo(() => {
    const m = new Map<string, { t: number; r: number; n: number }>()
    if (!serie) return m
    const diff = (arr: number[] | null, i: number) => (arr ? arr[i] - (i > 0 ? arr[i - 1] : 0) : 0)
    serie.total.forEach((_, i) => m.set(addDays(serie.start, i).toISOString().slice(0, 10), { t: diff(serie.total, i), r: diff(serie.rem, i), n: diff(serie.nov, i) }))
    return m
  }, [serie])
  if (!serie) return null
  const val = (iso: string) => { const d = daily.get(iso); return d ? (kind === 'total' ? d.t : kind === 'rem' ? d.r : d.n) : null }
  const todayIso = data.hoje
  const days = axis.map(dt => dt.toISOString().slice(0, 10))
  const past = days.filter(d => d <= todayIso && val(d) != null)
  const max = Math.max(1, ...past.map(d => val(d) ?? 0))
  const total = past.reduce((a, d) => a + (val(d) ?? 0), 0)
  const best = past.reduce<string | null>((b, d) => (b == null || (val(d) ?? 0) > (val(b) ?? 0) ? d : b), null)
  const uteis = past.filter(d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5 })
  const media = uteis.length ? (uteis.reduce((a, d) => a + (val(d) ?? 0), 0) / uteis.length) : 0
  const hoje = val(todayIso) ?? 0
  const shade = (v: number) => (v <= 0 ? '#F1F5F4' : SCALE[Math.min(4, Math.max(1, Math.ceil(v / max * 4)))])
  const months = new Map<string, string[]>()
  days.forEach(d => { const k = d.slice(0, 7); months.set(k, [...(months.get(k) ?? []), d]) })
  const selD = sel ? daily.get(sel) : null
  const fmtL = (iso: string) => { const dt = new Date(iso + 'T12:00:00Z'); return `${WD[dt.getUTCDay()]}, ${dt.getUTCDate()} de ${MES[dt.getUTCMonth()]}` }
  const kpi = (n: string | number, l: string) => (
    <div style={{ flex: '1 1 40%', background: BRAND.softer, borderRadius: 12, padding: '9px 11px' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.ink, lineHeight: 1.1 }}>{n}</div><div style={{ fontSize: 11, color: BRAND.muted, marginTop: 2, lineHeight: 1.25 }}>{l}</div>
    </div>
  )
  return (
    <div style={cardS}>
      <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Mapa do dia a dia</div>
      <div style={{ fontSize: 12, color: BRAND.muted, margin: '2px 0 10px', lineHeight: 1.45 }}>Quantas matrículas aconteceram em cada dia. Quanto mais escuro, mais matrículas. Toque num dia para ver os detalhes.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {kpi(hoje, 'matrículas hoje')}{kpi(best ? val(best) ?? 0 : '—', best ? `melhor dia (${fmtL(best).split(', ')[1]})` : 'melhor dia')}{kpi(media.toFixed(1).replace('.', ','), 'média por dia útil')}{kpi(total, 'no total')}
      </div>
      <div style={{ minHeight: 38, fontSize: 13, fontWeight: 700, color: BRAND.ink, background: '#F8FBFA', borderRadius: 10, padding: '8px 10px', marginBottom: 12, display: 'flex', alignItems: 'center' }}>
        {sel && selD ? <span>{fmtL(sel)}: <b style={{ color: BRAND.primary }}>{kind === 'total' ? selD.t : kind === 'rem' ? selD.r : selD.n} matrícula{(kind === 'total' ? selD.t : kind === 'rem' ? selD.r : selD.n) === 1 ? '' : 's'}</b>{kind === 'total' && serie.has_split ? <span style={{ fontWeight: 600, color: BRAND.muted }}> ({selD.n} {selD.n === 1 ? 'novato' : 'novatos'}, {selD.r} {selD.r === 1 ? 'rematrícula' : 'rematrículas'})</span> : null}</span> : <span style={{ fontWeight: 600, color: BRAND.muted }}>Toque ou passe o mouse em um dia.</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 14 }}>
        {[...months.entries()].map(([k, ds]) => {
          const first = new Date(ds[0] + 'T12:00:00Z').getUTCDay()
          return (
            <div key={k}>
              <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.ink, marginBottom: 5, textTransform: 'capitalize' }}>{MES[Number(k.slice(5)) - 1]}/{k.slice(2, 4)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                {Array.from({ length: first }).map((_, i) => <span key={'e' + i} />)}
                {ds.map(d => {
                  const v = val(d), fut = d > todayIso || v == null, sun = new Date(d + 'T12:00:00Z').getUTCDay() === 0
                  return (
                    <button key={d} type="button" aria-label={`${fmtL(d)}: ${v ?? 0}`} onClick={() => setSel(d)} onPointerEnter={e => { if (e.pointerType === 'mouse') setSel(d) }}
                      style={{ aspectRatio: '1', borderRadius: 5, padding: 0, cursor: fut ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 9.5, fontWeight: 700,
                        border: sel === d ? `2px solid ${BRAND.ink}` : d === todayIso ? `2px solid ${BRAND.primary}` : 'none',
                        background: fut ? '#fff' : shade(v ?? 0), outline: fut ? '1px dashed #E3E8F0' : 'none', outlineOffset: -1, opacity: sun && !fut ? .55 : 1,
                        color: !fut && (v ?? 0) / max > .5 ? '#fff' : '#64748B' }}>
                      {fut ? '' : (v ?? 0) > 0 ? v : ''}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 11, color: BRAND.muted }}>
        <span>menos</span>{['#F1F5F4', ...SCALE.slice(1)].map(c => <span key={c} style={{ width: 14, height: 14, borderRadius: 4, background: c }} />)}<span>mais</span>
        <span style={{ marginLeft: 'auto' }}>domingos esmaecidos</span>
      </div>
    </div>
  )
}
