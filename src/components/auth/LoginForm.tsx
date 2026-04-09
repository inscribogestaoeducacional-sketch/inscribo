import React, { useState, useEffect } from 'react'
import {
  Eye, EyeOff, Mail, Lock, AlertCircle, ArrowRight,
  ArrowLeft, CheckCircle, TrendingUp, Users, MessageCircle,
  BarChart3, Zap, Target,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

type View = 'login' | 'forgot' | 'forgot-sent'

// ── Mini dashboard animado (lado esquerdo) ──────────────────────────────────
function DashboardPreview() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), 3000)
    return () => clearInterval(t)
  }, [])

  const funnel = [
    { label: 'Leads captados',     val: 184 + (tick % 3), meta: 200, pct: 92, color: '#00A896' },
    { label: 'Visitas realizadas', val: 67  + (tick % 2), meta: 80,  pct: 84, color: '#8B5CF6' },
    { label: 'Matrículas',         val: 38  + (tick % 2), meta: 50,  pct: 76, color: '#F59E0B' },
    { label: 'Rematrículas',       val: 176 + (tick % 3), meta: 200, pct: 88, color: '#10B981' },
  ]

  const kanban = [
    { label: 'Novos',   n: 12 + (tick % 3), color: '#E0F2FE', dot: '#0EA5E9' },
    { label: 'Contato', n: 8  + (tick % 2), color: '#EDE9FE', dot: '#8B5CF6' },
    { label: 'Visita',  n: 5,                color: '#FEF3C7', dot: '#F59E0B' },
    { label: 'Matr.',   n: 3  + (tick % 2), color: '#D1FAE5', dot: '#10B981' },
  ]

  return (
    <div style={{
      background: 'rgba(255,255,255,0.08)',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.15)',
      backdropFilter: 'blur(12px)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>Campanha 2026 · Ao vivo</span>
        <span style={{ background: '#D1FAE5', color: '#065F46', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>● AO VIVO</span>
      </div>

      {/* Funil */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {funnel.map(row => (
          <div key={row.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{row.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{row.val}<span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>/{row.meta}</span></span>
            </div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.1)', borderRadius: 999 }}>
              <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 999, transition: 'width 1.2s ease' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Kanban mini */}
      <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
        {kanban.map(col => (
          <div key={col.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '8px 6px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: col.dot, margin: '0 auto 5px' }} />
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{col.n}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>{col.label}</div>
          </div>
        ))}
      </div>

      {/* IA insight */}
      <div style={{ margin: '0 18px 14px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Zap size={13} style={{ color: '#FCD34D', flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>IA: ritmo de visitas 14% abaixo. Intensifique agendamentos nas próximas 2 semanas.</span>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function LoginForm() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [view, setView]                 = useState<View>('login')
  const [forgotEmail, setForgotEmail]   = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError]   = useState('')

  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err: any) {
      const msg = err?.message ?? ''
      if (msg.includes('Invalid login credentials'))  setError('E-mail ou senha incorretos')
      else if (msg.includes('Email not confirmed'))   setError('E-mail não confirmado. Verifique sua caixa de entrada.')
      else if (msg.includes('Too many requests'))     setError('Muitas tentativas. Tente novamente em alguns minutos.')
      else                                            setError(msg || 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setView('forgot-sent')
    } catch {
      setForgotError('Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.')
    } finally {
      setForgotLoading(false)
    }
  }

  // Estilos reutilizáveis ─────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', height: 46,
    paddingLeft: 44, paddingRight: 14,
    background: '#F0FDFB',
    border: '1.5px solid #D1FAE5',
    borderRadius: 10, fontSize: 14,
    color: '#1A2B4A', outline: 'none',
    transition: 'all 0.18s ease',
    boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12,
    fontWeight: 700, color: '#1A2B4A',
    marginBottom: 6, letterSpacing: '0.02em',
  }

  const btnPrimary: React.CSSProperties = {
    width: '100%', height: 48,
    background: 'linear-gradient(135deg,#00523C,#00A896)',
    color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 15,
    fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 4px 16px rgba(0,82,60,0.25)',
  }

  const focusIn  = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#00A896'
    e.target.style.background  = '#fff'
    e.target.style.boxShadow   = '0 0 0 3px rgba(0,168,150,0.12)'
  }
  const focusOut = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#D1FAE5'
    e.target.style.background  = '#F0FDFB'
    e.target.style.boxShadow   = 'none'
  }

  const iconPos: React.CSSProperties = {
    position: 'absolute', left: 14,
    top: '50%', transform: 'translateY(-50%)',
    color: '#94A3B8', pointerEvents: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }}>

      {/* ══ LADO ESQUERDO — Branding ══════════════════════════════════════════ */}
      <div style={{
        display: 'none',
        flex: '0 0 52%',
        background: 'linear-gradient(145deg,#00523C 0%,#006B50 45%,#00A896 100%)',
        position: 'relative',
        overflow: 'hidden',
      }} className="login-left">

        {/* Blobs */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -80, right: -80,   width: 400, height: 400, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: -60, left: -60, width: 380, height: 380, borderRadius: '50%', background: 'rgba(0,0,0,0.08)',         filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', top: '40%', right: '20%', width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', filter: 'blur(40px)' }} />
        </div>

        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 44px' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.25)' }}>
              <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2.5px solid rgba(255,255,255,0.5)' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Áion Edu</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>Inteligência em matrículas</div>
            </div>
          </div>

          {/* Título central */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '5px 12px', marginBottom: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80', display: 'inline-block' }} />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600 }}>CRM + WhatsApp + IA para escolas</span>
              </div>
              <h1 style={{ fontSize: 38, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 14, letterSpacing: '-0.02em' }}>
                Mais matrículas.<br />
                <span style={{ color: '#A7F3D0' }}>Com processo e dados.</span>
              </h1>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, maxWidth: 380 }}>
                Plataforma completa de gestão de matrículas para escolas privadas brasileiras.
              </p>
            </div>

            {/* Módulos pill */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { Icon: Users,         label: 'CRM de Leads' },
                { Icon: MessageCircle, label: 'WhatsApp Oficial' },
                { Icon: BarChart3,     label: 'Relatórios IA' },
                { Icon: TrendingUp,    label: 'Funil em tempo real' },
                { Icon: Target,        label: 'Metas mensais' },
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Icon size={12} style={{ color: '#A7F3D0' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Dashboard preview */}
            <DashboardPreview />

            {/* Depoimento */}
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(255,255,255,0.12)' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 10 }}>
                "Pela primeira vez chegamos na campanha com um plano real — metas por semana e visibilidade total do funil."
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>A</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Direção, Colégio Ágape</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Patos, Paraíba</div>
                </div>
                <div style={{ marginLeft: 'auto', color: '#FCD34D', fontSize: 12 }}>★★★★★</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 20 }}>
            © 2026 Áion Edu · CNPJ 65.835.064/0001-58
          </div>
        </div>
      </div>

      {/* ══ LADO DIREITO — Formulário ═════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F8FFFE',
        padding: '40px 24px',
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: 420 }}>

          {/* Logo mobile (visível apenas quando esquerda oculta) */}
          <div className="login-logo-mobile" style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#00523C,#00A896)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid rgba(255,255,255,0.5)' }} />
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#00523C', letterSpacing: '-0.02em' }}>Áion Edu</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>Inteligência em matrículas</div>
              </div>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: '#fff',
            borderRadius: 20,
            border: '1px solid #D1FAE5',
            boxShadow: '0 8px 40px rgba(0,168,150,0.1)',
            padding: '36px 36px',
          }}>

            {/* ── VIEW: LOGIN ──────────────────────────────── */}
            {view === 'login' && (
              <>
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', marginBottom: 6, letterSpacing: '-0.01em' }}>Acessar o sistema</h2>
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>Entre com suas credenciais para continuar</p>
                </div>

                <form onSubmit={handleSubmit}>
                  {error && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#DC2626' }}>
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      {error}
                    </div>
                  )}

                  {/* E-mail */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={labelStyle}>E-mail</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={iconPos} />
                      <input
                        type="email"
                        autoFocus
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        style={inputStyle}
                        onFocus={focusIn}
                        onBlur={focusOut}
                      />
                    </div>
                  </div>

                  {/* Senha */}
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Senha</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={16} style={iconPos} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        style={{ ...inputStyle, paddingRight: 46 }}
                        onFocus={focusIn}
                        onBlur={focusOut}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0, display: 'flex', alignItems: 'center' }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Esqueceu */}
                  <div style={{ textAlign: 'right', marginBottom: 24 }}>
                    <button
                      type="button"
                      onClick={() => { setView('forgot'); setForgotEmail(email); setForgotError('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#00A896', padding: 0 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#00523C')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#00A896')}
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    style={{ ...btnPrimary, opacity: loading ? 0.7 : 1 }}
                    onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 24px rgba(0,82,60,0.3)' } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'none'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,82,60,0.25)' }}
                  >
                    {loading
                      ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Entrando...</>
                      : <>Entrar no sistema <ArrowRight size={16} /></>
                    }
                  </button>
                </form>

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid #D1FAE5', textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: '#94A3B8' }}>
                    Precisa de ajuda?{' '}
                    <a href="mailto:contato@aionedu.com.br" style={{ color: '#00A896', fontWeight: 600, textDecoration: 'none' }}>
                      contato@aionedu.com.br
                    </a>
                  </p>
                </div>
              </>
            )}

            {/* ── VIEW: FORGOT ─────────────────────────────── */}
            {view === 'forgot' && (
              <>
                <button
                  onClick={() => setView('login')}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#94A3B8', padding: 0, marginBottom: 24, fontWeight: 500 }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#1A2B4A')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                >
                  <ArrowLeft size={14} /> Voltar para o login
                </button>

                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: '#1A2B4A', marginBottom: 6 }}>Recuperar senha</h2>
                  <p style={{ fontSize: 13, color: '#94A3B8' }}>Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
                </div>

                <form onSubmit={handleForgotPassword}>
                  {forgotError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#DC2626' }}>
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      {forgotError}
                    </div>
                  )}

                  <div style={{ marginBottom: 24 }}>
                    <label style={labelStyle}>E-mail</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={16} style={iconPos} />
                      <input
                        type="email"
                        autoFocus
                        required
                        value={forgotEmail}
                        onChange={e => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        style={inputStyle}
                        onFocus={focusIn}
                        onBlur={focusOut}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotLoading}
                    style={{ ...btnPrimary, opacity: forgotLoading ? 0.7 : 1 }}
                  >
                    {forgotLoading
                      ? <><div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Enviando...</>
                      : <>Enviar link de recuperação <ArrowRight size={16} /></>
                    }
                  </button>
                </form>
              </>
            )}

            {/* ── VIEW: FORGOT SENT ────────────────────────── */}
            {view === 'forgot-sent' && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                  <CheckCircle size={36} style={{ color: '#00523C' }} />
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', marginBottom: 10 }}>E-mail enviado!</h2>
                <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.7, marginBottom: 28 }}>
                  Enviamos um link de recuperação para<br />
                  <strong style={{ color: '#1A2B4A' }}>{forgotEmail}</strong><br />
                  Verifique sua caixa de entrada e spam.
                </p>
                <button
                  onClick={() => { setView('login'); setForgotEmail('') }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#00A896' }}
                >
                  <ArrowLeft size={14} /> Voltar para o login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Estilos globais ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (min-width: 1024px) {
          .login-left       { display: flex !important; }
          .login-logo-mobile { display: none !important; }
        }
      `}</style>
    </div>
  )
}
