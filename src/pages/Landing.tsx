import React, { useState, useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

// ── Icons ─────────────────────────────────────────────────────────────────
function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcUsers = (p: any) => <Ic {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>
const IcColumns = (p: any) => <Ic {...p}><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" /></Ic>
const IcMsg = (p: any) => <Ic {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Ic>
const IcBarChart = (p: any) => <Ic {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>
const IcCpu = (p: any) => <Ic {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></Ic>
const IcCalCheck = (p: any) => <Ic {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><path d="m9 16 2 2 4-4" /></Ic>
const IcStar = (p: any) => <Ic {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Ic>
const IcMapPin = (p: any) => <Ic {...p}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></Ic>
const IcShield = (p: any) => <Ic {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ic>
const IcRefreshCw = (p: any) => <Ic {...p}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></Ic>
const IcCheck = (p: any) => <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>
const IcChevDown = (p: any) => <Ic {...p}><polyline points="6 9 12 15 18 9" /></Ic>
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
const IcHome = (p: any) => <Ic {...p}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></Ic>
const IcTrendUp = (p: any) => <Ic {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ic>
const IcGlobe = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Ic>
const IcSettings = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Ic>
const IcActivity = (p: any) => <Ic {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></Ic>
const IcAlert = (p: any) => <Ic {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></Ic>

// ── Reveal hook ────────────────────────────────────────────────────────────
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

function RevealCard({ children, delay, style, className }: { children: React.ReactNode; delay?: string; style?: React.CSSProperties; className?: string }) {
  const ref = useReveal(delay)
  return <div ref={ref} style={style} className={className}>{children}</div>
}

// ── Hero Dashboard Mockup ──────────────────────────────────────────────────
function HeroMockup() {
  const [beat, setBeat] = useState(false)
  useEffect(() => { const id = setInterval(() => setBeat(b => !b), 1800); return () => clearInterval(id) }, [])

  return (
    <div style={{ animation: 'floatY 5.5s ease-in-out infinite', position: 'relative' }}>
      <div style={{ position: 'absolute', top: -14, right: 16, background: 'linear-gradient(135deg,#0DD3BF,#00A896)', color: '#fff', padding: '5px 13px', borderRadius: 999, fontSize: 11, fontWeight: 800, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 16px rgba(13,211,191,.45)' }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'inline-block', animation: 'blink 1.4s infinite' }} />
        AO VIVO
      </div>
      <div style={{ background: 'rgba(255,255,255,.08)', borderRadius: 24, padding: 4, border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 48px 96px rgba(0,0,0,.45)' }}>
        <div style={{ background: '#fff', borderRadius: 21, overflow: 'hidden', width: 420 }}>
          {/* Browser bar */}
          <div style={{ padding: '11px 16px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
            </div>
            <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 6, padding: '4px 12px', fontSize: 11, color: '#9CA3AF' }}>app.aionedu.com.br</div>
          </div>
          {/* App header */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #F3F4F6', background: 'linear-gradient(90deg,#00523C,#006B50)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', marginBottom: 2 }}>Boa tarde, Victor!</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Colégio Ágape · Patos</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.15)', padding: '4px 10px', borderRadius: 999 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: beat ? '#4ADE80' : '#D1FAE5', transition: 'background .5s' }} />
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>Ao vivo</span>
            </div>
          </div>
          {/* IA alerts */}
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {['Novatos caíram 40.2% vs ano anterior', '225 leads sem contato há mais de 5 dias', 'Cadastros 0% da meta — intensifique captação'].map((a, i) => (
              <div key={i} style={{ background: '#FFFBEB', borderRadius: 9, padding: '7px 10px', border: '1px solid #FDE68A', display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: 1 }}><IcAlert size={12} color="#D97706" /></div>
                <span style={{ fontSize: 11, color: '#92400E', lineHeight: 1.45 }}>{a}</span>
              </div>
            ))}
          </div>
          {/* Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', borderTop: '1px solid #F3F4F6', borderBottom: '1px solid #F3F4F6' }}>
            {[{ l: 'Conversas', v: '23' }, { l: 'Leads', v: '184' }, { l: 'Matrículas', v: '38' }, { l: 'Satisfação', v: '4.8' }, { l: 'Resp.', v: '3min' }].map((m, i) => (
              <div key={i} style={{ padding: '9px 6px', textAlign: 'center', borderRight: i < 4 ? '1px solid #F3F4F6' : 'none' }}>
                <p style={{ fontSize: 16, fontWeight: 900, color: '#111827', lineHeight: 1 }}>{m.v}</p>
                <p style={{ fontSize: 9, color: '#9CA3AF', marginTop: 2, fontWeight: 600 }}>{m.l}</p>
              </div>
            ))}
          </div>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, padding: '10px 12px 12px' }}>
            {[
              { l: 'Score', v: '45', u: '/100', bg: '#FFF7ED', c: '#EA580C' },
              { l: 'Alunos', v: '956', u: '', bg: '#EFF6FF', c: '#2563EB' },
              { l: 'Novatos', v: '116', u: '', bg: '#F0FDF4', c: '#16A34A' },
              { l: 'Market Share', v: '23.3', u: '%', bg: '#F5F3FF', c: '#7C3AED' },
            ].map((k, i) => (
              <div key={i} style={{ background: k.bg, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
                <p style={{ fontSize: 18, fontWeight: 900, color: k.c, lineHeight: 1 }}>{k.v}<span style={{ fontSize: 10 }}>{k.u}</span></p>
                <p style={{ fontSize: 9, color: '#6B7280', marginTop: 3, fontWeight: 700 }}>{k.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── HERO ──────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{
      background: `radial-gradient(ellipse 80% 60% at 15% 50%, rgba(0,82,60,0.98) 0%, transparent 65%), radial-gradient(ellipse 50% 70% at 85% 15%, rgba(0,168,150,0.25) 0%, transparent 55%), radial-gradient(ellipse 35% 45% at 75% 85%, rgba(13,211,191,0.12) 0%, transparent 50%), #00301F`,
      padding: '140px 48px 96px', minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
    }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        <div className="hero-cols" style={{ display: 'flex', alignItems: 'center', gap: 80 }}>
          <div className="hero-text-block" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 32, animation: 'fadeIn .9s ease both', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 999, padding: '8px 18px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', animation: 'pulse2 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)', letterSpacing: '.04em' }}>CRM · WhatsApp Oficial Meta · IA · Pipeline · Relatórios</span>
            </div>
            <h1 className="s-title" style={{ fontSize: 'clamp(44px,5.5vw,76px)', color: '#fff', marginBottom: 28, animation: 'fadeUp .9s ease .1s both', lineHeight: 1.04 }}>
              O futuro da campanha<br />de matrícula e do<br />atendimento da sua<br />escola <span style={{ color: '#0DD3BF' }}>começa agora.</span>
            </h1>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.75)', lineHeight: 1.8, marginBottom: 40, maxWidth: 520, animation: 'fadeUp .9s ease .2s both' }}>
              A ÁION EDU lê os dados da sua escola, cria um plano de campanha com metas e ações, centraliza o atendimento das famílias e entrega ao gestor visibilidade total — do primeiro contato até a matrícula assinada.
            </p>
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animation: 'fadeUp .9s ease .3s both' }}>
              <a href="#demo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>Agende uma reunião <IcArrowRight size={16} /></a>
              <a href="#solucoes" className="btn-ghost">Conheça os módulos ↓</a>
            </div>
            <div className="hero-social" style={{ marginTop: 44, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp .9s ease .4s both', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex' }}>
                {['A', 'C', 'D', 'E', 'F'].map((l, i) => (
                  <div key={i} style={{ width: 40, height: 40, borderRadius: '50%', background: `linear-gradient(135deg,hsl(${158+i*14},65%,${34-i*2}%),hsl(${170+i*12},55%,${44-i*3}%))`, border: '2.5px solid rgba(255,255,255,.22)', marginLeft: i > 0 ? -11 : 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', position: 'relative', zIndex: 5 - i }}>{l}</div>
                ))}
              </div>
              <div>
                <div style={{ color: '#FCD34D', fontSize: 13, letterSpacing: 2, marginBottom: 4 }}>★★★★★</div>
                <p style={{ color: 'rgba(255,255,255,.7)', fontSize: 13 }}>"Colégio Ágape já usa a ÁION EDU" — <strong style={{ color: '#fff' }}>Patos, Paraíba</strong></p>
              </div>
            </div>
          </div>
          <div className="hero-right" style={{ flex: '0 0 460px', animation: 'fadeIn 1.2s ease .5s both' }}>
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  )
}

// ── TICKER ────────────────────────────────────────────────────────────────
function Ticker() {
  const items = ['CRM de Leads','Contatos','Visitas','WhatsApp Oficial Meta','Relatórios','Transferências','Pesquisas NPS','Usuários','Diagnóstico com IA','Configurações','Score da Escola','Market Share Local','Relatórios Mensais','Alertas Inteligentes']
  const doubled = [...items, ...items]
  return (
    <div style={{ background: '#E6F7F5', borderTop: '1px solid #A7F3D0', borderBottom: '1px solid #A7F3D0', padding: '14px 0', overflow: 'hidden' }}>
      <div className="ticker-wrap">
        <div className="ticker-track">
          {doubled.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 24, padding: '0 30px', fontSize: 13, fontWeight: 700, color: '#00523C', whiteSpace: 'nowrap' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00A896', display: 'inline-block' }} />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── DORES ─────────────────────────────────────────────────────────────────
function Dores() {
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>O problema</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(34px,4.5vw,56px)', color: '#111827', marginBottom: 18 }}>
            Sua escola <span style={{ color: '#0DD3BF' }}>perde matrículas</span><br />todos os anos.
          </h2>
          <p style={{ fontSize: 17, color: '#4B5563', maxWidth: 580, margin: '0 auto', lineHeight: 1.8 }}>
            Não é falta de esforço. É falta de processo. Sem um sistema adequado, leads somem, a equipe trabalha no improviso e você só descobre o problema quando não há mais tempo de agir.
          </p>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { Icon: IcUsers, title: 'Leads esquecidos todo ano', desc: 'Famílias interessadas entram em contato, não recebem follow-up rápido e vão para a concorrência. Cada lead perdido representa até R$ 14.400 em receita anual não gerada.' },
            { Icon: IcBarChart, title: 'Você descobre o problema tarde demais', desc: '30% abaixo da meta em novembro. Sem acompanhamento semanal, sem alertas, sem tempo de reagir. A campanha termina sem que você entenda o que deu errado.' },
            { Icon: IcUsers, title: 'O processo vai embora com o funcionário', desc: 'O histórico das famílias está no WhatsApp pessoal de quem saiu. O padrão de atendimento é o humor do atendente no dia. Sem sistema, não há continuidade.' },
          ].map((d, i) => (
            <RevealCard key={i} delay={`${i + 1}`}>
              <div className="card" style={{ padding: 36, height: '100%' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <d.Icon size={24} color="#00523C" />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 13, lineHeight: 1.35 }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{d.desc}</p>
              </div>
            </RevealCard>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 48 }}>
          <a href="#demo" className="btn-g">Quero resolver isso <IcArrowRight size={16} /></a>
        </div>
      </div>
    </section>
  )
}

// ── SOLUÇÕES ──────────────────────────────────────────────────────────────
const SOLUCOES = [
  { icon: IcUsers, title: 'CRM de Leads', bg: '#E6F7F5', ic: '#00523C', desc: 'Centralize todos os contatos, acompanhe o histórico completo e nunca perca um lead por falta de follow-up.', bullets: ['Funil visual com kanban drag-and-drop','Score automático de priorização','Classificação Frio / Morno / Quente','Dashboard de motivos de perda'], meta: false },
  { icon: IcMsg, title: 'WhatsApp Oficial Meta', bg: '#E8F5E9', ic: '#25D366', desc: 'Toda a equipe atende pelo número oficial da escola. Bot inteligente, fila de atendimento e histórico completo.', bullets: ['API Oficial Meta — sem risco de bloqueio','Bot de qualificação fora do horário','Acompanhamento em tempo real','Avaliação do atendimento pelas famílias'], meta: true },
  { icon: IcColumns, title: 'Pipeline de Matrículas', bg: '#EDE9FE', ic: '#7C3AED', desc: 'Visualize todo o processo com kanban drag-and-drop. Do primeiro contato até a matrícula assinada.', bullets: ['Kanban Novo → Contato → Visita → Proposta → Matriculado','Alertas de leads parados','Filtros por atendente e série','Histórico auditável'], meta: false },
  { icon: IcCpu, title: 'Diagnóstico com IA', bg: '#FFF7ED', ic: '#EA580C', desc: 'O sistema lê os dados da sua escola e cria automaticamente um plano de campanha com metas, ações e calendário.', bullets: ['Lê relatórios do ERP automaticamente','Gera plano de campanha em minutos','Metas mensais por série e canal','Benchmark com INEP e Censo Escolar'], meta: false },
  { icon: IcBarChart, title: 'Relatórios Mensais', bg: '#EFF6FF', ic: '#2563EB', desc: 'Relatórios automáticos mensais da campanha para que o gestor entenda exatamente o que está acontecendo.', bullets: ['Dashboard com desvios coloridos','Índice de saúde 0–100','Velocidade atual vs meta','Exportável para diretores'], meta: false },
  { icon: IcCalCheck, title: 'Gestão de Visitas', bg: '#F0FDF4', ic: '#16A34A', desc: 'Gerencie toda a agenda de visitas com confirmação automática e registro do resultado de cada conversa.', bullets: ['Confirmação automática via WhatsApp','Lembrete para a família','Observações pós-visita','Taxa de conversão por visita'], meta: false },
  { icon: IcStar, title: 'Pesquisas e NPS', bg: '#FFF1F2', ic: '#E11D48', desc: 'Meça a satisfação das famílias em tempo real e identifique insatisfação antes que vire cancelamento.', bullets: ['NPS em tempo real por série','Pesquisa automática pós-visita','Alertas para avaliações negativas','Relatório por atendente'], meta: false },
  { icon: IcRefreshCw, title: 'Transferências', bg: '#FFFBEB', ic: '#D97706', desc: 'Descubra o motivo real da saída e identifique quais alunos ainda podem ser recuperados antes de ir embora.', bullets: ['Link de pesquisa via WhatsApp','Família responde em 3 minutos','IA identifica motivo real','Chance de retenção calculada'], meta: false },
]

function Solucoes() {
  const r0 = useReveal()
  return (
    <section id="solucoes" className="section-pad" style={{ background: '#F4F7F5' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Plataforma completa</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>
            Solução completa para campanha de<br /><span style={{ color: '#0DD3BF' }}>matrícula e atendimento</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
            Cada módulo resolve um problema real. Juntos, formam a operação mais eficiente do mercado educacional brasileiro.
          </p>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {SOLUCOES.map((s, i) => (
            <RevealCard key={i} delay={`${(i % 3) + 1}`}>
              <div className="card" style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon size={24} color={s.ic} />
                  </div>
                  {s.meta && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#EBF5FB', padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: '#1877F2' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                      Parceiro Oficial
                    </div>
                  )}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, marginBottom: 20, flex: 1 }}>{s.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, marginBottom: 22 }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 8 }}>
                      <div style={{ flexShrink: 0, marginTop: 1 }}><IcCheck size={14} color="#00A896" /></div>
                      <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{b}</span>
                    </li>
                  ))}
                </ul>
                <a href="#demo" className="btn-outline-green" style={{ alignSelf: 'flex-start', fontSize: 13 }}>Saiba mais <IcArrowRight size={14} /></a>
              </div>
            </RevealCard>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PARCEIRO META ─────────────────────────────────────────────────────────
function MetaPartner() {
  const r0 = useReveal()
  return (
    <section style={{ background: '#00301F', padding: '96px 48px', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div ref={r0} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <svg width="90" height="24" viewBox="0 0 90 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="20" fontFamily="'Plus Jakarta Sans',sans-serif" fontWeight="700" fontSize="22" fill="white" letterSpacing="-0.5">Meta</text>
          </svg>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '7px 18px', marginBottom: 28 }}>
          <IcShield size={14} color="#0DD3BF" />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Parceiro Oficial de Integração WhatsApp</span>
        </div>
        <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#fff', marginBottom: 20 }}>
          Somos Parceiros Oficiais de<br /><span style={{ color: '#0DD3BF' }}>Integração WhatsApp Meta</span>
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,.72)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.8 }}>
          Isso significa número oficial homologado, atendimento centralizado de toda a equipe, bot inteligente, histórico preservado e zero risco de bloqueio — tudo dentro das normas oficiais do Meta.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[{ Icon: IcShield, label: 'Conta verificada Meta' }, { Icon: IcCheck, label: 'API Oficial WhatsApp Business' }, { Icon: IcUsers, label: 'Multi-atendente centralizado' }].map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', padding: '10px 20px', borderRadius: 999 }}>
              <b.Icon size={15} color="#0DD3BF" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── COMO FUNCIONA ─────────────────────────────────────────────────────────
function ComoFunciona() {
  const r0 = useReveal()
  return (
    <section id="como-funciona" className="section-pad" style={{ background: '#00301F', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(0,168,150,.1),transparent)', top: -200, right: -80, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1060, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>Como funciona</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#fff', marginBottom: 16 }}>
            Do zero ao plano de campanha<br />em menos de <span style={{ color: '#0DD3BF' }}>10 minutos</span>
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.62)', maxWidth: 480, margin: '0 auto', lineHeight: 1.75 }}>Simples para a equipe, poderoso para a gestão.</p>
        </div>
        <div className="steps-g" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 50, left: '18%', right: '18%', height: 2, background: 'linear-gradient(90deg,#00A896,#0DD3BF,#00A896)', opacity: .3, pointerEvents: 'none' }} />
          {[
            { num: '01', Icon: IcSettings, title: 'Configure sua escola em 5 dias', desc: 'Nossa equipe configura tudo: integração com o ERP, WhatsApp oficial homologado, equipe treinada e plano de campanha gerado pela IA.' },
            { num: '02', Icon: IcCpu, title: 'IA lê seus dados e cria o plano', desc: 'O sistema lê automaticamente o histórico do ERP, compara com benchmarks do mercado e gera metas mensais, ações e calendário de captação.' },
            { num: '03', Icon: IcTrendUp, title: 'Acompanhe, reaja e converta', desc: 'Dashboard semanal com alertas, desvios e análise automática. Relatório mensal completo. Sua equipe sabe o que fazer a cada semana.' },
          ].map((s, i) => (
            <RevealCard key={i} delay={`${i + 1}`}>
              <div className="card-dark" style={{ padding: 36, textAlign: 'center', position: 'relative', height: '100%' }}>
                <div className="s-title" style={{ position: 'absolute', top: 10, right: 20, fontSize: 80, color: 'rgba(255,255,255,.04)', lineHeight: 1, pointerEvents: 'none' }}>{s.num}</div>
                <div style={{ width: 68, height: 68, borderRadius: 20, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px', boxShadow: '0 8px 28px rgba(0,168,150,.3)' }}>
                  <s.Icon size={28} color="#fff" />
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0DD3BF', letterSpacing: '.12em', marginBottom: 11, textTransform: 'uppercase' }}>PASSO {s.num}</div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 13, lineHeight: 1.35 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,.58)', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            </RevealCard>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 52 }}>
          <a href="#demo" className="btn-teal" style={{ fontSize: 16, padding: '17px 36px' }}>Agende uma reunião <IcArrowRight size={16} /></a>
        </div>
      </div>
    </section>
  )
}

// ── IMPLANTAÇÃO ───────────────────────────────────────────────────────────
function Implantacao() {
  const r0 = useReveal()
  const etapas = [
    { num: '01', Icon: IcSettings, color: '#0DD3BF', title: 'Implantação', sub: 'CONFIGURAÇÃO COMPLETA', desc: 'Nossa equipe configura tudo em até 5 dias úteis.', bullets: ['Integração com o ERP da escola','Homologação WhatsApp Oficial Meta','Cadastro e permissões da equipe','Personalização dos fluxos','Treinamento presencial ou remoto'] },
    { num: '02', Icon: IcCpu, color: '#6366F1', title: 'Criação da Campanha', sub: 'COM APOIO DA IA', desc: 'A IA lê os dados da escola e constrói o plano completo com metas e ações.', bullets: ['Reunião de kickoff com consultor','IA gera plano de campanha','Metas mensais por série','Calendário de captação','Estratégia por canal'] },
    { num: '03', Icon: IcBarChart, color: '#F59E0B', title: 'Acompanhamento Mensal', sub: 'PARCERIA ATIVA', desc: 'Todo mês: reunião de performance, relatório automático e ajuste de estratégia.', bullets: ['Reunião mensal com consultor','Relatório mensal automático','Análise de desvios','Ajuste de estratégia','Suporte prioritário WhatsApp'] },
  ]
  return (
    <section id="implantacao" className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 64 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Fluxo de implantação</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>
            Você não precisa fazer<br /><span style={{ color: '#0DD3BF' }}>nada sozinho</span>
          </h2>
          <p style={{ fontSize: 17, color: '#6B7280', maxWidth: 500, margin: '0 auto', lineHeight: 1.75 }}>Nossa equipe conduz cada etapa — do primeiro acesso até a campanha rodando com dados reais.</p>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {etapas.map((e, i) => (
            <RevealCard key={i} delay={`${i + 1}`}>
              <div className="card" style={{ padding: 38, position: 'relative', overflow: 'hidden', height: '100%' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${e.color},${e.color}88)`, borderRadius: '20px 20px 0 0' }} />
                <div className="s-title" style={{ position: 'absolute', top: 10, right: 22, fontSize: 76, color: `${e.color}0d`, lineHeight: 1, pointerEvents: 'none' }}>{e.num}</div>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${e.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <e.Icon size={24} color={e.color} />
                </div>
                <h3 className="s-title" style={{ fontSize: 22, color: '#111827', marginBottom: 6 }}>{e.title}</h3>
                <p style={{ fontSize: 11, fontWeight: 800, color: e.color, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '.08em' }}>{e.sub}</p>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8, marginBottom: 22 }}>{e.desc}</p>
                {e.bullets.map((b, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 9 }}>
                    <div style={{ flexShrink: 0, marginTop: 1 }}><IcCheck size={14} color={e.color} /></div>
                    <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{b}</span>
                  </div>
                ))}
              </div>
            </RevealCard>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
          {etapas.map((e, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: e.color, boxShadow: `0 0 12px ${e.color}88` }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: e.color, whiteSpace: 'nowrap' }}>{e.title}</span>
              </div>
              {i < etapas.length - 1 && <div style={{ flex: 1, maxWidth: 120, height: 2, background: `linear-gradient(90deg,${e.color},${etapas[i+1].color})`, marginBottom: 18 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── DIFERENCIAIS ──────────────────────────────────────────────────────────
function Diferenciais() {
  const r0 = useReveal()
  return (
    <section id="diferenciais" className="section-pad" style={{ background: '#F4F7F5' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 62 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Por que ÁION EDU</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>
            Mais do que um software —<br /><span style={{ color: '#0DD3BF' }}>um parceiro de resultados</span>
          </h2>
          <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 490, margin: '0 auto', lineHeight: 1.75 }}>O que separa a ÁION EDU de qualquer outra ferramenta do mercado educacional.</p>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
          {[
            { Icon: IcMapPin, title: '100% feito para o Brasil', desc: 'LGPD, INEP, Censo Escolar e ERPs nacionais integrados nativamente. Desenvolvido para a realidade das escolas privadas brasileiras.' },
            { Icon: IcCpu, title: 'IA que cria sua campanha', desc: 'O sistema lê os dados do ERP, compara com o mercado local e gera automaticamente um plano com metas, ações e calendário de captação.' },
            { Icon: IcShield, title: 'Parceiro Oficial Meta', desc: 'API Oficial WhatsApp Business. Número oficial da escola, sem risco de bloqueio, atendimento centralizado para toda a equipe.' },
            { Icon: IcBarChart, title: 'Relatórios mensais automáticos', desc: 'Todo mês, um relatório completo da campanha é gerado automaticamente. O gestor entende o que aconteceu e o que precisa mudar.' },
            { Icon: IcActivity, title: 'Atendimento em tempo real', desc: 'Acompanhe todos os atendimentos via WhatsApp: tempo de espera, avaliação das famílias, produtividade por atendente.' },
            { Icon: IcRefreshCw, title: 'Ciclo completo de matrícula', desc: 'Da captação de novos alunos à rematrícula dos atuais. Com inteligência preditiva em cada etapa do ciclo escolar.' },
          ].map((d, i) => (
            <RevealCard key={i} delay={`${(i % 3) + 1}`}>
              <div className="card" style={{ padding: 32, height: '100%' }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                  <d.Icon size={24} color="#00523C" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.35 }}>{d.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{d.desc}</p>
              </div>
            </RevealCard>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── PARA QUEM ─────────────────────────────────────────────────────────────
function ParaQuem() {
  const r0 = useReveal()
  return (
    <section className="section-pad" style={{ background: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Para quem é</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 14 }}>
            A ÁION EDU foi feita para escolas que<br /><span style={{ color: '#0DD3BF' }}>querem crescer com inteligência</span>
          </h2>
        </div>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[
            { Icon: IcHome, title: 'Escola independente', desc: 'Quer profissionalizar a campanha e sair definitivamente das planilhas e do WhatsApp pessoal.', items: ['1 a 3 atendentes','Até 500 alunos','Campanha manual hoje'] },
            { Icon: IcTrendUp, title: 'Escola em crescimento', desc: 'Já tem equipe estruturada e quer dados confiáveis para tomar decisões com confiança e bater metas.', items: ['3 a 10 atendentes','500 a 2000 alunos','Quer previsibilidade'] },
            { Icon: IcGlobe, title: 'Rede de escolas', desc: 'Precisa padronizar e escalar a captação em múltiplas unidades com visibilidade centralizada.', items: ['10+ atendentes','2000+ alunos','Múltiplas unidades'] },
          ].map((card, i) => (
            <RevealCard key={i} delay={`${i + 1}`}>
              <div className="card" style={{ padding: 36, height: '100%' }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <card.Icon size={28} color="#00523C" />
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.3 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.75, marginBottom: 22 }}>{card.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {card.items.map((item, j) => (
                    <li key={j} style={{ fontSize: 13, color: '#374151', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 9 }}>
                      <IcCheck size={14} color="#00A896" />{item}
                    </li>
                  ))}
                </ul>
              </div>
            </RevealCard>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── FAQ ───────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null)
  const r0 = useReveal()
  const items = [
    { q: 'Como funciona o processo de implantação?', a: 'Nossa equipe conduz tudo: integração com o ERP, homologação do WhatsApp Oficial Meta, cadastro da equipe, personalização dos fluxos e treinamento. Em média 5 a 7 dias úteis do primeiro acesso à campanha rodando.' },
    { q: 'O sistema realmente cria o plano de campanha sozinho?', a: 'Sim. A IA lê automaticamente os relatórios do seu ERP, cruza com dados do Censo Escolar e IBGE e gera um plano completo com metas mensais por série, ações recomendadas e calendário de captação. Você revisa e aplica.' },
    { q: 'Preciso de conhecimento técnico para usar?', a: 'Não. A plataforma foi desenvolvida para gestores e equipes de atendimento de escolas. O onboarding é guiado e o suporte em português está sempre disponível.' },
    { q: 'Como funciona a integração com o WhatsApp?', a: 'Usamos a API Oficial do Meta WhatsApp Business. O processo de homologação leva de 2 a 5 dias úteis e nossa equipe realiza tudo por você. Sem risco de bloqueio.' },
    { q: 'A plataforma funciona com qualquer ERP escolar?', a: 'Sim. A IA processa relatórios em PDF, XLS e CSV de qualquer ERP: SIGA, Totvs, Escolare, Sistec e outros sistemas nacionais.' },
    { q: 'Como funcionam os relatórios mensais?', a: 'Todo mês o sistema gera automaticamente um relatório completo da campanha — desvios, conversões, performance por canal e análise de tendências. Você recebe e discute com o consultor dedicado na reunião mensal.' },
  ]
  return (
    <section className="section-pad" style={{ background: '#F4F7F5' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 56 }}>
          <div className="tag-g" style={{ marginBottom: 20 }}>Dúvidas</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(28px,4vw,44px)', color: '#111827' }}>Perguntas frequentes</h2>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ borderBottom: '1px solid #E5E7EB' }}>
            <button className="faq-btn" onClick={() => setOpen(open === i ? null : i)}>
              <span>{item.q}</span>
              <span style={{ flexShrink: 0, color: '#00A896', transition: 'transform .25s', transform: open === i ? 'rotate(180deg)' : 'none', display: 'flex' }}>
                <IcChevDown size={20} color="#00A896" />
              </span>
            </button>
            {open === i && <div style={{ paddingBottom: 22, fontSize: 15, color: '#4B5563', lineHeight: 1.85, animation: 'fadeUp .3s ease' }}>{item.a}</div>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── CTA FINAL ─────────────────────────────────────────────────────────────
function CTAFinal() {
  const [form, setForm] = useState({ nome: '', email: '', escola: '', cidade: '', whatsapp: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const r0 = useReveal()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.escola || !form.whatsapp) { setErr('Preencha todos os campos obrigatórios.'); return }
    setSending(true); setErr(null)
    try {
      const res = await fetch('https://syxxuumxkhhnoqrxporj.supabase.co/functions/v1/landing-lead', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar')
      setSent(true)
    } catch (ex: unknown) {
      setErr((ex instanceof Error ? ex.message : 'Erro ao enviar') + '. Tente novamente ou fale pelo WhatsApp.')
    } finally { setSending(false) }
  }

  return (
    <section id="demo" className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)', position: 'relative', overflow: 'hidden' }}>
      <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ maxWidth: 840, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        <div ref={r0} style={{ textAlign: 'center', marginBottom: 52 }}>
          <div className="tag-d" style={{ marginBottom: 20 }}>Pronto para começar?</div>
          <h2 className="s-title" style={{ fontSize: 'clamp(32px,4.5vw,52px)', color: '#fff', marginBottom: 16 }}>
            Agende uma reunião e veja a<br /><span style={{ color: '#0DD3BF' }}>ÁION EDU em ação</span>
          </h2>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.78)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
            Preencha o formulário e nossa equipe entra em contato em até 2 horas úteis para apresentar a plataforma e entender o momento da sua escola.
          </p>
        </div>

        {sent ? (
          <div style={{ background: '#fff', borderRadius: 24, padding: '52px 44px', textAlign: 'center', maxWidth: 520, margin: '0 auto', boxShadow: '0 32px 80px rgba(0,0,0,.2)' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <IcCheck size={28} color="#10B981" stroke={2.5} />
            </div>
            <h3 className="s-title" style={{ fontSize: 26, color: '#00523C', marginBottom: 14 }}>Recebemos sua solicitação!</h3>
            <p style={{ color: '#374151', lineHeight: 1.8, fontSize: 15 }}>Nossa equipe vai entrar em contato via WhatsApp em até 2 horas úteis.</p>
            <a href="https://wa.me/5583933444383?text=Ol%C3%A1!%20Acabei%20de%20solicitar%20uma%20demonstra%C3%A7%C3%A3o." target="_blank" rel="noopener noreferrer" className="btn-g" style={{ marginTop: 24, background: '#25D366', boxShadow: '0 4px 20px rgba(37,211,102,.35)', display: 'inline-flex' }}>
              Falar agora no WhatsApp
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 24, padding: 44, maxWidth: 700, margin: '0 auto', boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
            <div className="form-g" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 }}>
              {[{ key: 'nome', label: 'Nome completo *', ph: 'Seu nome', type: 'text' }, { key: 'email', label: 'E-mail *', ph: 'seu@email.com', type: 'email' }, { key: 'escola', label: 'Nome da escola *', ph: 'Colégio...', type: 'text' }, { key: 'cidade', label: 'Cidade / Estado', ph: 'Ex: João Pessoa/PB', type: 'text' }].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>{f.label}</label>
                  <input className="inp" type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} />
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 26 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>WhatsApp *</label>
              <input className="inp" value={form.whatsapp} onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))} placeholder="(83) 9xxxx-xxxx" />
            </div>
            {err && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 14 }}>{err}</p>}
            <button type="submit" disabled={sending} className="btn-g" style={{ width: '100%', justifyContent: 'center', fontSize: 16, padding: '18px 0', opacity: sending ? .7 : 1 }}>
              {sending ? 'Enviando...' : 'Agende uma reunião →'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>Resposta em até 2 horas úteis · Suporte em português</p>
          </form>
        )}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, marginBottom: 12 }}>Prefere falar direto?</p>
          <a href="https://wa.me/5583933444383" target="_blank" rel="noopener noreferrer" className="btn-ghost">Chamar no WhatsApp</a>
        </div>
      </div>
    </section>
  )
}

// ── FLOATING WA BUTTON ────────────────────────────────────────────────────
function WAButton() {
  return (
    <a href="https://wa.me/5583933444383?text=Ol%C3%A1!%20Tenho%20interesse%20na%20%C3%81ion%20Edu." target="_blank" rel="noopener noreferrer"
      style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 999, width: 60, height: 60, borderRadius: '50%', background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(37,211,102,.55)', textDecoration: 'none', transition: 'transform .2s, box-shadow .2s' }}
      onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.transform = 'scale(1.12)'; t.style.boxShadow = '0 8px 32px rgba(37,211,102,.65)' }}
      onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.transform = 'scale(1)'; t.style.boxShadow = '0 4px 24px rgba(37,211,102,.55)' }}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </a>
  )
}

// ── EXPORT ────────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    return () => { document.getElementById('aion-css')?.remove() }
  }, [])

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Ticker />
        <Dores />
        <Solucoes />
        <MetaPartner />
        <ComoFunciona />
        <Implantacao />
        <Diferenciais />
        <ParaQuem />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
      <WAButton />
    </>
  )
}
