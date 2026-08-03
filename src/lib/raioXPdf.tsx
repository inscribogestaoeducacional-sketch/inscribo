// Buffer polyfill for react-pdf in browser
import { Buffer } from 'buffer'
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  ;(globalThis as any).Buffer = Buffer
}

import React from 'react'
import { Document, Page, View, Text, Image, Link, Font, StyleSheet } from '@react-pdf/renderer'
import AION_LOGO_B64 from './aionLogo'
import { buildInterpretation, type RaioXMetrics, type CompetitorRow } from './raioXMetrics'

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
const VD     = '#00523C'
const VM     = '#00A896'
const VC     = '#0DD3BF'
const AZUL   = '#1A2B4A'
const CMID   = '#64748B'
const CLIGHT = '#94A3B8'
const BORDA  = '#E2E8F0'
const SOFT   = '#E6F7F4'

const NO_DATA_TEXT = 'Não há informações públicas suficientes para este indicador.'

const fmtNum = (v: number) => Math.round(v).toLocaleString('pt-BR')
const fmtPct = (v: number) => `${v.toFixed(1)}%`

// ─── Shared styles ────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page:    { fontFamily: 'PlusJakartaSans', fontSize: 11 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F7F4', borderRadius: 100, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 6, alignSelf: 'flex-start' },
  tagDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: VM, marginRight: 6 },
  tagText: { fontSize: 9, fontWeight: 700, color: VM, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'PlusJakartaSans' },
  sbarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sbarLine:{ width: 4, height: 32, backgroundColor: VM, borderRadius: 2, marginRight: 12 },
  sbarText:{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: VD },
  title:   { fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: AZUL, marginBottom: 16, marginTop: 2 },
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

function LogoPill({ height = 22 }: { height?: number }) {
  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 18, alignSelf: 'flex-start' }}>
      <Image src={AION_LOGO_B64} style={{ height }} />
    </View>
  )
}

function StatCard({ label, value, width }: { label: string; value: string; width?: string | number }) {
  return (
    <View style={{ width: width ?? '47%', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 10, padding: 14 }}>
      <Text style={{ fontSize: 9, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: AZUL }}>{value}</Text>
    </View>
  )
}

function BigStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDA, borderRadius: 14, paddingVertical: 22, paddingHorizontal: 20 }}>
      <Text style={{ fontSize: 9, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 34, color: VD, marginBottom: 6 }}>{value}</Text>
      <Text style={{ fontSize: 10, color: CMID, lineHeight: 1.5, fontFamily: 'PlusJakartaSans' }}>{sub}</Text>
    </View>
  )
}

function NoDataBanner({ label }: { label: string }) {
  return (
    <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 8 }}>
      <Text style={{ fontSize: 10, fontWeight: 700, color: '#92400E', marginBottom: 2, fontFamily: 'PlusJakartaSans' }}>{label}</Text>
      <Text style={{ fontSize: 9, color: '#78350F', fontFamily: 'PlusJakartaSans' }}>{NO_DATA_TEXT}</Text>
    </View>
  )
}

// barra horizontal simples desenhada com View — @react-pdf/renderer não tem gráficos nativos
function Bar({ label, value, max, color, valueLabel, highlight }: {
  label: string; value: number; max: number; color: string; valueLabel: string; highlight?: boolean
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: 10, color: highlight ? VD : AZUL, fontWeight: highlight ? 800 : 600, fontFamily: 'PlusJakartaSans', maxWidth: 320 }}>{label}</Text>
        <Text style={{ fontSize: 10, color: CMID, fontFamily: 'PlusJakartaSans' }}>{valueLabel}</Text>
      </View>
      <View style={{ height: 10, backgroundColor: '#F1F5F9', borderRadius: 6 }}>
        <View style={{ height: 10, width: `${pct}%`, backgroundColor: color, borderRadius: 6 }} />
      </View>
    </View>
  )
}

