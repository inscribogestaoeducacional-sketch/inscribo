// Concurso de Bolsas — coordenação: cria o concurso, disciplinas, professores e cotas, e revisa as questões.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Trophy, Plus, Loader2, Check, Undo2, Trash2, Mail, FileText } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import ConcursoProva from './ConcursoProva'
import ConcursoCorrecao from './ConcursoCorrecao'
import { EditInscricao, Painel } from './ConcursoInscritos'
import ConcursoEmails from './ConcursoEmails'
import EssayRubric from '../../components/concurso/EssayRubric'
import TakeHomeConfig from '../../components/concurso/TakeHomeConfig'
import ConcursoResultados from './ConcursoResultados'
import ConcursoSalas from './ConcursoSalas'
import { ContestImg } from '../../components/concurso/media'
import {
  db, DEFAULT_SUBJECTS, deadlineFromInput, deadlineLong, deadlineToInput, essayFor, examDateFromInput, examDateToInput, subjectHasGrade, DEFAULT_COVER, COVER_TOKENS, FORM_FIELDS, fieldCfg, GRADES, LETTERS, CONTEST_STATUS, Q_STATUS, fmtDate,
  type Candidate, type Contest, type ExtraField, slugify, type Question, type Quota, type Subject, type Teacher,
} from '../../lib/concurso'

const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})
// Mensagem real de uma Edge Function (o supabase-js só dá "non-2xx status code" quando a função responde erro).
async function fnMessage(error: any, data: any, fallback: string): Promise<string> {
  if (data?.error) return data.error
  try { const j = await error?.context?.json?.(); if (j?.error) return j.error } catch { /* resposta sem JSON */ }
  return error?.message || fallback
}
// Apaga questões (coordenação). Bloqueia se alguma já está num caderno de prova montado daquela série.
async function removeQuestions(contestId: string, qs: Question[]): Promise<string | null> {
  if (!qs.length) return null
  const grades = Array.from(new Set(qs.filter(q => q.in_exam).map(q => q.grade)))
  if (grades.length) {
    const { count } = await db.from('contest_exam_versions').select('id', { count: 'exact', head: true }).eq('contest_id', contestId).in('grade', grades)
    if ((count ?? 0) > 0) return 'Há questão que já está num caderno de prova montado. Desmonte a prova daquela série antes de apagar.'
  }
  const { data, error } = await db.from('contest_questions').delete().in('id', qs.map(q => q.id)).select('id')
  if (error) return error.message
  if ((data?.length ?? 0) !== qs.length) return 'Não foi possível apagar todas as questões.'
  return null
}
const STAGES = [
  { id: 'prep', label: 'Preparar', tabs: [['config', '1 · Dados básicos'], ['pub', '2 · Inscrição e edital'], ['fmt', '3 · Formato da prova'], ['prof', '4 · Professores e cotas'], ['quest', '5 · Questões'], ['prova', '6 · Fechar a prova']] },
  { id: 'insc', label: 'Inscrições', tabs: [['painel', 'Painel'], ['insc', 'Inscritos'], ['mail', 'E-mails']] },
  { id: 'corr', label: 'Aplicar e corrigir', tabs: [['salas', 'Salas e impressão'], ['corr', 'Correção']] },
  { id: 'res', label: 'Resultados', tabs: [['res', 'Ranking e divulgação']] },
] as const
type Tab = 'salas' | 'config' | 'fmt' | 'pub' | 'prof' | 'quest' | 'prova' | 'painel' | 'insc' | 'mail' | 'corr' | 'res'

export default function Concurso() {
  const { user } = useAuth()
  const instId = user?.institution_id || ''
  const [loading, setLoading] = useState(true)
  const [contests, setContests] = useState<Contest[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('config')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [quotas, setQuotas] = useState<Quota[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [cands, setCands] = useState<Candidate[]>([])
  const [msg, setMsg] = useState('')

  const loadAll = useCallback(async () => {
    if (!instId) return
    const [c, t] = await Promise.all([
      db.from('contests').select('*').eq('institution_id', instId).order('created_at', { ascending: false }),
      db.from('contest_teachers').select('*').eq('institution_id', instId).order('full_name'),
    ])
    setContests(c.data ?? []); setTeachers(t.data ?? [])
    setSel(cur => cur ?? c.data?.[0]?.id ?? null)
    setLoading(false)
  }, [instId])
  useEffect(() => { loadAll() }, [loadAll])

  const loadContest = useCallback(async () => {
    if (!sel) return
    const [s, q, qs, cd] = await Promise.all([
      db.from('contest_subjects').select('*').eq('contest_id', sel).order('position'),
      db.from('contest_quotas').select('*').eq('contest_id', sel),
      db.from('contest_questions').select('*').eq('contest_id', sel).order('updated_at', { ascending: false }),
      db.from('contest_candidates').select('*').eq('contest_id', sel).order('number'),
    ])
    setSubjects(s.data ?? []); setQuotas(q.data ?? []); setQuestions(qs.data ?? []); setCands(cd.data ?? [])
  }, [sel])
  useEffect(() => { loadContest() }, [loadContest])

  const contest = contests.find(c => c.id === sel) ?? null
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" /></div>

  const stageOf = STAGES.find(st => (st.tabs as readonly (readonly [string, string])[]).some(t => t[0] === tab)) ?? STAGES[0]
  const approved = questions.filter(q => q.status === 'approved').length
  const days = contest?.exam_date ? Math.ceil((new Date(contest.exam_date.split('T')[0] + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
  const stageHint = (id: string) => id === 'prep' ? `${approved} de ${questions.length} questões aprovadas` : id === 'insc' ? `${cands.length} inscritos` : id === 'corr' ? 'Salas, cartões e redações' : contest ? CONTEST_STATUS[contest.status] : ''
  const stat = (label: string, value: React.ReactNode) => (
    <div style={{ ...card, flex: '1 1 100px', padding: '10px 12px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.muted }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: BRAND.ink, lineHeight: 1.2, marginTop: 2 }}>{value}</div>
    </div>
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1000, margin: '0 auto' }}>
      <PageHeader icon={Trophy as any} title="Concurso de Bolsas" subtitle={contest ? `${contest.name} · ${CONTEST_STATUS[contest.status]}` : 'Monte a prova, receba as inscrições e divulgue o resultado'}
        actions={contest ? (
          <>
            {contests.length > 0 && <select value={sel ?? ''} onChange={e => setSel(e.target.value)} style={{ ...input, width: 'auto', fontWeight: 700, background: 'rgba(255,255,255,.95)' }}>
              {contests.map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
            </select>}
            <NewContestButton instId={instId} onCreated={async id => { await loadAll(); setSel(id) }} light />
          </>
        ) : undefined} />
      {msg && <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 200, maxWidth: 'min(520px, calc(100vw - 24px))', background: BRAND.ink, color: '#fff', borderRadius: 14, padding: '12px 18px', fontSize: 14.5, fontWeight: 700, boxShadow: '0 14px 40px -12px rgba(0,0,0,.5)' }}>{msg}</div>}

      {!contest ? (
        <NewContest instId={instId} onCreated={async id => { await loadAll(); setSel(id) }} />
      ) : (
        <>
          <StatusBar contest={contest} flash={flash} onChanged={() => { loadAll(); loadContest() }} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {stat('Inscritos', cands.length)}
            {stat('Questões aprovadas', `${approved}/${questions.length}`)}
            {stat('Dias até a prova', days === null ? '—' : days < 0 ? 'Já passou' : days === 0 ? 'Hoje' : days)}
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {STAGES.map((st, i) => {
              const on = st.id === stageOf.id
              return (
                <button key={st.id} onClick={() => setTab(st.tabs[0][0] as Tab)} style={{ flex: '1 1 0', minWidth: 150, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 16, padding: '12px 14px', border: `1.5px solid ${on ? BRAND.primary : BRAND.line}`, background: on ? BRAND.soft : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 22, height: 22, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: on ? BRAND.primary : BRAND.line, color: on ? '#fff' : BRAND.muted }}>{i + 1}</span>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: BRAND.ink }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 4 }}>{stageHint(st.id)}</div>
                </button>
              )
            })}
          </div>
          {stageOf.tabs.length > 1 && (
            <div style={{ display: 'flex', gap: 6, background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: 4, overflowX: 'auto', alignSelf: 'flex-start', maxWidth: '100%' }}>
              {stageOf.tabs.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k as Tab)} style={{ border: 0, borderRadius: 10, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0, background: tab === k ? BRAND.primary : 'transparent', color: tab === k ? '#fff' : BRAND.muted }}>{l}</button>
              ))}
            </div>
          )}
          {(tab === 'config' || tab === 'fmt' || tab === 'pub') && <Config key={contest.id} part={tab} contest={contest} subjects={subjects} quotas={quotas} onChanged={() => { loadAll(); loadContest() }} />}
          {tab === 'config' && <DeleteContest contest={contest} inscritos={cands.length} questoes={questions.length} onDeleted={async () => { setSel(null); await loadAll() }} />}
          {tab === 'painel' && <Painel contest={contest} cands={cands} />}
          {tab === 'insc' && <Candidates contest={contest} cands={cands} onChanged={loadContest} />}
          {tab === 'mail' && <ConcursoEmails key={contest.id} contest={contest} cands={cands} onChanged={() => { loadAll(); loadContest() }} />}
          {tab === 'prova' && <ConcursoProva contest={contest} subjects={subjects} quotas={quotas} questions={questions} cands={cands} onChanged={loadContest} onGoSalas={() => setTab('salas')} />}
          {tab === 'salas' && <ConcursoSalas key={contest.id} contest={contest} cands={cands} onChanged={loadContest} onGoProva={() => setTab('prova')} onGoFormato={() => { setTab('fmt'); setTimeout(() => document.getElementById('instrucoes-capa')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300) }} />}
          {tab === 'corr' && <ConcursoCorrecao contest={contest} subjects={subjects} questions={questions} cands={cands} />}
          {tab === 'res' && <ConcursoResultados key={contest.id} contest={contest} cands={cands} onChanged={() => { loadAll(); loadContest() }} />}
          {tab === 'prof' && <Professors instId={instId} contest={contest} subjects={subjects} teachers={teachers} quotas={quotas} questions={questions} flash={flash} onChanged={() => { loadAll(); loadContest() }} />}
          {tab === 'quest' && <Review contest={contest} subjects={subjects} teachers={teachers} questions={questions} flash={flash} onChanged={loadContest} />}
        </>
      )}
    </div>
  )
}

function NewContest({ instId, onCreated }: { instId: string; onCreated: (id: string) => void }) {
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Crie o primeiro concurso</div>
      <div style={{ fontSize: 13.5, color: BRAND.muted, marginBottom: 12 }}>Depois você cadastra os professores e define quantas questões cada um escreve.</div>
      <NewContestButton instId={instId} onCreated={onCreated} primary />
    </div>
  )
}

function NewContestButton({ instId, onCreated, primary, light }: { instId: string; onCreated: (id: string) => void; primary?: boolean; light?: boolean }) {
  const [busy, setBusy] = useState(false)
  const create = async () => {
    const name = prompt('Nome do concurso', `Concurso de Bolsas ${new Date().getFullYear() + 1}`)
    if (!name) return
    setBusy(true)
    const { data, error } = await db.from('contests').insert({ institution_id: instId, name: name.trim(), year: new Date().getFullYear() + 1, grades: [], alternatives_count: 4, versions_count: 2, has_essay: true }).select('id').single()
    if (!error && data) {
      await db.from('contest_subjects').insert(DEFAULT_SUBJECTS.map((n, i) => ({ institution_id: instId, contest_id: data.id, name: n, position: i })))
      onCreated(data.id)
    } else alert('Não foi possível criar: ' + error?.message)
    setBusy(false)
  }
  return <button onClick={create} disabled={busy} style={light ? { ...btn(), background: 'rgba(255,255,255,.18)', color: '#fff', border: '1px solid rgba(255,255,255,.4)' } : btn(primary)}><Plus size={15} /> Novo concurso</button>
}

