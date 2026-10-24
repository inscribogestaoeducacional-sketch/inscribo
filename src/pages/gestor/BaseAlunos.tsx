// src/pages/gestor/BaseAlunos.tsx
//
// Menu "Base de alunos" — quatro abas: Visão geral, Alunos, Por série e Conferência.
// Admin e gestor sempre veem; atendente só com a permissão base_alunos (Usuários).
// Tudo vem de funções do banco que conferem a permissão (o atendente não lê as
// tabelas da base). Os dados chegam pela integração (Activesoft) ou, nas escolas
// sem API, pelo envio de relatório em Configurações → Integrações.
//
// Contas da tela (todas feitas aqui, sobre a lista que o banco devolve):
//   origem   = rematrícula | novato | ex-aluno que voltou
//   situação = matriculado | pré-matriculado (a escola escolhe se a pré conta)
//   período  = pela data da matrícula (a que o sistema da escola informa; sem ela, a data em que o aluno
//              apareceu pela primeira vez; pré-matrícula sem data fica fora de qualquer período)
import { PillTabs, useTabSwipe } from '../../components/mobile/PillTabs'
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { GraduationCap, Loader2, Search, CheckCircle2, Undo2, Download, MessageCircle, ClipboardCheck, LayoutGrid, Users, Layers, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useBaseModuleEnabled } from '../../lib/baseModule'
import { useActiveCampaignYear } from '../../lib/activeCampaign'
import PageHeader from '../../components/ui/PageHeader'
import { BRAND, SHADOW } from '../../lib/brand'

type Row = {
  student_id: string; registration_code: string | null; student_name: string; guardian_name: string | null; guardian_phone: string | null
  category: string; origin: 'rematricula' | 'novato' | 'ex_aluno' | null; state: 'matriculado' | 'pre_matriculado' | null
  grade_id: string | null; grade_name: string | null; grade_sort: number | null; prev_grade: string | null; cur_status_text: string | null
  enrolled_on: string | null; date_is_estimate: boolean | null; erp_new: boolean | null
  declared_note: string | null; declared_at: string | null; origins: string[] | null
}
type PanelRow = {
  grade_level_id: string; grade_name: string; sort_order: number; is_terminal: boolean
  base_prev_year: number; reenrolled: number; reenrolled_declared: number; pending: number; left_school: number
  new_students: number; returning_students: number; graduates: number; capacity: number | null; pre_enrolled: number
}
type Head = {
  grade_level_id: string; grade_name: string; sort_order: number; studying: number; left_school: number; concluded: number
  prev_studying: number; prev_left: number; secretary_count: number | null
}
type Info = { last_seen: string | null; sources: string[] | null; pre_counts: boolean }
type Tab = 'geral' | 'alunos' | 'serie' | 'conferencia'
type Period = 'all' | 'month' | 'last' | 'custom'
type Group = 'todos' | 'matriculados' | 'pre' | 'faltam' | 'saiu' | 'concluinte'

