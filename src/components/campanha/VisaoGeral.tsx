// Visão geral da Campanha: resumo de todos os módulos (matrículas, funil, investimento, séries, matriculômetro, saídas)
// e o comparativo ano a ano, mês a mês.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { monthName, funnelNeeds, type FunnelRates, type HistYear, type PlanMonth } from '../../lib/campaignPlan'
import { thisMonthSP } from '../../lib/campaignCompare'
import { CountUp, useMounted } from './CampaignCharts'

type Tab = 'funil' | 'novatos' | 'rematricula' | 'invest' | 'serie' | 'matriculometro' | 'saidas'
interface Props {
  institutionId: string; targetYear: number; from: string; to: string; months: PlanMonth[]; rates: FunnelRates
  cur: HistYear | null; years: HistYear[]
  prog: { reMat: number; novos: number; pre: number; pending: number; left: number; done: number }
  goals: { total: number; re: number; novos: number }
  go: (t: Tab) => void; goBase: () => void
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '16px 18px' }
const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'right', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px', textAlign: 'right', fontSize: 13, borderTop: '1px solid #EEF2F1' }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
const YC = ['#CBD5E1', '#A78BFA', '#F59E0B']

function Bar({ v, max, c }: { v: number; max: number; c: string }) {
  const on = useMounted()
  return <div style={{ height: 9, borderRadius: 9, background: '#EDF1F0', overflow: 'hidden', marginTop: 6 }}><div style={{ width: on ? `${Math.min(100, max ? v / max * 100 : 0)}%` : 0, height: '100%', background: c, borderRadius: 9, transition: 'width 1s cubic-bezier(.2,.8,.2,1)' }} /></div>
}
const Go = ({ onClick }: { onClick: () => void }) => <button onClick={onClick} style={{ float: 'right', border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 800, fontSize: 12, cursor: 'pointer', padding: 0 }}>abrir →</button>
const Mini = ({ title, go, children }: { title: string; go: () => void; children: ReactNode }) => <div style={{ ...card, fontSize: 13, lineHeight: 1.7 }}><div style={{ fontSize: 14.5, fontWeight: 800, color: BRAND.ink, marginBottom: 4 }}>{title}<Go onClick={go} /></div>{children}</div>

