// src/pages/gestor/BaseAlunos.tsx
//
// Menu "Base de alunos" — painel de rematrícula por série e lista nominal de
// quem falta rematricular. Admin e gestor sempre veem; atendente só com a
// permissão base_alunos (Usuários). Tudo vem de duas funções do banco
// (base_reenrollment_panel / base_reenrollment_list), que conferem a permissão;
// o atendente não lê as tabelas da base. Os dados chegam pelo envio do
// relatório em Configurações → Integrações (mesmo fluxo para toda escola).
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { GraduationCap, Loader2, Search, CheckCircle2, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

type PanelRow = {
  grade_level_id: string; grade_name: string; sort_order: number; is_terminal: boolean
  base_prev_year: number; reenrolled: number; reenrolled_declared: number; pending: number; left_school: number
  new_students: number; returning_students: number; graduates: number; capacity: number | null
}
type ListRow = {
  student_id: string; registration_code: string | null; student_name: string; guardian_name: string | null; category: string
  prev_grade: string | null; prev_status_text: string | null; dest_grade_id: string | null; dest_grade: string | null
  cur_status_text: string | null; declared_note: string | null; declared_at: string | null
}

const CATS: { key: string; label: string; color: string }[] = [
  { key: 'a_rematricular',          label: 'A rematricular',            color: '#D97706' },
  { key: 'rematriculado_declarado', label: 'Marcados pela equipe',      color: '#0D9488' },
  { key: 'rematriculado',           label: 'Rematriculados',            color: '#059669' },
  { key: 'novato',                  label: 'Novatos',                   color: '#2563EB' },
  { key: 'retorno',                 label: 'Voltaram',                  color: '#7C3AED' },
  { key: 'saiu',                    label: 'Saíram',                    color: '#DC2626' },
  { key: 'concluinte',              label: 'Concluintes',               color: '#64748B' },
]

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 20 }
const input: CSSProperties = { padding: '7px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }
const th: CSSProperties = { padding: '8px 8px', color: '#475569', fontWeight: 600, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '7px 8px', fontSize: 13, color: '#1A2B4A', textAlign: 'right' }

const now = new Date()
const thisYear = Number(now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4))
// A campanha de rematrícula costuma abrir no 2º semestre, para o ano seguinte.
const defaultTarget = now.getMonth() >= 6 ? thisYear + 1 : thisYear

