// Teste automático de segurança de api/whatsapp/embedded-signup.ts
// Rodar: npx tsx --test tests/embedded-signup.security.test.ts
//
// Usa o handler de verdade (createEmbeddedSignupHandler) com a autenticação
// simulada — sem banco, sem Meta. Cada caso de acesso negado precisa parar
// ANTES de qualquer leitura ou gravação; os de acesso permitido param na
// validação dos dados do popup (400), o que prova que passaram pela
// autorização sem tocar em nada. Roteiro manual em
// api/whatsapp/embedded-signup.SECURITY_TEST.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createEmbeddedSignupHandler } from '../api/whatsapp/embedded-signup.js'
import { resolveConnectContext, checkPopupWaba, canConnectAnySchool, type ConnectAuthDeps } from '../api/_lib/whatsappConnectAuth.js'

const ESCOLA_A = '11111111-1111-4111-8111-111111111111'
const ESCOLA_B = '22222222-2222-4222-8222-222222222222'
const ESCOLA_INEXISTENTE = '33333333-3333-4333-8333-333333333333'

// Tokens simulados → linha de `users` de quem chama (user_type/active) e, se
// for admin de escola, qual escola.
const USERS: Record<string, { user_type: string; active?: boolean; schoolAdminOf?: string }> = {
  'tok-superadmin':        { user_type: 'admin_geral' },
  'tok-superadmin-inativo': { user_type: 'admin_geral', active: false },
  'tok-consultor':         { user_type: 'consultant' }, // Super Admin do painel, mas NÃO conecta WhatsApp
  'tok-admin-a':           { user_type: 'school_user', schoolAdminOf: ESCOLA_A },
  'tok-admin-b':           { user_type: 'school_user', schoolAdminOf: ESCOLA_B },
  'tok-atendente-a':       { user_type: 'school_user' }, // usuário ativo da escola A, role 'user' → não é admin
}

const tokenOf = (req: VercelRequest) => String(req.headers.authorization || '').replace(/^Bearer /, '')

const deps: ConnectAuthDeps = {
  // Mesma decisão do servidor (canConnectAnySchool) sobre a linha simulada
  authenticateAdminGeral: async req => (canConnectAnySchool(USERS[tokenOf(req)] ?? null) ? { userId: 'u-super' } : null),
  authenticateSchoolAdmin: async req => {
    const inst = USERS[tokenOf(req)]?.schoolAdminOf
    return inst ? { userId: `u-${tokenOf(req)}`, institutionId: inst } : null
  },
  institutionExists: async id => id === ESCOLA_A || id === ESCOLA_B,
}

function fakeReq(token: string | null, body: Record<string, unknown>): VercelRequest {
  return {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body,
  } as unknown as VercelRequest
}

async function call(token: string | null, body: Record<string, unknown>) {
  let status = 0
  let payload: any = null
  const res = {
    status(s: number) { status = s; return this },
    json(p: unknown) { payload = p; return this },
    end() { return this },
  } as unknown as VercelResponse
  await createEmbeddedSignupHandler(deps)(fakeReq(token, body), res)
  return { status, payload }
}

// Corpo sem code: se a autorização passar, o handler para em 400 (dados
// incompletos) antes de qualquer banco/Meta.
const SEM_CODE = { phone_number_id: '123', waba_id: '456' }

test('sem login → 403', async () => {
  assert.equal((await call(null, SEM_CODE)).status, 403)
})

test('token inválido → 403', async () => {
  assert.equal((await call('tok-invalido', SEM_CODE)).status, 403)
})

test('atendente (não admin) não conecta a própria escola → 403', async () => {
  assert.equal((await call('tok-atendente-a', SEM_CODE)).status, 403)
})

test('atendente não conecta escolhendo escola → 403', async () => {
  assert.equal((await call('tok-atendente-a', { ...SEM_CODE, institution_id: ESCOLA_A })).status, 403)
})

test('admin da escola A conecta a própria escola (sem institution_id) → passa', async () => {
  const r = await call('tok-admin-a', SEM_CODE)
  assert.equal(r.status, 400)
  assert.match(r.payload.error, /obrigatórios/)
})

