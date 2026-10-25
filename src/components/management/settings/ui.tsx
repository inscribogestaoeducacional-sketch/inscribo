// Peças visuais compartilhadas das telas de Configurações (padrão do Business,
// cores do Edu). Só visual: nenhuma delas fala com o banco.
import { createContext, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { Loader2, Check, Save, ChevronRight, type LucideIcon } from 'lucide-react'
import { BRAND, GRAD, SHADOW } from '../../../lib/brand'

type IconType = LucideIcon

export const card: CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 20, boxShadow: SHADOW }
export const input: CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, color: BRAND.ink, borderRadius: 12, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' }
export const label: CSSProperties = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }
export const hint: CSSProperties = { fontSize: 12.5, color: BRAND.muted, margin: '8px 0 0', lineHeight: 1.45 }

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <section className="cfg-card" style={{ ...card, ...style }}>{children}</section>
}

/** Título de bloco: ícone suave + título + frase de ajuda. */
export function Title({ Icon, title, help }: { Icon: IconType; title: string; help?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
      <span style={{ width: 34, height: 34, borderRadius: 11, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{title}</div>
        {help && <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>{help}</div>}
      </div>
    </div>
  )
}

export function Switch({ on, onChange, disabled, labelText }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; labelText: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={labelText} disabled={disabled} onClick={() => onChange(!on)}
      style={{ width: 44, height: 24, borderRadius: 999, background: on ? BRAND.primary : '#CBD5E1', border: 'none', cursor: disabled ? 'default' : 'pointer', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: disabled ? 0.6 : 1, padding: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left .2s' }} />
    </button>
  )
}

/** Botão principal em degradê, com os estados salvando / salvo. */
export function SaveButton({ onClick, saving, saved, disabled, text = 'Salvar' }: { onClick: () => void; saving?: boolean; saved?: boolean; disabled?: boolean; text?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={saving || disabled} className="cfg-save"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 20px', borderRadius: 14, border: 'none', background: saved ? BRAND.success : GRAD, color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: saving || disabled ? 'default' : 'pointer', opacity: saving || disabled ? 0.7 : 1, fontFamily: 'inherit' }}>
      {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : saved ? <><Check size={16} /> Salvo!</> : <><Save size={16} /> {text}</>}
    </button>
  )
}

export function GhostButton({ children, onClick, disabled, danger, style }: { children: ReactNode; onClick?: () => void; disabled?: boolean; danger?: boolean; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="cfg-ghost"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: `1px solid ${danger ? '#FECACA' : BRAND.line}`, background: '#fff', color: danger ? BRAND.danger : BRAND.ink, fontWeight: 700, fontSize: 13, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1, fontFamily: 'inherit', whiteSpace: 'nowrap', ...style }}>
      {children}
    </button>
  )
}

export function Pill({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'ok' | 'warn' | 'bad' | 'gray' }) {
  const t = {
    brand: { c: BRAND.primaryDark, b: BRAND.soft }, ok: { c: BRAND.success, b: BRAND.successSoft },
    warn: { c: BRAND.warn, b: BRAND.warnSoft }, bad: { c: '#B91C1C', b: BRAND.dangerSoft }, gray: { c: BRAND.muted, b: '#F1F5F9' },
  }[tone]
  return <span style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, color: t.c, background: t.b, borderRadius: 999, padding: '4px 12px' }}>{children}</span>
}