// tabela simples com cabeçalho fixo — usada em concorrentes e comparativo geral
function Table({ headers, rows }: { headers: { label: string; flex: number; align?: 'left' | 'right' }[]; rows: React.ReactNode[][] }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1.5, borderBottomColor: AZUL, paddingBottom: 8, marginBottom: 4 }}>
        {headers.map(h => (
          <Text key={h.label} style={{ flex: h.flex, fontSize: 9, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h.align ?? 'left', fontFamily: 'PlusJakartaSans' }}>{h.label}</Text>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 8 }}>
          {row.map((cell, j) => (
            <View key={j} style={{ flex: headers[j].flex }}>{cell}</View>
          ))}
        </View>
      ))}
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
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: VD, padding: 32 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <LogoPill />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,211,191,0.18)', borderRadius: 100, paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: VC }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: VC, marginRight: 6 }} />
          <Text style={{ fontSize: 10, fontWeight: 600, color: VC, fontFamily: 'PlusJakartaSans' }}>Relatório Confidencial</Text>
        </View>
      </View>

      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 34, color: '#fff', marginBottom: 12, lineHeight: 1.1 }}>
        {'Raio-X Estratégico\nda Escola'}
      </Text>
      <Text style={{ fontSize: 12, color: '#B2D8CE', marginBottom: 26, lineHeight: 1.6, fontFamily: 'PlusJakartaSans' }}>
        Análise de posicionamento de mercado com base nos dados oficiais do Censo Escolar INEP.
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: 520 }}>
        {cards.map(c => (
          <View key={c.label} style={{ width: 248, backgroundColor: '#1A6B52', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2A7A60' }}>
            <Text style={{ fontSize: 9, color: '#9ECFC4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600, fontFamily: 'PlusJakartaSans' }}>{c.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>{c.value}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

// ─── PAGE 2 — RESUMO EXECUTIVO ────────────────────────────────────────────────
function Page2({ m, headline }: { m: RaioXMetrics; headline: string }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Resumo Executivo</Tag>
      <Text style={s.title}>Como {m.schoolName} está posicionada</Text>

      <View style={{ flexDirection: 'row', gap: 18, marginBottom: 18 }}>
        <View style={{ width: 210, backgroundColor: SOFT, borderWidth: 1, borderColor: 'rgba(0,168,150,0.3)', borderRadius: 16, paddingVertical: 22, paddingHorizontal: 18, alignItems: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontFamily: 'PlusJakartaSans' }}>Score de Mercado</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 54, color: VD, lineHeight: 1 }}>{m.marketScore}</Text>
          <Text style={{ fontSize: 10, color: CLIGHT, marginBottom: 10, fontFamily: 'PlusJakartaSans' }}>de 100 pontos</Text>
          <View style={{ backgroundColor: VM, borderRadius: 100, paddingVertical: 5, paddingHorizontal: 14 }}>
            <Text style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>{m.scoreLabel}</Text>
          </View>
        </View>

        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <StatCard label="Ranking no município"          value={`${m.ranking}º de ${m.rankingTotal}`} />
          <StatCard label="Participação de mercado"        value={fmtPct(m.marketSharePct)} />
          <StatCard label="Matrículas totais"               value={fmtNum(m.qtMatTotal)} />
          <StatCard label="Escolas privadas concorrentes"  value={fmtNum(m.totalPrivateSchools)} />
        </View>
      </View>

      <View style={{ backgroundColor: VD, borderRadius: 8, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 11, color: '#fff', lineHeight: 1.6, fontFamily: 'PlusJakartaSans' }}>{headline}</Text>
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
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Panorama do Mercado</Tag>
      <Text style={s.title}>Indicadores de {m.city}/{m.state}</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {indicators.map(i => <StatCard key={i.label} label={i.label} value={i.value} width="47%" />)}
      </View>

      <Text style={{ fontSize: 11, fontWeight: 700, color: CMID, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'PlusJakartaSans' }}>
        Outros indicadores de mercado
      </Text>
      <NoDataBanner label="Desempenho médio no ENEM (rede privada regional)" />
      <NoDataBanner label="Renda média e perfil socioeconômico das famílias (IBGE)" />
    </Page>
  )
}

// ─── PAGE 4 — RANKING ─────────────────────────────────────────────────────────
function Page4({ m }: { m: RaioXMetrics }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#F8FAFC', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Ranking</Tag>
      <Text style={s.title}>Posição de {m.schoolName} no mercado local</Text>

      <View style={{ flexDirection: 'row', gap: 18 }}>
        <BigStat
          label="Posição atual"
          value={`${m.ranking}º`}
          sub={`de ${m.rankingTotal} escolas privadas em ${m.city}/${m.state}`}
        />
        <BigStat
          label="Distância para a líder"
          value={m.distanceToLeader > 0 ? fmtNum(m.distanceToLeader) : '—'}
          sub={m.distanceToLeader > 0 ? 'matrículas para alcançar a 1ª colocada do município' : 'A escola já lidera o mercado local'}
        />
        <BigStat
          label="Distância para o Top 5"
          value={m.ranking <= 5 ? '—' : fmtNum(m.distanceToTop5)}
          sub={m.ranking <= 5 ? 'A escola já está entre as 5 maiores do município' : 'matrículas para entrar no Top 5 do município'}
        />
      </View>
    </Page>
  )
}

// ─── PAGE 5 — PRINCIPAIS CONCORRENTES ─────────────────────────────────────────
function Page5({ m }: { m: RaioXMetrics }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Concorrência</Tag>
      <Text style={s.title}>Principais escolas privadas de {m.city}/{m.state}</Text>

      <Table
        headers={[
          { label: '#',           flex: 0.5 },
          { label: 'Escola',      flex: 3 },
          { label: 'Matrículas',  flex: 1.2, align: 'right' },
          { label: 'Market share', flex: 1.2, align: 'right' },
        ]}
        rows={m.topCompetitors.map((c: CompetitorRow) => [
          <Text style={{ fontSize: 10, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, fontFamily: 'PlusJakartaSans' }}>{c.rank}º</Text>,
          <Text style={{ fontSize: 10, color: c.isSelected ? VD : AZUL, fontWeight: c.isSelected ? 800 : 500, fontFamily: 'PlusJakartaSans' }}>
            {c.no_entidade}{c.isSelected ? '  (sua escola)' : ''}
          </Text>,
          <Text style={{ fontSize: 10, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, textAlign: 'right', fontFamily: 'PlusJakartaSans' }}>{fmtNum(c.qt_mat_total)}</Text>,
          <Text style={{ fontSize: 10, color: c.isSelected ? VD : CMID, fontWeight: c.isSelected ? 800 : 500, textAlign: 'right', fontFamily: 'PlusJakartaSans' }}>{fmtPct(c.marketSharePct)}</Text>,
        ])}
      />
    </Page>
  )
}

// ─── PAGE 6 — PARTICIPAÇÃO DE MERCADO ─────────────────────────────────────────
function Page6({ m }: { m: RaioXMetrics }) {
  const maxVal = Math.max(1, ...m.topCompetitors.map(c => c.qt_mat_total))
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Participação de Mercado</Tag>
      <Text style={s.title}>Distribuição de matrículas entre as principais escolas</Text>

      {m.topCompetitors.map(c => (
        <Bar
          key={c.co_entidade}
          label={`${c.rank}º · ${c.no_entidade}${c.isSelected ? ' (sua escola)' : ''}`}
          value={c.qt_mat_total}
          max={maxVal}
          color={c.isSelected ? VD : VM}
          valueLabel={`${fmtNum(c.qt_mat_total)} alunos · ${fmtPct(c.marketSharePct)}`}
          highlight={c.isSelected}
        />
      ))}
    </Page>
  )
}

// ─── PAGE 7 — DISTRIBUIÇÃO POR ETAPA DE ENSINO ────────────────────────────────
function Page7({ m }: { m: RaioXMetrics }) {
  const stages = [
    { label: 'Educação Infantil',  school: m.qtMatInf,  cityAvg: m.cityAvgInf },
    { label: 'Ensino Fundamental', school: m.qtMatFund, cityAvg: m.cityAvgFund },
    { label: 'Ensino Médio',       school: m.qtMatMed,  cityAvg: m.cityAvgMed },
  ]
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
      <Tag>Etapas de Ensino</Tag>
      <Text style={s.title}>{m.schoolName} vs. média do município</Text>

      {stages.map(st => {
        const max = Math.max(st.school ?? 0, st.cityAvg, 1)
        return (
          <View key={st.label} style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: AZUL, marginBottom: 8, fontFamily: 'PlusJakartaSans' }}>{st.label}</Text>
            <Bar label="Sua escola" value={st.school ?? 0} max={max} color={VD}
              valueLabel={st.school != null ? fmtNum(st.school) : 'Sem dado'} highlight />
            <Bar label="Média do município" value={st.cityAvg} max={max} color={CLIGHT}
              valueLabel={fmtNum(st.cityAvg)} />
          </View>
        )
      })}
    </Page>
  )
}

