// Buffer polyfill for react-pdf in browser
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  ;(globalThis as any).Buffer = Buffer
}

import React from 'react'
import { Document, Page, View, Text, Image, Link, Font, StyleSheet } from '@react-pdf/renderer'
import AION_LOGO_B64 from './aionLogo'
import { buildInterpretation, type RaioXMetrics, type CompetitorRow, type SegmentMetric, type SegmentCompetitorRow } from './raioXMetrics'

// ─── Local fonts — WOFF (fontkit in react-pdf doesn't support woff2) ──────────
Font.register({
  family: 'BricolageGrotesque',
  fonts: [
    { src: '/fonts/bricolage-grotesque-latin-ext-700-normal.woff', fontWeight: 700 },
    { src: '/fonts/bricolage-grotesque-latin-ext-800-normal.woff', fontWeight: 800 },
    { src: '/fonts/bricolage-grotesque-latin-ext-800-normal.woff', fontWeight: 900 },
  ],
})
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

// ─── Design tokens — mesma paleta de proposalPdf.tsx / RaioXPage.tsx ─────────
const VD     = '#00523C' // verde escuro — marca / bom desempenho
const VM     = '#00A896' // teal — marca / desempenho consolidado
const VC     = '#0DD3BF' // mint — destaque
const AZUL   = '#1A2B4A'
const CMID   = '#64748B'
const CLIGHT = '#94A3B8'
const BORDA  = '#E2E8F0'
const SOFT   = '#E6F7F4'

// pontos de atenção — mesma linguagem visual de alerta já usada no site (Landing.tsx)
const WARN      = '#F59E0B'
const WARN_BG   = '#FFFBEB'
const NEUTRAL_BG = '#F1F5F9'

const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR')
const fmtPct = (v: number) => `${v.toFixed(1)}%`

// cor por desempenho — verde (bom) / teal (consolidado) / âmbar (atenção)
const scoreColor  = (score: number) => (score >= 70 ? VD : score >= 40 ? VM : WARN)
const shareColor  = (pct: number)   => (pct >= 15 ? VD : pct >= 5 ? VM : WARN)
const rankColor   = (rank: number, total: number) => {
  if (total <= 1) return VD
  const pct = (rank - 1) / (total - 1)
  if (pct <= 0.2) return VD
  if (pct <= 0.5) return VM
  return WARN
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:    { fontFamily: 'PlusJakartaSans', fontSize: 12 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F7F4', borderRadius: 100, paddingVertical: 5, paddingHorizontal: 13, marginBottom: 8, alignSelf: 'flex-start' },
  tagDot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: VM, marginRight: 7 },
  tagText: { fontSize: 10, fontWeight: 700, color: VM, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'PlusJakartaSans' },
  title:   { fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 22, color: AZUL, marginBottom: 20, marginTop: 2 },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Tag({ children }: { children: string }) {
  return (
    <View style={s.tagWrap}>
      <View style={s.tagDot} />
      <Text style={s.tagText}>{children}</Text>
    </View>
  )
}

function LogoPill({ height = 24 }: { height?: number }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 20, alignSelf: 'flex-start' }}>
      <Image src={AION_LOGO_B64} style={{ height }} />
    </View>
  )
}

// badge de status colorido (círculo + texto)
function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 100, paddingVertical: 5, paddingHorizontal: 12 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color, marginRight: 6 }} />
      <Text style={{ fontSize: 10, fontWeight: 700, color, fontFamily: 'PlusJakartaSans' }}>{text}</Text>
    </View>
  )
}

// círculo colorido com número/texto curto dentro — usado em ranking e etapas
function NumberCircle({ text, size, color, bg, fontSize }: { text: string; size: number; color: string; bg: string; fontSize?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: fontSize ?? size * 0.34, color }}>{text}</Text>
    </View>
  )
}

// cartão simples de indicador — usado em grids 2 colunas
function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ width: '48%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 12, padding: 16 }}>
      <Text style={{ fontSize: 9.5, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 24, color: color ?? AZUL }}>{value}</Text>
    </View>
  )
}

