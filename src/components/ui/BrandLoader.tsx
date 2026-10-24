// Carregamento da marca: a logo animada (ponto → quadrado girando → A cortado pela barra →
// ÁION saindo do quadrado → EDU). Em tela cheia toca uma vez e fica na logo pronta;
// nos carregamentos pequenos repete só o quadrado. Também exporta Skeleton e PageSkeleton.
import type { CSSProperties } from 'react'
import LogoAnimation from './LogoAnimation'

export function BrandLoader({ label = 'Carregando', size = 56, fullscreen }: { label?: string; size?: number; fullscreen?: boolean }) {
  if (fullscreen) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: '100dvh', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22, background: 'radial-gradient(120% 90% at 50% 0%, #E6F7F5 0%, #FFFFFF 62%)' }}>
        <span aria-hidden className="aion-bl-orb" style={{ width: 340, height: 340, top: -140, right: -120, background: 'radial-gradient(circle, rgba(45,203,164,.28), transparent 68%)' }} />
        <span aria-hidden className="aion-bl-orb" style={{ width: 300, height: 300, bottom: -130, left: -110, background: 'radial-gradient(circle, rgba(5,144,123,.22), transparent 68%)', animationDelay: '-4s' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span aria-hidden className="aion-bl-halo" style={{ animationDelay: '.2s' }} />
          <span aria-hidden className="aion-bl-halo" style={{ animationDelay: '1.1s' }} />
          <LogoAnimation width={Math.min(340, typeof window !== 'undefined' ? window.innerWidth * 0.74 : 340)} />
        </div>
        <span style={{ fontSize: 12.5, color: '#00695F', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', animation: 'ldFadeUp .7s ease 2.6s both' }}>Inteligência em matrículas</span>
        <div aria-hidden style={{ display: 'flex', gap: 7, animation: 'ldFadeUp .5s ease 1s both' }}>
          {[0, 1, 2].map(i => <span key={i} className="aion-bl-dot" style={{ animationDelay: `${i * 0.16}s` }} />)}
        </div>
        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span>
      </div>
    )
  }
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '36px 0' }}>
      <LogoAnimation variant="mark" width={size} />
      <span style={{ fontSize: 12.5, color: '#5B6B86', fontWeight: 600 }}>{label}…</span>
    </div>
  )
}

export function Skeleton({ w = '100%', h = 16, r = 10, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span aria-hidden className="aion-skel" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />
}

/** Esqueleto de uma tela padrão: faixa + 4 cartões + bloco grande. */
export function PageSkeleton() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton h={92} r={22} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} h={104} r={18} />)}
      </div>
      <Skeleton h={280} r={18} />
    </div>
  )
}
