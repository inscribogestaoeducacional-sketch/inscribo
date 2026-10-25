import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, GraduationCap, PlayCircle, BookOpen, CheckCircle2, Circle, Clock, Sparkles, ListChecks } from 'lucide-react'
import { HELP_OPEN_EVENT, TOUR_START_EVENT, lessonsForPath } from '../../lib/academy/academy'
import { useAcademyAccess } from '../../lib/academy/useAcademyAccess'
import { useAcademyProgress } from '../../lib/academy/progress'
import AskAi from './AskAi'
import { BRAND } from '../../lib/brand'

// Painel do "?": as aulas da tela em que a pessoa está, "Fazer comigo", a aula inteira na Academia e as dúvidas.
// Fica sempre montado (vazio quando fechado) porque também cuida de guardar o progresso das aulas feitas.
export default function HelpPanel() {
  const loc = useLocation()
  const navigate = useNavigate()
  const { visible } = useAcademyAccess()
  const { done } = useAcademyProgress()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'aulas' | 'ask'>('aulas')

  useEffect(() => {
    const h = (e: Event) => {
      const t = (e as CustomEvent<{ tab?: 'aulas' | 'ask' }>).detail?.tab
      setTab(t === 'ask' ? 'ask' : 'aulas'); setOpen(true)
    }
    window.addEventListener(HELP_OPEN_EVENT, h)
    return () => window.removeEventListener(HELP_OPEN_EVENT, h)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => { setOpen(false) }, [loc.pathname])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, close])

  const here = useMemo(() => lessonsForPath(visible, loc.pathname), [visible, loc.pathname])
  if (!open) return null

  const go = (to: string) => { close(); navigate(to) }
  const start = (key: string) => { close(); setTimeout(() => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { key } })), 150) }
  const smallBtn = (primary: boolean): React.CSSProperties => ({
    height: 38, padding: '0 12px', borderRadius: 11, fontFamily: 'inherit', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
    border: primary ? 'none' : `1px solid ${BRAND.line}`, background: primary ? 'var(--aion-grad)' : '#fff', color: primary ? '#fff' : BRAND.ink,
  })
  const tabBtn = (on: boolean): React.CSSProperties => ({
    flex: 1, height: 40, border: 'none', borderRadius: 11, fontFamily: 'inherit', fontWeight: 800, fontSize: 13.5, cursor: 'pointer',
    background: on ? '#fff' : 'transparent', color: on ? BRAND.primaryDark : BRAND.muted, boxShadow: on ? '0 1px 3px rgba(26,43,74,.12)' : 'none',
  })

  return (
    <div className="m-sheet" role="dialog" aria-modal="true" aria-label="Ajuda" onClick={close}
      style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(26,43,74,.38)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch' }}>
      <div data-help-panel onClick={e => e.stopPropagation()} style={{ width: 'min(430px, 100vw)', height: '100dvh', maxHeight: '100%', background: '#F5FAF9', display: 'flex', flexDirection: 'column', boxShadow: '-12px 0 40px rgba(15,23,42,.25)', animation: 'aionHelpIn .25s ease-out' }}>
        <style>{`@keyframes aionHelpIn{from{transform:translateX(30px);opacity:.4}to{transform:none;opacity:1}}`}</style>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--aion-grad)', color: '#fff', flexShrink: 0 }}>
          <span style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><GraduationCap size={22} color="#fff" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800 }}>Ajuda</div>
            <div style={{ fontSize: 12.5, opacity: .9 }}>Academia Áion Edu</div>
          </div>
          <button type="button" aria-label="Fechar a ajuda" onClick={close} style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.14)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
          <div role="tablist" style={{ display: 'flex', gap: 4, background: '#EEF3F2', borderRadius: 14, padding: 4 }}>
            <button type="button" role="tab" aria-selected={tab === 'aulas'} style={tabBtn(tab === 'aulas')} onClick={() => setTab('aulas')}>Aulas desta tela</button>
            <button type="button" role="tab" aria-selected={tab === 'ask'} style={tabBtn(tab === 'ask')} onClick={() => setTab('ask')}>Tire suas dúvidas</button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: tab === 'ask' ? 'hidden' : 'auto', padding: tab === 'ask' ? 0 : 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tab === 'aulas' ? (
            <>
              {here.length === 0 && (
                <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 18, textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Ainda não há aula para esta tela</div>
                  <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 4, lineHeight: 1.45 }}>Veja todas as aulas na Academia ou pergunte em “Tire suas dúvidas”.</div>
                </div>
              )}
              {here.map(l => (
                <div key={l.key} style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {done.has(l.key) ? <CheckCircle2 size={22} color={BRAND.success} style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={22} color="#CBD5E1" style={{ flexShrink: 0, marginTop: 1 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, lineHeight: 1.3 }}>{l.title}</div>
                      <div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.4, marginTop: 3 }}>{l.summary}</div>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: BRAND.muted, marginTop: 6 }}><Clock size={12} /> {l.minutes} min</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {l.tour && l.tour.length > 0 && <button type="button" onClick={() => start(l.key)} style={smallBtn(true)}><PlayCircle size={16} /> Fazer comigo</button>}
                    <button type="button" onClick={() => go(`/academia?aula=${l.key}`)} style={smallBtn(false)}><BookOpen size={15} /> Abrir a aula na Academia</button>
                  </div>
                </div>
              ))}
            </>
          ) : (
            <AskAi onNavigate={close} />
          )}
        </div>
        {tab === 'aulas' && (
          <div style={{ flexShrink: 0, display: 'flex', gap: 8, padding: '10px 14px calc(12px + env(safe-area-inset-bottom))', background: '#fff', borderTop: `1px solid ${BRAND.line}` }}>
            <button type="button" onClick={() => go('/academia')} style={{ ...smallBtn(false), flex: 1, height: 46, justifyContent: 'center' }}><ListChecks size={17} /> Ver todas as aulas</button>
            <button type="button" onClick={() => setTab('ask')} style={{ ...smallBtn(true), flex: 1, height: 46, justifyContent: 'center' }}><Sparkles size={17} /> Tire suas dúvidas</button>
          </div>
        )}
      </div>
    </div>
  )
}
