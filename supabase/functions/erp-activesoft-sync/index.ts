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
import { PAGE_SIZE, ROUTES, ForbiddenRoute, routeUrl, readPage, fieldNames, plan, normalize, apiMessage, pickScheme, unidadeFromTurma, vinculosFromAluno, OPTIONAL_STEPS, type RouteKey, type Probe } from './adapter.ts'

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

class ApiError extends Error { constructor(public status: number, message: string, public detail = '') { super(message) } }

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
      if (!res.ok) {
        const detail = apiMessage(res.status, await res.text().catch(() => ''))
        throw new ApiError(res.status, `Activesoft respondeu ${res.status} em ${route}: ${detail}`, detail)
      }
      return await res.json()
    } catch (e) {
      if (e instanceof ApiError) throw e
      last = -1
    } finally { clearTimeout(t) }
  }
  throw new ApiError(last, last === -1 ? `Activesoft não respondeu em ${route}` : `Activesoft respondeu ${last} em ${route}`)
}

// Uma chamada (sem repetir) para o teste: devolve status e mensagem curta.
async function probe(baseUrl: string, key: RouteKey, scheme: string, token: string): Promise<Probe> {
  const params: Record<string, string | number | boolean> = { limit: 1, offset: 0 }
  if (key === 'enturmacao') params.situacao_sistema = 'A'
  let url: string
  try { url = routeUrl(baseUrl, ROUTES[key], params) } catch (e) { return { ok: false, status: 0, msg: errText(e) } }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15_000)
  try {
    const res = await fetch(url, { method: 'GET', headers: { Authorization: `${scheme} ${token}`, Accept: 'application/json' }, signal: ctrl.signal })
    const text = await res.text().catch(() => '')
    if (!res.ok) return { ok: false, status: res.status, msg: apiMessage(res.status, text) }
    let body: unknown = null
    try { body = JSON.parse(text) } catch { return { ok: false, status: res.status, msg: 'resposta não é JSON' } }
    return { ok: true, status: res.status, msg: 'ok', fields: fieldNames(readPage(body, 0).items) }   // só os nomes dos campos
  } catch {
    return { ok: false, status: 0, msg: apiMessage(0, '') }
  } finally { clearTimeout(t) }
}

