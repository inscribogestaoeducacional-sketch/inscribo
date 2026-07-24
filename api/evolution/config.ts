import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Environment variables ────────────────────────────────────────────────────
export const EVOLUTION_URL =
  process.env.EVOLUTION_URL ||
  process.env.VITE_EVOLUTION_URL ||
  'http://192.145.37.67:8080'

export const EVOLUTION_KEY =
  process.env.EVOLUTION_KEY ||
  process.env.VITE_EVOLUTION_KEY ||
  ''

export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  ''

// Stable production domain — never use VERCEL_URL for webhooks (it changes per deployment)
export const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  ''

// ── Supabase admin client (service role — bypasses RLS) ──────────────────────
// typed as `any` so callers aren't constrained by generated schema types
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

// ── Evolution API headers ────────────────────────────────────────────────────
export function evolutionHeaders(extra?: Record<string, string>) {
  return { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY, ...extra }
}

// ── Look up the Evolution instance name for a given institution ──────────────
export async function getInstanceForInstitution(institutionId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('institutions')
    .select('evolution_instance')
    .eq('id', institutionId)
    .single()
  if (error || !data?.evolution_instance) return null
  return data.evolution_instance as string
}

// ── Standard error response ──────────────────────────────────────────────────
export function errorResponse(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

// ── Auth: valida o JWT do Supabase e resolve o perfil do usuário ─────────────
export interface AuthContext {
  userId: string
  role: string | null
  userType: string | null
  institutionId: string | null
  isSuperAdmin: boolean
}

export async function authenticate(req: VercelRequest): Promise<AuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabase
    .from('users')
    .select('role, user_type, institution_id')
    .eq('id', data.user.id)
    .maybeSingle()

  return {
    userId: data.user.id,
    role: row?.role ?? null,
    userType: row?.user_type ?? null,
    institutionId: row?.institution_id ?? null,
    isSuperAdmin: row?.user_type === 'admin_geral',
  }
}

// Qualquer membro autenticado da própria instituição (ou super admin) — operação normal
export function hasInstitutionAccess(auth: AuthContext, institutionId: string | null | undefined): boolean {
  if (auth.isSuperAdmin) return true
  if (!institutionId) return false
  return auth.institutionId === institutionId
}

// Admin/gestor daquela instituição especificamente (ou super admin) — ações sensíveis de infra
// (criar/apagar instância, reconfigurar webhook)
export function hasInstitutionAdminAccess(auth: AuthContext, institutionId: string | null | undefined): boolean {
  if (auth.isSuperAdmin) return true
  if (!institutionId || auth.institutionId !== institutionId) return false
  return auth.role === 'admin' || auth.role === 'manager'
}

// ── Look up institution_id a partir do nome da instância Evolution (reverso de getInstanceForInstitution) ──
export async function getInstitutionForInstance(instanceName: string): Promise<string | null> {
  const supabase = getSupabaseAdmin()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('institutions')
    .select('id')
    .eq('evolution_instance', instanceName)
    .single()
  if (error || !data?.id) return null
  return data.id as string
}

// ── Token compartilhado para validar callbacks do Evolution API (webhook) ────
// O Evolution API não assina o payload — a URL do webhook é registrada por nós
// mesmos (via /webhook/set), então incluímos um token secreto na query string
// e o validamos aqui, no mesmo padrão do wa_verify_token do WhatsApp Cloud API.
export async function getEvolutionWebhookToken(): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'evolution_webhook_token')
    .maybeSingle()
  return data?.value || process.env.EVOLUTION_WEBHOOK_SECRET || ''
}

export function appendWebhookToken(url: string, token: string): string {
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}token=${encodeURIComponent(token)}`
}

// ── Allowlist de hosts para o media-proxy (fecha SSRF) ────────────────────────
// decodedUrl vem de query param controlado pelo cliente — só seguimos em frente
// se o host for a própria Evolution API, o próprio projeto Supabase, ou os CDNs
// de mídia conhecidos do WhatsApp/Meta (mmg.whatsapp.net, pps.whatsapp.net, etc.)
const ALLOWED_MEDIA_HOST_SUFFIXES = ['.whatsapp.net', '.fbcdn.net']

export function isAllowedMediaHost(rawUrl: string): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

  const host = parsed.hostname.toLowerCase()

  const exactAllowed = new Set<string>()
  try { if (EVOLUTION_URL) exactAllowed.add(new URL(EVOLUTION_URL).hostname.toLowerCase()) } catch { /* ignore */ }
  try { if (SUPABASE_URL) exactAllowed.add(new URL(SUPABASE_URL).hostname.toLowerCase()) } catch { /* ignore */ }

  if (exactAllowed.has(host)) return true
  return ALLOWED_MEDIA_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
}
