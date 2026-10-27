// Roteiro da campanha: passo a passo com check-in. Fica no menu Ajuda e só aparece quando a Áion libera o ano para a escola.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronDown, Clock, ExternalLink, Flag, Loader2, SkipForward, Undo2 } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { BRAND } from '../../lib/brand'
import { useAuth } from '../../contexts/AuthContext'
import { ROADMAP_STEPS, stepStatus, useRoadmap, type StepStatus } from '../../lib/roadmap'

const CHIP: Record<StepStatus, { t: string; c: string; bg: string }> = {
  done: { t: 'Feita', c: '#15803D', bg: '#DCFCE7' },
  skipped: { t: 'Pulada', c: '#64748B', bg: '#F1F5F9' },
  todo: { t: 'Falta fazer', c: '#B45309', bg: '#FEF3C7' },
}

export default function RoteiroCampanha() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { state, setStep } = useRoadmap(user?.institution_id)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState('')
  const rows = useMemo(() => (state?.released ? ROADMAP_STEPS.map(s => ({ s, st: stepStatus(s, state) })) : []), [state])
  const doneN = rows.filter(r => r.st === 'done').length
  const next = rows.find(r => r.st === 'todo')?.s.key ?? null
  useEffect(() => { if (open === null && next) setOpen(next) }, [next]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted, padding: 24 }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>
  if (!state.released) return (
    <div style={{ padding: window.innerWidth < 768 ? '12px 12px 24px' : 24, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader icon={Flag} title="Roteiro da campanha" subtitle="Passo a passo para começar a campanha" />
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 20, color: BRAND.muted, fontSize: 14 }}>O roteiro da próxima campanha ainda não foi liberado para a sua escola. Quando a Áion liberar, ele aparece aqui.</div>
    </div>
  )

  const act = async (key: string, status: 'done' | 'skipped' | null) => { setBusy(key); await setStep(key, status); setBusy('') }
  const pct = Math.round(doneN / rows.length * 100)
  return (
    <div style={{ padding: window.innerWidth < 768 ? '12px 12px 24px' : 24, maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader compact icon={Flag} title={`Minha campanha ${state.year}`} subtitle="Roteiro passo a passo, do funil ao acompanhamento" />
      <div style={{ background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink }}>{doneN} <span style={{ fontSize: 14, color: BRAND.muted, fontWeight: 600 }}>de {rows.length} etapas feitas</span></div>
          <div style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#15803D' : BRAND.primary }}>{pct === 100 ? 'Campanha pronta!' : `${pct}%`}</div>
        </div>
        <div style={{ height: 10, borderRadius: 99, background: '#EDF1F0', overflow: 'hidden', marginTop: 10 }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--aion-grad)', borderRadius: 99, transition: 'width .6s' }} /></div>
        <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8, lineHeight: 1.5 }}>O sistema marca sozinho o que ele consegue conferir. Nas outras etapas, marque você mesmo quando terminar.</div>
      </div>
      {rows.map(({ s, st }, i) => {
        const isOpen = open === s.key, isNext = next === s.key, ch = CHIP[st]
        return (
          <div key={s.key} style={{ background: '#fff', border: `${isNext ? 2 : 1}px solid ${isNext ? BRAND.primary : BRAND.line}`, borderRadius: 18, overflow: 'hidden' }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : s.key)} className="aion-tap" aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', minHeight: 64 }}>
              <span style={{ width: 34, height: 34, borderRadius: 99, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14,
                background: st === 'done' ? '#16A34A' : isNext ? 'var(--aion-grad)' : '#EEF2F1', color: st === 'done' || isNext ? '#fff' : BRAND.muted }}>{st === 'done' ? <Check size={18} /> : i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: BRAND.ink, lineHeight: 1.3, textDecoration: st === 'skipped' ? 'line-through' : 'none' }}>{s.title}</span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11.5, fontWeight: 800, padding: '2px 9px', borderRadius: 99, color: ch.c, background: ch.bg }}>{isNext && st === 'todo' ? 'Próxima etapa' : ch.t}</span>
                  <span style={{ fontSize: 11.5, color: BRAND.muted, display: 'inline-flex', gap: 3, alignItems: 'center' }}><Clock size={11} /> {s.minutes} min</span>
                </span>
              </span>
              <ChevronDown size={18} color={BRAND.muted} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
            </button>
            {isOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13.5, color: BRAND.text, lineHeight: 1.55, background: BRAND.softer, borderRadius: 12, padding: '10px 12px' }}><b>Por que fazer:</b> {s.why}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, marginBottom: 6, textTransform: 'uppercase' }}>O que fazer</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{s.todo.map((t, k) => (
                    <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13.5, color: BRAND.ink, lineHeight: 1.5 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 99, background: BRAND.soft, color: BRAND.primary, fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{k + 1}</span><span>{t}</span>
                    </div>))}</div>
                </div>
                {s.auto && st === 'done' && <div style={{ fontSize: 12, color: '#15803D', fontWeight: 700 }}>O sistema conferiu e esta etapa já está feita.</div>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="aion-tap" onClick={() => navigate(s.to)} style={{ flex: '1 1 180px', minHeight: 46, padding: '10px 14px', borderRadius: 12, border: 'none', background: 'var(--aion-grad)', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: '0 8px 18px -12px rgba(0,122,110,.8)' }}><ExternalLink size={15} /> {s.cta}</button>
                  {st === 'todo' && <>
                    <button type="button" className="aion-tap" disabled={busy === s.key} onClick={() => act(s.key, 'done')} style={ghost}>{busy === s.key ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Marcar como feita</button>
                    <button type="button" className="aion-tap" disabled={busy === s.key} onClick={() => act(s.key, 'skipped')} style={ghost}><SkipForward size={15} /> Pular</button>
                  </>}
                  {st !== 'todo' && !(s.auto && st === 'done' && !state.steps?.[s.key]) && <button type="button" className="aion-tap" disabled={busy === s.key} onClick={() => act(s.key, null)} style={ghost}><Undo2 size={15} /> Voltar para “falta fazer”</button>}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
const ghost: React.CSSProperties = { flex: '1 1 140px', minHeight: 46, padding: '10px 12px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }
