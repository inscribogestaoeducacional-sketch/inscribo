// Mapa do Brasil com os estados onde a Áion Edu já está. Os estados vêm das escolas em destaque do Super Admin.
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { BRAZIL_SVG_MARKUP, UF_NAMES } from '../components/landing/BrazilStatesMap'
import { useInView } from './lib'

type Row = { id: string; school_name: string; city: string; state: string }
type Dot = { uf: string; x: number; y: number }

function useCount(target: number, run: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(target); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => { const p = Math.min(1, (t - t0) / 1400); setN(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run])
  return n
}

export default function SchoolsMap() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [sel, setSel] = useState<string | null>(null)
  const [dots, setDots] = useState<Dot[]>([])
  const [seen, setSeen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inView = useInView<HTMLDivElement>()

  useEffect(() => {
    supabase.from('showcase_schools').select('id, school_name, city, state').eq('is_active', true).order('display_order', { ascending: true })
      .then(({ data }) => setRows((data as Row[]) || []))
  }, [])

  const byUf = useMemo(() => {
    const m: Record<string, Row[]> = {}
    ;(rows ?? []).forEach(r => { const uf = (r.state || '').toUpperCase().trim(); if (UF_NAMES[uf]) (m[uf] ||= []).push(r) })
    return m
  }, [rows])
  const ufs = Object.keys(byUf)

  useEffect(() => {
    const box = boxRef.current; if (!box) return
    const svg = box.querySelector('svg'); if (!svg) return
    const next: Dot[] = []
    const w = box.getBoundingClientRect()
    svg.querySelectorAll<SVGElement>('.br-state').forEach(el => el.classList.remove('br-on', 'br-sel'))
    ufs.forEach(uf => {
      const shapes = Array.from(svg.querySelectorAll<SVGGraphicsElement>(`#${uf}, [id="${uf}"]`))
      shapes.forEach(s => { s.classList.add('br-state', 'br-on'); if (sel === uf) s.classList.add('br-sel') })
      const big = shapes.sort((a, b) => b.getBBox().width * b.getBBox().height - a.getBBox().width * a.getBBox().height)[0]
      if (big) { const r = big.getBoundingClientRect(); next.push({ uf, x: r.left + r.width / 2 - w.left, y: r.top + r.height / 2 - w.top }) }
    })
    setDots(next)
  }, [ufs.join(','), sel, rows])

  useEffect(() => {
    const box = boxRef.current; if (!box) return
    const onClick = (e: Event) => { const t = (e.target as Element).closest?.('[id]') as Element | null; const uf = t?.id; if (uf && byUf[uf]) setSel(s => (s === uf ? null : uf)) }
    box.addEventListener('click', onClick)
    return () => box.removeEventListener('click', onClick)
  }, [byUf])

  useEffect(() => { const el = boxRef.current; if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return } const o = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), o.disconnect()), { threshold: .3 }); o.observe(el); return () => o.disconnect() }, [rows])
  const count = useCount(ufs.length, seen)

  if (!rows || ufs.length === 0) return null
  const shown = sel ? byUf[sel] : null

  return (
    <section className="st-map-sec st-sec" aria-labelledby="mapa-t">
      <div className="st-wrap st-map-grid">
        <div ref={inView} className="st-rv">
          <span className="st-eyebrow" style={{ color: '#2DCBA4' }}>Já em campo</span>
          <div className="st-big" aria-hidden="true">{count}</div>
          <h2 id="mapa-t" className="st-h2" style={{ color: '#fff', marginTop: 6 }}>{ufs.length === 1 ? 'estado' : 'estados'} com escolas na Áion Edu</h2>
          <p className="st-lead" style={{ color: 'rgba(255,255,255,.75)', marginTop: 16 }}>De escolas do sertão ao litoral, a mesma campanha de matrículas, o mesmo WhatsApp e o mesmo número do sistema da escola. A cada escola nova, um estado acende.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
            {ufs.map(uf => <button key={uf} type="button" className="st-ufchip" aria-pressed={sel === uf} onClick={() => setSel(s => (s === uf ? null : uf))}>{UF_NAMES[uf]}</button>)}
          </div>
          <div aria-live="polite" style={{ minHeight: 84, marginTop: 18, color: '#fff' }}>
            {shown ? (
              <div style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '14px 18px' }}>
                <b style={{ color: '#2DCBA4' }}>{UF_NAMES[sel!]}</b>
                <ul style={{ margin: '6px 0 0', padding: 0, listStyle: 'none', fontSize: 14.5 }}>
                  {shown.map(r => <li key={r.id}>{r.school_name}<span style={{ color: 'rgba(255,255,255,.6)' }}> · {r.city}</span></li>)}
                </ul>
              </div>
            ) : <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14 }}>Toque em um estado aceso para ver as escolas.</p>}
          </div>
        </div>
        <div className="st-map-box" ref={boxRef}>
          <div dangerouslySetInnerHTML={{ __html: BRAZIL_SVG_MARKUP }} />
          {dots.map(d => <span key={d.uf} className="st-dot" style={{ left: d.x, top: d.y }} />)}
        </div>
      </div>
    </section>
  )
}
