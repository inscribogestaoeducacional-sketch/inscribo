import React, { useEffect, useRef } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcTarget = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></Ic>
const IcBarChart = (p: any) => <Ic {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>
const IcTrendUp = (p: any) => <Ic {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ic>
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
const IcLinkedin = (p: any) => <Ic {...p}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></Ic>
const IcInstagram = (p: any) => <Ic {...p}><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></Ic>

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

function PersonCard({ name, role, bio }: { name: string; role: string; bio: string }) {
  return (
    <div className="card" style={{ padding: 36 }}>
      <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#E6F7F5', border: '2px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: 32, fontWeight: 900, color: '#00523C', fontFamily: 'Bricolage Grotesque, sans-serif' }}>
        {name[0]}
      </div>
      <h3 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{name}</h3>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#00A896', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{role}</p>
      <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8, marginBottom: 20 }}>{bio}</p>
      <div style={{ display: 'flex', gap: 10 }}>
        {[IcLinkedin, IcInstagram].map((Icon, i) => (
          <div key={i} style={{ width: 34, height: 34, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background .2s', color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#E6F7F5'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F3F4F6'}
          >
            <Icon size={15} color="#6B7280" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SobreNos() {
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
          background: `radial-gradient(ellipse 70% 60% at 20% 50%, rgba(0,82,60,0.95) 0%, transparent 60%), radial-gradient(ellipse 40% 60% at 80% 20%, rgba(0,168,150,0.2) 0%, transparent 55%), #00301F`,
          padding: '140px 48px 96px', minHeight: '65vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div className="tag-d" style={{ marginBottom: 24, display: 'inline-flex', animation: 'fadeIn .8s ease both' }}>Quem somos</div>
            <h1 className="s-title" style={{ fontSize: 'clamp(40px,5vw,64px)', color: '#fff', marginBottom: 24, animation: 'fadeUp .9s ease .1s both', lineHeight: 1.04 }}>
              Construindo o futuro das<br /><span style={{ color: '#0DD3BF' }}>escolas privadas brasileiras</span>
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.72)', maxWidth: 620, margin: '0 auto', lineHeight: 1.8, animation: 'fadeUp .9s ease .2s both' }}>
              A ÁION EDU nasceu da experiência direta com a realidade das escolas privadas brasileiras — e da convicção de que tecnologia, quando bem aplicada, transforma resultados.
            </p>
          </div>
        </section>

        {/* Nossa história */}
        <section className="section-pad" style={{ background: '#fff' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
              <div ref={r1}>
                <div className="tag-g" style={{ marginBottom: 20 }}>Nossa história</div>
                <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,42px)', color: '#111827', marginBottom: 24 }}>
                  De uma pergunta simples a uma<br /><span style={{ color: '#0DD3BF' }}>plataforma completa</span>
                </h2>
                <p style={{ fontSize: 16, color: '#4B5563', lineHeight: 1.85, marginBottom: 20 }}>
                  A ÁION EDU surgiu de uma pergunta simples: por que escolas privadas brasileiras ainda gerenciam campanhas de matrícula no improviso?
                </p>
                <p style={{ fontSize: 16, color: '#4B5563', lineHeight: 1.85, marginBottom: 20 }}>
                  Victor e Fábio, com anos de experiência em tecnologia e no mercado educacional, viram de perto o quanto escolas perdiam em matrículas por falta de processo, dados e ferramentas adequadas. Em 2024, decidiram construir a plataforma que gostariam de ter encontrado.
                </p>
                <p style={{ fontSize: 16, color: '#4B5563', lineHeight: 1.85 }}>
                  Hoje, a ÁION EDU é a plataforma mais completa para campanhas de matrícula do mercado — com CRM, WhatsApp Oficial Meta, IA e relatórios pensados especificamente para a realidade das escolas privadas brasileiras.
                </p>
              </div>

              {/* Timeline */}
              <RevealCard delay="2">
                <div className="card" style={{ padding: 36 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 28 }}>Nossa linha do tempo</h3>
                  {[
                    { year: '2024', title: 'Fundação', desc: 'Victor e Fábio fundam a ÁION Soluções Tecnológicas Ltda. em Patos, Paraíba.', color: '#00A896' },
                    { year: '2025', title: 'Lançamento', desc: 'Lançamento oficial da plataforma com CRM, WhatsApp Oficial Meta e Diagnóstico IA.', color: '#6366F1' },
                    { year: '2026', title: 'Primeiras escolas', desc: 'Colégio Ágape torna-se a primeira escola parceira, validando o produto com dados reais.', color: '#F59E0B' },
                  ].map((t, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, marginBottom: i < 2 ? 28 : 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${t.color}18`, border: `2px solid ${t.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: t.color, flexShrink: 0 }}>{t.year.slice(2)}</div>
                        {i < 2 && <div style={{ width: 2, flex: 1, background: '#E5E7EB', marginTop: 6 }} />}
                      </div>
                      <div style={{ paddingBottom: i < 2 ? 20 : 0 }}>
                        <p style={{ fontWeight: 800, color: '#111827', marginBottom: 4, fontSize: 15 }}>{t.year} — {t.title}</p>
                        <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </RevealCard>
            </div>
          </div>
        </section>

        {/* Time */}
        <section className="section-pad" style={{ background: '#F4F7F5' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div ref={r2} style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>O time</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#111827' }}>As pessoas por trás da ÁION EDU</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <RevealCard delay="1">
                <PersonCard
                  name="Victor Almeida"
                  role="Co-fundador & CTO"
                  bio="Victor é o arquiteto técnico da ÁION EDU. Com experiência em desenvolvimento de sistemas para o mercado educacional, lidera a engenharia da plataforma com foco em performance, usabilidade e inovação. É o responsável por transformar cada demanda das escolas em funcionalidades reais que resolvem problemas do dia a dia."
                />
              </RevealCard>
              <RevealCard delay="2">
                <PersonCard
                  name="Fábio Santos"
                  role="Co-fundador & CEO"
                  bio="Fábio traz a visão comercial e estratégica da ÁION EDU. Com trajetória no mercado educacional e em vendas consultivas, é o responsável por conectar a plataforma às necessidades reais das escolas — conduzindo cada demonstração com foco em resultado e construindo parcerias de longo prazo."
                />
              </RevealCard>
            </div>
          </div>
        </section>

        {/* Missão */}
        <section className="section-pad" style={{ background: '#fff' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div ref={r3} style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>Nossa missão</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#111827', maxWidth: 720, margin: '0 auto' }}>
                Transformar campanhas de matrícula que funcionam no improviso em operações{' '}
                <span style={{ color: '#0DD3BF' }}>organizadas, previsíveis e inteligentes.</span>
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {[
                { Icon: IcTarget, title: 'Processo', desc: 'Cada família acompanhada, cada lead trabalhado, cada etapa registrada.' },
                { Icon: IcBarChart, title: 'Dados', desc: 'Decisões baseadas em métricas reais, não em intuição ou achismo.' },
                { Icon: IcTrendUp, title: 'Resultado', desc: 'Mais matrículas, equipe organizada e campanha previsível campanha após campanha.' },
              ].map((v, i) => (
                <RevealCard key={i} delay={`${i + 1}`}>
                  <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                    <div style={{ width: 60, height: 60, borderRadius: 16, background: '#E6F7F5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <v.Icon size={26} color="#00523C" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 12 }}>{v.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{v.desc}</p>
                  </div>
                </RevealCard>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div ref={r4} style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <div className="tag-d" style={{ marginBottom: 20, display: 'inline-flex' }}>Vamos conversar?</div>
            <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#fff', marginBottom: 20 }}>
              Conheça a ÁION EDU na prática
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.78)', marginBottom: 36, lineHeight: 1.8 }}>
              Agende uma reunião com o nosso time e veja como a plataforma pode transformar a campanha de matrículas da sua escola.
            </p>
            <a href="/#demo" className="btn-white" style={{ fontSize: 15, padding: '16px 34px' }}>
              Agendar reunião <IcArrowRight size={16} />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
