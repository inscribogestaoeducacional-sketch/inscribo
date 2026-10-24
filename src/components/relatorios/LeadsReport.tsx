// Relatório de Leads: resumo, gráficos, tabela completa, CSV e análise da IA.
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod, sel } from './shared'

interface D {
  total: number; anterior: { total: number; matriculados: number; perdidos: number }; por_etapa: Record<string, number>; por_dia: { d: string; n: number }[]
  por_origem: { origem: string; leads: number; matriculados: number; perdidos: number }[]
  por_responsavel: { responsavel: string; leads: number; agendaram: number; visitaram: number; matriculados: number; perdidos: number }[]
  por_serie: { serie: string; leads: number; matriculados: number }[]; perdas: { motivo: string; n: number }[]; truncado: boolean; historico_desde: string | null; linhas: Record<string, string | number | null>[]
}
const ETAPA: Record<string, string> = { new: 'Novo', contact: 'Contato', scheduled: 'Agendou', visit: 'Visitou', proposal: 'Proposta', enrolled: 'Matriculado', lost: 'Perdido' }
const COLS = ['Criado em', 'Aluno', 'Responsável', 'Telefone', 'Série de interesse', 'Origem', 'Etapa', 'Atendente', 'Histórico de etapas']
const pc = (a: number, b: number) => (b > 0 ? `${Math.round(a / b * 100)}%` : '—')

