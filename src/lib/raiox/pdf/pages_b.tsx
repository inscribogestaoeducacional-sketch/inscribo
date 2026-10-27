import React from 'react'
import { View, Text, Svg, Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polygon, Polyline, G, Text as SText } from '@react-pdf/renderer'
import { C, Pg, Sec, H2, Card, Hero, Serve, Aula, Foot, Rich, Icon, IconBox, txt, num, head } from './ui'
import { Anel, Radar, Pirulito, Rosca } from './charts'
import { F, D, sgn, curto, nome, type RaioXCtx } from '../data'
import { STG, anoEtapas } from '../insights'

const rod = (c: RaioXCtx) => `${c.nome} · ${c.cid}/${c.uf}`
const W = 646

// ─── 2 · Crescimento ─────────────────────────────────────────────────────────
export function PageCrescimento({ c }: { c: RaioXCtx }) {
  const S = c.R.serie, n = c.nome, cid = c.cid
  const anos = S.map(s => s.ano), e = S.map(s => s.escola?.total ?? 0), ci = S.map(s => s.cidade.total), ne = S.map(s => s.cidade.escolas)
  const ie = e.map(v => (100 * v) / e[0]), ic = ci.map(v => (100 * v) / ci[0])
  const chE = 100 * (e[e.length - 1] / e[0] - 1), chC = 100 * (ci[ci.length - 1] / ci[0] - 1)
  const pk = ci.indexOf(Math.max(...ci)), chE2 = 100 * (e[e.length - 1] / e[pk] - 1), chC2 = 100 * (ci[ci.length - 1] / ci[pk] - 1)
  const CW = 646, H = 250, X0 = 44, Y0 = 26, Y1 = 34
  const lo = Math.floor((Math.min(...ie, ...ic) - 6) / 10) * 10, hi = Math.ceil((Math.max(...ie, ...ic) + 6) / 10) * 10
  const X = (i: number) => X0 + (i * (CW - X0 - 60)) / (anos.length - 1), Y = (v: number) => Y0 + ((hi - v) * (H - Y0 - Y1)) / (hi - lo)
  const grade = []; for (let v = lo; v <= hi; v += 10) grade.push(<G key={v}><Line x1={X0} x2={CW - 20} y1={Y(v)} y2={Y(v)} stroke={v === 100 ? '#9fc7bb' : '#E3F4EE'} strokeWidth={1} strokeDasharray={v === 100 ? '4 4' : undefined} /><SText x={0} y={Y(v) + 4} fill="#6b8a81" style={{ fontFamily: 'Jakarta', fontSize: 12 } as any}>{String(v)}</SText></G>)
  const linha = (vals: number[], cor: string, sw: number, gid: string) => {
    const pts = vals.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')
    return <G>
      <Polygon points={`${X(0)},${Y(lo)} ${pts} ${X(vals.length - 1)},${Y(lo)}`} fill={`url(#${gid})`} />
      <Polyline points={pts} fill="none" stroke={cor} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
      {vals.map((v, i) => <Circle key={i} cx={X(i)} cy={Y(v)} r={i === vals.length - 1 ? 6 : 4.5} fill={cor} stroke="#fff" strokeWidth={2.5} />)}
    </G>
  }
  const h1 = chE > 0 || chC > 0 ? `Em 5 anos, o ${n} ${chE >= 0 ? 'cresceu' : 'encolheu'} ${D(Math.abs(chE), 0)}% e a cidade, ${sgn(chC, 0)}%` : `Em 5 anos, o ${n} e a cidade perderam alunos`
  const mini = (cor1: string, cor2: string, t: string, v: string, s: string) => (
    <View style={{ flex: 1, borderRadius: 24, backgroundColor: cor1, paddingVertical: 16, paddingHorizontal: 22 }}>
      <Text style={txt(13, '#fff', 700)}>{t}</Text><Text style={{ ...num(52, '#fff'), marginTop: 8 }}>{v}</Text><Rich t={s} style={{ ...txt(13, '#fff', 500), marginTop: 6 }} />
    </View>)
  const pico = pk < anos.length - 1 ? `Desde ${anos[pk]}, o ano com mais alunos nas particulares de ${cid} (${F(ci[pk])}), a cidade **${chC2 < 0 ? 'perdeu' : 'ganhou'} ${D(Math.abs(chC2))}%**; a escola **${chE2 >= 0 ? 'cresceu' : 'perdeu'} ${D(Math.abs(chE2))}%**. ` : ''
  return (
    <Pg>
      <Hero pill="Crescimento em 5 anos" title={h1} lead={`Quantos alunos a escola tinha em ${anos[0]} e quantos tem em ${anos[anos.length - 1]}, ao lado das particulares de ${cid}.`} />
      <Sec first><View style={{ flexDirection: 'row', gap: 14 }}>{mini(C.VERDE, C.TURQ, `${n}, ${anos[0]} a ${anos[anos.length - 1]}`, `${sgn(chE, 0)}%`, `de ${F(e[0])} para **${F(e[e.length - 1])}** alunos`)}{mini('#E08A00', '#F5B73B', `Cidade, ${anos[0]} a ${anos[anos.length - 1]}`, `${sgn(chC, 0)}%`, `de ${F(ci[0])} para **${F(ci[ci.length - 1])}** alunos`)}</View></Sec>
      <Sec>
        <H2>{`Evolução, com ${anos[0]} = 100`}</H2>
        <Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 22 }}>
          <Svg width={CW} height={H} viewBox={`0 0 ${CW} ${H}`}>
            <Defs>
              <LinearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.TURQ} stopOpacity={0.3} /><Stop offset="1" stopColor={C.TURQ} stopOpacity={0} /></LinearGradient>
              <LinearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.AMBAR} stopOpacity={0.18} /><Stop offset="1" stopColor={C.AMBAR} stopOpacity={0} /></LinearGradient>
            </Defs>
            {grade}{linha(ic, C.AMBAR, 3.5, 'gc')}{linha(ie, C.TURQ, 4.5, 'ga')}
            {anos.map((a, i) => <SText key={a} x={X(i)} y={H - 8} textAnchor="middle" fill="#365a50" style={{ fontFamily: 'Jakarta', fontWeight: 700, fontSize: 12.5 } as any}>{String(a)}</SText>)}
            <SText x={X(anos.length - 1) + 14} y={Y(ie[ie.length - 1]) + 5} fill={C.VERDE} style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 15 } as any}>{D(ie[ie.length - 1], 0)}</SText>
            <SText x={X(anos.length - 1) + 14} y={Y(ic[ic.length - 1]) + 5} fill="#B36B00" style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 15 } as any}>{D(ic[ic.length - 1], 0)}</SText>
          </Svg>
          <View style={{ flexDirection: 'row', gap: 20, marginLeft: 44, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: C.TURQ }} /><Text style={txt(13, C.TINTA, 700)}>{n}</Text></View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: C.AMBAR }} /><Text style={txt(13, C.TINTA, 700)}>Cidade</Text></View>
          </View>
        </Card>
      </Sec>
      <Sec>
        <Card style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 }}>
          {anos.map((a, i) => (
            <View key={a} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i ? 2 : 0, borderLeftColor: C.LINHA }}>
              <Text style={txt(12, C.MUTED, 800)}>{a}</Text><Text style={{ ...num(20, C.VERDE), marginTop: 3 }}>{F(e[i])}</Text>
              <Text style={{ ...txt(11.5, C.WARN_TXT, 700), marginTop: 2 }}>{F(ci[i])} na cidade</Text><Text style={txt(11, '#8aa59c', 500)}>{ne[i]} escolas</Text>
            </View>))}
        </Card>
      </Sec>
      <Sec><Card><Rich t={`${pico}O número de escolas particulares foi de **${ne[0]}** para **${ne[ne.length - 1]}**: quando uma escola fecha, os alunos dela procuram vaga nas outras.`} style={txt(13.5, C.TXT)} /></Card></Sec>
      <Serve a="Alunos da escola e das particulares da cidade, ano a ano." b="Ver se a escola cresce junto, mais ou menos que o mercado." c="A **Captação** mostra de onde vêm as matrículas novas." />
      <Foot fonte={`INEP, Censo Escolar ${anos[0]} a ${anos[anos.length - 1]} · particulares em atividade`} rodape={rod(c)} />
    </Pg>
  )
}

