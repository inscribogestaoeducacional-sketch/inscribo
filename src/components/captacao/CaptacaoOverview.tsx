// Captação Inteligente — visão geral (dashboard + captações + detalhe).
// Dados: RPCs capture_trigger_stats / _series / _visits / _leads.
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Megaphone, Plus, Copy, ExternalLink, Pencil, Pause, Play, Trash2, X, QrCode, Zap, MessageCircle,
  UserPlus, CalendarCheck, GraduationCap, TrendingUp, TrendingDown, Clock, AlertTriangle, Layers,
  PhoneOff, Hourglass, ChevronRight, Bot, Store, Download, Search,
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import QRCode from 'qrcode'
import PageHeader from '../ui/PageHeader'
import { LEADS_CSS } from '../leads/LeadsAttention'
import { supabase } from '../../lib/supabase'
import {
  type CaptureTrigger, CAPTURE_CHANNELS, buildWaMeLink, findOverlappingTriggers, formatDuration,
} from '../../lib/captureTriggers'

const TEAL = '#00A896', TEAL_D = '#007A6E', NAVY = '#1e2d6b', LINE = '#E3E8F0'

export interface Assignee { trigger_id: string; user_id: string | null; group_id: string | null }
interface Group { id: string; name: string; emoji: string | null }
interface Stat {
  trigger_id: string; hits: number; conversations: number; first_touch_contacts: number
  first_touch_leads: number; first_touch_enrollments: number; avg_first_response_seconds: number | null; responded_entries: number
}
interface SeriesRow { day: string; trigger_id: string; hits: number; conversations: number }
interface LeadRow { lead_id: string; name: string; lead_status: string; captured_at: string; has_visit: boolean; enrolled: boolean }

const PERIODS = [
  { key: 7, label: '7 dias' }, { key: 30, label: '30 dias' }, { key: 90, label: '90 dias' }, { key: 365, label: '12 meses' },
] as const

const LEAD_STATUS: Record<string, [string, string, string]> = {
  new: ['Novo', '#EFF6FF', '#1D4ED8'], contact: ['Em contato', '#FEF3C7', '#B45309'],
  scheduled: ['Visita agendada', '#EDE9FE', '#6D28D9'], visit: ['Visitou', '#E0F2FE', '#0369A1'],
  proposal: ['Proposta', '#FCE7F3', '#BE185D'], enrolled: ['Matriculado', '#D1FAE5', '#047857'],
  lost: ['Perdido', '#F1F5F9', '#64748B'],
}

const fmt = (n: number) => n.toLocaleString('pt-BR')
const pct = (a: number, b: number) => b > 0 ? `${Math.round((a / b) * 1000) / 10}%`.replace('.', ',') : '—'

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 720)
  useEffect(() => {
    const f = () => setM(window.innerWidth < 720)
    window.addEventListener('resize', f)
    return () => window.removeEventListener('resize', f)
  }, [])
  return m
}

const num = (r: any): Stat => ({
  ...r, hits: Number(r.hits), conversations: Number(r.conversations),
  first_touch_contacts: Number(r.first_touch_contacts), first_touch_leads: Number(r.first_touch_leads),
  first_touch_enrollments: Number(r.first_touch_enrollments), responded_entries: Number(r.responded_entries),
  avg_first_response_seconds: r.avg_first_response_seconds == null ? null : Number(r.avg_first_response_seconds),
})

