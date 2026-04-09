import React, { useState } from 'react'
import { Eye, EyeOff, ArrowRight, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

type View = 'login' | 'forgot' | 'forgot-sent'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Bricolage+Grotesque:opsz,wght@12..96,800;12..96,900&display=swap');

@keyframes spin    { to { transform: rotate(360deg); } }
@keyframes fadeUp  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
@keyframes floatY  { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-8px); } }

.lf-wrap {
  min-height: 100vh;
  display: flex;
  font-family: 'Plus Jakarta Sans', sans-serif;
  background: #F0FDF9;
}

/* ── Lado esquerdo ── */
.lf-left {
  display: none;
  flex: 0 0 50%;
  background: linear-gradient(145deg,#00523C 0%,#006B50 50%,#00A896 100%);
  position: relative;
  overflow: hidden;
  padding: 48px 52px;
  flex-direction: column;
}
@media (min-width: 1024px) {
  .lf-left { display: flex; }
  .lf-logo-mob { display: none !important; }
}

.lf-grid {
  position: absolute; inset: 0; pointer-events: none; opacity: .06;
  background-image: linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),
                    linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px);
  background-size: 48px 48px;
}

/* ── Lado direito ── */
.lf-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  background: #fff;
}

.lf-card {
  width: 100%;
  max-width: 400px;
  animation: fadeUp .5s ease both;
}

