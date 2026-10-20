import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSupabaseAdmin,
  errorResponse,
  GRAPH_URL,
  WA_APP_ID,
  WA_APP_SECRET,
} from '../_lib/whatsappAuth.js'
import { handleReconnect, handleReconnectEvent, readMetaPhoneState, writeAudit } from '../_lib/whatsappReconnect.js'
import { requestSmbAppSync, summarizeSmbSync } from '../_lib/whatsappSmbSync.js'
import { resolveConnectContext, checkPopupWaba, type ConnectAuthDeps } from '../_lib/whatsappConnectAuth.js'

const META_FETCH_TIMEOUT_MS = 30000
// Fallback caso a resposta da Meta não traga expires_in (não deveria acontecer
// na troca fb_exchange_token, mas evita gravar token_expires_at vazio).
const DEFAULT_LONG_LIVED_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 dias

// ── Cadastro Incorporado (Embedded Signup) da Meta ──────────────────────────
// Segunda forma de conectar o WhatsApp de uma escola, além do formulário
// manual que só o superadmin usa (handleSaveWa em AdminSchools.tsx). Chamado
// pelo painel do gestor da escola (Configurações → WhatsApp) e pela ficha da
// escola no Super Admin (InstitutionDetails → WhatsApp), onde a equipe Áion
// conecta a escola em chamada de vídeo, com a escola lendo o QR code.
//
// Body esperado: { code, phone_number_id, waba_id, institution_id? }
//   - code: retornado pelo popup FB.login() no frontend.
//   - phone_number_id / waba_id: capturados pelo frontend a partir do evento
//     `WA_EMBEDDED_SIGNUP` que a Meta manda via postMessage durante o fluxo
//     (evita uma chamada extra pra descobrir isso depois).
//   - institution_id: só vale para Super Admin.
//
// IMPORTANTE — invariante de segurança (api/_lib/whatsappConnectAuth.ts):
// admin de escola conecta só a própria escola, resolvida pelo token de sessão;
// `institution_id` do corpo só é aceito de Super Admin. Roteiro e teste
// automático em embedded-signup.SECURITY_TEST.md.
export function createEmbeddedSignupHandler(authDeps?: ConnectAuthDeps) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

    const auth = await resolveConnectContext(req, authDeps)
    if ('status' in auth) return errorResponse(res, auth.status, auth.message)
    return connect(req, res, auth.ctx)
  }
}

export default createEmbeddedSignupHandler()