// cartão de destaque em largura total — números grandes e chamativos
function HeroStat({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <View style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: BORDA, borderRadius: 16, paddingVertical: 26, paddingHorizontal: 24, marginBottom: 14 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 46, color, marginBottom: 8 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: CMID, lineHeight: 1.5, fontFamily: 'PlusJakartaSans' }}>{sub}</Text>
    </View>
  )
}

// barra horizontal desenhada com View — @react-pdf/renderer não tem gráficos nativos
function Bar({ label, value, max, color, valueLabel, highlight }: {
  label: string; value: number; max: number; color: string; valueLabel: string; highlight?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <Text style={{ flex: 1, fontSize: 11, color: highlight ? VD : AZUL, fontWeight: highlight ? 800 : 600, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
        <Text style={{ marginLeft: 8, flexShrink: 0, fontSize: 10.5, color: CMID, fontFamily: 'PlusJakartaSans' }}>{valueLabel}</Text>
      </View>
      <View style={{ height: 13, backgroundColor: '#F1F5F9', borderRadius: 7 }}>
        <View style={{ height: 13, width: `${pct}%`, backgroundColor: color, borderRadius: 7 }} />
      </View>
    </View>
  )
}

// tabela simples com cabeçalho fixo — usada em concorrentes e comparativo geral
function Table({ headers, rows }: { headers: { label: string; flex: number; align?: 'left' | 'right' }[]; rows: React.ReactNode[][] }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: AZUL, paddingBottom: 9, marginBottom: 4 }}>
        {headers.map(h => (
          <Text key={h.label} style={{ flex: h.flex, fontSize: 9.5, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h.align ?? 'left', fontFamily: 'PlusJakartaSans' }}>{h.label}</Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 10 }}>
          {row.map((cell, j) => (
            <View key={j} style={{ flex: headers[j].flex }}>{cell}</View>
          ))}
        </View>
      ))}
    </View>
  )
}

// cartão de insight — usado na página de interpretação, com barra de destaque lateral
function InsightCard({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 10, overflow: 'hidden' }}>
      <View style={{ width: 4, backgroundColor: VM }} />
      <Text style={{ flex: 1, fontSize: 11, color: AZUL, lineHeight: 1.6, padding: 12, fontFamily: 'PlusJakartaSans' }}>{text}</Text>
    </View>
  )
}

// ─── PAGE 1 — CAPA ────────────────────────────────────────────────────────────
function Page1({ m, generatedDate }: { m: RaioXMetrics; generatedDate: string }) {
  const cards = [
    { label: 'Escola',                value: m.schoolName },
    { label: 'Cidade / UF',           value: `${m.city}/${m.state}` },
    { label: 'Ano do Censo Escolar',  value: String(m.anoCenso) },
    { label: 'Emitido em',            value: generatedDate },
  ]
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { backgroundColor: VD, padding: 36 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <LogoPill />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,211,191,0.18)', borderRadius: 100, paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderColor: VC }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: VC, marginRight: 6 }} />
          <Text style={{ fontSize: 9, fontWeight: 600, color: VC, fontFamily: 'PlusJakartaSans' }}>Relatório Confidencial</Text>
        </View>
      </View>

      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 38, color: '#fff', marginBottom: 14, lineHeight: 1.1 }}>
        {'Raio-X\nEstratégico\nda Escola'}
      </Text>
      <Text style={{ fontSize: 13, color: '#B2D8CE', marginBottom: 32, lineHeight: 1.6, fontFamily: 'PlusJakartaSans' }}>
        Análise de posicionamento de mercado com base nos dados oficiais do Censo Escolar INEP.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
        {cards.map(c => (
          <View key={c.label} style={{ width: '47%', backgroundColor: '#1A6B52', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2A7A60' }}>
            <Text style={{ fontSize: 9, color: '#9ECFC4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5, fontWeight: 600, fontFamily: 'PlusJakartaSans' }}>{c.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>{c.value}</Text>
          </View>
        ))}
      </View>

      {/* teaser do Score — impacto imediato na capa */}
      <View style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderRadius: 16, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <NumberCircle text={String(m.marketScore)} size={72} color="#fff" bg="rgba(255,255,255,0.14)" fontSize={30} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'PlusJakartaSans' }}>Score de Mercado</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 16, color: '#fff' }}>{m.scoreLabel}</Text>
          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 3, fontFamily: 'PlusJakartaSans' }}>{`${m.ranking}º lugar entre ${m.rankingTotal} escolas privadas do município`}</Text>
        </View>
      </View>
    </Page>
  )
}

