import React from 'react'

// Moldura de navegador (mesma do HeroMockup da landing) pra exibir prints
// reais do sistema nas páginas públicas.
export default function BrowserFrame({ src, alt, url = 'app.aionedu.com.br', dark = false, style }: {
  src: string
  alt: string
  url?: string
  dark?: boolean
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: dark ? 'rgba(255,255,255,.08)' : '#fff', borderRadius: 18, padding: 4,
      border: dark ? '1px solid rgba(255,255,255,.16)' : '1px solid #E5E7EB',
      boxShadow: dark ? '0 48px 96px rgba(0,0,0,.45)' : '0 32px 72px rgba(0,48,31,.14)',
      ...style,
    }}>
      <div style={{ background: '#fff', borderRadius: 15, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            {['#FF5F57', '#FFBD2E', '#28C840'].map((c, i) => <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />)}
          </div>
          <div style={{ flex: 1, background: '#F3F4F6', borderRadius: 6, padding: '3px 12px', fontSize: 11, color: '#9CA3AF', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{url}</div>
        </div>
        <img src={src} alt={alt} loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />
      </div>
    </div>
  )
}
