// Peças comuns da central de Relatórios: período, cartões, gráficos simples, CSV, auditoria e análise da IA.
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles, Download, Printer, ShieldCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { aiFetch } from '../../lib/authHeaders'
import { BRAND } from '../../lib/brand'

export const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '16px 18px' }
export const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff', color: BRAND.ink, fontWeight: 600, fontFamily: 'inherit' }
export const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap' }
export const td: React.CSSProperties = { padding: '8px', fontSize: 13, borderTop: '1px solid #EEF2F1' }
export const satPct = (score: number | null | undefined) => (score == null ? null : Math.round(((score - 1) / 2) * 100))
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const br = (s: string) => s.split('-').reverse().join('/')

export type Preset = 'mes' | '7d' | '30d' | 'ano' | 'custom'
export function usePeriod() {
  const today = new Date()
  const [preset, setPreset] = useState<Preset>('mes')
  const [cFrom, setCFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [cTo, setCTo] = useState(iso(today))
  const { from, to } = useMemo(() => {
    const t = new Date()
    if (preset === 'mes') return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) }
    if (preset === '7d') return { from: iso(new Date(t.getTime() - 6 * 864e5)), to: iso(t) }
    if (preset === '30d') return { from: iso(new Date(t.getTime() - 29 * 864e5)), to: iso(t) }
    if (preset === 'ano') return { from: `${t.getFullYear()}-01-01`, to: iso(t) }
    return { from: cFrom, to: cTo }
  }, [preset, cFrom, cTo])
  return { preset, setPreset, from, to, cFrom, cTo, setCFrom, setCTo, label: `${br(from)} a ${br(to)}` }
}
export type PeriodState = ReturnType<typeof usePeriod>

