// Ensaio da migration 20261022100000_central_notificacoes.sql SEM produção:
// Postgres em memória (PGlite) com uma réplica mínima das tabelas e das
// funções de papel de produção (is_super_admin_user, user_school_role_in,
// user_is_school_member — mesmas definições das migrations 20260720000200 e
// 20261013110000). A migration roda inteira, e cada teste confere uma regra.
// Rodar: npx tsx --test tests/central-notificacoes.sql.test.ts
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION = readFileSync(new URL('../supabase/migrations/20261022100000_central_notificacoes.sql', import.meta.url), 'utf8')
const REVERT = readFileSync(new URL('../supabase/pendentes/central_notificacoes_reverter.sql', import.meta.url), 'utf8')

const ESC_A = '11111111-1111-4111-8111-111111111111'
const ESC_B = '22222222-2222-4222-8222-222222222222'
const ESC_POUCO = '33333333-3333-4333-8333-333333333333'   // sem volume de mensagens
const U = {
  super:     'a0000000-0000-4000-8000-000000000001',
  adminA:    'a0000000-0000-4000-8000-000000000002',
  gestorA:   'a0000000-0000-4000-8000-000000000003',
  atendA:    'a0000000-0000-4000-8000-000000000004',
  adminB:    'a0000000-0000-4000-8000-000000000005',
  consultor: 'a0000000-0000-4000-8000-000000000006',
}
const PHONE_A = '900000000000001'
const PHONE_B = '900000000000002'

// Réplica mínima do que a migration usa em produção
const STUB = `
CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, anon, service_role;

CREATE TABLE institutions (id uuid PRIMARY KEY, name text);
CREATE TABLE users (id uuid PRIMARY KEY, role text, user_type text, institution_id uuid, active_institution_id uuid, active boolean DEFAULT true);
CREATE TABLE platform_settings (key text PRIMARY KEY, value text);
CREATE TABLE whatsapp_phone_numbers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid, phone_number_id text,
  phone_number text, waba_id text, is_active boolean DEFAULT true, use_meta_api boolean DEFAULT true);
CREATE TABLE whatsapp_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid, remote_jid text,
  direction text, message_type text DEFAULT 'text', is_bot_message boolean DEFAULT false, is_history_sync boolean DEFAULT false,
  is_aion_inbox boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE whatsapp_flows (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), institution_id uuid, working_days text[],
  working_start time, working_end time, timezone text, updated_at timestamptz DEFAULT now());

CREATE FUNCTION is_super_admin_user() RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral' LIMIT 1) $$;
CREATE FUNCTION user_school_role_in(p_institution_id uuid, p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND COALESCE(u.active, true)
     AND p_institution_id IN (u.institution_id, u.active_institution_id) AND u.role = ANY (p_roles)) $$;
CREATE FUNCTION user_is_school_member(p_institution_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND p_institution_id IN (u.institution_id, u.active_institution_id)) $$;
CREATE PUBLICATION supabase_realtime;

INSERT INTO institutions VALUES ('${ESC_A}', 'Escola A'), ('${ESC_B}', 'Escola B'), ('${ESC_POUCO}', 'Escola Pouco');
INSERT INTO users (id, role, user_type, institution_id) VALUES
  ('${U.super}', 'admin', 'admin_geral', NULL),
  ('${U.adminA}', 'admin', 'school_user', '${ESC_A}'),
  ('${U.gestorA}', 'manager', 'school_user', '${ESC_A}'),
  ('${U.atendA}', 'user', 'school_user', '${ESC_A}'),
  ('${U.adminB}', 'admin', 'school_user', '${ESC_B}'),
  ('${U.consultor}', 'admin', 'consultant', NULL);
INSERT INTO whatsapp_phone_numbers (institution_id, phone_number_id, phone_number, waba_id) VALUES
  ('${ESC_A}', '${PHONE_A}', '+55 83 3000-0001', 'W1'), ('${ESC_B}', '${PHONE_B}', '+55 83 3000-0002', 'W2'),
  ('${ESC_POUCO}', '900000000000003', '+55 83 3000-0003', 'W3');
INSERT INTO whatsapp_flows (institution_id, working_days, working_start, working_end, timezone) VALUES
  ('${ESC_A}', ARRAY['MON','TUE','WED','THU','FRI'], '07:00', '18:00', 'America/Fortaleza'),
  ('${ESC_B}', ARRAY['MON','TUE','WED','THU','FRI'], '07:00', '18:00', 'America/Fortaleza');
`