// Área perigosa no fim da Configuração: exclui o concurso e tudo que pertence a ele (não dá para desfazer).
export function DeleteContest({ contest, inscritos, questoes, onDeleted }: { contest: Contest; inscritos: number; questoes: number; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setOpen(false); setTyped(''); setErr('') }, [contest.id])
  const ok = typed.trim().toLowerCase() === contest.name.trim().toLowerCase()
  const remove = async () => {
    if (!ok) return
    setBusy(true); setErr('')
    const { error } = await db.from('contests').delete().eq('id', contest.id)
    setBusy(false)
    if (error) setErr('Não foi possível excluir: ' + error.message); else onDeleted()
  }
  return (
    <div style={{ ...card, border: '1.5px solid #FECACA', background: '#FFFBFB' }}>
      <div style={{ fontWeight: 800, color: '#B91C1C' }}>Excluir este concurso</div>
      {!open ? (
        <>
          <div style={{ fontSize: 13.5, color: BRAND.muted, margin: '4px 0 12px' }}>Apaga o concurso e tudo que pertence a ele. Não dá para desfazer.</div>
          <button onClick={() => setOpen(true)} style={{ ...btn(), color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={15} /> Excluir concurso</button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          <div style={{ fontSize: 13.5, color: BRAND.text, lineHeight: 1.5 }}>
            Vai apagar <b>{contest.name}</b> com <b>{inscritos} {inscritos === 1 ? 'inscrição' : 'inscrições'}</b> e <b>{questoes} {questoes === 1 ? 'questão' : 'questões'}</b>, além de salas, provas, notas e redações.
            {inscritos > 0 && <span style={{ color: '#B91C1C', fontWeight: 700 }}> Já existem candidatos inscritos: eles perdem o acesso ao resultado.</span>}
          </div>
          <label style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink }}>Para confirmar, digite o nome do concurso
            <input style={{ ...input, marginTop: 6 }} value={typed} onChange={e => setTyped(e.target.value)} placeholder={contest.name} autoComplete="off" />
          </label>
          {err && <div role="alert" style={{ fontSize: 13, color: '#B91C1C' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={remove} disabled={!ok || busy} style={{ ...btn(), background: ok ? '#DC2626' : '#F1F5F9', color: ok ? '#fff' : BRAND.faint, border: 'none', cursor: ok ? 'pointer' : 'not-allowed' }}>{busy ? 'Excluindo…' : 'Excluir de vez'}</button>
            <button onClick={() => { setOpen(false); setTyped('') }} style={btn()}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

type CfgPart = 'config' | 'fmt' | 'pub'
const PART_INFO: Record<CfgPart, { title: string; sub: string }> = {
  config: { title: 'Passo 1 · Dados básicos', sub: 'Nome, datas, local e séries. É o que aparece para as famílias.' },
  pub: { title: 'Passo 2 · Inscrição e edital', sub: 'Endereço da página, perguntas do formulário e o edital. Pronto este passo, já dá para divulgar o link.' },
  fmt: { title: 'Passo 3 · Formato da prova', sub: 'Disciplinas, alternativas, versões, redação e visual do caderno impresso.' },
}

// Faixa no topo: em que fase está o concurso e o botão certo para a próxima.
function StatusBar({ contest, onChanged, flash }: { contest: Contest; onChanged: () => void; flash: (m: string) => void }) {
  const [busy, setBusy] = useState(false)
  const link = contest.public_slug ? `${window.location.origin}/bolsas/${contest.public_slug}` : ''
  const set = async (status: Contest['status'], ok: string) => {
    setBusy(true)
    const { error } = await db.from('contests').update({ status }).eq('id', contest.id)
    setBusy(false)
    if (error) return flash('Não foi possível mudar: ' + error.message)
    flash(ok); onChanged()
  }
  const abrir = () => {
    const falta: string[] = []
    if (!contest.public_slug) falta.push('endereço da página')
    if (!contest.exam_date) falta.push('data da prova')
    if (!contest.registration_deadline) falta.push('"Inscrições até"')
    if (!contest.location) falta.push('local da prova')
    if (!contest.edital_path && !contest.edital?.trim()) falta.push('edital (PDF)')
    if (!contest.grades.length) falta.push('séries')
    const msg = falta.length ? `Ainda falta preencher: ${falta.join(', ')}.\n\nAbrir as inscrições mesmo assim? A página pública fica disponível na hora.` : 'Abrir as inscrições agora? A página pública fica disponível na hora.'
    if (confirm(msg)) set('open', 'Inscrições abertas. A página já está no ar.')
  }
  const wrap: React.CSSProperties = { ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px' }
  const dot = (c: string) => <span style={{ width: 10, height: 10, borderRadius: 99, background: c, display: 'inline-block', flexShrink: 0 }} />
  const cp = link && <button style={btn()} onClick={() => { navigator.clipboard?.writeText(link); flash('Link copiado.') }}>Copiar link</button>
  if (contest.status === 'draft') return (
    <div style={{ ...wrap, background: '#FFFBEB', borderColor: '#FCD34D' }}>
      {dot('#D97706')}
      <div style={{ flex: '1 1 240px' }}><div style={{ fontWeight: 800, color: BRAND.ink }}>Inscrições ainda não abertas</div><div style={{ fontSize: 13, color: BRAND.muted }}>A página das famílias só aparece depois que você abrir.</div></div>
      <button style={btn(true)} disabled={busy} onClick={abrir}>Abrir inscrições</button>
    </div>
  )
  if (contest.status === 'open') return (
    <div style={{ ...wrap, background: BRAND.soft, borderColor: BRAND.primary }}>
      {dot('#059669')}
      <div style={{ flex: '1 1 240px', minWidth: 0 }}><div style={{ fontWeight: 800, color: BRAND.ink }}>Inscrições abertas{contest.registration_deadline ? ` até ${deadlineLong(contest.registration_deadline)}` : ''}</div>{link && <div style={{ fontSize: 13, color: BRAND.muted, wordBreak: 'break-all' }}>{link}</div>}</div>
      {cp}
      <button style={btn()} disabled={busy} onClick={() => { if (confirm('Encerrar as inscrições agora? A página passa a mostrar que estão encerradas.')) set('closed', 'Inscrições encerradas.') }}>Encerrar inscrições</button>
    </div>
  )
  if (contest.status === 'closed') return (
    <div style={wrap}>
      {dot('#64748B')}
      <div style={{ flex: '1 1 240px' }}><div style={{ fontWeight: 800, color: BRAND.ink }}>Inscrições encerradas</div><div style={{ fontSize: 13, color: BRAND.muted }}>Para aceitar mais inscrições, reabra (confira o "Inscrições até").</div></div>
      <button style={btn()} disabled={busy} onClick={() => { if (confirm('Reabrir as inscrições?')) set('open', 'Inscrições reabertas.') }}>Reabrir inscrições</button>
    </div>
  )
  return (
    <div style={wrap}>{dot('#2563EB')}<div style={{ flex: 1, fontWeight: 800, color: BRAND.ink }}>Resultado divulgado</div></div>
  )
}

function Config({ contest, subjects, quotas, part, onChanged }: { contest: Contest; subjects: Subject[]; quotas: Quota[]; part: CfgPart; onChanged: () => void }) {
  const draftKey = `aion-concurso-rascunho:${contest.id}`
  const readDraft = (): Partial<Contest> | null => { try { const r = localStorage.getItem(draftKey); return r ? JSON.parse(r) : null } catch { return null } }
  const [f, setF] = useState<Contest>(() => { const d = readDraft(); return d ? { ...contest, ...d } : contest })
  const [restored, setRestored] = useState(() => !!readDraft())
  const [newSubj, setNewSubj] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [instName, setInstName] = useState('')
  useEffect(() => { db.from('institutions').select('name').eq('id', contest.institution_id).maybeSingle().then(({ data }: any) => setInstName(data?.name ?? '')) }, [contest.institution_id])
  const slugBase = slugify(instName)
  const prev = useRef(contest)
  const force = useRef(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(contest)

  // Os dados salvos mudaram (ex.: depois de salvar ou adicionar disciplina): só troco a tela se você não tem nada digitado por cima.
  useEffect(() => {
    if (prev.current === contest) return
    const old = prev.current; prev.current = contest
    if (force.current) { force.current = false; setF(contest); return }
    setF(cur => JSON.stringify(cur) === JSON.stringify(old) ? contest : cur)
  }, [contest])
  // Rascunho: o que você digita fica guardado neste navegador até salvar.
  useEffect(() => {
    try { if (dirty) localStorage.setItem(draftKey, JSON.stringify(f)); else localStorage.removeItem(draftKey) } catch { /* sem armazenamento: segue sem rascunho */ }
  }, [f, dirty, draftKey])
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    // o tema e as fotos da redação são do professor: aqui só vale ligar/desligar a série; o resto vem do que está salvo agora
    const { data: fresh } = await db.from('contests').select('essay_by_grade').eq('id', contest.id).maybeSingle()
    const merged: Contest['essay_by_grade'] = {}
    for (const [g, v] of Object.entries(f.essay_by_grade ?? {})) merged[g] = { ...(fresh?.essay_by_grade?.[g] ?? {}), enabled: v.enabled, prompt: fresh?.essay_by_grade?.[g]?.prompt ?? v.prompt ?? '' }
    const { error } = await db.from('contests').update({ name: f.name, year: f.year, exam_date: f.exam_date || null, grades: f.grades, public_slug: (f.public_slug ? slugify(f.public_slug) : slugBase) || null, edital: f.edital || null, location: f.location || null, registration_deadline: f.registration_deadline || null, extra_fields: f.extra_fields ?? [], essay_prompt: f.essay_prompt || null, print_color: f.print_color || null, essay_by_grade: merged, form_config: f.form_config ?? {}, exam_duration: f.exam_duration || null, cover_instructions: f.cover_instructions?.trim() && f.cover_instructions.trim() !== DEFAULT_COVER ? f.cover_instructions : null, alternatives_count: f.alternatives_count, versions_count: f.versions_count, has_essay: f.has_essay, status: f.status }).eq('id', contest.id)
    if (error) { setSaveMsg(/contests_public_slug_uidx|duplicate/i.test(error.message) ? 'Esse endereço já está em uso por outro concurso. Acrescente um complemento (ex.: a cidade ou o ano).' : 'Não foi possível salvar: ' + error.message) } else {
      setSaveMsg('Salvo!'); setRestored(false); force.current = true
      try { localStorage.removeItem(draftKey) } catch { /* ok */ }
      onChanged()
    }
    setTimeout(() => setSaveMsg(''), 5000)
  }
  const lab: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: BRAND.muted, display: 'block', marginBottom: 5 }
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }
  const missing: string[] = []
  if (part === 'config') { if (!f.exam_date) missing.push('data da prova'); if (!f.location) missing.push('local'); if (!f.registration_deadline) missing.push('"Inscrições até"'); if (!f.grades.length) missing.push('séries') }
  if (part === 'fmt') { if (!subjects.length) missing.push('disciplinas') }
  if (part === 'pub') { if (!f.public_slug && !slugBase) missing.push('endereço da página'); if (!f.edital && !contest.edital_path) missing.push('edital (PDF)') }
  const info = PART_INFO[part]

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: BRAND.ink }}>{info.title}</div>
        <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 2 }}>{info.sub}</div>
        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: missing.length ? '#B45309' : '#047857' }}>{missing.length ? `Falta preencher: ${missing.join(', ')}.` : 'Esta parte está completa.'}</div>
      </div>
      {restored && (
        <div role="status" style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '10px 12px', fontSize: 13.5, color: '#92400E', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 240px' }}>Recuperei o que você tinha digitado e não salvou. Confira e clique em Salvar.</span>
          <button style={{ ...btn(), padding: '5px 10px', fontSize: 12.5 }} onClick={() => { setF(contest); setRestored(false); try { localStorage.removeItem(draftKey) } catch { /* ok */ } }}>Descartar</button>
        </div>
      )}

      {part === 'config' && (<>
        <div style={grid}>
          <div><label style={lab}>Nome</label><input style={input} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
          <div><label style={lab}>Ano</label><input type="number" style={input} value={f.year} onChange={e => setF({ ...f, year: Number(e.target.value) })} /></div>
          <div><label style={lab}>Situação</label>
            <select style={input} value={f.status} onChange={e => setF({ ...f, status: e.target.value as Contest['status'] })}>{Object.entries(CONTEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div style={grid}>
          <div><label style={lab}>Data da prova</label><input type="date" style={input} value={examDateToInput(f.exam_date)} onChange={e => setF({ ...f, exam_date: examDateFromInput(e.target.value) })} /></div>
          <div><label style={lab}>Inscrições até (data e hora)</label><input type="datetime-local" style={input} value={deadlineToInput(f.registration_deadline)} onChange={e => setF({ ...f, registration_deadline: deadlineFromInput(e.target.value) })} /></div>
          <div><label style={lab}>Local da prova</label><input style={input} value={f.location ?? ''} onChange={e => setF({ ...f, location: e.target.value })} /></div>
        </div>
        <div>
          <label style={lab}>Séries que participam</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GRADES.map(g => { const on = f.grades.includes(g); return (
              <button key={g} onClick={() => setF({ ...f, grades: on ? f.grades.filter(x => x !== g) : [...f.grades, g] })} style={{ padding: '6px 11px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? BRAND.primary : BRAND.line}`, background: on ? BRAND.soft : '#fff', color: on ? BRAND.primaryDark : BRAND.muted }}>{g}</button>
            ) })}
          </div>
        </div>
      </>)}

      {part === 'fmt' && (<>
        <div style={grid}>
          <div><label style={lab}>Alternativas por questão</label>
            <select style={input} value={f.alternatives_count} onChange={e => setF({ ...f, alternatives_count: Number(e.target.value) as 4 | 5 })}><option value={4}>4 (A a D)</option><option value={5}>5 (A a E)</option></select></div>
          <div><label style={lab}>Versões embaralhadas</label>
            <select style={input} value={f.versions_count} onChange={e => setF({ ...f, versions_count: Number(e.target.value) })}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n === 1 ? '1 (sem embaralhar)' : `${n} versões`}</option>)}</select></div>
          <div><label style={lab}>Duração da prova (impressa no caderno)</label><input style={input} placeholder="Ex.: 3 horas" value={f.exam_duration ?? ''} onChange={e => setF({ ...f, exam_duration: e.target.value })} /></div>
        </div>
        <div>
          <label style={lab}>Disciplinas do concurso (lista geral)</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {subjects.map(s => (
              <span key={s.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '5px 10px', borderRadius: 99, background: '#F1F5F9', fontSize: 13, fontWeight: 600 }}>
                {s.name}
                <button aria-label={`Remover ${s.name}`} onClick={async () => { if (confirm(`Remover ${s.name}? As questões dela também saem.`)) { await db.from('contest_subjects').delete().eq('id', s.id); onChanged() } }} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.muted }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={input} placeholder="Nova disciplina" value={newSubj} onChange={e => setNewSubj(e.target.value)} />
            <button style={btn()} onClick={async () => { if (!newSubj.trim()) return; await db.from('contest_subjects').insert({ institution_id: contest.institution_id, contest_id: contest.id, name: newSubj.trim(), position: subjects.length, grades: f.grades.length ? f.grades : null }); setNewSubj(''); onChanged() }}>Adicionar</button>
          </div>
        </div>
        <div>
          <label style={lab}>Disciplinas por série</label>
          {f.grades.length === 0 && <div style={{ fontSize: 13, color: BRAND.muted }}>Escolha as séries no Passo 1 para definir as disciplinas de cada uma.</div>}
          {subjects.length === 0 && f.grades.length > 0 && <div style={{ fontSize: 13, color: BRAND.muted }}>Adicione as disciplinas acima. Depois marque quais valem para cada série.</div>}
          {GRADES.filter(g => f.grades.includes(g)).map(g => {
            const mine = subjects.filter(s => subjectHasGrade(s, g, f.grades))
            const toggle = async (s: Subject) => {
              const on = subjectHasGrade(s, g, f.grades)
              if (on && quotas.some(x => x.subject_id === s.id && x.grade === g)) { setSaveMsg(`Já existe cota de professor de ${s.name} no ${g}. Remova a cota em "Professores e cotas" antes.`); setTimeout(() => setSaveMsg(''), 6000); return }
              const base = s.grades ?? f.grades
              const next = on ? base.filter(x => x !== g) : [...base, g]
              await db.from('contest_subjects').update({ grades: next }).eq('id', s.id)
              onChanged()
            }
            return (
              <div key={g} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>{g} <span style={{ fontWeight: 600, fontSize: 12.5, color: BRAND.muted }}>· {mine.length} de {subjects.length} disciplinas</span></div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {subjects.map(s => { const on = subjectHasGrade(s, g, f.grades); return (
                    <button key={s.id} onClick={() => toggle(s)} aria-pressed={on} style={{ padding: '6px 11px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? BRAND.primary : BRAND.line}`, background: on ? BRAND.soft : '#fff', color: on ? BRAND.primaryDark : BRAND.muted }}>{s.name}</button>
                  ) })}
                </div>
              </div>
            )
          })}
          {saveMsg.startsWith('Já existe cota') && <div role="status" style={{ fontSize: 13.5, fontWeight: 700, color: '#B91C1C' }}>{saveMsg}</div>}
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}><input type="checkbox" checked={f.has_essay} onChange={e => setF({ ...f, has_essay: e.target.checked })} /> Redação ligada por padrão nas séries (você ajusta série por série abaixo)</label>
        <div>
          <label style={lab}>Redação por série</label>
          {f.grades.length === 0 && <div style={{ fontSize: 13, color: BRAND.muted }}>Escolha as séries no Passo 1 para configurar a redação de cada uma.</div>}
          {GRADES.filter(g => f.grades.includes(g)).map(g => {
            const e = essayFor(f, g)
            const set = (patch: Partial<{ enabled: boolean; prompt: string }>) => setF({ ...f, essay_by_grade: { ...(f.essay_by_grade ?? {}), [g]: { ...(f.essay_by_grade?.[g] ?? {}), enabled: e.enabled, prompt: e.prompt, ...patch } } })
            return (
              <div key={g} style={{ border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: 10, marginBottom: 8 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700, color: BRAND.ink }}><input type="checkbox" checked={e.enabled} onChange={ev => set({ enabled: ev.target.checked })} /> {g}: tem redação</label>
                {e.enabled && <div style={{ fontSize: 12.5, marginTop: 6, color: e.prompt ? '#047857' : '#B45309' }}>{e.prompt ? 'Tema cadastrado pelo professor de redação.' : 'Tema ainda não cadastrado: o professor de redação escreve na área dele.'}</div>}
              </div>
            )
          })}
        </div>
        <EssayRubric contest={contest} onChanged={onChanged} />
        <div style={{ borderTop: `1px solid ${BRAND.line}`, paddingTop: 12 }}><TakeHomeConfig contest={contest} onChanged={onChanged} /></div>
        <div id="instrucoes-capa">
          <label style={lab}>Instruções na capa do caderno ("Leia com atenção")</label>
          <textarea rows={7} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} value={f.cover_instructions?.trim() ? f.cover_instructions : DEFAULT_COVER} onChange={e => setF({ ...f, cover_instructions: e.target.value })} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
            <span style={{ fontSize: 12.5, color: BRAND.muted }}>Uma instrução por linha. Inserir no fim:</span>
            {COVER_TOKENS.map(([t, l]) => <button key={t} style={{ ...btn(), padding: '4px 10px', fontSize: 12.5 }} onClick={() => setF({ ...f, cover_instructions: `${(f.cover_instructions?.trim() ? f.cover_instructions : DEFAULT_COVER).replace(/\s+$/, '')} ${t}` })}>{l}</button>)}
            <button style={{ ...btn(), padding: '4px 10px', fontSize: 12.5 }} onClick={() => setF({ ...f, cover_instructions: null })}>Voltar ao texto padrão</button>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 4 }}>Os trechos entre chaves viram o valor real na impressão. Nas séries com redação, o sistema acrescenta sozinho a instrução da redação. Vale para todos os cadernos, inclusive o lote por sala.</div>
        </div>
        <div>
          <label style={lab}>Cor da prova impressa (faixas e destaques)</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {['#0B6E5F', '#1D4ED8', '#7C3AED', '#B91C1C', '#C2410C', '#1A2B4A', '#000000'].map(c => (
              <button key={c} aria-label={`Cor ${c}`} onClick={() => setF({ ...f, print_color: c })} style={{ width: 30, height: 30, borderRadius: 99, background: c, cursor: 'pointer', border: (f.print_color || '').toLowerCase() === c.toLowerCase() ? `3px solid ${BRAND.ink}` : '2px solid #fff', boxShadow: '0 0 0 1px #CBD5E1' }} />
            ))}
            <input type="color" value={f.print_color || '#0B6E5F'} onChange={e => setF({ ...f, print_color: e.target.value })} aria-label="Outra cor" style={{ width: 38, height: 32, border: 0, background: 'none', cursor: 'pointer' }} />
            <button style={{ ...btn(), padding: '5px 10px', fontSize: 12.5 }} onClick={() => setF({ ...f, print_color: null })}>Usar a cor da escola</button>
          </div>
        </div>
      </>)}

      {part === 'pub' && (<>
        <div><label style={lab}>Endereço da página</label>
          {(() => {
            const cur = f.public_slug || slugBase
            const suffix = slugBase && cur.startsWith(slugBase) ? cur.slice(slugBase.length).replace(/^-/, '') : ''
            const compose = (suf: string) => { const t = slugify(suf); return slugBase ? (t ? `${slugBase}-${t}` : slugBase) : t }
            return (<>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: BRAND.muted, whiteSpace: 'nowrap' }}>/bolsas/</span>
                {slugBase ? <b style={{ fontSize: 14, color: BRAND.ink }}>{slugBase}</b> : <input style={{ ...input, width: 'auto', flex: '1 1 160px' }} placeholder="nome-da-escola" value={f.public_slug ?? ''} onChange={e => setF({ ...f, public_slug: e.target.value })} />}
                {slugBase && <><span style={{ fontSize: 13, color: BRAND.muted }}>-</span><input style={{ ...input, width: 'auto', flex: '1 1 120px', maxWidth: 200 }} placeholder="complemento (opcional)" value={suffix} onChange={e => setF({ ...f, public_slug: compose(e.target.value) })} /></>}
              </div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 4 }}>O começo do endereço é o nome da sua escola e nenhuma outra escola usa o mesmo. Use o complemento só se tiver mais de um concurso (ex.: <b>2028</b>) ou se houver outra escola com o mesmo nome.</div>
            </>)
          })()}
        </div>
        {contest.public_slug && (
          <div style={{ fontSize: 13, color: BRAND.muted }}>Link para divulgar: <b style={{ color: BRAND.ink }}>{window.location.origin}/bolsas/{contest.public_slug}</b> {' '}
            <button style={{ ...btn(), padding: '4px 10px', fontSize: 12.5 }} onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/bolsas/${contest.public_slug}`)}>Copiar</button>
            <div style={{ marginTop: 4 }}>Para aparecer na Vitrine, adicione um botão de matrícula (modo link) com este endereço.</div></div>
        )}
        <EditalUpload contest={contest} lab={lab} onChanged={onChanged} />
        <div>
          <label style={lab}>Perguntas da inscrição (texto e se é obrigatória)</label>
          {FORM_FIELDS.map(d => {
            const c = fieldCfg(f.form_config, d.key)
            const setC = (patch: Record<string, unknown>) => setF({ ...f, form_config: { ...(f.form_config ?? {}), fields: { ...(f.form_config?.fields ?? {}), [d.key]: { ...(f.form_config?.fields?.[d.key] ?? {}), ...patch } } } })
            return (
              <div key={d.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px,3fr) auto auto', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                <input style={{ ...input, opacity: c.enabled ? 1 : .5 }} value={f.form_config?.fields?.[d.key]?.label ?? d.label} onChange={e => setC({ label: e.target.value })} aria-label={`Texto da pergunta: ${d.label}`} />
                <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center', opacity: d.locked ? .5 : 1 }}><input type="checkbox" disabled={d.locked || !c.enabled} checked={c.required} onChange={e => setC({ required: e.target.checked })} />Obrigatória</label>
                <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center', opacity: d.locked ? .5 : 1 }}><input type="checkbox" disabled={d.locked} checked={c.enabled} onChange={e => setC({ enabled: e.target.checked })} />Mostrar</label>
              </div>
            )
          })}
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>Nome do aluno, série, responsável e WhatsApp são sempre obrigatórios (só o texto muda). Perguntas extras ficam logo abaixo.</div>
        </div>
        <div>
          <label style={lab}>Perguntas extras na inscrição</label>
          {(f.extra_fields ?? []).map((x: ExtraField, i: number) => (
            <div key={x.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,2fr) 110px minmax(120px,2fr) auto auto', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input style={input} placeholder="Pergunta" value={x.label} onChange={e => setF({ ...f, extra_fields: f.extra_fields.map((y: ExtraField, j: number) => j === i ? { ...y, label: e.target.value } : y) })} />
              <select style={input} value={x.type} onChange={e => setF({ ...f, extra_fields: f.extra_fields.map((y: ExtraField, j: number) => j === i ? { ...y, type: e.target.value as 'text' | 'select' } : y) })}><option value="text">Texto</option><option value="select">Escolha</option></select>
              <input style={{ ...input, opacity: x.type === 'select' ? 1 : .4 }} disabled={x.type !== 'select'} placeholder="Opções separadas por vírgula" value={(x.options ?? []).join(', ')} onChange={e => setF({ ...f, extra_fields: f.extra_fields.map((y: ExtraField, j: number) => j === i ? { ...y, options: e.target.value.split(',').map(t => t.trim()).filter(Boolean) } : y) })} />
              <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={!!x.required} onChange={e => setF({ ...f, extra_fields: f.extra_fields.map((y: ExtraField, j: number) => j === i ? { ...y, required: e.target.checked } : y) })} />Obrigatória</label>
              <button aria-label="Remover pergunta" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.danger }} onClick={() => setF({ ...f, extra_fields: f.extra_fields.filter((_: ExtraField, j: number) => j !== i) })}><Trash2 size={15} /></button>
            </div>
          ))}
          <button style={btn()} onClick={() => setF({ ...f, extra_fields: [...(f.extra_fields ?? []), { id: 'q' + Date.now().toString(36), label: '', type: 'text', required: false }] })}><Plus size={15} /> Adicionar pergunta</button>
        </div>
      </>)}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', borderTop: `1px solid ${BRAND.line}`, paddingTop: 12 }}>
        <button style={btn(true)} onClick={save}>Salvar</button>
        {saveMsg ? <span role="status" style={{ fontSize: 14, fontWeight: 700, color: saveMsg === 'Salvo!' ? '#047857' : '#B91C1C' }}>{saveMsg}</span>
          : dirty ? <span style={{ fontSize: 13.5, fontWeight: 700, color: '#B45309' }}>Há alterações ainda não salvas (valem os 3 passos).</span> : null}
      </div>
    </div>
  )
}

// Edital em PDF: arrastar ou escolher o arquivo. Fica num bucket público para as famílias abrirem pela página de inscrição.
function EditalUpload({ contest, lab, onChanged }: { contest: Contest; lab: React.CSSProperties; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const path = contest.edital_path
  const url = path ? db.storage.from('contest-edital').getPublicUrl(path).data.publicUrl : ''
  const send = async (file: File | undefined) => {
    setErr('')
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return setErr('Envie o edital em PDF.')
    if (file.size > 20 * 1024 * 1024) return setErr('O PDF passa de 20 MB. Reduza o arquivo e tente de novo.')
    setBusy(true)
    const np = `${contest.institution_id}/${contest.id}/edital-${Date.now()}.pdf`
    const up = await db.storage.from('contest-edital').upload(np, file, { contentType: 'application/pdf' })
    if (up.error) { setBusy(false); return setErr('Não foi possível enviar: ' + up.error.message) }
    const { error } = await db.from('contests').update({ edital_path: np }).eq('id', contest.id)
    if (error) { setBusy(false); return setErr('Não foi possível salvar: ' + error.message) }
    if (path) await db.storage.from('contest-edital').remove([path])
    setBusy(false); onChanged()
  }
  const remove = async () => {
    if (!path || !confirm('Remover o edital? A página de inscrição deixa de mostrar o PDF.')) return
    await db.from('contests').update({ edital_path: null }).eq('id', contest.id)
    await db.storage.from('contest-edital').remove([path])
    onChanged()
  }
  return (
    <div>
      <label style={lab}>Edital (PDF)</label>
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); send(e.dataTransfer.files?.[0]) }}
        style={{ border: `2px dashed ${over ? BRAND.primary : BRAND.line}`, background: over ? BRAND.soft : '#fff', borderRadius: 14, padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {path ? (<>
          <FileText size={26} color={BRAND.primary} />
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ fontWeight: 800, color: BRAND.ink, fontSize: 14 }}>Edital enviado</div>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: BRAND.primaryDark, fontWeight: 700 }}>Abrir o PDF</a>
            <span style={{ fontSize: 12.5, color: BRAND.muted }}> · as famílias baixam pela página de inscrição</span>
          </div>
          <button style={btn()} disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Trocar PDF</button>
          <button style={btn()} disabled={busy} onClick={remove}>Remover</button>
        </>) : (<>
          <FileText size={26} color={BRAND.muted} />
          <div style={{ flex: '1 1 220px' }}>
            <div style={{ fontWeight: 800, color: BRAND.ink, fontSize: 14 }}>Arraste o PDF do edital para cá</div>
            <div style={{ fontSize: 12.5, color: BRAND.muted }}>ou escolha o arquivo. Até 20 MB.</div>
          </div>
          <button style={btn(true)} disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Escolher PDF</button>
        </>)}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={e => { send(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      {err && <div role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginTop: 6 }}>{err}</div>}
      {contest.edital?.trim() && <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 6 }}>Este concurso tem um edital em texto, escrito antes. Ele continua aparecendo na página até você enviar o PDF.</div>}
    </div>
  )
}

function Professors({ instId, contest, subjects, teachers, quotas, questions, flash, onChanged }: {
  instId: string; contest: Contest; subjects: Subject[]; teachers: Teacher[]; quotas: Quota[]; questions: Question[]; flash: (m: string) => void; onChanged: () => void
}) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' })
  const [busy, setBusy] = useState(false)
  const [q, setQ] = useState({ teacher_id: '', subject_id: '', grade: '', quantity: 10, due_date: '' })
  const [essayT, setEssayT] = useState<string[]>([])
  const [openQ, setOpenQ] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [alsoQ, setAlsoQ] = useState(false)
  const [working, setWorking] = useState(false)
  const [showForm, setShowForm] = useState<'prof' | 'quota' | null>(null)
  const [tf, setTf] = useState<'all' | 'falta' | 'termo' | 'atraso' | 'redacao'>('all')
  const [openT, setOpenT] = useState<string | null>(null)
  const delQuestions = async (qs: Question[], what: string) => {
    if (!qs.length || !confirm(`Apagar ${what}? Não dá para desfazer.`)) return
    setWorking(true)
    const e = await removeQuestions(contest.id, qs)
    setWorking(false)
    flash(e ? e : qs.length === 1 ? 'Questão apagada.' : `${qs.length} questões apagadas.`)
    if (!e) onChanged()
  }
  const delTeacher = async (t: Teacher) => {
    setWorking(true)
    const { data, error } = await supabase.functions.invoke('contest-teacher-remove', { body: { institution_id: instId, teacher_id: t.id, delete_questions: alsoQ } })
    setWorking(false)
    if (error || data?.error) return flash(await fnMessage(error, data, 'Não foi possível apagar o professor.'))
    flash(`Professor apagado${data?.questions_deleted ? ` e ${data.questions_deleted} questões apagadas` : ''}.${data?.account_deleted === false ? ' O login dele foi mantido.' : ''}`)
    setRemoving(null); setAlsoQ(false); onChanged()
  }
  useEffect(() => { db.from('contest_essay_teachers').select('teacher_id').eq('contest_id', contest.id).then(({ data }: any) => setEssayT((data ?? []).map((x: any) => x.teacher_id))) }, [contest.id])
  const toggleEssay = async (t: Teacher, on: boolean) => {
    const { error } = on
      ? await db.from('contest_essay_teachers').insert({ institution_id: instId, contest_id: contest.id, teacher_id: t.id })
      : await db.from('contest_essay_teachers').delete().eq('contest_id', contest.id).eq('teacher_id', t.id)
    if (error) return flash('Não foi possível salvar: ' + error.message)
    setEssayT(on ? [...essayT, t.id] : essayT.filter(x => x !== t.id))
  }

  const invite = async () => {
    if (!form.full_name.trim() || !form.email.trim()) return flash('Informe nome e e-mail do professor.')
    setBusy(true)
    const { data, error } = await supabase.functions.invoke('contest-teacher-invite', { body: { institution_id: instId, ...form } })
    if (error || data?.error) { flash(await fnMessage(error, data, 'Não foi possível cadastrar.')); setBusy(false); return }
    await supabase.auth.resetPasswordForEmail(form.email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reset-password` })
    flash('Professor cadastrado. Enviamos um e-mail para ele criar a senha.')
    setForm({ full_name: '', email: '', phone: '' }); setBusy(false); onChanged()
  }
  const resend = async (t: Teacher) => {
    await supabase.auth.resetPasswordForEmail(t.email, { redirectTo: `${window.location.origin}/reset-password` })
    flash(`E-mail de criar senha reenviado para ${t.email}.`)
  }
  const addQuota = async () => {
    if (!q.teacher_id || !q.subject_id || !q.grade || q.quantity < 1) return flash('Escolha professor, série, disciplina e quantidade.')
    const { error } = await db.from('contest_quotas').insert({ institution_id: instId, contest_id: contest.id, teacher_id: q.teacher_id, subject_id: q.subject_id, grade: q.grade, quantity: q.quantity, due_date: q.due_date || null })
    if (error) return flash('Não foi possível salvar: ' + error.message)
    onChanged()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn(showForm === 'prof')} onClick={() => setShowForm(showForm === 'prof' ? null : 'prof')}><Plus size={15} /> Cadastrar professor</button>
        <button style={btn(showForm === 'quota')} onClick={() => setShowForm(showForm === 'quota' ? null : 'quota')}><Plus size={15} /> Nova cota</button>
      </div>
      {showForm === 'prof' && (
      <div style={card}>
        <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Cadastrar professor</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
          <input style={input} placeholder="Nome completo" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <input style={input} placeholder="E-mail" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={input} placeholder="WhatsApp (opcional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '8px 0 10px' }}>O professor recebe um e-mail para criar a própria senha. Ele só vê as questões dele.</div>
        <button style={btn(true)} onClick={invite} disabled={busy}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Cadastrar e enviar convite</button>
      </div>
      )}

      <div style={card}>
        {showForm === 'quota' && (<div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${BRAND.line}` }}>
        <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Nova cota de questões</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <select style={input} value={q.teacher_id} onChange={e => setQ({ ...q, teacher_id: e.target.value })}><option value="">Professor</option>{teachers.filter(t => t.active).map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
          <select style={input} value={q.grade} onChange={e => { const g = e.target.value; const ok = subjects.find(s => s.id === q.subject_id && subjectHasGrade(s, g, contest.grades)); setQ({ ...q, grade: g, subject_id: ok ? q.subject_id : '' }) }}><option value="">Série</option>{(contest.grades.length ? contest.grades : GRADES).map(g => <option key={g}>{g}</option>)}</select>
          <select style={input} value={q.subject_id} disabled={!q.grade} onChange={e => setQ({ ...q, subject_id: e.target.value })}><option value="">{q.grade ? 'Disciplina' : 'Escolha a série primeiro'}</option>{subjects.filter(s => !q.grade || subjectHasGrade(s, q.grade, contest.grades)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input style={input} type="number" min={1} value={q.quantity} onChange={e => setQ({ ...q, quantity: Number(e.target.value) })} aria-label="Quantidade" />
          <input style={input} type="date" value={q.due_date} onChange={e => setQ({ ...q, due_date: e.target.value })} aria-label="Entregar até" />
        </div>
        <div style={{ marginTop: 10 }}><button style={btn(true)} onClick={addQuota}><Plus size={15} /> Adicionar cota</button></div></div>)}

        {quotas.length > 0 && (
          <div style={{ marginTop: 14, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '10px 12px', background: '#F8FAFC' }}>
            <div style={{ fontWeight: 800, color: BRAND.ink, fontSize: 13.5, marginBottom: 6 }}>Total por disciplina e série</div>
            {Array.from(new Set(quotas.map(x => `${x.subject_id}|${x.grade}`))).map(key => {
              const [sid, g] = key.split('|'); const qs = quotas.filter(x => x.subject_id === sid && x.grade === g)
              return <div key={key} style={{ fontSize: 13.5, color: BRAND.text, padding: '2px 0' }}><b>{subjects.find(x => x.id === sid)?.name} · {g}:</b> {qs.reduce((n, x) => n + x.quantity, 0)} questões = {qs.map(x => `${teachers.find(t => t.id === x.teacher_id)?.full_name?.split(' ')[0] ?? '?'} ${x.quantity}`).join(' + ')}</div>
            })}
            <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>Cada professor vê e edita só as questões que ele mesmo escreveu.</div>
          </div>
        )}

        {(() => {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const info = (t: Teacher) => {
            const mine = quotas.filter(x => x.teacher_id === t.id)
            const need = mine.reduce((n, x) => n + x.quantity, 0)
            const sentN = mine.reduce((n, x) => n + Math.min(x.quantity, questions.filter(y => y.quota_id === x.id && y.status !== 'draft').length), 0)
            const tq = questions.filter(y => y.author_teacher_id === t.id)
            const late = mine.some(x => x.due_date && new Date(x.due_date + 'T23:59:59') < new Date() && questions.filter(y => y.quota_id === x.id && y.status !== 'draft').length < x.quantity)
            return { mine, need, sentN, late, appr: tq.filter(y => y.status === 'approved').length, ret: tq.filter(y => y.status === 'returned').length, rev: tq.filter(y => y.status === 'sent').length, tq }
          }
          const all = teachers.map(t => ({ t, i: info(t) }))
          const missing = all.filter(x => x.i.need > x.i.sentN)
          const filters: [typeof tf, string, number][] = [
            ['all', 'Todos', all.length],
            ['falta', 'Faltam questões', missing.length],
            ['atraso', 'Prazo vencido', all.filter(x => x.i.late).length],
            ['termo', 'Sem termo aceito', all.filter(x => !x.t.nda_accepted_at).length],
            ['redacao', 'Redação', all.filter(x => essayT.includes(x.t.id)).length],
          ]
          const shown = all.filter(x => tf === 'all' || (tf === 'falta' && x.i.need > x.i.sentN) || (tf === 'atraso' && x.i.late) || (tf === 'termo' && !x.t.nda_accepted_at) || (tf === 'redacao' && essayT.includes(x.t.id)))
            .sort((a, b) => Number(b.i.late) - Number(a.i.late) || (b.i.need - b.i.sentN) - (a.i.need - a.i.sentN))
          const totNeed = all.reduce((n, x) => n + x.i.need, 0), totSent = all.reduce((n, x) => n + x.i.sentN, 0)
          return (
            <>
              <div style={{ fontWeight: 800, color: BRAND.ink, marginBottom: 4 }}>Andamento dos professores</div>
              <div style={{ fontSize: 13.5, color: BRAND.text, marginBottom: 10 }}><b>{totSent}</b> de <b>{totNeed}</b> questões entregues · faltam <b>{Math.max(0, totNeed - totSent)}</b> · {missing.length} professor(es) com entrega pendente</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {filters.map(([k, l, n]) => (
                  <button key={k} onClick={() => setTf(k)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${tf === k ? BRAND.primary : BRAND.line}`, background: tf === k ? BRAND.soft : '#fff', color: tf === k ? BRAND.primaryDark : BRAND.text }}>{l} ({n})</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {shown.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted, padding: '8px 0' }}>Nenhum professor neste filtro.</div>}
                {shown.map(({ t, i }) => {
                  const mine = i.mine
                  const pct = i.need ? Math.round(i.sentN / i.need * 100) : 0
                  const open = openT === t.id
                  return (
              <div key={t.id} style={{ padding: '10px 0', borderTop: `1px solid ${BRAND.line}` }}>
                <div onClick={() => setOpenT(open ? null : t.id)} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <b style={{ color: BRAND.ink }}>{t.full_name}</b>
                    <div style={{ color: BRAND.muted, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.email}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: t.nda_accepted_at ? '#D1FAE5' : '#FEF3C7', color: t.nda_accepted_at ? '#047857' : '#B45309', whiteSpace: 'nowrap' }}>{t.nda_accepted_at ? 'Termo aceito' : 'Termo pendente'}</span>
                  <div style={{ flex: '1 1 170px', minWidth: 150 }}>
                    <div style={{ fontSize: 12.5, color: BRAND.text, fontWeight: 700 }}>{i.need ? `${i.sentN}/${i.need} entregues` : 'Sem cota'}{i.late && <span style={{ color: '#DC2626', marginLeft: 6 }}>prazo vencido</span>}</div>
                    <div style={{ height: 6, borderRadius: 99, background: BRAND.line, marginTop: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: i.late ? '#DC2626' : BRAND.primary }} /></div>
                  </div>
                  <div style={{ fontSize: 12.5, color: BRAND.muted, whiteSpace: 'nowrap' }}>{i.appr} aprov. · {i.rev} p/ revisar{i.ret ? ` · ${i.ret} devolv.` : ''}</div>
                  <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={e => { e.stopPropagation(); setOpenT(open ? null : t.id) }}>{open ? 'Fechar' : 'Detalhes'}</button>
                </div>
                {open && (<div style={{ marginTop: 10, paddingLeft: 10, borderLeft: `3px solid ${BRAND.line}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700, color: BRAND.ink }}><input type="checkbox" checked={essayT.includes(t.id)} onChange={e => toggleEssay(t, e.target.checked)} /> Professor de redação</label>
                  <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={() => resend(t)}><Mail size={14} /> Reenviar convite</button>
                  <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={() => setOpenQ(openQ === t.id ? null : t.id)}>Questões ({i.tq.length})</button>
                  <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5, color: '#DC2626', border: '1px solid #FECACA' }} onClick={() => { setRemoving(removing === t.id ? null : t.id); setAlsoQ(false) }}><Trash2 size={14} /> Apagar professor</button>
                  {t.nda_accepted_at && <span style={{ fontSize: 12, color: BRAND.muted }}>Termo aceito em {fmtDate(t.nda_accepted_at)}</span>}
                </div>
                {removing === t.id && (() => {
                  const tq = questions.filter(y => y.author_teacher_id === t.id)
                  return (
                    <div role="alertdialog" style={{ marginTop: 8, border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: 12, padding: 12 }}>
                      <div style={{ fontWeight: 800, color: '#B91C1C', fontSize: 14 }}>Apagar {t.full_name}?</div>
                      <div style={{ fontSize: 13, color: BRAND.text, margin: '4px 0 8px' }}>O cadastro, as cotas e o acesso dele são removidos. Isso não dá para desfazer.</div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: BRAND.ink, fontWeight: 700 }}>
                        <input type="checkbox" checked={alsoQ} onChange={e => setAlsoQ(e.target.checked)} style={{ marginTop: 3 }} />
                        <span>Apagar também as {tq.length} questões que ele escreveu{tq.some(y => y.status === 'approved') ? ` (${tq.filter(y => y.status === 'approved').length} já aprovadas)` : ''}. Se eu não marcar, elas ficam na prova sem autor.</span>
                      </label>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button style={{ ...btn(), background: '#DC2626', color: '#fff', border: 'none' }} disabled={working} onClick={() => delTeacher(t)}>{working ? 'Apagando…' : 'Apagar professor'}</button>
                        <button style={btn()} disabled={working} onClick={() => setRemoving(null)}>Cancelar</button>
                      </div>
                    </div>
                  )
                })()}
                {openQ === t.id && (() => {
                  const tq = questions.filter(y => y.author_teacher_id === t.id)
                  return (
                    <div style={{ marginTop: 8, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '4px 12px', background: '#F8FAFC' }}>
                      {tq.length === 0 && <div style={{ fontSize: 13, color: BRAND.faint, padding: '8px 0' }}>Este professor ainda não escreveu questões neste concurso.</div>}
                      {tq.map((y, i) => {
                        const st = Q_STATUS[y.status]
                        return (
                          <div key={y.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${BRAND.line}` : 0 }}>
                            <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: BRAND.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              <b>{subjects.find(s => s.id === y.subject_id)?.name} · {y.grade}:</b> {y.statement || 'Sem enunciado'}
                            </div>
                            <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{st.label}</span>
                            <button aria-label="Apagar questão" disabled={working} style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.danger }} onClick={() => delQuestions([y], 'esta questão')}><Trash2 size={15} /></button>
                          </div>
                        )
                      })}
                      {tq.length > 1 && <div style={{ padding: '8px 0', borderTop: `1px solid ${BRAND.line}` }}><button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5, color: '#DC2626', border: '1px solid #FECACA' }} disabled={working} onClick={() => delQuestions(tq, `as ${tq.length} questões de ${t.full_name}`)}><Trash2 size={14} /> Apagar todas as questões dele</button></div>}
                    </div>
                  )
                })()}
                {mine.length === 0 && <div style={{ fontSize: 12.5, color: BRAND.faint }}>Sem cotas neste concurso.</div>}
                {mine.map(x => {
                  const sent = questions.filter(y => y.quota_id === x.id && y.status !== 'draft').length
                  return (
                    <div key={x.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, marginTop: 6, color: BRAND.text }}>
                      <span style={{ flex: 1 }}>{subjects.find(s => s.id === x.subject_id)?.name} · {x.grade} · <b>{sent}/{x.quantity}</b>{x.due_date ? ` · até ${fmtDate(x.due_date)}` : ''}</span>
                      <button aria-label="Remover cota" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: BRAND.danger }} onClick={async () => { if (confirm('Remover esta cota?')) { await db.from('contest_quotas').delete().eq('id', x.id); onChanged() } }}><Trash2 size={15} /></button>
                    </div>
                  )
                })}
                </div>)}
              </div>
                  )
                })}
                {teachers.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted }}>Nenhum professor cadastrado ainda.</div>}
              </div>
            </>
          )
        })()}
      </div>
    </div>
  )
}