// ─── 3 · Perda entre etapas ──────────────────────────────────────────────────
export function PagePerda({ c }: { c: RaioXCtx }) {
  const R = c.R, n = c.nome, cid = c.cid, ay = anoEtapas(c)
  if (!ay) return null
  const s0 = R.serie[0], sy = R.serie.find(s => s.ano === ay)!
  const ge: any = {}, gc: any = {}
  for (const s of STG) { ge[s.k] = ((sy.escola as any)[s.k] || 0) / s.q; gc[s.k] = ((sy.cidade as any)[s.k] || 0) / s.q }
  const raz = (g: any, a: string, b: string) => (g[a] > 0 && g[b] >= 0 ? g[b] / g[a] : null)
  const pares: [string, string, string, string][] = [['pre', 'ai', 'Pré-escola', '1º ao 5º ano'], ['ai', 'af', '1º ao 5º ano', '6º ao 9º ano'], ['af', 'med', '6º ao 9º ano', 'Ensino médio']]
  const lin: { ta: string; tb: string; re: number; rc: number; d: number }[] = []
  for (const [a, b, ta, tb] of pares) { const re = raz(ge, a, b), rc = raz(gc, a, b); if (re != null && rc != null) lin.push({ ta, tb, re, rc, d: re - rc }) }
  const pior = lin.length ? lin.reduce((m, x) => (x.d < m.d ? x : m)) : null
  const ruimGeral = pior && pior.d < -0.05
  const h1 = ruimGeral ? `A maior queda do ${n} acontece na passagem de ${pior!.ta} para ${pior!.tb}` : `Os alunos do ${n} seguem de uma etapa para outra no ritmo da cidade`
  const lead = ruimGeral ? `De cada 100 alunos por série da etapa anterior, a escola mantém **${D(100 * pior!.re, 0)}**. A média das particulares de ${cid} mantém **${D(100 * pior!.rc, 0)}**.` : 'Nas etapas comparadas, não há queda maior que a das outras particulares da cidade.'
  const mx = Math.max(...Object.values<number>(ge)) || 1, cores = [C.TURQ, '#00A896', '#00796B', '#00695C', C.VERDE]
  return (
    <Pg>
      <Hero pill="Onde a escola perde alunos" title={h1} lead={lead} />
      <Sec first><H2>{`Alunos por série, etapa a etapa (${ay})`}</H2>
        <Card style={{ paddingVertical: 12, paddingHorizontal: 24 }}>
          {STG.map((s, i) => { const v = ge[s.k], w = Math.max(Math.round((400 * v) / mx), 6); return (
            <View key={s.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 6 }}>
              <View style={{ width: 130 }}><Text style={txt(14, C.TINTA, 800)}>{s.nome}</Text><Text style={txt(11.5, C.MUTED, 500)}>{s.idade}</Text></View>
              <View style={{ height: 30, width: w, borderTopRightRadius: 15, borderBottomRightRadius: 15, backgroundColor: cores[i] }} />
              <Text style={num(24)}>{D(v, 0)}</Text>
            </View>) })}
        </Card></Sec>
      <Sec><H2>Quantos seguem para a etapa seguinte</H2>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {lin.map(x => { const ruim = x.d < -0.05, cor = ruim ? C.CORAL : C.TURQ; return (
            <Card key={x.ta} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderTopWidth: 7, borderTopColor: cor }}>
              <Text style={{ ...txt(12.5, C.TINTA, 800), textAlign: 'center', minHeight: 32 }}>{x.ta} para {x.tb}</Text>
              <View style={{ marginTop: 6 }}><Anel pct={100 * x.re} size={96} cor={cor} centro={`${D(100 * x.re, 0)}%`} esp={12} /></View>
              <Text style={{ ...txt(12, C.TXT), marginTop: 2 }}>cidade: <Text style={{ fontWeight: 800, color: C.WARN_TXT }}>{D(100 * x.rc, 0)}%</Text></Text>
              <View style={{ marginTop: 6, backgroundColor: ruim ? '#FDE7E7' : '#DDF5EE', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10 }}><Text style={txt(12.5, ruim ? C.RED_TXT : C.VERDE, 800)}>{sgn(100 * x.d, 0)} pontos</Text></View>
            </Card>) })}
        </View></Sec>
      <Sec><H2>{`Quanto cada etapa cresceu desde ${s0.ano}`}</H2>
        <Card style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 8 }}>
          {STG.map(s => { const a0 = (s0.escola as any)?.[s.k], a1 = (sy.escola as any)?.[s.k], b0 = (s0.cidade as any)[s.k], b1 = (sy.cidade as any)[s.k]; if (!a0 || !b0) return null
            const ce = 100 * (a1 / a0 - 1), cc = 100 * (b1 / b0 - 1), bom = ce >= cc
            return <View key={s.k} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 4 }}><Text style={txt(12, C.TINTA, 800)}>{s.nome}</Text><Text style={{ ...num(22, bom ? C.VERDE : C.RED_TXT), marginTop: 4 }}>{sgn(ce, 0)}%</Text><Text style={{ ...txt(11.5, C.WARN_TXT, 700), marginTop: 4 }}>cidade {sgn(cc, 0)}%</Text></View> })}
        </Card>
        <Text style={{ ...txt(11.5, C.MUTED), marginTop: 6 }}>{`Média por série = alunos da etapa ÷ número de séries (Censo ${ay}, que informa o total por etapa). Estimativa da Áion.`}</Text></Sec>
      <Serve a="Quantos alunos a escola mantém quando mudam de etapa." b="Achar o ponto onde os alunos saem e agir antes da rematrícula." c="**Rematrícula** e **Funil** mostram quem está saindo e por quê." />
      <Foot fonte={`INEP, Censo Escolar ${s0.ano} e ${ay} · médias por série calculadas pela Áion`} rodape={rod(c)} />
    </Pg>
  )
}

