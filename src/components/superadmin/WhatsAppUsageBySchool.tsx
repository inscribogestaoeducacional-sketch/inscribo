import { useEffect, useState } from 'react'
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
}

function monthStart(offset: number) {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toLocaleDateString('en-CA')
}

export default function WhatsAppUsageBySchool() {
  const [offset, setOffset] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      setError('')
      const { data, error } = await supabase.rpc('whatsapp_usage_by_school', { p_month: monthStart(offset) })
      if (cancelled) return
      if (error) {
        setError(/whatsapp_usage_by_school|function|schema cache/i.test(error.message)
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

  const label = new Date(`${monthStart(offset)}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="font-bold text-gray-900">Mensagens por escola</p>
          <p className="text-xs text-gray-500 mt-0.5">Recebidas e enviadas em {label} (sem histórico importado). Sem valores em reais.</p>
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
                <th className="text-right font-semibold px-3 py-2.5">Conversas</th>
                <th className="text-right font-semibold px-5 py-2.5">Última recebida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.institution_id} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5">
                    <Link to={`/super-admin/institutions/${r.institution_id}?tab=whatsapp`} className="font-semibold text-cyan-700 hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-right">{Number(r.received).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right">{Number(r.sent).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right">{Number(r.sent_template).toLocaleString('pt-BR')}</td>
                  <td className="px-3 py-2.5 text-right">{Number(r.conversations).toLocaleString('pt-BR')}</td>
                  <td className="px-5 py-2.5 text-right text-xs text-gray-500 whitespace-nowrap">
                    {r.last_received ? new Date(r.last_received).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
