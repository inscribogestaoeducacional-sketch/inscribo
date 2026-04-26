// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const AION_INSTITUTION_ID = '400349ba-872d-4b38-afca-d0eba2baa00a'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      }
    })
  }

  try {
    const { nome, email, escola, cidade, whatsapp } = await req.json()

    if (!nome || !escola || !whatsapp) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios faltando.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const { error: leadError } = await supabase.from('leads').insert({
      institution_id: AION_INSTITUTION_ID,
      responsible_name: nome,
      student_name: escola,
      phone: whatsapp,
      email: email || null,
      grade_interest: cidade ? `Demo solicitada - ${cidade}` : 'Demo solicitada pelo site',
      source: 'Site',
      status: 'new',
      notes: `Escola: ${escola}${cidade ? ` | Cidade: ${cidade}` : ''} | Contato via landing page`,
    })

    if (leadError) throw leadError

    await supabase.from('system_notifications').insert({
      institution_id: AION_INSTITUTION_ID,
      type: 'milestone',
      title: 'Nova solicitação de demo',
      message: `${nome} da escola ${escola} (${whatsapp}) quer uma demonstração.`,
      severity: 'success',
      action_url: '/leads',
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
