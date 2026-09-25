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
import { IMG, IcMegaphone, IcCheck, IcArrowRight, IcChevDown, IcTag, IcUsers, IcUserPlus, FLUXO, POR_QUE, PASSOS, FAQ, COPY } from './novidadeCaptacaoContent'

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
            {COPY.hero.pill}
          </span>
          <span className="tag-d">{COPY.hero.date}</span>
        </div>
        <h1 className="s-title" style={{ fontSize: 'clamp(38px,5.6vw,72px)', color: '#fff', marginBottom: 24, animation: 'fadeUp .9s ease .1s both', maxWidth: 900, marginInline: 'auto' }}>
          {COPY.hero.title} <span style={{ color: '#0DD3BF' }}>{COPY.hero.hl}</span>
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', lineHeight: 1.8, maxWidth: 680, margin: '0 auto 40px', animation: 'fadeUp .9s ease .2s both' }}>
          {COPY.hero.sub}
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
          <div className="tag-g" style={{ marginBottom: 20 }}>{COPY.oQueE.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            {COPY.oQueE.title}<br /><span style={{ color: '#0DD3BF' }}>{COPY.oQueE.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 640, margin: '0 auto', lineHeight: 1.8 }}>
            {COPY.oQueE.sub}
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
          <div className="tag-d" style={{ marginBottom: 20 }}>{COPY.porQue.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#fff', marginBottom: 16 }}>
            {COPY.porQue.title}<br /><span style={{ color: '#0DD3BF' }}>{COPY.porQue.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.62)', maxWidth: 600, margin: '0 auto', lineHeight: 1.8 }}>
            {COPY.porQue.sub}
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
          <div className="tag-g" style={{ marginBottom: 20 }}>{COPY.passos.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            {COPY.passos.title}<br /><span style={{ color: '#0DD3BF' }}>{COPY.passos.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
            {COPY.passos.sub}
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
            <div className="tag-d" style={{ marginBottom: 18 }}>{COPY.cta.cliente.tag}</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#fff', marginBottom: 12 }}>{COPY.cta.cliente.title}</h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.78)', lineHeight: 1.8, marginBottom: 26 }}>
              {COPY.cta.cliente.text}
            </p>
            <a href="/login" className="btn-white">{COPY.cta.cliente.btn} <IcArrowRight size={16} /></a>
          </div>
          <div style={{ background: '#fff', borderRadius: 24, padding: 36, boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
            <div className="tag-novo" style={{ marginBottom: 18 }}>{COPY.cta.prospect.tag}</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#00523C', marginBottom: 12 }}>{COPY.cta.prospect.title}</h3>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.8, marginBottom: 26 }}>
              {COPY.cta.prospect.text}
            </p>
            <a href="/#demo" className="btn-g">{COPY.cta.prospect.btn} <IcArrowRight size={16} /></a>
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
