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
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

      // 7. Verificar se já existe cobrança de implantação pendente
      const { data: paymentRows } = await dbFetch(
        `payments?institution_id=eq.${contract.institution_id}&payment_type=eq.implementation&status=eq.pending&select=id,asaas_charge_url,amount,due_date`,
        'GET'
      )
      const existingPayment = Array.isArray(paymentRows) ? paymentRows[0] : null

      if (!existingPayment) {
        // Cobrança não existe — criar agora que o contrato foi assinado
        const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
        const chargeRes = await fetch(`${supabaseUrl}/functions/v1/asaas-create-charge`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
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
              'Authorization': `Bearer ${anonKey}`,
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
        // Cobrança já existia — reenviar email com o link existente
        await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
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