const SEGMENTS: [string, string, (g: string) => boolean][] = [
  ['inf', 'Infantil', g => g.startsWith('Infantil')],
  ['f1', 'Fund. I', g => /^[1-5]º ano$/.test(g)],
  ['f2', 'Fund. II', g => /^[6-9]º ano$/.test(g)],
  ['em', 'Médio', g => g.includes('EM')],
]

function Review({ contest, subjects, teachers, questions, flash, onChanged }: { contest: Contest; subjects: Subject[]; teachers: Teacher[]; questions: Question[]; flash: (m: string) => void; onChanged: () => void }) {
  const [filter, setFilter] = useState<'sent' | 'returned' | 'approved' | 'draft' | 'all'>('sent')
  const [seg, setSeg] = useState('')
  const [grade, setGrade] = useState('')
  const [subj, setSubj] = useState('')
  const [teacher, setTeacher] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const segFn = SEGMENTS.find(x => x[0] === seg)?.[2]
  const base = questions.filter(x => (!segFn || segFn(x.grade)) && (!grade || x.grade === grade) && (!subj || x.subject_id === subj) && (!teacher || x.author_teacher_id === teacher))
  const list = base.filter(x => filter === 'all' || x.status === filter)
  const active = [seg, grade, subj, teacher].filter(Boolean).length
  const grades = GRADES.filter(g => (contest.grades.length === 0 || contest.grades.includes(g)) && (!segFn || segFn(g)))
  const sel: React.CSSProperties = { ...input, width: 'auto', minWidth: 130, padding: '7px 10px', fontSize: 13 }
  const del = async (x: Question) => {
    if (!confirm(x.status === 'approved' ? 'Esta questão já está aprovada. Apagar mesmo assim? Não dá para desfazer.' : 'Apagar esta questão? Não dá para desfazer.')) return
    const e = await removeQuestions(contest.id, [x])
    flash(e ?? 'Questão apagada.')
    if (!e) onChanged()
  }
  const act = async (x: Question, status: 'approved' | 'returned') => {
    let note: string | null = null
    if (status === 'returned') { note = prompt('O que o professor precisa ajustar?'); if (!note) return }
    await db.from('contest_questions').update({ status, review_note: note, updated_at: new Date().toISOString() }).eq('id', x.id)
    onChanged()
  }
  const toApprove = list.filter(x => x.status === 'sent')
  const approveAll = async () => {
    if (!toApprove.length || !confirm(`Aprovar ${toApprove.length} questão(ões) que estão na lista agora${active ? ' (com os filtros aplicados)' : ''}? Confira antes: elas passam a valer para a prova.`)) return
    setBusy(true)
    const { error } = await db.from('contest_questions').update({ status: 'approved', review_note: null, updated_at: new Date().toISOString() }).in('id', toApprove.map(x => x.id))
    setBusy(false)
    flash(error ? 'Não foi possível aprovar: ' + error.message : `${toApprove.length} questões aprovadas.`)
    onChanged()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select style={sel} value={seg} onChange={e => { setSeg(e.target.value); setGrade('') }} aria-label="Segmento"><option value="">Todos os segmentos</option>{SEGMENTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select style={sel} value={grade} onChange={e => setGrade(e.target.value)} aria-label="Série"><option value="">Todas as séries</option>{grades.map(g => <option key={g} value={g}>{g}</option>)}</select>
          <select style={sel} value={subj} onChange={e => setSubj(e.target.value)} aria-label="Disciplina"><option value="">Todas as disciplinas</option>{Array.from(new Map(subjects.map(s => [s.name, s])).values()).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select style={sel} value={teacher} onChange={e => setTeacher(e.target.value)} aria-label="Professor"><option value="">Todos os professores</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select>
          {active > 0 && <button style={{ ...btn(), padding: '7px 10px', fontSize: 12.5 }} onClick={() => { setSeg(''); setGrade(''); setSubj(''); setTeacher('') }}>Limpar filtros ({active})</button>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {([['sent', 'Para revisar'], ['returned', 'Devolvidas'], ['approved', 'Aprovadas'], ['draft', 'Rascunhos'], ['all', 'Todas']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 12px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${filter === k ? BRAND.primary : BRAND.line}`, background: filter === k ? BRAND.soft : '#fff', color: filter === k ? BRAND.primaryDark : BRAND.text }}>
              {l} ({base.filter(x => k === 'all' || x.status === k).length})
            </button>
          ))}
          {toApprove.length > 0 && <button style={{ ...btn(true), padding: '6px 12px', fontSize: 13, marginLeft: 'auto' }} disabled={busy} onClick={approveAll}><Check size={15} /> Aprovar as {toApprove.length} da lista</button>}
        </div>
      </div>
      {list.length === 0 && <div style={card}>Nenhuma questão nesta lista.</div>}
      {list.map(x => {
        const st = Q_STATUS[x.status]
        const isOpen = open === x.id
        return (
          <div key={x.id} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div onClick={() => setOpen(isOpen ? null : x.id)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: BRAND.muted }}>{subjects.find(s => s.id === x.subject_id)?.name} · {x.grade} · {teachers.find(t => t.id === x.author_teacher_id)?.full_name ?? '—'}</div>
                <div style={{ fontSize: 14, color: BRAND.ink, marginTop: 2, ...(isOpen ? { whiteSpace: 'pre-wrap' } : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }) }}>{x.statement || 'Sem enunciado'}</div>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: st.bg, color: st.fg }}>{st.label}</span>
              {x.status === 'sent' && <button style={{ ...btn(true), padding: '6px 10px', fontSize: 12.5 }} onClick={e => { e.stopPropagation(); act(x, 'approved') }}><Check size={14} /> Aprovar</button>}
              {x.status === 'sent' && <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={e => { e.stopPropagation(); act(x, 'returned') }}><Undo2 size={14} /> Devolver</button>}
              <button style={{ ...btn(), padding: '6px 10px', fontSize: 12.5 }} onClick={e => { e.stopPropagation(); setOpen(isOpen ? null : x.id) }}>{isOpen ? 'Fechar' : 'Ver'}</button>
            </div>
            {isOpen && (
              <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${BRAND.line}` }}>
                {x.statement_images.map(p => <div key={p} style={{ marginTop: 8 }}><ContestImg path={p} /></div>)}
                <ol type="A" style={{ margin: '10px 0 0', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {x.alternatives.slice(0, contest.alternatives_count).map((a, i) => (
                    <li key={i} style={{ fontSize: 14, padding: '5px 9px', borderRadius: 8, background: x.correct_index === i ? '#D1FAE5' : 'transparent', color: BRAND.text }}>
                      <b>{LETTERS[i]})</b> {a.text} {a.image && <ContestImg path={a.image} style={{ maxHeight: 80, display: 'block', marginTop: 4 }} />}
                    </li>
                  ))}
                </ol>
                {x.comment && <div style={{ marginTop: 8, fontSize: 12.5, color: BRAND.muted }}><b>Comentário do professor:</b> {x.comment}</div>}
                {x.review_note && x.status === 'returned' && <div style={{ marginTop: 6, fontSize: 12.5, color: '#92400E' }}><b>Pedido de ajuste:</b> {x.review_note}</div>}
                <div style={{ display: 'flex', marginTop: 12 }}>
                  <button style={{ ...btn(), color: '#DC2626', border: '1px solid #FECACA', marginLeft: 'auto' }} onClick={() => del(x)}><Trash2 size={15} /> Apagar questão</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Candidates({ contest, cands, onChanged }: { contest: Contest; cands: Candidate[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Candidate | null>(null)
  const [grade, setGrade] = useState('')
  const [q, setQ] = useState('')
  const list = cands.filter(c => (!grade || c.grade === grade) && (!q || (c.student_name + c.responsible_name + c.number).toLowerCase().includes(q.toLowerCase())))
  const exportCsv = () => {
    const rows = [['Inscrição', 'Aluno', 'Série', 'Responsável', 'WhatsApp', 'E-mail', 'Escola de origem'], ...list.map(c => [c.number, c.student_name, c.grade, c.responsible_name, c.phone, c.email ?? '', c.origin_school ?? ''])]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = `inscritos-${contest.public_slug || 'concurso'}.csv`; a.click()
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
        <div style={card}><div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>Inscritos</div><div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink }}>{cands.length}</div></div>
        {(contest.grades.length ? contest.grades : GRADES).filter(g => cands.some(c => c.grade === g)).map(g => (
          <div key={g} style={card}><div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>{g}</div><div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink }}>{cands.filter(c => c.grade === g).length}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: 160 }} placeholder="Buscar por nome ou número" value={q} onChange={e => setQ(e.target.value)} />
        <select style={{ ...input, width: 'auto' }} value={grade} onChange={e => setGrade(e.target.value)}><option value="">Todas as séries</option>{(contest.grades.length ? contest.grades : GRADES).map(g => <option key={g}>{g}</option>)}</select>
        <button style={btn()} onClick={exportCsv}>Exportar</button>
      </div>
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        {list.length === 0 && <div style={{ padding: 16, fontSize: 14, color: BRAND.muted }}>Nenhum inscrito ainda.</div>}
        {list.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', gap: 12, padding: '11px 14px', alignItems: 'center', borderTop: i ? `1px solid ${BRAND.line}` : 0 }}>
            <div style={{ width: 52, fontWeight: 800, color: BRAND.primaryDark }}>{c.number}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: BRAND.ink, fontSize: 14.5 }}>{c.student_name}</div><div style={{ fontSize: 12.5, color: BRAND.muted }}>{c.grade} · {c.responsible_name} · {c.phone}</div></div>
            <button style={btn()} onClick={() => setEditing(c)}>Editar</button>
          </div>
        ))}
      </div>
      {editing && <EditInscricao contest={contest} cand={editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
    </div>
  )
}
