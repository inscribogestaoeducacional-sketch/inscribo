import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Clock, Check, Lightbulb, PlayCircle, ExternalLink, CheckCircle2, Circle } from 'lucide-react'
import { MODULE_BY_ID, TOUR_START_EVENT, type Lesson } from '../../lib/academy/academy'
import AcademyIcon from './AcademyIcon'
import { BRAND } from '../../lib/brand'

// A aula em uma janela: resumo, passo a passo, dica, "Fazer comigo" e "Abrir esta tela".
export default function LessonSheet({ lesson, done, onClose, onToggleDone }: {
  lesson: Lesson; done: boolean; onClose: () => void; onToggleDone: () => void
}) {
  const navigate = useNavigate()
  const mod = MODULE_BY_ID[lesson.module]
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = prev }
  }, [onClose])

  const start = () => {
    onClose()
    setTimeout(() => window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { key: lesson.key } })), 120)
  }
  const open = () => { onClose(); navigate(lesson.to) }

  const btn = (primary: boolean): React.CSSProperties => ({
    flex: '1 1 150px', minHeight: 46, padding: '10px 14px', borderRadius: 14, fontFamily: 'inherit', fontWeight: 800, fontSize: 14, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: primary ? 'none' : '1px solid #E3E8F0', background: primary ? 'var(--aion-grad)' : '#fff', color: primary ? '#fff' : BRAND.ink,
    boxShadow: primary ? '0 8px 18px -12px rgba(0,122,110,.8)' : 'none',
  })

  return (
    <div className="m-sheet" role="dialog" aria-modal="true" aria-label={lesson.title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(26,43,74,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 22, width: '100%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 70px rgba(15,23,42,.35)', border: `1px solid ${BRAND.line}` }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 2, background: '#fff', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${BRAND.line}` }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: BRAND.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AcademyIcon name={mod?.icon || ''} size={24} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.primary, textTransform: 'uppercase', letterSpacing: .4 }}>{mod?.label}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink, lineHeight: 1.25 }}>{lesson.title}</div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
        </div>

        <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}><Clock size={14} /> {lesson.minutes} min</span>
            {done && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 800, color: BRAND.success, background: BRAND.successSoft, padding: '3px 10px', borderRadius: 999 }}><Check size={13} /> Concluída</span>}
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: BRAND.text }}>{lesson.summary}</p>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Passo a passo</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lesson.steps.map((s, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 99, background: BRAND.soft, color: BRAND.primaryDark, fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  <span style={{ fontSize: 14.5, lineHeight: 1.5, color: BRAND.text }}>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {lesson.tip && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 14, background: BRAND.warnSoft, border: '1px solid #FDE68A' }}>
              <Lightbulb size={18} color={BRAND.warn} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 14, lineHeight: 1.45, color: '#78350F' }}><b>Dica:</b> {lesson.tip}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {lesson.tour && lesson.tour.length > 0 && <button type="button" onClick={start} style={btn(true)}><PlayCircle size={18} /> Fazer comigo</button>}
            <button type="button" onClick={open} style={btn(false)}><ExternalLink size={16} /> Abrir esta tela</button>
          </div>
          <button type="button" onClick={onToggleDone} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '6px 0', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: done ? BRAND.success : BRAND.muted, cursor: 'pointer' }}>
            {done ? <CheckCircle2 size={20} /> : <Circle size={20} />} {done ? 'Marcada como concluída (toque para desmarcar)' : 'Marcar como concluída'}
          </button>
        </div>
      </div>
    </div>
  )
}