export default function CaptacaoOverview(props: {
  institutionId: string
  triggers: CaptureTrigger[]            // já sem arquivados
  allTriggers: CaptureTrigger[]         // com arquivados (histórico)
  assignees: Assignee[]
  groups: Group[]
  userName: (id: string) => string
  schoolPhone: string
  loading: boolean
  campaign: { label: string; start: string } | null
  onNew: () => void
  onEdit: (t: CaptureTrigger) => void
  onToggle: (t: CaptureTrigger) => void
  onArchive: (t: CaptureTrigger) => void
  onCopy: (link: string | null) => void
  reloadKey: number
}) {
  const { institutionId, triggers, allTriggers, assignees, groups, userName, schoolPhone, loading, campaign } = props
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const [period, setPeriod] = useState<number | 'campanha'>(30)
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (campaign && !touched) setPeriod('campanha') }, [campaign, touched])

  const [stats, setStats] = useState<Stat[]>([])
  const [prev, setPrev] = useState<Stat[]>([])
  const [series, setSeries] = useState<SeriesRow[]>([])
  const [visits, setVisits] = useState<Record<string, number>>({})
  const [recent, setRecent] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(true)

  const [metric, setMetric] = useState<'conversations' | 'hits'>('conversations')
  const [filter, setFilter] = useState<'all' | 'on' | 'off' | 'vitrine'>('all')
  const [alertFilter, setAlertFilter] = useState<{ key: string; ids: Set<string> } | null>(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<string | null>(null)
  const [showTable, setShowTable] = useState(false)

  // Janela de consulta: calculada a cada carga (nunca congelada), para o "agora" ser sempre o de verdade.
  const windowFor = () => {
    const end = new Date(Date.now() + 60_000)
    const start = period === 'campanha' && campaign
      ? new Date(campaign.start + 'T00:00:00-03:00')
      : new Date(Date.now() - (period === 'campanha' ? 30 : period) * 86400000)
    const span = end.getTime() - start.getTime()
    return { start, end, pStart: new Date(start.getTime() - span), pEnd: start }
  }
  const [range, setRange] = useState(() => windowFor())
  const [tick, setTick] = useState(0)

  // Atualiza sozinho: a cada 45 s e ao voltar para a aba.
  useEffect(() => {
    const iv = setInterval(() => setTick(x => x + 1), 45_000)
    const vis = () => { if (document.visibilityState === 'visible') setTick(x => x + 1) }
    document.addEventListener('visibilitychange', vis)
    window.addEventListener('focus', vis)
    return () => { clearInterval(iv); document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', vis) }
  }, [])

  const loadedOnce = React.useRef(false)
  useEffect(() => {
    if (!institutionId) return
    let off = false
    const w = windowFor()
    setRange(w)
    if (!loadedOnce.current) setBusy(true)
    const p = { p_institution_id: institutionId }
    Promise.all([
      supabase.rpc('capture_trigger_stats', { ...p, p_start: w.start.toISOString(), p_end: w.end.toISOString() }),
      supabase.rpc('capture_trigger_stats', { ...p, p_start: w.pStart.toISOString(), p_end: w.pEnd.toISOString() }),
      supabase.rpc('capture_trigger_series', { ...p, p_start: w.start.toISOString(), p_end: w.end.toISOString() }),
      supabase.rpc('capture_trigger_visits', { ...p, p_start: w.start.toISOString(), p_end: w.end.toISOString() }),
      supabase.from('capture_trigger_hits').select('trigger_id').eq('institution_id', institutionId)
        .gte('matched_at', new Date(Date.now() - 10 * 86400000).toISOString()).limit(2000),
    ]).then(([a, b, c, d, e]) => {
      if (off) return
      setStats(((a.data ?? []) as any[]).map(num))
      setPrev(((b.data ?? []) as any[]).map(num))
      setSeries(((c.data ?? []) as any[]).map(r => ({ ...r, hits: Number(r.hits), conversations: Number(r.conversations) })))
      const v: Record<string, number> = {}
      ;((d.data ?? []) as any[]).forEach(r => { v[r.trigger_id] = Number(r.visits) })
      setVisits(v)
      setRecent(new Set(((e.data ?? []) as any[]).map(r => r.trigger_id as string)))
      loadedOnce.current = true
      setBusy(false)
    }).catch(() => { if (!off) setBusy(false) })
    return () => { off = true }
  }, [institutionId, period, campaign?.start, props.reloadKey, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sel) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [sel])

  const statOf = (id: string): Stat => stats.find(s => s.trigger_id === id) ?? {
    trigger_id: id, hits: 0, conversations: 0, first_touch_contacts: 0, first_touch_leads: 0,
    first_touch_enrollments: 0, avg_first_response_seconds: null, responded_entries: 0,
  }

  const sum = (rows: Stat[], vis?: Record<string, number>) => rows.reduce((a, r) => ({
    hits: a.hits + r.hits, conv: a.conv + r.conversations, contacts: a.contacts + r.first_touch_contacts,
    leads: a.leads + r.first_touch_leads, enr: a.enr + r.first_touch_enrollments,
    vis: a.vis + (vis ? (vis[r.trigger_id] || 0) : 0),
  }), { hits: 0, conv: 0, contacts: 0, leads: 0, enr: 0, vis: 0 })
  const cur = useMemo(() => sum(stats, visits), [stats, visits]) // eslint-disable-line react-hooks/exhaustive-deps
  const old = useMemo(() => sum(prev), [prev])

  const delta = (c: number, p: number) => {
    if (p === 0) return c > 0 ? { t: 'novo', up: true } : { t: '—', up: null as boolean | null }
    const d = Math.round(((c - p) / p) * 100)
    return { t: `${d > 0 ? '+' : ''}${d}%`, up: d >= 0 }
  }

  // ── alertas ──
  const alerts = useMemo(() => {
    const act = triggers.filter(t => t.is_active)
    const noReply = new Set(act.filter(t => t.skip_bot_flow && !t.auto_reply).map(t => t.id))
    const overlap = new Set<string>()
    act.forEach(t => findOverlappingTriggers(t.trigger_text, act.filter(o => o.id !== t.id)).forEach(o => { overlap.add(t.id); overlap.add(o.id) }))
    const stalled = new Set(act.filter(t => !recent.has(t.id) && Date.now() - new Date(t.created_at).getTime() > 10 * 86400000).map(t => t.id))
    return [
      { key: 'reply', ids: noReply, red: true, icon: AlertTriangle, text: (n: number) => `${n} sem resposta automática (pula o robô)` },
      { key: 'overlap', ids: overlap, red: false, icon: Layers, text: (n: number) => `${n} com texto parecido com outro` },
      { key: 'stalled', ids: stalled, red: false, icon: Hourglass, text: (n: number) => `${n} sem acionamento há 10 dias` },
    ].filter(a => a.ids.size > 0)
  }, [triggers, recent])

  // ── gráfico ──
  const chart = useMemo(() => {
    const ids = sel ? new Set([sel]) : null
    const byDay = new Map<string, number>()
    series.forEach(r => { if (!ids || ids.has(r.trigger_id)) byDay.set(r.day, (byDay.get(r.day) || 0) + (metric === 'hits' ? r.hits : r.conversations)) })
    const days: { d: string; v: number }[] = []
    const n = Math.min(Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000), 400)
    const step = n > 120 ? 7 : 1
    for (let i = 0; i < n; i += step) {
      let v = 0
      for (let j = 0; j < step && i + j < n; j++) {
        const dt = new Date(range.start.getTime() + (i + j) * 86400000)
        const key = new Date(dt.getTime() - 3 * 3600000).toISOString().slice(0, 10)
        v += byDay.get(key) || 0
      }
      const dt = new Date(range.start.getTime() + i * 86400000 - 3 * 3600000)
      days.push({ d: `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`, v })
    }
    return days
  }, [series, sel, metric, range])

  // ── cartões ──
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return triggers
      .filter(t => filter === 'all' || (filter === 'on' && t.is_active) || (filter === 'off' && !t.is_active) || (filter === 'vitrine' && t.managed_by === 'vitrine'))
      .filter(t => !alertFilter || alertFilter.ids.has(t.id))
      .filter(t => !term || t.name.toLowerCase().includes(term) || t.trigger_text.toLowerCase().includes(term))
      .map(t => ({ t, s: statOf(t.id) }))
      .sort((a, b) => b.s.conversations - a.s.conversations || b.s.hits - a.s.hits)
  }, [triggers, filter, alertFilter, q, stats]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = sel ? allTriggers.find(t => t.id === sel) ?? null : null

  const kp = [
    { k: 'hits', label: 'Acionamentos', v: cur.hits, p: old.hits, icon: Zap, color: '#7C3AED', bg: '#EDE9FE', m: 'hits' as const },
    { k: 'conv', label: 'Conversas', v: cur.conv, p: old.conv, icon: MessageCircle, color: '#059669', bg: '#D1FAE5', m: 'conversations' as const },
    { k: 'leads', label: 'Leads', v: cur.leads, p: old.leads, icon: UserPlus, color: '#2563EB', bg: '#DBEAFE' },
    { k: 'vis', label: 'Visitas', v: cur.vis, p: -1, icon: CalendarCheck, color: '#6366F1', bg: '#E0E7FF' },
    { k: 'enr', label: 'Matrículas', v: cur.enr, p: old.enr, icon: GraduationCap, color: TEAL_D, bg: '#E6F7F5' },
  ]

  const hdrBtn = (primary?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 11, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', border: primary ? 'none' : '1px solid rgba(255,255,255,.4)',
    background: primary ? '#fff' : 'rgba(255,255,255,.16)', color: primary ? TEAL_D : '#fff', fontFamily: 'inherit',
  })
  const seg = (on: boolean): React.CSSProperties => ({
    padding: '6px 13px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    background: on ? '#E6F7F5' : 'transparent', color: on ? TEAL_D : '#64748b',
  })
  const segWrap: React.CSSProperties = { display: 'flex', gap: 3, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 11, padding: 3, width: 'fit-content', maxWidth: '100%', overflowX: 'auto' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{LEADS_CSS}</style>

      <PageHeader
        icon={Megaphone}
        compact={mobile}
        title="Captação Inteligente"
        subtitle="Descubra de qual anúncio veio cada conversa e o que ela virou"
        actions={<button onClick={props.onNew} style={hdrBtn(true)}><Plus size={15} /> Nova captação</button>}
      />

      {!loading && !schoolPhone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E', fontSize: 13 }}>
          <PhoneOff size={15} /> Nenhum número de WhatsApp ativo — o link e o QR code só são gerados com o número conectado.
        </div>
      )}

      {/* período */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={segWrap}>
          {[...(campaign ? [{ key: 'campanha' as const, label: campaign.label }] : []), ...PERIODS].map(p => (
            <button key={p.key} onClick={() => { setTouched(true); setPeriod(p.key) }} style={seg(period === p.key)}>{p.label}</button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>Comparado ao período anterior de mesma duração</span>
      </div>

      {/* alertas */}
      {alerts.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {alerts.map(a => {
            const on = alertFilter?.key === a.key
            const Icon = a.icon
            return (
              <button key={a.key} onClick={() => setAlertFilter(on ? null : { key: a.key, ids: a.ids })}
                className={a.red && !on ? 'ld-alert' : ''}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  background: a.red ? '#FEE2E2' : '#FEF3C7', color: a.red ? '#991B1B' : '#92400E',
                  border: `1.5px solid ${on ? (a.red ? '#DC2626' : '#D97706') : (a.red ? '#FECACA' : '#FDE68A')}`,
                }}>
                <Icon size={13} /> {a.text(a.ids.size)} {on && <X size={12} />}
              </button>
            )
          })}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0,1fr))' : 'repeat(5, minmax(0,1fr))', gap: 12 }}>
        {kp.map((k, i) => {
          const Icon = k.icon
          const d = k.p >= 0 ? delta(k.v, k.p) : null
          const pickable = !!k.m
          const on = pickable && metric === k.m
          return (
            <button key={k.k} className="ld-kpi ld-in" data-on={on ? 1 : 0} onClick={() => pickable && setMetric(k.m!)}
              style={{ background: '#fff', border: `1.5px solid ${on ? TEAL : LINE}`, borderRadius: 16, padding: '13px 14px', animationDelay: `${i * 40}ms`, cursor: pickable ? 'pointer' : 'default', gridColumn: mobile && i === 4 ? 'span 2' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 9, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} color={k.color} /></span>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{k.label}</span>
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, margin: '6px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{busy ? '…' : fmt(k.v)}</div>
              <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: d?.up === false ? '#DC2626' : d?.up ? '#059669' : '#94a3b8', fontWeight: 600 }}>
                {d ? <>{d.up === true && <TrendingUp size={12} />}{d.up === false && <TrendingDown size={12} />}{busy ? '' : d.t === '—' ? 'sem comparação' : `${d.t} vs. anterior`}</>
                  : k.k === 'vis' ? `${pct(k.v, cur.leads)} dos leads` : ''}
              </div>
            </button>
          )
        })}
      </div>

      {/* gráfico */}
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: '14px 14px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>
            {metric === 'hits' ? 'Acionamentos' : 'Conversas'} por {chart.length > 0 && Math.ceil((range.end.getTime() - range.start.getTime()) / 86400000) > 120 ? 'semana' : 'dia'}
            <span style={{ fontWeight: 500, color: '#64748b' }}> · {selected ? selected.name : 'todas as captações'}</span>
          </div>
          {selected && <button onClick={() => setSel(null)} style={{ border: `1px solid ${LINE}`, background: '#fff', borderRadius: 8, padding: '3px 9px', fontSize: 11, color: TEAL_D, cursor: 'pointer', fontFamily: 'inherit' }}>Ver todas</button>}
        </div>
        <div style={{ height: mobile ? 150 : 190 }}>
          {busy ? <div className="animate-pulse" style={{ height: '100%', borderRadius: 12, background: '#f8fafc' }} /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <defs><linearGradient id="capg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.35} /><stop offset="100%" stopColor={TEAL} stopOpacity={0.02} /></linearGradient></defs>
                <CartesianGrid stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 12 }} formatter={(v: any) => [v, metric === 'hits' ? 'Acionamentos' : 'Conversas']} />
                <Area type="monotone" dataKey="v" stroke={TEAL} strokeWidth={2.2} fill="url(#capg)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* lista */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>Suas captações ({list.length})</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {triggers.length > 5 && (
            <div style={{ position: 'relative' }}>
              <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 9, top: 10 }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar captação"
                style={{ padding: '7px 10px 7px 28px', borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 16, width: 170, outline: 'none' }} />
            </div>
          )}
          <div style={segWrap}>
            {([['all', 'Todas'], ['on', 'Ativas'], ['off', 'Pausadas'], ['vitrine', 'Vitrine']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={seg(filter === k)}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {[...Array(3)].map((_, i) => <div key={i} className="animate-pulse" style={{ height: 150, borderRadius: 16, background: '#fff', border: `1px solid ${LINE}` }} />)}
        </div>
      ) : triggers.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: '44px 24px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}><Megaphone size={24} color={TEAL_D} /></div>
          <p style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: NAVY }}>Crie sua primeira captação</p>
          <p style={{ margin: '0 auto 18px', maxWidth: 440, fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
            Uma captação para cada anúncio ou publicação. Quando a família manda a mensagem pré-preenchida, a conversa chega já marcada com a origem.
          </p>
          <button onClick={props.onNew} style={{ ...hdrBtn(true), background: TEAL, color: '#fff' }}><Plus size={15} /> Nova captação</button>
        </div>
      ) : list.length === 0 ? (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, padding: 28, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          Nenhuma captação neste filtro. <button onClick={() => { setFilter('all'); setAlertFilter(null); setQ('') }} style={{ color: TEAL_D, background: 'none', border: 'none', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Limpar filtros</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
          {list.map(({ t, s }, i) => {
            const ch = CAPTURE_CHANNELS[t.channel] ?? CAPTURE_CHANNELS.outro
            const vis = visits[t.id] || 0
            const steps = [
              ['Conversas', s.conversations, '#10B981'], ['Leads', s.first_touch_leads, '#3B82F6'],
              ['Visitas', vis, '#6366F1'], ['Matrículas', s.first_touch_enrollments, TEAL_D],
            ] as const
            const top = Math.max(s.conversations, s.first_touch_leads, 1)
            const flags = [alerts.find(a => a.key === 'reply')?.ids.has(t.id) && 'Sem resposta automática', alerts.find(a => a.key === 'stalled')?.ids.has(t.id) && 'Parada']
              .filter(Boolean) as string[]
            return (
              <div key={t.id} role="button" tabIndex={0} className="ld-card ld-in" onClick={() => setSel(t.id)}
                onKeyDown={e => { if (e.key === 'Enter') setSel(t.id) }}
                style={{ background: '#fff', border: `1.5px solid ${sel === t.id ? TEAL : LINE}`, borderRadius: 16, padding: 14, cursor: 'pointer', opacity: t.is_active ? 1 : 0.72, animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                    <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: ch.bg, color: ch.color }}>{ch.label}</span>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: t.is_active ? '#D1FAE5' : '#E2E8F0', color: t.is_active ? '#059669' : '#64748b', whiteSpace: 'nowrap' }}>{t.is_active ? 'Ativa' : 'Pausada'}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, margin: '12px 0 8px' }}>
                  {steps.map(([l, v, c]) => (
                    <div key={l}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, fontVariantNumeric: 'tabular-nums' }}>{busy ? '…' : fmt(v)}</div>
                      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{l}</div>
                      <div style={{ height: 5, borderRadius: 3, background: '#F1F5F9' }}><div style={{ height: '100%', borderRadius: 3, background: c, width: `${Math.min(100, (v / top) * 100)}%`, transition: 'width .5s ease' }} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> 1ª resposta <b style={{ color: NAVY }}>{formatDuration(s.avg_first_response_seconds)}</b></span>
                  <span style={{ color: TEAL_D, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>Detalhes <ChevronRight size={13} /></span>
                </div>
                {flags.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {flags.map(f => <span key={f} style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>{f}</span>)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* tabela comparativa */}
      {triggers.length > 0 && (
        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 18, overflow: 'hidden' }}>
          <button onClick={() => setShowTable(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>Comparar captações</span>
            <ChevronRight size={16} color="#64748b" style={{ transform: showTable ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
          </button>
          {showTable && (
            <div style={{ borderTop: '1px solid #F1F5F9' }}>
              <p style={{ margin: 0, padding: '10px 16px 0', fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
                Acionamentos e conversas contam todo match no período. Contatos, leads, visitas e matrículas usam o <strong>primeiro toque</strong> — cada contato conta só para a captação que o trouxe primeiro, então a soma nunca passa do total real.
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Captação', 'Acionamentos', 'Conversas', 'Contatos', 'Leads', 'Visitas', 'Matrículas', 'Contato → Matrícula', 'Lead → Matrícula', '1ª resposta'].map(c => (
                        <th key={c} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#94a3b8', textAlign: c === 'Captação' ? 'left' : 'right', textTransform: 'uppercase', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allTriggers.map(t => ({ t, s: statOf(t.id) }))
                      .filter(({ t, s }) => !t.archived_at || s.hits > 0 || s.first_touch_contacts > 0)
                      .sort((a, b) => b.s.conversations - a.s.conversations)
                      .map(({ t, s }) => {
                        const n: React.CSSProperties = { padding: '11px 14px', fontSize: 13, color: '#1e293b', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
                        return (
                          <tr key={t.id} className="ld-row" onClick={() => setSel(t.id)} style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}>
                            <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                              {t.name}{t.archived_at && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(excluída)</span>}
                              {!t.archived_at && !t.is_active && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(pausada)</span>}
                            </td>
                            <td style={n}>{fmt(s.hits)}</td><td style={n}>{fmt(s.conversations)}</td><td style={n}>{fmt(s.first_touch_contacts)}</td>
                            <td style={n}>{fmt(s.first_touch_leads)}</td><td style={n}>{fmt(visits[t.id] || 0)}</td>
                            <td style={{ ...n, fontWeight: 700, color: TEAL }}>{fmt(s.first_touch_enrollments)}</td>
                            <td style={n}>{pct(s.first_touch_enrollments, s.first_touch_contacts)}</td>
                            <td style={n}>{pct(s.first_touch_enrollments, s.first_touch_leads)}</td>
                            <td style={n}>{formatDuration(s.avg_first_response_seconds)}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <Detail
          t={selected} s={statOf(selected.id)} visits={visits[selected.id] || 0} mobile={mobile}
          institutionId={institutionId} range={range} schoolPhone={schoolPhone}
          own={assignees.filter(a => a.trigger_id === selected.id)} groups={groups} userName={userName}
          onClose={() => setSel(null)} onCopy={props.onCopy}
          onEdit={() => props.onEdit(selected)} onToggle={() => props.onToggle(selected)}
          onArchive={() => props.onArchive(selected)}
          onLead={id => navigate(`/leads?open=${id}`)}
        />
      )}
    </div>
  )
}

// ─────────────────────────── Detalhe ───────────────────────────
function Detail({ t, s, visits, mobile, institutionId, range, schoolPhone, own, groups, userName, onClose, onCopy, onEdit, onToggle, onArchive, onLead }: {
  t: CaptureTrigger; s: Stat; visits: number; mobile: boolean; institutionId: string
  range: { start: Date; end: Date }; schoolPhone: string; own: Assignee[]; groups: Group[]
  userName: (id: string) => string; onClose: () => void; onCopy: (l: string | null) => void
  onEdit: () => void; onToggle: () => void; onArchive: () => void; onLead: (id: string) => void
}) {
  const [leads, setLeads] = useState<LeadRow[] | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)
  const link = buildWaMeLink(schoolPhone, t.trigger_text)
  const ch = CAPTURE_CHANNELS[t.channel] ?? CAPTURE_CHANNELS.outro
  const vit = t.managed_by === 'vitrine'

  useEffect(() => {
    let off = false
    setLeads(null)
    supabase.rpc('capture_trigger_leads', {
      p_institution_id: institutionId, p_trigger_id: t.id,
      p_start: range.start.toISOString(), p_end: range.end.toISOString(),
    }).then(({ data }) => { if (!off) setLeads((data ?? []) as LeadRow[]) })
    return () => { off = true }
  }, [t.id, institutionId, range])

  useEffect(() => {
    setShowQr(false); setQr(null)
  }, [t.id])
  useEffect(() => {
    if (!showQr || !link || qr) return
    QRCode.toDataURL(link, { width: 280, margin: 1, color: { dark: '#1A2B4A', light: '#ffffff' } }).then(setQr).catch(() => setQr(null))
  }, [showQr, link, qr])

  const btn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 9, border: `1px solid ${LINE}`,
    background: '#fff', color: TEAL_D, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none',
  }
  const row = (l: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid #F1F5F9', fontSize: 12 }}>
      <span style={{ color: '#64748b', flexShrink: 0 }}>{l}</span><span style={{ color: NAVY, textAlign: 'right', fontWeight: 600 }}>{v}</span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'flex', justifyContent: 'flex-end', background: 'rgba(15,23,42,.38)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="ld-in"
        style={{ width: mobile ? '100%' : 460, maxWidth: '100%', height: '100%', overflowY: 'auto', background: '#F4F7FA', padding: 16, display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '-12px 0 40px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{t.name}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: ch.bg, color: ch.color }}>{ch.label}</span>
              <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: t.is_active ? '#D1FAE5' : '#E2E8F0', color: t.is_active ? '#059669' : '#64748b' }}>{t.archived_at ? 'Excluída' : t.is_active ? 'Ativa' : 'Pausada'}</span>
              {vit && <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#CCFBF1', color: '#0F766E', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Store size={10} /> Vitrine</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ ...btn, padding: 7 }}><X size={15} /></button>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '10px 12px', fontSize: 13, color: '#334155', fontStyle: 'italic' }}>“{t.trigger_text}”</div>

        {!t.archived_at && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button style={btn} disabled={!link} onClick={() => onCopy(link)}><Copy size={13} /> Copiar link</button>
            <button style={btn} disabled={!link} onClick={() => setShowQr(v => !v)}><QrCode size={13} /> QR code</button>
            {link && <a href={link} target="_blank" rel="noopener noreferrer" style={btn}><ExternalLink size={13} /> Testar</a>}
            <button style={btn} onClick={onEdit}><Pencil size={13} /> Editar</button>
            <button style={btn} onClick={onToggle}>{t.is_active ? <><Pause size={13} /> Pausar</> : <><Play size={13} /> Ativar</>}</button>
            {!vit && <button style={{ ...btn, color: '#DC2626' }} onClick={onArchive}><Trash2 size={13} /> Excluir</button>}
          </div>
        )}

        {showQr && (
          <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 14, textAlign: 'center' }}>
            {qr ? (
              <>
                <img src={qr} alt="QR code do link da captação" style={{ width: 200, height: 200 }} />
                <div style={{ marginTop: 8 }}>
                  <a href={qr} download={`qr-${t.name.replace(/\W+/g, '-').toLowerCase()}.png`} style={btn}><Download size={13} /> Baixar imagem</a>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8' }}>Abre o WhatsApp da escola com a mensagem pronta. Serve para cartaz, panfleto e redes sociais.</p>
              </>
            ) : <span style={{ fontSize: 12, color: '#64748b' }}>Gerando…</span>}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {([['Conversas', s.conversations], ['Leads', s.first_touch_leads], ['Visitas', visits], ['Matrículas', s.first_touch_enrollments]] as const).map(([l, v]) => (
            <div key={l} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 12, padding: '9px 10px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{fmt(v)}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>Contato → matrícula <b style={{ color: NAVY }}>{pct(s.first_touch_enrollments, s.first_touch_contacts)}</b></span>
          <span>Lead → matrícula <b style={{ color: NAVY }}>{pct(s.first_touch_enrollments, s.first_touch_leads)}</b></span>
          <span>1ª resposta <b style={{ color: NAVY }}>{formatDuration(s.avg_first_response_seconds)}</b></span>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 6 }}>Leads trazidos no período</div>
          {leads === null ? (
            <div className="animate-pulse" style={{ height: 60, borderRadius: 10, background: '#f8fafc' }} />
          ) : leads.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Nenhum lead veio por esta captação no período.</p>
          ) : leads.map(l => {
            const [lab, bg, fg] = LEAD_STATUS[l.lead_status] ?? [l.lead_status, '#F1F5F9', '#64748b']
            return (
              <div key={l.lead_id} className="ld-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #F1F5F9' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 3, alignItems: 'center' }}>
                    <span style={{ padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color: fg }}>{lab}</span>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{new Date(l.captured_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                  </div>
                </div>
                <button style={btn} onClick={() => onLead(l.lead_id)}>Ver lead</button>
              </div>
            )
          })}
        </div>

        <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '4px 14px 8px' }}>
          {row('Robô', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bot size={12} />{t.skip_bot_flow ? 'Pula o robô' : 'Robô normal'}</span>)}
          {row('Distribuição', !t.skip_bot_flow ? 'Pelo fluxo do robô' : own.length === 0 ? 'Fila geral'
            : own.map(a => { const g = a.group_id ? groups.find(x => x.id === a.group_id) : null; return g ? `${g.emoji || '👥'} ${g.name}` : userName(a.user_id!) }).join(', '))}
          {row('Resposta automática', t.auto_reply ? <span style={{ fontWeight: 500, maxWidth: 240, display: 'inline-block' }}>{t.auto_reply}</span> : 'Nenhuma')}
          {row('Etiqueta de origem', t.tag_name || '—')}
          {row('IDs de anúncio (Meta)', t.meta_ad_ids?.length ? `${t.meta_ad_ids.length} cadastrado${t.meta_ad_ids.length > 1 ? 's' : ''}` : '—')}
          {row('Criada em', new Date(t.created_at).toLocaleDateString('pt-BR'))}
        </div>
      </div>
    </div>
  )
}
