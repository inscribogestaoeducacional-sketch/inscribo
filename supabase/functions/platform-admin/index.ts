import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Operações que usam o token global da Meta (platform_settings.wa_access_token)
// ou leem/gravam segredos da plataforma. Antes elas rodavam no navegador, que
// lia o token direto de platform_settings — qualquer usuário logado conseguia
// ler o token, a service_role_key e os outros segredos. Agora o token só
// existe aqui; o navegador recebe só o resultado (e segredos mascarados).
//
// Ações (POST { action, ... }):
//   Escola (membro da instituição) ou Super Admin:
//     test_connection  { institution_id }                → nome/número verificados na Meta
//     send_reactivate  { institution_id | platform, to, contact_name }
//     send_survey      { institution_id | platform, to, message } → { sent } (false = sem número/token)
//   Só Super Admin:
//     phone_info               { phone_id }
//     subscribe_app            { waba_id }
//     list_templates           { waba_id | institution_id | platform }
//     check_template           { waba_id | platform, name } → { approved }
//     create_template          { waba_id, template: { name, language, category, components } }
//     create_default_templates { waba_id }
//     settings_get             → { values (não-segredos), secrets (mascarados) }
//     settings_set             { values: { chave: valor } } — só o que mudou;
//                              segredo vazio = mantém o atual
//     platform_wa_get          → WhatsApp da Áion (token mascarado)
//     platform_wa_save         { phone_number_id, waba_id, access_token? }
//     platform_wa_connect      { phone_number_id, waba_id, access_token? } → testa, inscreve, registra e grava

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!
const GRAPH = 'https://graph.facebook.com/v25.0'

// Mesma regra de platform_setting_is_secret() no banco (migration da RLS):
// chave com token/secret/password/api_key ou terminada em _key é segredo.
const SECRET_KEY_RE = /(token|secret|password|api_key|_key$)/i
const META_ID_RE    = /^[0-9]{5,25}$/
const UUID_RE       = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Supa = ReturnType<typeof createClient>

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) throw new HttpError(401, 'Não autenticado')
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) throw new HttpError(401, 'Não autenticado')
    const userId = userData.user.id
    const { data: isSA } = await userClient.rpc('is_super_admin_user')
    const superAdmin = isSA === true

    const sb   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json().catch(() => ({}))
    const ctx  = { sb, userId, superAdmin, body }

    switch (body?.action) {
      case 'test_connection':          return json(200, await testConnection(ctx))
      case 'send_reactivate':          return json(200, await sendReactivate(ctx))
      case 'send_survey':              return json(200, await sendSurvey(ctx))
    }
    if (!superAdmin) throw new HttpError(403, 'Apenas Super Admin')
    switch (body?.action) {
      case 'phone_info':               return json(200, await phoneInfo(ctx))
      case 'subscribe_app':            return json(200, await subscribeApp(ctx))
      case 'list_templates':           return json(200, await listTemplates(ctx))
      case 'check_template':           return json(200, await checkTemplate(ctx))
      case 'create_template':          return json(200, await createTemplate(ctx))
      case 'create_default_templates': return json(200, await createDefaultTemplates(ctx))
      case 'settings_get':             return json(200, await settingsGet(ctx))
      case 'settings_set':             return json(200, await settingsSet(ctx))
      case 'platform_wa_get':          return json(200, await platformWaGet(ctx))
      case 'platform_wa_save':         return json(200, await platformWaSave(ctx))
      case 'platform_wa_connect':      return json(200, await platformWaConnect(ctx))
    }
    throw new HttpError(400, 'Ação inválida')
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message })
    const message = err instanceof Error ? err.message : String(err)
    console.error('[platform-admin]', message)
    return json(500, { error: message })
  }
})

interface Ctx { sb: Supa; userId: string; superAdmin: boolean; body: any }

// ── Apoio ──────────────────────────────────────────────────────────────────

async function globalToken(sb: Supa): Promise<string> {
  const { data } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
  return (data as any)?.value || ''
}

async function setting(sb: Supa, key: string): Promise<string> {
  const { data } = await sb.from('platform_settings').select('value').eq('key', key).maybeSingle()
  return (data as any)?.value || ''
}

async function graph(token: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  })
  const data: any = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

const metaError = (data: any, fallback: string) => data?.error?.error_user_msg || data?.error?.message || fallback

