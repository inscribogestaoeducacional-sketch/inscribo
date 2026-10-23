// src/pages/gestor/CampanhaMatriculas.tsx
//
// Menu "Campanha de Matrículas" (admin e gestor). A Áion libera o ano; a escola abre esta página,
// confere a meta que o sistema sugere a partir do histórico dela, edita o que quiser e ativa.
//
// A conta (src/lib/campaignPlan.ts):
//   rematrículas = alunos elegíveis × taxa de retenção     (a escola pode mudar a taxa ou o número)
//   meta total   = alunos de hoje × (1 + crescimento)      (em % ou em número de alunos)
//   novos        = meta total − rematrículas
//   mês a mês    = pelo jeito que a escola matriculou nos anos anteriores
// Escola sem histórico (sem integração nem planilha): digita os números base e o sistema usa uma
// curva padrão, marcada como "estimativa".
import { Fragment, useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Flag, Loader2, Check, AlertTriangle, LayoutGrid, SlidersHorizontal, Layers, Sparkles, Filter, Users, RefreshCw, Wallet, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { BRAND, SHADOW } from '../../lib/brand'
import { applyCampaignCycle } from '../../lib/campaignApply'
import { aiFetch } from '../../lib/authHeaders'
import { NovatosTab, RematriculaTab } from '../../components/campanha/NovatosRematricula'
import Investimento from '../../components/campanha/Investimento'
import FunilCampanha from '../../components/campanha/FunilCampanha'
import Matriculometro from '../../components/campanha/Matriculometro'
import SaidasReport from '../../components/campanha/SaidasReport'
import RelatorioMensal from '../../components/campanha/RelatorioMensal'
import MetaCharts from '../../components/campanha/CampaignCharts'
import {
  type History, type HistYear, type PlanMonth, type FunnelRates, type PlanSource,
  DEFAULT_FUNNEL, MONTH_ABBR, monthName, monthsBetween, retention, suggestGoals, suggestMonths, funnelNeeds, sourceFromSources,
} from '../../lib/campaignPlan'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cycle = Record<string, any>
type PanelRow = {
  grade_level_id: string; grade_name: string; base_prev_year: number; reenrolled: number; reenrolled_declared: number; pending: number
  left_school: number; new_students: number; returning_students: number; graduates: number; pre_enrolled: number
}
type Tab = 'geral' | 'funil' | 'novatos' | 'rematricula' | 'invest' | 'metas' | 'serie' | 'matriculometro' | 'saidas' | 'relatorio'
type Report = { resumo?: string; secoes?: { titulo: string; texto?: string; pontos?: string[] }[]; alertas?: string[] }
type Ed = {
  start: string; end: string; curStudents: number; baseStudents: number; retention: number
  total: number; re: number; novos: number; months: PlanMonth[]; after: { rematriculas: number; novos: number }
  rates: FunnelRates; monthsSource: 'historico' | 'padrao' | 'salvo'; dirty: boolean
}

const card: CSSProperties = { background: '#fff', borderRadius: 16, border: `1px solid ${BRAND.line}`, padding: 20, boxShadow: SHADOW }
const inputS: CSSProperties = { padding: '8px 11px', borderRadius: 10, border: `1.5px solid ${BRAND.line}`, fontSize: 14, fontWeight: 700, outline: 'none', color: BRAND.ink, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', width: '100%' }
const th: CSSProperties = { padding: '9px 10px', color: BRAND.muted, fontWeight: 700, fontSize: 12, textAlign: 'right', whiteSpace: 'nowrap' }
const td: CSSProperties = { padding: '9px 10px', fontSize: 13, color: BRAND.ink, textAlign: 'right' }
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, color: BRAND.muted, marginBottom: 5, display: 'block' }
const fmt = (n: number) => n.toLocaleString('pt-BR')
const pct = (x: number, d = 0) => `${(x * 100).toFixed(d).replace('.', ',')}%`
const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const STATUS_LABEL: Record<string, { t: string; c: string; bg: string }> = {
  active: { t: 'Ativa', c: '#15803D', bg: '#DCFCE7' }, released: { t: 'Liberada, falta configurar', c: '#B45309', bg: '#FEF3C7' },
  setup: { t: 'Em configuração', c: '#B45309', bg: '#FEF3C7' }, draft: { t: 'Rascunho', c: '#5B6B86', bg: '#EEF3F2' },
  completed: { t: 'Encerrada', c: '#5B6B86', bg: '#EEF3F2' }, archived: { t: 'Arquivada', c: '#5B6B86', bg: '#EEF3F2' },
}
const SOURCE_LABEL: Record<PlanSource, string> = {
  activesoft: 'Dados reais da Activesoft', planilha: 'Dados da sua planilha', manual: 'Números digitados pela escola', estimativa: 'Estimativa: vai ficar mais precisa conforme as matrículas entrarem',
}

function Chip({ children, c = BRAND.muted, bg = '#EEF3F2' }: { children: ReactNode; c?: string; bg?: string }) {
  return <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 99, fontSize: 11.5, fontWeight: 700, color: c, background: bg }}>{children}</span>
}
function Num({ value, onChange, disabled, suffix, step }: { value: number; onChange: (n: number) => void; disabled?: boolean; suffix?: string; step?: number }) {
  return (
    <div style={{ position: 'relative' }}>
      <input type="number" min={0} step={step ?? 1} disabled={disabled} style={{ ...inputS, paddingRight: suffix ? 30 : 11, background: disabled ? '#F8FAFC' : '#fff' }}
        value={Number.isFinite(value) && value !== 0 ? value : ''} placeholder="0"
        onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} />
      {suffix && <span style={{ position: 'absolute', right: 11, top: 9, fontSize: 13, color: BRAND.faint, fontWeight: 700 }}>{suffix}</span>}
    </div>
  )
}

