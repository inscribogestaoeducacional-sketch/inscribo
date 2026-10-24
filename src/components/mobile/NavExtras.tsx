// Navegação do celular (23/10/2026, pedido do Victor):
//  - ModuleTabs: as partes do módulo aberto (ex.: Cartão Digital → Blocos,
//    Redes sociais, Aparência…) numa fileira no topo, para trocar com um toque
//    sem voltar ao Menu. Aparece no espaço #aion-module-tabs do layout.
//  - DockEditor: "Personalizar a barra" — a pessoa escolhe os 3 atalhos da
//    barra de baixo; o Atendimento fica fixo no meio e o Menu no canto.
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Lock } from 'lucide-react'
type LucideIcon = React.ComponentType<any>
import { BottomSheet, GRAD, INK, MUTED } from './MobileShell'

export interface TabPart { label: string; Icon?: LucideIcon; active: boolean; onPress: () => void }

export const MODULE_TABS_SLOT = 'aion-module-tabs'

export function ModuleTabs({ parts }: { parts: TabPart[] }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const row = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => { setSlot(document.getElementById(MODULE_TABS_SLOT)) }, [])
  const activeIdx = parts.findIndex(p => p.active)
  // A aba ativa sempre à vista (centraliza quando muda).
  useEffect(() => {
    const el = row.current?.children[activeIdx] as HTMLElement | undefined
    if (el && row.current) row.current.scrollTo({ left: el.offsetLeft - (row.current.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [activeIdx, slot])
  if (!slot || parts.length < 2) return null
  return createPortal(
    <div ref={row} role="tablist" aria-label="Partes do módulo" className="aion-tabs-row aion-hscroll"
      style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '10px 14px', background: '#fff', borderBottom: '1px solid #E3E8F0', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {parts.map(p => (
        <button key={p.label} role="tab" aria-selected={p.active} onClick={p.onPress} className="aion-tap"
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 999, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
            border: `1px solid ${p.active ? INK : '#E3E8F0'}`, background: p.active ? INK : '#fff', color: p.active ? '#fff' : '#5B6B86',
          }}>
          {p.Icon && <p.Icon size={15} strokeWidth={2.1} />}{p.label}
        </button>
      ))}
    </div>,
    slot,
  )
}

export interface DockChoice { id: string; label: string; Icon: LucideIcon }

export function DockEditor({ open, onClose, options, value, centerLabel, CenterIcon, MenuIcon, onSave }: {
  open: boolean; onClose: () => void; options: DockChoice[]; value: string[]
  centerLabel: string | null; CenterIcon?: LucideIcon; MenuIcon: LucideIcon; onSave: (ids: string[]) => Promise<void> | void
}) {
  const [sel, setSel] = useState<string[]>(value)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) setSel(value) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  const max = centerLabel ? 3 : 4
  const toggle = (id: string) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.length >= max ? [...s.slice(1), id] : [...s, id])
  const byId = new Map(options.map(o => [o.id, o]))
  const slots = sel.map(id => byId.get(id)).filter(Boolean) as DockChoice[]
  const Slot = ({ o, fixed, Icon, label }: { o?: DockChoice; fixed?: boolean; Icon?: LucideIcon; label?: string }) => {
    const I = o?.Icon || Icon
    return (
      <div style={{ flex: 1, minWidth: 0, borderRadius: 14, padding: '8px 2px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        border: `1.5px ${fixed ? 'dashed #CBD5E1' : o ? 'solid #05907B' : 'dashed #E3E8F0'}`, background: fixed ? '#F1F5F9' : o ? '#EFF6FF' : '#fff',
        color: fixed ? MUTED : o ? '#05907B' : '#CBD5E1', fontSize: 10.5, fontWeight: 700 }}>
        {I ? <I size={17} strokeWidth={2.1} /> : <span style={{ height: 17 }} />}
        <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{o?.label || label || '—'}</span>
        {fixed && <span style={{ fontSize: 9, display: 'inline-flex', alignItems: 'center', gap: 2 }}><Lock size={8} /> fixo</span>}
      </div>
    )
  }
  return (
    <BottomSheet open={open} onClose={onClose} label="Personalizar a barra">
      <div style={{ padding: '4px 18px 20px', overflowY: 'auto' }}>
        <div style={{ fontSize: 19, fontWeight: 800, color: INK }}>Personalizar a barra</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>
          {centerLabel ? <>O {centerLabel} fica sempre no meio e o Menu no canto. Escolha os outros {max} atalhos.</> : <>O Menu fica no canto. Escolha {max} atalhos.</>}
        </div>
        <div style={{ display: 'flex', gap: 6, margin: '16px 0 4px' }}>
          {centerLabel ? <>
            <Slot o={slots[0]} /><Slot o={slots[1]} /><Slot fixed Icon={CenterIcon} label={centerLabel} /><Slot o={slots[2]} /><Slot fixed Icon={MenuIcon} label="Menu" />
          </> : <>
            <Slot o={slots[0]} /><Slot o={slots[1]} /><Slot o={slots[2]} /><Slot o={slots[3]} /><Slot fixed Icon={MenuIcon} label="Menu" />
          </>}
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', margin: '16px 2px 8px' }}>Atalhos dos seus módulos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
          {options.map(o => {
            const on = sel.includes(o.id)
            return (
              <button key={o.id} onClick={() => toggle(o.id)} aria-pressed={on} className="aion-tap"
                style={{ position: 'relative', borderRadius: 14, padding: '11px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${on ? '#05907B' : '#E3E8F0'}`, background: on ? '#EFF6FF' : '#fff', color: on ? '#05907B' : '#334155', fontSize: 11, fontWeight: 700 }}>
                {on && <span style={{ position: 'absolute', top: 5, right: 5, width: 16, height: 16, borderRadius: '50%', background: '#05907B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="#fff" strokeWidth={3} /></span>}
                <o.Icon size={20} strokeWidth={2} />
                <span style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{o.label}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => setSel([])} style={{ flex: 1, height: 50, borderRadius: 14, border: '1px solid #E3E8F0', background: '#fff', color: INK, fontWeight: 700, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>Usar a sugestão</button>
          <button disabled={busy} onClick={async () => { setBusy(true); try { await onSave(sel) } finally { setBusy(false) } }}
            style={{ flex: 1.4, height: 50, borderRadius: 14, border: 'none', background: GRAD, color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit', cursor: 'pointer', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

/** Conversas com mensagem não lida (para o número no botão do Atendimento). */
export function useUnreadChats(companyId: string | null | undefined, userId: string | null | undefined, enabled: boolean, refreshKey?: string) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!companyId || !userId || !enabled) { setN(0); return }
    let alive = true
    const load = async () => {
      const { supabase } = await import('../../lib/supabase')
      const { count } = await supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
        .eq('institution_id', companyId).eq('assigned_user_id', userId).gt('unread_count', 0).neq('status', 'closed')
      if (alive) setN(count || 0)
    }
    load()
    const t = setInterval(load, 45000)
    return () => { alive = false; clearInterval(t) }
  }, [companyId, userId, enabled, refreshKey])
  return n
}
