// Relatório de transferências (alunos que saem): motivos, séries, pesquisa de saída e diagnósticos.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, useAnalise, usePeriod } from './shared'

interface D { total: number; anterior_total: number; com_pesquisa_respondida: number; com_motivo_registrado: number
  por_motivo: { motivo: string; n: number }[]; por_serie: { serie: string; n: number }[]; por_situacao: { situacao: string; n: number }[]; por_dia: { d: string; n: number }[]
  diagnosticos: string[]; detalhes_motivo: string[]; linhas: Record<string, string | number | null>[] }

export default function TransferenciasReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('transferencias', 'Transferências', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_transferencias', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`transferencias-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'transferencias', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ transferencias: d.total, anterior: { transferencias: d.anterior_total }, com_motivo_registrado: d.com_motivo_registrado, com_pesquisa_de_saida_respondida: d.com_pesquisa_respondida, motivos_como_registrados: d.por_motivo, por_serie: d.por_serie, por_situacao: d.por_situacao, detalhes_dos_motivos: d.detalhes_motivo, diagnosticos_da_pesquisa_de_saida: d.diagnosticos })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Transferências" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="TRANSFERÊNCIAS" value={d.total} color="#EF4444" now={d.total} before={d.anterior_total} />
            <Kpi label="COM MOTIVO REGISTRADO" value={pct(d.com_motivo_registrado, d.total)} color="#F59E0B" sub={`${d.com_motivo_registrado} de ${d.total}`} />
            <Kpi label="PESQUISA DE SAÍDA RESPONDIDA" value={pct(d.com_pesquisa_respondida, d.total)} color="#6366F1" sub={`${d.com_pesquisa_respondida} famílias`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.2 1 360px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Motivos (como foram registrados)</div><BarList color="#EF4444" rows={d.por_motivo.slice(0, 12).map(m => ({ label: m.motivo.trim().slice(0, 50), n: m.n }))} /></div>
            <div style={{ ...card, flex: '1 1 300px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por série</div><BarList color="#F59E0B" rows={d.por_serie.map(m => ({ label: m.serie, n: m.n }))} /></div>
          </div>
          <div style={card}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Transferências por dia</div><DayLine rows={d.por_dia} color="#EF4444" /></div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>Os motivos aparecem como foram digitados; a análise da IA agrupa os parecidos. O CSV traz cada aluno com série, motivo, observações internas, respostas da pesquisa de saída e diagnóstico.</div>
        </>
      )}
    </div>
  )
}
