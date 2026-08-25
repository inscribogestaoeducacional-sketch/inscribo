// =============================================================================
// supabase/functions/create-user/index.ts
// DOCUMENTAÇÃO DE DRIFT + CORREÇÃO DE SEGURANÇA — leia antes de dar deploy.
//
// Esta function já está ATIVA em produção (chamada por InstitutionDetails.tsx,
// AdminCRM.tsx, AdminSchools.tsx e AdminConsultants.tsx) mas nunca teve
// código-fonte versionado neste repositório — mesma situação já registrada
// em 20260701000014_fix_users_rls.sql (linhas 58-65) e na migration
// 20260720000000_document_is_super_admin_user_function.sql.
//
// O bloco "criação em auth.users + public.users" abaixo é uma transcrição
// fiel do código real de produção (colado pelo usuário), sem alterações de
// comportamento.
//
// MUDANÇAS DE COMPORTAMENTO deste arquivo em relação à produção:
// 1) bloco "1. Autenticação e autorização do CHAMADOR" logo abaixo dos
//    headers de CORS: hoje, em produção, QUALQUER requisição com a anon key
//    consegue chamar esta function e criar um usuário com role/user_type
//    arbitrários (inclusive admin_geral) — a function só usa a service role
//    para *escrever*, nunca verifica quem está pedindo a escrita. A correção
//    exige um JWT válido do chamador e libera a chamada só se ele for
//    user_type='admin_geral' OU (user_type='consultant' AND
//    consultant_type='interno') — consultor externo ou não classificado
//    (consultant_type NULL) recebe 403. Isso cobre o fluxo de conversão de
//    lead em cliente do AdminCRM.tsx (linha 813), usado também por
//    consultores internos (SuperAdminLayout.tsx:38, CONSULTANT_MENU).
// 2) aceita e valida o campo opcional `consultant_type` ('interno'|'externo'),
//    gravado em users.consultant_type (20260720000100_add_consultant_type.sql)
//    — rejeitado com 400 se vier junto de um user_type diferente de
//    'consultant'.
// 3) autorização do chamador agora também aceita admin de escola
//    (user_type='school_user' AND role='admin'), usado por
//    UserManagement.tsx para criar atendentes/gestores sem trocar a sessão
//    ativa do navegador (problema do supabase.auth.signUp() client-side).
//    Esse chamador só pode criar user_type='school_user' e somente dentro
//    da própria institution_id — nunca admin_geral/consultant nem
//    institution_id de outra escola. InitialSetup.tsx (bootstrap do 1º
//    admin de uma escola nova) continua em signUp(): não há sessão de
//    chamador pra proteger nesse fluxo (visitante anônimo virando o
//    próprio admin), então o create-user (que exige Bearer token de um
//    chamador já autorizado) não se aplica.
//
// NÃO FAÇA DEPLOY AUTOMÁTICO A PARTIR DESTE COMMIT. Depois de revisar,
// rode manualmente: supabase functions deploy create-user
// =============================================================================

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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ── 1. Autenticação e autorização do CHAMADOR (NOVO) ──────────────────
    // Sem isto, a service role acima permite que qualquer requisição com a
    // anon key crie um usuário com role/user_type arbitrários.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado: token ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerAuth, error: callerAuthErr } = await supabaseAdmin.auth.getUser(token)
    if (callerAuthErr || !callerAuth?.user) {
      return new Response(JSON.stringify({ error: 'Não autenticado: token inválido ou expirado.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile, error: callerProfileErr } = await supabaseAdmin
      .from('users')
      .select('user_type, consultant_type, role, institution_id')
      .eq('id', callerAuth.user.id)
      .single()

    const callerIsSuperOrConsultant =
      !callerProfileErr &&
      (callerProfile?.user_type === 'admin_geral' ||
        (callerProfile?.user_type === 'consultant' && callerProfile?.consultant_type === 'interno'))

    // Admin de escola (UserManagement.tsx / InitialSetup.tsx) pode criar
    // usuários — mas só dentro da própria instituição, e nunca com
    // user_type/institution_id fora dela (checado abaixo, após ler o body).
    const callerIsSchoolAdmin =
      !callerProfileErr &&
      callerProfile?.user_type === 'school_user' &&
      callerProfile?.role === 'admin'

    if (!callerIsSuperOrConsultant && !callerIsSchoolAdmin) {
      return new Response(JSON.stringify({ error: 'Não autorizado: apenas admin_geral, consultor interno ou admin de escola pode criar usuários.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Criação em auth.users + public.users (idêntico à produção) ─────
    const body = await req.json()
    const { email, password, full_name, role, user_type, institution_id, consultant_type } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email e password são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // consultant_type só faz sentido para user_type='consultant' — mesma regra
    // da CHECK constraint de users.consultant_type (20260720000100_add_consultant_type.sql).
    if (consultant_type !== undefined && consultant_type !== null && user_type !== 'consultant') {
      return new Response(JSON.stringify({ error: 'consultant_type só pode ser enviado quando user_type é "consultant".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    if (user_type === 'consultant' && consultant_type !== null && consultant_type !== undefined && !['interno', 'externo'].includes(consultant_type)) {
      return new Response(JSON.stringify({ error: 'consultant_type deve ser "interno" ou "externo".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin de escola não pode criar admin_geral/consultant nem apontar
    // institution_id de outra instituição — sempre força a própria.
    let resolvedInstitutionId = institution_id || null
    if (callerIsSchoolAdmin) {
      if (user_type && user_type !== 'school_user') {
        return new Response(JSON.stringify({ error: 'Admin de escola só pode criar usuários do tipo school_user.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (institution_id && institution_id !== callerProfile.institution_id) {
        return new Response(JSON.stringify({ error: 'Admin de escola só pode criar usuários na própria instituição.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      resolvedInstitutionId = callerProfile.institution_id
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authErr) {
      return new Response(JSON.stringify({ error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileErr } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      full_name: full_name || email,
      role: role || 'admin',
      user_type: user_type || 'school_user',
      institution_id: resolvedInstitutionId,
      consultant_type: user_type === 'consultant' ? (consultant_type || null) : null,
      active: true,
    })

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(JSON.stringify({ error: profileErr.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ user_id: authData.user.id, email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
