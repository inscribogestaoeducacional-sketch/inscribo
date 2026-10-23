// Aba "Atendimento IA" dos Relatórios: a IA lê uma amostra das conversas de WhatsApp de um período e aponta problemas, soluções e pontos por atendente.
// Privacidade: o texto das conversas não é guardado; só vai para a IA durante a geração. O relatório fica na tela (não é salvo).
import { useState } from 'react'
import { Loader2, Sparkles, ShieldCheck, Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { aiFetch } from '../../lib/authHeaders'
import { BRAND } from '../../lib/brand'

interface Atend { atendente: string; conversas: number; resp_mediana_min: number | null; satisfacao_media: number | null; avaliacoes: number }
interface Digest { total_conversas: number; com_atendente: number; por_atendente: Atend[]; amostra: unknown[] }
interface Rep { resumo?: string; problemas?: { titulo: string; descricao: string; exemplo?: string }[]; solucoes?: string[]; duvidas_frequentes?: string[]; atendentes?: { nome: string; forte: string; melhorar: string }[]; alertas?: string[] }
const card: React.CSSProperties = { background: '#fff', border: '1px solid #E3E8F0', borderRadius: 16, padding: '18px 20px' }
const inp: React.CSSProperties = { padding: '8px 10px', borderRadius: 9, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'inherit', color: BRAND.ink }
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const fmtMin = (m: number | null) => m == null ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
const t = (x: string) => <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink, marginBottom: 8 }}>{x}</div>

