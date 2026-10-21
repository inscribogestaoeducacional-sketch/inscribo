import { getSupabaseAdmin, GRAPH_URL } from './whatsappAuth.js'
import { exchangeCodeForToken, metaError, metaErrorText, errorFromException } from './metaApp.js'
import { readMetaPhoneState, writeAudit, getPlatformToken, type MetaPhoneState } from './whatsappReconnect.js'
import { requestSmbAppSync, summarizeSmbSync, type SmbSyncResult } from './whatsappSmbSync.js'
import { checkPopupWaba, type ConnectContext } from './whatsappConnectAuth.js'

// ── Conexão nova pelo popup da Meta (Cadastro Incorporado, coexistência) ────
// Usado por api/whatsapp/embedded-signup.ts. Dois jeitos de chegar aqui:
//   - com `code` (o popup devolveu a autorização): troca o code pelo token da
//     empresa (sem fb_exchange_token — esse token não é de usuário comum);
//   - SEM `code`, só com waba_id + phone_number_id do evento FINISH da Meta:
//     só para Super Admin admin_geral. Caso 20/10/2026: em 4 de 7 tentativas
//     o popup fechou sem code com o número já conectado na Meta.
// Nos dois casos, com o token de sistema da plataforma:
//   1. travas da conta: nunca troca a WABA já salva, nunca aceita a WABA de
//      teste (checkPopupWaba);
//   2. a WABA tem de estar no portfólio da Áion (dona da WABA = Áion; ou,
//      fallback, nas listas do portfólio); senão recusa
//      (checkWabaInAionPortfolio);
//   3. o número tem de ser desta WABA;
//   4. inscreve o app nos webhooks (subscribed_apps), lê o número, grava e,
//      em coexistência, pede contatos e histórico (smb_app_data).
// NUNCA chama /register (tiraria o número do app do celular).
// Tudo vai para o audit_logs: recusa, falha e conclusão.

export const AION_BUSINESS_ID = process.env.WA_BUSINESS_ID || '1009021325175669'
const META_FETCH_TIMEOUT_MS = 30000

export interface ConnectInput {
  code?: string
  phone_number_id?: string
  waba_id?: string
}

export interface SavedPhone { id: string; waba_id: string | null; phone_number_id: string | null }

export interface PhoneRow {
  institution_id: string
  phone_number_id: string
  phone_number: string
  display_name: string
  waba_id: string
  is_active: true
  use_meta_api: true
  access_token: string | null
  connection_method: 'embedded_signup'
  token_expires_at: null
}

export interface ConnectDeps {
  loadSaved: (institutionId: string) => Promise<SavedPhone | null>
  platformWabaId: () => Promise<string | null>
  platformToken: () => Promise<string>
  // erro = texto da Meta com código e fbtrace_id (metaErrorText); segredo = de onde veio o segredo do app
  exchangeCode: (code: string) => Promise<{ token?: string; erro?: string; segredo?: string | null }>
  wabaInAionPortfolio: (wabaId: string, token: string) => Promise<{ ok: boolean; via?: string; dona?: string; erro?: string }>
  wabaHasPhone: (wabaId: string, phoneNumberId: string, tokens: string[]) => Promise<{ ok: boolean; erro?: string }>
  readPhone: (phoneNumberId: string, tokens: string[]) => Promise<{ ok: boolean; display_phone_number?: string; verified_name?: string; erro?: string }>
  subscribe: (wabaId: string, tokens: string[]) => Promise<{ ok: boolean; erro?: string }>
  metaState: (phoneNumberId: string, token: string) => Promise<MetaPhoneState>
  smbSync: (phoneNumberId: string, tokens: string[]) => Promise<SmbSyncResult[]>
  save: (row: PhoneRow) => Promise<string | null>          // mensagem de erro ou null
  audit: typeof writeAudit
}

export type ConnectOutcome = { status: number; body: Record<string, unknown> }

