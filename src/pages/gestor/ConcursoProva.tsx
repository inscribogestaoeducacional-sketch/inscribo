// Aba "Prova": monta o caderno de cada série com as questões aprovadas, fecha as versões embaralhadas e libera as impressões.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Lock, Printer, Unlock } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, essayFor, GRADES, type Candidate, type Contest, type Question, type Quota, type Subject } from '../../lib/concurso'
import { buildVersions, versionFor, type ExamVersionRow } from '../../lib/concursoProva'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, textDecoration: 'none',
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})

export default function ConcursoProva({ contest, subjects, quotas, questions, cands, onChanged, onGoSalas }: {
  contest: Contest; subjects: Subject[]; quotas: Quota[]; questions: Question[]; cands: Candidate[]; onChanged: () => void; onGoSalas?: () => void
}) {
  const grades = contest.grades.length ? contest.grades : GRADES
  const [grade, setGrade] = useState(grades[0])
  const [versions, setVersions] = useState<ExamVersionRow[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const loadVersions = useCallback(async () => {
    const { data } = await db.from('contest_exam_versions').select('*').eq('contest_id', contest.id)
    setVersions(data ?? [])
  }, [contest.id])
  useEffect(() => { loadVersions() }, [loadVersions])

  const subjOrder = useMemo(() => [...subjects].sort((a, b) => a.position - b.position), [subjects])
  const approved = useMemo(() => questions.filter(q => q.grade === grade && q.status === 'approved'), [questions, grade])
  const ordered = useMemo(() => subjOrder.flatMap(s => approved.filter(q => q.subject_id === s.id).sort((a, b) => a.position - b.position || a.updated_at.localeCompare(b.updated_at))), [approved, subjOrder])
  const inExam = ordered.filter(q => q.in_exam)
  const gradeVersions = versions.filter(v => v.grade === grade).sort((a, b) => a.version.localeCompare(b.version))
  const locked = gradeVersions.length > 0
  const gradeCands = cands.filter(c => c.grade === grade)

  const move = async (q: Question, dir: -1 | 1) => {
    const list = ordered.filter(x => x.subject_id === q.subject_id)
    const i = list.findIndex(x => x.id === q.id); const j = i + dir
    if (j < 0 || j >= list.length) return
    const next = [...list]; [next[i], next[j]] = [next[j], next[i]]
    await Promise.all(next.map((x, p) => db.from('contest_questions').update({ position: p }).eq('id', x.id)))
    onChanged()
  }
  const toggle = async (q: Question) => { await db.from('contest_questions').update({ in_exam: !q.in_exam }).eq('id', q.id); onChanged() }

  const lock = async () => {
    setErr('')
    if (inExam.length === 0) return setErr('Não há questões aprovadas para esta série.')
    if (inExam.length > 120) return setErr('O cartão-resposta comporta até 120 questões por série. Tire algumas da prova.')
    if (inExam.some(q => q.correct_index === null)) return setErr('Há questão sem alternativa correta marcada.')
    setBusy(true)
    const built = buildVersions(inExam, contest.versions_count, contest.alternatives_count, subjOrder.map(s => s.id), `${contest.id}:${grade}`)
    const { error } = await db.from('contest_exam_versions').insert(built.map(b => ({ institution_id: contest.institution_id, contest_id: contest.id, grade, version: b.version, items: b.items, answer_key: b.answer_key })))
    if (error) { setBusy(false); return setErr('Não foi possível fechar a prova: ' + error.message) }
    // versão de cada candidato: revezamento pelo número de inscrição (reprodutível)
    for (let v = 0; v < contest.versions_count; v++) {
      const letter = String.fromCharCode(65 + v)
      const ids = gradeCands.filter(c => versionFor(c.number, contest.versions_count) === letter).map(c => c.id)
      if (ids.length) await db.from('contest_candidates').update({ version: letter }).in('id', ids)
    }
    setBusy(false); await loadVersions(); onChanged()
  }
  const reopen = async () => {
    if (!confirm('Reabrir a prova apaga as versões e o gabarito desta série. Só faça isso antes de imprimir. Continuar?')) return
    setBusy(true)
    await db.from('contest_exam_versions').delete().eq('contest_id', contest.id).eq('grade', grade)
    await db.from('contest_candidates').update({ version: null }).eq('contest_id', contest.id).eq('grade', grade)
    setBusy(false); await loadVersions(); onChanged()
  }

  const href = (kind: string, version?: string) => `/concurso/imprimir?contest=${contest.id}&grade=${encodeURIComponent(grade)}&kind=${kind}${version ? `&version=${version}` : ''}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: BRAND.soft, border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 14px', fontSize: 13.5, color: BRAND.ink, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 260px' }}><b>Último passo da preparação.</b> Aqui você escolhe as questões, a ordem e fecha a prova de cada série. A impressão de cadernos e cartões <b>por sala e por aluno</b> fica em "Aplicar e corrigir".</span>
        {onGoSalas && <button style={btn()} onClick={onGoSalas}>Ir para Salas e impressão</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={grade} onChange={e => setGrade(e.target.value)} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
          {grades.map(g => <option key={g}>{g}</option>)}
        </select>
        <span style={{ fontSize: 13, color: BRAND.muted }}>{inExam.length} questões na prova · {gradeCands.length} inscritos</span>
        <div style={{ flex: 1 }} />
        {locked
          ? <button style={btn()} onClick={reopen} disabled={busy}><Unlock size={15} /> Reabrir prova</button>
          : <button style={btn(true)} onClick={lock} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />} Fechar prova e gerar versões</button>}
      </div>
      {err && <div style={{ color: '#B91C1C', fontSize: 13.5 }}>{err}</div>}

      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Questões por disciplina</div>
        {subjOrder.map(s => {
          const total = quotas.filter(q => q.subject_id === s.id && q.grade === grade).reduce((n, q) => n + q.quantity, 0)
          const have = approved.filter(q => q.subject_id === s.id).length
          const list = ordered.filter(q => q.subject_id === s.id)
          if (!total && !have) return null
          return (
            <div key={s.id} style={{ padding: '10px 0', borderTop: `1px solid ${BRAND.line}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <b style={{ color: BRAND.ink }}>{s.name}</b>
                <span style={{ color: have >= total ? BRAND.success : BRAND.warn, fontWeight: 700 }}>{have} de {total} aprovadas</span>
              </div>
              {list.map((q, i) => (
                <div key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', opacity: q.in_exam ? 1 : .45 }}>
                  <input type="checkbox" checked={q.in_exam} disabled={locked} onChange={() => toggle(q)} aria-label="Usar na prova" />
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: BRAND.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.statement}</div>
                  {!locked && <>
                    <button aria-label="Subir" disabled={i === 0} onClick={() => move(q, -1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.muted }}><ArrowUp size={16} /></button>
                    <button aria-label="Descer" disabled={i === list.length - 1} onClick={() => move(q, 1)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.muted }}><ArrowDown size={16} /></button>
                  </>}
                </div>
              ))}
            </div>
          )
        })}
        {approved.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted }}>Ainda não há questões aprovadas para esta série. Aprove as questões na aba Questões.</div>}
      </div>

      {locked && (
        <>
          <div style={card}>
            <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 4 }}>Prova fechada · {gradeVersions.length} {gradeVersions.length === 1 ? 'versão' : 'versões'}</div>
            <div style={{ fontSize: 13, color: BRAND.muted, marginBottom: 12 }}>Cada inscrito recebe uma versão pelo número de inscrição. O gabarito abaixo é só da coordenação.</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead><tr><th style={{ textAlign: 'left', padding: '4px 10px', color: BRAND.muted }}>Questão</th>{gradeVersions.map(v => <th key={v.id} style={{ padding: '4px 14px', color: BRAND.ink }}>Versão {v.version}</th>)}</tr></thead>
                <tbody>{gradeVersions[0].answer_key.map((_, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BRAND.line}` }}><td style={{ padding: '4px 10px', color: BRAND.muted }}>{i + 1}</td>
                    {gradeVersions.map(v => <td key={v.id} style={{ padding: '4px 14px', textAlign: 'center', fontWeight: 800, color: BRAND.primaryDark }}>{v.answer_key[i]}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Impressões</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {gradeVersions.map(v => <a key={v.id} style={btn()} href={href('caderno', v.version)} target="_blank" rel="noreferrer"><Printer size={15} /> Caderno · versão {v.version}</a>)}
              <a style={btn()} href={`/concurso/imprimir?contest=${contest.id}&grade=${encodeURIComponent(grade)}&kind=caderno&room=serie`} target="_blank" rel="noreferrer"><Printer size={15} /> Cadernos de todos os alunos ({gradeCands.length})</a>
              <a style={btn()} href={href('cartoes')} target="_blank" rel="noreferrer"><Printer size={15} /> Cartões-resposta ({gradeCands.length})</a>
              {essayFor(contest, grade).enabled && <a style={btn()} href={href('redacao')} target="_blank" rel="noreferrer"><Printer size={15} /> Folhas de redação ({gradeCands.length})</a>}
              <a style={btn()} href={href('folha')} target="_blank" rel="noreferrer"><Printer size={15} /> Folhas do aluno ({gradeCands.length})</a>
              <a style={btn()} href={href('gabarito')} target="_blank" rel="noreferrer"><Printer size={15} /> Gabarito (coordenação)</a>
            </div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 10 }}>Na janela que abrir, escolha "Salvar como PDF" ou imprima direto. O caderno é um por versão (imprima uma cópia por aluno); o cartão e a folha de redação já saem identificados.</div>
          </div>
        </>
      )}
    </div>
  )
}
