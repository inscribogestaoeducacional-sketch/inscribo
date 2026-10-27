import React from 'react'
import { View, Text, Svg, Defs, LinearGradient, Stop, Rect, Link } from '@react-pdf/renderer'
import { C, Pg, Sec, H2, Card, Hero, Serve, Aula, Foot, Rich, Icon, IconBox, txt, num, head } from './ui'
import { F, D, type RaioXCtx } from '../data'
import { insights } from '../insights'
import { PERGUNTAS, FAIXA_TXT, textoResposta } from '../atendimento'
import { Medidor } from './charts'

const rod = (c: RaioXCtx) => `${c.nome} · ${c.cid}/${c.uf}`

function Grad({ id, w, h, a = '#00402F', b = '#00796B' }: { id: string; w: number; h: number; a?: string; b?: string }) {
  return <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={w} height={h} viewBox={`0 0 ${w} ${h}`}><Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor={a} /><Stop offset="1" stopColor={b} /></LinearGradient></Defs><Rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} /></Svg>
}

// ─── Diagnóstico de atendimento ──────────────────────────────────────────────
export function PageAtendimento({ c }: { c: RaioXCtx }) {
  const A = c.atend
  const Q: [string, string, string, string][] = [
    ['timer', 'Quanto tempo a escola leva para responder um contato novo?', 'menos de 5 min, até 1 hora, no mesmo dia ou só no dia seguinte', ''],
    ['inbox', 'Quantos contatos de famílias novas chegam por mês?', 'faixas de 0 a mais de 300', ''],
    ['door', 'De cada 10 famílias que pedem informação, quantas visitam?', 'de 0 a 10', ''],
    ['moon', 'Quem atende fora do horário e nos fins de semana?', 'ninguém, um funcionário, robô ou equipe de plantão', ''],
    ['target', 'A escola sabe de qual anúncio veio cada matrícula?', 'não sabe, de alguns ou de todos', ''],
    ['repeat', 'Como é feita a rematrícula?', 'sem processo, papel, planilha ou sistema com cobrança', ''],
    ['map', 'Quantos alunos moram em outra cidade? (opcional)', 'percentual aproximado e as cidades', 'o']]
  const fx: [string, string, string][] = [['80 a 100', 'Atendimento forte', C.TURQ], ['50 a 79', 'Atendimento com falhas', C.AMBAR], ['0 a 49', 'Matrículas se perdendo no caminho', C.CORAL]]
  return (
    <Pg>
      <Hero pill="Diagnóstico de atendimento" title={A ? `Atendimento do ${c.nome}: nota ${A.pontuacao} de 100` : 'Seis perguntas mostram quantas matrículas o atendimento deixa passar'} lead={A ? `**${FAIXA_TXT[A.faixa]}.** Respostas informadas pela própria escola no site da Áion.` : 'Os dados públicos mostram o mercado. Esta etapa mostra a escola por dentro: quem responde, quanto demora e de onde vêm as matrículas.'}
        side={A ? <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 28, padding: 14, paddingBottom: 10 }}><Medidor nota={A.pontuacao} cor="#FFD166" w={236} branco /></View> : undefined} />
      <Sec first><Card style={{ paddingVertical: 4, paddingHorizontal: 22 }}>
        {Q.map(([ic, t, o, op], i) => <View key={i} style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: C.LINHA }}>
          <IconBox name={ic} size={42} bg={op ? '#FFF0C7' : '#DDF5EE'} color={op ? '#8a5a00' : C.VERDE} />
          <View style={{ flex: 1 }}><Text style={txt(14, C.TINTA, 800)}>{t}</Text>{A && PERGUNTAS[i] && textoResposta(PERGUNTAS[i].id, A.respostas[PERGUNTAS[i].id]) ? <Text style={{ ...txt(12.5, C.VERDE, 800), marginTop: 2 }}>{textoResposta(PERGUNTAS[i].id, A.respostas[PERGUNTAS[i].id])}</Text> : <Text style={{ ...txt(12, C.MUTED), marginTop: 2 }}>{o}</Text>}</View>
        </View>)}
      </Card></Sec>
      <Sec><H2>Como a nota de 0 a 100 funciona</H2><View style={{ flexDirection: 'row', gap: 12 }}>
        {fx.map(([a, t, cor]) => <View key={a} style={{ flex: 1, borderRadius: 22, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: cor }}><Text style={num(34, '#fff')}>{a}</Text><Text style={{ ...txt(13.5, '#fff', 700), marginTop: 6 }}>{t}</Text></View>)}
      </View></Sec>
      <Sec><Card style={{ backgroundColor: '#FFF6DC', borderColor: '#FFE9B0', paddingVertical: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}><IconBox name="bulb" size={32} bg="#FFE9A8" color="#8a5a00" /> <Rich t={A ? 'Esta é a única página preenchida pela **própria escola**. A nota soma tempo de resposta, visitas, atendimento fora do horário, origem das matrículas e rematrícula; o volume de contatos é só contexto.' : 'Esta é a única página preenchida pela **própria escola**, no site. Nenhuma resposta é inventada: sem resposta, a nota não aparece.'} style={{ ...txt(13, '#4a3b00'), flex: 1 }} /></Card></Sec>
      <Serve a="Seis perguntas sobre o atendimento, com nota de 0 a 100." b="Ver onde a matrícula escapa entre o contato e a rematrícula." c="O **robô** responde na hora e o **CRM** registra a origem." />
      <Foot fonte="respostas da própria escola, informadas no site da Áion" rodape={rod(c)} />
    </Pg>
  )
}

