// =============================================================================
// src/pages/NovidadeCaptacao.tsx — /novidades/captacao-inteligente
//
// Página pública de anúncio do módulo Captação Inteligente, pra mandar o link
// direto a clientes e prospects. Rota fora do bloco de auth (App.tsx), no
// mesmo desvio de /raio-x: abre igual pra quem está logado ou não.
// A prévia do link (título/imagem no WhatsApp) não sai daqui — vem do HTML
// gerado no build (sharePreviewPages em vite.config.ts).
// Imagens em public/novidades/img/: mockups fiéis à tela real com dados de
// exemplo, gerados por scripts/novidades-mockups/render.mjs.
// =============================================================================
import React, { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BrowserFrame from '../components/landing/BrowserFrame'
import { SHARED_CSS } from '../styles/sharedCSS'

const IMG = {
  lista:     '/novidades/img/captacao-gatilhos.jpg',
  modal:     '/novidades/img/captacao-modal.jpg',
  dashboard: '/novidades/img/captacao-dashboard.jpg',
}

// ── Icons ─────────────────────────────────────────────────────────────────
function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcMegaphone = (p: any) => <Ic {...p}><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></Ic>
const IcCheck = (p: any) => <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
const IcChevDown = (p: any) => <Ic {...p}><polyline points="6 9 12 15 18 9" /></Ic>
const IcLink = (p: any) => <Ic {...p}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Ic>
const IcMsg = (p: any) => <Ic {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Ic>
const IcTag = (p: any) => <Ic {...p}><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></Ic>
const IcBarChart = (p: any) => <Ic {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>
const IcZap = (p: any) => <Ic {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></Ic>
const IcUsers = (p: any) => <Ic {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>
const IcUserPlus = (p: any) => <Ic {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></Ic>
const IcSearch = (p: any) => <Ic {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Ic>

// ── Reveal hook (mesmo da landing) ─────────────────────────────────────────
function useReveal(delay = '') {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    el.classList.add('reveal')
    if (delay) el.classList.add(`d${delay}`)
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add('in'); obs.disconnect() }
    }, { threshold: 0.07 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function Reveal({ children, delay, style, className }: { children: React.ReactNode; delay?: string; style?: React.CSSProperties; className?: string }) {
  const ref = useReveal(delay)
  return <div ref={ref} style={style} className={className}>{children}</div>
}

// Estilos só desta página (fluxo e balões do chat ilustrativo)
const PAGE_CSS = `
.nv-flow { display:grid; grid-template-columns:repeat(4,1fr); gap:18px; position:relative; }
.nv-flow-arrow { position:absolute; top:50%; right:-15px; transform:translateY(-50%); z-index:2; width:26px; height:26px; border-radius:50%; background:#fff; border:1px solid #E5E7EB; display:flex; align-items:center; justify-content:center; }
.nv-step-num { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:15px; width:40px; height:40px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; background:#00523C; color:#fff; flex-shrink:0; }
@media (max-width:1100px) {
  .nv-flow { grid-template-columns:1fr 1fr; }
  .nv-flow-arrow { display:none; }
}
@media (max-width:640px) {
  .nv-flow { grid-template-columns:1fr; }
}
`

// ── Conteúdo ──────────────────────────────────────────────────────────────
const FLUXO = [
  { Icon: IcMegaphone, title: 'A família vê o anúncio', desc: 'No Instagram, Facebook, Google, TikTok ou no site da escola, e toca no botão de WhatsApp.' },
  { Icon: IcLink, title: 'A mensagem já vem pronta', desc: 'O link wa.me gerado pela Áion abre o WhatsApp com o texto daquela campanha já digitado.' },
  { Icon: IcTag, title: 'A Áion reconhece a campanha', desc: 'Ao chegar, a conversa é marcada com a origem, o lead é criado e a família vai pra pessoa certa.' },
  { Icon: IcBarChart, title: 'Você vê o que dá resultado', desc: 'O dashboard mostra conversas, leads e matrículas de cada anúncio, lado a lado.' },
]

const POR_QUE = [
  { Icon: IcBarChart, title: 'Investimento guiado por matrícula, não por clique', desc: 'Curtida e clique não pagam mensalidade. Com a origem registrada no primeiro contato, você sabe quais anúncios viram matrícula e onde vale colocar a verba da próxima campanha.' },
  { Icon: IcZap, title: 'Atendimento na hora em que o interesse está alto', desc: 'Quem vem de um anúncio pode pular o robô e cair direto com uma consultora, com uma resposta automática de boas-vindas no mesmo instante.' },
  { Icon: IcSearch, title: 'Chega de "como conheceu a escola?"', desc: 'A família não precisa responder de onde veio, e a equipe não precisa perguntar. A etiqueta da campanha já aparece na conversa e no contato.' },
  { Icon: IcUserPlus, title: 'Nenhum interessado fica fora do funil', desc: 'Todo início de conversa vindo de um anúncio já gera o lead no CRM, com canal de origem e responsável definidos. Ninguém precisa cadastrar à mão.' },
]

const PASSOS = [
  {
    title: 'Cadastre um gatilho para cada anúncio',
    desc: 'No menu Captação, clique em "Novo gatilho". Dê um nome à campanha, escolha o canal e escreva a mensagem que a família vai enviar. Se quiser, defina uma resposta automática, uma etiqueta e para quem a conversa deve ir.',
    bullets: ['Canais: Meta Ads, Google Ads, Instagram, Facebook, TikTok, site e outros', 'Aviso automático se o texto se sobrepuser a outro gatilho', 'Distribuição em rodízio entre consultoras ou grupos da equipe'],
    img: IMG.modal, alt: 'Tela de criação de gatilho da Captação Inteligente',
  },
  {
    title: 'Copie o link e cole no anúncio',
    desc: 'Cada gatilho gera um link wa.me com o número da escola e o texto já codificado. É só usar esse link como destino do anúncio, da bio ou do botão do site, sem risco de erro de digitação.',
    bullets: ['Botões "Copiar" e "Testar" direto na lista', 'Em anúncios "Clique para WhatsApp" da Meta, dá pra vincular também o ID do anúncio', 'Pause ou reative campanhas com um clique'],
    img: IMG.lista, alt: 'Lista de gatilhos de captação com links wa.me prontos',
  },
  {
    title: 'A conversa chega identificada',
    desc: 'Quando a família envia a mensagem, a Áion reconhece a campanha (sem se confundir com maiúsculas, acentos ou pontuação) e aplica tudo o que você configurou, só no início do atendimento. Uma conversa já em andamento nunca recebe mensagem automática fora de hora.',
    bullets: ['Etiqueta de origem na conversa e no contato', 'Filtro por campanha na lista de Contatos', 'Aviso "Robô não ativado" pra consultora quando a conversa pula o robô'],
    img: null, alt: '',
  },
  {
    title: 'Acompanhe o resultado de cada campanha',
    desc: 'A aba Dashboard compara os gatilhos em 7, 30 ou 90 dias, ou em 12 meses: acionamentos, conversas, leads, matrículas, conversão e o tempo médio até a primeira resposta da equipe.',
    bullets: ['Contagem por primeiro toque: cada família conta pra campanha que a trouxe', 'Excluir um gatilho não apaga o histórico dele no dashboard', 'Tempo de primeira resposta por campanha'],
    img: IMG.dashboard, alt: 'Dashboard da Captação Inteligente com métricas por gatilho',
  },
]

const FAQ = [
  { q: 'Preciso usar anúncio pago?', a: 'Não. O gatilho funciona com qualquer lugar onde você colocar o link: anúncio da Meta ou do Google, link na bio do Instagram, post orgânico, botão no site, QR code em material impresso. Cada origem pode ter o seu gatilho.' },
  { q: 'E se a família apagar ou mudar o texto da mensagem?', a: 'A identificação é por "contém": pequenas diferenças de maiúsculas, acentos e pontuação não atrapalham. Em anúncios "Clique para WhatsApp" da Meta, você pode vincular o ID do anúncio, e aí a campanha é reconhecida mesmo que a família reescreva a mensagem.' },
  { q: 'O robô de atendimento continua funcionando?', a: 'Continua. Você escolhe por gatilho: manter o fluxo normal do robô ou pular o robô e mandar a conversa direto pra consultoras específicas, em rodízio. O rodízio respeita quem está disponível e fora do horário de almoço.' },
  { q: 'Quem pode configurar?', a: 'Gestores e administradores da escola, pelo menu Captação no painel da Áion Edu. O módulo já está disponível pra todas as escolas com WhatsApp Oficial conectado.' },
]

// Ilustração do passo 3 (balões no estilo do WhatsApp Hub). É ilustrativa: essa
// tela depende de uma conversa real chegando, então não tem print.
function ChatIlustracao() {
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E5E7EB', boxShadow: '0 32px 72px rgba(0,48,31,.14)', overflow: 'hidden', maxWidth: 520, margin: '0 auto', width: '100%' }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#00523C,#00A896)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>MC</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Mariana Costa</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 3, padding: '2px 9px', borderRadius: 999, background: '#FCE7F3', color: '#BE185D', fontSize: 11, fontWeight: 700 }}>
            <IcMegaphone size={11} color="#BE185D" /> Matrículas 2027 · Infantil
          </span>
        </div>
      </div>
      <div style={{ background: '#F4F7F5', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span style={{ alignSelf: 'flex-end', marginTop: -8, fontSize: 10, fontWeight: 700, color: '#BE185D', background: '#FDF2F8', border: '1.5px dashed #F9A8D4', borderRadius: 999, padding: '3px 10px' }}>Ilustração · dados de exemplo</span>
        <div style={{ alignSelf: 'center', background: '#FEF3C7', color: '#92400E', fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>Robô não ativado · Captação Inteligente</div>
        <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#fff', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', fontSize: 13, color: '#111827', lineHeight: 1.55, boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
          Olá! Vi o anúncio e quero saber sobre matrícula no Infantil 2027
          <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>09:41</span>
        </div>
        <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: '#D9FDD3', borderRadius: '14px 4px 14px 14px', padding: '10px 14px', fontSize: 13, color: '#111827', lineHeight: 1.55, boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
          Oi! Que bom que você se interessou pelo Infantil 😊 Em instantes uma de nossas consultoras vai te atender.
          <span style={{ display: 'block', textAlign: 'right', fontSize: 10, color: '#6B7280', marginTop: 4 }}>09:41 · resposta automática</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          {[{ Icon: IcTag, l: 'Etiqueta aplicada' }, { Icon: IcUserPlus, l: 'Lead criado no CRM' }, { Icon: IcUsers, l: 'Encaminhado pra Ana' }].map((c, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #A7F3D0', color: '#00523C', fontSize: 11, fontWeight: 700, padding: '5px 11px', borderRadius: 999 }}>
              <c.Icon size={12} color="#00A896" /> {c.l}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Seções ────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="hero-section" style={{
      background: `radial-gradient(ellipse 80% 60% at 15% 40%, rgba(0,82,60,0.98) 0%, transparent 65%), radial-gradient(ellipse 45% 55% at 88% 12%, rgba(219,39,119,0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 80% 80%, rgba(0,168,150,0.2) 0%, transparent 55%), #00301F`,
      padding: '140px 48px 0', position: 'relative', overflow: 'hidden',
    }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 28, animation: 'fadeIn .9s ease both' }}>
          <span className="tag-novo-d">
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#F472B6', display: 'inline-block', animation: 'pulse2 2s infinite' }} />
            Novidade
          </span>
          <span className="tag-d">Setembro de 2026</span>
        </div>
        <h1 className="s-title" style={{ fontSize: 'clamp(38px,5.6vw,72px)', color: '#fff', marginBottom: 24, animation: 'fadeUp .9s ease .1s both', maxWidth: 900, marginInline: 'auto' }}>
          Saiba de qual anúncio veio <span style={{ color: '#0DD3BF' }}>cada matrícula</span>
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', lineHeight: 1.8, maxWidth: 680, margin: '0 auto 40px', animation: 'fadeUp .9s ease .2s both' }}>
          Com a <strong style={{ color: '#fff' }}>Captação Inteligente</strong>, cada conversa que chega no WhatsApp da escola já vem marcada com a campanha de origem e vai direto pra pessoa certa. No fim do mês, você sabe exatamente quais anúncios trouxeram matrícula.
        </p>
        <div className="hero-ctas" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20, animation: 'fadeUp .9s ease .3s both' }}>
          <a href="#passo-a-passo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>Ver como funciona <IcArrowRight size={16} /></a>
          <a href="/#demo" className="btn-ghost">Agendar uma demonstração</a>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 36, animation: 'fadeUp .9s ease .35s both' }}>
          Telas ilustrativas da Áion Edu com dados de exemplo, nenhum dado real de escola.
        </p>
        <div style={{ animation: 'fadeUp 1.1s ease .45s both', maxWidth: 1040, margin: '0 auto', marginBottom: -2 }}>
          <BrowserFrame src={IMG.dashboard} alt="Dashboard da Captação Inteligente" url="app.aionedu.com.br/captacao" dark style={{ borderRadius: '18px 18px 0 0', paddingBottom: 0 }} />
        </div>
      </div>
    </section>
  )
}

function OQueE() {
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>O que é</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            Um gatilho por anúncio.<br /><span style={{ color: '#0DD3BF' }}>Rastreio do clique à matrícula.</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 640, margin: '0 auto', lineHeight: 1.8 }}>
            Você cadastra um gatilho para cada campanha, com a mensagem que a família vai mandar. A Áion Edu gera o link e, quando a mensagem chega, reconhece de onde ela veio e cuida do resto.
          </p>
        </div>
        <div className="nv-flow">
          {FLUXO.map((f, i) => (
            <Reveal key={i} delay={`${(i % 3) + 1}`} style={{ position: 'relative' }}>
              <div className="card" style={{ padding: 28, height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: i === 2 ? '#FCE7F3' : '#E6F7F5', border: `1px solid ${i === 2 ? '#FBCFE8' : '#A7F3D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <f.Icon size={22} color={i === 2 ? '#DB2777' : '#00523C'} />
                  </div>
                  <span className="s-title" style={{ fontSize: 32, color: '#E5E7EB' }}>{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 10, lineHeight: 1.35 }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75 }}>{f.desc}</p>
              </div>
              {i < FLUXO.length - 1 && <div className="nv-flow-arrow"><IcArrowRight size={13} color="#00A896" stroke={2.4} /></div>}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function PorQue() {
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: '#00301F', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.12),transparent)', top: -220, left: -120, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>Por que importa</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#fff', marginBottom: 16 }}>
            A escola para de investir<br /><span style={{ color: '#0DD3BF' }}>no escuro</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.62)', maxWidth: 600, margin: '0 auto', lineHeight: 1.8 }}>
            Na campanha de matrícula, todo real conta. Saber o que funciona é o que separa a escola que cresce da que só aumenta o gasto com anúncio.
          </p>
        </div>
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
          {POR_QUE.map((p, i) => (
            <Reveal key={i} delay={`${(i % 2) + 1}`}>
              <div className="card-dark" style={{ padding: 32, height: '100%', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,168,150,.25)' }}>
                  <p.Icon size={24} color="#fff" />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 10, lineHeight: 1.35 }}>{p.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(255,255,255,.62)', lineHeight: 1.8 }}>{p.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function PassoAPasso() {
  const r0 = useReveal()
  return (
    <section id="passo-a-passo" className="section-pad" style={{ background: '#F4F7F5' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 80 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Passo a passo</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            Da campanha no ar ao resultado<br /><span style={{ color: '#0DD3BF' }}>em 4 passos</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
            Tudo no menu <strong>Captação</strong> do painel da Áion Edu, sem planilha e sem depender da agência de marketing.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
          {PASSOS.map((p, i) => (
            <Reveal key={i} className={`split-cols${i % 2 ? ' rev' : ''}`}>
              <div style={{ flex: '0 0 40%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                  <span className="nv-step-num">{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#00A896', letterSpacing: '.12em', textTransform: 'uppercase' }}>Passo {i + 1}</span>
                </div>
                <h3 className="s-title" style={{ fontSize: 'clamp(24px,2.6vw,32px)', color: '#111827', marginBottom: 16 }}>{p.title}</h3>
                <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.85, marginBottom: 22 }}>{p.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {p.bullets.map((b, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <div style={{ flexShrink: 0, marginTop: 2 }}><IcCheck size={15} color="#00A896" stroke={2.2} /></div>
                      <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.65 }}>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                {/* O modal já vem com o fundo escurecido da própria tela: vai sem moldura e mais estreito */}
                {p.img === IMG.modal
                  ? <img src={p.img} alt={p.alt} loading="lazy" style={{ display: 'block', width: '100%', maxWidth: 440, height: 'auto', margin: '0 auto', borderRadius: 18, boxShadow: '0 32px 72px rgba(0,48,31,.18)' }} />
                  : p.img ? <BrowserFrame src={p.img} alt={p.alt} url="app.aionedu.com.br/captacao" /> : <ChatIlustracao />}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Perguntas() {
  const [open, setOpen] = useState<number | null>(0)
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 44 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Dúvidas</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,42px)', color: '#111827' }}>Perguntas frequentes</h2>
        </div>
        <div style={{ borderTop: '1px solid #E5E7EB' }}>
          {FAQ.map((f, i) => (
            <div key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
              <button className="faq-btn" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                {f.q}
                <span style={{ transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0, display: 'flex' }}><IcChevDown size={18} color="#00A896" /></span>
              </button>
              {open === i && <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.8, paddingBottom: 22 }}>{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTA() {
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div ref={r0} style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 24, padding: 36 }}>
            <div className="tag-d" style={{ marginBottom: 18 }}>Já é cliente?</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#fff', marginBottom: 12 }}>Já está no seu painel</h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.78)', lineHeight: 1.8, marginBottom: 26 }}>
              Entre na Áion Edu e abra o menu <strong style={{ color: '#fff' }}>Captação</strong>. Cadastre o gatilho da sua próxima campanha em menos de 2 minutos.
            </p>
            <a href="/login" className="btn-white">Acessar o painel <IcArrowRight size={16} /></a>
          </div>
          <div style={{ background: '#fff', borderRadius: 24, padding: 36, boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
            <div className="tag-novo" style={{ marginBottom: 18 }}>Ainda não usa a Áion?</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#00523C', marginBottom: 12 }}>Veja funcionando na sua escola</h3>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.8, marginBottom: 26 }}>
              Agende uma reunião e mostramos a Captação Inteligente e o restante da plataforma com o cenário da sua campanha de matrícula.
            </p>
            <a href="/#demo" className="btn-g">Agendar reunião <IcArrowRight size={16} /></a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Export ────────────────────────────────────────────────────────────────
export default function NovidadeCaptacao() {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    const prevTitle = document.title
    document.title = 'Novidade: Captação Inteligente — Áion Edu'
    return () => { document.getElementById('aion-css')?.remove(); document.title = prevTitle }
  }, [])

  return (
    <>
      <style>{PAGE_CSS}</style>
      <Navbar />
      <main>
        <Hero />
        <OQueE />
        <PorQue />
        <PassoAPasso />
        <Perguntas />
        <CTA />
      </main>
      <Footer />
    </>
  )
}