test('admin da escola A NÃO conecta a escola B via body → 403', async () => {
  assert.equal((await call('tok-admin-a', { ...SEM_CODE, institution_id: ESCOLA_B })).status, 403)
})

test('admin da escola A NÃO dispara evento de reconexão na escola B → 403', async () => {
  assert.equal((await call('tok-admin-a', { event: 'reconnect_click', institution_id: ESCOLA_B })).status, 403)
})

test('admin da escola A NÃO reconecta a escola B → 403', async () => {
  assert.equal((await call('tok-admin-a', { mode: 'reconnect', code: 'x', phone_number_id: '1', waba_id: '2', institution_id: ESCOLA_B })).status, 403)
})

test('superadmin conecta a escola A → passa', async () => {
  const r = await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_A })
  assert.equal(r.status, 400)
  assert.match(r.payload.error, /obrigatórios/)
})

test('superadmin conecta a escola B → passa', async () => {
  const r = await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_B })
  assert.equal(r.status, 400)
})

test('superadmin com escola inexistente ou id inválido → 404', async () => {
  assert.equal((await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_INEXISTENTE })).status, 404)
  assert.equal((await call('tok-superadmin', { ...SEM_CODE, institution_id: "x' or 1=1" })).status, 404)
})

test('consultor NÃO conecta nenhuma escola (conexão, reconexão, evento) → 403', async () => {
  assert.equal((await call('tok-consultor', { ...SEM_CODE, institution_id: ESCOLA_A })).status, 403)
  assert.equal((await call('tok-consultor', { mode: 'reconnect', code: 'x', phone_number_id: '1', waba_id: '2', institution_id: ESCOLA_B })).status, 403)
  assert.equal((await call('tok-consultor', { event: 'connect_click', institution_id: ESCOLA_A })).status, 403)
  assert.equal((await call('tok-consultor', SEM_CODE)).status, 403)
})

test('superadmin inativo → 403', async () => {
  assert.equal((await call('tok-superadmin-inativo', { ...SEM_CODE, institution_id: ESCOLA_A })).status, 403)
})

test('regra do servidor: só admin_geral ativo conecta qualquer escola', () => {
  assert.equal(canConnectAnySchool({ user_type: 'admin_geral', active: true }), true)
  assert.equal(canConnectAnySchool({ user_type: 'admin_geral', active: null }), true)
  assert.equal(canConnectAnySchool({ user_type: 'admin_geral', active: false }), false)
  assert.equal(canConnectAnySchool({ user_type: 'consultant', active: true }), false)
  assert.equal(canConnectAnySchool({ user_type: 'school_user', active: true }), false)
  assert.equal(canConnectAnySchool(null), false)
})

test('superadmin sem escola no body não ganha escola nenhuma → 403', async () => {
  assert.equal((await call('tok-superadmin', SEM_CODE)).status, 403)
})

test('a escola resolvida é a do token / a escolhida pelo superadmin', async () => {
  const a = await resolveConnectContext(fakeReq('tok-admin-a', {}), deps)
  assert.deepEqual(a, { ok: true, ctx: { userId: 'u-tok-admin-a', institutionId: ESCOLA_A, actor: 'school_admin' } })
  const s = await resolveConnectContext(fakeReq('tok-superadmin', { institution_id: ESCOLA_B }), deps)
  assert.deepEqual(s, { ok: true, ctx: { userId: 'u-super', institutionId: ESCOLA_B, actor: 'superadmin' } })
})

test('WABA: nunca troca a conta salva nem aceita a de teste da plataforma', () => {
  const PLAT = '2812701862456294'
  assert.equal(checkPopupWaba('', null, PLAT).ok, false)
  assert.equal(checkPopupWaba(PLAT, null, PLAT).ok, false)
  assert.equal(checkPopupWaba(PLAT, '2226058870759667', PLAT).ok, false)
  assert.equal(checkPopupWaba('999', '2226058870759667', PLAT).ok, false)
  assert.equal(checkPopupWaba('2226058870759667', '2226058870759667', PLAT).ok, true)
  assert.equal(checkPopupWaba('2226058870759667', null, PLAT).ok, true)
})
