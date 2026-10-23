// Relatório de pesquisas: respostas por pesquisa, NPS, médias por pergunta, opções e comentários.
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, td, th, useAnalise, usePeriod } from './shared'

interface P { pergunta: string; tipo: string; respondidas: number; media: number | null; opcoes: { opcao: string; n: number }[]; textos: string[] }
interface S { pesquisa: string; situacao: string; respostas: number; nps: number | null; perguntas: P[] }
interface D { respostas: number; pesquisas: number; por_dia: { d: string; n: number }[]; lista: S[]; linhas: Record<string, string | number | null>[] }

export default function PesquisasReport({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const per = usePeriod()
  const [d, setD] = useState<D | null>(null); const [err, setErr] = useState('')
  const ai = useAnalise('pesquisas', 'Pesquisas', institutionId, institutionName, per)
  useEffect(() => {
    let alive = true; setD(null); setErr('')
    supabase.rpc('report_pesquisas', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (!alive) return; if (error) setErr(error.message); else setD(data as D) })
    return () => { alive = false }
  }, [institutionId, per.from, per.to])
  if (err) return <div style={{ ...card, color: '#B91C1C' }}>{err.includes('permiss') ? 'Somente gestores podem ver os relatórios.' : err}</div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={() => { if (!d) return; downloadCsv(`pesquisas-${per.from}-${per.to}.csv`, d.linhas); logAudit(institutionId, 'pesquisas', 'csv', per.from, per.to, d.linhas.length) }} csvDisabled={!d || !d.linhas.length}
          onAi={() => d && ai.run({ respostas: d.respostas, pesquisas: d.lista.map(s => ({ pesquisa: s.pesquisa, situacao: s.situacao, respostas: s.respostas, nps: s.nps, perguntas: s.perguntas })), respostas_por_dia: d.por_dia })} aiBusy={ai.busy} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          <AnalisePanel rep={ai.rep} err={ai.err} title="Pesquisas" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="RESPOSTAS NO PERÍODO" value={d.respostas} color="#6366F1" sub={`${d.pesquisas} pesquisa${d.pesquisas === 1 ? '' : 's'}`} />
            {d.lista.slice(0, 3).map(s => s.nps != null && <Kpi key={s.pesquisa} label="NPS" value={s.nps} color={s.nps >= 50 ? '#00A896' : s.nps >= 0 ? '#F59E0B' : '#EF4444'} sub={s.pesquisa.slice(0, 40)} />)}
          </KpiGrid>
          {d.por_dia.length > 0 && <div style={card}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Respostas por dia</div><DayLine rows={d.por_dia} color="#6366F1" /></div>}
          {d.lista.length === 0 && <div style={{ ...card, color: BRAND.muted }}>Nenhuma pesquisa recebeu respostas nesse período.</div>}
          {d.lista.map(s => (
            <div key={s.pesquisa} style={{ ...card, overflowX: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{s.pesquisa}</div>
              <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 8 }}>{s.respostas} respostas · {s.situacao === 'closed' ? 'encerrada' : s.situacao === 'active' ? 'em andamento' : s.situacao}{s.nps != null ? ` · NPS ${s.nps}` : ''}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Pergunta</th><th style={{ ...th, textAlign: 'right' }}>Respostas</th><th style={{ ...th, textAlign: 'right' }}>Média</th></tr></thead>
                <tbody>{s.perguntas.filter(p => p.tipo === 'scale' || p.tipo === 'nps').map((p, i) => <tr key={i}><td style={td}>{p.pergunta}</td><td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{p.respondidas}</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, color: BRAND.ink }}>{p.media != null ? String(p.media).replace('.', ',') : '—'}{p.tipo === 'nps' ? ' / 10' : ' / 5'}</td></tr>)}</tbody></table>
              {s.perguntas.filter(p => p.tipo === 'multiple_choice' && p.opcoes.length).map((p, i) => <div key={i} style={{ marginTop: 12 }}><div style={{ fontWeight: 700, fontSize: 13.5, color: BRAND.ink, marginBottom: 4 }}>{p.pergunta}</div><BarList color="#0EA5E9" rows={p.opcoes.map(o => ({ label: o.opcao.slice(0, 70), n: o.n }))} /></div>)}
              {s.perguntas.filter(p => p.tipo === 'text' && p.textos.length).map((p, i) => <details key={i} style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: BRAND.ink }}>{p.pergunta} ({p.textos.length} comentários)</summary>{p.textos.map((t, j) => <div key={j} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid #EEF2F1' }}>“{t}”</div>)}</details>)}
            </div>
          ))}
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>NPS usa a última pergunta de 0 a 10 de cada pesquisa (notas 9 e 10 menos notas até 6). O CSV traz cada resposta com todas as perguntas. A tela mostra até 60 comentários sorteados por pergunta; o CSV traz todos.</div>
        </>
      )}
    </div>
  )
}
