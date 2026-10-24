// Relatório de saídas (transferências/cancelamentos): Activesoft + registros de Transferências + relatório estratégico da IA.
import { useEffect, useState } from 'react'
import { Loader2, Sparkles, Printer, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { aiFetch } from '../../lib/authHeaders'
import { BRAND } from '../../lib/brand'
import { CountUp, useMounted } from './CampaignCharts'

type Report = { resumo?: string; secoes?: { titulo: string; texto?: string; pontos?: string[] }[]; alertas?: string[] }
interface Data {
  year: number; exits: number
  years: { year: number; exits: number; transferido: number; cancelado: number }[]
  by_grade: { grade: string; n: number }[]
  records: { total: number; retained: number; confirmed: number; with_reason: number; survey_done: number; with_diagnosis: number; reasons: { reason: string; n: number }[]; by_month: { m: string; n: number }[] }
}
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const REASON: Record<string, string> = { financial: 'Financeiro', pedagogical: 'Pedagógico', distance: 'Localização', competition: 'Outra escola', relocation: 'Mudança', relationship: 'Relacionamento', other: 'Outro' }

export default function SaidasReport({ institutionId, institutionName, defaultYear, campaignYear }: { institutionId: string; institutionName: string; defaultYear: number; campaignYear?: number }) {
  const [year, setYear] = useState(defaultYear)
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [rep, setRep] = useState<Report | null>(null)
  const [busy, setBusy] = useState(false)
  const on = useMounted()
  useEffect(() => {
    let alive = true; setD(null); setRep(null)
    supabase.rpc('transfers_report', { p_inst: institutionId, p_year: year }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else { setErr(''); setD(data as Data) } })
    return () => { alive = false }
  }, [institutionId, year])
  if (err) return <div style={{ ...card, color: BRAND.danger }}>{err}</div>
  if (!d) return <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div>

  const prev = d.years.find(y => y.year === year - 1)
  const maxY = Math.max(1, ...d.years.map(y => y.exits)), maxG = Math.max(1, ...d.by_grade.map(g => g.n))
  const r = d.records
  const kpi = (v: number, c: string, t: string) => <div style={{ flex: '1 1 190px' }}><div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1.1 }}><CountUp value={v} /></div><div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{t}</div></div>

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const data = { saidas_activesoft: d.exits, anos: d.years, por_serie: d.by_grade, registros_aqui: { total: r.total, retidos: r.retained, confirmados: r.confirmed, com_motivo: r.with_reason, pesquisa_respondida: r.survey_done, motivos: r.reasons.map(x => ({ motivo: REASON[x.reason] ?? x.reason, n: x.n })) }, campanha: campaignYear ? { ano: campaignYear } : null }
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'transfers_report', payload: { institutionName, year, data } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      setRep(json.result as Report)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível gerar.') } finally { setBusy(false) }
  }

  return (
    <div id="saidas-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <style>{`@media print { body * { visibility: hidden !important } #saidas-print, #saidas-print * { visibility: visible !important } #saidas-print { position: absolute; left: 0; top: 0; width: 100%; padding: 12px } .no-print { display: none !important } }`}</style>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.muted }}>Ano das saídas:</span>
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '7px 11px', borderRadius: 9, border: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
          {Array.from(new Set([defaultYear, defaultYear - 1, defaultYear - 2, ...d.years.map(y => y.year)])).sort((a, b) => b - a).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        {kpi(d.exits, '#DC2626', `Saídas em ${year} na Activesoft (${prev ? `${prev.exits} em ${year - 1}, ${d.exits >= prev.exits ? '+' : ''}${prev.exits ? Math.round((d.exits / prev.exits - 1) * 100) : 0}%` : 'sem ano anterior'})`)}
        {kpi(r.total, '#B45309', 'Registros em Transferências neste ano')}
        {kpi(r.with_reason, r.with_reason ? '#15803D' : '#B91C1C', 'Com motivo conhecido')}
        {kpi(r.retained, '#15803D', 'Retidos pela escola')}
      </div>
      {r.total > 0 && r.with_reason === 0 && <div style={{ padding: '10px 14px', borderRadius: 12, background: BRAND.warnSoft, color: BRAND.warn, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={16} />Nenhuma saída tem motivo ou pesquisa de saída respondida. O relatório mostra quando e onde as saídas acontecem; para saber o porquê, registre o motivo e envie a pesquisa em Transferências.</div>}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...card, flex: '1 1 340px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Saídas por ano (Activesoft)</div>
          <div style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 10px' }}>Transferidos e cancelados em cada ano letivo</div>
          {d.years.map(y => (
            <div key={y.year} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ width: 40, fontSize: 13, fontWeight: 700 }}>{y.year}</span>
              <div style={{ flex: 1, height: 18, background: '#EDF1F0', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: on ? `${y.exits / maxY * 100}%` : 0, height: '100%', background: y.year === year ? '#DC2626' : '#CBD5E1', transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
              <span style={{ width: 110, fontSize: 12.5, color: '#64748B' }}><b style={{ color: BRAND.ink }}>{y.exits}</b> ({y.transferido} transf. · {y.cancelado} canc.)</span>
            </div>
          ))}
        </div>
        <div style={{ ...card, flex: '1 1 340px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Por série em {year}</div>
          <div style={{ fontSize: 12.5, color: '#64748B', margin: '2px 0 10px' }}>Onde mais se perde aluno</div>
          {d.by_grade.length === 0 ? <div style={{ fontSize: 13, color: '#64748B' }}>Sem saídas neste ano.</div> : d.by_grade.map(g => (
            <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 96, fontSize: 12.5, fontWeight: 700 }}>{g.grade}</span>
              <div style={{ flex: 1, height: 12, background: '#EDF1F0', borderRadius: 6, overflow: 'hidden' }}><div style={{ width: on ? `${g.n / maxG * 100}%` : 0, height: '100%', background: '#EF4444', transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} /></div>
              <b style={{ width: 24, fontSize: 13, textAlign: 'right' }}>{g.n}</b>
            </div>
          ))}
        </div>
      </div>
      {r.reasons.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Motivos registrados</div>
          {r.reasons.map(x => <div key={x.reason} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderTop: '1px solid #EEF2F1' }}><span>{REASON[x.reason] ?? x.reason}</span><b>{x.n}</b></div>)}
        </div>
      )}
      <div style={{ fontSize: 12, color: '#94A3B8' }}>A Activesoft não informa o mês da saída, por isso não há gráfico por mês. A lista de quem saiu e o botão para registrar estão em Transferências.</div>
      <div className="no-print" style={{ ...card, borderTop: `4px solid ${BRAND.primary}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>Relatório estratégico (IA)</div>
          <div style={{ fontSize: 13, color: BRAND.muted, marginTop: 3 }}>Compara com os anos anteriores, mostra onde se perde aluno, o que ainda não se sabe e o que fazer, ligando com a campanha{campaignYear ? ` ${campaignYear}` : ''}.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {rep && <button onClick={() => window.print()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '9px 14px', borderRadius: 11, border: '1px solid #E3E8F0', background: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}><Printer size={15} /> PDF</button>}
          <button onClick={generate} disabled={busy} style={{ display: 'inline-flex', gap: 7, alignItems: 'center', padding: '10px 18px', borderRadius: 11, border: 'none', cursor: busy ? 'default' : 'pointer', fontWeight: 700, fontSize: 13.5, color: '#fff', background: 'linear-gradient(135deg,#00695F,#05907B)', opacity: busy ? 0.6 : 1 }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{rep ? 'Gerar de novo' : 'Gerar relatório'}</button>
        </div>
      </div>
      {rep && (
        <>
          {rep.resumo && <div style={{ ...card, background: BRAND.softer, border: `1px solid ${BRAND.softLine}` }}><div style={{ fontSize: 12, fontWeight: 800, color: BRAND.primaryDark, textTransform: 'uppercase', marginBottom: 6 }}>Em resumo</div><div style={{ fontSize: 14.5, color: BRAND.ink, lineHeight: 1.6 }}>{rep.resumo}</div></div>}
          {(rep.alertas ?? []).length > 0 && <div style={{ ...card, background: BRAND.warnSoft, border: '1px solid #FCD34D' }}>{(rep.alertas ?? []).map((a, i) => <div key={i} style={{ fontSize: 13.5, color: BRAND.warn, display: 'flex', gap: 8, marginBottom: 4 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />{a}</div>)}</div>}
          {(rep.secoes ?? []).map((sec, i) => (
            <div key={i} style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>{sec.titulo}</div>
              {sec.texto && <div style={{ fontSize: 14, color: BRAND.text, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{sec.texto}</div>}
              {(sec.pontos ?? []).length > 0 && <ul style={{ margin: '10px 0 0', paddingLeft: 20, listStyle: 'disc', fontSize: 14, lineHeight: 1.6 }}>{(sec.pontos ?? []).map((q, j) => <li key={j} style={{ marginBottom: 4 }}>{q}</li>)}</ul>}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
