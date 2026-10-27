import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Lightning, ShieldCheck, DeviceMobile } from '@phosphor-icons/react'
import { SiteShell, Btn, WaButton } from './SiteShell'
import { DeskFrame, PhoneFrame } from './Devices'
import { ModIcon } from './icons'
import SchoolsMap from './SchoolsMap'
import { MODULES, moduleBySlug, useInView, useSeo } from './lib'
import { appLd, faqLd, orgLd } from './jsonld'
import home from './content/home.json'

function Rv({ children, d = 0, className = '', style }: { children: React.ReactNode; d?: number; className?: string; style?: React.CSSProperties }) {
  const ref = useInView<HTMLDivElement>()
  return <div ref={ref} className={`st-rv${d ? ` d${d}` : ''} ${className}`} style={style}>{children}</div>
}

/* ---------- Herói ---------- */
const LEADS = [['Maria Clara · 5º ano', 'Instagram'], ['Rafael · Infantil 3', 'Google'], ['Helena · 1º ano', 'Indicação'], ['Davi · 9º ano', 'Vitrine']]
function Hero() {
  const [n, setN] = useState(0)
  const [mat, setMat] = useState(76)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const a = setInterval(() => setN(x => (x + 1) % LEADS.length), 3200)
    const b = setInterval(() => setMat(x => (x >= 83 ? 76 : x + 1)), 2600)
    return () => { clearInterval(a); clearInterval(b) }
  }, [])
  return (
    <section className="st-hero">
      <div className="st-wrap st-hero-in">
        <div>
          <span className="st-pill"><i />Para escolas particulares</span>
          <h1>Sua campanha de matrículas, do primeiro contato à <span className="st-grad" style={{ backgroundImage: 'linear-gradient(100deg,#7ff0d1,#2DCBA4)' }}>matrícula</span>, em um lugar só</h1>
          <p className="sub">{home.sub}</p>
          <div className="st-hero-cta"><WaButton /><Btn kind="ghost" href="#modulos">Ver os módulos <ArrowRight size={18} weight="bold" /></Btn></div>
          <div className="st-trust">
            <span><ShieldCheck size={20} weight="duotone" color="#2DCBA4" />WhatsApp oficial da Meta</span>
            <span><Lightning size={20} weight="duotone" color="#2DCBA4" />Pronto em até 5 dias</span>
            <span><DeviceMobile size={20} weight="duotone" color="#2DCBA4" />Celular e computador</span>
          </div>
        </div>
        <div className="st-duo" style={{ paddingBottom: '6%' }}>
          <DeskFrame shot="inicio" alt="Tela inicial da Áion Edu no computador, com resultados da campanha" eager />
          <PhoneFrame shot="inicio" alt="Tela inicial da Áion Edu no celular" eager />
          <div className="st-float" style={{ left: '-3%', top: '14%' }} aria-hidden="true">
            <span className="st-ico" style={{ background: '#D1FAE5', color: '#16A34A' }}><ModIcon name="WhatsappLogo" size={20} /></span>
            <div key={n}>Novo lead<small>{LEADS[n][0]} · {LEADS[n][1]}</small></div>
          </div>
          <div className="st-float" style={{ left: '12%', bottom: '-2%', animationDelay: '1.2s' }} aria-hidden="true">
            <span className="st-ico" style={{ background: '#FFEDD5', color: '#EA580C' }}><ModIcon name="Flag" size={20} /></span>
            <div>Matrículas no mês<small><b style={{ color: '#047857' }}>{mat}</b> de 90 da meta</small></div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Problema e solução ---------- */
const PROBLEMS = [
  { id: 'noite', t: 'A família escreveu às 21h e ninguém respondeu', s: 'No dia seguinte ela já falou com outra escola.', mods: ['whatsapp', 'robo-e-sequencia'], shot: 'whatsapp', h: 'O WhatsApp responde enquanto a equipe descansa', p: 'O robô atende fora do horário, coleta o nome e a série e deixa a conversa na fila. Na manhã seguinte a equipe vê quem chegou e responde primeiro quem esperou mais.' },
  { id: 'meta', t: 'Só descubro que a meta está longe em novembro', s: 'Sem acompanhamento, não dá tempo de reagir.', mods: ['campanha-de-matriculas'], shot: 'funil', h: 'A meta acompanha você mês a mês', p: 'O que faltou em um mês soma no seguinte. O funil mostra em que etapa as famílias estão paradas e o mapa do dia mostra cada matrícula.' },
  { id: 'numero', t: 'O número do CRM é diferente do número da secretaria', s: 'Cada reunião vira uma discussão sobre qual está certo.', mods: ['base-de-alunos', 'rematricula'], shot: 'base', h: 'O número final é o do sistema da escola', p: 'A Áion Edu lê a Activesoft toda madrugada e confere com os leads. O que não bate aparece numa lista, e a rematrícula é mostrada série a série.' },
  { id: 'anuncio', t: 'Invisto em anúncio e não sei qual deu matrícula', s: 'O lead chega no WhatsApp sem origem.', mods: ['captacao-inteligente', 'vitrine'], shot: 'captacao', h: 'Cada anúncio ganha o seu link', p: 'A conversa já abre com a origem marcada. O lead entra no funil com ela e você vê o investimento e as matrículas de cada campanha.' },
  { id: 'visita', t: 'A família visitou a escola e sumiu', s: 'Ninguém lembrou de retomar o contato.', mods: ['visitas', 'robo-e-sequencia'], shot: 'visitas', h: 'Visita marcada acontece, visita feita é retomada', p: 'Confirmação e lembrete automáticos pelo WhatsApp. Depois da visita, a sequência retoma o contato no dia certo, até a família responder.' },
  { id: 'equipe', t: 'Quando alguém sai da equipe, o histórico sai junto', s: 'As conversas ficavam no celular pessoal.', mods: ['crm-de-leads', 'contatos'], shot: 'leads', h: 'O histórico é da escola, não do atendente', p: 'Cada família tem um card com origem, conversas, visitas e próximos passos. Quem chega continua de onde o colega parou.' },
  { id: 'saida', t: 'Não sei por que as famílias estão saindo', s: 'A escola repete os mesmos erros no ano seguinte.', mods: ['transferencias', 'pesquisas-e-nps'], shot: 'transferencias', h: 'Descubra o motivo real, com a família ainda por perto', p: 'A pesquisa por link muda as perguntas conforme o motivo e a IA resume o risco. O NPS mostra quem está insatisfeito antes de pedir transferência.' },
]
function Problems() {
  const [i, setI] = useState(0)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.matchMedia?.('(max-width: 900px)').matches) return
    const t = setInterval(() => setI(x => (x + 1) % PROBLEMS.length), 7000)
    return () => clearInterval(t)
  }, [auto])
  const p = PROBLEMS[i]
  const panel = (cls: string) => (
    <div className={`st-prob-panel ${cls}`} role="tabpanel" key={p.id + cls}>
      <span className="st-eyebrow">A solução</span>
      <h3>{p.h}</h3>
      <p className="why">{p.p}</p>
      <div className="st-showcase">
        <DeskFrame shot={p.shot} alt={`Tela do módulo: ${p.h}`} url="app.aionedu.com.br" eager />
        <PhoneFrame shot={p.shot} alt={`Tela no celular: ${p.h}`} eager />
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
        {p.mods.map(s => { const m = moduleBySlug(s)!; return <a key={s} className="st-btn st-btn-line" style={{ minHeight: 40, padding: '8px 16px', fontSize: 14 }} href={`/modulos/${s}`}><ModIcon name={m.icon} size={18} color={m.color} />{m.name}</a> })}
      </div>
    </div>
  )
  return (
    <section className="st-sec st-alt" id="problemas">
      <div className="st-wrap">
        <Rv><span className="st-eyebrow">A rotina da escola</span>
          <h2 className="st-h2" style={{ marginTop: 12, maxWidth: 780 }}>Você já passou por isso? Cada problema tem a sua solução aqui.</h2></Rv>
        <div className="st-prob">
          <div className="st-prob-list" role="tablist" aria-label="Problemas da escola">
            {PROBLEMS.map((x, k) => (
              <div key={x.id} style={{ display: 'contents' }}>
                <button role="tab" aria-selected={i === k} className="st-prob-item" onClick={() => { setI(k); setAuto(false) }}>
                  <span className="st-ico" style={{ background: i === k ? '#05907B' : '#E6F7F5', color: i === k ? '#fff' : '#05907B', fontWeight: 800 }}>{k + 1}</span>
                  <span><b>{x.t}</b><span className="t">{x.s}</span></span>
                </button>
                {i === k && panel('inline')}
              </div>
            ))}
          </div>
          {panel('side')}
        </div>
      </div>
    </section>
  )
}