// ─── PAGE 2 — RESUMO EXECUTIVO ────────────────────────────────────────────────
function Page2({ m, headline }: { m: RaioXMetrics; headline: string }) {
  const sColor = scoreColor(m.marketScore)
  const sBg = m.marketScore >= 70 ? SOFT : m.marketScore >= 40 ? '#E6F7F4' : WARN_BG
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Resumo Executivo</Tag>
      <Text style={s.title}>Como {m.schoolName} está posicionada</Text>

      {/* Score de Mercado — hero */}
      <View style={{ backgroundColor: sBg, borderWidth: 1.5, borderColor: sColor, borderRadius: 18, padding: 24, marginBottom: 18, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <NumberCircle text={String(m.marketScore)} size={88} color={sColor} bg="#fff" fontSize={34} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontFamily: 'PlusJakartaSans' }}>Score de Mercado (0-100)</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 19, color: sColor, marginBottom: 6 }}>{m.scoreLabel}</Text>
          <Text style={{ fontSize: 10.5, color: CMID, lineHeight: 1.5, fontFamily: 'PlusJakartaSans' }}>Combina posição no ranking e participação de mercado no município.</Text>
        </View>
      </View>

      {/* KPIs principais — coloridos por desempenho */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <KpiCard label="Ranking no município"          value={`${m.ranking}º de ${m.rankingTotal}`} color={rankColor(m.ranking, m.rankingTotal)} />
        <KpiCard label="Participação de mercado"        value={fmtPct(m.marketSharePct)} color={shareColor(m.marketSharePct)} />
        <KpiCard label="Matrículas totais"               value={fmtNum(m.qtMatTotal)} />
        <KpiCard label="Escolas privadas concorrentes"  value={fmtNum(m.totalPrivateSchools)} />
      </View>

      <View style={{ backgroundColor: VD, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 18 }}>
        <Text style={{ fontSize: 12, color: '#fff', lineHeight: 1.6, fontFamily: 'PlusJakartaSans' }}>{headline}</Text>
      </View>
    </Page>
  )
}

// ─── PAGE 3 — PANORAMA DO MERCADO ─────────────────────────────────────────────
function Page3({ m }: { m: RaioXMetrics }) {
  const indicators = [
    { label: 'Escolas privadas no município',        value: fmtNum(m.totalPrivateSchools) },
    { label: 'Total de alunos na rede privada',       value: fmtNum(m.totalPrivateStudents) },
    { label: 'Média de alunos por escola',            value: fmtNum(m.avgStudentsPerSchool) },
    { label: 'Ano de referência (Censo Escolar)',     value: String(m.anoCenso) },
  ]
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Panorama do Mercado</Tag>
      <Text style={s.title}>Indicadores de {m.city}/{m.state}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {indicators.map(i => <KpiCard key={i.label} label={i.label} value={i.value} />)}
      </View>
    </Page>
  )
}

