// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASAAS_KEY = Deno.env.get('ASAAS_API_KEY')
const ASAAS_URL = 'https://api.asaas.com/v3'

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

    // Força geração manual se vier payment_id no body
    let forcePaymentId: string | null = null
    try {
      const body = await req.json()
      forcePaymentId = body?.payment_id || null
    } catch {}

    // Busca pagamentos pendentes sem link que vencem em 10 dias
    const tenDaysFromNow = new Date()
    tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10)

    let query = sb.from('payments')
      .select(`
        id, institution_id, amount, due_date, description, payment_type,
        institutions (id, name, email, cnpj, asaas_customer_id)
      `)
      .eq('status', 'pending')
      .is('asaas_charge_url', null)
      .eq('payment_type', 'monthly')

    if (forcePaymentId) {
      query = query.eq('id', forcePaymentId)
    } else {
      query = query.lte('due_date', tenDaysFromNow.toISOString().split('T')[0])
    }

    const { data: payments, error: paymentsErr } = await query
    if (paymentsErr) throw paymentsErr

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
              'access_token': ASAAS_KEY!,
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
            await sb.from('institutions')
              .update({ asaas_customer_id: customerId })
              .eq('id', payment.institution_id)
          }
        }

        if (!customerId) {
          console.error(`[asaas-generate-monthly] sem customerId para ${inst.name}`)
          continue
        }

        // Cria cobrança no Asaas
        const chargeRes = await fetch(`${ASAAS_URL}/payments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_KEY!,
          },
          body: JSON.stringify({
            customer: customerId,
            billingType: 'UNDEFINED',
            value: Number(payment.amount),
            dueDate: payment.due_date,
            description: payment.description || `Mensalidade — ${inst.name}`,
            externalReference: payment.institution_id,
          })
        })

        const charge = await chargeRes.json()
        console.log(`[asaas-generate-monthly] charge para ${inst.name}:`, JSON.stringify(charge))

        if (!chargeRes.ok) {
          console.error(`[asaas-generate-monthly] erro ao criar cobrança:`, charge?.errors)
          continue
        }

        const paymentLink = charge.invoiceUrl || `https://www.asaas.com/i/${charge.id}`

        // Atualiza pagamento com link
        await sb.from('payments').update({
          asaas_payment_id: charge.id,
          asaas_charge_url: paymentLink,
          asaas_id: charge.id,
        }).eq('id', payment.id)

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
                description: payment.description || `Mensalidade — ${inst.name}`,
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
