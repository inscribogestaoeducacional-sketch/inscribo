// Cabeçalho padrão de todas as telas do portal (mesma linha visual em todos os
// módulos): ícone em degradê esmeralda→azul, título, contador opcional,
// subtítulo e ações à direita.
import type { ReactNode, ComponentType } from 'react'
import { BRAND, GRAD } from '../../lib/brand'

export default function PageHeader({ icon: Icon, title, subtitle, count, actions, flush }: {
  icon?: ComponentType<any>
  title: ReactNode
  subtitle?: ReactNode
  count?: number | string | null
  actions?: ReactNode
  /** Sem margem embaixo (quando o pai já espaça com gap) */
  flush?: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: flush ? 0 : 18 }}>
      {Icon && (
        <div aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 16px rgba(37,99,235,.22)' }}>
          <Icon size={21} color="#fff" strokeWidth={2.1} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: BRAND.ink, letterSpacing: '-0.01em' }}>{title}</h1>
          {count != null && count !== '' && (
            <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.primary, background: BRAND.soft, borderRadius: 999, padding: '2px 10px' }}>{count}</span>
          )}
        </div>
        {subtitle && <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

/** Só o bloco ícone + título + subtítulo do PageHeader, para cabeçalhos que já
 *  têm suas próprias ações ao lado (telas antigas do Super Admin). */
export function PageTitle({ icon: Icon, title, subtitle }: { icon?: ComponentType<any>; title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      {Icon && (
        <div aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 16px rgba(37,99,235,.22)' }}>
          <Icon size={21} color="#fff" strokeWidth={2.1} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: BRAND.ink, letterSpacing: '-0.01em' }}>{title}</h1>
        {subtitle && <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}
