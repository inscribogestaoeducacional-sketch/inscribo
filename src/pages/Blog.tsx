import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
const IcArrowLeft = (p: any) => <Ic {...p}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Ic>
const IcBarChart = (p: any) => <Ic {...p}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Ic>
const IcMsg = (p: any) => <Ic {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></Ic>
const IcCpu = (p: any) => <Ic {...p}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /></Ic>
const IcTrendUp = (p: any) => <Ic {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ic>
const IcGlobe = (p: any) => <Ic {...p}><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /></Ic>

function injectCSS() {
  const el = document.createElement('style')
  el.id = 'aion-css'
  el.textContent = SHARED_CSS
  if (!document.getElementById('aion-css')) document.head.appendChild(el)
  return () => { document.getElementById('aion-css')?.remove() }
}

const POSTS = [
  { slug: 'funil-de-matriculas', cat: 'Matrículas', catColor: '#00A896', title: 'Como estruturar o funil de matrículas da sua escola em 5 passos', desc: 'Da captação de leads até a assinatura do contrato — um guia prático para gestores que querem sair do improviso e criar um processo replicável.', date: '15 Mai 2026', Icon: IcTrendUp, bg: '#E6F7F5', ic: '#00523C' },
  { slug: 'whatsapp-oficial-vs-pessoal', cat: 'WhatsApp', catColor: '#25D366', title: 'WhatsApp Oficial vs WhatsApp pessoal: qual o risco para sua escola?', desc: 'Usar o celular pessoal da secretária para atender famílias pode custar caro. Entenda os riscos legais, operacionais e de imagem.', date: '8 Mai 2026', Icon: IcMsg, bg: '#E8F5E9', ic: '#25D366' },
  { slug: 'ia-plano-de-campanha', cat: 'IA', catColor: '#EA580C', title: 'Como a IA pode criar o plano de campanha de matrícula da sua escola', desc: 'Em menos de 10 minutos, a inteligência artificial pode gerar metas mensais, CPA sugerido e calendário de captação com base nos seus dados reais.', date: '2 Mai 2026', Icon: IcCpu, bg: '#FFF7ED', ic: '#EA580C' },
  { slug: 'relatorio-mensal-de-campanha', cat: 'Gestão', catColor: '#2563EB', title: 'Relatório mensal de campanha: por que seu gestor precisa dele', desc: 'Sem dados, decisão é chute. Entenda como um relatório mensal bem estruturado pode mudar o resultado da sua campanha de matrículas.', date: '24 Abr 2026', Icon: IcBarChart, bg: '#EFF6FF', ic: '#2563EB' },
  { slug: 'market-share-escolar', cat: 'Mercado', catColor: '#7C3AED', title: 'Market share escolar: você sabe qual é a fatia da sua escola na cidade?', desc: 'Cruzando dados do IBGE e do Censo Escolar, é possível calcular o potencial real de captação da sua região. Veja como fazer.', date: '18 Abr 2026', Icon: IcGlobe, bg: '#EDE9FE', ic: '#7C3AED' },
  { slug: 'nps-em-escolas', cat: 'Gestão', catColor: '#2563EB', title: 'NPS em escolas: como medir satisfação e evitar cancelamentos', desc: 'Identificar insatisfação antes que vire cancelamento pode salvar dezenas de matrículas por ano. Veja como implementar o NPS na sua escola.', date: '10 Abr 2026', Icon: IcBarChart, bg: '#EFF6FF', ic: '#2563EB' },
]

const CATS = ['Todos', 'Matrículas', 'WhatsApp', 'Gestão', 'IA', 'Mercado']

export default function Blog() {
  const [active, setActive] = useState('Todos')

  useEffect(() => injectCSS(), [])

  const filtered = active === 'Todos' ? POSTS : POSTS.filter(p => p.cat === active)

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section style={{ background: `radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,82,60,0.95) 0%, transparent 65%), #00301F`, padding: '140px 48px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tag-d" style={{ display: 'inline-flex', marginBottom: 24 }}>Blog ÁION EDU</div>
            <h1 className="s-title" style={{ fontSize: 'clamp(36px,5vw,60px)', color: '#fff', marginBottom: 20 }}>
              Conteúdo estratégico para<br /><span style={{ color: '#0DD3BF' }}>gestores de escolas privadas</span>
            </h1>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,.7)', maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
              Matrículas, WhatsApp, gestão, IA e mercado educacional — tudo que você precisa saber para liderar sua campanha com confiança.
            </p>
          </div>
        </section>

        {/* Posts */}
        <section className="section-pad" style={{ background: '#F4F7F5' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 48, flexWrap: 'wrap', justifyContent: 'center' }}>
              {CATS.map(cat => (
                <button key={cat} onClick={() => setActive(cat)} style={{ padding: '9px 20px', borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid transparent', transition: 'all .2s', fontFamily: 'Plus Jakarta Sans, sans-serif', background: active === cat ? '#E6F7F5' : '#fff', color: active === cat ? '#00523C' : '#6B7280', borderColor: active === cat ? '#A7F3D0' : '#E5E7EB' }}>
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {filtered.map((post, i) => (
                <article key={post.slug} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Image placeholder */}
                  <div style={{ height: 200, background: post.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <post.Icon size={48} color={post.ic} />
                  </div>
                  <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: post.catColor, background: `${post.catColor}15`, padding: '4px 12px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.06em' }}>{post.cat}</span>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>{post.date}</span>
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: '#111827', marginBottom: 12, lineHeight: 1.45 }}>{post.title}</h2>
                    <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.75, flex: 1, marginBottom: 20 }}>{post.desc}</p>
                    <a href={`/blog/${post.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#00A896', textDecoration: 'none' }}>
                      Ler mais <IcArrowRight size={14} color="#00A896" />
                    </a>
                  </div>
                </article>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#6B7280', fontSize: 16 }}>
                Nenhum artigo nessa categoria ainda. Em breve!
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <button className="btn-outline-green" style={{ fontSize: 14, padding: '13px 28px' }}>
                Ver mais artigos
              </button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

// ── BlogPost ──────────────────────────────────────────────────────────────
export function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const post = POSTS.find(p => p.slug === slug)

  useEffect(() => injectCSS(), [])

  if (!post) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '140px 24px 80px' }}>
          <p style={{ fontSize: 18, color: '#6B7280' }}>Artigo não encontrado.</p>
          <a href="/blog" className="btn-g">Voltar ao Blog</a>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main>
        <section style={{ background: '#00301F', padding: '140px 48px 60px', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <a href="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,.65)', textDecoration: 'none', fontSize: 14, marginBottom: 28, fontWeight: 600 }}>
              <IcArrowLeft size={15} color="rgba(255,255,255,.65)" /> Voltar ao Blog
            </a>
            <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 800, color: post.catColor, background: `${post.catColor}20`, padding: '4px 14px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 20 }}>{post.cat}</span>
            <h1 className="s-title" style={{ fontSize: 'clamp(28px,4vw,48px)', color: '#fff', marginBottom: 16, lineHeight: 1.1 }}>{post.title}</h1>
            <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13 }}>{post.date}</p>
          </div>
        </section>

        <section style={{ padding: '72px 48px 112px', background: '#fff' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ height: 280, background: post.bg, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 56 }}>
              <post.Icon size={80} color={post.ic} />
            </div>
            <p style={{ fontSize: 18, color: '#4B5563', lineHeight: 1.9, marginBottom: 28, fontWeight: 500 }}>{post.desc}</p>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.9, marginBottom: 24 }}>
              Este artigo está sendo preparado pela equipe ÁION EDU e será publicado em breve com conteúdo completo, exemplos práticos e dados do mercado educacional brasileiro.
            </p>
            <p style={{ fontSize: 16, color: '#6B7280', lineHeight: 1.9, marginBottom: 40 }}>
              Enquanto isso, agende uma conversa com nosso time para ver como a ÁION EDU pode ajudar a sua escola a melhorar os resultados da campanha de matrículas.
            </p>
            <a href="/#demo" className="btn-g">Agendar reunião <IcArrowRight size={16} /></a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
