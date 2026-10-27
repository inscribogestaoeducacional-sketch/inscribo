import React from 'react'
import { View, Text, Svg, Defs, LinearGradient, Stop, Rect, Circle, Path, Line, G, Text as SText } from '@react-pdf/renderer'
import { C, Pg, Sec, H2, Card, Hero, Serve, Aula, Foot, Rich, Icon, IconBox, txt, num, head } from './ui'
import { Pirulito, Medidor, Rosca } from './charts'
import { F, D, curto, bairroDe, faixaRenda, CORES_RENDA, NOMES_RENDA, kids, type RaioXCtx } from '../data'
import type { IgAnalise } from '../ig'

const rod = (c: RaioXCtx) => `${c.nome} · ${c.cid}/${c.uf}`
const W = 646

// ─── 5 · Mapa de bairros ─────────────────────────────────────────────────────
export function PageMapa({ c }: { c: RaioXCtx }) {
  const { B, ESC } = c, n = c.nome, cid = c.cid
  if (!B.length) return null
  const lngs = B.flatMap(b => b.g.flatMap(pl => pl.flatMap(r => r.map(p => p[0])))), lats = B.flatMap(b => b.g.flatMap(pl => pl.flatMap(r => r.map(p => p[1]))))
  const mnx = Math.min(...lngs), mxx = Math.max(...lngs), mny = Math.min(...lats), mxy = Math.max(...lats)
  const MW = 440, MH = 400, k = Math.cos((((mny + mxy) / 2) * Math.PI) / 180)
  const sc = Math.min((MW - 16) / ((mxx - mnx) * k), (MH - 16) / (mxy - mny)), ox = (MW - (mxx - mnx) * k * sc) / 2, oy = (MH - (mxy - mny) * sc) / 2
  const X = (lng: number) => ox + (lng - mnx) * k * sc, Y = (lat: number) => oy + (mxy - lat) * sc
  const loc = ESC.filter(o => o.lat != null && o.lng != null && o.d != null && o.d <= 1000), sem = ESC.filter(o => !loc.includes(o))
  const todos = [...ESC].sort((a, b) => b.t - a.t), rk: Record<string, number> = {}; todos.forEach((o, i) => { rk[o.c] = i + 1 })
  const cont: Record<string, number> = {}
  for (const o of loc) { o.bairro_ibge = bairroDe(o.lng!, o.lat!, B); if (o.bairro_ibge) cont[o.bairro_ibge] = (cont[o.bairro_ibge] || 0) + 1 }
  const topk = [...B].sort((a, b) => kids(b) - kids(a)).slice(0, 5)
  const paths = B.map((b, i) => {
    const f = faixaRenda(b.r), cor = f != null ? CORES_RENDA[f] : '#e3e8e6'
    const d = b.g.map(pl => pl.map(ring => 'M' + ring.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('L') + 'Z').join('')).join('')
    return <Path key={i} d={d} fill={cor} stroke="#fff" strokeWidth={2} fillRule="evenodd" />
  })
  const labs = topk.map(b => {
    const big = b.g.map(pl => pl[0]).reduce((m, r) => (r.length > m.length ? r : m)), cx = X(big.reduce((s, p) => s + p[0], 0) / big.length), cy = Y(big.reduce((s, p) => s + p[1], 0) / big.length)
    const dark = (faixaRenda(b.r) ?? 0) >= 2
    return <SText key={b.n} x={cx} y={cy + 24} textAnchor="middle" fill={dark ? '#fff' : C.VERDE} style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 11 } as any}>{b.n}</SText>
  })
  const pins = [...loc].sort((a, b) => Number(a.c === c.me) - Number(b.c === c.me)).map(o => {
    const x = X(o.lng!), y = Y(o.lat!), me = o.c === c.me, r = 9 + Math.sqrt(o.t) * 0.1
    return me
      ? <G key={o.c}><Circle cx={x} cy={y} r={r + 10} fill={C.AMBAR} fillOpacity={0.3} /><Circle cx={x} cy={y} r={r + 3} fill={C.AMBAR} stroke="#fff" strokeWidth={3} /><SText x={x} y={y + 5} textAnchor="middle" fill="#fff" style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 13 } as any}>{String(rk[o.c])}</SText></G>
      : <G key={o.c}><Circle cx={x} cy={y} r={r} fill={C.TINTA} stroke="#fff" strokeWidth={2} /><SText x={x} y={y + 4} textAnchor="middle" fill="#fff" style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 10.5 } as any}>{String(rk[o.c])}</SText></G>
  })
  const meO = ESC.find(o => o.c === c.me), meb = meO?.bairro_ibge ?? null, mebD = B.find(b => b.n === meb)
  const mxk = Math.max(...topk.map(kids)) || 1, semEsc = topk.filter(b => !cont[b.n])
  const frase = semEsc.length ? `**${semEsc.map(b => b.n).join(', ')}** ${semEsc.length > 1 ? 'têm' : 'tem'} muitas crianças e nenhuma escola particular marcada: é onde anunciar pode render mais.` : 'Os 5 bairros com mais crianças já têm escola particular. A disputa é bairro a bairro.'
  const lead = meb ? `O ${n} fica no bairro **${meb}**${mebD?.r ? `, com renda média de R$ ${F(mebD.r)} por responsável.` : '.'}` : `Onde estão as crianças, a renda e as escolas particulares de ${cid}.`
  const ordem = loc.sort((a, b) => rk[a.c] - rk[b.c]), tz = Math.ceil(ordem.length / 3)
  const col = (a: number, b: number) => <View style={{ flex: 1 }}>{ordem.slice(a, b).map(o => <View key={o.c} style={{ flexDirection: 'row', gap: 6, marginVertical: 1 }}><Text style={{ ...txt(11.5, C.VERDE, 800), width: 20 }}>{rk[o.c]}</Text><Text style={{ ...txt(11.5, C.TXT, 500), flex: 1 }}>{curto(o.n, 28)}</Text><Text style={txt(11.5, '#5b7a71', 700)}>{F(o.t)}</Text></View>)}</View>
  const sq = (cor: string) => <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: cor }} />
  return (
    <Pg>
      <Hero pill="Mapa da cidade" title={`O mapa de ${cid}: onde estão as crianças, a renda e as escolas`} lead={lead} />
      <Sec first>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
          <Card style={{ padding: 8 }}><Svg width={MW} height={MH} viewBox={`0 0 ${MW} ${MH}`}><Rect x={0} y={0} width={MW} height={MH} rx={18} fill="#EEF6F3" />{paths}{labs}{pins}</Svg></Card>
          <View style={{ flex: 1, gap: 10 }}>
            <Card style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
              <Text style={{ ...head(14, C.TINTA), marginBottom: 6 }}>Renda média do responsável</Text>
              {NOMES_RENDA.map((t, i) => <View key={t} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 2 }}>{sq(CORES_RENDA[i])}<Text style={txt(12.5, C.TXT)}>{t}</Text></View>)}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 }}>{sq('#e3e8e6')}<Text style={txt(12.5, C.TXT)}>sem dado</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.AMBAR }} /><Text style={txt(12.5, C.TXT)}>{curto(n, 22)}</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: C.TINTA }} /><Text style={txt(12.5, C.TXT)}>outras particulares</Text></View>
            </Card>
            <Card style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
              <Text style={{ ...head(14, C.TINTA), marginBottom: 2 }}>Mais crianças (0 a 14)</Text>
              {topk.map((b, i) => { const ne = cont[b.n] || 0; return (
                <View key={b.n} style={{ paddingVertical: 4, borderTopWidth: 1, borderTopColor: C.LINHA }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={txt(13, C.TINTA, 800)}>{b.n}{b.n === meb ? ' ★' : ''}</Text><Text style={txt(12, ne === 0 ? C.RED_TXT : C.TXT, 700)}>{ne} escola{ne === 1 ? '' : 's'}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}><View style={{ height: 10, width: Math.round((110 * kids(b)) / mxk) + 4, borderRadius: 5, backgroundColor: i % 2 ? C.TURQ : C.VERDE }} /><Text style={txt(11.5, C.VERDE, 800)}>{F(kids(b))} crianças</Text><Text style={txt(11, C.MUTED)}>R$ {b.r ? F(b.r) : '—'}</Text></View>
                </View>) })}
            </Card>
          </View>
        </View>
      </Sec>
      <Sec><Card style={{ backgroundColor: '#FFF6DC', borderColor: '#FFE9B0', paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="bulb" size={32} bg="#FFE9A8" color="#8a5a00" /><View style={{ flex: 1 }}><Rich t={frase} style={txt(13.5, C.TXT)} />{sem.length ? <Text style={{ ...txt(11, '#b86e00'), marginTop: 4 }}>Sem localização confiável: {sem.map(o => curto(o.n, 26)).join(', ')}.</Text> : null}</View></Card></Sec>
      <Sec><Card style={{ paddingVertical: 10, paddingHorizontal: 18 }}><Text style={{ ...txt(12, '#5b7a71', 800), marginBottom: 4 }}>Escolas no mapa: número = posição por alunos</Text><View style={{ flexDirection: 'row', gap: 18 }}>{col(0, tz)}{col(tz, 2 * tz)}{col(2 * tz, ordem.length)}</View></Card></Sec>
      <Serve a="Bairros pintados por renda, com crianças e escolas." b="Escolher onde anunciar e onde ainda não há concorrente." c="O **Mapa da Escola** mostra onde moram seus alunos e leads." />
      <Foot fonte="IBGE, Censo 2022 · INEP, Censo Escolar" rodape={rod(c)} />
    </Pg>
  )
}

