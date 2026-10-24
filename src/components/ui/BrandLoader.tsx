// Carregamento da marca: ícone da logo com anel pulsante e barra de brilho.
// Também exporta Skeleton (blocos que "respiram" no lugar do conteúdo).
import type { CSSProperties } from 'react'

export function BrandLoader({ label = 'Carregando', size = 56, fullscreen }: { label?: string; size?: number; fullscreen?: boolean }) {
  const box = (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <span aria-hidden className="aion-ring" style={{ position: 'absolute', inset: -8, borderRadius: size * 0.34, border: '2px solid #2DCBA4' }} />
        <img src="/aion-logo-icon.png" alt="" className="aion-logo-pop" style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />
      </div>
      <div style={{ width: 96, height: 4, borderRadius: 99, background: '#E3EFEC', overflow: 'hidden' }}>
        <span className="aion-bar" style={{ display: 'block', height: '100%', width: '40%', borderRadius: 99, background: 'var(--aion-grad)' }} />
      </div>
      <span style={{ fontSize: 12.5, color: '#5B6B86', fontWeight: 600 }}>{label}…</span>
    </div>
  )
  if (!fullscreen) return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>{box}</div>
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5FAF9' }}>{box}</div>
}

export function Skeleton({ w = '100%', h = 16, r = 10, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span aria-hidden className="aion-skel" style={{ display: 'block', width: w, height: h, borderRadius: r, ...style }} />
}

/** Esqueleto de uma tela padrão: faixa + 4 cartões + bloco grande. */
export function PageSkeleton() {
  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Skeleton h={92} r={22} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3].map(i => <Skeleton key={i} h={104} r={18} />)}
      </div>
      <Skeleton h={280} r={18} />
    </div>
  )
}
