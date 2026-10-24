// Cara de aplicativo no celular (Fase 5c, 22/10/2026). Peças usadas pelo
// sistema do cliente e pelo Super Admin:
//  - AppDock: barra flutuante embaixo, com 4 atalhos e o botão Menu;
//  - BottomSheet: janela que sobe de baixo, fecha arrastando para baixo,
//    tocando fora ou no X, sempre com animação de entrada e de saída;
//  - MenuSheet: o menu completo em blocos, com busca e, nos módulos com
//    partes, uma segunda tela que entra deslizando;
//  - goTo: troca de tela com transição (sai uma, entra a outra), quando o
//    navegador permite; senão a tela nova só entra suave (aion-page-in).
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync, createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, LayoutGrid, Search, X } from 'lucide-react'

export const GRAD = 'var(--aion-grad)'
export const INK = '#1A2B4A'
export const MUTED = '#64748B'
// Fundos dos ícones: tons da paleta da Áion, um por grupo.
export const TINTS: { bg: string; fg: string }[] = [
  { bg: '#E6F7F5', fg: '#00695F' }, { bg: '#E8F8F4', fg: '#05907B' }, { bg: '#E0F7F3', fg: '#00806D' },
  { bg: '#EAF6F3', fg: '#00695F' }, { bg: '#E3F6F1', fg: '#05907B' }, { bg: '#ECFDF5', fg: '#047857' },
]

type IconT = React.ComponentType<any>