/* ---------- Palco: a logo vira cada módulo ---------- */
const STAGE = ['crm-de-leads', 'whatsapp', 'robo-e-sequencia', 'captacao-inteligente', 'vitrine', 'campanha-de-matriculas', 'base-de-alunos', 'rematricula', 'transmissoes']
const TOKEN_RADIUS = ['22px', '50%', '30% 70% 70% 30% / 30% 30% 70% 70%', '18px', '50%', '26px', '42% 58% 40% 60% / 55% 45% 55% 45%', '50%', '16px']
function Stage() {
  const mods = STAGE.map(s => moduleBySlug(s)!)
  const [on, setOn] = useState(-1)
  const [pop, setPop] = useState(false)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) setOn(Number((e.target as HTMLElement).dataset.i)) }), { rootMargin: '-45% 0px -45% 0px' })
    refs.current.forEach(r => r && o.observe(r))
    return () => o.disconnect()
  }, [])
  useEffect(() => { setPop(true); const t = setTimeout(() => setPop(false), 500); return () => clearTimeout(t) }, [on])
  const cur = on >= 0 ? mods[on] : null
  return (
    <section className="st-stage st-sec" id="modulos">
      <div className="st-wrap">
        <Rv><span className="st-eyebrow" style={{ color: '#2DCBA4' }}>Os módulos</span>
          <h2 className="st-h2" style={{ marginTop: 12, maxWidth: 760, color: '#fff' }}>Um sistema só, que muda conforme o seu dia</h2>
          <p className="st-lead" style={{ color: 'rgba(255,255,255,.7)', marginTop: 14 }}>Role a página e veja a Áion Edu virar cada módulo.</p></Rv>
        <div className="st-stage-grid" style={{ marginTop: 40 }}>
          <div className="st-stage-left" aria-hidden="true">
            <div className={`st-token${pop ? ' pop' : ''}`} style={{ background: cur ? cur.color : 'linear-gradient(135deg,#05907B,#2DCBA4)', borderRadius: on >= 0 ? TOKEN_RADIUS[on] : '22px' }}>
              {cur ? <ModIcon name={cur.icon} size={46} weight="fill" color="#fff" /> : <img src="/site/logo-icon.webp" alt="" width="64" height="60" />}
            </div>
            <div className="st-stage-shot">
              {mods.map((m, k) => <DeskFrame key={m.slug} shot={m.shot} alt="" className={on === k || (on < 0 && k === 0) ? 'on' : ''} />)}
            </div>
          </div>
          <div className="st-stage-right">
            {mods.map((m, k) => (
              <div key={m.slug} data-i={k} ref={el => { refs.current[k] = el }} className={`st-step${on === k ? ' on' : ''}`}>
                <span className="st-ico" style={{ background: m.color, color: '#fff', width: 48, height: 48, borderRadius: 14 }}><ModIcon name={m.icon} size={26} weight="fill" /></span>
                <h3>{m.name}{m.paid && <span className="st-tag" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Módulo à parte</span>}</h3>
                <p>{m.headline}. {m.sub}</p>
                <ul>{m.features.slice(0, 3).map(f => <li key={f.t}>{f.t}</li>)}</ul>
                <a className="more" href={`/modulos/${m.slug}`}>Ver o módulo <ArrowRight size={16} weight="bold" /></a>
                <div className="st-step-mob"><PhoneFrame shot={m.shot} alt={`Tela do módulo ${m.name} no celular`} /></div>
              </div>
            ))}
            <div style={{ textAlign: 'center' }}><Btn kind="wa" href="/modulos">Ver os {MODULES.length} módulos</Btn></div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Celular ---------- */
function Mobile() {
  return (
    <section className="st-sec">
      <div className="st-wrap">
        <div className="st-split">
          <Rv>
            <span className="st-eyebrow">No bolso do gestor</span>
            <h2 className="st-h2" style={{ marginTop: 12 }}>A campanha inteira na palma da mão</h2>
            <p className="st-lead" style={{ marginTop: 16 }}>O gestor abre o celular e vê quanto falta para a meta, quem está na fila do WhatsApp e quais famílias precisam de contato. Tudo com as mesmas telas do computador, pensadas para o dedo.</p>
            <ul className="st-checks"><li>Instala como aplicativo, sem loja</li><li>Notificação quando uma família escreve</li><li>Funil, campanha e conversas na mesma tela</li></ul>
          </Rv>
          <Rv d={2}><div style={{ display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'flex-end' }}>
            <PhoneFrame shot="funil" alt="Funil de matrículas no celular" className="" />
            <div style={{ transform: 'translateY(-24px)', width: '100%', maxWidth: 230 }}><PhoneFrame shot="whatsapp" alt="Fila de WhatsApp no celular" /></div>
          </div></Rv>
        </div>
      </div>
    </section>
  )
}

/* ---------- WhatsApp: duas formas ---------- */
function Ways() {
  return (
    <section className="st-sec st-alt">
      <div className="st-wrap">
        <Rv><span className="st-eyebrow">WhatsApp oficial da Meta</span>
          <h2 className="st-h2" style={{ marginTop: 12, maxWidth: 760 }}>Conecte o número da escola do jeito que for melhor para vocês</h2>
          <p className="st-lead" style={{ marginTop: 14 }}>Duas formas de conectar. As mensagens de atendimento estão incluídas no plano, sem cobrança por mensagem.</p></Rv>
        <div className="st-ways">
          <Rv className="st-way"><span className="n">Forma 1</span><h3>App WhatsApp Business (coexistência)</h3><p style={{ color: 'var(--mut)' }}>A Áion acompanha a conexão com você, em uma chamada curta. O número continua funcionando no WhatsApp Business do celular e a equipe atende também pela Áion Edu.</p></Rv>
          <Rv d={1} className="st-way"><span className="n">Forma 2</span><h3>API oficial com Phone ID e token</h3><p style={{ color: 'var(--mut)' }}>Para quem já tem a conta da Meta configurada. A Áion cadastra o Phone ID e o token e testa a conexão.</p></Rv>
        </div>
        <div style={{ marginTop: 28 }}><Btn kind="main" href="/integracoes/whatsapp">Ver a integração com o WhatsApp <ArrowRight size={18} weight="bold" /></Btn></div>
      </div>
    </section>
  )
}

/* ---------- Como começar ---------- */
function Steps() {
  const steps = [['Implantação em até 5 dias', 'Integramos o sistema da escola, conectamos o WhatsApp, cadastramos a equipe e montamos os fluxos.'], ['Campanha com apoio da IA', 'A IA lê os dados da escola e monta a campanha, com meta por mês e por série.'], ['Acompanhamento todo mês', 'Reunião de desempenho, relatório automático e ajuste de estratégia.']]
  return (
    <section className="st-sec">
      <div className="st-wrap">
        <Rv style={{ textAlign: 'center' }}><span className="st-eyebrow">Como começar</span><h2 className="st-h2" style={{ marginTop: 12 }}>Você não faz nada sozinho</h2></Rv>
        <div className="st-grid" style={{ marginTop: 36 }}>
          {steps.map(([t, d], k) => <Rv key={t} d={k} className="st-card"><span className="st-ico" style={{ background: '#E6F7F5', color: '#05907B', fontWeight: 800 }}>{k + 1}</span><h3>{t}</h3><p>{d}</p></Rv>)}
        </div>
        <Rv style={{ textAlign: 'center', marginTop: 28 }}><Btn kind="main" href="/modulos/minha-campanha">Ver o passo a passo da campanha</Btn></Rv>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section className="st-sec st-alt">
      <div className="st-wrap">
        <Rv style={{ textAlign: 'center' }}><span className="st-eyebrow">Perguntas frequentes</span><h2 className="st-h2" style={{ marginTop: 12 }}>O que as escolas perguntam</h2></Rv>
        <div className="st-faq">{home.faq.map(f => <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>)}</div>
      </div>
    </section>
  )
}

function Final() {
  return (
    <section className="st-final st-sec">
      <div className="st-wrap">
        <h2 className="st-h2">Vamos montar a campanha da sua escola?</h2>
        <p className="st-lead" style={{ margin: '16px auto 28px', color: 'rgba(255,255,255,.8)' }}>Fale com a gente pelo WhatsApp ou comece pelo Raio-X grátis.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}><WaButton /><Btn kind="ghost" href="/raio-x">Fazer o Raio-X grátis</Btn></div>
      </div>
    </section>
  )
}

export default function Home() {
  useSeo({ title: home.title, description: home.description, path: '/', jsonLd: [orgLd(), appLd('Áion Edu', home.description, '/'), faqLd(home.faq)] })
  return (
    <SiteShell dark>
      <Hero />
      <Problems />
      <Stage />
      <Mobile />
      <Ways />
      <SchoolsMap />
      <Steps />
      <Faq />
      <Final />
    </SiteShell>
  )
}