interface V { total: number; anterior_total: number; realizadas: number; faltaram: number; canceladas: number; agendadas_futuras: number; matriculados_apos_visita: number; sem_baixa?: number; confirmadas?: number; por_motivo?: { motivo: string; situacao: string; n: number }[]; por_responsavel: { pessoa: string; total: number; realizadas: number; faltaram: number; matriculados: number }[]; linhas: Record<string, string | number | null>[] }
export default function LeadsReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState(''); const [q, setQ] = useState(''); const [origem, setOrigem] = useState('')
  const ai = useAnalise('leads', 'Leads', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_leads', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  const linhas = useMemo<Record<string, string | number | null>[]>(() => (d?.linhas ?? []).map(l => ({ ...l, Etapa: ETAPA[String(l.Etapa)] ?? l.Etapa })), [d])
  const shown = useMemo(() => linhas.filter(l => (!origem || (origem === '__none' ? !l['Origem'] : l['Origem'] === origem)) && (!q || Object.values(l).some(v => String(v ?? '').toLowerCase().includes(q.toLowerCase())))), [linhas, q, origem])

  const [vis2, setVis2] = useState<V | null>(null)
  useEffect(() => {
    let alive = true; setVis2(null)
    supabase.rpc('report_visitas', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (alive && !error) setVis2(data as V) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  const e = d?.por_etapa ?? {}
  const agend = (e.scheduled ?? 0) + (e.visit ?? 0) + (e.proposal ?? 0) + (e.enrolled ?? 0), vis = (e.visit ?? 0) + (e.proposal ?? 0) + (e.enrolled ?? 0)
  const csv = () => { if (!d) return; downloadCsv(`leads-${per.from}-${per.to}.csv`, linhas); logAudit(institutionId, 'leads', 'csv', per.from, per.to, linhas.length) }
  const analisar = () => d && ai.run({ periodo_total: d.total, anterior: d.anterior, etapas: d.por_etapa, agendaram_ou_alem: agend, visitaram_ou_alem: vis, por_origem: d.por_origem, por_responsavel: d.por_responsavel, por_serie: d.por_serie, motivos_perda: d.perdas, por_dia: d.por_dia, visitas: vis2 ? { total: vis2.total, anterior: vis2.anterior_total, realizadas: vis2.realizadas, faltaram: vis2.faltaram, canceladas: vis2.canceladas, ainda_agendadas: vis2.agendadas_futuras, viraram_matricula: vis2.matriculados_apos_visita, sem_baixa: vis2.sem_baixa, confirmadas_pela_familia: vis2.confirmadas, motivos_de_nao_realizacao: vis2.por_motivo, por_quem_atende: vis2.por_responsavel } : null })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={csv} csvDisabled={!d || !linhas.length} onAi={analisar} aiBusy={ai.busy} extra={<button disabled={!vis2 || !vis2.linhas.length} onClick={() => { if (!vis2) return; downloadCsv(`visitas-${per.from}-${per.to}.csv`, vis2.linhas); logAudit(institutionId, 'leads', 'csv', per.from, per.to, vis2.linhas.length) }} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: BRAND.ink, fontFamily: 'inherit' }}>CSV das visitas</button>} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel busy={ai.busy} rep={ai.rep} err={ai.err} title="Leads" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="LEADS NO PERÍODO" value={d.total} color="#6366F1" now={d.total} before={d.anterior.total} />
            <Kpi label="AGENDARAM VISITA" value={agend} color="#8B5CF6" sub={`${pc(agend, d.total)} dos leads`} />
            <Kpi label="VISITARAM" value={vis} color="#F59E0B" sub={`${pc(vis, agend)} de quem agendou`} />
            <Kpi label="MATRICULADOS" value={e.enrolled ?? 0} color="#05907B" now={e.enrolled ?? 0} before={d.anterior.matriculados} sub={`${pc(e.enrolled ?? 0, d.total)} dos leads`} />
            <Kpi label="PERDIDOS" value={e.lost ?? 0} color="#B91C1C" now={e.lost ?? 0} before={d.anterior.perdidos} invert sub={`${pc(e.lost ?? 0, d.total)} dos leads`} />
          </KpiGrid>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.5 1 420px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Leads por dia</div><DayLine rows={d.por_dia} /></div>
            <div style={{ ...card, flex: '1 1 300px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por origem</div><BarList rows={d.por_origem.slice(0, 8).map(o => ({ label: o.origem, n: o.leads, extra: `${o.matriculados} matr.` }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ ...card, flex: '1.4 1 420px', overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por responsável</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Responsável</th><th style={{ ...th, textAlign: 'right' }}>Leads</th><th style={{ ...th, textAlign: 'right' }}>Agendaram</th><th style={{ ...th, textAlign: 'right' }}>Visitaram</th><th style={{ ...th, textAlign: 'right' }}>Matric.</th><th style={{ ...th, textAlign: 'right' }}>Conv.</th></tr></thead>
                <tbody>{d.por_responsavel.map(r => <tr key={r.responsavel}><td style={{ ...td, fontWeight: 700 }}>{r.responsavel}</td><td style={{ ...td, textAlign: 'right' }}>{r.leads}</td><td style={{ ...td, textAlign: 'right' }}>{r.agendaram}</td><td style={{ ...td, textAlign: 'right' }}>{r.visitaram}</td><td style={{ ...td, textAlign: 'right' }}>{r.matriculados}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700, color: BRAND.primaryDark }}>{pc(r.matriculados, r.leads)}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 260px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Por que se perde</div>
              {d.perdas.length ? <BarList color="#EF4444" rows={d.perdas.map(p => ({ label: p.motivo, n: p.n }))} /> : <div style={{ fontSize: 13, color: BRAND.muted }}>Nenhum lead perdido no período.</div>}
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, margin: '14px 0 6px' }}>Séries mais procuradas</div>
              <BarList color="#8B5CF6" rows={d.por_serie.slice(0, 6).map(s => ({ label: s.serie, n: s.leads }))} />
            </div>
          </div>
          {vis2 && (
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Visitas dos leads</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>Visitas marcadas no período: {vis2.total} (período anterior: {vis2.anterior_total})</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                {[['Realizadas', vis2.realizadas, '#05907B'], ['Faltaram', vis2.faltaram, '#EF4444'], ['Canceladas', vis2.canceladas, '#94A3B8'], ['Ainda agendadas', vis2.agendadas_futuras, '#6366F1'], ['Viraram matrícula', vis2.matriculados_apos_visita, '#F59E0B']].map(([l, n, c]) => <div key={String(l)} style={{ flex: '1 1 120px', border: '1px solid #E3E8F0', borderRadius: 12, padding: '8px 12px' }}><div style={{ fontSize: 11, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase' }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800, color: String(c) }}>{n}</div></div>)}
              </div>
              {(vis2.sem_baixa ?? 0) > 0 && <div style={{ fontSize: 12.5, color: '#B45309', fontWeight: 700, marginBottom: 8 }}>{vis2.sem_baixa} visita{vis2.sem_baixa === 1 ? '' : 's'} do período já passou e ainda está sem baixa.</div>}
              {(vis2.por_motivo?.length ?? 0) > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 12, fontWeight: 800, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>Por que não aconteceram</div>{vis2.por_motivo!.map((m, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '1px solid #F1F5F4' }}><span>{m.motivo} <span style={{ color: '#94A3B8' }}>· {m.situacao}</span></span><b>{m.n}</b></div>)}</div>}
              {vis2.por_responsavel.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Quem atende</th><th style={{ ...th, textAlign: 'right' }}>Visitas</th><th style={{ ...th, textAlign: 'right' }}>Realizadas</th><th style={{ ...th, textAlign: 'right' }}>Faltaram</th><th style={{ ...th, textAlign: 'right' }}>Viraram matrícula</th></tr></thead>
                <tbody>{vis2.por_responsavel.map(p => <tr key={p.pessoa}><td style={{ ...td, fontWeight: 700 }}>{p.pessoa}</td><td style={{ ...td, textAlign: 'right' }}>{p.total}</td><td style={{ ...td, textAlign: 'right' }}>{p.realizadas}</td><td style={{ ...td, textAlign: 'right' }}>{p.faltaram}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{p.matriculados}</td></tr>)}</tbody></table>}
            </div>
          )}
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, flex: 1 }}>Todos os leads do período ({linhas.length})</div>
              <select value={origem} onChange={e => setOrigem(e.target.value)} style={sel}><option value="">Origem: todas</option>{d.por_origem.map(o => <option key={o.origem} value={o.origem === 'Não informada' ? '__none' : o.origem}>{o.origem}</option>)}</select>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome, telefone…" style={{ ...sel, minWidth: 200 }} />
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{COLS.map(c => <th key={c} style={th}>{c}</th>)}</tr></thead>
              <tbody>{shown.slice(0, 100).map((l, i) => <tr key={i}>{COLS.map(c => <td key={c} style={{ ...td, minWidth: c === 'Histórico de etapas' ? 320 : undefined, fontSize: c === 'Histórico de etapas' ? 12 : 13 }}>{String(l[c] ?? '—')}</td>)}</tr>)}</tbody></table>
            <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8 }}>{shown.length > 100 ? `Mostrando 100 de ${shown.length}. ` : ''}As datas de cada etapa vêm do histórico de mudanças de etapa, registrado desde {d.historico_desde ? d.historico_desde.split('-').reverse().join('/') : 'o início do uso'}; leads mais antigos aparecem sem datas, e “(estimada)” indica etapa deduzida. O CSV leva todos os leads do período com todos os campos, incluindo a data de entrada em cada etapa{d.truncado ? ' (limite de 5.000 leads por arquivo; reduza o período)' : ''}. CPF não é exportado.</div>
          </div>
        </>
      )}
    </div>
  )
}
