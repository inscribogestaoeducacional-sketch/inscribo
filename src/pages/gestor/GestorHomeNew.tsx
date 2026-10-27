// Novo Início do gestor — visão estratégica da escola numa tela só.
// Cada número leva para a tela (ou relatório) onde ele pode ser trabalhado.
// Dados: RPCs report_* (mesmos números da Central de Relatórios), campaign_* (Campanha),
// lead_waiting (famílias esperando), capture_trigger_stats (Captação), transfers_report (saídas).
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, AlertCircle, UserX, MessageCircle, CalendarX, Wallet, ClipboardList, Flag, GraduationCap, TrendingUp,
  Filter, Megaphone, Headset, Users, CalendarCheck, DoorOpen, MapPin, Wallet2, ChevronRight, Trophy, Medal, Clock, Smile, CheckCircle2, Sparkles,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import PageHeader from '../../components/ui/PageHeader'
import { PageSkeleton, Skeleton } from '../../components/ui/BrandLoader'
import { CountUp, useMounted } from '../../components/campanha/CampaignCharts'

// ─── tipos das respostas (só o que a tela usa) ─────────────────────────────────
type Json = Record<string, any>
interface Cycle { id: string; label: string | null; status: string; year: number; target_school_year: number | null; start_date: string | null; end_date: string | null; goal_total: number | null; goal_reenrollments: number | null; target_new_students: number | null; score: number | null; market_data: Json | null }
interface PanelRow { reenrolled: number; reenrolled_declared: number; pending: number; left_school: number; new_students: number; returning_students: number; graduates: number; pre_enrolled: number }
interface HistMonth { m: string; novos: number; rematriculas: number }
interface HistYear { year: number; monthly: HistMonth[] }

// ─── helpers ───────────────────────────────────────────────────────────────────
const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const n0 = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : Number(v) || 0)
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null)
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const satPct = (score: number | null | undefined) => (score == null ? null : Math.round(((score - 1) / 2) * 100))
const firstName = (s?: string | null) => (s || '').trim().split(/\s+/)[0] || ''
const greeting = () => { const h = Number(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', hour12: false, timeZone: 'America/Fortaleza' }).slice(0, 2)); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' }
const minLabel = (m: number | null | undefined) => (m == null ? '—' : m < 60 ? `${Math.round(m)} min` : `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`)
const initials = (s: string) => s.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

type PeriodKey = 'hoje' | '7d' | 'mes' | 'ano' | 'campanha'
function rangeOf(k: PeriodKey, cycle: Cycle | null): { from: string; to: string; label: string } {
  const t = new Date(), today = iso(t)
  if (k === 'hoje') return { from: today, to: today, label: 'hoje' }
  if (k === '7d') return { from: iso(new Date(t.getTime() - 6 * 864e5)), to: today, label: 'últimos 7 dias' }
  if (k === 'ano') return { from: `${t.getFullYear()}-01-01`, to: today, label: `ano de ${t.getFullYear()}` }
  if (k === 'campanha' && cycle?.start_date) return { from: cycle.start_date, to: today, label: cycle.label || 'campanha' }
  return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: today, label: `${['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][t.getMonth()]}` }
}

// ─── peças visuais ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = { background: '#fff', border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: '16px 18px', boxShadow: '0 1px 2px rgba(26,43,74,.04)' }

type TabId = 'resumo' | 'matriculas' | 'atendimento' | 'captacao' | 'financas'
const TABS: [TabId, string][] = [['resumo', 'Resumo'], ['matriculas', 'Matrículas'], ['atendimento', 'Atendimento'], ['captacao', 'Captação'], ['financas', 'Finanças']]
// No celular cada grupo vira uma aba (deslize para o lado); no computador aparece tudo junto.
function T({ id, tab, mobile, children }: { id: TabId; tab: TabId; mobile: boolean; children: React.ReactNode }) {
  return <div style={{ display: !mobile || tab === id ? 'contents' : 'none' }}>{children}</div>
}

function Head({ icon: Icon, title, sub, to, label }: { icon: any; title: string; sub?: string; to?: string; label?: string }) {
  const go = useNavigate()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ width: 34, height: 34, borderRadius: 11, background: BRAND.soft, color: BRAND.primaryDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, lineHeight: 1.2 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      {to && <button type="button" onClick={() => go(to)} style={{ border: 'none', background: BRAND.softer, color: BRAND.primaryDark, fontWeight: 800, fontSize: 12, padding: '6px 10px', borderRadius: 99, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2, fontFamily: 'inherit', whiteSpace: 'nowrap' }}><span className="aion-head-label">{label || 'Abrir'}</span><ChevronRight size={13} /></button>}
    </div>
  )
}

function Bar({ v, max, c, h = 9 }: { v: number; max: number; c: string; h?: number }) {
  const on = useMounted()
  return <div style={{ height: h, borderRadius: 99, background: '#EAF1F0', overflow: 'hidden' }}><div style={{ width: on ? `${Math.min(100, max ? (v / max) * 100 : 0)}%` : 0, height: '100%', background: c, borderRadius: 99, transition: 'width 1s cubic-bezier(.22,1,.36,1)' }} /></div>
}

function Delta({ cur, prev, invert }: { cur: number | null; prev: number | null; invert?: boolean }) {
  if (cur == null || prev == null || prev === 0) return null
  const d = Math.round(((cur - prev) / prev) * 100)
  if (d === 0) return <span style={{ fontSize: 11, color: BRAND.faint, fontWeight: 700 }}>= período anterior</span>
  const good = invert ? d < 0 : d > 0
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '1px 7px', borderRadius: 99, background: good ? '#DCFCE7' : '#FEE2E2', color: good ? '#15803D' : '#B91C1C' }}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}% vs. anterior</span>
}

