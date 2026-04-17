import React, { useState } from 'react'
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

type View = 'login' | 'forgot' | 'forgot-sent'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,800;12..96,900&display=swap');

@keyframes spin   { to { transform: rotate(360deg); } }
@keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }

* { box-sizing: border-box; margin: 0; padding: 0; }

.lf-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F9FAFB;
  font-family: 'Plus Jakarta Sans', sans-serif;
  padding: 24px;
  position: relative;
  overflow: hidden;
}

/* blobs de fundo sutis */
.lf-blob1 {
  position: absolute;
  width: 500px; height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,168,150,.12), transparent 70%);
  top: -180px; right: -120px;
  pointer-events: none;
}
.lf-blob2 {
  position: absolute;
  width: 400px; height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,82,60,.08), transparent 70%);
  bottom: -150px; left: -100px;
  pointer-events: none;
}

.lf-card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 24px;
  border: 1px solid #E5E7EB;
  box-shadow: 0 8px 48px rgba(0,0,0,.07);
  padding: 40px 36px;
  animation: fadeUp .45s ease both;
  position: relative;
  z-index: 1;
}

.lf-inp {
  width: 100%;
  height: 48px;
  padding: 0 14px 0 44px;
  background: #F9FAFB;
  border: 1.5px solid #E5E7EB;
  border-radius: 12px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #111827;
  outline: none;
  transition: border-color .18s, box-shadow .18s, background .18s;
}
.lf-inp:focus {
  border-color: #00A896;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(0,168,150,.1);
}
.lf-inp::placeholder { color: #9CA3AF; }
.lf-inp-pr { padding-right: 46px; }

.lf-btn {
  width: 100%; height: 50px;
  background: linear-gradient(135deg, #00523C, #00A896);
  color: #fff; border: none; border-radius: 12px;
  font-size: 15px; font-weight: 800;
  font-family: 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform .15s, box-shadow .15s;
  box-shadow: 0 4px 20px rgba(0,82,60,.25);
}
.lf-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 28px rgba(0,82,60,.35);
}
.lf-btn:disabled { opacity: .65; cursor: not-allowed; }

.lf-icon {
  position: absolute;
  left: 14px; top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: #9CA3AF;
}
`

export default function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [view, setView]         = useState<View>('login')
  const [fEmail, setFEmail]     = useState('')
  const [fLoading, setFLoading] = useState(false)
  const [fError, setFError]     = useState('')
  const { signIn } = useAuth()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { await signIn(email, password) }
    catch (err: any) {
      const m = err?.message ?? ''
      if (m.includes('Invalid login credentials')) setError('E-mail ou senha incorretos.')
      else if (m.includes('Email not confirmed'))  setError('E-mail não confirmado.')
      else if (m.includes('Too many requests'))    setError('Muitas tentativas. Aguarde.')
      else setError('Erro ao entrar. Tente novamente.')
    } finally { setLoading(false) }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setFError(''); setFLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(fEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setView('forgot-sent')
    } catch { setFError('Não foi possível enviar. Verifique o e-mail.') }
    finally { setFLoading(false) }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="lf-page">
        <div className="lf-blob1" />
        <div className="lf-blob2" />

        <div className="lf-card">

          {/* ── Logo ── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <img
              src="/aion-logo-full.png"
              alt="Áion Edu"
              style={{ height: 48, width: 'auto', objectFit: 'contain' }}
            />
          </div>

          {/* ══ LOGIN ══════════════════════════════════════════ */}
          {view === 'login' && (
            <>
              <p style={{ fontSize:14, color:'#6B7280', textAlign:'center', marginBottom:28 }}>
                Entre com suas credenciais
              </p>

              {error && (
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', marginBottom:18, fontSize:13, color:'#DC2626' }}>
                  <AlertCircle size={14} style={{ flexShrink:0 }} />
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Email */}
                <div style={{ position:'relative' }}>
                  <svg className="lf-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input className="lf-inp" type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>

                {/* Senha */}
                <div style={{ position:'relative' }}>
                  <svg className="lf-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input className="lf-inp lf-inp-pr" type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:0, display:'flex' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Esqueceu */}
                <div style={{ textAlign:'right', marginTop:-4 }}>
                  <button type="button" onClick={() => { setView('forgot'); setFEmail(email); setFError('') }}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, color:'#00A896', padding:0, transition:'color .15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color='#00523C')}
                    onMouseLeave={e => (e.currentTarget.style.color='#00A896')}
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                <button type="submit" disabled={loading} className="lf-btn" style={{ marginTop:4 }}>
                  {loading
                    ? <><div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Entrando...</>
                    : <>Entrar <ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <div style={{ marginTop:24, textAlign:'center', display:'flex', flexDirection:'column', gap:8 }}>
                <Link to="/" style={{ fontSize:12, color:'#9CA3AF', textDecoration:'none', display:'inline-flex', alignItems:'center', justifyContent:'center', gap:4, transition:'color .15s' }}
                  onMouseEnter={(e:any) => e.currentTarget.style.color='#374151'}
                  onMouseLeave={(e:any) => e.currentTarget.style.color='#9CA3AF'}
                >
                  <ArrowLeft size={12} /> Voltar para o site
                </Link>
              </div>
            </>
          )}

          {/* ══ FORGOT ════════════════════════════════════════ */}
          {view === 'forgot' && (
            <>
              <p style={{ fontSize:14, color:'#6B7280', textAlign:'center', marginBottom:28 }}>
                Informe seu e-mail para recuperar a senha
              </p>

              {fError && (
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', marginBottom:18, fontSize:13, color:'#DC2626' }}>
                  <AlertCircle size={14} style={{ flexShrink:0 }} />
                  {fError}
                </div>
              )}

              <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ position:'relative' }}>
                  <svg className="lf-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input className="lf-inp" type="email" autoFocus required value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="seu@email.com" />
                </div>

                <button type="submit" disabled={fLoading} className="lf-btn">
                  {fLoading
                    ? <><div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Enviando...</>
                    : <>Enviar link <ArrowRight size={16} /></>
                  }
                </button>
              </form>

              <div style={{ marginTop:20, textAlign:'center' }}>
                <button onClick={() => setView('login')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, color:'#9CA3AF', display:'inline-flex', alignItems:'center', gap:4, transition:'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}
                >
                  <ArrowLeft size={13} /> Voltar
                </button>
              </div>
            </>
          )}

          {/* ══ FORGOT SENT ═══════════════════════════════════ */}
          {view === 'forgot-sent' && (
            <div style={{ textAlign:'center', padding:'8px 0' }}>
              <div style={{ width:64, height:64, borderRadius:'50%', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center', margin:'24px auto 20px', boxShadow:'0 0 0 10px #F0FDF9' }}>
                <CheckCircle size={30} style={{ color:'#00523C' }} />
              </div>
              <h3 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:20, fontWeight:900, color:'#111827', marginBottom:8 }}>E-mail enviado!</h3>
              <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.7, marginBottom:24 }}>
                Verifique sua caixa de entrada em<br />
                <strong style={{ color:'#111827' }}>{fEmail}</strong>
              </p>
              <button onClick={() => { setView('login'); setFEmail('') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color:'#00A896', display:'inline-flex', alignItems:'center', gap:5, transition:'color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.color='#00523C')}
                onMouseLeave={e => (e.currentTarget.style.color='#00A896')}
              >
                <ArrowLeft size={14} /> Voltar para o login
              </button>
            </div>
          )}

        </div>
      </div>
    </>
  )
}