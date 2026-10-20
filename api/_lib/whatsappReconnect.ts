import type { VercelResponse } from '@vercel/node'
import { getSupabaseAdmin, errorResponse, GRAPH_URL, WA_APP_ID, WA_APP_SECRET } from './whatsappAuth.js'
import { requestSmbAppSync, summarizeSmbSync, type SmbSyncResult } from './whatsappSmbSync.js'
import type { ConnectActor, ConnectContext } from './whatsappConnectAuth.js'

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
//   - tudo vai pro audit_logs (clique, resultado do popup, resultado final,
//     inclusive erro inesperado);
//   - número de volta em coexistência → pede contatos e histórico à Meta
//     (smb_app_data). Se o popup fechou sem devolver o code mas a Meta mostra
//     o número reconectado (caso Universo 19/10), registra isso e pede também.

const META_FETCH_TIMEOUT_MS = 30000
const AUDIT_MODULE = 'whatsapp'
const POPUP_RESULTS = ['cancelado', 'erro_meta', 'sem_resposta', 'sem_codigo', 'sem_numero', 'sem_codigo_com_ids', 'finish_sem_retorno'] as const
// Detalhes da Meta que vão para o audit_logs (o resto do objeto é descartado):
// código e mensagem do erro, sessão, etapa, portfólio e os ids devolvidos.
const META_KEYS = ['event', 'fb_status', 'error_code', 'error_id', 'error_message', 'error_type', 'session_id', 'current_step',
                   'business_id', 'waba_id', 'phone_number_id', 'ad_account_ids', 'page_ids', 'dataset_ids', 'timestamp'] as const
export function metaDetail(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const out: Record<string, string> = {}
  for (const k of META_KEYS) {
    const v = (raw as Record<string, unknown>)[k]
    if (v === null || v === undefined || v === '') continue
    out[k] = (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 500)
  }
  return Object.keys(out).length ? out : null
}
// Resultados em que o fluxo da Meta pode ter terminado sem o code chegar até
// nós — nesses vale conferir o número na Meta.
const POPUP_RESULTS_CHECK_META = ['sem_codigo', 'sem_numero']

interface CurrentPhone {
  id: string
  phone_number_id: string
  phone_number: string | null
  waba_id: string | null
}

