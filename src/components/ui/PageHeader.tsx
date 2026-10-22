// Cabeçalho em faixa degradê (padrão do AION Business, com as cores do Edu):
// ícone em vidro, título e subtítulo, ações opcionais à direita.
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { GRAD } from '../../lib/brand'

export default function PageHeader({ icon: Icon, title, subtitle, actions, compact }: {
  icon?: LucideIcon
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  compact?: boolean
}) {
  const orb = 'radial-gradient(circle at 35% 35%, rgba(255,255,255,.22), rgba(255,255,255,.05) 60%, transparent 70%)'
  return (
    <div style={{
      position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: compact ? '16px 16px' : '22px 24px', borderRadius: compact ? 18 : 22, background: GRAD, color: '#fff',
      boxShadow: '0 18px 38px -20px rgba(0,122,110,.7), 0 2px 6px -2px rgba(6,95,82,.25)',
    }}>
      <span aria-hidden style={{ position: 'absolute', width: 260, height: 260, right: -60, top: -120, borderRadius: 999, background: orb, pointerEvents: 'none' }} />
      <span aria-hidden style={{ position: 'absolute', width: 180, height: 180, right: 160, bottom: -120, borderRadius: 999, background: orb, pointerEvents: 'none' }} />
      {Icon && (
        <div aria-hidden style={{
          width: compact ? 40 : 48, height: compact ? 40 : 48, borderRadius: 16, flexShrink: 0, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 8px 18px -8px rgba(0,0,0,.35)',
        }}>
          <Icon size={compact ? 18 : 22} color="#fff" strokeWidth={2.1} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
        <h1 style={{ margin: 0, fontSize: compact ? 20 : 24, fontWeight: 800, letterSpacing: '-.015em', color: '#fff', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.86)', marginTop: 3 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', position: 'relative' }}>{actions}</div>}
    </div>
  )
}
