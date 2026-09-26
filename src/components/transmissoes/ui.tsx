// Peças visuais das telas de Transmissões — mesmo visual de
// CaptacaoInteligente.tsx / GestorTransfers (Modal, KpiCard, pílulas).
import React from 'react'
import { X, Loader2 } from 'lucide-react'

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
  background: '#FAFAFA', boxSizing: 'border-box',
}
export const hintStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }
export const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }

export function Badge({ label, color, bg, icon }: { label: string; color: string; bg: string; icon?: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color, whiteSpace: 'nowrap' }}>
      {icon}{label}
    </span>
  )
}

export function Btn({ onClick, children, variant = 'primary', disabled, loading, type = 'button' }: {
  onClick?: () => void; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  disabled?: boolean; loading?: boolean; type?: 'button' | 'submit'
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: '#00A896', color: '#fff', border: 'none' },
    secondary: { background: '#fff', color: '#1e2d6b', border: '1.5px solid #E2E8F0' },
    danger:    { background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' },
    ghost:     { background: 'transparent', color: '#64748b', border: 'none' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
               cursor: disabled || loading ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, ...styles[variant] }}>
      {loading && <Loader2 size={14} className="animate-spin" />}{children}
    </button>
  )
}

export function KpiCard({ label, value, icon, bg, hint }: { label: string; value: string; icon: React.ReactNode; bg: string; hint?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.3 }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: '#1e2d6b', lineHeight: 1.1 }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Modal({ children, onClose, title, wide, footer }: {
  children: React.ReactNode; onClose: () => void; title: string; wide?: boolean; footer?: React.ReactNode
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: wide ? 860 : 520, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e2d6b' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}><X size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>{children}</div>
        {footer && <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}

export function ErrorBox({ message, details }: { message: string | null; details?: string[] }) {
  if (!message) return null
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', borderRadius: 10, padding: '10px 14px', fontSize: 13, lineHeight: 1.5 }}>
      <strong>{message}</strong>
      {details?.length ? <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{details.map((d, i) => <li key={i}>{d}</li>)}</ul> : null}
    </div>
  )
}

export function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{icon}</div>
      <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e2d6b' }}>{title}</p>
      <p style={{ margin: '0 auto 20px', fontSize: 13, color: '#64748b', maxWidth: 480, lineHeight: 1.6 }}>{text}</p>
      {action}
    </div>
  )
}

export function toggleIn<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter(x => x !== v) : [...list, v]
}
