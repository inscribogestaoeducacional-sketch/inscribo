// supabase/functions/zapsign-webhook/index.ts
// Receives ZapSign webhook events and updates contract status
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('ZapSign webhook received:', JSON.stringify(payload))

    // ZapSign sends event_type: 'doc_signed' when all signers complete
    const eventType: string = payload.event_type ?? payload.type ?? ''
    const doc = payload.doc ?? payload.document ?? payload

    if (!doc?.token) {
      return new Response(
        JSON.stringify({ error: 'doc.token ausente no payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (eventType === 'doc_signed' || eventType === 'signed') {
      const { data, error } = await supabaseAdmin
        .from('contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(doc.pdf_url ? { pdf_url: doc.pdf_url } : {}),
        })
        .eq('zapsign_doc_token', doc.token)
        .select('id, institution_id')

      if (error) {
        console.error('Error updating contract:', error)
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar contrato', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('Contract signed, updated records:', data?.length ?? 0)

      // Create payment record on first signature
      if (data && data.length > 0) {
        const contract = data[0]
        const { data: contractFull } = await supabaseAdmin
          .from('contracts')
          .select('monthly_value, institution_id')
          .eq('id', contract.id)
          .single()

        if (contractFull?.monthly_value) {
          const dueDate = new Date()
          dueDate.setDate(1)
          dueDate.setMonth(dueDate.getMonth() + 1)

          await supabaseAdmin.from('payments').insert({
            institution_id: contractFull.institution_id,
            contract_id: contract.id,
            amount: contractFull.monthly_value,
            due_date: dueDate.toISOString().slice(0, 10),
            status: 'pending',
          })
        }
      }
    } else if (eventType === 'doc_refused' || eventType === 'refused') {
      await supabaseAdmin
        .from('contracts')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('zapsign_doc_token', doc.token)
    } else {
      console.log('Unhandled event_type:', eventType)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
