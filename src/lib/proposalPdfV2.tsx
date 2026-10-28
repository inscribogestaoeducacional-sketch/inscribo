// Proposta comercial da Áion Edu em PDF (formato 16:9, textos grandes para ler no celular).
// Os valores (implantação, mensalidade, unidades, números de WhatsApp) e a validade vêm sempre da proposta.
// Os custos da Meta são referência (ver META) e os exemplos são calculados a partir deles.
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  ;(globalThis as any).Buffer = Buffer
}

import React from 'react'
import { Document, Page, View, Text, Image, Font, Svg, Circle, Path, StyleSheet } from '@react-pdf/renderer'
import AION_LOGO_B64 from './aionLogo'

Font.register({
  family: 'BricolageGrotesque',
  fonts: [
    { src: '/fonts/bricolage-grotesque-latin-ext-700-normal.woff', fontWeight: 700 },
    { src: '/fonts/bricolage-grotesque-latin-ext-800-normal.woff', fontWeight: 800 },
  ],
})
Font.registerHyphenationCallback(w => [w])
Font.register({
  family: 'PlusJakartaSans',
  fonts: [
    { src: '/fonts/plus-jakarta-sans-latin-ext-400-normal.woff', fontWeight: 400 },
    { src: '/fonts/plus-jakarta-sans-latin-ext-500-normal.woff', fontWeight: 500 },
    { src: '/fonts/plus-jakarta-sans-latin-ext-600-normal.woff', fontWeight: 600 },
    { src: '/fonts/plus-jakarta-sans-latin-ext-700-normal.woff', fontWeight: 700 },
    { src: '/fonts/plus-jakarta-sans-latin-ext-800-normal.woff', fontWeight: 800 },
  ],
})

export interface ProposalPdfData {
  client_name: string
  school_name: string
  proposal_date?: string         // yyyy-mm-dd
  created_at?: string
  implementation_normal: number
  implementation_special: number // 0 = cortesia
  monthly_normal: number
  monthly_special: number
  special_deadline?: string      // yyyy-mm-dd (se vazio, vale validity_days a partir da data da proposta)
  validity_days: number
  units?: number                 // unidades da escola (padrão 1)
  whatsapp_numbers?: number      // números de WhatsApp (padrão 1)
  extra_unit_monthly?: number
  extra_unit_impl?: number
  extra_number_monthly?: number
  extra_number_impl?: number
  payment_terms?: string         // opcional
  notes?: string                 // opcional
  consultant_name?: string
  consultant_phone?: string
  consultant_email?: string
}

// Custos da Meta por mensagem (reais, referência de 01/10/2026; a Meta reajusta e o câmbio varia).
export const META = { marketing: 0.32, utility: 0.035, service: 0.035, freeService: 1000 }

const BASE = () => (globalThis as any).__PROPOSAL_BASE__ || ''
const img = (n: string) => `${BASE()}/proposal/${n}.jpg`

const DEEP = '#00372A', VD = '#00523C', VM = '#05907B', VC = '#2DCBA4', MINT = '#E6F7F5', INK = '#1A2B4A', MUTED = '#4B5B76', LINE = '#E3E8F0', PAPER = '#F4F7F5', GOLD = '#F5B544'
const SIZE: [number, number] = [720, 405]

const brl = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const brl3 = (v: number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 3 })
const num = (v: number) => Number(v).toLocaleString('pt-BR')
const toDate = (iso?: string | null) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso) : null)
const longDate = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '')
const firstName = (n: string) => (n || '').trim().split(/\s+/)[0] || ''

/** Data limite da proposta: a data especial, se houver; senão a data da proposta + validade em dias. */
export function validUntil(d: ProposalPdfData): Date | null {
  const sp = toDate(d.special_deadline)
  if (sp) return sp
  const base = toDate(d.proposal_date || d.created_at) || new Date()
  const out = new Date(base.getTime())
  out.setDate(out.getDate() + (d.validity_days || 0))
  return d.validity_days ? out : null
}

const s = StyleSheet.create({
  page: { fontFamily: 'PlusJakartaSans', fontSize: 12, color: INK },
  h1: { fontFamily: 'BricolageGrotesque', fontWeight: 800, color: INK },
})

