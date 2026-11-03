// Relatório de custo da Meta por escola (pricing_analytics da conta WhatsApp Business).
// Só Super Admin. O token da plataforma fica aqui; o navegador recebe só o resultado.
// POST { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' } -> { schools: [{ institution_id, waba_id, rows, error }] }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const GRAPH = 'https://graph.facebook.com/v25.0'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = req.headers.get('Authorization') || ''
    if (!auth.startsWith('Bearer ')) return json(401, { error: 'Não autenticado' })
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
    const { data: u } = await userClient.auth.getUser()
    if (!u?.user) return json(401, { error: 'Não autenticado' })
    const { data: isSA } = await userClient.rpc('is_super_admin_user')
    if (isSA !== true) return json(403, { error: 'Apenas Super Admin' })

    const body = await req.json().catch(() => ({}))
    const from = String(body.from ?? ''), to = String(body.to ?? '')
    if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) return json(400, { error: 'Período inválido' })
    const start = Math.floor(new Date(`${from}T00:00:00-03:00`).getTime() / 1000)
    const end = Math.floor(new Date(`${to}T00:00:00-03:00`).getTime() / 1000) + 86400

    const sb = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: tok } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
    const token = (tok as any)?.value || Deno.env.get('WA_ACCESS_TOKEN') || ''
    if (!token) return json(400, { error: 'Token da plataforma não configurado' })

    const { data: phones } = await sb.from('whatsapp_phone_numbers')
      .select('institution_id, waba_id').not('institution_id', 'is', null).eq('is_active', true).eq('use_meta_api', true)
    const seen = new Set<string>()
    const list = ((phones ?? []) as any[]).filter(p => p.waba_id && /^[0-9]{5,25}$/.test(String(p.waba_id)) && !seen.has(p.institution_id + p.waba_id) && seen.add(p.institution_id + p.waba_id))

    const schools = await Promise.all(list.map(async (p) => {
      try {
        const f = `pricing_analytics.start(${start}).end(${end}).granularity(DAILY).dimensions(["PRICING_CATEGORY","PRICING_TYPE"])`
        const r = await fetch(`${GRAPH}/${p.waba_id}?fields=${encodeURIComponent(f)}`, {
          headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
        })
        const d: any = await r.json().catch(() => null)
        if (!r.ok) return { institution_id: p.institution_id, waba_id: p.waba_id, rows: [], error: d?.error?.message || `Meta respondeu ${r.status}`, code: d?.error?.code ?? null }
        const acc = new Map<string, { category: string; type: string; volume: number; cost: number }>()
        for (const blk of d?.pricing_analytics?.data ?? []) for (const pt of blk?.data_points ?? []) {
          const cat = String(pt.pricing_category ?? 'OUTRO'), typ = String(pt.pricing_type ?? 'REGULAR')
          const k = `${cat}|${typ}`
          const cur = acc.get(k) ?? { category: cat, type: typ, volume: 0, cost: 0 }
          cur.volume += Number(pt.volume) || 0; cur.cost += Number(pt.cost) || 0
          acc.set(k, cur)
        }
        return { institution_id: p.institution_id, waba_id: p.waba_id, rows: [...acc.values()], error: null }
      } catch (e) {
        return { institution_id: p.institution_id, waba_id: p.waba_id, rows: [], error: e instanceof Error ? e.message : String(e) }
      }
    }))
    return json(200, { from, to, schools })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
