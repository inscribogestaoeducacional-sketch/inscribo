// Funil da campanha: geral e mês a mês, com filtros de origem e série. Etapas vêm do histórico de mudanças de etapa do lead.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { monthName } from '../../lib/campaignPlan'

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

export default function FunilCampanha({ institutionId, from, to }: { institutionId: string; from: string; to: string }) {
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
        <div style={{ ...card, flex: '1.3 1 420px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 10 }}>Funil geral</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Etapa</th><th style={th}>Leads</th><th style={th}>% dos que entraram</th><th style={th}>% da etapa anterior</th><th style={{ ...th, textAlign: 'left', width: 140 }} /></tr></thead>
            <tbody>
              <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Entraram</td><td style={td}>{ent}</td><td style={td}>100%</td><td style={td}>—</td>
                <td style={td}><div style={{ height: 10, borderRadius: 99, background: '#00A896' }} /></td></tr>
              {rows.map(r => (
                <tr key={r.k}><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>{r.label}</td><td style={td}>{cell(r.e)}</td>
                  <td style={td}>{ent ? Math.round(r.ofTotal * 100) + '%' : '—'}</td><td style={td}>{r.n ? Math.round(r.ofPrev * 100) + '%' : '—'}</td>
                  <td style={td}><div style={{ height: 10, borderRadius: 99, background: '#EDF1F0' }}><div style={{ width: `${Math.min(100, r.ofTotal * 100)}%`, height: '100%', borderRadius: 99, background: r.k === 'enrolled' ? '#059669' : '#00A896' }} /></div></td></tr>
              ))}
              <tr><td style={{ ...td, textAlign: 'left', fontWeight: 700 }}>Perdeu</td><td style={td}>{cell(lost)}</td><td style={td}>{ent && lost ? Math.round(lost.n / ent * 100) + '%' : '—'}</td><td style={td}>—</td>
                <td style={td}><div style={{ height: 10, borderRadius: 99, background: '#EDF1F0' }}><div style={{ width: `${ent && lost ? Math.min(100, lost.n / ent * 100) : 0}%`, height: '100%', borderRadius: 99, background: '#DC2626' }} /></div></td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: BRAND.muted, margin: '10px 0 0' }}>
            {data.history_since ? `O histórico de etapas começou em ${fmtDate(data.history_since)}. ` : ''}Números entre parênteses são etapas estimadas (o lead já estava adiante quando o registro começou). Entraram = leads cadastrados no período.
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