async function connect(req: VercelRequest, res: VercelResponse, ctx: Parameters<typeof handleReconnect>[1]) {
  const { institutionId, userId, actor } = ctx

  // Reconexão em coexistência de escola que já tem número (api/_lib/whatsappReconnect.ts)
  if (req.body?.event) return handleReconnectEvent(res, ctx, req.body)
  if (req.body?.mode === 'reconnect') return handleReconnect(res, ctx, req.body)

  const { code, phone_number_id, waba_id } = req.body || {}
  if (!code || !phone_number_id || !waba_id) {
    return errorResponse(res, 400, 'code, phone_number_id e waba_id são obrigatórios')
  }

  if (!WA_APP_ID || !WA_APP_SECRET) {
    return errorResponse(res, 500, 'WA_APP_ID/WA_APP_SECRET não configurados')
  }

  // Conta (WABA) do popup: nunca troca a já salva da escola nem aceita a de
  // teste da plataforma. Recusa antes de qualquer chamada à Meta ou gravação.
  {
    const supabase = getSupabaseAdmin()
    const [{ data: saved }, { data: platformWaba }] = await Promise.all([
      supabase.from('whatsapp_phone_numbers').select('id, waba_id, phone_number_id')
        .eq('institution_id', institutionId).maybeSingle(),
      supabase.from('platform_settings').select('value').eq('key', 'wa_waba_id').maybeSingle(),
    ])
    const check = checkPopupWaba(String(waba_id), saved?.waba_id, platformWaba?.value)
    if ('motivo' in check) {
      await writeAudit({
        institutionId, userId, actor, recordId: saved?.id ?? null,
        action: 'Conexão WhatsApp (Meta): recusada',
        fieldChanged: check.motivo,
        oldValue: saved ? `phone_id=${saved.phone_number_id} waba=${saved.waba_id}` : 'sem cadastro anterior',
        newValue: `phone_id=${phone_number_id} waba=${waba_id}`,
      })
      return errorResponse(res, 409, check.message)
    }
  }

  try {
    // ── 1. Troca o code por um token de curta duração (server-to-server) ──
    const shortRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?client_id=${WA_APP_ID}&client_secret=${WA_APP_SECRET}&code=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS) }
    )
    const shortData = await shortRes.json()
    if (!shortRes.ok || !shortData.access_token) {
      throw new Error(shortData?.error?.message || 'Falha ao trocar code por token de acesso')
    }

    // ── 2. Troca pelo long-lived token (~60 dias, escopo sobre o WABA conectado) ──
    const longRes = await fetch(
      `${GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${WA_APP_ID}&client_secret=${WA_APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortData.access_token)}`,
      { signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS) }
    )
    const longData = await longRes.json()
    if (!longRes.ok || !longData.access_token) {
      throw new Error(longData?.error?.message || 'Falha ao gerar token de longa duração')
    }
    const longLivedToken: string = longData.access_token
    const expiresInSeconds: number = longData.expires_in || DEFAULT_LONG_LIVED_TOKEN_TTL_SECONDS
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

    // ── 3. Valida o número (mesma checagem que handleSaveWa já faz hoje) ──
    const verifyRes = await fetch(
      `${GRAPH_URL}/${phone_number_id}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${longLivedToken}` }, signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS) }
    )
    const verifyData = await verifyRes.json()
    if (!verifyRes.ok) {
      throw new Error(verifyData?.error?.message || 'Phone Number ID inválido ou token sem permissão sobre ele')
    }
    const verifiedPhone = verifyData.display_phone_number || ''
    const verifiedName  = verifyData.verified_name || ''

    // ── 4. Assina o app da Áion pra receber webhooks deste WABA ──
    // Mesma chamada que handleSaveWa faz hoje pra WABAs de terceiros
    // (AdminSchools.tsx) — aqui o WABA é sempre "de terceiro" (da escola),
    // então sempre assinamos, usando o próprio token recém-obtido (que já
    // tem permissão sobre esse WABA específico).
    try {
      const subscribeRes = await fetch(`${GRAPH_URL}/${waba_id}/subscribed_apps`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${longLivedToken}` },
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      })
      const subscribeData = await subscribeRes.json()
      if (!subscribeData?.success) {
        console.warn('[embedded-signup] Falha ao inscrever WABA nos webhooks:', subscribeData)
      }
    } catch (e) {
      console.error('[embedded-signup] Erro ao inscrever WABA:', e)
    }

    // ── 5. Upsert — mesmo formato de dado que handleSaveWa grava hoje, mais
    // os campos novos da conexão via Embedded Signup ──
    const supabase = getSupabaseAdmin()
    const { error: upsertErr } = await supabase.from('whatsapp_phone_numbers').upsert({
      institution_id:     institutionId,
      phone_number_id,
      phone_number:        verifiedPhone,
      display_name:        verifiedName,
      waba_id,
      is_active:           true,
      use_meta_api:        true,
      access_token:        longLivedToken,
      connection_method:   'embedded_signup',
      token_expires_at:    tokenExpiresAt,
    }, { onConflict: 'institution_id' })
    if (upsertErr) throw new Error(upsertErr.message)

    // Espelha nas colunas legadas de `institutions`, mesmo comportamento de
    // handleSaveWa — mantém o fallback do webhook (Step B do roteamento)
    // consistente independente de qual dos dois caminhos conectou a escola.
    await supabase.from('institutions').update({
      whatsapp_phone_id:     phone_number_id,
      whatsapp_phone_number: verifiedPhone,
      whatsapp_display_name: verifiedName,
      whatsapp_connected:    true,
    }).eq('id', institutionId)

    // ── 6. Coexistência (número também no app WhatsApp Business) → pede os
    // contatos e o histórico à Meta (api/_lib/whatsappSmbSync.ts) ──
    const meta = await readMetaPhoneState(phone_number_id, longLivedToken)
    const sync = meta.is_on_biz_app === true
      ? await requestSmbAppSync(phone_number_id, [longLivedToken])
      : []

    await writeAudit({
      institutionId, userId, actor,
      action: 'Conexão WhatsApp (Meta): concluída',
      fieldChanged: 'whatsapp_phone_numbers',
      newValue: JSON.stringify({
        tipo: meta.is_on_biz_app === true ? 'coexistencia' : 'cloud_api', por: actor,
        phone_id: phone_number_id, waba: waba_id, numero: verifiedPhone, meta,
        sincronizacao: sync.length ? summarizeSmbSync(sync) : 'não pedida (número fora da coexistência)',
      }),
    })

    return res.status(200).json({
      phone_number_id,
      waba_id,
      phone_number: verifiedPhone,
      display_name: verifiedName,
      sync,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[embedded-signup] erro:', message)
    await writeAudit({
      institutionId, userId, actor,
      action: 'Conexão WhatsApp (Meta): falhou',
      fieldChanged: 'erro',
      oldValue: `phone_id=${phone_number_id} waba=${waba_id}`,
      newValue: message.slice(0, 300),
    })
    return errorResponse(res, 500, message)
  }
}