// ─── Presença digital ────────────────────────────────────────────────────────
const COR_F = { forte: C.TURQ, medio: C.AMBAR, fraco: C.CORAL } as const
const NOMES_T = { reels: 'Reels e vídeo', carrossel: 'Carrossel', foto: 'Foto única' } as const
const COR_T = { reels: C.TURQ, carrossel: '#00796B', foto: C.AMBAR } as const
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const DIAS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']

export function PageDigital1({ c, ig }: { c: RaioXCtx; ig: IgAnalise }) {
  if (!ig?.amostra?.n) return null
  const n = c.nome, P = ig.perfil, E = ig.engajamento, Co = ig.conteudo, A = ig.amostra, nt = E.curtidas_ocultas ? 'comentários' : 'curtidas e comentários'
  const kp: [string, string, string, string][] = [
    [D(ig.frequencia.por_semana), 'posts por semana', 'a escola publica quase todo dia', C.VERDE],
    [E.taxa_pct != null ? `${D(E.taxa_pct)}%` : '—', 'engajamento por post', `${D(E.medio_por_post, 0)} ${nt} sobre ${F(P.seguidores)} seguidores`, C.VERDE],
    [`${ig.tipos[0].pct}%`, 'vídeo e Reels', `${ig.tipos[0].qtd} de ${A.n} posts`, C.VERDE],
    [`${Co.fala_matricula}`, `de ${A.n} posts falam de matrícula`, 'o assunto que traz a família nova', C.RED_TXT]]
  const serie = ig.frequencia.serie_dias, mxs = Math.max(...serie.map(d => d.qtd), 1), nn = serie.length, bw = (W - 20) / nn, media = serie.reduce((s, d) => s + d.qtd, 0) / nn
  const pico = serie.reduce((m, d) => (d.qtd > m.qtd ? d : m)), CH = 170
  const ym = CH - 24 - ((CH - 44) * media) / mxs
  const tipos = ig.tipos.filter(t => t.qtd), mxe = Math.max(...tipos.map(t => t.engaj_medio || 0)) || 1
  return (
    <Pg>
      <Hero pill="Presença digital" title={`Instagram do ${n}: nota ${ig.nota} de 100 para atrair matrícula`} lead={`**@${P.username}** · ${F(P.seguidores)} seguidores · ${F(P.posts_total)} posts. Lemos os ${A.n} mais recentes, de ${dm(A.primeiro!.slice(0, 10))} a ${dm(A.ultimo!.slice(0, 10))}.`}
        side={<View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 28, padding: 14, paddingBottom: 10 }}><Medidor nota={ig.nota} cor="#FFD166" w={236} branco /></View>} />
      <Sec first><Card style={{ flexDirection: 'row', paddingVertical: 18, paddingHorizontal: 6 }}>
        {kp.map(([v, t, s, cor], i) => <View key={i} style={{ flex: 1, paddingHorizontal: 16, borderLeftWidth: i ? 2 : 0, borderLeftColor: C.LINHA }}><Text style={num(44, cor)}>{v}</Text><Text style={{ ...txt(14, C.TINTA, 800), marginTop: 6 }}>{t}</Text><Text style={{ ...txt(11.8, C.MUTED), marginTop: 3 }}>{s}</Text></View>)}
      </Card></Sec>
      <Sec><H2>Quantos posts por dia</H2><Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 22 }}>
        <Svg width={W} height={CH} viewBox={`0 0 ${W} ${CH}`}>
          <Defs><LinearGradient id="gbd" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={C.TURQ} /><Stop offset="1" stopColor="#7FE0D2" /></LinearGradient></Defs>
          {serie.map((d, i) => { const bh = ((CH - 44) * d.qtd) / mxs, x = 10 + i * bw, y = CH - 24 - bh; return (
            <G key={d.dia}>
              {d.qtd ? <G><Rect x={x + 3} y={y} width={bw - 6} height={bh} rx={6} fill={d.dia === pico.dia ? C.VERDE : 'url(#gbd)'} /><SText x={x + bw / 2} y={y - 5} textAnchor="middle" fill={C.VERDE} style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 12 } as any}>{String(d.qtd)}</SText></G> : <Rect x={x + 3} y={CH - 27} width={bw - 6} height={3} rx={1.5} fill="#D3EBE4" />}
              {(i % 3 === 0 && ![1, 2].includes(nn - 1 - i)) || i === nn - 1 ? <SText x={x + bw / 2} y={CH - 6} textAnchor="middle" fill="#6b8a81" style={{ fontFamily: 'Jakarta', fontSize: 11 } as any}>{dm(d.dia)}</SText> : null}
            </G>) })}
          <Line x1={10} x2={W - 10} y1={ym} y2={ym} stroke={C.AMBAR} strokeWidth={2} strokeDasharray="6 5" />
          <SText x={W - 10} y={ym - 6} textAnchor="end" fill={C.WARN_TXT} style={{ fontFamily: 'Jakarta', fontWeight: 800, fontSize: 11.5 } as any}>{`média: ${D(media)} por dia`}</SText>
        </Svg>
        <Rich t={`Maior dia: **${pico.qtd} posts em ${dm(pico.dia)}**. A linha laranja é a média do período.`} style={{ ...txt(12.5, C.TXT), marginBottom: 4 }} />
      </Card></Sec>
      <Sec><H2>Qual formato mais engaja</H2><Card style={{ flexDirection: 'row', alignItems: 'center', gap: 26, paddingVertical: 16, paddingHorizontal: 26 }}>
        <Rosca segs={tipos.map(t => ({ v: t.qtd, cor: COR_T[t.tipo] }))} size={190} total={A.n} rotulo="posts lidos" />
        <View style={{ flex: 1 }}>
          <Text style={{ ...txt(12, C.MUTED), marginBottom: 2 }}>Média de {nt} por post, em cada formato</Text>
          {tipos.map(t => (
            <View key={t.tipo} style={{ marginVertical: 9 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: COR_T[t.tipo] }} /><Text style={txt(13.5, C.TINTA, 800)}>{NOMES_T[t.tipo]}</Text></View><Text style={txt(12, C.MUTED, 600)}>{t.qtd} posts</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}><View style={{ height: 16, width: Math.round((230 * (t.engaj_medio || 0)) / mxe), borderRadius: 8, backgroundColor: COR_T[t.tipo] }} /><Text style={num(22)}>{D(t.engaj_medio, 0)}</Text></View>
            </View>))}
        </View>
      </Card></Sec>
      <Serve a="A nota do Instagram da escola e os números dos últimos posts públicos." b="Ver o que o público aprova e onde o perfil deixa a matrícula de lado." c="A **Campanha de Matrículas** e a **Captação** transformam o que engaja em contatos." />
      <Foot fonte="Instagram, dados públicos do perfil e dos últimos posts · cálculos da Áion" rodape={rod(c)} />
    </Pg>
  )
}

