import React from 'react'
import { View, Text, Svg, Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polygon, Polyline, G, Text as SText, Image } from '@react-pdf/renderer'
import { C, Pg, Sec, H2, Card, Hero, Serve, Aula, Foot, Rich, Icon, IconBox, txt, num, head, PW, PH, LOGO_BRANCA, asset } from './ui'
import { Pessoas, Anel, Medidor, Radar, Pirulito, GradBar, Rosca } from './charts'
import { F, D, sgn, curto, nome, type RaioXCtx } from '../data'
import { STG, anoEtapas } from '../insights'

const rod = (c: RaioXCtx) => `${c.nome} · ${c.cid}/${c.uf}`
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// ─── Capa ────────────────────────────────────────────────────────────────────
export function Capa({ c, lista }: { c: RaioXCtx; lista: { icon: string; t: string }[] }) {
  const P = c.R.posicao, E = c.R.enem, hoje = new Date()
  const st: [string, string][] = [[`${P.ranking}º`, `entre ${P.total_escolas} particulares de ${c.cid}`], [F(P.minha), 'alunos na escola']]
  if (E?.escola?.media_geral) st.push([D(E.escola.media_geral, 0), `média no ENEM ${E.ano}`])
  return (
    <Pg>
      <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={PW} height={PH} viewBox={`0 0 ${PW} ${PH}`}>
        <Defs><LinearGradient id="capa" x1="0" y1="0" x2="0.6" y2="1"><Stop offset="0" stopColor="#00402F" /><Stop offset="0.62" stopColor="#00796B" /><Stop offset="1" stopColor="#0DD3BF" /></LinearGradient></Defs>
        <Rect x={0} y={0} width={PW} height={PH} fill="url(#capa)" />
        <Circle cx={PW - 10} cy={110} r={260} fill="#ffffff" fillOpacity={0.07} />
        <Circle cx={50} cy={PH - 300} r={210} fill="#0DD3BF" fillOpacity={0.18} />
      </Svg>
      <View style={{ paddingTop: 60, paddingHorizontal: 64 }}>
        <Image src={asset(LOGO_BRANCA)} style={{ height: 62, width: 62 * (900 / 265) }} />
        <Text style={{ ...txt(17, '#fff', 700), marginTop: 70, opacity: 0.9 }}>Raio-X Estratégico</Text>
        <Text style={{ ...head(60, '#fff', 800), lineHeight: 1.02, marginTop: 12, maxWidth: 620, letterSpacing: -1.5 }}>{c.nome}</Text>
        <Text style={{ ...txt(22, '#fff', 500), marginTop: 14 }}>{c.cid}, {c.uf}</Text>
        <Text style={{ ...txt(16, '#fff', 500), lineHeight: 1.55, marginTop: 22, maxWidth: 540 }}>Um diagnóstico completo da escola e do mercado, feito só com dados públicos e comparando apenas escolas particulares.</Text>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 44 }}>
          {st.map(([a, b], i) => (
            <View key={i} style={{ flex: 1, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.28)', paddingLeft: 18 }}>
              <Text style={num(52, '#fff')}>{a}</Text><Text style={{ ...txt(14, '#fff', 500), marginTop: 6 }}>{b}</Text>
            </View>))}
        </View>
        <Text style={{ ...head(20, '#fff', 700), marginTop: 44 }}>O que você vai ver</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
          {lista.map((it, i) => (
            <View key={i} style={{ width: 322, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16 }}>
              <Icon name={it.icon} size={22} color="#fff" /><Text style={txt(14.5, '#fff', 700)}>{it.t}</Text>
            </View>))}
        </View>
      </View>
      <View style={{ position: 'absolute', left: 64, right: 64, bottom: 34, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={txt(12.5, '#fff', 500)}>Gerado em {hoje.getDate()} de {MESES[hoje.getMonth()]} de {hoje.getFullYear()}</Text>
        <Text style={txt(12.5, '#fff', 500)}>Fontes: INEP, IBGE, Ministério da Saúde</Text>
      </View>
    </Pg>
  )
}

// ─── 1 · Posição ─────────────────────────────────────────────────────────────
export function PagePosicao({ c }: { c: RaioXCtx }) {
  const R = c.R, P = R.posicao, L = R.lideres ?? ({} as any), n = c.nome, cid = c.cid
  const { ranking: rk, total_escolas: totE, total_alunos: totA, minha, lider } = P, share = (100 * minha) / totA
  const h1 = rk === 1 ? `${n} é a escola particular com mais alunos de ${cid}` : `${n} é a ${rk}ª maior escola particular de ${cid}`
  const lead = rk === 1 ? `São **${F(minha)} alunos**. Veja onde essa liderança é mais forte e onde ainda dá para crescer.` : `São **${F(minha)} alunos**. A maior tem ${F(lider.mat)}, **${F(lider.mat - minha)} a mais**. Veja onde está essa diferença.`
  const todos = [...c.ESC].sort((a, b) => b.t - a.t); let top5 = todos.slice(0, 5)
  if (!top5.some(o => o.c === c.me)) top5 = [...top5.slice(0, 4), todos.find(o => o.c === c.me)!].filter(Boolean)
  const mx = Math.max(...top5.map(o => o.t)), hi = Math.ceil(mx / 250) * 250
  const itens = top5.map((o, i) => ({ rotulo: `${todos.indexOf(o) + 1}º  ${curto(o.n, 26)}`, sub: i === 0 ? 'alunos na educação infantil, fundamental e médio' : '', v: o.t }))
  const meLab = itens[top5.findIndex(o => o.c === c.me)]?.rotulo
  const nota = rk === 1 ? `Está no **topo**: a 2ª colocada tem ${F(todos[1]?.t)} alunos.` : `Para a próxima posição faltam **${F(todos[rk - 2].t - minha + 1)} alunos**.`
  const tit = { inf: 'Educação infantil', fund: 'Ensino fundamental', med: 'Ensino médio' } as const, ico = { inf: 'baby', fund: 'book', med: 'cap' } as const
  const stage = (seg: 'inf' | 'fund' | 'med') => {
    const s = P.segmentos.find(x => x.seg === seg)!, top = L[seg] ?? []
    if (!s.minha) return (
      <Card key={seg} style={{ flex: 1, backgroundColor: '#EDF3F1', paddingHorizontal: 18, paddingVertical: 16 }}>
        <Icon name={ico[seg]} size={26} color="#8aa59c" /><Text style={{ ...head(16, C.TINTA), marginTop: 8 }}>{tit[seg]}</Text>
        <Text style={{ ...txt(12.5, C.TXT), marginTop: 6 }}>A escola não tem alunos nesta etapa. {s.ativas} escolas particulares têm.</Text>
      </Card>)
    const r = s.ranking as number, cor = r <= 2 ? C.TURQ : C.AMBAR
    const nt = r === 1 ? `A maior da cidade.${top[1] ? ` A 2ª tem ${F(top[1].mat)}.` : ''}` : `O 1º lugar tem ${F(top[0].mat)}: ${F(top[0].mat - s.minha)} a mais.`
    return (
      <Card key={seg} style={{ flex: 1, paddingHorizontal: 18, paddingVertical: 16, borderTopWidth: 7, borderTopColor: cor }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Icon name={ico[seg]} size={26} color={cor} /><Text style={txt(11.5, C.MUTED, 600)}>{s.ativas} escolas</Text></View>
        <Text style={{ ...head(16, C.TINTA), marginTop: 8 }}>{tit[seg]}</Text>
        <Text style={{ ...num(44, r <= 2 ? C.VERDE : '#B36B00'), marginTop: 6 }}>{r}º</Text>
        <Text style={{ ...txt(13, C.TINTA, 800), marginTop: 6 }}>{F(s.minha)} alunos</Text>
        <Text style={{ ...txt(11.5, C.TXT), marginTop: 2 }}>{nt}</Text>
      </Card>)
  }
  return (
    <Pg>
      <Hero pill="Sua posição na cidade" title={h1} lead={lead} side={<View style={{ alignItems: 'center' }}><View style={{ flexDirection: 'row', alignItems: 'flex-start' }}><Text style={{ ...num(150, '#fff') }}>{rk}</Text><Text style={{ ...num(48, '#fff'), marginTop: 14, marginLeft: 4 }}>o</Text></View><Text style={{ ...txt(14, '#fff', 700), textAlign: 'center', marginTop: 2 }}>entre {totE} escolas</Text></View>} />
      <Sec first>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 30, paddingVertical: 14, paddingHorizontal: 24 }}>
          <Pessoas pct={share} w={104} />
          <View style={{ flex: 1 }}>
            <Text style={num(64, C.VERDE)}>{D(share)}%</Text>
            <Rich t={`dos alunos das escolas particulares de ${cid} estudam no ${n}. Cada figura é 1% dos **${F(totA)}** alunos.\n${nota}`} style={{ ...txt(15, C.TXT), marginTop: 6 }} />
          </View>
        </Card>
      </Sec>
      <Sec><H2>Posição em cada etapa</H2><View style={{ flexDirection: 'row', gap: 14 }}>{(['inf', 'fund', 'med'] as const).map(stage)}</View></Sec>
      <Sec><H2>As escolas particulares com mais alunos</H2><Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 24 }}><Pirulito itens={itens} lo={0} hi={hi} w={646} destaque={meLab} fmt={v => F(v)} linha={34} passo={250} /></Card></Sec>
      <Serve a="A posição da escola entre as particulares da cidade." b="Saber se você lidera e com quem se comparar." c="A **Campanha de Matrículas** mostra quantos alunos novos cada ação traz." />
      <Foot fonte={`INEP, Censo Escolar ${c.ano}`} rodape={rod(c)} />
    </Pg>
  )
}
