import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Volume2, VolumeX, X, ChevronRight } from 'lucide-react'
import { TOUR_START_EVENT, TOUR_END_EVENT, type TourStep } from '../../lib/academy/academy'
import { LESSON_BY_KEY } from '../../lib/academy/academyContent'
import { findTarget, isLocked } from '../../lib/academy/tourFind'

// "Fazer comigo": a Áion aponta, a voz explica e a pessoa toca de verdade.
// Nunca clicamos por ela (nada destrutivo acontece sozinho). Tudo que é da aula tem data-tour-ui.
const SOUND_KEY = 'aion_academy_sound'
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== '0' } catch { return true } }
const writeSound = (v: boolean) => { try { localStorage.setItem(SOUND_KEY, v ? '1' : '0') } catch { /* sem armazenamento */ } }

let ptVoice: SpeechSynthesisVoice | null = null
function pickVoice() {
  try {
    const vs = window.speechSynthesis?.getVoices?.() || []
    ptVoice = vs.find(v => /pt-BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null
  } catch { ptVoice = null }
}
function speak(text: string) {
  try {
    const s = window.speechSynthesis
    if (!s) return
    s.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/\s+/g, ' '))
    u.lang = 'pt-BR'; u.rate = 1.0
    if (!ptVoice) pickVoice()
    if (ptVoice) u.voice = ptVoice
    s.speak(u)
  } catch { /* sem voz neste aparelho */ }
}
const stopSpeak = () => { try { window.speechSynthesis?.cancel() } catch { /* nada */ } }

const PAD = 6
const Z = 2147483000

type Rect = { x: number; y: number; w: number; h: number }

