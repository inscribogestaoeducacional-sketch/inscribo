// supabase/functions/brevo-webhook/index.ts
// Recebe eventos de e-mail transacional do Brevo (proposta comercial enviada
// por e-mail, ver ProposalGenerator.tsx) e atualiza o status da proposta.
// Réplica de api/brevo/webhook.ts (Vercel) adaptada pro runtime Deno — mesmo
// padrão das outras edge functions de webhook do projeto (asaas-webhook,
// autentique-webhook, zapsign-webhook).
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    console.log('[brevo-webhook] payload:', JSON.stringify(body))

    // O Brevo manda um único evento por request por padrão, mas a conta pode
    // estar configurada pra enviar em lote (array) — aceita os dois formatos,
    // mesma checagem já usada em api/brevo/webhook.ts.
    const events = Array.isArray(body) ? body : [body]

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    for (const event of events) {
      const eventType: string = event?.event || ''
      const proposalId: string | undefined = event?.params?.proposal_id

      if (!proposalId) continue

      if (eventType === 'delivered') {
        await supabaseAdmin
          .from('proposals')
          .update({ status: 'delivered', delivered_at: new Date().toISOString() })
          .eq('id', proposalId)
          .in('status', ['sent', 'draft'])
      } else if (eventType === 'opened') {
        await supabaseAdmin
          .from('proposals')
          .update({ status: 'opened', opened_email_at: new Date().toISOString() })
          .eq('id', proposalId)
          .in('status', ['sent', 'delivered'])
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[brevo-webhook] erro:', String(err))
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