// ─── Diagnóstico da IA ───────────────────────────────────────────────────────
export function PageIA({ c }: { c: RaioXCtx }) {
  const { R, nome: n, cid } = c, P = R.posicao, S = R.serie, { ops, fatos } = insights(c)
  const e = S.map(s => s.escola?.total ?? 0), ci = S.map(s => s.cidade.total)
  const chE = 100 * (e[e.length - 1] / e[0] - 1), chC = 100 * (ci[ci.length - 1] / ci[0] - 1)
  const forte: string[] = [], risco: string[] = []; let iaOport: string[] | null = null, iaAtend: string[] | null = null
  if (P.ranking === 1) forte.push(`É a escola particular com mais alunos de ${cid} (${F(P.minha)}).`)
  else if (P.ranking <= 3) forte.push(`Está entre as 3 maiores particulares de ${cid} (${P.ranking}º, ${F(P.minha)} alunos).`)
  if (isFinite(chE) && chE > chC) forte.push(`Cresceu ${D(chE, 0)}% desde ${S[0].ano}, e a cidade, ${D(chC, 0)}%.`)
  if (fatos.lider_em?.length) forte.push('Lidera em: ' + fatos.lider_em.join(', ').toLowerCase() + '.')
  if (fatos.enem) { const [pos, tot, g] = fatos.enem; if (pos) forte.push(`No ENEM ${R.enem?.ano}: média ${D(g)}, ${pos}º entre ${tot} particulares.`) }
  if (fatos.passagem) { const [t, re, rc] = fatos.passagem; risco.push(`A passagem ${t} mantém ${D(100 * re, 0)} alunos por 100, contra ${D(100 * rc, 0)} na cidade.`) }
  const N = (R as any).nascimentos as { ano: number; nascidos: number }[] | undefined
  if (N && N.length > 1) risco.push(`Nascimentos em ${cid}: de ${F(N[0].nascidos)} (${N[0].ano}) para ${F(N[N.length - 1].nascidos)} (${N[N.length - 1].ano}), com ${S[S.length - 1].cidade.escolas} particulares disputando esses alunos.`)
  if (fatos.creche && fatos.creche[0] < fatos.creche[1]) risco.push(`A creche cresceu ${D(fatos.creche[0], 0)}% desde ${S[0].ano}; a da cidade, ${D(fatos.creche[1], 0)}%.`)
  if (c.textoIA) {
    const sec: Record<string, string[]> = {}; let cur = ''
    for (const ln of c.textoIA.split('\n').map(x => x.trim()).filter(Boolean)) {
      const t = ln.replace(/[:.]$/, '')
      if (['O que está forte', 'Onde há risco', 'Onde está a oportunidade', 'Atendimento'].includes(t)) { cur = t; sec[cur] = []; continue }
      if (cur) sec[cur].push(...(ln.match(/[^.!?]+[.!?]+/g) ?? [ln]).map(x => x.trim()))
    }
    if (sec['O que está forte']) { forte.length = 0; forte.push(...sec['O que está forte']) }
    if (sec['Onde há risco']) { risco.length = 0; risco.push(...sec['Onde há risco']) }
    if (sec['Onde está a oportunidade']) iaOport = sec['Onde está a oportunidade']
    if (sec['Atendimento']) iaAtend = sec['Atendimento']
  }
  const top = ops.slice(0, 3), oport = iaOport ?? top.map(o => `**${o.titulo}.** ${o.texto}`)
  const primeiro = top.length ? 'Escolha uma oportunidade, defina uma meta de matrículas e acompanhe o resultado por 30 dias.' : 'Acompanhe os números do relatório a cada trimestre.'
  const bl = (ic: string, t: string, it: string[], cor: string) => (
    <Card style={{ paddingTop: 14, paddingBottom: 12, paddingHorizontal: 22, borderLeftWidth: 9, borderLeftColor: cor }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={ic} size={22} color={cor} /><Text style={head(18, cor, 800)}>{t}</Text></View>
      {(it.length ? it : ['Sem ponto a destacar com os dados disponíveis.']).map((x, i) => <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}><Text style={txt(13.5, cor, 800)}>•</Text><Rich t={x} style={{ ...txt(13.5, '#2b4a41'), flex: 1 }} /></View>)}
    </Card>)
  return (
    <Pg>
      <Hero pill="Diagnóstico da IA" title={`Resumo do que os números dizem sobre o ${n}`} lead="Um texto escrito por inteligência artificial usando somente os números das páginas anteriores." />
      <Sec first>{bl('award', 'O que está forte', forte, '#00796B')}</Sec>
      <Sec>{bl('alert', 'Onde há risco', risco, C.RED_TXT)}</Sec>
      <Sec>{bl('rocket', 'Onde está a oportunidade', oport, C.WARN_TXT)}</Sec>
      {iaAtend ? <Sec>{bl('call', 'Atendimento', iaAtend, C.VERDE)}</Sec> : null}
      <Sec><View style={{ borderRadius: 24, overflow: 'hidden', flexDirection: 'row', gap: 16, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24 }}>
        <Grad id="ia30" w={698} h={110} a={C.VERDE} b={C.TURQ} />
        <Text style={num(46, '#fff')}>30</Text>
        <View style={{ flex: 1 }}><Text style={head(16, '#fff', 800)}>Primeiro passo para os próximos 30 dias</Text><Text style={{ ...txt(13.5, '#fff'), marginTop: 3 }}>{primeiro}</Text></View>
      </View></Sec>
      <Aula title="Aviso">Texto gerado por IA a partir dos dados públicos e das respostas da escola, conferido contra os números do relatório. Ele aponta onde olhar; a decisão é da gestão.</Aula>
      <Foot fonte="texto gerado por IA a partir dos números deste relatório" rodape={rod(c)} />
    </Pg>
  )
}