export default function TourPlayer() {
  const navigate = useNavigate()
  const loc = useLocation()
  const [lessonKey, setLessonKey] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [missing, setMissing] = useState(false)
  const [sound, setSound] = useState(readSound)
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [balloonH, setBalloonH] = useState(150)
  const balloonRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const startedAt = useRef(0)
  const soundRef = useRef(sound)
  soundRef.current = sound

  const lesson = lessonKey ? LESSON_BY_KEY[lessonKey] : null
  const steps: TourStep[] = lesson?.tour || []
  const step: TourStep | undefined = steps[idx]

  const finish = useCallback((completed: boolean) => {
    stopSpeak()
    const key = lessonKey
    setLessonKey(null); setIdx(0); setRect(null); setMissing(false); targetRef.current = null
    if (key) window.dispatchEvent(new CustomEvent(TOUR_END_EVENT, { detail: { key, completed } }))
  }, [lessonKey])

  const next = useCallback(() => {
    setIdx(i => {
      if (i + 1 >= steps.length) { setTimeout(() => finish(true), 0); return i }
      return i + 1
    })
  }, [steps.length, finish])

  // começar uma aula
  useEffect(() => {
    const h = (e: Event) => {
      const key = (e as CustomEvent<{ key?: string }>).detail?.key
      if (!key || !LESSON_BY_KEY[key]?.tour?.length) return
      stopSpeak()
      startedAt.current = Date.now()
      setIdx(0); setRect(null); setMissing(false); targetRef.current = null
      setLessonKey(key)
    }
    window.addEventListener(TOUR_START_EVENT, h)
    return () => window.removeEventListener(TOUR_START_EVENT, h)
  }, [])

  useEffect(() => {
    pickVoice()
    try { window.speechSynthesis?.addEventListener?.('voiceschanged', pickVoice) } catch { /* nada */ }
    const r = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', r)
    return () => { window.removeEventListener('resize', r); try { window.speechSynthesis?.removeEventListener?.('voiceschanged', pickVoice) } catch { /* nada */ } }
  }, [])

  // fim se a pessoa sair da página do app (ex.: logout)
  useEffect(() => () => stopSpeak(), [])

  // ao entrar num passo: abre a tela, fala, procura o alvo
  useEffect(() => {
    if (!lesson || !step) return
    setMissing(false); setRect(null); targetRef.current = null
    if (step.route) {
      const cur = loc.pathname + loc.search
      const wanted = step.route
      const same = wanted.includes('?') ? cur === wanted : loc.pathname === wanted
      if (!same) navigate(wanted)
    }
    if (soundRef.current) speak(step.say)
    let stop = false
    const t0 = Date.now()
    let timer: number | undefined
    const tick = () => {
      if (stop) return
      if (!step.target) return
      const el = findTarget(step.target)
      if (el) {
        if (targetRef.current !== el) {
          targetRef.current = el
          try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' }) } catch { /* nada */ }
        }
        setMissing(false)
      } else {
        targetRef.current = null
        if (Date.now() - t0 > 3500) setMissing(true)
      }
      timer = window.setTimeout(tick, 250)
    }
    tick()
    return () => { stop = true; if (timer) clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey, idx])

  // acompanhar a posição do alvo (rolagem, animação, teclado)
  useEffect(() => {
    if (!lesson) return
    let raf = 0
    const loop = () => {
      const el = targetRef.current
      if (el && document.contains(el)) {
        const r = el.getBoundingClientRect()
        setRect(prev => (prev && Math.abs(prev.x - r.left) < 0.5 && Math.abs(prev.y - r.top) < 0.5 && Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5) ? prev : { x: r.left, y: r.top, w: r.width, h: r.height })
      } else {
        setRect(prev => prev ? null : prev)
      }
      const bh = balloonRef.current?.offsetHeight
      if (bh) setBalloonH(p => Math.abs(p - bh) > 1 ? bh : p)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [lessonKey])

  // a pessoa tocou: se foi no alvo, vamos para o próximo passo (escuta no document, na captura)
  useEffect(() => {
    if (!lesson || !step || step.action !== 'click') return
    const onTap = (e: Event) => {
      const el = targetRef.current
      const t = e.target as Node | null
      if (!el || !t) return
      if ((t as Element).closest?.('[data-tour-ui]')) return
      if (el.contains(t)) {
        if (isLocked(el)) return
        setTimeout(next, 350)
      }
    }
    document.addEventListener('click', onTap, true)
    return () => document.removeEventListener('click', onTap, true)
  }, [lessonKey, idx, next]) // eslint-disable-line react-hooks/exhaustive-deps

  // preencher: avança quando o campo ganha valor
  useEffect(() => {
    if (!lesson || !step || step.action !== 'fill') return
    const onInput = (e: Event) => {
      const el = targetRef.current
      if (el && (e.target === el || el.contains(e.target as Node))) {
        const v = (e.target as HTMLInputElement).value
        if (v && v.length >= 2) setTimeout(next, 700)
      }
    }
    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    return () => { document.removeEventListener('input', onInput, true); document.removeEventListener('change', onInput, true) }
  }, [lessonKey, idx, next]) // eslint-disable-line react-hooks/exhaustive-deps

  // alvo faltando: termina ou segue
  useEffect(() => {
    if (!missing || !step) return
    if (!step.ifMissing && !step.endIfMissing) {
      // sem aviso: pula o passo sozinho
      const t = setTimeout(next, 300)
      return () => clearTimeout(t)
    }
  }, [missing, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!lesson || !step) return null

  const hasTarget = !!rect && !missing
  const isLast = idx === steps.length - 1
  const isClick = step.action === 'click' && hasTarget
  const text = missing && step.ifMissing ? step.ifMissing : step.say
  const mobile = vp.w < 768

  // 4 blocos escuros em volta do alvo (o alvo fica clicável)
  const hole = hasTarget && rect ? {
    x: Math.max(0, rect.x - PAD), y: Math.max(0, rect.y - PAD),
    w: Math.min(vp.w, rect.x + rect.w + PAD) - Math.max(0, rect.x - PAD),
    h: Math.min(vp.h, rect.y + rect.h + PAD) - Math.max(0, rect.y - PAD),
  } : null
  const dark = 'rgba(15,23,42,.55)'
  const block = (s: React.CSSProperties) => <div data-tour-ui style={{ position: 'fixed', background: dark, zIndex: Z, ...s }} />

  // posição do balão
  const bw = Math.min(340, vp.w - 24)
  let bStyle: React.CSSProperties
  if (hole && !mobile) {
    const below = vp.h - (hole.y + hole.h)
    const above = hole.y
    const top = below >= balloonH + 16 ? hole.y + hole.h + 12 : above >= balloonH + 16 ? hole.y - balloonH - 12 : Math.max(12, vp.h - balloonH - 12)
    let left = hole.x + hole.w / 2 - bw / 2
    if (below < balloonH + 16 && above < balloonH + 16) left = hole.x > vp.w / 2 ? 16 : vp.w - bw - 16
    bStyle = { left: Math.max(12, Math.min(vp.w - bw - 12, left)), top: Math.max(12, top), width: bw }
  } else if (hole && mobile) {
    const spaceBelow = vp.h - (hole.y + hole.h)
    const top = spaceBelow >= balloonH + 20 ? hole.y + hole.h + 12 : hole.y >= balloonH + 20 ? hole.y - balloonH - 12 : 12
    bStyle = { left: 12, width: vp.w - 24, top: Math.max(12, Math.min(top, vp.h - balloonH - 12)) }
  } else {
    bStyle = mobile ? { left: 12, width: vp.w - 24, bottom: 14 } : { left: vp.w / 2 - bw / 2, width: bw, bottom: 24 }
  }

  return (
    <>
      {hole ? (
        <>
          {block({ left: 0, top: 0, width: vp.w, height: hole.y })}
          {block({ left: 0, top: hole.y + hole.h, width: vp.w, height: Math.max(0, vp.h - hole.y - hole.h) })}
          {block({ left: 0, top: hole.y, width: hole.x, height: hole.h })}
          {block({ left: hole.x + hole.w, top: hole.y, width: Math.max(0, vp.w - hole.x - hole.w), height: hole.h })}
          <div data-tour-ui style={{ position: 'fixed', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 12, border: '3px solid #05907B', boxShadow: '0 0 0 4px rgba(5,144,123,.30)', pointerEvents: 'none', zIndex: Z + 1, animation: 'aionTourBlink 1.1s ease-in-out infinite' }} />
        </>
      ) : (
        <div data-tour-ui style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: Z }} />
      )}
      <style data-tour-ui>{`@keyframes aionTourBlink{0%,100%{box-shadow:0 0 0 3px rgba(5,144,123,.55)}50%{box-shadow:0 0 0 9px rgba(5,144,123,.12)}}`}</style>
      <div ref={balloonRef} data-tour-ui role="dialog" aria-live="polite" style={{ position: 'fixed', zIndex: Z + 2, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 18, boxShadow: '0 16px 48px rgba(15,23,42,.30)', padding: 14, ...bStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#05907B', textTransform: 'uppercase', letterSpacing: .4 }}>Passo {idx + 1} de {steps.length}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button type="button" aria-label={sound ? 'Desligar a voz' : 'Ligar a voz'} onClick={() => { const v = !sound; setSound(v); writeSound(v); if (v) speak(text); else stopSpeak() }}
              style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #E3E8F0', background: '#F8FAFC', color: sound ? '#05907B' : '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button type="button" aria-label="Sair da aula" onClick={() => finish(false)}
              style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid #E3E8F0', background: '#F8FAFC', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </span>
        </div>
        <div style={{ fontSize: 14.5, lineHeight: 1.45, color: '#1A2B4A', fontWeight: 600 }}>{text}</div>
        {isClick && <div style={{ fontSize: 12, color: '#64748B', marginTop: 6 }}>Toque no que está piscando.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          {missing && step.endIfMissing ? (
            <button type="button" onClick={() => finish(false)} style={btn(true)}>Entendi</button>
          ) : (
            <>
              {isClick && !isLast && <button type="button" onClick={next} style={btn(false)}>Pular</button>}
              {(!isClick || missing) && (
                <button type="button" onClick={() => (isLast ? finish(true) : next())} style={btn(true)}>
                  {isLast ? 'Concluir' : <>Próximo <ChevronRight size={15} style={{ verticalAlign: -3 }} /></>}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

const btn = (primary: boolean): React.CSSProperties => ({
  height: 38, padding: '0 16px', borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: 'pointer',
  border: primary ? 'none' : '1px solid #E3E8F0', background: primary ? '#05907B' : '#fff', color: primary ? '#fff' : '#475569',
})