function metaId(v: unknown, label: string): string {
  const s = String(v ?? '').trim()
  if (!META_ID_RE.test(s)) throw new HttpError(400, `${label} inválido`)
  return s
}

function phoneTo(v: unknown): string {
  const s = String(v ?? '').replace(/\D/g, '')
  if (!/^[0-9]{8,15}$/.test(s)) throw new HttpError(400, 'Telefone de destino inválido')
  return s
}

// Escola: usuário da instituição (principal, ativa de gestor de rede ou
// vínculo em user_institutions). Super Admin passa sempre.
async function requireMember(ctx: Ctx, institutionId: unknown): Promise<string> {
  const id = String(institutionId ?? '')
  if (!UUID_RE.test(id)) throw new HttpError(400, 'institution_id inválido')
  if (ctx.superAdmin) return id
  const { data: u } = await ctx.sb.from('users').select('institution_id, active_institution_id, active').eq('id', ctx.userId).maybeSingle()
  if (u && (u as any).active !== false && [(u as any).institution_id, (u as any).active_institution_id].includes(id)) return id
  const { data: link } = await ctx.sb.from('user_institutions').select('user_id')
    .eq('user_id', ctx.userId).eq('institution_id', id).eq('active', true).limit(1).maybeSingle()
  if (link) return id
  throw new HttpError(403, 'Sem acesso a esta escola')
}

// Número que envia: o da escola (whatsapp_phone_numbers) ou, só pro Super
// Admin, o da plataforma Áion (platform_whatsapp) — igual às telas antigas.
async function sendingPhone(ctx: Ctx): Promise<{ phone_number_id: string; waba_id: string } | null> {
  if (ctx.body.platform === true) {
    if (!ctx.superAdmin) throw new HttpError(403, 'Apenas Super Admin')
    const { data } = await ctx.sb.from('platform_whatsapp').select('phone_number_id, waba_id').eq('connected', true).limit(1).maybeSingle()
    return data?.phone_number_id ? { phone_number_id: (data as any).phone_number_id, waba_id: (data as any).waba_id || '' } : null
  }
  // Sem escola (ex.: Inbox Áion sem instituição) = sem número, como antes.
  if (!ctx.body.institution_id) return null
  const inst = await requireMember(ctx, ctx.body.institution_id)
  const { data } = await ctx.sb.from('whatsapp_phone_numbers').select('phone_number_id, waba_id')
    .eq('institution_id', inst).eq('is_active', true).limit(1).maybeSingle()
  return data?.phone_number_id ? { phone_number_id: (data as any).phone_number_id, waba_id: (data as any).waba_id || '' } : null
}

// ── Escola ─────────────────────────────────────────────────────────────────

async function testConnection(ctx: Ctx) {
  const inst = await requireMember(ctx, ctx.body.institution_id)
  const [{ data: instRow }, { data: phoneRow }] = await Promise.all([
    ctx.sb.from('institutions').select('whatsapp_phone_id').eq('id', inst).maybeSingle(),
    ctx.sb.from('whatsapp_phone_numbers').select('phone_number_id').eq('institution_id', inst).eq('is_active', true).limit(1).maybeSingle(),
  ])
  const phoneId = (instRow as any)?.whatsapp_phone_id || (phoneRow as any)?.phone_number_id
  const token = await globalToken(ctx.sb)
  if (!phoneId || !token) return { ok: false, error: 'Phone ID ou token não configurado.' }
  const r = await graph(token, `${metaId(phoneId, 'Phone ID')}?fields=display_phone_number,verified_name`)
  if (!r.ok) return { ok: false, error: metaError(r.data, 'Token inválido') }
  return { ok: true, verified_name: r.data?.verified_name || '', display_phone_number: r.data?.display_phone_number || '' }
}

