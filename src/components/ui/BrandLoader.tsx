// Carregamento da marca: a logo animada (ponto → quadrado girando → A cortado pela barra →
// ÁION saindo do quadrado → EDU). Em tela cheia toca uma vez e fica na logo pronta;
// nos carregamentos pequenos repete só o quadrado. Também exporta Skeleton e PageSkeleton.
import type { CSSProperties } from 'react'
import LogoAnimation from './LogoAnimation'

export function BrandLoader({ label = 'Carregando', size = 56, fullscreen }: { label?: string; size?: number; fullscreen?: boolean }) {
  if (fullscreen) {
    return (
      <div role="status" aria-live="polite" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 26, background: 'radial-gradient(120% 90% at 50% 0%, #F0FDFB 0%, #FFFFFF 60%)' }}>
        <LogoAnimation width={Math.min(360, typeof window !== 'undefined' ? window.innerWidth * 0.78 : 360)} />
        <div style={{ width: 120, height: 4, borderRadius: 99, background: '#E3EFEC', overflow: 'hidden' }}>
          <span className="aion-bar" style={{ display: 'block', height: '100%', width: '40%', borderRadius: 99, background: 'var(--aion-grad)' }} />
        </div>
        <span style={{ fontSize: 12.5, color: '#5B6B86', fontWeight: 600 }}>{label}…</span>
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