/** Faixa "Valendo agora": mostra o valor que o sistema aplica de fato. */
export function NowNote({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: BRAND.primaryDark, background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>{children}</div>
}

export function WarnNote({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: '#92400E', background: BRAND.warnSoft, border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px', lineHeight: 1.5 }}>{children}</div>
}

/** Cabeçalho de uma tela de detalhe: "← Voltar" + título + frase. */
export function BackHeader({ backLabel, onBack, title, help }: { backLabel: string; onBack: () => void; title: string; help?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button type="button" onClick={onBack} aria-label={`Voltar para ${backLabel}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: BRAND.primaryDark, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '9px 14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit' }}>
        ← {backLabel}
      </button>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{title}</div>
        {help && <div style={{ fontSize: 12.5, color: BRAND.muted }}>{help}</div>}
      </div>
    </div>
  )
}

/** Cartão-atalho do início de um grupo (ícone, título, frase). */
export function Tile({ Icon, title, desc, onClick, highlight }: { Icon: IconType; title: string; desc: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="aion-tile aion-tap"
      style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start', fontFamily: 'inherit' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: highlight ? GRAD : BRAND.soft, color: highlight ? '#fff' : BRAND.primary }}><Icon size={19} /></span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{title}</span>
        <span style={{ fontSize: 12.5, color: BRAND.muted, lineHeight: 1.45 }}>{desc}</span>
      </span>
      <ChevronRight size={18} color={BRAND.faint} className="cfg-chev" aria-hidden />
    </button>
  )
}

/** Estilos globais das telas de Configurações (animação dos cartões, spinner). */
export function SettingsStyles() {
  return (
    <style>{`
      .animate-spin{animation:spin 1s linear infinite}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
      @keyframes aionSlide{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}
      .aion-slide{animation:aionSlide .26s cubic-bezier(.2,.8,.2,1) backwards}
      .aion-tile{transition:transform .15s ease, box-shadow .15s ease, border-color .15s ease}
      .cfg-chev{display:none;flex-shrink:0;align-self:center}
      @media (max-width:767px){
        .cfg-chev{display:block}
        .cfg-toast{left:14px !important;right:14px !important;top:70px !important}
        .cfg-m input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]):not([type=range]),.cfg-m select,.cfg-m textarea{font-size:16px !important;min-height:44px;max-width:100%;box-sizing:border-box}
        .cfg-m textarea{min-height:84px}
        .cfg-m .cfg-card{padding:16px !important}
        .cfg-m .cfg-card[style*="padding: 0px"]{padding:0 !important}
        .cfg-m table.aion-rt input:not([type=checkbox]){width:100% !important;text-align:left !important}
        .cfg-m [style*="border-radius: 16px"][style*="padding: 24px"]{padding:16px !important}
        .cfg-m .cfg-save{width:100%;justify-content:center;height:48px !important;font-size:15px !important}
        .cfg-m .cfg-ghost{min-height:44px;justify-content:center}
        .cfg-m button{min-height:40px}
        .cfg-m button[role=switch]{min-height:24px}
        .cfg-m button[style*="width: 20px"]{min-height:30px;min-width:36px}
        .cfg-m input[maxlength="2"]{width:56px !important;text-align:center !important}
        .cfg-m button[aria-label^=Cor]{min-height:36px;min-width:36px}
        .cfg-m .cfg-chip{min-height:40px}
        .cfg-m .cfg-tiny{min-height:0}
        .cfg-m :not(.aion-snap)[style*="grid-template-columns: repeat(auto-fit"],.cfg-m :not(.aion-snap)[style*="grid-template-columns: repeat(auto-fill"]{grid-template-columns:1fr !important}
        .cfg-m .cfg-stack{flex-wrap:wrap !important}
        .cfg-m .cfg-stack>input,.cfg-m .cfg-stack>select{flex:1 1 100% !important;min-width:0}
        .cfg-m .cfg-stack>button{flex:1 1 100%}
        .cfg-m *{overflow-wrap:anywhere}
        .cfg-m .cfg-card,.cfg-m .aion-slide{min-width:0}
      }
      .aion-tile:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(26,43,74,.08);border-color:${BRAND.softLine}}
    `}</style>
  )
}

/** Celular: a tela de detalhe mostra o nome do assunto e o "Voltar" dentro da faixa verde da página. */
export type SubHeader = { title: string; onBack: () => void } | null
export const SubHeaderCtx = createContext<((s: SubHeader) => void) | null>(null)
export function useSubHeader(s: SubHeader) {
  const set = useContext(SubHeaderCtx)
  const backRef = useRef<(() => void) | null>(null)
  backRef.current = s?.onBack ?? null
  const title = s?.title ?? null
  useEffect(() => {
    if (!set || !title) return
    set({ title, onBack: () => backRef.current?.() })
    return () => set(null)
  }, [title]) // eslint-disable-line react-hooks/exhaustive-deps
}
