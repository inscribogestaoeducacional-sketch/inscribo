// Aba "Correção": sobe o PDF dos cartões escaneados, lê, corrige, e leva os casos duvidosos para conferência.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Loader2, Keyboard, CheckCircle2, AlertTriangle } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, GRADES, LETTERS, type Candidate, type Contest, type Question, type Subject } from '../../lib/concurso'
import { gradeAnswers, readCard, type Flag } from '../../lib/omr'
import { pdfPages } from '../../lib/pdfPages'
import { versionFor, type ExamVersionRow } from '../../lib/concursoProva'

type Result = { id: string; candidate_id: string; version: string; answers: (string | null)[]; flags: Flag[]; score: number; total: number; by_subject: Record<string, { hits: number; total: number }>; status: 'ok' | 'review' | 'manual'; source: 'scan' | 'manual'; scan_path: string | null }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const btn = (primary = false): React.CSSProperties => ({ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink })

function toJpeg(rect: { data: Uint8ClampedArray; w: number; h: number }): Promise<Blob | null> {
  const small = document.createElement('canvas'); small.width = Math.round(rect.w / 2); small.height = Math.round(rect.h / 2)
  const full = document.createElement('canvas'); full.width = rect.w; full.height = rect.h
  const id = new ImageData(rect.w, rect.h); for (let i = 0; i < rect.data.length; i++) { const j = i * 4; id.data[j] = id.data[j + 1] = id.data[j + 2] = rect.data[i]; id.data[j + 3] = 255 }
  full.getContext('2d')!.putImageData(id, 0, 0); small.getContext('2d')!.drawImage(full, 0, 0, small.width, small.height)
  return new Promise(r => small.toBlob(r, 'image/jpeg', 0.7))
}

