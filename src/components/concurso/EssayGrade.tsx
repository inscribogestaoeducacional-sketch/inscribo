// Correção de uma redação, às cegas (nome e número do aluno nunca aparecem). Funciona bem no celular.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, type Contest, type Essay } from '../../lib/concurso'

const steps = (max: number) => Array.from({ length: 6 }, (_, i) => Math.round((max * i) / 5))
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})

export default function EssayGrade({ essay, label, rubric, onClose, onSaved }: { essay: Essay; label: number; rubric: Contest['essay_rubric']; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>(essay.scores ?? {})
  const [annulled, setAnnulled] = useState(essay.annulled)
  const [note, setNote] = useState(essay.note ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    if (!essay.scan_path) return
    db.storage.from('contest-scans').createSignedUrl(essay.scan_path, 3600).then(({ data }: any) => setUrl(data?.signedUrl ?? null))
  }, [essay.scan_path])
  const max = rubric.reduce((s, r) => s + r.max, 0)
  const total = rubric.reduce((s, r) => s + (scores[r.id] ?? 0), 0)
  const complete = annulled || rubric.every(r => scores[r.id] != null)
  const save = async () => {
    setBusy(true); setErr('')
    const { data, error } = await db.rpc('contest_teacher_grade_essay', { p_essay: essay.id, p_scores: scores, p_annulled: annulled, p_note: note })
    setBusy(false)
    if (error || !data?.ok) return setErr(data?.error || error?.message || 'Não foi possível salvar.')
    onSaved()
  }
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 80, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${BRAND.line}` }}>
        <b style={{ flex: 1, color: BRAND.ink }}>Redação nº {label}</b>
        <button style={btn()} onClick={() => setZoom(z => Math.max(.6, z - .25))} aria-label="Diminuir">−</button>
        <button style={btn()} onClick={() => setZoom(z => Math.min(3, z + .25))} aria-label="Aumentar">+</button>
        <button style={btn()} onClick={onClose}>Fechar</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <div style={{ flex: '0 0 auto', maxHeight: '48vh', overflow: 'auto', background: '#E5E7EB', textAlign: 'center' }}>
          {url ? <img src={url} alt="Folha de redação" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} /> : <div style={{ padding: 40 }}><Loader2 className="animate-spin" /></div>}
        </div>
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700, color: '#B91C1C' }}><input type="checkbox" checked={annulled} onChange={e => setAnnulled(e.target.checked)} /> Zerar redação (em branco, fuga ao tema, identificada…)</label>
          {!annulled && rubric.map(r => (
            <div key={r.id}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink, marginBottom: 5 }}>{r.name}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 5 }}>
                {steps(r.max).map(v => <button key={v} onClick={() => setScores({ ...scores, [r.id]: v })} style={{ padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, border: `1px solid ${scores[r.id] === v ? BRAND.primary : BRAND.line}`, background: scores[r.id] === v ? BRAND.primary : '#fff', color: scores[r.id] === v ? '#fff' : BRAND.ink }}>{v}</button>)}
              </div>
            </div>
          ))}
          <textarea rows={2} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} placeholder="Observação (opcional, só a coordenação vê)" value={note} onChange={e => setNote(e.target.value)} />
        </div>
      </div>
      <div style={{ padding: 12, borderTop: `1px solid ${BRAND.line}`, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, color: BRAND.ink, fontSize: 15 }}>Total: {annulled ? 0 : total} / {max}</div>
        {err && <div role="alert" style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>}
        <span style={{ flex: 1 }} />
        <button style={btn(true)} disabled={!complete || busy} onClick={save}>{busy && <Loader2 size={15} className="animate-spin" />} Salvar e ir para a próxima</button>
      </div>
    </div>
  )
}
