// Teste automático de segurança de api/whatsapp/embedded-signup.ts
// Rodar: npx tsx --test tests/embedded-signup.security.test.ts
//
// Usa o handler de verdade (createEmbeddedSignupHandler) com a autenticação,
// o banco e a Meta simulados (em memória). Cada caso de acesso negado precisa
// parar ANTES de qualquer leitura ou gravação. Admin da escola sem code para
// em 400; Super Admin sem code segue até a Meta simulada (grava ou recusa).
// Roteiro manual em api/whatsapp/embedded-signup.SECURITY_TEST.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createEmbeddedSignupHandler } from '../api/whatsapp/embedded-signup.js'
import { resolveConnectContext, checkPopupWaba, canConnectAnySchool, TEST_WABA_ID, type ConnectAuthDeps } from '../api/_lib/whatsappConnectAuth.js'
import type { ConnectDeps, PhoneRow } from '../api/_lib/whatsappConnect.js'

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

// ── Meta e banco simulados ──
// Portfólio da Áion: WABA_OK (compartilhada pela escola) com o número PHONE_OK.
const WABA_OK = '700000000000001'
const PHONE_OK = '800000000000001'
const WABA_OUTRA = '700000000000099'      // de outro portfólio
const PHONE_DA_OUTRA = '800000000000099'
const PLAT_WABA = '2812701862456294'
const META_WABAS: Record<string, { aion: boolean; phones: string[] }> = {
  [WABA_OK]: { aion: true, phones: [PHONE_OK] },
  [WABA_OUTRA]: { aion: false, phones: [PHONE_DA_OUTRA] },
  [PLAT_WABA]: { aion: true, phones: ['800000000000777'] },
}
const db = {
  saved: new Map<string, { id: string; waba_id: string; phone_number_id: string }>(), rows: [] as PhoneRow[],
  audits: [] as { action: string; fieldChanged?: string | null; newValue?: string | null }[], metaCalls: [] as string[],
}
const resetDb = () => { db.saved.clear(); db.rows = []; db.audits = []; db.metaCalls = [] }
const connectDeps: ConnectDeps = {
  loadSaved: async inst => db.saved.get(inst) ?? null,
  platformWabaId: async () => PLAT_WABA,
  platformToken: async () => 'tok-plataforma',
  exchangeCode: async code => { db.metaCalls.push('oauth'); return code === 'code-bom' ? { token: 'tok-empresa' } : { erro: 'code inválido' } },
  wabaInAionPortfolio: async waba => { db.metaCalls.push('portfolio'); return { ok: !!META_WABAS[waba]?.aion, via: 'compartilhada' } },
  wabaHasPhone: async (waba, phone) => { db.metaCalls.push('phone_numbers'); return { ok: !!META_WABAS[waba]?.phones.includes(phone) } },
  readPhone: async () => { db.metaCalls.push('read'); return { ok: true, display_phone_number: '+55 84 3000-0000', verified_name: 'Escola' } },
  subscribe: async () => { db.metaCalls.push('subscribed_apps'); return true },
  metaState: async () => ({ status: 'CONNECTED', platform_type: 'CLOUD_API', is_on_biz_app: true }),
  smbSync: async () => {
    db.metaCalls.push('smb_app_data')
    return [{ sync_type: 'smb_app_state_sync', ok: true, request_id: 'r1', erro: null }, { sync_type: 'history', ok: true, request_id: 'r2', erro: null }]
  },
  save: async row => { db.rows.push(row); return null },
  audit: async a => { db.audits.push(a) },
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
  await createEmbeddedSignupHandler(deps, connectDeps)(fakeReq(token, body), res)
  return { status, payload }
}

// Corpo sem code: admin da escola para em 400 (dados incompletos) antes de
// qualquer banco/Meta; Super Admin segue para a Meta simulada.
const SEM_CODE = { phone_number_id: PHONE_OK, waba_id: WABA_OK }

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

test('admin da escola A conecta a própria escola (sem institution_id) → passa, mas sem code para em 400', async () => {
  resetDb()
  const r = await call('tok-admin-a', SEM_CODE)
  assert.equal(r.status, 400)
  assert.match(r.payload.error, /obrigatórios/)
  assert.equal(db.metaCalls.length, 0)
  assert.equal(db.rows.length, 0)
})

test('admin da escola A com code válido grava; code recusado não grava', async () => {
  resetDb()
  const ok = await call('tok-admin-a', { ...SEM_CODE, code: 'code-bom' })
  assert.equal(ok.status, 200)
  assert.equal(db.rows[0].institution_id, ESCOLA_A)
  assert.equal(db.rows[0].access_token, 'tok-empresa')
  resetDb()
  const bad = await call('tok-admin-a', { ...SEM_CODE, code: 'code-ruim' })
  assert.equal(bad.status, 400)
  assert.equal(db.rows.length, 0)
  assert.equal(db.audits[0].fieldChanged, 'code_recusado')
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

test('superadmin SEM code mas com ids válidos grava (escola A)', async () => {
  resetDb()
  const r = await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_A })
  assert.equal(r.status, 200)
  assert.equal(r.payload.sem_code, true)
  assert.equal(db.rows.length, 1)
  assert.deepEqual({ ...db.rows[0] }, {
    institution_id: ESCOLA_A, phone_number_id: PHONE_OK, phone_number: '+55 84 3000-0000', display_name: 'Escola',
    waba_id: WABA_OK, is_active: true, use_meta_api: true, access_token: null, connection_method: 'embedded_signup', token_expires_at: null,
  })
  // não troca code, não chama /register; inscreve webhook e pede histórico
  assert.ok(!db.metaCalls.includes('oauth'))
  assert.ok(db.metaCalls.includes('subscribed_apps') && db.metaCalls.includes('smb_app_data'))
  assert.ok(!db.metaCalls.some(c => /register/.test(c)))
  const fim = db.audits.at(-1)!
  assert.equal(fim.action, 'Conexão WhatsApp (Meta): concluída')
  assert.match(String(fim.newValue), /"sem_code":true/)
})

