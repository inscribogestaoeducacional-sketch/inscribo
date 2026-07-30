import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  APP_URL,
  oauthRedirectUri,
  authenticateAdminGeral,
  getSupabaseAdmin,
} from './config.js'

const SETTINGS_URL = `${APP_URL}/super-admin/settings`

function redirectToSettings(res: VercelResponse, status: 'connected' | 'error', message?: string) {
  const params = new URLSearchParams({ google_oauth: status })
  if (message) params.set('message', message)
  res.writeHead(302, { Location: `${SETTINGS_URL}?${params.toString()}` })
  res.end()
}

// Callback do Google: recebe `code`, troca por access_token + refresh_token e
// salva o refresh_token. Chegamos aqui via redirect do servidor do Google, sem
// header Authorization — a identidade/permissão do admin que iniciou o fluxo
// é revalidada a partir do `state` (ver authenticateAdminGeral em ./config.ts).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: googleError } = req.query as Record<string, string | undefined>

  if (googleError) {
    return redirectToSettings(res, 'error', 'Autorização cancelada no Google')
  }
  if (!code || !state) {
    return redirectToSettings(res, 'error', 'Parâmetros inválidos no retorno do Google')
  }

  const auth = await authenticateAdminGeral(req)
  if (!auth) {
    return redirectToSettings(res, 'error', 'Sessão expirada — faça login novamente e tente reconectar')
  }

  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) {
    return redirectToSettings(res, 'error', 'GOOGLE_OAUTH_CLIENT_ID/SECRET não configurados')
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
        redirect_uri: oauthRedirectUri(),
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Falha ao trocar code por tokens')
    }

    const refreshToken = tokenData.refresh_token as string | undefined
    if (!refreshToken) {
      throw new Error('Google não retornou refresh_token — revogue o acesso em myaccount.google.com/permissions e tente novamente')
    }

    const supabase = getSupabaseAdmin()
    const { error: dbError } = await supabase
      .from('platform_settings')
      .upsert({ key: 'google_oauth_refresh_token', value: refreshToken }, { onConflict: 'key' })
    if (dbError) throw new Error(dbError.message)

    return redirectToSettings(res, 'connected')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[google/oauth-callback]', message)
    return redirectToSettings(res, 'error', message)
  }
}
