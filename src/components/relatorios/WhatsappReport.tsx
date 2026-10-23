// Relatório de WhatsApp: resumo, horários, atendentes, CSV de conversas e de mensagens completas, e análise da IA.
import { useEffect, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface At { atendente: string; conversas: number; resp_mediana_min: number | null; satisfacao_media: number | null; avaliacoes: number }
interface D {
  total: number; com_atendente: number; anterior: { total: number; satisfacao: number | null }; msgs_recebidas: number; msgs_enviadas_humano: number; msgs_enviadas_robo: number
  satisfacao_media: number | null; avaliacoes: number; por_dia: { d: string; n: number }[]; por_hora: { h: number; n: number }[]; por_atendente: At[]; truncado: boolean; linhas: Record<string, string | number | null>[]
}
const fmtMin = (m: number | null) => m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`

export default function WhatsappReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState(''); const [busyMsg, setBusyMsg] = useState(false)
  const ai = useAnalise('whatsapp', 'WhatsApp', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_whatsapp', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>

  const csv = () => { if (!d) return; downloadCsv(`whatsapp-conversas-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'whatsapp', 'csv', per.from, per.to, d.linhas.length) }
  const csvMsgs = async () => {
    if (!confirm('Baixar todas as mensagens do período, com o texto completo? Esse arquivo tem dados pessoais das famílias: guarde com cuidado. O download fica registrado.')) return
    setBusyMsg(true)
    const { data, error } = await supabase.rpc('report_whatsapp_messages', { p_inst: institutionId, p_from: per.from, p_to: per.to, p_limit: 60000 })
    setBusyMsg(false)
    if (error) { alert('Não foi possível baixar as mensagens: ' + error.message); return }
    const rows = (data ?? []) as Record<string, unknown>[]
    if (!rows.length) { alert('Não há mensagens nesse período.'); return }
    downloadCsv(`whatsapp-mensagens-${per.from}-${per.to}.csv`, rows); logAudit(institutionId, 'whatsapp', 'csv_mensagens', per.from, per.to, rows.length)
    if (rows.length >= 60000) alert('O arquivo chegou ao limite de 60.000 mensagens. Use um período menor para ter tudo.')
  }
  const analisar = async () => {
    if (!d) return
    const { data: dig } = await supabase.rpc('whatsapp_period_digest', { p_inst: institutionId, p_from: per.from, p_to: per.to, p_sample: 50 })
    ai.run({ conversas: d.total, com_atendente: d.com_atendente, anterior: d.anterior, mensagens_recebidas: d.msgs_recebidas, enviadas_por_pessoas: d.msgs_enviadas_humano, enviadas_pelo_robo: d.msgs_enviadas_robo, satisfacao_media: d.satisfacao_media, avaliacoes: d.avaliacoes, por_atendente: d.por_atendente, mensagens_por_hora: d.por_hora, por_dia: d.por_dia, amostra: (dig as { amostra?: unknown } | null)?.amostra ?? [] })
  }
  const maxH = Math.max(1, ...(d?.por_hora ?? []).map(h => h.n))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={csv} csvLabel="CSV das conversas" csvDisabled={!d || !d.linhas.length} onAi={analisar} aiBusy={ai.busy}
          extra={<button onClick={csvMsgs} disabled={busyMsg || !d} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', color: BRAND.ink, fontFamily: 'inherit' }}>{busyMsg ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} CSV das mensagens (texto completo)</button>} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="WhatsApp" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="CONVERSAS" value={d.total} color="#25D366" now={d.total} before={d.anterior.total} />
            <Kpi label="COM ATENDENTE" value={d.com_atendente} color="#6366F1" sub={`${d.total ? Math.round(d.com_atendente / d.total * 100) : 0}% das conversas`} />
            <Kpi label="MENSAGENS RECEBIDAS" value={d.msgs_recebidas.toLocaleString('pt-BR')} color="#0EA5E9" sub="das famílias" />
            <Kpi label="ENVIADAS POR PESSOAS" value={d.msgs_enviadas_humano.toLocaleString('pt-BR')} color="#00A896" sub={`${d.msgs_enviadas_robo.toLocaleString('pt-BR')} pelo robô`} />
            <Kpi label="SATISFAÇÃO MÉDIA" value={d.satisfacao_media ?? '—'} color="#F59E0B" now={d.satisfacao_media ?? undefined} before={d.anterior.satisfacao ?? undefined} sub={`${d.avaliacoes} avaliações`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.4 1 420px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Conversas novas por dia</div><DayLine rows={d.por_dia} color="#25D366" /></div>
            <div style={{ ...card, flex: '1 1 300px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Quando as famílias escrevem</div><div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>Mensagens recebidas por hora do dia</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 90 }}>{Array.from({ length: 24 }, (_, h) => d.por_hora.find(x => x.h === h)?.n ?? 0).map((n, h) => <div key={h} title={`${h}h: ${n} mensagens`} style={{ flex: 1, height: `${Math.max(2, n / maxH * 100)}%`, background: '#25D366', borderRadius: '3px 3px 0 0', transition: 'height .8s' }} />)}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94A3B8' }}><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.6 1 420px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por atendente</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Atendente</th><th style={{ ...th, textAlign: 'right' }}>Conversas</th><th style={{ ...th, textAlign: 'right' }} title="Metade das conversas foi respondida em menos que isso">1ª resposta (mediana)</th><th style={{ ...th, textAlign: 'right' }}>Satisfação</th><th style={{ ...th, textAlign: 'right' }}>Avaliações</th></tr></thead>
                <tbody>{d.por_atendente.map(a => <tr key={a.atendente}><td style={{ ...td, fontWeight: 700 }}>{a.atendente}</td><td style={{ ...td, textAlign: 'right' }}>{a.conversas}</td><td style={{ ...td, textAlign: 'right' }}>{fmtMin(a.resp_mediana_min)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{a.satisfacao_media ?? '—'}</td><td style={{ ...td, textAlign: 'right', color: '#94A3B8' }}>{a.avaliacoes}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 260px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Carga por atendente</div><BarList color="#6366F1" rows={d.por_atendente.slice(0, 8).map(a => ({ label: a.atendente, n: a.conversas }))} /></div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV das conversas traz uma linha por conversa{d.truncado ? ' (limite de 5.000; reduza o período)' : ''}. O CSV das mensagens traz o texto completo e só é liberado para gestor e admin; cada download fica registrado. A IA lê só uma amostra de até 50 conversas e não guarda o texto.</div>
        </>
      )}
    </div>
  )
}
