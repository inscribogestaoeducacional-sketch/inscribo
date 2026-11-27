// Trilha do Concurso de Bolsas: o processo inteiro em fases, com o andamento calculado dos dados reais e um "próximo passo" único.
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Lock } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, type Candidate, type Contest, type Question } from '../../lib/concurso'

type Go = (tab: string) => void
type Status = 'done' | 'now' | 'todo' | 'wait'
type Phase = { id: string; title: string; what: string; detail: string; done: boolean; need?: string; tab: string; cta: string; shortcuts?: [string, string][] }

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16 }

export default function ConcursoTrilha({ contest, cands, questions, onGo }: { contest: Contest; cands: Candidate[]; questions: Question[]; onGo: Go }) {
  const [info, setInfo] = useState<{ closed: number; rooms: number; read: number; essays: number } | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [v, r, res, es] = await Promise.all([
        db.from('contest_exam_versions').select('grade').eq('contest_id', contest.id),
        db.from('contest_rooms').select('id', { count: 'exact', head: true }).eq('contest_id', contest.id),
        db.from('contest_results').select('id', { count: 'exact', head: true }).eq('contest_id', contest.id),
        db.from('contest_essays').select('id', { count: 'exact', head: true }).eq('contest_id', contest.id).not('total', 'is', null),
      ])
      if (!alive) return
      setInfo({ closed: new Set((v.data ?? []).map((x: any) => x.grade)).size, rooms: r.count ?? 0, read: res.count ?? 0, essays: es.count ?? 0 })
    })()
    return () => { alive = false }
  }, [contest.id, cands.length])

  const grades = contest.grades ?? []
  const regular = cands.filter(c => !c.avulso)
  const approved = questions.filter(q => q.status === 'approved').length
  const placed = regular.filter(c => c.room_id).length
  const i = info ?? { closed: 0, rooms: 0, read: 0, essays: 0 }
  const stage = contest.release_stage ?? 0
  const basicsOk = !!(contest.exam_date && grades.length && contest.location && contest.public_slug)
  const closedOk = grades.length > 0 && i.closed >= grades.length

  const phases: Phase[] = [
    { id: 'dados', title: 'Dados e edital', what: 'Nome, série, data, local, edital e formato da prova.', detail: basicsOk ? `${grades.length} série(s) · prova em ${new Date(contest.exam_date!.split('T')[0] + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Falta data, local, séries ou endereço da página.', done: basicsOk, tab: 'config', cta: 'Preencher dados', shortcuts: [['config', 'Dados básicos'], ['pub', 'Inscrição e edital'], ['fmt', 'Formato da prova']] },
    { id: 'quest', title: 'Questões', what: 'Os professores enviam e você aprova.', detail: questions.length ? `${approved} de ${questions.length} aprovadas` : 'Nenhuma questão ainda.', done: questions.length > 0 && approved === questions.length, tab: 'quest', cta: 'Revisar questões', shortcuts: [['prof', 'Professores e cotas']] },
    { id: 'prova', title: 'Fechar a prova', what: 'Monta os cadernos e o gabarito de cada série.', detail: closedOk ? 'Todas as séries fechadas' : `${i.closed} de ${grades.length || 0} séries fechadas`, done: closedOk, need: questions.length > 0 && approved === questions.length ? undefined : 'Aprove as questões primeiro.', tab: 'prova', cta: 'Fechar a prova' },
    { id: 'insc', title: 'Inscrições', what: 'Abrir, acompanhar e encerrar as inscrições.', detail: contest.status === 'draft' ? 'Ainda não abertas.' : contest.status === 'open' ? `Abertas · ${cands.length} inscritos` : `Encerradas · ${cands.length} inscritos`, done: contest.status === 'closed' || contest.status === 'published', tab: 'painel', cta: 'Ver inscrições', shortcuts: [['insc', 'Inscritos'], ['mail', 'E-mails']] },
    { id: 'salas', title: 'Salas e impressão', what: 'Distribuir os alunos nas salas e imprimir cadernos, cartões e redações.', detail: regular.length ? `${placed} de ${regular.length} alunos em sala` : 'Sem inscritos ainda.', done: regular.length > 0 && placed === regular.length && i.rooms > 0, need: closedOk ? undefined : 'Feche a prova primeiro.', tab: 'salas', cta: 'Abrir salas' },
    { id: 'corr', title: 'Aplicar e corrigir', what: 'Ler os cartões-resposta e corrigir as redações.', detail: regular.length ? `${i.read} de ${regular.length} gabaritos lidos · ${i.essays} redações corrigidas` : 'Sem inscritos ainda.', done: regular.length > 0 && i.read >= regular.length, need: closedOk ? undefined : 'Feche a prova primeiro.', tab: 'corr', cta: 'Ler gabaritos' },
    { id: 'res', title: 'Resultados', what: 'Anular questões, liberar o gabarito, a nota e a colocação.', detail: stage === 0 ? 'Nada liberado ainda.' : stage === 1 ? 'Liberado: gabarito e acertos.' : stage === 2 ? 'Liberado: redação e nota final.' : 'Tudo liberado, com colocação.', done: stage >= 3, need: i.read > 0 ? undefined : 'Leia os gabaritos primeiro.', tab: 'res', cta: 'Abrir resultados' },
  ]
  const firstOpen = phases.findIndex(p => !p.done)
  const statusOf = (p: Phase, idx: number): Status => p.done ? 'done' : idx === firstOpen ? 'now' : p.need ? 'wait' : 'todo'
  const cur = firstOpen === -1 ? null : phases[firstOpen]
  const doneCount = phases.filter(p => p.done).length

  const btn = (primary: boolean): React.CSSProperties => ({ display: 'inline-flex', gap: 7, alignItems: 'center', justifyContent: 'center', padding: '11px 16px', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', border: primary ? 0 : `1px solid ${BRAND.line}`, color: primary ? '#fff' : BRAND.ink, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff' })

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...card, padding: 18, background: cur ? `linear-gradient(135deg, ${BRAND.softer}, #fff)` : '#F0FDF4', borderColor: cur ? BRAND.softLine : '#86EFAC' }}>
        {cur ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.primary }}>Próximo passo · fase {firstOpen + 1} de {phases.length}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.ink, marginTop: 4, lineHeight: 1.2 }}>{cur.title}</div>
            <div style={{ fontSize: 14.5, color: BRAND.text, marginTop: 4 }}>{cur.what}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.muted, marginTop: 8 }}>{cur.detail}</div>
            {cur.need && <div style={{ fontSize: 13.5, fontWeight: 700, color: '#92400E', background: '#FEF3C7', borderRadius: 10, padding: '8px 11px', marginTop: 10 }}>{cur.need}</div>}
            <button style={{ ...btn(true), marginTop: 14 }} onClick={() => onGo(cur.need && phases[firstOpen - 1] ? phases[firstOpen - 1].tab : cur.tab)}>{cur.need && phases[firstOpen - 1] ? `Voltar: ${phases[firstOpen - 1].title}` : cur.cta} <ArrowRight size={17} /></button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#15803D' }}>Concurso completo</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: BRAND.ink, marginTop: 4 }}>Todas as fases estão concluídas.</div>
          </>
        )}
        <div style={{ height: 8, borderRadius: 99, background: BRAND.line, marginTop: 14, overflow: 'hidden' }} role="progressbar" aria-valuenow={doneCount} aria-valuemax={phases.length} aria-label="Fases concluídas"><div style={{ width: `${(doneCount / phases.length) * 100}%`, height: '100%', background: BRAND.primary }} /></div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 6 }}>{doneCount} de {phases.length} fases concluídas</div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {phases.map((p, idx) => {
          const st = statusOf(p, idx)
          const tone = st === 'done' ? { bg: '#DCFCE7', fg: '#15803D' } : st === 'now' ? { bg: BRAND.primary, fg: '#fff' } : st === 'wait' ? { bg: '#F1F5F9', fg: BRAND.faint } : { bg: BRAND.line, fg: BRAND.muted }
          return (
            <div key={p.id} style={{ ...card, padding: '12px 14px', borderColor: st === 'now' ? BRAND.primary : BRAND.line, borderWidth: st === 'now' ? 1.5 : 1, opacity: st === 'wait' ? .8 : 1 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ flex: 'none', width: 32, height: 32, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, background: tone.bg, color: tone.fg }}>
                  {st === 'done' ? <Check size={18} strokeWidth={3} /> : st === 'wait' ? <Lock size={14} /> : idx + 1}
                </span>
                <button onClick={() => onGo(p.tab)} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: BRAND.ink }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 1 }}>{st === 'wait' && p.need ? p.need : p.detail}</div>
                </button>
                <button onClick={() => onGo(p.tab)} aria-label={`Abrir ${p.title}`} style={{ ...btn(false), padding: '8px 12px', fontSize: 13 }}>{st === 'done' ? 'Ver' : 'Abrir'}</button>
              </div>
              {p.shortcuts && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingLeft: 44 }}>
                  {p.shortcuts.map(([k, l]) => <button key={k} onClick={() => onGo(k)} style={{ border: `1px solid ${BRAND.line}`, background: BRAND.softer, color: BRAND.primaryDark, borderRadius: 99, padding: '5px 11px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