const ORIGIN_LABEL: Record<string, string> = { rematricula: 'Rematrícula', novato: 'Novato', ex_aluno: 'Ex-aluno que voltou' }
const ORIGIN_COLOR: Record<string, string> = { rematricula: '#059669', novato: '#2563EB', ex_aluno: '#0EA5E9' }
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: `1px solid ${BRAND.line}`, padding: 20, boxShadow: SHADOW }
const input: CSSProperties = { padding: '8px 11px', borderRadius: 10, border: `1.5px solid ${BRAND.line}`, fontSize: 13, outline: 'none', color: BRAND.ink, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff' }
const th: CSSProperties = { padding: '9px 10px', color: BRAND.muted, fontWeight: 700, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 10px', fontSize: 13, color: BRAND.ink, textAlign: 'right' }

const now = new Date()
const todaySP = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const thisYear = Number(todaySP.slice(0, 4))
// A campanha de rematrícula costuma abrir no 2º semestre, para o ano seguinte.
const defaultTarget = now.getMonth() >= 6 ? thisYear + 1 : thisYear

const pad = (n: number) => String(n).padStart(2, '0')
function periodRange(p: Period, from: string, to: string): [string, string] | null {
  const y = Number(todaySP.slice(0, 4)), m = Number(todaySP.slice(5, 7))
  if (p === 'all') return null
  if (p === 'month') return [`${y}-${pad(m)}-01`, `${y}-${pad(m)}-31`]
  if (p === 'last') { const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1; return [`${py}-${pad(pm)}-01`, `${py}-${pad(pm)}-31`] }
  return [from || '0000-01-01', to || '9999-12-31']
}

export default function BaseAlunos() {
  const { user } = useAuth()
  const institutionId = user?.institution_id || ''
  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const [year, setYear] = useState(defaultTarget)
  const [tab, setTab] = useState<Tab>('geral')
  const [rows, setRows] = useState<Row[]>([])
  const [panel, setPanel] = useState<PanelRow[]>([])
  const [head, setHead] = useState<Head[]>([])
  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<Period>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [group, setGroup] = useState<Group>('matriculados')
  const [grade, setGrade] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(100)
  const [busyId, setBusyId] = useState('')
  const [capDraft, setCapDraft] = useState<Record<string, string>>({})
  const [headDraft, setHeadDraft] = useState<Record<string, string>>({})
  const moduleOn = useBaseModuleEnabled(institutionId)
  // o ano abre no da campanha ativa (chave mestra); depois o gestor pode trocar à mão
  const campaignYear = useActiveCampaignYear(institutionId)
  useEffect(() => { if (campaignYear) setYear(campaignYear) }, [campaignYear])

  const load = useCallback(async () => {
    if (!institutionId) return
    setLoading(true); setError('')
    const [o, p, inf, h] = await Promise.all([
      supabase.rpc('base_students_overview', { p_institution_id: institutionId, p_target_year: year }),
      supabase.rpc('base_reenrollment_panel', { p_institution_id: institutionId, p_target_year: year }),
      supabase.rpc('base_sync_info', { p_institution_id: institutionId }),
      supabase.rpc('base_headcount', { p_institution_id: institutionId, p_year: thisYear }),
    ])
    setLoading(false)
    setInfo(((inf.data ?? [])[0] ?? null) as Info | null)
    const err = o.error || p.error
    if (err) {
      setError(err.code === '42501' ? 'Sem permissão para ver a base de alunos.' : 'Não foi possível carregar: ' + err.message)
      return
    }
    setRows((o.data ?? []) as Row[])
    setPanel((p.data ?? []) as PanelRow[])
    setHead((h.data ?? []) as Head[])
    setCapDraft({}); setHeadDraft({})
  }, [institutionId, year])

  useEffect(() => { if (moduleOn) load() }, [load, moduleOn])
  useEffect(() => { setLimit(100) }, [group, grade, q, period, from, to, year])

  const preCounts = !!info?.pre_counts
  const range = useMemo(() => periodRange(period, from, to), [period, from, to])
  const inPeriod = useCallback((r: Row) => !range || (!!r.enrolled_on && r.enrolled_on >= range[0] && r.enrolled_on <= range[1]), [range])

  // quem entra em cada grupo (matriculado/pré dependem do período; "faltam", "saíram" e "concluintes" não)
  const isMat = useCallback((r: Row) => r.state === 'matriculado' || (preCounts && r.state === 'pre_matriculado'), [preCounts])
  const isPre = useCallback((r: Row) => !preCounts && r.state === 'pre_matriculado', [preCounts])
  const inGroup = useCallback((r: Row, g: Group) => {
    switch (g) {
      case 'matriculados': return isMat(r) && inPeriod(r)
      case 'pre':          return isPre(r) && inPeriod(r)
      case 'faltam':       return r.category === 'a_rematricular'
      case 'saiu':         return r.category === 'saiu'
      case 'concluinte':   return r.category === 'concluinte'
      default:             return true
    }
  }, [isMat, isPre, inPeriod])

  const counts = useMemo(() => {
    const c = { mat: 0, pre: 0, faltam: 0, matBy: { rematricula: 0, novato: 0, ex_aluno: 0 }, preBy: { rematricula: 0, novato: 0, ex_aluno: 0 },
                matOnly: { rematricula: 0, novato: 0, ex_aluno: 0 }, preOnly: { rematricula: 0, novato: 0, ex_aluno: 0 }, estimated: 0 }
    for (const r of rows) {
      if (r.category === 'a_rematricular') c.faltam++
      if (!r.origin || !r.state || !inPeriod(r)) continue
      if (r.date_is_estimate) c.estimated++
      if (r.state === 'matriculado') c.matOnly[r.origin]++; else c.preOnly[r.origin]++
      if (isMat(r)) { c.mat++; c.matBy[r.origin]++ }
      else if (isPre(r)) { c.pre++; c.preBy[r.origin]++ }
    }
    return c
  }, [rows, inPeriod, isMat, isPre])

  const totals = useMemo(() => {
    const t = { base: 0, left: 0, conc: 0, all: 0 }
    for (const r of panel) { t.base += r.base_prev_year; t.left += r.left_school; t.conc += r.graduates }
    t.all = t.base + t.left + t.conc   // a base do painel já tira quem saiu e quem concluiu
    return t
  }, [panel])

  const months = useMemo(() => {
    const m = Array.from({ length: 12 }, () => ({ mat: 0, pre: 0 }))
    for (const r of rows) {
      if (!r.state || !r.enrolled_on || Number(r.enrolled_on.slice(0, 4)) !== year - 0 && Number(r.enrolled_on.slice(0, 4)) !== year - 1) continue
      const idx = Number(r.enrolled_on.slice(5, 7)) - 1
      if (idx < 0 || idx > 11) continue
      if (isMat(r)) m[idx].mat++; else if (isPre(r)) m[idx].pre++
    }
    return m
  }, [rows, year, isMat, isPre])

  const shown = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return rows.filter(r => inGroup(r, group)
      && (!grade || r.grade_id === grade)
      && (!qq || r.student_name.toLowerCase().includes(qq) || (r.registration_code || '').toLowerCase().includes(qq)
          || (r.guardian_name || '').toLowerCase().includes(qq)))
  }, [rows, group, grade, q, inGroup])

  const groupCount = useMemo(() => {
    const m: Record<Group, number> = { todos: rows.length, matriculados: 0, pre: 0, faltam: 0, saiu: 0, concluinte: 0 }
    for (const r of rows) for (const g of ['matriculados', 'pre', 'faltam', 'saiu', 'concluinte'] as Group[]) if (inGroup(r, g)) m[g]++
    return m
  }, [rows, inGroup])

  const byGrade = useMemo(() => {
    const m = new Map<string, { mat: number; pre: number; faltam: number }>()
    for (const r of rows) {
      if (!r.grade_id) continue
      const g = m.get(r.grade_id) ?? { mat: 0, pre: 0, faltam: 0 }
      if (r.category === 'a_rematricular') g.faltam++
      if (inPeriod(r)) { if (isMat(r)) g.mat++; else if (isPre(r)) g.pre++ }
      m.set(r.grade_id, g)
    }
    return m
  }, [rows, inPeriod, isMat, isPre])

  const setPreCounts = async (on: boolean) => {
    const { error: err } = await supabase.rpc('base_set_pre_counts', { p_institution_id: institutionId, p_on: on })
    if (err) { setError('Não foi possível salvar a regra: ' + err.message); return }
    load()
  }
  const mark = async (r: Row, on: boolean) => {
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
  const saveHead = async (h: Head) => {
    const raw = headDraft[h.grade_level_id]
    if (raw === undefined) return
    const v = raw.trim() === '' ? null : Number(raw)
    if (v === h.secretary_count) return
    const { error: err } = await supabase.rpc('base_set_headcount', {
      p_institution_id: institutionId, p_year: thisYear, p_grade_level_id: h.grade_level_id, p_count: v,
    })
    if (err) { setError('Não foi possível salvar a contagem: ' + err.message); return }
    load()
  }

  const exportCsv = () => {
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
    const head = ['Matrícula', 'Aluno', 'Responsável', 'Telefone', 'Série', 'Origem', 'Situação', 'Data da matrícula']
    const lines = shown.map(r => [r.registration_code ?? '', r.student_name, r.guardian_name ?? '', r.guardian_phone ?? '', r.grade_name ?? '',
      r.origin ? ORIGIN_LABEL[r.origin] : '', stateLabel(r), r.enrolled_on ? fmtDate(r.enrolled_on) + (r.date_is_estimate ? ' (estimada)' : '') : '']
      .map(v => esc(String(v))).join(';'))
    const blob = new Blob(['﻿' + [head.map(esc).join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `base-de-alunos-${year}-${group}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const BA_TABS: [string, string, any][] = [['geral', 'Visão geral', LayoutGrid], ['alunos', 'Alunos', Users], ['serie', 'Por série', Layers], ['conferencia', 'Conferência', ClipboardCheck]]
  const swipeProps = useTabSwipe(BA_TABS.map(t => t[0]), tab, id => setTab(id as Tab), isMobile)
  if (moduleOn === false) return <Navigate to="/" replace />
  const hasData = rows.length > 0
  const sourceText = (info?.sources ?? []).map(o => o === 'activesoft' ? 'Activesoft' : 'planilha enviada pela escola').join(' e ')
  const upd = info?.last_seen ? new Date(info.last_seen).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : ''

  return (
    <div {...swipeProps} style={{ padding: isMobile ? '12px 12px 24px' : '24px 28px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon={GraduationCap} title="Base de alunos"
        subtitle={<>Rematrícula {year}: alunos de {year - 1} cruzados com {year}{sourceText ? <> · dados da {sourceText}{upd ? `, atualizados em ${upd}` : ''}</> : null}</>}
        actions={
          <label style={{ fontSize: 12, color: 'rgba(255,255,255,.9)', fontWeight: 700 }}>Ano&nbsp;
            <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...input, padding: '6px 10px', borderColor: 'transparent' }}>
              {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        } />

      {isMobile && <PillTabs tabs={BA_TABS} value={tab} onChange={id => setTab(id as Tab)} />}
      {!isMobile && <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#EEF3F2', borderRadius: 14, padding: 4, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
        {([['geral', 'Visão geral', LayoutGrid], ['alunos', 'Alunos', Users], ['serie', 'Por série', Layers], ['conferencia', 'Conferência', ClipboardCheck]] as const).map(([id, label, Icon]) => {
          const active = tab === id
          return (
            <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 13.5,
                fontWeight: active ? 800 : 600, color: active ? BRAND.primaryDark : BRAND.muted, background: active ? '#fff' : 'transparent',
                boxShadow: active ? '0 1px 3px rgba(26,43,74,.1)' : 'none', cursor: 'pointer' }}>
              <Icon size={15} />{label}
            </button>
          )
        })}
      </div>}

      {error && <div style={{ ...card, color: '#B91C1C', background: BRAND.dangerSoft, borderColor: '#FECACA', fontSize: 13 }}>{error}</div>}

      {loading ? <div style={card}><Loader2 size={18} className="animate-spin" /></div> : !hasData && !error ? (
        <div style={card}>
          <p style={{ fontSize: 14, color: BRAND.text, margin: 0, lineHeight: 1.6 }}>
            Ainda não há alunos de {year - 1} ou {year} nesta base.{' '}
            {canEdit
              ? <>Conecte o sistema da escola em <a href="/settings?tab=integracoes" style={{ color: BRAND.primary, fontWeight: 700 }}>Configurações → Integrações</a>.</>
              : <>Peça ao administrador ou gestor da escola para conectar o sistema da escola.</>}
          </p>
        </div>
      ) : hasData && (
        <>
          {tab !== 'conferencia' ? (
            <PeriodBar period={period} setPeriod={setPeriod} from={from} to={to} setFrom={setFrom} setTo={setTo} note={tab === 'conferencia' ? '' : 'O período usa a data da matrícula. Pré-matrícula não tem data no sistema da escola: só aparece em “Todo o período”.'} />
          ) : null}

          {tab === 'geral' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <Big label="matriculados" value={counts.mat} color="#059669"
                  sub={`${counts.matBy.rematricula} rematrículas · ${counts.matBy.novato} novatos · ${counts.matBy.ex_aluno} ex-alunos que voltaram`} />
                <Big label="pré-matriculados" value={counts.pre} color="#7C3AED" sub={preCounts ? 'contados junto com os matriculados' : 'reservaram vaga, ainda não matriculados'} />
                <Big label="ainda faltam" value={counts.faltam} color="#D97706" sub={`dos ${totals.base} que seguem na base de ${year - 1}`} />
                <Big label="saíram" value={totals.left} color="#DC2626" sub={`transferidos ou cancelados`} />
              </div>

              <div style={card}>
                <SectionTitle>De onde vêm os alunos de {year}</SectionTitle>
                <table style={{ borderCollapse: 'collapse', width: '100%', maxWidth: 640 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ ...th, textAlign: 'left' }}>Origem</th>
                      <th style={th}>Matriculados</th>
                      <th style={th}>Pré-matriculados</th>
                      <th style={th}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(['rematricula', 'novato', 'ex_aluno'] as const).map(o => (
                      <tr key={o} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>
                          <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: ORIGIN_COLOR[o], marginRight: 8 }} />
                          {ORIGIN_LABEL[o]}
                        </td>
                        <td style={td}>{counts.matOnly[o] || '–'}</td>
                        <td style={td}>{counts.preOnly[o] || '–'}</td>
                        <td style={{ ...td, fontWeight: 800 }}>{counts.matOnly[o] + counts.preOnly[o] || '–'}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: `2px solid ${BRAND.line}` }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td>
                      <td style={{ ...td, fontWeight: 800 }}>{counts.matOnly.rematricula + counts.matOnly.novato + counts.matOnly.ex_aluno}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{counts.preOnly.rematricula + counts.preOnly.novato + counts.preOnly.ex_aluno}</td>
                      <td style={{ ...td, fontWeight: 800 }}>{counts.mat + counts.pre}</td>
                    </tr>
                  </tbody>
                </table>
                <p style={{ fontSize: 12, color: BRAND.muted, margin: '12px 0 0', lineHeight: 1.55 }}>
                  <b>Novato</b> nunca estudou na escola. <b>Ex-aluno que voltou</b> já estudou aqui antes, mas não estava na escola em {year - 1}.
                  {counts.estimated > 0 && <> Em {counts.estimated} aluno(s) a data da matrícula é estimada (primeira vez que apareceram no sistema).</>}
                </p>
              </div>

              <div style={card}>
                <SectionTitle>E os {totals.all} alunos de {year - 1}?</SectionTitle>
                <Reconcile parts={[
                  { label: 'rematriculados', n: rows.filter(r => r.origin === 'rematricula' && r.state === 'matriculado').length + rows.filter(r => r.category === 'rematriculado_declarado').length, color: '#059669' },
                  { label: 'pré-matriculados', n: rows.filter(r => r.origin === 'rematricula' && r.state === 'pre_matriculado').length, color: '#7C3AED' },
                  { label: 'ainda faltam', n: counts.faltam, color: '#D97706' },
                  { label: 'saíram', n: totals.left, color: '#DC2626' },
                  { label: 'concluintes', n: totals.conc, color: '#64748B' },
                ]} total={totals.all} />
              </div>

              <div style={card}>
                <SectionTitle>Matrículas por mês</SectionTitle>
                <MonthChart months={months} />
              </div>

              <div style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '14px 18px' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink }}>Pré-matrícula conta como matriculado?</div>
                  <div style={{ fontSize: 12, color: BRAND.muted }}>
                    Cada escola escolhe. Hoje: {preCounts ? 'Sim, soma nos matriculados.' : 'Não, aparece separada como “pré-matriculado”.'}
                  </div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', border: `1.5px solid ${BRAND.line}`, borderRadius: 10, overflow: 'hidden', fontSize: 13 }}>
                    {[false, true].map(v => (
                      <button key={String(v)} onClick={() => { if (preCounts !== v) setPreCounts(v) }}
                        style={{ padding: '7px 16px', border: 0, cursor: 'pointer', fontFamily: 'inherit', background: preCounts === v ? BRAND.primary : '#fff', color: preCounts === v ? '#fff' : BRAND.text, fontWeight: 700 }}>
                        {v ? 'Sim' : 'Não'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {tab === 'alunos' && (
            <div style={card}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {([['matriculados', 'Matriculados', '#059669'], ['pre', 'Pré-matriculados', '#7C3AED'], ['faltam', 'Ainda faltam', '#D97706'],
                   ['saiu', 'Saíram', '#DC2626'], ['concluinte', 'Concluintes', '#64748B'], ['todos', 'Todos', BRAND.primaryDark]] as [Group, string, string][]).map(([k, label, color]) => (
                  <button key={k} onClick={() => setGroup(k)}
                    style={{ padding: '6px 12px', borderRadius: 999, border: '1px solid ' + (group === k ? color : BRAND.line), fontFamily: 'inherit',
                      background: group === k ? color : '#fff', color: group === k ? '#fff' : BRAND.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    {label} ({groupCount[k]})
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: BRAND.faint }} />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, responsável ou matrícula" style={{ ...input, paddingLeft: 30, width: 320 }} />
                </div>
                {grade && (
                  <button onClick={() => setGrade('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, border: `1px solid ${BRAND.softLine}`, background: BRAND.soft, color: BRAND.primaryDark, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {panel.find(p => p.grade_level_id === grade)?.grade_name} <X size={13} />
                  </button>
                )}
                <span style={{ fontSize: 12, color: BRAND.faint }}>{shown.length} aluno(s)</span>
                <button onClick={exportCsv} disabled={shown.length === 0}
                  style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Download size={14} /> Baixar planilha (CSV)
                </button>
              </div>
              {group === 'faltam' && (
                <p style={{ fontSize: 12, color: BRAND.muted, margin: '0 0 10px', lineHeight: 1.55 }}>
                  Quem estava na escola em {year - 1} e ainda não aparece em {year}. Se a família já confirmou e o sistema da escola ainda não mostra,
                  use “Marcar rematriculado”; a marcação some sozinha quando o sistema trouxer o aluno.
                </p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={{ ...th, textAlign: 'left' }}>Aluno</th>
                      <th style={{ ...th, textAlign: 'left' }}>Responsável</th>
                      <th style={{ ...th, textAlign: 'left' }}>Série</th>
                      <th style={{ ...th, textAlign: 'left' }}>Origem</th>
                      <th style={{ ...th, textAlign: 'left' }}>Situação</th>
                      <th style={{ ...th, textAlign: 'left' }}>Matrícula em</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.slice(0, limit).map(r => (
                      <tr key={r.student_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ ...td, textAlign: 'left' }}>
                          <div style={{ fontWeight: 700 }}>{r.student_name}</div>
                          <div style={{ fontSize: 11.5, color: BRAND.faint }}>Matrícula {r.registration_code || '–'}</div>
                        </td>
                        <td style={{ ...td, textAlign: 'left' }}>
                          {r.guardian_name || '–'}
                          {r.guardian_phone && <div style={{ fontSize: 12, color: BRAND.muted }}>{fmtPhone(r.guardian_phone)}</div>}
                        </td>
                        <td style={{ ...td, textAlign: 'left', fontSize: 12.5 }}>{r.grade_name || '–'}</td>
                        <td style={{ ...td, textAlign: 'left' }}>
                          {r.origin ? <Badge color={ORIGIN_COLOR[r.origin]}>{ORIGIN_LABEL[r.origin]}</Badge> : <span style={{ color: BRAND.faint }}>–</span>}
                        </td>
                        <td style={{ ...td, textAlign: 'left' }}>
                          {r.state === 'pre_matriculado' ? <Badge color="#7C3AED">Pré-matriculado</Badge>
                            : r.state === 'matriculado' ? <Badge color="#059669">Matriculado</Badge>
                            : r.category === 'a_rematricular' ? <Badge color="#D97706">Ainda falta</Badge>
                            : r.category === 'saiu' ? <Badge color="#DC2626">Saiu</Badge>
                            : r.category === 'concluinte' ? <Badge color="#64748B">Concluinte</Badge> : '–'}
                        </td>
                        <td style={{ ...td, textAlign: 'left', fontSize: 12.5 }}>
                          {r.enrolled_on ? <>{fmtDate(r.enrolled_on)}{r.date_is_estimate && <span title="Data estimada: primeira vez que o aluno apareceu no sistema" style={{ color: BRAND.faint }}> ~</span>}</> : '–'}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          {r.category === 'a_rematricular' && r.guardian_phone && (
                            <a href={`https://wa.me/${waNumber(r.guardian_phone)}`} target="_blank" rel="noreferrer" title="Chamar no WhatsApp"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, marginRight: 6, borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D' }}>
                              <MessageCircle size={15} />
                            </a>
                          )}
                          {r.category === 'a_rematricular' && canEdit && (
                            <button onClick={() => mark(r, true)} disabled={busyId === r.student_id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BRAND.softLine}`, background: BRAND.softer, color: BRAND.primaryDark, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {busyId === r.student_id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Marcar rematriculado
                            </button>
                          )}
                          {r.category === 'rematriculado_declarado' && canEdit && (
                            <button onClick={() => mark(r, false)} disabled={busyId === r.student_id}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.muted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {busyId === r.student_id ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />} Desfazer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {shown.length === 0 && (
                      <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: BRAND.faint, padding: 22 }}>Nenhum aluno nesta lista.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {shown.length > limit && (
                <button onClick={() => setLimit(l => l + 200)} style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.text, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Mostrar mais ({shown.length - limit} restantes)
                </button>
              )}
            </div>
          )}

          {tab === 'serie' && (
            <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC' }}>
                    <th style={{ ...th, textAlign: 'left', paddingLeft: 18 }}>Série em {year}</th>
                    <th style={th}>Alunos em {year - 1}</th>
                    <th style={th}>Matriculados</th>
                    <th style={th}>Pré-matric.</th>
                    <th style={th}>Ainda faltam</th>
                    <th style={th}>Vagas</th>
                    <th style={{ ...th, paddingRight: 18 }}>Livres</th>
                  </tr>
                </thead>
                <tbody>
                  {panel.filter(r => r.base_prev_year + r.pending + r.pre_enrolled + r.reenrolled + r.new_students + r.returning_students + r.graduates > 0 || r.capacity != null).map(r => {
                    const g = byGrade.get(r.grade_level_id) ?? { mat: 0, pre: 0, faltam: 0 }
                    const occ = g.mat + g.pre
                    return (
                      <tr key={r.grade_level_id} onClick={() => { setGrade(r.grade_level_id); setGroup('todos'); setTab('alunos') }}
                        style={{ borderTop: '1px solid #F1F5F9', cursor: 'pointer' }} title="Ver os alunos desta série">
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: 18 }}>
                          {r.grade_name}{r.is_terminal && <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 500 }}> · série final</span>}
                        </td>
                        <td style={td}>{r.base_prev_year || '–'}</td>
                        <td style={{ ...td, color: '#059669', fontWeight: 700 }}>{g.mat || '–'}</td>
                        <td style={{ ...td, color: g.pre ? '#7C3AED' : undefined, fontWeight: g.pre ? 700 : 400 }}>{g.pre || '–'}</td>
                        <td style={{ ...td, color: g.faltam ? '#D97706' : undefined, fontWeight: g.faltam ? 800 : 400 }}>{g.faltam || '–'}</td>
                        <td style={td} onClick={e => e.stopPropagation()}>
                          {canEdit ? (
                            <input inputMode="numeric" aria-label={`Vagas ${r.grade_name}`}
                              value={capDraft[r.grade_level_id] ?? (r.capacity == null ? '' : String(r.capacity))}
                              onChange={e => setCapDraft(d => ({ ...d, [r.grade_level_id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                              onBlur={() => saveCap(r)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                              placeholder="–" style={{ ...input, width: 64, textAlign: 'right', padding: '5px 8px' }} />
                          ) : (r.capacity ?? '–')}
                        </td>
                        <td style={{ ...td, paddingRight: 18, color: r.capacity != null && occ > r.capacity ? '#DC2626' : undefined }}>
                          {r.capacity == null ? '–' : r.capacity - occ}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'conferencia' && (
            <Conference head={head} draft={headDraft} setDraft={setHeadDraft} save={saveHead} canEdit={canEdit} year={thisYear} />
          )}
        </>
      )}
    </div>
  )
}

function stateLabel(r: Row) {
  return r.state === 'pre_matriculado' ? 'Pré-matriculado' : r.state === 'matriculado' ? 'Matriculado'
    : r.category === 'a_rematricular' ? 'Ainda falta' : r.category === 'saiu' ? 'Saiu' : r.category === 'concluinte' ? 'Concluinte' : ''
}

function PeriodBar({ period, setPeriod, from, to, setFrom, setTo, note }: {
  period: Period; setPeriod: (p: Period) => void; from: string; to: string; setFrom: (s: string) => void; setTo: (s: string) => void; note: string
}) {
  const chips: [Period, string][] = [['all', 'Todo o período'], ['month', 'Este mês'], ['last', 'Mês passado'], ['custom', 'Escolher datas']]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {chips.map(([k, label]) => (
        <button key={k} onClick={() => setPeriod(k)}
          style={{ padding: '6px 13px', borderRadius: 999, border: '1px solid ' + (period === k ? BRAND.primary : BRAND.line), fontFamily: 'inherit',
            background: period === k ? BRAND.soft : '#fff', color: period === k ? BRAND.primaryDark : BRAND.text, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {label}
        </button>
      ))}
      {period === 'custom' && (
        <>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={input} aria-label="De" />
          <span style={{ fontSize: 12, color: BRAND.muted }}>até</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={input} aria-label="Até" />
        </>
      )}
      {note && period !== 'all' && <span style={{ fontSize: 12, color: BRAND.faint }}>{note}</span>}
    </div>
  )
}

function Reconcile({ parts, total }: { parts: { label: string; n: number; color: string }[]; total: number }) {
  const sum = parts.reduce((s, p) => s + p.n, 0)
  const denom = Math.max(total, sum, 1)
  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 99, overflow: 'hidden', background: '#EEF3F2' }}>
        {parts.map(p => p.n > 0 && <div key={p.label} title={`${p.label}: ${p.n}`} style={{ width: `${(p.n / denom) * 100}%`, background: p.color }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 12 }}>
        {parts.map(p => (
          <div key={p.label} style={{ fontSize: 13, color: BRAND.text }}>
            <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: p.color, marginRight: 6 }} />
            <b style={{ color: BRAND.ink }}>{p.n}</b> {p.label}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, margin: '10px 0 0', color: sum === total ? BRAND.success : BRAND.warn, fontWeight: 600 }}>
        {sum === total ? `A conta fecha: ${sum} de ${total}.` : `Somam ${sum}, a base tem ${total}: ${Math.abs(total - sum)} aluno(s) de diferença (conferir na aba Alunos).`}
      </p>
    </div>
  )
}

function MonthChart({ months }: { months: { mat: number; pre: number }[] }) {
  const max = Math.max(1, ...months.map(m => m.mat + m.pre))
  const any = months.some(m => m.mat + m.pre > 0)
  if (!any) return <p style={{ fontSize: 13, color: BRAND.muted, margin: 0 }}>Ainda não há matrículas com data para mostrar.</p>
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, paddingTop: 8 }}>
      {months.map((m, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
          <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700 }}>{m.mat + m.pre || ''}</div>
          <div style={{ width: '100%', maxWidth: 34, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: `${((m.mat + m.pre) / max) * 100}%`, minHeight: m.mat + m.pre ? 3 : 0 }}>
            {m.pre > 0 && <div style={{ flex: m.pre, background: '#C4B5FD', borderRadius: '5px 5px 0 0' }} />}
            {m.mat > 0 && <div style={{ flex: m.mat, background: '#10B981', borderRadius: m.pre ? 0 : '5px 5px 0 0' }} />}
          </div>
          <div style={{ fontSize: 11, color: BRAND.faint }}>{MONTHS[i]}</div>
        </div>
      ))}
    </div>
  )
}

function Conference({ head, draft, setDraft, save, canEdit, year }: {
  head: Head[]; draft: Record<string, string>; setDraft: (f: (d: Record<string, string>) => Record<string, string>) => void
  save: (h: Head) => void; canEdit: boolean; year: number
}) {
  const rows = head.filter(h => h.studying + h.left_school + h.concluded + h.prev_studying + h.prev_left > 0)
  const totalStudying = rows.reduce((s, h) => s + h.studying, 0)
  const totalLeft = rows.reduce((s, h) => s + h.left_school, 0)
  const totalPrevLeft = rows.reduce((s, h) => s + h.prev_left, 0)
  const totalPrevBase = rows.reduce((s, h) => s + h.prev_studying + h.prev_left, 0)
  const rate = totalStudying + totalLeft ? totalLeft / (totalStudying + totalLeft) : 0
  const prevRate = totalPrevBase ? totalPrevLeft / totalPrevBase : 0
  const low = prevRate > 0.02 && rate < prevRate / 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={card}>
        <SectionTitle>Conferir com a secretaria · {year}</SectionTitle>
        <p style={{ fontSize: 13, color: BRAND.text, margin: '0 0 6px', lineHeight: 1.6 }}>
          O sistema da escola mostra <b>{totalStudying}</b> alunos cursando. Nem sempre isso é o número real: aluno que saiu e ainda não foi baixado continua aparecendo.
          Peça à secretaria quantos alunos há em cada série e digite abaixo; a diferença mostra onde conferir.
        </p>
        {low && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: BRAND.warnSoft, border: '1px solid #FDE68A', color: BRAND.warn, fontSize: 13, lineHeight: 1.5 }}>
            Atenção: neste ano saíram {(rate * 100).toFixed(1)}% dos alunos; no ano passado foram {(prevRate * 100).toFixed(1)}%. Pode haver aluno que já saiu e continua “cursando” no sistema.
          </div>
        )}
      </div>
      <div style={{ ...card, padding: 0, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 720 }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={{ ...th, textAlign: 'left', paddingLeft: 18 }}>Série</th>
              <th style={th}>Cursando no sistema</th>
              <th style={th}>Secretaria diz</th>
              <th style={th}>Diferença</th>
              <th style={th}>Saíram no ano</th>
              <th style={{ ...th, paddingRight: 18 }}>Saíram no ano passado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(h => {
              const sec = h.secretary_count
              const diff = sec == null ? null : h.studying - sec
              return (
                <tr key={h.grade_level_id} style={{ borderTop: '1px solid #F1F5F9' }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700, paddingLeft: 18 }}>{h.grade_name}</td>
                  <td style={td}>{h.studying || '–'}</td>
                  <td style={td}>
                    {canEdit ? (
                      <input inputMode="numeric" aria-label={`Secretaria ${h.grade_name}`}
                        value={draft[h.grade_level_id] ?? (sec == null ? '' : String(sec))}
                        onChange={e => setDraft(d => ({ ...d, [h.grade_level_id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        onBlur={() => save(h)} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        placeholder="–" style={{ ...input, width: 72, textAlign: 'right', padding: '5px 8px' }} />
                    ) : (sec ?? '–')}
                  </td>
                  <td style={{ ...td, fontWeight: 800, color: diff == null ? BRAND.faint : diff === 0 ? BRAND.success : BRAND.warn }}>
                    {diff == null ? '–' : diff === 0 ? 'bate' : diff > 0 ? `+${diff} no sistema` : `${diff} no sistema`}
                  </td>
                  <td style={td}>{h.left_school || '–'}</td>
                  <td style={{ ...td, paddingRight: 18 }}>{h.prev_left || '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 12 }}>{children}</div>
}
function Badge({ color, children }: { color: string; children: ReactNode }) {
  return <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: color + '1A', color }}>{children}</span>
}

const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const waNumber = (p: string) => { const d = p.replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d }
// 5583999990000 → (83) 99999-0000; o resto como veio
function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}

function Big({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div style={{ ...card, padding: '16px 18px', minWidth: 190, flex: '1 1 190px' }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-.02em', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 13, color: BRAND.ink, fontWeight: 700, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: BRAND.faint, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
}
