// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Financeiro geral: traz as cobranças do Asaas (todas as empresas na mesma
// conta) para fin_asaas_charges e chama fin_asaas_apply(), que cria os
// lançamentos das já classificadas. Só Super Admin (mesma regra de
// is_super_admin_user() usada nas demais funções do Asaas).
const MAX_PAGES = 30          // 3.000 cobranças por execução
const MAX_CUSTOMER_LOOKUPS = 60

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

function mapCharge(p: any) {
  return {
    asaas_id: p.id,
    customer_id: p.customer ?? null,
    description: p.description ?? null,
    value: Number(p.value) || 0,
    billing_type: p.billingType ?? null,
    status: p.status,
    due_date: p.dueDate ?? null,
    paid_date: p.clientPaymentDate ?? p.paymentDate ?? null,
    updated_at: new Date().toISOString(),
  }
}

async function asaasGet(cfg, path: string) {
  const res = await fetch(cfg.url + path, { headers: { access_token: cfg.apiKey, 'Content-Type': 'application/json' } })
  if (!res.ok) throw new Error(`Asaas ${res.status} em ${path.split('?')[0]}`)
  return res.json()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Não autenticado' })
    const userSb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } })
    const { data: u } = await userSb.auth.getUser()
    if (!u?.user) return json(401, { error: 'Não autenticado' })
    const { data: isAdmin } = await userSb.rpc('is_super_admin_user')
    if (isAdmin !== true) return json(403, { error: 'Apenas Super Admin' })

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: cfgData } = await sb.from('platform_settings').select('key, value').in('key', ['asaas_api_key', 'asaas_environment'])
    const c: Record<string, string> = {}
    cfgData?.forEach((r: any) => { c[r.key] = r.value })
    const apiKey = c.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
    if (!apiKey) return json(400, { error: 'Chave Asaas não configurada.' })
    const cfg = { apiKey, url: (c.asaas_environment || 'production') === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3' }

    const body = await req.json().catch(() => ({}))
    const since = /^\d{4}-\d{2}-\d{2}$/.test(body?.since || '') ? body.since : new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10)

    // 1) cobranças (criadas desde `since`), paginadas
    const charges: any[] = []
    let offset = 0, pages = 0, hasMore = true
    while (hasMore && pages < MAX_PAGES) {
      const r = await asaasGet(cfg, `/payments?limit=100&offset=${offset}&dateCreated%5Bge%5D=${since}`)
      charges.push(...(r.data || []))
      hasMore = !!r.hasMore; offset += 100; pages++
    }

    // 2) clientes ainda não conhecidos (nome/CPF-CNPJ para classificar)
    const { data: known } = await sb.from('fin_asaas_charges').select('customer_id, customer_name, customer_doc').not('customer_name', 'is', null)
    const cust = new Map<string, { name: string; doc: string | null }>()
    known?.forEach((k: any) => k.customer_id && cust.set(k.customer_id, { name: k.customer_name, doc: k.customer_doc }))
    let lookups = 0
    for (const p of charges) {
      if (!p.customer || cust.has(p.customer) || lookups >= MAX_CUSTOMER_LOOKUPS) continue
      try {
        const cu = await asaasGet(cfg, `/customers/${p.customer}`)
        cust.set(p.customer, { name: cu.name ?? null, doc: cu.cpfCnpj ?? null }); lookups++
      } catch { lookups++ }
    }

    // 3) upsert (preserva company/category/entry/ignored: não estão no payload)
    const rows = charges.map((p) => {
      const m = mapCharge(p), cu = cust.get(m.customer_id || '')
      return { ...m, customer_name: cu?.name ?? null, customer_doc: cu?.doc ?? null }
    })
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await sb.from('fin_asaas_charges').upsert(rows.slice(i, i + 200), { onConflict: 'asaas_id' })
      if (error) throw new Error('Falha ao gravar cobranças: ' + error.message)
    }

    // 4) aplica regras e cria lançamentos
    const { data: applied, error: apErr } = await sb.rpc('fin_asaas_apply')
    if (apErr) throw new Error('fin_asaas_apply: ' + apErr.message)
    return json(200, { ok: true, cobrancas_lidas: charges.length, clientes_consultados: lookups, ...applied })
  } catch (e) {
    console.error('[fin-asaas-sync]', e)
    return json(500, { error: String(e?.message || e) })
  }
})
