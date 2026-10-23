// Relatório de matrículas por pessoa: quem matriculou, em quais séries e de quais origens.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface D {
  total: number; anterior_total: number; sem_data_exata: number; dias_ate_matricular_mediana: number | null
  por_pessoa: { pessoa: string; matriculas: number; dias_mediana: number | null }[]; por_serie: { serie: string; n: number }[]; por_origem: { origem: string; n: number }[]
  por_dia: { d: string; n: number }[]; linhas: Record<string, string | number | null>[]
}

export default function MatriculasReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('matriculas', 'Matrículas por pessoa', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_matriculas', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`matriculas-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'matriculas', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ matriculas: d.total, anterior: { matriculas: d.anterior_total }, datas_estimadas: d.sem_data_exata, por_pessoa: d.por_pessoa, por_serie: d.por_serie, por_origem_do_lead: d.por_origem, por_dia: d.por_dia })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Matrículas por pessoa" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="MATRÍCULAS NO PERÍODO" value={d.total} color="#00A896" now={d.total} before={d.anterior_total} />
            <Kpi label="PESSOAS QUE MATRICULARAM" value={d.por_pessoa.length} color="#6366F1" sub="inclui “sem responsável”, se houver" />
            <Kpi label="DATAS ESTIMADAS" value={d.sem_data_exata} color="#B45309" sub="sem a data exata registrada" />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.2 1 360px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Quem matriculou</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Pessoa</th><th style={{ ...th, textAlign: 'right' }}>Matrículas</th><th style={{ ...th, textAlign: 'right' }}>% do total</th><th style={{ ...th, textAlign: 'right' }} title="Pode ser 0 quando o lead é cadastrado já no dia da matrícula">Dias do lead à matrícula</th></tr></thead>
                <tbody>{d.por_pessoa.map(p => <tr key={p.pessoa}><td style={{ ...td, fontWeight: 700 }}>{p.pessoa}</td><td style={{ ...td, textAlign: 'right' }}>{p.matriculas}</td><td style={{ ...td, textAlign: 'right' }}>{d.total ? Math.round(p.matriculas / d.total * 100) : 0}%</td><td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{p.dias_mediana ?? '—'}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 300px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por série</div><BarList color="#00A896" rows={d.por_serie.map(s => ({ label: s.serie, n: s.n }))} />
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, margin: '14px 0 6px' }}>De onde vieram</div><BarList color="#8B5CF6" rows={d.por_origem.map(s => ({ label: s.origem, n: s.n }))} />
            </div>
          </div>
          <div style={card}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Matrículas por dia</div><DayLine rows={d.por_dia} /></div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV traz cada matrícula: aluno, responsável, série, quem matriculou, origem do lead e valor da matrícula{d.linhas.length >= 5000 ? ' (limite de 5.000)' : ''}.</div>
        </>
      )}
    </div>
  )
}
