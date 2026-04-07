import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── Global CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  .anim { opacity: 0; }
  .anim.visible { animation: fadeInUp 0.6s ease forwards; }
  .anim.visible:nth-child(1) { animation-delay: 0.05s; }
  .anim.visible:nth-child(2) { animation-delay: 0.15s; }
  .anim.visible:nth-child(3) { animation-delay: 0.25s; }
  .anim.visible:nth-child(4) { animation-delay: 0.35s; }
  .anim.visible:nth-child(5) { animation-delay: 0.45s; }
  .anim.visible:nth-child(6) { animation-delay: 0.55s; }

  .nav-link {
    color: #374151;
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    padding: 6px 4px;
    border-bottom: 2px solid transparent;
    transition: color 0.2s, border-color 0.2s;
  }
  .nav-link:hover { color: #00523C; border-bottom-color: #00523C; }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #00523C;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.2s, transform 0.15s;
  }
  .btn-primary:hover { background: #003d2d; transform: translateY(-1px); }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    color: #00523C;
    border: 2px solid #00523C;
    border-radius: 8px;
    padding: 10px 22px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
  }
  .btn-outline:hover { background: #00523C; color: #fff; }

  .btn-white {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #fff;
    color: #00523C;
    border: none;
    border-radius: 8px;
    padding: 14px 28px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    text-decoration: none;
    transition: all 0.2s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  }
  .btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.18); }

  .card {
    background: #fff;
    border-radius: 16px;
    padding: 28px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04);
    border: 1px solid #f0f0f0;
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .card:hover { box-shadow: 0 8px 32px rgba(0,82,60,0.12); transform: translateY(-2px); }

  .form-input {
    width: 100%;
    padding: 12px 16px;
    border: 1.5px solid #d1d5db;
    border-radius: 8px;
    font-size: 15px;
    outline: none;
    transition: border-color 0.2s;
    background: #fff;
  }
  .form-input:focus { border-color: #00523C; box-shadow: 0 0 0 3px rgba(0,82,60,0.08); }

  .section-alt { background: #f9fafb; }

  @media (max-width: 768px) {
    .hide-mobile { display: none !important; }
    .hero-grid { flex-direction: column !important; }
    .features-grid { grid-template-columns: 1fr !important; }
    .stats-grid { grid-template-columns: 1fr 1fr !important; }
    .footer-grid { grid-template-columns: 1fr 1fr !important; }
    .steps-grid { flex-direction: column !important; }
  }
`

// ─── Scroll animation hook ─────────────────────────────────────────────────────
function useScrollAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.08 }
    )
    const els = document.querySelectorAll('.anim')
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ─── Header ────────────────────────────────────────────────────────────────────
function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Preços', href: '#precos' },
    { label: 'Contato', href: '#contato' },
  ]

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
      background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(10px)',
      borderBottom: `1px solid ${scrolled ? '#e5e7eb' : 'transparent'}`,
      transition: 'all 0.3s',
      boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 800, fontSize: 20, color: '#00523C', letterSpacing: '-0.5px' }}>Áion Edu</span>
          <span style={{ fontSize: 10, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Inteligência em matrículas</span>
        </a>

        {/* Desktop nav */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/login" className="btn-outline" style={{ padding: '8px 18px', fontSize: 14 }}>Entrar</a>
          <a href="#demo" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>Agendar demonstração</a>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          className="mobile-menu-btn"
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="24" height="24" fill="none" stroke="#00523C" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="24" height="24" fill="none" stroke="#00523C" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ background: '#fff', borderTop: '1px solid #e5e7eb', padding: '16px 24px 24px' }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              style={{ display: 'block', padding: '12px 0', color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500, borderBottom: '1px solid #f3f4f6' }}>
              {l.label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <a href="/login" className="btn-outline" style={{ flex: 1, justifyContent: 'center', fontSize: 14 }}>Entrar</a>
            <a href="#demo" className="btn-primary" onClick={() => setMenuOpen(false)} style={{ flex: 1, justifyContent: 'center', fontSize: 14 }}>Demo grátis</a>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      background: 'linear-gradient(135deg, #00523C 0%, #007a5e 50%, #00A896 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      padding: '100px 24px 80px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background shapes */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: -100, right: -100, width: 500, height: 500, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', bottom: -150, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', top: '40%', right: '8%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,168,150,0.2)' }} />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative' }}>
        <div className="hero-grid" style={{ display: 'flex', alignItems: 'center', gap: 64 }}>
          {/* Text */}
          <div style={{ flex: '1 1 540px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', borderRadius: 100, padding: '6px 16px', marginBottom: 24 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 500 }}>Plataforma em operação · Primeiro cliente desde 2026</span>
            </div>

            <h1 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: 20, letterSpacing: '-1px' }}>
              Chega de perder alunos{' '}
              <span style={{ color: '#a7f3d0' }}>por falta de processo</span>
            </h1>

            <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 36, maxWidth: 520 }}>
              A Áion Edu é a plataforma de inteligência em matrículas para escolas privadas brasileiras.
              CRM, IA, WhatsApp e relatórios em um só lugar.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="#demo" className="btn-white">
                Agendar demonstração gratuita
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l7-7M12 12V5H5"/></svg>
              </a>
              <a href="#como-funciona" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                color: 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 15, fontWeight: 600,
                padding: '12px 4px',
              }}>
                Ver como funciona
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
              </a>
            </div>

            {/* Social proof */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
              {[
                'Usado por escolas privadas',
                'Dados reais do INEP e Censo Escolar',
                'Suporte em português',
              ].map(text => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                  <svg width="14" height="14" fill="none" stroke="#4ade80" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/><polyline points="20 6 9 17 4 12" transform="scale(0.7) translate(3,3)"/></svg>
                  {text}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mockup */}
          <div className="hide-mobile" style={{ flex: '0 0 480px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.15)',
              padding: 24,
              backdropFilter: 'blur(8px)',
            }}>
              {/* Fake browser chrome */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                {['#ff5f57','#febc2e','#28c840'].map((c,i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
                ))}
              </div>

              {/* KPI row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Leads ativos', value: '147', color: '#4ade80' },
                  { label: 'Matrículas', value: '89', color: '#60a5fa' },
                  { label: 'Conversão', value: '61%', color: '#f59e0b' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{kpi.label}</div>
                  </div>
                ))}
              </div>

              {/* Kanban columns */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[
                  { col: 'Novo', count: 24, color: '#6366f1' },
                  { col: 'Contato', count: 18, color: '#f59e0b' },
                  { col: 'Visita', count: 11, color: '#3b82f6' },
                  { col: 'Matrícula', count: 7, color: '#10b981' },
                ].map(col => (
                  <div key={col.col} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 6px' }}>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.col}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[1,2].map(i => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 4, height: 28, borderLeft: `3px solid ${col.color}` }} />
                      ))}
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>{col.count} leads</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* AI insight */}
              <div style={{ background: 'rgba(0,168,150,0.2)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(0,168,150,0.3)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 16 }}>🤖</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#a7f3d0', marginBottom: 2 }}>Insight da IA</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                    Meta de agosto atingida em 73%. Reforce contatos da semana passada para alcançar 100%.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Pain Cards ────────────────────────────────────────────────────────────────
function PainSection() {
  const problems = [
    {
      emoji: '😰',
      title: 'Perco leads porque não consigo acompanhar todos',
      pain: 'Sem um processo claro, leads esfriam e vão para a concorrência.',
      solution: 'A Áion Edu organiza tudo em um funil visual com alertas automáticos.',
    },
    {
      emoji: '📋',
      title: 'Minha equipe trabalha no Excel e WhatsApp pessoal',
      pain: 'Processo manual gera retrabalho, erros e falta de visibilidade.',
      solution: 'Com a Áion Edu, tudo fica centralizado e rastreável.',
    },
    {
      emoji: '📊',
      title: 'Não sei quantos alunos vou perder no próximo ciclo',
      pain: 'Sem dados históricos organizados, a campanha começa no escuro.',
      solution: 'A Áion Edu analisa seus dados e projeta o que esperar.',
    },
  ]
  return (
    <section style={{ padding: '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#00523C', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 100, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            Situações comuns
          </span>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            Você reconhece alguma dessas situações?
          </h2>
        </div>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {problems.map((p, i) => (
            <div key={i} className="card anim">
              <div style={{ fontSize: 40, marginBottom: 16 }}>{p.emoji}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 12, lineHeight: 1.35 }}>{p.title}</h3>
              <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>{p.pain}</p>
              <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, borderLeft: '3px solid #00523C' }}>
                <p style={{ fontSize: 13, color: '#065f46', fontWeight: 500, lineHeight: 1.5 }}>{p.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── What is Áion ──────────────────────────────────────────────────────────────
function AboutSection() {
  const stats = [
    { value: 'R$0', label: 'perdidos em leads não acompanhados com processo correto' },
    { value: '40%', label: 'de queda de novatos detectada em 1 ciclo no primeiro cliente' },
    { value: '3 min', label: 'para gerar um plano de campanha completo com IA' },
    { value: '956', label: 'alunos gerenciados no Colégio Ágape, primeiro cliente' },
  ]
  return (
    <section className="section-alt" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', marginBottom: 56 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#00523C', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 100, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            A plataforma
          </span>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#111827', marginBottom: 20, letterSpacing: '-0.5px' }}>
            Uma plataforma feita para a realidade das escolas brasileiras
          </h2>
          <p style={{ fontSize: 16, color: '#6b7280', lineHeight: 1.7 }}>
            A Áion Edu combina CRM educacional, inteligência artificial e dados do INEP para ajudar
            escolas privadas a planejar, executar e acompanhar a campanha de matrículas — do primeiro
            lead ao aluno matriculado.
          </p>
        </div>

        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {stats.map((s, i) => (
            <div key={i} className="anim" style={{
              textAlign: 'center', padding: '28px 20px',
              background: '#fff', borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              border: '1px solid #f0f0f0',
            }}>
              <div style={{ fontSize: 'clamp(28px, 3vw, 40px)', fontWeight: 800, color: '#00523C', marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      emoji: '🎯',
      title: 'CRM com Kanban visual',
      desc: 'Acompanhe cada lead do primeiro contato até a matrícula. Visualize o funil em tempo real e nunca perca um follow-up.',
    },
    {
      emoji: '📱',
      title: 'WhatsApp integrado nativamente',
      desc: 'Atenda leads diretamente pelo sistema, crie fluxos automáticos e envie campanhas pelo número oficial da escola.',
    },
    {
      emoji: '🤖',
      title: 'IA para tomada de decisão',
      desc: 'Gere planos de campanha, analise transferências e receba insights semanais baseados nos dados reais da sua escola.',
    },
    {
      emoji: '📊',
      title: 'Relatórios e inteligência',
      desc: 'Funil, rematrícula, marketing e retenção em painéis visuais com comparativos históricos e benchmark do setor.',
    },
    {
      emoji: '🔄',
      title: 'Pesquisa de satisfação',
      desc: 'Entenda por que famílias saem e o que as mantém. A IA cruza pesquisas com dados de rematrícula automaticamente.',
    },
    {
      emoji: '🏆',
      title: 'Benchmark com dados do INEP',
      desc: 'Saiba onde sua escola está no mercado local. Market share, ranking estimado e oportunidades de crescimento.',
    },
  ]

  return (
    <section id="funcionalidades" style={{ padding: '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#00523C', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 100, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            Funcionalidades
          </span>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            Tudo que sua campanha precisa
          </h2>
        </div>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {features.map((f, i) => (
            <div key={i} className="card anim" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: '#f0fdf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26,
              }}>{f.emoji}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ──────────────────────────────────────────────────────────────
function HowItWorksSection() {
  const steps = [
    {
      num: '1',
      title: 'Cadastre sua escola',
      subtitle: '(5 minutos)',
      desc: 'Importe os relatórios do seu ERP (SIGA, Totvs ou similar). A IA lê o histórico e entende o padrão da sua escola automaticamente.',
    },
    {
      num: '2',
      title: 'Gere seu plano de campanha',
      subtitle: '',
      desc: 'Com base no histórico + mercado local, a IA cria metas mês a mês, CPA sugerido e calendário de captação personalizado.',
    },
    {
      num: '3',
      title: 'Acompanhe e converta em tempo real',
      subtitle: '',
      desc: 'Dashboard com desvios visuais, alertas automáticos e recálculo de rota quando necessário. Nunca mais fique no escuro.',
    },
  ]

  return (
    <section id="como-funciona" className="section-alt" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#00523C', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 100, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            Como funciona
          </span>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            Simples de começar, poderoso na prática
          </h2>
        </div>

        <div className="steps-grid" style={{ display: 'flex', gap: 32, alignItems: 'flex-start', position: 'relative' }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div className="anim" style={{ flex: 1, textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #00523C, #00A896)',
                  color: '#fff', fontSize: 24, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 4px 16px rgba(0,82,60,0.3)',
                }}>{s.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  {s.title}
                </h3>
                {s.subtitle && <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>{s.subtitle}</p>}
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.65, maxWidth: 280, margin: '8px auto 0' }}>{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="hide-mobile" style={{ flexShrink: 0, marginTop: 30, color: '#d1d5db' }}>
                  <svg width="32" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h22M19 5l8 7-8 7"/></svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonial ───────────────────────────────────────────────────────────────
function TestimonialSection() {
  return (
    <section style={{ padding: '80px 24px', background: '#fff' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div className="anim" style={{
          background: 'linear-gradient(135deg, #00523C 0%, #00A896 100%)',
          borderRadius: 24,
          padding: '48px 48px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -30, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

          <div style={{ fontSize: 56, color: 'rgba(255,255,255,0.2)', lineHeight: 1, marginBottom: 8, fontFamily: 'Georgia, serif' }}>"</div>

          <blockquote style={{ fontSize: 'clamp(17px, 2vw, 21px)', color: '#fff', fontWeight: 500, lineHeight: 1.6, marginBottom: 32, fontStyle: 'italic', position: 'relative' }}>
            A Áion Edu identificou que nossa captação de novatos caiu 40% em um ano. Com o plano gerado
            pela IA, chegamos preparados para a campanha de 2027 pela primeira vez.
          </blockquote>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              🏫
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Colégio Ágape Patos</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Patos, Paraíba · 956 alunos · primeiro cliente Áion Edu · desde 2026</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ───────────────────────────────────────────────────────────────────
function PricingSection() {
  const items = [
    'CRM completo com Kanban',
    'WhatsApp integrado',
    'Gerador de campanha com IA',
    'Relatórios e inteligência',
    'Benchmark INEP',
    'Pesquisas de satisfação ilimitadas',
    'Módulo de transferências',
    'Suporte em português',
    'Consultor dedicado',
  ]

  return (
    <section id="precos" className="section-alt" style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <span style={{ display: 'inline-block', background: '#f0fdf4', color: '#00523C', fontSize: 13, fontWeight: 600, padding: '4px 14px', borderRadius: 100, marginBottom: 16, border: '1px solid #bbf7d0' }}>
            Preços
          </span>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.5px' }}>
            Simples e sem surpresas
          </h2>
        </div>

        <div className="anim" style={{
          background: '#fff',
          borderRadius: 24,
          padding: '40px 40px',
          boxShadow: '0 8px 40px rgba(0,82,60,0.12)',
          border: '2px solid #00523C',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Badge */}
          <div style={{
            position: 'absolute', top: 20, right: -28,
            background: 'linear-gradient(90deg, #00523C, #00A896)',
            color: '#fff', fontSize: 12, fontWeight: 700, padding: '6px 36px',
            transform: 'rotate(45deg)',
            letterSpacing: '0.5px',
          }}>POPULAR</div>

          <div style={{ marginBottom: 8 }}>
            <span style={{ background: '#f0fdf4', color: '#00523C', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 100, border: '1px solid #bbf7d0' }}>
              Plano Escola — tudo incluído
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 20, marginBottom: 8 }}>
            <span style={{ fontSize: 18, color: '#6b7280', fontWeight: 500 }}>R$</span>
            <span style={{ fontSize: 56, fontWeight: 800, color: '#00523C', letterSpacing: '-2px', lineHeight: 1 }}>550</span>
            <span style={{ fontSize: 16, color: '#6b7280' }}>/mês por escola</span>
          </div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 28 }}>Sem limite de usuários · Sem taxa de implantação</p>

          <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 24, marginBottom: 28 }}>
            {items.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="11" height="11" fill="none" stroke="#00523C" strokeWidth="2.5"><polyline points="1 5 4 8 10 2"/></svg>
                </div>
                <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{item}</span>
              </div>
            ))}
          </div>

          <a href="#demo" className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px' }}>
            Quero começar →
          </a>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 14 }}>
            Primeiro mês grátis · Sem fidelidade · Cancele quando quiser
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Demo Form ─────────────────────────────────────────────────────────────────
function DemoSection() {
  const [form, setForm] = useState({ name: '', email: '', school: '', city: '', phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      await supabase.from('demo_requests').insert({
        name: form.name,
        email: form.email,
        school_name: form.school,
        city: form.city,
        phone: form.phone,
      })

      const msg = encodeURIComponent(
        `Olá! Quero uma demonstração da Áion Edu.\n\nNome: ${form.name}\nEscola: ${form.school}\nCidade: ${form.city}\nE-mail: ${form.email}`
      )
      window.open(`https://wa.me/5583985556393?text=${msg}`, '_blank')
      setSubmitted(true)
    } catch {
      setError('Erro ao enviar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="demo" style={{ padding: '80px 24px', background: 'linear-gradient(135deg, #00523C 0%, #00A896 100%)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 800, color: '#fff', marginBottom: 16, letterSpacing: '-0.5px' }}>
            Comece antes da campanha de agosto
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
            Escolas que planejam com antecedência matriculam significativamente mais novatos.
          </p>
        </div>

        {submitted ? (
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '48px 40px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Obrigado!</h3>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, lineHeight: 1.6 }}>
              Redirecionando para o WhatsApp... Em breve nossa equipe entrará em contato.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{
            background: 'rgba(255,255,255,0.97)',
            borderRadius: 20,
            padding: '40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Nome completo *
                </label>
                <input className="form-input" type="text" required
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Seu nome completo" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  E-mail *
                </label>
                <input className="form-input" type="email" required
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="seu@email.com.br" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Telefone/WhatsApp *
                </label>
                <input className="form-input" type="tel" required
                  value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(XX) 9XXXX-XXXX" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Nome da escola *
                </label>
                <input className="form-input" type="text" required
                  value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))}
                  placeholder="Nome da sua escola" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                  Cidade/Estado *
                </label>
                <input className="form-input" type="text" required
                  value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Ex: Patos - PB" />
              </div>
            </div>

            {error && (
              <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 14 }}>{error}</p>
            )}

            <button type="submit" className="btn-primary" disabled={submitting}
              style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '14px', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Enviando...' : 'Quero minha demonstração gratuita →'}
            </button>

            <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 14 }}>
              Sem compromisso · Demonstração em 30 minutos · Suporte em português
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer id="contato" style={{ background: '#0a1628', color: '#e5e7eb', padding: '64px 24px 32px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Top */}
        <div className="footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48, paddingBottom: 48, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Brand */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: '#fff', letterSpacing: '-0.5px' }}>Áion Edu</div>
              <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Inteligência em matrículas</div>
            </div>
            <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.6, maxWidth: 280, marginBottom: 20 }}>
              Plataforma de gestão de matrículas para escolas privadas brasileiras. CRM, IA e WhatsApp em um só lugar.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              {/* WhatsApp */}
              <a href="https://wa.me/5583985556393" target="_blank" rel="noopener noreferrer"
                style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', textDecoration: 'none', transition: 'background 0.2s' }}>
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.5 2C6.253 2 2 6.253 2 11.5c0 1.938.577 3.74 1.568 5.248L2 22l5.379-1.517A9.454 9.454 0 0011.5 21C16.747 21 21 16.747 21 11.5S16.747 2 11.5 2zm0 17.143a7.618 7.618 0 01-3.896-1.071l-.279-.166-2.893.816.824-2.821-.182-.289A7.609 7.609 0 013.857 11.5C3.857 7.274 7.274 3.857 11.5 3.857c4.226 0 7.643 3.417 7.643 7.643 0 4.226-3.417 7.643-7.643 7.643z" fillRule="evenodd"/></svg>
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Produto</h4>
            {[
              { label: 'Funcionalidades', href: '#funcionalidades' },
              { label: 'Como funciona', href: '#como-funciona' },
              { label: 'Preços', href: '#precos' },
              { label: 'Blog', href: '#' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ display: 'block', color: '#9ca3af', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                {l.label}
              </a>
            ))}
          </div>

          {/* Company */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Empresa</h4>
            {[
              { label: 'Sobre nós', href: '#' },
              { label: 'Parceiros', href: '#' },
              { label: 'Contato', href: '#contato' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ display: 'block', color: '#9ca3af', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                {l.label}
              </a>
            ))}
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 16 }}>Legal</h4>
            {[
              { label: 'Política de Privacidade', href: '/privacidade' },
              { label: 'Termos de Uso', href: '/termos' },
              { label: 'LGPD', href: '/privacidade#lgpd' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ display: 'block', color: '#9ca3af', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>
                {l.label}
              </a>
            ))}
          </div>
        </div>

        {/* Company info */}
        <div style={{ marginBottom: 24, padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: 12 }}>
          <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.8 }}>
            <strong style={{ color: '#9ca3af' }}>AION SOLUCOES TECNOLOGICAS LTDA</strong> · CNPJ: 65.835.064/0001-58<br />
            R. Francisco Vicente de Araújo, 48 · Bela Vista · Patos - PB · CEP 58.704-560<br />
            (83) 9855-6393 · contato@aionedu.com.br
          </p>
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            © 2026 Áion Edu. Todos os direitos reservados.
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Política de Privacidade', href: '/privacidade' },
              { label: 'Termos de Uso', href: '/termos' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9ca3af')}
                onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Landing Page ─────────────────────────────────────────────────────────
export default function Landing() {
  useScrollAnimations()

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
      <Header />
      <main style={{ paddingTop: 0 }}>
        <Hero />
        <PainSection />
        <AboutSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialSection />
        <PricingSection />
        <DemoSection />
      </main>
      <Footer />
    </>
  )
}
