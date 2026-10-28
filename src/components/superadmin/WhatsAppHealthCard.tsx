import { useEffect, useState } from 'react'
import { Activity, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { BRAND } from '../../lib/brand'
import { Card, Title, GhostButton } from '../management/settings/ui'

// Saúde do WhatsApp (só leitura): conversas duplicadas, números fora do padrão e falhas de envio por código da Meta.
// Serve para ver o problema antes de virar reclamação. Nada aqui altera dados.

const META_CODES: Record<number, string> = {
  131042: 'Pagamento da conta na Meta (forma de pagamento ou saldo)',
  131026: 'Número sem WhatsApp ou que não pôde receber',
  131047: 'Fora da janela de 24h: só vale com modelo aprovado',
  131049: 'A Meta limitou mensagens de marketing para essa pessoa',
  131048: 'Limite de envios da conta por suspeita de spam',
  130472: 'A Meta não entregou (teste de campanha dela)',
  131008: 'Faltou algum campo obrigatório no modelo',
  131051: 'Tipo de mensagem não aceito',
}

const digitsOf = (jid: string) => jid.replace(/@.*$/, '').replace(/\D/g, '')
// Fora do padrão = 55 + DDD + 9 + 8 dígitos (celular) ou 55 + DDD + 8 dígitos (fixo). Estrangeiro (não BR) não conta.
function isOdd(jid: string): boolean {
  if (jid.includes('@')) return true
  const d = digitsOf(jid)
  if (d.startsWith('0')) return true
  if (d.startsWith('55') && d.length === 12 && d[4] >= '6' && d[4] <= '9') return true   // celular sem o 9
  if (d.length === 10 || (d.length === 11 && d[2] === '9')) return true                    // sem o 55
  return false
}

interface Health { total: number; odd: number; dups: number; fails: { code: number | null; n: number }[]; failTotal: number }

export default function WhatsAppHealthCard() {
  const [h, setH] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setErr(null)
    try {
      const rows: { institution_id: string | null; remote_jid: string }[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('whatsapp_conversations').select('institution_id, remote_jid').order('id').range(from, from + 999)
        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < 1000) break
      }
      const groups = new Map<string, number>()
      let odd = 0
      for (const r of rows) {
        if (isOdd(r.remote_jid)) odd++
        const d = digitsOf(r.remote_jid)
        const key = `${r.institution_id ?? 'aion'}:${d.slice(-8)}`
        groups.set(key, (groups.get(key) || 0) + 1)
      }
      const dups = Array.from(groups.values()).filter(n => n > 1).length

      const since = new Date(Date.now() - 7 * 864e5).toISOString()
      const { data: failed, error: fe } = await supabase.from('whatsapp_messages').select('error_details').eq('status', 'failed').gte('timestamp', since).limit(5000)
      if (fe) throw fe
      const byCode = new Map<number | null, number>()
      for (const m of failed || []) {
        const ed: any = (m as any).error_details
        const code = Array.isArray(ed) && ed[0]?.code != null ? Number(ed[0].code) : null
        byCode.set(code, (byCode.get(code) || 0) + 1)
      }
      const fails = Array.from(byCode.entries()).map(([code, n]) => ({ code, n })).sort((a, b) => b.n - a.n)
      setH({ total: rows.length, odd, dups, fails, failTotal: (failed || []).length })
    } catch (e: any) { setErr(e?.message || 'Não foi possível ler os dados.') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const stat = (label: string, value: number | string, bad: boolean) => (
    <div style={{ flex: '1 1 140px', border: `1px solid ${bad ? '#FCA5A5' : BRAND.line}`, background: bad ? BRAND.dangerSoft : '#fff', borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: bad ? BRAND.danger : BRAND.ink }}>{value}</div>
      <div style={{ fontSize: 12.5, color: BRAND.muted }}>{label}</div>
    </div>
  )

  return (
    <Card>
      <Title Icon={Activity} title="Saúde do WhatsApp" help="Mostra duplicadas, números fora do padrão e falhas de envio dos últimos 7 dias. Só leitura." />
      {loading && !h ? <Loader2 size={20} className="animate-spin" color={BRAND.primary} /> : err ? <div style={{ fontSize: 13, color: BRAND.danger }}>{err}</div> : h && (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {stat('conversas duplicadas', h.dups, h.dups > 0)}
            {stat('números fora do padrão', h.odd, h.odd > 0)}
            {stat('envios que falharam (7 dias)', h.failTotal, h.failTotal > 0)}
          </div>
          {h.fails.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {h.fails.slice(0, 6).map(f => (
                <div key={String(f.code)} style={{ display: 'flex', gap: 10, fontSize: 13, color: BRAND.text }}>
                  <strong style={{ minWidth: 34, textAlign: 'right' }}>{f.n}</strong>
                  <span>{f.code ? `${META_CODES[f.code] || 'Erro da Meta'} (código ${f.code})` : 'Motivo não gravado'}</span>
                </div>
              ))}
            </div>
          )}
          <GhostButton onClick={load} disabled={loading}><RefreshCw size={14} /> Atualizar</GhostButton>
        </>
      )}
    </Card>
  )
}