async function sendReactivate(ctx: Ctx) {
  const to = phoneTo(ctx.body.to)
  const contactName = String(ctx.body.contact_name ?? '').slice(0, 200) || to
  const phone = await sendingPhone(ctx)
  const token = await globalToken(ctx.sb)
  if (!phone || !token) throw new HttpError(400, 'WhatsApp não configurado')
  const wabaId = phone.waba_id || await setting(ctx.sb, 'wa_waba_id')
  if (!wabaId) throw new HttpError(400, 'WABA ID não configurado')

  const check = await graph(token, `${metaId(wabaId, 'WABA ID')}/message_templates?name=reativar_atendimento&status=APPROVED`)
  if (!check.data?.data?.length) throw new HttpError(409, 'Template "reativar_atendimento" não aprovado. Aguarde aprovação da Meta.')

  const send = await graph(token, `${metaId(phone.phone_number_id, 'Phone ID')}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name: 'reativar_atendimento', language: { code: 'pt_BR' }, components: [{ type: 'body', parameters: [{ type: 'text', text: contactName }] }] },
    },
  })
  if (!send.ok) throw new HttpError(502, metaError(send.data, 'Erro ao enviar template'))
  return { ok: true, wamid: send.data?.messages?.[0]?.id || null }
}

async function sendSurvey(ctx: Ctx) {
  const to = phoneTo(ctx.body.to)
  const message = String(ctx.body.message ?? '').slice(0, 1024)
  if (!message.trim()) throw new HttpError(400, 'Mensagem da pesquisa vazia')
  const phone = await sendingPhone(ctx)
  const token = await globalToken(ctx.sb)
  // Sem número/token: a tela cai no envio de texto (/api/whatsapp/send), como antes.
  if (!phone || !token) return { sent: false }
  const r = await graph(token, `${metaId(phone.phone_number_id, 'Phone ID')}/messages`, {
    method: 'POST',
    body: {
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'button', body: { text: message },
        action: { buttons: [
          { type: 'reply', reply: { id: 'survey_1', title: '😞 Ruim' } },
          { type: 'reply', reply: { id: 'survey_2', title: '😐 Regular' } },
          { type: 'reply', reply: { id: 'survey_3', title: '😊 Ótimo' } },
        ] },
      },
    },
  })
  if (!r.ok) console.warn('[platform-admin] pesquisa não enviada:', metaError(r.data, `HTTP ${r.status}`))
  return { sent: true, ok: r.ok }
}

// ── Super Admin: Meta ──────────────────────────────────────────────────────

async function phoneInfo(ctx: Ctx) {
  const token = await globalToken(ctx.sb)
  if (!token) throw new HttpError(400, 'Token de acesso não encontrado. Vá em Admin → Configurações → WhatsApp e salve o Access Token.')
  const r = await graph(token, `${metaId(ctx.body.phone_id, 'Phone ID')}?fields=display_phone_number,verified_name`)
  if (!r.ok) throw new HttpError(400, metaError(r.data, 'Phone ID inválido ou token sem permissão'))
  return { display_phone_number: r.data?.display_phone_number || '', verified_name: r.data?.verified_name || '' }
}

async function subscribeApp(ctx: Ctx) {
  const token = await globalToken(ctx.sb)
  if (!token) throw new HttpError(400, 'Token de acesso não encontrado')
  const r = await graph(token, `${metaId(ctx.body.waba_id, 'WABA ID')}/subscribed_apps`, { method: 'POST' })
  return { success: !!r.data?.success, error: r.ok ? null : metaError(r.data, `HTTP ${r.status}`) }
}

async function resolveWaba(ctx: Ctx): Promise<string | null> {
  if (ctx.body.platform === true) {
    const { data } = await ctx.sb.from('platform_whatsapp').select('waba_id').eq('connected', true).limit(1).maybeSingle()
    return (data as any)?.waba_id || null
  }
  if (ctx.body.institution_id) {
    const { data } = await ctx.sb.from('whatsapp_phone_numbers').select('waba_id').eq('institution_id', String(ctx.body.institution_id)).limit(1).maybeSingle()
    return (data as any)?.waba_id || null
  }
  return ctx.body.waba_id ? String(ctx.body.waba_id) : null
}

async function listTemplates(ctx: Ctx) {
  const wabaId = await resolveWaba(ctx)
  if (!wabaId) return { templates: [], waba_id: null }
  const token = await globalToken(ctx.sb)
  if (!token) return { templates: [], waba_id: wabaId }
  const r = await graph(token, `${metaId(wabaId, 'WABA ID')}/message_templates?limit=50`)
  if (!r.ok) throw new HttpError(502, metaError(r.data, 'Erro ao buscar templates na Meta'))
  return { templates: r.data?.data || [], waba_id: wabaId }
}

async function checkTemplate(ctx: Ctx) {
  const name = String(ctx.body.name ?? '')
  if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new HttpError(400, 'Nome de template inválido')
  const wabaId = await resolveWaba(ctx)
  if (!wabaId) throw new HttpError(400, 'WABA não configurado')
  const token = await globalToken(ctx.sb)
  if (!token) throw new HttpError(400, 'Token de acesso da plataforma Áion não configurado.')
  const r = await graph(token, `${metaId(wabaId, 'WABA ID')}/message_templates?name=${encodeURIComponent(name)}&status=APPROVED`)
  return { approved: r.ok && !!r.data?.data?.length }
}

async function createTemplate(ctx: Ctx) {
  const t = ctx.body.template || {}
  const name = String(t.name ?? '')
  if (!/^[a-z0-9_]{1,512}$/.test(name)) throw new HttpError(400, 'Nome de template inválido (use letras minúsculas, números e _)')
  const token = await globalToken(ctx.sb)
  if (!token) throw new HttpError(400, 'Token de acesso não encontrado')
  const r = await graph(token, `${metaId(ctx.body.waba_id, 'WABA ID')}/message_templates`, {
    method: 'POST',
    body: { name, language: String(t.language || 'pt_BR'), category: String(t.category || 'UTILITY'), components: Array.isArray(t.components) ? t.components : [] },
  })
  if (!r.ok) throw new HttpError(400, metaError(r.data, 'Erro ao enviar template'))
  return { id: r.data?.id || null, status: r.data?.status || null }
}

// Templates padrão (whatsapp_platform_templates.is_default) no WABA de uma
// escola — pula o WABA da própria Áion e os que já existem lá.
async function createDefaultTemplates(ctx: Ctx) {
  const wabaId = metaId(ctx.body.waba_id, 'WABA ID')
  const token = await globalToken(ctx.sb)
  if (!token) return { created: [], skipped: [], errors: ['Token de acesso não encontrado'] }
  if (wabaId === await setting(ctx.sb, 'wa_waba_id')) return { created: [], skipped: ['waba_da_aion'], errors: [] }

  const { data: templates } = await ctx.sb.from('whatsapp_platform_templates').select('*').eq('is_default', true)
  const created: string[] = [], skipped: string[] = [], errors: string[] = []
  for (const tpl of (templates || []) as any[]) {
    try {
      const check = await graph(token, `${wabaId}/message_templates?name=${encodeURIComponent(tpl.name)}`)
      if (check.data?.data?.length > 0) { skipped.push(tpl.name); continue }
      const r = await graph(token, `${wabaId}/message_templates`, {
        method: 'POST',
        body: {
          name: tpl.name, language: tpl.language, category: tpl.category,
          components: [{
            type: 'BODY', text: tpl.body_text,
            example: { body_text: [((tpl.variables || []) as string[]).map((_: string, i: number) => i === 0 ? 'João' : 'Colégio Exemplo')] },
          }],
        },
      })
      if (r.ok) created.push(tpl.name)
      else errors.push(`${tpl.name}: ${metaError(r.data, `HTTP ${r.status}`)}`)
    } catch (e) {
      errors.push(`${tpl.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { created, skipped, errors }
}

// ── Super Admin: configurações ─────────────────────────────────────────────

function mask(v: string): string {
  if (!v) return ''
  return v.length >= 16 ? `${v.slice(0, 4)}…${v.slice(-4)}` : '••••'
}

async function settingsGet(ctx: Ctx) {
  const { data, error } = await ctx.sb.from('platform_settings').select('key, value')
  if (error) throw new Error(error.message)
  const values: Record<string, string> = {}
  const secrets: Record<string, { set: boolean; masked: string; length: number }> = {}
  for (const r of (data || []) as { key: string; value: string | null }[]) {
    const v = r.value || ''
    if (SECRET_KEY_RE.test(r.key)) secrets[r.key] = { set: v.length > 0, masked: mask(v), length: v.length }
    else values[r.key] = v
  }
  return { values, secrets }
}

async function settingsSet(ctx: Ctx) {
  const input = ctx.body.values
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(400, 'values deve ser um objeto')
  const rows: { key: string; value: string }[] = []
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-z0-9_]{1,64}$/.test(key)) throw new HttpError(400, `Chave inválida: ${key}`)
    const value = raw == null ? '' : String(raw)
    if (value.length > 500_000) throw new HttpError(400, `Valor grande demais: ${key}`)
    // Segredo vazio = "não mexer" (a tela nunca recebe o valor atual).
    if (SECRET_KEY_RE.test(key) && !value.trim()) continue
    rows.push({ key, value: SECRET_KEY_RE.test(key) ? value.trim() : value })
  }
  if (!rows.length) return { saved: [] }
  const { error } = await ctx.sb.from('platform_settings').upsert(rows, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  console.log('[platform-admin] settings_set por', ctx.userId, '→', rows.map(r => r.key).join(', '))
  return { saved: rows.map(r => r.key) }
}

