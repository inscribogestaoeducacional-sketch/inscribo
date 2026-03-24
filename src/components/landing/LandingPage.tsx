import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, CheckCircle, ChevronDown, Menu, X, Star,
  BarChart3, Upload, Zap
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

// ─── Animações globais (injetadas uma vez) ─────────────────────────────────────
const GLOBAL_CSS = `
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to   { opacity: 1; transform: translateY(0);     }
}
@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to   { opacity: 1; transform: translateY(0);      }
}
.anim-in { opacity: 0; }
.anim-in.visible {
  animation: fadeInUp 0.6s ease forwards;
}
.anim-in.visible:nth-child(1) { animation-delay: 0.05s; }
.anim-in.visible:nth-child(2) { animation-delay: 0.15s; }
.anim-in.visible:nth-child(3) { animation-delay: 0.25s; }
.anim-in.visible:nth-child(4) { animation-delay: 0.35s; }
.anim-in.visible:nth-child(5) { animation-delay: 0.45s; }
.anim-in.visible:nth-child(6) { animation-delay: 0.55s; }
`

function useScrollAnimations() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      }),
      { threshold: 0.1 }
    )
    document.querySelectorAll('.anim-in').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])
}

// ─── Logo ──────────────────────────────────────────────────────────────────────
function LogoMark({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: dark ? '#00523C' : 'rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: dark ? '#00A896' : 'white', border: '2px solid rgba(255,255,255,0.5)' }} />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 800, color: dark ? '#00523C' : 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Áion Edu</div>
        <div style={{ fontSize: 9, color: dark ? '#64748b' : 'rgba(255,255,255,0.7)', lineHeight: 1 }}>Inteligência em matrículas</div>
      </div>
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Funcionalidades', href: '#funcionalidades' },
    { label: 'Como funciona',   href: '#como-funciona'   },
    { label: 'Preços',          href: '#precos'           },
    { label: 'Depoimentos',     href: '#depoimentos'      },
  ]

  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, transition: 'all 0.3s', background: scrolled ? 'white' : 'transparent', boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.1)' : 'none' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <LogoMark dark={scrolled} />

          <div className="hidden md:flex items-center gap-8">
            {links.map(l => (
              <a key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 500, color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {l.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: `1.5px solid ${scrolled ? '#00523C' : 'rgba(255,255,255,0.6)'}`, color: scrolled ? '#00523C' : 'white', textDecoration: 'none', transition: 'all 0.2s' }}>
              Entrar
            </Link>
            <a href="#demo" style={{ padding: '8px 16px', fontSize: 14, fontWeight: 600, borderRadius: 8, background: '#00A896', color: 'white', textDecoration: 'none', boxShadow: '0 2px 8px rgba(0,168,150,0.4)' }}>
              Demonstração gratuita
            </a>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {mobileOpen ? <X color={scrolled ? '#374151' : 'white'} /> : <Menu color={scrolled ? '#374151' : 'white'} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div style={{ background: 'white', borderTop: '1px solid #f1f5f9', padding: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)} style={{ display: 'block', padding: '10px 0', fontSize: 14, fontWeight: 500, color: '#374151', textDecoration: 'none' }}>
              {l.label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Link to="/login" style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 14, fontWeight: 600, borderRadius: 8, border: '1.5px solid #00523C', color: '#00523C', textDecoration: 'none' }}>
              Entrar
            </Link>
            <a href="#demo" style={{ flex: 1, textAlign: 'center', padding: '10px', fontSize: 14, fontWeight: 600, borderRadius: 8, background: '#00A896', color: 'white', textDecoration: 'none' }}>
              Demonstração
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: 'linear-gradient(135deg, #00523C 0%, #007A5A 55%, #00A896 100%)', position: 'relative', overflow: 'hidden', paddingTop: 64 }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 500, height: 500, background: '#00FFCC', opacity: 0.08, borderRadius: '50%', filter: 'blur(80px)', transform: 'translate(30%, -30%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: 400, height: 400, background: 'white', opacity: 0.05, borderRadius: '50%', filter: 'blur(80px)', transform: 'translate(-30%, 30%)' }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center" style={{ position: 'relative', width: '100%' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)', padding: '8px 18px', borderRadius: 999, fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 32, animation: 'fadeInDown 0.6s ease both' }}>
          <span style={{ width: 8, height: 8, background: '#A7F3D0', borderRadius: '50%', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Usado por escolas privadas no Brasil · Dados reais do INEP e Censo Escolar
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.75rem)', fontWeight: 800, color: 'white', lineHeight: 1.15, marginBottom: 24, animation: 'fadeInUp 0.7s ease 0.1s both', opacity: 0 }}>
          Sua escola pronta para{' '}
          <span style={{ color: '#A7F3D0' }}>matricular mais</span>{' '}
          em 2027
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255,255,255,0.82)', maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.7, animation: 'fadeInUp 0.7s ease 0.2s both', opacity: 0 }}>
          A Áion Edu analisa o histórico da sua escola, estuda o mercado local e gera um plano de campanha personalizado com IA — para você chegar em agosto já preparado.
        </p>

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24, animation: 'fadeInUp 0.7s ease 0.3s both', opacity: 0 }}>
          <a href="#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', background: 'white', color: '#00523C', fontWeight: 700, borderRadius: 14, fontSize: 16, textDecoration: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', transition: 'transform 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
            Quero uma demonstração gratuita
            <ArrowRight size={18} />
          </a>
          <a href="#como-funciona" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '16px 32px', border: '2px solid rgba(255,255,255,0.4)', color: 'white', fontWeight: 600, borderRadius: 14, fontSize: 16, textDecoration: 'none', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            Ver como funciona →
          </a>
        </div>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', animation: 'fadeInUp 0.7s ease 0.4s both', opacity: 0 }}>
          Sem compromisso · Demonstração em 30 minutos · Suporte em português
        </p>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </section>
  )
}

