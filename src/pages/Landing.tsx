import React, { useState, useEffect, useRef } from 'react'

// ─── Global CSS ────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #111827;
  overflow-x: hidden;
  background: #fff;
}

@keyframes fadeUp    { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
@keyframes floatY    { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-12px); } }
@keyframes slideLeft { from { transform:translateX(0); } to { transform:translateX(-50%); } }
@keyframes pulse2    { 0%,100%{ opacity:1; } 50%{ opacity:.35; } }
@keyframes scaleIn   { from { opacity:0; transform:scale(.95); } to { opacity:1; transform:scale(1); } }
@keyframes blink     { 0%,100%{ opacity:1; } 50%{ opacity:.2; } }

.reveal { opacity:0; transform:translateY(32px); transition:opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1); }
.reveal.in { opacity:1; transform:none; }
.d1.in { transition-delay:.07s; }
.d2.in { transition-delay:.14s; }
.d3.in { transition-delay:.21s; }

.s-title { font-family:'Bricolage Grotesque', sans-serif; font-weight:900; line-height:1.08; letter-spacing:-.02em; }

.btn-g {
  display:inline-flex; align-items:center; gap:8px;
  background:linear-gradient(135deg,#00523C 0%,#00A896 100%);
  color:#fff; border:none; border-radius:14px;
  padding:15px 32px; font-size:15px; font-weight:800;
  cursor:pointer; text-decoration:none;
  transition:transform .18s, box-shadow .18s;
  box-shadow:0 4px 24px rgba(0,82,60,.35);
  font-family:'Plus Jakarta Sans',sans-serif;
  position:relative; overflow:hidden;
}
.btn-g::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,.1); opacity:0; transition:opacity .2s; }
.btn-g:hover { transform:translateY(-2px); box-shadow:0 12px 36px rgba(0,82,60,.45); }
.btn-g:hover::after { opacity:1; }

.btn-ghost {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(255,255,255,.12); color:#fff;
  border:1.5px solid rgba(255,255,255,.35); border-radius:14px;
  padding:14px 28px; font-size:14px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:background .2s, border-color .2s;
  font-family:'Plus Jakarta Sans',sans-serif;
}
.btn-ghost:hover { background:rgba(255,255,255,.22); border-color:rgba(255,255,255,.65); }

.card {
  background:#fff;
  border:1.5px solid #E8ECF0;
  border-radius:22px;
  transition:border-color .25s, box-shadow .25s, transform .25s;
}
.card:hover {
  border-color:#00A896;
  box-shadow:0 16px 48px rgba(0,168,150,.13);
  transform:translateY(-5px);
}

.card-dark {
  background:rgba(255,255,255,.06);
  border:1px solid rgba(255,255,255,.12);
  border-radius:22px;
  transition:border-color .25s, background .25s;
}
.card-dark:hover {
  background:rgba(255,255,255,.1);
  border-color:rgba(255,255,255,.28);
}

