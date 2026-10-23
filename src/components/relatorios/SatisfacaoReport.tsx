// Relatório de satisfação do atendimento (nota 1 a 3 dada pelas famílias ao fim da conversa).
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, satPct, td, th, useAnalise, usePeriod } from './shared'

interface D {
  conversas: number; pesquisas_enviadas: number; avaliacoes: number; media: number | null; anterior: { media: number | null; avaliacoes: number }; distribuicao: Record<string, number>
  por_atendente: { atendente: string; avaliacoes: number; media: number | null; notas_baixas: number }[]; por_dia: { d: string; n: number }[]; linhas: Record<string, string | number | boolean | null>[]
}
const LAB: [string, string, string][] = [['3', 'Ótimo', '#059669'], ['2', 'Regular', '#F59E0B'], ['1', 'Ruim', '#DC2626']]

export default function SatisfacaoReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('satisfacao', 'Satisfação do atendimento', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_satisfacao', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const comentarios = (d?.linhas ?? []).filter(l => l['Comentário'])
  const baixas = (d?.linhas ?? []).filter(l => Number(l['Nota']) === 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`satisfacao-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'satisfacao', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ conversas: d.conversas, pesquisas_enviadas: d.pesquisas_enviadas, avaliacoes: d.avaliacoes, indice_satisfacao_pct: satPct(d.media), media_1a3: d.media, anterior: { media_1a3: d.anterior.media, indice_pct: satPct(d.anterior.media), avaliacoes: d.anterior.avaliacoes }, distribuicao_1ruim_2regular_3otimo: d.distribuicao, por_atendente: d.por_atendente, media_por_dia: d.por_dia, comentarios: comentarios.slice(0, 40).map(c => ({ nota: c['Nota'], atendente: c['Atendente'], texto: String(c['Comentário']).slice(0, 200) })) })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Satisfação do atendimento" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="SATISFAÇÃO" value={satPct(d.media) != null ? `${satPct(d.media)}%` : '—'} color="#F59E0B" now={satPct(d.media) ?? undefined} before={satPct(d.anterior.media) ?? undefined} sub={`nota ${String(d.media ?? '—').replace('.', ',')} de 3`} />
            <Kpi label="AVALIAÇÕES" value={d.avaliacoes} color="#6366F1" now={d.avaliacoes} before={d.anterior.avaliacoes} />
            <Kpi label="PESQUISAS ENVIADAS" value={d.pesquisas_enviadas} color="#0EA5E9" sub="no período" />
            <Kpi label="NOTA RUIM" value={d.distribuicao['1'] ?? 0} color="#DC2626" sub={`${d.avaliacoes ? Math.round((d.distribuicao['1'] ?? 0) / d.avaliacoes * 100) : 0}% das avaliações`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1 1 300px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>Como as famílias avaliaram</div>
              {LAB.map(([k, l, c]) => { const n = d.distribuicao[k] ?? 0; return <div key={k} title={`${l}: ${n}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13 }}><span style={{ width: 60, color: c, fontWeight: 700 }}>{l}</span><div style={{ flex: 1, height: 14, borderRadius: 7, background: '#EDF1F0', overflow: 'hidden' }}><div style={{ width: `${d.avaliacoes ? n / d.avaliacoes * 100 : 0}%`, height: '100%', background: c, transition: 'width .8s' }} /></div><b style={{ width: 70, textAlign: 'right' }}>{n} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({d.avaliacoes ? Math.round(n / d.avaliacoes * 100) : 0}%)</span></b></div> })}
            </div>
            <div style={{ ...card, flex: '1.4 1 380px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Nota média por dia (de 1 a 3)</div><DayLine rows={d.por_dia} color="#F59E0B" /></div>
          </div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por atendente</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Atendente</th><th style={{ ...th, textAlign: 'right' }}>Avaliações</th><th style={{ ...th, textAlign: 'right' }}>Satisfação</th><th style={{ ...th, textAlign: 'right' }}>Nota (1 a 3)</th><th style={{ ...th, textAlign: 'right' }}>Notas ruins</th></tr></thead>
              <tbody>{d.por_atendente.map(a => <tr key={a.atendente}><td style={{ ...td, fontWeight: 700 }}>{a.atendente}</td><td style={{ ...td, textAlign: 'right' }}>{a.avaliacoes}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{satPct(a.media) != null ? `${satPct(a.media)}%` : '—'}</td><td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{a.media ?? '—'}</td><td style={{ ...td, textAlign: 'right', color: a.notas_baixas ? '#B91C1C' : '#94A3B8' }}>{a.notas_baixas}</td></tr>)}</tbody></table>
          </div>
          {(baixas.length > 0 || comentarios.length > 0) && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Para olhar de perto</div>
              <div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>Notas ruins e comentários deixados pelas famílias (até 15). O CSV traz todos, com contato para você retornar.</div>
              {[...baixas, ...comentarios.filter(c => Number(c['Nota']) !== 1)].slice(0, 15).map((l, i) => (
                <div key={i} style={{ padding: '7px 0', borderTop: i ? '1px solid #EEF2F1' : 'none', fontSize: 13 }}>
                  <b style={{ color: Number(l['Nota']) === 1 ? '#DC2626' : Number(l['Nota']) === 2 ? '#B45309' : '#059669' }}>{Number(l['Nota']) === 1 ? 'Ruim' : Number(l['Nota']) === 2 ? 'Regular' : 'Ótimo'}</b> · {String(l['Data'])} · atendente {String(l['Atendente'] ?? '—')}{l['Comentário'] ? <div style={{ color: BRAND.text, fontStyle: 'italic' }}>“{String(l['Comentário'])}”</div> : <span style={{ color: '#94A3B8' }}> · sem comentário</span>}
                </div>))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