// ─── Metas e relatórios com IA ───────────────────────────────────────────────
export function PageMetas({ c }: { c: RaioXCtx }) {
  const n = c.nome
  const P: [string, string, string][] = [
    ['edit', 'A escola informa só dois números', 'Quantos alunos tem hoje e quantos quer ter no próximo ano.'],
    ['calc', 'A Áion calcula tudo', 'Lê o histórico, vê quantos alunos costumam voltar e separa a meta em rematrículas e matrículas novas.'],
    ['calendar', 'A meta vira um calendário', 'Divide a meta mês a mês pelo que a escola já viveu e mostra quantos contatos e visitas são necessários.'],
    ['bot', 'A IA acompanha toda semana', 'Compara o resultado com a meta do mês, avisa quando há atraso, recalcula os meses seguintes e sugere o que fazer.'],
    ['chart', 'O relatório chega pronto', 'O gestor recebe, sem montar planilha: onde estamos, o que está travando e o que fazer nesta semana.']]
  const ex: [string, string, string][] = [['Meta do mês', 'Matrículas novas e rematrículas que a escola precisa fechar', C.TURQ], ['Realizado', 'O que já entrou no mês, vindo do CRM', C.AMBAR], ['Alerta da IA', 'Ritmo abaixo ou dentro da meta, com o que fazer', C.CORAL]]
  return (
    <Pg>
      <Hero pill="Metas e relatórios com IA" title={`As metas de matrícula do ${n}, calculadas pela Áion`} lead="O gestor não faz conta. A Áion calcula as metas com o histórico da escola e a IA acompanha o resultado." />
      <Sec first><H2>Como funciona, passo a passo</H2><Card style={{ paddingTop: 18, paddingBottom: 12, paddingHorizontal: 24 }}>
        {P.map(([ic, t, d], i) => <View key={i} style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ alignItems: 'center' }}>
            <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><Grad id={`mt${i}`} w={46} h={46} a={C.VERDE} b={C.TURQ} /><Icon name={ic} size={22} color="#fff" /></View>
            {i < 4 ? <View style={{ width: 3, flex: 1, backgroundColor: '#CBEFE5', marginVertical: 3 }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: i === 4 ? 0 : 12 }}><Text style={head(16.5, C.TINTA)}>{i + 1}. {t}</Text><Text style={{ ...txt(13, C.TXT), marginTop: 2 }}>{d}</Text></View>
        </View>)}
      </Card></Sec>
      <Sec><H2>O que o gestor vê no acompanhamento</H2><View style={{ flexDirection: 'row', gap: 12 }}>
        {ex.map(([a, b, cor]) => <View key={a} style={{ flex: 1, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: cor }}><Text style={head(17, '#fff', 800)}>{a}</Text><Text style={{ ...txt(12.5, '#fff'), marginTop: 5 }}>{b}</Text></View>)}
      </View><Text style={{ ...txt(11.5, C.MUTED), marginTop: 7 }}>Os números aparecem depois que a escola informa o histórico. Esta página não traz metas calculadas: os dados públicos não mostram a matrícula interna da escola.</Text></Sec>
      <Aula title="Por que meta por mês">Matrícula não acontece igual o ano todo. Uma meta só para o ano esconde o atraso até ser tarde; a meta mensal mostra cedo se a escola está no ritmo.</Aula>
      <Serve a="Como o histórico da escola vira metas e relatórios." b="Ter meta clara e saber, toda semana, se a escola está no caminho." c="O **Funil**, a **Campanha** e o **relatório automático**." />
      <Foot fonte="funcionamento da plataforma Áion Edu" rodape={rod(c)} />
    </Pg>
  )
}

