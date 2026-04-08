import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── Global CSS ────────────────────────────────────────────────────────────
const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; overflow-x: hidden; }

@keyframes fadeUp { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.03); } }
@keyframes barFill { from { width:0; } to { width:var(--w); } }

.anim { opacity:0; transform:translateY(24px); transition:opacity .65s ease, transform .65s ease; }
.anim.visible { opacity:1; transform:none; }
.anim-d1.visible { transition-delay:.08s; }
.anim-d2.visible { transition-delay:.16s; }
.anim-d3.visible { transition-delay:.24s; }
.anim-d4.visible { transition-delay:.32s; }
.anim-d5.visible { transition-delay:.40s; }
.anim-d6.visible { transition-delay:.48s; }
.anim-d7.visible { transition-delay:.56s; }
.anim-d8.visible { transition-delay:.64s; }

.nav-link { color:#374151; text-decoration:none; font-size:14px; font-weight:500; transition:color .2s; white-space:nowrap; }
.nav-link:hover { color:#00523C; }

.btn-primary {
  display:inline-flex; align-items:center; gap:8px;
  background:linear-gradient(135deg,#00523C,#00A896);
  color:#fff; border:none; border-radius:10px;
  padding:14px 28px; font-size:15px; font-weight:700;
  cursor:pointer; text-decoration:none;
  transition:transform .15s, box-shadow .15s;
  box-shadow:0 4px 16px rgba(0,82,60,.3);
}
.btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,82,60,.4); }

.btn-secondary {
  display:inline-flex; align-items:center; gap:8px;
  background:rgba(255,255,255,.15); color:#fff;
  border:1.5px solid rgba(255,255,255,.4); border-radius:10px;
  padding:13px 24px; font-size:14px; font-weight:600;
  cursor:pointer; text-decoration:none; transition:background .2s;
}
.btn-secondary:hover { background:rgba(255,255,255,.25); }

.module-card { background:#fff; border-radius:16px; padding:28px; border:1.5px solid #E5E7EB; transition:border-color .2s, box-shadow .2s; }
.module-card:hover { border-color:#00A896; box-shadow:0 8px 32px rgba(0,168,150,.1); }

.check-item { display:flex; align-items:flex-start; gap:10px; margin-bottom:10px; }
.check-icon { width:20px; height:20px; border-radius:50%; background:#D1FAE5; display:flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px; font-size:11px; color:#065F46; font-weight:800; }

.faq-item { border-bottom:1px solid #E5E7EB; }
.faq-btn { width:100%; text-align:left; background:none; border:none; padding:18px 0; font-size:15px; font-weight:600; color:#111827; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }

.input-field { width:100%; padding:11px 14px; border-radius:9px; border:1.5px solid #D1D5DB; font-size:14px; outline:none; transition:border-color .2s; background:#fff; }
.input-field:focus { border-color:#00A896; box-shadow:0 0 0 3px rgba(0,168,150,.1); }

@media (max-width:1024px) {
  .hero-inner { flex-direction:column !important; text-align:center; }
  .hero-ctas { justify-content:center !important; }
  .hero-mockup { display:none !important; }
  .modules-grid { grid-template-columns:1fr 1fr !important; }
  .numeros-grid { grid-template-columns:repeat(2,1fr) !important; }
  .footer-cols { grid-template-columns:1fr 1fr !important; }
}
@media (max-width:768px) {
  .nav-links { display:none !important; }
  .nav-mobile-btn { display:flex !important; }
  .hero-text h1 { font-size:32px !important; }
  .modules-grid { grid-template-columns:1fr !important; }
  .numeros-grid { grid-template-columns:1fr 1fr !important; }
  .dores-grid { grid-template-columns:1fr !important; }
  .steps-grid { grid-template-columns:1fr !important; }
  .wa-grid { flex-direction:column !important; }
  .footer-cols { grid-template-columns:1fr !important; }
  .preco-features { grid-template-columns:1fr !important; }
  .form-grid { grid-template-columns:1fr !important; }
}
`

// ─── Hook de animação por scroll ───────────────────────────────────────────
function useAnim() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() } }, { threshold: 0.08 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── Header fixo ──────────────────────────────────────────────────────────
function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])
  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.0)',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid #E5E7EB' : '1px solid transparent',
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'background .3s, border-color .3s, backdrop-filter .3s',
      }}>
        {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', border: '2px solid rgba(255,255,255,0.5)' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 17, color: scrolled ? '#00523C' : '#fff' }}>Áion Edu</span>
        </Link>
        {/* Links desktop */}
        <div className="nav-links" style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[['#modulos','Módulos'],['#whatsapp','WhatsApp'],['#relatorios','Relatórios'],['#precos','Preços'],['#demo','Demo']].map(([href, label]) => (
            <a key={href} href={href} className="nav-link" style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,.85)' }}>{label}</a>
          ))}
          <Link to="/blog" className="nav-link" style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,.85)' }}>Blog</Link>
        </div>
        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link to="/login" style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', color: scrolled ? '#374151' : '#fff', border: `1.5px solid ${scrolled ? '#E5E7EB' : 'rgba(255,255,255,.4)'}`, transition: 'all .2s' }}>
            Entrar
          </Link>
          <a href="#demo" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14, boxShadow: 'none' }}>
            Agendar Demo →
          </a>
          {/* Mobile hamburger */}
          <button className="nav-mobile-btn" onClick={() => setMobileOpen(!mobileOpen)} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 4, flexDirection: 'column', gap: 5 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 22, height: 2, background: scrolled ? '#374151' : '#fff', borderRadius: 2 }} />)}
          </button>
        </div>
      </nav>
      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, zIndex: 199, background: '#fff', borderBottom: '1px solid #E5E7EB', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['#modulos','Módulos'],['#whatsapp','WhatsApp'],['#relatorios','Relatórios'],['#precos','Preços'],['#demo','Demo']].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMobileOpen(false)} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>{label}</a>
          ))}
          <Link to="/login" onClick={() => setMobileOpen(false)} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500, padding: '8px 0' }}>Entrar</Link>
        </div>
      )}
    </>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 40%,#00A896 100%)', padding: '130px 32px 90px', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        <div className="hero-inner" style={{ display: 'flex', alignItems: 'center', gap: 64, width: '100%' }}>
          {/* Texto */}
          <div className="hero-text" style={{ flex: 1 }}>
            {/* Badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.15)', borderRadius: 999, padding: '6px 14px', marginBottom: 28, animation: 'fadeIn .8s ease both' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
              <span style={{ color: 'rgba(255,255,255,.9)', fontSize: 13, fontWeight: 600 }}>CRM + WhatsApp + IA para escolas privadas</span>
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 900, color: '#fff', lineHeight: 1.15, marginBottom: 24, animation: 'fadeUp .8s ease .1s both' }}>
              Sua escola vai matricular mais.<br />
              <span style={{ color: '#A7F3D0' }}>Com processo, dados e IA.</span>
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.85)', lineHeight: 1.7, marginBottom: 36, maxWidth: 560, animation: 'fadeUp .8s ease .2s both' }}>
              A Áion Edu é a plataforma completa para gestão de matrículas em escolas privadas. Do primeiro contato com a família até o aluno sentado na sala de aula.
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'fadeUp .8s ease .3s both' }}>
              <a href="#demo" className="btn-primary" style={{ fontSize: 16, padding: '15px 32px' }}>
                Quero uma demonstração gratuita →
              </a>
              <a href="#como-funciona" className="btn-secondary">
                Ver como funciona ↓
              </a>
            </div>
            {/* Prova social */}
            <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeUp .8s ease .4s both' }}>
              <div style={{ display: 'flex', gap: -4 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${160+i*20},60%,${40-i*5}%)`, border: '2px solid rgba(255,255,255,.4)', marginLeft: i > 0 ? -10 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                    {['A','C','D','E'][i]}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ color: '#FCD34D', fontSize: 13, letterSpacing: 1 }}>★★★★★</div>
                <p style={{ color: 'rgba(255,255,255,.8)', fontSize: 13, marginTop: 2 }}>
                  "Transformou nossa campanha de matrículas" — <strong style={{ color: '#fff' }}>Colégio Ágape, Patos/PB</strong>
                </p>
              </div>
            </div>
          </div>
          {/* Mockup animado */}
          <div className="hero-mockup" style={{ flex: '0 0 420px', animation: 'fadeIn 1s ease .5s both' }}>
            <div style={{ background: 'rgba(255,255,255,.1)', borderRadius: 20, padding: 20, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)' }}>
              {/* Fake dashboard */}
              <div style={{ background: 'rgba(255,255,255,.95)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Funil · Campanha 2027</span>
                  <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>Ao vivo</span>
                </div>
                {[
                  { label: 'Leads captados', val: 184, meta: 200, pct: 92, color: '#00A896' },
                  { label: 'Visitas realizadas', val: 67, meta: 80, pct: 84, color: '#6366F1' },
                  { label: 'Matrículas', val: 38, meta: 50, pct: 76, color: '#F59E0B' },
                ].map(row => (
                  <div key={row.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{row.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{row.val} <span style={{ color: '#9CA3AF', fontWeight: 400 }}>/ {row.meta}</span></span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 999, transition: 'width 1.5s ease' }} />
                    </div>
                  </div>
                ))}
                <div style={{ marginTop: 16, padding: '10px 12px', background: '#FEF3C7', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span style={{ fontSize: 12, color: '#92400E' }}>IA: ritmo 8% abaixo da meta em visitas. Acelere o agendamento.</span>
                </div>
              </div>
              {/* Kanban mini */}
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { label: 'Novos', n: 12, color: '#E0F2FE', dot: '#0284C7' },
                  { label: 'Contato', n: 8, color: '#EDE9FE', dot: '#7C3AED' },
                  { label: 'Visita', n: 5, color: '#FEF3C7', dot: '#D97706' },
                  { label: 'Matr.', n: 3, color: '#D1FAE5', dot: '#059669' },
                ].map(col => (
                  <div key={col.label} style={{ background: col.color, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.dot, margin: '0 auto 4px' }} />
                    <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>{col.n}</div>
                    <div style={{ fontSize: 10, color: '#6B7280' }}>{col.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FAIXA DE NÚMEROS ─────────────────────────────────────────────────────
function Numeros() {
  const ref = useAnim()
  const nums = [
    { val: '+40%', label: 'novatos em média', sub: 'crescimento de captação' },
    { val: '85%', label: 'rematrícula como meta', sub: 'retenção estruturada' },
    { val: '3 min', label: 'plano IA completo', sub: 'gerado automaticamente' },
    { val: '100%', label: 'brasileiro', sub: 'feito para sua realidade' },
  ]
  return (
    <section style={{ background: '#fff', padding: '0 32px', borderBottom: '1px solid #E5E7EB' }}>
      <div ref={ref} className="anim numeros-grid" style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderLeft: '1px solid #E5E7EB' }}>
        {nums.map((n, i) => (
          <div key={i} className={`anim-d${i + 1}`} style={{ padding: '32px 24px', borderRight: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#00523C', marginBottom: 4 }}>{n.val}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{n.label}</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{n.sub}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── PROBLEMA ─────────────────────────────────────────────────────────────
function Problema() {
  const ref = useAnim()
  const dores = [
    { icon: '😰', title: 'Leads somem sem acompanhamento', desc: 'Sem processo claro, famílias interessadas esfriam e vão para a concorrência. Você nem sabe quantas perdeu.' },
    { icon: '📋', title: 'Equipe trabalhando no improviso', desc: 'Cada atendente faz do seu jeito. Sem padrão, sem histórico, sem controle de quem fez o quê.' },
    { icon: '📊', title: 'Campanha começa no escuro todo ano', desc: 'Sem dados do ano anterior organizados, você repete os mesmos erros e não consegue bater a meta.' },
  ]
  return (
    <section style={{ padding: '88px 32px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} className="anim" style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 12 }}>
            Você ainda gerencia matrículas<br />no Excel e no WhatsApp pessoal?
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 520, margin: '0 auto' }}>
            Essa é a realidade de 9 em cada 10 escolas privadas brasileiras. E ela custa matrículas.
          </p>
        </div>
        <div className="dores-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, marginBottom: 48 }}>
          {dores.map((d, i) => (
            <div key={i} className={`anim anim-d${i+1}`} ref={useAnim()} style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1.5px solid #E5E7EB' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>{d.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{d.title}</h3>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>{d.desc}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <a href="#demo" className="btn-primary" style={{ fontSize: 16, padding: '15px 36px' }}>
            Quero resolver isso →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── O QUE É ──────────────────────────────────────────────────────────────
function OQueE() {
  const ref = useAnim()
  return (
    <section style={{ padding: '88px 32px', background: '#fff' }}>
      <div ref={ref} className="anim" style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: '#E6F7F5', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ color: '#00523C', fontSize: 13, fontWeight: 700 }}>Uma plataforma. Todos os processos.</span>
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 20, lineHeight: 1.3 }}>
          Uma plataforma. Todos os processos da matrícula.
        </h2>
        <p style={{ fontSize: 17, color: '#374151', lineHeight: 1.8, marginBottom: 32 }}>
          A Áion Edu integra CRM, WhatsApp, IA e relatórios em um único sistema feito para a realidade das escolas privadas brasileiras. Sua equipe trabalha unida, sua campanha tem direção e você toma decisões com dados reais.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {['CRM de Leads','WhatsApp Oficial','IA de Campanha','Relatórios','Rematrículas','Transferências'].map(tag => (
            <span key={tag} style={{ background: '#F0FDF9', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── MÓDULOS ──────────────────────────────────────────────────────────────
function Modulos() {
  const modules = [
    {
      icon: '🎯', title: 'CRM de Leads e Matrículas', id: 'crm',
      items: [
        'Kanban visual: Novo → Contato → Visita → Proposta → Matriculado',
        'Termômetro Frio / Morno / Quente para priorização',
        'Score automático — leads mais quentes sobem para o topo',
        'Motivo de perda estruturado com dashboard de causas',
        'Histórico completo de interações por lead',
      ],
      why: 'Você para de perder leads por falta de acompanhamento e entende exatamente por que está perdendo.'
    },
    {
      icon: '📱', title: 'WhatsApp Integrado', id: 'whatsapp',
      items: [
        'Toda a equipe atende pelo número oficial da escola',
        'Bot de atendimento automático fora do horário',
        'Fluxos personalizados pela escola',
        'Disparos de campanha para leads frios',
        'API Oficial do Meta — sem risco de bloqueio',
        'Lead que chega pelo WhatsApp entra no funil automaticamente',
      ],
      why: 'Sua equipe responde mais rápido e as famílias recebem atenção imediata — sem depender do celular pessoal de ninguém.'
    },
    {
      icon: '🤖', title: 'Gerador de Campanha com IA', id: 'ia',
      items: [
        'Plano completo em 3 minutos a partir do histórico do ERP',
        'Metas mensais + CPA sugerido + calendário de captação',
        'Slider de ambição: conservador, realista ou agressivo',
        'Benchmark com dados reais do INEP e Censo Escolar',
        'Recalcula automaticamente ao ajustar parâmetros',
      ],
      why: 'Você chega em agosto com um plano real, não uma planilha genérica. Sua equipe sabe o que fazer cada semana.'
    },
    {
      icon: '📊', title: 'Relatórios e Inteligência', id: 'relatorios',
      items: [
        'Funil em tempo real com desvios coloridos (verde, âmbar, vermelho)',
        'Velocidade semanal: ritmo atual vs meta necessária',
        'Índice de saúde da campanha: nota 0 a 100 pela IA',
        'Comparativo histórico mês a mês por ano',
        'ROI por canal de marketing: Google, Facebook, outdoor',
      ],
      why: 'Você para de adivinhar. Quando algo sai do planejado, o sistema avisa antes que seja tarde demais.'
    },
    {
      icon: '🔄', title: 'Módulo de Rematrículas', id: 'rematriculas',
      items: [
        'Projeção preditiva: quais alunos têm risco de não renovar',
        'Base elegível real: desconta formandos e transferências',
        'Radar de evasão com cruzamento de dados de satisfação',
        'Ações sugeridas pela IA para recuperação de alunos em risco',
      ],
      why: 'Reter um aluno custa menos do que captar um novo. Com a Áion Edu você age antes de perder.'
    },
    {
      icon: '↔', title: 'Transferências e Diagnóstico', id: 'transferencias',
      items: [
        'Link de pesquisa personalizado enviado por WhatsApp ou e-mail',
        'A família responde em 3 minutos',
        'IA analisa: motivo real + confiança + oportunidade de retenção',
        'Histórico de saídas por série, mês e motivo',
      ],
      why: 'Você deixa de perder alunos sem saber o motivo e começa a corrigir os problemas reais.'
    },
    {
      icon: '⭐', title: 'Pesquisa de Satisfação', id: 'pesquisas',
      items: [
        'Crie e envie pesquisas por WhatsApp ou e-mail',
        'IA analisa respostas e entrega relatório com ações prioritárias',
        'Cruza automaticamente com o radar de evasão',
        'Influencia a projeção de rematrícula',
      ],
      why: 'Você entende o que as famílias pensam enquanto ainda dá tempo de agir.'
    },
    {
      icon: '🔍', title: 'Auditoria e Controle', id: 'auditoria',
      items: [
        'Histórico completo de alterações por registro',
        'Rastreabilidade: quem criou, editou, o quê mudou e quando',
        'Perfis por função: gestor, atendente, consultor',
        'Visibilidade adequada para cada papel',
      ],
      why: 'Sua equipe trabalha com responsabilidade e você tem rastreabilidade total do processo.'
    },
  ]

  const ref = useAnim()
  return (
    <section id="modulos" style={{ padding: '88px 32px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} className="anim" style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{ display: 'inline-block', background: '#E6F7F5', borderRadius: 999, padding: '6px 16px', marginBottom: 16 }}>
            <span style={{ color: '#00523C', fontSize: 13, fontWeight: 700 }}>Módulos completos</span>
          </div>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 12 }}>
            Tudo que sua escola precisa para uma campanha de matrículas de sucesso
          </h2>
          <p style={{ fontSize: 16, color: '#6B7280', maxWidth: 580, margin: '0 auto' }}>
            Cada módulo foi construído a partir de problemas reais de escolas privadas brasileiras.
          </p>
        </div>
        <div className="modules-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {modules.map((m, i) => {
            const r = useAnim()
            return (
              <div key={m.id} id={m.id} ref={r} className={`module-card anim anim-d${(i % 3) + 1}`}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{m.icon}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 14 }}>{m.title}</h3>
                <div style={{ marginBottom: 16 }}>
                  {m.items.map((item, j) => (
                    <div key={j} className="check-item">
                      <div className="check-icon">✓</div>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#F0FDF9', borderRadius: 10, padding: '12px 14px', borderLeft: '3px solid #00A896' }}>
                  <p style={{ fontSize: 12, color: '#065F46', lineHeight: 1.6 }}><strong>Por que isso importa: </strong>{m.why}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <a href="#demo" className="btn-primary" style={{ fontSize: 16, padding: '15px 36px' }}>
            Ver tudo isso na prática →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── COMO FUNCIONA ────────────────────────────────────────────────────────
function ComoFunciona() {
  const ref = useAnim()
  const steps = [
    {
      num: '01', icon: '📂',
      title: 'Configure sua escola (5 minutos)',
      desc: 'Importe os relatórios do ERP (SIGA, Totvs, outros). A IA lê o histórico e entende o padrão da sua escola automaticamente. Sem planilha. Sem digitação manual.',
    },
    {
      num: '02', icon: '🧠',
      title: 'Gere seu plano de campanha',
      desc: 'A IA analisa histórico + mercado local e cria metas mensais, CPA sugerido e calendário de captação. Você revisa, ajusta e aplica com um clique.',
    },
    {
      num: '03', icon: '📈',
      title: 'Acompanhe e converta em tempo real',
      desc: 'Dashboard com desvios visuais, alertas automáticos e análise semanal da IA. Sua equipe sabe exatamente o que fazer a cada semana.',
    },
  ]
  return (
    <section id="como-funciona" style={{ padding: '88px 32px', background: '#fff' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div ref={ref} className="anim" style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 12 }}>Como funciona</h2>
          <p style={{ fontSize: 16, color: '#6B7280' }}>Do zero ao plano de campanha em menos de 10 minutos.</p>
        </div>
        <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
          {steps.map((s, i) => {
            const r = useAnim()
            return (
              <div key={i} ref={r} className={`anim anim-d${i+1}`} style={{ textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#00A896', letterSpacing: '0.1em', marginBottom: 8 }}>PASSO {s.num}</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>{s.desc}</p>
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
  const ref = useAnim()
  return (
    <section style={{ padding: '88px 32px', background: 'linear-gradient(135deg,#00523C,#00A896)' }}>
      <div ref={ref} className="anim" style={{ maxWidth: 820, margin: '0 auto' }}>
        <div style={{ background: 'rgba(255,255,255,.12)', borderRadius: 20, padding: '48px 48px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)', position: 'relative' }}>
          <div style={{ fontSize: 64, color: 'rgba(255,255,255,.2)', position: 'absolute', top: 20, left: 36, lineHeight: 1, fontFamily: 'Georgia, serif' }}>"</div>
          <div style={{ color: '#FCD34D', fontSize: 20, letterSpacing: 2, marginBottom: 20, textAlign: 'center' }}>★★★★★</div>
          <blockquote style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.6, textAlign: 'center', marginBottom: 28, fontStyle: 'italic' }}>
            "Pela primeira vez chegamos na campanha de matrículas com um plano real — metas por semana, calendário de captação e visibilidade total do funil. A plataforma identificou tendências que a gente não estava vendo."
          </blockquote>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 20, fontWeight: 800, color: '#fff' }}>A</div>
            <p style={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>Direção, Colégio Ágape</p>
            <p style={{ color: 'rgba(255,255,255,.75)', fontSize: 13, marginTop: 4 }}>Escola privada · Patos, Paraíba</p>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a href="#demo" className="btn-primary" style={{ background: '#fff', color: '#00523C', boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
            Quero esses resultados →
          </a>
        </div>
      </div>
    </section>
  )
}

// ─── WHATSAPP ─────────────────────────────────────────────────────────────
function WhatsApp() {
  const ref = useAnim()
  const items = [
    'Número oficial da escola — não o celular pessoal de alguém',
    'Toda a equipe atende pelo mesmo número com histórico completo',
    'Bot que responde fora do horário e qualifica o lead',
    'Fluxos personalizados com a linguagem da sua escola',
    'API Oficial Meta — sem bloqueio, sem QR code diário',
    'Lead que chega pelo WhatsApp entra no funil automaticamente',
    'Disparos de campanha para listas segmentadas',
  ]
  return (
    <section id="whatsapp" style={{ padding: '88px 32px', background: '#F9FAFB' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={ref} className="anim wa-grid" style={{ display: 'flex', gap: 64, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#DCFCE7', borderRadius: 999, padding: '6px 14px', marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              <span style={{ color: '#15803D', fontSize: 13, fontWeight: 700 }}>API Oficial Meta WhatsApp Business</span>
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 16, lineHeight: 1.3 }}>
              WhatsApp do jeito certo:<br />
              <span style={{ color: '#00523C' }}>API Oficial do Meta</span>
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, marginBottom: 28 }}>
              Sua escola provavelmente já usa WhatsApp para atender famílias. O problema é: está no celular pessoal de alguém, sem histórico, sem padrão e com risco de perder tudo se trocar de atendente.
            </p>
            <div style={{ marginBottom: 32 }}>
              {items.map((item, i) => (
                <div key={i} className="check-item">
                  <div className="check-icon">✓</div>
                  <span style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{item}</span>
                </div>
              ))}
            </div>
            <a href="#demo" className="btn-primary">Quero o WhatsApp oficial →</a>
          </div>
          {/* Visual */}
          <div style={{ flex: '0 0 360px' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.12)', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '0 0 12px', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📱</div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Colégio — Matrículas</p>
                  <p style={{ fontSize: 12, color: '#16A34A' }}>● Número oficial verificado</p>
                </div>
              </div>
              {[
                { from: 'lead', text: 'Olá! Tenho interesse em matricular minha filha. Quais as séries disponíveis?', time: '14:23' },
                { from: 'bot', text: '👋 Olá! Que ótimo! Atendemos do Infantil I ao 9º ano. Posso agendar uma visita para você conhecer a escola?', time: '14:23', badge: 'Bot' },
                { from: 'lead', text: 'Sim, pode agendar para sábado!', time: '14:24' },
                { from: 'atendente', text: '✅ Perfeito! Agendado para sábado às 9h. Vou enviar a confirmação por aqui.', time: '14:25', badge: 'Ana · Atendente' },
              ].map((msg, i) => (
                <div key={i} style={{ marginBottom: 10, display: 'flex', justifyContent: msg.from === 'lead' ? 'flex-start' : 'flex-end' }}>
                  <div style={{ maxWidth: '80%', background: msg.from === 'lead' ? '#F3F4F6' : msg.from === 'bot' ? '#E6F7F5' : '#DCF8C6', borderRadius: msg.from === 'lead' ? '4px 12px 12px 12px' : '12px 4px 12px 12px', padding: '8px 12px' }}>
                    {msg.badge && <p style={{ fontSize: 10, color: '#6B7280', marginBottom: 3, fontWeight: 600 }}>{msg.badge}</p>}
                    <p style={{ fontSize: 12, color: '#111827', lineHeight: 1.5 }}>{msg.text}</p>
                    <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, textAlign: 'right' }}>{msg.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────
function Relatorios() {
  const ref = useAnim()
  return (
    <section id="relatorios" style={{ padding: '88px 32px', background: '#fff' }}>
      <div ref={ref} className="anim" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Visual */}
          <div style={{ flex: '0 0 440px' }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,.1)', border: '1px solid #E5E7EB' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Saúde da campanha</span>
                <div style={{ background: '#D1FAE5', borderRadius: 999, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#065F46' }}>82 / 100</div>
              </div>
              {[
                { label: 'Captação de leads', pct: 92, meta: 200, real: 184, color: '#10B981', status: '🟢' },
                { label: 'Visitas realizadas', pct: 84, meta: 80, real: 67, color: '#F59E0B', status: '🟡' },
                { label: 'Matrículas efetivadas', pct: 76, meta: 50, real: 38, color: '#EF4444', status: '🔴' },
                { label: 'Rematrícula', pct: 88, meta: 200, real: 176, color: '#10B981', status: '🟢' },
              ].map(row => (
                <div key={row.label} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>{row.status} {row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{row.real}<span style={{ color: '#9CA3AF', fontWeight: 400 }}>/{row.meta}</span></span>
                  </div>
                  <div style={{ height: 8, background: '#F3F4F6', borderRadius: 999 }}>
                    <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 999 }} />
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 16, padding: '12px 14px', background: '#FEF3C7', borderRadius: 10 }}>
                <p style={{ fontSize: 12, color: '#92400E', lineHeight: 1.5 }}>
                  <strong>⚡ Análise IA:</strong> Ritmo de visitas está 14% abaixo do necessário para bater a meta de matrículas. Recomendação: intensificar o agendamento pós-primeiro contato nas próximas 2 semanas.
                </p>
              </div>
            </div>
          </div>
          {/* Texto */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'inline-block', background: '#E6F7F5', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
              <span style={{ color: '#00523C', fontSize: 13, fontWeight: 700 }}>Inteligência em tempo real</span>
            </div>
            <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 16, lineHeight: 1.3 }}>
              Visão cirúrgica da sua campanha
            </h2>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.7, marginBottom: 28 }}>
              Pare de adivinhar se está no ritmo certo. A Áion Edu te diz em tempo real onde estão os desvios, quais ações tomar e qual é a saúde geral da campanha.
            </p>
            {[
              'Funil em tempo real com desvios coloridos',
              'Velocidade semanal vs meta necessária',
              'Índice de saúde 0–100 calculado pela IA',
              'Comparativo histórico mês a mês por ano',
              'ROI por canal de marketing',
              'Alertas automáticos quando algo sai do planejado',
            ].map((item, i) => (
              <div key={i} className="check-item">
                <div className="check-icon">✓</div>
                <span style={{ fontSize: 14, color: '#374151' }}>{item}</span>
              </div>
            ))}
            <div style={{ marginTop: 32 }}>
              <a href="#demo" className="btn-primary">Ver os relatórios →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── PREÇOS ───────────────────────────────────────────────────────────────
function Precos() {
  const ref = useAnim()
  const features = [
    'CRM completo com Kanban de leads',
    'WhatsApp com API Oficial Meta',
    'Gerador de campanha com IA',
    'Relatórios e inteligência completos',
    'Módulo de rematrículas e retenção',
    'Transferências com diagnóstico IA',
    'Pesquisas de satisfação ilimitadas',
    'Benchmark com dados do INEP',
    'Auditoria e controle de equipe',
    'Suporte em português',
    'Consultor dedicado',
  ]
  return (
    <section id="precos" style={{ padding: '88px 32px', background: '#F9FAFB' }}>
      <div ref={ref} className="anim" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', background: '#E6F7F5', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
          <span style={{ color: '#00523C', fontSize: 13, fontWeight: 700 }}>Um plano. Tudo incluído.</span>
        </div>
        <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 12 }}>Preço simples e transparente</h2>
        <p style={{ fontSize: 16, color: '#6B7280', marginBottom: 48 }}>Sem surpresas, sem pacotes complicados. Um plano com tudo que sua escola precisa.</p>

        <div style={{ background: '#fff', borderRadius: 24, padding: '40px 40px', boxShadow: '0 20px 60px rgba(0,0,0,.1)', border: '2px solid #00A896', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(135deg,#00523C,#00A896)', borderRadius: 999, padding: '5px 18px', fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
            Primeiro mês grátis
          </div>
          <div style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 14, color: '#9CA3AF' }}>por escola</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#374151' }}>R$</span>
            <span style={{ fontSize: 64, fontWeight: 900, color: '#00523C', lineHeight: 1 }}>550</span>
            <span style={{ fontSize: 18, color: '#9CA3AF' }}>/mês</span>
          </div>
          <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 32 }}>Sem fidelidade · Cancele quando quiser</p>

          <div className="preco-features" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, textAlign: 'left', marginBottom: 32 }}>
            {features.map(f => (
              <div key={f} className="check-item">
                <div className="check-icon">✓</div>
                <span style={{ fontSize: 13, color: '#374151' }}>{f}</span>
              </div>
            ))}
          </div>

          <a href="#demo" className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '16px 0' }}>
            Quero começar →
          </a>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>Sem compromisso · Resposta em até 2 horas · Suporte em português</p>
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  const ref = useAnim()
  const items = [
    { q: 'Como funciona o primeiro mês grátis?', a: 'Você começa a usar a plataforma sem pagar nada. Só cobramos a partir do segundo mês, quando você já viu o valor na prática.' },
    { q: 'Preciso de conhecimento técnico para usar?', a: 'Não. A plataforma foi criada para gestores de escolas, não para analistas de TI. O onboarding é guiado e o suporte em português está sempre disponível.' },
    { q: 'Quanto tempo leva para configurar?', a: 'Em menos de 10 minutos você importa o histórico do ERP, a IA gera o plano inicial e sua equipe já pode começar a usar o CRM.' },
    { q: 'Posso cancelar quando quiser?', a: 'Sim. Não há fidelidade mínima. Se quiser cancelar, basta avisar com 30 dias de antecedência.' },
    { q: 'Como funciona a integração com o WhatsApp?', a: 'Usamos a API Oficial do Meta WhatsApp Business. O processo de homologação do número leva de 2 a 5 dias úteis e nossa equipe faz tudo por você.' },
    { q: 'A plataforma funciona com qualquer ERP escolar?', a: 'Sim. A IA consegue processar relatórios em PDF, XLS e CSV de qualquer ERP: SIGA, Totvs, Escolare, Sistec e outros.' },
  ]
  return (
    <section style={{ padding: '88px 32px', background: '#fff' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div ref={ref} className="anim" style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: '#111827', marginBottom: 12 }}>Perguntas frequentes</h2>
        </div>
        <div>
          {items.map((item, i) => (
            <div key={i} className="faq-item">
              <button className="faq-btn" onClick={() => setOpen(open === i ? null : i)}>
                <span>{item.q}</span>
                <span style={{ fontSize: 20, color: '#00A896', transition: 'transform .2s', transform: open === i ? 'rotate(45deg)' : 'none' }}>+</span>
              </button>
              {open === i && (
                <div style={{ paddingBottom: 18, fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA FINAL + FORMULÁRIO ───────────────────────────────────────────────
function CTAFinal() {
  const [form, setForm] = useState({ nome: '', email: '', escola: '', cidade: '', whatsapp: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const ref = useAnim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.escola || !form.whatsapp) { setErr('Preencha todos os campos obrigatórios.'); return }
    setSending(true); setErr(null)
    try {
      await supabase.from('demo_requests').insert({
        name: form.nome,
        email: form.email,
        school_name: form.escola,
        city: form.cidade,
        whatsapp: form.whatsapp,
        type: 'demo',
      })
      setSent(true)
      const msg = encodeURIComponent(`Olá! Sou ${form.nome} da escola ${form.escola} (${form.cidade || 'Brasil'}) e quero agendar uma demonstração gratuita da Áion Edu.`)
      window.open(`https://wa.me/5583985556393?text=${msg}`, '_blank')
    } catch {
      setErr('Erro ao enviar. Tente novamente ou fale pelo WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section id="demo" style={{ padding: '88px 32px', background: 'linear-gradient(135deg,#00523C,#00A896)' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div ref={ref} className="anim" style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 14 }}>
            Comece antes da campanha de agosto
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.85)', maxWidth: 540, margin: '0 auto', lineHeight: 1.7 }}>
            Escolas que planejam com antecedência têm resultados consistentemente melhores na captação de novos alunos.
          </p>
        </div>

        {sent ? (
          <div style={{ background: '#fff', borderRadius: 20, padding: '48px 40px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontSize: 24, fontWeight: 900, color: '#00523C', marginBottom: 12 }}>Recebemos sua solicitação!</h3>
            <p style={{ color: '#374151', lineHeight: 1.7, fontSize: 15 }}>
              Nossa equipe vai entrar em contato via WhatsApp em até 2 horas. Enquanto isso, abrimos o WhatsApp para você já adiantar uma mensagem.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 20, padding: '40px 40px', maxWidth: 680, margin: '0 auto' }}>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome completo *</label>
                <input className="input-field" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail *</label>
                <input className="input-field" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome da escola *</label>
                <input className="input-field" value={form.escola} onChange={e => setForm(f => ({ ...f, escola: e.target.value }))} placeholder="Colégio..." />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cidade / Estado</label>
                <input className="input-field" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: João Pessoa/PB" />
              </div>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp *</label>
              <input className="input-field" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(83) 9xxxx-xxxx" />
            </div>
            {err && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</p>}
            <button type="submit" disabled={sending} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '16px 0', opacity: sending ? 0.7 : 1 }}>
              {sending ? 'Enviando...' : 'Quero minha demonstração gratuita →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>
              Sem compromisso · Resposta em até 2 horas · Suporte em português
            </p>
          </form>
        )}
      </div>
    </section>
  )
}

// ─── RODAPÉ ───────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#111827', padding: '64px 32px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Logo + descrição */}
        <div className="footer-cols" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, marginBottom: 48 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'white' }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>Áion Edu</span>
            </div>
            <p style={{ fontSize: 13, color: '#9CA3AF', lineHeight: 1.7, marginBottom: 16 }}>Inteligência em matrículas para escolas privadas brasileiras.</p>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>
              AION SOLUÇÕES TECNOLÓGICAS LTDA<br />
              CNPJ: 65.835.064/0001-58<br />
              R. Francisco Vicente de Araújo, 48 · Bela Vista<br />
              Patos - PB · CEP 58.704-560<br />
              (83) 9855-6393 · contato@aionedu.com.br
            </p>
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Produto</h4>
            {[['#modulos','Módulos'],['#como-funciona','Como funciona'],['#precos','Preços'],['#demo','Demo']].map(([href, label]) => (
              <a key={href} href={href} style={{ display: 'block', color: '#9CA3AF', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
              >{label}</a>
            ))}
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Empresa</h4>
            {[['/sobre','Sobre nós'],['/parceiros','Parceiros'],['/blog','Blog']].map(([href, label]) => (
              <Link key={href} to={href} style={{ display: 'block', color: '#9CA3AF', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
              >{label}</Link>
            ))}
          </div>
          <div>
            <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Legal</h4>
            {[['/privacidade','Política de Privacidade'],['/termos','Termos de Uso'],['/privacidade','LGPD']].map(([href, label]) => (
              <Link key={label} to={href} style={{ display: 'block', color: '#9CA3AF', textDecoration: 'none', fontSize: 13, marginBottom: 10, transition: 'color .2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9CA3AF')}
              >{label}</Link>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid #1F2937', paddingTop: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#6B7280' }}>© 2026 Áion Edu. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = CSS
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  return (
    <>
      <Header />
      <main>
        <Hero />
        <Numeros />
        <Problema />
        <OQueE />
        <Modulos />
        <ComoFunciona />
        <Depoimento />
        <WhatsApp />
        <Relatorios />
        <Precos />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
    </>
  )
}
