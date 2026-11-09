// Concurso de Bolsas — edição de inscrição e painel de métricas.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { BRAND } from '../../lib/brand'
import { db, GRADES, type Candidate, type Contest } from '../../lib/concurso'

const input: React.CSSProperties = { border: `1px solid ${BRAND.line}`, borderRadius: 10, padding: '9px 11px', fontSize: 14, fontFamily: 'inherit', color: BRAND.ink, background: '#fff', boxSizing: 'border-box', width: '100%' }
const lab: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: BRAND.muted, marginBottom: 4, display: 'block' }
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 16 }
const btn = (primary = false): React.CSSProperties => ({
  display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'center', padding: '9px 14px', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13.5,
  border: primary ? 0 : `1px solid ${BRAND.line}`, background: primary ? `linear-gradient(135deg, ${BRAND.primary}, ${BRAND.primaryDark})` : '#fff', color: primary ? '#fff' : BRAND.ink,
})

export function EditInscricao({ contest, cand, onClose, onSaved }: { contest: Contest; cand: Candidate; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    student_name: cand.student_name, grade: cand.grade, responsible_name: cand.responsible_name, phone: cand.phone,
    email: cand.email ?? '', origin_school: cand.origin_school ?? '', birth_date: cand.birth_date ?? '', student_cpf: cand.student_cpf ?? '',
  })
  const [answers, setAnswers] = useState<Record<string, string>>(cand.answers ?? {})
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))
  const gradeChanged = f.grade !== cand.grade
  const grades = Array.from(new Set([...(contest.grades.length ? contest.grades : GRADES), cand.grade]))

  const save = async () => {
    if (!f.student_name.trim() || !f.responsible_name.trim() || !f.phone.trim()) { setErr('Preencha nome do aluno, responsável e WhatsApp.'); return }
    setBusy(true); setErr('')
    const { error } = await db.from('contest_candidates').update({
      student_name: f.student_name.trim(), grade: f.grade, responsible_name: f.responsible_name.trim(), phone: f.phone.trim(),
      email: f.email.trim() || null, origin_school: f.origin_school.trim() || null, birth_date: f.birth_date || null,
      student_cpf: f.student_cpf.replace(/\D/g, '') || null, answers,
    }).eq('id', cand.id)
    if (error) { setBusy(false); setErr('Não foi possível salvar: ' + error.message); return }
    if (cand.lead_id) {
      await db.from('leads').update({
        student_name: f.student_name.trim(), responsible_name: f.responsible_name.trim(), phone: f.phone.trim(),
        email: f.email.trim() || null, grade_interest: f.grade, origin_school: f.origin_school.trim() || null,
      }).eq('id', cand.lead_id)
    }
    setBusy(false); onSaved(); onClose()
  }
  const remove = async () => {
    setBusy(true)
    const { error } = await db.from('contest_candidates').delete().eq('id', cand.id)
    setBusy(false)
    if (error) { setErr('Não foi possível excluir: ' + error.message); return }
    onSaved(); onClose()
  }
  const field = (label: string, k: keyof typeof f, type = 'text') => (
    <div><label style={lab}>{label}</label><input style={input} type={type} value={f[k]} onChange={e => set(k, e.target.value)} /></div>
  )
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }} onClick={onClose}>
      <div style={{ ...card, width: 'min(560px,100%)', maxHeight: '92vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, fontWeight: 800, fontSize: 17, color: BRAND.ink }}>Editar inscrição nº {cand.number}</div>
          <button aria-label="Fechar" onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        {field('Nome do aluno', 'student_name')}
        <div><label style={lab}>Série</label><select style={input} value={f.grade} onChange={e => set('grade', e.target.value)}>{grades.map(g => <option key={g}>{g}</option>)}</select></div>
        {gradeChanged && contest.status !== 'draft' && contest.status !== 'open' && (
          <div style={{ background: '#FEF3C7', color: '#92400E', borderRadius: 10, padding: 10, fontSize: 13 }}>Atenção: o concurso já foi encerrado. Trocar a série muda o caderno e o gabarito deste aluno; confira a correção depois.</div>
        )}
        {field('Responsável', 'responsible_name')}
        {field('WhatsApp', 'phone')}
        {field('E-mail', 'email', 'email')}
        {field('Escola de origem', 'origin_school')}
        {field('Data de nascimento', 'birth_date', 'date')}
        {field('CPF do aluno', 'student_cpf')}
        {contest.extra_fields.map(x => (
          <div key={x.id}><label style={lab}>{x.label}</label>
            {x.type === 'select'
              ? <select style={input} value={answers[x.id] ?? ''} onChange={e => setAnswers({ ...answers, [x.id]: e.target.value })}><option value="">—</option>{(x.options ?? []).map(o => <option key={o}>{o}</option>)}</select>
              : <input style={input} value={answers[x.id] ?? ''} onChange={e => setAnswers({ ...answers, [x.id]: e.target.value })} />}
          </div>
        ))}
        <div style={{ fontSize: 12.5, color: BRAND.muted }}>As alterações também são aplicadas ao cadastro do lead no CRM.</div>
        {err && <div role="alert" style={{ color: '#B91C1C', fontSize: 13.5 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btn(true)} disabled={busy} onClick={save}>{busy ? <Loader2 size={15} className="spin" /> : null} Salvar alterações</button>
          <button style={btn()} onClick={onClose}>Cancelar</button>
          <span style={{ flex: 1 }} />
          {!confirmDel
            ? <button style={{ ...btn(), color: '#B91C1C' }} onClick={() => setConfirmDel(true)}>Excluir inscrição</button>
            : <button style={{ ...btn(), background: '#B91C1C', color: '#fff', border: 0 }} disabled={busy} onClick={remove}>Confirmar exclusão</button>}
        </div>
      </div>
    </div>
  )
}

function Bars({ rows, color = BRAND.primary }: { rows: [string, number][]; color?: string }) {
  const max = Math.max(1, ...rows.map(r => r[1]))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.length === 0 && <div style={{ fontSize: 13.5, color: BRAND.muted }}>Sem dados ainda.</div>}
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: 'minmax(80px,140px) 1fr 36px', gap: 8, alignItems: 'center', fontSize: 13.5 }}>
          <span style={{ color: BRAND.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
          <div style={{ background: '#F1F5F9', borderRadius: 6, height: 12 }}><div style={{ width: `${(v / max) * 100}%`, height: 12, borderRadius: 6, background: color }} /></div>
          <b style={{ color: BRAND.ink, textAlign: 'right' }}>{v}</b>
        </div>
      ))}
    </div>
  )
}

