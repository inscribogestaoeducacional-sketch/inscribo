import React from 'react'
import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer'
import type { ProposalData } from '../components/superadmin/ProposalContent'

// ─── Fonts ────────────────────────────────────────────────────────────────────
Font.register({
  family: 'BricolageGrotesque',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/bricolagegrotesque/v9/pxiDypAnsdxUm159X7D-XV9GNjODsRf.woff2', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/bricolagegrotesque/v9/pxiDypAnsdxUm159X7D-XV9GNjODsRf.woff2', fontWeight: 800 },
    { src: 'https://fonts.gstatic.com/s/bricolagegrotesque/v9/pxiDypAnsdxUm159X7D-XV9GNjODsRf.woff2', fontWeight: 900 },
  ],
})
Font.register({
  family: 'PlusJakartaSans',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg.woff2', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg.woff2', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg.woff2', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/plusjakartasans/v8/LDIoaomQNQcsA88c7O9yZ4KMCoOg.woff2', fontWeight: 800 },
  ],
})

// ─── Tokens ───────────────────────────────────────────────────────────────────
const VD     = '#00523C'
const VM     = '#00A896'
const VC     = '#0DD3BF'
const AZUL   = '#1A2B4A'
const CMID   = '#64748B'
const CLIGHT = '#94A3B8'
const BORDA  = '#E2E8F0'

const fmtBRL = (v: number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { fontFamily: 'PlusJakartaSans', fontSize: 11 },

  // Shared
  row:     { flexDirection: 'row' },
  col:     { flexDirection: 'column' },
  center:  { alignItems: 'center', justifyContent: 'center' },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: VM },
  circle:  { width: 16, height: 16, borderRadius: 8, backgroundColor: VM },

  // Tag pill
  tagWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F7F4', borderRadius: 100, paddingVertical: 4, paddingHorizontal: 12, marginBottom: 6, alignSelf: 'flex-start' },
  tagDot:  { width: 5, height: 5, borderRadius: 3, backgroundColor: VM, marginRight: 6 },
  tagText: { fontSize: 9, fontWeight: 700, color: VM, textTransform: 'uppercase', letterSpacing: 1 },

  // SectionBar
  sbarWrap: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sbarLine: { width: 4, height: 32, backgroundColor: VM, borderRadius: 2, marginRight: 12 },
  sbarText: { fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: VD },
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

function SectionBar({ text }: { text: string }) {
  return (
    <View style={s.sbarWrap}>
      <View style={s.sbarLine} />
      <Text style={s.sbarText}>{text}</Text>
    </View>
  )
}

function LogoPill({ height = 22 }: { height?: number }) {
  return (
    <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 18, alignSelf: 'flex-start' }}>
      <Image src="/aion-logo-full.png" style={{ height }} />
    </View>
  )
}

// ─── MODULE LIST ─────────────────────────────────────────────────────────────
const MODULES = [
  { name: 'Início / Dashboard', desc: 'Visão geral da campanha, metas e indicadores em tempo real.' },
  { name: 'Leads',              desc: 'Pipeline completo do lead até a matrícula, com histórico.' },
  { name: 'Contatos',           desc: 'Cadastro centralizado de famílias e responsáveis.' },
  { name: 'Visitas',            desc: 'Agendamento, confirmação e taxa de comparecimento.' },
  { name: 'WhatsApp',           desc: 'Equipe toda atendendo no número oficial Meta da escola.' },
  { name: 'Relatórios',         desc: 'Conversão, CPA, desempenho por consultor e rematrícula.' },
  { name: 'Transferências',     desc: 'Rastreia motivo real da saída e oportunidades de retenção.' },
  { name: 'Pesquisas',          desc: 'NPS e satisfação das famílias organizados por IA.' },
  { name: 'Usuários',           desc: 'Gestão de equipe com permissões e produtividade.' },
  { name: 'Configurações',      desc: 'Personalização completa dos fluxos da escola.' },
]

const HOW_STEPS = [
  { num: '01', title: 'Implantação', desc: 'Configuramos tudo em até 5 dias úteis' },
  { num: '02', title: 'Treinamento', desc: 'Sua equipe aprende na prática, com suporte direto' },
  { num: '03', title: 'Suporte',     desc: 'Acompanhamento contínuo durante toda a campanha' },
]

