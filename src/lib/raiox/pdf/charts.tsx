import React from 'react'
import { Svg, Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polygon, Polyline, G, Text as SText } from '@react-pdf/renderer'
import { C } from './ui'
import { D } from '../data'

const FJ = 'Jakarta', FB = 'Bricolage'
let uid = 0
const nid = (p: string) => `${p}${uid++}`

// pictograma de 100 pessoas (cada uma = 1%)
export function Pessoas({ pct, w = 104, on = C.TURQ, off = '#D3EBE4' }: { pct: number; w?: number; on?: string; off?: string }) {
  const nOn = Math.round(pct), cw = w / 10, ch = cw * 1.35, k = (cw * 0.76) / 18
  const items = []
  for (let i = 0; i < 100; i++) {
    const r = Math.floor(i / 10), c = i % 10, x = c * cw + cw * 0.12, y = r * ch, col = i < nOn ? on : off
    items.push(
      <G key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${k.toFixed(3)})`}>
        <Circle cx={9} cy={5.5} r={4.6} fill={col} /><Path d="M1 25v-8.5a8 8 0 0 1 16 0V25z" fill={col} />
      </G>)
  }
  return <Svg width={w} height={ch * 10} viewBox={`0 0 ${w} ${ch * 10}`}>{items}</Svg>
}

// anel de percentual
export function Anel({ pct, size = 96, cor = C.TURQ, centro, esp = 12, trilha = '#E3F4EE' }: { pct: number; size?: number; cor?: string; centro?: string; esp?: number; trilha?: string }) {
  const r = (size - esp) / 2, L = 2 * Math.PI * r, v = (L * Math.max(0, Math.min(100, pct))) / 100, m = size / 2
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={m} cy={m} r={r} fill="none" stroke={trilha} strokeWidth={esp} />
      {v > 0.5 && <Circle cx={m} cy={m} r={r} fill="none" stroke={cor} strokeWidth={esp} strokeLinecap="round" strokeDasharray={`${v.toFixed(1)} ${L.toFixed(1)}`} transform={`rotate(-90 ${m} ${m})`} />}
      {centro ? <SText x={m} y={m + size * 0.1} textAnchor="middle" fill={C.TINTA} style={{ fontFamily: FB, fontWeight: 800, fontSize: size * 0.27 } as any}>{centro}</SText> : null}
    </Svg>
  )
}

// rosca (donut) com total no centro
export function Rosca({ segs, size = 190, esp = 34, total, rotulo }: { segs: { v: number; cor: string }[]; size?: number; esp?: number; total: number; rotulo: string }) {
  const tot = segs.reduce((s, x) => s + x.v, 0) || 1, r = (size - esp) / 2, L = 2 * Math.PI * r, m = size / 2
  let off = 0
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segs.map((s, i) => { const l = (L * s.v) / tot, d = Math.max(l - 3, 0); const el = d < 0.5 ? <G key={i} /> : <Circle key={i} cx={m} cy={m} r={r} fill="none" stroke={s.cor} strokeWidth={esp} strokeDasharray={`${d.toFixed(1)} ${(L - d).toFixed(1)}`} transform={`rotate(${(-90 + (360 * off) / L).toFixed(2)} ${m} ${m})`} />; off += l; return el })}
      <SText x={m} y={m + 10} textAnchor="middle" fill={C.TINTA} style={{ fontFamily: FB, fontWeight: 800, fontSize: 38 } as any}>{String(total)}</SText>
      <SText x={m} y={m + 28} textAnchor="middle" fill="#5b7a71" style={{ fontFamily: FJ, fontWeight: 700, fontSize: 12.5 } as any}>{rotulo}</SText>
    </Svg>
  )
}

// medidor semicircular 0–100
export function Medidor({ nota, cor, w = 236, branco }: { nota: number; cor: string; w?: number; branco?: boolean }) {
  const r = 100, L = Math.PI * r, v = (L * nota) / 100, tr = branco ? 'rgba(255,255,255,0.25)' : '#E3F4EE', tx = branco ? '#fff' : C.TINTA, sb = branco ? 'rgba(255,255,255,0.9)' : '#5b7a71'
  const arco = 'M20 130 A100 100 0 0 1 220 130'
  return (
    <Svg width={w} height={w * 0.62} viewBox="0 0 240 150">
      <Path d={arco} fill="none" stroke={tr} strokeWidth={22} strokeLinecap="round" />
      {v > 0.5 && <Path d={arco} fill="none" stroke={cor} strokeWidth={22} strokeLinecap="round" strokeDasharray={`${v.toFixed(1)} ${L.toFixed(1)}`} />}
      <SText x={120} y={112} textAnchor="middle" fill={tx} style={{ fontFamily: FB, fontWeight: 800, fontSize: 66 } as any}>{String(nota)}</SText>
      <SText x={120} y={140} textAnchor="middle" fill={sb} style={{ fontFamily: FJ, fontWeight: 700, fontSize: 14 } as any}>de 100 pontos</SText>
    </Svg>
  )
}

// radar
export function Radar({ eixos, series, lo, hi, size = 250 }: { eixos: string[]; series: { vals: number[]; cor: string; fill: string; op: number; dash?: string; sw: number }[]; lo: number; hi: number; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 52, n = eixos.length, ang = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n
  const P = (i: number, v: number): [number, number] => [cx + (R * (v - lo)) / (hi - lo) * Math.cos(ang(i)), cy + (R * (v - lo)) / (hi - lo) * Math.sin(ang(i))]
  const grade = [0.25, 0.5, 0.75, 1].map(k => {
    const pts = Array.from({ length: n }, (_, i) => `${(cx + R * k * Math.cos(ang(i))).toFixed(1)},${(cy + R * k * Math.sin(ang(i))).toFixed(1)}`).join(' ')
    return <G key={k}><Polygon points={pts} fill="none" stroke="#D3EBE4" strokeWidth={1.2} /><SText x={cx + 4} y={cy - R * k - 3} fill="#8aa59c" style={{ fontFamily: FJ, fontSize: 10 } as any}>{String(Math.round(lo + (hi - lo) * k))}</SText></G>
  })
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {grade}
      {eixos.map((e, i) => {
        const x = cx + R * Math.cos(ang(i)), y = cy + R * Math.sin(ang(i)), lx = cx + (R + 30) * Math.cos(ang(i)), ly = cy + (R + 24) * Math.sin(ang(i))
        return <G key={e}><Line x1={cx} y1={cy} x2={x} y2={y} stroke="#D3EBE4" strokeWidth={1} /><SText x={lx} y={ly + 4} textAnchor="middle" fill="#365a50" style={{ fontFamily: FJ, fontWeight: 700, fontSize: 12.5 } as any}>{e}</SText></G>
      })}
      {series.map((s, k) => <Polygon key={k} points={s.vals.map((v, i) => P(i, v).map(z => z.toFixed(1)).join(',')).join(' ')} fill={s.fill} fillOpacity={s.op} stroke={s.cor} strokeWidth={s.sw} strokeDasharray={s.dash} />)}
      {series[series.length - 1].vals.map((v, i) => { const [x, y] = P(i, v); return <Circle key={i} cx={x} cy={y} r={5} fill={series[series.length - 1].cor} stroke="#fff" strokeWidth={2} /> })}
    </Svg>
  )
}

// ranking em "pirulito"
export interface PItem { rotulo: string; sub?: string; v: number }
export function Pirulito({ itens, lo, hi, w = 646, destaque, fmt = (v: number) => D(v), linha = 34, passo }: { itens: PItem[]; lo: number; hi: number; w?: number; destaque?: string; fmt?: (v: number) => string; linha?: number; passo?: number }) {
  const labW = 230, x0 = labW, x1 = w - 60, X = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0), h = linha * itens.length + 30
  const st = passo ?? (hi - lo > 150 ? 50 : 25), grade = []
  for (let v = lo; v <= hi; v += st) grade.push(<G key={v}><Line x1={X(v)} x2={X(v)} y1={0} y2={h - 22} stroke="#E3F4EE" strokeWidth={1} /><SText x={X(v)} y={h - 6} textAnchor="middle" fill="#8aa59c" style={{ fontFamily: FJ, fontSize: 11 } as any}>{String(v)}</SText></G>)
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {grade}
      {itens.map((it, i) => {
        const y = i * linha + linha / 2, me = it.rotulo === destaque, cor = me ? C.AMBAR : '#7CC9BA'
        return (
          <G key={i}>
            <SText x={0} y={y - 1} fill={C.TINTA} style={{ fontFamily: FJ, fontWeight: me ? 800 : 600, fontSize: 13.5 } as any}>{it.rotulo}</SText>
            {it.sub ? <SText x={0} y={y + 13} fill="#6b8a81" style={{ fontFamily: FJ, fontSize: 10.5 } as any}>{it.sub}</SText> : null}
            <Line x1={x0} x2={X(it.v)} y1={y} y2={y} stroke={cor} strokeWidth={6} strokeLinecap="round" strokeOpacity={0.55} />
            <Circle cx={X(it.v)} cy={y} r={me ? 10 : 8} fill={cor} stroke="#fff" strokeWidth={3} />
            <SText x={X(it.v) + 16} y={y + 5} fill={C.TINTA} style={{ fontFamily: FJ, fontWeight: 800, fontSize: 13.5 } as any}>{fmt(it.v)}</SText>
          </G>
        )
      })}
    </Svg>
  )
}

// gradiente linear reutilizável em barras
export function GradBar({ w, h, de, ate, radius = 6, dir = 'h' }: { w: number; h: number; de: string; ate: string; radius?: number; dir?: 'h' | 'v' }) {
  const id = nid('gb')
  return (
    <Svg width={Math.max(w, 1)} height={Math.max(h, 1)} viewBox={`0 0 ${Math.max(w, 1)} ${Math.max(h, 1)}`}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2={dir === 'h' ? '1' : '0'} y2={dir === 'h' ? '0' : '1'}><Stop offset="0" stopColor={de} /><Stop offset="1" stopColor={ate} /></LinearGradient></Defs>
      <Rect x={0} y={0} width={Math.max(w, 1)} height={Math.max(h, 1)} rx={radius} fill={`url(#${id})`} />
    </Svg>
  )
}