interface AuditInput {
  institutionId: string
  userId: string
  // Quem agiu: Super Admin (equipe Áion, pela ficha da escola) ou admin da escola
  actor?: ConnectActor
  recordId?: string | null
  action: string
  fieldChanged?: string | null
  oldValue?: string | null
  newValue?: string | null
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: u } = await supabase.from('users')
    .select('full_name, role, user_type').eq('id', input.userId).maybeSingle()
  // Super Admin não é usuário da escola: o papel gravado deixa claro que foi
  // a equipe Áion (user_type admin_geral/consultant).
  const userRole = input.actor === 'superadmin'
    ? `superadmin (${u?.user_type ?? 'admin_geral'})`
    : (u?.role ?? null)
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
    user_role:      userRole,
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
export async function getPlatformToken(): Promise<string> {
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

export interface MetaPhoneState {
  status?: string | null
  platform_type?: string | null
  is_on_biz_app?: boolean | null
  erro?: string
}

export async function readMetaPhoneState(phoneNumberId: string, token: string): Promise<MetaPhoneState> {
  const state = await graphGet(`${phoneNumberId}?fields=status,platform_type,is_on_biz_app`, token)
  return state.ok ? {
    status: state.body.status ?? null,
    platform_type: state.body.platform_type ?? null,
    is_on_biz_app: state.body.is_on_biz_app ?? null,
  } : { erro: state.body?.error?.message ?? 'falha ao consultar a Meta' }
}

const isCoexistenceConnected = (m: MetaPhoneState) =>
  m.status === 'CONNECTED' && m.platform_type === 'CLOUD_API' && m.is_on_biz_app === true

// ── Eventos só de registro: clique, verificação antes do popup, FINISH da
// Meta e resultado do popup — em TODOS os modos ──
// reconnect_* = escola que já tem número; connect_* = primeira conexão.
export async function handleReconnectEvent(
  res: VercelResponse, ctx: ConnectContext, body: any,
) {
  const current = await loadCurrentPhone(ctx.institutionId)
  const isConnect = typeof body.event === 'string' && body.event.startsWith('connect_')
  const prefix = isConnect ? 'Conexão WhatsApp (coexistência)' : 'Reconexão WhatsApp (coexistência)'
  const detailJson = () => {
    const meta = metaDetail(body.meta)
    const detail = typeof body.detail === 'string' ? body.detail.slice(0, 300) : ''
    return meta ? JSON.stringify(detail ? { ...meta, detalhe: detail } : meta) : (detail || null)
  }

  // Antes de abrir o popup: o número salvo já está conectado em coexistência?
  if (body.event === 'reconnect_precheck' || body.event === 'connect_precheck') {
    if (!current) return res.status(200).json({ connected: false, sem_numero: true })
    const meta = await readMetaPhoneState(current.phone_number_id, await getPlatformToken())
    const connected = isCoexistenceConnected(meta)
    await writeAudit({
      ...ctx, recordId: current.id,
      action: `${prefix}: verificação antes do popup`,
      fieldChanged: connected ? 'ja_conectado' : meta.erro ? 'nao_conferido' : 'nao_conectado',
      newValue: JSON.stringify({ numero: current.phone_number, waba: current.waba_id, meta }),
    })
    return res.status(200).json({ connected, meta, phone_number: current.phone_number })
  }
  if (body.event === 'reconnect_popup_finish' || body.event === 'connect_popup_finish') {
    await writeAudit({
      ...ctx, recordId: current?.id,
      action: `${prefix}: Meta avisou o fim (FINISH)`,
      fieldChanged: 'finish',
      newValue: detailJson(),
    })
    return res.status(200).json({ ok: true })
  }
  if (body.event === 'reconnect_click' || body.event === 'connect_click') {
    await writeAudit({
      ...ctx, recordId: current?.id,
      action: `${prefix}: botão clicado`,
      fieldChanged: 'popup_meta',
      newValue: current ? `numero=${current.phone_number} waba=${current.waba_id}` : 'sem numero cadastrado',
    })
    return res.status(200).json({ ok: true })
  }
  if (body.event === 'reconnect_popup_result' || body.event === 'connect_popup_result') {
    const result = POPUP_RESULTS.includes(body.result) ? body.result : 'erro_meta'
    await writeAudit({
      ...ctx, recordId: current?.id,
      action: `${prefix}: popup não concluído`,
      fieldChanged: result,
      newValue: detailJson(),
    })

    // O popup pode fechar sem devolver o code depois de a Meta já ter
    // reconectado o número. Confere e, se for o caso, registra e pede o
    // histórico — senão ninguém fica sabendo e a janela de 24h se perde.
    if (current && POPUP_RESULTS_CHECK_META.includes(result)) {
      try {
        const platformToken = await getPlatformToken()
        const meta = await readMetaPhoneState(current.phone_number_id, platformToken)
        if (isCoexistenceConnected(meta)) {
          const sync = await requestSmbAppSync(current.phone_number_id, [platformToken])
          await writeAudit({
            ...ctx, recordId: current.id,
            action: 'Reconexão WhatsApp (coexistência): concluída na Meta sem retorno do popup',
            fieldChanged: 'smb_app_data',
            oldValue: `phone_id=${current.phone_number_id} waba=${current.waba_id}`,
            newValue: JSON.stringify({ meta, sincronizacao: summarizeSmbSync(sync) }),
          })
        }
      } catch (e) {
        console.warn('[reconnect] conferência pós-popup falhou:', e)
      }
    }
    return res.status(200).json({ ok: true })
  }
  return errorResponse(res, 400, 'Evento inválido')
}

// ── Conclusão da reconexão (depois do popup da Meta) ──
// Qualquer erro inesperado também vai pro audit_logs como falha.
export async function handleReconnect(
  res: VercelResponse, ctx: ConnectContext,
  input: { code?: string; phone_number_id?: string; waba_id?: string },
) {
  try {
    return await reconnect(res, ctx, input)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[reconnect] erro inesperado:', message)
    await writeAudit({
      ...ctx,
      action: 'Reconexão WhatsApp (coexistência): falhou',
      fieldChanged: 'erro_inesperado',
      newValue: message.slice(0, 300),
    })
    return errorResponse(res, 500, `Erro ao concluir a reconexão: ${message}`)
  }
}

async function reconnect(
  res: VercelResponse, ctx: ConnectContext,
  input: { code?: string; phone_number_id?: string; waba_id?: string },
) {
  const { institutionId, userId, actor } = ctx
  const current = await loadCurrentPhone(institutionId)
  const fail = async (status: number, motivo: string, message: string) => {
    await writeAudit({
      institutionId, userId, actor, recordId: current?.id,
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
  // Sem code (popup fechou sem a autorização) só a equipe Áion conclui: a
  // conta tem de ser a já salva, conferida abaixo, e o resto usa o token da plataforma.
  if (!input.phone_number_id || !input.waba_id || (!input.code && actor !== 'superadmin')) {
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
  if (input.code && WA_APP_ID && WA_APP_SECRET) {
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
  const meta = await readMetaPhoneState(input.phone_number_id, platformToken)

  // 5. De volta em coexistência → pede contatos e histórico (smb_app_data).
  let sync: SmbSyncResult[] = []
  if (meta.is_on_biz_app === true) {
    sync = await requestSmbAppSync(input.phone_number_id, [businessToken, platformToken])
  }

  await writeAudit({
    institutionId, userId, actor, recordId: current.id,
    action: 'Reconexão WhatsApp (coexistência): concluída',
    fieldChanged: phoneIdChanged ? 'phone_number_id' : 'sem_alteracao_no_cadastro',
    oldValue: `phone_id=${current.phone_number_id} waba=${current.waba_id}`,
    newValue: JSON.stringify({
      tipo: 'coexistencia', por: actor ?? 'school_admin',
      phone_id: input.phone_number_id, sem_code: !input.code, code_trocado: codeExchanged, app_inscrito: subscribed, meta,
      sincronizacao: sync.length ? summarizeSmbSync(sync) : 'não pedida (número fora da coexistência)',
    }),
  })

  return res.status(200).json({
    reconnected: true,
    phone_number_id: input.phone_number_id,
    waba_id: current.waba_id,
    phone_id_changed: phoneIdChanged,
    app_subscribed: subscribed,
    meta,
    sync,
  })
}