export default function VisaoGeral(p: Props) {
  const now = thisMonthSP()
  const [fun, setFun] = useState<{ entraram: number; totais: Record<string, { n: number }> } | null>(null)
  const [inv, setInv] = useState<{ total: number; budget: number; leads: number; visits: number; novos: number } | null>(null)
  const [seg, setSeg] = useState<Record<string, { base: number; ok: number }>>({})
  const [exits, setExits] = useState<{ cur: number; prev: number } | null>(null)
  const [metric, setMetric] = useState<'total' | 'novos' | 'rematriculas'>('total')
  const [acc, setAcc] = useState(false)
  const on = useMounted()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [f, ex, bu, ib, mm, tr] = await Promise.all([
        supabase.rpc('campaign_funnel', { p_inst: p.institutionId, p_from: p.from, p_to: p.to, p_source: null, p_grade: null, p_assigned: null }),
        supabase.from('campaign_expenses').select('amount').eq('institution_id', p.institutionId).eq('target_year', p.targetYear),
        supabase.from('campaign_expense_budgets').select('budget').eq('institution_id', p.institutionId).eq('target_year', p.targetYear),
        supabase.rpc('campaign_investment_base', { p_inst: p.institutionId, p_year: p.targetYear, p_from: p.from, p_to: p.to }),
        supabase.rpc('campaign_matriculometro', { p_inst: p.institutionId, p_year: p.targetYear }),
        supabase.rpc('transfers_report', { p_inst: p.institutionId, p_year: p.targetYear - 1 }),
      ])
      if (!alive) return
      setFun((f.data ?? null) as typeof fun)
      const b = (ib.data ?? { leads: 0, visits: 0, novos: 0 }) as { leads: number; visits: number; novos: number }
      setInv({ total: ((ex.data ?? []) as { amount: number }[]).reduce((s, e) => s + Number(e.amount), 0), budget: ((bu.data ?? []) as { budget: number }[]).reduce((s, e) => s + Number(e.budget), 0), leads: b.leads ?? 0, visits: b.visits ?? 0, novos: b.novos ?? 0 })
      const s: Record<string, { base: number; ok: number }> = {}
      for (const t of ((mm.data as { turmas: { segment: string | null; base: number; matriculados: number; pre: number }[] } | null)?.turmas ?? [])) { const k = t.segment ?? 'outro'; s[k] = s[k] ?? { base: 0, ok: 0 }; s[k].base += t.base; s[k].ok += t.matriculados + t.pre }
      setSeg(s)
      const t = tr.data as { exits: number; years: { year: number; exits: number }[] } | null
      setExits(t ? { cur: t.exits, prev: t.years.find(y => y.year === p.targetYear - 2)?.exits ?? 0 } : null)
    })()
    return () => { alive = false }
  }, [p.institutionId, p.targetYear, p.from, p.to])

  // comparativo ano a ano
  const chart = useMemo(() => {
    const val = (y: HistYear, m: string, shift: number) => { const x = y.monthly.find(z => `${Number(z.m.slice(0, 4)) + shift}-${z.m.slice(5, 7)}` === m); return !x ? 0 : metric === 'total' ? x.novos + x.rematriculas : x[metric] }
    const cols = p.years.slice(-3).map((y, i) => ({ label: String(y.year), c: YC[i], vals: p.months.map(m => val(y, m.m, p.targetYear - y.year)) }))
    cols.push({ label: `${p.targetYear} (em andamento)`, c: '#05907B', vals: p.months.map(m => (m.m <= now ? (p.cur?.monthly.find(z => z.m === m.m) ? (metric === 'total' ? (p.cur!.monthly.find(z => z.m === m.m)!.novos + p.cur!.monthly.find(z => z.m === m.m)!.rematriculas) : p.cur!.monthly.find(z => z.m === m.m)![metric]) : 0) : -1)) })
    if (acc) for (const c of cols) { let s = 0; c.vals = c.vals.map(v => (v < 0 ? v : (s += v))) }
    return cols
  }, [p.years, p.cur, p.months, p.targetYear, metric, acc, now])
  const maxV = Math.max(5, ...chart.flatMap(c => c.vals))
  const top = Math.ceil(maxV / 10) * 10

  const W = 900, H = 230, L = 36, B = 34, T = 14
  const n = p.months.length, slot = (W - L - 8) / Math.max(1, n)
  const bw = Math.min(22, (slot - 10) / Math.max(1, chart.length))
  const y = (v: number) => H - B - (v / top) * (H - B - T)

  const goalFor = (k: 'novos' | 'rematriculas') => p.months.map(m => m[k])
  const feitoFor = (k: 'novos' | 'rematriculas', m: string) => p.cur?.monthly.find(x => x.m === m)?.[k] ?? 0
  const kpis: [string, number, number, string, string][] = [
    ['Matriculados', p.prog.done, p.goals.total, '#059669', '#10B981'], ['Novos', p.prog.novos, p.goals.novos, '#7C3AED', '#7C3AED'],
    ['Rematrículas', p.prog.reMat, p.goals.re, '#0EA5E9', '#0EA5E9'], ['Pré-matriculados', p.prog.pre, Math.max(0, p.goals.total - p.prog.done), '#B45309', '#F59E0B'],
  ]
  const lastYear = p.years[p.years.length - 1]
  const risk = (p.cur?.by_grade ?? []).filter(g => g.base > 0).map(g => {
    const prev = lastYear?.by_grade.find(x => x.grade_id === g.grade_id)
    const prevRate = prev && prev.base ? prev.retained / prev.base : null
    const expected = prevRate != null ? Math.round(g.base * prevRate) : null
    return { name: g.name, base: g.base, falta: g.lost, dev: expected != null ? g.retained - expected : null }
  }).sort((a, b) => (a.dev ?? 0) - (b.dev ?? 0) || b.falta - a.falta).slice(0, 4)
  const SEGN: Record<string, string> = { infantil: 'Educação Infantil', fund1: 'Fundamental I', fund2: 'Fundamental II', medio: 'Ensino Médio' }
  const need = fun ? funnelNeeds(p.goals.novos, p.rates) : null

  return (
    <>
      <div className="aion-snap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
        {kpis.map(([t, v, m, c, bc]) => (
          <div key={t} style={card}><div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1.1 }}><CountUp value={v} /></div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{t}{t === 'Pré-matriculados' ? ` · faltam ${m} para a meta` : ` · meta ${m}`}</div><Bar v={v} max={m} c={bc} /></div>
        ))}
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Comparativo ano a ano, mês a mês</div>
            <div style={{ fontSize: 12.5, color: '#64748B' }}>Matrículas feitas em cada mês, em cada campanha. Passe o mouse nas barras para ver o número.</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select value={metric} onChange={e => setMetric(e.target.value as typeof metric)} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 600 }}><option value="total">Todas as matrículas</option><option value="novos">Só novos</option><option value="rematriculas">Só rematrículas</option></select>
            <select value={acc ? 'acc' : 'mes'} onChange={e => setAcc(e.target.value === 'acc')} style={{ padding: '6px 10px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, fontWeight: 600 }}><option value="mes">Mês a mês</option><option value="acc">Acumulado</option></select>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }}>
          {[0, 0.5, 1].map(f => <g key={f}><line x1={L} x2={W - 4} y1={y(top * f)} y2={y(top * f)} stroke="#EEF2F1" /><text x={L - 6} y={y(top * f) + 4} fontSize="11" fill="#94A3B8" textAnchor="end">{Math.round(top * f)}</text></g>)}
          {p.months.map((m, i) => {
            const x0 = L + slot * i + (slot - bw * chart.length) / 2
            return (
              <g key={m.m}>
                {chart.map((c, k) => { const v = c.vals[i]; if (v < 0) return null; const hh = on ? (v / top) * (H - B - T) : 0
                  return <rect key={k} x={x0 + k * bw} width={bw - 2} y={H - B - hh} height={hh} rx="3" fill={c.c} style={{ transition: `all .8s cubic-bezier(.2,.8,.2,1) ${k * 0.08}s` }}><title>{`${monthName(m.m + '-01')} · ${c.label}: ${v}`}</title></rect> })}
                <text x={L + slot * i + slot / 2} y={H - 14} fontSize="12" fontWeight="700" fill="#1A2B4A" textAnchor="middle">{monthName(m.m + '-01')}</text>
              </g>
            )
          })}
        </svg>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748B' }}>{chart.map(c => <span key={c.label} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><span style={{ width: 11, height: 11, background: c.c, borderRadius: 3 }} />{c.label}</span>)}</div>
        {chart.length === 1 && <div style={{ fontSize: 12.5, color: '#94A3B8', marginTop: 6 }}>Ainda não há campanhas anteriores com matrículas por mês para comparar.</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 12 }}>
        <Mini title="Funil" go={() => p.go('funil')}>
          {fun && need ? ([['Leads', fun.entraram, need.registrations, '#0EA5E9'], ['Agendamentos', fun.totais.scheduled?.n ?? 0, need.schedules, '#2DCBA4'], ['Visitas', fun.totais.visit?.n ?? 0, need.visits, '#10B981'], ['Matrículas novas', fun.totais.enrolled?.n ?? 0, p.goals.novos, '#059669']] as [string, number, number, string][]).map(([l, v, m, c]) => (
            <div key={l}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><span><b>{v}</b> de {m} <b style={{ color: v >= m ? '#15803D' : '#B91C1C' }}>{m ? `${v >= m ? '+' : ''}${Math.round((v - m) / m * 100)}%` : ''}</b></span></div><Bar v={v} max={m} c={c} /></div>
          )) : <span style={{ color: '#94A3B8' }}>Carregando…</span>}
        </Mini>
        <Mini title="Investimento" go={() => p.go('invest')}>
          {inv ? <>Investido <b>{brl(inv.total)}</b>{inv.budget > 0 && <> de {brl(inv.budget)}</>}{inv.budget > 0 && <Bar v={inv.total} max={inv.budget} c="#F59E0B" />}
            <div style={{ marginTop: 6 }}>Custo por lead <b>{inv.leads ? brl(inv.total / inv.leads) : '—'}</b> · por visita <b>{inv.visits ? brl(inv.total / inv.visits) : '—'}</b></div>
            <div>Custo por aluno novo (CPA) <b>{inv.novos ? brl(inv.total / inv.novos) : '—'}</b></div></> : <span style={{ color: '#94A3B8' }}>Carregando…</span>}
        </Mini>
        <Mini title="Séries em risco" go={() => p.go('serie')}>
          {risk.length === 0 ? <span style={{ color: '#94A3B8' }}>Sem dados de rematrícula ainda.</span> : risk.map(r => (
            <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{r.name}: <b>{r.falta}</b> faltam de {r.base}</span>
              {r.dev != null && <span style={{ fontSize: 11.5, fontWeight: 800, padding: '1px 8px', borderRadius: 99, background: r.dev < 0 ? '#FEE2E2' : '#DCFCE7', color: r.dev < 0 ? '#B91C1C' : '#15803D' }}>{r.dev > 0 ? '+' : ''}{r.dev} vs {lastYear?.year}</span>}</div>
          ))}
        </Mini>
        <Mini title="Matriculômetro" go={() => p.go('matriculometro')}>
          {Object.keys(seg).length === 0 ? <span style={{ color: '#94A3B8' }}>Carregando…</span> : Object.entries(seg).map(([k, v]) => (
            <div key={k}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{SEGN[k] ?? k}</span><b>{v.base ? Math.round(v.ok / v.base * 100) : 0}%</b></div><Bar v={v.ok} max={v.base} c="#10B981" /></div>
          ))}
        </Mini>
        <Mini title="Saídas" go={() => p.go('saidas')}>
          {exits ? <>Saídas em {p.targetYear - 1}: <b>{exits.cur}</b>{exits.prev > 0 && <> ({exits.cur >= exits.prev ? '+' : ''}{Math.round((exits.cur / exits.prev - 1) * 100)}% vs {p.targetYear - 2})</>}<br />Alunos sem rematrícula nem pré: <b>{p.prog.pending}</b><br />Saíram neste ano: <b>{p.prog.left}</b></> : <span style={{ color: '#94A3B8' }}>Carregando…</span>}
        </Mini>
        <Mini title="Alunos novos e rematrículas" go={() => p.go('novatos')}>
          <div>Novos <b>{p.prog.novos}</b> de {p.goals.novos}</div><Bar v={p.prog.novos} max={p.goals.novos} c="#7C3AED" />
          <div style={{ marginTop: 6 }}>Rematrículas <b>{p.prog.reMat}</b> de {p.goals.re}</div><Bar v={p.prog.reMat} max={p.goals.re} c="#0EA5E9" />
          <div style={{ marginTop: 6 }}><button onClick={() => p.go('rematricula')} style={{ border: 'none', background: 'none', padding: 0, color: BRAND.primaryDark, fontWeight: 700, cursor: 'pointer', fontSize: 12.5 }}>Ver rematrícula →</button></div>
        </Mini>
      </div>

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Meta mês a mês, por tipo</div>
        <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 8 }}>Cada tipo com a sua meta e o que foi feito. A compensação da meta fica nas abas Novatos e Rematrícula.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Novos meta</th><th style={th}>Feito</th><th style={th}>Rematrículas meta</th><th style={th}>Feito</th></tr></thead>
            <tbody>
              {p.months.map((m, i) => {
                const fut = m.m > now, gn = goalFor('novos')[i], gr = goalFor('rematriculas')[i], fn = feitoFor('novos', m.m), fr = feitoFor('rematriculas', m.m)
                const c = (f: number, g: number) => fut ? '#94A3B8' : f >= g ? '#15803D' : m.m === now ? '#B45309' : '#B91C1C'
                return <tr key={m.m} style={{ background: m.m === now ? '#FFFBEB' : undefined }}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(m.m + '-01')}/{m.m.slice(0, 4)}{m.m === now ? <span style={{ color: '#94A3B8', fontWeight: 500 }}> · em andamento</span> : ''}</td>
                  <td style={td}>{gn}</td><td style={{ ...td, fontWeight: 800, color: c(fn, gn) }}>{fut ? '—' : fn}</td><td style={td}>{gr}</td><td style={{ ...td, fontWeight: 800, color: c(fr, gr) }}>{fut ? '—' : fr}</td></tr>
              })}
            </tbody>
          </table>
        </div>
      </div>
      {(p.prog.pre > 0 || p.prog.pending > 0) && (
        <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertTriangle size={16} color="#B45309" />
          <span style={{ fontSize: 13.5, color: '#92400E', flex: 1 }}>{p.prog.pre > 0 && <><b>{p.prog.pre}</b> pré-matrículas esperando efetivar. </>}{p.prog.pending > 0 && <><b>{p.prog.pending}</b> alunos sem rematrícula nem pré.</>}</span>
          <button onClick={p.goBase} style={{ border: 'none', background: 'none', color: BRAND.primaryDark, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>Ver na Base de alunos →</button>
        </div>
      )}
    </>
  )
}