export async function runConnect(ctx: ConnectContext, input: ConnectInput, deps: ConnectDeps = defaultConnectDeps): Promise<ConnectOutcome> {
  const { institutionId, userId, actor } = ctx
  const phoneId = String(input.phone_number_id || '').trim()
  const wabaId = String(input.waba_id || '').trim()
  const code = String(input.code || '').trim()
  const semCode = !code

  // Sem code só a equipe Áion (admin_geral) conclui; admin da escola precisa do code.
  if (!phoneId || !wabaId || (semCode && actor !== 'superadmin')) {
    return { status: 400, body: { error: 'code, phone_number_id e waba_id são obrigatórios' } }
  }

  const saved = await deps.loadSaved(institutionId)
  // detalhe = o que vai para o audit além dos ids (resposta da Meta etc.);
  // sem detalhe, grava a própria mensagem da tela.
  const refuse = async (status: number, motivo: string, message: string, detalhe?: string) => {
    await deps.audit({
      institutionId, userId, actor, recordId: saved?.id ?? null,
      action: 'Conexão WhatsApp (Meta): recusada',
      fieldChanged: motivo,
      oldValue: saved ? `phone_id=${saved.phone_number_id} waba=${saved.waba_id}` : 'sem cadastro anterior',
      newValue: `phone_id=${phoneId} waba=${wabaId}${semCode ? ' (sem code)' : ''} | ${detalhe ?? message}`.slice(0, 1000),
    })
    return { status, body: { error: message, motivo } }
  }

  try {
    // 1. Travas da conta, antes de qualquer chamada à Meta
    const check = checkPopupWaba(wabaId, saved?.waba_id, await deps.platformWabaId())
    if ('motivo' in check) return refuse(409, check.motivo, check.message)

    // 2. Token da empresa pelo code (quando vier). Sem fb_exchange_token.
    let businessToken = ''
    let codeErro: string | null = null
    let segredo: string | null = null
    if (code) {
      const ex = await deps.exchangeCode(code)
      segredo = ex.segredo ?? null
      if (ex.token) businessToken = ex.token
      else codeErro = ex.erro || 'falha ao trocar o code'
      // admin da escola: o code é a única prova de que ele autorizou na Meta
      if (!businessToken && actor !== 'superadmin') {
        return refuse(400, 'code_recusado', `A Meta recusou a autorização: ${codeErro}. Nada foi alterado.`,
          `Meta: ${codeErro} | segredo do app: ${segredo ?? 'nenhum'}`)
      }
    }
    const platformToken = await deps.platformToken()
    if (!platformToken) return refuse(500, 'sem_token_plataforma', 'Token da plataforma não configurado. Nada foi alterado.')
    const tokens = [businessToken, platformToken].filter(Boolean)

    // 3. A WABA está no portfólio da Áion?
    const owner = await deps.wabaInAionPortfolio(wabaId, platformToken)
    if (!owner.ok) {
      if (owner.erro) {
        return refuse(409, 'portfolio_nao_conferido',
          `Não foi possível conferir na Meta se a conta ${wabaId} está ligada à Áion (${owner.erro}). Nada foi alterado.`,
          `Meta: ${owner.erro}`)
      }
      return refuse(409, 'waba_de_outro_portfolio',
        'A conta ficou em outro portfólio. No popup, escolha o portfólio Aion Solucoes Tecnologicas e tente de novo.',
        `dona da conta na Meta: ${owner.dona ?? 'não informada'} (exigido ${AION_BUSINESS_ID})`)
    }

    // 4. O número é desta WABA?
    const hasPhone = await deps.wabaHasPhone(wabaId, phoneId, tokens)
    if (!hasPhone.ok) {
      return refuse(409, 'numero_fora_da_waba', hasPhone.erro
        ? `Não foi possível conferir o número na conta ${wabaId} (${hasPhone.erro}). Nada foi alterado.`
        : `O número ${phoneId} não pertence à conta ${wabaId}. Nada foi alterado.`,
        hasPhone.erro ? `Meta: ${hasPhone.erro}` : undefined)
    }

    // 5. Lê o número
    const phone = await deps.readPhone(phoneId, tokens)
    if (!phone.ok) {
      return refuse(409, 'numero_ilegivel', `Não foi possível ler o número na Meta (${phone.erro}). Nada foi alterado.`,
        `Meta: ${phone.erro}`)
    }
    const verifiedPhone = phone.display_phone_number || ''
    const verifiedName = phone.verified_name || ''

    // 6. Webhooks (idempotente). Sem /register.
    const subscribed = await deps.subscribe(wabaId, tokens)

    // 7. Grava (o envio da escola usa o token da plataforma; o da empresa fica só de registro)
    const saveErr = await deps.save({
      institution_id: institutionId, phone_number_id: phoneId, phone_number: verifiedPhone, display_name: verifiedName,
      waba_id: wabaId, is_active: true, use_meta_api: true, access_token: businessToken || null,
      connection_method: 'embedded_signup', token_expires_at: null,
    })
    if (saveErr) throw new Error(`Erro ao gravar o número: ${saveErr}`)

    // 8. Coexistência → contatos e histórico
    const meta = await deps.metaState(phoneId, platformToken)
    const sync = meta.is_on_biz_app === true ? await deps.smbSync(phoneId, tokens) : []

    await deps.audit({
      institutionId, userId, actor, recordId: saved?.id ?? null,
      action: 'Conexão WhatsApp (Meta): concluída',
      fieldChanged: 'whatsapp_phone_numbers',
      oldValue: saved ? `phone_id=${saved.phone_number_id} waba=${saved.waba_id}` : 'sem cadastro anterior',
      newValue: JSON.stringify({
        tipo: meta.is_on_biz_app === true ? 'coexistencia' : 'cloud_api', por: actor,
        phone_id: phoneId, waba: wabaId, numero: verifiedPhone,
        sem_code: semCode, code_trocado: !!businessToken, code_erro: codeErro, segredo_do_app: segredo,
        portfolio: owner.via ?? null, app_inscrito: subscribed.ok, app_inscrito_erro: subscribed.erro ?? null, meta,
        sincronizacao: sync.length ? summarizeSmbSync(sync) : 'não pedida (número fora da coexistência)',
      }),
    })

    return {
      status: 200,
      body: { phone_number_id: phoneId, waba_id: wabaId, phone_number: verifiedPhone, display_name: verifiedName,
              sem_code: semCode, app_subscribed: subscribed.ok, meta, sync },
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[embedded-signup] erro:', message)
    await deps.audit({
      institutionId, userId, actor, recordId: saved?.id ?? null,
      action: 'Conexão WhatsApp (Meta): falhou',
      fieldChanged: 'erro',
      oldValue: `phone_id=${phoneId} waba=${wabaId}${semCode ? ' (sem code)' : ''}`,
      newValue: message.slice(0, 300),
    })
    return { status: 500, body: { error: message } }
  }
}

// ── Implementação real (banco + Graph API) ──
// Só os campos da resposta da Graph API que este arquivo lê
type GraphBody = { error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string }; data?: { id?: string }[]; paging?: { next?: string }; success?: boolean; display_phone_number?: string; verified_name?: string; owner_business_info?: { id?: string } }
type GraphFn = (path: string, token: string) => Promise<{ ok: boolean; body: GraphBody }>
async function graph(path: string, token: string, init: RequestInit = {}): Promise<{ ok: boolean; body: GraphBody }> {
  try {
    const r = await fetch(`${GRAPH_URL}/${path}`, {
      ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
    })
    return { ok: r.ok, body: await r.json().catch(() => ({})) }
  } catch (e) {
    return { ok: false, body: { error: errorFromException(e) } }
  }
}
// Resposta da Meta com código e fbtrace_id, sem tokens (api/_lib/metaApp.ts)
const gErr = (b: GraphBody | undefined) => metaErrorText(metaError(b))

