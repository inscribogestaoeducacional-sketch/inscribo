// "A visita aconteceu?" num lugar só: Aconteceu / Faltou / Cancelada.
// Faltou e Cancelada exigem o motivo (lista editável pela escola).
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { BRAND } from '../../lib/brand'
import { setVisitOutcome, type PendingVisit, type VisitOutcome } from '../../lib/visitOutcome'
import { useVisitReasons } from '../../lib/visitReasons'

export default function VisitOutcomePicker({ visit, advanceLead = true, onDone }: {
  visit: PendingVisit
  advanceLead?: boolean
  onDone: (outcome: VisitOutcome) => void
}) {
  const { user } = useAuth()
  const { labelsFor } = useVisitReasons(user?.institution_id)
  const [pick, setPick] = useState<VisitOutcome | null>(null)
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async (outcome: VisitOutcome) => {
    if (!user?.institution_id) return
    if (outcome !== 'completed' && !reason) { setError('Escolha o motivo.'); return }
    setSaving(true); setError('')
    try {
      await setVisitOutcome({
        visit, outcome, advanceLead,
        reason: outcome === 'completed' ? undefined : { label: reason, detail: detail.trim() || undefined },
        user: { id: user.id, full_name: user.full_name, role: user.role, institution_id: user.institution_id },
      })
      onDone(outcome)
    } catch (e) {
      setError((e as Error).message || 'Não foi possível salvar a baixa.')
    } finally { setSaving(false) }
  }

  const btn = (o: VisitOutcome, label: string, bg: string, color: string) => (
    <button type="button" disabled={saving} onClick={() => { setError(''); if (o === 'completed') save(o); else { setPick(o); setReason('') } }}
      style={{ fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 10, cursor: saving ? 'wait' : 'pointer',
        border: pick === o ? `2px solid ${color}` : '2px solid transparent', background: bg, color }}>{label}</button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {btn('completed', 'Aconteceu', '#DCFCE7', '#15803D')}
        {btn('no_show', 'Faltou', '#FFEDD5', '#C2410C')}
        {btn('cancelled', 'Cancelada', '#F1F5F9', '#475569')}
      </div>
      {pick && (
        <div style={{ marginTop: 9, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: '#7C2D12', marginBottom: 6 }}>Por que não aconteceu? (obrigatório)</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
            {[...labelsFor(pick === 'no_show' ? 'no_show' : 'cancelled'), 'Outro'].map(l => (
              <button key={l} type="button" onClick={() => setReason(l)}
                style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${reason === l ? '#475569' : '#CBD5E1'}`, background: reason === l ? '#475569' : '#fff', color: reason === l ? '#fff' : '#475569' }}>{l}</button>
            ))}
          </div>
          <input value={detail} onChange={e => setDetail(e.target.value)} placeholder={reason === 'Outro' ? 'Conte o que aconteceu' : 'Detalhe (opcional)'}
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 9, border: `1px solid ${BRAND.line}`, fontSize: 12.5, outline: 'none', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" disabled={saving || !reason || (reason === 'Outro' && !detail.trim())} onClick={() => save(pick)}
              style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 10, border: 'none', background: !reason ? '#CBD5E1' : BRAND.primary, color: '#fff', cursor: !reason ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Salvando...' : 'Salvar baixa'}
            </button>
            <button type="button" onClick={() => setPick(null)} style={{ fontSize: 12, border: 'none', background: 'none', color: BRAND.muted, cursor: 'pointer' }}>Voltar</button>
          </div>
        </div>
      )}
      {error && <p style={{ margin: '6px 0 0', fontSize: 12, color: BRAND.danger }}>{error}</p>}
    </div>
  )
}