// ─── 4 · ENEM ────────────────────────────────────────────────────────────────
export function PageEnem({ c }: { c: RaioXCtx }) {
  const E = c.R.enem, n = c.nome, cid = c.cid
  if (!E?.escola || !E.cidade?.length) return null
  const me = E.escola, Ls = E.cidade, U = E.uf_privadas
  const idx = Ls.findIndex(x => x.co === c.me); if (idx < 0) return null
  const pos = idx + 1, tot = Ls.length
  const ax = [['cn', 'Natureza'], ['ch', 'Humanas'], ['lc', 'Linguagens'], ['mt', 'Matemática'], ['red', 'Redação']] as const
  const melhor: any = {}, media: any = {}, mine: any = {}
  for (const [k] of ax) { melhor[k] = Math.max(...Ls.map((x: any) => x[k])); media[k] = Ls.reduce((s: number, x: any) => s + x[k], 0) / Ls.length; mine[k] = (me as any)['media_' + k] }
  const lo = Math.floor((Math.min(...Object.values<number>(mine), ...Object.values<number>(media)) - 40) / 50) * 50, hi = Math.ceil((Math.max(...Object.values<number>(melhor)) + 20) / 50) * 50
  const mel = Ls.reduce((m, x) => (x.geral > m.geral ? x : m))
  const h1 = pos === 1 ? `No ENEM ${E.ano}, o ${n} teve a maior média das particulares de ${cid}` : `No ENEM ${E.ano}, o ${n} ficou em ${pos}º entre ${tot} escolas`
  const lead = pos === 1 ? `Média geral de **${D(me.media_geral)} pontos**, com ${me.n_part} alunos com nota.` : `Média geral de **${D(me.media_geral)} pontos**, com ${me.n_part} alunos. A 1ª colocada fez ${D(mel.geral)}: **${D(mel.geral - me.media_geral)} pontos** a mais.`
  const gl = Math.min(...Ls.map(x => x.geral)), gh = Math.max(...Ls.map(x => x.geral)), glo = Math.floor((gl - 40) / 50) * 50, ghi = Math.ceil((gh + 30) / 50) * 50
  const its = Ls.map((x, i) => ({ rotulo: `${i + 1}º  ${curto(x.nome, 25)}`, sub: `${x.n} alunos com nota`, v: x.geral }))
  const labMe = its[idx].rotulo, uf = me.media_geral - U.geral
  const ordem = [...ax].sort((a, b) => mine[a[0]] - melhor[a[0]] - (mine[b[0]] - melhor[b[0]]))
  const leg = (cor: string, t: string) => <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 13, height: 13, borderRadius: 4, backgroundColor: cor }} /><Text style={txt(11.5, C.TXT, 600)}>{t}</Text></View>
  return (
    <Pg>
      <Hero pill={`ENEM ${E.ano}`} title={h1} lead={lead} side={<View style={{ alignItems: 'center' }}><Text style={num(150, '#fff')}>{pos}º</Text><Text style={{ ...txt(14, '#fff', 700), textAlign: 'center' }}>entre {tot} particulares</Text></View>} />
      <Sec first><H2>Matéria por matéria: onde está forte e onde perde</H2>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 20, paddingVertical: 14, paddingHorizontal: 22 }}>
          <View style={{ width: 300, alignItems: 'center' }}>
            <Radar eixos={ax.map(a => a[1])} lo={lo} hi={hi} size={270} series={[
              { vals: ax.map(([k]) => melhor[k]), cor: C.AMBAR, fill: C.AMBAR, op: 0.1, dash: '6 5', sw: 2.4 },
              { vals: ax.map(([k]) => media[k]), cor: '#8aa59c', fill: '#8aa59c', op: 0.12, sw: 2 },
              { vals: ax.map(([k]) => mine[k]), cor: C.TURQ, fill: C.TURQ, op: 0.3, sw: 3.4 }]} />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>{leg(C.TURQ, 'Escola')}{leg('#8aa59c', 'Média')}{leg(C.AMBAR, 'Melhor')}</View>
          </View>
          <View style={{ flex: 1 }}>
            {ordem.map(([k, a], i) => { const d = mine[k] - melhor[k], lid = d >= 0; return (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.LINHA }}>
                <View style={{ flex: 1 }}><Text style={txt(14, C.TINTA, 800)}>{a}</Text><Text style={txt(11, C.MUTED, 500)}>melhor: {D(melhor[k])}</Text></View>
                <Text style={num(24, C.VERDE)}>{D(mine[k])}</Text>
                <View style={{ backgroundColor: lid ? '#DDF5EE' : '#FDE8E8', borderRadius: 99, paddingVertical: 3, paddingHorizontal: 8 }}><Text style={txt(11, lid ? C.VERDE : '#B42318', 800)}>{lid ? '1ª da cidade' : `${sgn(d)}`}</Text></View>
              </View>) })}
          </View>
        </Card></Sec>
      <Sec><H2>Média geral das particulares da cidade</H2><Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 24 }}><Pirulito itens={its} lo={glo} hi={ghi} w={646} destaque={labMe} linha={34} passo={50} /><Text style={{ ...txt(11, '#8aa59c'), marginTop: -4 }}>O eixo começa em {glo} pontos para as diferenças ficarem visíveis.</Text></Card></Sec>
      <Sec><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 14 }}><Text style={num(44, uf >= 0 ? C.VERDE : '#B42318')}>{sgn(uf)}</Text><Rich t={`**pontos em relação à média das ${U.escolas} particulares de ${c.uf}** (${D(U.geral)}). Quem passa dessa média tem um bom argumento para o ensino médio.`} style={{ ...txt(14, C.TXT), flex: 1 }} /></Card></Sec>
      <Serve a="A média dos alunos de cada escola nas cinco provas do ENEM." b="Saber se a nota é argumento de matrícula e em qual matéria perde." c="A **Campanha de Matrículas** leva a nota para os anúncios." />
      <Foot fonte={`INEP, Microdados do ENEM ${E.ano} · média por escola (mín. 10 alunos)`} rodape={rod(c)} />
    </Pg>
  )
}