// Percorre uma lista paginada da Graph API (até 20 páginas) procurando um id.
async function listHas(path: string, id: string, token: string, get: GraphFn = graph): Promise<{ found: boolean; erro?: string }> {
  let next: string | null = `${path}${path.includes('?') ? '&' : '?'}fields=id&limit=100`
  for (let i = 0; i < 20 && next; i++) {
    const r = await get(next, token)
    if (!r.ok) return { found: false, erro: gErr(r.body) }
    if ((r.body?.data ?? []).some(x => String(x?.id) === id)) return { found: true }
    const n: string | undefined = r.body?.paging?.next
    next = n ? n.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, '') : null
  }
  return { found: false }
}

// A WABA está no portfólio da Áion? 1º lê a DONA da própria WABA
// (owner_business_info) e exige o id da Áion — o token de sistema da plataforma
// lê isso. As listas do portfólio (client_/owned_whatsapp_business_accounts)
// ficam como fallback: pedem business_management, que o token não tem hoje
// (conferido 20/10/2026: 403 #200), mas cobrem a WABA de outro dono
// compartilhada com a Áion, se a permissão for dada um dia.
export async function checkWabaInAionPortfolio(
  wabaId: string, token: string, get: GraphFn = graph,
): Promise<{ ok: boolean; via?: string; dona?: string; erro?: string }> {
  const own = await get(`${wabaId}?fields=owner_business_info`, token)
  const ownerId = own.ok ? String(own.body?.owner_business_info?.id ?? '') : ''
  if (ownerId === AION_BUSINESS_ID) return { ok: true, via: 'dona' }
  const client = await listHas(`${AION_BUSINESS_ID}/client_whatsapp_business_accounts`, wabaId, token, get)
  if (client.found) return { ok: true, via: 'compartilhada' }
  const owned = await listHas(`${AION_BUSINESS_ID}/owned_whatsapp_business_accounts`, wabaId, token, get)
  if (owned.found) return { ok: true, via: 'propria' }
  // Dona lida e diferente da Áion = outro portfólio (mesmo com as listas sem
  // permissão). Só é "não conferido" se nem a dona deu para ler.
  if (ownerId) return { ok: false, dona: ownerId }
  return { ok: false, erro: own.ok ? 'a Meta não informou a dona da conta' : gErr(own.body) }
}

