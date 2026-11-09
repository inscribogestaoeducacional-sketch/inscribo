// Cadastra um professor do Concurso de Bolsas: cria a conta (tipo 'professor', sem vínculo comum com a escola)
// e a linha em contest_teachers. A senha é criada pelo próprio professor (o app dispara o e-mail "Criar minha senha").
// Quem chama: admin/gestor da escola com o módulo ligado (ou Super Admin).
// POST { institution_id, full_name, email, phone? } -> { teacher_id, user_id, created }
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim()
    if (!token) return json(401, { error: 'Não autenticado' })
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
    const { data: caller } = await admin.auth.getUser(token)
    if (!caller?.user) return json(401, { error: 'Não autenticado' })

    const body = await req.json().catch(() => ({}))
    const institution_id = String(body.institution_id ?? '')
    const full_name = String(body.full_name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const phone = body.phone ? String(body.phone).trim() : null
    if (!/^[0-9a-f-]{36}$/.test(institution_id) || !full_name || !EMAIL_RE.test(email)) return json(400, { error: 'Informe nome e e-mail válidos' })

    // Autorização: quem chama precisa gerir o concurso desta escola
    const { data: prof } = await admin.from('users').select('user_type, role, active, institution_id, active_institution_id').eq('id', caller.user.id).maybeSingle()
    const isSuper = prof?.user_type === 'admin_geral'
    const isSchoolManager = !!prof && prof.active !== false && ['admin', 'manager'].includes(prof.role)
      && [prof.institution_id, prof.active_institution_id].includes(institution_id)
    if (!isSuper && !isSchoolManager) return json(403, { error: 'Sem permissão para cadastrar professores' })
    const { data: st } = await admin.from('contest_settings').select('module_enabled').eq('institution_id', institution_id).maybeSingle()
    if (st?.module_enabled !== true) return json(403, { error: 'Módulo Concurso de Bolsas não está liberado para esta escola' })

    // Conta existente?
    const { data: existingId } = await admin.rpc('get_auth_user_id_by_email', { target_email: email })
    let userId = existingId as string | null
    let created = false
    if (userId) {
      const { data: existing } = await admin.from('users').select('user_type').eq('id', userId).maybeSingle()
      if (existing && existing.user_type !== 'professor') {
        return json(409, { error: 'Este e-mail já tem uma conta na Áion (equipe da escola). Use outro e-mail para o professor.' })
      }
    } else {
      const pwd = crypto.randomUUID() + crypto.randomUUID()
      const { data: a, error: aerr } = await admin.auth.admin.createUser({ email, password: pwd, email_confirm: true, user_metadata: { full_name } })
      if (aerr || !a?.user) return json(400, { error: aerr?.message ?? 'Não foi possível criar a conta' })
      userId = a.user.id
      created = true
    }
    if (created || !(await admin.from('users').select('id').eq('id', userId!).maybeSingle()).data) {
      const { error: perr } = await admin.from('users').insert({
        id: userId, email, full_name, role: 'user', user_type: 'professor', institution_id: null, active: true,
        can_see_all_conversations: false, can_see_full_history: false,
      })
      if (perr) {
        if (created) await admin.auth.admin.deleteUser(userId!)
        return json(400, { error: perr.message })
      }
    }
    const { data: t, error: terr } = await admin.from('contest_teachers')
      .upsert({ institution_id, user_id: userId, full_name, email, phone, active: true }, { onConflict: 'institution_id,user_id' })
      .select('id').single()
    if (terr) return json(400, { error: terr.message })
    return json(200, { teacher_id: t.id, user_id: userId, created })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