let db: PGlite

// Roda como a pessoa (RLS de verdade: papel authenticated + auth.uid()).
async function as<T = Record<string, unknown>>(user: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false);`)
  await db.exec(user ? 'SET ROLE authenticated' : 'SET ROLE service_role')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`)
  }
}
// Sem parâmetros aceita vários comandos (exec); com parâmetros, um comando só.
const sys = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
  params.length ? (await db.query<T>(sql, params)).rows : ((await db.exec(sql)).at(-1)?.rows ?? []) as T[]
const count = async (where = 'true') =>
  Number((await sys<{ n: number }>(`SELECT count(*)::int AS n FROM notification_alerts WHERE ${where}`))[0].n)

before(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(MIGRATION)
})

test('migration aplica e cria tabelas, funções e o índice', async () => {
  const t = await sys<{ t: string }>(`SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public'
     AND tablename IN ('notification_alerts','whatsapp_connection_events','whatsapp_phone_health') ORDER BY 1`)
  assert.deepEqual(t.map(r => r.t), ['notification_alerts', 'whatsapp_connection_events', 'whatsapp_phone_health'])
  const i = await sys(`SELECT 1 FROM pg_indexes WHERE indexname = 'idx_whatsapp_messages_inst_created'`)
  assert.equal(i.length, 1)
})

test('queda: avisa Super Admin e gestor, sem repetir enquanto durar; resolve ao reconectar', async () => {
  await sys('DELETE FROM notification_alerts')
  const t0 = '2026-10-21 13:00:00+00'
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record($1, 'CONNECTED', 'CLOUD_API', true, NULL, $2) AS r`, [PHONE_A, t0]))[0].r, 'conectado')
  assert.equal(await count(), 0)
  // cai: 2 avisos (superadmin + gestor)
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record($1, 'DISCONNECTED', 'CLOUD_API', true, NULL, $2) AS r`,
    [PHONE_A, '2026-10-21 13:10:00+00']))[0].r, 'desconectado')
  assert.equal(await count(), 2)
  // continua caído nas próximas conferências: não repete
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, '2026-10-21 13:20:00+00')`, [PHONE_A])
  await sys(`SELECT whatsapp_health_record($1, 'FLAGGED', NULL, NULL, NULL, '2026-10-21 13:30:00+00')`, [PHONE_A])
  assert.equal(await count(), 2)
  const h = (await sys<{ down_since: Date }>(`SELECT down_since FROM whatsapp_phone_health WHERE phone_number_id = $1`, [PHONE_A]))[0]
  assert.equal(new Date(h.down_since).toISOString(), '2026-10-21T13:10:00.000Z')   // desde a 1ª queda
  // a Meta não respondeu: não é queda nem volta
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record($1, NULL, NULL, NULL, 'timeout', now()) AS r`, [PHONE_A]))[0].r, 'nao_conferido')
  assert.equal(await count('resolved_at IS NULL'), 2)
  // voltou: resolve os dois
  await sys(`SELECT whatsapp_health_record($1, 'CONNECTED', 'CLOUD_API', true, NULL, '2026-10-21 14:00:00+00')`, [PHONE_A])
  assert.equal(await count('resolved_at IS NULL'), 0)
  assert.equal(await count(`resolved_reason = 'reconectou'`), 2)
  // nova queda depois de resolvida: avisa de novo
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, '2026-10-21 15:00:00+00')`, [PHONE_A])
  assert.equal(await count('resolved_at IS NULL'), 2)
  assert.equal(await count(), 4)
  // eventos gravados (uma linha por conferência)
  const ev = await sys<{ n: number }>(`SELECT count(*)::int AS n FROM whatsapp_connection_events WHERE phone_number_id = $1`, [PHONE_A])
  assert.equal(Number(ev[0].n), 7)
  // número que não é de escola nenhuma: ignorado
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record('000', 'DISCONNECTED') AS r`))[0].r, 'numero_desconhecido')
})