function Kpi({ label, value, sub, color, icon: Icon, to, delay = 0, children }: { label: string; value: React.ReactNode; sub?: React.ReactNode; color: string; icon: any; to?: string; delay?: number; children?: React.ReactNode }) {
  const go = useNavigate()
  return (
    <button type="button" className="ld-kpi ld-in" onClick={() => to && go(to)} style={{ animationDelay: `${delay}ms`, position: 'relative', overflow: 'hidden', textAlign: 'left', background: '#fff', border: `1.5px solid ${BRAND.line}`, borderRadius: 18, padding: '13px 14px 12px', display: 'flex', flexDirection: 'column', gap: 5, cursor: to ? 'pointer' : 'default', fontFamily: 'inherit' }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: color }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, lineHeight: 1.2 }}>{label}</span>
        <span style={{ width: 28, height: 28, borderRadius: 9, background: `${color}14`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} /></span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: BRAND.ink, lineHeight: 1, letterSpacing: '-.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: BRAND.muted, lineHeight: 1.3 }}>{sub}</div>}
      {children}
    </button>
  )
}

function Ring({ value, max, size = 132, label, sub }: { value: number; max: number; size?: number; label: string; sub: string }) {
  const on = useMounted(), r = size / 2 - 11, c = 2 * Math.PI * r, p = max ? Math.min(1, value / max) : 0
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs><linearGradient id="gh-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#00695F" /><stop offset="100%" stopColor="#2DCBA4" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6F1EF" strokeWidth="11" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#gh-ring)" strokeWidth="11" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={on ? c * (1 - p) : c} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 30, fontWeight: 800, color: BRAND.ink, lineHeight: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700, marginTop: 3 }}>{sub}</span>
      </div>
    </div>
  )
}