export default function ConcursoCorrecao({ contest, subjects, questions, cands }: { contest: Contest; subjects: Subject[]; questions: Question[]; cands: Candidate[] }) {
  const [versions, setVersions] = useState<ExamVersionRow[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'review' | 'ok' | 'missing'>('all')
  const [grade, setGrade] = useState('')
  const [editing, setEditing] = useState<Candidate | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const [v, r] = await Promise.all([
      db.from('contest_exam_versions').select('*').eq('contest_id', contest.id),
      db.from('contest_results').select('*').eq('contest_id', contest.id),
    ])
    setVersions(v.data ?? []); setResults(r.data ?? [])
  }, [contest.id])
  useEffect(() => { load() }, [load])

  const subjectsOf = useMemo(() => {
    const qmap = new Map(questions.map(q => [q.id, q.subject_id]))
    const m = new Map<string, string[]>()
    versions.forEach(v => m.set(`${v.grade}|${v.version}`, v.items.map(it => qmap.get(it.question_id) ?? '-')))
    return m
  }, [versions, questions])
  const keyOf = (c: Candidate, version: string) => versions.find(v => v.grade === c.grade && v.version === version)

  const save = async (c: Candidate, version: string, answers: (string | null)[], flags: Flag[], status: Result['status'], source: Result['source'], scanPath: string | null) => {
    const v = keyOf(c, version); if (!v) return false
    const g = gradeAnswers(answers, v.answer_key, subjectsOf.get(`${c.grade}|${version}`) ?? [])
    const row = { institution_id: contest.institution_id, contest_id: contest.id, candidate_id: c.id, version, answers, flags, score: g.score, total: g.total, by_subject: g.by, status, source, ...(scanPath ? { scan_path: scanPath } : {}), updated_at: new Date().toISOString() }
    const { error } = await db.from('contest_results').upsert(row, { onConflict: 'contest_id,candidate_id' })
    return !error
  }

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setLog([]); const lines: string[] = []; let okN = 0, revN = 0, failN = 0
    for (const file of Array.from(files)) {
      try {
        for await (const { page, image } of pdfPages(file)) {
          setProgress(`${file.name} · página ${page}`)
          await new Promise(r => setTimeout(r, 0))
          const r = readCard(image, 1, contest.alternatives_count) // 1ª leitura: só alinhar e ler o QR
          if (!r.ok || !r.qr) { failN++; lines.push(`${file.name} p.${page}: ${r.error ?? 'QR code não lido'}`); continue }
          if (r.qr.contestId !== contest.id) { failN++; lines.push(`${file.name} p.${page}: cartão de outro concurso`); continue }
          const c = cands.find(x => x.number === r.qr!.number)
          if (!c) { failN++; lines.push(`${file.name} p.${page}: inscrição ${r.qr.number} não existe`); continue }
          const nQ = versions.find(v => v.grade === c.grade)?.items.length ?? 0
          if (!nQ) { failN++; lines.push(`${file.name} p.${page}: a prova de ${c.grade} ainda não foi fechada`); continue }
          const rr = readCard(image, nQ, contest.alternatives_count)
          let path: string | null = null
          if (rr.rectified) {
            const blob = await toJpeg(rr.rectified)
            if (blob) { path = `${contest.institution_id}/${contest.id}/${c.number}.jpg`; const up = await db.storage.from('contest-scans').upload(path, blob, { upsert: true, contentType: 'image/jpeg' }); if (up.error) path = null }
          }
          const status = rr.flags.length ? 'review' : 'ok'
          if (await save(c, r.qr.version, rr.answers, rr.flags, status, 'scan', path)) { status === 'ok' ? okN++ : revN++ } else { failN++; lines.push(`${file.name} p.${page}: não consegui salvar o resultado de ${c.student_name}`) }
        }
      } catch (e: any) { failN++; lines.push(`${file.name}: ${e?.message || 'erro ao abrir o arquivo'}`) }
    }
    setBusy(false); setProgress(''); setLog([`Lidos sem dúvida: ${okN} · Para conferir: ${revN} · Com problema: ${failN}`, ...lines]); load()
    if (fileRef.current) fileRef.current.value = ''
  }

  const resOf = (id: string) => results.find(r => r.candidate_id === id)
  const rows = cands.filter(c => (!grade || c.grade === grade) && (() => {
    const r = resOf(c.id)
    return filter === 'all' || (filter === 'missing' && !r) || (filter === 'review' && r?.status === 'review') || (filter === 'ok' && r && r.status !== 'review')
  })())
  const counts = { total: cands.length, read: results.filter(r => r.status !== 'review').length, review: results.filter(r => r.status === 'review').length, missing: cands.filter(c => !resOf(c.id)).length }
  const hasExam = versions.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!hasExam && <div style={card}>Feche a prova de pelo menos uma série na aba Prova para poder corrigir os cartões.</div>}
      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink }}>Subir cartões escaneados</div>
        <div style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 12px' }}>Escaneie os cartões em PDF (todas as páginas, em ordem qualquer) e envie. A leitura acontece neste computador; só o resultado é salvo.</div>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => onFiles(e.target.files)} />
        <button style={btn(true)} disabled={busy || !hasExam} onClick={() => fileRef.current?.click()}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />} {busy ? `Lendo… ${progress}` : 'Escolher PDF dos cartões'}</button>
        {log.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 13.5 }}>
            <div style={{ fontWeight: 800, color: BRAND.ink }}>{log[0]}</div>
            {log.slice(1, 12).map((l, i) => <div key={i} style={{ color: '#B45309' }}>{l}</div>)}
            {log.length > 12 && <div style={{ color: BRAND.muted }}>… e mais {log.length - 12}</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        {([['Inscritos', counts.total, BRAND.ink], ['Corrigidos', counts.read, BRAND.success], ['Para conferir', counts.review, '#B45309'], ['Sem cartão', counts.missing, BRAND.muted]] as const).map(([l, v, c]) => (
          <div key={l} style={card}><div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>{l}</div><div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div></div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {([['all', 'Todos'], ['review', 'Para conferir'], ['ok', 'Corrigidos'], ['missing', 'Sem cartão']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === k ? BRAND.primary : BRAND.line}`, background: filter === k ? BRAND.soft : '#fff', color: filter === k ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
        ))}
        <select value={grade} onChange={e => setGrade(e.target.value)} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit' }}>
          <option value="">Todas as séries</option>{(contest.grades.length ? contest.grades : GRADES).map(g => <option key={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {rows.length === 0 && <div style={{ padding: 16, fontSize: 14, color: BRAND.muted }}>Nada nesta lista.</div>}
        {rows.map((c, i) => {
          const r = resOf(c.id)
          return (
            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'center', borderTop: i ? `1px solid ${BRAND.line}` : 0, flexWrap: 'wrap' }}>
              <div style={{ width: 48, fontWeight: 800, color: BRAND.primaryDark }}>{c.number}</div>
              <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontWeight: 700, color: BRAND.ink, fontSize: 14.5 }}>{c.student_name}</div><div style={{ fontSize: 12.5, color: BRAND.muted }}>{c.grade}</div></div>
              {r ? (
                <>
                  <div style={{ fontWeight: 800, color: BRAND.ink, minWidth: 64 }}>{r.score}/{r.total}</div>
                  {r.status === 'review' ? <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '3px 9px', borderRadius: 99 }}><AlertTriangle size={13} /> Conferir ({r.flags.length})</span>
                    : <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#047857', background: '#D1FAE5', padding: '3px 9px', borderRadius: 99 }}><CheckCircle2 size={13} /> {r.status === 'manual' ? 'Digitado' : 'Corrigido'}</span>}
                  <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={() => setEditing(c)}>{r.status === 'review' ? 'Conferir' : 'Ver / corrigir'}</button>
                </>
              ) : (
                <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={() => setEditing(c)}><Keyboard size={14} /> Digitar respostas</button>
              )}
            </div>
          )
        })}
      </div>

      {editing && (
        <Conference
          cand={editing} contest={contest} result={resOf(editing.id) ?? null}
          version={resOf(editing.id)?.version ?? versionFor(editing.number, contest.versions_count)}
          exam={keyOf(editing, resOf(editing.id)?.version ?? versionFor(editing.number, contest.versions_count))}
          subjects={subjects} subjectOf={subjectsOf.get(`${editing.grade}|${resOf(editing.id)?.version ?? versionFor(editing.number, contest.versions_count)}`) ?? []}
          onClose={() => setEditing(null)}
          onSave={async (answers, version) => { const r = resOf(editing.id); const ok = await save(editing, version, answers, [], r && r.source === 'scan' ? 'ok' : 'manual', r?.source ?? 'manual', r?.scan_path ?? null); if (ok) { setEditing(null); load() } return ok }}
        />
      )}
    </div>
  )
}

function Conference({ cand, contest, result, version, exam, subjects, subjectOf, onClose, onSave }: {
  cand: Candidate; contest: Contest; result: Result | null; version: string; exam?: ExamVersionRow; subjects: Subject[]; subjectOf: string[]; onClose: () => void; onSave: (a: (string | null)[], v: string) => Promise<boolean>
}) {
  const n = exam?.items.length ?? 0
  const [answers, setAnswers] = useState<(string | null)[]>(() => Array.from({ length: n }, (_, i) => result?.answers?.[i] ?? null))
  const [img, setImg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const flagged = new Map((result?.flags ?? []).map(f => [f.q, f.kind]))
  useEffect(() => {
    let alive = true
    if (result?.scan_path) db.storage.from('contest-scans').createSignedUrl(result.scan_path, 3600).then(({ data }: any) => { if (alive) setImg(data?.signedUrl ?? null) })
    return () => { alive = false }
  }, [result?.scan_path])
  if (!exam) return null
  const g = gradeAnswers(answers, exam.answer_key, subjectOf)
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 80, overflowY: 'auto', padding: '20px 10px' }}>
      <div style={{ background: '#fff', borderRadius: 18, maxWidth: 860, margin: '0 auto', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div><div style={{ fontWeight: 800, fontSize: 17, color: BRAND.ink }}>{cand.student_name}</div><div style={{ fontSize: 13, color: BRAND.muted }}>Inscrição {cand.number} · {cand.grade} · versão {version}</div></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.primaryDark }}>{g.score}/{g.total}</div>
        </div>
        {img && <img src={img} alt="Cartão escaneado" style={{ width: '100%', maxHeight: 420, objectFit: 'contain', objectPosition: 'top', border: `1px solid ${BRAND.line}`, borderRadius: 10, marginTop: 12, background: '#f8fafc' }} />}
        <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '12px 0 6px' }}>Toque na letra certa de cada questão. Em amarelo, as que o sistema não teve certeza.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: 6 }}>
          {answers.map((a, i) => {
            const fl = flagged.get(i); const sid = subjectOf[i]
            return (
              <div key={i} title={subjects.find(s => s.id === sid)?.name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', borderRadius: 8, background: fl ? '#FEF3C7' : 'transparent' }}>
                <div style={{ width: 26, fontSize: 12.5, fontWeight: 800, color: BRAND.muted, textAlign: 'right' }}>{i + 1}</div>
                {LETTERS.slice(0, contest.alternatives_count).map(L => (
                  <button key={L} onClick={() => setAnswers(cur => cur.map((x, j) => j === i ? (x === L ? null : L) : x))} style={{ width: 30, height: 30, borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, border: `1px solid ${a === L ? BRAND.primary : BRAND.line}`, background: a === L ? BRAND.primary : '#fff', color: a === L ? '#fff' : BRAND.ink }}>{L}</button>
                ))}
                {fl && <span style={{ fontSize: 11, color: '#B45309', fontWeight: 700 }}>{fl === 'double' ? 'duas' : 'fraca'}</span>}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btn()} onClick={onClose}>Cancelar</button>
          <button style={btn(true)} disabled={saving} onClick={async () => { setSaving(true); await onSave(answers, version); setSaving(false) }}>{saving && <Loader2 size={15} className="animate-spin" />} Confirmar e salvar</button>
        </div>
      </div>
    </div>
  )
}
