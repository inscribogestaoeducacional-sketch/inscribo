// Tela de abertura do aplicativo (celular): "Conheça a Áion", Entrar e Assinar pelo WhatsApp.
import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WhatsappLogo, ChatsCircle, Funnel, Flag, ChartLineUp, ArrowRight, SignIn } from '@phosphor-icons/react'

const WA_ASSINAR = 'https://wa.me/5583993444383?text=' + encodeURIComponent('Olá! Quero assinar o Áion Edu para a minha escola.')

const SLIDES = [
  { Icon: ChatsCircle, title: 'Todo o atendimento num só lugar', text: 'WhatsApp oficial da escola com a equipe toda: conversas, transferências e respostas rápidas no celular.' },
  { Icon: Funnel, title: 'Do primeiro contato à matrícula', text: 'Leads, visitas e funil organizados. Você sabe quem está esperando resposta e o que fazer agora.' },
  { Icon: Flag, title: 'Campanha de matrículas e rematrículas', text: 'Metas, ritmo do mês e famílias pendentes, com números claros para decidir.' },
  { Icon: ChartLineUp, title: 'Relatórios e IA a seu favor', text: 'Satisfação, equipe e origem dos leads, com análises prontas para ler em um minuto.' },
]

export default function AppWelcome() {
  const nav = useNavigate()
  const [i, setI] = useState(0)
  const x0 = useRef<number | null>(null)
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)))
  const S = SLIDES[i]

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--aion-grad)', color: '#fff', position: 'relative', overflow: 'hidden', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      onTouchStart={e => { x0.current = e.touches[0].clientX }}
      onTouchEnd={e => { if (x0.current == null) return; const dx = e.changedTouches[0].clientX - x0.current; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0.current = null }}>
      <span aria-hidden style={{ position: 'absolute', width: 420, height: 420, right: -140, top: -150, borderRadius: 999, background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,.26), rgba(255,255,255,.04) 62%, transparent 70%)' }} />
      <span aria-hidden style={{ position: 'absolute', width: 320, height: 320, left: -120, bottom: 90, borderRadius: 999, background: 'radial-gradient(circle at 60% 40%, rgba(45,203,164,.45), transparent 68%)' }} />

      <div style={{ position: 'relative', padding: 'calc(26px + env(safe-area-inset-top)) 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <img src="/aion-logo-icon.png" alt="Áion" style={{ width: 46, height: 46, borderRadius: 14, boxShadow: '0 10px 24px -10px rgba(0,0,0,.5)' }} />
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', opacity: .85 }}>Conheça a Áion</span>
      </div>

      <div key={i} style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 28px', animation: 'ldFadeUp .5s cubic-bezier(.22,1,.36,1) both' }}>
        <div style={{ width: 112, height: 112, borderRadius: 34, background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.34)', display: 'grid', placeItems: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 24px 40px -22px rgba(0,0,0,.5)', marginBottom: 30 }}>
          <S.Icon size={60} weight="duotone" color="#fff" />
        </div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(28px, 8.4vw, 36px)', lineHeight: 1.08, letterSpacing: '-.02em', margin: 0, color: '#fff' }}>{S.title}</h1>
        <p style={{ fontSize: 15.5, lineHeight: 1.55, opacity: .92, margin: '14px 0 0', maxWidth: 360, color: '#fff' }}>{S.text}</p>
        <div style={{ display: 'flex', gap: 7, marginTop: 28 }} role="tablist" aria-label="Passos">
          {SLIDES.map((_, n) => <button key={n} onClick={() => go(n)} aria-label={`Passo ${n + 1}`} aria-selected={n === i} role="tab"
            style={{ border: 'none', padding: 0, height: 8, width: n === i ? 28 : 8, borderRadius: 99, background: n === i ? '#fff' : 'rgba(255,255,255,.4)', transition: 'width .3s, background .3s', cursor: 'pointer' }} />)}
        </div>
      </div>

      <div style={{ position: 'relative', padding: '0 20px calc(22px + env(safe-area-inset-bottom))', display: 'grid', gap: 10 }}>
        {i < SLIDES.length - 1 ? (
          <button onClick={() => go(i + 1)} className="aion-tap" style={{ height: 54, borderRadius: 18, border: 'none', background: '#fff', color: '#00695F', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 16px 30px -16px rgba(0,0,0,.5)' }}>
            Continuar <ArrowRight size={19} weight="bold" />
          </button>
        ) : (
          <button onClick={() => nav('/login')} className="aion-tap" style={{ height: 54, borderRadius: 18, border: 'none', background: '#fff', color: '#00695F', fontSize: 16, fontWeight: 800, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 16px 30px -16px rgba(0,0,0,.5)' }}>
            <SignIn size={20} weight="bold" /> Entrar
          </button>
        )}
        <a href={WA_ASSINAR} target="_blank" rel="noopener noreferrer" className="aion-tap" style={{ height: 54, borderRadius: 18, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.4)', color: '#fff', fontSize: 15.5, fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          <WhatsappLogo size={22} weight="fill" /> Assine agora pelo WhatsApp
        </a>
        {i < SLIDES.length - 1 && <button onClick={() => nav('/login')} style={{ border: 'none', background: 'none', color: 'rgba(255,255,255,.92)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', padding: 6, cursor: 'pointer' }}>Já tenho conta · Entrar</button>}
      </div>
    </div>
  )
}