// ─── PAGE 4 — RANKING ─────────────────────────────────────────────────────────
function Page4({ m }: { m: RaioXMetrics }) {
  const rColor = rankColor(m.ranking, m.rankingTotal)
  const rBg = m.ranking <= 5 ? SOFT : WARN_BG
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Ranking</Tag>
      <Text style={s.title}>Posição de {m.schoolName} no mercado local</Text>

      {/* posição atual — hero com círculo colorido */}
      <View style={{ backgroundColor: rBg, borderWidth: 1.5, borderColor: rColor, borderRadius: 18, padding: 24, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 20 }}>
        <NumberCircle text={`${m.ranking}º`} size={84} color={rColor} bg="#fff" fontSize={28} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: 'PlusJakartaSans' }}>Posição atual</Text>
          <Text style={{ fontSize: 12.5, color: AZUL, lineHeight: 1.5, fontFamily: 'PlusJakartaSans', fontWeight: 600 }}>
            {`de ${m.rankingTotal} escolas privadas em ${m.city}/${m.state}`}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <HeroStat
            label="Distância p/ a líder"
            value={m.distanceToLeader > 0 ? fmtNum(m.distanceToLeader) : '—'}
            sub={m.distanceToLeader > 0 ? 'matrículas para alcançar a 1ª colocada' : 'A escola já lidera o mercado local'}
            color={m.distanceToLeader > 0 ? WARN : VD}
          />
        </View>
        <View style={{ flex: 1 }}>
          <HeroStat
            label="Distância p/ o Top 5"
            value={m.ranking <= 5 ? '—' : fmtNum(m.distanceToTop5)}
            sub={m.ranking <= 5 ? 'Já está entre as 5 maiores do município' : 'matrículas para entrar no Top 5'}
            color={m.ranking <= 5 ? VD : WARN}
          />
        </View>
      </View>
    </Page>
  )
}

// ─── PAGE 5 — PRINCIPAIS CONCORRENTES ─────────────────────────────────────────
function Page5({ m }: { m: RaioXMetrics }) {
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Concorrência</Tag>
      <Text style={s.title}>Principais escolas privadas de {m.city}/{m.state}</Text>

      <Table
        headers={[
          { label: '#',           flex: 0.5 },
          { label: 'Escola',      flex: 2.6 },
          { label: 'Matríc.',     flex: 1, align: 'right' },
          { label: 'Share',       flex: 1, align: 'right' },
        ]}
        rows={m.topCompetitors.map((c: CompetitorRow) => [
          <Text style={{ fontSize: 11, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, fontFamily: 'PlusJakartaSans' }}>{c.rank}º</Text>,
          <View>
            <Text style={{ fontSize: 11, color: c.isSelected ? VD : AZUL, fontWeight: c.isSelected ? 800 : 500, fontFamily: 'PlusJakartaSans' }}>{c.no_entidade}</Text>
            {c.isSelected && (
              <View style={{ marginTop: 3, alignSelf: 'flex-start', backgroundColor: VD, borderRadius: 100, paddingVertical: 2, paddingHorizontal: 8 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>SUA ESCOLA</Text>
              </View>
            )}
          </View>,
          <Text style={{ fontSize: 11, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, textAlign: 'right', fontFamily: 'PlusJakartaSans' }}>{fmtNum(c.qt_mat_total)}</Text>,
          <Text style={{ fontSize: 11, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, textAlign: 'right', fontFamily: 'PlusJakartaSans' }}>{fmtPct(c.marketSharePct)}</Text>,
        ])}
      />
    </Page>
  )
}

// ─── PAGE 6 — PARTICIPAÇÃO DE MERCADO ─────────────────────────────────────────
function Page6({ m }: { m: RaioXMetrics }) {
  const maxVal = Math.max(1, ...m.topCompetitors.map(c => c.qt_mat_total))
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Participação de Mercado</Tag>
      <Text style={s.title}>Distribuição de matrículas entre as principais escolas</Text>

      {m.topCompetitors.map(c => (
        <Bar
          key={c.co_entidade}
          label={`${c.rank}º · ${c.no_entidade}${c.isSelected ? ' (sua escola)' : ''}`}
          value={c.qt_mat_total}
          max={maxVal}
          color={c.isSelected ? VD : VM}
          valueLabel={`${fmtNum(c.qt_mat_total)} · ${fmtPct(c.marketSharePct)}`}
          highlight={c.isSelected}
        />
      ))}
    </Page>
  )
}

