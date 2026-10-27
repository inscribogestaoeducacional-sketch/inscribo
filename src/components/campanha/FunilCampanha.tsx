// Funil da campanha: geral e mês a mês, com filtros de origem e série. Etapas vêm do histórico de mudanças de etapa do lead.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { funnelNeeds, monthName, type FunnelRates, type PlanMonth } from '../../lib/campaignPlan'

type Et = Record<string, { n: number; inferidos: number }>
interface Data {
  history_since: string | null; entraram: number; matriculados_leads_antigos?: number; matriculou_erp?: { confirmados: number; matriculados: number }; totais: Et; origens: string[]; series: string[]
  motivos_perda: { motivo: string; n: number }[]
  months: { m: string; entraram: number; etapas: Et }[]
}
const STAGES: [string, string][] = [['contact', 'Contato'], ['scheduled', 'Agendou'], ['visit', 'Visitou'], ['proposal', 'Proposta'], ['enrolled', 'Matriculou']]
const LOST_LABEL: Record<string, string> = { outro: 'Outro motivo', nao_informado: 'Não informado', outra_escola: 'Foi para outra escola', preco: 'Preço', distancia: 'Distância' }
const sel: React.CSSProperties = { padding: '7px 10px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, background: '#fff', color: BRAND.ink, fontWeight: 600 }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const th: React.CSSProperties = { fontSize: 11.5, color: '#94A3B8', textTransform: 'uppercase', padding: '8px', textAlign: 'right', fontWeight: 700 }
const td: React.CSSProperties = { padding: '8px', textAlign: 'right', fontSize: 13, borderTop: '1px solid #EEF2F1' }

export default function FunilCampanha({ institutionId, from, to, planMonths, rates }: { institutionId: string; from: string; to: string; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const [mes, setMes] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [source, setSource] = useState('')
  const [grade, setGrade] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    supabase.rpc('campaign_funnel', { p_inst: institutionId, p_from: from, p_to: to, p_source: source || null, p_grade: grade || null, p_assigned: null })
      .then(({ data: d, error }) => { if (!alive) return; if (error) setErr(error.message); else { setErr(''); setData(d as Data) } })
    return () => { alive = false }
  }, [institutionId, from, to, source, grade])

  if (err) return <div style={{ color: '#B91C1C', fontSize: 13 }}>{err}</div>
  if (!data) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  const cell = (e?: { n: number; inferidos: number }) => e ? <>{e.n}{e.inferidos > 0 && <span style={{ color: BRAND.muted }}> ({e.inferidos})</span>}</> : '—'
  const ent = data.entraram
  let prev = ent
  const rows = STAGES.map(([k, label]) => {
    const n = data.totais[k]?.n ?? 0
    const r = { k, label, e: data.totais[k], n, ofTotal: ent ? n / ent : 0, ofPrev: prev ? n / prev : 0 }
    if (n > 0) prev = n
    return r
  })
  const lost = data.totais.lost
  const fmtDate = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={source} onChange={e => setSource(e.target.value)} style={sel}>
          <option value="">Origem: todas</option>{data.origens.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={grade} onChange={e => setGrade(e.target.value)} style={sel}>
          <option value="">Série: todas</option>{data.series.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <button onClick={() => setSource(x => x === 'Concurso de Bolsas' ? '' : 'Concurso de Bolsas')} style={{ padding: '7px 13px', borderRadius: 99, border: '1px solid ' + (source === 'Concurso de Bolsas' ? BRAND.primary : '#E2E8F0'), background: source === 'Concurso de Bolsas' ? BRAND.primary : '#fff', color: source === 'Concurso de Bolsas' ? '#fff' : BRAND.text, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>Só Concurso de Bolsas</button>
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>Período da campanha: {fmtDate(from)} a {fmtDate(to)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[['', 'Campanha toda'], ...data.months.map(m => [m.m, monthName(m.m + '-01')])].map(([k, l]) => (
          <button key={k} onClick={() => setMes(k)} style={{ padding: '7px 13px', borderRadius: 99, border: '1px solid ' + (mes === k ? BRAND.primary : '#E2E8F0'), background: mes === k ? BRAND.primary : '#fff', color: mes === k ? '#fff' : BRAND.text, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>{l}</button>
        ))}
      </div>
      <FunilVisual data={data} mes={mes} planMonths={planMonths} rates={rates} />
      <ConvRow data={data} mes={mes} rates={rates} />
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Mês a mês: quem entrou e até onde chegou</div>
        <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>Cada linha são os leads que <b>entraram naquele mês</b>. As etapas contam quem já passou por elas, mesmo que hoje esteja mais adiante ou tenha sido perdido.</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th>{['Entraram', 'Contato', 'Agendou', 'Visitou', 'Proposta', 'Matriculou', 'Perdeu'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.months.filter(m => m.entraram > 0).map(m => (
                <tr key={m.m}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(m.m + '-01')}</td><td style={{ ...td, fontWeight: 800 }}>{m.entraram}</td>
                  {(['contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost'] as const).map(k => <td key={k} style={{ ...td, color: k === 'lost' ? '#B91C1C' : k === 'enrolled' ? '#05907B' : undefined, fontWeight: k === 'enrolled' ? 800 : 400 }}>{m.etapas[k]?.n ?? 0}</td>)}</tr>
              ))}
              <tr style={{ background: '#F8FBFA' }}><td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>Total</td><td style={{ ...td, fontWeight: 800 }}>{data.entraram}</td>
                {(['contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost'] as const).map(k => <td key={k} style={{ ...td, fontWeight: 800 }}>{data.totais[k]?.n ?? 0}</td>)}</tr>
            </tbody>
          </table>
        </div>
        {data.matriculou_erp && <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 10, lineHeight: 1.5 }}>Das <b>{data.matriculou_erp.matriculados}</b> matrículas dos leads, <b style={{ color: '#05907B' }}>{data.matriculou_erp.confirmados}</b> já têm o aluno confirmado no sistema da escola. {data.matriculou_erp.matriculados - data.matriculou_erp.confirmados > 0 ? <>As outras {data.matriculou_erp.matriculados - data.matriculou_erp.confirmados} estão em Base de alunos → Conferir matrículas. </> : null}O que vale como matrícula final é o do sistema da escola.</div>}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1.5 1 520px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Mês a mês no gráfico</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>Linhas cheias: o que aconteceu. Tracejado: a meta. Cada mês mostra os leads que <b>entraram</b> naquele mês e até onde chegaram. Clique num mês acima para ver os cartões dele.</div>
          <MonthLines data={data} planMonths={planMonths} rates={rates} />
          <p style={{ fontSize: 12, color: BRAND.muted, margin: '10px 0 0', lineHeight: 1.6 }}>
            {data.history_since ? `O registro de etapas começou em ${fmtDate(data.history_since)}. ` : ''}O funil olha só os leads que <b>entraram na campanha</b> e conta cada um em toda etapa que já alcançou, por isso os números só diminuem de uma etapa para a próxima. {data.matriculados_leads_antigos ? <>Não entram aqui os <b>{data.matriculados_leads_antigos}</b> leads que chegaram antes do início da campanha e matricularam nela. </> : null}Quem matriculou conta em todas as etapas anteriores, porque necessariamente passou por elas. <b>~N estimados</b>: quando um lead aparece numa etapa mais à frente sem registro de ter passado pela anterior, o sistema entende que ele passou e marca como estimado.
          </p>
        </div>
        <div style={{ ...card, flex: '1 1 280px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Por que se perde</div>
          {data.motivos_perda.length === 0 ? <div style={{ fontSize: 13, color: BRAND.muted }}>Nenhum lead perdido no período.</div> : data.motivos_perda.map(m => (
            <div key={m.motivo} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid #EEF2F1' }}>
              <span>{LOST_LABEL[m.motivo] ?? m.motivo}</span><b>{m.n}</b>
            </div>
          ))}
        </div>
      </div>
      <MonthTable data={data} planMonths={planMonths} rates={rates} />
    </div>
  )
}

const STG: [string, string, string][] = [['entraram', 'Leads', '#0EA5E9'], ['scheduled', 'Agendamentos', '#2DCBA4'], ['visit', 'Visitas', '#10B981'], ['enrolled', 'Matrículas novas', '#059669']]

const lostN = (e?: { n: number }) => e?.n ?? 0
function stagesOf(data: Data, mes: string) {
  const mrow = data.months.find(m => m.m === mes)
  return STG.map(([k]) => k === 'entraram' ? (mes ? (mrow?.entraram ?? 0) : data.entraram) : (mes ? (mrow?.etapas[k]?.n ?? 0) : (data.totais[k]?.n ?? 0)))
}
const pc = (a: number, b: number) => (b > 0 ? `${Math.round(a / b * 100)}%` : '—')

const STAGE_COL = ['#6366F1', '#8B5CF6', '#F59E0B', '#05907B']
function metaOf(planMonths: PlanMonth[], rates: FunnelRates, mes: string) {
  const novos = mes ? (planMonths.find(m => m.m === mes)?.novos ?? 0) : planMonths.reduce((a, m) => a + m.novos, 0)
  const need = funnelNeeds(novos, rates)
  return [need.registrations, need.schedules, need.visits, novos]
}
const devColor = (d: number | null) => d == null ? '#94A3B8' : d >= 0 ? '#15803D' : d > -30 ? '#B45309' : '#B91C1C'

function StageCards({ data, mes, planMonths, rates }: { data: Data; mes: string; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const real = stagesOf(data, mes)
  const meta = metaOf(planMonths, rates, mes)
  const mrow = data.months.find(m => m.m === mes)
  const inf = STG.map(([k]) => k === 'entraram' ? 0 : (mes ? (mrow?.etapas[k]?.inferidos ?? 0) : (data.totais[k]?.inferidos ?? 0)))
  const names = ['Cadastros', 'Agendamentos', 'Visitas', 'Matrículas novas']
  const nexts = ['agendaram', 'visitaram', 'matricularam', '']
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
      {real.map((v, i) => {
        const d = meta[i] > 0 ? Math.round((v - meta[i]) / meta[i] * 100) : null
        const pct = meta[i] > 0 ? Math.min(100, v / meta[i] * 100) : 0
        return (
          <div key={i} style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', fontWeight: 600 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: STAGE_COL[i] + '1F', color: STAGE_COL[i], fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>{i + 1}</span>{names[i]}
              </div>
              <div style={{ fontSize: 38, fontWeight: 800, color: STAGE_COL[i], lineHeight: 1.15, marginTop: 8 }}>{v}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>meta: {meta[i] || '—'}{inf[i] > 0 && <span title="Deduzidos: o lead aparece numa etapa mais à frente sem registro desta" style={{ marginLeft: 8, color: '#0F766E', fontWeight: 700 }}>~{inf[i]} estimados</span>}</div>
              {d != null && <div style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 99, background: d >= 0 ? '#DCFCE7' : '#FEE2E2', color: devColor(d) }}>{d >= 0 ? '↑' : '↓'} {d > 0 ? '+' : ''}{d}%</div>}
              <div style={{ borderTop: '1px solid #EEF2F1', marginTop: 12, paddingTop: 8, fontSize: 11.5, color: '#94A3B8' }}>
                {i < 3 ? `→ ${pc(real[i + 1], v)} ${nexts[i]}` : `→ ${pc(v, real[0])} dos cadastros`}
              </div>
            </div>
            <div style={{ height: 4, background: '#EEF2F1' }}><div style={{ width: `${pct}%`, height: '100%', background: STAGE_COL[i], transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
          </div>
        )
      })}
    </div>
  )
}

function ConvRow({ data, mes, rates }: { data: Data; mes: string; rates: FunnelRates }) {
  const r = stagesOf(data, mes)
  const items: [string, number, number][] = [['Cadastro → Agenda', r[0] ? r[1] / r[0] : 0, rates.registration_to_schedule], ['Agenda → Visita', r[1] ? r[2] / r[1] : 0, rates.schedule_to_visit], ['Visita → Matrícula', r[2] ? r[3] / r[2] : 0, rates.visit_to_enrollment]]
  return (
    <div style={{ ...card, display: 'flex', justifyContent: 'space-around', gap: 16, flexWrap: 'wrap' }}>
      {items.map(([l, v, ideal]) => (
        <div key={l} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: v >= ideal ? '#15803D' : '#B91C1C' }}>{(v * 100).toFixed(1)}%</div>
          <div style={{ fontSize: 12.5, color: '#475569', fontWeight: 600 }}>{l}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8' }}>ideal: {Math.round(ideal * 100)}%</div>
        </div>
      ))}
    </div>
  )
}

function MonthLines({ data, planMonths, rates }: { data: Data; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const W = 640, H = 220, L = 34, B = 26, T = 10
  const ms = data.months
  const now = new Date().toISOString().slice(0, 7)
  const series = STG.map(([k], i) => ({ k, i, real: ms.map(m => m.m > now ? null : k === 'entraram' ? m.entraram : (m.etapas[k]?.n ?? 0)), meta: ms.map(m => metaOf(planMonths, rates, m.m)[i]) }))
  const max = Math.max(1, ...series.flatMap(s => [...s.real.map(v => v ?? 0), ...s.meta]))
  const x = (j: number) => L + (ms.length > 1 ? j / (ms.length - 1) : 0.5) * (W - L - 10)
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const path = (vals: (number | null)[]) => vals.map((v, j) => v == null ? '' : `${vals.slice(0, j).some(u => u != null) && vals[j - 1] != null ? 'L' : 'M'}${x(j)},${y(v)}`).join(' ')
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {[0, .5, 1].map(f => <g key={f}><line x1={L} x2={W - 10} y1={y(max * f)} y2={y(max * f)} stroke="#EEF2F1" /><text x={L - 6} y={y(max * f) + 4} fontSize="10" textAnchor="end" fill="#94A3B8">{Math.round(max * f)}</text></g>)}
        {ms.map((m, j) => <text key={m.m} x={x(j)} y={H - 8} fontSize="10.5" textAnchor="middle" fill="#64748B">{monthName(m.m + '-01').slice(0, 3)}</text>)}
        {series.map(s => <g key={s.k}>
          <path d={path(s.meta)} fill="none" stroke={STAGE_COL[s.i]} strokeWidth="1.5" strokeDasharray="4 4" opacity=".55" />
          <path d={path(s.real)} fill="none" stroke={STAGE_COL[s.i]} strokeWidth="2.5" />
          {s.real.map((v, j) => v == null ? null : <circle key={j} cx={x(j)} cy={y(v)} r="3.5" fill={STAGE_COL[s.i]}><title>{`${STG[s.i][1]} · ${monthName(ms[j].m + '-01')}: feito ${v} · meta ${s.meta[j]}`}</title></circle>)}
        </g>)}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#475569' }}>
        {STG.map(([, l], i) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: STAGE_COL[i] }} />{l}</span>)}
      </div>
    </div>
  )
}

function MonthTable({ data, planMonths, rates }: { data: Data; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const th2: React.CSSProperties = { ...th, textAlign: 'center' }
  const cellS = (feito: number, meta: number, inf: number, fut: boolean) => {
    const d = meta > 0 ? Math.round((feito - meta) / meta * 100) : null
    return (
      <td style={{ ...td, textAlign: 'center', lineHeight: 1.35 }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>{fut ? '—' : feito}{!fut && inf > 0 && <span title={`${inf} estimados: deduzidos por o lead estar em etapa mais à frente`} style={{ fontSize: 10, fontWeight: 700, color: '#0F766E', background: '#CCFBF1', borderRadius: 99, padding: '0 6px', marginLeft: 4 }}>~{inf}</span>}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>meta {meta || '—'}</div>
        {!fut && d != null && <div style={{ fontSize: 11.5, fontWeight: 800, color: d >= 0 ? '#15803D' : d > -30 ? '#B45309' : '#B91C1C' }}>{d > 0 ? '+' : ''}{d}%</div>}
      </td>
    )
  }
  const now = new Date().toISOString().slice(0, 7)
  return (
    <div style={card}>
      <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Mês a mês: cada etapa contra a meta</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted, margin: '2px 0 10px' }}>Em cada célula: o que aconteceu, a meta do mês e o desvio. O selo ~N indica etapas estimadas.</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th2}>Leads (entraram)</th><th style={th2}>Agendaram</th><th style={th2}>Visitaram</th><th style={th2}>Matricularam</th><th style={th2}>Perdidos</th></tr></thead>
          <tbody>
            {data.months.map(r => {
              const pm = planMonths.find(m => m.m === r.m)
              const need = funnelNeeds(pm?.novos ?? 0, rates)
              const fut = r.m > now
              return (
                <tr key={r.m} style={{ background: r.m === now ? '#FFFBEB' : undefined }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(r.m + '-01')}{r.m === now ? <span style={{ color: '#94A3B8', fontWeight: 500 }}> · em andamento</span> : ''}</td>
                  {cellS(r.entraram, need.registrations, 0, fut)}
                  {cellS(r.etapas.scheduled?.n ?? 0, need.schedules, r.etapas.scheduled?.inferidos ?? 0, fut)}
                  {cellS(r.etapas.visit?.n ?? 0, need.visits, r.etapas.visit?.inferidos ?? 0, fut)}
                  {cellS(r.etapas.enrolled?.n ?? 0, pm?.novos ?? 0, r.etapas.enrolled?.inferidos ?? 0, fut)}
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#B91C1C' }}>{fut ? '—' : lostN(r.etapas.lost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const FV: { k: string; label: string; verb: string; metaIdx: number | null; c: [string, string] }[] = [
  { k: 'entraram', label: 'Cadastros', verb: 'entraram na campanha', metaIdx: 0, c: ['#6366F1', '#7C83F5'] },
  { k: 'contact', label: 'Contato', verb: 'foram contatados', metaIdx: null, c: ['#7C5CF0', '#9A7DF5'] },
  { k: 'scheduled', label: 'Agendamentos', verb: 'agendaram visita', metaIdx: 1, c: ['#8B5CF6', '#A98BF8'] },
  { k: 'visit', label: 'Visitas', verb: 'visitaram a escola', metaIdx: 2, c: ['#D9970B', '#F5B23A'] },
  { k: 'proposal', label: 'Proposta', verb: 'receberam proposta', metaIdx: null, c: ['#2F9E6B', '#4FC08B'] },
  { k: 'enrolled', label: 'Matrículas novas', verb: 'matricularam', metaIdx: 3, c: ['#05907B', '#2DCBA4'] },
]

/** Funil de verdade: barras que estreitam, com número, % do total, conversão entre etapas, meta e a etapa onde mais se perde. */
function FunilVisual({ data, mes, planMonths, rates }: { data: Data; mes: string; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const mrow = data.months.find(m => m.m === mes)
  const get = (k: string) => k === 'entraram' ? (mes ? (mrow?.entraram ?? 0) : data.entraram) : (mes ? (mrow?.etapas[k]?.n ?? 0) : (data.totais[k]?.n ?? 0))
  const inf = (k: string) => k === 'entraram' ? 0 : (mes ? (mrow?.etapas[k]?.inferidos ?? 0) : (data.totais[k]?.inferidos ?? 0))
  const meta = metaOf(planMonths, rates, mes)
  const vals = FV.map(f => get(f.k))
  const top = Math.max(1, vals[0])
  const widths = vals.map(v => Math.max(34, Math.round(v / top * 100)))
  // etapa com a maior queda proporcional em relação à anterior (só onde há gente)
  let worst = -1, worstDrop = 0
  vals.forEach((v, i) => { if (i > 0 && vals[i - 1] > 0) { const drop = 1 - v / vals[i - 1]; if (drop > worstDrop) { worstDrop = drop; worst = i } } })
  const lostV = mes ? (mrow?.etapas.lost?.n ?? 0) : (data.totais.lost?.n ?? 0)
  return (
    <div style={{ ...card, padding: '18px 14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '0 6px', marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Funil de matrículas novas</div>
        <div style={{ fontSize: 12, color: BRAND.muted }}>{mes ? monthName(mes + '-01') : 'Campanha toda'} · {vals[0]} leads entraram</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {FV.map((f, i) => {
          const v = vals[i], w = widths[i], nextW = i < FV.length - 1 ? widths[i + 1] : Math.max(26, w - 10)
          const inset = Math.max(0, (w - nextW) / 2 / w * 100)
          const m = f.metaIdx != null ? meta[f.metaIdx] : 0
          const d = m > 0 ? Math.round((v - m) / m * 100) : null
          const conv = i > 0 ? (vals[i - 1] > 0 ? Math.round(v / vals[i - 1] * 100) : null) : null
          return (
            <div key={f.k} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {i > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '5px 0', fontSize: 11.5, fontWeight: 700, color: worst === i ? '#B91C1C' : '#64748B' }}>
                  <span aria-hidden>↓</span>
                  <span style={{ padding: '2px 9px', borderRadius: 99, background: worst === i ? '#FEE2E2' : '#F1F5F4' }}>{conv == null ? '—' : `${conv}% ${f.verb}`}</span>
                  {worst === i && <span style={{ fontSize: 11, fontWeight: 800 }}>maior perda</span>}
                </div>
              )}
              <div title={`${f.label}: ${v}`} style={{ width: `${w}%`, minWidth: 128, height: 58, position: 'relative', background: `linear-gradient(135deg, ${f.c[0]}, ${f.c[1]})`, clipPath: `polygon(0 0, 100% 0, ${100 - inset}% 100%, ${inset}% 100%)`, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, opacity: .95, marginTop: 2 }}>{f.label}</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span>{vals[0] > 0 ? Math.round(v / vals[0] * 100) : 0}% dos cadastros</span>
                {m > 0 && <span>meta {m}</span>}
                {d != null && <b style={{ color: devColor(d) }}>{d >= 0 ? '↑ +' : '↓ '}{d}%</b>}
                {inf(f.k) > 0 && <span title="Deduzidos: o lead aparece numa etapa mais à frente sem registro desta" style={{ color: '#0F766E', fontWeight: 700 }}>~{inf(f.k)} estimados</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: '#FEF2F2', color: '#B91C1C', fontSize: 12.5, fontWeight: 700, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span>Perdidos no período</span><span>{lostV}{vals[0] > 0 ? ` · ${Math.round(lostV / vals[0] * 100)}% dos cadastros` : ''}</span>
      </div>
    </div>
  )
}
