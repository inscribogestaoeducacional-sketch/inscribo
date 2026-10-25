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
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { GraduationCap, Loader2, Search, LayoutGrid, Users, Layers, ClipboardCheck, UserCheck, Hourglass, AlertCircle, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { useBaseModuleEnabled } from '../../lib/baseModule'
import { useActiveCampaignYear } from '../../lib/activeCampaign'
import PageHeader from '../../components/ui/PageHeader'
import HeaderAction from '../../components/mobile/HeaderAction'
import { BRAND } from '../../lib/brand'
import StudentSheet from '../../components/base/StudentSheet'
import {
  ORIGIN_LABEL, baseCard, fmtDate, stateLabel,
  type Row, type PanelRow, type Head, type Info, type Tab, type Period, type Group,
} from '../../components/base/baseShared'
import { ConferenceView, GeralView, KpiStrip, PeriodBar, ProgressCard, SerieView, StudentsView } from '../../components/base/BaseViews'

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

const BA_TABS: [string, string, any][] = [['geral', 'Visão geral', LayoutGrid], ['alunos', 'Alunos', Users], ['serie', 'Por série', Layers], ['conferencia', 'Conferência', ClipboardCheck]]
const PERIOD_NOTE = 'O período usa a data da matrícula. Pré-matrícula não tem data no sistema da escola: só aparece em “Todo o período”.'

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
  const [sheetId, setSheetId] = useState('')
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

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => {
    const f = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  const swipeProps = useTabSwipe(BA_TABS.map(t => t[0]), tab, id => setTab(id as Tab), isMobile)
  if (moduleOn === false) return <Navigate to="/" replace />
  const hasData = rows.length > 0
  const sourceText = (info?.sources ?? []).map(o => o === 'activesoft' ? 'Activesoft' : 'planilha enviada pela escola').join(' e ')
  const upd = info?.last_seen ? new Date(info.last_seen).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }) : ''

  // rematriculados = vieram pela rematrícula no sistema + os que a escola marcou à mão
  const remCount = rows.filter(r => r.origin === 'rematricula' && r.state === 'matriculado').length + rows.filter(r => r.category === 'rematriculado_declarado').length
  const reconcileParts = [
    { label: 'rematriculados', n: remCount, color: '#059669' },
    { label: 'pré-matriculados', n: rows.filter(r => r.origin === 'rematricula' && r.state === 'pre_matriculado').length, color: '#7C3AED' },
    { label: 'ainda faltam', n: counts.faltam, color: '#D97706' },
    { label: 'saíram', n: totals.left, color: '#DC2626' },
    { label: 'concluintes', n: totals.conc, color: '#64748B' },
  ]
  const goGroup = (g: Group) => { setGroup(g); setGrade(''); setQ(''); setTab('alunos'); window.scrollTo?.({ top: 0 }) }
  const openGrade = (id: string) => { setGrade(id); setGroup('todos'); setQ(''); setTab('alunos'); window.scrollTo?.({ top: 0 }) }
  const sheetRow = sheetId ? rows.find(r => r.student_id === sheetId) ?? null : null
  const focusSearch = () => {
    setTab('alunos')
    setTimeout(() => { const el = document.getElementById('base-busca') as HTMLInputElement | null; el?.scrollIntoView?.({ block: 'center' }); el?.focus() }, 80)
  }

  const yearSelect = (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(255,255,255,.92)', fontWeight: 800 }}>Ano
      <select value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Ano da rematrícula"
        style={{ minHeight: 36, padding: '6px 10px', borderRadius: 12, border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.14)', color: '#fff', fontFamily: 'inherit', fontWeight: 800, fontSize: 14, outline: 'none' }}>
        {[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y} style={{ color: BRAND.ink }}>{y}</option>)}
      </select>
    </label>
  )
  const periodBar = tab !== 'conferencia' ? (
    <PeriodBar mobile={isMobile} period={period} setPeriod={setPeriod} from={from} to={to} setFrom={setFrom} setTo={setTo} note={PERIOD_NOTE} />
  ) : null

  const strip = (
    <KpiStrip items={[
      { label: 'Matriculados', value: counts.mat, color: '#059669', icon: UserCheck, onClick: () => goGroup('matriculados'),
        sub: isMobile ? 'toque para ver a lista' : `${counts.matBy.rematricula} rematrículas · ${counts.matBy.novato} novatos · ${counts.matBy.ex_aluno} ex-alunos que voltaram` },
      { label: 'Pré-matriculados', value: counts.pre, color: '#7C3AED', icon: Hourglass, onClick: () => goGroup('pre'),
        sub: preCounts ? 'contados junto com os matriculados' : 'reservaram vaga, ainda não matriculados' },
      { label: 'Ainda faltam', value: counts.faltam, color: '#D97706', icon: AlertCircle, alert: counts.faltam > 0, onClick: () => goGroup('faltam'), sub: `dos ${totals.base} que seguem na base de ${year - 1}` },
      { label: 'Saíram', value: totals.left, color: '#DC2626', icon: LogOut, onClick: () => goGroup('saiu'), sub: 'transferidos ou cancelados' },
    ]} />
  )

  const body = loading ? (
    <div style={{ ...baseCard, display: 'flex', justifyContent: 'center', padding: 28 }}><Loader2 size={20} className="animate-spin" color={BRAND.primary} /></div>
  ) : !hasData && !error ? (
    <div style={baseCard}>
      <p style={{ fontSize: 14, color: BRAND.text, margin: 0, lineHeight: 1.6 }}>
        Ainda não há alunos de {year - 1} ou {year} nesta base.{' '}
        {canEdit
          ? <>Conecte o sistema da escola em <a href="/settings?tab=integracoes" style={{ color: BRAND.primary, fontWeight: 700 }}>Configurações → Integrações</a>.</>
          : <>Peça ao administrador ou gestor da escola para conectar o sistema da escola.</>}
      </p>
    </div>
  ) : hasData && (
    <>
      {!(isMobile && tab === 'alunos') && periodBar}

      {tab === 'geral' && (
        <>
          <ProgressCard year={year} rem={remCount} pre={reconcileParts[1].n} faltam={counts.faltam} base={totals.base} onFaltam={() => goGroup('faltam')} />
          {strip}
          <GeralView mobile={isMobile} year={year} counts={counts} parts={reconcileParts} totalAll={totals.all} preCounts={preCounts}
            canEdit={canEdit} setPreCounts={setPreCounts} months={months} />
        </>
      )}

      {tab === 'alunos' && (
        <StudentsView mobile={isMobile} year={year} shown={shown} limit={limit} setLimit={setLimit} group={group} setGroup={setGroup} groupCount={groupCount}
          grade={grade} setGrade={setGrade} panel={panel} q={q} setQ={setQ} canEdit={canEdit} busyId={busyId} mark={mark} onOpen={r => setSheetId(r.student_id)} exportCsv={exportCsv} periodSlot={isMobile ? periodBar : null} />
      )}

      {tab === 'serie' && (
        <SerieView mobile={isMobile} year={year} panel={panel} byGrade={byGrade} canEdit={canEdit} capDraft={capDraft} setCapDraft={setCapDraft} saveCap={saveCap} openGrade={openGrade} />
      )}

      {tab === 'conferencia' && (
        <ConferenceView mobile={isMobile} head={head} draft={headDraft} setDraft={setHeadDraft} save={saveHead} canEdit={canEdit} year={thisYear} />
      )}
    </>
  )

  return (
    <div {...swipeProps} style={{ padding: isMobile ? '12px 12px 110px' : '24px 28px', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: isMobile ? 12 : 16 }}>
      <PageHeader compact={isMobile} icon={GraduationCap} title="Base de alunos"
        subtitle={isMobile ? `Rematrícula ${year}: alunos de ${year - 1} × ${year}` : <>Rematrícula {year}: alunos de {year - 1} cruzados com {year}{sourceText ? <> · dados da {sourceText}{upd ? `, atualizados em ${upd}` : ''}</> : null}</>}
        actions={<>
          {hasData && <HeaderAction primary icon={Search} label="Buscar aluno" onClick={focusSearch} />}
          {yearSelect}
        </>} />
      {isMobile && sourceText && (
        <div style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.45, marginTop: -4 }}>Dados da {sourceText}{upd ? `, atualizados em ${upd}` : ''}.</div>
      )}

      {isMobile ? <PillTabs tabs={BA_TABS} value={tab} onChange={id => setTab(id as Tab)} /> : (
        <div role="tablist" style={{ display: 'inline-flex', gap: 2, background: '#EEF3F2', borderRadius: 14, padding: 4, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
          {BA_TABS.map(([id, label, Icon]) => {
            const active = tab === id
            return (
              <button key={id} role="tab" aria-selected={active} onClick={() => setTab(id as Tab)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 13.5,
                  fontWeight: active ? 800 : 600, color: active ? BRAND.primaryDark : BRAND.muted, background: active ? '#fff' : 'transparent',
                  boxShadow: active ? '0 1px 3px rgba(26,43,74,.1)' : 'none', cursor: 'pointer' }}>
                <Icon size={15} />{label}
              </button>
            )
          })}
        </div>
      )}

      {error && <div style={{ ...baseCard, color: '#B91C1C', background: BRAND.dangerSoft, borderColor: '#FECACA', fontSize: 13 } as CSSProperties}>{error}</div>}

      {body}

      {sheetRow && <StudentSheet row={sheetRow} year={year} canEdit={canEdit} busy={busyId === sheetRow.student_id} onClose={() => setSheetId('')} onMark={mark} />}
    </div>
  )
}