export function PeriodBar({ p }: { p: PeriodState }) {
  const chip = (k: Preset, l: string) => <button key={k} onClick={() => p.setPreset(k)} style={{ padding: '7px 13px', borderRadius: 99, border: '1px solid ' + (p.preset === k ? BRAND.primary : '#E2E8F0'), background: p.preset === k ? BRAND.primary : '#fff', color: p.preset === k ? '#fff' : BRAND.text, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {chip('mes', 'Este mês')}{chip('7d', '7 dias')}{chip('30d', '30 dias')}{chip('ano', 'Este ano')}{chip('custom', 'Personalizado')}
      {p.preset === 'custom' && <><input type="date" value={p.cFrom} onChange={e => p.setCFrom(e.target.value)} style={sel} /><span style={{ color: '#94A3B8' }}>até</span><input type="date" value={p.cTo} onChange={e => p.setCTo(e.target.value)} style={sel} /></>}
    </div>
  )
}

export function Kpi({ label, value, color, now, before, sub, invert }: { label: string; value: string | number; color: string; now?: number; before?: number; sub?: string; invert?: boolean }) {
  const d = now != null && before != null && before > 0 ? Math.round((now - before) / before * 100) : null
  const good = d == null ? true : invert ? d <= 0 : d >= 0
  return (
    <div style={{ ...card, padding: '12px 14px' }}>
      <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.15 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#94A3B8' }}>{d != null ? <span style={{ color: good ? '#15803D' : '#B91C1C', fontWeight: 700 }}>{d > 0 ? '↑' : d < 0 ? '↓' : '='} {Math.abs(d)}% </span> : null}{d != null ? 'vs período anterior' : sub}</div>
    </div>
  )
}
export const KpiGrid = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>{children}</div>

export function BarList({ rows, color = BRAND.primary, fmt }: { rows: { label: string; n: number; extra?: string }[]; color?: string; fmt?: (n: number) => string }) {
  const mx = Math.max(1, ...rows.map(r => r.n))
  return <div>{rows.map(r => (
    <div key={r.label} title={`${r.label}: ${r.n}${r.extra ? ' · ' + r.extra : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5 }}>
      <span style={{ width: 120, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
      <div style={{ flex: 1, height: 11, borderRadius: 6, background: '#EDF1F0', overflow: 'hidden' }}><div style={{ width: `${r.n / mx * 100}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} /></div>
      <b style={{ width: 44, textAlign: 'right' }}>{fmt ? fmt(r.n) : r.n}</b>{r.extra && <span style={{ width: 70, color: '#94A3B8', fontSize: 11.5 }}>{r.extra}</span>}
    </div>))}</div>
}

export function DayLine({ rows, color = BRAND.primary }: { rows: { d: string; n: number }[]; color?: string }) {
  if (!rows.length) return <div style={{ fontSize: 13, color: BRAND.muted }}>Sem dados no período.</div>
  const W = 560, H = 140, L = 28, B = 22, T = 8, mx = Math.max(1, ...rows.map(r => r.n))
  const x = (i: number) => L + (rows.length > 1 ? i / (rows.length - 1) : 0.5) * (W - L - 8), y = (v: number) => T + (1 - v / mx) * (H - T - B)
  const path = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.n)}`).join(' ')
  const step = Math.max(1, Math.ceil(rows.length / 8))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {[0, .5, 1].map(f => <g key={f}><line x1={L} x2={W - 8} y1={y(mx * f)} y2={y(mx * f)} stroke="#EEF2F1" /><text x={L - 5} y={y(mx * f) + 4} fontSize="10" textAnchor="end" fill="#94A3B8">{Math.round(mx * f)}</text></g>)}
      <path d={`${path} L${x(rows.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={color} opacity=".08" />
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {rows.map((r, i) => <g key={r.d}><circle cx={x(i)} cy={y(r.n)} r="3" fill={color}><title>{`${br(r.d)}: ${r.n}`}</title></circle>{i % step === 0 && <text x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#64748B">{r.d.slice(8, 10)}/{r.d.slice(5, 7)}</text>}</g>)}
    </svg>
  )
}

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const blob = new Blob(['﻿' + [cols.map(esc).join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
}

export async function logAudit(institutionId: string, module: string, action: 'csv' | 'csv_mensagens' | 'analise_ia', from: string, to: string, rows?: number) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('report_audit').insert({ institution_id: institutionId, user_id: user.id, user_name: (user.user_metadata?.full_name as string) ?? user.email ?? null, module, action, period_from: from, period_to: to, rows_count: rows ?? null })
  } catch { /* auditoria é melhor esforço */ }
}

export function ActionBar({ onCsv, csvLabel = 'Baixar CSV', csvDisabled, extra, onAi, aiBusy, aiLabel }: { onCsv: () => void; csvLabel?: string; csvDisabled?: boolean; extra?: React.ReactNode; onAi: () => void; aiBusy: boolean; aiLabel?: string }) {
  const b: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', fontFamily: 'inherit' }
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <button onClick={onCsv} disabled={csvDisabled} style={{ ...b, border: '1px solid #E2E8F0', background: '#fff', color: BRAND.ink, opacity: csvDisabled ? 0.5 : 1 }}><Download size={15} /> {csvLabel}</button>
      {extra}
      <button onClick={onAi} disabled={aiBusy} style={{ ...b, border: 'none', background: 'linear-gradient(135deg,#065F52,#00A896)', color: '#fff', opacity: aiBusy ? 0.6 : 1 }}>{aiBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{aiBusy ? (aiLabel ?? 'Analisando…') : 'Análise da IA'}</button>
    </div>
  )
}

interface Analise { resumo?: string; destaques?: string[]; atencao?: { titulo: string; descricao: string }[]; comparacao?: string; pessoas?: { nome: string; leitura: string }[]; acoes?: { acao: string; quem?: string; prazo?: string }[]; perguntas_reuniao?: string[]; limites?: string; perguntas_frequentes?: { tema: string; conversas?: number; perguntas?: string[] }[]; clientes_dizem?: { elogios?: string[]; reclamacoes?: string[]; objecoes?: string[] }; gargalos?: { titulo: string; evidencia?: string; impacto?: string; correcao?: string }[]; abordagem?: { como_chegam?: string; como_sao_recebidos?: string; onde_esfria?: string; falhas?: string[]; boas_praticas?: string[] } }
export function useAnalise(module: string, moduleTitle: string, institutionId: string, institutionName: string, period: PeriodState) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [rep, setRep] = useState<Analise | null>(null)
  useEffect(() => { setRep(null); setErr('') }, [module, period.from, period.to])
  const run = async (data: unknown) => {
    setBusy(true); setErr('')
    try {
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'report_module_analysis', payload: { module, moduleTitle, institutionName, periodo: period.label, data } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      setRep(json.result as Analise); logAudit(institutionId, module, 'analise_ia', period.from, period.to)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível gerar a análise.') } finally { setBusy(false) }
  }
  return { busy, err, rep, run }
}

// Card de espera da IA: barra que sobe (real quando o texto traz "X de N", senão estimada pelo tempo) e tempo decorrido.
function EsperaIA({ label }: { label?: string }) {
  const [sec, setSec] = useState(0)
  useEffect(() => { const t = setInterval(() => setSec(x => x + 1), 1000); return () => clearInterval(t) }, [])
  const m = (label || '').match(/(\d+) de (\d+)/)
  const real = m && Number(m[2]) > 0 ? Math.min(95, Math.round(Number(m[1]) / Number(m[2]) * 90)) : null
  const est = Math.round(92 * (1 - Math.exp(-sec / 35)))
  const pct = Math.max(real ?? 0, est * (real == null ? 1 : 0.4), 3)
  return (
    <div className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #E3E8F0', padding: '22px 24px', width: 'min(440px, 100%)', boxShadow: '0 20px 50px rgba(15,23,42,.25)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}><Sparkles size={20} color={BRAND.primary} /><div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Gerando a análise da IA…</div></div>
        <div style={{ height: 10, borderRadius: 99, background: '#E6F4F1', overflow: 'hidden' }}><div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: `linear-gradient(90deg, ${BRAND.primary}, #34D399)`, transition: 'width 1s ease' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: BRAND.text, marginTop: 8 }}><span>{label || 'Lendo os dados do período…'}</span><span style={{ color: BRAND.muted }}>{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</span></div>
        <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8 }}>Pode levar de 30 segundos a alguns minutos, principalmente na leitura completa do WhatsApp. Aguarde: o relatório aparece sozinho quando ficar pronto.</div>
      </div>
    </div>)
}