export function PageDigital2({ c, ig }: { c: RaioXCtx; ig: IgAnalise }) {
  if (!ig?.amostra?.n) return null
  const P = ig.perfil, E = ig.engajamento, Co = ig.conteudo, nt = E.curtidas_ocultas ? 'comentários' : 'curtidas e comentários'
  const em = Co.engaj_matricula, eo = Co.engaj_outros
  const comp = em && eo && Co.fala_matricula >= 2 ? (() => {
    const raz = eo / em, mx = Math.max(em, eo), hh = 150
    const col = (v: number, cor: string, rot: string) => <View style={{ flex: 1, alignItems: 'center' }}><Text style={num(38, cor)}>{D(v, 0)}</Text><View style={{ height: hh, justifyContent: 'flex-end', marginTop: 4 }}><View style={{ width: 84, height: Math.round((hh * v) / mx), borderTopLeftRadius: 14, borderTopRightRadius: 14, backgroundColor: cor }} /></View><Text style={{ ...txt(13, C.TINTA, 800), marginTop: 7, textAlign: 'center' }}>{rot}</Text></View>
    return (
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 24, paddingVertical: 20, paddingHorizontal: 26 }}>
        <View style={{ width: 260, flexDirection: 'row', gap: 16 }}>{col(em, C.CORAL, 'Posts de matrícula')}{col(eo, C.TURQ, 'Todos os outros posts')}</View>
        <View style={{ flex: 1 }}><Text style={num(58, C.RED_TXT)}>{D(raz)}×</Text><Text style={{ ...txt(16, C.TINTA, 800), marginVertical: 6 }}>menos {nt} nos posts de matrícula</Text><Text style={txt(13.2, C.TXT)}>O público reage ao dia a dia da escola, mas a conversa de matrícula ainda não prende. É o conteúdo que mais precisa de estratégia, porque é o que traz a família nova.</Text></View>
      </Card>)
  })() : null
  const tm = Co.temas.filter(t => t.qtd), hi = Math.ceil(Math.max(...tm.map(t => t.engaj_medio || 0), 1) / 50) * 50
  const its = [...tm].sort((a, b) => (b.engaj_medio || 0) - (a.engaj_medio || 0)).map(t => ({ rotulo: t.tema, sub: `${t.qtd} posts`, v: t.engaj_medio || 0 }))
  const pd = [...E.por_dia].sort((a, b) => DIAS.indexOf(a.dia) - DIAS.indexOf(b.dia)), mxd = Math.max(...pd.map(d => d.engaj_medio || 0), 1)
  const mb = E.melhor, leg = mb ? (mb.legenda.replace(/\s+/g, ' ').slice(0, 130) + '…') : ''
  return (
    <Pg>
      <Hero pill="Presença digital" title="O que a família responde: e o que ainda não funciona" lead={`Cruzamos assunto, dia e formato dos ${ig.amostra.n} posts de @${P.username} com o que o público fez em cada um.`} />
      {comp ? <Sec first><H2>Matrícula engaja menos que o resto</H2>{comp}</Sec> : null}
      <Sec first={!comp}><H2>{`Por assunto, em média de ${nt}`}</H2><Card style={{ paddingTop: 14, paddingBottom: 8, paddingHorizontal: 24 }}><Pirulito itens={its} lo={0} hi={hi} w={646} linha={34} passo={50} fmt={v => D(v, 0)} destaque="Matrícula e vagas" /><Text style={{ ...txt(11.5, '#8aa59c'), marginTop: -4 }}>Assuntos reconhecidos por palavras-chave nas legendas. Um post pode ter mais de um assunto.</Text></Card></Sec>
      <Sec><View style={{ flexDirection: 'row', gap: 14 }}>
        <Card style={{ flex: 1.25, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 18 }}><Text style={{ ...head(16, C.TINTA), marginBottom: 6 }}>Melhor dia para postar</Text>
          <View style={{ flexDirection: 'row', gap: 2 }}>{pd.map(d => { const v = d.engaj_medio || 0, h = d.qtd ? Math.round((78 * v) / mxd) : 0, best = d.dia === E.melhor_dia; return (
            <View key={d.dia} style={{ flex: 1, alignItems: 'center' }}><Text style={txt(12, best ? C.VERDE : C.MUTED, 800)}>{d.qtd ? D(v, 0) : '–'}</Text><View style={{ height: 82, justifyContent: 'flex-end', alignItems: 'center' }}><View style={{ width: 34, height: Math.max(h, 3), borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: best ? C.VERDE : d.qtd >= 2 ? '#7CC9BA' : '#D3EBE4' }} /></View><Text style={{ ...txt(12, best ? C.VERDE : C.TXT, 800), marginTop: 4 }}>{d.dia.slice(0, 3).replace(/^./, s => s.toUpperCase())}</Text><Text style={txt(10.5, '#8aa59c')}>{d.qtd} posts</Text></View>) })}</View>
        </Card>
        {mb ? <Card style={{ flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#FFF6DC', borderColor: '#FFE9B0', paddingVertical: 16, paddingHorizontal: 20 }}>
          <IconBox name="trophy" size={44} bg="#FFE9A8" color="#8a5a00" />
          <View style={{ flex: 1 }}><Text style={head(16, C.TINTA)}>Post que mais engajou</Text><Text style={{ ...txt(12.5, C.TXT), marginVertical: 4 }}>{leg.replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')}</Text><Text style={txt(12.5, C.VERDE, 800)}>{NOMES_T[mb.tipo]} · {dm(mb.data)}{mb.curtidas != null ? ` · ${F(mb.curtidas)} curtidas` : ''} · {F(mb.comentarios)} comentários</Text></View>
        </Card> : null}
      </View></Sec>
      <Serve a="O que o público fez em cada tipo de post." b="Descobrir o que prende a família e onde a matrícula perde força." c="A **Captação** mostra qual anúncio virou conversa e matrícula de verdade." />
      <Foot fonte="Instagram, dados públicos do perfil e dos últimos posts · cálculos da Áion" rodape={rod(c)} />
    </Pg>
  )
}

export function PageDigital3({ c, ig }: { c: RaioXCtx; ig: IgAnalise }) {
  if (!ig?.amostra?.n) return null
  const Co = ig.conteudo, A = ig.amostra
  const reels = ig.tipos.find(t => t.tipo === 'reels'), foto = ig.tipos.find(t => t.tipo === 'foto')
  const aj: [string, string][] = []
  for (const k of [...ig.checks].filter(k => !k.ok).sort((a, b) => b.peso - a.peso)) {
    switch (k.id) {
      case 'campanha': { const ex = reels?.engaj_medio && foto?.engaj_medio && reels.engaj_medio > foto.engaj_medio ? ` Os Reels engajam ${D(reels.engaj_medio / foto.engaj_medio)} vezes mais que as fotos: conte a matrícula em vídeo.` : ''; aj.push(['Dê à matrícula o mesmo cuidado dos eventos', `Só ${Co.fala_matricula} de ${A.n} posts falam de matrícula.${ex}`]); break }
      case 'chamada': aj.push(['Termine toda legenda com um convite', `Só ${Co.com_chamada} de ${A.n} legendas dizem à família o que fazer: chamar no WhatsApp, agendar visita ou clicar no link.`]); break
      case 'contato': aj.push(['Coloque o WhatsApp na bio', 'Quem se interessa precisa de um caminho de um toque para falar com a escola.']); break
      case 'site': aj.push(['Coloque um link na bio', 'É o único lugar do Instagram onde o link é clicável.']); break
      case 'matricula': aj.push(['Fale de matrícula na bio', 'A bio é a primeira coisa que a família lê.']); break
      case 'frequencia': aj.push(['Poste pelo menos duas vezes por semana', k.detalhe]); break
      case 'recente': aj.push(['Volte a postar', k.detalhe]); break
      case 'video': aj.push(['Use mais vídeo e Reels', k.detalhe]); break
    }
  }
  const half = Math.ceil(ig.checks.length / 2)
  const tile = (k: IgAnalise['checks'][number]) => (
    <View key={k.id} style={{ flex: 1, backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: k.ok ? '#CBEFE5' : '#F8CFCF', paddingVertical: 13, paddingHorizontal: 15, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: k.ok ? C.TURQ : C.CORAL, alignItems: 'center', justifyContent: 'center' }}><Icon name={k.ok ? 'check' : 'x'} size={16} color="#fff" sw={3} /></View>
      <View style={{ flex: 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Text style={{ ...txt(14, C.TINTA, 800), flex: 1 }}>{k.titulo}</Text><Text style={num(16, k.ok ? C.VERDE : '#B0B8B5')}>{k.ok ? k.peso : 0}/{k.peso}</Text></View><Text style={{ ...txt(11.8, '#4d6b62'), marginTop: 3 }}>{k.detalhe}</Text></View>
    </View>)
  const rows: React.ReactNode[] = []
  for (let i = 0; i < ig.checks.length; i += 2) rows.push(<View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>{tile(ig.checks[i])}{ig.checks[i + 1] ? tile(ig.checks[i + 1]) : <View style={{ flex: 1 }} />}</View>)
  return (
    <Pg>
      <Hero pill="Presença digital" title="Oito critérios explicam a nota e mostram por onde começar" lead={`A nota é a soma dos critérios que o perfil cumpre: **${ig.nota} de 100**. Os critérios são da Áion e olham só o que é público.`} />
      <Sec first>{rows}</Sec>
      <Sec><H2>Os 3 ajustes que mais mudam o resultado</H2><Card style={{ paddingVertical: 6, paddingHorizontal: 24 }}>
        {aj.slice(0, 3).map(([a, b], j) => <View key={j} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start', paddingVertical: 11, borderTopWidth: j ? 1 : 0, borderTopColor: C.LINHA }}><Text style={{ ...num(34, C.AMBAR), width: 28 }}>{j + 1}</Text><View style={{ flex: 1 }}><Text style={head(16.5, C.TINTA)}>{a}</Text><Text style={{ ...txt(12.8, C.TXT), marginTop: 2 }}>{b}</Text></View></View>)}
      </Card></Sec>
      <Aula title="Por que engajamento não é matrícula">Curtida mostra que o público gosta da escola, mas não que a família quer matricular. Por isso a nota olha também a bio, o link, o WhatsApp e se os posts convidam a agir.</Aula>
      <Serve a="Os 8 critérios da nota e os ajustes prioritários." b="Saber por onde começar a melhorar." c="A **Captação** e a **Vitrine** fecham o que o Instagram deixa aberto." />
      <Foot fonte="Instagram, dados públicos do perfil e dos últimos posts · critérios da Áion" rodape={rod(c)} />
    </Pg>
  )
}

export function PageDigital4({ c, ig }: { c: RaioXCtx; ig: IgAnalise }) {
  if (!ig?.amostra?.n) return null
  const n = c.nome, cid = c.cid, P = ig.perfil, Co = ig.conteudo, vit = !!P.site && P.site.includes('aionedu.com.br')
  const et: [string, string, string][] = [['Anúncio', 'Cada anúncio ganha um texto cadastrado', '#00402F'], ['Conversa', 'A família chama no WhatsApp', '#00796B'], ['Lead', 'O contato entra no CRM com a origem', C.TURQ], ['Visita', 'A equipe agenda e confirma', '#E0A100'], ['Matrícula', 'O resultado volta para o anúncio', '#E08A00']]
  const vt = vit ? `O link da bio de **@${P.username}** já leva à Vitrine da Áion. Falta só reforçar o convite nas legendas: hoje só ${Co.com_chamada} de ${ig.amostra.n} falam dele.` : 'O link da bio pode levar à Vitrine, para a família ver a escola e pedir informações em um só lugar.'
  const btn = (t: string, bg: string, cor: string) => <View style={{ backgroundColor: bg, borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}><Text style={txt(11.5, cor, 800)}>{t}</Text></View>
  return (
    <Pg>
      <Hero pill="Como a Áion ajuda" title="O Instagram atrai. A Captação e a Vitrine transformam atenção em matrícula" lead="Seu perfil já gera atenção. Estes dois módulos cuidam do que acontece depois do clique." />
      <Sec first><H2>Captação: de qual anúncio veio cada matrícula</H2><Card style={{ paddingTop: 20, paddingBottom: 16, paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>{et.map(([t, d, cor], i) => (
          <View key={t} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 104 - i * 8, height: 62, borderRadius: 14, backgroundColor: cor, alignItems: 'center', justifyContent: 'center' }}><Text style={head(13, '#fff', 800)}>{t}</Text></View>
            <Text style={{ ...txt(11.4, C.TXT), marginTop: 7, paddingHorizontal: 4, textAlign: 'center' }}>{d}</Text>
          </View>))}</View>
        <Rich t="Você cadastra o texto de cada anúncio ou post patrocinado. Quando a família chama no WhatsApp, a Áion reconhece a campanha e mostra, por captação, quantas **conversas, leads, visitas e matrículas** ela trouxe." style={{ ...txt(13, C.TXT), marginTop: 14, paddingHorizontal: 6 }} />
      </Card></Sec>
      <Sec><H2>Vitrine: a página da escola para o link da bio</H2><Card style={{ flexDirection: 'row', gap: 30, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 26 }}>
        <View style={{ width: 216, height: 372, borderRadius: 34, backgroundColor: '#0B2E25', padding: 9 }}>
          <View style={{ flex: 1, borderRadius: 26, backgroundColor: '#fff', overflow: 'hidden' }}>
            <View style={{ height: 112, padding: 14 }}>
              <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={198} height={112} viewBox="0 0 198 112"><Defs><LinearGradient id="vit" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#00523C" /><Stop offset="1" stopColor="#0DD3BF" /></LinearGradient></Defs><Rect x={0} y={0} width={198} height={112} fill="url(#vit)" /></Svg>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: '#fff' }} />
              <Text style={{ ...head(16, '#fff', 800), marginTop: 9 }}>{n}</Text><Text style={txt(10, '#fff')}>{cid}, {c.uf}</Text>
            </View>
            <View style={{ padding: 12, gap: 8 }}>{btn('Matrículas abertas', '#DDF5EE', C.VERDE)}{btn('Falar no WhatsApp', '#25D366', '#fff')}{btn('Agendar visita', '#F3FAF7', C.VERDE)}{btn('Deixar meu contato', '#F3FAF7', C.VERDE)}</View>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Rich t="Uma página pública da escola, com fotos, texto, botões, formulário de contato e WhatsApp, pronta para divulgar. O contato que chega por ela **entra direto no CRM**." style={txt(14.5, C.TXT)} />
          <View style={{ marginTop: 14, borderRadius: 16, backgroundColor: '#FFF6DC', paddingVertical: 13, paddingHorizontal: 16 }}><Rich t={vt} style={txt(13, '#6b4a00')} /></View>
        </View>
      </Card></Sec>
      <Serve a="Dois módulos da Áion que continuam o que o Instagram começa." b="Saber de onde vem cada matrícula e dar à bio um destino que converte." c="**Captação** e **Vitrine** ficam ligadas ao CRM e ao WhatsApp da escola." />
      <Foot fonte="Plataforma Áion Edu" rodape={rod(c)} />
    </Pg>
  )
}
