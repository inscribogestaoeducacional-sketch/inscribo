import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; color: #111827; }
.anim { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim.visible { opacity: 1; transform: none; }
.parceiro-input { width: 100%; padding: 11px 14px; border-radius: 9px; border: 1.5px solid #D1D5DB; font-size: 14px; outline: none; transition: border-color 0.2s; background: #fff; font-family: 'Plus Jakarta Sans', sans-serif; }
.parceiro-input:focus { border-color: #00A896; }
.beneficio-card { background: #fff; border-radius: 16px; padding: 24px 20px; border: 1.5px solid #E5E7EB; transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s; }
.beneficio-card:hover { border-color: #00A896; box-shadow: 0 8px 28px rgba(0,168,150,0.12); transform: translateY(-3px); }
@media (max-width: 768px) {
  .parceiro-beneficios { grid-template-columns: 1fr !important; }
  .parceiro-tipos { grid-template-columns: 1fr !important; }
  .parceiro-form-grid { grid-template-columns: 1fr !important; }
  .nav-links-desktop { display: none !important; }
  .nav-mobile-btn { display: block !important; }
}
@media (max-width: 480px) {
  .footer-grid { grid-template-columns: 1fr !important; }
}
`

function useAnim() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect() } }, { threshold: 0.1 })
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
            <a key={link.href} href={link.href} style={{ color: scrolled ? '#374151' : 'rgba(255,255,255,0.9)', textDecoration: 'none', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}>{link.href === '/parceiros' ? <strong>{link.label}</strong> : link.label}</a>
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

export default function Parceiros() {
  const r1 = useAnim(), r2 = useAnim(), r3 = useAnim(), r4 = useAnim()
  const [form, setForm] = useState({ nome: '', email: '', empresa: '', cidade: '', whatsapp: '', tipo: 'consultor', mensagem: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const beneficios = [
    { icon: '💰', title: 'Comissão recorrente', desc: 'Ganhe mensalmente enquanto a escola continuar ativa. Quanto mais escolas você trouxer, maior a sua receita passiva.', color: '#10B981' },
    { icon: '🎓', title: 'Treinamento completo', desc: 'Certificação na plataforma, materiais de vendas, scripts de abordagem e acesso ao demo ilimitado para prospects.', color: '#6366F1' },
    { icon: '🤝', title: 'Suporte dedicado', desc: 'Canal direto com o time da Áion Edu para dúvidas técnicas, negociações e acompanhamento das escolas parceiras.', color: '#00A896' },
    { icon: '📱', title: 'Acesso à plataforma para demos', desc: 'Ambiente de demonstração completo para apresentar a plataforma a prospects com dados reais de exemplo.', color: '#F59E0B' },
    { icon: '🚀', title: 'Co-marketing', desc: 'Materiais co-branded, presença em eventos educacionais e oportunidades de visibilidade junto à marca Áion Edu.', color: '#8B5CF6' },
    { icon: '🔒', title: 'Proteção de território', desc: 'Cada lead que você indicar fica associado ao seu perfil pelo período de vigência da parceria.', color: '#EF4444' },
  ]

  const tipos = [
    { icon: '👨‍💼', title: 'Consultores educacionais', desc: 'Você já atende escolas privadas. Adicione a Áion Edu ao seu portfólio e gere valor imediato para seus clientes com uma plataforma de gestão de matrículas.' },
    { icon: '🏢', title: 'Agências e integradores', desc: 'Você oferece marketing, tecnologia ou gestão para escolas. A Áion Edu complementa seu serviço com o CRM e a inteligência de matrículas.' },
    { icon: '📡', title: 'Parceiros de WhatsApp Business', desc: 'Você trabalha com API do Meta e comunicação para escolas. A Áion Edu integra nativamente e você pode oferecer a plataforma completa para seus clientes.' },
  ]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.whatsapp) { setErr('Preencha nome, e-mail e WhatsApp.'); return }
    setSending(true); setErr(null)
    try {
      await supabase.from('demo_requests').insert({
        name: form.nome,
        email: form.email,
        school_name: form.empresa || 'Parceiro',
        city: form.cidade,
        whatsapp: form.whatsapp,
        message: `[PARCEIRO - ${form.tipo.toUpperCase()}] ${form.mensagem}`,
        type: 'parceiro',
      })
      setSent(true)
      const msg = encodeURIComponent(`Olá! Sou ${form.nome} e tenho interesse em ser parceiro Áion Edu (${form.tipo}). Empresa: ${form.empresa || '—'}. Cidade: ${form.cidade || '—'}.`)
      window.open(`https://wa.me/5583933444383?text=${msg}`, '_blank')
    } catch {
      setErr('Erro ao enviar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#00523C 0%,#006B50 45%,#00A896 100%)', padding: '120px 24px 80px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 720, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Programa de Parceiros · Áion Edu</span>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 20, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
            Seja um parceiro Áion Edu
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto' }}>
            Para consultores educacionais, integradores e agências que atendem escolas privadas. Gere receita recorrente indicando a Áion Edu.
          </p>
        </div>
      </section>

      {/* Para quem é */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div ref={r1} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Para quem é o programa?</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 48 }}>Qualquer profissional ou empresa que tenha acesso a gestores de escolas privadas.</p>
          <div className="parceiro-tipos" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {tipos.map(t => (
              <div key={t.title} style={{ background: '#F9FAFB', borderRadius: 20, padding: 28, border: '1.5px solid #E5E7EB', transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#00A896'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 28px rgba(0,168,150,0.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB'; (e.currentTarget as HTMLElement).style.boxShadow = ''; (e.currentTarget as HTMLElement).style.transform = '' }}
              >
                <div style={{ fontSize: 36, marginBottom: 14 }}>{t.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 10 }}>{t.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefícios */}
      <section style={{ padding: '80px 24px', background: '#F9FAFB' }}>
        <div ref={r2} className="anim" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 48, fontFamily: 'Bricolage Grotesque, sans-serif' }}>O que você ganha</h2>
          <div className="parceiro-beneficios" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {beneficios.map(b => (
              <div key={b.title} className="beneficio-card">
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `${b.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 14, border: `1px solid ${b.color}30` }}>
                  {b.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{b.title}</h3>
                <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7 }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section style={{ padding: '80px 24px', background: '#fff' }}>
        <div ref={r3} className="anim" style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 48, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Como funciona</h2>
          {[
            { num: '①', title: 'Cadastre-se', desc: 'Preencha o formulário abaixo. Nossa equipe entra em contato em até 2 horas para apresentar o programa.' },
            { num: '②', title: 'Treinamento e certificação', desc: 'Acesso à plataforma demo, materiais de vendas e onboarding com o time da Áion Edu.' },
            { num: '③', title: 'Indique e ganhe', desc: 'Cada escola que você indicar e se tornar cliente gera comissão recorrente para você enquanto a conta estiver ativa.' },
          ].map(s => (
            <div key={s.num} style={{ display: 'flex', gap: 20, textAlign: 'left', marginBottom: 32 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20, fontWeight: 800, color: '#fff' }}>{s.num}</div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Formulário */}
      <section id="form" style={{ padding: '80px 24px', background: 'linear-gradient(135deg,#00523C,#00A896)' }}>
        <div ref={r4} className="anim" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 8, fontFamily: 'Bricolage Grotesque, sans-serif' }}>Quero ser parceiro</h2>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 40 }}>Preencha e nossa equipe entra em contato em até 2 horas.</p>

          {sent ? (
            <div style={{ background: '#fff', borderRadius: 16, padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#00523C', marginBottom: 12 }}>Interesse registrado!</h3>
              <p style={{ color: '#374151', lineHeight: 1.7 }}>Recebemos seu interesse. Nossa equipe vai entrar em contato via WhatsApp em breve.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: 40 }}>
              <div className="parceiro-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nome *</label>
                  <input className="parceiro-input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Seu nome completo" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>E-mail *</label>
                  <input className="parceiro-input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Empresa / Nome profissional</label>
                  <input className="parceiro-input" value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} placeholder="Sua consultoria ou agência" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cidade / Estado</label>
                  <input className="parceiro-input" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: João Pessoa/PB" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp *</label>
                  <input className="parceiro-input" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="(83) 9xxxx-xxxx" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tipo de parceiro</label>
                  <select className="parceiro-input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="consultor">Consultor educacional</option>
                    <option value="agencia">Agência / Integradora</option>
                    <option value="whatsapp">Parceiro WhatsApp Business</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Conte um pouco sobre você</label>
                <textarea className="parceiro-input" rows={3} value={form.mensagem} onChange={e => setForm(f => ({ ...f, mensagem: e.target.value }))} placeholder="Quantas escolas você atende? Qual seu principal serviço hoje?" style={{ resize: 'vertical' }} />
              </div>
              {err && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 12 }}>{err}</p>}
              <button type="submit" disabled={sending} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#00523C,#00A896)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                {sending ? 'Enviando...' : 'Quero ser parceiro →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>Sem compromisso · Resposta em até 2 horas</p>
            </form>
          )}
        </div>
      </section>

      <Footer />
    </>
  )
}
