// Relatório de WhatsApp: resumo, horários, atendentes, CSV de conversas e de mensagens completas, e análise da IA.
import { useEffect, useState } from 'react'
import { Loader2, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { aiFetch } from '../../lib/authHeaders'
import { ActionBar, AnalisePanel, BarList, DayLine, Kpi, KpiGrid, PeriodBar, card, downloadCsv, logAudit, satPct, td, th, useAnalise, usePeriod } from './shared'

interface At { atendente: string; conversas: number; resp_mediana_min: number | null; satisfacao_media: number | null; avaliacoes: number }
interface Garg { criterio?: string; por_atendente: { atendente: string; conversas: number; sem_resposta_ha_mais_de_24h: number; familia_nao_voltou_ha_mais_de_48h: number; com_lead: number; agendaram_ou_alem: number; matriculados: number; falas_da_familia: number; respondidas_em_5min_pct: number | null; respondidas_em_30min_pct: number | null; respondidas_em_60min_pct: number | null; sem_resposta_nas_falas: number; mediana_resposta_min: number | null }[]; por_hora: { h: number; falas: number; respondidas_em_30min_pct: number | null; sem_resposta: number }[] }
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
  const [reading, setReading] = useState('')
  const [choose, setChoose] = useState(false)
  const [garg, setGarg] = useState<Garg | null>(null)
  useEffect(() => { let alive = true; setGarg(null); supabase.rpc('report_whatsapp_gargalos', { p_inst: institutionId, p_from: per.from, p_to: per.to }).then(({ data, error }) => { if (alive && !error) setGarg(data as Garg) }); return () => { alive = false } }, [institutionId, per.from, per.to])
  const callAi = async (action: string, payload: unknown) => {
    for (let t = 0; t < 2; t++) {
      try {
        const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action, payload }) })
        const json = await resp.json().catch(() => ({}))
        if (resp.ok && json.result) return json.result
      } catch { /* tenta de novo */ }
    }
    return null
  }
  const analisar = async (completa: boolean) => {
    if (!d) return
    setChoose(false)
    try {
      setReading('Medindo gargalos…')
      const g = await supabase.rpc('report_whatsapp_gargalos', { p_inst: institutionId, p_from: per.from, p_to: per.to })
      const gargalos = g.error ? null : (g.data as Garg); setGarg(gargalos)
      let extratos: unknown[] = []; let lidas = 0
      if (!completa) {
        setReading('Sorteando conversas…')
        const { data: amostra, error } = await supabase.rpc('report_whatsapp_sample', { p_inst: institutionId, p_from: per.from, p_to: per.to, p_per_att: 30, p_max: 140 })
        if (error) throw new Error(error.message)
        const conv = (amostra ?? []) as { atendente: string; msgs: unknown[] }[]; lidas = conv.length
        const nB = Math.min(5, Math.max(1, Math.ceil(conv.length / 26)))
        const batches: unknown[][] = Array.from({ length: nB }, () => []); conv.forEach((c, i) => batches[i % nB].push(c))
        let done = 0; setReading(`Lendo as conversas (0 de ${nB})…`)
        extratos = (await Promise.all(batches.filter(b => b.length).map(async b => { const r = await callAi('whatsapp_batch_extract', { institutionName, conversas: b }); done++; setReading(`Lendo as conversas (${done} de ${nB})…`); return r }))).filter(Boolean)
      } else {
        // leitura completa: baixa as conversas em páginas, monta lotes de ~30 mil caracteres e lê em paralelo
        const batches: unknown[][] = []; let cur: unknown[] = []; let size = 0; let off = 0; let total = d.total
        for (;;) {
          setReading(`Baixando as conversas (${Math.min(off, total)} de ${total})…`)
          const { data, error } = await supabase.rpc('report_whatsapp_full', { p_inst: institutionId, p_from: per.from, p_to: per.to, p_offset: off, p_limit: 100 })
          if (error) throw new Error(error.message)
          const pg = data as { total: number; items: { msgs: unknown[] }[] }; total = pg.total
          if (!pg.items.length) break
          for (const it of pg.items) { const sz = JSON.stringify(it).length; if (size + sz > 30000 && cur.length) { batches.push(cur); cur = []; size = 0 } cur.push(it); size += sz; lidas++ }
          off += pg.items.length; if (off >= total) break
        }
        if (cur.length) batches.push(cur)
        let done = 0; let next = 0; const res: unknown[] = []
        setReading(`Lendo as conversas (0 de ${lidas})…`)
        const worker = async () => { while (next < batches.length) { const i = next++; const r = await callAi('whatsapp_batch_extract', { institutionName, conversas: batches[i] }); if (r) res.push(r); done += batches[i].length; setReading(`Lendo as conversas (${Math.min(done, lidas)} de ${lidas})…`) } }
        await Promise.all([worker(), worker(), worker(), worker()])
        if (!res.length) throw new Error('A IA não conseguiu ler as conversas. Tente de novo em instantes.')
        // une as leituras em rodadas de até 5
        let level = res
        while (level.length > 1) {
          setReading(`Reunindo as leituras (${level.length})…`)
          const groups: unknown[][] = []; for (let i = 0; i < level.length; i += 5) groups.push(level.slice(i, i + 5))
          const merged = await Promise.all(groups.map(async gp => gp.length === 1 ? gp[0] : ((await callAi('whatsapp_merge_extracts', { extratos: gp })) ?? gp[0])))
          level = merged
        }
        extratos = level
      }
      setReading('Escrevendo o relatório…')
      await ai.run({
        modo_leitura: completa ? `COMPLETA: a IA leu ${lidas} de ${d.total} conversas do período` : `AMOSTRA: a IA leu ${lidas} de ${d.total} conversas (sorteio por atendente)`,
        conversas: d.total, com_atendente: d.com_atendente, anterior: d.anterior, mensagens_recebidas: d.msgs_recebidas, enviadas_por_pessoas: d.msgs_enviadas_humano, enviadas_pelo_robo: d.msgs_enviadas_robo,
        satisfacao_indice_pct: satPct(d.satisfacao_media), satisfacao_media_1a3: d.satisfacao_media, avaliacoes: d.avaliacoes, por_atendente: d.por_atendente, mensagens_por_hora: d.por_hora, por_dia: d.por_dia,
        gargalos_medidos: gargalos, conversas_lidas_pela_ia: lidas, leitura_das_conversas: extratos,
      })
    } catch (e) { alert(e instanceof Error ? e.message : 'Não foi possível analisar.') } finally { setReading('') }
  }
  const nComp = d ? d.total : 0
  const callsEst = Math.ceil(nComp / 20) + Math.ceil(nComp / 100) + 2
  const maxH = Math.max(1, ...(d?.por_hora ?? []).map(h => h.n))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <PeriodBar p={per} />
        <ActionBar onCsv={csv} csvLabel="CSV das conversas" csvDisabled={!d || !d.linhas.length} onAi={() => setChoose(true)} aiBusy={ai.busy || !!reading} aiLabel={reading || 'Analisando…'}
          extra={<button onClick={csvMsgs} disabled={busyMsg || !d} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', color: BRAND.ink, fontFamily: 'inherit' }}>{busyMsg ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} CSV das mensagens (texto completo)</button>} />
      </div>
      {!d ? <div style={{ display: 'flex', gap: 8, color: BRAND.muted }}><Loader2 size={16} className="animate-spin" /> Carregando…</div> : (
        <>
          {choose && <div style={{ ...card, border: `2px solid ${BRAND.primary}` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Como a IA deve ler as conversas?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
              <button onClick={() => analisar(true)} disabled={d.total > 1500} style={{ textAlign: 'left', padding: 12, borderRadius: 12, border: `1.5px solid ${BRAND.primary}`, background: BRAND.softer, cursor: d.total > 1500 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: d.total > 1500 ? 0.5 : 1 }}>
                <div style={{ fontWeight: 800, color: BRAND.ink }}>Leitura completa (recomendada)</div>
                <div style={{ fontSize: 12.5, color: BRAND.text, marginTop: 2 }}>Lê as {d.total} conversas do período, uma a uma. Mais profunda e precisa. Leva alguns minutos e usa cerca de {callsEst} das análises de IA do mês da escola.{d.total > 1500 ? ' Acima de 1.500 conversas: reduza o período.' : ''}</div>
              </button>
              <button onClick={() => analisar(false)} style={{ textAlign: 'left', padding: 12, borderRadius: 12, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>
                <div style={{ fontWeight: 800, color: BRAND.ink }}>Leitura rápida (amostra)</div>
                <div style={{ fontSize: 12.5, color: BRAND.text, marginTop: 2 }}>Lê até 140 conversas sorteadas. Leva cerca de um minuto e usa poucas análises.</div>
              </button>
            </div>
            <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 8 }}>Os textos das conversas são enviados ao provedor de IA só durante a geração, sem nomes nem telefones, e não são guardados. A IA é orientada a não citar dados pessoais. Cada análise fica registrada.</div>
            <button onClick={() => setChoose(false)} style={{ marginTop: 6, background: 'none', border: 'none', color: BRAND.muted, cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>Cancelar</button>
          </div>}
          <AnalisePanel rep={ai.rep} err={ai.err} title="WhatsApp" periodLabel={per.label} institutionId={institutionId} institutionName={institutionName} />
          <KpiGrid>
            <Kpi label="CONVERSAS" value={d.total} color="#25D366" now={d.total} before={d.anterior.total} />
            <Kpi label="COM ATENDENTE" value={d.com_atendente} color="#6366F1" sub={`${d.total ? Math.round(d.com_atendente / d.total * 100) : 0}% das conversas`} />
            <Kpi label="MENSAGENS RECEBIDAS" value={d.msgs_recebidas.toLocaleString('pt-BR')} color="#0EA5E9" sub="das famílias" />
            <Kpi label="ENVIADAS POR PESSOAS" value={d.msgs_enviadas_humano.toLocaleString('pt-BR')} color="#00A896" sub={`${d.msgs_enviadas_robo.toLocaleString('pt-BR')} pelo robô`} />
            <Kpi label="SATISFAÇÃO" value={satPct(d.satisfacao_media) != null ? `${satPct(d.satisfacao_media)}%` : '—'} color="#F59E0B" now={satPct(d.satisfacao_media) ?? undefined} before={satPct(d.anterior.satisfacao) ?? undefined} sub={`nota ${String(d.satisfacao_media ?? '—').replace('.', ',')} de 3 · ${d.avaliacoes} avaliações`} />
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
              <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Atendente</th><th style={{ ...th, textAlign: 'right' }}>Conversas</th><th style={{ ...th, textAlign: 'right' }} title="Metade das conversas foi respondida em menos que isso">1ª resposta (mediana)</th><th style={{ ...th, textAlign: 'right' }}>Satisfação</th><th style={{ ...th, textAlign: 'right' }}>Nota (1 a 3)</th><th style={{ ...th, textAlign: 'right' }}>Avaliações</th></tr></thead>
                <tbody>{d.por_atendente.map(a => <tr key={a.atendente}><td style={{ ...td, fontWeight: 700 }}>{a.atendente}</td><td style={{ ...td, textAlign: 'right' }}>{a.conversas}</td><td style={{ ...td, textAlign: 'right' }}>{fmtMin(a.resp_mediana_min)}</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{satPct(a.satisfacao_media) != null ? `${satPct(a.satisfacao_media)}%` : '—'}</td><td style={{ ...td, textAlign: 'right', color: '#64748B' }}>{a.satisfacao_media ?? '—'}</td><td style={{ ...td, textAlign: 'right', color: '#94A3B8' }}>{a.avaliacoes}</td></tr>)}</tbody></table>
            </div>
            <div style={{ ...card, flex: '1 1 260px' }}><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>Carga por atendente</div><BarList color="#6366F1" rows={d.por_atendente.slice(0, 8).map(a => ({ label: a.atendente, n: a.conversas }))} /></div>
          </div>
          {garg && garg.por_atendente.length > 0 && <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 2 }}>Gargalos medidos</div>
            <div style={{ fontSize: 12, color: BRAND.muted, marginBottom: 6 }}>Tempo de resposta conta só falas da família entre 7h e 19h. “Sem resposta” = última fala é da família há mais de 24h. “Não voltou” = a escola falou por último há mais de 48h.</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Atendente</th><th style={{ ...th, textAlign: 'right' }}>Conversas</th><th style={{ ...th, textAlign: 'right' }}>Resp. em 5 min</th><th style={{ ...th, textAlign: 'right' }}>em 30 min</th><th style={{ ...th, textAlign: 'right' }}>em 60 min</th><th style={{ ...th, textAlign: 'right' }}>Sem resposta +24h</th><th style={{ ...th, textAlign: 'right' }}>Família não voltou</th><th style={{ ...th, textAlign: 'right' }}>Agendaram+</th><th style={{ ...th, textAlign: 'right' }}>Matriculados</th></tr></thead>
              <tbody>{garg.por_atendente.map(a => <tr key={a.atendente}><td style={{ ...td, fontWeight: 700 }}>{a.atendente}</td><td style={{ ...td, textAlign: 'right' }}>{a.conversas}</td><td style={{ ...td, textAlign: 'right' }}>{a.respondidas_em_5min_pct ?? '—'}{a.respondidas_em_5min_pct != null ? '%' : ''}</td><td style={{ ...td, textAlign: 'right' }}>{a.respondidas_em_30min_pct ?? '—'}{a.respondidas_em_30min_pct != null ? '%' : ''}</td><td style={{ ...td, textAlign: 'right' }}>{a.respondidas_em_60min_pct ?? '—'}{a.respondidas_em_60min_pct != null ? '%' : ''}</td><td style={{ ...td, textAlign: 'right', color: a.sem_resposta_ha_mais_de_24h ? '#B91C1C' : undefined, fontWeight: 700 }}>{a.sem_resposta_ha_mais_de_24h}</td><td style={{ ...td, textAlign: 'right' }}>{a.familia_nao_voltou_ha_mais_de_48h}</td><td style={{ ...td, textAlign: 'right' }}>{a.agendaram_ou_alem}</td><td style={{ ...td, textAlign: 'right' }}>{a.matriculados}</td></tr>)}</tbody></table>
          </div>}
          <div style={{ fontSize: 12.5, color: BRAND.muted }}>O CSV das conversas traz uma linha por conversa{d.truncado ? ' (limite de 5.000; reduza o período)' : ''}. O CSV das mensagens traz o texto completo e só é liberado para gestor e admin; cada download fica registrado. A análise da IA pode ler todas as conversas do período (leitura completa) ou uma amostra sorteada; os textos seguem sem nomes nem telefones e não são guardados. Satisfação em %: 100% é só nota Ótimo, 0% só nota Ruim (a mesma conta da Home).</div>
        </>
      )}
    </div>
  )
}
