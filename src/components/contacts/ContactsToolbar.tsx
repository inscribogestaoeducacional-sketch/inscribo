// Peças da tela de Contatos no padrão AION: resumo único (tipos + pendências),
// botão de filtros consolidado e menu "Ações".
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, ChevronDown, GitMerge, GraduationCap, HelpCircle, Link2Off, MessageCircle, MoreHorizontal, Plug, SlidersHorizontal, Target, UserRoundX, Users, X, type LucideIcon } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { CountUp } from '../campanha/CampaignCharts'
import type { ContactAttentionKey } from './ContactsAttention'

interface Counts { sem_nome: number; duplicados: number; sem_relacao: number; sem_lead: number; api_resp: number }

/* ───────────── Resumo: tipos + pendências ───────────── */
export function ContactsSummary({ kpi, origin, onOrigin, counts, attention, onAttention, compact }: {
  kpi: { total: number; lead: number; client: number; unknown: number }
  origin: string; onOrigin: (v: string) => void
  counts: Counts | null; attention: ContactAttentionKey | null; onAttention: (k: ContactAttentionKey | null) => void
  compact?: boolean
}) {
  const types: { v: string; label: string; n: number; Icon: LucideIcon; color: string; bg: string }[] = [
    { v: 'all', label: 'Todos', n: kpi.total, Icon: Users, color: '#2563EB', bg: '#EFF6FF' },
    { v: 'lead', label: 'Leads', n: kpi.lead, Icon: Target, color: '#7C3AED', bg: '#F5F3FF' },
    { v: 'client', label: 'Clientes', n: kpi.client, Icon: GraduationCap, color: '#047857', bg: '#ECFDF5' },
    { v: 'unknown', label: 'WhatsApp', n: kpi.unknown, Icon: MessageCircle, color: '#B45309', bg: '#FFFBEB' },
  ]
  const c = counts ?? { sem_nome: 0, duplicados: 0, sem_relacao: 0, sem_lead: 0, api_resp: 0 }
  const pend: { key: ContactAttentionKey; label: string; n: number; Icon: LucideIcon; color: string; alert?: boolean }[] = [
    { key: 'name', label: 'sem nome', n: c.sem_nome, Icon: UserRoundX, color: '#B91C1C', alert: true },
    { key: 'dup', label: 'duplicados', n: c.duplicados, Icon: GitMerge, color: '#B45309' },
    { key: 'rel', label: 'sem relação', n: c.sem_relacao, Icon: HelpCircle, color: '#4F46E5' },
    { key: 'nolead', label: 'leads sem contato', n: c.sem_lead, Icon: Link2Off, color: '#5B6B86' },
  ]
  const shown = pend.filter(p => p.n > 0 || attention === p.key)
  return (
    <div className="ld-in" style={compact ? { display: 'flex', flexDirection: 'column', gap: 10 } : { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={compact ? 'aion-snap' : undefined} style={{ display: 'grid', gridTemplateColumns: compact ? undefined : 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        {types.map((t, i) => {
          const on = origin === t.v
          const Icon = t.Icon
          return (
            <button key={t.v} type="button" className="ld-kpi ld-in" data-on={on ? '1' : '0'} onClick={() => onOrigin(on && t.v !== 'all' ? 'all' : t.v)} aria-pressed={on}
              style={{ animationDelay: `${i * 50}ms`, position: 'relative', overflow: 'hidden', background: on ? t.bg : '#fff', border: `${on ? 2 : 1}px solid ${on ? t.color : BRAND.line}`, borderRadius: 14, padding: compact ? '10px 12px' : '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: compact ? 32 : 38, height: compact ? 32 : 38, borderRadius: 12, background: t.bg, color: t.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={compact ? 16 : 19} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: compact ? 20 : 26, fontWeight: 800, lineHeight: 1.1, color: on ? t.color : BRAND.ink }}><CountUp value={t.n} /></span>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: on ? t.color : '#5B6B86' }}>{t.label}</span>
              </span>
              <span aria-hidden style={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: kpi.total ? `${Math.max(4, (t.n / kpi.total) * 100)}%` : 0, background: t.color, opacity: on ? 1 : 0.35, transition: 'width .8s ease' }} />
            </button>
          )
        })}
      </div>
      {(shown.length > 0 || c.api_resp > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#5B6B86', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} color="#B45309" />Para resolver:</span>
          {shown.map(p => {
            const on = attention === p.key
            const Icon = p.Icon
            return (
              <button key={p.key} type="button" onClick={() => onAttention(on ? null : p.key)} aria-pressed={on}
                className={p.alert && !on ? 'ld-alert' : ''}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  background: on ? BRAND.primary : '#fff', color: on ? '#fff' : p.color, border: `1.5px solid ${on ? BRAND.primary : p.alert ? '#FCA5A5' : BRAND.line}` }}>
                <Icon size={13} />{p.n.toLocaleString('pt-BR')} {p.label}
              </button>
            )
          })}
          {c.api_resp > 0 && (
            <button type="button" onClick={() => onAttention(attention === 'api' ? null : 'api')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: '#F0FDFB', color: '#00695F', border: '1.5px solid #99F6E4' }}>
              <Plug size={12} />{c.api_resp.toLocaleString('pt-BR')} da integração
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────── Menu flutuante (portal, para não cortar na faixa verde) ───────────── */
function useFloating(open: boolean, anchor: React.RefObject<HTMLElement | null>, width: number) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  useEffect(() => {
    if (!open || !anchor.current) return
    const place = () => {
      const r = anchor.current!.getBoundingClientRect()
      const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
      setPos({ top: r.bottom + 8, left })
    }
    place()
    window.addEventListener('resize', place); window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchor, width])
  return pos
}

function Popover({ open, onClose, anchor, width, children }: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement | null>; width: number; children: ReactNode }) {
  const pos = useFloating(open, anchor, width)
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, onClose])
  if (!open || !pos) return null
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
      <div className="ld-in" style={{ position: 'fixed', top: pos.top, left: pos.left, width, maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto', zIndex: 901, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, boxShadow: '0 18px 40px -16px rgba(26,43,74,.35)', padding: 6 }}>
        {children}
      </div>
    </>, document.body)
}

/* ───────────── Ações (⋯) ───────────── */
export function ActionsMenu({ items, light }: { items: { label: string; hint?: string; Icon: LucideIcon; onClick: () => void }[]; light?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 11, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          border: '1px solid rgba(255,255,255,.4)', background: 'rgba(255,255,255,.14)', color: '#fff', ...(light ? { background: '#fff', color: BRAND.ink, border: `1px solid ${BRAND.line}` } : {}) }}>
        <MoreHorizontal size={15} /> Ações <ChevronDown size={13} style={{ transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} width={260}>
        {items.map(it => {
          const Icon = it.Icon
          return (
            <button key={it.label} type="button" className="ld-row" onClick={() => { setOpen(false); it.onClick() }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', border: 'none', background: 'transparent', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: '#F0FDFB', color: BRAND.primaryDark ?? '#00695F', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon size={15} /></span>
              <span>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{it.label}</span>
                {it.hint && <span style={{ display: 'block', fontSize: 11.5, color: '#5B6B86' }}>{it.hint}</span>}
              </span>
            </button>
          )
        })}
      </Popover>
    </>
  )
}

/* ───────────── Filtros consolidados ───────────── */
export interface FilterField { key: string; label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }

export function FiltersButton({ fields, onClear }: { fields: FilterField[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const active = fields.filter(f => f.value !== 'all')
  return (
    <>
      <button ref={ref} type="button" onClick={() => setOpen(o => !o)} aria-haspopup="dialog" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          background: active.length ? '#F0FDFA' : '#fff', color: active.length ? '#00695F' : BRAND.ink, border: `1.5px solid ${active.length ? BRAND.primary : '#E2E8F0'}` }}>
        <SlidersHorizontal size={14} /> Filtros
        {active.length > 0 && <span style={{ background: BRAND.primary, color: '#fff', borderRadius: 999, minWidth: 18, height: 18, padding: '0 5px', fontSize: 11, display: 'grid', placeItems: 'center' }}>{active.length}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} width={320}>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink }}>Filtrar contatos</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#5B6B86', display: 'grid' }}><X size={16} /></button>
          </div>
          {fields.map(f => (
            <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, fontWeight: 700, color: '#5B6B86', textTransform: 'uppercase', letterSpacing: '.03em' }}>
              {f.label}
              <select value={f.value} onChange={e => f.onChange(e.target.value)}
                style={{ border: `1.5px solid ${f.value !== 'all' ? BRAND.primary : '#E2E8F0'}`, background: f.value !== 'all' ? '#F0FDFA' : '#fff', borderRadius: 10, padding: '9px 10px', fontSize: 13.5, color: BRAND.ink, outline: 'none', textTransform: 'none', letterSpacing: 0, fontWeight: 500, fontFamily: 'inherit' }}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
          {active.length > 0 && (
            <button type="button" onClick={() => { onClear(); setOpen(false) }}
              style={{ border: '1.5px solid #FCA5A5', background: '#FEF2F2', color: '#DC2626', borderRadius: 10, padding: '9px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Limpar filtros
            </button>
          )}
        </div>
      </Popover>
    </>
  )
}

/** Chips dos filtros ativos, com ✕ para tirar cada um. */
export function ActiveChips({ fields }: { fields: FilterField[] }) {
  const act = fields.filter(f => f.value !== 'all')
  if (!act.length) return null
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {act.map(f => (
        <span key={f.key} className="ld-in" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 999, background: '#F0FDFA', border: '1px solid #99F6E4', color: '#00695F', fontSize: 12, fontWeight: 700 }}>
          {f.label}: {f.options.find(o => o.value === f.value)?.label ?? f.value}
          <button type="button" onClick={() => f.onChange('all')} aria-label={`Remover filtro ${f.label}`} style={{ border: 'none', background: 'rgba(0,122,110,.12)', color: '#00695F', borderRadius: 999, width: 18, height: 18, display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0 }}><X size={11} /></button>
        </span>
      ))}
    </div>
  )
}
