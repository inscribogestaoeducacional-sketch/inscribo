// Fase 0A — visitas de um lead com baixa inline (realizada / faltou /
// cancelada). Usado no modal do lead e na aba Lead do Hub de WhatsApp.
import { useCallback, useEffect, useState } from 'react'
import { CalendarCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { isPastVisit } from '../../lib/visitOutcome'
import VisitOutcomePicker from './VisitOutcomePicker'

interface VisitRow { id: string; lead_id: string | null; scheduled_date: string; status: string }

const STATUS_CHIP: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: 'Agendada', bg: '#EEF2FF', color: '#4338CA' },
  completed: { label: 'Realizada', bg: '#DCFCE7', color: '#15803D' },
  no_show:   { label: 'Faltou', bg: '#FFEDD5', color: '#C2410C' },
  cancelled: { label: 'Cancelada', bg: '#F1F5F9', color: '#475569' },
}

export default function LeadVisitsPanel({ leadId, reloadKey, onChanged }: {
  leadId: string
  /** muda pra forçar recarregar (ex.: depois de agendar uma visita) */
  reloadKey?: unknown
  onChanged?: () => void
}) {
  const [visits, setVisits] = useState<VisitRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('visits').select('id, lead_id, scheduled_date, status')
      .eq('lead_id', leadId).order('scheduled_date', { ascending: false })
    setVisits((data ?? []) as VisitRow[])
    setLoading(false)
  }, [leadId])

  useEffect(() => { load() }, [load, reloadKey])

  if (loading) return <div style={{ height: 40, borderRadius: 10, background: '#F1F5F9' }} />
  if (visits.length === 0) return <p style={{ margin: 0, fontSize: 12, color: '#94A3B8' }}>Nenhuma visita agendada.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visits.map(v => {
        const d = new Date(v.scheduled_date)
        const chip = STATUS_CHIP[v.status] ?? STATUS_CHIP.scheduled
        const pendingPast = v.status === 'scheduled' && isPastVisit(v)
        return (
          <div key={v.id} style={{ border: `1px solid ${pendingPast ? '#FDE68A' : '#E2E8F0'}`, background: pendingPast ? '#FFFBEB' : '#fff', borderRadius: 10, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarCheck size={14} color="#64748B" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', flex: 1 }}>
                {d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às {d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: chip.bg, color: chip.color }}>{chip.label}</span>
            </div>
            {v.status === 'scheduled' && (
              <div style={{ marginTop: 8 }}>
                {pendingPast && <div style={{ fontSize: 11, color: '#B45309', fontWeight: 600, marginBottom: 5 }}>Sem baixa — aconteceu?</div>}
                <VisitOutcomePicker visit={v} onDone={() => { load(); onChanged?.() }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