const INCLUDES = [
  'Configuração completa da conta',
  'Integração com ERP da escola',
  'Homologação WhatsApp Oficial Meta',
  'Personalização dos fluxos',
  'Definição das metas iniciais',
  'Treinamento da equipe',
]

const ALSO_INCLUDED = ['Suporte via WhatsApp', 'Relatório mensal', 'Atualizações gratuitas']

// ─── Page 1 — CAPA ────────────────────────────────────────────────────────────
function Page1({ data, proposalDate }: { data: ProposalData; proposalDate: string }) {
  const cards = [
    { label: 'Apresentado para', value: data.client_name || '—' },
    { label: 'Escola',           value: data.school_name || '—' },
    { label: 'Consultor',        value: data.consultant_name || '—' },
    { label: 'Data',             value: proposalDate },
  ]

  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: VD, padding: 32 }]}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <LogoPill />
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,211,191,0.18)', borderRadius: 100, paddingVertical: 6, paddingHorizontal: 16, borderWidth: 1, borderColor: VC }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: VC, marginRight: 6 }} />
          <Text style={{ fontSize: 10, fontWeight: 600, color: VC }}>Proposta Comercial</Text>
        </View>
      </View>

      {/* Title block */}
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 34, color: '#fff', marginBottom: 12, lineHeight: 1.1 }}>
        Plataforma de Matrículas e{'\n'}Atendimento Escolar
      </Text>
      <Text style={{ fontSize: 12, color: '#B2D8CE', marginBottom: 26, lineHeight: 1.6 }}>
        Da primeira visita ao aluno matriculado — gestão completa do ciclo de captação.
      </Text>

      {/* 2×2 info grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, maxWidth: 520 }}>
        {cards.map(c => (
          <View key={c.label} style={{ width: 248, backgroundColor: '#1A6B52', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#2A7A60' }}>
            <Text style={{ fontSize: 9, color: '#9ECFC4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 }}>{c.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{c.value}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

// ─── Page 2 — SOBRE + 10 MÓDULOS ─────────────────────────────────────────────
function Page2() {
  const rows: (typeof MODULES)[] = [MODULES.slice(0, 5), MODULES.slice(5)]

  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', padding: '24 36' }]}>
      <SectionBar text="Sobre a Áion Edu" />

      <Text style={{ fontSize: 11, color: CMID, lineHeight: 1.6, marginBottom: 14 }}>
        A campanha de matrículas da sua escola começa AGORA com a{' '}
        <Text style={{ fontWeight: 700, color: VD }}>ÁION EDU</Text>! Lemos os dados da sua escola, criamos
        um plano de campanha com metas e ações, centralizamos o atendimento das famílias e
        entregamos ao gestor visibilidade total — do primeiro contato até a matrícula assinada.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 15, color: AZUL }}>10 módulos. Em um só lugar.</Text>
        <Text style={{ fontSize: 10, color: CMID }}>Integrados, inteligentes e prontos para a sua campanha.</Text>
      </View>

      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 7, marginBottom: 7 }}>
          {row.map(mod => (
            <View key={mod.name} style={{ flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 10, padding: '10 7', alignItems: 'center' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: VM, marginBottom: 6 }} />
              <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 9, color: AZUL, textAlign: 'center', marginBottom: 3, lineHeight: 1.3 }}>{mod.name}</Text>
              <Text style={{ fontSize: 8, color: CMID, textAlign: 'center', lineHeight: 1.4 }}>{mod.desc}</Text>
            </View>
          ))}
        </View>
      ))}

      <View style={{ backgroundColor: VD, borderRadius: 8, padding: '10 16', flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 9, fontWeight: 700, color: VD }}>✓</Text>
        </View>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>Sua secretaria configura em 2 dias. Sem projeto, sem TI, sem custo oculto.</Text>
      </View>
    </Page>
  )
}

// ─── Page 3 — COMO FUNCIONA ───────────────────────────────────────────────────
function Page3() {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#F8FAFC', padding: '40 56', justifyContent: 'center' }]}>
      <View style={{ marginBottom: 28 }}>
        <Tag>Metodologia</Tag>
        <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 26, color: AZUL, marginTop: 4 }}>Como funciona</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 18 }}>
        {HOW_STEPS.map(step => (
          <View key={step.num} style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: BORDA, borderRadius: 14, padding: '32 24' }}>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 52, color: VC, lineHeight: 1, marginBottom: 16 }}>{step.num}</Text>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 18, color: AZUL, marginBottom: 10 }}>{step.title}</Text>
            <Text style={{ fontSize: 13, color: CMID, lineHeight: 1.6 }}>{step.desc}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

// ─── Page 4 — INVESTIMENTO ────────────────────────────────────────────────────
function Page4({ data, deadline }: { data: ProposalData; deadline: string | null }) {
  const isFreeImpl = Number(data.implementation_special) === 0

  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#F0F4F8', padding: '26 36' }]}>
      {deadline && (
        <View style={{ backgroundColor: VD, borderRadius: 10, padding: '14 22', marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: VC }} />
          <View>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 700, fontSize: 13, color: '#fff' }}>Condição especial válida até {deadline}</Text>
            <Text style={{ fontSize: 11, color: '#B2D8CE', marginTop: 2 }}>Garanta agora — após essa data os valores retornam ao normal.</Text>
          </View>
        </View>
      )}

      <Tag>Investimento</Tag>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 20, color: AZUL, marginBottom: 16, marginTop: 2 }}>
        Condições especiais para a sua escola
      </Text>

      <View style={{ flexDirection: 'row', gap: 18 }}>
        {/* Card Implantação */}
        <View style={{ flex: 1, backgroundColor: '#E6F7F4', borderWidth: 1, borderColor: 'rgba(0,168,150,0.3)', borderRadius: 16, padding: '22 24' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: VM, marginBottom: 8 }} />
          <Text style={{ fontSize: 9, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Taxa de Implantação</Text>
          <Text style={{ fontSize: 11, color: CLIGHT, textDecoration: 'line-through', marginBottom: 8 }}>De: {fmtBRL(data.implementation_normal)}</Text>

          {isFreeImpl ? (
            <>
              <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 48, color: VD, lineHeight: 1, letterSpacing: -1, marginBottom: 8 }}>GRÁTIS</Text>
              <Text style={{ fontSize: 11, color: VD, fontWeight: 600 }}>Implantação gratuita · Setup completo</Text>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 48, color: VD, lineHeight: 1, letterSpacing: -1, marginBottom: 6 }}>{fmtBRL(data.implementation_special)}</Text>
              <Text style={{ fontSize: 11, color: VM, fontWeight: 600 }}>Economia de {fmtBRL(data.implementation_normal - data.implementation_special)}</Text>
            </>
          )}
          <Text style={{ fontSize: 9, color: CLIGHT, marginTop: 10 }}>Válido para fechamento no prazo da proposta</Text>
        </View>

        {/* Card Mensalidade */}
        <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 2, borderColor: VM, borderRadius: 16, padding: '22 24' }}>
          <View style={{ backgroundColor: VM, borderRadius: 100, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-end', marginBottom: 8 }}>
            <Text style={{ fontSize: 8, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>ESPECIAL</Text>
          </View>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: VM, marginBottom: 8 }} />
          <Text style={{ fontSize: 9, fontWeight: 700, color: CMID, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Mensalidade da Plataforma</Text>
          <Text style={{ fontSize: 11, color: CLIGHT, textDecoration: 'line-through', marginBottom: 8 }}>De: {fmtBRL(data.monthly_normal)}/mês</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6 }}>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 48, color: VD, lineHeight: 1, letterSpacing: -1 }}>{fmtBRL(data.monthly_special)}</Text>
            <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 600, fontSize: 16, color: VD, marginBottom: 4, marginLeft: 2 }}>/mês</Text>
          </View>
          <Text style={{ fontSize: 12, color: VM, fontWeight: 700, marginBottom: 5 }}>Você economiza {fmtBRL(data.monthly_normal - data.monthly_special)}/mês</Text>
          <Text style={{ fontSize: 11, color: CMID }}>Acesso completo · Todos os 10 módulos</Text>
        </View>
      </View>
    </Page>
  )
}