const ICONS: Record<string, string[]> = {
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  columns: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z', 'M9 3v18', 'M15 3v18'],
  chip: ['M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M9 9h6v6H9z', 'M9 1v3', 'M15 1v3', 'M9 20v3', 'M15 20v3', 'M20 9h3', 'M20 14h3', 'M1 9h3', 'M1 14h3'],
  chart: ['M12 20V10', 'M18 20V4', 'M6 20v-4'],
  calcheck: ['M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M16 2v4', 'M8 2v4', 'M3 10h18', 'M9 16l2 2 4-4'],
  star: ['M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z'],
  swap: ['M23 4v6h-6', 'M1 20v-6h6', 'M3.51 9a9 9 0 0 1 14.85-3.36L23 10', 'M1 14l4.64 4.36A9 9 0 0 0 20.49 15'],
  contact: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8', 'M17 11l2 2 4-4'],
  send: ['M22 2L11 13', 'M22 2l-7 20-4-9-9-4z'],
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  bell: ['M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', 'M13.73 21a2 2 0 0 1-3.46 0'],
  target: ['M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20', 'M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12', 'M12 10a2 2 0 1 0 0 4a2 2 0 1 0 0-4'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
  phone: ['M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z', 'M12 18h.01'],
  store: ['M3 9l1.5-5h15L21 9', 'M3 9a3 3 0 0 0 6 0a3 3 0 0 0 6 0a3 3 0 0 0 6 0', 'M5 12v8h14v-8', 'M10 20v-5h4v5'],
  megaphone: ['M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z', 'M15 8a5 5 0 0 1 0 8', 'M18 5a9 9 0 0 1 0 14'],
  flag: ['M4 22V4', 'M4 4h13l-2 4 2 4H4'],
  grad: ['M2 9l10-5 10 5-10 5z', 'M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5', 'M22 9v6'],
  book: ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'],
  plug: ['M9 2v6', 'M15 2v6', 'M6 8h12v4a6 6 0 0 1-12 0z', 'M12 18v4'],
  infinity: ['M18.2 8a4 4 0 1 0 0 8c3.5 0 5.8-8 0-8z', 'M5.8 8c-5.8 0-3.5 8 0 8a4 4 0 1 0 0-8z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  building: ['M3 21h18', 'M5 21V7l8-4v18', 'M19 21V11l-6-4', 'M9 9v.01', 'M9 12v.01', 'M9 15v.01', 'M9 18v.01'],
  gift: ['M20 12v10H4V12', 'M2 7h20v5H2z', 'M12 22V7', 'M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z', 'M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z'],
}
function Icon({ name, color = VM, size = 18, sw = 1.8 }: { name: string; color?: string; size?: number; sw?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {(ICONS[name] || []).map((d, i) => <Path key={i} d={d} stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  )
}
function Tile({ name, bg, color, size = 34 }: { name: string; bg: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} color={color} size={size * 0.54} />
    </View>
  )
}
function Logo({ height = 18 }: { height?: number }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 13, alignSelf: 'flex-start' }}>
      <Image src={AION_LOGO_B64} style={{ height }} />
    </View>
  )
}
function Rings({ x = 560, y = 90, h = 380 }: { x?: number; y?: number; h?: number }) {
  return (
    <Svg width={720} height={h} style={{ position: 'absolute', top: 0, left: 0 }}>
      {[50, 95, 140, 190, 245].map((r, i) => (
        <Circle key={r} cx={x} cy={y} r={r} stroke={i % 2 ? '#2DCBA4' : '#FFFFFF'} strokeOpacity={i % 2 ? 0.16 : 0.07} strokeWidth={i % 2 ? 1.2 : 1} fill="none" />
      ))}
      <Circle cx={x} cy={y} r={28} fill="#2DCBA4" fillOpacity={0.2} />
    </Svg>
  )
}
function Check({ size = 14, color = VM }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Circle cx="8" cy="8" r="8" fill={color} fillOpacity={0.15} />
      <Path d="M4.6 8.3 L7 10.6 L11.4 5.6" stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}
function Shot({ name, width, ratio }: { name: string; width: number; ratio?: number }) {
  const h = width * (ratio || 0.603)
  return (
    <View style={{ width, borderRadius: 8, borderWidth: 1, borderColor: '#CFD8D5', backgroundColor: '#fff', overflow: 'hidden' }}>
      <View style={{ height: 11, backgroundColor: '#EEF2F1', flexDirection: 'row', alignItems: 'center', paddingLeft: 6 }}>
        {['#F87171', '#FBBF24', '#34D399'].map(c => <View key={c} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: c, marginRight: 3 }} />)}
      </View>
      <Image src={img(name)} style={{ width, height: h }} />
    </View>
  )
}
function PhoneShot({ name, width }: { name: string; width: number }) {
  const h = width * 1.9
  return (
    <View style={{ width, height: h, borderRadius: 14, borderWidth: 3, borderColor: '#1F2937', backgroundColor: '#1F2937', overflow: 'hidden' }}>
      <Image src={img(name)} style={{ width: width - 6, height: (width - 6) * 2.164 }} />
    </View>
  )
}
function Head({ tag, title, dark, sub, maxW = 560 }: { tag: string; title: string; dark?: boolean; sub?: string; maxW?: number }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, color: dark ? VC : VM, fontWeight: 700, marginBottom: 5 }}>{tag}</Text>
      <Text style={[s.h1, { fontSize: 25, lineHeight: 1.1, color: dark ? '#fff' : INK, maxWidth: maxW }]}>{title}</Text>
      {sub ? <Text style={{ fontSize: 12, color: dark ? '#B7DCD2' : MUTED, marginTop: 6, lineHeight: 1.45, maxWidth: maxW }}>{sub}</Text> : null}
    </View>
  )
}
function Foot({ n, total, school, dark }: { n: number; total: number; school: string; dark?: boolean }) {
  const c = dark ? 'rgba(255,255,255,0.55)' : '#8A97A8'
  return (
    <View fixed style={{ position: 'absolute', left: 36, right: 36, bottom: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 8.5, color: c }}>Áion Edu · Proposta para {school}</Text>
      <Text style={{ fontSize: 8.5, color: c }}>{n} / {total}</Text>
    </View>
  )
}
const PAD = { paddingHorizontal: 36, paddingTop: 30 }
const TOTAL = 14