const PLATFORM_WA_COLS = 'id, phone_number_id, waba_id, phone_number, display_name, connected, webhook_verified'

async function platformWaGet(ctx: Ctx) {
  const { data } = await ctx.sb.from('platform_whatsapp').select(`${PLATFORM_WA_COLS}, access_token`).limit(1).maybeSingle()
  if (!data) return { config: null }
  const { access_token, ...rest } = data as any
  return { config: { ...rest, token_set: !!access_token, token_masked: mask(access_token || '') } }
}

async function platformWaSave(ctx: Ctx) {
  const phoneNumberId = metaId(ctx.body.phone_number_id, 'Phone Number ID')
  const wabaId = ctx.body.waba_id ? metaId(ctx.body.waba_id, 'WABA ID') : null
  const newToken = String(ctx.body.access_token ?? '').trim()
  const { data: existing } = await ctx.sb.from('platform_whatsapp').select('id').limit(1).maybeSingle()
  const patch: Record<string, unknown> = { phone_number_id: phoneNumberId, waba_id: wabaId, ...(newToken ? { access_token: newToken } : {}) }
  if (existing) {
    const { error } = await ctx.sb.from('platform_whatsapp').update(patch).eq('id', (existing as any).id)
    if (error) throw new Error(error.message)
  } else {
    if (!newToken) throw new HttpError(400, 'Access Token obrigatório no primeiro cadastro')
    const { error } = await ctx.sb.from('platform_whatsapp').insert({ ...patch, connected: false })
    if (error) throw new Error(error.message)
  }
  return platformWaGet(ctx)
}

