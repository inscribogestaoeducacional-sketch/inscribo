// Concurso de Bolsas — provas avulsas (alunos que fazem a prova sem inscrição prévia) e quadro da proposta de redação.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, essayFor, GRADES, type Candidate, type Contest } from '../../lib/concurso'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box' }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5, textDecoration: 'none',
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})

export function ProvasAvulsas({ contest, cands, onChanged, onEdit }: { contest: Contest; cands: Candidate[]; onChanged: () => void; onEdit: (c: Candidate) => void }) {
  const grades = contest.grades.length ? contest.grades : GRADES
  const [grade, setGrade] = useState(grades[0])
  const [qty, setQty] = useState(3)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [built, setBuilt] = useState<Record<string, number>>({})
  useEffect(() => {
    db.from('contest_exam_versions').select('grade').eq('contest_id', contest.id).then(({ data }: any) => {
      const m: Record<string, number> = {}; (data ?? []).forEach((v: any) => { m[v.grade] = (m[v.grade] ?? 0) + 1 }); setBuilt(m)
    })
  }, [contest.id])

  const avulsas = useMemo(() => cands.filter(c => c.avulso).sort((a, b) => a.number - b.number), [cands])
  const mine = avulsas.filter(c => c.grade === grade)
  const pending = mine.filter(c => !c.student_name?.trim()).length
  const essayOn = essayFor(contest, grade).enabled
  const ready = !!built[grade]
  const href = (kind: string) => `/concurso/imprimir?contest=${contest.id}&grade=${encodeURIComponent(grade)}&kind=${kind}&room=serie&only=avulsas`

  const generate = async () => {
    setBusy(true); setMsg('')
    const { data, error } = await db.rpc('contest_create_avulsas', { p_contest: contest.id, p_grade: grade, p_qty: qty })
    setBusy(false)
    if (error || !data?.ok) { setMsg('Não foi possível gerar: ' + (data?.error || error?.message)); return }
    const nums: number[] = data.numbers ?? []
    setMsg(`Geradas ${nums.length} prova(s) avulsa(s): ${nums[0]}${nums.length > 1 ? ` a ${nums[nums.length - 1]}` : ''}.`)
    onChanged()
  }

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 16, color: BRAND.ink }}>Provas avulsas</div>
        <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 2 }}>Para alunos que vão fazer a prova sem inscrição prévia. Você reserva os números, imprime ficha, caderno e cartão-resposta e completa o cadastro depois. A correção funciona igual às demais.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Série
          <select style={input} value={grade} onChange={e => setGrade(e.target.value)}>{grades.map(g => <option key={g}>{g}</option>)}</select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 700, color: BRAND.muted }}>Quantas provas
          <input style={{ ...input, width: 90 }} type="number" min={1} max={200} value={qty} onChange={e => setQty(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} />
        </label>
        <button style={btn(true)} disabled={busy} onClick={generate}>{busy ? <Loader2 size={15} className="spin" /> : null} Gerar {qty} avulsa{qty > 1 ? 's' : ''}</button>
      </div>
      {msg && <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: msg.startsWith('Não') ? '#B91C1C' : '#047857' }}>{msg}</div>}

      {mine.length > 0 && (
        <>
          <div style={{ fontSize: 13.5, color: BRAND.ink }}><b>{mine.length}</b> avulsa(s) em {grade}: {pending} aguardando cadastro, {mine.length - pending} já cadastrada(s).</div>
          {!ready && <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 10, padding: 10, fontSize: 13 }}>A prova de {grade} ainda não foi montada. Monte em Preparar → Montar prova antes de imprimir caderno e cartão. A ficha já pode ser impressa.</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a style={btn()} href={href('ficha')} target="_blank" rel="noreferrer"><Printer size={15} /> Fichas de inscrição ({mine.length})</a>
            {ready && <a style={btn()} href={href('caderno')} target="_blank" rel="noreferrer"><Printer size={15} /> Cadernos ({mine.length})</a>}
            {ready && <a style={btn()} href={href('cartoes')} target="_blank" rel="noreferrer"><Printer size={15} /> Cartões-resposta ({mine.length})</a>}
            {ready && essayOn && <a style={btn()} href={href('redacao')} target="_blank" rel="noreferrer"><Printer size={15} /> Folhas de redação ({mine.length})</a>}
            {ready && <a style={btn()} href={`/concurso/imprimir?contest=${contest.id}&grade=${encodeURIComponent(grade)}&kind=gabarito`} target="_blank" rel="noreferrer"><Printer size={15} /> Gabarito da série</a>}
          </div>
          <div style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, overflow: 'hidden' }}>
            {mine.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', gap: 12, padding: '9px 12px', alignItems: 'center', borderTop: i ? `1px solid ${BRAND.line}` : 0 }}>
                <div style={{ width: 52, fontWeight: 800, color: BRAND.primaryDark }}>{c.number}</div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 14, color: c.student_name?.trim() ? BRAND.ink : BRAND.muted }}>{c.student_name?.trim() || 'Aguardando cadastro'}</div>
                <button style={{ ...btn(!c.student_name?.trim()), padding: '6px 10px', fontSize: 12.5 }} onClick={() => onEdit(c)}>{c.student_name?.trim() ? 'Editar' : 'Completar cadastro'}</button>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>As avulsas não entram nos lotes normais de impressão da série, para não repetir. O gabarito é o mesmo da série.</div>
        </>
      )}
    </div>
  )
}

// Quadro: o tema de redação de cada série já foi cadastrado pelo professor?
export function RedacaoStatus({ contest, cands }: { contest: Contest; cands: Candidate[] }) {
  const grades = (contest.grades.length ? contest.grades : GRADES).filter(g => cands.some(c => c.grade === g) || contest.grades.includes(g))
  const [teachers, setTeachers] = useState<string[]>([])
  useEffect(() => {
    db.from('contest_essay_teachers').select('contest_teachers(full_name)').eq('contest_id', contest.id).then(({ data }: any) => setTeachers((data ?? []).map((x: any) => x.contest_teachers?.full_name).filter(Boolean)))
  }, [contest.id])
  const rows = grades.map(g => { const e = essayFor(contest, g); return { g, e } }).filter(r => r.e.enabled)
  if (rows.length === 0) return null
  const done = rows.filter(r => r.e.prompt.trim() || r.e.images.length).length
  return (
    <div style={{ ...card, borderColor: done === rows.length ? '#A7F3D0' : '#FCD34D', background: done === rows.length ? '#F0FDF4' : '#FFFBEB' }}>
      <div style={{ fontWeight: 800, fontSize: 15, color: BRAND.ink }}>Proposta de redação: {done} de {rows.length} séries com tema</div>
      <div style={{ fontSize: 13, color: BRAND.muted, margin: '2px 0 8px' }}>{teachers.length ? `Professor de redação: ${teachers.join(', ')}.` : 'Nenhum professor de redação designado (Professores → Redação).'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(({ g, e }) => {
          const ok = !!(e.prompt.trim() || e.images.length)
          return (
            <div key={g} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13.5 }}>
              <b style={{ minWidth: 92, color: BRAND.ink }}>{g}</b>
              <span style={{ fontWeight: 700, color: ok ? '#047857' : '#B45309' }}>{ok ? 'Tema cadastrado' : 'Tema ainda não cadastrado'}</span>
              {ok && <span style={{ color: BRAND.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{e.prompt.trim().slice(0, 70)}{e.images.length ? ` · ${e.images.length} foto(s)` : ''}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
