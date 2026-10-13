// supabase/functions/erp-activesoft-sync/index.ts
//
// Activesoft (só leitura) — Etapa C. Mesmo fluxo para toda escola.
// Ações (POST { action, institution_id, run_id? }), só admin da escola com o
// módulo "Base de alunos" liberado:
//   test  → uma chamada limit=1 em cada rota permitida: descobre a forma de
//           autenticação (Bearer/Token), marca o que respondeu (scopes_ok) e
//           guarda só os NOMES dos campos (fields_seen). Nenhum dado é guardado.
//   step  → avança a leitura de uma carga (sync_runs criada por base_erp_start)
//           por ~40 s, 25 itens por página, e para; a próxima chamada continua
//           de onde parou (step/step_offset). Ao terminar, a carga fica
//           "aguardando_confirmacao": nada entra na base até a escola conferir
//           a contagem (base_erp_preview) e confirmar (base_erp_apply).
// O token sai do Vault só aqui dentro (erp_connection_token, service role) e
// nunca vai para log, erro ou resposta.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PAGE_SIZE, ROUTES, ForbiddenRoute, routeUrl, readPage, fieldNames, plan, normalize, type RouteKey } from './adapter.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const TIME_BUDGET_MS = 40_000
const KEEP_FROM_YEAR = new Date().getFullYear() - 1     // N-1 em diante (base do ano anterior)

type Supa = ReturnType<typeof createClient>
class HttpError extends Error { constructor(public status: number, message: string) { super(message) } }
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) throw new HttpError(401, 'Não autenticado')
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: u, error: ue } = await userClient.auth.getUser()
    if (ue || !u?.user) throw new HttpError(401, 'Não autenticado')

    const body = await req.json().catch(() => ({}))
    const inst = String(body?.institution_id || '')
    if (!/^[0-9a-f-]{36}$/i.test(inst)) throw new HttpError(400, 'institution_id inválido')
    // papel e módulo conferidos com o JWT de quem chamou
    const [{ data: isAdmin }, { data: modOn }] = await Promise.all([
      userClient.rpc('base_user_is_admin', { p_institution_id: inst }),
      userClient.rpc('base_module_enabled', { p_institution_id: inst }),
    ])
    if (isAdmin !== true) throw new HttpError(403, 'Só o administrador da escola mexe na integração')
    if (modOn !== true) throw new HttpError(403, 'Módulo Base de alunos não liberado para esta escola')

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    switch (body?.action) {
      case 'test': return json(200, await actionTest(sb, inst))
      case 'step': return json(200, await actionStep(sb, inst, String(body?.run_id || '')))
      default: throw new HttpError(400, 'action deve ser test ou step')
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const msg = e instanceof Error ? e.message : String(e)
    if (status === 500) console.error('[erp-activesoft-sync]', msg)
    return json(status, { error: msg })
  }
})

async function loadConn(sb: Supa, inst: string) {
  const { data: conn } = await sb.from('erp_connections')
    .select('api_base_url, auth_scheme, token_secret_id').eq('institution_id', inst).eq('provider', 'activesoft').maybeSingle()
  if (!conn?.token_secret_id) throw new HttpError(400, 'Cadastre o token do Activesoft primeiro')
  const { data: token, error } = await sb.rpc('erp_connection_token', { p_institution_id: inst, p_provider: 'activesoft' })
  if (error || !token) throw new HttpError(500, 'Não foi possível ler o token guardado')
  return { baseUrl: conn.api_base_url as string, scheme: conn.auth_scheme as string | null, token: token as string }
}

class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }

// GET numa rota permitida, com 3 tentativas em 429/5xx/timeout.
async function apiGet(baseUrl: string, route: string, params: Record<string, string | number | boolean>, scheme: string, token: string) {
  const url = routeUrl(baseUrl, route, params)   // recusa rota fora da lista
  let last = 0
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await new Promise(r => setTimeout(r, 800 * 2 ** attempt))
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20_000)
    try {
      const res = await fetch(url, { method: 'GET', headers: { Authorization: `${scheme} ${token}`, Accept: 'application/json' }, signal: ctrl.signal })
      last = res.status
      if (res.status === 429 || res.status >= 500) continue
      if (!res.ok) throw new ApiError(res.status, `Activesoft respondeu ${res.status} em ${route}`)
      return await res.json()
    } catch (e) {
      if (e instanceof ApiError) throw e
      last = -1
    } finally { clearTimeout(t) }
  }
  throw new ApiError(last, last === -1 ? `Activesoft não respondeu em ${route}` : `Activesoft respondeu ${last} em ${route}`)
}

