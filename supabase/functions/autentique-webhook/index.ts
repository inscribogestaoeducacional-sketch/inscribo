// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function dbFetch(path: string, method: string, body?: object, prefer?: string) {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }
  if (prefer) headers['Prefer'] = prefer
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return { data: null, status: res.status }
  const data = await res.json()
  return { data, status: res.status }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    console.log('[autentique-webhook] payload:', JSON.stringify(body))

    const documentId =
      body?.event?.data?.document ||
      body?.document?.id ||
      body?.id ||
      null

    if (!documentId) {
      return new Response(JSON.stringify({ ok: true, msg: 'no document id' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 1. Buscar contrato com dados da instituição (join via PostgREST)
    const { data: contractRows } = await dbFetch(
      `contracts?autentique_document_id=eq.${documentId}&select=*,institutions(id,name,email,phone,cnpj,implementation_value)`,
      'GET'
    )
    const contract = Array.isArray(contractRows) ? contractRows[0] : null

    if (!contract) {
      console.log('[autentique-webhook] contrato não encontrado para document:', documentId)
      return new Response(JSON.stringify({ ok: true, msg: 'contract not found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // 2. Identificar qual signatário acabou de assinar
    const signerEmail: string | null =
      body?.event?.data?.user?.email ||
      body?.email ||
      body?.signer?.email ||
      body?.document?.signatures?.find((s: any) => s?.signed_at)?.email ||
      null

    console.log('[autentique-webhook] documentId:', documentId, 'signerEmail:', signerEmail)

    // 3. Atualizar status por signatário no JSONB signers
    let updatedSigners = contract.signers
    if (signerEmail && Array.isArray(contract.signers) && contract.signers.length > 0) {
      const signedAt = body?.event?.data?.signed_at || body?.signed_at || body?.signer?.signed_at || new Date().toISOString()
      updatedSigners = contract.signers.map((s: any) =>
        s.email === signerEmail ? { ...s, signed: true, signed_at: signedAt } : s
      )
      await dbFetch(`contracts?id=eq.${contract.id}`, 'PATCH', { signers: updatedSigners })
      contract.signers = updatedSigners
    }

    // Cada webhook é disparado por uma assinatura individual.
    // Considera o contrato totalmente assinado quando todos os signers têm signed: true.
    const isSigned =
      (Array.isArray(updatedSigners) && updatedSigners.length > 0 && updatedSigners.every((s: any) => s.signed)) ||
      body?.document?.signatures?.every((s: any) => s?.signed_at) ||
      body?.signed === true

    if (isSigned) {
      // 4. Marcar contrato como assinado
      await dbFetch(`contracts?id=eq.${contract.id}`, 'PATCH', {
        status: 'signed',
        signed_at: new Date().toISOString(),
      })

      // 5. Atualizar status da instituição
      await dbFetch(`institutions?id=eq.${contract.institution_id}`, 'PATCH', {
        plan_status: 'pending_payment',
      })

      // 6. Notificação para o super admin
      await dbFetch('system_notifications', 'POST', {
        institution_id: null,
        title: `Contrato assinado — ${contract.institutions?.name}`,
        message: `O gestor assinou o contrato. Escola aguardando pagamento da implantação.`,
        type: 'info',
        read: false,
      }, 'return=minimal')

      const inst = contract.institutions
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const rawKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      const serviceKey = (() => {
        try {
          const parsed = JSON.parse(rawKey)
          return parsed.service_role || rawKey
        } catch { return rawKey }
      })()

      // 7. Verificar se já existe cobrança de implantação pendente
      const { data: paymentRows } = await dbFetch(
        `payments?institution_id=eq.${contract.institution_id}&payment_type=eq.implementation&status=eq.pending&select=id,asaas_charge_url,amount,due_date`,
        'GET'
      )
      const existingPayment = Array.isArray(paymentRows) ? paymentRows[0] : null

      if (!existingPayment) {
        // 7a. Buscar config do Asaas
        const { data: cfgRows } = await dbFetch(
          'platform_settings?key=in.(asaas_api_key,asaas_environment)&select=key,value',
          'GET'
        )
        const asaasCfg: Record<string, string> = {}
        for (const row of cfgRows || []) asaasCfg[row.key] = row.value

        const asaasKey = asaasCfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
        const ASAAS_URL = (asaasCfg.asaas_environment || 'production') === 'sandbox'
          ? 'https://sandbox.asaas.com/api/v3'
          : 'https://www.asaas.com/api/v3'

        if (!asaasKey) {
          console.warn('[autentique-webhook] Asaas API key não configurada — cobrança não criada')
        } else {
          // 7b. Buscar institution para asaas_customer_id e implementation_value
          const { data: instRows } = await dbFetch(
            `institutions?id=eq.${contract.institution_id}&select=asaas_customer_id,cnpj,name,email,phone,implementation_value`,
            'GET'
          )
          const institution = Array.isArray(instRows) ? instRows[0] : null

          let customerId = institution?.asaas_customer_id

          // 7c. Criar cliente no Asaas se não existir
          if (!customerId) {
            const rawCnpj = (institution?.cnpj || inst?.cnpj || '').replace(/\D/g, '')
            const customerRes = await fetch(`${ASAAS_URL}/customers`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'access_token': asaasKey },
              body: JSON.stringify({
                name:              institution?.name || inst?.name,
                email:             institution?.email || inst?.email,
                cpfCnpj:           rawCnpj || undefined,
                externalReference: contract.institution_id,
              }),
            })
            const customerData = await customerRes.json()
            console.log('[autentique-webhook] asaas customer:', JSON.stringify(customerData))

            if (customerRes.ok && customerData.id) {
              customerId = customerData.id
              await dbFetch(`institutions?id=eq.${contract.institution_id}`, 'PATCH', {
                asaas_customer_id: customerId,
              })
            }
          }

          if (customerId) {
            const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
            const implValue = Number(institution?.implementation_value || inst?.implementation_value || 0)
            const desc = `Taxa de implantação — ${institution?.name || inst?.name}`

            // 7d. Inserir payment no banco primeiro (para externalReference)
            const { data: newPaymentRows } = await dbFetch('payments', 'POST', {
              institution_id: contract.institution_id,
              payment_type:   'implementation',
              amount:         implValue,
              status:         'pending',
              due_date:       dueDate,
              description:    desc,
            }, 'return=representation')
            const paymentId = Array.isArray(newPaymentRows) ? newPaymentRows[0]?.id : newPaymentRows?.id || null

            // 7e. Criar cobrança no Asaas
            const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'access_token': asaasKey },
              body: JSON.stringify({
                customer:          customerId,
                billingType:       'UNDEFINED',
                value:             implValue,
                dueDate,
                description:       desc,
                externalReference: paymentId ? `${contract.institution_id}:${paymentId}` : contract.institution_id,
              }),
            })
            const chargeData = await chargeRes.json()
            console.log('[autentique-webhook] asaas charge:', JSON.stringify(chargeData))

            const paymentLink = chargeData.invoiceUrl
              || (chargeData.id ? `https://www.asaas.com/i/${chargeData.id}` : null)

            // 7f. Atualizar payment com IDs do Asaas
            if (paymentId && chargeData.id) {
              await dbFetch(`payments?id=eq.${paymentId}`, 'PATCH', {
                asaas_payment_id: chargeData.id,
                asaas_charge_url: paymentLink,
                asaas_id:         chargeData.id,
              })
            }

            // 7g. Enviar email com link de pagamento
            const emailTo = institution?.email || inst?.email
            if (paymentLink && emailTo) {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  type: 'payment_link',
                  to:   emailTo,
                  data: {
                    institution_name: institution?.name || inst?.name,
                    value:            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(implValue),
                    due_date:         new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR'),
                    billing_type:     'PIX/Boleto',
                    payment_link:     paymentLink,
                  },
                }),
              })
            }
          }
        }
      } else if (existingPayment.asaas_charge_url && (inst?.email)) {
        // Cobrança já existia — reenviar email com o link existente
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            type: 'payment_link',
            to:   inst.email,
            data: {
              institution_name: inst.name,
              value:            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(existingPayment.amount),
              due_date:         existingPayment.due_date ? new Date(existingPayment.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
              billing_type:     'PIX/Boleto',
              payment_link:     existingPayment.asaas_charge_url,
            },
          }),
        })
      }

      console.log('[autentique-webhook] contrato assinado, escola pendente pagamento:', contract.institution_id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[autentique-webhook] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS,
    })
  }
})