test('RLS: Super Admin vê tudo; gestor só a própria escola; atendente não vê conexão; outra escola não vê', async () => {
  await sys('DELETE FROM notification_alerts')
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, now())`, [PHONE_A])
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, now())`, [PHONE_B])
  // aviso de equipe que não é de conexão (ex.: consumo) na escola A
  await sys(`SELECT notif.emit_alert($1, 'equipe', 'aviso', 'consumo', 'Aviso geral A')`, [ESC_A])
  const sel = 'SELECT institution_id::text AS inst, recipient_role AS role, category FROM notification_alerts ORDER BY 1, 2'
  assert.equal((await as(U.super, sel)).length, 5)
  const adminA = await as<{ inst: string; role: string }>(U.adminA, sel)
  assert.deepEqual(adminA.map(r => `${r.inst === ESC_A ? 'A' : 'B'}:${r.role}`), ['A:equipe', 'A:gestor'])
  assert.deepEqual((await as<{ role: string }>(U.gestorA, sel)).map(r => r.role), ['equipe', 'gestor'])
  const atend = await as<{ category: string }>(U.atendA, sel)
  assert.deepEqual(atend.map(r => r.category), ['consumo'])          // não vê os de conexão
  assert.deepEqual((await as<{ inst: string }>(U.adminB, sel)).map(r => r.inst === ESC_B), [true])  // só o gestor da B
  assert.equal((await as(U.consultor, sel)).length, 0)                 // consultor não é Super Admin
  assert.equal((await as(null, sel)).length, 5)                        // servidor (service role, sem RLS de pessoa)
  // ninguém grava direto
  await assert.rejects(as(U.adminA, `INSERT INTO notification_alerts (recipient_role, type, title) VALUES ('gestor','x','x')`))
  const upd = await as(U.adminA, `UPDATE notification_alerts SET resolved_at = now() RETURNING id`)
  assert.equal(upd.length, 0)                                          // sem política de UPDATE: nada muda
  // funções do servidor fechadas para quem está logado
  await assert.rejects(as(U.adminA, `SELECT whatsapp_health_record($1, 'CONNECTED')`, [PHONE_A]))
  await assert.rejects(as(U.adminA, `SELECT whatsapp_silence_check()`))
  await assert.rejects(as(U.adminA, `SELECT notif.emit_alert($1, 'gestor', 'x', 'geral', 'x')`, [ESC_A]))
})

test('marcar como lida: só o que a pessoa vê', async () => {
  // atendente tenta marcar tudo: só o de consumo (o único que vê)
  assert.equal(Number((await as<{ n: number }>(U.atendA, 'SELECT notification_alerts_mark_read(NULL) AS n'))[0].n), 1)
  // admin da B tenta marcar os da A pelo id: nada
  const idsA = (await sys<{ id: string }>(`SELECT id FROM notification_alerts WHERE institution_id = $1 AND recipient_role = 'gestor'`, [ESC_A])).map(r => r.id)
  assert.equal(Number((await as<{ n: number }>(U.adminB, 'SELECT notification_alerts_mark_read($1::uuid[]) AS n', [idsA]))[0].n), 0)
  assert.equal(Number((await as<{ n: number }>(U.adminA, 'SELECT notification_alerts_mark_read($1::uuid[]) AS n', [idsA]))[0].n), 1)
  // o do Super Admin continua não lido
  assert.equal(await count(`recipient_role = 'superadmin' AND read_at IS NOT NULL`), 0)
})

