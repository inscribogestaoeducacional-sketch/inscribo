// Peças visuais compartilhadas do editor da Vitrine (mesmo vocabulário
// visual do Captação: inputs #FAFAFA com borda #E2E8F0, rótulo em caixa alta,
// teal #00A896 como cor de ação).
import React, { useId } from 'react'
import MediaUploader from './MediaUploader'

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
}
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none',
  background: '#FAFAFA', boxSizing: 'border-box', color: '#1e293b', fontFamily: 'inherit',
}
export const hintStyle: React.CSSProperties = { margin: '4px 0 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }
export const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }

// O rótulo aponta pro campo (htmlFor/id) quando o filho é um input/textarea/
// select — leitor de tela anuncia o nome do campo e o clique no rótulo foca.
const LABELABLE = new Set(['input', 'textarea', 'select'])

export function Field({ label, hint, children, counter }: {
  label: string; hint?: React.ReactNode; children: React.ReactNode; counter?: { value: string; max: number }
}) {
  const autoId = useId()
  const single = React.Children.count(children) === 1 && React.isValidElement(children) ? children as React.ReactElement<any> : null
  const labelable = !!single && (LABELABLE.has(single.type as string) || single.type === TextInput || single.type === TextArea)
  const id = labelable ? (single!.props.id || autoId) : undefined
  const content = labelable && !single!.props.id ? React.cloneElement(single!, { id }) : children
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <label style={labelStyle} htmlFor={id}>{label}</label>
        {counter && (
          <span style={{ fontSize: 11, color: counter.value.length > counter.max ? '#dc2626' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            {counter.value.length}/{counter.max}
          </span>
        )}
      </div>
      {content}
      {hint && <p style={hintStyle}>{hint}</p>}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }}
    onFocus={e => { e.currentTarget.style.borderColor = '#00A896'; props.onFocus?.(e) }}
    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; props.onBlur?.(e) }} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, ...(props.style || {}) }}
    onFocus={e => { e.currentTarget.style.borderColor = '#00A896'; props.onFocus?.(e) }}
    onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; props.onBlur?.(e) }} />
}

export function Toggle({ checked, onChange, label, description, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: React.ReactNode; disabled?: boolean
}) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          flex: 'none', width: 36, height: 20, borderRadius: 999, border: 'none', padding: 2, marginTop: 1,
          background: checked ? '#00A896' : '#CBD5E1', cursor: 'inherit', transition: 'background .15s',
          display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start',
        }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
      </button>
      <span>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{label}</span>
        {description && <span style={{ display: 'block', fontSize: 12, color: '#64748b', lineHeight: 1.5, marginTop: 2 }}>{description}</span>}
      </span>
    </label>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4, flexWrap: 'wrap' }}>
      {options.map(o => {
        const sel = o.value === value
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={sel} onClick={() => onChange(o.value)}
            style={{
              flex: '1 1 auto', padding: '6px 12px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: sel ? '#fff' : 'transparent', color: sel ? '#1e2d6b' : '#64748b',
              boxShadow: sel ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Seletor de imagem (logo, capa, miniatura, fundo): mesma interface de
// antes, agora sobre o MediaUploader (clique ou arraste). Devolve a URL
// pública; quem chama decide o que fazer com a antiga (removeVitrineImage).
export function ImagePicker({ institutionId, value, onChange, shape = 'rect', height = 96, emptyLabel = 'Enviar imagem', onError, maxWidth, recommended, fit }: {
  institutionId: string
  value: string | null
  onChange: (url: string | null) => void
  shape?: 'rect' | 'circle'
  height?: number
  emptyLabel?: string
  onError: (msg: string) => void
  maxWidth?: number   // largura máxima depois da redução (padrão: IMAGE_WIDTH.large)
  recommended?: string
  fit?: 'cover' | 'contain'
}) {
  return <MediaUploader institutionId={institutionId} value={value} onChange={onChange} onError={onError}
    label={emptyLabel} maxWidth={maxWidth} shape={shape} height={height} recommended={recommended}
    fit={fit ?? (shape === 'circle' ? 'contain' : 'cover')} />
}
