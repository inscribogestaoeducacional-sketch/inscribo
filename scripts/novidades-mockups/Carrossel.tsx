// =============================================================================
// scripts/novidades-mockups/Carrossel.tsx
//
// Carrossel de posts (1080x1350, feed do Instagram) da novidade Captação
// Inteligente. Recorte direto de /novidades/captacao-inteligente: a copy e os
// ícones vêm de src/pages/novidadeCaptacaoContent.tsx (mesma fonte da página),
// o visual usa SHARED_CSS, BrowserFrame e os mockups de public/novidades/img/.
// Renderizado por render.mjs (--carrossel) em 2x.
// =============================================================================
import React from 'react'
import BrowserFrame from '../../src/components/landing/BrowserFrame'
import { COPY, FLUXO, POR_QUE, IMG, IcArrowRight } from '../../src/pages/novidadeCaptacaoContent'
export { SHARED_CSS } from '../../src/styles/sharedCSS'

const W = 1080, H = 1350, TOTAL = 5
const HERO_BG = `radial-gradient(ellipse 80% 60% at 15% 40%, rgba(0,82,60,0.98) 0%, transparent 65%), radial-gradient(ellipse 45% 55% at 88% 12%, rgba(219,39,119,0.16) 0%, transparent 60%), radial-gradient(ellipse 50% 70% at 80% 80%, rgba(0,168,150,0.2) 0%, transparent 55%), #00301F`

function Slide({ n, bg, dark, children }: { n: number; bg: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div className="slide" style={{ width: W, height: H, background: bg, position: 'relative', overflow: 'hidden', padding: '64px 80px', display: 'flex', flexDirection: 'column' }}>
      {dark && <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 56 }}>
        <img src="/aion-logo-full.png" alt="Áion Edu" style={{ height: 50 }} />
        <span className={dark ? 'tag-novo-d' : 'tag-novo'} style={{ fontSize: 16, padding: '10px 20px' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: dark ? '#F472B6' : '#DB2777', display: 'inline-block' }} />
          Captação Inteligente
        </span>
      </div>
      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</div>
      <div style={{ position: 'absolute', left: 80, right: 80, bottom: 44, zIndex: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 700, color: dark ? 'rgba(255,255,255,.6)' : '#6B7280' }}>
        <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", letterSpacing: '.04em' }}>{String(n).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}</span>
        {n < TOTAL
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Arraste pro lado <IcArrowRight size={20} /></span>
          : <span>aionedu.com.br</span>}
      </div>
    </div>
  )
}

const title = (size: number, color: string): React.CSSProperties => ({ fontSize: size, color, lineHeight: 1.02, letterSpacing: '-0.035em' })