// Cartão com ícone, título e texto
function Card({ ic, bg, color, t, x, w, h }: { ic: string; bg: string; color: string; t: string; x: string; w: number; h?: number }) {
  return (
    <View style={{ width: w, paddingRight: 10, marginBottom: 10 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: LINE, padding: 12, height: h }}>
        <Tile name={ic} bg={bg} color={color} size={30} />
        <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 13.5, marginTop: 8, marginBottom: 3 }}>{t}</Text>
        <Text style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{x}</Text>
      </View>
    </View>
  )
}
// Linha com ícone, título e texto
function Row({ ic, t, x, bg = MINT, color = VD }: { ic: string; t: string; x: string; bg?: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: LINE, padding: 10, marginBottom: 8 }}>
      <Tile name={ic} bg={bg} color={color} size={30} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{t}</Text>
        <Text style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{x}</Text>
      </View>
    </View>
  )
}

// 1 · CAPA
function Cover({ d, date }: { d: ProposalPdfData; date: string }) {
  const until = validUntil(d)
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: DEEP, paddingHorizontal: 36, paddingVertical: 30 }]}>
      <Rings h={330} />
      <Logo />
      <View style={{ marginTop: 52, width: 290 }}>
        <Text style={{ fontSize: 12, color: VC, fontWeight: 700, marginBottom: 8 }}>Proposta preparada para {firstName(d.client_name) || 'você'}</Text>
        <Text style={[s.h1, { fontSize: 30, color: '#fff', lineHeight: 1.08 }]}>{d.school_name}</Text>
        <Text style={{ fontSize: 13, color: '#B7DCD2', marginTop: 10, lineHeight: 1.45 }}>Captação, atendimento e matrícula em um só lugar, com o WhatsApp oficial e os números da campanha na mão do gestor.</Text>
      </View>
      <View style={{ position: 'absolute', right: 36, top: 66 }}><Shot name="leads" width={330} /></View>
      <View style={{ position: 'absolute', right: 100, top: 190 }}><Shot name="relatorios" width={250} /></View>
      <View style={{ position: 'absolute', left: 36, bottom: 28, flexDirection: 'row' }}>
        {[['Emitida em', date], d.consultant_name ? ['Seu consultor', d.consultant_name] : null, until ? ['Válida até', longDate(until)] : null].filter(Boolean).map((p: any) => (
          <View key={p[0]} style={{ marginRight: 26 }}>
            <Text style={{ fontSize: 9, color: '#7FB5A8', marginBottom: 2 }}>{p[0]}</Text>
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>{p[1]}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

// 2 · HISTÓRIA
function Story({ d }: { d: ProposalPdfData }) {
  const p: [string, string, string][] = [
    ['building', 'Nasceu dentro de escolas', 'Criada por quem vive a campanha de matrículas todos os anos.'],
    ['target', 'Feita para a escola privada', 'Cada tela resolve um problema real da secretaria e da direção.'],
    ['users', 'Hoje, escolas em vários estados', 'Já são escolas de várias regiões do Brasil usando no dia a dia.'],
  ]
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <Head tag="Quem somos" title="Uma plataforma criada por quem vive a matrícula por dentro" maxW={600} />
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        <View style={{ width: 290, marginRight: 24 }}>
          <Text style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, marginBottom: 12 }}>A Áion Edu surgiu dentro de escolas, de uma pergunta simples: por que a campanha de matrículas ainda é feita no improviso?</Text>
          <Text style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>Juntamos CRM, WhatsApp oficial, relatórios e inteligência em uma única plataforma, pensada para a rotina de quem atende e de quem decide.</Text>
        </View>
        <View style={{ flex: 1 }}>
          {p.map(([ic, t, x]) => (
            <View key={t} style={{ flexDirection: 'row', backgroundColor: PAPER, borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 13, marginBottom: 10 }}>
              <Tile name={ic} bg={VM} color="#fff" size={34} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{t}</Text>
                <Text style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>{x}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
      <Foot n={2} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 3 · PARA QUEM ATENDE
function ForAttendant({ d }: { d: ProposalPdfData }) {
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: PAPER, ...PAD }]}>
      <Head tag="No dia a dia da secretaria" title="Mais fácil para quem atende" />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 10 }}>
          <Row ic="users" t="Fila sem dono" x="Nunca dois atendentes respondem a mesma família." />
          <Row ic="chip" t="Robô que atende sozinho" x="Fora do horário, responde e coleta os dados." />
          <Row ic="list" t="Histórico na mesma tela" x="Conversas, visitas e etapa de cada família." />
        </View>
        <View style={{ flex: 1 }}>
          <Row ic="bell" t="Lembrete de retorno" x="Aviso quando o lead fica 5 dias sem contato." />
          <Row ic="calcheck" t="Visitas confirmadas sozinhas" x="Confirmação e lembrete por WhatsApp." />
          <Row ic="chat" t="Chat interno da equipe" x="Combina o atendimento sem misturar com a família." />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: MINT, borderRadius: 12, borderWidth: 1, borderColor: '#BDEBE4', padding: 12, marginTop: 2 }}>
        <Check size={18} />
        <Text style={{ fontSize: 12.5, color: VD, fontWeight: 700, marginLeft: 10, flex: 1 }}>Toda a equipe atende pelo número oficial da escola, e o histórico fica na escola, não no celular de quem saiu.</Text>
      </View>
      <Foot n={3} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 4 · PARA A DIREÇÃO