// ─── PAGE 7 — RANKING E PARTICIPAÇÃO POR ETAPA DE ENSINO ──────────────────────
function CompetitorMiniList({ items }: { items: SegmentCompetitorRow[] }) {
  if (items.length === 0) return null
  return (
    <View style={{ marginTop: 4 }}>
      <Text style={{ fontSize: 9.5, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontFamily: 'PlusJakartaSans' }}>
        Principais concorrentes nesse segmento
      </Text>
      {items.map((c, i) => (
        <View key={c.co_entidade} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#E2E8F0' }}>
          <Text style={{ flex: 1, fontSize: 10.5, color: AZUL, fontWeight: 600, fontFamily: 'PlusJakartaSans' }}>{`${i + 1}º ${c.no_entidade}`}</Text>
          <Text style={{ fontSize: 10, color: CMID, fontFamily: 'PlusJakartaSans' }}>{`${fmtNum(c.value)} · ${fmtPct(c.marketSharePct)}`}</Text>
        </View>
      ))}
    </View>
  )
}

function SegmentCard({ seg, cityAvg }: { seg: SegmentMetric; cityAvg: number }) {
  const initial = seg.label.charAt(0)

  if (!seg.active) {
    return (
      <View style={{ backgroundColor: NEUTRAL_BG, borderRadius: 14, padding: 18, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: seg.topCompetitors.length > 0 ? 12 : 0 }}>
          <NumberCircle text={initial} size={44} color={CLIGHT} bg="#fff" fontSize={16} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 14, color: AZUL, marginBottom: 3 }}>{seg.label}</Text>
            <Text style={{ fontSize: 10.5, color: CMID, fontFamily: 'PlusJakartaSans' }}>
              {seg.totalStudents > 0
                ? `A escola não atua neste segmento — ${fmtNum(seg.totalActive)} escolas atendem ${fmtNum(seg.totalStudents)} alunos aqui.`
                : 'A escola não atua neste segmento.'}
            </Text>
          </View>
        </View>
        <CompetitorMiniList items={seg.topCompetitors} />
      </View>
    )
  }

  const isLeader = seg.ranking === 1
  const color = seg.ranking != null ? rankColor(seg.ranking, seg.totalActive) : VM
  const bg = isLeader ? SOFT : (color === WARN ? WARN_BG : '#F0FDFA')
  const badgeText = isLeader ? 'Líder de mercado' : `${seg.ranking}º de ${seg.totalActive}`

  return (
    <View style={{ backgroundColor: bg, borderWidth: 1.5, borderColor: color, borderRadius: 14, padding: 18, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <NumberCircle text={seg.ranking != null ? `${seg.ranking}º` : initial} size={52} color={color} bg="#fff" fontSize={18} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 15, color: AZUL, marginBottom: 4 }}>{seg.label}</Text>
          <Badge text={badgeText} color={color} bg="#fff" />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 9, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'PlusJakartaSans' }}>Market share</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 18, color }}>{seg.marketSharePct != null ? fmtPct(seg.marketSharePct) : '—'}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 10, color: CMID, marginBottom: 10, fontFamily: 'PlusJakartaSans' }}>
        {`${fmtNum(seg.totalStudents)} alunos matriculados nesse segmento, entre ${seg.totalActive} escolas privadas do município.`}
      </Text>

      {!isLeader && seg.leaderName && (
        <Text style={{ fontSize: 10, color: CMID, marginBottom: 10, fontFamily: 'PlusJakartaSans' }}>
          {`Líder do segmento: ${seg.leaderName} (${fmtNum(seg.leaderValue)} matrículas)`}
        </Text>
      )}

      <Bar
        label="Sua escola"
        value={seg.schoolValue}
        max={Math.max(seg.schoolValue, cityAvg, 1)}
        color={color}
        valueLabel={fmtNum(seg.schoolValue)}
        highlight
      />
      <Bar
        label="Média do município"
        value={cityAvg}
        max={Math.max(seg.schoolValue, cityAvg, 1)}
        color={CLIGHT}
        valueLabel={fmtNum(cityAvg)}
      />

      <CompetitorMiniList items={seg.topCompetitors} />
    </View>
  )
}

function Page7({ m }: { m: RaioXMetrics }) {
  const cityAvgByKey: Record<SegmentMetric['key'], number> = {
    inf: m.cityAvgInf,
    fund: m.cityAvgFund,
    med: m.cityAvgMed,
  }
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Etapas de Ensino</Tag>
      <Text style={s.title}>Ranking e participação por segmento educacional</Text>

      {m.segments.map(seg => (
        <SegmentCard key={seg.key} seg={seg} cityAvg={cityAvgByKey[seg.key]} />
      ))}
    </Page>
  )
}

