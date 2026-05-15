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
      .select('*, institutions(id, name, email, phone, cnpj, implementation_value)')
      .eq('autentique_document_id', documentId)
      .maybeSingle()

    if (!contract) {
      console.log('[autentique-webhook] contrato não encontrado para document:', documentId)
      return new Response(JSON.stringify({ ok: true, msg: 'contract not found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // Identify which signer just signed from the webhook payload
    const signerEmail: string | null =
      body?.email ||
      body?.signer?.email ||
      body?.document?.signatures?.find((s: any) => s?.signed_at)?.email ||
      null

    // Update per-signer status in signers JSONB
    if (signerEmail && Array.isArray(contract.signers) && contract.signers.length > 0) {
      const signedAt = body?.signed_at || body?.signer?.signed_at || new Date().toISOString()
      const updatedSigners = contract.signers.map((s: any) =>
        s.email === signerEmail ? { ...s, signed: true, signed_at: signedAt } : s
      )
      await supabase.from('contracts')
        .update({ signers: updatedSigners })
        .eq('id', contract.id)
      // Refresh contract.signers for the all-signed check below
      contract.signers = updatedSigners
    }

    const isSigned = status === 'SIGNED' || status === 'signed' ||
      (Array.isArray(contract.signers) && contract.signers.length > 0 && contract.signers.every((s: any) => s.signed)) ||
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

      const inst = contract.institutions
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!

      // Verificar se já existe cobrança de implantação pendente
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, asaas_charge_url, amount, due_date')
        .eq('institution_id', contract.institution_id)
        .eq('payment_type', 'implementation')
        .eq('status', 'pending')
        .maybeSingle()

      if (!existingPayment) {
        // Cobrança ainda não existe — criar agora que o contrato foi assinado
        const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
        const chargeRes = await fetch(`${supabaseUrl}/functions/v1/asaas-create-charge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            institution_id: contract.institution_id,
            name:           inst?.name,
            email:          inst?.email,
            cpfCnpj:        inst?.cnpj || null,
            value:          inst?.implementation_value || 0,
            description:    `Taxa de implantação — ${inst?.name}`,
            dueDate,
            payment_type:   'implementation',
          }),
        })

        const chargeData = await chargeRes.json()
        console.log('[autentique-webhook] asaas charge created:', JSON.stringify(chargeData))

        if (chargeData?.paymentLink && inst?.email) {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              type: 'payment_link',
              to:   inst.email,
              data: {
                institution_name: inst.name,
                value:            new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inst.implementation_value || 0),
                due_date:         new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR'),
                billing_type:     'PIX/Boleto',
                payment_link:     chargeData.paymentLink,
              },
            }),
          })
        }
      } else if (existingPayment.asaas_charge_url && inst?.email) {
        // Cobrança já existia (criada manualmente) — só reenviar o email com o link existente
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
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
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[autentique-webhook] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: CORS
    })
  }
})