.tag-g { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:6px 16px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; background:#E6F7F5; color:#00523C; border:1px solid #A7F3D0; }
.tag-d { display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:6px 16px; font-size:12px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; background:rgba(255,255,255,.12); color:rgba(255,255,255,.88); border:1px solid rgba(255,255,255,.22); }

.inp { width:100%; padding:13px 16px; border-radius:11px; border:1.5px solid #D1D5DB; font-size:14px; outline:none; transition:border-color .2s, box-shadow .2s; background:#fff; font-family:'Plus Jakarta Sans',sans-serif; color:#111827; }
.inp:focus { border-color:#00A896; box-shadow:0 0 0 4px rgba(0,168,150,.12); }

.faq-btn { width:100%; text-align:left; background:none; border:none; padding:22px 0; font-size:15px; font-weight:700; cursor:pointer; display:flex; justify-content:space-between; align-items:center; font-family:'Plus Jakarta Sans',sans-serif; color:#111827; }

.mod-tab {
  padding:10px 20px; border-radius:11px; font-size:13px; font-weight:700;
  cursor:pointer; border:1.5px solid transparent; transition:all .2s;
  background:#F3F4F6; color:#6B7280; white-space:nowrap;
  font-family:'Plus Jakarta Sans',sans-serif; flex-shrink:0;
}
.mod-tab.active { background:#E6F7F5; color:#00523C; border-color:#A7F3D0; }
.mod-tab:hover:not(.active) { background:#E9ECEF; color:#374151; }

.ticker-wrap { overflow:hidden; width:100%; }
.ticker-track { display:flex; animation:slideLeft 32s linear infinite; width:max-content; }
.ticker-track:hover { animation-play-state:paused; }

.ck { display:flex; align-items:flex-start; gap:10px; margin-bottom:12px; }
.ck-i { width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg,#00523C,#00A896); display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; font-size:11px; color:#fff; font-weight:900; }

.grid-pattern { background-image:linear-gradient(rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px); background-size:56px 56px; }
.grid-pattern-light { background-image:linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px); background-size:48px 48px; }

@media (max-width:1024px) {
  .hero-cols { flex-direction:column !important; }
  .hero-right { display:none !important; }
  .hero-ctas { justify-content:center !important; }
  .hero-text { text-align:center !important; }
  .hero-text p { margin:0 auto 32px !important; }
  .steps-g { grid-template-columns:1fr !important; }
  .difs-g { grid-template-columns:1fr 1fr !important; }
  .footer-g { grid-template-columns:1fr 1fr !important; }
  .mod-panel { grid-template-columns:1fr !important; }
  .impl-g { grid-template-columns:1fr !important; }
}
@media (max-width:768px) {
  .nav-links-desktop { display:none !important; }
  .nav-mobile-btn { display:block !important; }
  .nums-g { grid-template-columns:1fr 1fr !important; }
  .dores-g { grid-template-columns:1fr !important; }
  .difs-g { grid-template-columns:1fr !important; }
  .form-g { grid-template-columns:1fr !important; }
  .footer-g { grid-template-columns:1fr 1fr !important; }
  .para-quem-g { grid-template-columns:1fr !important; }
}
@media (max-width:480px) {
  .footer-g { grid-template-columns:1fr !important; }
}
`

// ─── Reveal hook ──────────────────────────────────────────────────────────
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

// ─── NAVBAR ───────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent',
      backdropFilter: scrolled ? 'blur(14px)' : 'none',
      boxShadow: scrolled ? '0 1px 24px rgba(0,0,0,0.09)' : 'none',
      transition: 'all .3s ease',
      padding: '0 24px',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src="/aion-logo-full.png"
            alt="ÁION EDU"
            style={{ height: 36, objectFit: 'contain' }}
            onError={e => {
              e.currentTarget.style.display = 'none';
              (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('style')
            }}
          />
          <span style={{ display: 'none', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 20, color: scrolled ? '#00523C' : '#fff', letterSpacing: '-.02em' }}>
            ÁION EDU
          </span>
        </a>

        <div className="nav-links-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[
            { href: '/#modulos', label: 'Módulos' },
            { href: '/#como-funciona', label: 'Como funciona' },
            { href: '/parceiros', label: 'Parceiros' },
            { href: '/blog', label: 'Blog' },
            { href: '/sobre', label: 'Sobre' },
          ].map(link => (
            <a key={link.href} href={link.href} style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,.88)', textDecoration: 'none', fontSize: 14, fontWeight: 600, transition: 'color .2s' }}>
              {link.label}
            </a>
          ))}
          <a href="/login" style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,.88)', fontSize: 14, fontWeight: 700, textDecoration: 'none', border: `1.5px solid ${scrolled ? '#D1D5DB' : 'rgba(255,255,255,.4)'}`, padding: '8px 18px', borderRadius: 10, transition: 'all .2s' }}>
            Entrar
          </a>
          <a href="/#demo" style={{ background: '#00A896', color: 'white', padding: '9px 20px', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700, boxShadow: '0 2px 12px rgba(0,168,150,.35)', transition: 'transform .2s, box-shadow .2s' }}>
            Agendar demo
          </a>
        </div>

        <button onClick={() => setMenuOpen(!menuOpen)} className="nav-mobile-btn" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 26, color: scrolled ? '#111827' : '#fff', lineHeight: 1 }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {menuOpen && (
        <div style={{ background: '#fff', padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 18, borderTop: '1px solid #F3F4F6', boxShadow: '0 8px 24px rgba(0,0,0,.1)' }}>
          {[
            { href: '/#modulos', label: 'Módulos' },
            { href: '/#como-funciona', label: 'Como funciona' },
            { href: '/parceiros', label: 'Parceiros' },
            { href: '/blog', label: 'Blog' },
            { href: '/sobre', label: 'Sobre' },
          ].map(link => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 600 }}>
              {link.label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/login" style={{ flex: 1, textAlign: 'center', border: '1.5px solid #D1D5DB', color: '#374151', padding: '11px 0', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>Entrar</a>
            <a href="/#demo" onClick={() => setMenuOpen(false)} style={{ flex: 2, textAlign: 'center', background: '#00A896', color: 'white', padding: '11px 0', borderRadius: 10, textDecoration: 'none', fontSize: 14, fontWeight: 700 }}>
              Agendar demo
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── HERO DASHBOARD MOCK ──────────────────────────────────────────────────
function HeroDashboard() {
  const [beat, setBeat] = useState(false)
  useEffect(() => { const id = setInterval(() => setBeat(b => !b), 2000); return () => clearInterval(id) }, [])

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: -10, right: -10,
        background: 'linear-gradient(135deg,#0DD3BF,#00A896)', color: '#fff',
        padding: '5px 13px', borderRadius: 20, fontSize: 11, fontWeight: 800,
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 5,
        boxShadow: '0 4px 16px rgba(13,211,191,.4)',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'blink 1.4s infinite' }} />
        AO VIVO
      </div>

      <div style={{ animation: 'floatY 5.5s ease-in-out infinite', background: 'rgba(255,255,255,.1)', borderRadius: 24, padding: 4, border: '1px solid rgba(255,255,255,.18)', boxShadow: '0 40px 100px rgba(0,0,0,.3)' }}>
        <div style={{ background: '#fff', borderRadius: 21, overflow: 'hidden' }}>
          {/* Browser bar */}
          <div style={{ padding: '11px 16px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#FF5F57','#FFBD2E','#28C840'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
              app.aionedu.com.br/campanha/2027
            </div>
          </div>

          {/* Header */}
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Funil · Campanha 2027</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: beat ? '#10B981' : '#D1FAE5', transition: 'background .6s' }} />
              <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Ao vivo</span>
            </div>
          </div>

          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', borderBottom: '1px solid #F3F4F6' }}>
            {[
              { label: 'Leads', val: '184', delta: '+12 hoje', color: '#00A896' },
              { label: 'Visitas', val: '67', delta: '+3 hoje', color: '#6366F1' },
              { label: 'Matrículas', val: '38', delta: '+2 hoje', color: '#F59E0B' },
            ].map((s, i) => (
              <div key={i} style={{ padding: '13px 15px', borderRight: i < 2 ? '1px solid #F3F4F6' : 'none' }}>
                <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#111827', lineHeight: 1, marginBottom: 2 }}>{s.val}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.delta}</p>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div style={{ padding: '14px 18px' }}>
            {[
              { label: 'Captação de leads', pct: 92, real: 184, meta: 200, color: '#00A896' },
              { label: 'Visitas agendadas', pct: 84, real: 67, meta: 80, color: '#6366F1' },
              { label: 'Matrículas efetivadas', pct: 76, real: 38, meta: 50, color: '#F59E0B' },
            ].map(row => (
              <div key={row.label} style={{ marginBottom: 11 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: '#6B7280' }}>{row.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#111827' }}>{row.real}<span style={{ color: '#D1D5DB', fontWeight: 400 }}>/{row.meta}</span></span>
                </div>
                <div style={{ height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.pct}%`, background: `linear-gradient(90deg,${row.color},${row.color}bb)`, borderRadius: 999 }} />
                </div>
              </div>
            ))}
            <div style={{ marginTop: 11, padding: '9px 11px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', display: 'flex', gap: 7 }}>
              <span style={{ fontSize: 12 }}>⚡</span>
              <span style={{ fontSize: 11, color: '#92400E', lineHeight: 1.5 }}>IA: visitas 14% abaixo da meta. Intensifique agendamento esta semana.</span>
            </div>
          </div>

          {/* Kanban mini */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, padding: '0 14px 14px' }}>
            {[
              { col: 'Novos', n: 12, bg: '#EFF6FF', dot: '#3B82F6' },
              { col: 'Contato', n: 8, bg: '#F5F3FF', dot: '#8B5CF6' },
              { col: 'Visita', n: 5, bg: '#FFFBEB', dot: '#D97706' },
              { col: 'Matr.', n: 3, bg: '#ECFDF5', dot: '#059669' },
            ].map(k => (
              <div key={k.col} style={{ background: k.bg, borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: k.dot, margin: '0 auto 4px' }} />
                <p style={{ fontSize: 15, fontWeight: 900, color: '#111827' }}>{k.n}</p>
                <p style={{ fontSize: 9, color: '#6B7280', fontWeight: 700 }}>{k.col}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ background: 'linear-gradient(145deg,#00301F 0%,#00523C 55%,#006B50 100%)', padding: '132px 36px 96px', minHeight: '94vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,168,150,.15),transparent 70%)', top: -200, right: -100, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,211,191,.08),transparent 70%)', bottom: -100, left: 40, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1160, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div className="hero-cols" style={{ display: 'flex', alignItems: 'center', gap: 80 }}>
          <div className="hero-text" style={{ flex: 1 }}>
            <div className="tag-d" style={{ marginBottom: 28, animation: 'fadeIn .8s ease both' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'pulse2 2s infinite' }} />
              CRM + WhatsApp + IA para escolas privadas
            </div>
            <h1 className="s-title" style={{ fontSize: 'clamp(40px,5.5vw,72px)', color: '#fff', marginBottom: 26, animation: 'fadeUp .85s ease .1s both', lineHeight: 1.06 }}>
              Sua escola vai<br />
              matricular mais.<br />
              <span style={{ color: '#0DD3BF' }}>Com processo,<br />dados e IA.</span>
            </h1>
            <p className="hero-text" style={{ fontSize: 18, color: 'rgba(255,255,255,.8)', lineHeight: 1.8, marginBottom: 38, maxWidth: 520, animation: 'fadeUp .85s ease .2s both' }}>
              A ÁION EDU centraliza toda a campanha de matrículas — do primeiro contato da família até a assinatura do contrato.
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'fadeUp .85s ease .3s both' }}>
              <a href="#demo" className="btn-g" style={{ fontSize: 16, padding: '17px 36px', background: '#fff', color: '#00523C', boxShadow: '0 6px 28px rgba(0,0,0,.2)' }}>
                Quero uma demonstração →
              </a>
              <a href="#modulos" className="btn-ghost">Ver os módulos ↓</a>
            </div>
            <div style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .85s ease .4s both', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex' }}>
                {['A','C','D','E','F'].map((l, i) => (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,hsl(${158+i*15},65%,${36-i*3}%),hsl(${168+i*15},55%,${44-i*3}%))`, border: '2.5px solid rgba(255,255,255,.25)', marginLeft: i > 0 ? -11 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', position: 'relative', zIndex: 5 - i }}>
                    {l}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: '#FCD34D', fontSize: 14, letterSpacing: 2, marginBottom: 4 }}>★★★★★</div>
                <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13 }}>
                  "Colégio Ágape já usa a ÁION EDU" — <strong style={{ color: '#fff' }}>Patos, Paraíba</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="hero-right" style={{ flex: '0 0 480px', animation: 'fadeIn 1.1s ease .5s both' }}>
            <HeroDashboard />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── TICKER ───────────────────────────────────────────────────────────────
function Ticker() {
  const items = ['CRM de Leads','WhatsApp Oficial','Pipeline Visual','IA de Campanha','Relatórios em Tempo Real','Rematrículas','Histórico das Famílias','Pesquisas NPS','Score de Leads','Automações','Benchmark INEP','Gestão da Equipe']
  const doubled = [...items, ...items]
  return (
    <div style={{ background: '#E6F7F5', borderTop: '1px solid #A7F3D0', borderBottom: '1px solid #A7F3D0', padding: '13px 0', overflow: 'hidden' }}>
      <div className="ticker-wrap">
        <div className="ticker-track">
          {doubled.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 22, padding: '0 28px', fontSize: 13, fontWeight: 700, color: '#00523C', whiteSpace: 'nowrap' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00A896', display: 'inline-block' }} />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────────────────
function StatCard({ value, suffix, label, desc, icon, color, index }: {
  value: number; suffix: string; label: string; desc: string; icon: string; color: string; index: number
}) {
  const [count, setCount] = useState(0)
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect() }
    }, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    setCount(0)
    const interval = setInterval(() => {
      setCount(prev => {
        if (prev >= value) { clearInterval(interval); return value }
        return Math.min(prev + Math.ceil(value / 28), value)
      })
    }, 50)
    return () => clearInterval(interval)
  }, [visible, value])

  return (
    <div ref={ref} style={{ padding: '48px 32px', borderRight: index < 3 ? '1px solid #E5E7EB' : 'none', textAlign: 'center' }}>
      <div style={{ fontSize: 38, marginBottom: 16 }}>{icon}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2, marginBottom: 10 }}>
        <div className="s-title" style={{ fontSize: 54, color, lineHeight: 1 }}>{count}</div>
        <div className="s-title" style={{ fontSize: 28, color }}>{suffix}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.65 }}>{desc}</div>
    </div>
  )
}

function Numeros() {
  const stats = [
    { value: 40, suffix: '%', label: 'Mais conversões', desc: 'em média nas escolas parceiras', icon: '📈', color: '#00A896' },
    { value: 85, suffix: '%', label: 'Taxa de rematrícula', desc: 'com acompanhamento pelo sistema', icon: '🔄', color: '#8B5CF6' },
    { value: 3, suffix: 'min', label: 'Tempo de resposta', desc: 'médio com WhatsApp integrado', icon: '⚡', color: '#F59E0B' },
    { value: 100, suffix: '%', label: 'Dados em tempo real', desc: 'sem planilhas ou anotações', icon: '📊', color: '#10B981' },
  ]
  return (
    <section style={{ background: '#fff', borderBottom: '1px solid #E5E7EB' }}>
      <div className="nums-g" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)' }}>
        {stats.map((s, i) => <StatCard key={i} {...s} index={i} />)}
      </div>
    </section>
  )
}

// ─── PROBLEMA ─────────────────────────────────────────────────────────────
function Problema() {
  const r0 = useReveal()
  const dores = [
    { icon: '😰', title: 'Leads somem sem acompanhamento', desc: 'Sem processo claro, famílias interessadas esfriam e vão para a concorrência. Você nem sabe quantas perdeu.' },
    { icon: '📋', title: 'Equipe trabalhando no improviso', desc: 'Cada atendente faz do seu jeito. Sem padrão, sem histórico, sem controle de quem fez o quê.' },
    { icon: '📊', title: 'Campanha começa no escuro todo ano', desc: 'Sem dados organizados do ano anterior, você repete os mesmos erros e não consegue bater a meta.' },
  ]
  return (
    <section style={{ padding: '96px 40px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>O problema</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827', marginBottom: 16 }}>
            Você ainda gerencia matrículas<br />no Excel e no WhatsApp pessoal?
          </h2>
          <p style={{ fontSize: 17, color: '#6B7280', maxWidth: 520, margin: '0 auto', lineHeight: 1.75 }}>
            Essa é a realidade de 9 em cada 10 escolas privadas. E ela custa matrículas todo ano.
          </p>
        </div>
        <div className="dores-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {dores.map((d, i) => {
            const r = useReveal(`${i + 1}`)
            return (
              <div key={i} ref={r} className="card" style={{ padding: 36 }}>
                <div style={{ fontSize: 44, marginBottom: 18 }}>{d.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 13, lineHeight: 1.4 }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{d.desc}</p>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <a href="#demo" className="btn-g">Quero resolver isso →</a>
        </div>
      </div>
    </section>
  )
}

// ─── MODULE PREVIEWS ──────────────────────────────────────────────────────
function KanbanPreview() {
  const cols = ['Novos', 'Contato', 'Visita', 'Matriculado']
  const cards = [
    { col: 'Novos', name: 'Maria Souza', temp: 'Quente', sub: '1º ano', score: 92 },
    { col: 'Contato', name: 'João Lima', temp: 'Morno', sub: '3º ano', score: 67 },
    { col: 'Visita', name: 'Ana Costa', temp: 'Quente', sub: '2º ano', score: 88 },
    { col: 'Matriculado', name: 'Carlos Melo', temp: 'Frio', sub: '4º ano', score: 41 },
  ]
  const tc = (t: string) => t === 'Quente' ? '#EF4444' : t === 'Morno' ? '#F59E0B' : '#60A5FA'
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {cols.map(col => (
        <div key={col} style={{ flex: '0 0 114px', background: '#F9FAFB', borderRadius: 11, padding: 9, border: '1px solid #E5E7EB' }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{col}</p>
          {cards.filter(c => c.col === col).map((c, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 9, padding: '9px 10px', marginBottom: 7, border: `1.5px solid ${tc(c.temp)}33`, boxShadow: '0 1px 4px rgba(0,0,0,.05)' }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{c.name}</p>
              <p style={{ fontSize: 10, color: '#9CA3AF', marginBottom: 6 }}>{c.sub}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 9, fontWeight: 800, color: tc(c.temp), background: `${tc(c.temp)}15`, borderRadius: 4, padding: '1px 5px' }}>{c.temp}</span>
                <span style={{ fontSize: 9, color: '#6B7280' }}>⚡{c.score}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function WhatsAppPreview() {
  return (
    <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1.5px solid #E5E7EB', boxShadow: '0 4px 20px rgba(0,0,0,.07)' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #F3F4F6', background: '#F9FAFB', display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#065F46,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>📱</div>
        <div>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>Colégio — Matrículas</p>
          <p style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>● Número oficial verificado</p>
        </div>
      </div>
      <div style={{ padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { from: 'lead', text: 'Olá! Tenho interesse em matricular minha filha. Quais séries?', time: '14:23' },
          { from: 'bot', text: '👋 Olá! Atendemos do Infantil ao 9º ano. Posso agendar uma visita?', time: '14:23', badge: 'Bot' },
          { from: 'lead', text: 'Sim, sábado seria ótimo!', time: '14:24' },
          { from: 'at', text: '✅ Agendado para sábado às 9h. Confirmarei por aqui.', time: '14:25', badge: 'Ana · Atendente' },
        ].map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'lead' ? 'flex-start' : 'flex-end' }}>
            <div style={{ maxWidth: '82%', padding: '8px 11px', borderRadius: msg.from === 'lead' ? '4px 12px 12px 12px' : '12px 4px 12px 12px', background: msg.from === 'lead' ? '#F3F4F6' : msg.from === 'bot' ? '#E6F7F5' : '#DCF8C6' }}>
              {(msg as any).badge && <p style={{ fontSize: 9, color: '#6B7280', marginBottom: 2, fontWeight: 700 }}>{(msg as any).badge}</p>}
              <p style={{ fontSize: 11, color: '#111827', lineHeight: 1.55 }}>{msg.text}</p>
              <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 3, textAlign: 'right' }}>{msg.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IAPreview() {
  const [slider, setSlider] = useState(50)
  const meta = Math.round(180 + (slider / 100) * 60)
  const cpa = Math.round(320 - (slider / 100) * 80)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#F9FAFB', borderRadius: 11, padding: 14, border: '1px solid #E5E7EB' }}>
        <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, fontWeight: 700 }}>Ambição da campanha</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Conservador</span>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>Agressivo</span>
        </div>
        <input type="range" min={0} max={100} value={slider} onChange={e => setSlider(+e.target.value)} style={{ width: '100%', accentColor: '#00A896', cursor: 'pointer' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: '#E6F7F5', borderRadius: 11, padding: 14, border: '1px solid #A7F3D0', textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#065F46', marginBottom: 5, fontWeight: 700 }}>Meta de matrículas</p>
          <p className="s-title" style={{ fontSize: 32, color: '#00523C' }}>{meta}</p>
        </div>
        <div style={{ background: '#EEF2FF', borderRadius: 11, padding: 14, border: '1px solid #C7D2FE', textAlign: 'center' }}>
          <p style={{ fontSize: 10, color: '#4338CA', marginBottom: 5, fontWeight: 700 }}>CPA sugerido</p>
          <p className="s-title" style={{ fontSize: 32, color: '#4338CA' }}>R${cpa}</p>
        </div>
      </div>
      <div style={{ background: '#FFFBEB', borderRadius: 9, padding: '10px 12px', border: '1px solid #FDE68A' }}>
        <p style={{ fontSize: 11, color: '#92400E', lineHeight: 1.55 }}>⚡ IA: Priorize Google Ads e eventos de captação em agosto e setembro.</p>
      </div>
    </div>
  )
}

function RelatoriosPreview() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>Saúde da campanha</span>
        <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 12, fontWeight: 800, padding: '3px 11px', borderRadius: 7 }}>82/100</span>
      </div>
      {[
        { label: 'Captação', pct: 92, real: 184, meta: 200, color: '#10B981', st: '🟢' },
        { label: 'Visitas', pct: 84, real: 67, meta: 80, color: '#F59E0B', st: '🟡' },
        { label: 'Matrículas', pct: 76, real: 38, meta: 50, color: '#EF4444', st: '🔴' },
        { label: 'Rematrícula', pct: 88, real: 176, meta: 200, color: '#10B981', st: '🟢' },
      ].map(row => (
        <div key={row.label} style={{ marginBottom: 11 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', gap: 5 }}>{row.st} {row.label}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{row.real}<span style={{ color: '#D1D5DB', fontWeight: 400 }}>/{row.meta}</span></span>
          </div>
          <div style={{ height: 7, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function RematPreview() {
  return (
    <div>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em' }}>Radar de Evasão</p>
      {[
        { name: 'Pedro Alves', serie: '5º ano', risco: 82, acao: 'Ligar hoje' },
        { name: 'Luana Mota', serie: '3º ano', risco: 61, acao: 'Enviar WA' },
        { name: 'Carlos Neto', serie: '7º ano', risco: 34, acao: 'Monitorar' },
      ].map((a, i) => (
        <div key={i} style={{ background: '#F9FAFB', borderRadius: 11, padding: '11px 13px', marginBottom: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #E5E7EB' }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#111827', marginBottom: 2 }}>{a.name}</p>
            <p style={{ fontSize: 10, color: '#9CA3AF' }}>{a.serie}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="s-title" style={{ fontSize: 20, color: a.risco > 70 ? '#EF4444' : a.risco > 50 ? '#F59E0B' : '#10B981' }}>{a.risco}%</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: '#6B7280' }}>{a.acao}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function TransfPreview() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#F9FAFB', borderRadius: 11, padding: 14, border: '1px solid #E5E7EB' }}>
        <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 8, fontWeight: 700 }}>Link enviado via WhatsApp</p>
        <div style={{ background: '#E6F7F5', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#00523C', fontWeight: 700 }}>aionedu.com.br/t/agt2027abc</div>
      </div>
      <div style={{ background: '#FEF2F2', borderRadius: 11, padding: 14, border: '1px solid #FECACA' }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.05em' }}>Análise IA</p>
        <p style={{ fontSize: 12, color: '#374151', lineHeight: 1.65 }}>Motivo principal: <strong>Distância</strong> (confiança 87%). Oportunidade de retenção: <strong style={{ color: '#10B981' }}>Alta</strong> — família aberta a negociação.</p>
      </div>
    </div>
  )
}

const MODULES = [
  { id: 'crm', icon: '🎯', label: 'CRM de Leads', title: 'Kanban visual com score automático', desc: 'Gerencie todo o funil com kanban drag-and-drop. Leads mais quentes sobem automaticamente para o topo da fila.', items: ['Kanban: Novo → Contato → Visita → Proposta → Matriculado', 'Termômetro Frio / Morno / Quente', 'Score automático de priorização', 'Motivo de perda com dashboard de causas', 'Histórico completo de interações por lead'], preview: <KanbanPreview /> },
  { id: 'whatsapp', icon: '📱', label: 'WhatsApp', title: 'API Oficial Meta — seu número, sua equipe', desc: 'Toda a equipe atende pelo número oficial da escola. Bot inteligente, histórico completo, leads entram no funil automaticamente.', items: ['Número oficial — não o celular de alguém', 'Bot fora do horário que qualifica leads', 'Fluxos personalizados pela escola', 'API Oficial Meta — sem risco de bloqueio', 'Disparos para listas segmentadas'], preview: <WhatsAppPreview /> },
  { id: 'ia', icon: '🤖', label: 'IA de Campanha', title: 'Plano completo em 3 minutos', desc: 'A IA lê seus dados do ERP, compara com o mercado local e gera metas mensais, CPA sugerido e calendário de captação.', items: ['Plano completo em 3 min a partir do ERP', 'Metas mensais + CPA + calendário de captação', 'Slider: conservador, realista ou agressivo', 'Benchmark com INEP e Censo Escolar', 'Recalcula automaticamente ao ajustar parâmetros'], preview: <IAPreview /> },
  { id: 'relatorios', icon: '📊', label: 'Relatórios', title: 'Visão cirúrgica da campanha em tempo real', desc: 'Dashboard com desvios coloridos, alertas automáticos e análise semanal. Sua equipe sabe o que fazer a cada semana.', items: ['Funil em tempo real com desvios coloridos', 'Velocidade semanal vs meta necessária', 'Índice de saúde 0–100 pela IA', 'Comparativo histórico mês a mês', 'ROI por canal de marketing'], preview: <RelatoriosPreview /> },
  { id: 'rematriculas', icon: '🔄', label: 'Rematrículas', title: 'Radar de evasão preditivo', desc: 'Cruzamento de satisfação, frequência e histórico para apontar alunos com risco de não renovar antes que seja tarde.', items: ['Projeção preditiva de não-renovação', 'Base elegível real: desconta formandos', 'Radar de evasão com dados de satisfação', 'Ações sugeridas pela IA para retenção'], preview: <RematPreview /> },
  { id: 'transferencias', icon: '↔', label: 'Transferências', title: 'Diagnóstico IA de cada saída', desc: 'Link de pesquisa enviado por WhatsApp. A família responde em 3 minutos. A IA analisa o motivo real e aponta retenção.', items: ['Link personalizado por WhatsApp ou e-mail', 'Família responde em 3 minutos', 'IA: motivo real + confiança + retenção', 'Histórico por série, mês e motivo'], preview: <TransfPreview /> },
]

// ─── MÓDULOS INTERATIVOS ──────────────────────────────────────────────────
function Modulos() {
  const [active, setActive] = useState(0)
  const r0 = useReveal()

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % MODULES.length), 6000)
    return () => clearInterval(id)
  }, [])

  const m = MODULES[active]

  return (
    <section id="modulos" style={{ padding: '96px 40px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Módulos completos</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827', marginBottom: 16 }}>
            Tudo que sua escola precisa para uma<br />campanha de matrículas de sucesso
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 520, margin: '0 auto', lineHeight: 1.75 }}>
            Cada módulo foi construído a partir de problemas reais de escolas privadas brasileiras.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 34, overflowX: 'auto', paddingBottom: 4 }}>
          {MODULES.map((mod, i) => (
            <button key={mod.id} className={`mod-tab${active === i ? ' active' : ''}`} onClick={() => setActive(i)}>
              {mod.icon} {mod.label}
            </button>
          ))}
        </div>

        <div key={active} className="mod-panel" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, animation: 'scaleIn .38s ease' }}>
          <div className="card" style={{ padding: 38 }}>
            <div style={{ fontSize: 44, marginBottom: 18 }}>{m.icon}</div>
            <h3 className="s-title" style={{ fontSize: 24, color: '#111827', marginBottom: 14, lineHeight: 1.2 }}>{m.title}</h3>
            <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.8, marginBottom: 24 }}>{m.desc}</p>
            {m.items.map((item, j) => (
              <div key={j} className="ck">
                <div className="ck-i">✓</div>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{item}</span>
              </div>
            ))}
            <div style={{ marginTop: 28 }}>
              <a href="#demo" className="btn-g">Ver este módulo na prática →</a>
            </div>
          </div>
          <div className="card" style={{ padding: 30, background: '#FAFAFA', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span className="tag-g" style={{ fontSize: 11, marginBottom: 18 }}>Preview interativo</span>
            {m.preview}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 26 }}>
          {MODULES.map((_, i) => (
            <button key={i} onClick={() => setActive(i)} style={{ width: active === i ? 26 : 8, height: 8, borderRadius: 999, background: active === i ? '#00A896' : '#D1D5DB', border: 'none', cursor: 'pointer', transition: 'all .3s', padding: 0 }} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── COMO FUNCIONA ────────────────────────────────────────────────────────
function ComoFunciona() {
  const r0 = useReveal()
  const steps = [
    { num: '01', icon: '📂', title: 'Configure sua escola (5 min)', desc: 'Importe relatórios do ERP. A IA lê o histórico e entende o padrão da sua escola automaticamente. Sem planilha, sem digitação.' },
    { num: '02', icon: '🧠', title: 'Gere seu plano de campanha', desc: 'A IA analisa histórico + mercado local e cria metas mensais, CPA sugerido e calendário de captação. Você revisa e aplica.' },
    { num: '03', icon: '📈', title: 'Acompanhe e converta em tempo real', desc: 'Dashboard com desvios visuais, alertas automáticos e análise semanal. Sua equipe sabe o que fazer a cada semana.' },
  ]

  return (
    <section id="como-funciona" style={{ padding: '96px 40px', background: '#00301F', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,168,150,.12),transparent 70%)', top: -200, right: -100, pointerEvents: 'none' }} />

      <div style={{ maxWidth: 1060, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>Como funciona</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,46px)', color: '#fff', marginBottom: 14 }}>
            Do zero ao plano de campanha<br />em menos de 10 minutos
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>
            Simples para a equipe, poderoso para a gestão.
          </p>
        </div>

        <div className="steps-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative' }}>
          {/* Connecting line */}
          <div style={{ position: 'absolute', top: 52, left: '17%', right: '17%', height: 2, background: 'linear-gradient(90deg,#00A896,#0DD3BF)', opacity: .35, pointerEvents: 'none' }} />

          {steps.map((s, i) => {
            const r = useReveal(`${i + 1}`)
            return (
              <div key={i} ref={r} className="card-dark" style={{ padding: 36, textAlign: 'center', position: 'relative' }}>
                <div className="s-title" style={{ position: 'absolute', top: 12, right: 20, fontSize: 80, color: 'rgba(255,255,255,.04)', lineHeight: 1, pointerEvents: 'none' }}>{s.num}</div>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', fontSize: 30, boxShadow: '0 8px 28px rgba(0,168,150,.3)' }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0DD3BF', letterSpacing: '.12em', marginBottom: 11, textTransform: 'uppercase' }}>PASSO {s.num}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 13, lineHeight: 1.35 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.6)', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 52 }}>
          <a href="#demo" className="btn-g" style={{ fontSize: 16, padding: '17px 36px' }}>
            Quero começar →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── IMPLANTAÇÃO ──────────────────────────────────────────────────────────
function Implantacao() {
  const r0 = useReveal()
  const etapas = [
    { num: '01', icon: '⚙️', color: '#00A896', title: 'Implantação', sub: 'Configuração completa da plataforma', desc: 'Nossa equipe conduz todo o processo. Integração com o ERP, WhatsApp oficial, cadastro da equipe e ajuste das metas iniciais.', items: ['Configuração completa da conta e equipe', 'Integração e leitura do ERP da escola', 'Homologação do número WhatsApp oficial', 'Personalização dos fluxos de atendimento', 'Treinamento presencial ou remoto da equipe'] },
    { num: '02', icon: '🧠', color: '#6366F1', title: 'Criação da Campanha', sub: 'Com apoio técnico e inteligência artificial', desc: 'Junto com nosso consultor, a IA constrói o plano: metas, CPA, calendário de captação e estratégia por canal.', items: ['Reunião de kickoff com consultor dedicado', 'Geração do plano completo com IA', 'Definição de metas mensais realistas', 'Calendário de captação personalizado', 'Estratégia por canal: Google, Facebook, indicação'] },
    { num: '03', icon: '📊', color: '#F59E0B', title: 'Acompanhamento Mensal', sub: 'Reuniões + relatórios + estratégia contínua', desc: 'Todo mês, reunião de análise de performance, relatório detalhado e ajuste de estratégia. Sempre no ritmo certo.', items: ['Reunião mensal de análise de performance', 'Relatório detalhado mês a mês', 'Análise de desvios e causas', 'Ajuste de estratégia em tempo real', 'Suporte prioritário via WhatsApp'] },
  ]

  return (
    <section id="implantacao" style={{ padding: '96px 40px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Fluxo de implantação</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827', marginBottom: 16 }}>
            Você não precisa fazer nada sozinho
          </h2>
          <p style={{ fontSize: 17, color: '#6B7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.75 }}>
            Do primeiro acesso à campanha rodando, nossa equipe acompanha cada etapa.
          </p>
        </div>
        <div className="impl-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {etapas.map((e, i) => {
            const r = useReveal(`${i + 1}`)
            return (
              <div key={i} ref={r} className="card" style={{ padding: 38, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${e.color},${e.color}66)`, borderRadius: '22px 22px 0 0' }} />
                <div className="s-title" style={{ position: 'absolute', top: 10, right: 22, fontSize: 76, color: `${e.color}0d`, lineHeight: 1, pointerEvents: 'none' }}>{e.num}</div>
                <div style={{ fontSize: 38, marginBottom: 16 }}>{e.icon}</div>
                <h3 className="s-title" style={{ fontSize: 22, color: '#111827', marginBottom: 5 }}>{e.title}</h3>
                <p style={{ fontSize: 12, fontWeight: 800, color: e.color, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '.06em' }}>{e.sub}</p>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8, marginBottom: 22 }}>{e.desc}</p>
                {e.items.map((item, j) => (
                  <div key={j} className="ck" style={{ marginBottom: 9 }}>
                    <div className="ck-i" style={{ background: `linear-gradient(135deg,${e.color}cc,${e.color})` }}>✓</div>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0, marginTop: 40 }}>
          {etapas.map((e, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 13, height: 13, borderRadius: '50%', background: e.color, boxShadow: `0 0 12px ${e.color}88` }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: e.color }}>{e.title}</span>
              </div>
              {i < etapas.length - 1 && (
                <div style={{ flex: 1, maxWidth: 100, height: 2, background: `linear-gradient(90deg,${e.color},${etapas[i+1].color})`, marginBottom: 14 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── DIFERENCIAIS ─────────────────────────────────────────────────────────
function Diferenciais() {
  const r0 = useReveal()
  const difs = [
    { icon: '🇧🇷', title: '100% feito para o Brasil', desc: 'LGPD, INEP, Censo Escolar, ERPs nacionais — tudo integrado nativamente. Desenvolvido para a realidade das escolas privadas brasileiras.' },
    { icon: '🤖', title: 'IA proprietária de matrículas', desc: 'Não é um ChatGPT genérico. Nossa IA foi desenvolvida com dados do mercado escolar brasileiro e entende os ciclos específicos de matrícula.' },
    { icon: '📱', title: 'API Oficial Meta — sem riscos', desc: 'Enquanto concorrentes usam soluções não-oficiais com risco de bloqueio, a ÁION EDU opera com a API Oficial do Meta WhatsApp Business.' },
    { icon: '👥', title: 'Consultor dedicado do início ao fim', desc: 'Não somos uma plataforma de autoatendimento. Você tem um consultor que acompanha sua campanha mensalmente e faz ajustes com você.' },
    { icon: '🔗', title: 'Plataforma integrada — sem ilhas de dados', desc: 'CRM, WhatsApp, relatórios, rematrícula e pesquisas em um único sistema. Dados cruzados automaticamente. Nada em planilha isolada.' },
    { icon: '📈', title: 'Ciclo completo de matrícula', desc: 'Da captação de leads à rematrícula e pesquisa de satisfação. A ÁION EDU acompanha do primeiro contato até a renovação.' },
  ]
  return (
    <section id="diferenciais" style={{ padding: '96px 40px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 62 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Por que ÁION EDU</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827', marginBottom: 16 }}>
            Mais do que um software —<br />um parceiro de resultados
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 490, margin: '0 auto', lineHeight: 1.75 }}>
            O que separa a ÁION EDU de qualquer outra ferramenta do mercado.
          </p>
        </div>
        <div className="difs-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {difs.map((d, i) => {
            const r = useReveal(`${(i % 3) + 1}`)
            return (
              <div key={i} ref={r} className="card" style={{ padding: 32 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 18 }}>
                  {d.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.35 }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{d.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── DEPOIMENTO ───────────────────────────────────────────────────────────
function Depoimento() {
  const r0 = useReveal()
  return (
    <section style={{ padding: '96px 40px', background: 'linear-gradient(145deg,#00301F 0%,#00523C 55%,#006B50 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle,rgba(13,211,191,.1),transparent)', top: -120, left: -80, pointerEvents: 'none' }} />
      <div ref={r0} style={{ maxWidth: 780, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(255,255,255,.09)', borderRadius: 26, padding: '52px 52px', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,.16)', position: 'relative' }}>
          <div style={{ fontSize: 80, color: 'rgba(255,255,255,.08)', position: 'absolute', top: 10, left: 36, lineHeight: 1, fontFamily: 'Georgia,serif' }}>"</div>
          <div style={{ color: '#FCD34D', fontSize: 22, letterSpacing: 3, marginBottom: 24, textAlign: 'center' }}>★★★★★</div>
          <blockquote style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.65, textAlign: 'center', marginBottom: 34, fontStyle: 'italic' }}>
            "Pela primeira vez chegamos na campanha de matrículas com um plano real — metas por semana, calendário de captação e visibilidade total do funil. A plataforma identificou tendências que a gente não estava vendo."
          </blockquote>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 900, color: '#fff' }}>A</div>
            <p style={{ fontWeight: 800, color: '#fff', fontSize: 16 }}>Direção, Colégio Ágape</p>
            <p style={{ color: 'rgba(255,255,255,.6)', fontSize: 14, marginTop: 5 }}>Escola privada · Patos, Paraíba</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 42 }}>
          <a href="#demo" className="btn-g" style={{ background: '#fff', color: '#00523C', boxShadow: '0 8px 32px rgba(0,0,0,.18)', fontSize: 16, padding: '17px 36px' }}>
            Quero esses resultados →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── PARA QUEM É ──────────────────────────────────────────────────────────
function ParaQuem() {
  const r0 = useReveal()
  const cards = [
    { icon: '🏫', title: 'Escola independente', desc: 'Que quer profissionalizar a campanha e sair das planilhas', items: ['1 a 3 atendentes', 'Até 500 alunos', 'Campanha manual hoje'] },
    { icon: '🏢', title: 'Escola em crescimento', desc: 'Que já tem equipe e quer dados para tomar decisões', items: ['3 a 10 atendentes', '500 a 2000 alunos', 'Quer previsibilidade'] },
    { icon: '🌐', title: 'Rede de escolas', desc: 'Que precisa padronizar e escalar a captação em múltiplas unidades', items: ['10+ atendentes', '2000+ alunos', 'Múltiplas unidades'] },
  ]
  return (
    <section style={{ padding: '96px 40px', background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Para quem é</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827', marginBottom: 14 }}>
            Para qual escola é a ÁION EDU?
          </h2>
        </div>
        <div className="para-quem-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {cards.map((card, i) => {
            const r = useReveal(`${i + 1}`)
            return (
              <div key={i} ref={r} className="card" style={{ padding: 36 }}>
                <div style={{ fontSize: 46, marginBottom: 18 }}>{card.icon}</div>
                <h3 style={{ fontSize: 19, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.3 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, marginBottom: 22 }}>{card.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {card.items.map((item, j) => (
                    <li key={j} style={{ fontSize: 13, color: '#374151', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ color: '#00A896', fontWeight: 800, fontSize: 14 }}>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  const r0 = useReveal()
  const items = [
    { q: 'Como funciona o processo de implantação?', a: 'Nossa equipe conduz tudo. Do acesso inicial à homologação do WhatsApp, configuração do ERP, treinamento da equipe e geração do primeiro plano de campanha. Você não precisa de conhecimento técnico.' },
    { q: 'Preciso de conhecimento técnico para usar?', a: 'Não. A plataforma foi criada para gestores de escolas. O onboarding é guiado e o suporte em português está sempre disponível.' },
    { q: 'Quanto tempo leva para a escola estar funcionando?', a: 'Em média 5 a 7 dias úteis: integração ERP, WhatsApp oficial homologado, equipe treinada e primeiro plano de campanha gerado.' },
    { q: 'Como funciona a integração com o WhatsApp?', a: 'Usamos a API Oficial do Meta WhatsApp Business. O processo leva de 2 a 5 dias úteis e nossa equipe faz tudo por você.' },
    { q: 'A plataforma funciona com qualquer ERP escolar?', a: 'Sim. A IA processa relatórios em PDF, XLS e CSV de qualquer ERP: SIGA, Totvs, Escolare, Sistec e outros.' },
    { q: 'Como funciona o acompanhamento mensal?', a: 'Todo mês, uma reunião de análise de performance com nosso consultor, relatório detalhado e ajuste de estratégia. Não é suporte — é parceria ativa de resultados.' },
  ]
  return (
    <section style={{ padding: '96px 40px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 54 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Dúvidas</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,40px)', color: '#111827' }}>Perguntas frequentes</h2>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
            <button className="faq-btn" onClick={() => setOpen(open === i ? null : i)}>
              <span>{item.q}</span>
              <span style={{ fontSize: 24, color: '#00A896', transition: 'transform .25s', transform: open === i ? 'rotate(45deg)' : 'none', lineHeight: 1, flexShrink: 0, marginLeft: 16 }}>+</span>
            </button>
            {open === i && (
              <div style={{ paddingBottom: 22, fontSize: 15, color: '#6B7280', lineHeight: 1.85, animation: 'fadeUp .3s ease' }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── CTA FINAL ────────────────────────────────────────────────────────────
function CTAFinal() {
  const [form, setForm] = useState({ nome: '', email: '', escola: '', cidade: '', whatsapp: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const r0 = useReveal()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.escola || !form.whatsapp) {
      setErr('Preencha todos os campos obrigatórios.')
      return
    }
    setSending(true)
    setErr(null)
    try {
      const res = await fetch(
        'https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/landing-lead',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: form.nome, email: form.email, escola: form.escola, cidade: form.cidade, whatsapp: form.whatsapp }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar')
      setSent(true)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao enviar'
      setErr(message + '. Tente novamente ou fale pelo WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="demo" style={{ padding: '96px 40px', background: 'linear-gradient(145deg,#00301F 0%,#00523C 55%,#00A896 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 840, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 54 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>Pronto para começar?</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4.5vw,52px)', color: '#fff', marginBottom: 16 }}>
            Comece antes da próxima<br />campanha de matrícula
          </h2>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,.78)', maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
            Escolas que planejam com antecedência têm resultados consistentemente melhores na captação de novos alunos.
          </p>
        </div>

        {sent ? (
          <div style={{ background: '#fff', borderRadius: 26, padding: '52px 44px', textAlign: 'center', maxWidth: 520, margin: '0 auto', boxShadow: '0 32px 80px rgba(0,0,0,.2)' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
            <h3 className="s-title" style={{ fontSize: 26, color: '#00523C', marginBottom: 14 }}>Recebemos sua solicitação!</h3>
            <p style={{ color: '#374151', lineHeight: 1.8, fontSize: 15 }}>Nossa equipe vai entrar em contato via WhatsApp em até 2 horas úteis.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <a
                href="https://wa.me/5583933444383?text=Olá! Acabei de solicitar uma demonstração da Áion Edu e gostaria de agendar."
                target="_blank"
                rel="noopener noreferrer"
                className="btn-g"
                style={{ background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,.35)', fontSize: 14, padding: '13px 26px' }}
              >
                💬 Falar agora no WhatsApp
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 26, padding: '44px 44px', maxWidth: 700, margin: '0 auto', boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
            <div className="form-g" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              {[
                { key: 'nome', label: 'Nome completo *', ph: 'Seu nome', type: 'text' },
                { key: 'email', label: 'E-mail *', ph: 'seu@email.com', type: 'email' },
                { key: 'escola', label: 'Nome da escola *', ph: 'Colégio...', type: 'text' },
                { key: 'cidade', label: 'Cidade / Estado', ph: 'Ex: João Pessoa/PB', type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.07em' }}>{f.label}</label>
                  <input className="inp" type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '.07em' }}>WhatsApp *</label>
              <input className="inp" value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(83) 9xxxx-xxxx" />
            </div>
            {err && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 14 }}>{err}</p>}
            <button type="submit" disabled={sending} className="btn-g" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '18px 0', opacity: sending ? .7 : 1 }}>
              {sending ? 'Enviando...' : 'Quero minha demonstração →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>Resposta em até 2 horas úteis · Suporte em português</p>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#00301F', color: 'white', padding: '64px 40px 36px' }}>
      <div className="footer-g" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 44, marginBottom: 52 }}>
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 24, marginBottom: 13, letterSpacing: '-.02em' }}>ÁION EDU</div>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>
            A plataforma inteligente para campanhas de matrícula escolar.
          </p>
          <div style={{ color: 'rgba(255,255,255,.4)', fontSize: 12, lineHeight: 1.8 }}>
            CNPJ: 65.835.064/0001-58<br />
            Patos, Paraíba — Brasil
          </div>
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 13, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Produto</div>
          {['Módulos', 'Como funciona', 'Implantação', 'Parceiros'].map(item => (
            <div key={item} style={{ marginBottom: 12 }}>
              <a href="#" style={{ color: 'rgba(255,255,255,.72)', textDecoration: 'none', fontSize: 14, transition: 'color .2s' }}>{item}</a>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 13, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Empresa</div>
          {[
            { label: 'Sobre nós', href: '/sobre' },
            { label: 'Blog', href: '/blog' },
            { label: 'Parceiros', href: '/parceiros' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <a href={item.href} style={{ color: 'rgba(255,255,255,.72)', textDecoration: 'none', fontSize: 14 }}>{item.label}</a>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 18, fontSize: 13, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Contato</div>
          {[
            { label: 'Privacidade', href: '/privacidade' },
            { label: 'Termos de uso', href: '/termos' },
          ].map(item => (
            <div key={item.label} style={{ marginBottom: 12 }}>
              <a href={item.href} style={{ color: 'rgba(255,255,255,.72)', textDecoration: 'none', fontSize: 14 }}>{item.label}</a>
            </div>
          ))}
          <div style={{ marginTop: 18 }}>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, marginBottom: 6 }}>WhatsApp</div>
            <a href="https://wa.me/5583933444383" style={{ color: '#0DD3BF', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>(83) 9344-4383</a>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>© 2026 ÁION Soluções Tecnológicas Ltda. Todos os direitos reservados.</span>
        <span style={{ color: 'rgba(255,255,255,.4)', fontSize: 12 }}>Feito com 💚 no sertão paraibano</span>
      </div>
    </footer>
  )
}

// ─── BOTÃO FLUTUANTE WHATSAPP ─────────────────────────────────────────────
function WAButton() {
  return (
    <a
      href="https://wa.me/5583933444383?text=Olá! Tenho interesse na Áion Edu e gostaria de saber mais."
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: 'fixed', bottom: 28, right: 28, zIndex: 999,
        width: 60, height: 60, borderRadius: '50%',
        background: '#25D366',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 24px rgba(37,211,102,.55)',
        textDecoration: 'none',
        transition: 'transform .2s, box-shadow .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(37,211,102,.65)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(37,211,102,.55)' }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )
}

// ─── EXPORT ───────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <Numeros />
        <Problema />
        <Modulos />
        <ComoFunciona />
        <Implantacao />
        <Diferenciais />
        <Depoimento />
        <ParaQuem />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
      <WAButton />
    </>
  )
}
