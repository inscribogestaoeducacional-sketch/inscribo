import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

// ── Consumo de WhatsApp da escola (ETAPA 2) ─────────────────────────────────
// Mensagens recebidas e enviadas por dia (horário de Brasília), a partir do
// próprio histórico — função whatsapp_usage_daily (migration 20261022100000),
// que só responde a Super Admin e ao gestor da escola. Não conta histórico
// importado nem o inbox interno da Áion. Sem valores em reais por enquanto.

interface UsageDay {
  day: string
  received: number
  sent_team: number
  sent_bot: number
  sent_template: number
  conversations: number
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', weekday: 'short' })
const isoDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export default function WhatsAppUsagePanel({ institutionId }: { institutionId: string }) {
  const [rows, setRows] = useState<UsageDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const today = new Date()
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1)   // mês passado + mês atual
      const { data, error } = await supabase.rpc('whatsapp_usage_daily', {
        p_institution_id: institutionId, p_from: isoDay(from), p_to: isoDay(today),
      })
      if (cancelled) return
      if (error) {
        setError(/whatsapp_usage_daily|function|schema cache/i.test(error.message)
          ? 'Consumo ainda não disponível (falta aplicar a migration da Central de notificações).'
          : error.message)
        setRows([])
      } else {
        setRows(((data ?? []) as UsageDay[]).map(r => ({
          ...r, received: Number(r.received), sent_team: Number(r.sent_team), sent_bot: Number(r.sent_bot),
          sent_template: Number(r.sent_template), conversations: Number(r.conversations),
        })))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [institutionId])

  const months = useMemo(() => {
    const out = new Map<string, { received: number; sent: number; template: number }>()
    for (const r of rows) {
      const k = r.day.slice(0, 7)
      const m = out.get(k) ?? { received: 0, sent: 0, template: 0 }
      m.received += r.received
      m.sent += r.sent_team + r.sent_bot + r.sent_template
      m.template += r.sent_template
      out.set(k, m)
    }
    return [...out.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  const last30 = rows.slice(-30).reverse()

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div>
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Mensagens do WhatsApp</p>
        <p className="text-xs text-gray-400 mt-0.5">Recebidas e enviadas, por dia e por mês (horário de Brasília). Sem valores em reais.</p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400">Carregando…</p>
      ) : error ? (
        <p className="text-xs text-amber-700">{error}</p>
      ) : !rows.length ? (
        <p className="text-xs text-gray-400">Nenhuma mensagem no período.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {months.map(([month, m]) => (
              <div key={month} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-500">
                  {new Date(`${month}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
                <p className="text-sm text-gray-800 mt-1">
                  <strong>{m.received.toLocaleString('pt-BR')}</strong> recebidas · <strong>{m.sent.toLocaleString('pt-BR')}</strong> enviadas
                  {m.template ? <span className="text-gray-500"> ({m.template.toLocaleString('pt-BR')} modelos)</span> : null}
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-400 sticky top-0 bg-white">
                <tr>
                  <th className="text-left font-semibold py-1.5 pr-2">Dia</th>
                  <th className="text-right font-semibold py-1.5 px-2">Recebidas</th>
                  <th className="text-right font-semibold py-1.5 px-2">Equipe</th>
                  <th className="text-right font-semibold py-1.5 px-2">Robô</th>
                  <th className="text-right font-semibold py-1.5 px-2">Modelos</th>
                  <th className="text-right font-semibold py-1.5 pl-2">Conversas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-gray-700">
                {last30.map(r => (
                  <tr key={r.day}>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDay(r.day)}</td>
                    <td className="py-1.5 px-2 text-right">{r.received}</td>
                    <td className="py-1.5 px-2 text-right">{r.sent_team}</td>
                    <td className="py-1.5 px-2 text-right">{r.sent_bot}</td>
                    <td className="py-1.5 px-2 text-right">{r.sent_template}</td>
                    <td className="py-1.5 pl-2 text-right">{r.conversations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