export const defaultConnectDeps: ConnectDeps = {
  loadSaved: async institutionId => {
    const { data } = await getSupabaseAdmin().from('whatsapp_phone_numbers')
      .select('id, waba_id, phone_number_id').eq('institution_id', institutionId).maybeSingle()
    return (data as SavedPhone | null) ?? null
  },
  platformWabaId: async () => {
    const { data } = await getSupabaseAdmin().from('platform_settings').select('value').eq('key', 'wa_waba_id').maybeSingle()
    return data?.value ?? null
  },
  platformToken: getPlatformToken,
  exchangeCode: exchangeCodeForToken,
  wabaInAionPortfolio: (wabaId, token) => checkWabaInAionPortfolio(wabaId, token),
  wabaHasPhone: async (wabaId, phoneNumberId, tokens) => {
    let erro: string | undefined
    for (const t of tokens) {
      const r = await listHas(`${wabaId}/phone_numbers`, phoneNumberId, t)
      if (r.found) return { ok: true }
      if (!r.erro) return { ok: false }
      erro = r.erro
    }
    return { ok: false, erro }
  },
  readPhone: async (phoneNumberId, tokens) => {
    let erro = 'sem token'
    for (const t of tokens) {
      const r = await graph(`${phoneNumberId}?fields=display_phone_number,verified_name`, t)
      if (r.ok) return { ok: true, display_phone_number: r.body.display_phone_number, verified_name: r.body.verified_name }
      erro = gErr(r.body)
    }
    return { ok: false, erro }
  },
  subscribe: async (wabaId, tokens) => {
    let erro = 'sem token'
    for (const t of tokens) {
      const r = await graph(`${wabaId}/subscribed_apps`, t, { method: 'POST' })
      if (r.body?.success) return { ok: true }
      erro = gErr(r.body)
      console.warn('[embedded-signup] subscribed_apps sem sucesso:', erro)
    }
    return { ok: false, erro }
  },
  metaState: readMetaPhoneState,
  smbSync: requestSmbAppSync,
  save: async row => {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('whatsapp_phone_numbers').upsert(row, { onConflict: 'institution_id' })
    if (error) return error.message
    // espelho nas colunas legadas (fallback do roteamento do webhook)
    await supabase.from('institutions').update({
      whatsapp_phone_id: row.phone_number_id, whatsapp_phone_number: row.phone_number,
      whatsapp_display_name: row.display_name, whatsapp_connected: true,
    }).eq('id', row.institution_id)
    return null
  },
  audit: writeAudit,
}