let vtNav = false
/** Conteúdo da tela, com entrada suave quando a troca não veio pelo goTo. */
export function PageAnim({ pathKey, children, style }: { pathKey: string; children: React.ReactNode; style?: React.CSSProperties }) {
  // aion-page: estilo do visual novo (cartões, cascata) — sempre; aion-page-in: entrada da página (sem View Transition)
  // "Puxar para atualizar" (lib/pullToRefresh): monta a tela de novo, que busca os dados outra vez.
  const [n, setN] = useState(0)
  useEffect(() => { const on = () => setN(v => v + 1); window.addEventListener('aion:refresh', on); return () => window.removeEventListener('aion:refresh', on) }, [])
  const cls = useMemo(() => (vtNav ? 'aion-page' : 'aion-page aion-page-in'), [pathKey, n]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div key={`${pathKey}#${n}`} className={cls} style={style}>{children}</div>
}

/** Troca de tela com animação de saída e entrada (View Transitions). */
export function goTo(navigate: (to: string) => void, to: string, dir: 'forward' | 'back' | 'fade' = 'fade') {
  const doc = document as any
  if (typeof doc.startViewTransition !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { navigate(to); return }
  document.documentElement.dataset.nav = dir
  const t = doc.startViewTransition(() => { vtNav = true; try { flushSync(() => navigate(to)) } finally { vtNav = false } })
  t.finished.finally(() => { delete document.documentElement.dataset.nav })
}

// ─── Barra de baixo ───────────────────────────────────────────────────────
export interface DockItem { key: string; label: string; Icon: IconT; active: boolean; badge?: number; onPress: () => void }

export function AppDock({ items, menuOpen, menuActive, menuBadge, onMenu, center }: { items: DockItem[]; menuOpen: boolean; menuActive: boolean; menuBadge?: number; onMenu: () => void; center?: DockItem }) {
  // Avisos, botões flutuantes e barras presas embaixo sobem acima da barra.
  useEffect(() => {
    document.documentElement.style.setProperty('--dock', 'calc(84px + env(safe-area-inset-bottom))')
    return () => { document.documentElement.style.removeProperty('--dock') }
  }, [])
  const menu: DockItem = { key: '__menu', label: 'Menu', Icon: menuOpen ? X : LayoutGrid, active: menuOpen || menuActive, badge: menuOpen ? 0 : menuBadge, onPress: onMenu }
  // Com "center" (Atendimento): 2 atalhos | botão redondo no meio | 1 atalho + Menu.
  const all: DockItem[] = center ? [...items.slice(0, 2), center, ...items.slice(2), menu] : [...items, menu]
  return (
    <nav className="aion-dock" aria-label="Navegação principal" style={{
      position: 'fixed', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', zIndex: menuOpen ? 1200 : 60,
      height: 66, borderRadius: 24, background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(18px) saturate(1.6)', WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
      border: '1px solid rgba(209,250,229,.9)', boxShadow: '0 10px 30px rgba(26,43,74,.14), 0 2px 6px rgba(26,43,74,.06)',
      display: 'flex', alignItems: 'stretch', padding: '0 4px',
    }}>
      {all.map(it => it === center ? (
        <button key={it.key} onClick={it.onPress} aria-current={it.active ? 'page' : undefined} aria-label={it.label} className="aion-tap"
          style={{ flex: 1.15, minWidth: 0, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 9, cursor: 'pointer', position: 'relative', fontFamily: 'inherit' }}>
          <span style={{
            position: 'absolute', top: -22, width: 60, height: 60, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#34D96B 0%,#16A34A 100%)', border: '4px solid var(--bg-page, #F6F8FB)',
            boxShadow: it.active ? '0 10px 26px rgba(22,163,74,.55), 0 0 0 3px rgba(22,163,74,.20)' : '0 10px 24px rgba(22,163,74,.42)', boxSizing: 'border-box',
          }}>
            <it.Icon size={25} strokeWidth={2.2} weight="fill" color="#fff" />
            {!!it.badge && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, padding: '0 4px', borderRadius: 999, background: '#F43F5E', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxSizing: 'border-box' }}>{it.badge > 99 ? '99+' : it.badge}</span>}
          </span>
          <span style={{ fontSize: 10.5, lineHeight: 1, fontWeight: 800, color: INK, whiteSpace: 'nowrap' }}>{it.label}</span>
        </button>
      ) : (
        <button key={it.key} onClick={it.onPress} aria-current={it.active && it.key !== '__menu' ? 'page' : undefined} className="aion-tap"
          style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', position: 'relative', fontFamily: 'inherit', padding: 0 }}>
          <span key={String(it.active)} style={{
            width: it.active ? 46 : 34, height: 30, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: it.active ? GRAD : 'transparent', boxShadow: it.active ? '0 6px 14px rgba(5,144,123,.30)' : 'none',
            transition: 'width .25s cubic-bezier(.3,1.4,.5,1), background .2s', animation: it.active ? 'aionDockPop .35s cubic-bezier(.3,1.4,.5,1)' : undefined,
          }}>
            <it.Icon size={19} strokeWidth={it.active ? 2.4 : 1.9} weight={it.active ? "fill" : "duotone"} color={it.active ? '#fff' : '#5B6B86'} />
          </span>
          <span style={{ fontSize: 10.5, lineHeight: 1, fontWeight: it.active ? 800 : 600, color: it.active ? INK : '#64748B', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }}>{it.label}</span>
          {!!it.badge && <span style={{ position: 'absolute', top: 6, left: '50%', marginLeft: 8, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: '#F43F5E', color: '#fff', fontSize: 9.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{it.badge > 99 ? '99+' : it.badge}</span>}
        </button>
      ))}
    </nav>
  )
}
/** Espaço no fim da tela para o conteúdo não ficar atrás da barra. */
export const DOCK_SPACE = 'calc(92px + env(safe-area-inset-bottom))'

// ─── Janela que sobe de baixo ─────────────────────────────────────────────
export function BottomSheet({ open, onClose, children, label, aboveDock, height }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string; aboveDock?: boolean; height?: string }) {
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [drag, setDrag] = useState(0)
  const start = useRef<number | null>(null)
  useEffect(() => {
    if (open) { setMounted(true); setClosing(false); setDrag(0) }
    else if (mounted) { setClosing(true); const t = setTimeout(() => { setMounted(false); setClosing(false) }, 230); return () => clearTimeout(t) }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc) }
  }, [open, onClose])
  if (!mounted) return null
  const bottom = aboveDock ? 'calc(84px + env(safe-area-inset-bottom))' : 0
  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(26,43,74,.38)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', animation: `${closing ? 'aionFadeOut' : 'aionFadeIn'} .23s ease both` }} />
      <div role="dialog" aria-modal="true" aria-label={label} style={{
        position: 'fixed', left: aboveDock ? 10 : 0, right: aboveDock ? 10 : 0, bottom, zIndex: 1150,
        maxHeight: height || `calc(100dvh - ${aboveDock ? '84px - env(safe-area-inset-bottom) - ' : ''}56px)`,
        background: '#F6F8FC', borderRadius: aboveDock ? 28 : '28px 28px 0 0', boxShadow: '0 -10px 40px rgba(26,43,74,.22)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        paddingBottom: aboveDock ? 0 : 'env(safe-area-inset-bottom)',
        transform: drag ? `translateY(${drag}px)` : undefined, transition: drag ? 'none' : undefined,
        animation: closing ? 'aionSheetDown .23s cubic-bezier(.4,0,1,1) both' : 'aionSheetUp .38s cubic-bezier(.2,.9,.25,1.05) both',
      }}>
        <div
          onTouchStart={e => { start.current = e.touches[0].clientY }}
          onTouchMove={e => { if (start.current != null) setDrag(Math.max(0, e.touches[0].clientY - start.current)) }}
          onTouchEnd={() => { if (drag > 90) onClose(); else setDrag(0); start.current = null }}
          style={{ padding: '10px 0 6px', display: 'flex', justifyContent: 'center', flexShrink: 0, touchAction: 'none', cursor: 'grab' }}>
          <span style={{ width: 42, height: 5, borderRadius: 99, background: '#CBD5E1' }} />
        </div>
        {children}
      </div>
    </>,
    document.body,
  )
}

