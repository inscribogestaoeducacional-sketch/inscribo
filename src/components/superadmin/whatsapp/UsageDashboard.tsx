// Painel de consumo do WhatsApp (Super Admin). Usado em dois lugares:
//  - Financeiro > WhatsApp (todas as escolas)
//  - aba WhatsApp > Uso, dentro de cada escola (institutionId)
// Sem valores em dinheiro: só quantidades, como a Meta conta (modelos por categoria, conversas, mensagens).
// Fonte: whatsapp_usage_report e whatsapp_usage_report_daily (leem whatsapp_messages, horário de Brasília).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { ChevronLeft, ChevronRight, Download, MessageCircle, Send, Inbox, FileText, AlertTriangle, CheckCheck, Eye, Sparkles } from 'lucide-react'

type Row = {
  institution_id: string; name: string
  received: number; sent: number; sent_template: number
  conversations: number; conv_by_client: number; conv_by_school: number
  failed: number; delivered_pct: number | null; read_pct: number | null
  tpl_marketing: number; tpl_utility: number; tpl_auth: number
  ai_improve: number; ai_summary: number; last_received: string | null
}
type Day = { day: string; received: number; sent: number; tpl_marketing: number; tpl_utility: number; tpl_auth: number }
type Reason = { code: string; total: number; last_at: string | null }

// Cores (validadas com a skill dataviz): enviadas/recebidas e as 3 categorias da Meta.
const C = {
  sent: '#2a78d6', received: '#1baf7a',
  marketing: '#eb6834', utility: '#6250d6', auth: '#e87ba4',
}

const REASON: Record<string, string> = {
  '131026': 'A mensagem não foi entregue: o número não tem WhatsApp, está inválido ou a família bloqueou a escola.',
  '131047': 'Fora da janela de 24h: só dá para enviar um modelo aprovado depois de 24h sem resposta da família.',
  '131049': 'A Meta segurou o envio de marketing para essa pessoa (limite de qualidade).',
  '131048': 'Limite de spam: a Meta limitou os envios desse número.',
  '131042': 'Problema de pagamento ou elegibilidade da conta na Meta. Confira a forma de pagamento no gerenciador.',
  '130472': 'O número da família está em um teste da Meta e não recebeu o modelo.',
  '131008': 'Faltou um parâmetro no modelo (variável vazia).',
  '131009': 'Valor de parâmetro inválido no modelo.',
  '131051': 'Tipo de mensagem não aceito.',
  '131053': 'Não foi possível enviar a mídia (arquivo inválido).',
  'sem motivo': 'Falha sem motivo registrado (envios antigos).',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s: string) => new Date(`${s}T12:00:00`)
const fmt = (n: number | string | null | undefined) => Number(n ?? 0).toLocaleString('pt-BR')
const fmtDay = (s: string) => parse(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((t, x) => t + Number(f(x) || 0), 0)

function monthRange(offset: number) {
  const n = new Date()
  const a = new Date(n.getFullYear(), n.getMonth() + offset, 1)
  const b = new Date(n.getFullYear(), n.getMonth() + offset + 1, 0)
  return { from: iso(a), to: iso(b) }
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (!prev && !cur) return <span className="text-[11px] text-gray-400">sem dados no período anterior</span>
  if (!prev) return <span className="text-[11px] text-gray-400">novo no período</span>
  const p = Math.round(((cur - prev) / prev) * 100)
  if (p === 0) return <span className="text-[11px] text-gray-400">igual ao período anterior</span>
  return <span className="text-[11px] text-gray-500">{p > 0 ? '▲' : '▼'} {Math.abs(p)}% vs. período anterior</span>
}

function Stat({ icon: Icon, label, value, sub, delta }: any) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-teal-600" />
        <p className="text-xs font-semibold text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      {delta}
    </div>
  )
}

