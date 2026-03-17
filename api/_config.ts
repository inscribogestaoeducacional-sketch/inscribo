import { createClient } from '@supabase/supabase-js'
import type { VercelResponse } from '@vercel/node'

// ── Environment variables ────────────────────────────────────────────────────
export const EVOLUTION_URL =
  process.env.EVOLUTION_URL ||
  process.env.VITE_EVOLUTION_URL ||
  'https://evolution-api-production-a00c.up.railway.app'

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
