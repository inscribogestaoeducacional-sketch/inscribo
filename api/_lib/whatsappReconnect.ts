import type { VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, errorResponse, GRAPH_URL, WA_APP_ID, WA_APP_SECRET } from './whatsappAuth.js'

// ── Reconexão em modo coexistência (app WhatsApp Business + API) ────────────
// Usado por api/whatsapp/embedded-signup.ts quando o body traz
// mode: 'reconnect'. Existe pra escola que JÁ tem número cadastrado e perdeu
// a ligação da coexistência (caso Universo, 16/10/2026: Meta recusando envio
// com 133010 enquanto o app do celular seguia funcionando).
//
// Regras deste caminho (combinadas com o dono):
//   - reaproveita o WABA já cadastrado da escola; se o popup voltar com outro
//     WABA, recusa sem gravar nada;
//   - NUNCA chama /register — num número em uso no app WhatsApp Business isso
//     tira o número do celular;
//   - não troca token nem connection_method; só atualiza o phone_number_id se
//     a Meta devolver outro id para o MESMO número, no MESMO WABA;
//   - tudo vai pro audit_logs (clique, resultado do popup, resultado final).

const META_FETCH_TIMEOUT_MS = 30000
const AUDIT_MODULE = 'whatsapp'
const POPUP_RESULTS = ['cancelado', 'erro_meta', 'sem_resposta', 'sem_codigo', 'sem_numero'] as const

interface CurrentPhone {
  id: string
  phone_number_id: string
  phone_number: string | null
  waba_id: string | null
}

interface AuditInput {
  institutionId: string
  userId: string
  recordId?: string | null
  action: string
  fieldChanged?: string | null
  oldValue?: string | null
  newValue?: string | null
}

async function writeAudit(input: AuditInput): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: u } = await supabase.from('users')
    .select('full_name, role').eq('id', input.userId).maybeSingle()
  const { error } = await supabase.from('audit_logs').insert({
    institution_id: input.institutionId,
    module:         AUDIT_MODULE,
    record_id:      input.recordId ?? null,
    action:         input.action,
    field_changed:  input.fieldChanged ?? null,
    old_value:      input.oldValue ?? null,
    new_value:      input.newValue ?? null,
    user_id:        input.userId,
    user_name:      u?.full_name ?? null,
    user_role:      u?.role ?? null,
  })
  if (error) console.error('[reconnect] falha ao gravar audit_logs:', error.message)
}

async function loadCurrentPhone(institutionId: string): Promise<CurrentPhone | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('whatsapp_phone_numbers')
    .select('id, phone_number_id, phone_number, waba_id')
    .eq('institution_id', institutionId)
    .eq('is_active', true)
    .maybeSingle()
  return data?.phone_number_id ? data as CurrentPhone : null
}

// Token de sistema da plataforma — o mesmo que send.ts/webhook.ts usam.
async function getPlatformToken(): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('platform_settings')
    .select('value').eq('key', 'wa_access_token').maybeSingle()
  return data?.value || process.env.WA_ACCESS_TOKEN || ''
}

const digits = (s: string | null | undefined) => String(s || '').replace(/\D/g, '')

