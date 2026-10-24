import React, { useRef } from 'react'

// Abas em pílulas que deslizam de lado (celular). Reaproveitável em qualquer
// tela com abas: <PillTabs tabs={[['a','Aba A', Icon?]]} value onChange />
// e o gesto de arrastar a tela para trocar de aba: useTabSwipe(ids, value, set).
type Tab = [string, string, React.ComponentType<{ size?: number }>?]

export function PillTabs({ tabs, value, onChange }: { tabs: Tab[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="aion-hscroll" role="tablist" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '2px 12px', position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(#F5FAF9 70%, rgba(245,250,249,0))' }}>
      {tabs.map(([id, label, Icon]) => {
        const on = value === id
        return (
          <button key={id} type="button" role="tab" aria-selected={on} className="aion-tap" onClick={() => onChange(id)}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, border: on ? 'none' : '1px solid #E3E8F0', background: on ? 'var(--aion-grad)' : '#fff', color: on ? '#fff' : '#5B6B86', fontWeight: 800, fontSize: 13, padding: '8px 14px', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer', boxShadow: on ? '0 8px 18px -10px rgba(0,122,110,.8)' : 'none' }}>
            {Icon && <Icon size={14} />}{label}
          </button>
        )
      })}
    </div>
  )
}

export function useTabSwipe(ids: string[], value: string, set: (id: string) => void, enabled: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = (e.target as Element).closest('.aion-snap, .aion-hscroll, table, input, select, textarea') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s0 = start.current; start.current = null
      if (!s0 || !enabled) return
      const dx = e.changedTouches[0].clientX - s0.x, dy = e.changedTouches[0].clientY - s0.y
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
      const i = ids.indexOf(value)
      if (i < 0) return
      const n = ids[Math.max(0, Math.min(ids.length - 1, i + (dx < 0 ? 1 : -1)))]
      if (n !== value) { set(n); window.scrollTo?.({ top: 0 }) }
    },
  }
}
