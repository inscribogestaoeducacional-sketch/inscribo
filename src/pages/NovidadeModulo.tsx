// =============================================================================
// src/pages/NovidadeModulo.tsx
//
// Página pública de anúncio de um módulo novo (/novidades/<módulo>), no mesmo
// formato de /novidades/captacao-inteligente (NovidadeCaptacao.tsx): hero,
// "O que é" em 4 etapas, "Por que importa", passo a passo com telas,
// perguntas e chamada final. O texto de cada módulo fica num arquivo de
// conteúdo (novidadeVitrineContent.tsx, novidadeTransmissoesContent.tsx), que
// também alimenta o carrossel de posts (scripts/novidades-mockups).
// Rota fora do bloco de auth (App.tsx): abre igual pra quem está logado ou não.
// A prévia do link (WhatsApp) vem do HTML gerado no build (vite.config.ts).
// =============================================================================
import React, { useEffect, useRef, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import BrowserFrame from '../components/landing/BrowserFrame'
import { SHARED_CSS } from '../styles/sharedCSS'
import { IcCheck, IcArrowRight, IcChevDown } from './novidadeCaptacaoContent'

type IconCmp = (p: any) => React.ReactElement
export interface NovidadeContent {
  docTitle: string                      // <title> da aba
  appUrl: string                        // endereço na moldura do navegador
  heroImg: string
  heroAlt: string
  FLUXO: { Icon: IconCmp; title: string; desc: string }[]
  FLUXO_DESTAQUE: number                // etapa do fluxo em rosa (a que é "a novidade")
  POR_QUE: { Icon: IconCmp; title: string; desc: string }[]
  // frame: browser = moldura de navegador; plain = imagem solta (já tem
  // moldura própria, ex.: celular ou modal).
  PASSOS: { title: string; desc: string; bullets: string[]; img: string; alt: string; frame: 'browser' | 'plain'; maxWidth?: number }[]
  FAQ: { q: string; a: string }[]
  COPY: {
    hero: { pill: string; date: string; title: string; hl: string; sub: React.ReactNode }
    oQueE: { tag: string; title: string; hl: string; sub: string }
    porQue: { tag: string; title: string; hl: string; sub: string }
    passos: { tag: string; title: string; hl: string; sub: React.ReactNode }
    cta: {
      cliente: { tag: string; title: string; text: React.ReactNode; btn: string }
      prospect: { tag: string; title: string; text: string; btn: string }
    }
  }
}

// ── Reveal (mesmo da landing) ───────────────────────────────────────────────
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

// ── Seções ────────────────────────────────────────────────────────────────
function Hero({ c }: { c: NovidadeContent }) {
  const h = c.COPY.hero
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
            {h.pill}
          </span>
          <span className="tag-d">{h.date}</span>
        </div>
        <h1 className="s-title" style={{ fontSize: 'clamp(38px,5.6vw,72px)', color: '#fff', marginBottom: 24, animation: 'fadeUp .9s ease .1s both', maxWidth: 900, marginInline: 'auto' }}>
          {h.title} <span style={{ color: '#0DD3BF' }}>{h.hl}</span>
        </h1>
        <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', lineHeight: 1.8, maxWidth: 680, margin: '0 auto 40px', animation: 'fadeUp .9s ease .2s both' }}>
          {h.sub}
        </p>
        <div className="hero-ctas" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20, animation: 'fadeUp .9s ease .3s both' }}>
          <a href="#passo-a-passo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>Ver como funciona <IcArrowRight size={16} /></a>
          <a href="/#demo" className="btn-ghost">Agendar uma demonstração</a>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 36, animation: 'fadeUp .9s ease .35s both' }}>
          Telas ilustrativas da Áion Edu com dados de exemplo, nenhum dado real de escola.
        </p>
        <div style={{ animation: 'fadeUp 1.1s ease .45s both', maxWidth: 1040, margin: '0 auto', marginBottom: -2 }}>
          <BrowserFrame src={c.heroImg} alt={c.heroAlt} url={c.appUrl} dark style={{ borderRadius: '18px 18px 0 0', paddingBottom: 0 }} />
        </div>
      </div>
    </section>
  )
}