test('horário de atendimento: só conta o tempo dentro da janela', async () => {
  const ws = async (a: string, b: string) => Number((await sys<{ s: number }>(
    `SELECT notif.working_seconds_between($1::timestamptz, $2::timestamptz, ARRAY['MON','TUE','WED','THU','FRI'], '07:00', '18:00', 'America/Fortaleza') AS s`, [a, b]))[0].s)
  // ter 21/10 10:00 → 14:00 Fortaleza (UTC−3) = 4 h
  assert.equal(await ws('2026-10-21 13:00+00', '2026-10-21 17:00+00'), 4 * 3600)
  // ter 17:00 → qua 08:00 (Fortaleza) = 1 h (ter) + 1 h (qua)
  assert.equal(await ws('2026-10-21 20:00+00', '2026-10-22 11:00+00'), 2 * 3600)
  // sex 17:00 → seg 08:00 = 1 h + 1 h (fim de semana não conta)
  assert.equal(await ws('2026-10-23 20:00+00', '2026-10-26 11:00+00'), 2 * 3600)
  const inH = async (t: string) => (await sys<{ b: boolean }>(
    `SELECT notif.in_working_hours($1::timestamptz, ARRAY['MON','TUE','WED','THU','FRI'], '07:00', '18:00', 'America/Fortaleza') AS b`, [t]))[0].b
  assert.equal(await inH('2026-10-21 13:00+00'), true)    // ter 10:00
  assert.equal(await inH('2026-10-21 22:00+00'), false)   // ter 19:00
  assert.equal(await inH('2026-10-24 13:00+00'), false)   // sábado
})

// Volume normal (14 dias, vários dias) para as escolas A e B; pouco para ESC_POUCO.
async function seedMessages(lastInboundA: string) {
  await sys('DELETE FROM whatsapp_messages')
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, created_at)
             SELECT $1::uuid, 'j' || g, 'inbound', $2::timestamptz - (g || ' hours')::interval FROM generate_series(0, 299) g`,
    [ESC_A, lastInboundA])
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, created_at)
             SELECT $1::uuid, 'j' || g, 'inbound', '2026-10-21 15:30+00'::timestamptz - (g || ' hours')::interval FROM generate_series(0, 299) g`, [ESC_B])
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, created_at)
             VALUES ($1, 'x', 'inbound', '2026-10-15 13:00+00')`, [ESC_POUCO])
  // histórico importado e inbox da Áion não contam como "recebida"
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, is_history_sync, created_at)
             VALUES ($1, 'h', 'inbound', true, '2026-10-21 16:59+00')`, [ESC_A])
}

