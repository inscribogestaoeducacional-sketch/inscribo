// Apaga um professor do Concurso de Bolsas: remove o cadastro (e as cotas dele) e, se a conta só serve para o concurso, o login também.
// Quem chama: admin/gestor da escola com o módulo ligado (ou Super Admin).
// POST { institution_id, teacher_id, delete_questions: boolean } -> { ok, questions_deleted, account_deleted }
// delete_questions=false mantém as questões dele na prova (ficam sem autor).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

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
    const teacher_id = String(body.teacher_id ?? '')
    const delete_questions = body.delete_questions === true
    if (!/^[0-9a-f-]{36}$/.test(institution_id) || !/^[0-9a-f-]{36}$/.test(teacher_id)) return json(400, { error: 'Professor inválido' })

    // Autorização (mesma regra do cadastro)
    const { data: prof } = await admin.from('users').select('user_type, role, active, institution_id, active_institution_id').eq('id', caller.user.id).maybeSingle()
    const isSuper = prof?.user_type === 'admin_geral'
    const { data: perm } = await admin.from('user_permissions').select('enabled').eq('user_id', caller.user.id).eq('institution_id', institution_id).eq('module', 'concurso').maybeSingle()
    const isSchoolManager = !!prof && prof.active !== false && (['admin', 'manager'].includes(prof.role) || perm?.enabled === true)
      && [prof.institution_id, prof.active_institution_id].includes(institution_id)
    if (!isSuper && !isSchoolManager) return json(403, { error: 'Sem permissão para apagar professores' })

    const { data: t } = await admin.from('contest_teachers').select('id, user_id').eq('id', teacher_id).eq('institution_id', institution_id).maybeSingle()
    if (!t) return json(404, { error: 'Professor não encontrado' })

    let questionsDeleted = 0
    if (delete_questions) {
      const { data: qs } = await admin.from('contest_questions').select('id, contest_id, grade, in_exam').eq('author_teacher_id', teacher_id)
      // Bloqueia se alguma questão dele já está num caderno montado
      for (const q of (qs ?? []).filter((x: any) => x.in_exam)) {
        const { count } = await admin.from('contest_exam_versions').select('id', { count: 'exact', head: true }).eq('contest_id', q.contest_id).eq('grade', q.grade)
        if ((count ?? 0) > 0) return json(409, { error: 'Uma das questões deste professor já está num caderno de prova montado. Desmonte a prova daquela série antes de apagar.' })
      }
      if ((qs ?? []).length) {
        const { error } = await admin.from('contest_questions').delete().eq('author_teacher_id', teacher_id)
        if (error) return json(400, { error: error.message })
        questionsDeleted = qs!.length
      }
    }

    const { error: terr } = await admin.from('contest_teachers').delete().eq('id', teacher_id)
    if (terr) return json(400, { error: terr.message })

    // Login: só apaga se a conta é de professor e não está ligada a outro cadastro de professor
    let accountDeleted = false
    const { data: acc } = await admin.from('users').select('user_type').eq('id', t.user_id).maybeSingle()
    const { count: other } = await admin.from('contest_teachers').select('id', { count: 'exact', head: true }).eq('user_id', t.user_id)
    if (acc?.user_type === 'professor' && (other ?? 0) === 0 && t.user_id !== caller.user.id) {
      try {
        await admin.from('users').delete().eq('id', t.user_id)
        const { error: derr } = await admin.auth.admin.deleteUser(t.user_id)
        accountDeleted = !derr
      } catch (_) { accountDeleted = false }
    }
    return json(200, { ok: true, questions_deleted: questionsDeleted, account_deleted: accountDeleted })
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : String(e) })
  }
})