// ─── PAGE 8 — COMPARATIVO GERAL + INTERPRETAÇÃO ───────────────────────────────
function Page8({ m, interpretation }: { m: RaioXMetrics; interpretation: string[] }) {
  const cell = (text: string, opts?: { bold?: boolean; align?: 'left' | 'right' }) => (
    <Text style={{ fontSize: 11, color: opts?.bold ? VD : CMID, fontWeight: opts?.bold ? 700 : 500, textAlign: opts?.align ?? 'left', fontFamily: 'PlusJakartaSans' }}>{text}</Text>
  )

  const rows: [string, string, string][] = [
    ['Matrículas totais',       fmtNum(m.qtMatTotal),                                    fmtNum(m.avgStudentsPerSchool)],
    ['Ranking no município',    `${m.ranking}º de ${m.rankingTotal}`,                    '—'],
    ['Participação de mercado', fmtPct(m.marketSharePct),                                fmtPct(m.rankingTotal > 0 ? 100 / m.rankingTotal : 0)],
    ['Educação Infantil',       m.qtMatInf  != null ? fmtNum(m.qtMatInf)  : '—',          fmtNum(m.cityAvgInf)],
    ['Ensino Fundamental',      m.qtMatFund != null ? fmtNum(m.qtMatFund) : '—',          fmtNum(m.cityAvgFund)],
    ['Ensino Médio',            m.qtMatMed  != null ? fmtNum(m.qtMatMed)  : '—',          fmtNum(m.cityAvgMed)],
  ]

  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Comparativo Geral</Tag>
      <Text style={s.title}>Sua escola vs. média de {m.city}/{m.state}</Text>

      <Table
        headers={[
          { label: 'Indicador',        flex: 2 },
          { label: 'Sua escola',       flex: 1, align: 'right' },
          { label: 'Média da cidade',  flex: 1, align: 'right' },
        ]}
        rows={rows.map(([label, school, avg]) => [
          cell(label, { bold: true }),
          cell(school, { align: 'right' }),
          cell(avg, { align: 'right' }),
        ])}
      />

      <Text style={{ fontSize: 11.5, fontWeight: 700, color: CMID, marginTop: 22, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'PlusJakartaSans' }}>
        Interpretação
      </Text>
      {interpretation.map((p, i) => <InsightCard key={i} text={p} />)}
    </Page>
  )
}

// ─── PAGE 9 — COMO A ÁION EDU PODE AJUDAR (diferenciais) ──────────────────────
// mesmo conteúdo do carrossel exibido em RaioXPage.tsx durante a geração do relatório
const AION_BENEFITS = [
  { title: 'Criamos sua campanha de matrícula com você', desc: 'A Áion não entrega só um sistema - montamos a campanha junto e acompanhamos os resultados automaticamente.' },
  { title: 'CRM feito especialmente para escolas',        desc: 'Não é um sistema genérico adaptado - foi construído pensando na realidade da gestão educacional.' },
  { title: 'Relatórios de campanha completos',            desc: 'Veja exatamente de onde vêm seus leads e o que está funcionando, sem precisar montar planilha.' },
  { title: 'Mais de 10 módulos, um único clique',         desc: 'Tudo organizado numa única tela - sem dor de cabeça pra gerar nada.' },
  { title: 'O melhor custo-benefício do mercado educacional', desc: 'Tecnologia completa por um investimento que cabe no orçamento da sua escola.' },
]

