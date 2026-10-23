// Funil da campanha: geral e mês a mês, com filtros de origem e série. Etapas vêm do histórico de mudanças de etapa do lead.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { funnelNeeds, monthName, type FunnelRates, type PlanMonth } from '../../lib/campaignPlan'

type Et = Record<string, { n: number; inferidos: number }>
interface Data {
  history_since: string | null; entraram: number; totais: Et; origens: string[]; series: string[]
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
        <span style={{ fontSize: 12.5, color: BRAND.muted }}>Período da campanha: {fmtDate(from)} a {fmtDate(to)}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1.5 1 520px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, flex: 1 }}>Funil de matrículas: meta × realizado</div>
            <select value={mes} onChange={e => setMes(e.target.value)} style={sel}>
              <option value="">Campanha toda</option>{data.months.map(m => <option key={m.m} value={m.m}>{monthName(m.m + '-01')}</option>)}
            </select>
          </div>
          <FunnelShape data={data} mes={mes} planMonths={planMonths} rates={rates} />
          <p style={{ fontSize: 12, color: BRAND.muted, margin: '10px 0 0' }}>
            {data.history_since ? `O histórico de etapas começou em ${fmtDate(data.history_since)}. ` : ''}Números entre parênteses são etapas estimadas. A meta de cada etapa vem do plano (metas e taxas do funil, em “Configuração da campanha”).
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
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Mês a mês</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Mês</th><th style={th}>Entraram</th>{STAGES.map(([k, l]) => <th key={k} style={th}>{l}</th>)}<th style={th}>Perdeu</th></tr></thead>
            <tbody>
              {data.months.map(r => (
                <tr key={r.m}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{monthName(r.m + '-01')}</td><td style={td}>{r.entraram}</td>
                  {STAGES.map(([k]) => <td key={k} style={td}>{cell(r.etapas[k])}</td>)}<td style={td}>{cell(r.etapas.lost)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const STG: [string, string, string][] = [['entraram', 'Leads', '#0EA5E9'], ['scheduled', 'Agendamentos', '#14B8A6'], ['visit', 'Visitas', '#10B981'], ['enrolled', 'Matrículas novas', '#059669']]

function FunnelShape({ data, mes, planMonths, rates }: { data: Data; mes: string; planMonths: PlanMonth[]; rates: FunnelRates }) {
  const novosMeta = mes ? (planMonths.find(m => m.m === mes)?.novos ?? 0) : planMonths.reduce((a, m) => a + m.novos, 0)
  const need = funnelNeeds(novosMeta, rates)
  const meta = [need.registrations, need.schedules, need.visits, novosMeta]
  const mrow = data.months.find(m => m.m === mes)
  const real = STG.map(([k]) => k === 'entraram' ? (mes ? (mrow?.entraram ?? 0) : data.entraram) : (mes ? (mrow?.etapas[k]?.n ?? 0) : (data.totais[k]?.n ?? 0)))
  const inf = STG.map(([k]) => k === 'entraram' ? 0 : (mes ? (mrow?.etapas[k]?.inferidos ?? 0) : (data.totais[k]?.inferidos ?? 0)))
  const top = Math.max(meta[0], real[0], 1)
  const w = (n: number) => Math.max(14, Math.min(100, (n / top) * 100))
  const poly = (tw: number, bw: number) => `polygon(${(100 - tw) / 2}% 0, ${(100 + tw) / 2}% 0, ${(100 + bw) / 2}% 100%, ${(100 - bw) / 2}% 100%)`
  return (
    <div>
      {STG.map(([k, label, color], i) => {
        const nextR = i < 3 ? w(real[i + 1]) : Math.max(10, w(real[i]) * 0.7)
        const nextM = i < 3 ? w(meta[i + 1]) : Math.max(10, w(meta[i]) * 0.7)
        const dev = meta[i] > 0 ? Math.round((real[i] - meta[i]) / meta[i] * 100) : null
        const conv = i > 0 && real[i - 1] > 0 ? Math.round(real[i] / real[i - 1] * 100) : null
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{ flex: 1, position: 'relative', height: 58 }}>
              <div style={{ position: 'absolute', inset: 0, background: '#E2E8F0', clipPath: poly(w(meta[i]), nextM), opacity: 0.8 }} />
              <div style={{ position: 'absolute', inset: 0, background: color, clipPath: poly(w(real[i]), nextR), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15 }}>
                <span style={{ textShadow: '0 1px 2px rgba(0,0,0,.25)' }}>{real[i]}{inf[i] > 0 ? <span style={{ fontWeight: 600, fontSize: 12 }}> ({inf[i]})</span> : ''}</span>
              </div>
            </div>
            <div style={{ width: 190, fontSize: 12.5, lineHeight: 1.5 }}>
              <div style={{ color: '#64748B' }}>Meta: <b style={{ color: BRAND.ink }}>{meta[i] || '—'}</b></div>
              <div>{dev === null ? <span style={{ color: '#94A3B8' }}>sem meta definida</span> : <span style={{ fontWeight: 800, color: dev >= 0 ? '#15803D' : dev > -30 ? '#B45309' : '#B91C1C' }}>Desvio {dev > 0 ? '+' : ''}{dev}%</span>}
                {conv !== null && <span style={{ color: '#94A3B8' }}> · converte {conv}%</span>}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