export function Painel({ contest, cands }: { contest: Contest; cands: Candidate[] }) {
  const [leadStatus, setLeadStatus] = useState<Record<string, number>>({})
  useEffect(() => {
    const ids = cands.map(c => c.lead_id).filter(Boolean) as string[]
    if (!ids.length) { setLeadStatus({}); return }
    db.from('leads').select('id,status').in('id', ids).then(({ data }: any) => {
      const m: Record<string, number> = {}
      ;(data ?? []).forEach((l: any) => { m[l.status] = (m[l.status] ?? 0) + 1 })
      setLeadStatus(m)
    })
  }, [cands])

  const byDay = useMemo(() => {
    const m: Record<string, number> = {}
    cands.forEach(c => { const d = c.created_at.slice(0, 10); m[d] = (m[d] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]))
  }, [cands])
  const byGrade = useMemo(() => (contest.grades.length ? contest.grades : GRADES).map(g => [g, cands.filter(c => c.grade === g).length] as [string, number]).filter(r => r[1] > 0), [cands, contest.grades])
  const byOrigin = useMemo(() => {
    const m: Record<string, number> = {}
    cands.forEach(c => { const o = (c.origin_school || 'Não informada').trim(); m[o] = (m[o] ?? 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [cands])
  const last7 = byDay.slice(-7).reduce((s, r) => s + r[1], 0)
  const withEmail = cands.filter(c => c.email).length
  const selects = contest.extra_fields.filter(x => x.type === 'select')
  const fmt = (d: string) => d.split('-').reverse().slice(0, 2).join('/')
  const STATUS: Record<string, string> = { new: 'Novo', contacted: 'Contatado', visit_scheduled: 'Visita agendada', visited: 'Visitou', negotiating: 'Negociando', enrolled: 'Matriculado', lost: 'Perdido' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {([['Inscritos', cands.length], ['Últimos 7 dias', last7], ['Com e-mail', withEmail], ['Séries com inscritos', byGrade.length]] as [string, number][]).map(([k, v]) => (
          <div key={k} style={card}><div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>{k}</div><div style={{ fontSize: 28, fontWeight: 800, color: BRAND.ink }}>{v}</div></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 12 }}>
        <div style={card}><div style={{ fontWeight: 800, marginBottom: 10, color: BRAND.ink }}>Inscrições por dia</div><Bars rows={byDay.slice(-14).map(([d, v]) => [fmt(d), v])} /></div>
        <div style={card}><div style={{ fontWeight: 800, marginBottom: 10, color: BRAND.ink }}>Inscritos por série</div><Bars rows={byGrade} /></div>
        <div style={card}><div style={{ fontWeight: 800, marginBottom: 10, color: BRAND.ink }}>Escola de origem</div><Bars rows={byOrigin} /></div>
        <div style={card}><div style={{ fontWeight: 800, marginBottom: 10, color: BRAND.ink }}>Funil no CRM</div><Bars rows={Object.entries(leadStatus).map(([k, v]) => [STATUS[k] ?? k, v] as [string, number])} /></div>
        {selects.map(x => {
          const m: Record<string, number> = {}
          cands.forEach(c => { const a = c.answers?.[x.id]; if (a) m[a] = (m[a] ?? 0) + 1 })
          return <div key={x.id} style={card}><div style={{ fontWeight: 800, marginBottom: 10, color: BRAND.ink }}>{x.label}</div><Bars rows={Object.entries(m).sort((a, b) => b[1] - a[1])} /></div>
        })}
      </div>
    </div>
  )
}
