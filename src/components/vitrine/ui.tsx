// Peças visuais compartilhadas do editor da Vitrine (mesmo vocabulário
// visual do Captação: inputs #FAFAFA com borda #E2E8F0, rótulo em caixa alta,
// teal #00A896 como cor de ação).
import React, { useId } from 'react'
import MediaUploader from './MediaUploader'

// Tokens do design system do Áion (src/index.css): as mesmas sombras em
// duas camadas com tom teal, a escala de raios 8/12/16/20 e a transição do
// resto do painel. Todo o editor da Vitrine usa estes valores.
export const DS = {
  shadowSm: '0 1px 3px rgba(0,168,150,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 16px rgba(0,168,150,0.10), 0 2px 4px rgba(0,0,0,0.04)',
  shadowLg: '0 8px 24px rgba(0,168,150,0.12), 0 4px 8px rgba(0,0,0,0.04)',
  // Janelas e a moldura da prévia: a "lg" um degrau mais funda.
  shadowXl: '0 24px 48px rgba(15,23,42,0.14), 0 8px 16px rgba(0,168,150,0.08)',
  focusRing: '0 0 0 3px rgba(0,168,150,0.14)',
  r: { sm: 8, md: 12, lg: 16, xl: 20 },
  ease: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
  navy: '#1A2B4A', text: '#1e293b', muted: '#64748B', faint: '#94A3B8', border: '#E2E8F0',
} as const

export const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
}
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: DS.r.md,
  border: `1.5px solid ${DS.border}`, fontSize: 14, outline: 'none', lineHeight: 1.4,
  background: '#FAFAFA', boxSizing: 'border-box', color: DS.text, fontFamily: 'inherit',
  transition: 'border-color .18s cubic-bezier(0.4,0,0.2,1), box-shadow .18s cubic-bezier(0.4,0,0.2,1), background-color .18s cubic-bezier(0.4,0,0.2,1)',
}
export const hintStyle: React.CSSProperties = { margin: '6px 0 0', fontSize: 12, color: DS.faint, lineHeight: 1.55 }
export const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: DS.r.xl, border: `1px solid ${DS.border}`, boxShadow: DS.shadowSm }
// Título de seção dentro de um painel (Identidade, Fundo, Endereço...).
export const sectionTitleStyle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: DS.navy, letterSpacing: '-0.01em' }

// Foco dos campos: borda teal + anel suave (padrão dos formulários do Áion).
const focusOn = (el: HTMLElement) => { el.style.borderColor = '#00A896'; el.style.boxShadow = DS.focusRing; el.style.background = '#fff' }
const focusOff = (el: HTMLElement) => { el.style.borderColor = DS.border; el.style.boxShadow = 'none'; el.style.background = '#FAFAFA' }

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
    onFocus={e => { focusOn(e.currentTarget); props.onFocus?.(e) }}
    onBlur={e => { focusOff(e.currentTarget); props.onBlur?.(e) }} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55, ...(props.style || {}) }}
    onFocus={e => { focusOn(e.currentTarget); props.onFocus?.(e) }}
    onBlur={e => { focusOff(e.currentTarget); props.onBlur?.(e) }} />
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
          background: checked ? '#00A896' : '#CBD5E1', cursor: 'inherit', transition: DS.ease,
          display: 'flex', justifyContent: checked ? 'flex-end' : 'flex-start',
        }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
      </button>
      <span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: DS.text }}>{label}</span>
        {description && <span style={{ display: 'block', fontSize: 12, color: DS.muted, lineHeight: 1.55, marginTop: 2 }}>{description}</span>}
      </span>
    </label>
  )
}

export function Segmented<T extends string | number>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: DS.r.md, padding: 4, flexWrap: 'wrap' }}>
      {options.map(o => {
        const sel = o.value === value
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={sel} onClick={() => onChange(o.value)}
            style={{
              flex: '1 1 auto', padding: '8px 12px', borderRadius: DS.r.sm, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: sel ? '#fff' : 'transparent', color: sel ? DS.navy : DS.muted,
              boxShadow: sel ? DS.shadowMd : 'none', transition: DS.ease,
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
