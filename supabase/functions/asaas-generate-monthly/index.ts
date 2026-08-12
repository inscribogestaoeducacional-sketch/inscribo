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
    // Busca configurações (api key + ambiente)
    const { data: cfgRows } = await dbFetch(
      'platform_settings?key=in.(asaas_api_key,asaas_environment)&select=key,value',
      'GET'
    )
    const cfg = Object.fromEntries(cfgRows?.map((r: any) => [r.key, r.value]) || [])
    const ASAAS_KEY_EFF = cfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
    const ASAAS_URL = (cfg.asaas_environment || 'production') === 'sandbox'
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3'

    // Forca geracao manual se vier payment_id no body
    let forcePaymentId: string | null = null
    try {
      const body = await req.json()
      forcePaymentId = body?.payment_id || null
    } catch {}

    // Busca pagamentos pendentes sem link que vencem em 10 dias
    const tenDaysFromNow = new Date()
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)
    const dueDateLimit = tenDaysFromNow.toISOString().split('T')[0]

    const selectFields = 'id,institution_id,amount,due_date,description,payment_type,institutions!inner(id,name,email,cnpj,asaas_customer_id,plan_status,nf_issue_timing)'

    let paymentsPath = `payments?payment_type=eq.monthly&status=eq.pending&asaas_charge_url=is.null&select=${selectFields}&institutions.plan_status=eq.active`

    if (forcePaymentId) {
      paymentsPath += `&id=eq.${forcePaymentId}`
    } else {
      paymentsPath += `&due_date=lte.${dueDateLimit}`
    }

    const { data: payments, status: paymentsStatus } = await dbFetch(paymentsPath, 'GET')
    if (!Array.isArray(payments)) throw new Error(`Erro ao buscar pagamentos: status ${paymentsStatus}`)

    console.log(`[asaas-generate-monthly] ${payments?.length || 0} pagamentos para processar`)

    if (!payments || payments.length === 0) {
      return new Response(JSON.stringify({ ok: true, generated: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const results = []

    for (const payment of payments) {
      const inst = payment.institutions as any
      if (!inst) continue

      try {
        // Busca ou cria cliente no Asaas
        let customerId = inst.asaas_customer_id

        if (!customerId) {
          const customerRes = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_KEY_EFF,
            },
            body: JSON.stringify({
              name: inst.name,
              email: inst.email,
              cpfCnpj: inst.cnpj?.replace(/\D/g, '') || null,
              externalReference: payment.institution_id,
            })
          })
          const customerData = await customerRes.json()
          customerId = customerData.id

          if (customerId) {
            await dbFetch(
              `institutions?id=eq.${payment.institution_id}`,
              'PATCH',
              { asaas_customer_id: customerId },
              'return=minimal'
            )
          }
        }

        if (!customerId) {
          console.error(`[asaas-generate-monthly] sem customerId para ${inst.name}`)
          continue
        }

        // Cria cobranca no Asaas
        const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_KEY_EFF,
          },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: Number(payment.amount),
            dueDate: payment.due_date,
            description: payment.description || `Mensalidade - ${inst.name}`,
            externalReference: payment.institution_id,
          })
        })

        const charge = await chargeRes.json()
        console.log(`[asaas-generate-monthly] charge para ${inst.name}:`, JSON.stringify(charge))

        if (!chargeRes.ok) {
          console.error(`[asaas-generate-monthly] erro ao criar cobranca:`, charge?.errors)
          continue
        }

        const paymentLink = charge.invoiceUrl || `https://www.asaas.com/i/${charge.id}`

        // Atualiza pagamento com link
        await dbFetch(
          `payments?id=eq.${payment.id}`,
          'PATCH',
          {
            asaas_payment_id: charge.id,
            asaas_charge_url: paymentLink,
            asaas_id: charge.id,
          },
          'return=minimal'
        )

        // Nota Fiscal "antes do pagamento" — mesma lógica do asaas-create-charge:
        // se a escola emite a nota antes de receber, cria a linha 'pending' já
        // aqui, na criação da cobrança, sem esperar o webhook de confirmação.
        if (inst.nf_issue_timing === 'before_payment') {
          const { status: invStatus } = await dbFetch(
            'payment_invoices',
            'POST',
            {
              payment_id: payment.id,
              institution_id: payment.institution_id,
              status: 'pending',
              issue_timing: 'before_payment',
            },
            'return=minimal'
          )
          if (invStatus >= 400) console.error(`[asaas-generate-monthly] erro ao criar payment_invoices pra ${payment.id}: status ${invStatus}`)
        }

        // Envia email via Brevo
        if (inst.email) {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              type: 'monthly_payment',
              to: inst.email,
              data: {
                institution_name: inst.name,
                value: Number(payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
                due_date: new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR'),
                description: payment.description || `Mensalidade - ${inst.name}`,
                billing_type: 'PIX / Boleto',
                payment_link: paymentLink,
              }
            })
          }).catch(e => console.error('[asaas-generate-monthly] erro email:', e))
        }

        results.push({ payment_id: payment.id, charge_id: charge.id, link: paymentLink })

      } catch (e) {
        console.error(`[asaas-generate-monthly] erro no pagamento ${payment.id}:`, e)
      }
    }

    return new Response(
      JSON.stringify({ ok: true, generated: results.length, results }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[asaas-generate-monthly] erro:', String(err))
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: CORS }
    )
  }
})
