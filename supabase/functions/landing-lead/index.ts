// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const AION_INSTITUTION_ID = '400349ba-872d-4b38-afca-d0eba2baa00a'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  try {
    const body = await req.json()
    const { nome, email, escola, cidade, whatsapp } = body

    if (!nome?.trim() || !escola?.trim() || !whatsapp?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const { error: leadError } = await supabase.from('leads').insert({
      institution_id: AION_INSTITUTION_ID,
      responsible_name: nome.trim(),
      student_name: escola.trim(),
      phone: whatsapp.trim(),
      email: email?.trim() || null,
      grade_interest: cidade?.trim() ? `Demo - ${cidade.trim()}` : 'Demo pelo site',
      source: 'Site',
      status: 'new',
      notes: `Escola: ${escola}${cidade ? ` | ${cidade}` : ''} | Landing page`,
    })

    if (leadError) {
      console.error('Lead error:', leadError)
      throw new Error(leadError.message)
    }

    await supabase.from('system_notifications').insert({
      institution_id: AION_INSTITUTION_ID,
      type: 'milestone',
      title: 'Nova solicitação de demo',
      message: `${nome} da escola ${escola}${cidade ? ` (${cidade})` : ''} — ${whatsapp}`,
      severity: 'success',
      action_url: '/leads',
    })

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('Function error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