// ─── Menu completo ────────────────────────────────────────────────────────
export interface MenuPart { label: string; Icon: IconT; active: boolean; badge?: number; onPress: () => void }
export interface MenuModule { key: string; label: string; short?: string; Icon: IconT; active: boolean; badge?: number; tint: number; parts?: MenuPart[]; onPress?: () => void }
export interface MenuGroup { title: string; modules: MenuModule[] }

export function MenuSheet({ open, onClose, groups, title = 'Menu', footer, action }: { open: boolean; onClose: () => void; groups: MenuGroup[]; title?: string; footer?: React.ReactNode; action?: React.ReactNode }) {
  const [q, setQ] = useState('')
  const [mod, setMod] = useState<MenuModule | null>(null)
  const [dir, setDir] = useState<'in' | 'out'>('in')
  useEffect(() => { if (open) { setQ(''); setMod(null) } }, [open])
  const t = q.trim().toLowerCase()
  const hits = useMemo(() => {
    if (!t) return []
    const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const k = n(t)
    const out: { key: string; label: string; sub?: string; Icon: IconT; tint: number; onPress: () => void }[] = []
    for (const g of groups) for (const m of g.modules) {
      if (!m.parts?.length) { if (n(m.label).includes(k)) out.push({ key: m.key, label: m.label, Icon: m.Icon, tint: m.tint, onPress: m.onPress! }) }
      else for (const p of m.parts) if (n(p.label).includes(k) || n(m.label).includes(k)) out.push({ key: m.key + p.label, label: p.label, sub: m.label, Icon: p.Icon, tint: m.tint, onPress: p.onPress })
    }
    return out.slice(0, 30)
  }, [t, groups])
  // 23/10/2026 (pedido do Victor): tocar no módulo já abre a tela dele; as
  // partes do módulo ficam na fileira que desliza no topo (ModuleTabs), não
  // numa segunda lista aqui. A busca continua achando cada parte.
  const openMod = (m: MenuModule) => { (m.onPress || m.parts?.[0]?.onPress)?.() }
  let k = 0

  return (
    <BottomSheet open={open} onClose={onClose} label={title} aboveDock>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {!mod ? (
          <div key="root" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, animation: dir === 'out' ? 'aionFromLeft .28s ease both' : undefined }}>
            <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '2px 2px 10px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: INK, letterSpacing: '-.02em' }}>{title}</div>
                {action}
              </div>
              <label style={{ position: 'relative', display: 'block' }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar uma tela" aria-label="Buscar uma tela"
                  style={{ width: '100%', boxSizing: 'border-box', height: 42, borderRadius: 14, border: '1px solid #E2E8F0', background: '#fff', padding: '0 12px 0 38px', fontSize: 16, color: INK, outline: 'none', fontFamily: 'inherit' }} />
              </label>
            </div>
            <div style={{ overflowY: 'auto', padding: '2px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14, overscrollBehavior: 'contain' }}>
              {t ? (
                hits.length ? <div style={card}>{hits.map((h, i) => (
                  <button key={h.key} onClick={h.onPress} className="aion-tap" style={{ ...rowBtn, borderTop: i ? '1px solid #EEF2F7' : 'none' }}>
                    <IconBox Icon={h.Icon} tint={h.tint} size={36} />
                    <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: INK }}>{h.label}</span>
                      {h.sub && <span style={{ display: 'block', fontSize: 12, color: MUTED }}>{h.sub}</span>}
                    </span>
                    <ChevronRight size={16} color="#CBD5E1" />
                  </button>
                ))}</div> : <p style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '24px 0' }}>Nenhuma tela com “{q}”.</p>
              ) : groups.map(g => (
                <section key={g.title}>
                  {g.title && <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 4px 8px' }}>{g.title}</div>}
                  <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', rowGap: 14, columnGap: 2, padding: '14px 6px' }}>
                    {g.modules.map(m => {
                      const d = Math.min(k++ * 22, 330)
                      return (
                        <button key={m.key} onClick={() => openMod(m)} className="aion-tap" style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '0 2px', position: 'relative', fontFamily: 'inherit', animation: `aionTileIn .34s cubic-bezier(.2,.9,.3,1.2) ${d}ms both` }}>
                          <IconBox Icon={m.Icon} tint={m.tint} size={50} active={m.active} />
                          <span style={{ fontSize: 11.5, lineHeight: 1.2, fontWeight: m.active ? 800 : 600, color: m.active ? INK : '#334155', textAlign: 'center' }}>{m.short || m.label}</span>
                          {!!m.badge && <span style={{ position: 'absolute', top: -4, right: 8, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 99, background: '#F43F5E', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{m.badge}</span>}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
              {!t && footer}
            </div>
          </div>
        ) : (
          <div key={mod.key} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1, animation: 'aionFromRight .3s cubic-bezier(.2,.9,.25,1) both' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 12px', flexShrink: 0 }}>
              <button onClick={() => { setDir('out'); setMod(null) }} aria-label="Voltar" className="aion-tap" style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><ChevronLeft size={19} color={INK} /></button>
              <IconBox Icon={mod.Icon} tint={mod.tint} size={38} />
              <div style={{ fontSize: 20, fontWeight: 800, color: INK, letterSpacing: '-.02em', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.label}</div>
            </div>
            <div style={{ overflowY: 'auto', padding: '0 16px 18px', overscrollBehavior: 'contain' }}>
              <div style={card}>
                {mod.parts!.map((p, i) => (
                  <button key={p.label} onClick={p.onPress} className="aion-tap" style={{ ...rowBtn, borderTop: i ? '1px solid #EEF2F7' : 'none', animation: `aionTileIn .3s ease ${i * 35}ms both` }}>
                    <span style={{ width: 36, height: 36, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.active ? GRAD : '#F1F5F9', flexShrink: 0 }}><p.Icon size={17} color={p.active ? '#fff' : '#475569'} /></span>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: p.active ? 800 : 600, color: p.active ? '#05907B' : INK }}>{p.label}</span>
                    {!!p.badge && <span style={{ minWidth: 20, height: 20, borderRadius: 99, background: '#F43F5E', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{p.badge}</span>}
                    <ChevronRight size={16} color="#CBD5E1" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

export function IconBox({ Icon, tint, size, active }: { Icon: IconT; tint: number; size: number; active?: boolean }) {
  const c = TINTS[tint % TINTS.length]
  return (
    <span style={{ width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? GRAD : c.bg, boxShadow: active ? '0 8px 18px rgba(26,83,205,.28)' : 'inset 0 0 0 1px rgba(26,43,74,.03)' }}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={2} weight={active ? "fill" : "duotone"} color={active ? '#fff' : c.fg} />
    </span>
  )
}

// ─── Menu do usuário (foto no topo) ───────────────────────────────────────
export function SheetSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {title && <div style={{ fontSize: 11.5, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.07em', margin: '0 4px 8px' }}>{title}</div>}
      <div style={card}>{React.Children.toArray(children).filter(Boolean).map((c, i) => <div key={i} style={{ borderTop: i ? '1px solid #EEF2F7' : 'none' }}>{c}</div>)}</div>
    </section>
  )
}
export function SheetRow({ Icon, label, hint, onPress, danger, right, tint = 2 }: { Icon: IconT; label: string; hint?: string; onPress?: () => void; danger?: boolean; right?: React.ReactNode; tint?: number }) {
  return (
    <button onClick={onPress} className="aion-tap" style={rowBtn}>
      {danger ? <span style={{ width: 36, height: 36, borderRadius: 11, background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} color="#E11D48" /></span> : <IconBox Icon={Icon} tint={tint} size={36} />}
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: danger ? '#E11D48' : INK }}>{label}</span>
        {hint && <span style={{ display: 'block', fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hint}</span>}
      </span>
      {right ?? (!danger && <ChevronRight size={16} color="#CBD5E1" />)}
    </button>
  )
}
export function ProfileHero({ avatar, name, line1, line2 }: { avatar: React.ReactNode; name: string; line1?: string; line2?: string }) {
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: GRAD, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 14, color: '#fff', boxShadow: '0 12px 28px rgba(26,83,205,.28)', animation: 'aionTileIn .4s cubic-bezier(.2,.9,.3,1.1) both' }}>
      <span style={{ position: 'absolute', right: -30, top: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,.10)' }} />
      <span style={{ position: 'absolute', right: 40, bottom: -50, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,.07)' }} />
      <span style={{ borderRadius: '50%', padding: 3, background: 'rgba(255,255,255,.25)', display: 'inline-flex', position: 'relative' }}>{avatar}</span>
      <span style={{ minWidth: 0, position: 'relative' }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        {line1 && <span style={{ display: 'block', fontSize: 12.5, opacity: .9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line1}</span>}
        {line2 && <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.2)', borderRadius: 99, padding: '3px 9px' }}>{line2}</span>}
      </span>
    </div>
  )
}

/** Tela do celular? (atualiza ao girar ou redimensionar) */
export function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp)
  useEffect(() => { const h = () => setM(window.innerWidth < bp); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [bp])
  return m
}

const card: React.CSSProperties = { background: '#fff', borderRadius: 20, border: '1px solid #E8EDF5', boxShadow: '0 1px 2px rgba(26,43,74,.04)', overflow: 'hidden' }
const rowBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', minHeight: 58, boxSizing: 'border-box' }
