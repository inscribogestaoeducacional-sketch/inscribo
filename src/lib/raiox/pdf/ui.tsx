import React from 'react'
import { Page, View, Text, Image, Font, Svg, Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polygon, Polyline } from '@react-pdf/renderer'
import { ICON_DATA } from './iconData'

// ─── fontes (WOFF: o fontkit do react-pdf não lê woff2) ──────────────────────
let fontsOk = false
let BASE = ''
export const setBase = (b: string) => { BASE = b }
export const asset = (p: string) => BASE + p
export function registerFonts() {
  if (fontsOk) return; fontsOk = true
  Font.register({ family: 'Bricolage', fonts: [{ src: BASE + '/fonts/rx-bricolage-700.woff', fontWeight: 700 }, { src: BASE + '/fonts/rx-bricolage-800.woff', fontWeight: 800 }] })
  Font.register({ family: 'Jakarta', fonts: [
    { src: BASE + '/fonts/rx-jakarta-400.woff', fontWeight: 400 }, { src: BASE + '/fonts/rx-jakarta-500.woff', fontWeight: 500 }, { src: BASE + '/fonts/rx-jakarta-600.woff', fontWeight: 600 },
    { src: BASE + '/fonts/rx-jakarta-700.woff', fontWeight: 700 }, { src: BASE + '/fonts/rx-jakarta-800.woff', fontWeight: 800 }] })
  Font.registerHyphenationCallback(w => [w]) // sem hifenização
}

// ─── cores da marca ──────────────────────────────────────────────────────────
export const C = { VERDE: '#00523C', ESCURO: '#00402F', TURQ: '#00A896', MENTA: '#E3F4EE', AMBAR: '#F5A623', CORAL: '#E5484D', TINTA: '#0B2E25', BG: '#F3FAF7', MUTED: '#6b8a81', TXT: '#365a50', LINHA: '#E3F4EE', WARN_TXT: '#B36B00', RED_TXT: '#C0392B' }
export const PW = 794, PH = 1123 // página proporcional a A4, em pontos
export const LOGO_COR = '/raiox/logo-cor.png', LOGO_BRANCA = '/raiox/logo-branca.png'

// texto rico: **negrito**
export function Rich({ t, style, bold = 800 }: { t: string; style?: any; bold?: number }) {
  const parts = t.split('**')
  return <Text style={style}>{parts.map((p, i) => (i % 2 ? <Text key={i} style={{ fontWeight: bold }}>{p}</Text> : p))}</Text>
}
export const txt = (size: number, color: string = C.TXT, weight: number = 500): any => ({ fontFamily: 'Jakarta', fontSize: size, color, fontWeight: weight, lineHeight: 1.45 })
export const num = (size: number, color: string = C.TINTA): any => ({ fontFamily: 'Bricolage', fontWeight: 800, fontSize: size, color, lineHeight: 1 })
export const head = (size: number, color: string = C.VERDE, weight: number = 700): any => ({ fontFamily: 'Bricolage', fontWeight: weight, fontSize: size, color, lineHeight: 1.15 })

// ─── ícones (lucide) ─────────────────────────────────────────────────────────
export function Icon({ name, size = 22, color = C.VERDE, sw = 2 }: { name: string; size?: number; color?: string; sw?: number }) {
  const nodes = ICON_DATA[name] ?? []
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {nodes.map(([tag, a], i) => {
        const p: any = { key: i, stroke: color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', ...a }
        if (tag === 'path') return <Path {...p} />
        if (tag === 'circle') return <Circle {...p} />
        if (tag === 'rect') { return <Rect {...p} rx={a.rx as any} /> }
        if (tag === 'line') return <Line {...p} />
        if (tag === 'polyline') return <Polyline {...p} />
        if (tag === 'polygon') return <Polygon {...p} />
        return null
      })}
    </Svg>
  )
}
export function IconBox({ name, size = 42, bg = '#DDF5EE', color = C.VERDE, radius }: { name: string; size?: number; bg?: string; color?: string; radius?: number }) {
  return <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={size * 0.52} color={color} /></View>
}