export default function BaseAlunos() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''
  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const [year, setYear] = useState(defaultTarget)
  const [panel, setPanel] = useState<PanelRow[]>([])
  const [list, setList] = useState<ListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cat, setCat] = useState('a_rematricular')
  const [grade, setGrade] = useState('')
  const [q, setQ] = useState('')
  const [busyId, setBusyId] = useState('')
  const [capDraft, setCapDraft] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!institutionId) return
    setLoading(true); setError('')
    const [p, l] = await Promise.all([
      supabase.rpc('base_reenrollment_panel', { p_institution_id: institutionId, p_target_year: year }),
      supabase.rpc('base_reenrollment_list', { p_institution_id: institutionId, p_target_year: year }),
    ])
    setLoading(false)
    const err = p.error || l.error
    if (err) {
      setError(err.code === '42501' ? 'Sem permissão para ver a base de alunos.' : 'Não foi possível carregar: ' + err.message)
      return
    }
    setPanel((p.data ?? []) as PanelRow[])
    setList((l.data ?? []) as ListRow[])
    setCapDraft({})
  }, [institutionId, year])

  useEffect(() => { load() }, [load])

  const totals = useMemo(() => {
    const t = { base: 0, re: 0, decl: 0, pend: 0, left: 0, novos: 0, ret: 0, conc: 0, cap: 0, capSet: false, occ: 0 }
    for (const r of panel) {
      t.base += r.base_prev_year; t.re += r.reenrolled; t.decl += r.reenrolled_declared; t.pend += r.pending
      t.left += r.left_school; t.novos += r.new_students; t.ret += r.returning_students; t.conc += r.graduates
      if (r.capacity != null) { t.cap += r.capacity; t.capSet = true; t.occ += r.reenrolled + r.reenrolled_declared + r.new_students + r.returning_students }
    }
    return t
  }, [panel])

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return list.filter(r => r.category === cat
      && (!grade || r.dest_grade_id === grade)
      && (!qq || r.student_name.toLowerCase().includes(qq) || (r.registration_code || '').toLowerCase().includes(qq)
          || (r.guardian_name || '').toLowerCase().includes(qq)))
  }, [list, cat, grade, q])

  const countBy = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of list) m[r.category] = (m[r.category] || 0) + 1
    return m
  }, [list])

  const mark = async (r: ListRow, on: boolean) => {
    setBusyId(r.student_id)
    const { error: err } = await supabase.rpc('base_mark_reenrolled', {
      p_institution_id: institutionId, p_target_year: year, p_student_id: r.student_id, p_on: on, p_note: null,
    })
    setBusyId('')
    if (err) { setError('Não foi possível marcar: ' + err.message); return }
    load()
  }

  const saveCap = async (g: PanelRow) => {
    const raw = capDraft[g.grade_level_id]
    if (raw === undefined) return
    const v = raw.trim() === '' ? null : Number(raw)
    if (v === g.capacity) return
    const { error: err } = await supabase.rpc('base_set_capacity', {
      p_institution_id: institutionId, p_academic_year: year, p_grade_level_id: g.grade_level_id, p_capacity: v,
    })
    if (err) { setError('Não foi possível salvar as vagas: ' + err.message); return }
    load()
  }

  const hasData = list.length > 0
  const rowsWithData = panel.filter(r => r.base_prev_year + r.reenrolled + r.reenrolled_declared + r.pending + r.left_school
    + r.new_students + r.returning_students + r.graduates > 0 || r.capacity != null)

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <GraduationCap size={22} color="#00A896" /> Base de alunos
          </h1>
          <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 0' }}>
            Rematrícula {year}: alunos de {year - 1} cruzados com {year} pela matrícula.
          </p>
        </div>
        <label style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>Rematrícula para&nbsp;
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={input}>
            {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {error && <div style={{ ...card, color: '#B91C1C', background: '#FEF2F2', borderColor: '#FECACA', fontSize: 13 }}>{error}</div>}

      {loading ? <div style={card}><Loader2 size={18} className="animate-spin" /></div> : !hasData && !error ? (
        <div style={card}>
          <p style={{ fontSize: 14, color: '#475569', margin: 0, lineHeight: 1.6 }}>
            Ainda não há alunos de {year - 1} ou {year} nesta base.{' '}
            {canEdit
              ? <>Envie os relatórios de alunos em <a href="/settings?tab=integracoes" style={{ color: '#00A896', fontWeight: 600 }}>Configurações → Integrações</a> (o do ano anterior e o do ano atual).</>
              : <>Peça ao administrador ou gestor da escola para enviar os relatórios de alunos.</>}
          </p>
        </div>
      ) : hasData && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Big label={`alunos em ${year - 1} (base)`} value={totals.base} color="#1A2B4A" />
            <Big label="rematriculados" value={totals.re} color="#059669" sub={totals.decl > 0 ? `+ ${totals.decl} marcados pela equipe` : undefined} />
            <Big label="a rematricular" value={totals.pend} color="#D97706" />
            <Big label="saíram" value={totals.left} color="#DC2626" />
            <Big label="novatos" value={totals.novos} color="#2563EB" sub={totals.ret > 0 ? `+ ${totals.ret} voltaram` : undefined} />
            <Big label="concluintes" value={totals.conc} color="#64748B" />
            {totals.capSet && <Big label="vagas livres" value={Math.max(totals.cap - totals.occ, 0)} color="#0D9488" sub={`de ${totals.cap}`} />}
          </div>

          <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={{ ...th, textAlign: 'left', paddingLeft: 16 }}>Série em {year}</th>
                  <th style={th}>Base {year - 1}</th>
                  <th style={th}>Rematriculados</th>
                  <th style={th}>Marcados</th>
                  <th style={th}>A rematricular</th>
                  <th style={th}>Saíram</th>
                  <th style={th}>Novatos</th>
                  <th style={th}>Concluintes</th>
                  <th style={th}>Vagas</th>
                  <th style={{ ...th, paddingRight: 16 }}>Livres</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithData.map(r => {
                  const occ = r.reenrolled + r.reenrolled_declared + r.new_students + r.returning_students
                  return (
                    <tr key={r.grade_level_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600, paddingLeft: 16 }}>
                        {r.grade_name}{r.is_terminal && <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}> · série final</span>}
                      </td>
                      <td style={td}>{r.base_prev_year || '–'}</td>
                      <td style={{ ...td, color: '#059669', fontWeight: 600 }}>{r.reenrolled || '–'}</td>
                      <td style={td}>{r.reenrolled_declared || '–'}</td>
                      <td style={{ ...td, color: r.pending ? '#D97706' : undefined, fontWeight: r.pending ? 700 : 400 }}>{r.pending || '–'}</td>
                      <td style={td}>{r.left_school || '–'}</td>
                      <td style={td}>{r.new_students + r.returning_students || '–'}</td>
                      <td style={td}>{r.graduates || '–'}</td>
                      <td style={td}>
                        {canEdit ? (
                          <input inputMode="numeric" aria-label={`Vagas ${r.grade_name}`}
                            value={capDraft[r.grade_level_id] ?? (r.capacity == null ? '' : String(r.capacity))}
                            onChange={e => setCapDraft(d => ({ ...d, [r.grade_level_id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                            onBlur={() => saveCap(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                            placeholder="–" style={{ ...input, width: 64, textAlign: 'right', padding: '5px 8px' }} />
                        ) : (r.capacity ?? '–')}
                      </td>
                      <td style={{ ...td, paddingRight: 16, color: r.capacity != null && occ > r.capacity ? '#DC2626' : undefined }}>
                        {r.capacity == null ? '–' : r.capacity - occ}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {CATS.map(c => (
                <button key={c.key} onClick={() => setCat(c.key)}
                  style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (cat === c.key ? c.color : '#E2E8F0'),
                    background: cat === c.key ? c.color : '#fff', color: cat === c.key ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {c.label} ({countBy[c.key] || 0})
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#94A3B8' }} />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Nome, responsável ou matrícula" style={{ ...input, paddingLeft: 28, width: 260 }} />
              </div>
              <select value={grade} onChange={e => setGrade(e.target.value)} style={input}>
                <option value="">Todas as séries</option>
                {panel.filter(r => list.some(l => l.dest_grade_id === r.grade_level_id)).map(r => <option key={r.grade_level_id} value={r.grade_level_id}>{r.grade_name}</option>)}
              </select>
              <span style={{ fontSize: 12, color: '#94A3B8', alignSelf: 'center' }}>{shown.length} aluno(s)</span>
            </div>
            {cat === 'a_rematricular' && (
              <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 10px' }}>
                Quem estava na escola em {year - 1} e ainda não aparece em {year}. Se a família já confirmou e o sistema da escola
                ainda não mostra, use "Marcar rematriculado"; a marcação some sozinha quando o próximo relatório trouxer o aluno.
              </p>
            )}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ ...th, textAlign: 'left' }}>Matrícula</th>
                    <th style={{ ...th, textAlign: 'left' }}>Aluno</th>
                    <th style={{ ...th, textAlign: 'left' }}>Responsável</th>
                    <th style={{ ...th, textAlign: 'left' }}>{year - 1}</th>
                    <th style={{ ...th, textAlign: 'left' }}>{year}</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r.student_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ ...td, textAlign: 'left', color: '#64748B' }}>{r.registration_code || '–'}</td>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{r.student_name}</td>
                      <td style={{ ...td, textAlign: 'left' }}>{r.guardian_name || '–'}</td>
                      <td style={{ ...td, textAlign: 'left', fontSize: 12 }}>{r.prev_grade ? `${r.prev_grade} · ${r.prev_status_text || ''}` : '–'}</td>
                      <td style={{ ...td, textAlign: 'left', fontSize: 12 }}>
                        {r.cur_status_text ? `${r.dest_grade || ''} · ${r.cur_status_text}` : r.dest_grade ? <span style={{ color: '#94A3B8' }}>{r.dest_grade} (esperada)</span> : '–'}
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        {r.category === 'a_rematricular' && (
                          <button onClick={() => mark(r, true)} disabled={busyId === r.student_id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid #99F6E4', background: '#F0FDFA', color: '#0D9488', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {busyId === r.student_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Marcar rematriculado
                          </button>
                        )}
                        {r.category === 'rematriculado_declarado' && (
                          <button onClick={() => mark(r, false)} disabled={busyId === r.student_id}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', color: '#64748B', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            {busyId === r.student_id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Desfazer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && (
                    <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: 20 }}>Nenhum aluno nesta lista.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Big({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '14px 18px', minWidth: 140, flex: '1 1 140px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#64748B' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
