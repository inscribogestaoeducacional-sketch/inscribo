// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cria cobrança avulsa no Asaas. Dois modos:
//
// 1. Super Admin (AdminFinancial, AdminSchools, InstitutionDetails) — body
//    { institution_id, value, dueDate, ... }. verify_jwt=true sozinho não
//    bastava: a anon key também é um JWT válido, então qualquer um com ela
//    criava cobrança pra qualquer institution_id com qualquer valor. Agora o
//    chamador precisa passar em is_super_admin_user() — a MESMA função que a
//    RLS de payments usa pra liberar escrita (20260925010000_payments_rls_
//    lockdown.sql), avaliada com o JWT de quem chamou, pra endpoint e tabela
//    nunca divergirem de critério. O valor continua vindo do formulário
//    (cobrança manual digitada pelo Super Admin), mas é validado aqui.
//
// 2. Campanha de Transmissão — body { campaign_id, billingType? }. Quem chama
//    é a escola: autorização por broadcast_user_can_manage() (mesma regra do
//    módulo no front). O valor NUNCA vem do navegador: é o total_charged_brl
//    congelado na precificação da campanha. Precisa do mínimo do Asaas em
//    platform_settings.asaas_min_charge_brl — sem ele configurado, a cobrança
//    de campanha fica bloqueada (decisão: não adivinhar o mínimo).
const PAYMENT_TYPES  = ['implementation', 'monthly', 'extra_conversations']
const BILLING_TYPES  = ['UNDEFINED', 'BOLETO', 'PIX', 'CREDIT_CARD']
const UUID_RE        = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/
// Vencimento da cobrança de campanha: curto (a campanha só sai depois de
// paga), mas com folga pra boleto compensar.
const CAMPAIGN_DUE_DAYS = 3

