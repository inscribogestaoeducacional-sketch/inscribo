import React, { useState, useEffect, useRef } from 'react'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #111827; }
.anim { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim.visible { opacity: 1; transform: none; }
@media (max-width: 768px) {
  .sobre-hero h1 { font-size: 28px !important; }
  .sobre-grid { grid-template-columns: 1fr !important; }
  .sobre-valores { grid-template-columns: 1fr 1fr !important; }
  .sobre-time { grid-template-columns: 1fr 1fr !important; }
  .sobre-timeline { grid-template-columns: 1fr !important; }
  .nav-links-desktop { display: none !important; }
  .nav-mobile-btn { display: block !important; }
}
@media (max-width: 480px) {
  .footer-grid { grid-template-columns: 1fr !important; }
  .sobre-valores { grid-template-columns: 1fr !important; }
}
`

function useAnim() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() } }, { threshold: 0.12 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

// ─── NAVBAR ─────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000, background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none', boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.3s ease', padding: '0 24px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <img src="/aion-logo-full.png" alt="ÁION EDU" style={{ height: 36, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('style') }} />
          <span style={{ display: 'none', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 20, color: scrolled ? '#00523C' : 'white' }}>ÁION EDU</span>
        </a>
        <div className="nav-links-desktop" style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[{ href: '/', label: 'Início' }, { href: '/#modulos', label: 'Módulos' }, { href: '/#como-funciona', label: 'Como funciona' }, { href: '/blog', label: 'Blog' }, { href: '/sobre', label: 'Sobre' }, { href: '/parceiros', label: 'Parceiros' }].map(link => (
            <a key={link.href} href={link.href} style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}>{link.label}</a>
          ))}
          <a href="/#demo" style={{ background: '#00A896', color: 'white', padding: '8px 20px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Agendar demo</a>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="nav-mobile-btn" style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: scrolled ? '#111827' : 'white' }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
      {menuOpen && (
        <div style={{ background: 'white', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[{ href: '/', label: 'Início' }, { href: '/blog', label: 'Blog' }, { href: '/sobre', label: 'Sobre' }, { href: '/parceiros', label: 'Parceiros' }].map(link => (
            <a key={link.href} href={link.href} style={{ color: '#374151', textDecoration: 'none', fontSize: 15, fontWeight: 500 }}>{link.label}</a>
          ))}
          <a href="/#demo" style={{ background: '#00A896', color: 'white', padding: '10px 20px', borderRadius: 20, textDecoration: 'none', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>Agendar demo</a>
        </div>
      )}
    </nav>
  )
}

// ─── FOOTER ─────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#00523C', color: 'white', padding: '60px 24px 32px' }}>
      <div className="footer-grid" style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 48 }}>
        <div>
          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 22, marginBottom: 12 }}>ÁION EDU</div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>A plataforma inteligente para campanhas de matrícula escolar.</p>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>CNPJ: 65.835.064/0001-58<br/>Patos, Paraíba — Brasil</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Produto</div>
          {['Módulos', 'Como funciona', 'Implantação', 'Parceiros'].map(item => (
            <div key={item} style={{ marginBottom: 10 }}><a href="#" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item}</a></div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Empresa</div>
          {[{ label: 'Sobre nós', href: '/sobre' }, { label: 'Blog', href: '/blog' }, { label: 'Parceiros', href: '/parceiros' }].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}><a href={item.href} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item.label}</a></div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 14 }}>Legal</div>
          {[{ label: 'Privacidade', href: '/privacidade' }, { label: 'Termos de uso', href: '/termos' }].map(item => (
            <div key={item.label} style={{ marginBottom: 10 }}><a href={item.href} style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>{item.label}</a></div>
          ))}
          <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            WhatsApp:<br/><a href="https://wa.me/5583933444383" style={{ color: '#0DD3BF', textDecoration: 'none' }}>(83) 9344-4383</a>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>© 2026 ÁION Soluções Tecnológicas Ltda. Todos os direitos reservados.</span>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Feito com 💚 no sertão paraibano</span>
      </div>
    </footer>
  )
}

export default function SobreNos() {
  const r1 = useAnim(), r2 = useAnim(), r3 = useAnim(), r4 = useAnim(), r5 = useAnim(), r6 = useAnim()

  const valores = [
    { icon: '🎯', title: 'Foco no resultado', desc: 'Cada funcionalidade existe para ajudar sua escola a matricular mais e reter melhor. Sem funcionalidade de vitrine.', gradient: 'linear-gradient(135deg,#E6F7F5,#F0FDF9)' },
    { icon: '🤝', title: 'Parceria real', desc: 'Não somos só um software. Somos o time que ajuda sua escola a crescer com método e acompanhamento contínuo.', gradient: 'linear-gradient(135deg,#EEF2FF,#F5F3FF)' },
    { icon: '🔍', title: 'Transparência', desc: 'Dados claros, processos visíveis. Nenhuma informação escondida, nenhum jargão desnecessário com o cliente.', gradient: 'linear-gradient(135deg,#FEF3C7,#FFFBEB)' },
    { icon: '🇧🇷', title: '100% brasileiro', desc: 'Feito para a realidade das escolas privadas brasileiras. LGPD, INEP, ERPs nacionais — suporte em português, sempre.', gradient: 'linear-gradient(135deg,#ECFDF5,#F0FDF4)' },
    { icon: '⚡', title: 'Inovação prática', desc: 'IA aplicada onde faz diferença real: plano de campanha, análise de saída, previsão de retenção e score de leads.', gradient: 'linear-gradient(135deg,#FEF2F2,#FFF1F2)' },
    { icon: '🌱', title: 'Crescimento sustentável', desc: 'Acreditamos que escolas saudáveis constroem comunidades melhores. Crescer com dados é crescer de forma duradoura.', gradient: 'linear-gradient(135deg,#E6F7F5,#ECFDF5)' },
  ]

  const time = [
    { inicial: 'V', nome: 'Victor Almeida', cargo: 'Co-fundador & CEO', bio: 'Produto, estratégia e visão de mercado', cor: '#00523C', linkedin: '#' },
    { inicial: 'R', nome: 'Rafaela Costa', cargo: 'Co-fundadora & Produto', bio: 'UX, pesquisa e jornada do cliente', cor: '#00A896', linkedin: '#' },
    { inicial: 'T', nome: 'Thiago Melo', cargo: 'Engenharia', bio: 'Arquitetura, backend e integrações', cor: '#6366F1', linkedin: '#' },
    { inicial: 'A', nome: 'Ana Bezerra', cargo: 'Sucesso do Cliente', bio: 'Onboarding, suporte e retenção', cor: '#F59E0B', linkedin: '#' },
  ]

  const timeline = [
    { year: '2024', label: 'Ideia nasceu em Patos/PB', desc: 'Observamos de perto escolas privadas gerenciando matrículas em planilhas e grupos de WhatsApp.', color: '#00A896' },
    { year: '2025', label: 'Primeiro cliente — Ágape', desc: 'Colégio Ágape se tornou o primeiro cliente e provou o conceito da plataforma em uma campanha real.', color: '#6366F1' },
    { year: '2026', label: 'Lançamento oficial', desc: 'Plataforma completa com CRM, WhatsApp Oficial, IA e relatórios disponível para escolas de todo o Brasil.', color: '#F59E0B' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* Hero */}
      <section className="sobre-hero" style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 45%,#00A896 100%)', padding: '120px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Fundada em Patos, Paraíba · 2024</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 20, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Somos a Áion Edu
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Nascemos com uma missão simples: dar às escolas privadas brasileiras as ferramentas e os dados que elas precisam para crescer com consistência.
          </p>
        </div>
      </section>

      {/* Missão destacada */}
      <section style={{ padding: '0 24px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', transform: 'translateY(-32px)' }}>
          <div style={{ background: '#00523C', borderRadius: 20, padding: '40px 48px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,82,60,0.25)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Nossa missão</div>
            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
              "Transformar campanhas de matrícula que hoje funcionam no improviso em operações organizadas, previsíveis e inteligentes."
            </p>
          </div>
        </div>
      </section>

      {/* História */}
      <section style={{ padding: '20px 24px 80px' }}>
        <div ref={r1} className="sobre-grid anim" style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#00523C', marginBottom: 16, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Nossa história</h2>
            <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.8, marginBottom: 16 }}>
              A Áion Edu surgiu de uma observação simples: escolas privadas brasileiras enfrentam campanhas de matrículas cada vez mais competitivas, mas ainda gerenciam tudo em planilhas e grupos de WhatsApp.
            </p>
            <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.8, marginBottom: 16 }}>
              A partir de Patos, no sertão da Paraíba, desenvolvemos uma plataforma que integra CRM, WhatsApp, inteligência artificial e relatórios em um único sistema — feito especificamente para o jeito que as escolas privadas brasileiras funcionam.
            </p>
            <p style={{ fontSize: 15, color: '#374151', lineHeight: 1.8 }}>
              Hoje trabalhamos lado a lado com gestores escolares para que cada campanha de matrículas seja planejada, executada e analisada com dados reais.
            </p>
          </div>
          <div>
            <div style={{ background: '#F0FDF9', borderRadius: 16, padding: 32, marginBottom: 20, border: '1px solid #A7F3D0' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#00523C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Nossa visão</h3>
              <p style={{ fontSize: 16, color: '#065F46', lineHeight: 1.7 }}>
                Ser a plataforma de referência para gestão de matrículas em escolas privadas no Brasil.
              </p>
            </div>
            <div style={{ background: '#FAFAFA', borderRadius: 16, padding: 32, border: '1px solid #E5E7EB' }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Localização</h3>
              <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
                AION SOLUÇÕES TECNOLÓGICAS LTDA<br/>
                CNPJ: 65.835.064/0001-58<br/>
                R. Francisco Vicente de Araújo, 48 · Bela Vista<br/>
                Patos - PB · CEP 58.704-560
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding: '80px 24px', background: '#F9FAFB' }}>
        <div ref={r2} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Nossa jornada</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 52 }}>Do sertão paraibano para o Brasil.</p>
          <div className="sobre-timeline" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {timeline.map((item, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 28, border: '1px solid #E5E7EB', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: item.color, borderRadius: '16px 16px 0 0' }} />
                <div style={{ fontSize: 36, fontWeight: 900, color: item.color, fontFamily: 'Bricolage Grotesque, sans-serif', marginBottom: 8, lineHeight: 1 }}>{item.year}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{item.label}</h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Valores */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div ref={r3} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Nossos valores</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 48 }}>Os princípios que guiam cada decisão de produto e de negócio.</p>
          <div className="sobre-valores" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {valores.map(v => (
              <div key={v.title} style={{ background: v.gradient, borderRadius: 16, padding: '28px 24px', border: '1px solid #E5E7EB', transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '' }}
              >
                <div style={{ fontSize: 36, marginBottom: 14 }}>{v.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{v.title}</h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Time */}
      <section style={{ padding: '80px 24px', background: '#F9FAFB' }}>
        <div ref={r4} className="anim" style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Quem está por trás</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 52 }}>Um time pequeno, focado e obcecado com o problema das escolas privadas brasileiras.</p>
          <div className="sobre-time" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 28 }}>
            {time.map(p => (
              <div key={p.nome} style={{ textAlign: 'center', background: '#fff', borderRadius: 16, padding: '28px 16px', border: '1px solid #E5E7EB' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg,${p.cor},${p.cor}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 24, fontWeight: 800, color: '#fff', boxShadow: `0 8px 24px ${p.cor}40` }}>
                  {p.inicial}
                </div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{p.nome}</p>
                <p style={{ fontSize: 12, color: p.cor, fontWeight: 600, marginBottom: 6 }}>{p.cargo}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 12, lineHeight: 1.5 }}>{p.bio}</p>
                <a href={p.linkedin} style={{ fontSize: 11, color: '#0077B5', textDecoration: 'none', fontWeight: 600 }}>LinkedIn →</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg,#00523C,#00A896)', textAlign: 'center' }}>
        <div ref={r5} className="anim" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 16, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Conheça a plataforma</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 32, lineHeight: 1.7 }}>
            Veja como a Áion Edu pode transformar a gestão de matrículas da sua escola.
          </p>
          <a href="/#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#00523C', padding: '14px 32px', borderRadius: 12, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            Agendar demonstração gratuita →
          </a>
        </div>
      </section>

      <Footer />
    </>
  )
}