test('silêncio: avisa uma vez por dia no horário; não avisa fora do horário, sem volume ou com número em queda', async () => {
  await sys('DELETE FROM notification_alerts; DELETE FROM whatsapp_phone_health;')
  // A: última recebida ter 21/10 08:00 Fortaleza (11:00 UTC)
  await seedMessages('2026-10-21 11:00+00')
  // 13:00 Fortaleza = 5 h de atendimento em silêncio → avisa (Super Admin + gestor) só a A
  assert.equal(Number((await sys<{ n: number }>(`SELECT whatsapp_silence_check('2026-10-21 16:00+00') AS n`))[0].n), 1)
  assert.equal(await count(`type = 'whatsapp_silencio'`), 2)
  assert.equal(await count(`type = 'whatsapp_silencio' AND institution_id = '${ESC_B}'`), 0)   // B recebeu às 12:30
  assert.equal(await count(`institution_id = '${ESC_POUCO}'`), 0)                             // sem volume: ignorada
  // uma hora depois, mesmo dia: não repete
  await sys(`SELECT whatsapp_silence_check('2026-10-21 17:00+00')`)
  assert.equal(await count(`type = 'whatsapp_silencio'`), 2)
  // chegou mensagem: resolve o aviso do dia, e não volta a avisar hoje
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, created_at) VALUES ($1, 'n', 'inbound', '2026-10-21 17:30+00')`, [ESC_A])
  await sys(`SELECT whatsapp_silence_check('2026-10-21 17:40+00')`)
  assert.equal(await count(`type = 'whatsapp_silencio' AND resolved_at IS NULL`), 0)
  assert.equal(await count(`resolved_reason = 'voltou a receber'`), 2)
})

test('silêncio fora do horário não avisa (noite e fim de semana)', async () => {
  await sys('DELETE FROM notification_alerts')
  // última recebida sex 23/10 08:00 Fortaleza
  await seedMessages('2026-10-23 11:00+00')
  await sys(`SELECT whatsapp_silence_check('2026-10-23 23:00+00')`)   // sex 20:00
  await sys(`SELECT whatsapp_silence_check('2026-10-24 15:00+00')`)   // sábado 12:00
  await sys(`SELECT whatsapp_silence_check('2026-10-25 15:00+00')`)   // domingo
  assert.equal(await count(`type = 'whatsapp_silencio' AND institution_id = '${ESC_A}'`), 0)
  // segunda 08:00: só 1 h (sex até 18h já conta 10 h)… sex 08→18 = 10 h → avisa na segunda no horário
  await sys(`SELECT whatsapp_silence_check('2026-10-26 11:00+00')`)
  assert.equal(await count(`type = 'whatsapp_silencio' AND institution_id = '${ESC_A}'`), 2)
})

test('silêncio com número em queda não avisa (a queda já avisou); limite configurável', async () => {
  await sys('DELETE FROM notification_alerts; DELETE FROM whatsapp_phone_health;')
  await seedMessages('2026-10-21 11:00+00')
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, '2026-10-21 12:00+00')`, [PHONE_A])
  await sys(`SELECT whatsapp_silence_check('2026-10-21 16:00+00')`)
  assert.equal(await count(`type = 'whatsapp_silencio'`), 0)
  // número volta; limite sobe para 8 h → 5 h de silêncio não avisa
  await sys(`SELECT whatsapp_health_record($1, 'CONNECTED', NULL, NULL, NULL, '2026-10-21 12:10+00')`, [PHONE_A])
  await sys(`INSERT INTO platform_settings VALUES ('wa_silence_hours', '8')`)
  await sys(`SELECT whatsapp_silence_check('2026-10-21 16:00+00')`)
  assert.equal(await count(`type = 'whatsapp_silencio'`), 0)
  await sys(`DELETE FROM platform_settings WHERE key = 'wa_silence_hours'`)
})

test('consumo por dia e por escola: conta enviadas/recebidas; só Super Admin e gestor da escola', async () => {
  await sys('DELETE FROM whatsapp_messages')
  await sys(`INSERT INTO whatsapp_messages (institution_id, remote_jid, direction, message_type, is_bot_message, is_history_sync, is_aion_inbox, created_at) VALUES
    ($1, 'a', 'inbound',  'text',     false, false, false, '2026-10-21 13:00+00'),
    ($1, 'a', 'outbound', 'text',     false, false, false, '2026-10-21 13:01+00'),
    ($1, 'b', 'outbound', 'text',     true,  false, false, '2026-10-21 13:02+00'),
    ($1, 'c', 'outbound', 'template', false, false, false, '2026-10-21 13:03+00'),
    ($1, 'd', 'inbound',  'text',     false, true,  false, '2026-10-21 13:04+00'),
    ($1, 'e', 'inbound',  'text',     false, false, true,  '2026-10-21 13:05+00'),
    ($1, 'a', 'inbound',  'text',     false, false, false, '2026-10-22 02:00+00')`, [ESC_A])
  const q = `SELECT day::text, received::int, sent_team::int, sent_bot::int, sent_template::int, conversations::int
               FROM whatsapp_usage_daily($1, '2026-10-21', '2026-10-21')`
  // 22/10 02:00 UTC = 21/10 23:00 em Brasília → conta no dia 21
  assert.deepEqual(await as(U.adminA, q, [ESC_A]),
    [{ day: '2026-10-21', received: 2, sent_team: 1, sent_bot: 1, sent_template: 1, conversations: 3 }])
  assert.equal((await as(U.super, q, [ESC_A])).length, 1)
  await assert.rejects(as(U.atendA, q, [ESC_A]), /Sem permissão/)
  await assert.rejects(as(U.adminB, q, [ESC_A]), /Sem permissão/)
  const lista = await as<{ name: string; received: number; sent: number }>(U.super,
    `SELECT name, received::int, sent::int FROM whatsapp_usage_by_school('2026-10-01')`)
  assert.deepEqual(lista, [{ name: 'Escola A', received: 2, sent: 3 }])
  await assert.rejects(as(U.adminA, `SELECT * FROM whatsapp_usage_by_school()`), /Apenas Super Admin/)
})

