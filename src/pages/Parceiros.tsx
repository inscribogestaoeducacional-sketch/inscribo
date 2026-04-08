import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
.anim { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
.anim.visible { opacity: 1; transform: none; }
.nav-link { color: #374151; text-decoration: none; font-size: 14px; font-weight: 500; transition: color 0.2s; }
.nav-link:hover { color: #00523C; }
.parceiro-input { width: 100%; padding: 11px 14px; border-radius: 9px; border: 1.5px solid #D1D5DB; font-size: 14px; outline: none; transition: border-color 0.2s; background: #fff; }
.parceiro-input:focus { border-color: #00A896; }
@media (max-width: 768px) {
  .parceiro-beneficios { grid-template-columns: 1fr !important; }
  .parceiro-tipos { grid-template-columns: 1fr !important; }
  .parceiro-form-grid { grid-template-columns: 1fr !important; }
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
        <Link to="/sobre" className="nav-link">Sobre</Link>
        <Link to="/blog" className="nav-link">Blog</Link>
        <Link to="/login" style={{ padding: '7px 16px', background: '#00523C', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Entrar</Link>
      </div>
    </nav>
  )
}

export default function Parceiros() {
  const r1 = useAnim(), r2 = useAnim(), r3 = useAnim(), r4 = useAnim()
  const [form, setForm] = useState({ nome: '', email: '', empresa: '', cidade: '', whatsapp: '', tipo: 'consultor', mensagem: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const beneficios = [
    { icon: '💰', title: 'Comissão recorrente', desc: 'Ganhe mensalmente enquanto a escola continuar ativa. Quanto mais escolas você trouxer, maior a sua receita passiva.' },
    { icon: '🎓', title: 'Treinamento completo', desc: 'Certificação na plataforma, materiais de vendas, scripts de abordagem e acesso ao demo ilimitado para prospects.' },
    { icon: '🤝', title: 'Suporte dedicado', desc: 'Canal direto com o time da Áion Edu para dúvidas técnicas, negociações e acompanhamento das escolas parceiras.' },
    { icon: '📊', title: 'Dashboard do parceiro', desc: 'Visibilidade total das escolas que você indicou — status, saúde da conta, renovações e comissões.' },
    { icon: '🚀', title: 'Co-marketing', desc: 'Materiais co-branded, presença em eventos educacionais e oportunidades de visibilidade junto à marca Áion Edu.' },
    { icon: '🔒', title: 'Proteção de território', desc: 'Cada lead que você indicar fica associado ao seu perfil pelo período de vigência da parceria.' },
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
      window.open(`https://wa.me/5583985556393?text=${msg}`, '_blank')
    } catch {
      setErr('Erro ao enviar. Tente novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <Nav />

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', padding: '120px 24px 80px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.15)', borderRadius: 999, padding: '6px 16px', marginBottom: 20 }}>
            <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600 }}>Programa de Parceiros · Áion Edu</span>
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 20 }}>
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
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 12 }}>Para quem é o programa?</h2>
          <p style={{ textAlign: 'center', color: '#6B7280', fontSize: 15, marginBottom: 48 }}>Qualquer profissional ou empresa que tenha acesso a gestores de escolas privadas.</p>
          <div className="parceiro-tipos" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {tipos.map(t => (
              <div key={t.title} style={{ background: '#F9FAFB', borderRadius: 16, padding: 28, border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>{t.icon}</div>
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
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 48 }}>O que você ganha</h2>
          <div className="parceiro-beneficios" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {beneficios.map(b => (
              <div key={b.title} style={{ background: '#fff', borderRadius: 14, padding: '24px 20px', border: '1px solid #E5E7EB' }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{b.icon}</div>
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
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 48 }}>Como funciona</h2>
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
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 8 }}>Quero ser parceiro</h2>
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
              <button type="submit" disabled={sending} style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg,#00523C,#00A896)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.7 : 1 }}>
                {sending ? 'Enviando...' : 'Quero ser parceiro →'}
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>Sem compromisso · Resposta em até 2 horas</p>
            </form>
          )}
        </div>
      </section>

      <footer style={{ background: '#111827', padding: '32px 24px', textAlign: 'center' }}>
        <p style={{ color: '#9CA3AF', fontSize: 13 }}>© 2026 Áion Edu · <Link to="/privacidade" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Privacidade</Link> · <Link to="/termos" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Termos</Link></p>
      </footer>
    </>
  )
}