// ─── 6 · Nascimentos ─────────────────────────────────────────────────────────
export function PageNascimentos({ c }: { c: RaioXCtx }) {
  const R = c.R, N = R.nascimentos, P = R.pop_municipio, n = c.nome, cid = c.cid
  if (!N?.length || !P) return null
  const anos = N.map(x => x.ano), v = N.map(x => x.nascidos), mx = Math.max(...v), H = 230, bw = Math.min(64, (W - 40) / v.length - 18), gap = (W - 20 - bw * v.length) / Math.max(v.length - 1, 1)
  const ch = 100 * (v[v.length - 1] / v[0] - 1), tend = ch < -1 ? 'caiu' : ch > 1 ? 'subiu' : 'ficou estável'
  const ay = [...R.serie].reverse().find(s => s.escola && s.escola.cre != null)
  const creE = ay?.escola?.cre ?? null, creC = ay?.cidade.cre ?? null, p03 = P['0-3']
  const ids: [string, string, string][] = [['0 a 3 anos', '0-3', 'baby'], ['4 e 5 anos', '4-5', 'sparkles'], ['6 a 10 anos', '6-10', 'backpack'], ['11 a 14 anos', '11-14', 'book'], ['15 a 17 anos', '15-17', 'cap']]
  return (
    <Pg>
      <Hero pill="As crianças que vão chegar" title={`Em ${cid}, o número de nascimentos ${tend}: ${F(v[0])} em ${anos[0]} e ${F(v[v.length - 1])} em ${anos[anos.length - 1]}`} lead="Quem nasce hoje é o aluno de creche e pré-escola de daqui a 2 a 5 anos." />
      <Sec first><H2>Nascidos vivos por ano</H2>
        <Card style={{ paddingTop: 14, paddingBottom: 12, paddingHorizontal: 22 }}>
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <Defs><LinearGradient id="gn" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor="#0DD3BF" /><Stop offset="1" stopColor="#00796B" /></LinearGradient></Defs>
            {v.map((x, i) => { const h = Math.round(((H - 60) * x) / mx), xx = 10 + i * (bw + gap), last = i === v.length - 1; return (
              <G key={i}><Rect x={xx} y={H - 28 - h} width={bw} height={h} rx={12} fill={last ? 'url(#gn)' : '#9FDACB'} />
                <SText x={xx + bw / 2} y={H - 34 - h} textAnchor="middle" fill={C.VERDE} style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 15 } as any}>{F(x)}</SText>
                <SText x={xx + bw / 2} y={H - 8} textAnchor="middle" fill="#365a50" style={{ fontFamily: 'Jakarta', fontWeight: 700, fontSize: 13 } as any}>{String(anos[i])}</SText></G>) })}
          </Svg>
          <Rich t={`Variação de **${sgn(ch)}%** de ${anos[0]} a ${anos[anos.length - 1]}. Os nascidos em ${anos[anos.length - 1]} chegam à pré-escola em ${anos[anos.length - 1] + 4} e ao 1º ano em ${anos[anos.length - 1] + 6}.`} style={{ ...txt(13, C.TXT), marginTop: 4 }} />
        </Card></Sec>
      <Sec><H2>Crianças que moram na cidade, por idade</H2>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {ids.map(([t, k, ic]) => <Card key={k} style={{ flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 }}><IconBox name={ic} size={42} /><Text style={{ ...num(26, C.VERDE), marginTop: 8 }}>{F(P[k])}</Text><Text style={{ ...txt(12.5, C.TINTA, 800), marginTop: 4 }}>{t}</Text></Card>)}
        </View></Sec>
      {creC && p03 ? (() => { const pc = (100 * creC) / p03; return (
        <Sec><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 22, paddingVertical: 16, paddingHorizontal: 24 }}>
          <Anel pct={pc} size={112} cor={C.AMBAR} centro={`${D(pc, 0)}%`} esp={14} />
          <View style={{ flex: 1 }}><Text style={head(17, C.VERDE, 800)}>Quanto da demanda de creche está atendida?</Text>
            <Rich t={`Em ${ay!.ano}, as particulares de ${cid} tinham **${F(creC)} alunos de creche** para **${F(p03)} crianças de 0 a 3 anos**. O ${n} tinha ${F(creE)} (${D((100 * (creE ?? 0)) / p03, 1)}%). Conta aproximada: nem todo aluno mora no município da escola.`} style={{ ...txt(13.5, C.TXT), marginTop: 4 }} /></View>
        </Card></Sec>) })() : null}
      <Serve a={`Nascimentos por ano e crianças de ${cid} por idade.`} b="Prever a demanda de creche e pré-escola e planejar vagas." c="O **Funil** acompanha cada família, da conversa à matrícula." />
      <Foot fonte="Ministério da Saúde, SINASC (nascidos vivos) · IBGE, Censo 2022. Último ano pode ser preliminar." rodape={rod(c)} />
    </Pg>
  )
}