// ─── Números de impacto ────────────────────────────────────────────────────────
function Impacto() {
  const metrics = [
    { value: '956',    label: 'alunos gerenciados no primeiro cliente'       },
    { value: '−40%',   label: 'de queda de novatos detectada em 1 ciclo'    },
    { value: '3 min',  label: '4 anos de histórico analisados pela IA'      },
    { value: 'Patos/PB', label: 'primeira escola atendida em 2026'          },
  ]

  return (
    <section style={{ padding: '60px 0', background: '#00523C' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32 }}>
          {metrics.map((m, i) => (
            <div key={i} className="anim-in" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', fontWeight: 800, color: '#A7F3D0', marginBottom: 6 }}>{m.value}</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Como funciona ────────────────────────────────────────────────────────────
function ComoFunciona() {
  const steps = [
    {
      icon: <Upload size={32} color="#00A896" />,
      title: 'Importe seu histórico',
      desc: 'Suba os relatórios do seu ERP (SIGA, Totvs, etc.). A IA lê e entende o padrão da sua escola em segundos.'
    },
    {
      icon: <Zap size={32} color="#00A896" />,
      title: 'Gere seu plano de campanha',
      desc: 'Com base no histórico + mercado local, a IA cria metas mês a mês, CPA sugerido e calendário de captação.'
    },
    {
      icon: <BarChart3 size={32} color="#00A896" />,
      title: 'Acompanhe e ajuste em tempo real',
      desc: 'Dashboard com desvios visuais, alertas automáticos e recálculo de rota quando necessário.'
    },
  ]

  return (
    <section id="como-funciona" style={{ padding: '96px 0', background: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Simples de usar</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>Como funciona</h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.7 }}>Em três passos, sua escola sai do improviso para um plano estruturado com IA.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 32 }}>
          {steps.map((s, i) => (
            <div key={i} className="anim-in" style={{ background: 'white', borderRadius: 20, padding: 32, border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', textAlign: 'center', position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 72, height: 72, borderRadius: 18, background: '#f0fdf4', border: '2px solid #bbf7d0', marginBottom: 20, position: 'relative' }}>
                {s.icon}
                <span style={{ position: 'absolute', top: -10, right: -10, width: 28, height: 28, background: '#00523C', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>{i + 1}</span>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Funcionalidades ──────────────────────────────────────────────────────────
function Funcionalidades() {
  const features = [
    { emoji: '🎯', bg: '#f0fdf4', title: 'Gerador de campanha com IA',    desc: 'Plano completo com metas mensais, investimento e CPA baseado no seu histórico real.' },
    { emoji: '📊', bg: '#eff6ff', title: 'Relatórios cirúrgicos',          desc: 'Funil, rematrícula, marketing e retenção — tudo em um painel com comparativos históricos.' },
    { emoji: '🏆', bg: '#fefce8', title: 'Benchmark de mercado',           desc: 'Compare sua escola com o setor usando dados reais do INEP e Censo Escolar.' },
    { emoji: '🔄', bg: '#fff1f2', title: 'Radar de retenção',              desc: 'Cruza pesquisas de satisfação, transferências e rematrícula para identificar risco de evasão.' },
    { emoji: '📱', bg: '#f0fdf4', title: 'WhatsApp integrado',             desc: 'Automações, bot de atendimento e disparo de campanhas direto pelo número da escola.' },
    { emoji: '📋', bg: '#faf5ff', title: 'Pesquisa de satisfação',         desc: 'Envie links para as famílias, colete respostas e receba análise da IA com ações prioritárias.' },
  ]

  return (
    <section id="funcionalidades" style={{ padding: '96px 0', background: 'white' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Tudo que sua escola precisa</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>Funcionalidades principais</h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 520, margin: '12px auto 0', lineHeight: 1.7 }}>Da importação do ERP até o encerramento do ciclo.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {features.map((f, i) => (
            <div key={i} className="anim-in" style={{ padding: 24, borderRadius: 16, border: '1px solid #f1f5f9', transition: 'box-shadow 0.2s, border-color 0.2s', cursor: 'default' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(0,82,60,0.1)'; (e.currentTarget as HTMLElement).style.borderColor = '#bbf7d0' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; (e.currentTarget as HTMLElement).style.borderColor = '#f1f5f9' }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14 }}>
                {f.emoji}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Diferenciais ─────────────────────────────────────────────────────────────
function Diferenciais() {
  const items = [
    { title: 'Não é só um CRM — é inteligência de matrículas',  desc: 'A maioria dos sistemas apenas registra leads. A Áion Edu estuda seus dados e diz o que fazer.' },
    { title: 'Dados do INEP integrados',                         desc: 'Sabemos quantas escolas concorrem com você, qual é o market share e onde está a oportunidade.' },
    { title: 'Calendário de captação personalizado',             desc: 'Baseado nos picos históricos da sua escola — não em uma planilha genérica.' },
    { title: 'IA que aprende com cada ciclo',                    desc: 'A cada ano, o plano fica mais preciso porque a IA usa seu histórico real, não estimativas.' },
    { title: 'Tudo em português, para a realidade brasileira',   desc: 'Calendário escolar brasileiro, ERPs nacionais, INEP, Censo Escolar — feito para o seu contexto.' },
  ]

  return (
    <section style={{ padding: '96px 0', background: 'linear-gradient(135deg, #00523C 0%, #007A5A 100%)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#A7F3D0', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Por que escolher a Áion Edu</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: 'white', marginTop: 8 }}>Por que somos diferentes?</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {items.map((item, i) => (
            <div key={i} className="anim-in" style={{ display: 'flex', gap: 14, padding: 24, borderRadius: 16, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
              <CheckCircle size={20} color="#A7F3D0" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'white', marginBottom: 4 }}>{item.title}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Depoimentos ──────────────────────────────────────────────────────────────
function Depoimentos() {
  const testimonials = [
    {
      avatar: 'CA',
      avatarBg: '#00523C',
      name: 'Colégio Ágape Patos',
      location: 'Patos, Paraíba · 956 alunos · primeiro cliente Áion Edu',
      text: 'A IA identificou que nossa captação de novatos caiu 40% em um ano. Com o plano gerado, chegamos preparados para a campanha de 2027.',
      highlight: true,
    },
    {
      avatar: 'GE',
      avatarBg: '#007A5A',
      name: 'Gestor Escolar',
      location: 'Escola Particular, interior do NE',
      text: 'Antes chegávamos em agosto sem saber quantos alunos íamos perder. Agora temos um plano com metas por semana desde julho.',
      highlight: false,
    },
    {
      avatar: 'CA',
      avatarBg: '#00A896',
      name: 'Coordenador Administrativo',
      location: 'Escola Cristã, Nordeste do Brasil',
      text: 'Em 3 minutos o sistema gerou um plano completo com investimento mês a mês. A agilidade é inacreditável.',
      highlight: false,
    },
  ]

  return (
    <section id="depoimentos" style={{ padding: '96px 0', background: '#f8fafc' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Resultados reais</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>O que dizem os gestores</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {testimonials.map((t, i) => (
            <div key={i} className="anim-in" style={{ background: 'white', borderRadius: 20, padding: 28, border: t.highlight ? '2px solid #00A896' : '1px solid #e2e8f0', boxShadow: t.highlight ? '0 8px 32px rgba(0,168,150,0.12)' : '0 2px 8px rgba(0,0,0,0.04)', position: 'relative' }}>
              {t.highlight && (
                <div style={{ position: 'absolute', top: -12, left: 24, background: '#00A896', color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 12px', borderRadius: 999 }}>
                  Primeiro cliente
                </div>
              )}
              <div style={{ display: 'flex', gap: 2, marginBottom: 16 }}>
                {Array.from({ length: 5 }).map((_, j) => <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />)}
              </div>
              <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: t.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {t.avatar}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{t.name}</p>
                  <p style={{ fontSize: 11, color: '#94a3b8' }}>{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Preços ───────────────────────────────────────────────────────────────────
function Precos() {
  const features = [
    'Gerador de campanha com IA',
    'Relatórios e inteligência completos',
    'CRM de leads e visitas',
    'Módulo de transferências com diagnóstico IA',
    'Pesquisas de satisfação ilimitadas',
    'Benchmark com dados do INEP',
    'WhatsApp integrado',
    'Suporte em português',
    'Consultor dedicado',
  ]

  return (
    <section id="precos" style={{ padding: '96px 0', background: 'white' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Preço</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>Um plano. Tudo incluído.</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginTop: 8 }}>Sem surpresas. Sem taxas extras.</p>
        </div>

        <div style={{ maxWidth: 440, margin: '0 auto' }}>
          <div className="anim-in" style={{ background: 'white', borderRadius: 24, boxShadow: '0 8px 40px rgba(0,168,150,0.15)', padding: 40, border: '2px solid #00A896' }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#00A896', background: '#f0fdf4', padding: '4px 14px', borderRadius: 999 }}>Plano Escola</span>
              <div style={{ marginTop: 20 }}>
                <span style={{ fontSize: 48, fontWeight: 800, color: '#0f172a' }}>R$ 550</span>
                <span style={{ fontSize: 16, color: '#94a3b8' }}>/mês</span>
              </div>
              <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>por escola · sem limite de usuários</p>
            </div>

            <ul style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {features.map(f => (
                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={16} color="#00A896" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: '#374151' }}>{f}</span>
                </li>
              ))}
            </ul>

            <a href="#demo" style={{ display: 'block', textAlign: 'center', marginTop: 32, padding: '14px', background: 'linear-gradient(135deg, #00523C, #007A5A)', color: 'white', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Quero começar agora →
            </a>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 12 }}>
              Primeiro mês grátis · Cancele quando quiser
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── CTA Demo ─────────────────────────────────────────────────────────────────
const WA_NUMBER = '5583999999999' // Substituir pelo número real da Áion Edu

function CTADemo() {
  const [form, setForm] = useState({ name: '', email: '', school: '', city: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      // Salva lead no Supabase
      await supabase.from('demo_requests').insert({
        name:        form.name,
        email:       form.email,
        school_name: form.school,
        city:        form.city.split('/')[0]?.trim() || form.city,
        state:       form.city.split('/')[1]?.trim() || '',
      })

      // Abre WhatsApp em seguida
      const msg = encodeURIComponent(
        `Olá! Tenho interesse em uma demonstração da Áion Edu.\n\n` +
        `Nome: ${form.name}\n` +
        `Escola: ${form.school}\n` +
        `Cidade: ${form.city}\n` +
        `E-mail: ${form.email}`
      )
      window.open(`https://wa.me/${WA_NUMBER}?text=${msg}`, '_blank')
      setSent(true)
    } catch {
      setError('Erro ao enviar. Escreva para contato@aionedu.com.br ou acesse o WhatsApp diretamente.')
    } finally {
      setSending(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10,
    border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a',
    outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
  }

  return (
    <section id="demo" style={{ padding: '96px 0', background: '#f8fafc' }}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Demonstração gratuita</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>Comece antes da campanha de agosto</h2>
          <p style={{ fontSize: 16, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>
            Escolas que planejam com antecedência matriculam até 40% mais novatos.
          </p>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '48px 32px', borderRadius: 20, border: '2px solid #00A896', background: '#f0fdf4' }}>
            <CheckCircle size={52} color="#00523C" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Abrimos o WhatsApp para você!</h3>
            <p style={{ fontSize: 14, color: '#64748b' }}>Também registramos seu contato. Nossa equipe entrará em contato em breve.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: 20, padding: 40, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input required placeholder="Nome completo" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00A896')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            <input required type="email" placeholder="E-mail profissional" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00A896')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            <input required placeholder="Nome da escola" value={form.school} onChange={e => setForm(f => ({ ...f, school: e.target.value }))} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00A896')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />
            <input required placeholder="Cidade / Estado (ex: Patos / PB)" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} style={inputStyle}
              onFocus={e => (e.target.style.borderColor = '#00A896')} onBlur={e => (e.target.style.borderColor = '#e2e8f0')} />

            {error && <p style={{ fontSize: 13, color: '#dc2626' }}>{error}</p>}

            <button type="submit" disabled={sending} style={{ padding: '14px', background: 'linear-gradient(135deg, #00523C, #007A5A)', color: 'white', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity 0.2s' }}>
              {sending ? 'Enviando...' : <><span>Quero minha demonstração gratuita</span><ArrowRight size={18} /></>}
            </button>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>
              Sem compromisso · Demonstração em 30 minutos · Suporte em português
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── FAQ ───────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  const items = [
    { q: 'Preciso ter conhecimento técnico?',             a: 'Não. A interface foi desenvolvida para gestores e secretarias. O onboarding com IA leva menos de 30 minutos.' },
    { q: 'Como a IA gera o plano de campanha?',           a: 'Você importa o histórico do seu ERP, informa a meta de novatos e a IA analisa os padrões históricos + dados do INEP para gerar metas mensais, CPA sugerido e calendário.' },
    { q: 'Quais ERPs são compatíveis?',                   a: 'SIGA, Totvs, Escola Web e qualquer sistema que exporte em Excel/CSV. Nossa IA lê e identifica as colunas automaticamente.' },
    { q: 'Como funciona a integração com WhatsApp?',      a: 'Conectamos ao WhatsApp Business via Evolution API. Você centraliza as conversas e configura automações de follow-up e campanhas.' },
    { q: 'Os dados do INEP são atualizados?',             a: 'Usamos os microdados mais recentes do Censo Escolar (INEP), atualizados anualmente.' },
    { q: 'Posso cancelar quando quiser?',                 a: 'Sim. Sem burocracia, sem multa, sem necessidade de ligar para ninguém.' },
  ]

  return (
    <section style={{ padding: '96px 0', background: 'white' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#00A896', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dúvidas</span>
          <h2 style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginTop: 8 }}>Perguntas frequentes</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
              <button onClick={() => setOpen(open === i ? null : i)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{item.q}</span>
                <ChevronDown size={18} color="#94a3b8" style={{ flexShrink: 0, transform: open === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {open === i && (
                <div style={{ padding: '0 24px 18px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { title: 'Produto',  links: [{ label: 'Funcionalidades', href: '#funcionalidades' }, { label: 'Como funciona', href: '#como-funciona' }, { label: 'Preços', href: '#precos' }, { label: 'Blog', href: '#' }] },
    { title: 'Empresa',  links: [{ label: 'Sobre nós', href: '#' }, { label: 'Parceiros', href: '#' }, { label: 'Contato', href: 'mailto:contato@aionedu.com.br' }] },
    { title: 'Legal',    links: [{ label: 'Política de Privacidade', href: '#' }, { label: 'Termos de Uso', href: '#' }, { label: 'LGPD', href: '#' }] },
  ]

  return (
    <footer style={{ background: '#0A1A14', paddingTop: 64, paddingBottom: 32 }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 40, marginBottom: 48 }}>
          <div>
            <LogoMark />
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 16, lineHeight: 1.7, marginBottom: 12 }}>Inteligência que transforma histórico escolar em crescimento de matrículas.</p>
            <a href="mailto:contato@aionedu.com.br" style={{ display: 'block', fontSize: 13, color: '#64748b', textDecoration: 'none', marginBottom: 4 }}>contato@aionedu.com.br</a>
            <a href="https://www.aionedu.com.br" style={{ display: 'block', fontSize: 13, color: '#64748b', textDecoration: 'none' }}>www.aionedu.com.br</a>
          </div>

          {cols.map(col => (
            <div key={col.title}>
              <h4 style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>{col.title}</h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.links.map(l => (
                  <li key={l.label}>
                    <a href={l.href} style={{ fontSize: 13, color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'white')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #1a2e25', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 13, color: '#4b5563' }}>© 2026 Áion Edu. Todos os direitos reservados.</p>
          <p style={{ fontSize: 12, color: '#374151' }}>Feito com ♥ para gestores educacionais brasileiros</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Root ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useScrollAnimations()

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif', overflowX: 'hidden' }}>
        <Navbar />
        <Hero />
        <Impacto />
        <ComoFunciona />
        <Funcionalidades />
        <Diferenciais />
        <Depoimentos />
        <Precos />
        <CTADemo />
        <FAQ />
        <Footer />
      </div>
    </>
  )
}