// ─── PAGE 8 — COMPARATIVO GERAL + INTERPRETAÇÃO ───────────────────────────────
function Page8({ m, interpretation }: { m: RaioXMetrics; interpretation: string[] }) {
  const cell = (text: string, opts?: { bold?: boolean; align?: 'left' | 'right' }) => (
    <Text style={{ fontSize: 10, color: opts?.bold ? VD : CMID, fontWeight: opts?.bold ? 700 : 500, textAlign: opts?.align ?? 'left', fontFamily: 'PlusJakartaSans' }}>{text}</Text>
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
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', paddingVertical: 28, paddingHorizontal: 42 }]}>
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

      <Text style={{ fontSize: 11, fontWeight: 700, color: CMID, marginTop: 18, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'PlusJakartaSans' }}>
        Interpretação
      </Text>
      {interpretation.map((p, i) => (
        <Text key={i} style={{ fontSize: 10.5, color: AZUL, lineHeight: 1.6, marginBottom: 6, fontFamily: 'PlusJakartaSans' }}>{p}</Text>
      ))}
    </Page>
  )
}

// ─── PAGE 9 — COMO A ÁION EDU PODE AJUDAR + CTA ───────────────────────────────
function Page9({ m }: { m: RaioXMetrics }) {
  const pillars = ['Mais Controle', 'Mais Previsibilidade', 'Mais Matrículas']
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: VD, paddingVertical: 36, paddingHorizontal: 48, alignItems: 'center', justifyContent: 'center' }]}>
      <LogoPill height={20} />

      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 27, color: '#fff', textAlign: 'center', maxWidth: 560, marginTop: 20, marginBottom: 14, lineHeight: 1.2 }}>
        {`Como a Áion Edu pode ajudar ${m.schoolName}`}
      </Text>

      <Text style={{ fontSize: 11, color: '#B2D8CE', textAlign: 'center', maxWidth: 520, lineHeight: 1.7, marginBottom: 22, fontFamily: 'PlusJakartaSans' }}>
        {'A campanha de matrículas da sua escola começa AGORA com a '}
        <Text style={{ fontWeight: 700, color: '#fff' }}>ÁION EDU</Text>
        {'! Lemos os dados da sua escola, criamos um plano de campanha com metas e ações, centralizamos o atendimento das famílias e entregamos ao gestor visibilidade total — do primeiro contato até a matrícula assinada.'}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 26 }}>
        {pillars.map((label, i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 ? <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 18 }} /> : null}
            <Text style={{ fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: 'PlusJakartaSans' }}>{label}</Text>
          </View>
        ))}
      </View>

      <Link src="https://wa.me/5583993444383?text=Ol%C3%A1!%20Vi%20o%20Raio-X%20Estrat%C3%A9gico%20da%20minha%20escola%20e%20quero%20uma%20demonstra%C3%A7%C3%A3o.">
        <View style={{ backgroundColor: VC, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 14, fontWeight: 800, color: VD, fontFamily: 'PlusJakartaSans' }}>Solicite uma demonstração gratuita</Text>
        </View>
      </Link>
      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 14, fontFamily: 'PlusJakartaSans' }}>aionedu.com.br · Todos os direitos reservados</Text>
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
    </Document>
  )
}