function OQueE({ c }: { c: NovidadeContent }) {
  const r0 = useReveal()
  const s = c.COPY.oQueE
  return (
    <section className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>{s.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            {s.title}<br /><span style={{ color: '#0DD3BF' }}>{s.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 640, margin: '0 auto', lineHeight: 1.8 }}>{s.sub}</p>
        </div>
        <div className="nv-flow">
          {c.FLUXO.map((f, i) => {
            const pink = i === c.FLUXO_DESTAQUE
            return (
              <Reveal key={i} delay={`${(i % 3) + 1}`} style={{ position: 'relative' }}>
                <div className="card" style={{ padding: 28, height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, background: pink ? '#FCE7F3' : '#E6F7F5', border: `1px solid ${pink ? '#FBCFE8' : '#A7F3D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <f.Icon size={22} color={pink ? '#DB2777' : '#00523C'} />
                    </div>
                    <span className="s-title" style={{ fontSize: 32, color: '#E5E7EB' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 10, lineHeight: 1.35 }}>{f.title}</h3>
                  <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75 }}>{f.desc}</p>
                </div>
                {i < c.FLUXO.length - 1 && <div className="nv-flow-arrow"><IcArrowRight size={13} color="#00A896" stroke={2.4} /></div>}
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function PorQue({ c }: { c: NovidadeContent }) {
  const r0 = useReveal()
  const s = c.COPY.porQue
  return (
    <section className="section-pad" style={{ background: '#00301F', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.12),transparent)', top: -220, left: -120, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>{s.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#fff', marginBottom: 16 }}>
            {s.title}<br /><span style={{ color: '#0DD3BF' }}>{s.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.62)', maxWidth: 600, margin: '0 auto', lineHeight: 1.8 }}>{s.sub}</p>
        </div>
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20 }}>
          {c.POR_QUE.map((p, i) => (
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

function PassoAPasso({ c }: { c: NovidadeContent }) {
  const r0 = useReveal()
  const s = c.COPY.passos
  return (
    <section id="passo-a-passo" className="section-pad" style={{ background: '#F4F7F5' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 80 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>{s.tag}</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(30px,4vw,48px)', color: '#111827', marginBottom: 16 }}>
            {s.title}<br /><span style={{ color: '#0DD3BF' }}>{s.hl}</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>{s.sub}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 96 }}>
          {c.PASSOS.map((p, i) => (
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
                {p.frame === 'plain'
                  ? <img src={p.img} alt={p.alt} loading="lazy" style={{ display: 'block', width: '100%', maxWidth: p.maxWidth || 440, height: 'auto', margin: '0 auto', borderRadius: 18, boxShadow: '0 32px 72px rgba(0,48,31,.18)' }} />
                  : <BrowserFrame src={p.img} alt={p.alt} url={c.appUrl} />}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Perguntas({ c }: { c: NovidadeContent }) {
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
          {c.FAQ.map((f, i) => (
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

function CTA({ c }: { c: NovidadeContent }) {
  const r0 = useReveal()
  const { cliente, prospect } = c.COPY.cta
  return (
    <section className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div ref={r0} style={{ maxWidth: 980, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 24, padding: 36 }}>
            <div className="tag-d" style={{ marginBottom: 18 }}>{cliente.tag}</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#fff', marginBottom: 12 }}>{cliente.title}</h3>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,.78)', lineHeight: 1.8, marginBottom: 26 }}>{cliente.text}</p>
            <a href="/login" className="btn-white">{cliente.btn} <IcArrowRight size={16} /></a>
          </div>
          <div style={{ background: '#fff', borderRadius: 24, padding: 36, boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
            <div className="tag-novo" style={{ marginBottom: 18 }}>{prospect.tag}</div>
            <h3 className="s-title" style={{ fontSize: 28, color: '#00523C', marginBottom: 12 }}>{prospect.title}</h3>
            <p style={{ fontSize: 15, color: '#4B5563', lineHeight: 1.8, marginBottom: 26 }}>{prospect.text}</p>
            <a href="/#demo" className="btn-g">{prospect.btn} <IcArrowRight size={16} /></a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Export ────────────────────────────────────────────────────────────────
export default function NovidadeModulo({ content }: { content: NovidadeContent }) {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    const prevTitle = document.title
    document.title = content.docTitle
    return () => { document.getElementById('aion-css')?.remove(); document.title = prevTitle }
  }, [content])

  return (
    <>
      <style>{PAGE_CSS}</style>
      <Navbar />
      <main>
        <Hero c={content} />
        <OQueE c={content} />
        <PorQue c={content} />
        <PassoAPasso c={content} />
        <Perguntas c={content} />
        <CTA c={content} />
      </main>
      <Footer />
    </>
  )
}
