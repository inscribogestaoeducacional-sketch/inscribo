import React, { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { cardBtn } from '../mobile/StatStrip'
import { GRAD } from '../../lib/brand'
import type { Survey } from './surveyShared'

// ─── janela (modal) no padrão do sistema ─────────────────────────────────
// Computador: caixa centralizada. Celular (<768px): tela cheia, graças à classe
// `m-sheet` (src/index.css) — o painel precisa ser filho direto do overlay.
let sheetSeq = 0
const sheetStack: number[] = []

export function Sheet({ onClose, title, subtitle, icon: Icon, headerActions, children, footer, maxWidth = 560, z = 9999 }: {
  onClose: () => void
  title: React.ReactNode
  subtitle?: React.ReactNode
  icon?: React.ElementType
  headerActions?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
  z?: number
}) {
  // Esc fecha só a janela de cima (há janelas empilhadas: editor > pergunta)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const id = ++sheetSeq
    sheetStack.push(id)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === id) closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); sheetStack.splice(sheetStack.indexOf(id), 1) }
  }, [])
  return (
    <div className="m-sheet" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,.5)', zIndex: z, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#F5FAF9', borderRadius: 22, width: '100%', maxWidth, maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 30px 80px -20px rgba(26,43,74,.5)' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 5, background: GRAD, color: '#fff', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {Icon && (
              <div aria-hidden style={{ width: 38, height: 38, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.28)' }}>
                <Icon size={18} color="#fff" />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.25, wordBreak: 'break-word' }}>{title}</h2>
              {subtitle && <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.88)', marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="aion-tap"
              style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>
          {headerActions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{headerActions}</div>}
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ position: 'sticky', bottom: 0, zIndex: 5, background: '#fff', borderTop: '1px solid #E3E8F0', padding: '12px 16px calc(12px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── confirmação (no lugar do confirm() do navegador) ───────────────────────
export interface ConfirmState { title: string; message: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }

export function ConfirmDialog({ state, onCancel }: { state: ConfirmState; onCancel: () => void }) {
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,43,74,.5)', zIndex: 10100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div role="alertdialog" style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 400, padding: 20, boxShadow: '0 30px 80px -20px rgba(26,43,74,.5)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 40, height: 40, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: state.danger ? '#FEF2F2' : '#E6F7F5', color: state.danger ? '#DC2626' : '#05907B' }}>
            <AlertTriangle size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1A2B4A' }}>{state.title}</p>
            <p style={{ margin: '6px 0 0', fontSize: 14, color: '#5B6B86', lineHeight: 1.5 }}>{state.message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onCancel} style={cardBtn('ghost')}>Cancelar</button>
          <button type="button" onClick={state.onConfirm}
            style={state.danger ? { ...cardBtn('ghost'), background: '#DC2626', color: '#fff', border: 'none' } : cardBtn('primary')}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── pequenos blocos ─────────────────────────────────────────────────────
export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      style={{ width: 48, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? '#05907B' : '#CBD5E1', position: 'relative', flexShrink: 0, padding: 0, transition: 'background .2s' }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)' }} />
    </button>
  )
}

const STATUS_CFG = {
  draft:  { label: 'Rascunho',  bg: '#F1F5F9', color: '#475569' },
  active: { label: 'Ativa',     bg: '#D1FAE5', color: '#065F46' },
  closed: { label: 'Encerrada', bg: '#DBEAFE', color: '#1E40AF' },
} as const

export function StatusBadge({ status }: { status: Survey['status'] }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {cfg.label}
    </span>
  )
}

export function IconBtn({ onClick, label, children, danger, disabled }: {
  onClick: () => void; label: string; children: React.ReactNode; danger?: boolean; disabled?: boolean
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} disabled={disabled} className="aion-tap"
      style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, border: `1px solid ${danger ? '#FECACA' : '#E3E8F0'}`, background: '#fff', color: danger ? '#DC2626' : '#5B6B86' }}>
      {children}
    </button>
  )
}

export function EmptyState({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E3E8F0', borderRadius: 18, padding: '36px 20px', textAlign: 'center' }}>
      <span style={{ width: 52, height: 52, borderRadius: 18, background: '#E6F7F5', color: '#05907B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Icon size={24} /></span>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A2B4A' }}>{title}</p>
      {hint && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5B6B86', lineHeight: 1.5 }}>{hint}</p>}
    </div>
  )
}
