// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
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

    if (!institution_id) throw new Error('institution_id é obrigatório')
    if (!value || Number(value) <= 0) throw new Error('Valor inválido')
    if (!dueDate) throw new Error('dueDate é obrigatório')

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
      .single()

    let customerId = inst?.asaas_customer_id

    if (!customerId) {
      const rawCnpj = (cpfCnpj || inst?.cnpj || '').replace(/\D/g, '')
      const customerRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': apiKey },
        body: JSON.stringify({
          name:              name || inst?.name,
          email:             email || inst?.email,
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
    const desc = description || `${payment_type === 'implementation' ? 'Implantação' : 'Mensalidade'} — ${inst?.name || name}`
    const { data: paymentRecord, error: payErr } = await sb.from('payments').insert({
      institution_id,
      payment_type,
      amount:      Number(value),
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
        value:             Number(value),
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
