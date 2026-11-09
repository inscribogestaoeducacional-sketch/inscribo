// Impressões do Concurso (abre em outra aba): caderno, cartão-resposta, folha de redação e gabarito. Modelo ENEM.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { essayFor, LETTERS, type Candidate, type Contest, type Question, type Subject } from '../../lib/concurso'
import { versionFor, type ExamVersionRow } from '../../lib/concursoProva'
import { ContestImg } from '../../components/concurso/media'
import { cardGrid, rowLeft, rowTop } from '../../lib/concursoLayout'

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
  const [school, setSchool] = useState<{ name: string; logo_url: string | null; primary_color: string | null } | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [versions, setVersions] = useState<ExamVersionRow[]>([])
  const [questions, setQuestions] = useState<Record<string, Question>>({})
  const [cands, setCands] = useState<Candidate[]>([])
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [printing, setPrinting] = useState(false)

  useEffect(() => { (async () => {
    const { data: c } = await db.from('contests').select('*').eq('id', contestId).maybeSingle()
    if (!c) return setState('error')
    const [i, s, v, cd] = await Promise.all([
      db.from('institutions').select('name, logo_url, primary_color').eq('id', c.institution_id).maybeSingle(),
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

  const doPrint = async () => {
    setPrinting(true)
    const t0 = Date.now()
    while (Date.now() - t0 < 12000) {
      const imgs = Array.from(document.images)
      if (imgs.every(i => i.complete)) break
      await new Promise(r => setTimeout(r, 250))
    }
    setPrinting(false); window.print()
  }

  if (state === 'loading') return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Carregando…</div>
  if (state === 'error' || !contest) return <div style={{ padding: 40, fontFamily: 'system-ui' }}>Não foi possível abrir. Entre na sua conta e confira se a prova desta série foi fechada.</div>

  const essay = essayFor(contest, grade)
  const margin = kind === 'cartoes' || kind === 'redacao' ? '0' : '12mm 12mm 16mm'
  const ver = versions.find(v => v.version === version) ?? versions[0]
  const N = versions[0].items.length
  const subjName = (id: string) => subjects.find(s => s.id === id)?.name ?? ''

  return (
    <div style={{ fontFamily: 'Arial, Helvetica, sans-serif', color: '#000', background: '#9aa3ad', minHeight: '100vh' }}>
      <style>{`
        @page { size: A4; margin: ${margin}; ${kind === 'caderno' || kind === 'gabarito' ? `@bottom-left { content: "${contest.name} · ${grade}${kind === 'caderno' ? ` · Versão ${ver.version}` : ''}"; font: 8pt Arial; color: #444 } @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 8pt Arial; color: #444 }` : ''} }
        @page :first { @bottom-left { content: none } @bottom-right { content: none } }
        * { box-sizing: border-box; }
        .bar { position: sticky; top: 0; background: #1A2B4A; color: #fff; padding: 10px 16px; display: flex; gap: 12px; align-items: center; font-size: 14px; z-index: 5 }
        .bar button { padding: 8px 16px; border-radius: 10px; border: 0; background: #05907B; color: #fff; font-weight: 700; cursor: pointer }
        .sheet { background: #fff; width: 210mm; margin: 12px auto; position: relative; }
        .full { height: 297mm; page-break-after: always; overflow: hidden; }
        .flow { padding: 12mm 12mm 16mm; }
        .cols { column-count: 2; column-gap: 9mm; column-rule: 1px solid #888; font-size: 10.5pt; line-height: 1.35; }
        .q { break-inside: avoid; margin-bottom: 5mm; }
        .q img { max-width: 100%; }
        .alt { display: flex; gap: 6px; margin: 1.2mm 0; }
        .figure { margin: 2mm 0; text-align: center; break-inside: avoid; }
        .figure img { display: block; margin: 0 auto; max-width: 100%; }
        .cover { height: 268mm; page-break-after: always; overflow: hidden; }
        @media print { body { background: #fff } .bar { display: none } .sheet { margin: 0; width: auto; box-shadow: none } .full { width: 210mm } .flow { padding: 0; min-height: 0 } .cover { width: auto } }
      `}</style>
      <div className="bar"><b>{kind === 'caderno' ? `Caderno · versão ${ver.version}` : kind === 'cartoes' ? 'Cartões-resposta' : kind === 'redacao' ? 'Folhas de redação' : 'Gabarito'} · {grade}</b>
        <button onClick={doPrint} disabled={printing}>{printing ? 'Carregando imagens…' : 'Imprimir / Salvar PDF'}</button><span style={{ opacity: .8 }}>Em "Mais configurações", desligue "Cabeçalhos e rodapés".</span></div>

      {kind === 'caderno' && (() => {
        const accent = contest.print_color || school?.primary_color || '#1A2B4A'
        const ranges: { id: string; name: string; from: number; to: number }[] = []
        ver.items.forEach((it, i) => {
          const sid = questions[it.question_id]?.subject_id; if (!sid) return
          const last = ranges[ranges.length - 1]
          if (last && last.id === sid) last.to = i + 1; else ranges.push({ id: sid, name: subjName(sid), from: i + 1, to: i + 1 })
        })
        const Logo = ({ h }: { h: number }) => school?.logo_url ? <img src={school.logo_url} alt="" style={{ height: h, maxWidth: h * 3, objectFit: 'contain' }} /> : null
        let n = 0; let lastSubject = ''
        return (
          <>
            <div className="sheet cover">
              <div style={{ background: accent, color: '#fff', padding: '14mm 16mm 10mm', display: 'flex', alignItems: 'center', gap: '8mm' }}>
                {school?.logo_url && <div style={{ background: '#fff', borderRadius: 10, padding: 8 }}><Logo h={58} /></div>}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, opacity: .9 }}>{school?.name}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1, marginTop: 3 }}>{contest.name}</div>
                  <div style={{ fontSize: 14, marginTop: 4 }}>{grade}</div>
                </div>
                <div style={{ background: '#fff', color: '#000', borderRadius: 10, padding: '4mm 7mm', textAlign: 'center' }}><div style={{ fontSize: 10, fontWeight: 700 }}>VERSÃO</div><div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{ver.version}</div></div>
              </div>
              <div style={{ padding: '10mm 16mm' }}>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: .5 }}>CADERNO DE QUESTÕES</div>
                <div style={{ height: 3, width: 60, background: accent, margin: '3mm 0 6mm' }} />
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 3 }}>LEIA COM ATENÇÃO</div>
                <ol style={{ fontSize: '10.5pt', lineHeight: 1.5, margin: '0 0 8mm', paddingLeft: 18, listStyle: 'decimal' }}>
                  <li>Este caderno tem <b>{N} questões objetivas</b>{essay.enabled ? ' e a proposta de redação' : ''}. Confira se a versão <b>{ver.version}</b> é a mesma do seu cartão-resposta.</li>
                  <li>Cada questão tem uma única alternativa correta. No cartão-resposta, preencha todo o círculo com caneta azul ou preta.</li>
                  <li>Não rasure nem dobre o cartão-resposta. {essay.enabled && 'Não escreva seu nome na folha de redação.'}</li>
                  {contest.exam_duration && <li>Duração da prova: <b>{contest.exam_duration}</b>.</li>}
                  <li>Ao terminar, entregue o caderno, o cartão-resposta{essay.enabled ? ' e a folha de redação' : ''}. Nada pode ser levado.</li>
                  <li>É proibido o uso de celular, calculadora e qualquer material de consulta.</li>
                </ol>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 4 }}>O QUE TEM NESTA PROVA</div>
                <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '10.5pt' }}>
                  <tbody>{ranges.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #bbb' }}><td style={{ padding: '2.2mm 0', fontWeight: 700 }}>{r.name}</td><td style={{ textAlign: 'right', color: '#333' }}>questões {r.from} a {r.to}</td></tr>
                  ))}{essay.enabled && <tr style={{ borderTop: '1px solid #bbb', borderBottom: '1px solid #bbb' }}><td style={{ padding: '2.2mm 0', fontWeight: 700 }}>Redação</td><td style={{ textAlign: 'right', color: '#333' }}>folha própria</td></tr>}</tbody>
                </table>
              </div>
            </div>

            <div className="sheet flow">
              <div className="cols">
                {ver.items.map(it => {
                  const qu = questions[it.question_id]; if (!qu) return null
                  n++
                  const r = ranges.find(x => x.id === qu.subject_id && n >= x.from && n <= x.to)
                  const heading = qu.subject_id !== lastSubject ? (
                    <div style={{ background: accent, color: '#fff', padding: '2mm 3mm', margin: '1mm 0 3.5mm', breakAfter: 'avoid', display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '10pt', borderRadius: 3 }}>
                      <span>{subjName(qu.subject_id).toUpperCase()}</span><span style={{ fontWeight: 600, opacity: .9 }}>{r ? `questões ${r.from} a ${r.to}` : ''}</span>
                    </div>) : null
                  lastSubject = qu.subject_id
                  return (
                    <div key={it.question_id}>
                      {heading}
                      <div className="q">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 1.5 }}>
                          <span style={{ display: 'inline-block', minWidth: '7mm', textAlign: 'center', border: `1.4px solid ${accent}`, color: accent, fontWeight: 800, fontSize: '9.5pt', padding: '0.4mm 1.5mm', borderRadius: 3 }}>{String(n).padStart(2, '0')}</span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', textAlign: 'justify', hyphens: 'auto' }}>{qu.statement}</div>
                        {qu.statement_images.map(p => <div key={p} className="figure"><ContestImg path={p} style={{ border: 0, borderRadius: 0, maxWidth: '100%', maxHeight: '62mm', width: 'auto', height: 'auto', objectFit: 'contain' }} /></div>)}
                        <div style={{ marginTop: '2mm' }}>
                          {it.alt_order.map((orig, pos) => { const a = qu.alternatives[orig]; return (
                            <div key={pos} className="alt"><b style={{ minWidth: '5mm' }}>{LETTERS[pos]})</b><div style={{ flex: 1, minWidth: 0 }}>{a?.text}{a?.image && <div className="figure"><ContestImg path={a.image} style={{ border: 0, borderRadius: 0, maxWidth: '100%', maxHeight: '34mm', width: 'auto', height: 'auto', objectFit: 'contain' }} /></div>}</div></div>
                          ) })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {essay.enabled && essay.prompt && (
              <div className="sheet flow" style={{ breakBefore: 'page' }}>
                <div style={{ background: accent, color: '#fff', padding: '3mm 5mm', fontWeight: 800, fontSize: 14, borderRadius: 3 }}>REDAÇÃO</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: '11.5pt', lineHeight: 1.6, marginTop: '6mm', textAlign: 'justify' }}>{essay.prompt}</div>
                <div style={{ fontSize: '10pt', marginTop: '8mm', borderLeft: `3px solid ${accent}`, paddingLeft: 10, color: '#333' }}>Escreva o texto na folha de redação, sem se identificar. Não há folha de rascunho.</div>
              </div>
            )}
          </>
        )
      })()}

      {kind === 'cartoes' && cands.map(c => {
        const ver2 = versionFor(c.number, contest.versions_count)
        void cardGrid
        return (
          <div key={c.id} className="sheet full">
            <Marks />
            <div style={{ position: 'absolute', left: '20mm', top: '16mm', right: '58mm', display: 'flex', gap: '4mm', alignItems: 'flex-start' }}>
              {school?.logo_url && <img src={school.logo_url} alt="" style={{ height: '18mm', maxWidth: '40mm', objectFit: 'contain' }} />}
              <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{school?.name}</div>
              <div style={{ fontSize: 11 }}>{contest.name} · {grade}</div>
              <div style={{ fontWeight: 800, fontSize: 18, margin: '3mm 0 2mm' }}>CARTÃO-RESPOSTA</div>
              <div style={{ fontSize: 11 }}>Inscrição nº <b style={{ fontSize: 15 }}>{c.number}</b> &nbsp;·&nbsp; Versão <b style={{ fontSize: 15 }}>{ver2}</b></div>
              <div style={{ fontSize: 12, marginTop: 2 }}><b>{c.student_name}</b></div>
              </div>
            </div>
            {qrs[c.id] && <img src={qrs[c.id]} alt="" style={{ position: 'absolute', right: '20mm', top: '16mm', width: '32mm', height: '32mm' }} />}
            <div style={{ position: 'absolute', left: '20mm', right: '20mm', top: '56mm', fontSize: 9.5, border: '1px solid #000', padding: '2mm 3mm' }}>
              Preencha todo o círculo com caneta azul ou preta, assim: <span style={{ display: 'inline-block', width: '3.6mm', height: '3.6mm', borderRadius: '50%', background: '#000', verticalAlign: 'middle' }} />. Não rasure. Uma só marca por questão.
            </div>
            {Array.from({ length: N }, (_, i) => {
              const left = rowLeft(N, i); const top = rowTop(N, i)
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
            {school?.logo_url && <img src={school.logo_url} alt="" style={{ height: '14mm', maxWidth: '40mm', objectFit: 'contain', marginBottom: '2mm' }} />}
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