function ForManager({ d }: { d: ProposalPdfData }) {
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <Head tag="Para a direção" title="Mais controle para quem decide" />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 300, marginRight: 18 }}><Shot name="inicio" width={300} /></View>
        <View style={{ flex: 1 }}>
          <Row ic="home" t="O que precisa de você agora" x="Conversas na fila, pagamentos em atraso e leads sem responsável." bg={PAPER} />
          <Row ic="target" t="Metas por mês" x="Alerta quando uma etapa cai abaixo da meta." bg={PAPER} />
          <Row ic="chart" t="Relatório com diagnóstico" x="Nota de 0 a 100 e texto de IA pronto para a diretoria." bg={PAPER} />
          <Row ic="users" t="Desempenho da equipe" x="Leads, visitas e matrículas por atendente e origem." bg={PAPER} />
        </View>
      </View>
      <Foot n={4} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 5 · MÓDULOS — CAPTAR E ATENDER
function ModCapture({ d }: { d: ProposalPdfData }) {
  const W = 216
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: PAPER, ...PAD }]}>
      <Head tag="Módulos · Captar e atender" title="Do anúncio à conversa no WhatsApp" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 660 }}>
        <Card w={W} h={104} ic="users" bg="#E6F7F5" color="#00523C" t="Leads (CRM)" x="Funil visual com histórico de cada família e card único por família." />
        <Card w={W} h={104} ic="chat" bg="#E8F5E9" color="#16A34A" t="WhatsApp oficial" x="Fila, robô sem programar e chat interno da equipe." />
        <Card w={W} h={104} ic="megaphone" bg="#FCE7F3" color="#DB2777" t="Captação Inteligente" x="Saiba de qual anúncio veio cada matrícula." />
        <Card w={W} h={104} ic="store" bg="#CCFBF1" color="#0D9488" t="Vitrine Áion" x="A página da escola num link só, para bio e QR code." />
        <Card w={W} h={104} ic="contact" bg="#DBEAFE" color="#2563EB" t="Contatos" x="Base única, sem duplicados, com a linha do tempo." />
        <Card w={W} h={104} ic="calcheck" bg="#FEF3C7" color="#D97706" t="Visitas" x="Agenda com confirmação e Google Meet automático." />
      </View>
      <Foot n={5} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 6 · RELATÓRIOS DA CAMPANHA
