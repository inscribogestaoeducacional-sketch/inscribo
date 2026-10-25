import React, { useState } from 'react'
import { ChevronDown, CheckCircle2, Circle, Clock, PlayCircle } from 'lucide-react'
import { MODULE_BY_ID, countDone, type Lesson, type Trail } from '../../lib/academy/academy'
import AcademyIcon from './AcademyIcon'
import { BRAND } from '../../lib/brand'

// Uma trilha por módulo: ícone, barra de progresso e a lista de aulas.
export default function TrailCard({ trail, lessons, done, onOpen, defaultOpen }: {
  trail: Trail; lessons: Lesson[]; done: Set<string>; onOpen: (l: Lesson) => void; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(!!defaultOpen)
  const mod = MODULE_BY_ID[trail.module]
  const n = countDone(lessons, done)
  const pct = lessons.length ? Math.round((n / lessons.length) * 100) : 0
  const full = n === lessons.length
  return (
    <div style={{ background: '#fff', border: `1px solid ${full ? BRAND.softLine : BRAND.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 1px 2px rgba(26,43,74,.04)' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="aion-tap"
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ width: 46, height: 46, borderRadius: 14, background: full ? BRAND.successSoft : BRAND.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AcademyIcon name={mod?.icon || ''} size={26} color={full ? BRAND.success : BRAND.primary} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: BRAND.ink }}>{trail.title}</span>
          <span style={{ display: 'block', fontSize: 12.5, color: BRAND.muted, lineHeight: 1.35, marginTop: 1 }}>{trail.desc}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <span style={{ flex: 1, height: 7, borderRadius: 99, background: '#EEF3F2', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 99, background: full ? BRAND.success : 'var(--aion-grad)', transition: 'width .5s' }} />
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: full ? BRAND.success : BRAND.muted, whiteSpace: 'nowrap' }}>{n} de {lessons.length}</span>
          </span>
        </span>
        <ChevronDown size={20} color={BRAND.faint} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div style={{ borderTop: `1px solid ${BRAND.line}`, padding: '6px 8px 8px' }}>
          {lessons.map(l => {
            const d = done.has(l.key)
            return (
              <button key={l.key} type="button" onClick={() => onOpen(l)} className="aion-tap"
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', background: 'none', border: 'none', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: 48 }}>
                {d ? <CheckCircle2 size={21} color={BRAND.success} style={{ flexShrink: 0 }} /> : <Circle size={21} color="#CBD5E1" style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 700, color: BRAND.ink, lineHeight: 1.3 }}>{l.title}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: BRAND.muted, marginTop: 2 }}>
                    <Clock size={12} /> {l.minutes} min
                    {l.tour && l.tour.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: BRAND.primary, fontWeight: 700 }}><PlayCircle size={12} /> Fazer comigo</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
