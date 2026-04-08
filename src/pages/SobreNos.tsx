import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
.anim { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim.visible { opacity: 1; transform: none; }
.nav-link { color: #374151; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-link:hover { color: #00523C; }
@media (max-width: 768px) {
  .sobre-hero h1 { font-size: 28px !important; }
  .sobre-grid { grid-template-columns: 1fr !important; }
  .sobre-valores { grid-template-columns: 1fr 1fr !important; }
  .sobre-time { grid-template-columns: 1fr 1fr !important; }
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

function Nav() {
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #E5E7EB', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'white' }} />
        </div>
        <span style={{ fontWeight: 800, fontSize: 16, color: '#00523C' }}>Áion Edu</span>
      </Link>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <Link to="/blog" className="nav-link">Blog</Link>
        <Link to="/parceiros" className="nav-link">Parceiros</Link>
        <Link to="/login" style={{ padding: '7px 16px', background: '#00523C', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
      </div>
    </nav>
  )
}

export default function SobreNos() {
  const r1 = useAnim(), r2 = useAnim(), r3 = useAnim(), r4 = useAnim(), r5 = useAnim()

  const valores = [
    { icon: '🎯', title: 'Foco no resultado', desc: 'Cada funcionalidade existe para ajudar sua escola a matricular mais e reter melhor.' },
    { icon: '🤝', title: 'Parceria real', desc: 'Não somos só um software. Somos o time que ajuda sua escola a crescer com método.' },
    { icon: '🔍', title: 'Transparência', desc: 'Dados claros, processos visíveis. Nenhuma informação escondida, nenhum jargão desnecessário.' },
    { icon: '🇧🇷', title: '100% brasileiro', desc: 'Feito para a realidade das escolas privadas brasileiras. Suporte em português, sempre.' },
    { icon: '⚡', title: 'Inovação prática', desc: 'IA aplicada onde faz diferença real: plano de campanha, análise de saída, previsão de retenção.' },
    { icon: '🌱', title: 'Crescimento sustentável', desc: 'Acreditamos que escolas saudáveis constroem comunidades melhores.' },
  ]

  const time = [
    { inicial: 'V', nome: 'Victor', cargo: 'Co-fundador & CEO', cor: '#00523C' },
    { inicial: 'R', nome: 'Rafaela', cargo: 'Co-fundadora & Produto', cor: '#00A896' },
    { inicial: 'T', nome: 'Thiago', cargo: 'Engenharia', cor: '#6366F1' },
    { inicial: 'A', nome: 'Ana', cargo: 'Sucesso do Cliente', cor: '#F59E0B' },
  ]

  return (
    <>
      <style>{CSS}</style>
      <Nav />

      {/* Hero */}
      <section className="sobre-hero" style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', padding: '120px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Fundada em Patos, Paraíba · 2026</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 20 }}>
            Somos a Áion Edu
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Nascemos com uma missão simples: dar às escolas privadas brasileiras as ferramentas e os dados que elas precisam para crescer com consistência.
          </p>
        </div>
      </section>

      {/* Missão / Visão / História */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div ref={r1} className="sobre-grid anim" style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          <div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#00523C', marginBottom: 16 }}>Nossa história</h2>
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
            <div style={{ background: '#F0FDF9', borderRadius: 16, padding: 32, marginBottom: 20 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#00523C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Nossa missão</h3>
              <p style={{ fontSize: 16, color: '#065F46', lineHeight: 1.7 }}>
                Transformar a gestão de matrículas de escolas privadas brasileiras com processo, dados e inteligência artificial.
              </p>
            </div>
            <div style={{ background: '#EFF6FF', borderRadius: 16, padding: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Nossa visão</h3>
              <p style={{ fontSize: 16, color: '#1E40AF', lineHeight: 1.7 }}>
                Ser a plataforma de referência para gestão de matrículas em escolas privadas no Brasil.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section style={{ padding: '80px 24px', background: '#F9FAFB' }}>
        <div ref={r2} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 48 }}>Nossos valores</h2>
          <div className="sobre-valores" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {valores.map(v => (
              <div key={v.title} style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{v.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{v.title}</h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Time */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div ref={r3} className="anim" style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12 }}>Quem está por trás</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 48 }}>Um time pequeno, focado e obcecado com o problema das escolas privadas brasileiras.</p>
          <div className="sobre-time" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {time.map(p => (
              <div key={p.nome} style={{ textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: p.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 24, fontWeight: 800, color: '#fff' }}>{p.inicial}</div>
                <p style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{p.nome}</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{p.cargo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Empresa legal */}
      <section style={{ padding: '48px 24px', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
        <div ref={r4} className="anim" style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 12 }}>AION SOLUÇÕES TECNOLÓGICAS LTDA</h3>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.8 }}>
            CNPJ: 65.835.064/0001-58<br />
            R. Francisco Vicente de Araújo, 48 · Bela Vista · Patos - PB · CEP 58.704-560<br />
            contato@aionedu.com.br · (83) 9855-6393
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 24px', background: 'linear-gradient(135deg,#00523C,#00A896)', textAlign: 'center' }}>
        <div ref={r5} className="anim" style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 16 }}>Conheça a plataforma</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.85)', marginBottom: 32, lineHeight: 1.7 }}>
            Veja como a Áion Edu pode transformar a gestão de matrículas da sua escola.
          </p>
          <Link to="/#demo" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', color: '#00523C', padding: '14px 32px', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}>
            Agendar demonstração gratuita →
          </Link>
        </div>
      </section>

      {/* Rodapé simples */}
      <footer style={{ background: '#111827', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>© 2026 Áion Edu · <Link to="/privacidade" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Privacidade</Link> · <Link to="/termos" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Termos</Link></p>
      </footer>
    </>
  )
}
