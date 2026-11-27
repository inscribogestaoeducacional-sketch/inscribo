// Anulação de questões do Concurso de Bolsas. A escola escolhe, na hora, se a questão vale ponto para todos ou sai da prova.
// A nota de todos os alunos é recalculada no banco (gatilho) e volta ao normal se a anulação for desfeita.
import { useEffect, useMemo, useState } from 'react'
import { BRAND } from '../../lib/brand'
import { db, type Contest } from '../../lib/concurso'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const sel: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '7px 9px', fontSize: 13.5, fontFamily: 'inherit', color: BRAND.ink, background: '#fff' }
const btn = (primary = false, danger = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '8px 12px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
  border: primary || danger ? 0 : `1px solid ${BRAND.line}`, background: danger ? '#DC2626' : primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary || danger ? '#fff' : BRAND.ink,
})

type Mode = 'point' | 'remove'
type Item = { n: number; id: string; subject: string; text: string }
const MODE_LABEL: Record<Mode, string> = { point: 'ponto para todos', remove: 'tirada da prova' }

export default function AnulacaoQuestoes({ contest, onChanged, flash }: { contest: Contest; onChanged: () => void; flash: (m: string) => void }) {
  const grades = contest.grades ?? []
  const [grade, setGrade] = useState(grades[0] ?? '')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [pick, setPick] = useState<string | null>(null)       // questão escolhida para anular
  const [mode, setMode] = useState<Mode | null>(null)
  const [busy, setBusy] = useState(false)
  const annulled = contest.annulled ?? []
  const released = (contest.release_stage ?? 0) >= 1 && contest.status === 'published'

  useEffect(() => {
    if (!grade) { setItems([]); setLoading(false); return }
    let alive = true; setLoading(true)
    ;(async () => {
      const { data: ver } = await db.from('contest_exam_versions').select('items').eq('contest_id', contest.id).eq('grade', grade).order('version').limit(1).maybeSingle()
      const ids: string[] = (ver?.items ?? []).map((i: any) => i.question_id)
      if (!ids.length) { if (alive) { setItems([]); setLoading(false) } return }
      const [{ data: qs }, { data: subs }] = await Promise.all([
        db.from('contest_questions').select('id,statement,subject_id').in('id', ids),
        db.from('contest_subjects').select('id,name').eq('contest_id', contest.id),
      ])
      if (!alive) return
      const subj = new Map<string, string>((subs ?? []).map((s: any) => [s.id, s.name]))
      const byId = new Map<string, any>((qs ?? []).map((q: any) => [q.id, q]))
      setItems(ids.map((id, i) => {
        const q = byId.get(id)
        return { n: i + 1, id, subject: subj.get(q?.subject_id) ?? '', text: String(q?.statement ?? '').replace(/\s+/g, ' ').trim().slice(0, 110) }
      }))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [contest.id, grade])

  const save = async (list: typeof annulled, okMsg: string) => {
    setBusy(true)
    const { error } = await db.from('contests').update({ annulled: list }).eq('id', contest.id)
    setBusy(false)
    if (error) return flash('Não foi possível salvar: ' + error.message)
    setPick(null); setMode(null); flash(okMsg); onChanged()
  }
  const annul = () => {
    if (!pick || !mode) return
    save([...annulled.filter(a => a.question_id !== pick), { question_id: pick, mode }], 'Questão anulada. As notas de todos os alunos foram recalculadas.')
  }
  const undo = (id: string) => save(annulled.filter(a => a.question_id !== id), 'Anulação desfeita. As notas voltaram ao normal.')

  const modeOf = useMemo(() => new Map(annulled.map(a => [a.question_id, a.mode])), [annulled])
  const total = annulled.length

  return (
    <div style={card}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink, flex: 1 }}>Questões anuladas {total > 0 && <span style={{ color: '#B45309', fontSize: 13 }}>· {total} anulada{total > 1 ? 's' : ''}</span>}</div>
        <button style={btn()} onClick={() => setOpen(o => !o)}>{open ? 'Fechar' : total > 0 ? 'Ver e alterar' : 'Anular uma questão'}</button>
      </div>
      <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 6 }}>Se uma questão tiver erro, anule aqui. A nota de todos os alunos é recalculada sozinha, e você pode desfazer quando quiser.</div>

      {open && (
        <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
          {released && <div role="alert" style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 10, padding: '10px 12px', fontSize: 13.5, fontWeight: 700 }}>O resultado já foi liberado para as famílias. Se anular agora, as notas que elas já viram vão mudar.</div>}
          <label style={{ fontSize: 13, fontWeight: 700, color: BRAND.muted }}>Série{' '}
            <select style={sel} value={grade} onChange={e => { setGrade(e.target.value); setPick(null); setMode(null) }}>{grades.map(g => <option key={g}>{g}</option>)}</select>
          </label>
          {loading ? <div style={{ fontSize: 13.5, color: BRAND.muted }}>Carregando as questões…</div>
            : !items.length ? <div style={{ fontSize: 13.5, color: BRAND.muted }}>Esta série ainda não tem prova fechada.</div>
            : (
              <div style={{ display: 'grid', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {items.map(it => {
                  const m = modeOf.get(it.id)
                  return (
                    <div key={it.id} style={{ border: `1px solid ${m ? '#FCD34D' : BRAND.line}`, background: m ? '#FFFBEB' : '#fff', borderRadius: 12, padding: '9px 11px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <div style={{ fontWeight: 800, fontSize: 13.5, color: BRAND.ink }}>Questão {it.n}{it.subject && <span style={{ fontWeight: 600, color: BRAND.muted }}> · {it.subject}</span>}{m && <span style={{ color: '#B45309' }}> · anulada ({MODE_LABEL[m]})</span>}</div>
                          <div style={{ fontSize: 12.5, color: BRAND.muted }}>{it.text}{it.text.length >= 110 ? '…' : ''}</div>
                        </div>
                        {m ? <button style={btn()} disabled={busy} onClick={() => undo(it.id)}>Desfazer</button>
                          : pick === it.id ? <button style={btn()} onClick={() => { setPick(null); setMode(null) }}>Cancelar</button>
                          : <button style={btn()} onClick={() => { setPick(it.id); setMode(null) }}>Anular</button>}
                      </div>
                      {pick === it.id && !m && (
                        <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink }}>Como fica a nota dos alunos nesta questão?</div>
                          {([['point', 'Ponto para todos', 'Conta como acerto para todos, inclusive quem errou ou deixou em branco.'], ['remove', 'Tirar da prova', 'A questão sai do cálculo. A nota passa a ser sobre as questões restantes.']] as [Mode, string, string][]).map(([k, t, d]) => (
                            <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: `1px solid ${mode === k ? BRAND.primary : BRAND.line}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer', background: mode === k ? '#F0FDF9' : '#fff' }}>
                              <input type="radio" name={`mode-${it.id}`} checked={mode === k} onChange={() => setMode(k)} style={{ marginTop: 3 }} />
                              <span><b style={{ fontSize: 13.5, color: BRAND.ink }}>{t}</b><br /><span style={{ fontSize: 12.5, color: BRAND.muted }}>{d}</span></span>
                            </label>
                          ))}
                          <div><button style={btn(true)} disabled={!mode || busy} onClick={annul}>{busy ? 'Recalculando…' : 'Confirmar anulação'}</button></div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      )}
    </div>
  )
}
