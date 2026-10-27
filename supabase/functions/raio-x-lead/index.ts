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
    const { director_name, role, phone, email, city, state, school_name, co_entidade, diagnostico } = body

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

    const { data: lead, error: leadError } = await supabase.from('crm_leads').insert({
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
    }).select('id').single()

    if (leadError) {
      console.error('Lead error:', leadError)
      throw new Error(leadError.message)
    }

    // Diagnóstico de atendimento respondido pela escola (opcional). Falha aqui não derruba o cadastro.
    let diagnostico_id: string | null = null
    if (diagnostico && typeof diagnostico === 'object' && Number.isFinite(Number(co_entidade))) {
      try {
        const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? Math.round(v) : null)
        const small = (o: unknown) => (o && typeof o === 'object' && JSON.stringify(o).length < 60000 ? o : null)
        const txt = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)
        const { data: dg, error: dgErr } = await supabase.from('raiox_diagnostico').insert({
          lead_id: lead?.id ?? null,
          co_entidade: Number(co_entidade),
          respostas: small(diagnostico.respostas) ?? {},
          pontuacao: num(diagnostico.pontuacao),
          faixa: txt(diagnostico.faixa, 20),
          instagram: txt(diagnostico.instagram, 60),
          instagram_texto: txt(diagnostico.instagram_texto, 6000),
          instagram_dados: small(diagnostico.instagram_dados),
          outras_cidades: small(diagnostico.outras_cidades),
        }).select('id').single()
        if (dgErr) console.error('[raio-x-lead] diagnóstico:', dgErr.message)
        else diagnostico_id = dg?.id ?? null
      } catch (e) { console.error('[raio-x-lead] diagnóstico:', e) }
    }

    // Fase B — WhatsApp + e-mail de boas-vindas assim que o lead é capturado
    // (único sinal server-side que temos: o PDF em si é gerado e baixado
    // 100% no client, ver src/pages/RaioXPage.tsx). Best-effort: uma falha
    // aqui não deve impedir a resposta de sucesso pro formulário.
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/raio-x-followup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          leadId: lead?.id,
          director_name: director_name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          school_name: school_name.trim(),
        }),
      })
    } catch (followupErr) {
      console.error('[raio-x-lead] erro ao chamar raio-x-followup:', followupErr)
    }

    return new Response(
      JSON.stringify({ ok: true, diagnostico_id }),
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