test('superadmin conecta a escola B → passa', async () => {
  resetDb()
  const r = await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_B })
  assert.equal(r.status, 200)
  assert.equal(db.rows[0].institution_id, ESCOLA_B)
})

test('WABA de outro portfólio é recusada, sem gravar, e auditada', async () => {
  resetDb()
  const r = await call('tok-superadmin', { phone_number_id: PHONE_DA_OUTRA, waba_id: WABA_OUTRA, institution_id: ESCOLA_A })
  assert.equal(r.status, 409)
  assert.equal(r.payload.motivo, 'waba_de_outro_portfolio')
  assert.equal(db.rows.length, 0)
  assert.ok(!db.metaCalls.includes('subscribed_apps'))
  assert.equal(db.audits[0].action, 'Conexão WhatsApp (Meta): recusada')
  assert.equal(db.audits[0].fieldChanged, 'waba_de_outro_portfolio')
})

test('WABA de teste da plataforma é recusada antes de chamar a Meta', async () => {
  resetDb()
  const r = await call('tok-superadmin', { phone_number_id: '800000000000777', waba_id: TEST_WABA_ID, institution_id: ESCOLA_A })
  assert.equal(r.status, 409)
  assert.equal(r.payload.motivo, 'waba_da_plataforma')
  assert.equal(db.metaCalls.length, 0)
  assert.equal(db.rows.length, 0)
})

test('WABA diferente da já salva é recusada (nunca troca a conta)', async () => {
  resetDb()
  db.saved.set(ESCOLA_A, { id: 'p1', waba_id: '700000000000555', phone_number_id: '800000000000555' })
  const r = await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_A })
  assert.equal(r.status, 409)
  assert.equal(r.payload.motivo, 'waba_diferente')
  assert.equal(db.rows.length, 0)
})

test('número que não é da WABA é recusado', async () => {
  resetDb()
  const r = await call('tok-superadmin', { phone_number_id: PHONE_DA_OUTRA, waba_id: WABA_OK, institution_id: ESCOLA_A })
  assert.equal(r.status, 409)
  assert.equal(r.payload.motivo, 'numero_fora_da_waba')
  assert.equal(db.rows.length, 0)
})

test('superadmin sem ids → 400 sem tocar em nada', async () => {
  resetDb()
  const r = await call('tok-superadmin', { institution_id: ESCOLA_A })
  assert.equal(r.status, 400)
  assert.equal(db.metaCalls.length + db.rows.length + db.audits.length, 0)
})

test('superadmin com escola inexistente ou id inválido → 404', async () => {
  assert.equal((await call('tok-superadmin', { ...SEM_CODE, institution_id: ESCOLA_INEXISTENTE })).status, 404)
  assert.equal((await call('tok-superadmin', { ...SEM_CODE, institution_id: "x' or 1=1" })).status, 404)
})

test('consultor NÃO conecta nenhuma escola (conexão, reconexão, evento) → 403', async () => {
  resetDb()
  assert.equal((await call('tok-consultor', { ...SEM_CODE, institution_id: ESCOLA_A })).status, 403)
  assert.equal((await call('tok-consultor', { mode: 'reconnect', code: 'x', phone_number_id: '1', waba_id: '2', institution_id: ESCOLA_B })).status, 403)
  assert.equal((await call('tok-consultor', { event: 'connect_click', institution_id: ESCOLA_A })).status, 403)
  assert.equal((await call('tok-consultor', SEM_CODE)).status, 403)
  assert.equal((await call('tok-consultor', { event: 'connect_precheck', institution_id: ESCOLA_A })).status, 403)
  assert.equal(db.metaCalls.length + db.rows.length + db.audits.length, 0)
})

test('atendente NÃO conclui sem code nem dispara verificação → 403', async () => {
  resetDb()
  assert.equal((await call('tok-atendente-a', { ...SEM_CODE, institution_id: ESCOLA_A })).status, 403)
  assert.equal((await call('tok-atendente-a', { event: 'reconnect_precheck' })).status, 403)
  assert.equal(db.metaCalls.length + db.rows.length + db.audits.length, 0)
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
  // a de teste fica recusada mesmo se platform_settings vier vazio
  assert.equal(checkPopupWaba(TEST_WABA_ID, null, null).ok, false)
})

test('detalhes da Meta no audit: só os campos da lista, nada de token', async () => {
  const { metaDetail } = await import('../api/_lib/whatsappReconnect.js')
  const d = metaDetail({ event: 'ERROR', error_code: 2593025, error_message: 'x'.repeat(900), session_id: 's1', current_step: 'PHONE',
                         business_id: '1009021325175669', access_token: 'segredo', code: 'segredo' })
  assert.deepEqual(Object.keys(d!).sort(), ['business_id', 'current_step', 'error_code', 'error_message', 'event', 'session_id'])
  assert.equal(d!.error_message.length, 500)
  assert.equal(metaDetail(null), null)
  assert.equal(metaDetail({ access_token: 'segredo' }), null)
})
