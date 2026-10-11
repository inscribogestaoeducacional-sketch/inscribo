// Fase 0A — "A visita aconteceu?". Usado no Kanban (selo do cartão e ao mover
// o lead pra Visita/Proposta/Matriculado) e reaproveitável em outras telas.
import { useState } from 'react'
import { CalendarCheck, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { setVisitOutcome, isPastVisit, VISIT_OUTCOME_LABEL, type PendingVisit, type VisitOutcome } from '../../lib/visitOutcome'

const OUTCOME_STYLE: Record<VisitOutcome, { bg: string; color: string }> = {
  completed: { bg: '#DCFCE7', color: '#15803D' },
  no_show:   { bg: '#FFEDD5', color: '#C2410C' },
  cancelled: { bg: '#F1F5F9', color: '#475569' },
}

export default function VisitOutcomeDialog({ open, title, subtitle, visits, advanceLead = true, onClose, onChanged }: {
  open: boolean
  title: string
  subtitle?: string
  visits: PendingVisit[]
  /** false quando o lead já foi movido (drag) — a baixa não mexe no status */
  advanceLead?: boolean
  onClose: () => void
  onChanged?: () => void
}) {
  const { user } = useAuth()
  const [done, setDone] = useState<Record<string, VisitOutcome>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const answer = async (v: PendingVisit, outcome: VisitOutcome) => {
    if (!user?.institution_id) return
    setSaving(v.id); setError(null)
    try {
      await setVisitOutcome({
        visit: v, outcome, advanceLead,
        user: { id: user.id, full_name: user.full_name, role: user.role, institution_id: user.institution_id },
      })
      setDone(d => ({ ...d, [v.id]: outcome }))
      onChanged?.()
    } catch (e) {
      setError((e as Error).message || 'Não foi possível salvar a baixa.')
    } finally {
      setSaving(null)
    }
  }

  const pending = visits.filter(v => !done[v.id])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <CalendarCheck size={17} color="#D97706" />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A2B4A' }}>{title}</p>
            {subtitle && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 2 }}><X size={16} /></button>
        </div>

        <div style={{ padding: '10px 18px 6px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '55vh', overflowY: 'auto' }}>
          {visits.map(v => {
            const d = new Date(v.scheduled_date)
            const answered = done[v.id]
            return (
              <div key={v.id} style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                  {v.student_name ? `${v.student_name} · ` : ''}{d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p style={{ margin: '2px 0 8px', fontSize: 11, color: isPastVisit(v) ? '#B45309' : '#64748B' }}>
                  {isPastVisit(v) ? 'Já passou e está sem baixa' : 'Ainda vai acontecer'}
                </p>
                {answered ? (
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, ...OUTCOME_STYLE[answered] }}>✓ {VISIT_OUTCOME_LABEL[answered]}</span>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['completed', 'no_show', 'cancelled'] as VisitOutcome[]).map(o => (
                      <button key={o} disabled={saving === v.id} onClick={() => answer(v, o)}
                        style={{ fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: saving === v.id ? 'wait' : 'pointer', ...OUTCOME_STYLE[o] }}>
                        {VISIT_OUTCOME_LABEL[o]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {error && <p style={{ margin: 0, fontSize: 12, color: '#DC2626' }}>{error}</p>}
        </div>

        <div style={{ padding: '10px 18px 16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', color: '#475569', cursor: 'pointer' }}>
            {pending.length === 0 ? 'Fechar' : 'Responder depois'}
          </button>
        </div>
      </div>
    </div>
  )
}