function ModCampaign({ d }: { d: ProposalPdfData }) {
  const tabs = ['Visão geral', 'Funil', 'Novatos', 'Rematrícula', 'Investimento', 'Séries e turmas', 'Matriculômetro', 'Dia a dia', 'Saídas', 'Relatório']
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <Head tag="Módulo · Campanha de matrículas" title="Relatórios da campanha, do primeiro dia à matrícula" maxW={620} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 340, marginRight: 18 }}><Shot name="campanha" width={340} /></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.45, marginBottom: 9 }}>Metas, comparativo com os anos anteriores e o que falta para fechar, tudo em uma tela:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {tabs.map(t => (
              <View key={t} style={{ backgroundColor: MINT, borderRadius: 99, borderWidth: 1, borderColor: '#BDEBE4', paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}>
                <Text style={{ fontSize: 11, color: VD, fontWeight: 600 }}>{t}</Text>
              </View>
            ))}
          </View>
          <View style={{ marginTop: 6 }}>
            {['Matrículas por mês, ano contra ano', 'Meta de rematrícula e quem ainda falta', 'Investimento e custo por matrícula'].map(t => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Check size={14} /><Text style={{ fontSize: 12, marginLeft: 8, flex: 1 }}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
      <Foot n={6} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 7 · MÓDULOS — MATRICULAR E RETER
function ModRetain({ d }: { d: ProposalPdfData }) {
  const W = 216
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: PAPER, ...PAD }]}>
      <Head tag="Módulos · Matricular e reter" title="Do aluno novo à rematrícula" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 660 }}>
        <Card w={W} h={104} ic="grad" bg="#D1FAE5" color="#059669" t="Base de alunos" x="Cruza com o sistema da escola e mostra quem falta rematricular." />
        <Card w={W} h={104} ic="swap" bg="#FEE2E2" color="#DC2626" t="Transferências" x="O motivo real da saída e a chance de reter o aluno." />
        <Card w={W} h={104} ic="star" bg="#FFEDD5" color="#F97316" t="Pesquisas e NPS" x="Pesquisa por link, sem app, com análise de IA." />
        <Card w={W} h={104} ic="chart" bg="#DBEAFE" color="#3B82F6" t="Relatórios com IA" x="Nota da campanha e diagnóstico pronto para a diretoria." />
        <Card w={W} h={104} ic="flag" bg="#FFEDD5" color="#EA580C" t="Minha campanha" x="Passo a passo guiado para montar a campanha da escola." />
        <Card w={W} h={104} ic="send" bg="#E0F2FE" color="#0284C7" t="Transmissões" x="Mensagem para todas as famílias, com custo à vista." />
      </View>
      <Foot n={7} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 8 · PARA TODA A EQUIPE
function ModTeam({ d }: { d: ProposalPdfData }) {
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <Head tag="Para toda a equipe" title="Usuários ilimitados, no computador e no celular" maxW={600} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, marginRight: 18 }}>
          <Row ic="infinity" t="Usuários ilimitados" x="Toda a equipe com acesso, sem pagar por usuário. Perfis de administrador, gestor e consultor." bg={PAPER} />
          <Row ic="phone" t="Acesso pelo celular" x="Atenda, veja leads e acompanhe a campanha de qualquer lugar, sem baixar nada." bg={PAPER} />
          <Row ic="plug" t="Integra com o sistema da escola" x="Conectado ao Activesoft e a outros sistemas de gestão escolar." bg={PAPER} />
          <Row ic="book" t="Academia" x="Treinamentos para a equipe aprender na prática." bg={PAPER} />
        </View>
        <View style={{ width: 200, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <View style={{ marginRight: 10, marginTop: 14 }}><PhoneShot name="leads-m" width={86} /></View>
          <PhoneShot name="inicio-m" width={86} />
        </View>
      </View>
      <Foot n={8} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 9 · WHATSAPP: COMO A META COBRA
function MetaCosts({ d }: { d: ProposalPdfData }) {
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: DEEP, ...PAD }]}>
      <Rings x={650} y={40} h={330} />
      <Head dark tag="WhatsApp oficial" title="A Meta cobra por mensagem enviada" sub="Desde 1º de outubro de 2026, as respostas do atendimento também passaram a ser cobradas." maxW={520} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: '#2F6B5C', padding: 16, marginRight: 12 }}>
          <Text style={{ fontSize: 11, color: '#9ECFC4', fontWeight: 700 }}>Cada mensagem que a escola envia</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 32, color: VC, marginTop: 4 }}>{brl3(META.service)}</Text>
          <Text style={{ fontSize: 11.5, color: '#D3ECE5', marginTop: 4, lineHeight: 1.4 }}>depois das {num(META.freeService)} mensagens gratuitas do mês, em cada número de WhatsApp.</Text>
        </View>
        <View style={{ flex: 1 }}>
          {[['Mensagens que a família envia', 'Gratuitas'], ['Primeiras ' + num(META.freeService) + ' do mês', 'Gratuitas, por número'], ['Anúncio que abre o WhatsApp', 'Janela gratuita']].map(([t, v]) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(45,203,164,0.14)', borderRadius: 10, padding: 11, marginBottom: 7 }}>
              <Text style={{ fontSize: 12, color: '#fff', flex: 1 }}>{t}</Text>
              <Text style={{ fontSize: 12, color: VC, fontWeight: 700 }}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 9.5, color: '#7FB5A8', marginTop: 8 }}>Valor aproximado em reais pela tabela da Meta de 01/10/2026 (US$ 0,0068). Muda com o câmbio e com reajustes da Meta.</Text>
      <Foot n={9} total={TOTAL} school={d.school_name} dark />
    </Page>
  )
}

