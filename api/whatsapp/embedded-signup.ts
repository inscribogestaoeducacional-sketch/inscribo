import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSupabaseAdmin,
  errorResponse,
  authenticateSchoolAdmin,
  GRAPH_URL,
  WA_APP_ID,
  WA_APP_SECRET,
} from './config.js'

const META_FETCH_TIMEOUT_MS = 30000
// Fallback caso a resposta da Meta não traga expires_in (não deveria acontecer
// na troca fb_exchange_token, mas evita gravar token_expires_at vazio).
const DEFAULT_LONG_LIVED_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60 // 60 dias

// ── Cadastro Incorporado (Embedded Signup) da Meta ──────────────────────────
// Segunda forma de conectar o WhatsApp de uma escola, além do formulário
// manual que só o superadmin usa (handleSaveWa em AdminSchools.tsx). Chamado
// pelo próprio painel do gestor da escola (Configurações → WhatsApp).
//
// Body esperado: { code, phone_number_id, waba_id }
//   - code: retornado pelo popup FB.login() no frontend.
//   - phone_number_id / waba_id: capturados pelo frontend a partir do evento
//     `WA_EMBEDDED_SIGNUP` que a Meta manda via postMessage durante o fluxo
//     (evita uma chamada extra pra descobrir isso depois).
//
// IMPORTANTE — invariante de segurança: `institution_id` NUNCA é lido de
// req.body. A única fonte de verdade é o retorno de authenticateSchoolAdmin(),
// resolvido a partir do token de sessão do usuário autenticado. Isso é o que
// impede uma escola de gravar/sobrescrever a conexão de WhatsApp de outra —
// ver api/whatsapp/embedded-signup.SECURITY_TEST.md para o roteiro de teste
// manual que verifica isso.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

  const auth = await authenticateSchoolAdmin(req)
  if (!auth) {
    return errorResponse(res, 403, 'Apenas o admin da escola pode conectar o WhatsApp desta instituição')
  }
  const institutionId = auth.institutionId // única fonte de verdade — não usar req.body.institution_id

  const { code, phone_number_id, waba_id } = req.body || {}
  if (!code || !phone_number_id || !waba_id) {
    return errorResponse(res, 400, 'code, phone_number_id e waba_id são obrigatórios')
  }

  if (!WA_APP_ID || !WA_APP_SECRET) {
    return errorResponse(res, 500, 'WA_APP_ID/WA_APP_SECRET não configurados')
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

    return res.status(200).json({
      phone_number_id,
      waba_id,
      phone_number: verifiedPhone,
      display_name: verifiedName,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[embedded-signup] erro:', message)
    return errorResponse(res, 500, message)
  }
}
