// Relatório de Atendimento: desempenho por atendente, com detalhe de cada pessoa, CSV e análise da IA.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface At { atendente: string; conversas: number; encerradas: number; sem_resposta_humana: number; resp_mediana_min: number | null; resp_p90_min: number | null; resolucao_mediana_h: number | null; satisfacao: number | null; avaliacoes: number; mensagens_enviadas: number }
interface D { total: number; anterior_total: number; sem_atendente: number; por_atendente: At[] }
const fmtMin = (m: number | null) => m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
const fmtH = (h: number | null) => h == null ? '—' : h < 48 ? `${h} h` : `${Math.round(h / 24)} dias`

export default function AtendimentoReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState(''); const [pick, setPick] = useState('')
  const ai = useAnalise('atendimento', 'Atendimento', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_atendimento', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const rows = (d?.por_atendente ?? []).map(a => ({ Atendente: a.atendente, Conversas: a.conversas, Encerradas: a.encerradas, 'Sem resposta de pessoa': a.sem_resposta_humana, 'Primeira resposta, mediana (min)': a.resp_mediana_min, 'Primeira resposta, 90% (min)': a.resp_p90_min, 'Tempo até encerrar, mediana (h)': a.resolucao_mediana_h, 'Mensagens enviadas': a.mensagens_enviadas, 'Satisfação média (1 a 3)': a.satisfacao, Avaliações: a.avaliacoes }))
  const sel = d?.por_atendente.find(a => a.atendente === pick)
  const tot = (k: keyof At) => (d?.por_atendente ?? []).reduce((x, a) => x + (Number(a[k]) || 0), 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { downloadCsv(`atendimento-${per.from}-${per.to}.csv`, rows); logAudit(institutionId, 'atendimento', 'csv', per.from, per.to, rows.length) }} csvDisabled={!rows.length} onAi={() => d && ai.run({ conversas_com_atendente: d.total, anterior: { conversas: d.anterior_total }, conversas_sem_atendente: d.sem_atendente, por_atendente: d.por_atendente })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="Atendimento" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="CONVERSAS ATENDIDAS" value={d.total} color="#6366F1" now={d.total} before={d.anterior_total} />
            <Kpi label="SEM ATENDENTE" value={d.sem_atendente} color="#B45309" sub="conversas só com o robô" />
            <Kpi label="SEM RESPOSTA DE PESSOA" value={tot('sem_resposta_humana')} color="#B91C1C" sub="entre as atendidas" />
            <Kpi label="MENSAGENS ENVIADAS" value={tot('mensagens_enviadas').toLocaleString('pt-BR')} color="#00A896" sub="por pessoas da equipe" />
          </KpiGrid>
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Cada atendente</div>
            <div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>Clique numa pessoa para ver o resumo dela. A mediana é o tempo em que metade das conversas já tinha sido respondida; "90%" é o tempo das conversas mais demoradas.</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Atendente</th><th style={{ ...th, textAlign: 'right' }}>Conversas</th><th style={{ ...th, textAlign: 'right' }}>1ª resposta (mediana)</th><th style={{ ...th, textAlign: 'right' }}>1ª resposta (90%)</th><th style={{ ...th, textAlign: 'right' }}>Até encerrar</th><th style={{ ...th, textAlign: 'right' }}>Mensagens</th><th style={{ ...th, textAlign: 'right' }}>Satisfação</th></tr></thead>
              <tbody>{d.por_atendente.map(a => <tr key={a.atendente} onClick={() => setPick(pick === a.atendente ? '' : a.atendente)} style={{ cursor: 'pointer', background: pick === a.atendente ? '#E6F7F5' : undefined }}><td style={{ ...td, fontWeight: 700 }}>{a.atendente}</td><td style={{ ...td, textAlign: 'right' }}>{a.conversas}</td><td style={{ ...td, textAlign: 'right' }}>{fmtMin(a.resp_mediana_min)}</td><td style={{ ...td, textAlign: 'right' }}>{fmtMin(a.resp_p90_min)}</td><td style={{ ...td, textAlign: 'right' }}>{fmtH(a.resolucao_mediana_h)}</td><td style={{ ...td, textAlign: 'right' }}>{a.mensagens_enviadas.toLocaleString('pt-BR')}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{a.satisfacao ?? '—'} <span style={{ color: '#94A3B8', fontWeight: 400 }}>({a.avaliacoes})</span></td></tr>)}</tbody></table>
          </div>
          {sel && (
            <div style={{ ...card, borderColor: BRAND.primary }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>{sel.atendente} em {per.label}</div>
              <KpiGrid>
                <Kpi label="CONVERSAS" value={sel.conversas} color="#6366F1" sub={`${d.total ? Math.round(sel.conversas / d.total * 100) : 0}% do total da equipe`} />
                <Kpi label="ENCERRADAS" value={sel.encerradas} color="#00A896" sub={`${sel.conversas ? Math.round(sel.encerradas / sel.conversas * 100) : 0}% das conversas`} />
                <Kpi label="SEM RESPOSTA DE PESSOA" value={sel.sem_resposta_humana} color="#B91C1C" sub="das conversas dela" />
                <Kpi label="SATISFAÇÃO" value={sel.satisfacao ?? '—'} color="#F59E0B" sub={`${sel.avaliacoes} avaliações · escala 1 a 3`} />
              </KpiGrid>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1 1 320px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Conversas por atendente</div><BarList color="#6366F1" rows={d.por_atendente.map(a => ({ label: a.atendente, n: a.conversas }))} /></div>
            <div style={{ ...card, flex: '1 1 320px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Mensagens enviadas</div><BarList color="#00A896" rows={d.por_atendente.map(a => ({ label: a.atendente, n: a.mensagens_enviadas }))} /></div>
          </div>
        </>
      )}
    </div>
  )
}