// 10 · EXEMPLO: SURPRESA NO FIM DO MÊS
function Example({ d }: { d: ProposalPdfData }) {
  const cost = (m: number) => Math.max(0, m - META.freeService) * META.service
  const scale = [3000, 5000, 10000, 20000]
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <Head tag="Um exemplo" title="Quanto a escola pagaria só de WhatsApp" sub="Pagando direto à Meta, o valor muda todo mês e só aparece no fim." maxW={560} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.2, backgroundColor: PAPER, borderRadius: 14, borderWidth: 1, borderColor: LINE, padding: 16, marginRight: 12 }}>
          <Text style={{ fontSize: 11.5, color: MUTED, fontWeight: 700 }}>5.000 mensagens enviadas no mês</Text>
          <Text style={{ fontSize: 12, marginTop: 8 }}>{num(5000)} mensagens, menos {num(META.freeService)} gratuitas</Text>
          <Text style={{ fontSize: 12, marginTop: 2 }}>{num(5000 - META.freeService)} cobradas × {brl3(META.service)}</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 32, marginTop: 8 }}>{brl(cost(5000))}</Text>
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: LINE }}>
            <Text style={{ fontSize: 10.5, color: MUTED, marginBottom: 5 }}>Em outros meses de movimento:</Text>
            <View style={{ flexDirection: 'row' }}>
              {scale.filter(m => m !== 5000).map(m => (
                <View key={m} style={{ flex: 1 }}>
                  <Text style={{ fontSize: 10.5, color: MUTED }}>{num(m)} msgs</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: 700 }}>{brl(cost(m))}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <View style={{ flex: 1, backgroundColor: DEEP, borderRadius: 14, padding: 18 }}>
          <Text style={{ fontSize: 11.5, color: VC, fontWeight: 700 }}>Com a Áion Edu</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: '#fff', marginTop: 6, lineHeight: 1.15 }}>Valor fixo, sem surpresa</Text>
          <Text style={{ fontSize: 12, color: '#D3ECE5', marginTop: 8, lineHeight: 1.45 }}>A mensalidade já cobre todas as mensagens do WhatsApp, enviadas e recebidas, em qualquer volume.</Text>
          <Text style={{ fontSize: 11, color: '#9ECFC4', marginTop: 8, lineHeight: 1.4 }}>Só a campanha de Transmissão tem custo à parte, se a escola quiser enviar.</Text>
        </View>
      </View>
      <Foot n={10} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 11 · TRANSMISSÕES: COMO FUNCIONA
function Broadcasts({ d }: { d: ProposalPdfData }) {
  const st: [string, string][] = [
    ['Escolha a mensagem', 'Modelo aprovado pela Meta, com texto, imagem ou vídeo e botões.'],
    ['Escolha quem recebe', 'Toda a base de contatos ou só um grupo: turma, etiqueta ou planilha.'],
    ['Veja o custo e confirme', 'A simulação mostra o valor total antes de enviar.'],
    ['Acompanhe as respostas', 'Quem leu, quem respondeu, e a resposta cai com a equipe.'],
  ]
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: PAPER, ...PAD }]}>
      <Head tag="Transmissões" title="Envie uma mensagem para todas as suas famílias" sub="Rematrícula, eventos e avisos para toda a base de contatos, de uma vez, pelo WhatsApp oficial." maxW={600} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 310, marginRight: 18 }}>
          {st.map(([t, x], i) => (
            <View key={t} style={{ flexDirection: 'row', marginBottom: 10 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: VM, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 11.5, fontWeight: 800, color: '#fff' }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 13.5, marginBottom: 1 }}>{t}</Text>
                <Text style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.4 }}>{x}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}><Shot name="transmissoes" width={300} /></View>
      </View>
      <Foot n={11} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

// 12 · TRANSMISSÕES: CUSTOS
function BroadcastCosts({ d }: { d: ProposalPdfData }) {
  const fam = [500, 1000, 2000]
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: DEEP, ...PAD }]}>
      <Rings x={640} y={60} h={330} />
      <Head dark tag="Transmissões" title="Você só paga se quiser enviar" sub="Não faz parte da mensalidade. O custo depende de quantas famílias vão receber e é mostrado antes de confirmar." maxW={540} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: '#2F6B5C', padding: 15, marginRight: 12 }}>
          <Text style={{ fontSize: 11, color: '#9ECFC4', fontWeight: 700 }}>Mensagem de campanha</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 28, color: VC, marginTop: 3 }}>{brl3(META.marketing)}</Text>
          <Text style={{ fontSize: 11, color: '#D3ECE5', marginTop: 2 }}>por família que recebe</Text>
          <Text style={{ fontSize: 11, color: '#9ECFC4', fontWeight: 700, marginTop: 10 }}>Aviso ou lembrete</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 18, color: VC, marginTop: 2 }}>{brl3(META.utility)}</Text>
        </View>
        <View style={{ flex: 1.2 }}>
          <Text style={{ fontSize: 11, color: '#9ECFC4', fontWeight: 700, marginBottom: 6 }}>Exemplos de campanha (mensagem de campanha)</Text>
          {fam.map(f => (
            <View key={f} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(45,203,164,0.14)', borderRadius: 10, padding: 11, marginBottom: 7 }}>
              <Text style={{ fontSize: 12.5, color: '#fff' }}>{num(f)} famílias</Text>
              <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 15, color: VC }}>{brl(f * META.marketing)}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={{ fontSize: 9.5, color: '#7FB5A8', marginTop: 6 }}>Valores aproximados da Meta. O valor final da campanha aparece na simulação, antes do envio.</Text>
      <Foot n={12} total={TOTAL} school={d.school_name} dark />
    </Page>
  )
}

