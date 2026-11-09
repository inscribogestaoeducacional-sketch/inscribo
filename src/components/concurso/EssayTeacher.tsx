// Área do professor de redação: escreve o tema (com fotos) de cada série e corrige as redações às cegas.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, essayFor, type Contest, type Essay } from '../../lib/concurso'
import { ContestImg, uploadContestImage } from './media'
import EssayGrade from './EssayGrade'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})

function PromptEditor({ contest, grade, onSaved }: { contest: Contest; grade: string; onSaved: () => void }) {
  const cur = essayFor(contest, grade)
  const [text, setText] = useState(cur.prompt)
  const [images, setImages] = useState<string[]>(cur.images)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true); setMsg('')
    try { const added: string[] = []; for (const f of Array.from(files)) added.push(await uploadContestImage(f, contest.institution_id, contest.id)); setImages(i => [...i, ...added]) }
    catch (e: any) { setMsg(e?.message || 'Não foi possível enviar a foto.') }
    setBusy(false)
  }
  const save = async () => {
    setBusy(true); setMsg('')
    const { data, error } = await db.rpc('contest_teacher_save_essay_prompt', { p_contest: contest.id, p_grade: grade, p_prompt: text, p_images: images })
    setBusy(false)
    if (error || !data?.ok) return setMsg(data?.error || error?.message || 'Não foi possível salvar.')
    setMsg('Tema salvo.'); onSaved()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <textarea rows={7} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', resize: 'vertical', width: '100%', boxSizing: 'border-box' }} placeholder="Texto de apoio e proposta de redação desta série. Aparece na última página do caderno." value={text} onChange={e => setText(e.target.value)} />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {images.map(p => (
          <div key={p} style={{ position: 'relative' }}>
            <ContestImg path={p} style={{ height: 90, width: 'auto', maxHeight: 90 }} />
            <button aria-label="Remover foto" onClick={() => setImages(images.filter(x => x !== p))} style={{ position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: 99, border: 0, background: '#B91C1C', color: '#fff', cursor: 'pointer' }}><X size={14} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ ...btn(), cursor: 'pointer' }}><Camera size={16} /> Adicionar foto / imagem
          <input type="file" accept="image/*" multiple hidden onChange={e => { add(e.target.files); e.target.value = '' }} /></label>
        <button style={btn(true)} disabled={busy} onClick={save}>{busy && <Loader2 size={15} className="animate-spin" />} Salvar tema</button>
        {msg && <span role="status" style={{ fontSize: 13, color: msg === 'Tema salvo.' ? '#047857' : '#B91C1C' }}>{msg}</span>}
      </div>
    </div>
  )
}

export default function EssayTeacher({ contest, onChanged }: { contest: Contest; onChanged: () => void }) {
  const [essays, setEssays] = useState<Essay[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const grades = Object.keys(contest.essay_by_grade ?? {}).filter(g => essayFor(contest, g).enabled)

  const load = useCallback(async () => {
    const { data } = await db.from('contest_essays').select('*').eq('contest_id', contest.id).order('created_at')
    setEssays(data ?? [])
  }, [contest.id])
  useEffect(() => { load() }, [load])

  const anon = useMemo(() => new Map([...essays].sort((a, b) => a.id.localeCompare(b.id)).map((e, i) => [e.id, i + 1])), [essays])
  const isDone = (e: Essay) => e.total != null || e.annulled
  const pend = essays.filter(e => !isDone(e)).sort((a, b) => (anon.get(a.id) ?? 0) - (anon.get(b.id) ?? 0))
  const done = essays.filter(isDone).sort((a, b) => (anon.get(a.id) ?? 0) - (anon.get(b.id) ?? 0))
  const open = essays.find(e => e.id === openId) ?? null
  const gradeOf = (e: Essay) => (e as any).grade as string | undefined

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ margin: 0, fontSize: 16, color: BRAND.ink }}>{contest.name} <span style={{ color: BRAND.muted, fontWeight: 600, fontSize: 13 }}>· redação</span></h2>
      {grades.length === 0 && <div style={card}>A coordenação ainda não ligou a redação em nenhuma série.</div>}
      {grades.map(g => {
        const cur = essayFor(contest, g)
        return (
          <div key={g} style={card}>
            <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Tema da redação · {g} <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: cur.prompt ? '#D1FAE5' : '#FEF3C7', color: cur.prompt ? '#047857' : '#B45309' }}>{cur.prompt ? 'Cadastrado' : 'Falta cadastrar'}</span></div>
            <PromptEditor contest={contest} grade={g} onSaved={onChanged} />
          </div>
        )
      })}

      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink }}>Corrigir redações</div>
        <div style={{ fontSize: 13, color: BRAND.muted, margin: '4px 0 10px' }}>{essays.length === 0 ? 'Ainda não há redações escaneadas. A coordenação envia as folhas depois da prova.' : `${pend.length} para corrigir · ${done.length} ${done.length === 1 ? "corrigida" : "corrigidas"}. Você não vê nome nem número do aluno.`}</div>
        {pend.length > 0 && <button style={btn(true)} onClick={() => setOpenId(pend[0].id)}>Começar a corrigir ({pend.length})</button>}
        {done.length > 0 && <div style={{ marginTop: 10 }}>
          <button style={{ ...btn(), padding: '6px 12px', fontSize: 13 }} onClick={() => setShowDone(s => !s)}>{showDone ? 'Esconder corrigidas' : 'Rever corrigidas'}</button>
          {showDone && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column' }}>{done.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${BRAND.line}` }}>
              <span style={{ flex: 1, fontWeight: 700, color: BRAND.ink }}>Redação nº {anon.get(e.id)} {gradeOf(e) && <span style={{ color: BRAND.muted, fontWeight: 600, fontSize: 12.5 }}>· {gradeOf(e)}</span>}</span>
              <b>{e.annulled ? 'Zerada' : `${e.total}/${e.max_total}`}</b>
              <button style={{ ...btn(), padding: '6px 10px', fontSize: 13 }} onClick={() => setOpenId(e.id)}>Rever</button>
            </div>))}</div>}
        </div>}
      </div>
      {open && <EssayGrade key={open.id} essay={open} label={anon.get(open.id) ?? 0} rubric={contest.essay_rubric} onClose={() => setOpenId(null)}
        onSaved={async () => { const { data } = await db.from('contest_essays').select('*').eq('contest_id', contest.id).order('created_at'); setEssays(data ?? []); const nx = (data ?? []).filter((e: Essay) => e.id !== open.id && e.total == null && !e.annulled).sort((a: Essay, b: Essay) => a.id.localeCompare(b.id))[0]; setOpenId(nx?.id ?? null) }} />}
    </section>
  )
}
