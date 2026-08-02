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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  try {
    const body = await req.json()
    const { director_name, role, phone, email, city, state, school_name, co_entidade } = body

    if (!director_name?.trim() || !phone?.trim() || !email?.trim() || !school_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando.' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const notesParts = [
      'Raio-X Estratégico da Escola (INEP)',
      role?.trim() ? `Cargo: ${role.trim()}` : null,
      co_entidade ? `CO_ENTIDADE INEP: ${co_entidade}` : null,
    ].filter(Boolean)

    const { error: leadError } = await supabase.from('crm_leads').insert({
      name: director_name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      school_name: school_name.trim(),
      city: city?.trim() || null,
      state: state?.trim() || null,
      stage: 'interesse',
      origin: 'raio_x_inep',
      notes: notesParts.join(' | '),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (leadError) {
      console.error('Lead error:', leadError)
      throw new Error(leadError.message)
    }

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