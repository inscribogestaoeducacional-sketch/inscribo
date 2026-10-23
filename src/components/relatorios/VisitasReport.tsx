// Relatório de visitas: agendadas, realizadas, faltas e quantas viraram matrícula.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface D {
  total: number; anterior_total: number; realizadas: number; anterior_realizadas: number; faltaram: number; canceladas: number; agendadas_futuras: number; matriculados_apos_visita: number
  por_responsavel: { pessoa: string; total: number; realizadas: number; faltaram: number; matriculados: number }[]; por_dia: { d: string; n: number }[]; linhas: Record<string, string | number | null>[]
}

export default function VisitasReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('visitas', 'Visitas', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_visitas', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`visitas-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'visitas', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ visitas: d.total, anterior: { visitas: d.anterior_total, realizadas: d.anterior_realizadas }, realizadas: d.realizadas, faltaram: d.faltaram, canceladas: d.canceladas, ainda_agendadas: d.agendadas_futuras, matriculados_apos_visita: d.matriculados_apos_visita, por_responsavel: d.por_responsavel, por_dia: d.por_dia })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="Visitas" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="VISITAS NO PERÍODO" value={d.total} color="#8B5CF6" now={d.total} before={d.anterior_total} />
            <Kpi label="REALIZADAS" value={d.realizadas} color="#00A896" now={d.realizadas} before={d.anterior_realizadas} sub={`${pct(d.realizadas, d.total)} do total`} />
            <Kpi label="FALTARAM" value={d.faltaram} color="#EF4444" sub={`${d.canceladas} canceladas · ${d.agendadas_futuras} ainda agendadas`} />
            <Kpi label="VIRARAM MATRÍCULA" value={d.matriculados_apos_visita} color="#F59E0B" sub={`${pct(d.matriculados_apos_visita, d.realizadas)} das visitas realizadas`} />
          </KpiGrid>
          <div style={card}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Visitas por dia</div><DayLine rows={d.por_dia} color="#8B5CF6" /></div>
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por quem atende</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Pessoa</th><th style={{ ...th, textAlign: 'right' }}>Visitas</th><th style={{ ...th, textAlign: 'right' }}>Realizadas</th><th style={{ ...th, textAlign: 'right' }}>Faltaram</th><th style={{ ...th, textAlign: 'right' }}>Viraram matrícula</th></tr></thead>
              <tbody>{d.por_responsavel.map(p => <tr key={p.pessoa}><td style={{ ...td, fontWeight: 700 }}>{p.pessoa}</td><td style={{ ...td, textAlign: 'right' }}>{p.total}</td><td style={{ ...td, textAlign: 'right' }}>{p.realizadas}</td><td style={{ ...td, textAlign: 'right' }}>{p.faltaram}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{p.matriculados}</td></tr>)}</tbody></table>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV traz cada visita: data, aluno, responsável, telefone, origem, situação, quem atende, etapa atual do lead, se matriculou depois e observações.</div>
        </>
      )}
    </div>
  )
}