// 13 · INVESTIMENTO
function Invest({ d }: { d: ProposalPdfData }) {
  const units = Math.max(1, d.units || 1)
  const nums = Math.max(1, d.whatsapp_numbers || 1)
  const exU = units - 1, exN = nums - 1
  const implFree = d.implementation_special === 0 && d.implementation_normal > 0
  const implBase = implFree ? 0 : d.implementation_special || d.implementation_normal
  const implStrike = implFree || (d.implementation_normal > 0 && d.implementation_special > 0 && d.implementation_special < d.implementation_normal)
  const monBase = d.monthly_special > 0 ? d.monthly_special : d.monthly_normal
  const monStrike = d.monthly_special > 0 && d.monthly_normal > d.monthly_special
  const price = (v?: number) => (v && v > 0 ? brl(v) : 'sob consulta')
  const extras: [string, number, number | undefined, number | undefined][] = []
  if (exU > 0) extras.push([`${exU} ${exU > 1 ? 'unidades adicionais' : 'unidade adicional'}`, exU, d.extra_unit_monthly, d.extra_unit_impl])
  if (exN > 0) extras.push([`${exN} ${exN > 1 ? 'números de WhatsApp adicionais' : 'número de WhatsApp adicional'}`, exN, d.extra_number_monthly, d.extra_number_impl])
  const implTot = implBase + extras.reduce((a, e) => a + e[1] * (e[3] || 0), 0)
  const monTot = monBase + extras.reduce((a, e) => a + e[1] * (e[2] || 0), 0)
  const until = validUntil(d)
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: DEEP, ...PAD }]}>
      <Rings x={650} y={30} h={330} />
      <Head dark tag="Investimento" title={`Proposta para ${d.school_name}`} maxW={560} />
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, borderWidth: 1, borderColor: '#2F6B5C', padding: extras.length ? 13 : 18, marginRight: 12 }}>
          <Text style={{ fontSize: 11.5, color: '#9ECFC4', fontWeight: 700 }}>Implantação · pagamento único</Text>
          <View style={{ height: 14, marginTop: 6 }}>{implStrike ? <Text style={{ fontSize: 11, color: '#7FB5A8', textDecoration: 'line-through' }}>de {brl(d.implementation_normal)}</Text> : null}</View>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 32, color: '#fff' }}>{implFree ? 'Cortesia' : brl(implBase)}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: extras.length ? 13 : 18 }}>
          <Text style={{ fontSize: 11.5, color: VM, fontWeight: 700 }}>Mensalidade da plataforma</Text>
          <View style={{ height: 14, marginTop: 6 }}>{monStrike ? <Text style={{ fontSize: 11, color: '#94A3B8', textDecoration: 'line-through' }}>de {brl(d.monthly_normal)}</Text> : null}</View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 32, color: VD }}>{brl(monBase)}</Text>
            <Text style={{ fontSize: 12, color: MUTED, marginBottom: 5, marginLeft: 4 }}>/ mês</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: extras.length ? 8 : 12 }}>
        {[
          'Usuários ilimitados e todos os módulos da plataforma.',
          'A mensalidade cobre todas as mensagens do WhatsApp, enviadas e recebidas.',
          'Transmissões (campanhas para a base) são cobradas conforme o uso, com simulação antes do envio.',
        ].slice(extras.length ? 1 : 0).map(t => (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
            <Check size={14} color={VC} /><Text style={{ fontSize: 12, color: '#E6F7F5', marginLeft: 8, flex: 1 }}>{t}</Text>
          </View>
        ))}
      </View>

      {extras.length ? (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: '#2F6B5C', padding: 10, marginTop: 4 }}>
          <Text style={{ fontSize: 11.5, color: VC, fontWeight: 700, marginBottom: 4 }}>Sua proposta: {units} {units > 1 ? 'unidades' : 'unidade'} e {nums} {nums > 1 ? 'números' : 'número'} de WhatsApp</Text>
          {extras.map(([t, n, m, im]) => (
            <Text key={t} style={{ fontSize: 11.5, color: '#fff', marginBottom: 2 }}>{t}: mensalidade {price(m ? m * n : 0)}{m ? ' / mês' : ''} · implantação {price(im ? im * n : 0)}</Text>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingTop: 5, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Total</Text>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 15, color: VC }}>{brl(implTot)} + {brl(monTot)}/mês</Text>
          </View>
        </View>
      ) : null}
      {d.payment_terms ? <Text style={{ fontSize: 11.5, color: '#D3ECE5', marginTop: 8 }}>Pagamento: {d.payment_terms}</Text> : null}
      {until ? (
        <View style={{ marginTop: extras.length ? 6 : 8, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 8 }} />
          <Text style={{ fontSize: 11.5, color: '#F6D79A' }}>Proposta válida até {longDate(until)}.</Text>
        </View>
      ) : null}
      <Foot n={13} total={TOTAL} school={d.school_name} dark />
    </Page>
  )
}

