// Relatório de investimento da campanha: valores por categoria, mês e canal, e custo por resultado.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface D { total: number; trafego_pago: number; meta_total: number; por_categoria: { categoria: string; investido: number; meta: number }[]; por_mes: { mes: string; investido: number }[]; por_canal: { canal: string; investido: number }[]
  resultados: { leads: number; novos: number; visits: number; by_origin: { source: string; leads: number; matriculas: number }[] }; linhas: Record<string, string | number | null>[] }
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function InvestimentoReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('investimento', 'Investimento', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_investimento', { p_inst: institutionId, p_year: year, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, year, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const cpa = (n: number) => d && n > 0 && d.total > 0 ? brl(d.total / n) : '—'
  const y0 = new Date().getFullYear()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <PeriodBar p={per} />
          <label style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 700 }}>Campanha do ano letivo <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ marginLeft: 4, padding: '7px 10px', borderRadius: 9, border: '1.5px solid #E2E8F0', fontFamily: 'inherit', fontWeight: 700 }}>{[y0, y0 + 1, y0 + 2].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
        </div>
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`investimento-${year}-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'investimento', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ campanha_ano_letivo: year, total_investido_reais: d.total, trafego_pago_reais: d.trafego_pago, meta_de_investimento_reais: d.meta_total, por_categoria: d.por_categoria, por_mes: d.por_mes, por_canal: d.por_canal, resultados_no_periodo: d.resultados,
            custo_por_lead_reais: d.resultados.leads ? d.total / d.resultados.leads : null, custo_por_matricula_nova_reais: d.resultados.novos ? d.total / d.resultados.novos : null })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Investimento" periodLabel={`${per.label} · campanha ${year}`} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="INVESTIDO NO PERÍODO" value={brl(d.total)} color="#8B5CF6" sub={d.meta_total ? `meta da campanha: ${brl(d.meta_total)}` : 'sem meta definida'} />
            <Kpi label="CUSTO POR LEAD" value={cpa(d.resultados.leads)} color="#0EA5E9" sub={`${d.resultados.leads} leads no período`} />
            <Kpi label="CUSTO POR VISITA" value={cpa(d.resultados.visits)} color="#F59E0B" sub={`${d.resultados.visits} visitas`} />
            <Kpi label="CUSTO POR MATRÍCULA NOVA" value={cpa(d.resultados.novos)} color="#00A896" sub={`${d.resultados.novos} matrículas novas`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.4 1 420px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por categoria</div>
              {d.por_categoria.length === 0 ? <div style={{ fontSize: 13, color: BRAND.muted }}>Nenhum investimento lançado nesse período.</div> :
                <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Categoria</th><th style={{ ...th, textAlign: 'right' }}>Investido</th><th style={{ ...th, textAlign: 'right' }}>Meta</th></tr></thead>
                  <tbody>{d.por_categoria.map(c => <tr key={c.categoria}><td style={{ ...td, fontWeight: 700 }}>{c.categoria}</td><td style={{ ...td, textAlign: 'right' }}>{brl(c.investido)}</td><td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{c.meta ? brl(c.meta) : '—'}</td></tr>)}</tbody></table>}
            </div>
            <div style={{ ...card, flex: '1 1 300px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por mês (R$)</div><BarList color="#8B5CF6" rows={d.por_mes.map(m => ({ label: m.mes, n: Math.round(m.investido) }))} />
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, margin: '14px 0 6px' }}>Resultado por origem</div><BarList color="#00A896" rows={d.resultados.by_origin.map(o => ({ label: `${o.source} (${o.matriculas} matrículas)`, n: o.leads }))} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>Custos por lead, visita e matrícula dividem o total investido no período pelos resultados do mesmo período. O CSV traz cada lançamento de investimento.</div>
        </>
      )}
    </div>
  )
}
