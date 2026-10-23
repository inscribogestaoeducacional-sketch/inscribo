// Relatório de transmissões (disparos em massa de WhatsApp): alcance, leitura, respostas, falhas e custo.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface C { nome: string; modelo: string | null; situacao: string; criada: string; destinatarios: number; enviadas: number; entregues: number; lidas: number; respostas: number; falhas: number; valor: number | null }
interface D { campanhas: number; anterior_campanhas: number; destinatarios: number; enviadas: number; entregues: number; lidas: number; falhas: number; respostas: number; valor_cobrado: number
  motivos_de_falha: { motivo: string; n: number }[]; campanhas_lista: C[]; linhas: Record<string, string | number | null>[] }
const SIT: Record<string, string> = { completed: 'Concluída', paused: 'Pausada', cancelled: 'Cancelada', draft: 'Rascunho', running: 'Enviando', scheduled: 'Agendada', sending: 'Enviando' }
const brl = (n: number | null) => (n ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function TransmissoesReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('transmissoes', 'Transmissões', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_transmissoes', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '—'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`transmissoes-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'transmissoes', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ campanhas: d.campanhas, campanhas_periodo_anterior: d.anterior_campanhas, destinatarios: d.destinatarios, enviadas: d.enviadas, entregues: d.entregues, lidas: d.lidas, respostas: d.respostas, falhas: d.falhas, valor_cobrado_reais: d.valor_cobrado, motivos_de_falha: d.motivos_de_falha, lista: d.campanhas_lista })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="Transmissões" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="CAMPANHAS" value={d.campanhas} color="#0EA5E9" now={d.campanhas} before={d.anterior_campanhas} sub={`${d.destinatarios.toLocaleString('pt-BR')} destinatários`} />
            <Kpi label="ENTREGUES" value={d.entregues.toLocaleString('pt-BR')} color="#00A896" sub={`${pct(d.entregues, d.enviadas)} das enviadas`} />
            <Kpi label="LIDAS" value={d.lidas.toLocaleString('pt-BR')} color="#6366F1" sub={`${pct(d.lidas, d.entregues)} das entregues`} />
            <Kpi label="RESPOSTAS" value={d.respostas.toLocaleString('pt-BR')} color="#F59E0B" sub={`${pct(d.respostas, d.entregues)} das entregues`} />
            <Kpi label="FALHAS" value={d.falhas.toLocaleString('pt-BR')} color="#EF4444" sub={`${pct(d.falhas, d.destinatarios)} dos destinatários`} />
            <Kpi label="VALOR COBRADO" value={brl(d.valor_cobrado)} color="#8B5CF6" sub="das transmissões do período" />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '2 1 520px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Campanhas</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Campanha</th><th style={th}>Situação</th><th style={th}>Criada</th><th style={{ ...th, textAlign: 'right' }}>Destinatários</th><th style={{ ...th, textAlign: 'right' }}>Entregues</th><th style={{ ...th, textAlign: 'right' }}>Lidas</th><th style={{ ...th, textAlign: 'right' }}>Respostas</th><th style={{ ...th, textAlign: 'right' }}>Falhas</th></tr></thead>
                <tbody>{d.campanhas_lista.map((c, i) => <tr key={i}><td style={{ ...td, fontWeight: 700 }}>{c.nome}</td><td style={td}>{SIT[c.situacao] ?? c.situacao}</td><td style={{ ...td, color: '#64748B' }}>{c.criada}</td><td style={{ ...td, textAlign: 'right' }}>{c.destinatarios}</td><td style={{ ...td, textAlign: 'right' }}>{c.entregues}</td><td style={{ ...td, textAlign: 'right' }}>{c.lidas}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{c.respostas}</td><td style={{ ...td, textAlign: 'right', color: c.falhas ? '#B91C1C' : undefined }}>{c.falhas}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 260px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por que falharam</div>{d.motivos_de_falha.length ? <BarList color="#EF4444" rows={d.motivos_de_falha.map(m => ({ label: m.motivo.slice(0, 60), n: m.n }))} /> : <div style={{ fontSize: 13, color: BRAND.muted }}>Nenhuma falha no período.</div>}</div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV traz uma linha por campanha: modelo, situação, datas, destinatários, enviadas, entregues, lidas, respostas, falhas, pendentes, valor cobrado e motivo de pausa. Campanhas pausadas mantêm os envios pendentes.</div>
        </>
      )}
    </div>
  )
}