// Gráfico de linhas por dia (enviadas x recebidas), SVG simples com dica ao passar o mouse
function DailyChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720, H = 230, L = 44, R = 12, T = 12, B = 26
  const max = Math.max(1, ...days.map(d => Math.max(d.sent, d.received)))
  const step = max <= 10 ? 2 : Math.pow(10, Math.floor(Math.log10(max)))
  const top = Math.ceil(max / step) * step
  const x = (i: number) => L + (days.length <= 1 ? 0 : (i * (W - L - R)) / (days.length - 1))
  const y = (v: number) => T + (1 - v / top) * (H - T - B)
  const path = (k: 'sent' | 'received') => days.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(top * t))
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const i = Math.round(((px - L) / (W - L - R)) * (days.length - 1))
    setHover(Math.max(0, Math.min(days.length - 1, i)))
  }
  const h = hover != null ? days[hover] : null
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Mensagens enviadas e recebidas por dia">
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth="1" />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{fmt(t)}</text>
          </g>
        ))}
        {days.map((d, i) => (i === days.length - 1 || (i % Math.ceil(days.length / 8) === 0 && days.length - 1 - i >= Math.ceil(days.length / 8) / 2)) && (
          <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{fmtDay(d.day)}</text>
        ))}
        <path d={path('received')} fill="none" stroke={C.received} strokeWidth="2" strokeLinejoin="round" />
        <path d={path('sent')} fill="none" stroke={C.sent} strokeWidth="2" strokeLinejoin="round" />
        {hover != null && h && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(h.sent)} r="4" fill={C.sent} stroke="#fff" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(h.received)} r="4" fill={C.received} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover != null && h && (
        <div className="absolute top-0 pointer-events-none bg-white border border-gray-200 rounded-lg shadow-md px-3 py-2 text-xs"
          style={{ left: `${Math.min(78, Math.max(0, (x(hover) / W) * 100 - 8))}%` }}>
          <p className="font-semibold text-gray-800 mb-1">{parse(h.day).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>
          <p className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full" style={{ background: C.sent }} /> Enviadas <b className="ml-1 text-gray-900">{fmt(h.sent)}</b></p>
          <p className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full" style={{ background: C.received }} /> Recebidas <b className="ml-1 text-gray-900">{fmt(h.received)}</b></p>
        </div>
      )}
    </div>
  )
}

