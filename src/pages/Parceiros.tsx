import React, { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { SHARED_CSS } from '../styles/sharedCSS'

function Ic({ children, size = 20, color = 'currentColor', stroke = 1.8 }: { children: React.ReactNode; size?: number; color?: string; stroke?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{children}</svg>
}
const IcTrendUp = (p: any) => <Ic {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></Ic>
const IcUsers = (p: any) => <Ic {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Ic>
const IcShield = (p: any) => <Ic {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Ic>
const IcArrowRight = (p: any) => <Ic {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ic>
const IcCheck = (p: any) => <Ic {...p}><polyline points="20 6 9 17 4 12" /></Ic>

export default function Parceiros() {
  const [form, setForm] = useState({ nome: '', email: '', whatsapp: '', cidade: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'aion-css'
    el.textContent = SHARED_CSS
    if (!document.getElementById('aion-css')) document.head.appendChild(el)
    return () => { document.getElementById('aion-css')?.remove() }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nome || !form.email || !form.whatsapp) { setErr('Preencha os campos obrigatórios.'); return }
    setSending(true); setErr(null)
    try {
      await new Promise(r => setTimeout(r, 1000))
      setSent(true)
    } catch {
      setErr('Erro ao enviar. Tente novamente.')
    } finally { setSending(false) }
  }

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section style={{ background: `radial-gradient(ellipse 70% 60% at 50% 50%, rgba(0,82,60,0.95) 0%, transparent 65%), #00301F`, padding: '140px 48px 96px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto' }}>
            <div className="tag-d" style={{ display: 'inline-flex', marginBottom: 24 }}>Programa de parceiros</div>
            <h1 className="s-title" style={{ fontSize: 'clamp(38px,5vw,64px)', color: '#fff', marginBottom: 20 }}>
              Seja um parceiro<br /><span style={{ color: '#0DD3BF' }}>ÁION EDU</span>
            </h1>
            <p style={{ fontSize: 18, color: 'rgba(255,255,255,.72)', maxWidth: 600, margin: '0 auto', lineHeight: 1.8 }}>
              Leve a plataforma mais completa de campanhas de matrícula para escolas de todo o Brasil — e construa uma receita recorrente sólida.
            </p>
          </div>
        </section>

        {/* Benefícios */}
        <section className="section-pad" style={{ background: '#F4F7F5' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>Por que ser parceiro</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#111827', marginBottom: 14 }}>
                Construa um negócio recorrente com a<br /><span style={{ color: '#0DD3BF' }}>plataforma certa</span>
              </h2>
            </div>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {[
                { Icon: IcTrendUp, color: '#00A896', bg: '#E6F7F5', title: 'Receita recorrente', desc: 'Comissão mensal por cada escola ativa na plataforma. Quanto mais você cresce, mais você ganha — sem teto.' },
                { Icon: IcUsers, color: '#6366F1', bg: '#EDE9FE', title: 'Suporte completo', desc: 'Treinamento, materiais de venda, apoio comercial e consultoria da nossa equipe em cada negociação.' },
                { Icon: IcShield, color: '#EA580C', bg: '#FFF7ED', title: 'Marca reconhecida', desc: 'Parceiro oficial de uma plataforma certificada Meta e reconhecida no mercado educacional brasileiro.' },
              ].map((b, i) => (
                <div key={i} className="card" style={{ padding: 36, textAlign: 'center' }}>
                  <div style={{ width: 60, height: 60, borderRadius: 16, background: b.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <b.Icon size={28} color={b.color} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 12 }}>{b.title}</h3>
                  <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="section-pad" style={{ background: '#fff' }}>
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 52 }}>
              <div className="tag-g" style={{ marginBottom: 20 }}>Como funciona</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#111827' }}>
                3 passos para começar
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { num: '01', title: 'Cadastre seu interesse', desc: 'Preencha o formulário abaixo. Nossa equipe vai entrar em contato em até 24 horas para apresentar o programa completo.' },
                { num: '02', title: 'Treinamento e onboarding', desc: 'Você recebe acesso à plataforma, materiais de apresentação, precificação e treinamento de vendas com nossa equipe.' },
                { num: '03', title: 'Indique escolas e receba', desc: 'Para cada escola ativa na plataforma que você indicar, você recebe comissão mensal recorrente enquanto ela permanecer ativa.' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 24, padding: '28px 0', borderBottom: i < 2 ? '1px solid #E5E7EB' : 'none' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#E6F7F5', border: '2px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#00523C', flexShrink: 0, fontFamily: 'Bricolage Grotesque, sans-serif' }}>
                    {s.num}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 8 }}>{s.title}</h3>
                    <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.8 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Formulário */}
        <section className="section-pad" style={{ background: 'linear-gradient(135deg,#00523C,#00A896)', position: 'relative', overflow: 'hidden' }}>
          <div className="grid-pattern" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
          <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 44 }}>
              <div className="tag-d" style={{ display: 'inline-flex', marginBottom: 20 }}>Cadastro</div>
              <h2 className="s-title" style={{ fontSize: 'clamp(28px,3.5vw,44px)', color: '#fff', marginBottom: 16 }}>
                Quero ser parceiro ÁION EDU
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(255,255,255,.75)', lineHeight: 1.8 }}>
                Preencha o formulário e nossa equipe entrará em contato para apresentar todos os detalhes do programa.
              </p>
            </div>

            {sent ? (
              <div style={{ background: '#fff', borderRadius: 24, padding: '48px 40px', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <IcCheck size={26} color="#10B981" stroke={2.5} />
                </div>
                <h3 className="s-title" style={{ fontSize: 24, color: '#00523C', marginBottom: 12 }}>Cadastro recebido!</h3>
                <p style={{ color: '#374151', lineHeight: 1.8, fontSize: 15 }}>Nossa equipe vai entrar em contato em até 24 horas para apresentar o programa completo.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 24, padding: '40px', boxShadow: '0 28px 72px rgba(0,0,0,.18)' }}>
                {[
                  { key: 'nome', label: 'Nome completo *', ph: 'Seu nome', type: 'text' },
                  { key: 'email', label: 'E-mail *', ph: 'seu@email.com', type: 'email' },
                  { key: 'whatsapp', label: 'WhatsApp *', ph: '(xx) 9xxxx-xxxx', type: 'text' },
                  { key: 'cidade', label: 'Cidade / Estado', ph: 'Ex: Recife/PE', type: 'text' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 18 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.07em' }}>{f.label}</label>
                    <input className="inp" type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph} />
                  </div>
                ))}
                {err && <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 14 }}>{err}</p>}
                <button type="submit" disabled={sending} className="btn-g" style={{ width: '100%', justifyContent: 'center', fontSize: 15, padding: '17px 0', opacity: sending ? .7 : 1 }}>
                  {sending ? 'Enviando...' : 'Quero ser parceiro →'}
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>Retorno em até 24 horas · Sem compromisso</p>
              </form>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
