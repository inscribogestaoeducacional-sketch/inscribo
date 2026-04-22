// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Webhook externo — não valida JWT do Supabase
  // Valida apenas pelo token da Autentique se configurado

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    console.log('[autentique-webhook] payload:', JSON.stringify(body))

    const documentId = body?.document?.id || body?.id
    const status = body?.event || body?.status

    if (!documentId) {
      return new Response(JSON.stringify({ ok: true, msg: 'no document id' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const { data: contract } = await supabase
      .from('contracts')
      .select('*, institutions(id, name, email, phone)')
      .eq('autentique_document_id', documentId)
      .maybeSingle()

    if (!contract) {
      console.log('[autentique-webhook] contrato não encontrado para document:', documentId)
      return new Response(JSON.stringify({ ok: true, msg: 'contract not found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const isSigned = status === 'SIGNED' || status === 'signed' ||
      body?.document?.signatures?.every((s: any) => s?.signed_at) ||
      body?.signed === true

    if (isSigned) {
      await supabase.from('contracts')
        .update({ status: 'signed' })
        .eq('id', contract.id)

      await supabase.from('institutions')
        .update({ plan_status: 'pending_payment' })
        .eq('id', contract.institution_id)

      await supabase.from('system_notifications').insert({
        institution_id: null,
        title: `Contrato assinado — ${contract.institutions?.name}`,
        message: `O gestor assinou o contrato. Escola aguardando pagamento da implantação.`,
        type: 'info',
        read: false,
      })

      const { data: payment } = await supabase
        .from('payments')
        .select('asaas_charge_url, amount, due_date')
        .eq('institution_id', contract.institution_id)
        .eq('payment_type', 'implementation')
        .eq('status', 'pending')
        .maybeSingle()

      if (payment?.asaas_charge_url && contract.institutions?.email) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            type: 'payment_link',
            to: contract.institutions.email,
            data: {
              institution_name: contract.institutions.name,
              value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount),
              due_date: payment.due_date ? new Date(payment.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—',
              billing_type: 'PIX/Boleto',
              payment_link: payment.asaas_charge_url,
            }
          })
        })
      }

      console.log('[autentique-webhook] contrato assinado, escola pendente pagamento:', contract.institution_id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[autentique-webhook] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS
    })
  }
})