// ─── tela ──────────────────────────────────────────────────────────────────────
export default function GestorHomeNew() {
  const { user } = useAuth()
  const go = useNavigate()
  const inst = user?.institution_id || ''
  const [period, setPeriod] = useState<PeriodKey>('mes')
  const [tab, setTab] = useState<TabId>('resumo')
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768)
  useEffect(() => { const h = () => setIsMobile(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  const swipe = React.useRef<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [d, setD] = useState<Json>({})

  // 1) campanha ativa (define janelas e metas)
  useEffect(() => {
    if (!inst) return
    let alive = true
    supabase.from('campaign_cycles').select('id,label,status,year,target_school_year,start_date,end_date,goal_total,goal_reenrollments,target_new_students,score,market_data')
      .eq('institution_id', inst).in('status', ['active', 'released']).order('created_at', { ascending: false }).limit(5)
      .then(({ data }) => {
        if (!alive) return
        const rows = (data ?? []) as Cycle[]
        setCycle(rows.find(r => r.status === 'active') ?? rows[0] ?? null)
        setD(prev => ({ ...prev, _cyc: true }))
      })
    return () => { alive = false }
  }, [inst])

  const range = useMemo(() => rangeOf(period, cycle), [period, cycle])
  const targetYear = cycle ? (cycle.target_school_year ?? cycle.year) : new Date().getFullYear() + 1

  // 2) dados do período
  useEffect(() => {
    if (!inst || !d._cyc) return
    let alive = true
    setLoading(true)
    const p = { p_inst: inst, p_from: range.from, p_to: range.to }
    const cFrom = cycle?.start_date ?? iso(new Date(Date.now() - 90 * 864e5))
    const since14 = new Date(Date.now() - 14 * 864e5).toISOString()
    const qc = (x: any) => Promise.resolve(x).then((r: any) => (r?.error ? 0 : r?.count ?? 0)).catch(() => 0)
    const q = (x: any) => Promise.resolve(x).then((r: any) => (r?.error ? null : r?.data ?? null)).catch(() => null)
    ;(async () => {
      const [leads, vis, wa, att, sat, usr, mat, wait, queue, overdue, past, incomplete, panel, info, hist, fun, trans, invBase, exps, trig, trigNames, enr] = await Promise.all([
        q(supabase.rpc('report_leads', p)), q(supabase.rpc('report_visitas', p)), q(supabase.rpc('report_whatsapp', p)),
        q(supabase.rpc('report_atendimento', p)), q(supabase.rpc('report_satisfacao', p)), q(supabase.rpc('report_usuarios', p)), q(supabase.rpc('report_matriculas', p)),
        q(supabase.rpc('lead_waiting', { p_institution_id: inst })),
        qc(supabase.from('whatsapp_conversations').select('id', { count: 'exact', head: true }).eq('institution_id', inst).eq('status', 'waiting').not('remote_jid', 'ilike', '%@g.us')),
        q(supabase.from('payments').select('id,amount').eq('institution_id', inst).eq('status', 'overdue')),
        qc(supabase.from('visits').select('id', { count: 'exact', head: true }).eq('institution_id', inst).eq('status', 'scheduled').lt('scheduled_date', new Date().toISOString())),
        qc(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('institution_id', inst).is('deleted_at', null).not('status', 'in', '(enrolled,lost)').is('assigned_to', null)),
        q(supabase.rpc('base_reenrollment_panel', { p_institution_id: inst, p_target_year: targetYear })),
        q(supabase.rpc('base_sync_info', { p_institution_id: inst })),
        q(supabase.rpc('campaign_history', { p_institution_id: inst, p_target_year: targetYear, p_years: 2 })),
        q(supabase.rpc('campaign_funnel', { p_inst: inst, p_from: cFrom, p_to: range.to, p_source: null, p_grade: null, p_assigned: null })),
        q(supabase.rpc('transfers_report', { p_inst: inst, p_year: new Date().getFullYear() })),
        cycle ? q(supabase.rpc('campaign_investment_base', { p_inst: inst, p_year: targetYear, p_from: cycle.start_date, p_to: range.to })) : Promise.resolve(null),
        cycle ? q(supabase.from('campaign_expenses').select('amount').eq('institution_id', inst).eq('target_year', targetYear)) : Promise.resolve(null),
        q(supabase.rpc('capture_trigger_stats', { p_institution_id: inst, p_start: new Date(range.from + 'T00:00:00-03:00').toISOString(), p_end: new Date(Date.now() + 60000).toISOString() })),
        q(supabase.from('capture_triggers').select('id,name').eq('institution_id', inst)),
        q(supabase.from('enrollments').select('enrollment_date').eq('institution_id', inst).is('cancelled_at', null).gte('enrollment_date', new Date(Date.now() - 240 * 864e5).toISOString()).limit(5000)),
      ])
      if (!alive) return
      void since14
      setD(prev => ({ ...prev, leads, vis, wa, att, sat, usr, mat, wait, queue, overdue, past, incomplete, panel, info, hist, fun, trans, invBase, exps, trig, trigNames, enr }))
      setLoading(false)
    })()
    return () => { alive = false }
  }, [inst, range.from, range.to, d._cyc, cycle?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── derivados ──
  const leads = d.leads as Json | null, vis = d.vis as Json | null, wa = d.wa as Json | null, att = d.att as Json | null
  const sat = d.sat as Json | null, usr = d.usr as Json | null, mat = d.mat as Json | null, fun = d.fun as Json | null, trans = d.trans as Json | null
  const waitingUs = ((d.wait ?? []) as Json[]).filter(w => w.side === 'us').length
  const overdueList = (d.overdue ?? []) as { amount: number }[]
  const panelRows = (d.panel ?? []) as PanelRow[]
  const preCounts = !!((d.info ?? [])[0]?.pre_counts)
  const prog = useMemo(() => {
    const s = (k: keyof PanelRow) => panelRows.reduce((a, r) => a + (n0(r[k])), 0)
    const reMat = s('reenrolled') + s('reenrolled_declared'), novos = s('new_students') + s('returning_students'), pre = s('pre_enrolled')
    return { reMat, novos, pre: preCounts ? 0 : pre, pending: s('pending'), left: s('left_school'), done: reMat + novos + (preCounts ? pre : 0) }
  }, [panelRows, preCounts])
  const goalTotal = cycle ? (cycle.goal_total ?? n0(cycle.goal_reenrollments) + n0(cycle.target_new_students)) : 0
  const goalRe = n0(cycle?.goal_reenrollments), goalNovos = Math.max(0, goalTotal - goalRe)
  const dayInfo = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return null
    const a = new Date(cycle.start_date + 'T12:00:00').getTime(), b = new Date(cycle.end_date + 'T12:00:00').getTime(), t = Date.now()
    const total = Math.max(1, Math.round((b - a) / 864e5)), day = Math.min(total, Math.max(0, Math.round((t - a) / 864e5)))
    return { day, total, left: total - day }
  }, [cycle?.start_date, cycle?.end_date])
  const expectedToday = dayInfo ? Math.round(goalTotal * (dayInfo.day / dayInfo.total)) : 0
  const projected = dayInfo && dayInfo.day > 7 ? Math.round(prog.done / (dayInfo.day / dayInfo.total)) : null

  // evolução mês a mês (ano da campanha × ano anterior)
  const evo = useMemo(() => {
    const h = d.hist as { current: HistYear | null; years: HistYear[] } | null
    const cur = h?.current?.monthly ?? []
    const prevYear = h?.years?.length ? h.years[h.years.length - 1] : null
    // Matrículas lançadas no CRM por mês (todas as escolas têm); o histórico aluno a aluno, quando existe, tem prioridade no mês
    const by = new Map<string, number>()
    for (const e of (d.enr ?? []) as { enrollment_date: string }[]) {
      const m = new Date(new Date(e.enrollment_date).getTime() - 3 * 3600e3).toISOString().slice(0, 7)
      by.set(m, (by.get(m) ?? 0) + 1)
    }
    const keys = [...new Set([...cur.map(x => x.m), ...by.keys()])].sort().slice(-8)
    return keys.map(m => {
      const c = cur.find(x => x.m === m)
      const pm = `${Number(m.slice(0, 4)) - 1}-${m.slice(5, 7)}`
      const p = prevYear?.monthly.find(x => x.m === pm)
      return { m, novos: c ? c.novos : (by.get(m) ?? 0), re: c?.rematriculas ?? 0, prev: p ? p.novos + p.rematriculas : null }
    })
  }, [d.hist, d.enr])
  const evoMax = Math.max(5, ...evo.map(e => Math.max(e.novos + e.re, e.prev ?? 0)))

  // funil
  const STAGES: [string, string][] = [['contact', 'Contato'], ['scheduled', 'Agendou'], ['visit', 'Visitou'], ['proposal', 'Proposta'], ['enrolled', 'Matriculou']]
  const funRows = useMemo(() => {
    if (!fun) return []
    let prev = n0(fun.entraram)
    const out = [{ k: 'in', label: 'Entraram', n: n0(fun.entraram), step: null as number | null }]
    for (const [k, label] of STAGES) { const n = n0(fun.totais?.[k]?.n); out.push({ k, label, n, step: prev ? Math.round((n / prev) * 100) : null }); if (n > 0) prev = n }
    return out
  }, [fun]) // eslint-disable-line react-hooks/exhaustive-deps

  // equipe: junta usuários + atendimento + satisfação
  const team = useMemo(() => {
    const byName = new Map<string, Json>()
    for (const u of (usr?.usuarios ?? []) as Json[]) byName.set(String(u.nome), { nome: u.nome, perfil: u.perfil, matriculas: n0(u.matriculas), abertos: n0(u.leads_em_aberto), leads: n0(u.leads_no_periodo), conversas: n0(u.conversas), visitas: n0(u.visitas), acesso: u.ultimo_acesso })
    for (const a of (att?.por_atendente ?? []) as Json[]) { const r = byName.get(String(a.atendente)) ?? { nome: a.atendente, matriculas: 0, abertos: 0, leads: 0, conversas: 0, visitas: 0 }; r.resp = a.resp_mediana_min; r.sat = a.satisfacao; r.conversas = Math.max(n0(r.conversas), n0(a.conversas)); byName.set(String(a.atendente), r) }
    return [...byName.values()].filter(r => r.matriculas || r.leads || r.conversas || r.abertos).sort((a, b) => b.matriculas - a.matriculas || b.conversas - a.conversas || b.leads - a.leads).slice(0, 8)
  }, [usr, att])
  const respAvg = useMemo(() => {
    const l = ((att?.por_atendente ?? []) as Json[]).filter(a => a.resp_mediana_min != null)
    const w = l.reduce((s, a) => s + n0(a.conversas), 0)
    return w ? l.reduce((s, a) => s + n0(a.resp_mediana_min) * n0(a.conversas), 0) / w : null
  }, [att])
  const hours = useMemo(() => { const m = new Map<number, number>(); for (const h of (wa?.por_hora ?? []) as Json[]) m.set(n0(h.h), n0(h.n)); return Array.from({ length: 15 }, (_, i) => ({ h: i + 7, n: m.get(i + 7) ?? 0 })) }, [wa])
  const hMax = Math.max(1, ...hours.map(x => x.n))
  const peak = hours.reduce((a, b) => (b.n > a.n ? b : a), hours[0])

  // captação: top gatilhos
  const trig = useMemo(() => {
    const names = new Map<string, string>(((d.trigNames ?? []) as Json[]).map(t => [t.id, t.name]))
    return ((d.trig ?? []) as Json[]).map(t => ({ name: names.get(t.trigger_id) || 'Gatilho', hits: n0(t.hits), leads: n0(t.first_touch_leads) })).filter(t => t.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 4)
  }, [d.trig, d.trigNames])

  const invTotal = ((d.exps ?? []) as { amount: number }[]).reduce((s, e) => s + n0(e.amount), 0)
  const invBase = d.invBase as Json | null
  const market = cycle?.market_data as Json | null

  // alertas
  const alerts = [
    { key: 'us', n: waitingUs, label: 'Famílias esperando a escola', sub: 'sem resposta nossa', color: '#B91C1C', icon: AlertCircle, to: '/leads?filter=us' },
    { key: 'fila', n: n0(d.queue), label: 'Conversas na fila', sub: 'ninguém assumiu ainda', color: '#B45309', icon: MessageCircle, to: '/whatsapp' },
    { key: 'pay', n: overdueList.length, label: 'Pagamentos em atraso', sub: overdueList.length ? brl(overdueList.reduce((s, p) => s + n0(p.amount), 0)) : '', color: '#DC2626', icon: Wallet, to: '/settings' },
    { key: 'rem', n: prog.pending, label: 'Sem matrícula nem pré', sub: 'alunos da base que ainda não responderam', color: '#05907B', icon: GraduationCap, to: '/base-alunos' },
    { key: 'sem', n: n0(d.incomplete), label: 'Leads sem responsável', sub: 'ninguém da equipe assumiu', color: '#5B6B86', icon: UserX, to: '/leads?owner=unassigned' },
  ]
  const hot = alerts.filter(a => a.n > 0)

  const PERIODS: [PeriodKey, string][] = [['hoje', 'Hoje'], ['7d', '7 dias'], ['mes', 'Este mês'], ['ano', 'Ano'], ...(cycle ? [['campanha', 'Campanha'] as [PeriodKey, string]] : [])]

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 24px)', maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: '100%' }}>
      <PageHeader icon={LayoutDashboard} title={`${greeting()}, ${firstName(user?.full_name)}`}
        subtitle={<>{user?.institution_name || 'Sua escola'} · visão geral de {range.label}</>}
        actions={<>
          <div className="aion-hscroll aion-periods" data-tour="home-periodo" style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.28)', borderRadius: 14, padding: 4, flexWrap: 'wrap' }}>
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPeriod(k)} style={{ border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, padding: '6px 11px', borderRadius: 10, background: period === k ? '#fff' : 'transparent', color: period === k ? BRAND.primaryDark : '#fff', transition: 'background .15s' }}>{l}</button>
            ))}
          </div>
          {cycle?.score != null && cycle.score > 0 && (
            <button type="button" onClick={() => go('/campanha')} title="Score da campanha" style={{ border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.16)', color: '#fff', borderRadius: 14, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.05 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}><CountUp value={cycle.score} /></div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', opacity: .9 }}>Score</div>
            </button>
          )}
        </>} />

      {isMobile && !loading && (
        <div className="aion-hscroll" role="tablist" data-tour="home-abas" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '2px 12px', position: 'sticky', top: 0, zIndex: 20, background: 'linear-gradient(#F5FAF9 70%, rgba(245,250,249,0))' }}>
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" className="aion-tap" onClick={() => setTab(k)}
              style={{ flexShrink: 0, border: tab === k ? 'none' : '1px solid #E3E8F0', background: tab === k ? 'var(--aion-grad)' : '#fff', color: tab === k ? '#fff' : BRAND.muted, fontWeight: 800, fontSize: 13, padding: '8px 15px', borderRadius: 999, fontFamily: 'inherit', cursor: 'pointer', boxShadow: tab === k ? '0 8px 18px -10px rgba(0,122,110,.8)' : 'none' }}>{l}</button>
          ))}
        </div>
      )}

      {loading ? <PageSkeleton /> : <div style={{ display: 'contents' }}
        onTouchStart={e => { swipe.current = (e.target as Element).closest('.aion-snap, .aion-hscroll') ? null : { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
        onTouchEnd={e => {
          const s0 = swipe.current; swipe.current = null
          if (!s0 || !isMobile) return
          const dx = e.changedTouches[0].clientX - s0.x, dy = e.changedTouches[0].clientY - s0.y
          if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return
          const i = TABS.findIndex(t => t[0] === tab)
          const n = TABS[Math.max(0, Math.min(TABS.length - 1, i + (dx < 0 ? 1 : -1)))][0]
          if (n !== tab) { setTab(n); window.scrollTo?.({ top: 0 }) }
        }}>
        <T tab={tab} mobile={isMobile} id="resumo">
        {/* Precisa de você agora */}
        <section className="ld-in">
          <Head icon={Sparkles} title="Precisa de você agora" sub={hot.length ? 'Clique para resolver direto na tela certa' : 'Nada urgente por enquanto'} />
          {hot.length === 0 ? (
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, color: '#15803D', fontWeight: 700 }}><CheckCircle2 size={22} /> Tudo em dia: sem famílias esperando, fila vazia e nenhuma pendência.</div>
          ) : (
            <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
              {hot.map((a, i) => <Kpi key={a.key} label={a.label} value={<CountUp value={a.n} />} sub={a.sub} color={a.color} icon={a.icon} to={a.to} delay={i * 60} />)}
            </div>
          )}
        </section>

        {/* Resultados do período */}
        <section className="ld-in">
          <Head icon={GraduationCap} title="Resultados do período" sub={`${range.label} · comparado com o período anterior`} />
          <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <Kpi label="Matrículas" value={<CountUp value={n0(mat?.total)} />} color="#05907B" icon={GraduationCap} to="/reports?tab=matriculas" delay={0} sub={<Delta cur={n0(mat?.total)} prev={n0(mat?.anterior_total)} />} />
            <Kpi label="Leads novos" value={<CountUp value={n0(leads?.total)} />} color="#2DCBA4" icon={Users} to="/reports?tab=leads" delay={60} sub={<Delta cur={n0(leads?.total)} prev={n0(leads?.anterior?.total)} />} />
            <Kpi label="Conversão" value={pct(n0(mat?.total), n0(leads?.total)) != null ? `${pct(n0(mat?.total), n0(leads?.total))}%` : '—'} color="#00695F" icon={TrendingUp} to="/reports?tab=leads" delay={120} sub="matrículas ÷ leads do período" />
            <Kpi label="Tempo até matricular" value={mat?.dias_ate_matricular_mediana != null ? `${n0(mat.dias_ate_matricular_mediana)} dias` : '—'} color="#F59E0B" icon={Clock} to="/reports?tab=matriculas" delay={180} sub="mediana do primeiro contato à matrícula" />
            <Kpi label="Valor em matrículas" value={brl(((mat?.linhas ?? []) as Json[]).reduce((t, l) => t + n0(l['Valor da matrícula']), 0))} color="#B45309" icon={Wallet} to="/reports?tab=matriculas" delay={240} sub={`${n0(mat?.total)} matrículas no período`} />
          </div>
        </section>

        {/* Campanha */}
        {cycle && (
          <section className="ld-in" style={{ ...card, animationDelay: '80ms' }}>
            <Head icon={Flag} title={cycle.label || 'Campanha de matrículas'} sub={dayInfo ? `Dia ${dayInfo.day} de ${dayInfo.total} · faltam ${dayInfo.left} dias` : undefined} to="/campanha" label="Campanha" />
            <div style={{ display: 'flex', gap: 22, alignItems: 'center', flexWrap: 'wrap' }}>
              <Ring value={prog.done} max={goalTotal} label={`${pct(prog.done, goalTotal) ?? 0}%`} sub={`${prog.done} de ${goalTotal}`} />
              <div style={{ flex: 1, minWidth: 240, display: 'grid', gap: 11 }}>
                {([['Novos alunos', prog.novos, goalNovos, '#2DCBA4'], ['Rematrículas', prog.reMat, goalRe, '#05907B'], ['Pré-matriculados', prog.pre, Math.max(0, goalTotal - prog.done), '#F59E0B']] as const).map(([l, v, m, c]) => (
                  <div key={l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: BRAND.muted }}><span style={{ fontWeight: 700, color: BRAND.ink }}>{l}</span><span><b style={{ color: BRAND.ink }}>{v}</b>{l === 'Pré-matriculados' ? ` · faltam ${m} p/ meta` : ` de ${m}`}</span></div>
                    <div style={{ marginTop: 5 }}><Bar v={v} max={m} c={c} /></div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, minWidth: 240, flex: '0 1 300px' }}>
                {[
                  ['Esperado hoje', expectedToday ? String(expectedToday) : '—', prog.done >= expectedToday ? '#15803D' : '#B45309', expectedToday ? (prog.done >= expectedToday ? `+${prog.done - expectedToday} à frente` : `${expectedToday - prog.done} atrás do ritmo`) : ''],
                  ['Projeção final', projected != null ? String(projected) : '—', projected != null && projected >= goalTotal ? '#15803D' : '#B45309', projected != null ? `meta ${goalTotal}` : 'poucos dias de dados'],
                  ['Sem matrícula nem pré', String(prog.pending), '#B45309', 'ainda não responderam'], ['Só pré-matriculados', String(prog.pre), '#7C3AED', 'ainda não efetivaram'],
                  ['Saíram', String(prog.left), '#B91C1C', 'da base do ano'],
                ].map(([l, v, c, s]) => (
                  <div key={l} style={{ background: '#F8FBFA', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700 }}>{l}</div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: c as string, lineHeight: 1.15 }}>{v}</div>
                    <div style={{ fontSize: 11, color: BRAND.faint }}>{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        </T><T tab={tab} mobile={isMobile} id="matriculas">
        {/* Evolução de matrículas + funil */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16 }}>
          <section className="ld-in" style={{ ...card, animationDelay: '120ms' }}>
            <Head icon={GraduationCap} title="Evolução das matrículas" sub="Mês a mês: novatos × veteranos (rematrículas)" to="/reports?tab=matriculas" label="Matrículas" />
            {evo.length === 0 ? <div style={{ fontSize: 13, color: BRAND.faint, padding: '24px 0', textAlign: 'center' }}>Sem matrículas registradas na campanha ainda.</div> : <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 168, padding: '6px 2px 0' }}>
                {evo.map(e => {
                  const tot = e.novos + e.re
                  return (
                    <div key={e.m} title={`${MES[Number(e.m.slice(5, 7)) - 1]}/${e.m.slice(2, 4)}: ${e.novos} novatos + ${e.re} veteranos${e.prev != null ? ` · ano anterior ${e.prev}` : ''}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: BRAND.ink }}>{tot}</span>
                      <div style={{ width: '100%', maxWidth: 38, height: `${(tot / evoMax) * 118}px`, minHeight: tot ? 4 : 0, display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', position: 'relative', transition: 'height .9s cubic-bezier(.22,1,.36,1)' }}>
                        <span style={{ flex: e.novos, background: '#2DCBA4' }} /><span style={{ flex: e.re, background: 'var(--aion-grad)' }} />
                      </div>
                      {e.prev != null && <span aria-hidden style={{ width: '100%', maxWidth: 38, height: 3, borderRadius: 3, background: '#CBD5E1', marginTop: -1, opacity: .9, transform: `translateY(${(tot - e.prev) / evoMax * -118 + 0}px)`, display: 'none' }} />}
                      <span style={{ fontSize: 11, color: BRAND.muted, fontWeight: 700 }}>{MES[Number(e.m.slice(5, 7)) - 1]}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: BRAND.muted, marginTop: 10, alignItems: 'center' }}>
                <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: '#2DCBA4', marginRight: 5 }} />Novatos <b style={{ color: BRAND.ink }}>{evo.reduce((s, e) => s + e.novos, 0)}</b></span>
                {evo.some(e => e.re > 0) && <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: 'var(--aion-grad)', marginRight: 5 }} />Veteranos <b style={{ color: BRAND.ink }}>{evo.reduce((s, e) => s + e.re, 0)}</b></span>}
                {!evo.some(e => e.re > 0) && <button type="button" onClick={() => go('/base-alunos')} style={{ border: 'none', background: '#F1F5F9', color: BRAND.muted, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 999, padding: '4px 10px' }}>Veteranos aparecem quando a base de alunos for importada →</button>}
                <button type="button" onClick={() => go('/reports?tab=rematriculas')} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ver rematrículas →</button>
              </div>
            </>}
          </section>

          <section className="ld-in" style={{ ...card, animationDelay: '160ms' }}>
            <Head icon={Filter} title="Funil de leads" sub={cycle?.start_date ? 'Desde o início da campanha' : 'Últimos 90 dias'} to="/leads" label="Leads" />
            {funRows.length === 0 || !funRows[0].n ? <div style={{ fontSize: 13, color: BRAND.faint, padding: '24px 0', textAlign: 'center' }}>Sem leads no período.</div> : (
              <div style={{ display: 'grid', gap: 9 }}>
                {funRows.map((r, i) => (
                  <button key={r.k} type="button" onClick={() => go('/leads')} style={{ border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: BRAND.ink }}>{r.label}</span>
                      <span><b style={{ color: BRAND.ink }}>{r.n}</b>{r.step != null && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, color: r.step >= 50 ? '#15803D' : r.step >= 25 ? '#B45309' : '#B91C1C' }}>{r.step}% da etapa anterior</span>}</span>
                    </div>
                    <div style={{ marginTop: 4 }}><Bar v={r.n} max={funRows[0].n} c={i === 0 ? '#94A3B8' : i === funRows.length - 1 ? '#05907B' : '#2DCBA4'} h={10} /></div>
                  </button>
                ))}
                <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2 }}>Conversão geral: <b style={{ color: BRAND.ink }}>{pct(n0(fun?.totais?.enrolled?.n), n0(fun?.entraram)) ?? 0}%</b> dos leads viraram matrícula.</div>
              </div>
            )}
          </section>
        </div>

        </T><T tab={tab} mobile={isMobile} id="atendimento">
        {/* Atendimento */}
        <section className="ld-in" style={{ animationDelay: '200ms' }}>
          <Head icon={Headset} title="Atendimento" sub={`WhatsApp e satisfação · ${range.label}`} to="/reports?tab=atendimento" label="Relatório de atendimento" />
          <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12 }}>
            <Kpi label="Conversas" value={<CountUp value={n0(wa?.total)} />} color="#05907B" icon={MessageCircle} to="/reports?tab=whatsapp" sub={<Delta cur={n0(wa?.total)} prev={n0(wa?.anterior?.total)} />} />
            <Kpi label="Com atendente" value={`${pct(n0(wa?.com_atendente), n0(wa?.total)) ?? 0}%`} color="#0EA5E9" icon={Users} to="/reports?tab=atendimento" sub={`${n0(wa?.com_atendente)} de ${n0(wa?.total)} · ${n0(att?.sem_atendente)} sem atendente`} />
            <Kpi label="1ª resposta (mediana)" value={minLabel(respAvg)} color={respAvg != null && respAvg > 30 ? '#B45309' : '#15803D'} icon={Clock} to="/reports?tab=atendimento" sub="tempo até a primeira resposta humana" />
            <Kpi label="Satisfação" value={satPct(sat?.media) != null ? `${satPct(sat?.media)}%` : '—'} color="#F59E0B" icon={Smile} to="/reports?tab=satisfacao" sub={<>{n0(sat?.avaliacoes)} avaliações <Delta cur={sat?.media ?? null} prev={sat?.anterior?.media ?? null} /></>} />
            <Kpi label="Mensagens enviadas" value={<CountUp value={n0(wa?.msgs_enviadas_humano)} />} color="#2DCBA4" icon={TrendingUp} to="/reports?tab=whatsapp" sub={`${n0(wa?.msgs_enviadas_robo)} do robô · ${n0(wa?.msgs_recebidas)} recebidas`} />
          </div>
        </section>

        {/* Equipe */}
        <section className="ld-in" style={{ ...card, animationDelay: '240ms' }}>
          <Head icon={Trophy} title="Ranking da equipe" sub="Quem mais matricula e como está o atendimento de cada um" to="/reports?tab=usuarios" label="Relatório da equipe" />
          {team.length === 0 ? <div style={{ fontSize: 13, color: BRAND.faint, padding: '18px 0', textAlign: 'center' }}>Sem atividade da equipe no período.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead><tr>{['#', 'Pessoa', 'Matrículas', 'Leads em aberto', 'Conversas', '1ª resposta', 'Satisfação'].map((h, i) => <th key={h} style={{ textAlign: i < 2 ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {team.map((r, i) => (
                    <tr key={r.nome} onClick={() => go('/reports?tab=usuarios')} style={{ cursor: 'pointer' }}>
                      <td style={{ width: 34 }}>{i < 3 ? <Medal size={18} color={['#D4A017', '#94A3B8', '#B7791F'][i]} /> : <span style={{ color: BRAND.faint, fontWeight: 700 }}>{i + 1}</span>}</td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--aion-grad)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(String(r.nome))}</span><div><div style={{ fontWeight: 700, color: BRAND.ink }}>{r.nome}</div>{r.perfil && <div style={{ fontSize: 11, color: BRAND.faint }}>{r.perfil}</div>}</div></div></td>
                      <td style={{ textAlign: 'right', fontWeight: 800, color: r.matriculas ? '#05907B' : BRAND.faint }}>{r.matriculas}</td>
                      <td style={{ textAlign: 'right' }}>{r.abertos}</td>
                      <td style={{ textAlign: 'right' }}>{r.conversas}</td>
                      <td style={{ textAlign: 'right', color: r.resp != null && r.resp > 30 ? '#B45309' : BRAND.ink }}>{minLabel(r.resp)}</td>
                      <td style={{ textAlign: 'right' }}>{satPct(r.sat) != null ? <span style={{ fontWeight: 800, color: (satPct(r.sat) ?? 0) >= 80 ? '#15803D' : '#B45309' }}>{satPct(r.sat)}%</span> : <span style={{ color: BRAND.faint }}>—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 14, paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>Cronograma do dia: quando as famílias escrevem</span>
              <span style={{ fontSize: 12, color: BRAND.muted }}>{hours.some(x => x.n) ? <>pico às <b style={{ color: BRAND.ink }}>{peak.h}h</b> ({peak.n} mensagens) — garanta equipe nesse horário</> : 'sem mensagens no período'}</span>
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 78, marginTop: 10 }}>
              {hours.map(x => (
                <div key={x.h} title={`${x.h}h: ${x.n} mensagens recebidas`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 3 }}>
                  <div style={{ width: '100%', height: `${(x.n / hMax) * 52}px`, minHeight: x.n ? 3 : 0, borderRadius: 5, background: x === peak && x.n ? 'var(--aion-grad)' : '#B8E6DA', transition: 'height .8s cubic-bezier(.22,1,.36,1)' }} />
                  <span style={{ fontSize: 10, color: BRAND.faint, fontWeight: 700 }}>{x.h}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        </T><T tab={tab} mobile={isMobile} id="captacao">
        {/* Origem + Visitas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 16 }}>
          <section className="ld-in" style={{ ...card, animationDelay: '280ms' }}>
            <Head icon={Megaphone} title="De onde vêm os leads" sub={`${n0(leads?.total)} leads em ${range.label}`} to="/captacao" label="Captação" />
            {((leads?.por_origem ?? []) as Json[]).length === 0 ? <div style={{ fontSize: 13, color: BRAND.faint, padding: '18px 0', textAlign: 'center' }}>Sem leads no período.</div> : (
              <div style={{ display: 'grid', gap: 9 }}>
                {((leads?.por_origem ?? []) as Json[]).slice(0, 5).map(o => (
                  <div key={o.origem}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span style={{ fontWeight: 700, color: BRAND.ink }}>{o.origem || 'Sem origem'}</span><span><b>{o.leads}</b> <span style={{ color: BRAND.muted }}>· {o.matriculados} matriculados</span></span></div>
                    <div style={{ marginTop: 4 }}><Bar v={n0(o.leads)} max={n0(leads?.por_origem?.[0]?.leads)} c="#2DCBA4" /></div>
                  </div>
                ))}
              </div>
            )}
            {trig.length > 0 && (
              <div style={{ borderTop: `1px solid ${BRAND.line}`, marginTop: 12, paddingTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.muted, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Gatilhos da Captação que mais trouxeram</div>
                {trig.map(t => <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}><span style={{ color: BRAND.ink, fontWeight: 600 }}>{t.name}</span><span style={{ color: BRAND.muted }}><b style={{ color: BRAND.ink }}>{t.hits}</b> acionamentos · {t.leads} leads</span></div>)}
              </div>
            )}
          </section>

          <section className="ld-in" style={{ ...card, animationDelay: '320ms' }}>
            <Head icon={CalendarCheck} title="Visitas" sub={`${n0(vis?.total)} no período`} to="/visits" label="Visitas" />
            <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
              {([
                ['Realizadas', n0(vis?.realizadas), '#15803D'], ['Faltaram', n0(vis?.faltaram), '#B91C1C'], ['Canceladas', n0(vis?.canceladas), '#64748B'],
                ['Agendadas à frente', n0(vis?.agendadas_futuras), '#6366F1'], ['Matricularam após visita', n0(vis?.matriculados_apos_visita), '#05907B'],
              ] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} style={{ background: '#F8FBFA', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '9px 11px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c, lineHeight: 1.1 }}><CountUp value={v} /></div>
                  <div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
            {n0(vis?.realizadas) + n0(vis?.faltaram) > 0 && <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 10 }}>Comparecimento: <b style={{ color: BRAND.ink }}>{pct(n0(vis?.realizadas), n0(vis?.realizadas) + n0(vis?.faltaram))}%</b> · <button type="button" onClick={() => go('/reports?tab=leads')} style={{ border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontSize: 12.5 }}>relatório de leads e visitas →</button></div>}
          </section>
        </div>

        </T><T tab={tab} mobile={isMobile} id="financas">
        {/* Investimento + Saídas + Mercado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 16 }}>
          {cycle && (
            <section className="ld-in" style={{ ...card, animationDelay: '360ms' }}>
              <Head icon={Wallet2} title="Investimento da campanha" sub="Quanto foi investido e quanto custa cada aluno novo" to="/campanha" label="Campanha" />
              <div style={{ fontSize: 28, fontWeight: 800, color: BRAND.ink }}>{brl(invTotal)}</div>
              <div style={{ display: 'grid', gap: 4, fontSize: 13, color: BRAND.muted, marginTop: 6 }}>
                <div>Custo por lead <b style={{ color: BRAND.ink }}>{n0(invBase?.leads) ? brl(invTotal / n0(invBase?.leads)) : '—'}</b></div>
                <div>Custo por visita <b style={{ color: BRAND.ink }}>{n0(invBase?.visits) ? brl(invTotal / n0(invBase?.visits)) : '—'}</b></div>
                <div>Custo por aluno novo <b style={{ color: BRAND.ink }}>{n0(invBase?.novos) ? brl(invTotal / n0(invBase?.novos)) : '—'}</b></div>
              </div>
            </section>
          )}
          <section className="ld-in" style={{ ...card, animationDelay: '400ms' }}>
            <Head icon={DoorOpen} title="Saídas e transferências" sub={`Alunos que saíram em ${new Date().getFullYear()}`} to="/transferencias" label="Transferências" />
            <div style={{ fontSize: 28, fontWeight: 800, color: n0(trans?.exits) ? '#B91C1C' : BRAND.ink }}>{n0(trans?.exits)}</div>
            {((trans?.records?.reasons ?? []) as Json[]).length > 0 ? (
              <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
                {((trans?.records?.reasons ?? []) as Json[]).sort((a, b) => n0(b.n) - n0(a.n)).slice(0, 4).map(r => {
                  const L: Record<string, string> = { financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Distância', competition: 'Outra escola', relocation: 'Mudança de cidade', other: 'Outro' }
                  return <div key={r.reason}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: BRAND.ink, fontWeight: 600 }}>{L[r.reason] || r.reason}</span><b>{r.n}</b></div><Bar v={n0(r.n)} max={n0(trans?.records?.reasons?.[0]?.n)} c="#F87171" h={7} /></div>
                })}
              </div>
            ) : <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 6 }}>{((trans?.by_grade ?? []) as Json[])[0] ? <>Mais saídas em <b style={{ color: BRAND.ink }}>{trans!.by_grade[0].grade}</b> ({trans!.by_grade[0].n})</> : 'Motivos ainda não registrados.'}</div>}
          </section>
          {market && (market.total_private_schools || market.school_age_population || market.private_school_rate) && (
            <section className="ld-in" style={{ ...card, animationDelay: '440ms' }}>
              <Head icon={MapPin} title="Mercado" sub={[market.city, market.state].filter(Boolean).join(' / ') || undefined} to="/campanha" label="Campanha" />
              <div style={{ display: 'grid', gap: 6, fontSize: 13, color: BRAND.muted }}>
                {market.total_private_schools != null && <div>Escolas particulares <b style={{ color: BRAND.ink }}>{n0(market.total_private_schools)}</b></div>}
                {market.school_age_population != null && <div>População em idade escolar <b style={{ color: BRAND.ink }}>{n0(market.school_age_population).toLocaleString('pt-BR')}</b></div>}
                {market.private_school_rate != null && <div>Taxa de escola particular <b style={{ color: BRAND.ink }}>{n0(market.private_school_rate)}%</b></div>}
                {(market.sector_growth ?? market.sector_growth_rate) != null && <div>Crescimento do setor <b style={{ color: BRAND.ink }}>{n0(market.sector_growth ?? market.sector_growth_rate)}%</b></div>}
              </div>
            </section>
          )}
        </div>
        </T>
      </div>}
      {!loading && <div style={{ height: 8 }} />}
      <span style={{ display: 'none' }}><Skeleton /></span>
    </div>
  )
}
