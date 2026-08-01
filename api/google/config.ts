import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Supabase / app config (duplicado de api/evolution/config.ts antes da
// remoção da integração Evolution — ver commit que apagou api/evolution/) ──
export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

export const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabaseAdmin: any = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSupabaseAdmin(): any {
  if (!_supabaseAdmin) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
    }
    _supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false },
    })
  }
  return _supabaseAdmin
}

export function errorResponse(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

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
// validação (auth.getUser + checagem de role) usada nas outras rotas
// administrativas do projeto, que ficam protegidas por header.
export interface GoogleAuthContext {
  userId: string
  token: string
}

export async function authenticateAdminGeral(req: VercelRequest): Promise<GoogleAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const queryToken = (req.query.access_token as string) || ''
  const stateToken = (req.query.state as string) || ''
  const token = headerToken || queryToken || stateToken || ''
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
