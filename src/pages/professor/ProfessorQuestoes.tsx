// Portal do professor (Concurso de Bolsas): vê as cotas que recebeu, escreve e envia questões.
import { useCallback, useEffect, useState } from 'react'
import { Loader2, LogOut, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { BRAND } from '../../lib/brand'
import { db, fmtDate, Q_STATUS, type Contest, type Question, type Quota, type Subject } from '../../lib/concurso'
import QuestionEditor from '../../components/concurso/QuestionEditor'
import EssayTeacher from '../../components/concurso/EssayTeacher'
import NdaTerm from '../../components/concurso/NdaTerm'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }

export default function ProfessorQuestoes() {
  const { user, signOut } = useAuth() as any
  const [loading, setLoading] = useState(true)
  const [teacher, setTeacher] = useState<{ id: string; full_name: string; institution_id: string; nda_accepted_at: string | null } | null>(null)
  const [contests, setContests] = useState<Contest[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [essayContests, setEssayContests] = useState<string[]>([])
  const [editor, setEditor] = useState<{ quota: Quota; question: Question | null } | null>(null)

  const load = useCallback(async () => {
    const { data: t } = await db.from('contest_teachers').select('id, full_name, institution_id, nda_accepted_at').eq('user_id', user?.id).eq('active', true).maybeSingle()
    setTeacher(t ?? null)
    if (t) {
      const [c, s, q, qs] = await Promise.all([
        db.from('contests').select('*').order('created_at', { ascending: false }),
        db.from('contest_subjects').select('*'),
        db.from('contest_quotas').select('*').eq('teacher_id', t.id),
        db.from('contest_questions').select('*').eq('author_teacher_id', t.id).order('updated_at', { ascending: false }),
      ])
      const et = await db.from('contest_essay_teachers').select('contest_id').eq('teacher_id', t.id)
      setEssayContests((et.data ?? []).map((x: any) => x.contest_id))
      setContests(c.data ?? []); setSubjects(s.data ?? []); setQuotas(q.data ?? []); setQuestions(qs.data ?? [])
    }
    setLoading(false)
  }, [user?.id])
  useEffect(() => { load() }, [load])

  const remove = async (q: Question) => {
    if (!confirm('Apagar esta questão?')) return
    await db.from('contest_questions').delete().eq('id', q.id)
    load()
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>
  if (teacher && !teacher.nda_accepted_at) return <NdaTerm name={teacher.full_name} onAccepted={() => { setLoading(true); load() }} />

  return (
    <div style={{ minHeight: '100vh', background: BRAND.bg }}>
      <header style={{ background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`, color: '#fff', padding: '16px 16px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, opacity: .85 }}>Concurso de Bolsas</div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>Olá, {teacher?.full_name?.split(' ')[0] ?? 'professor'}</div>
          </div>
          <button onClick={() => signOut?.()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: '1px solid rgba(255,255,255,.4)', background: 'transparent', color: '#fff', borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!teacher && <div style={card}>Seu acesso ainda não está ativo. Fale com a coordenação da escola.</div>}
        {teacher && quotas.length === 0 && essayContests.length === 0 && <div style={card}>Você ainda não recebeu nenhuma tarefa. Quando a coordenação definir quantas questões você deve escrever, elas aparecem aqui.</div>}

        {contests.filter(ct => essayContests.includes(ct.id)).map(ct => <EssayTeacher key={'e' + ct.id} contest={ct} onChanged={load} />)}

        {contests.map(ct => {
          const mine = quotas.filter(q => q.contest_id === ct.id)
          if (!mine.length) return null
          return (
            <section key={ct.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 16, color: BRAND.ink }}>{ct.name} <span style={{ color: BRAND.muted, fontWeight: 600, fontSize: 13 }}>· prova em {fmtDate(ct.exam_date)}</span></h2>
              {mine.map(q => {
                const subj = subjects.find(s => s.id === q.subject_id)?.name ?? 'Disciplina'
                const list = questions.filter(x => x.quota_id === q.id)
                const done = list.filter(x => x.status !== 'draft').length
                const pct = Math.min(100, Math.round((done / Math.max(1, q.quantity)) * 100))
                return (
                  <div key={q.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: BRAND.ink }}>{subj} · {q.grade}</div>
                        <div style={{ fontSize: 12.5, color: BRAND.muted }}>{done} de {q.quantity} enviadas{q.due_date ? ` · entregar até ${fmtDate(q.due_date)}` : ''}</div>
                      </div>
                      <button onClick={() => setEditor({ quota: q, question: null })} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: 0, borderRadius: 12, padding: '9px 14px', background: `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})`, color: '#fff', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                        <Plus size={15} /> Nova questão
                      </button>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: '#EEF2F7', margin: '12px 0' }}><div style={{ width: `${pct}%`, height: '100%', borderRadius: 99, background: BRAND.primary }} /></div>
                    {list.map((x, i) => {
                      const st = Q_STATUS[x.status]
                      return (
                        <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${BRAND.line}` : 0 }}>
                          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: BRAND.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.statement || 'Sem enunciado'}</div>
                          <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: st.bg, color: st.fg }}>{st.label}</span>
                          {(x.status === 'draft' || x.status === 'returned') && (
                            <button aria-label="Editar" onClick={() => setEditor({ quota: q, question: x })} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.muted }}><Pencil size={16} /></button>
                          )}
                          {x.status === 'draft' && (
                            <button aria-label="Apagar" onClick={() => remove(x)} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.danger }}><Trash2 size={16} /></button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </section>
          )
        })}
      </main>

      {editor && teacher && (
        <QuestionEditor
          contest={contests.find(c => c.id === editor.quota.contest_id)!}
          institutionId={teacher.institution_id} teacherId={teacher.id}
          quota={editor.quota} question={editor.question}
          onClose={() => setEditor(null)} onSaved={() => { setEditor(null); load() }}
        />
      )}
    </div>
  )
}