function jsonResponse(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function userClient(req: Request) {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
}

async function authenticatedUser(req: Request) {
  const client = userClient(req)
  if (!client) return null
  const { data, error } = await client.auth.getUser()
  if (error || !data?.user) return null
  return { client, user: data.user }
}

async function isSuperAdminCaller(req: Request): Promise<boolean> {
  const auth = await authenticatedUser(req)
  if (!auth) return false
  const { data: isAdmin, error: rpcErr } = await auth.client.rpc('is_super_admin_user')
  if (rpcErr) console.error('[asaas-create-charge] erro em is_super_admin_user:', rpcErr.message)
  return isAdmin === true
}

async function getAsaasConfig(sb) {
  const { data: cfgData } = await sb.from('platform_settings')
    .select('key, value')
    .in('key', ['asaas_api_key', 'asaas_environment', 'asaas_min_charge_brl'])
  const cfg: Record<string, string> = {}
  cfgData?.forEach((r: any) => { cfg[r.key] = r.value })

  const apiKey = cfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
  if (!apiKey) throw new Error('Chave Asaas não configurada. Acesse Configurações → Asaas.')

  const url = (cfg.asaas_environment || 'production') === 'sandbox'
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://www.asaas.com/api/v3'

  const min = Number(String(cfg.asaas_min_charge_brl ?? '').replace(',', '.'))
  return { apiKey, url, minChargeBrl: Number.isFinite(min) && min > 0 ? min : null }
}

// Cliente Asaas da escola: reaproveita institutions.asaas_customer_id; se não
// existir, cria com os dados do banco (o body só completa o que estiver vazio).
async function ensureCustomer(sb, asaas, institutionId: string, fallback: { name?: string; email?: string; cpfCnpj?: string }) {
  const { data: inst } = await sb.from('institutions')
    .select('asaas_customer_id, cnpj, name, email')
    .eq('id', institutionId)
    .maybeSingle()
  if (!inst) return { inst: null, customerId: null }

  let customerId = inst.asaas_customer_id
  if (!customerId) {
    const rawCnpj = (inst.cnpj || fallback.cpfCnpj || '').replace(/\D/g, '')
    const customerRes = await fetch(`${asaas.url}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': asaas.apiKey },
      body: JSON.stringify({
        name:              inst.name || fallback.name,
        email:             inst.email || fallback.email,
        cpfCnpj:           rawCnpj || undefined,
        externalReference: institutionId,
      }),
    })
    const customerData = await customerRes.json()
    console.log('[asaas-create-charge] customer:', JSON.stringify(customerData))
    if (!customerRes.ok) throw new Error(customerData?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas')

    customerId = customerData.id
    if (customerId) {
      await sb.from('institutions').update({ asaas_customer_id: customerId }).eq('id', institutionId)
    }
  }
  if (!customerId) throw new Error('Não foi possível obter ID do cliente Asaas')
  return { inst, customerId }
}

async function createAsaasCharge(asaas, p: { customerId: string; billingType: string; value: number; dueDate: string; description: string; externalReference: string }) {
  const chargeRes = await fetch(`${asaas.url}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'access_token': asaas.apiKey },
    body: JSON.stringify({
      customer:          p.customerId,
      billingType:       p.billingType,
      value:             p.value,
      dueDate:           p.dueDate,
      description:       p.description,
      externalReference: p.externalReference,
    }),
  })
  const charge = await chargeRes.json()
  console.log('[asaas-create-charge] charge:', JSON.stringify(charge))
  if (!chargeRes.ok) throw new Error(charge?.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas')
  return { charge, paymentLink: charge.invoiceUrl || `https://www.asaas.com/i/${charge.id}` }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json().catch(() => ({}))
    if (body?.campaign_id) return await handleCampaignCharge(req, body)
    return await handleSuperAdminCharge(req, body)
  } catch (err) {
    console.error('[asaas-create-charge] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})

// ── Modo 1: cobrança manual do Super Admin (comportamento de antes) ──────────
async function handleSuperAdminCharge(req: Request, body: any) {
  if (!(await isSuperAdminCaller(req))) {
    console.warn('[asaas-create-charge] chamada rejeitada — chamador não é Super Admin')
    return jsonResponse(403, { error: 'Apenas Super Admin pode criar cobranças' })
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const {
    institution_id, name, email, cpfCnpj,
    value, description, dueDate, billingType,
    payment_type = 'implementation',
  } = body

  if (typeof institution_id !== 'string' || !UUID_RE.test(institution_id)) {
    return jsonResponse(400, { error: 'institution_id inválido' })
  }
  const amount = Math.round(Number(value) * 100) / 100
  if (!Number.isFinite(amount) || amount <= 0) return jsonResponse(400, { error: 'Valor inválido' })
  if (typeof dueDate !== 'string' || !DATE_RE.test(dueDate) || isNaN(Date.parse(dueDate))) {
    return jsonResponse(400, { error: 'dueDate inválido (formato AAAA-MM-DD)' })
  }
  if (!PAYMENT_TYPES.includes(payment_type)) return jsonResponse(400, { error: 'payment_type inválido' })
  if (billingType && !BILLING_TYPES.includes(billingType)) return jsonResponse(400, { error: 'billingType inválido' })

  const asaas = await getAsaasConfig(sb)
  const { inst, customerId } = await ensureCustomer(sb, asaas, institution_id, { name, email, cpfCnpj })
  if (!inst) return jsonResponse(404, { error: 'Instituição não encontrada' })

  // Registro no banco primeiro (o ID vira externalReference)
  const desc = (typeof description === 'string' && description.trim() ? description.trim() : `${payment_type === 'implementation' ? 'Implantação' : 'Mensalidade'} — ${inst.name || name}`).slice(0, 500)
  const { data: paymentRecord, error: payErr } = await sb.from('payments').insert({
    institution_id,
    payment_type,
    amount:      amount,
    status:      'pending',
    due_date:    dueDate,
    description: desc,
  }).select().single()

  if (payErr) console.error('[asaas-create-charge] erro ao inserir payment:', payErr)
  const paymentId = paymentRecord?.id

  const { charge, paymentLink } = await createAsaasCharge(asaas, {
    customerId,
    billingType:       billingType || 'UNDEFINED',
    value:             amount,
    dueDate,
    description:       desc,
    externalReference: paymentId ? `${institution_id}:${paymentId}` : institution_id,
  })

  if (paymentId) {
    await sb.from('payments').update({
      asaas_payment_id: charge.id,
      asaas_charge_url: paymentLink,
      asaas_id:         charge.id,
    }).eq('id', paymentId)
  }

  console.log(`[asaas-create-charge] ok — charge ${charge.id} link ${paymentLink}`)
  return jsonResponse(200, { ok: true, paymentLink, chargeId: charge.id, paymentId })
}

// ── Modo 2: cobrança de campanha de Transmissão ─────────────────────────────
async function handleCampaignCharge(req: Request, body: any) {
  const { campaign_id, billingType } = body
  if (typeof campaign_id !== 'string' || !UUID_RE.test(campaign_id)) {
    return jsonResponse(400, { error: 'campaign_id inválido' })
  }
  if (billingType && !BILLING_TYPES.includes(billingType)) return jsonResponse(400, { error: 'billingType inválido' })

  const auth = await authenticatedUser(req)
  if (!auth) return jsonResponse(401, { error: 'Não autenticado' })

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: campaign } = await sb.from('broadcast_campaigns')
    .select('id, institution_id, name, status, priced_at, priced_recipients, total_charged_brl, paid_at, payment_id')
    .eq('id', campaign_id)
    .maybeSingle()
  if (!campaign) return jsonResponse(404, { error: 'Campanha não encontrada' })

  const { data: canManage, error: permErr } = await auth.client
    .rpc('broadcast_user_can_manage', { p_institution_id: campaign.institution_id })
  if (permErr) console.error('[asaas-create-charge] erro em broadcast_user_can_manage:', permErr.message)
  if (canManage !== true) {
    console.warn('[asaas-create-charge] campanha: chamador sem permissão', auth.user.id, campaign_id)
    return jsonResponse(403, { error: 'Sem permissão para gerenciar Transmissões desta escola' })
  }

  if (campaign.paid_at) return jsonResponse(409, { error: 'Campanha já está paga' })
  if (!['pending_template', 'pending_payment'].includes(campaign.status)) {
    return jsonResponse(409, { error: `Campanha não aceita cobrança no status "${campaign.status}"` })
  }
  if (!campaign.priced_at || campaign.total_charged_brl == null) {
    return jsonResponse(409, { error: 'Campanha ainda não foi precificada' })
  }

  // Já existe cobrança em aberto: devolve a mesma (clique duplo, recarregar a tela).
  if (campaign.payment_id) {
    const { data: existing } = await sb.from('payments')
      .select('id, status, asaas_charge_url, asaas_payment_id').eq('id', campaign.payment_id).maybeSingle()
    if (existing && ['pending', 'overdue'].includes(existing.status) && existing.asaas_charge_url) {
      return jsonResponse(200, { ok: true, paymentLink: existing.asaas_charge_url, chargeId: existing.asaas_payment_id, paymentId: existing.id, reused: true })
    }
    // Cobrança anterior cancelada (ex.: excluída no Asaas) ou sem link: fica
    // no histórico, mas solta da campanha — broadcast_campaign_id é único em
    // payments e bloquearia a nova.
    if (existing && !['paid'].includes(existing.status)) {
      await sb.from('payments').update({ broadcast_campaign_id: null }).eq('id', existing.id)
    }
  }

  const amount = Math.round(Number(campaign.total_charged_brl) * 100) / 100
  if (!(amount > 0)) {
    // Crédito cobriu tudo: não há cobrança — a precificação libera direto.
    return jsonResponse(409, { error: 'Campanha sem valor a cobrar (coberta por crédito)' })
  }

  const asaas = await getAsaasConfig(sb)
  if (asaas.minChargeBrl === null) {
    console.warn('[asaas-create-charge] campanha bloqueada: platform_settings.asaas_min_charge_brl não configurado')
    return jsonResponse(503, { error: 'Cobrança de campanha indisponível: valor mínimo do Asaas ainda não configurado pela Áion.' })
  }
  if (amount < asaas.minChargeBrl) {
    // A precificação já sobe pro mínimo (decisão 1) — chegar aqui abaixo dele
    // é inconsistência, não algo pra "ajustar" silenciosamente.
    return jsonResponse(409, { error: `Valor da campanha (R$ ${amount.toFixed(2)}) abaixo do mínimo do Asaas (R$ ${asaas.minChargeBrl.toFixed(2)}) — precifique de novo` })
  }

  const { inst, customerId } = await ensureCustomer(sb, asaas, campaign.institution_id, {})
  if (!inst) return jsonResponse(404, { error: 'Instituição não encontrada' })

  const due = new Date(Date.now() + CAMPAIGN_DUE_DAYS * 86400000)
  const dueDate = new Date(due.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).toISOString().slice(0, 10)
  const desc = `Transmissão: ${campaign.name} (${campaign.priced_recipients ?? 0} mensagens) — ${inst.name}`.slice(0, 500)

  // Reserva: grava a cobrança e só então tenta amarrar à campanha, com
  // "payment_id ainda vazio (ou o mesmo de antes, sem link)" na condição.
  // Duas requisições simultâneas: só uma amarra; a outra desfaz a própria.
  const { data: paymentRecord, error: payErr } = await sb.from('payments').insert({
    institution_id:        campaign.institution_id,
    payment_type:          'broadcast',
    broadcast_campaign_id: campaign.id,
    amount,
    status:                'pending',
    due_date:              dueDate,
    description:           desc,
  }).select('id').single()
  if (payErr || !paymentRecord) {
    // UNIQUE(broadcast_campaign_id) em payments: outra requisição já criou.
    console.error('[asaas-create-charge] campanha: erro ao reservar cobrança:', payErr?.message)
    return jsonResponse(409, { error: 'Já existe uma cobrança sendo gerada para esta campanha — tente de novo em instantes' })
  }
  const paymentId = paymentRecord.id

  let linkQuery = sb.from('broadcast_campaigns')
    .update({ payment_id: paymentId, status: campaign.status === 'pending_template' ? 'pending_template' : 'pending_payment' })
    .eq('id', campaign.id).is('paid_at', null)
  linkQuery = campaign.payment_id ? linkQuery.eq('payment_id', campaign.payment_id) : linkQuery.is('payment_id', null)
  const { data: linked } = await linkQuery.select('id')
  if (!linked?.length) {
    await sb.from('payments').delete().eq('id', paymentId)
    return jsonResponse(409, { error: 'A campanha mudou enquanto a cobrança era gerada — atualize a tela' })
  }

  try {
    const { charge, paymentLink } = await createAsaasCharge(asaas, {
      customerId,
      billingType:       billingType || 'UNDEFINED',
      value:             amount,
      dueDate,
      description:       desc,
      externalReference: `${campaign.institution_id}:${paymentId}`,
    })
    await sb.from('payments').update({
      asaas_payment_id: charge.id,
      asaas_charge_url: paymentLink,
      asaas_id:         charge.id,
    }).eq('id', paymentId)

    console.log(`[asaas-create-charge] campanha ${campaign.id} — charge ${charge.id} link ${paymentLink}`)
    return jsonResponse(200, { ok: true, paymentLink, chargeId: charge.id, paymentId })
  } catch (e) {
    // Asaas recusou: desfaz a reserva pra escola poder tentar de novo.
    await sb.from('broadcast_campaigns').update({ payment_id: campaign.payment_id ?? null })
      .eq('id', campaign.id).eq('payment_id', paymentId)
    await sb.from('payments').delete().eq('id', paymentId)
    throw e
  }
}
