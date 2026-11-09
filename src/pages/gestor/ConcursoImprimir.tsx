// Impressões do Concurso (abre em outra aba): caderno, cartão-resposta, folha de redação e gabarito. Modelo ENEM.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { LETTERS, type Candidate, type Contest, type Question, type Subject } from '../../lib/concurso'
import { versionFor, type ExamVersionRow } from '../../lib/concursoProva'
import { ContestImg } from '../../components/concurso/media'

const db: any = supabase
const MARK: React.CSSProperties = { position: 'absolute', width: '8mm', height: '8mm', background: '#000' }
export const qrPayload = (contestId: string, number: number, version: string) => `aion-cr|${contestId}|${number}|${version}`

function Marks() {
  return <>
    <div style={{ ...MARK, left: '8mm', top: '8mm' }} /><div style={{ ...MARK, right: '8mm', top: '8mm' }} />
    <div style={{ ...MARK, left: '8mm', bottom: '8mm' }} /><div style={{ ...MARK, right: '8mm', bottom: '8mm' }} />
  </>
}

export default function ConcursoImprimir() {
  const q = new URLSearchParams(window.location.search)
  const contestId = q.get('contest') || ''; const grade = q.get('grade') || ''; const kind = q.get('kind') || 'caderno'; const version = q.get('version') || 'A'
  const [state, setState] = useState<'loading' | 'error' | 'ok'>('loading')
  const [contest, setContest] = useState<Contest | null>(null)
  const [school, setSchool] = useState<{ name: string; logo_url: string | null } | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [versions, setVersions] = useState<ExamVersionRow[]>([])
  const [questions, setQuestions] = useState<Record<string, Question>>({})
  const [cands, setCands] = useState<Candidate[]>([])
  const [qrs, setQrs] = useState<Record<string, string>>({})

  useEffect(() => { (async () => {
    const { data: c } = await db.from('contests').select('*').eq('id', contestId).maybeSingle()
    if (!c) return setState('error')
    const [i, s, v, cd] = await Promise.all([
      db.from('institutions').select('name, logo_url').eq('id', c.institution_id).maybeSingle(),
      db.from('contest_subjects').select('*').eq('contest_id', contestId).order('position'),
      db.from('contest_exam_versions').select('*').eq('contest_id', contestId).eq('grade', grade).order('version'),
      db.from('contest_candidates').select('*').eq('contest_id', contestId).eq('grade', grade).order('number'),
    ])
    const vers: ExamVersionRow[] = v.data ?? []
    if (!vers.length) return setState('error')
    const ids = Array.from(new Set(vers.flatMap(x => x.items.map(it => it.question_id))))
    const { data: qs } = await db.from('contest_questions').select('*').in('id', ids)
    setContest(c); setSchool(i.data); setSubjects(s.data ?? []); setVersions(vers); setCands(cd.data ?? [])
    setQuestions(Object.fromEntries((qs ?? []).map((x: Question) => [x.id, x])))
    if (kind === 'cartoes' || kind === 'redacao') {
      const entries = await Promise.all((cd.data ?? []).map(async (x: Candidate) => {
        const ver = versionFor(x.number, c.versions_count)
        return [x.id, await QRCode.toDataURL(qrPayload(c.id, x.number, kind === 'redacao' ? 'R' : ver), { margin: 0, width: 220, errorCorrectionLevel: 'M' })] as const
      }))
      setQrs(Object.fromEntries(entries))
    }
    setState('ok')
  })() }, [contestId, grade, kind])

  if (state === 'loading') return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Carregando…</div>
  if (state === 'error' || !contest) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Não foi possível abrir. Entre na sua conta e confira se a prova desta série foi fechada.</div>

  const margin = kind === 'cartoes' || kind === 'redacao' ? '0' : '12mm 12mm 16mm'
  const ver = versions.find(v => v.version === version) ?? versions[0]
  const N = versions[0].items.length
  const subjName = (id: string) => subjects.find(s => s.id === id)?.name ?? ''

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#9aa3ad', minHeight: '100vh' }}>
      <style>{`
        @page { size: A4; margin: ${margin}; }
        * { box-sizing: border-box; }
        .bar { position: sticky; top: 0; background: #1A2B4A; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font-size: 14px; z-index: 5 }
        .bar button { padding: 8px 16px; border-radius: 10px; border: 0; background: #05907B; color: #fff; font-weight: 700; cursor: pointer }
        .sheet { background: #fff; width: 210mm; margin: 12px auto; position: relative; }
        .full { height: 297mm; page-break-after: always; overflow: hidden; }
        .flow { padding: 12mm 12mm 16mm; min-height: 297mm; }
        .cols { column-count: 2; column-gap: 9mm; column-rule: 1px solid #888; font-size: 10.5pt; line-height: 1.35; }
        .q { break-inside: avoid; margin-bottom: 5mm; }
        .q img { max-width: 100%; }
        .alt { display: flex; gap: 6px; margin: 1.2mm 0; }
        .foot { position: fixed; bottom: 4mm; left: 0; right: 0; text-align: center; font-size: 8.5pt; color: #333; display: none }
        @media print { body { background: #fff } .bar { display: none } .sheet { margin: 0; width: auto; box-shadow: none } .full { width: 210mm } .flow { padding: 0; min-height: 0 } .foot { display: block } }
      `}</style>
      <div className="bar"><b>{kind === 'caderno' ? `Caderno · versão ${ver.version}` : kind === 'cartoes' ? 'Cartões-resposta' : kind === 'redacao' ? 'Folhas de redação' : 'Gabarito'} · {grade}</b>
        <button onClick={() => window.print()}>Imprimir / Salvar PDF</button><span style={{ opacity: .8 }}>Em "Mais configurações", desligue "Cabeçalhos e rodapés".</span></div>

      {kind === 'caderno' && (
        <div className="sheet flow">
          <div className="foot">{contest.name} · {grade} · Versão {ver.version}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '2px solid #000', paddingBottom: 6 }}>
            {school?.logo_url && <img src={school.logo_url} alt="" style={{ height: 46 }} />}
            <div style={{ flex: 1 }}><div style={{ fontWeight: 800, fontSize: 15 }}>{school?.name}</div><div style={{ fontSize: 12 }}>{contest.name} · {grade}</div></div>
            <div style={{ border: '2px solid #000', padding: '6px 14px', textAlign: 'center' }}><div style={{ fontSize: 10 }}>VERSÃO</div><div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{ver.version}</div></div>
          </div>
          <div style={{ fontWeight: 800, textAlign: 'center', margin: '10px 0 6px', fontSize: 14 }}>CADERNO DE QUESTÕES</div>
          <ol style={{ fontSize: '9.5pt', lineHeight: 1.4, margin: '0 0 8px', paddingLeft: 18, listStyle: 'decimal' }}>
            <li>Este caderno contém {N} questões objetivas{contest.has_essay ? ' e a proposta de redação' : ''}. Confira se a versão impressa aqui é a mesma do seu cartão-resposta.</li>
            <li>Cada questão tem uma única alternativa correta. Marque no cartão-resposta, preenchendo todo o círculo, com caneta azul ou preta.</li>
            <li>Não rasure o cartão-resposta. Não escreva seu nome na folha de redação.</li>
            {contest.exam_duration && <li>Duração da prova: {contest.exam_duration}.</li>}
            <li>Ao terminar, entregue este caderno, o cartão-resposta{contest.has_essay ? ' e a folha de redação' : ''}. Nada pode ser levado.</li>
          </ol>
          <div className="cols">
            {(() => {
              let n = 0; let lastSubject = ''
              return ver.items.map(it => {
                const qu = questions[it.question_id]; if (!qu) return null
                n++
                const heading = qu.subject_id !== lastSubject ? <div style={{ fontWeight: 800, fontSize: '10pt', background: '#000', color: '#fff', padding: '2px 8px', margin: '2mm 0 3mm', breakAfter: 'avoid' }}>{subjName(qu.subject_id).toUpperCase()}</div> : null
                lastSubject = qu.subject_id
                return (
                  <div key={it.question_id}>
                    {heading}
                    <div className="q">
                      <div style={{ fontWeight: 800, marginBottom: 2 }}>QUESTÃO {String(n).padStart(2, '0')}</div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{qu.statement}</div>
                      {qu.statement_images.map(p => <div key={p} style={{ margin: '2mm 0' }}><ContestImg path={p} style={{ border: 0, borderRadius: 0, maxHeight: '70mm' }} /></div>)}
                      <div style={{ marginTop: '2mm' }}>
                        {it.alt_order.map((orig, p) => { const a = qu.alternatives[orig]; return (
                          <div key={p} className="alt"><b>{LETTERS[p]})</b><div>{a?.text}{a?.image && <ContestImg path={a.image} style={{ border: 0, borderRadius: 0, maxHeight: '40mm', display: 'block' }} />}</div></div>
                        ) })}
                      </div>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
          {contest.has_essay && contest.essay_prompt && (
            <div style={{ breakBefore: 'page', paddingTop: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, background: '#000', color: '#fff', padding: '3px 10px', marginBottom: 8 }}>REDAÇÃO</div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: '11pt', lineHeight: 1.5 }}>{contest.essay_prompt}</div>
              <div style={{ fontSize: '10pt', marginTop: 10 }}>Escreva a redação na folha própria, sem se identificar. Não há folha de rascunho.</div>
            </div>
          )}
        </div>
      )}

      {kind === 'cartoes' && cands.map(c => {
        const ver2 = versionFor(c.number, contest.versions_count)
        const rows = 20; const blocks = Math.ceil(N / rows)
        return (
          <div key={c.id} className="sheet full">
            <Marks />
            <div style={{ position: 'absolute', left: '20mm', top: '16mm', right: '66mm' }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{school?.name}</div>
              <div style={{ fontSize: 11 }}>{contest.name} · {grade}</div>
              <div style={{ fontWeight: 800, fontSize: 18, margin: '4mm 0 3mm' }}>CARTÃO-RESPOSTA</div>
              <div style={{ fontSize: 11 }}>Inscrição nº <b style={{ fontSize: 15 }}>{c.number}</b> &nbsp;·&nbsp; Versão <b style={{ fontSize: 15 }}>{ver2}</b></div>
              <div style={{ fontSize: 12, marginTop: 2 }}><b>{c.student_name}</b></div>
            </div>
            {qrs[c.id] && <img src={qrs[c.id]} alt="" style={{ position: 'absolute', right: '20mm', top: '16mm', width: '32mm', height: '32mm' }} />}
            <div style={{ position: 'absolute', left: '20mm', right: '20mm', top: '56mm', fontSize: 9.5, border: '1px solid #000', padding: '2mm 3mm' }}>
              Preencha todo o círculo com caneta azul ou preta, assim: <span style={{ display: 'inline-block', width: '3.6mm', height: '3.6mm', borderRadius: '50%', background: '#000', verticalAlign: 'middle' }} />. Não rasure. Uma só marca por questão.
            </div>
            {Array.from({ length: N }, (_, i) => {
              const col = Math.floor(i / rows); const row = i % rows
              const left = 20 + col * (170 / Math.max(blocks, 1)); const top = 72 + row * 8
              return (
                <div key={i} style={{ position: 'absolute', left: `${left}mm`, top: `${top}mm`, height: '6mm', display: 'flex', alignItems: 'center', gap: '1.6mm' }}>
                  <div style={{ width: '7mm', fontSize: 9.5, fontWeight: 700, textAlign: 'right', marginRight: '1mm' }}>{i + 1}</div>
                  {LETTERS.slice(0, contest.alternatives_count).map(L => (
                    <div key={L} style={{ width: '5.2mm', height: '5.2mm', borderRadius: '50%', border: '0.35mm solid #000', fontSize: 6.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{L}</div>
                  ))}
                </div>
              )
            })}
            <div style={{ position: 'absolute', left: '20mm', right: '20mm', bottom: '24mm', borderTop: '1px solid #000', fontSize: 10, paddingTop: 1 }}>Assinatura do candidato</div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '14mm', textAlign: 'center', fontSize: 8 }}>Não dobre, não amasse e não risque os quadrados pretos dos cantos.</div>
          </div>
        )
      })}

      {kind === 'redacao' && cands.map(c => (
        <div key={c.id} className="sheet full">
          <Marks />
          <div style={{ position: 'absolute', left: '20mm', top: '16mm', right: '66mm' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>FOLHA DE REDAÇÃO</div>
            <div style={{ fontSize: 11, margin: '2mm 0' }}>{contest.name} · {grade}</div>
            <div style={{ fontSize: 12 }}>Inscrição nº <b style={{ fontSize: 22 }}>{c.number}</b></div>
            <div style={{ fontSize: 10, marginTop: 3 }}>Não escreva seu nome, não assine e não faça marcas que o identifiquem.</div>
          </div>
          {qrs[c.id] && <img src={qrs[c.id]} alt="" style={{ position: 'absolute', right: '20mm', top: '16mm', width: '30mm', height: '30mm' }} />}
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: '20mm', right: '20mm', top: `${58 + i * 7.3}mm`, borderBottom: '0.3mm solid #444', height: 0 }}>
              <span style={{ position: 'absolute', left: '-8mm', top: '-3mm', fontSize: 7, color: '#555' }}>{i + 1}</span>
            </div>
          ))}
        </div>
      ))}

      {kind === 'gabarito' && (
        <div className="sheet flow">
          <div style={{ fontWeight: 800, fontSize: 16 }}>Gabarito — {contest.name} · {grade}</div>
          <div style={{ fontSize: 11, color: '#444', marginBottom: 10 }}>Uso exclusivo da coordenação. Não distribuir.</div>
          <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr><th style={{ border: '1px solid #000', padding: '3px 10px' }}>Questão</th><th style={{ border: '1px solid #000', padding: '3px 10px', textAlign: 'left' }}>Disciplina</th>{versions.map(v => <th key={v.id} style={{ border: '1px solid #000', padding: '3px 12px' }}>Versão {v.version}</th>)}</tr></thead>
            <tbody>{versions[0].answer_key.map((_, i) => (
              <tr key={i}><td style={{ border: '1px solid #000', padding: '2px 10px', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ border: '1px solid #000', padding: '2px 10px' }}>{subjName(questions[versions[0].items[i].question_id]?.subject_id)}</td>
                {versions.map(v => <td key={v.id} style={{ border: '1px solid #000', padding: '2px 12px', textAlign: 'center', fontWeight: 800 }}>{v.answer_key[i]}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