// ── 1. Capa — hero da página ────────────────────────────────────────────────
export function Slide1() {
  const h = COPY.hero
  return (
    <Slide n={1} bg={HERO_BG} dark>
      <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
        <span className="tag-novo-d" style={{ fontSize: 17, padding: '10px 20px' }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#F472B6', display: 'inline-block' }} />{h.pill}
        </span>
        <span className="tag-d" style={{ fontSize: 17, padding: '10px 20px' }}>{h.date}</span>
      </div>
      <h1 className="s-title" style={{ ...title(112, '#fff'), marginBottom: 32 }}>
        {h.title} <span style={{ color: '#0DD3BF' }}>{h.hl}</span>
      </h1>
      <p style={{ fontSize: 29, lineHeight: 1.55, color: 'rgba(255,255,255,.78)', maxWidth: 900 }}>{h.sub}</p>
      <div style={{ position: 'absolute', left: -8, right: -8, top: 700, maxWidth: 'none' }}>
        <BrowserFrame src={IMG.dashboard} alt="" url="app.aionedu.com.br/captacao" dark />
      </div>
      <div style={{ position: 'absolute', left: -80, right: -80, bottom: -64, height: 300, zIndex: 2, maxWidth: 'none', background: 'linear-gradient(180deg,rgba(0,48,31,0),#00301F 78%)' }} />
    </Slide>
  )
}

// ── 2. O problema — "Por que importa" ──────────────────────────────────────
export function Slide2() {
  const s = COPY.porQue
  const cards = [POR_QUE[0], POR_QUE[2]]
  return (
    <Slide n={2} bg="#00301F" dark>
      <div style={{ position: 'absolute', width: 760, height: 760, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.16),transparent 70%)', top: -300, right: -260, pointerEvents: 'none', zIndex: -1, maxWidth: 'none' }} />
      <div className="tag-d" style={{ fontSize: 17, padding: '10px 20px', alignSelf: 'flex-start', marginBottom: 32 }}>{s.tag}</div>
      <h2 className="s-title" style={{ ...title(122, '#fff'), marginBottom: 32 }}>
        {s.title} <span style={{ color: '#0DD3BF' }}>{s.hl}</span>
      </h2>
      <p style={{ fontSize: 30, lineHeight: 1.55, color: 'rgba(255,255,255,.72)', marginBottom: 52 }}>{s.sub}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {cards.map(c => (
          <div key={c.title} className="card-dark" style={{ padding: 34, display: 'flex', gap: 26, alignItems: 'flex-start' }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 8px 24px rgba(0,168,150,.25)' }}>
              <c.Icon size={34} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: 31, fontWeight: 800, color: '#fff', marginBottom: 10, lineHeight: 1.25 }}>{c.title}</h3>
              <p style={{ fontSize: 22, color: 'rgba(255,255,255,.66)', lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </Slide>
  )
}

// ── 3. A solução — "O que é" + dashboard ───────────────────────────────────
export function Slide3() {
  const s = COPY.oQueE
  return (
    <Slide n={3} bg="#F4F7F5">
      <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,.08),transparent 70%)', top: -380, right: -300, pointerEvents: 'none', zIndex: -1, maxWidth: 'none' }} />
      <div className="tag-g" style={{ fontSize: 17, padding: '10px 20px', alignSelf: 'flex-start', marginBottom: 30 }}>{s.tag}</div>
      <h2 className="s-title" style={{ ...title(92, '#111827'), marginBottom: 44 }}>
        {s.title}<br /><span style={{ color: '#0DD3BF' }}>{s.hl}</span>
      </h2>
      <div style={{ position: 'relative', height: 570, margin: '0 -24px', maxWidth: 'none', overflow: 'hidden', borderRadius: 18 }}>
        <BrowserFrame src={IMG.dashboard} alt="" url="app.aionedu.com.br/captacao" />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 180, background: 'linear-gradient(180deg,rgba(244,247,245,0),#F4F7F5 85%)' }} />
      </div>
    </Slide>
  )
}

// ── 4. Como funciona — fluxo em 4 passos ────────────────────────────────────
export function Slide4() {
  const s = COPY.passos
  return (
    <Slide n={4} bg="#fff">
      <div className="tag-g" style={{ fontSize: 17, padding: '10px 20px', alignSelf: 'flex-start', marginBottom: 30 }}>{s.tag}</div>
      <h2 className="s-title" style={{ ...title(92, '#111827'), marginBottom: 48 }}>
        {s.title} <span style={{ color: '#0DD3BF' }}>{s.hl}</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {FLUXO.map((f, i) => {
          const pink = i === 2
          return (
            <div key={f.title} className="card" style={{ padding: '26px 30px', display: 'flex', gap: 26, alignItems: 'center' }}>
              <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 26, width: 60, height: 60, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#00523C', color: '#fff', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 30, fontWeight: 800, color: '#111827', marginBottom: 6, lineHeight: 1.25 }}>{f.title}</h3>
                <p style={{ fontSize: 21, color: '#6B7280', lineHeight: 1.55 }}>{f.desc}</p>
              </div>
              <div style={{ width: 68, height: 68, borderRadius: 18, background: pink ? '#FCE7F3' : '#E6F7F5', border: `1px solid ${pink ? '#FBCFE8' : '#A7F3D0'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <f.Icon size={32} color={pink ? '#DB2777' : '#00523C'} />
              </div>
            </div>
          )
        })}
      </div>
    </Slide>
  )
}

// ── 5. CTA final — mesma chamada da página ─────────────────────────────────
export function Slide5() {
  const { prospect, cliente } = COPY.cta
  return (
    <Slide n={5} bg="linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)" dark>
      <div style={{ marginTop: 'auto' }} />
      <div style={{ background: '#fff', borderRadius: 32, padding: '52px 52px 56px', boxShadow: '0 28px 72px rgba(0,0,0,.22)', marginBottom: 26 }}>
        <div className="tag-novo" style={{ fontSize: 17, padding: '10px 20px', marginBottom: 28 }}>{prospect.tag}</div>
        <h2 className="s-title" style={{ ...title(96, '#00523C'), marginBottom: 26 }}>{prospect.title}</h2>
        <p style={{ fontSize: 28, color: '#4B5563', lineHeight: 1.55, marginBottom: 38 }}>{prospect.text}</p>
        <span className="btn-g" style={{ fontSize: 26, padding: '22px 44px' }}>{prospect.btn} <IcArrowRight size={24} /></span>
      </div>
      <div style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 32, padding: '40px 52px' }}>
        <div className="tag-d" style={{ fontSize: 16, padding: '9px 18px', marginBottom: 20 }}>{cliente.tag}</div>
        <h3 className="s-title" style={{ ...title(52, '#fff'), marginBottom: 14 }}>{cliente.title}</h3>
        <p style={{ fontSize: 24, color: 'rgba(255,255,255,.82)', lineHeight: 1.55 }}>{cliente.text}</p>
      </div>
      <div style={{ marginBottom: 'auto', paddingBottom: 40 }} />
    </Slide>
  )
}

export const SLIDES = [Slide1, Slide2, Slide3, Slide4, Slide5]
