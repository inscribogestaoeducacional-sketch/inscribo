// Editor de questão (professor): enunciado, imagens, alternativas, resposta certa, dificuldade e comentário.
import { useState } from 'react'
import { Loader2, ImagePlus, X } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, LETTERS, type Alt, type Contest, type Question } from '../../lib/concurso'
import { ContestImg, uploadContestImage } from './media'

const input: React.CSSProperties = { width: '100%', border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box' }
const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: BRAND.muted, marginBottom: 5, display: 'block' }

export default function QuestionEditor({ contest, institutionId, question, quota, teacherId, onClose, onSaved }: {
  contest: Contest; institutionId: string; question: Question | null
  quota: { id: string; subject_id: string; grade: string }; teacherId: string
  onClose: () => void; onSaved: () => void
}) {
  const n = contest.alternatives_count
  const [statement, setStatement] = useState(question?.statement ?? '')
  const [images, setImages] = useState<string[]>(question?.statement_images ?? [])
  const [alts, setAlts] = useState<Alt[]>(Array.from({ length: n }, (_, i) => question?.alternatives?.[i] ?? { text: '' }))
  const [correct, setCorrect] = useState<number | null>(question?.correct_index ?? null)
  const [difficulty, setDifficulty] = useState<string>(question?.difficulty ?? '')
  const [comment, setComment] = useState(question?.comment ?? '')
  const [noShuffle, setNoShuffle] = useState(question?.no_shuffle ?? false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const risky = /todas as anteriores|nenhuma das anteriores|as alternativas? (acima|anteriores)|\bI e II\b|apenas I\b/i.test(alts.map(a => a.text).join(' '))

  const addImg = async (file: File | undefined, onPath: (p: string) => void) => {
    if (!file) return
    setErr('')
    try { onPath(await uploadContestImage(file, institutionId, contest.id)) } catch (e: any) { setErr(e?.message || 'Não foi possível enviar a imagem') }
  }

  const save = async (send: boolean) => {
    setErr('')
    if (send) {
      if (!statement.trim()) return setErr('Escreva o enunciado antes de enviar.')
      if (alts.some(a => !a.text.trim() && !a.image)) return setErr('Preencha todas as alternativas.')
      if (correct === null) return setErr('Marque a alternativa correta.')
    }
    setBusy(true)
    const row = {
      institution_id: institutionId, contest_id: contest.id, quota_id: quota.id, subject_id: quota.subject_id, grade: quota.grade,
      author_teacher_id: teacherId, statement: statement.trim(), statement_images: images, alternatives: alts,
      correct_index: correct, difficulty: difficulty || null, comment: comment.trim() || null, no_shuffle: noShuffle,
      status: send ? 'sent' : 'draft', updated_at: new Date().toISOString(),
    }
    const { error } = question
      ? await db.from('contest_questions').update(row).eq('id', question.id)
      : await db.from('contest_questions').insert(row)
    setBusy(false)
    if (error) return setErr('Não foi possível salvar: ' + error.message)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 80, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '24px 12px' }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 680, padding: 20, boxShadow: '0 30px 60px -20px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: BRAND.ink }}>{question ? 'Editar questão' : 'Nova questão'} <span style={{ color: BRAND.muted, fontWeight: 600, fontSize: 13 }}>· {quota.grade}</span></div>
          <button onClick={onClose} aria-label="Fechar" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.muted }}><X size={20} /></button>
        </div>
        {question?.status === 'returned' && question.review_note && (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>
            <b>A coordenação pediu ajuste:</b> {question.review_note}
          </div>
        )}
        <label style={label}>Enunciado</label>
        <textarea value={statement} onChange={e => setStatement(e.target.value)} rows={6} style={{ ...input, resize: 'vertical' }} placeholder="Texto de apoio e pergunta" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '8px 0 14px', alignItems: 'flex-start' }}>
          {images.map((p, i) => (
            <div key={p} style={{ position: 'relative' }}>
              <ContestImg path={p} style={{ maxHeight: 120 }} />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} aria-label="Remover imagem" style={{ position: 'absolute', top: 4, right: 4, border: 0, borderRadius: 99, width: 22, height: 22, background: 'rgba(15,23,42,.7)', color: '#fff', cursor: 'pointer' }}>×</button>
            </div>
          ))}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px dashed ${BRAND.softLine}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: BRAND.primary, fontWeight: 700, cursor: 'pointer' }}>
            <ImagePlus size={15} /> Adicionar imagem
            <input type="file" accept="image/*" hidden onChange={e => { addImg(e.target.files?.[0], p => setImages(x => [...x, p])); e.currentTarget.value = '' }} />
          </label>
        </div>

        <label style={label}>Alternativas <span style={{ fontWeight: 500 }}>(marque a correta)</span></label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input type="radio" name="correct" checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Alternativa ${LETTERS[i]} correta`} style={{ marginTop: 12 }} />
              <div style={{ width: 24, paddingTop: 9, fontWeight: 800, color: BRAND.ink }}>{LETTERS[i]}</div>
              <div style={{ flex: 1 }}>
                <input value={a.text} onChange={e => setAlts(alts.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} style={input} placeholder={`Alternativa ${LETTERS[i]}`} />
                {a.image && <div style={{ marginTop: 6 }}><ContestImg path={a.image} style={{ maxHeight: 90 }} /></div>}
              </div>
              <label title="Imagem na alternativa" style={{ paddingTop: 9, cursor: 'pointer', color: BRAND.muted }}>
                <ImagePlus size={17} />
                <input type="file" accept="image/*" hidden onChange={e => { addImg(e.target.files?.[0], p => setAlts(cur => cur.map((x, j) => j === i ? { ...x, image: p } : x))); e.currentTarget.value = '' }} />
              </label>
            </div>
          ))}
        </div>
        {risky && !noShuffle && (
          <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 10, padding: '8px 12px', fontSize: 12.5 }}>
            Alguma alternativa parece citar outras ("todas as anteriores", "I e II"). Se a prova for embaralhada isso quebra o sentido. Marque "Não embaralhar as alternativas desta questão".
          </div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: BRAND.text, margin: '10px 0 14px' }}>
          <input type="checkbox" checked={noShuffle} onChange={e => setNoShuffle(e.target.checked)} /> Não embaralhar as alternativas desta questão
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
          <div><label style={label}>Dificuldade</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={input}>
              <option value="">Não informada</option><option value="facil">Fácil</option><option value="media">Média</option><option value="dificil">Difícil</option>
            </select></div>
          <div style={{ gridColumn: '1 / -1' }}><label style={label}>Comentário / resolução <span style={{ fontWeight: 500 }}>(só a coordenação vê)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} /></div>
        </div>

        {err && <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 12 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={() => save(false)} disabled={busy} style={{ padding: '10px 16px', borderRadius: 12, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.ink, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Salvar rascunho</button>
          <button onClick={() => save(true)} disabled={busy} style={{ padding: '10px 18px', borderRadius: 12, border: 0, background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`, color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            {busy && <Loader2 size={15} className="animate-spin" />} Enviar para a coordenação
          </button>
        </div>
      </div>
    </div>
  )
}
