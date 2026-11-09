// Critérios da redação e peso na nota final (coordenação).
import { useState } from 'react'
import { BRAND } from '../../lib/brand'
import { db, type Contest } from '../../lib/concurso'

const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const btn: React.CSSProperties = { display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, border: 0, background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`, color: '#fff' }

export default function EssayRubric({ contest, onChanged }: { contest: Contest; onChanged: () => void }) {
  const [rubric, setRubric] = useState(contest.essay_rubric)
  const [weight, setWeight] = useState(contest.essay_weight)
  const [msg, setMsg] = useState('')
  const save = async () => {
    const { error } = await db.from('contests').update({ essay_rubric: rubric, essay_weight: weight }).eq('id', contest.id)
    setMsg(error ? 'Não foi possível salvar: ' + error.message : 'Critérios e peso salvos.'); setTimeout(() => setMsg(''), 4000); if (!error) onChanged()
  }
  return (
    <div>
      <label style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted, display: 'block', marginBottom: 4 }}>Critérios de correção da redação</label>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>O professor dá nota de 0 até o máximo de cada critério, em 6 degraus (como no ENEM).</div>
      {rubric.map((r, i) => (
        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, marginBottom: 8 }}>
          <input style={input} value={r.name} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label={`Critério ${i + 1}`} />
          <input style={input} type="number" min={10} max={1000} value={r.max} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, max: Math.max(10, Number(e.target.value) || 10) } : x))} aria-label={`Nota máxima do critério ${i + 1}`} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Peso da redação na nota final (%)</label>
        <input style={{ ...input, width: 90 }} type="number" min={0} max={100} value={weight} onChange={e => setWeight(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>Nota máxima: {rubric.reduce((s, r) => s + r.max, 0)}. Séries sem redação usam só a prova objetiva.</span>
        <button type="button" style={btn} onClick={save}>Salvar critérios e peso</button>
        {msg && <span role="status" style={{ fontSize: 13, color: BRAND.ink }}>{msg}</span>}
      </div>
    </div>
  )
}