export default function UsageDashboard({ institutionId, institutionName }: { institutionId?: string; institutionName?: string }) {
  const [mode, setMode] = useState<'month' | 'custom'>('month')
  const [offset, setOffset] = useState(0)
  const [custom, setCustom] = useState(() => monthRange(0))
  const [rows, setRows] = useState<Row[]>([])
  const [prevRows, setPrevRows] = useState<Row[]>([])
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Reason[] | null>(null)
  const [exporting, setExporting] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const range = mode === 'month' ? monthRange(offset) : custom
  const prev = useMemo(() => {
    if (mode === 'month') return monthRange(offset - 1)
    const a = parse(range.from), b = parse(range.to)
    const len = Math.round((b.getTime() - a.getTime()) / 864e5) + 1
    const pb = new Date(a.getTime() - 864e5), pa = new Date(pb.getTime() - (len - 1) * 864e5)
    return { from: iso(pa), to: iso(pb) }
  }, [mode, offset, range.from, range.to])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true); setError(''); setOpenId(null)
      const [cur, pr, dy] = await Promise.all([
        supabase.rpc('whatsapp_usage_report', { p_from: range.from, p_to: range.to }),
        supabase.rpc('whatsapp_usage_report', { p_from: prev.from, p_to: prev.to }),
        supabase.rpc('whatsapp_usage_report_daily', { p_from: range.from, p_to: range.to, p_institution: institutionId ?? null }),
      ])
      if (cancelled) return
      const err = cur.error || pr.error || dy.error
      if (err) { setError(/function|schema cache/i.test(err.message) ? 'O painel ainda não está disponível (falta aplicar a migration do relatório de WhatsApp).' : err.message); setRows([]); setPrevRows([]); setDays([]) }
      else {
        setRows((cur.data ?? []) as Row[]); setPrevRows((pr.data ?? []) as Row[])
        // completa os dias sem mensagem com zero, para o gráfico não "pular"
        const map = new Map<string, Day>(((dy.data ?? []) as Day[]).map(d => [String(d.day).slice(0, 10), { ...d, day: String(d.day).slice(0, 10) }]))
        const out: Day[] = []
        for (let d = parse(range.from); iso(d) <= range.to; d = new Date(d.getTime() + 864e5)) {
          const k = iso(d); out.push(map.get(k) ?? { day: k, received: 0, sent: 0, tpl_marketing: 0, tpl_utility: 0, tpl_auth: 0 })
        }
        setDays(out)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [range.from, range.to, prev.from, prev.to, institutionId])

  const scope = useMemo(() => institutionId ? rows.filter(r => r.institution_id === institutionId) : rows, [rows, institutionId])
  const prevScope = useMemo(() => institutionId ? prevRows.filter(r => r.institution_id === institutionId) : prevRows, [prevRows, institutionId])
  const tot = (a: Row[], f: (r: Row) => number) => sum(a, f)
  const cats = [
    { k: 'tpl_marketing' as const, label: 'Marketing', color: C.marketing },
    { k: 'tpl_utility' as const, label: 'Utilidade', color: C.utility },
    { k: 'tpl_auth' as const, label: 'Autenticação', color: C.auth },
  ]
  const catTotal = sum(cats, c => tot(scope, r => r[c.k]))
  const ok = tot(scope, r => r.sent) - tot(scope, r => r.failed)
  const wDlv = scope.reduce((t, r) => t + (Number(r.delivered_pct) || 0) * Math.max(0, Number(r.sent) - Number(r.failed)), 0)
  const wRd = scope.reduce((t, r) => t + (Number(r.read_pct) || 0) * Math.max(0, Number(r.sent) - Number(r.failed)), 0)
  const dlvPct = ok > 0 ? Math.round((wDlv / ok) * 10) / 10 : null
  const rdPct = ok > 0 ? Math.round((wRd / ok) * 10) / 10 : null
  const ranking = [...scope].sort((a, b) => (b.sent + b.received) - (a.sent + a.received))
  const rankMax = Math.max(1, ...ranking.map(r => r.sent + r.received))
  const periodLabel = mode === 'month'
    ? parse(range.from).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase()).replace(' De ', ' de ')
    : `${parse(range.from).toLocaleDateString('pt-BR')} a ${parse(range.to).toLocaleDateString('pt-BR')}`
  const who = institutionId ? (institutionName || scope[0]?.name || 'Escola') : 'Todas as escolas'

  const toggleReasons = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id); setReasons(null)
    const { data } = await supabase.rpc('whatsapp_failure_reasons', { p_inst: id, p_month: range.from.slice(0, 8) + '01' })
    setReasons((data ?? []) as Reason[])
  }

  const exportPdf = async () => {
    if (!reportRef.current) return
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const jsPDF = (await import('jspdf')).default
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true, backgroundColor: '#F9FAFB', ignoreElements: el => el.classList?.contains('no-pdf') })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight()
      const m = 24, iw = pw - m * 2
      const sliceH = Math.floor(((ph - m * 2) * canvas.width) / iw)
      for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
        const part = document.createElement('canvas')
        part.width = canvas.width; part.height = Math.min(sliceH, canvas.height - y)
        part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height)
        if (page > 0) pdf.addPage()
        pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, iw, (part.height * iw) / canvas.width)
      }
      const slug = who.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      pdf.save(`whatsapp-${slug}-${range.from}-a-${range.to}.pdf`)
    } finally { setExporting(false) }
  }

  const btn = 'px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 bg-white'
  return (
    <div className="space-y-4">
      {/* Controles (não entram no PDF) */}
      <div className="no-pdf flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5">
          {(['month', 'custom'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${mode === m ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{m === 'month' ? 'Mês' : 'Período livre'}</button>
          ))}
        </div>
        {mode === 'month' ? (
          <div className="inline-flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)} className={btn} aria-label="Mês anterior"><ChevronLeft className="w-3.5 h-3.5" /></button>
            <span className="px-2 text-sm font-semibold text-gray-800 min-w-[120px] whitespace-nowrap text-center">{periodLabel}</span>
            <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset === 0} className={`${btn} disabled:opacity-40`} aria-label="Próximo mês"><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 text-xs text-gray-500">
            <input type="date" value={custom.from} max={custom.to} onChange={e => e.target.value && setCustom(c => ({ ...c, from: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700" />
            até
            <input type="date" value={custom.to} min={custom.from} onChange={e => e.target.value && setCustom(c => ({ ...c, to: e.target.value }))} className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white text-gray-700" />
          </div>
        )}
        <button onClick={exportPdf} disabled={exporting || loading || !!error} className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> {exporting ? 'Gerando…' : 'Exportar PDF'}
        </button>
      </div>

      {/* Relatório (é isto que vai para o PDF) */}
      <div ref={reportRef} className="space-y-4 bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-gray-900">Uso do WhatsApp · {who}</p>
            <p className="text-xs text-gray-500 mt-0.5">{periodLabel}{mode === 'custom' ? '' : ` · de ${parse(range.from).toLocaleDateString('pt-BR')} a ${parse(range.to).toLocaleDateString('pt-BR')}`}</p>
          </div>
          <p className="text-[11px] text-gray-400">Áion Edu · gerado em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
        </div>

        {loading ? (
          <p className="px-2 py-8 text-sm text-gray-400">Carregando…</p>
        ) : error ? (
          <p className="px-2 py-6 text-sm text-amber-700">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat icon={MessageCircle} label="Conversas" value={fmt(tot(scope, r => r.conversations))}
                sub={`${fmt(tot(scope, r => r.conv_by_client))} abertas pelo cliente · ${fmt(tot(scope, r => r.conv_by_school))} pela escola`}
                delta={<Delta cur={tot(scope, r => r.conversations)} prev={tot(prevScope, r => r.conversations)} />} />
              <Stat icon={Send} label="Mensagens enviadas" value={fmt(tot(scope, r => r.sent))}
                delta={<Delta cur={tot(scope, r => r.sent)} prev={tot(prevScope, r => r.sent)} />} />
              <Stat icon={Inbox} label="Mensagens recebidas" value={fmt(tot(scope, r => r.received))}
                delta={<Delta cur={tot(scope, r => r.received)} prev={tot(prevScope, r => r.received)} />} />
              <Stat icon={FileText} label="Modelos enviados" value={fmt(tot(scope, r => r.sent_template))}
                delta={<Delta cur={tot(scope, r => r.sent_template)} prev={tot(prevScope, r => r.sent_template)} />} />
              <Stat icon={AlertTriangle} label="Falhas de envio" value={fmt(tot(scope, r => r.failed))}
                delta={<Delta cur={tot(scope, r => r.failed)} prev={tot(prevScope, r => r.failed)} />} />
              <Stat icon={CheckCheck} label="Entregues" value={dlvPct == null ? '—' : `${String(dlvPct).replace('.', ',')}%`} sub="das mensagens enviadas sem falha" />
              <Stat icon={Eye} label="Lidas" value={rdPct == null ? '—' : `${String(rdPct).replace('.', ',')}%`} sub="das mensagens enviadas sem falha" />
              <Stat icon={Sparkles} label="IA (melhorar texto e resumos)" value={fmt(tot(scope, r => r.ai_improve + r.ai_summary))} sub="usos no período" />
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-gray-900">Mensagens por dia</p>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.sent }} /> Enviadas <b className="text-gray-900">{fmt(sum(days, d => d.sent))}</b></span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C.received }} /> Recebidas <b className="text-gray-900">{fmt(sum(days, d => d.received))}</b></span>
                </div>
              </div>
              <DailyChart days={days} />
              <details className="no-pdf mt-3 text-xs text-gray-500">
                <summary className="cursor-pointer font-semibold">Ver tabela do dia a dia</summary>
                <div className="max-h-56 overflow-auto mt-2">
                  <table className="w-full text-xs"><thead><tr className="text-left text-gray-400"><th className="py-1">Dia</th><th className="text-right">Enviadas</th><th className="text-right">Recebidas</th></tr></thead>
                    <tbody>{days.map(d => <tr key={d.day} className="border-t border-gray-100"><td className="py-1">{fmtDay(d.day)}</td><td className="text-right">{fmt(d.sent)}</td><td className="text-right">{fmt(d.received)}</td></tr>)}</tbody></table>
                </div>
              </details>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-sm font-bold text-gray-900">Modelos por categoria</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">A Meta separa os modelos nestas três categorias. Respostas ao cliente dentro de 24h (atendimento) não entram aqui.</p>
              {catTotal === 0 ? <p className="text-sm text-gray-400">Nenhum modelo enviado no período.</p> : (
                <div className="space-y-3">
                  {cats.map(c => {
                    const v = tot(scope, r => r[c.k]); const pct = catTotal ? Math.round((v / catTotal) * 100) : 0
                    return (
                      <div key={c.k}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 font-semibold text-gray-700"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: c.color }} />{c.label}</span>
                          <span className="text-gray-600"><b className="text-gray-900">{fmt(v)}</b> · {pct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} /></div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {!institutionId && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Consumo por escola</p>
                  <p className="text-xs text-gray-500 mt-0.5">Mensagens enviadas e recebidas somadas.</p></div>
                <div className="px-5 py-4 space-y-2.5">
                  {ranking.filter(r => r.sent + r.received > 0).map(r => (
                    <div key={r.institution_id} className="flex items-center gap-3 text-xs">
                      <span className="w-40 sm:w-56 truncate font-semibold text-gray-700">{r.name}</span>
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${((r.sent + r.received) / rankMax) * 100}%`, background: C.sent }} /></div>
                      <span className="w-16 text-right font-bold text-gray-900">{fmt(r.sent + r.received)}</span>
                    </div>
                  ))}
                  {ranking.every(r => r.sent + r.received === 0) && <p className="text-sm text-gray-400">Nenhuma mensagem no período.</p>}
                </div>
                <div className="overflow-x-auto border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-50 text-xs text-gray-500">
                      {['Escola', 'Conversas', 'Enviadas', 'Recebidas', 'Marketing', 'Utilidade', 'Autent.', 'Falhas', 'Entregues', 'Lidas'].map((h, i) => <th key={h} className={`px-3 py-2.5 font-semibold whitespace-nowrap ${i ? 'text-right' : 'text-left'}`}>{h}</th>)}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {ranking.map(r => (
                        <Fragment key={r.institution_id}>
                          <tr className="hover:bg-gray-50">
                            <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">
                              <Link to={`/super-admin/schools/${r.institution_id}?tab=whatsapp`} className="hover:underline text-teal-700">{r.name}</Link>
                            </td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.conversations)}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.sent)}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.received)}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.tpl_marketing)}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.tpl_utility)}</td>
                            <td className="px-3 py-2.5 text-right">{fmt(r.tpl_auth)}</td>
                            <td className="px-3 py-2.5 text-right">
                              {r.failed > 0 ? <button onClick={() => toggleReasons(r.institution_id)} className="no-pdf-btn font-bold text-red-600 underline decoration-dotted">{fmt(r.failed)}</button> : <span className="text-gray-300">0</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right">{r.delivered_pct != null ? `${String(r.delivered_pct).replace('.', ',')}%` : '—'}</td>
                            <td className="px-3 py-2.5 text-right">{r.read_pct != null ? `${String(r.read_pct).replace('.', ',')}%` : '—'}</td>
                          </tr>
                          {openId === r.institution_id && (
                            <tr className="bg-gray-50"><td colSpan={10} className="px-5 py-3">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Por que as mensagens falharam em {parse(range.from).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                              {reasons === null ? <p className="text-xs text-gray-400">Carregando…</p> : reasons.map(x => (
                                <div key={x.code} className="flex gap-3 text-xs py-1">
                                  <span className="font-bold text-gray-900 w-10 text-right shrink-0">{fmt(x.total)}</span>
                                  <span className="text-gray-700 flex-1">{REASON[x.code] ?? `Erro ${x.code} da Meta.`} <span className="text-gray-400">{x.code !== 'sem motivo' ? `(código ${x.code})` : ''}</span></span>
                                </div>
                              ))}
                            </td></tr>
                          )}
                        </Fragment>
                      ))}
                      <tr className="bg-gray-50 font-semibold">
                        <td className="px-3 py-2.5">Total</td>
                        {[tot(scope, r => r.conversations), tot(scope, r => r.sent), tot(scope, r => r.received), tot(scope, r => r.tpl_marketing), tot(scope, r => r.tpl_utility), tot(scope, r => r.tpl_auth), tot(scope, r => r.failed)].map((v, i) => <td key={i} className="px-3 py-2.5 text-right">{fmt(v)}</td>)}
                        <td className="px-3 py-2.5 text-right">{dlvPct == null ? '—' : `${String(dlvPct).replace('.', ',')}%`}</td>
                        <td className="px-3 py-2.5 text-right">{rdPct == null ? '—' : `${String(rdPct).replace('.', ',')}%`}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <MetaReport from={range.from} to={range.to} institutionId={institutionId} names={Object.fromEntries(rows.map(r => [r.institution_id, r.name]))} />

            {institutionId && tot(scope, r => r.failed) > 0 && (
              <FailureBlock institutionId={institutionId} monthStart={range.from.slice(0, 8) + '01'} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function FailureBlock({ institutionId, monthStart }: { institutionId: string; monthStart: string }) {
  const [reasons, setReasons] = useState<Reason[] | null>(null)
  useEffect(() => {
    let off = false
    void supabase.rpc('whatsapp_failure_reasons', { p_inst: institutionId, p_month: monthStart }).then(({ data }) => { if (!off) setReasons((data ?? []) as Reason[]) })
    return () => { off = true }
  }, [institutionId, monthStart])
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <p className="text-sm font-bold text-gray-900 mb-2">Por que as mensagens falharam</p>
      {reasons === null ? <p className="text-xs text-gray-400">Carregando…</p> : reasons.map(x => (
        <div key={x.code} className="flex gap-3 text-xs py-1">
          <span className="font-bold text-gray-900 w-10 text-right shrink-0">{fmt(x.total)}</span>
          <span className="text-gray-700 flex-1">{REASON[x.code] ?? `Erro ${x.code} da Meta.`} <span className="text-gray-400">{x.code !== 'sem motivo' ? `(código ${x.code})` : ''}</span></span>
        </div>
      ))}
    </div>
  )
}

const CAT_LABEL: Record<string, string> = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação', AUTHENTICATION_INTERNATIONAL: 'Autenticação (internacional)', SERVICE: 'Atendimento (grátis)', MARKETING_LITE: 'Marketing lite' }

// Valores reais cobrados pela Meta (pricing_analytics). Só aparece ao clicar, para não chamar a Meta à toa.
function MetaReport({ from, to, institutionId, names }: { from: string; to: string; institutionId?: string; names: Record<string, string> }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [schools, setSchools] = useState<{ institution_id: string; waba_id: string; rows: { category: string; volume: number; cost: number }[]; error: string | null }[]>([])
  useEffect(() => { setState('idle'); setSchools([]); setErr('') }, [from, to, institutionId])

  const load = async () => {
    setState('loading'); setErr('')
    const { data, error } = await supabase.functions.invoke('whatsapp-meta-report', { body: { from, to } })
    if (error || data?.error) { setErr(data?.error || error?.message || 'Não foi possível consultar a Meta.'); setState('idle'); return }
    setSchools(data.schools ?? []); setState('done')
  }
  const shown = institutionId ? schools.filter(x => x.institution_id === institutionId) : schools
  const money = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  const cats = [...new Set(shown.flatMap(x => x.rows.map(r => r.category)))].sort()
  const total = sum(shown, x => sum(x.rows, r => r.cost))
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">Relatório da Meta</p>
          <p className="text-xs text-gray-500 mt-0.5">Valores reais cobrados pela Meta no período, na moeda da conta dela. Não é cálculo nosso.</p>
        </div>
        <button onClick={load} disabled={state === 'loading'} className="no-pdf px-3.5 py-2 text-xs font-semibold rounded-xl border border-teal-600 text-teal-700 hover:bg-teal-50 disabled:opacity-50">
          {state === 'loading' ? 'Consultando a Meta…' : state === 'done' ? 'Atualizar' : 'Buscar da Meta'}
        </button>
      </div>
      {err && <p className="mt-3 text-sm text-amber-700">{err}</p>}
      {state === 'done' && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 bg-gray-50">
              <th className="px-3 py-2 text-left font-semibold">Escola</th>
              {cats.map(c => <th key={c} className="px-3 py-2 text-right font-semibold whitespace-nowrap">{CAT_LABEL[c] ?? c}</th>)}
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map(x => (
                <tr key={x.institution_id}>
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{names[x.institution_id] ?? x.waba_id}</td>
                  {x.error ? <td colSpan={cats.length + 1} className="px-3 py-2 text-xs text-amber-700">{x.error}</td> : (<>
                    {cats.map(c => { const r = x.rows.find(y => y.category === c); return <td key={c} className="px-3 py-2 text-right">{r ? <>{money(r.cost)} <span className="text-[11px] text-gray-400">({fmt(r.volume)})</span></> : <span className="text-gray-300">—</span>}</td> })}
                    <td className="px-3 py-2 text-right font-bold">{money(sum(x.rows, r => r.cost))}</td>
                  </>)}
                </tr>
              ))}
              {!institutionId && <tr className="bg-gray-50 font-semibold"><td className="px-3 py-2">Total</td><td colSpan={cats.length} /><td className="px-3 py-2 text-right">{money(total)}</td></tr>}
            </tbody>
          </table>
          <p className="text-[11px] text-gray-400 mt-2">Entre parênteses: quantidade cobrada. Os dados da Meta podem levar algumas horas para fechar.</p>
        </div>
      )}
    </div>
  )
}