async function platformWaConnect(ctx: Ctx) {
  const phoneNumberId = metaId(ctx.body.phone_number_id, 'Phone Number ID')
  const wabaId = ctx.body.waba_id ? metaId(ctx.body.waba_id, 'WABA ID') : null
  const { data: existing } = await ctx.sb.from('platform_whatsapp').select('id, access_token').limit(1).maybeSingle()
  const token = String(ctx.body.access_token ?? '').trim() || (existing as any)?.access_token || ''
  if (!token) throw new HttpError(400, 'Phone Number ID e Access Token são obrigatórios.')

  // 1. Valida as credenciais
  const info = await graph(token, `${phoneNumberId}?fields=display_phone_number,verified_name`)
  if (!info.ok || !info.data?.display_phone_number) throw new HttpError(400, metaError(info.data, 'Credenciais inválidas'))
  // 2. Inscreve o app no WABA (webhook)
  let webhookVerified = false
  if (wabaId) {
    const sub = await graph(token, `${wabaId}/subscribed_apps`, { method: 'POST' })
    webhookVerified = sub.ok && !!sub.data?.success
  }
  // 3. Registra o número no Cloud API (ignora se já registrado)
  await graph(token, `${phoneNumberId}/register`, { method: 'POST', body: { messaging_product: 'whatsapp', pin: '000000' } }).catch(() => null)

  const row = {
    phone_number_id: phoneNumberId, waba_id: wabaId, access_token: token,
    phone_number: info.data.display_phone_number, display_name: info.data.verified_name || '',
    connected: true, webhook_verified: webhookVerified,
  }
  const { error } = existing
    ? await ctx.sb.from('platform_whatsapp').update(row).eq('id', (existing as any).id)
    : await ctx.sb.from('platform_whatsapp').insert(row)
  if (error) throw new Error(error.message)
  const out = await platformWaGet(ctx)
  return { ...out, verified_name: info.data.verified_name || '', display_phone_number: info.data.display_phone_number, webhook_verified: webhookVerified }
}