test('evento do webhook é registrado com a escola certa (e nunca derruba o webhook)', async () => {
  await sys(`SELECT whatsapp_connection_event_log($1, NULL, 'account_update', 'ACCOUNT_RESTRICTION', '{"x":1}')`, [PHONE_B])
  await sys(`SELECT whatsapp_connection_event_log(NULL, 'W2', 'phone_quality', 'FLAGGED')`)
  const ev = await sys<{ inst: string; event_type: string }>(
    `SELECT institution_id::text AS inst, event_type FROM whatsapp_connection_events WHERE source = 'webhook' ORDER BY created_at`)
  assert.deepEqual(ev.map(e => [e.inst === ESC_B, e.event_type]), [[true, 'account_update'], [true, 'phone_quality']])
  // só Super Admin lê os eventos
  assert.equal((await as(U.adminB, 'SELECT * FROM whatsapp_connection_events')).length, 0)
  assert.ok((await as(U.super, 'SELECT * FROM whatsapp_connection_events')).length > 0)
})

test('reverter: o script desfaz tudo (sem cron no PGlite) e a migration aplica de novo', async () => {
  await db.exec(REVERT)
  const t = await sys(`SELECT 1 FROM pg_tables WHERE tablename IN ('notification_alerts','whatsapp_connection_events','whatsapp_phone_health')`)
  assert.equal(t.length, 0)
  assert.equal((await sys(`SELECT 1 FROM pg_namespace WHERE nspname = 'notif'`)).length, 0)
  await db.exec(MIGRATION)
  assert.equal((await sys(`SELECT 1 FROM pg_tables WHERE tablename = 'notification_alerts'`)).length, 1)
})

test('escolas em wa_alertas_ignorar: grava o estado, mas não avisa queda nem silêncio', async () => {
  await sys('DELETE FROM notification_alerts; DELETE FROM whatsapp_phone_health;')
  // a migration já põe o Colégio Áion na lista (e não sobrescreve lista existente)
  const v = await sys<{ value: string }>(`SELECT value FROM platform_settings WHERE key = 'wa_alertas_ignorar'`)
  assert.match(v[0].value, /169b10a1-024d-4ac8-b3a8-199f34d1f360/)
  await sys(`UPDATE platform_settings SET value = $1 WHERE key = 'wa_alertas_ignorar'`, [`169b10a1-024d-4ac8-b3a8-199f34d1f360, ${ESC_A}`])
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, now()) AS r`, [PHONE_A]))[0].r, 'ignorada')
  assert.equal(await count(), 0)
  assert.equal((await sys(`SELECT 1 FROM whatsapp_phone_health WHERE phone_number_id = $1 AND down_since IS NOT NULL`, [PHONE_A])).length, 1)
  // silêncio da A também não avisa
  await sys(`SELECT whatsapp_health_record($1, 'CONNECTED', NULL, NULL, NULL, now())`, [PHONE_A])
  await seedMessages('2026-10-21 11:00+00')
  await sys(`SELECT whatsapp_silence_check('2026-10-21 16:00+00')`)
  assert.equal(await count(`institution_id = '${ESC_A}'`), 0)
  // B (fora da lista) continua avisando queda
  await sys(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, now())`, [PHONE_B])
  assert.equal(await count(`institution_id = '${ESC_B}'`), 2)
  // valor inválido: ninguém ignorado, nada quebra
  await sys(`UPDATE platform_settings SET value = 'lixo' WHERE key = 'wa_alertas_ignorar'`)
  assert.equal((await sys<{ r: string }>(`SELECT whatsapp_health_record($1, 'DISCONNECTED', NULL, NULL, NULL, now()) AS r`, [PHONE_A]))[0].r, 'desconectado')
})
