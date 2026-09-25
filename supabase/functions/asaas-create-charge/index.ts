// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cria cobrança avulsa no Asaas — só Super Admin (AdminFinancial,
// AdminSchools, InstitutionDetails). verify_jwt=true sozinho não bastava: a
// anon key também é um JWT válido, então qualquer um com ela criava cobrança
// pra qualquer institution_id com qualquer valor. Agora o chamador precisa
// passar em is_super_admin_user() — a MESMA função que a RLS de payments usa
// pra liberar escrita (20260925010000_payments_rls_lockdown.sql), avaliada
// com o JWT de quem chamou, pra endpoint e tabela nunca divergirem de
// critério. O valor continua vindo do formulário (cobrança manual digitada
// pelo Super Admin), mas é validado aqui.
const PAYMENT_TYPES  = ['implementation', 'monthly', 'extra_conversations']
const BILLING_TYPES  = ['UNDEFINED', 'BOLETO', 'PIX', 'CREDIT_CARD']
const UUID_RE        = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE        = /^\d{4}-\d{2}-\d{2}$/

function jsonResponse(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function isSuperAdminCaller(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return false

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return false

  const { data: isAdmin, error: rpcErr } = await userClient.rpc('is_super_admin_user')
  if (rpcErr) console.error('[asaas-create-charge] erro em is_super_admin_user:', rpcErr.message)
  return isAdmin === true
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    if (!(await isSuperAdminCaller(req))) {
      console.warn('[asaas-create-charge] chamada rejeitada — chamador não é Super Admin')
      return jsonResponse(403, { error: 'Apenas Super Admin pode criar cobranças' })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
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

    // 1. Buscar configurações do Asaas
    const { data: cfgData } = await sb.from('platform_settings')
      .select('key, value')
      .in('key', ['asaas_api_key', 'asaas_environment'])
    const cfg: Record<string, string> = {}
    cfgData?.forEach((r: any) => { cfg[r.key] = r.value })

    const apiKey = cfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
    if (!apiKey) throw new Error('Chave Asaas não configurada. Acesse Configurações → Asaas.')

    const ASAAS_URL = (cfg.asaas_environment || 'production') === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://www.asaas.com/api/v3'

    // 2. Buscar ou criar cliente Asaas
    const { data: inst } = await sb.from('institutions')
      .select('asaas_customer_id, cnpj, name, email')
      .eq('id', institution_id)
      .maybeSingle()

    if (!inst) return jsonResponse(404, { error: 'Instituição não encontrada' })

    let customerId = inst.asaas_customer_id

    if (!customerId) {
      // Dados do banco têm prioridade; o body só completa o que estiver vazio
      // (AdminSchools chama logo após criar a escola, com os mesmos dados).
      const rawCnpj = (inst.cnpj || cpfCnpj || '').replace(/\D/g, '')
      const customerRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
        body: JSON.stringify({
          name:              inst.name || name,
          email:             inst.email || email,
          cpfCnpj:           rawCnpj || undefined,
          externalReference: institution_id,
        }),
      })
      const customerData = await customerRes.json()
      console.log('[asaas-create-charge] customer:', JSON.stringify(customerData))

      if (!customerRes.ok) throw new Error(customerData?.errors?.[0]?.description || 'Erro ao criar cliente no Asaas')

      customerId = customerData.id
      if (customerId) {
        await sb.from('institutions').update({ asaas_customer_id: customerId }).eq('id', institution_id)
      }
    }

    if (!customerId) throw new Error('Não foi possível obter ID do cliente Asaas')

    // 3. Criar registro no banco primeiro (para ter o ID como externalReference)
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

    // 4. Criar cobrança no Asaas
    const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
      body: JSON.stringify({
        customer:          customerId,
        billingType:       billingType || 'UNDEFINED',
        value:             amount,
        dueDate,
        description:       desc,
        externalReference: paymentId ? `${institution_id}:${paymentId}` : institution_id,
      }),
    })

    const charge = await chargeRes.json()
    console.log('[asaas-create-charge] charge:', JSON.stringify(charge))

    if (!chargeRes.ok) {
      throw new Error(charge?.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas')
    }

    const paymentLink = charge.invoiceUrl || `https://www.asaas.com/i/${charge.id}`

    // 5. Atualizar pagamento com IDs do Asaas
    if (paymentId) {
      await sb.from('payments').update({
        asaas_payment_id: charge.id,
        asaas_charge_url: paymentLink,
        asaas_id:         charge.id,
      }).eq('id', paymentId)
    }

    console.log(`[asaas-create-charge] ok — charge ${charge.id} link ${paymentLink}`)

    return new Response(
      JSON.stringify({ ok: true, paymentLink, chargeId: charge.id, paymentId }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[asaas-create-charge] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
