// Relatório de contatos: base de contatos do WhatsApp, novos no período, classificação e relação com a escola.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, useAnalise, usePeriod } from './shared'

interface D { base_total: number; novos: number; anterior_novos: number; novos_com_lead: number; base_com_relacao: number; base_com_email: number; base_com_aluno: number
  por_tipo: { tipo: string; n: number }[]; por_relacao: { relacao: string; n: number }[]; por_dia: { d: string; n: number }[]; linhas: Record<string, string | number | null>[] }

export default function ContatosReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('contatos', 'Contatos', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_contatos', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const pct = (a: number, b: number) => b ? `${Math.round(a / b * 100)}%` : '—'
  const csv = () => {
    if (!d) return
    if (!confirm('Baixar os contatos do período com telefone, e-mail e endereço? O arquivo tem dados pessoais: guarde com cuidado. O download fica registrado.')) return
    downloadCsv(`contatos-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'contatos', 'csv', per.from, per.to, d.linhas.length)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={csv} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ contatos_na_base: d.base_total, novos_no_periodo: d.novos, novos_periodo_anterior: d.anterior_novos, novos_que_viraram_lead: d.novos_com_lead, base_com_relacao_definida: d.base_com_relacao, base_com_email: d.base_com_email, base_com_aluno_vinculado: d.base_com_aluno, por_tipo: d.por_tipo, por_relacao_com_a_escola: d.por_relacao, novos_por_dia: d.por_dia })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="Contatos" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="CONTATOS NA BASE" value={d.base_total.toLocaleString('pt-BR')} color="#0EA5E9" sub="todo o histórico" />
            <Kpi label="NOVOS NO PERÍODO" value={d.novos} color="#00A896" now={d.novos} before={d.anterior_novos} sub={`${d.novos_com_lead} viraram lead`} />
            <Kpi label="COM RELAÇÃO DEFINIDA" value={pct(d.base_com_relacao, d.base_total)} color="#6366F1" sub={`${d.base_com_relacao.toLocaleString('pt-BR')} contatos`} />
            <Kpi label="COM E-MAIL" value={pct(d.base_com_email, d.base_total)} color="#F59E0B" sub={`${d.base_com_aluno.toLocaleString('pt-BR')} com aluno vinculado`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.4 1 420px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Contatos novos por dia</div><DayLine rows={d.por_dia} color="#0EA5E9" /></div>
            <div style={{ ...card, flex: '1 1 300px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Tipo de contato (base toda)</div><BarList color="#0EA5E9" rows={d.por_tipo.map(t => ({ label: t.tipo, n: t.n }))} />
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, margin: '14px 0 6px' }}>Relação com a escola</div><BarList color="#8B5CF6" rows={d.por_relacao.map(t => ({ label: t.relacao, n: t.n }))} />
            </div>
          </div>
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV traz os contatos cadastrados no período (até 20.000): nome, telefone, e-mail, endereço, tipo, relação com a escola, aluno vinculado, etiquetas e se virou lead. Os números por tipo e relação consideram a base inteira. Pede confirmação e fica registrado.</div>
        </>
      )}
    </div>
  )
}