export function AnalisePanel({ rep, err, title, periodLabel, institutionId, institutionName, busy, label }: { rep: Analise | null; err: string; title: string; periodLabel: string; institutionId: string; institutionName: string; busy?: boolean; label?: string }) {
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => { supabase.from('institutions').select('logo_url').eq('id', institutionId).maybeSingle().then(({ data }) => setLogo((data as { logo_url?: string | null } | null)?.logo_url ?? null)) }, [institutionId])
  if (busy) return <EsperaIA label={label} />
  if (err) return <div style={{ ...card, color: '#B91C1C', fontSize: 13.5 }}>{err}</div>
  if (!rep) return null
  const h = (t: string) => <div style={{ fontSize: 12, fontWeight: 800, color: BRAND.primaryDark, textTransform: 'uppercase', marginBottom: 6 }}>{t}</div>
  return (
    <div id="rep-print" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@page { size: A4; margin: 12mm } @media print { body * { visibility: hidden !important } #rep-print, #rep-print * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact } #rep-print { position: absolute; left: 0; top: 0; width: 100% } #rep-print > div { break-inside: avoid } .no-print { display: none !important } }`}</style>
      <div style={{ ...card, background: 'linear-gradient(135deg,#065F52,#00A896)', border: 'none', color: '#fff', display: 'flex', gap: 16, alignItems: 'center' }}>
        {logo && <div style={{ width: 72, height: 72, borderRadius: 16, background: '#fff', padding: 8, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><img src={logo} alt="" crossOrigin="anonymous" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /></div>}
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>ANÁLISE DA IA · {title.toUpperCase()}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{institutionName}</div><div style={{ fontSize: 12.5, opacity: 0.85 }}>Período: {periodLabel}</div></div>
        <button className="no-print" onClick={() => window.print()} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center' }}><Printer size={14} /> PDF</button>
      </div>
      {rep.resumo && <div style={{ ...card, background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, fontSize: 14.5, lineHeight: 1.65, color: BRAND.ink }}>{h('Em resumo')}{rep.resumo}</div>}
      {(rep.destaques ?? []).length > 0 && <div style={card}>{h('O que está indo bem')}{(rep.destaques ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0', display: 'flex', gap: 8 }}><span style={{ color: '#15803D' }}>✓</span>{x}</div>)}</div>}
      {(rep.atencao ?? []).length > 0 && <div style={{ ...card, background: '#FFFBEB', border: '1px solid #FCD34D' }}>{h('Pontos de atenção')}{(rep.atencao ?? []).map((x, i) => <div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid #FDE68A' : 'none' }}><div style={{ fontWeight: 700, fontSize: 13.5, color: '#92400E' }}>{x.titulo}</div><div style={{ fontSize: 13, color: BRAND.text, lineHeight: 1.55 }}>{x.descricao}</div></div>)}</div>}
      {(rep.perguntas_frequentes ?? []).length > 0 && <div style={card}>{h('Perguntas mais frequentes das famílias')}{(rep.perguntas_frequentes ?? []).map((q, i) => <div key={i} style={{ padding: '6px 0', borderTop: i ? '1px solid #EEF2F1' : 'none' }}><div style={{ fontWeight: 700, fontSize: 13.5, color: BRAND.ink }}>{q.tema}{q.conversas ? <span style={{ fontWeight: 500, color: '#94A3B8', fontSize: 12 }}> · {q.conversas} conversas</span> : null}</div>{(q.perguntas ?? []).map((x, j) => <div key={j} style={{ fontSize: 13, color: BRAND.text }}>• {x}</div>)}</div>)}</div>}
      {rep.clientes_dizem && ((rep.clientes_dizem.elogios ?? []).length > 0 || (rep.clientes_dizem.reclamacoes ?? []).length > 0) && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ ...card, background: '#F0FDF4', border: '1px solid #BBF7D0' }}>{h('O que as famílias elogiam')}{(rep.clientes_dizem.elogios ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '2px 0' }}>• {x}</div>)}</div>
        <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FECACA' }}>{h('O que as famílias reclamam')}{(rep.clientes_dizem.reclamacoes ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '2px 0' }}>• {x}</div>)}</div></div>}
      {(rep.clientes_dizem?.objecoes ?? []).length > 0 && <div style={card}>{h('O que faz as famílias hesitarem ou desistirem')}{(rep.clientes_dizem?.objecoes ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '2px 0' }}>• {x}</div>)}</div>}
      {rep.abordagem && (rep.abordagem.como_chegam || rep.abordagem.como_sao_recebidos || rep.abordagem.onde_esfria) && <div style={card}>{h('Como os leads chegam e como são abordados')}
        {rep.abordagem.como_chegam && <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 6 }}><b>Como chegam: </b>{rep.abordagem.como_chegam}</div>}
        {rep.abordagem.como_sao_recebidos && <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 6 }}><b>Como são recebidos: </b>{rep.abordagem.como_sao_recebidos}</div>}
        {rep.abordagem.onde_esfria && <div style={{ fontSize: 13.5, lineHeight: 1.6, marginBottom: 6 }}><b>Onde a conversa esfria: </b>{rep.abordagem.onde_esfria}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          {(rep.abordagem.falhas ?? []).length > 0 && <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '8px 12px' }}><div style={{ fontWeight: 800, fontSize: 12.5, color: '#B91C1C' }}>Falhas de abordagem</div>{(rep.abordagem.falhas ?? []).map((x, i) => <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>• {x}</div>)}</div>}
          {(rep.abordagem.boas_praticas ?? []).length > 0 && <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '8px 12px' }}><div style={{ fontWeight: 800, fontSize: 12.5, color: '#15803D' }}>Boas práticas</div>{(rep.abordagem.boas_praticas ?? []).map((x, i) => <div key={i} style={{ fontSize: 13, padding: '2px 0' }}>• {x}</div>)}</div>}
        </div></div>}
      {(rep.gargalos ?? []).length > 0 && <div style={{ ...card, background: '#FFF7ED', border: '1px solid #FDBA74' }}>{h('Gargalos do atendimento')}{(rep.gargalos ?? []).map((g, i) => <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid #FED7AA' : 'none' }}><div style={{ fontWeight: 800, fontSize: 14, color: '#9A3412' }}>{g.titulo}</div>{g.evidencia && <div style={{ fontSize: 13, lineHeight: 1.55 }}><b>Prova: </b>{g.evidencia}</div>}{g.impacto && <div style={{ fontSize: 13, lineHeight: 1.55 }}><b>Efeito: </b>{g.impacto}</div>}{g.correcao && <div style={{ fontSize: 13, lineHeight: 1.55, color: '#065F52' }}><b>Como corrigir: </b>{g.correcao}</div>}</div>)}</div>}
      {rep.comparacao && <div style={card}>{h('Comparado ao período anterior')}<div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{rep.comparacao}</div></div>}
      {(rep.pessoas ?? []).length > 0 && <div style={card}>{h('Por pessoa')}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>{(rep.pessoas ?? []).map(p => <div key={p.nome} style={{ border: '1px solid #E3E8F0', borderRadius: 12, padding: '10px 12px' }}><div style={{ fontWeight: 800, color: BRAND.ink }}>{p.nome}</div><div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 2 }}>{p.leitura}</div></div>)}</div></div>}
      {(rep.acoes ?? []).length > 0 && <div style={card}>{h('O que fazer, em ordem')}{(rep.acoes ?? []).map((a, i) => <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderTop: i ? '1px solid #EEF2F1' : 'none', fontSize: 13.5 }}><b style={{ color: BRAND.primary }}>{i + 1}.</b><div style={{ flex: 1 }}>{a.acao}{(a.quem || a.prazo) && <div style={{ fontSize: 12, color: '#64748B' }}>{a.quem ? `Quem: ${a.quem}` : ''}{a.quem && a.prazo ? ' · ' : ''}{a.prazo ? `Até: ${a.prazo}` : ''}</div>}</div></div>)}</div>}
      {(rep.perguntas_reuniao ?? []).length > 0 && <div style={card}>{h('Perguntas para a reunião da equipe')}{(rep.perguntas_reuniao ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0' }}>• {x}</div>)}</div>}
      {rep.limites && <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 6 }}><ShieldCheck size={14} color="#00A896" style={{ flexShrink: 0, marginTop: 1 }} />{rep.limites}</div>}
    </div>
  )
}
