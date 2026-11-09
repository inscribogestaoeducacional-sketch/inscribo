// Aba "Redações": correção às cegas (sem nome/nº do aluno), com critérios e nota por critério.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, essayFor, GRADES, type Candidate, type Contest, type Essay } from '../../lib/concurso'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})
const steps = (max: number) => Array.from({ length: 6 }, (_, i) => Math.round((max * i) / 5))

export default function ConcursoRedacao({ contest, cands, onChanged }: { contest: Contest; cands: Candidate[]; onChanged: () => void }) {
  const [essays, setEssays] = useState<Essay[]>([])
  const [grade, setGrade] = useState('')
  const [filter, setFilter] = useState<'pending' | 'done' | 'all'>('pending')
  const [openId, setOpenId] = useState<string | null>(null)
  const [rubric, setRubric] = useState(contest.essay_rubric)
  const [weight, setWeight] = useState(contest.essay_weight)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const { data } = await db.from('contest_essays').select('*').eq('contest_id', contest.id).order('created_at')
    setEssays(data ?? [])
  }, [contest.id])
  useEffect(() => { load() }, [load])

  const gradesWithEssay = (contest.grades.length ? contest.grades : GRADES).filter(g => essayFor(contest, g).enabled)
  const candOf = (id: string) => cands.find(c => c.id === id)
  // anonimato: o corretor vê só "Redação nº X" (posição embaralhada de forma estável pelo id), nunca o aluno
  const anon = useMemo(() => {
    const order = [...essays].sort((a, b) => a.id.localeCompare(b.id))
    return new Map(order.map((e, i) => [e.id, i + 1]))
  }, [essays])
  const list = essays.filter(e => (!grade || candOf(e.candidate_id)?.grade === grade) && (filter === 'all' || (filter === 'pending' ? e.total == null && !e.annulled : e.total != null || e.annulled)))
    .sort((a, b) => (anon.get(a.id) ?? 0) - (anon.get(b.id) ?? 0))
  const done = essays.filter(e => e.total != null || e.annulled).length
  const open = essays.find(e => e.id === openId) ?? null

  const saveSettings = async () => {
    const { error } = await db.from('contests').update({ essay_rubric: rubric, essay_weight: weight }).eq('id', contest.id)
    setMsg(error ? 'Não foi possível salvar: ' + error.message : 'Critérios e peso salvos.'); setTimeout(() => setMsg(''), 4000); if (!error) onChanged()
  }
  const next = (id: string) => {
    const pend = essays.filter(e => e.id !== id && e.total == null && !e.annulled).sort((a, b) => (anon.get(a.id) ?? 0) - (anon.get(b.id) ?? 0))
    setOpenId(pend[0]?.id ?? null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {msg && <div role="status" style={{ ...card, background: BRAND.softer, borderColor: BRAND.softLine, fontSize: 14 }}>{msg}</div>}
      {gradesWithEssay.length === 0 && <div style={card}>Nenhuma série tem redação. Ligue a redação na aba Concurso.</div>}

      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink }}>Critérios e peso da redação</div>
        <div style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 10px' }}>Cada critério vale de 0 até a nota máxima, em 6 degraus (como no ENEM). Na nota final, a redação entra com o peso abaixo.</div>
        {rubric.map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8, marginBottom: 8 }}>
            <input style={input} value={r.name} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label={`Critério ${i + 1}`} />
            <input style={input} type="number" min={10} max={1000} value={r.max} onChange={e => setRubric(rubric.map((x, j) => j === i ? { ...x, max: Math.max(10, Number(e.target.value) || 10) } : x))} aria-label={`Nota máxima do critério ${i + 1}`} />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          <label style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>Peso da redação na nota final (%)</label>
          <input style={{ ...input, width: 90 }} type="number" min={0} max={100} value={weight} onChange={e => setWeight(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} />
          <span style={{ fontSize: 12.5, color: BRAND.muted }}>Nota máxima da redação: {rubric.reduce((s, r) => s + r.max, 0)} · Séries sem redação usam só a prova objetiva.</span>
          <span style={{ flex: 1 }} />
          <button style={btn(true)} onClick={saveSettings}>Salvar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {([['Redações recebidas', essays.length], ['Corrigidas', done], ['Faltam corrigir', essays.length - done]] as [string, number][]).map(([l, v]) => (
          <div key={l} style={card}><div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink }}>{v}</div></div>
        ))}
      </div>
      <div style={{ fontSize: 13, color: BRAND.muted }}>As folhas de redação escaneadas entram pela aba Correção, junto com os cartões. Aqui o corretor não vê nome nem número do aluno.</div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['pending', 'Para corrigir'], ['done', 'Corrigidas'], ['all', 'Todas']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === k ? BRAND.primary : BRAND.line}`, background: filter === k ? BRAND.soft : '#fff', color: filter === k ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
        ))}
        <select value={grade} onChange={e => setGrade(e.target.value)} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }}>
          <option value="">Todas as séries</option>{gradesWithEssay.map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {list.length === 0 && <div style={{ padding: 16, fontSize: 14, color: BRAND.muted }}>Nenhuma redação nesta lista.</div>}
        {list.map((e, i) => (
          <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 14px', alignItems: 'center', borderTop: i ? `1px solid ${BRAND.line}` : 0 }}>
            <div style={{ flex: 1, fontWeight: 700, color: BRAND.ink }}>Redação nº {anon.get(e.id)} <span style={{ color: BRAND.muted, fontWeight: 600, fontSize: 12.5 }}>· {candOf(e.candidate_id)?.grade}</span></div>
            {e.annulled ? <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', padding: '3px 9px', borderRadius: 99 }}>Zerada</span>
              : e.total != null ? <b style={{ color: BRAND.ink }}>{e.total}/{e.max_total}</b> : <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 9px', borderRadius: 99 }}>Pendente</span>}
            <button style={btn()} onClick={() => setOpenId(e.id)}>{e.total != null || e.annulled ? 'Rever' : 'Corrigir'}</button>
          </div>
        ))}
      </div>
      {open && <Grade key={open.id} essay={open} label={anon.get(open.id) ?? 0} contest={contest} rubric={contest.essay_rubric} onClose={() => setOpenId(null)} onSaved={async () => { await load(); next(open.id) }} />}
    </div>
  )
}

function Grade({ essay, label, contest, rubric, onClose, onSaved }: { essay: Essay; label: number; contest: Contest; rubric: Contest['essay_rubric']; onClose: () => void; onSaved: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [scores, setScores] = useState<Record<string, number>>(essay.scores ?? {})
  const [annulled, setAnnulled] = useState(essay.annulled)
  const [note, setNote] = useState(essay.note ?? '')
  const [busy, setBusy] = useState(false)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    if (!essay.scan_path) return
    db.storage.from('contest-scans').createSignedUrl(essay.scan_path, 3600).then(({ data }: any) => setUrl(data?.signedUrl ?? null))
  }, [essay.scan_path])
  const max = rubric.reduce((s, r) => s + r.max, 0)
  const total = rubric.reduce((s, r) => s + (scores[r.id] ?? 0), 0)
  const complete = annulled || rubric.every(r => scores[r.id] != null)
  const save = async () => {
    setBusy(true)
    const { data: u } = await db.auth.getUser()
    await db.from('contest_essays').update({ scores: annulled ? {} : scores, total: annulled ? 0 : total, max_total: max, annulled, note: note || null, graded_by: u?.user?.id ?? null, graded_at: new Date().toISOString() }).eq('id', essay.id)
    setBusy(false); onSaved()
  }
  void contest
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: 'min(1100px,100%)', maxHeight: '96vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${BRAND.line}` }}>
          <b style={{ flex: 1, color: BRAND.ink }}>Redação nº {label}</b>
          <button style={btn()} onClick={() => setZoom(z => Math.max(.6, z - .2))}>−</button><button style={btn()} onClick={() => setZoom(z => Math.min(2.4, z + .2))}>+</button>
          <button style={btn()} onClick={onClose}>Fechar</button>
        </div>
        <div style={{ display: 'flex', gap: 14, padding: 14, overflow: 'auto', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 380px', minWidth: 0, background: '#E5E7EB', borderRadius: 12, overflow: 'auto', maxHeight: '76vh', textAlign: 'center' }}>
            {url ? <img src={url} alt="Folha de redação" style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} /> : <div style={{ padding: 40 }}><Loader2 className="animate-spin" /></div>}
          </div>
          <div style={{ flex: '0 1 340px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700, color: '#B91C1C' }}><input type="checkbox" checked={annulled} onChange={e => setAnnulled(e.target.checked)} /> Zerar redação (em branco, fuga ao tema, identificada…)</label>
            {!annulled && rubric.map(r => (
              <div key={r.id}>
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>{r.name}</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {steps(r.max).map(v => <button key={v} onClick={() => setScores({ ...scores, [r.id]: v })} style={{ minWidth: 42, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 13, border: `1px solid ${scores[r.id] === v ? BRAND.primary : BRAND.line}`, background: scores[r.id] === v ? BRAND.primary : '#fff', color: scores[r.id] === v ? '#fff' : BRAND.ink }}>{v}</button>)}
                </div>
              </div>
            ))}
            <textarea rows={2} style={{ ...input, resize: 'vertical' }} placeholder="Observação (opcional, só a coordenação vê)" value={note} onChange={e => setNote(e.target.value)} />
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Total: {annulled ? 0 : total} / {max}</div>
            <button style={btn(true)} disabled={!complete || busy} onClick={save}>{busy && <Loader2 size={15} className="animate-spin" />} Salvar e ir para a próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
