import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

// ── Consumo de WhatsApp por escola, no mês (Super Admin, ETAPA 2) ───────────
// Função whatsapp_usage_by_school (migration 20261022100000): mensagens
// recebidas/enviadas no mês (horário de Brasília) por escola, só para Super
// Admin. Sem valores em reais por enquanto.

interface Row {
  institution_id: string
  name: string
  received: number
  sent: number
  sent_template: number
  conversations: number
  last_received: string | null
  failed: number
  delivered_pct: number | null
  read_pct: number | null
  tpl_marketing: number
  tpl_utility: number
  est_cost_usd: number
  ai_improve: number
  ai_summary: number
  ai_tokens: number
}
interface Reason { code: string; total: number; last_at: string | null }

// Códigos de erro da Meta em linguagem simples
const REASON: Record<string, string> = {
  '131026': 'A mensagem não foi entregue: o número não tem WhatsApp, está inválido ou a família bloqueou a escola.',
  '131047': 'Fora da janela de 24h: só dá para enviar um modelo aprovado depois de 24h sem resposta da família.',
  '131049': 'A Meta segurou o envio de marketing para essa pessoa (limite de qualidade).',
  '131048': 'Limite de spam: a Meta limitou os envios desse número.',
  '131042': 'Problema de pagamento ou elegibilidade da conta na Meta. Confira a forma de pagamento no gerenciador.',
  '130472': 'O número da família está em um teste da Meta e não recebeu o modelo.',
  '131008': 'Faltou um parâmetro no modelo (variável vazia).',
  '131009': 'Valor de parâmetro inválido no modelo.',
  '131051': 'Tipo de mensagem não aceito.',
  '131053': 'Não foi possível enviar a mídia (arquivo inválido).',
  'sem motivo': 'Falha sem motivo registrado (envios antigos).',
}

function monthStart(offset: number) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString('en-CA')
}