// ─── estrutura da página ─────────────────────────────────────────────────────
export function Pg({ children }: { children: React.ReactNode }) {
  // altura fixa: se algum conteúdo passar do limite ele é cortado em vez de abrir uma página extra
  return <Page size={{ width: PW, height: PH }} style={{ backgroundColor: C.BG, fontFamily: 'Jakarta' }}><View style={{ width: PW, height: PH, overflow: 'hidden', paddingBottom: 50, flexDirection: 'column' }}>{children}</View></Page>
}
export function Sec({ children, first, style }: { children: React.ReactNode; first?: boolean; style?: any }) {
  return <View style={{ marginHorizontal: 48, marginTop: first ? 18 : 'auto', ...style }}>{children}</View>
}
export function H2({ children }: { children: string }) { return <Text style={{ ...head(21), marginBottom: 7 }}>{children}</Text> }
export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={{ backgroundColor: '#fff', borderRadius: 24, paddingVertical: 18, paddingHorizontal: 22, borderWidth: 1, borderColor: '#DFF0EA', ...style }}>{children}</View>
}

let gid = 0
export function Hero({ pill, title, lead, side }: { pill: string; title: string; lead?: string; side?: React.ReactNode }) {
  const id = `hg${gid++}`
  return (
    <View style={{ borderBottomLeftRadius: 48, borderBottomRightRadius: 48, overflow: 'hidden', minHeight: 140, paddingTop: 22, paddingBottom: 20, paddingHorizontal: 48 }}>
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={PW} height={300} viewBox={`0 0 ${PW} 300`}>
        <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.55"><Stop offset="0" stopColor="#00402F" /><Stop offset="0.55" stopColor="#00796B" /><Stop offset="1" stopColor="#0DD3BF" /></LinearGradient></Defs>
        <Rect x={0} y={0} width={PW} height={300} fill={`url(#${id})`} />
        <Circle cx={PW - 40} cy={30} r={165} fill="#ffffff" fillOpacity={0.08} />
        <Circle cx={PW - 240} cy={170} r={115} fill="#0DD3BF" fillOpacity={0.22} />
      </Svg>
      <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 99, paddingVertical: 6, paddingHorizontal: 15 }}><Text style={{ ...txt(13, '#fff', 700) }}>{pill}</Text></View>
      <Text style={{ ...head(28, '#fff', 800), marginTop: 14, maxWidth: side ? 470 : 560, letterSpacing: -0.3 }}>{title}</Text>
      {lead ? <Rich t={lead} bold={800} style={{ ...txt(15.5, '#fff', 500), marginTop: 12, maxWidth: 420 }} /> : null}
      {side ? <View style={{ position: 'absolute', right: 46, top: 28, alignItems: 'center' }}>{side}</View> : null}
    </View>
  )
}

export function Serve({ a, b, c }: { a: string; b: string; c: string }) {
  const box = (h: string, t: string) => (
    <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 18, paddingVertical: 11, paddingHorizontal: 14, borderWidth: 1, borderColor: '#DFF0EA' }}>
      <Text style={{ ...head(12.5, C.TURQ, 800), marginBottom: 2 }}>{h}</Text><Rich t={t} style={txt(11.6, C.TXT, 500)} />
    </View>
  )
  return <View style={{ marginHorizontal: 48, marginTop: 'auto', flexDirection: 'row', gap: 10 }}>{box('O que é', a)}{box('Para que serve', b)}{box('Como a Áion ajuda', c)}</View>
}
export function Aula({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ marginHorizontal: 48, marginTop: 'auto', backgroundColor: '#FFF6DC', borderRadius: 22, paddingVertical: 14, paddingLeft: 66, paddingRight: 20 }}>
      <View style={{ position: 'absolute', left: 20, top: 14 }}><IconBox name="bulb" size={32} bg="#FFE9A8" color="#8a5a00" /></View>
      <Text style={{ ...head(14.5, '#8a5a00', 700), marginBottom: 2 }}>{title}</Text><Rich t={children} style={txt(12.6, '#4a3b00', 500)} />
    </View>
  )
}
export function Foot({ fonte, rodape }: { fonte: string; rodape: string }) {
  return (
    <View style={{ position: 'absolute', left: 48, right: 48, bottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ ...txt(10.5, '#5b7a71', 500), maxWidth: 360 }}>Fonte: {fonte}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={txt(10.5, '#5b7a71', 500)}>Raio-X · {rodape}</Text><Image src={asset(LOGO_COR)} style={{ height: 20, width: 20 * (640 / 188) }} /></View>
    </View>
  )
}