// ─── Top 3 oportunidades + WhatsApp ──────────────────────────────────────────
export function PageOportunidades({ c }: { c: RaioXCtx }) {
  const { nome: n, cid } = c, top = insights(c).ops.slice(0, 3)
  return (
    <Pg>
      <Hero pill="As 3 maiores oportunidades" title={`Por onde o ${n} pode crescer mais rápido`} lead={`As três com maior diferença entre a escola e o mercado de ${cid}, pelos números das páginas anteriores.`} />
      <Sec first style={{ gap: 12 }}>
        {top.map((o, i) => <Card key={i} style={{ flexDirection: 'row', gap: 18, alignItems: 'flex-start', paddingVertical: 18 }}>
          <Text style={{ ...num(58, C.TURQ), width: 44 }}>{i + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={head(18, C.VERDE, 800)}>{o.titulo}</Text>
            <Rich t={o.texto} style={{ ...txt(13.5, C.TXT), marginTop: 5 }} />
            <View style={{ marginTop: 9, flexDirection: 'row', gap: 8, backgroundColor: '#E6F7F2', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 12 }}><Text style={txt(12.5, C.VERDE, 800)}>{o.modulo}:</Text><Rich t={o.como} style={{ ...txt(12.5, C.TXT), flex: 1 }} /></View>
          </View>
        </Card>)}
      </Sec>
      <Sec><View style={{ borderRadius: 28, overflow: 'hidden', flexDirection: 'row', gap: 18, alignItems: 'center', paddingVertical: 22, paddingHorizontal: 26 }}>
        <Grad id="wpp" w={698} h={130} />
        <View style={{ flex: 1 }}><Text style={head(21, '#fff', 800)}>Quer conversar sobre esses números?</Text><Text style={{ ...txt(14, '#fff'), marginTop: 5 }}>Fale com a equipe da Áion e tire suas dúvidas sobre este relatório.</Text></View>
        <Link src="https://wa.me/5583993444383" style={{ textDecoration: 'none' }}><View style={{ backgroundColor: '#25D366', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' }}><Text style={txt(15, '#fff', 800)}>Fale com a Áion no WhatsApp</Text><Text style={txt(13, '#fff', 700)}>(83) 99344-4383</Text></View></Link>
      </View></Sec>
      <Aula title="De onde vêm os dados">INEP (Censo Escolar 2021 a 2025 e ENEM 2025), IBGE (Censo 2022: idade, renda e bairros), Ministério da Saúde (SINASC) e respostas da própria escola. A Áion calculou as médias e comparações. Escolas públicas não entram.</Aula>
      <Foot fonte="Áion Soluções Tecnológicas · aionedu.com.br" rodape={rod(c)} />
    </Pg>
  )
}