// ─── Page 5 — INCLUSO ─────────────────────────────────────────────────────────
function Page5({ data, deadline }: { data: ProposalData; deadline: string | null }) {
  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: '#fff', padding: '28 42' }]}>
      <Tag>Incluso</Tag>
      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 22, color: AZUL, marginBottom: 14, marginTop: 2 }}>
        O que está incluso na implantação
      </Text>

      {/* 3×2 grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        {INCLUDES.map(item => (
          <View key={item} style={{ width: '31%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: '12 14', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: VD, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</Text>
            </View>
            <Text style={{ fontSize: 11, color: AZUL, fontWeight: 500, lineHeight: 1.3 }}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={{ fontSize: 11, fontWeight: 700, color: CMID, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Também incluso:</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {ALSO_INCLUDED.map(label => (
          <View key={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: BORDA, borderRadius: 10, padding: '12 14' }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: VM, flexShrink: 0 }} />
            <Text style={{ fontSize: 12, fontWeight: 600, color: AZUL }}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 12, padding: '16 22', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>!</Text>
        </View>
        <View>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 13, color: '#92400E', marginBottom: 3 }}>
            Proposta válida por {data.validity_days} dias
          </Text>
          <Text style={{ fontSize: 11, color: '#78350F', lineHeight: 1.5 }}>
            {deadline
              ? `Os valores especiais estão disponíveis até ${deadline}. Após essa data, os preços retornarão ao normal.`
              : `Esta proposta é válida por ${data.validity_days} dias a partir da data de envio.`}
          </Text>
        </View>
      </View>
    </Page>
  )
}

// ─── Page 6 — CTA / RODAPÉ ───────────────────────────────────────────────────
function Page6({ data }: { data: ProposalData }) {
  const pillars = ['Mais Controle', 'Mais Previsibilidade', 'Mais Matrículas']

  return (
    <Page size="A4" orientation="landscape" style={[s.page, { backgroundColor: VD, padding: '36 48', alignItems: 'center', justifyContent: 'center' }]}>
      <LogoPill height={20} />

      <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 900, fontSize: 34, color: '#fff', textAlign: 'center', maxWidth: 500, marginTop: 20, marginBottom: 22, lineHeight: 1.15 }}>
        Sua escola pronta para a{'\n'}próxima campanha.
      </Text>

      {/* Pillars */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
        {pillars.map((label, i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
            {i > 0 && <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: 18 }} />}
            <Text style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Consultant card */}
      {data.consultant_name ? (
        <View style={{ backgroundColor: '#1A6B52', borderRadius: 14, padding: '16 28', alignItems: 'center', minWidth: 260, marginBottom: 18 }}>
          <Text style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Seu consultor</Text>
          <Text style={{ fontFamily: 'BricolageGrotesque', fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 8 }}>{data.consultant_name}</Text>
          {data.consultant_phone && (
            <Text style={{ fontSize: 12, color: '#B2D8CE', marginBottom: 4 }}>{data.consultant_phone}</Text>
          )}
          {data.consultant_email && (
            <Text style={{ fontSize: 12, color: '#B2D8CE' }}>{data.consultant_email}</Text>
          )}
        </View>
      ) : null}

      <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
        {data.consultant_site || 'aionedu.com.br'} · Todos os direitos reservados
      </Text>
    </Page>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProposalPdfDocument({ data }: { data: ProposalData }) {
  const rawDate = data.proposal_date
    ? data.proposal_date + 'T12:00:00'
    : data.created_at || null
  const proposalDate = rawDate
    ? new Date(rawDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const deadline = data.special_deadline
    ? new Date(data.special_deadline + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null

  return (
    <Document>
      <Page1 data={data} proposalDate={proposalDate} />
      <Page2 />
      <Page3 />
      <Page4 data={data} deadline={deadline} />
      <Page5 data={data} deadline={deadline} />
      <Page6 data={data} />
    </Document>
  )
}
