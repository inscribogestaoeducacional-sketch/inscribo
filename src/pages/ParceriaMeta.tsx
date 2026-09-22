import React, { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

const META_LOGO = 'https://static.xx.fbcdn.net/rsrc.php/y1/r/4hZ1LkFP2sW.webp'

// ── Icons ─────────────────────────────────────────────────────────────────
function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcShield = (p: any) => <Ic {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ic>
const IcCheck = (p: any) => <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>
const IcStar = (p: any) => <Ic {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></Ic>
const IcGlobe = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></Ic>
const IcSettings = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Ic>
const IcColumns = (p: any) => <Ic {...p}><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18" /></Ic>
const IcUsers = (p: any) => <Ic {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>

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

function RevealCard({ children, delay, style }: { children: React.ReactNode; delay?: string; style?: React.CSSProperties }) {
  const ref = useReveal(delay)
  return <div ref={ref} style={style}>{children}</div>
}

// ── Dados ─────────────────────────────────────────────────────────────────
const POR_QUE_IMPORTA = [
  { Icon: IcShield, title: 'Número nunca corre risco de banimento', desc: 'Diferente de ferramentas não oficiais que simulam o WhatsApp Web, a conexão via API Oficial roda dentro das regras da própria Meta — sem o risco de bloqueio que essas soluções alternativas carregam.' },
  { Icon: IcCheck, title: 'Templates aprovados diretamente pela Meta', desc: 'Mensagens automáticas e em massa usam modelos homologados pela própria plataforma, com garantia de entrega e sem risco de sinalização como spam.' },
  { Icon: IcStar, title: 'Conta empresarial verificada', desc: 'Selo de conta comercial verificada, trazendo confiança pro cliente final da escola — que sabe estar falando com o número oficial da instituição.' },
  { Icon: IcGlobe, title: 'Conformidade total com os termos da plataforma', desc: 'Toda a operação — envio, automação e atendimento — segue as políticas oficiais do WhatsApp Business Platform, sem gambiarras que colocam o número em risco.' },
]

const COMO_FUNCIONA = [
  { Icon: IcSettings, color: '#00523C', title: 'Conexão direta pelo painel', desc: 'Via Embedded Signup oficial da Meta, a escola conecta o próprio número em minutos, direto do painel Áion Edu — sem precisar copiar token nem abrir chamado de suporte técnico.' },
  { Icon: IcColumns, color: '#7C3AED', title: 'Catálogo central de templates', desc: 'Todos os modelos de mensagem aprovados ficam organizados num catálogo central, prontos pra equipe usar em qualquer conversa com as famílias.' },
  { Icon: IcUsers, color: '#2563EB', title: 'WhatsApp compartilhado entre unidades', desc: 'Redes com mais de uma escola podem operar o atendimento de forma organizada entre as unidades do grupo, com visibilidade centralizada pra gestão.' },
]

// ── Export ────────────────────────────────────────────────────────────────
export default function ParceriaMeta() {
  const r1 = useReveal()
  const r2 = useReveal()
  const r3 = useReveal()
  const r4 = useReveal()

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
        {/* Hero */}
        <section style={{
          background: `radial-gradient(ellipse 80% 60% at 15% 50%, rgba(0,82,60,0.98) 0%, transparent 65%), radial-gradient(ellipse 50% 70% at 85% 15%, rgba(0,168,150,0.25) 0%, transparent 55%), #00301F`,
          padding: '140px 48px 96px', minHeight: '75vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ maxWidth: 820, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28, animation: 'fadeIn .8s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 20, padding: '14px 26px' }}>
                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '-.02em' }}>ÁION EDU</span>
                <span style={{ width: 1, height: 22, background: 'rgba(255,255,255,.25)' }} />
                <img src={META_LOGO} alt="Meta" style={{ height: 18, filter: 'brightness(0) invert(1)' }} />
              </div>
            </div>
            <div className="tag-d" style={{ marginBottom: 24, display: 'inline-flex', animation: 'fadeIn .8s ease both' }}>
              <IcShield size={13} color="#0DD3BF" /> Parceria oficial de integração WhatsApp
            </div>
            <h1 className="s-title" style={{ fontSize: 'clamp(38px,5.5vw,68px)', color: '#fff', marginBottom: 24, animation: 'fadeUp .9s ease .1s both', lineHeight: 1.05 }}>
              Áion Edu é parceira<br />oficial da <span style={{ color: '#0DD3BF' }}>Meta</span>
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.75)', maxWidth: 620, margin: '0 auto 40px', lineHeight: 1.8, animation: 'fadeUp .9s ease .2s both' }}>
              O WhatsApp da sua escola conectado pela API Oficial WhatsApp Business — número homologado, templates aprovados e zero risco de bloqueio.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', animation: 'fadeUp .9s ease .3s both' }}>
              <a href="/#demo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>Agende uma reunião <IcArrowRight size={16} /></a>
              <a href="/" className="btn-ghost">Voltar pra página inicial</a>
            </div>
          </div>
        </section>

        {/* Por que isso importa */}
        <section className="section-pad" style={{ background: '#fff' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div ref={r1} style={{ textAlign: 'center', marginBottom: 60 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>Por que isso importa</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>
                WhatsApp oficial não é modismo.<br />É <span style={{ color: '#0DD3BF' }}>segurança pro número da escola</span>
              </h2>
              <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 620, margin: '0 auto', lineHeight: 1.8 }}>
                Ferramentas não oficiais simulam o WhatsApp Web e colocam o número da instituição em risco constante. A API Oficial da Meta elimina esse risco desde a raiz.
              </p>
            </div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
              {POR_QUE_IMPORTA.map((d, i) => (
                <RevealCard key={i} delay={`${(i % 3) + 1}`}>
                  <div className="card" style={{ padding: 28, height: '100%' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 13, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                      <d.Icon size={22} color="#00523C" />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111827', marginBottom: 11, lineHeight: 1.35 }}>{d.title}</h3>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.75 }}>{d.desc}</p>
                  </div>
                </RevealCard>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona na prática */}
        <section className="section-pad" style={{ background: '#F4F7F5' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div ref={r2} style={{ textAlign: 'center', marginBottom: 60 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>Como funciona na prática</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(32px,4vw,52px)', color: '#111827', marginBottom: 16 }}>
                Benefícios que já estão<br /><span style={{ color: '#0DD3BF' }}>na plataforma, hoje</span>
              </h2>
              <p style={{ fontSize: 16, color: '#4B5563', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
                Nada disso é promessa futura. É o que a sua escola já usa dentro do painel Áion Edu.
              </p>
            </div>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {COMO_FUNCIONA.map((e, i) => (
                <RevealCard key={i} delay={`${i + 1}`}>
                  <div className="card" style={{ padding: 36, height: '100%', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg,${e.color},${e.color}88)`, borderRadius: '20px 20px 0 0' }} />
                    <div style={{ width: 56, height: 56, borderRadius: 15, background: `${e.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                      <e.Icon size={25} color={e.color} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 13, lineHeight: 1.35 }}>{e.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{e.desc}</p>
                  </div>
                </RevealCard>
              ))}
            </div>
          </div>
        </section>

        {/* Confiança / credibilidade */}
        <section style={{ background: '#00301F', padding: '96px 48px', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div ref={r3} style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <img src={META_LOGO} alt="Meta" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 999, padding: '7px 18px', marginBottom: 28 }}>
              <IcShield size={14} color="#0DD3BF" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Parceiro Oficial de Integração WhatsApp</span>
            </div>
            <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#fff', marginBottom: 20 }}>
              Uma parceria que sustenta<br /><span style={{ color: '#0DD3BF' }}>a confiança da sua operação</span>
            </h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,.72)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.8 }}>
              Ser parceira oficial de integração WhatsApp da Meta significa número oficial homologado, atendimento centralizado de toda a equipe, histórico preservado e zero risco de bloqueio — tudo dentro das normas oficiais da plataforma.
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

        {/* CTA final */}
        <section className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 50%,#00A896 100%)', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div ref={r4} style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div className="tag-d" style={{ marginBottom: 20, display: 'inline-flex' }}>Vamos conversar?</div>
            <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#fff', marginBottom: 20 }}>
              Leve o WhatsApp oficial<br />pra sua escola
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.78)', marginBottom: 36, lineHeight: 1.8 }}>
              Agende uma reunião com o nosso time e veja como conectar o número da sua escola pela API Oficial da Meta, direto pelo painel Áion Edu.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/#demo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>
                Agendar reunião <IcArrowRight size={16} />
              </a>
              <a href="/" className="btn-ghost">Voltar pra página inicial</a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