async function actionTest(sb: Supa, inst: string) {
  const { baseUrl, token } = await loadConn(sb, inst)
  const scopes: Record<string, unknown> = {}
  const fields: Record<string, string[]> = {}
  let scheme: string | null = null

  // forma de autenticação: a que a 1ª rota aceitar
  for (const s of ['Bearer', 'Token']) {
    try { await apiGet(baseUrl, ROUTES.unidades, { limit: 1, offset: 0 }, s, token); scheme = s; break }
    catch (e) { if (!(e instanceof ApiError) || (e.status !== 401 && e.status !== 403)) { scopes.unidades = errText(e); break } }
  }
  if (!scheme) {
    const err = scopes.unidades ? String(scopes.unidades) : 'Token recusado pelo Activesoft (401/403)'
    await sb.from('erp_connections').update({ status: 'token_invalido', scopes_ok: scopes, last_error: err, last_error_at: new Date().toISOString(),
      last_test_at: new Date().toISOString(), auth_scheme: null }).eq('institution_id', inst).eq('provider', 'activesoft')
    return { ok: false, error: err, scopes }
  }
  for (const [key, route] of Object.entries(ROUTES) as [RouteKey, string][]) {
    try {
      const params: Record<string, string | number | boolean> = { limit: 1, offset: 0 }
      if (key === 'enturmacao') params.situacao_sistema = 'A'
      const body = await apiGet(baseUrl, route, params, scheme, token)
      const page = readPage(body, 0)
      scopes[key] = true
      fields[key] = fieldNames(page.items)        // só os nomes dos campos
    } catch (e) { scopes[key] = errText(e) }
  }
  const allOk = Object.values(scopes).every(v => v === true)
  await sb.from('erp_connections').update({
    auth_scheme: scheme, scopes_ok: scopes, fields_seen: fields, last_test_at: new Date().toISOString(),
    status: 'pausada', last_error: allOk ? null : 'Algumas rotas não responderam no teste',
  }).eq('institution_id', inst).eq('provider', 'activesoft')
  return { ok: allOk, scheme, scopes, fields }
}

function errText(e: unknown) {
  if (e instanceof ForbiddenRoute) return e.message
  if (e instanceof ApiError) return e.message
  return 'falha na chamada'
}

async function actionStep(sb: Supa, inst: string, runId: string) {
  const { data: run } = await sb.from('sync_runs')
    .select('id, status, step, step_offset, counts, http_calls, pages').eq('id', runId).eq('institution_id', inst).eq('source', 'activesoft').maybeSingle()
  if (!run) throw new HttpError(404, 'Carga não encontrada')
  if (!['na_fila', 'rodando'].includes(run.status)) return progress(run, null)

  const { baseUrl, scheme, token } = await loadConn(sb, inst)
  if (!scheme) throw new HttpError(400, 'Faça o teste de conexão antes da carga')
  // nomes (aluno/responsável): aditivo LGPD registrado pelo Super Admin E caixa marcada na carga
  const { data: settings } = await sb.from('student_base_settings').select('names_allowed').eq('institution_id', inst).maybeSingle()
  const names = settings?.names_allowed === true && (run.counts as Record<string, unknown> | null)?.guardar_nomes === true
  const steps = plan(names)
  let idx = Math.max(0, steps.findIndex(s => s.key === run.step))
  let offset = run.step_offset ?? 0
  const counts: Record<string, unknown> = { ...(run.counts ?? {}) }
  let calls = run.http_calls ?? 0
  let pages = run.pages ?? 0
  const started = Date.now()
  await sb.from('sync_runs').update({ status: 'rodando', started_at: run.status === 'na_fila' ? new Date().toISOString() : undefined }).eq('id', runId)

  try {
    while (idx < steps.length && Date.now() - started < TIME_BUDGET_MS) {
      const step = steps[idx]
      const body = await apiGet(baseUrl, ROUTES[step.route], { ...step.params, limit: PAGE_SIZE, offset }, scheme, token)
      calls++; pages++
      const page = readPage(body, offset)
      const rows = []
      for (const it of page.items) {
        const n = normalize(step, it, names)
        if (!n) continue
        const ano = n.data.ano ? Number(n.data.ano) : null
        if ((step.entity === 'turma' || step.entity === 'enturmacao') && ano !== null && ano < KEEP_FROM_YEAR) continue
        rows.push({ run_id: runId, institution_id: inst, entity: step.entity, external_id: n.external_id, data: n.data })
      }
      if (rows.length) {
        const { error } = await sb.from('erp_staging').upsert(rows, { onConflict: 'run_id,entity,external_id' })
        if (error) throw new Error('Falha ao guardar a página: ' + error.message)
      }
      counts[step.key] = Number(counts[step.key] ?? 0) + rows.length
      if (page.hasMore && page.items.length > 0) offset += PAGE_SIZE
      else { idx++; offset = 0 }
      await sb.from('sync_runs').update({
        step: idx < steps.length ? steps[idx].key : 'contagem', step_offset: offset, counts, http_calls: calls, pages,
      }).eq('id', runId)
    }
  } catch (e) {
    const msg = errText(e) === 'falha na chamada' && e instanceof Error ? e.message : errText(e)
    const status = e instanceof ApiError && (e.status === 401 || e.status === 403) ? 'token_invalido' : null
    await sb.from('sync_runs').update({ status: 'erro', error: msg, finished_at: new Date().toISOString() }).eq('id', runId)
    await sb.from('erp_connections').update({ last_error: msg, last_error_at: new Date().toISOString(), ...(status ? { status } : {}) })
      .eq('institution_id', inst).eq('provider', 'activesoft')
    return { status: 'erro', error: msg }
  }

  const done = idx >= steps.length
  if (done) await sb.from('sync_runs').update({ status: 'aguardando_confirmacao', step: 'contagem', step_offset: 0 }).eq('id', runId)
  return progress({ ...run, status: done ? 'aguardando_confirmacao' : 'rodando', counts, http_calls: calls, pages },
                  { index: Math.min(idx, steps.length), total: steps.length, label: done ? 'contagem' : steps[idx].key })
}

function progress(run: Record<string, unknown>, pos: { index: number; total: number; label: string } | null) {
  return { status: run.status, counts: run.counts, http_calls: run.http_calls, pages: run.pages, position: pos }
}
