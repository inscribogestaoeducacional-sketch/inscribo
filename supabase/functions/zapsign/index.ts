// supabase/functions/zapsign/index.ts
// Creates a ZapSign document and updates the contract record with sign URL
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
    const {
      contract_id,
      school_name,
      signer_name,
      signer_email,
      signer_phone,
    } = await req.json()

    if (!contract_id || !signer_name || !signer_email) {
      return new Response(
        JSON.stringify({ error: 'contract_id, signer_name e signer_email são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const ZAPSIGN_TOKEN = Deno.env.get('ZAPSIGN_API_TOKEN')
    if (!ZAPSIGN_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'ZAPSIGN_API_TOKEN não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Supabase client to fetch contract template URL from settings
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: setting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'contract_template_url')
      .maybeSingle()

    const templateUrl = setting?.value || ''
    if (!templateUrl) {
      return new Response(
        JSON.stringify({ error: 'URL do template de contrato não configurada em Configurações' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create document via ZapSign API
    const zapPayload: Record<string, unknown> = {
      name: `Contrato Áion Edu — ${school_name}`,
      url_pdf: templateUrl,
      signers: [
        {
          name: signer_name,
          email: signer_email,
          send_automatic_email: true,
          ...(signer_phone ? { phone: signer_phone, send_automatic_whatsapp: true } : {}),
        },
      ],
    }

    const zapRes = await fetch('https://api.zapsign.com.br/api/v1/docs/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ZAPSIGN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(zapPayload),
    })

    if (!zapRes.ok) {
      const errText = await zapRes.text()
      console.error('ZapSign error:', errText)
      return new Response(
        JSON.stringify({ error: `Erro ZapSign: ${zapRes.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const doc = await zapRes.json()
    const signUrl = doc.signers?.[0]?.sign_url ?? null
    const docToken = doc.token ?? null

    // Update contract with ZapSign data
    const { error: updateErr } = await supabaseAdmin
      .from('contracts')
      .update({
        zapsign_doc_token: docToken,
        zapsign_sign_url: signUrl,
        status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract_id)

    if (updateErr) {
      console.error('Supabase update error:', updateErr)
    }

    return new Response(
      JSON.stringify({ success: true, doc_token: docToken, sign_url: signUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('ZapSign function error:', err)
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