/* ── Input ── */
.lf-inp {
  width: 100%;
  height: 48px;
  padding: 0 14px 0 44px;
  background: #F9FAFB;
  border: 1.5px solid #E5E7EB;
  border-radius: 11px;
  font-size: 14px;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #111827;
  outline: none;
  transition: border-color .18s, box-shadow .18s, background .18s;
  box-sizing: border-box;
}
.lf-inp:focus {
  border-color: #00A896;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(0,168,150,.1);
}
.lf-inp::placeholder { color: #9CA3AF; }

/* ── Botão ── */
.lf-btn {
  width: 100%; height: 50px;
  background: linear-gradient(135deg,#00523C,#00A896);
  color: #fff; border: none; border-radius: 12px;
  font-size: 15px; font-weight: 800;
  font-family: 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  transition: transform .15s, box-shadow .15s, opacity .15s;
  box-shadow: 0 4px 20px rgba(0,82,60,.25);
  position: relative; overflow: hidden;
}
.lf-btn::after {
  content:''; position:absolute; inset:0;
  background: linear-gradient(135deg,rgba(255,255,255,.1),transparent);
  opacity:0; transition:opacity .2s;
}
.lf-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 8px 28px rgba(0,82,60,.35); }
.lf-btn:hover::after { opacity:1; }
.lf-btn:disabled { opacity:.65; cursor:not-allowed; }

/* ── Mini dashboard ── */
.lf-dash {
  background: rgba(255,255,255,.09);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 16px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  animation: floatY 5s ease-in-out infinite;
}
`

function MiniDashboard() {
  const [t, setT] = React.useState(0)
  React.useEffect(() => {
    const id = setInterval(() => setT(v => v + 1), 2800)
    return () => clearInterval(id)
  }, [])
  const rows = [
    { label:'Leads captados',  val:184+(t%3), meta:200, pct:92, c:'#00A896' },
    { label:'Visitas',         val:67+(t%2),  meta:80,  pct:84, c:'#818CF8' },
    { label:'Matrículas',      val:38+(t%2),  meta:50,  pct:76, c:'#F59E0B' },
  ]
  return (
    <div className="lf-dash">
      <div style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,.08)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.85)' }}>Campanha 2027 · Ao vivo</span>
        <span style={{ background:'#D1FAE5', color:'#065F46', fontSize:9, fontWeight:800, padding:'2px 7px', borderRadius:5 }}>● AO VIVO</span>
      </div>
      <div style={{ padding:'12px 16px' }}>
        {rows.map(r => (
          <div key={r.label} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:11, color:'rgba(255,255,255,.6)' }}>{r.label}</span>
              <span style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{r.val}<span style={{ color:'rgba(255,255,255,.35)', fontWeight:400 }}>/{r.meta}</span></span>
            </div>
            <div style={{ height:5, background:'rgba(255,255,255,.1)', borderRadius:999 }}>
              <div style={{ height:'100%', width:`${r.pct}%`, background:r.c, borderRadius:999, transition:'width 1.2s ease' }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6 }}>
          {[['Novos',12+(t%3),'#38BDF8'],['Contato',8+(t%2),'#818CF8'],['Visita',5,'#F59E0B'],['Matr.',3+(t%2),'#10B981']].map(([l,n,c]) => (
            <div key={String(l)} style={{ background:'rgba(255,255,255,.06)', borderRadius:8, padding:'7px 4px', textAlign:'center' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:String(c), margin:'0 auto 4px' }} />
              <p style={{ fontSize:13, fontWeight:900, color:'#fff', lineHeight:1 }}>{String(n)}</p>
              <p style={{ fontSize:9, color:'rgba(255,255,255,.45)', marginTop:2 }}>{String(l)}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.22)', borderRadius:8, display:'flex', gap:7 }}>
          <span style={{ fontSize:12 }}>⚡</span>
          <span style={{ fontSize:10, color:'rgba(255,255,255,.75)', lineHeight:1.5 }}>IA: ritmo de visitas 14% abaixo. Intensifique agendamentos.</span>
        </div>
      </div>
    </div>
  )
}

export default function LoginForm() {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [view, setView]               = useState<View>('login')
  const [fEmail, setFEmail]           = useState('')
  const [fLoading, setFLoading]       = useState(false)
  const [fError, setFError]           = useState('')
  const { signIn } = useAuth()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    try { await signIn(email, password) }
    catch (err: any) {
      const m = err?.message ?? ''
      if (m.includes('Invalid login credentials')) setError('E-mail ou senha incorretos.')
      else if (m.includes('Email not confirmed'))  setError('E-mail não confirmado. Verifique sua caixa de entrada.')
      else if (m.includes('Too many requests'))    setError('Muitas tentativas. Aguarde alguns minutos.')
      else setError(m || 'Erro ao entrar. Tente novamente.')
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
    } catch { setFError('Não foi possível enviar. Verifique o endereço e tente novamente.') }
    finally { setFLoading(false) }
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="lf-wrap">

        {/* ── Esquerda ─────────────────────────────────── */}
        <div className="lf-left">
          <div className="lf-grid" />

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:'auto' }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.15)', border:'1px solid rgba(255,255,255,.25)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:900, fontSize:17, color:'#fff' }}>Á</span>
            </div>
            <div>
              <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:900, fontSize:17, color:'#fff', lineHeight:1.1 }}>Áion Edu</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.55)' }}>Inteligência em matrículas</p>
            </div>
          </div>

          {/* Centro */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', gap:28, marginTop:40 }}>
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.1)', borderRadius:999, padding:'5px 12px', marginBottom:18, border:'1px solid rgba(255,255,255,.15)' }}>
                <span style={{ width:5, height:5, borderRadius:'50%', background:'#4ADE80', display:'inline-block' }} />
                <span style={{ color:'rgba(255,255,255,.8)', fontSize:11, fontWeight:600 }}>CRM + WhatsApp + IA</span>
              </div>
              <h2 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:36, fontWeight:900, color:'#fff', lineHeight:1.15, marginBottom:12 }}>
                Mais matrículas.<br />
                <span style={{ color:'#A7F3D0' }}>Com processo e dados.</span>
              </h2>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.65)', lineHeight:1.7, maxWidth:360 }}>
                Plataforma completa de gestão de matrículas para escolas privadas brasileiras.
              </p>
            </div>

            <MiniDashboard />

            {/* Depoimento */}
            <div style={{ background:'rgba(255,255,255,.07)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(255,255,255,.1)' }}>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.8)', fontStyle:'italic', lineHeight:1.65, marginBottom:12 }}>
                "Pela primeira vez chegamos na campanha com um plano real — metas por semana e visibilidade total do funil."
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff' }}>A</div>
                <div>
                  <p style={{ fontSize:12, fontWeight:700, color:'#fff' }}>Direção, Colégio Ágape</p>
                  <p style={{ fontSize:10, color:'rgba(255,255,255,.45)' }}>Patos, Paraíba</p>
                </div>
                <span style={{ marginLeft:'auto', color:'#FCD34D', fontSize:11 }}>★★★★★</span>
              </div>
            </div>
          </div>

          <p style={{ fontSize:11, color:'rgba(255,255,255,.3)', marginTop:32 }}>© 2026 Áion Edu · CNPJ 65.835.064/0001-58</p>
        </div>

        {/* ── Direita ───────────────────────────────────── */}
        <div className="lf-right">
          <div className="lf-card">

            {/* Logo mobile */}
            <div className="lf-logo-mob" style={{ display:'flex', justifyContent:'center', marginBottom:36 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#00523C,#00A896)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(0,82,60,.3)' }}>
                  <span style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:900, fontSize:17, color:'#fff' }}>Á</span>
                </div>
                <div>
                  <p style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontWeight:900, fontSize:17, color:'#00523C' }}>Áion Edu</p>
                  <p style={{ fontSize:10, color:'#9CA3AF' }}>Inteligência em matrículas</p>
                </div>
              </div>
            </div>

            {/* ── LOGIN ─────────────────────────────────── */}
            {view === 'login' && (
              <>
                <div style={{ marginBottom:28 }}>
                  <h1 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:26, fontWeight:900, color:'#111827', marginBottom:6, letterSpacing:'-.02em' }}>
                    Acessar o sistema
                  </h1>
                  <p style={{ fontSize:13, color:'#9CA3AF' }}>Entre com suas credenciais para continuar</p>
                </div>

                {error && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 14px', marginBottom:20, fontSize:13, color:'#DC2626' }}>
                    <AlertCircle size={15} style={{ flexShrink:0 }} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {/* E-mail */}
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:6, letterSpacing:'.02em' }}>E-mail</label>
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#9CA3AF' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      <input className="lf-inp" type="email" autoFocus required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                  </div>

                  {/* Senha */}
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <label style={{ fontSize:12, fontWeight:700, color:'#374151', letterSpacing:'.02em' }}>Senha</label>
                      <button type="button" onClick={() => { setView('forgot'); setFEmail(email); setFError('') }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, color:'#00A896', padding:0, transition:'color .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color='#00523C')}
                        onMouseLeave={e => (e.currentTarget.style.color='#00A896')}
                      >Esqueceu a senha?</button>
                    </div>
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#9CA3AF' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      <input className="lf-inp" type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight:46 }} />
                      <button type="button" onClick={() => setShowPw(v => !v)} style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#9CA3AF', padding:0, display:'flex', alignItems:'center', transition:'color .15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color='#374151')}
                        onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="lf-btn" style={{ marginTop:4 }}>
                    {loading
                      ? <><div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Entrando...</>
                      : <>Entrar <ArrowRight size={16} /></>
                    }
                  </button>
                </form>

                <div style={{ marginTop:24, paddingTop:20, borderTop:'1px solid #F3F4F6', textAlign:'center' }}>
                  <p style={{ fontSize:12, color:'#9CA3AF' }}>
                    Precisa de ajuda?{' '}
                    <a href="mailto:contato@aionedu.com.br" style={{ color:'#00A896', fontWeight:600, textDecoration:'none' }}>contato@aionedu.com.br</a>
                  </p>
                </div>

                <div style={{ marginTop:16, textAlign:'center' }}>
                  <Link to="/" style={{ fontSize:12, color:'#9CA3AF', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:4, transition:'color .15s' }}
                    onMouseEnter={(e:any) => e.currentTarget.style.color='#374151'}
                    onMouseLeave={(e:any) => e.currentTarget.style.color='#9CA3AF'}
                  >
                    <ArrowLeft size={13} /> Voltar para o site
                  </Link>
                </div>
              </>
            )}

            {/* ── FORGOT ────────────────────────────────── */}
            {view === 'forgot' && (
              <>
                <button onClick={() => setView('login')} style={{ display:'flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, color:'#9CA3AF', padding:0, marginBottom:28, transition:'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#374151')}
                  onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}
                >
                  <ArrowLeft size={14} /> Voltar
                </button>

                <div style={{ marginBottom:28 }}>
                  <h1 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:26, fontWeight:900, color:'#111827', marginBottom:6 }}>Recuperar senha</h1>
                  <p style={{ fontSize:13, color:'#9CA3AF', lineHeight:1.6 }}>Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
                </div>

                {fError && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:'11px 14px', marginBottom:20, fontSize:13, color:'#DC2626' }}>
                    <AlertCircle size={15} style={{ flexShrink:0 }} />
                    {fError}
                  </div>
                )}

                <form onSubmit={handleForgot} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  <div>
                    <label style={{ display:'block', fontSize:12, fontWeight:700, color:'#374151', marginBottom:6, letterSpacing:'.02em' }}>E-mail</label>
                    <div style={{ position:'relative' }}>
                      <svg style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'#9CA3AF' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                      <input className="lf-inp" type="email" autoFocus required value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="seu@email.com" />
                    </div>
                  </div>
                  <button type="submit" disabled={fLoading} className="lf-btn">
                    {fLoading
                      ? <><div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} />Enviando...</>
                      : <>Enviar link de recuperação <ArrowRight size={16} /></>
                    }
                  </button>
                </form>
              </>
            )}

            {/* ── FORGOT SENT ──────────────────────────── */}
            {view === 'forgot-sent' && (
              <div style={{ textAlign:'center', padding:'16px 0' }}>
                <div style={{ width:68, height:68, borderRadius:'50%', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 22px', boxShadow:'0 0 0 12px #F0FDF9' }}>
                  <CheckCircle size={32} style={{ color:'#00523C' }} />
                </div>
                <h2 style={{ fontFamily:'Bricolage Grotesque,sans-serif', fontSize:22, fontWeight:900, color:'#111827', marginBottom:10 }}>E-mail enviado!</h2>
                <p style={{ fontSize:13, color:'#6B7280', lineHeight:1.75, marginBottom:28 }}>
                  Enviamos um link de recuperação para<br />
                  <strong style={{ color:'#111827' }}>{fEmail}</strong><br />
                  Verifique sua caixa de entrada e spam.
                </p>
                <button onClick={() => { setView('login'); setFEmail('') }} style={{ display:'inline-flex', alignItems:'center', gap:6, background:'none', border:'none', cursor:'pointer', fontSize:13, fontWeight:700, color:'#00A896', transition:'color .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#00523C')}
                  onMouseLeave={e => (e.currentTarget.style.color='#00A896')}
                >
                  <ArrowLeft size={14} /> Voltar para o login
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}