function Page9({ m }: { m: RaioXMetrics }) {
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { paddingVertical: 32, paddingHorizontal: 38 }]}>
      <Tag>Por que a Áion Edu</Tag>
      <Text style={s.title}>{`O que muda para ${m.schoolName}`}</Text>

      <Text style={{ fontSize: 11, color: CMID, lineHeight: 1.6, marginBottom: 18, fontFamily: 'PlusJakartaSans' }}>
        {'A campanha de matrículas da sua escola começa AGORA com a '}
        <Text style={{ fontWeight: 700, color: VD }}>ÁION EDU</Text>
        {'. Lemos os dados da sua escola, criamos um plano de campanha com metas e ações, centralizamos o atendimento das famílias e entregamos ao gestor visibilidade total — do primeiro contato até a matrícula assinada.'}
      </Text>

      {AION_BENEFITS.map((b, i) => (
        <View key={b.title} style={{ flexDirection: 'row', gap: 14, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 14, padding: 14, marginBottom: 9 }}>
          <NumberCircle text={String(i + 1)} size={30} color={VD} bg={SOFT} fontSize={13} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 12, color: AZUL, marginBottom: 4, lineHeight: 1.3 }}>{b.title}</Text>
            <Text style={{ fontSize: 9.5, color: CMID, lineHeight: 1.5, fontFamily: 'PlusJakartaSans' }}>{b.desc}</Text>
          </View>
        </View>
      ))}

      <View style={{ backgroundColor: VD, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 22, marginTop: 4 }}>
        <Text style={{ fontSize: 12.5, color: '#fff', lineHeight: 1.7, fontFamily: 'PlusJakartaSans', fontStyle: 'italic' }}>
          {'"Enquanto sua equipe foca em encantar as famílias, a Áion Edu cuida da organização, dos alertas e dos números — para nenhuma matrícula ficar pelo caminho."'}
        </Text>
      </View>
    </Page>
  )
}

// ─── PAGE 10 — CTA FINAL ───────────────────────────────────────────────────────
function Page10({ m }: { m: RaioXMetrics }) {
  const pillars = ['Mais Controle', 'Mais Previsibilidade', 'Mais Matrículas']
  return (
    <Page size="A4" orientation="portrait" style={[s.page, { backgroundColor: VD, paddingVertical: 48, paddingHorizontal: 40, alignItems: 'center', justifyContent: 'center' }]}>
      <LogoPill height={22} />

      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 26, color: '#fff', textAlign: 'center', marginTop: 24, marginBottom: 16, lineHeight: 1.25 }}>
        {`${m.schoolName} pronta para a próxima campanha`}
      </Text>

      <Text style={{ fontSize: 12, color: '#B2D8CE', textAlign: 'center', lineHeight: 1.7, marginBottom: 26, fontFamily: 'PlusJakartaSans' }}>
        Fale com a nossa equipe e veja, na prática, como a Áion Edu se encaixa na rotina da sua escola.
      </Text>

      <View style={{ gap: 10, marginBottom: 30, alignItems: 'center' }}>
        {pillars.map(label => (
          <View key={label} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 100, paddingVertical: 8, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>{label}</Text>
          </View>
        ))}
      </View>

      <Link src="https://wa.me/5583993444383?text=Ol%C3%A1!%20Vi%20o%20Raio-X%20Estrat%C3%A9gico%20da%20minha%20escola%20e%20quero%20uma%20demonstra%C3%A7%C3%A3o.">
        <View style={{ backgroundColor: VC, borderRadius: 100, paddingVertical: 16, paddingHorizontal: 36 }}>
          <Text style={{ fontSize: 15, fontWeight: 800, color: VD, fontFamily: 'PlusJakartaSans' }}>Solicite uma demonstração gratuita</Text>
        </View>
      </Link>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 16, fontFamily: 'PlusJakartaSans' }}>aionedu.com.br · Todos os direitos reservados</Text>
    </Page>
  )
}

// ─── Document export ──────────────────────────────────────────────────────────
export interface RaioXPdfData {
  metrics: RaioXMetrics
  directorName: string
  generatedDate: string
}

export default function RaioXPdfDocument({ data }: { data: RaioXPdfData }) {
  const { metrics: m } = data
  const interpretation = buildInterpretation(m)
  const headline = interpretation[0] ?? ''

  return (
    <Document>
      <Page1 m={m} generatedDate={data.generatedDate} />
      <Page2 m={m} headline={headline} />
      <Page3 m={m} />
      <Page4 m={m} />
      <Page5 m={m} />
      <Page6 m={m} />
      <Page7 m={m} />
      <Page8 m={m} interpretation={interpretation} />
      <Page9 m={m} />
      <Page10 m={m} />
    </Document>
  )
}