export default function CampanhaMatriculas() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const institutionId = user?.institution_id || ''
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleId, setCycleId] = useState('')
  const [hist, setHist] = useState<History | null>(null)
  const [panel, setPanel] = useState<PanelRow[]>([])
  const [info, setInfo] = useState<{ sources: string[] | null; pre_counts: boolean } | null>(null)
  const [tab, setTab] = useState<Tab>('geral')
  const [noLead, setNoLead] = useState<{ novos_matriculados: number; sem_lead: number; lista: { student: string; grade: string | null }[] } | null>(null)
  const [ed, setEd] = useState<Ed | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [openClasses, setOpenClasses] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [geralKind, setGeralKind] = useState<'novos' | 'rematriculas'>('novos')
  const [report, setReport] = useState<Report | null>(null)
  const [reportAt, setReportAt] = useState<string | null>(null)
  const [genBusy, setGenBusy] = useState(false)
  const [genErr, setGenErr] = useState('')

  const cycle = useMemo(() => cycles.find(c => c.id === cycleId) ?? null, [cycles, cycleId])
  const targetYear: number = cycle ? (cycle.target_school_year ?? cycle.year) : 0
  const configured = !!cycle && cycle.goal_reenrollments != null
  const readOnly = cycle?.status === 'completed' || cycle?.status === 'archived'

  // 1) campanhas da escola; abre a ativa, senão a liberada, senão a mais nova
  const loadCycles = useCallback(async () => {
    if (!institutionId) return
    const { data } = await supabase.from('campaign_cycles').select('*').eq('institution_id', institutionId).neq('status', 'archived').order('created_at', { ascending: false })
    const list = (data ?? []) as Cycle[]
    setCycles(list)
    setCycleId(prev => prev && list.some(c => c.id === prev) ? prev
      : (list.find(c => c.status === 'active') ?? list.find(c => c.status === 'released') ?? list[0])?.id ?? '')
    if (!list.length) setLoading(false)
  }, [institutionId])
  useEffect(() => { loadCycles() }, [loadCycles])

  // 2) histórico e andamento do ano da campanha escolhida
  useEffect(() => {
    if (!cycle || !institutionId) return
    let alive = true
    setLoading(true); setEd(null)
    ;(async () => {
      const [h, p, i, nl] = await Promise.all([
        supabase.rpc('campaign_history', { p_institution_id: institutionId, p_target_year: targetYear, p_years: 3 }),
        supabase.rpc('base_reenrollment_panel', { p_institution_id: institutionId, p_target_year: targetYear }),
        supabase.rpc('base_sync_info', { p_institution_id: institutionId }),
        supabase.rpc('campaign_enrollments_without_lead', { p_inst: institutionId, p_year: targetYear }),
      ])
      if (!alive) return
      setNoLead(nl.error ? null : (nl.data as typeof noLead))
      setHist((h.data ?? null) as History | null)
      setPanel(((p.data ?? []) as PanelRow[]))
      setInfo(((i.data ?? [])[0] ?? null) as { sources: string[] | null; pre_counts: boolean } | null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [cycle?.id, institutionId, targetYear]) // eslint-disable-line react-hooks/exhaustive-deps

  const years: HistYear[] = hist?.years ?? []
  const ret = useMemo(() => retention(years), [years])
  const source: PlanSource = useMemo(() => {
    if (cycle?.plan_source) return cycle.plan_source as PlanSource
    return sourceFromSources(info?.sources, years)
  }, [cycle?.plan_source, info?.sources, years])

  // 3) monta o editor: campanha já configurada volta como foi salva; senão, sugestão pelo histórico
  const build = useCallback((o: { start: string; end: string; curStudents: number; baseStudents: number; retention: number; total: number; re: number }, keepRates?: FunnelRates): Ed => {
    const goals = { total: o.total, rematriculas: o.re, novos: Math.max(0, o.total - o.re) }
    const s = suggestMonths({ years, targetYear, start: o.start, end: o.end, goals })
    return { ...o, novos: goals.novos, months: s.months, after: s.after, rates: keepRates ?? DEFAULT_FUNNEL, monthsSource: s.source, dirty: true }
  }, [years, targetYear])

  useEffect(() => {
    if (!cycle || !hist || ed) return
    const start: string = cycle.start_date ?? `${targetYear - 1}-09-01`
    const end: string = cycle.end_date ?? `${targetYear}-03-31`
    const curStudents = hist.current_students || cycle.base_students || 0
    const baseStudents = hist.current_base || cycle.base_students || curStudents
    if (configured) {
      const list = monthsBetween(start, end)
      const mt = (cycle.monthly_targets ?? []) as Cycle[]
      const re = cycle.goal_reenrollments as number
      const novos = (cycle.target_new_students ?? 0) as number
      setEd({
        start, end, curStudents, baseStudents, retention: baseStudents ? re / baseStudents : 0.85,
        total: cycle.goal_total ?? re + novos, re, novos,
        months: list.map((m, i) => ({ m, rematriculas: mt[i]?.enrollments_returning ?? 0, novos: mt[i]?.enrollments_new ?? 0 })),
        after: { rematriculas: cycle.plan_after?.rematriculas ?? 0, novos: cycle.plan_after?.novos ?? 0 },
        rates: { ...DEFAULT_FUNNEL, ...(cycle.funnel_rates ?? {}) }, monthsSource: 'salvo', dirty: false,
      })
      return
    }
    const rate = ret.rate ?? 0.85
    const g = suggestGoals({ baseStudents, currentStudents: curStudents, retentionRate: rate, growthPct: 0 })
    const e = build({ start, end, curStudents, baseStudents, retention: rate, total: g.total, re: g.rematriculas })
    setEd({ ...e, dirty: false })
  }, [cycle, hist, ed, configured, ret.rate, build, targetYear])

  useEffect(() => { setReport((cycle?.ai_report ?? null) as Report | null); setReportAt(cycle?.ai_report_at ?? null); setGenErr('') }, [cycle?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (cycle) setTab(searchParams.get('relatorio') ? 'relatorio' : cycle.status === 'active' && configured ? 'geral' : 'metas') }, [cycle?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── edições do gestor: cada uma refaz o mês a mês (as edições mês a mês ficam só enquanto não mexer na meta)
  const rebuild = (patch: Partial<Ed>) => setEd(prev => prev ? build({ ...prev, ...patch }, prev.rates) : prev)
  const setGrowth = (g: number) => ed && rebuild({ total: Math.round(ed.curStudents * (1 + g / 100)) })
  const setTotal = (t: number) => rebuild({ total: t })
  const setRe = (r: number) => ed && rebuild({ re: r, retention: ed.baseStudents ? r / ed.baseStudents : 0 })
  const setRetention = (p: number) => ed && rebuild({ retention: p / 100, re: Math.round(ed.baseStudents * p / 100) })
  const setNovos = (n: number) => ed && rebuild({ total: ed.re + n })
  const setBase = (b: number) => ed && rebuild({ baseStudents: b, re: Math.round(b * ed.retention) })
  const setCur = (c: number) => ed && rebuild({ curStudents: c })
  const setDates = (start: string, end: string) => ed && rebuild({ start, end })
  const setCell = (i: number, k: 'rematriculas' | 'novos', v: number) => setEd(p => p ? { ...p, dirty: true, months: p.months.map((m, j) => j === i ? { ...m, [k]: v } : m) } : p)
  const setAfter = (k: 'rematriculas' | 'novos', v: number) => setEd(p => p ? { ...p, dirty: true, after: { ...p.after, [k]: v } } : p)
  const setRate = (k: keyof FunnelRates, v: number) => setEd(p => p ? { ...p, dirty: true, rates: { ...p.rates, [k]: Math.min(1, Math.max(0.01, v / 100)) } } : p)

  const sums = useMemo(() => {
    if (!ed) return { re: 0, novos: 0 }
    return {
      re: ed.months.reduce((s, m) => s + m.rematriculas, 0) + ed.after.rematriculas,
      novos: ed.months.reduce((s, m) => s + m.novos, 0) + ed.after.novos,
    }
  }, [ed])

  const save = async (activate: boolean) => {
    if (!cycle || !ed) return
    setSaving(true); setMsg(null)
    try {
      const mt = ed.months.map((m, i) => {
        const f = funnelNeeds(m.novos, ed.rates)
        const old = ((cycle.monthly_targets ?? []) as Cycle[])[i] ?? {}
        return {
          month: MONTH_ABBR[Number(m.m.slice(5, 7)) - 1], year: Number(m.m.slice(0, 4)),
          registrations: f.registrations, schedules: f.schedules, visits: f.visits,
          enrollments: m.rematriculas + m.novos, enrollments_new: m.novos, enrollments_returning: m.rematriculas,
          investment_suggested: old.investment_suggested ?? 0, leads_target: f.registrations, cpa_target: old.cpa_target ?? 0,
        }
      })
      const totalNovos = sums.novos, totalRe = sums.re
      const extra = {
        goal_mode: 'growth', growth_pct: ed.curStudents ? Math.round(((totalNovos + totalRe) / ed.curStudents - 1) * 1000) / 10 : null,
        goal_total: totalNovos + totalRe, goal_reenrollments: totalRe,
        lead_conversion_rate: ed.rates.registration_to_schedule * ed.rates.schedule_to_visit * ed.rates.visit_to_enrollment,
        funnel_rates: ed.rates, plan_after: ed.after, plan_source: source, plan_edited_at: new Date().toISOString(),
      }
      if (activate || cycle.status === 'active') {
        if (activate) {
          const other = cycles.find(c => c.status === 'active' && c.id !== cycle.id)
          if (other) {
            const { error } = await supabase.from('campaign_cycles').update({ status: 'completed', finished_at: new Date().toISOString() }).eq('id', other.id)
            if (error) throw error
          }
        }
        await applyCampaignCycle({
          institutionId, cycleId: cycle.id, campaignStartMonthNum: Number(ed.start.slice(5, 7)),
          schoolDataSnapshot: cycle.school_data ?? {}, erpFiles: cycle.erp_files ?? [], currentStudents: ed.baseStudents,
          cycleData: {
            institution_id: institutionId, year: cycle.year, label: cycle.label, start_date: ed.start, end_date: ed.end,
            target_new_students: totalNovos, target_reenrollment_rate: ed.baseStudents ? totalRe / ed.baseStudents : 0.85,
            base_students: ed.baseStudents, projected_cpa: cycle.projected_cpa ?? 0, monthly_targets: mt,
            market_data: cycle.market_data ?? {}, historical_data: cycle.historical_data ?? [],
            generation_mode: cycle.generation_mode ?? 'benchmark', ai_reasoning: cycle.ai_reasoning ?? '', realism_score: cycle.realism_score ?? 'realistic',
            applied_at: new Date().toISOString(),
          },
        })
        const { error } = await supabase.from('campaign_cycles').update(extra).eq('id', cycle.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('campaign_cycles').update({
          start_date: ed.start, end_date: ed.end, monthly_targets: mt, target_new_students: totalNovos,
          target_reenrollment_rate: ed.baseStudents ? totalRe / ed.baseStudents : 0.85, base_students: ed.baseStudents, ...extra,
        }).eq('id', cycle.id)
        if (error) throw error
      }
      setMsg({ ok: true, t: activate ? `Campanha ${targetYear} ativada.` : 'Alterações salvas.' })
      setEd(null); await loadCycles()
    } catch (e) {
      setMsg({ ok: false, t: 'Não foi possível salvar: ' + (e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'erro') })
    } finally { setSaving(false) }
  }


  // ── relatório da IA: manda o histórico, a meta e o andamento; a IA explica e diz o que fazer
  const generateReport = async () => {
    if (!cycle || !ed) return
    setGenBusy(true); setGenErr('')
    try {
      const rate = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null)
      const study = {
        ano_da_campanha: targetYear, alunos_hoje: ed.curStudents, alunos_que_podem_rematricular: ed.baseStudents, retencao_esperada_pct: Math.round(ed.retention * 1000) / 10,
        anos: years.map(y => {
          const seg: Record<string, { alunos: number; voltaram: number }> = {}
          for (const g of y.by_grade) { const k = g.segment ?? 'outro'; seg[k] = seg[k] ?? { alunos: 0, voltaram: 0 }; seg[k].alunos += g.base; seg[k].voltaram += g.retained }
          return {
            ano: y.year, alunos_na_base: y.base, voltaram: y.retained, nao_voltaram: y.lost, retencao_pct: rate(y.retained, y.base), novos: y.new_students,
            total_de_alunos_no_ano: y.total_students, concluintes: y.graduates, saiu_durante_o_ano: y.left_during_year, matriculas_por_mes: y.monthly,
            por_segmento: Object.entries(seg).map(([k, v]) => ({ segmento: k, ...v, nao_voltaram: v.alunos - v.voltaram, retencao_pct: rate(v.voltaram, v.alunos) })),
            por_serie: y.by_grade.map(g => ({ serie: g.name, segmento: g.segment, alunos: g.base, voltaram: g.retained, nao_voltaram: g.lost, retencao_pct: rate(g.retained, g.base), novos_na_serie: g.new_students })),
            turmas_com_mais_perda: y.by_class.filter(c => c.base >= 8 && c.lost >= 3).sort((a, b) => b.lost - a.lost).slice(0, 20)
              .map(c => ({ turma: c.name, alunos: c.base, voltaram: c.retained, nao_voltaram: c.lost, retencao_pct: rate(c.retained, c.base) })),
          }
        }),
        meta: {
          total_de_alunos: sums.re + sums.novos, rematriculas: sums.re, novos: sums.novos, crescimento_pct: ed.curStudents ? Math.round(((sums.re + sums.novos) / ed.curStudents - 1) * 1000) / 10 : null,
          taxas_do_funil_pct: { cadastro_para_agendamento: Math.round(ed.rates.registration_to_schedule * 100), agendamento_para_visita: Math.round(ed.rates.schedule_to_visit * 100), visita_para_matricula: Math.round(ed.rates.visit_to_enrollment * 100) },
          meses: ed.months.map(m => ({ mes: m.m, rematriculas: m.rematriculas, novos: m.novos, ...(() => { const f = funnelNeeds(m.novos, ed.rates); return { cadastros_necessarios: f.registrations, visitas_necessarias: f.visits } })() })),
          depois_do_fim: ed.after,
        },
        andamento_agora: { matriculados: prog.done, pre_matriculados: prog.pre, ainda_nao_rematricularam: prog.pending, saiu: prog.left, por_mes: hist?.current?.monthly ?? [] },
      }
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'campaign_study', payload: { institutionId, targetYear, source, study } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      const rep = json.result as Report
      const at = new Date().toISOString()
      setReport(rep); setReportAt(at)
      await supabase.from('campaign_cycles').update({ ai_report: rep, ai_report_at: at }).eq('id', cycle.id)
    } catch (e) {
      setGenErr(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
    } finally { setGenBusy(false) }
  }

  // ── andamento real do ano da campanha (vem da Base de alunos)
  const prog = useMemo(() => {
    const s = (k: keyof PanelRow) => panel.reduce((a, r) => a + ((r[k] as number) || 0), 0)
    const preCounts = !!info?.pre_counts
    const reMat = s('reenrolled') + s('reenrolled_declared'), novos = s('new_students') + s('returning_students'), pre = s('pre_enrolled')
    return { reMat, novos, pre: preCounts ? 0 : pre, pending: s('pending'), left: s('left_school'), grads: s('graduates'), done: reMat + novos + (preCounts ? pre : 0) }
  }, [panel, info])
  const goalTotal = cycle ? (cycle.goal_total ?? ((cycle.goal_reenrollments ?? 0) + (cycle.target_new_students ?? 0))) : 0
  const dayInfo = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return null
    const a = new Date(cycle.start_date + 'T12:00:00').getTime(), b = new Date(cycle.end_date + 'T12:00:00').getTime(), t = new Date(todaySP + 'T12:00:00').getTime()
    const total = Math.max(1, Math.round((b - a) / 86400000)), day = Math.min(total, Math.max(0, Math.round((t - a) / 86400000)))
    return { day, total }
  }, [cycle?.start_date, cycle?.end_date])

  if (user && user.role !== 'admin' && user.role !== 'manager') return <div style={{ padding: 24 }}>Sem permissão.</div>

  // ── tela sem campanha
  if (!loading && !cycles.length) {
    return (
      <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto' }}>
        <PageHeader icon={Flag} title="Campanha de Matrículas" subtitle="Aqui você acompanha e planeja as matrículas do ano" />
        <div style={{ ...card, marginTop: 16, textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Nenhuma campanha liberada ainda</div>
          <div style={{ fontSize: 13.5, color: BRAND.muted, marginTop: 6 }}>Quando a Áion liberar o ano da campanha para a sua escola, ela aparece aqui para você configurar.</div>
        </div>
      </div>
    )
  }

  const st = STATUS_LABEL[cycle?.status ?? 'draft'] ?? STATUS_LABEL.draft
  const tabBtn = (id: Tab, label: string, Icon: typeof LayoutGrid) => (
    <button key={id} onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      fontSize: 13, fontWeight: 700, background: tab === id ? '#fff' : 'transparent', color: tab === id ? BRAND.primaryDark : BRAND.muted,
      boxShadow: tab === id ? '0 1px 3px rgba(26,43,74,.1)' : 'none',
    }}><Icon size={15} />{label}</button>
  )

  return (
    <div style={{ padding: 24, maxWidth: 1180, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader icon={Flag} title="Campanha de Matrículas"
        subtitle={cycle ? `${cycle.label ?? `Campanha ${targetYear}`}${cycle.start_date ? ` · ${cycle.start_date.split('-').reverse().join('/')} a ${(cycle.end_date ?? '').split('-').reverse().join('/')}` : ''}${dayInfo ? ` · dia ${dayInfo.day} de ${dayInfo.total}` : ''}` : ''}
        actions={<>
          {cycle && <Chip c={st.c} bg={st.bg}>{st.t}</Chip>}
          {cycle && <button onClick={() => { setStep(1); setTab('metas') }} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'rgba(255,255,255,.18)', cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><SlidersHorizontal size={15} /> Configuração da campanha</button>}
          {cycles.length > 1 && (
            <select value={cycleId} onChange={e => { setCycleId(e.target.value); setEd(null) }}
              style={{ padding: '8px 12px', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 14, color: BRAND.ink, background: '#fff' }}>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.label ?? `Campanha ${c.target_school_year ?? c.year}`}{c.status === 'active' ? ' (ativa)' : ''}</option>)}
            </select>
          )}
        </>} />

      {cycle && cycle.status !== 'active' && !readOnly && (
        <div style={{ ...card, border: `2px solid ${BRAND.primary}`, background: BRAND.softer, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#065F52' }}>Campanha {targetYear} liberada. Falta configurar e ativar.</div>
            <div style={{ fontSize: 13, color: BRAND.text, marginTop: 3 }}>Já deixei tudo preenchido com o histórico da escola. Confira, ajuste o que quiser e ative.</div>
          </div>
          <Chip c="#B45309" bg="#FEF3C7">Em configuração</Chip>
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: 4, background: '#EEF3F2', borderRadius: 14, padding: 5, alignSelf: 'flex-start', flexWrap: 'wrap' }}>
        {tabBtn('geral', 'Visão geral', LayoutGrid)}
        {tabBtn('funil', 'Funil', Filter)}
        {tabBtn('novatos', 'Novatos', Users)}
        {tabBtn('rematricula', 'Rematrícula', RefreshCw)}
        {tabBtn('invest', 'Investimento', Wallet)}
        {tabBtn('serie', 'Séries e turmas', Layers)}
        {tabBtn('matriculometro', 'Matriculômetro', Flag)}
        {tabBtn('saidas', 'Saídas', LogOut)}
        {tabBtn('relatorio', 'Relatório do mês', Sparkles)}
      </div>

      {loading && <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>}

      {!loading && cycle && tab === 'geral' && (
        <>
          {noLead && noLead.sem_lead > 0 && (
            <div style={{ ...card, borderColor: '#FDE68A', background: '#FFFBEB' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400E', marginBottom: 4 }}>
                {noLead.sem_lead} de {noLead.novos_matriculados} alunos novos matriculados em {targetYear} não têm lead
              </div>
              <div style={{ fontSize: 12.5, color: '#92400E', marginBottom: 8 }}>
                O telefone do responsável não aparece em nenhum lead. Sem o lead, o funil e a origem da matrícula ficam incompletos.
              </div>
              <div style={{ fontSize: 12.5, color: BRAND.text, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {noLead.lista.slice(0, 12).map((x, i) => (
                  <span key={i} style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: 999, padding: '3px 10px' }}>{x.student}{x.grade ? ` · ${x.grade}` : ''}</span>
                ))}
                {noLead.lista.length > 12 && <span style={{ color: BRAND.muted }}>+{noLead.lista.length - 12}</span>}
              </div>
            </div>
          )}
          {!configured ? (
            <div style={card}><div style={{ fontSize: 14, color: BRAND.text }}>Esta campanha ainda não tem meta. Abra <b>Metas e mês a mês</b> para configurar.</div></div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ ...card, flex: '1.6 1 420px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 12 }}>Meta da campanha: {fmt(goalTotal)} alunos</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
                    <div style={{ fontSize: 34, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{fmt(prog.done)}</div>
                    <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>matriculados</div>
                      <div style={{ fontSize: 12, color: BRAND.faint }}>{goalTotal ? pct(prog.done / goalTotal) : '–'} da meta{dayInfo ? ` · ${pct(dayInfo.day / dayInfo.total)} do tempo da campanha já passou` : ''}</div></div>
                  </div>
                  <div style={{ height: 14, borderRadius: 99, background: '#EDF1F0', marginTop: 14, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, goalTotal ? (prog.done / goalTotal) * 100 : 0)}%`, background: '#10B981', borderRadius: 99 }} />
                  </div>
                  {prog.pre > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 18 }}>
                        <div style={{ fontSize: 34, fontWeight: 800, color: '#7C3AED', lineHeight: 1 }}>{fmt(prog.pre)}</div>
                        <div><div style={{ fontSize: 13.5, fontWeight: 700 }}>pré-matriculados</div>
                          <div style={{ fontSize: 12, color: BRAND.faint }}>reservaram a vaga e ainda não efetivaram · matriculados + pré = {fmt(prog.done + prog.pre)}</div></div>
                      </div>
                      <div style={{ height: 14, borderRadius: 99, background: '#EDF1F0', marginTop: 14, overflow: 'hidden', position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, goalTotal ? (prog.done / goalTotal) * 100 : 0)}%`, background: '#10B981' }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, goalTotal ? (prog.done / goalTotal) * 100 : 0)}%`, width: `${Math.min(100 - Math.min(100, goalTotal ? (prog.done / goalTotal) * 100 : 0), goalTotal ? (prog.pre / goalTotal) * 100 : 0)}%`, background: '#8B5CF6' }} />
                      </div>
                    </>
                  )}
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
                    <thead><tr style={{ background: '#F8FAFC' }}><th style={{ ...th, textAlign: 'left' }}>Meta</th><th style={th}>Meta</th><th style={th}>Matriculados</th><th style={th}>Faltam para efetivar</th></tr></thead>
                    <tbody>
                      <tr style={{ borderTop: `1px solid ${BRAND.line}` }}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Rematrículas</td><td style={td}>{fmt(cycle.goal_reenrollments ?? 0)}</td><td style={td}>{fmt(prog.reMat)}</td><td style={{ ...td, fontWeight: 700 }}>{fmt(Math.max(0, (cycle.goal_reenrollments ?? 0) - prog.reMat))}</td></tr>
                      <tr style={{ borderTop: `1px solid ${BRAND.line}` }}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Alunos novos</td><td style={td}>{fmt(cycle.target_new_students ?? 0)}</td><td style={td}>{fmt(prog.novos)}</td><td style={{ ...td, fontWeight: 700 }}>{fmt(Math.max(0, (cycle.target_new_students ?? 0) - prog.novos))}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ ...card, flex: '1 1 300px' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Avisos da campanha</div>
                  {prog.pre > 0 && <Aviso t={`${fmt(prog.pre)} pré-matrículas esperando efetivar`} d="Veja a lista na Base de alunos." go={() => navigate('/base-alunos')} />}
                  {prog.pending > 0 && <Aviso t={`${fmt(prog.pending)} alunos sem rematrícula nem pré`} d="Ainda não rematricularam. Veja quem são." go={() => navigate('/base-alunos')} />}
                  {prog.left > 0 && <Aviso t={`${fmt(prog.left)} alunos saíram`} d="Transferidos ou cancelados no ano." go={() => navigate('/base-alunos')} />}
                  {!prog.pre && !prog.pending && !prog.left && <div style={{ fontSize: 13, color: BRAND.muted }}>Nada pendente por enquanto.</div>}
                </div>
              </div>

              {ed && (
                <>
                  <div style={{ display: 'inline-flex', gap: 4, background: '#EEF3F2', borderRadius: 12, padding: 4, alignSelf: 'flex-start' }}>
                    {([['novos', 'Alunos novos'], ['rematriculas', 'Rematrículas']] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setGeralKind(k)} style={{ padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: geralKind === k ? '#fff' : 'transparent', color: geralKind === k ? BRAND.primaryDark : BRAND.muted }}>{l}</button>
                    ))}
                  </div>
                  <MetaCharts key={geralKind} kind={geralKind} months={ed.months} cur={hist?.current ?? null} years={years} targetYear={targetYear} label={geralKind === 'novos' ? 'Alunos novos' : 'Rematrículas'} />
                </>
              )}
            </>
          )}
        </>
      )}

      {!loading && cycle && tab === 'metas' && ed && (
        <>
          <button onClick={() => setTab('geral')} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', padding: 0 }}>← Voltar ao acompanhamento</button>
          <Step n={1} cur={step} setStep={setStep} title="Datas da campanha" summary={`${ed.start.split('-').reverse().join('/')} a ${ed.end.split('-').reverse().join('/')} · ${ed.months.length} meses`} hint="Quando a campanha começa e termina">
            <div style={{ display: 'flex', gap: 12, maxWidth: 480 }}>
              <div style={{ flex: 1 }}><label style={lbl}>Início</label><input type="date" disabled={readOnly} style={inputS} value={ed.start} onChange={e => e.target.value && setDates(e.target.value, ed.end)} /></div>
              <div style={{ flex: 1 }}><label style={lbl}>Fim</label><input type="date" disabled={readOnly} style={inputS} value={ed.end} onChange={e => e.target.value && setDates(ed.start, e.target.value)} /></div>
            </div>
            <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 10 }}>Mudar datas ou metas refaz o mês a mês. Depois dá para ajustar cada mês.</div>
          </Step>
          <Step n={2} cur={step} setStep={setStep} title="Plano inicial da campanha (IA)" summary={report ? `Plano gerado em ${reportAt ? new Date(reportAt).toLocaleDateString('pt-BR') : ''}` : 'Histórico da escola e análise da IA'} hint="Entenda o histórico da escola antes de definir a meta">
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 4 }}>O que a escola fez nos últimos anos <Chip>{SOURCE_LABEL[source]}</Chip></div>
              {years.length ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
                  <thead><tr style={{ background: '#F8FAFC' }}><th style={{ ...th, textAlign: 'left' }}>Campanha</th><th style={th}>Alunos na base</th><th style={th}>Rematricularam</th><th style={th}>Retenção</th><th style={th}>Saíram</th><th style={th}>Novos</th></tr></thead>
                  <tbody>{years.map(y => (
                    <tr key={y.year} style={{ borderTop: `1px solid ${BRAND.line}` }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{y.year}</td><td style={td}>{fmt(y.base)}</td><td style={td}>{fmt(y.retained)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{pct(y.retained / y.base, 1)}</td><td style={td}>{fmt(y.lost)}</td><td style={td}>{fmt(y.new_students)}</td>
                    </tr>))}</tbody>
                </table>
              ) : <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 8 }}>A escola ainda não tem histórico. Digite abaixo os números de hoje; o mês a mês usa uma curva típica de escola particular até as matrículas reais entrarem.</div>}
              {years.length > 0 && <div style={{ fontSize: 12, color: BRAND.faint, marginTop: 8 }}>Retenção = alunos que voltaram ÷ alunos que poderiam voltar (sem os concluintes). Novos = quem não estava no ano anterior; se o primeiro ano do histórico estiver incompleto, o número de novos dele fica inflado.</div>}
            </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 14 }}>
            <div style={{ maxWidth: 720 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Plano inicial da campanha {targetYear} (IA)</div>
              <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 3 }}>
                A IA lê o histórico da escola, a meta que você definiu e o andamento de agora. Ela explica o que cada número quer dizer, mostra onde a escola perde alunos (por série e turma) e diz o que fazer.
                {reportAt ? ` Gerado em ${new Date(reportAt).toLocaleString('pt-BR')}.` : ''}
              </div>
              {report && cycle.plan_edited_at && reportAt && cycle.plan_edited_at > reportAt && <div style={{ fontSize: 12.5, color: BRAND.warn, marginTop: 6 }}>A meta mudou depois deste relatório. Gere de novo para atualizar.</div>}
              {ed && ed.dirty && <div style={{ fontSize: 12.5, color: BRAND.warn, marginTop: 6 }}>Você tem alterações não salvas em Metas e mês a mês. O relatório usa o que está na tela.</div>}
            </div>
            <button onClick={generateReport} disabled={genBusy || !ed} style={primaryBtn(genBusy || !ed)}>{genBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{report ? 'Gerar de novo' : 'Gerar plano com IA'}</button>
          </div>
          {genBusy && <div style={{ color: BRAND.muted, fontSize: 13.5, marginTop: 10 }}>Analisando o histórico da escola. Isso pode levar até um minuto.</div>}
          {genErr && <div style={{ color: BRAND.danger, fontSize: 13.5, marginTop: 10 }}>{genErr}</div>}
          {report && (
            <>
              {report.resumo && <div style={{ ...card, background: BRAND.softer, border: `1px solid ${BRAND.softLine}` }}><div style={{ fontSize: 12, fontWeight: 800, color: BRAND.primaryDark, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>Em resumo</div><div style={{ fontSize: 14.5, color: BRAND.ink, lineHeight: 1.6 }}>{report.resumo}</div></div>}
              {(report.alertas ?? []).length > 0 && <div style={{ ...card, background: BRAND.warnSoft, border: '1px solid #FCD34D' }}>{(report.alertas ?? []).map((a, i) => <div key={i} style={{ fontSize: 13.5, color: BRAND.warn, display: 'flex', gap: 8, marginBottom: 4 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />{a}</div>)}</div>}
              {(report.secoes ?? []).map((sec, i) => (
                <div key={i} style={card}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>{sec.titulo}</div>
                  {sec.texto && <div style={{ fontSize: 14, color: BRAND.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{sec.texto}</div>}
                  {(sec.pontos ?? []).length > 0 && <ul style={{ margin: '10px 0 0', paddingLeft: 20, listStyle: 'disc', color: BRAND.text, fontSize: 14, lineHeight: 1.6 }}>{(sec.pontos ?? []).map((p, j) => <li key={j} style={{ marginBottom: 4 }}>{p}</li>)}</ul>}
                </div>
              ))}
            </>
          )}
        
          </Step>
          <Step n={3} cur={step} setStep={setStep} title="Metas da campanha" summary={`${fmt(ed.total)} alunos · ${fmt(ed.re)} rematrículas · ${fmt(ed.novos)} novos`} hint="Total de alunos, rematrículas e novos (sugestão pelo histórico, tudo editável)">
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 12 }}>Meta de {targetYear}: o sistema sugere, você decide</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
              <div><label style={lbl}>Alunos que a escola tem hoje</label><Num value={ed.curStudents} onChange={setCur} disabled={readOnly} /></div>
              <div><label style={lbl}>Podem rematricular (sem concluintes)</label><Num value={ed.baseStudents} onChange={setBase} disabled={readOnly} /></div>
              <div><label style={lbl}>Retenção esperada</label><Num value={Math.round(ed.retention * 1000) / 10} step={0.1} suffix="%" onChange={setRetention} disabled={readOnly} /><div style={{ fontSize: 11.5, color: BRAND.faint, marginTop: 4 }}>{ret.rate != null ? `histórico: ${pct(ret.rate, 1)}` : 'sem histórico: 85% como ponto de partida'}</div></div>
              <div><label style={lbl}>Rematrículas</label><Num value={ed.re} onChange={setRe} disabled={readOnly} /></div>
              <div><label style={lbl}>Crescimento</label><Num value={ed.curStudents ? Math.round((ed.total / ed.curStudents - 1) * 1000) / 10 : 0} step={0.1} suffix="%" onChange={setGrowth} disabled={readOnly} /></div>
              <div><label style={lbl}>Meta de alunos</label><Num value={ed.total} onChange={setTotal} disabled={readOnly} /></div>
              <div><label style={lbl}>Alunos novos necessários</label><Num value={ed.novos} onChange={setNovos} disabled={readOnly} /><div style={{ fontSize: 11.5, color: BRAND.faint, marginTop: 4 }}>{years.length ? `nos últimos anos: ${years.map(y => y.new_students).join(', ')}` : ''}</div></div>
            </div>
            {years.length > 0 && (() => {
              const last = years[years.length - 1].new_students
              const lastTot = years[years.length - 1].total_students
              if (ed.novos > last * 1.3 && last > 0) return <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: BRAND.warnSoft, color: BRAND.warn, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={16} />Esta meta pede {fmt(ed.novos)} novos, {pct(ed.novos / last - 1)} a mais que no último ano ({fmt(last)}). Exige mais captação, principalmente nos meses de pico.</div>
              if (ed.total < lastTot * 0.98) return <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: BRAND.warnSoft, color: BRAND.warn, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={16} />Esta meta fica abaixo dos {fmt(lastTot)} alunos do último ano.</div>
              return null
            })()}
          </Step>
          <Step n={4} cur={step} setStep={setStep} title="Mês a mês" summary={`${fmt(sums.re)} rematrículas e ${fmt(sums.novos)} novos distribuídos em ${ed.months.length} meses`} hint="Como a meta se distribui nos meses, pelo jeito que a escola matriculou nos anos anteriores">
            <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Mês a mês: quanto matricular em cada mês <Chip>{ed.monthsSource === 'historico' ? 'segue o jeito da sua escola' : ed.monthsSource === 'salvo' ? 'plano salvo' : 'curva típica (estimativa)'}</Chip></div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
                <thead><tr style={{ background: '#F8FAFC' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Rematrículas<br />anos anteriores</th><th style={{ ...th, color: BRAND.primaryDark }}>Rematrículas<br />meta</th>
                  <th style={th}>Novos<br />anos anteriores</th><th style={{ ...th, color: BRAND.primaryDark }}>Novos<br />meta</th><th style={th}>Cadastros<br />necessários</th><th style={th}>Visitas<br />necessárias</th>
                </tr></thead>
                <tbody>
                  {ed.months.map((m, i) => {
                    const peakRe = Math.max(...ed.months.map(x => x.rematriculas)), peakNew = Math.max(...ed.months.map(x => x.novos))
                    const f = funnelNeeds(m.novos, ed.rates)
                    const prevOf = (k: 'novos' | 'rematriculas') => years.length ? Math.round(years.reduce((s, y) => s + (y.monthly.find(x => x.m.slice(5) === m.m.slice(5))?.[k] ?? 0), 0) / years.length) : null
                    const peak = m.rematriculas === peakRe && peakRe > 0 ? 'pico de rematrículas' : m.novos === peakNew && peakNew > 0 ? 'pico de novos' : ''
                    return (
                      <tr key={m.m} style={{ borderTop: `1px solid ${BRAND.line}`, background: peak ? '#FFFBEB' : undefined }}>
                        <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(m.m)} {peak && <Chip c="#B45309" bg="#FEF3C7">{peak}</Chip>}</td>
                        <td style={{ ...td, color: BRAND.faint }}>{prevOf('rematriculas') ?? '–'}</td>
                        <td style={{ ...td, width: 110 }}><Num value={m.rematriculas} onChange={v => setCell(i, 'rematriculas', v)} disabled={readOnly} /></td>
                        <td style={{ ...td, color: BRAND.faint }}>{prevOf('novos') ?? '–'}</td>
                        <td style={{ ...td, width: 110 }}><Num value={m.novos} onChange={v => setCell(i, 'novos', v)} disabled={readOnly} /></td>
                        <td style={td}>{fmt(f.registrations)}</td><td style={td}>{fmt(f.visits)}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: `1px solid ${BRAND.line}` }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Depois do fim da campanha</td><td style={td} />
                    <td style={{ ...td, width: 110 }}><Num value={ed.after.rematriculas} onChange={v => setAfter('rematriculas', v)} disabled={readOnly} /></td><td style={td} />
                    <td style={{ ...td, width: 110 }}><Num value={ed.after.novos} onChange={v => setAfter('novos', v)} disabled={readOnly} /></td><td style={td} /><td style={td} />
                  </tr>
                  <tr style={{ borderTop: `2px solid ${BRAND.line}` }}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td><td style={td} />
                    <td style={{ ...td, fontWeight: 800 }}>{fmt(sums.re)}{sums.re !== ed.re && <div style={{ fontSize: 11, color: BRAND.warn }}>meta {fmt(ed.re)}</div>}</td><td style={td} />
                    <td style={{ ...td, fontWeight: 800 }}>{fmt(sums.novos)}{sums.novos !== ed.novos && <div style={{ fontSize: 11, color: BRAND.warn }}>meta {fmt(ed.novos)}</div>}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{fmt(ed.months.reduce((s, m) => s + funnelNeeds(m.novos, ed.rates).registrations, 0))}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{fmt(ed.months.reduce((s, m) => s + funnelNeeds(m.novos, ed.rates).visits, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {(sums.re !== ed.re || sums.novos !== ed.novos) && <div style={{ marginTop: 10, fontSize: 12.5, color: BRAND.warn }}>Os meses não somam a meta. Se estiver certo assim, ao salvar a meta passa a ser a soma dos meses.</div>}

            </div>
          </Step>
          <Step n={5} cur={step} setStep={setStep} title="Funil" summary={`${Math.round(ed.rates.registration_to_schedule * 100)}% → ${Math.round(ed.rates.schedule_to_visit * 100)}% → ${Math.round(ed.rates.visit_to_enrollment * 100)}%`} hint="Taxas de cadastro → agendamento → visita → matrícula">
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BRAND.line}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Taxas do funil usadas para estimar cadastros e visitas</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {([['registration_to_schedule', 'Cadastro → agendamento'], ['schedule_to_visit', 'Agendamento → visita'], ['visit_to_enrollment', 'Visita → matrícula']] as const).map(([k, l]) => (
                  <div key={k} style={{ width: 170 }}><label style={lbl}>{l}</label><Num value={Math.round(ed.rates[k] * 100)} suffix="%" onChange={v => setRate(k, v)} disabled={readOnly} /></div>
                ))}
                <div style={{ fontSize: 12, color: BRAND.faint, maxWidth: 280 }}>Valores padrão do sistema. Passam a vir do funil da escola quando houver histórico suficiente.</div>
              </div>
            </div>

          </Step>
          <Step n={6} cur={step} setStep={setStep} title={cycle.status === 'active' ? 'Revisar e salvar' : `Revisar e ativar a campanha ${targetYear}`} summary={cycle.status === 'active' ? 'Campanha ativa' : 'Falta ativar'} hint="Resumo final" last>
            <div style={{ fontSize: 14, color: BRAND.text, lineHeight: 1.8 }}>
              <b>{ed.start.split('-').reverse().join('/')} a {ed.end.split('-').reverse().join('/')}</b> · meta de <b>{fmt(sums.re + sums.novos)}</b> alunos: <b>{fmt(sums.re)}</b> rematrículas e <b>{fmt(sums.novos)}</b> novos.<br />
              Para os novos, o funil pede <b>{fmt(ed.months.reduce((a, m) => a + funnelNeeds(m.novos, ed.rates).registrations, 0))}</b> cadastros e <b>{fmt(ed.months.reduce((a, m) => a + funnelNeeds(m.novos, ed.rates).visits, 0))}</b> visitas.
            </div>
            {!readOnly && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                {msg && <span style={{ fontSize: 13, fontWeight: 700, color: msg.ok ? BRAND.success : BRAND.danger }}>{msg.t}</span>}
                {cycle?.status === 'active' ? (
                  <button disabled={saving || (configured && !ed.dirty)} onClick={() => save(false)} style={primaryBtn(saving || (configured && !ed.dirty))}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Salvar alterações</button>
                ) : (
                  <>
                    <button disabled={saving} onClick={() => save(false)} style={secondaryBtn}>Salvar sem ativar</button>
                    <button disabled={saving} onClick={() => save(true)} style={primaryBtn(saving)}>{saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}Ativar campanha {targetYear}</button>
                  </>
                )}
              </div>
            )}
            {cycle && cycle.status !== 'active' && !readOnly && <div style={{ fontSize: 12, color: BRAND.faint, marginTop: 10, textAlign: 'right' }}>Ao ativar, a campanha anterior é encerrada e fica guardada como histórico.</div>}
          </Step>
        </>
      )}

      {!loading && cycle && tab === 'funil' && institutionId && <FunilCampanha institutionId={institutionId} from={cycle.start_date ?? `${targetYear - 1}-09-01`} to={cycle.end_date ?? `${targetYear}-03-31`} planMonths={ed?.months ?? []} rates={ed?.rates ?? ((cycle.funnel_rates as FunnelRates | null) ?? DEFAULT_FUNNEL)} />}

      {!loading && cycle && tab === 'novatos' && institutionId && (
        <NovatosTab institutionId={institutionId} from={cycle.start_date ?? `${targetYear - 1}-09-01`} to={cycle.end_date ?? `${targetYear}-03-31`}
          rates={ed?.rates ?? ((cycle.funnel_rates as FunnelRates | null) ?? DEFAULT_FUNNEL)} goal={cycle.target_new_students ?? 0} done={prog.novos}
          months={ed?.months ?? []} hist={hist?.current ?? null} />
      )}
      {!loading && cycle && tab === 'novatos' && ed && <MetaCharts kind="novos" months={ed.months} cur={hist?.current ?? null} years={years} targetYear={targetYear} label="Alunos novos" />}

      {!loading && cycle && tab === 'rematricula' && (
        <RematriculaTab goal={cycle.goal_reenrollments ?? 0} done={prog.reMat} months={ed?.months ?? []} hist={hist?.current ?? null}
          pre={prog.pre || panel.reduce((a, r) => a + (r.pre_enrolled || 0), 0)} pending={prog.pending}
          bySegment={panel.map(r => ({ name: r.grade_name, pending: r.pending }))} />
      )}
      {!loading && cycle && tab === 'rematricula' && ed && <MetaCharts kind="rematriculas" months={ed.months} cur={hist?.current ?? null} years={years} targetYear={targetYear} label="Rematrículas" />}

      {!loading && cycle && tab === 'invest' && institutionId && <Investimento institutionId={institutionId} year={targetYear} from={cycle.start_date ?? `${targetYear - 1}-09-01`} to={cycle.end_date ?? `${targetYear}-03-31`} />}

      {!loading && cycle && tab === 'matriculometro' && institutionId && <Matriculometro institutionId={institutionId} year={targetYear} />}

      {!loading && cycle && tab === 'serie' && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 4 }}>Retenção por série e turma</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 12 }}>De cada série do ano anterior, quantos alunos voltaram. Em vermelho: abaixo da média da escola.</div>
          {!(years.length || hist?.current) ? <div style={{ fontSize: 13, color: BRAND.muted }}>Ainda não há histórico para mostrar.</div> : [...(hist?.current && hist.current.base > 0 ? [hist.current] : []), ...years.slice().reverse()].map(y => {
            const inProg = y.year === targetYear
            const avg = y.base ? y.retained / y.base : 0
            return (
              <div key={y.year} style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Campanha {y.year}{inProg ? ' (em andamento)' : ''}: {pct(avg, 1)} {inProg ? 'já garantidos' : 'de retenção'} ({fmt(y.retained)} de {fmt(y.base)}) · {fmt(y.new_students)} novos</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ background: '#F8FAFC' }}><th style={{ ...th, textAlign: 'left' }}>Série (no ano anterior)</th><th style={th}>Alunos</th><th style={th}>{inProg ? 'Matriculados ou pré' : 'Voltaram'}</th><th style={th}>{inProg ? 'Ainda sem rematrícula' : 'Não voltaram'}</th><th style={{ ...th, textAlign: 'left', width: 200 }}>Retenção</th><th style={th}>Novos na série</th><th style={th} /></tr></thead>
                    <tbody>
                      {y.by_grade.filter(g => g.base > 0 || g.new_students > 0).map(g => {
                        const r = g.base ? g.retained / g.base : null
                        const low = r != null && r < avg - 0.05
                        const key = `${y.year}-${g.grade_id}`
                        const turmas = y.by_class.filter(c => c.grade_id === g.grade_id)
                        return (
                          <Fragment key={key}>
                            <tr style={{ borderTop: `1px solid ${BRAND.line}` }}>
                              <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{g.name}</td><td style={td}>{fmt(g.base)}</td><td style={td}>{fmt(g.retained)}</td>
                              <td style={{ ...td, color: low ? BRAND.danger : undefined, fontWeight: low ? 700 : 400 }}>{fmt(g.lost)}</td>
                              <td style={{ ...td, textAlign: 'left' }}>{r != null ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div style={{ flex: 1, height: 8, borderRadius: 99, background: '#EDF1F0', overflow: 'hidden' }}><div style={{ width: `${r * 100}%`, height: '100%', background: low ? '#EF4444' : '#10B981' }} /></div>
                                  <span style={{ fontSize: 12.5, fontWeight: 700, color: low ? BRAND.danger : BRAND.ink, minWidth: 44 }}>{pct(r, 1)}</span>
                                </div>) : <span style={{ color: BRAND.faint }}>–</span>}</td>
                              <td style={td}>{fmt(g.new_students)}</td>
                              <td style={td}>{turmas.length > 0 && <button onClick={() => setOpenClasses(openClasses === key ? null : key)} style={{ border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>{openClasses === key ? 'ocultar turmas' : 'ver turmas'}</button>}</td>
                            </tr>
                            {openClasses === key && turmas.map(c => {
                              const cr = c.base ? c.retained / c.base : null
                              return (
                                <tr key={key + c.class_id} style={{ background: '#FAFCFC' }}>
                                  <td style={{ ...td, textAlign: 'left', paddingLeft: 28, color: BRAND.muted }}>{c.name}</td><td style={td}>{fmt(c.base)}</td><td style={td}>{fmt(c.retained)}</td><td style={td}>{fmt(c.lost)}</td>
                                  <td style={{ ...td, textAlign: 'left', color: cr != null && cr < avg - 0.05 ? BRAND.danger : BRAND.muted }}>{cr != null ? pct(cr, 1) : '–'}</td><td style={td} /><td style={td} />
                                </tr>
                              )
                            })}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {!loading && cycle && tab === 'saidas' && institutionId && <SaidasReport institutionId={institutionId} institutionName={user?.institution_name ?? ''} defaultYear={targetYear - 1} campaignYear={targetYear} />}

      {!loading && cycle && tab === 'relatorio' && institutionId && user && (
        <RelatorioMensal institutionId={institutionId} cycleId={cycle.id} institutionName={user.institution_name ?? ''} userId={user.id} userEmail={user.email ?? ''}
          from={cycle.start_date ?? `${targetYear - 1}-09-01`} to={cycle.end_date ?? `${targetYear}-03-31`} year={targetYear}
          months={ed?.months ?? []} rates={ed?.rates ?? ((cycle.funnel_rates as FunnelRates | null) ?? DEFAULT_FUNNEL)} cur={hist?.current ?? null} years={years}
          prog={{ done: prog.done, pre: prog.pre, pending: prog.pending }} noLead={noLead?.sem_lead ?? 0} openId={searchParams.get('relatorio')} />
      )}
    </div>
  )
}

function Step({ n, cur, setStep, title, summary, hint, children, last }: { n: number; cur: number; setStep: (n: number) => void; title: string; summary: string; hint: string; children: ReactNode; last?: boolean }) {
  const open = cur === n, done = cur > n
  return (
    <div style={{ ...card, padding: open ? 20 : '14px 20px', border: open ? `2px solid ${BRAND.primary}` : `1px solid ${BRAND.line}` }}>
      <div onClick={() => !open && setStep(n)} style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: open ? 'default' : 'pointer' }}>
        <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, background: open ? BRAND.primary : done ? '#DCFCE7' : '#EEF3F2', color: open ? '#fff' : done ? '#15803D' : '#94A3B8' }}>{done ? <Check size={16} /> : n}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{n}. {title}</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>{open ? hint : summary}</div>
        </div>
        {!open && <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.primaryDark }}>{done ? 'Editar' : 'Abrir'}</span>}
      </div>
      {open && (
        <div style={{ marginTop: 16 }}>
          {children}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, paddingTop: 14, borderTop: `1px solid ${BRAND.line}` }}>
            {n > 1 ? <button onClick={() => setStep(n - 1)} style={secondaryBtn}>← Anterior</button> : <span />}
            {!last && <button onClick={() => setStep(n + 1)} style={primaryBtn(false)}>Próximo →</button>}
          </div>
        </div>
      )}
    </div>
  )
}

function Aviso({ t, d, go }: { t: string; d: string; go: () => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: `1px solid ${BRAND.line}` }}>
      <AlertTriangle size={16} color="#B45309" style={{ marginTop: 2, flexShrink: 0 }} />
      <div><div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{t}</div>
        <div style={{ fontSize: 12.5, color: BRAND.muted }}>{d} <button onClick={go} style={{ border: 'none', background: 'none', padding: 0, color: BRAND.primaryDark, fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Abrir</button></div></div>
    </div>
  )
}
const primaryBtn = (disabled: boolean): CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 11, border: 'none', cursor: disabled ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'linear-gradient(135deg,#065F52,#00A896)', opacity: disabled ? 0.55 : 1, fontFamily: 'inherit' })
const secondaryBtn: CSSProperties = { padding: '10px 18px', borderRadius: 11, border: `1px solid ${BRAND.line}`, background: '#fff', color: BRAND.text, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' }