async function graphGet(path: string, token: string): Promise<{ ok: boolean; body: any }> {
  try {
    const r = await fetch(`${GRAPH_URL}/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
    })
    return { ok: r.ok, body: await r.json() }
  } catch (e) {
    return { ok: false, body: { error: { message: e instanceof Error ? e.message : String(e) } } }
  }
}

// ── Eventos só de registro: clique no botão e resultado do popup ──
export async function handleReconnectEvent(
  res: VercelResponse, ctx: { institutionId: string; userId: string }, body: any,
) {
  const current = await loadCurrentPhone(ctx.institutionId)
  if (body.event === 'reconnect_click') {
    await writeAudit({
      ...ctx, recordId: current?.id,
      action: 'Reconexão WhatsApp (coexistência): botão clicado',
      fieldChanged: 'popup_meta',
      newValue: current ? `numero=${current.phone_number} waba=${current.waba_id}` : 'sem numero cadastrado',
    })
    return res.status(200).json({ ok: true })
  }
  if (body.event === 'reconnect_popup_result') {
    const result = POPUP_RESULTS.includes(body.result) ? body.result : 'erro_meta'
    const detail = typeof body.detail === 'string' ? body.detail.slice(0, 300) : ''
    await writeAudit({
      ...ctx, recordId: current?.id,
      action: 'Reconexão WhatsApp (coexistência): popup não concluído',
      fieldChanged: result,
      newValue: detail || null,
    })
    return res.status(200).json({ ok: true })
  }
  return errorResponse(res, 400, 'Evento inválido')
}

// ── Conclusão da reconexão (depois do popup da Meta) ──
export async function handleReconnect(
  res: VercelResponse, ctx: { institutionId: string; userId: string },
  input: { code?: string; phone_number_id?: string; waba_id?: string },
) {
  const { institutionId, userId } = ctx
  const current = await loadCurrentPhone(institutionId)
  const fail = async (status: number, motivo: string, message: string) => {
    await writeAudit({
      institutionId, userId, recordId: current?.id,
      action: 'Reconexão WhatsApp (coexistência): recusada',
      fieldChanged: motivo,
      oldValue: current ? `phone_id=${current.phone_number_id} waba=${current.waba_id}` : null,
      newValue: `phone_id=${input.phone_number_id ?? ''} waba=${input.waba_id ?? ''}`,
    })
    return errorResponse(res, status, message)
  }

  if (!current) {
    return fail(409, 'sem_numero_cadastrado', 'Esta escola não tem número cadastrado. Use "Conectar via Meta".')
  }
  if (!current.waba_id) {
    return fail(409, 'sem_waba_cadastrado', 'O número desta escola não tem a conta (WABA) cadastrada. Fale com a equipe Áion antes de reconectar.')
  }
  if (!input.code || !input.phone_number_id || !input.waba_id) {
    return fail(400, 'dados_incompletos', 'A Meta não devolveu os dados da conexão. Nada foi alterado. Tente de novo.')
  }
  if (String(input.waba_id) !== String(current.waba_id)) {
    return fail(409, 'waba_diferente',
      `A conta escolhida no popup (${input.waba_id}) não é a conta desta escola (${current.waba_id}). ` +
      'Nada foi alterado na Áion. Refaça escolhendo a conta já existente.')
  }

  const platformToken = await getPlatformToken()

  // Mesmo WABA, mas id de número diferente: só aceita se for o MESMO telefone.
  let phoneIdChanged = false
  if (String(input.phone_number_id) !== String(current.phone_number_id)) {
    const check = await graphGet(`${input.phone_number_id}?fields=display_phone_number`, platformToken)
    if (!check.ok || digits(check.body?.display_phone_number) !== digits(current.phone_number)) {
      return fail(409, 'numero_diferente',
        'O número escolhido no popup não é o número desta escola. Nada foi alterado na Áion.')
    }
    phoneIdChanged = true
  }

  // 1. Troca o code (confirma a autorização). Falha aqui não bloqueia: o
  //    envio usa o token de sistema da plataforma, não este.
  let codeExchanged = false
  let businessToken = ''
  if (WA_APP_ID && WA_APP_SECRET) {
    try {
      const r = await fetch(
        `${GRAPH_URL}/oauth/access_token?client_id=${WA_APP_ID}&client_secret=${WA_APP_SECRET}&code=${encodeURIComponent(input.code)}`,
        { signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS) },
      )
      const d = await r.json()
      if (r.ok && d.access_token) { codeExchanged = true; businessToken = d.access_token }
      else console.warn('[reconnect] troca do code falhou:', d?.error?.message)
    } catch (e) {
      console.warn('[reconnect] troca do code falhou:', e)
    }
  }

  // 2. Garante o app inscrito no WABA (idempotente). Sem /register.
  let subscribed = false
  for (const token of [businessToken, platformToken].filter(Boolean)) {
    try {
      const r = await fetch(`${GRAPH_URL}/${current.waba_id}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      })
      const d = await r.json()
      if (d?.success) { subscribed = true; break }
      console.warn('[reconnect] subscribed_apps sem sucesso:', d?.error?.message)
    } catch (e) {
      console.warn('[reconnect] subscribed_apps falhou:', e)
    }
  }

  // 3. Só se a Meta trocou o id do mesmo número: atualiza o roteamento.
  if (phoneIdChanged) {
    const supabase = getSupabaseAdmin()
    const { error: e1 } = await supabase.from('whatsapp_phone_numbers')
      .update({ phone_number_id: input.phone_number_id }).eq('id', current.id)
    if (e1) return fail(500, 'erro_ao_gravar', `Erro ao atualizar o número: ${e1.message}`)
    await supabase.from('institutions')
      .update({ whatsapp_phone_id: input.phone_number_id }).eq('id', institutionId)
  }

  // 4. Lê o estado do número na Meta pra mostrar e registrar.
  const state = await graphGet(
    `${input.phone_number_id}?fields=status,platform_type,is_on_biz_app,display_phone_number`,
    platformToken,
  )
  const meta = state.ok ? {
    status: state.body.status ?? null,
    platform_type: state.body.platform_type ?? null,
    is_on_biz_app: state.body.is_on_biz_app ?? null,
  } : { erro: state.body?.error?.message ?? 'falha ao consultar a Meta' }

  await writeAudit({
    institutionId, userId, recordId: current.id,
    action: 'Reconexão WhatsApp (coexistência): concluída',
    fieldChanged: phoneIdChanged ? 'phone_number_id' : 'sem_alteracao_no_cadastro',
    oldValue: `phone_id=${current.phone_number_id} waba=${current.waba_id}`,
    newValue: JSON.stringify({ phone_id: input.phone_number_id, code_trocado: codeExchanged, app_inscrito: subscribed, meta }),
  })

  return res.status(200).json({
    reconnected: true,
    phone_number_id: input.phone_number_id,
    waba_id: current.waba_id,
    phone_id_changed: phoneIdChanged,
    app_subscribed: subscribed,
    meta,
  })
}
