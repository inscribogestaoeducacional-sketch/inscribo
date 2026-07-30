import type { VercelRequest } from '@vercel/node'
import { getSupabaseAdmin, APP_URL } from '../evolution/config.js'

export { getSupabaseAdmin, APP_URL, errorResponse } from '../evolution/config.js'

export const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
export const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
export const GOOGLE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/calendar'

export function oauthRedirectUri(): string {
  return `${APP_URL}/api/google/oauth-callback`
}

// oauth-authorize/oauth-callback são acessados via navegação de página inteira
// (link do navegador / redirect do Google) — o navegador não anexa o header
// Authorization nesses casos, então o token do Supabase trafega via query
// string (?access_token= na ida, ?state= na volta do Google) em vez de header.
// authenticateAdminGeral() aceita ambas as origens para reusar a mesma
// validação (auth.getUser + checagem de role) usada nas rotas protegidas por
// header, como authenticate() em api/evolution/config.ts.
export interface GoogleAuthContext {
  userId: string
  token: string
}

export async function authenticateAdminGeral(req: VercelRequest): Promise<GoogleAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token =
    (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '') ||
    (req.query.access_token as string) ||
    (req.query.state as string) ||
    ''
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabase
    .from('users')
    .select('user_type')
    .eq('id', data.user.id)
    .maybeSingle()

  if (row?.user_type !== 'admin_geral') return null

  return { userId: data.user.id, token }
}