export default function AtendimentoIA({ institutionId, institutionName }: { institutionId: string; institutionName: string }) {
  const today = new Date()
  const [from, setFrom] = useState(iso(new Date(today.getFullYear(), today.getMonth(), 1)))
  const [to, setTo] = useState(iso(today))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [dig, setDig] = useState<Digest | null>(null)
  const [rep, setRep] = useState<Rep | null>(null)

  const run = async () => {
    setBusy(true); setErr(''); setRep(null); setDig(null)
    try {
      const { data, error } = await supabase.rpc('whatsapp_period_digest', { p_inst: institutionId, p_from: from, p_to: to, p_sample: 50 })
      if (error) throw new Error(error.message.includes('permiss') ? 'Somente gestores podem gerar esta análise.' : error.message)
      const d = data as Digest
      setDig(d)
      if (!d.total_conversas) throw new Error('Não há conversas nesse período.')
      const resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action: 'whatsapp_period_report', payload: { institutionName, periodo: `${from.split('-').reverse().join('/')} a ${to.split('-').reverse().join('/')}`, data: d } }) })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Erro ${resp.status}`)
      setRep(json.result as Rep)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Não foi possível gerar.') } finally { setBusy(false) }
  }
  const csv = () => {
    if (!dig) return
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['Atendente', 'Conversas', 'Mediana 1ª resposta (min)', 'Satisfação média', 'Avaliações'], ...dig.por_atendente.map(a => [a.atendente, a.conversas, a.resp_mediana_min, a.satisfacao_media, a.avaliacoes])]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = `atendimento-${from}-${to}.csv`; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: BRAND.ink }}>Atendimento por WhatsApp, lido pela IA</div>
          <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2 }}>Escolha o período. A IA aponta os problemas mais comuns, o que fazer e como está cada atendente.</div>
        </div>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp} />
        <span style={{ color: '#94A3B8' }}>até</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp} />
        <button onClick={run} disabled={busy} style={{ padding: '9px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#065F52,#00A896)', color: '#fff', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', gap: 6, alignItems: 'center', opacity: busy ? 0.6 : 1 }}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}{busy ? 'Lendo as conversas…' : 'Gerar análise'}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: BRAND.muted, display: 'flex', gap: 6, alignItems: 'center' }}><ShieldCheck size={15} color="#00A896" /> Só gestores veem. O texto das conversas não é guardado: a IA lê uma amostra de até 50 conversas na hora de gerar, e o relatório fica só na tela.</div>
      {err && <div style={{ ...card, color: '#B91C1C', fontSize: 13.5 }}>{err}</div>}

      {dig && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            {t(`${dig.total_conversas} conversas no período · ${dig.com_atendente} com atendente`)}
            <button onClick={csv} style={{ padding: '6px 12px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}><Download size={13} /> Baixar CSV</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ color: '#94A3B8', fontSize: 11.5, textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: 8 }}>Atendente</th><th style={{ textAlign: 'right', padding: 8 }}>Conversas</th><th style={{ textAlign: 'right', padding: 8 }} title="Metade das conversas foi respondida em menos que isso">1ª resposta (mediana)</th><th style={{ textAlign: 'right', padding: 8 }}>Satisfação</th></tr></thead>
              <tbody>{dig.por_atendente.map(a => (
                <tr key={a.atendente} style={{ borderTop: '1px solid #EEF2F1' }}><td style={{ padding: 8, fontWeight: 700 }}>{a.atendente}</td><td style={{ padding: 8, textAlign: 'right' }}>{a.conversas}</td><td style={{ padding: 8, textAlign: 'right' }}>{fmtMin(a.resp_mediana_min)}</td><td style={{ padding: 8, textAlign: 'right' }}>{a.satisfacao_media ?? '—'}{a.avaliacoes ? <span style={{ color: '#94A3B8' }}> ({a.avaliacoes})</span> : ''}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {rep && (
        <>
          {rep.resumo && <div style={{ ...card, background: BRAND.softer, border: `1px solid ${BRAND.softLine}`, fontSize: 14.5, lineHeight: 1.6, color: BRAND.ink }}>{rep.resumo}</div>}
          {(rep.alertas ?? []).length > 0 && <div style={{ ...card, background: BRAND.warnSoft, border: '1px solid #FCD34D', color: BRAND.warn, fontSize: 13.5 }}>{(rep.alertas ?? []).map((a, i) => <div key={i}>⚠ {a}</div>)}</div>}
          {(rep.problemas ?? []).length > 0 && <div style={card}>{t('Problemas mais comuns')}{(rep.problemas ?? []).map((p, i) => (
            <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid #EEF2F1' : 'none' }}><div style={{ fontWeight: 700, color: BRAND.ink, fontSize: 13.5 }}>{p.titulo}</div><div style={{ fontSize: 13, color: BRAND.text, lineHeight: 1.55 }}>{p.descricao}</div>{p.exemplo && <div style={{ fontSize: 12.5, color: '#64748B', fontStyle: 'italic', marginTop: 2 }}>“{p.exemplo}”</div>}</div>))}</div>}
          {(rep.solucoes ?? []).length > 0 && <div style={card}>{t('O que fazer')}{(rep.solucoes ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '4px 0', display: 'flex', gap: 8 }}><b style={{ color: '#00A896' }}>{i + 1}.</b>{x}</div>)}</div>}
          {(rep.duvidas_frequentes ?? []).length > 0 && <div style={card}>{t('Dúvidas que mais aparecem')}{(rep.duvidas_frequentes ?? []).map((x, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0' }}>• {x}</div>)}</div>}
          {(rep.atendentes ?? []).length > 0 && <div style={card}>{t('Por atendente')}<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>{(rep.atendentes ?? []).map(a => (
            <div key={a.nome} style={{ border: '1px solid #E3E8F0', borderRadius: 12, padding: '10px 14px' }}><div style={{ fontWeight: 800, color: BRAND.ink }}>{a.nome}</div><div style={{ fontSize: 13, marginTop: 4 }}><b style={{ color: '#15803D' }}>Forte:</b> {a.forte}</div><div style={{ fontSize: 13, marginTop: 2 }}><b style={{ color: '#B45309' }}>Melhorar:</b> {a.melhorar}</div></div>))}</div></div>}
        </>
      )}
    </div>
  )
}