// Teste: as 6 rotas com Bearer e com Token (em paralelo, 1 tentativa cada).
// Guarda por rota { ok, status, msg }, a autenticação aceita e só os NOMES dos
// campos. Nada de dados, nada de token.
async function actionTest(sb: Supa, inst: string) {
  const { baseUrl, token } = await loadConn(sb, inst)
  const keys = Object.keys(ROUTES) as RouteKey[]
  const results: Record<string, Record<string, Probe>> = {}
  for (const scheme of ['Bearer', 'Token']) {
    const probes = await Promise.all(keys.map(k => probe(baseUrl, k, scheme, token)))
    results[scheme] = Object.fromEntries(keys.map((k, i) => [k, probes[i]]))
    if (probes.every(p => p.ok)) break                    // Bearer passou em tudo: nem tenta Token
  }
  const pick = pickScheme(results)
  const scopes: Record<string, unknown> = {}
  const fields: Record<string, string[]> = {}
  for (const [k, p] of Object.entries(pick.routes)) {
    scopes[k] = { ok: p.ok, status: p.status, msg: p.msg }
    if (p.ok && p.fields) fields[k] = p.fields
  }
  scopes._auth = { aceita: pick.scheme, mostrada: pick.shown, tentativas: pick.tried, endereco: baseUrl }
  const now = new Date().toISOString()
  const failed = Object.entries(pick.routes).filter(([, p]) => !p.ok)
  const onlyOptional = pick.okCount > 0 && failed.every(([k, p]) => OPTIONAL_STEPS.has(k) && p.status === 403)
  const err = pick.allOk || onlyOptional ? null
    : pick.okCount === 0 ? `Nenhuma rota respondeu (${pick.shown}): ${Object.values(pick.routes)[0]?.msg ?? 'sem resposta'}`
    : `${pick.total - pick.okCount} de ${pick.total} rotas falharam no teste`
  await sb.from('erp_connections').update({
    auth_scheme: pick.scheme, scopes_ok: scopes, fields_seen: fields, last_test_at: now,
    status: pick.okCount === 0 ? 'token_invalido' : 'pausada',
    last_error: err, last_error_at: err ? now : null,
  }).eq('institution_id', inst).eq('provider', 'activesoft')
  return { ok: pick.allOk || onlyOptional, any_ok: pick.okCount > 0, scheme: pick.scheme, shown: pick.shown, base_url: baseUrl, scopes, fields, error: err }
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

  // Só o que interessa à base (menos dados pessoais): enturmações de turmas que
  // ficaram (ano anterior em diante) e alunos que aparecem nessas enturmações.
  let turmaIds: Set<string> | null = null
  let alunoIds: Set<string> | null = null

  try {
    while (idx < steps.length && Date.now() - started < TIME_BUDGET_MS) {
      const step = steps[idx]
      let body: unknown
      try {
        body = await apiGet(baseUrl, ROUTES[step.route], { ...step.params, limit: PAGE_SIZE, offset }, scheme, token)
      } catch (e) {
        // rota opcional fora do token (403): segue sem ela e registra
        if (e instanceof ApiError && e.status === 403 && OPTIONAL_STEPS.has(step.key)) {
          counts[`${step.key}_sem_permissao`] = true
          idx++; offset = 0
          await sb.from('sync_runs').update({ step: idx < steps.length ? steps[idx].key : 'contagem', step_offset: 0, counts }).eq('id', runId)
          continue
        }
        throw e
      }
      calls++; pages++
      const page = readPage(body, offset)
      if (step.entity === 'enturmacao' && !turmaIds) turmaIds = await stagedIds(sb, runId, 'turma', null)
      if (step.entity === 'aluno' && !alunoIds) alunoIds = await stagedIds(sb, runId, 'enturmacao', 'aluno_id')
      const byKey = new Map<string, { run_id: string; institution_id: string; entity: string; external_id: string; data: Record<string, string> }>()
      for (const it of page.items) {
        const n = normalize(step, it, names)
        if (!n) continue
        const ano = n.data.ano ? Number(n.data.ano) : null
        if ((step.entity === 'turma' || step.entity === 'enturmacao') && ano !== null && ano < KEEP_FROM_YEAR) continue
        if (step.entity === 'enturmacao' && turmaIds && turmaIds.size > 0 && n.data.turma_id && !turmaIds.has(n.data.turma_id)) continue
        if (step.entity === 'aluno' && alunoIds && !alunoIds.has(n.external_id)) continue
        byKey.set(step.entity + '|' + n.external_id, { run_id: runId, institution_id: inst, entity: step.entity, external_id: n.external_id, data: n.data })
        if (step.entity === 'aluno' && names) {
          for (const v of vinculosFromAluno(n)) byKey.set('vinculo|' + v.external_id, { run_id: runId, institution_id: inst, entity: 'vinculo', external_id: v.external_id, data: v.data })
        }
        if (step.entity === 'turma') {
          const u = unidadeFromTurma(n)
          if (u) byKey.set('unidade|' + u.external_id, { run_id: runId, institution_id: inst, entity: 'unidade', external_id: u.external_id, data: u.data })
        }
      }
      const rows = [...byKey.values()]
      if (rows.length) {
        const { error } = await sb.from('erp_staging').upsert(rows, { onConflict: 'run_id,entity,external_id' })
        if (error) throw new Error('Falha ao guardar a página: ' + error.message)
      }
      counts[step.key] = Number(counts[step.key] ?? 0) + rows.filter(r => r.entity === step.entity).length
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
  if (done) {
    Object.assign(counts, await familyCounts(sb, runId, names))
    await sb.from('sync_runs').update({ status: 'aguardando_confirmacao', step: 'contagem', step_offset: 0, counts }).eq('id', runId)
  }
  return progress({ ...run, status: done ? 'aguardando_confirmacao' : 'rodando', counts, http_calls: calls, pages },
                  { index: Math.min(idx, steps.length), total: steps.length, label: done ? 'contagem' : steps[idx].key })
}

// Famílias: aluno com responsável ligado = algum id de responsável do aluno
// (lista_alunos) existe em lista_responsaveis. Sem nomes liberados os
// responsáveis não são lidos e a contagem diz isso.
async function familyCounts(sb: Supa, runId: string, names: boolean) {
  const alunos = await stagedIds(sb, runId, 'aluno', null)
  if (!names) return { responsaveis_lidos: false, alunos_lidos: alunos.size }
  const resp = await stagedIds(sb, runId, 'responsavel', null)
  const linked = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('erp_staging').select('data').eq('run_id', runId).eq('entity', 'vinculo').range(from, from + 999)
    if (error) throw new Error('Falha ao ler a área de espera: ' + error.message)
    for (const r of (data ?? []) as { data: Record<string, string> }[]) {
      if (resp.has(r.data?.responsavel_id)) linked.add(r.data.aluno_id)
    }
    if (!data || data.length < 1000) break
  }
  const com = [...alunos].filter(a => linked.has(a)).length
  return { responsaveis_lidos: true, alunos_lidos: alunos.size, alunos_com_responsavel: com, alunos_sem_responsavel: alunos.size - com }
}

// ids já guardados na área de espera desta carga (turmas, ou alunos das enturmações)
async function stagedIds(sb: Supa, runId: string, entity: string, field: string | null): Promise<Set<string>> {
  const out = new Set<string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('erp_staging').select('external_id, data').eq('run_id', runId).eq('entity', entity).range(from, from + 999)
    if (error) throw new Error('Falha ao ler a área de espera: ' + error.message)
    for (const r of (data ?? []) as { external_id: string; data: Record<string, string> }[]) {
      const v = field ? r.data?.[field] : r.external_id
      if (v) out.add(v)
    }
    if (!data || data.length < 1000) break
  }
  return out
}

function progress(run: Record<string, unknown>, pos: { index: number; total: number; label: string } | null) {
  return { status: run.status, counts: run.counts, http_calls: run.http_calls, pages: run.pages, position: pos }
}