export default function WhatsAppUsageBySchool() {
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Reason[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase.rpc('whatsapp_usage_detail', { p_month: monthStart(offset) })
      if (cancelled) return
      if (error) {
        setError(/whatsapp_usage_detail|function|schema cache/i.test(error.message)
          ? 'Consumo ainda não disponível (falta aplicar a migration da Central de notificações).'
          : error.message)
        setRows([])
      } else {
        setRows((data ?? []) as Row[])
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [offset])

  const toggle = async (r: Row) => {
    if (openId === r.institution_id) { setOpenId(null); return }
    setOpenId(r.institution_id); setReasons(null)
    const { data } = await supabase.rpc('whatsapp_failure_reasons', { p_inst: r.institution_id, p_month: monthStart(offset) })
    setReasons((data ?? []) as Reason[])
  }
  const fmt = (n: number | string | null) => Number(n ?? 0).toLocaleString('pt-BR')
  const usd = (n: number | string | null) => `US$ ${Number(n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const totalCost = rows.reduce((a, r) => a + Number(r.est_cost_usd || 0), 0)
  const label = new Date(`${monthStart(offset)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-gray-900">Mensagens por escola</p>
          <p className="text-xs text-gray-500 mt-0.5">Mês de {label}, sem histórico importado. O custo é uma estimativa (modelos enviados × tabela de preços da Meta no Brasil) e não inclui mensagens de serviço.</p>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOffset(o => o - 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">← Mês anterior</button>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset === 0}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40">Próximo →</button>
        </div>
      </div>
      {loading ? (
        <p className="px-5 py-6 text-sm text-gray-400">Carregando…</p>
      ) : error ? (
        <p className="px-5 py-6 text-sm text-amber-700">{error}</p>
      ) : !rows.length ? (
        <p className="px-5 py-6 text-sm text-gray-400">Nenhuma mensagem neste mês.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="text-left font-semibold px-5 py-2.5">Escola</th>
                <th className="text-right font-semibold px-3 py-2.5">Recebidas</th>
                <th className="text-right font-semibold px-3 py-2.5">Enviadas</th>
                <th className="text-right font-semibold px-3 py-2.5">Modelos</th>
                <th className="text-right font-semibold px-3 py-2.5">Falhas</th>
                <th className="text-right font-semibold px-3 py-2.5">Entregues</th>
                <th className="text-right font-semibold px-3 py-2.5">Lidas</th>
                <th className="text-right font-semibold px-3 py-2.5">Custo estimado</th>
                <th className="text-right font-semibold px-3 py-2.5">Usos da IA</th>
                <th className="text-right font-semibold px-5 py-2.5">Última recebida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => {
                const failPct = r.sent ? (Number(r.failed) / Number(r.sent)) * 100 : 0
                return (
                  <Fragment key={r.institution_id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-2.5">
                        <Link to={`/super-admin/institutions/${r.institution_id}?tab=whatsapp`} className="font-semibold text-cyan-700 hover:underline">{r.name}</Link>
                        <div className="text-[11px] text-gray-400">{fmt(r.conversations)} conversas</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{fmt(r.received)}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(r.sent)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {fmt(r.sent_template)}
                        <div className="text-[11px] text-gray-400">{fmt(r.tpl_marketing)} marketing · {fmt(r.tpl_utility)} utilidade</div>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => toggle(r)} disabled={!Number(r.failed)}
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${!Number(r.failed) ? 'text-gray-400' : failPct > 5 ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'}`}>
                          {fmt(r.failed)}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-right">{r.delivered_pct == null ? '—' : `${Number(r.delivered_pct).toLocaleString('pt-BR')}%`}</td>
                      <td className="px-3 py-2.5 text-right">{r.read_pct == null ? '—' : `${Number(r.read_pct).toLocaleString('pt-BR')}%`}</td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">{usd(r.est_cost_usd)}</td>
                      <td className="px-3 py-2.5 text-right">
                        {fmt(Number(r.ai_improve) + Number(r.ai_summary))}
                        {Number(r.ai_tokens) > 0 && <div className="text-[11px] text-gray-400">{fmt(r.ai_tokens)} tokens</div>}
                      </td>
                      <td className="px-5 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">
                        {r.last_received ? new Date(r.last_received).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                    </tr>
                    {openId === r.institution_id && (
                      <tr className="bg-gray-50">
                        <td colSpan={10} className="px-5 py-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Por que as mensagens falharam em {label}</p>
                          {reasons === null ? <p className="text-xs text-gray-400">Carregando…</p> : reasons.map(x => (
                            <div key={x.code} className="flex gap-3 text-xs py-1">
                              <span className="font-bold text-gray-900 w-10 text-right shrink-0">{fmt(x.total)}</span>
                              <span className="text-gray-700 flex-1">{REASON[x.code] ?? `Erro ${x.code} da Meta.`} <span className="text-gray-400">{x.code !== 'sem motivo' ? `(código ${x.code})` : ''}</span></span>
                              <span className="text-gray-400 whitespace-nowrap">{x.last_at ? new Date(x.last_at).toLocaleDateString('pt-BR') : ''}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              <tr className="bg-gray-50 font-semibold text-sm">
                <td className="px-5 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right">{fmt(rows.reduce((a, r) => a + Number(r.received), 0))}</td>
                <td className="px-3 py-2.5 text-right">{fmt(rows.reduce((a, r) => a + Number(r.sent), 0))}</td>
                <td className="px-3 py-2.5 text-right">{fmt(rows.reduce((a, r) => a + Number(r.sent_template), 0))}</td>
                <td className="px-3 py-2.5 text-right">{fmt(rows.reduce((a, r) => a + Number(r.failed), 0))}</td>
                <td /><td />
                <td className="px-3 py-2.5 text-right whitespace-nowrap">{usd(totalCost)}</td>
                <td className="px-3 py-2.5 text-right">{fmt(rows.reduce((a, r) => a + Number(r.ai_improve) + Number(r.ai_summary), 0))}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
