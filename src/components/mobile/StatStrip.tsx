import React from 'react'
import { CountUp } from '../leads/LeadsAttention'

// Faixa de números no padrão do sistema (igual à de Leads): cartão branco, filete
// colorido na esquerda, título, ícone, número grande e uma linha de apoio.
// No celular desliza de lado (aion-snap); no computador vira grade.
export interface Stat { label: string; value: number | string; sub?: string; color: string; icon: React.ElementType; alert?: boolean }

export default function StatStrip({ items }: { items: Stat[] }) {
  return (
    <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))', gap: 12 }}>
      {items.map((it, i) => {
        const Icon = it.icon
        return (
          <div key={it.label} className="ld-kpi ld-in" style={{ animationDelay: `${i * 60}ms`, position: 'relative', overflow: 'hidden', background: '#fff', borderRadius: 18, padding: '14px 14px 13px', border: `1.5px solid ${it.alert ? '#FCA5A5' : '#E3E8F0'}`, display: 'flex', flexDirection: 'column', gap: 6, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }}>
            <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: it.color, opacity: it.alert ? 1 : .55 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', lineHeight: 1.2 }}>{it.label}</span>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: `${it.color}14`, color: it.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} /></span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color: it.alert ? '#B91C1C' : '#1A2B4A', lineHeight: 1, letterSpacing: '-.02em' }}>
              {typeof it.value === 'number' ? <CountUp value={it.value} /> : it.value}
            </div>
            {it.sub && <div style={{ fontSize: 11.5, color: '#5B6B86', lineHeight: 1.3 }}>{it.sub}</div>}
          </div>
        )
      })}
    </div>
  )
}

// Botões de cartão no padrão: um principal (verde da marca) e os demais brancos com borda.
export const cardBtn = (kind: 'primary' | 'ghost' | 'danger' = 'ghost', extra: React.CSSProperties = {}): React.CSSProperties => ({
  flex: '1 1 130px', minHeight: 44, padding: '10px 12px', borderRadius: 12, fontFamily: 'inherit', fontWeight: 700, fontSize: 13, cursor: 'pointer',
  border: kind === 'primary' ? 'none' : kind === 'danger' ? '1px solid #FECACA' : '1px solid #E3E8F0',
  background: kind === 'primary' ? 'var(--aion-grad)' : '#fff',
  color: kind === 'primary' ? '#fff' : kind === 'danger' ? '#DC2626' : '#1A2B4A',
  boxShadow: kind === 'primary' ? '0 8px 18px -12px rgba(0,122,110,.8)' : 'none', ...extra,
})