// ─── 7 · Estrutura × concorrentes ────────────────────────────────────────────
export function PageEstrutura({ c }: { c: RaioXCtx }) {
  const R = c.R, E = R.estrutura, n = c.nome, cid = c.cid
  if (!E?.escola || !E.ano) return null
  const ay = E.ano, me = E.escola, ci = E.cidade, conc = R.concorrentes.slice(0, 5)
  const totAno = (serie: { ano: number; total: number }[]) => serie.find(x => x.ano === ay)?.total ?? null
  const matMe = R.serie.find(s => s.ano === ay)?.escola?.total ?? null
  const itens: [string, string, string, number][] = [['library', 'Biblioteca', 'in_biblioteca', ci.biblioteca], ['ball', 'Quadra de esportes', 'in_quadra_esportes', ci.quadra], ['flask', 'Laboratório de ciências', 'in_laboratorio_ciencias', ci.lab_ciencias], ['laptop', 'Laboratório de informática', 'in_laboratorio_informatica', ci.lab_info], ['baby', 'Parque infantil', 'in_parque_infantil', ci.parque]]
  const integ = (d: any) => ((d?.qt_mat_inf_int || 0) + (d?.qt_mat_fund_int || 0) + (d?.qt_mat_med_int || 0)) > 0
  const prof = (d: any, m: number | null) => (m ? ((d?.qt_doc_bas || 0) * 100) / m : null)
  const tick = (v: any) => <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: v ? C.TURQ : '#EEF3F1', alignItems: 'center', justifyContent: 'center' }}>{v ? <Icon name="check" size={15} color="#fff" sw={3} /> : null}</View>
  const COLW = 62, LW = 668 - 7 * COLW - 4
  const row = (key: string, lbl: React.ReactNode, em: React.ReactNode, vals: React.ReactNode[], last: string, first?: boolean) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: first ? 0 : 1, borderTopColor: C.LINHA, paddingVertical: 6 }}>
      <View style={{ width: LW }}>{lbl}</View>
      <View style={{ width: COLW, alignItems: 'center', backgroundColor: '#E6F7F2', paddingVertical: 6, borderRadius: 10 }}>{em}</View>
      {vals.map((x, i) => <View key={i} style={{ width: COLW, alignItems: 'center' }}>{x}</View>)}
      <View style={{ width: COLW, alignItems: 'center' }}><Text style={{ ...txt(12, '#365a50', 800), textAlign: 'center' }}>{last}</Text></View>
    </View>)
  const th = (t: string, me_ = false) => <View style={{ width: COLW, alignItems: 'center' }}><Text style={{ ...txt(11, me_ ? C.VERDE : '#365a50', 800), textAlign: 'center', lineHeight: 1.2 }}>{t}</Text></View>
  const pm = prof(me, matMe)
  const faltam = itens.filter(([, , k]) => !(me as any)[k])
  const obs: [string, string][] = []
  if (faltam.length) obs.push(['alert', `O ${n} **não tem ${faltam[0][1].toLowerCase()}**, e ${faltam[0][3]} de ${ci.escolas} particulares têm.`])
  if (!integ(me)) obs.push(['star', `Só **${ci.integral} de ${ci.escolas}** particulares de ${cid} oferecem tempo integral${ci.integral <= 3 ? ': espaço para ser a primeira.' : '.'}`])
  if (pm != null && ci.prof_por_100_alunos) obs.push(['users', `Professores por 100 alunos: **${D(pm)}** no ${n} e **${D(ci.prof_por_100_alunos)}** na média.`])
  const lbl = (ic: string, t: string) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><Icon name={ic} size={16} color={C.VERDE} /><Text style={{ ...txt(12.5, C.TINTA, 700), flex: 1 }}>{t}</Text></View>
  return (
    <Pg>
      <Hero pill="Estrutura × concorrentes" title={`O que o ${n} oferece e o que os concorrentes mais próximos têm`} lead={`Comparamos o espaço e a equipe com as ${conc.length} particulares mais próximas em tamanho e com a média da cidade.`} />
      <Sec first>
        <Card style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 4 }}><View style={{ width: LW }} />{th(curto(R.escola.nome, 14), true)}{conc.map(x => <React.Fragment key={x.co}>{th(curto(x.nome, 14))}</React.Fragment>)}{th(`Média das ${ci.escolas}`)}</View>
          {itens.map(([ic, t, k, ct], i) => row(k, lbl(ic, t), tick((me as any)[k]), conc.map(x => tick((x.estrutura as any)?.[k])), `${ct} de ${ci.escolas}`, i === 0))}
          {row('int', lbl('clock', 'Tempo integral'), tick(integ(me)), conc.map(x => tick(integ(x.estrutura))), `${ci.integral} de ${ci.escolas}`)}
          {row('prof', lbl('users', 'Professores por 100 alunos'), <Text style={num(17, C.VERDE)}>{D(pm)}</Text>, conc.map(x => <Text style={txt(13, C.TINTA, 800)}>{D(prof(x.estrutura, totAno(x.serie)))}</Text>), `média ${D(ci.prof_por_100_alunos)}`)}
          <Text style={{ ...txt(11.5, C.MUTED), marginTop: 8 }}>✓ = a escola informou ao INEP ter o espaço. O Censo mostra se existe, não a qualidade.</Text>
        </Card></Sec>
      <Sec><H2>O que chama atenção</H2>
        <Card style={{ backgroundColor: '#FFF6DC', borderColor: '#FFE9B0', paddingVertical: 10 }}>
          {obs.map(([ic, t], i) => <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: '#FFE9B0' }}><IconBox name={ic} size={34} bg="#FFE9A8" color="#8a5a00" /><Rich t={t} style={{ ...txt(14, '#4a3b00'), flex: 1 }} /></View>)}
        </Card></Sec>
      <Serve a="Os espaços e a equipe que cada escola informou ao INEP." b="Ver o que falta para competir e o que já é diferencial para divulgar." c="A **Campanha de Matrículas** transforma cada diferencial em anúncio." />
      <Foot fonte={`INEP, Censo Escolar ${ay} · particulares em atividade`} rodape={rod(c)} />
    </Pg>
  )
}