// 14 · INCLUSO + PRÓXIMO PASSO
function Next({ d }: { d: ProposalPdfData }) {
  const inc = ['Configuração completa da conta', 'Integração com o sistema da escola', 'Homologação do WhatsApp oficial (Meta)', 'Personalização dos fluxos e etapas', 'Treinamento da equipe', 'Todas as mensagens do WhatsApp no atendimento', 'Suporte pelo WhatsApp e atualizações']
  return (
    <Page size={SIZE} style={[s.page, { backgroundColor: '#fff', ...PAD }]}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1.2, paddingRight: 26 }}>
          <Text style={{ fontSize: 11, color: VM, fontWeight: 700, marginBottom: 5 }}>Tudo incluso</Text>
          <Text style={[s.h1, { fontSize: 23, marginBottom: 12 }]}>O que está na proposta</Text>
          {inc.map(t => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9 }}>
              <Check size={16} /><Text style={{ fontSize: 12.5, marginLeft: 9, flex: 1 }}>{t}</Text>
            </View>
          ))}
          {d.notes ? <View style={{ marginTop: 4, backgroundColor: PAPER, borderRadius: 10, borderWidth: 1, borderColor: LINE, padding: 10 }}><Text style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}>{d.notes}</Text></View> : null}
        </View>
        <View style={{ flex: 1, backgroundColor: DEEP, borderRadius: 16, padding: 20, minHeight: 320 }}>
          <Text style={{ fontSize: 11, color: VC, fontWeight: 700, marginBottom: 5 }}>Próximo passo</Text>
          <Text style={[s.h1, { fontSize: 19, color: '#fff', lineHeight: 1.15, marginBottom: 12 }]}>Vamos começar a sua campanha?</Text>
          {['Você aprova a proposta', 'Enviamos o contrato', 'Iniciamos a implantação'].map((t, i) => (
            <View key={t} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: VC, alignItems: 'center', justifyContent: 'center', marginRight: 9 }}>
                <Text style={{ fontSize: 10.5, fontWeight: 800, color: DEEP }}>{i + 1}</Text>
              </View>
              <Text style={{ fontSize: 12.5, color: '#fff' }}>{t}</Text>
            </View>
          ))}
          <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)', paddingTop: 12 }}>
            <Text style={{ fontSize: 9.5, color: '#7FB5A8', marginBottom: 3 }}>Fale com o seu consultor</Text>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 4 }}>{d.consultant_name || 'Equipe Áion Edu'}</Text>
            {d.consultant_phone ? <Text style={{ fontSize: 12, color: '#D3ECE5', marginBottom: 2 }}>WhatsApp {d.consultant_phone}</Text> : null}
            {d.consultant_email ? <Text style={{ fontSize: 12, color: '#D3ECE5' }}>{d.consultant_email}</Text> : null}
          </View>
        </View>
      </View>
      <Foot n={14} total={TOTAL} school={d.school_name} />
    </Page>
  )
}

export default function ProposalPdfV2({ data }: { data: ProposalPdfData }) {
  const date = longDate(toDate(data.proposal_date || data.created_at) || new Date())
  return (
    <Document title={`Proposta Áion Edu — ${data.school_name}`} author="Áion Edu">
      <Cover d={data} date={date} />
      <Story d={data} />
      <ForAttendant d={data} />
      <ForManager d={data} />
      <ModCapture d={data} />
      <ModCampaign d={data} />
      <ModRetain d={data} />
      <ModTeam d={data} />
      <MetaCosts d={data} />
      <Example d={data} />
      <Broadcasts d={data} />
      <BroadcastCosts d={data} />
      <Invest d={data} />
      <Next d={data} />
    </Document>
  )
}
