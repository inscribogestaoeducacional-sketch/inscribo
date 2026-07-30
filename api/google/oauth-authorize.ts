import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_SCOPE,
  oauthRedirectUri,
  authenticateAdminGeral,
  errorResponse,
} from './config.js'

// Inicia o fluxo OAuth: redireciona para a tela de consentimento do Google.
// Chamado via navegação de página inteira (não fetch), por isso o token de
// sessão do Supabase vem em ?access_token= na query, não no header Authorization.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await authenticateAdminGeral(req)
  if (!auth) {
    return errorResponse(res, 403, 'Apenas administradores gerais podem conectar o Google Calendar')
  }

  if (!GOOGLE_OAUTH_CLIENT_ID) {
    return errorResponse(res, 500, 'GOOGLE_OAUTH_CLIENT_ID não configurado')
  }

  // access_type=offline + prompt=consent são obrigatórios para garantir que o
  // Google retorne um refresh_token (sem prompt=consent, só vem na primeira
  // autorização; com ele, vem sempre — necessário para reconectar).
  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: oauthRedirectUri(),
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: auth.token,
  })

  res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  res.end()
}
