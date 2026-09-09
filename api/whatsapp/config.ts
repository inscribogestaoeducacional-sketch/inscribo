import { createClient } from '@supabase/supabase-js'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// ── Supabase / app config (mesmo papel de api/google/config.ts — client de
// service role compartilhado pelos endpoints de api/whatsapp/*.ts que
// precisam autenticar o usuário chamador, não só o service role) ──
export const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''

export const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
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

export const GRAPH_URL = 'https://graph.facebook.com/v19.0'
export const WA_APP_ID = process.env.WA_APP_ID || ''
export const WA_APP_SECRET = process.env.WA_APP_SECRET || ''

// ── authenticateSchoolAdmin ──────────────────────────────────────────────
// Mesma ideia de api/google/config.ts → authenticateAdminGeral(): valida o
// Bearer token de sessão do Supabase (supabase.auth.getUser) e cruza com a
// tabela `users`. Aqui o papel exigido é o admin de UMA escola (não
// admin_geral da Áion), e o retorno é o institution_id efetivo desse
// usuário — resolvido inteiramente a partir do banco.
//
// Regra de segurança que este endpoint existe pra garantir: o institutionId
// devolvido aqui é a ÚNICA fonte de verdade usada por quem chama esta
// função. Nenhum chamador deve ler institution_id de req.body — isso
// abriria brecha pra uma escola sequestrar a conexão de WhatsApp de outra.
export interface SchoolAdminAuthContext {
  userId: string
  institutionId: string
}

export async function authenticateSchoolAdmin(req: VercelRequest): Promise<SchoolAdminAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabase
    .from('users')
    .select('role, user_type, institution_id, active_institution_id, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!row || !row.active || row.role !== 'admin') return null

  // Gestor de rede: institution_id é NULL no banco — a unidade "efetiva" é
  // a que está selecionada no momento (active_institution_id). Mesma regra
  // de AuthContext.loadUserProfile() no frontend (src/contexts/AuthContext.tsx),
  // replicada aqui pra nunca depender do que o cliente diz que é sua escola.
  const institutionId: string | null = row.user_type === 'gestor_rede'
    ? row.active_institution_id
    : row.institution_id
  if (!institutionId) return null

  return { userId: data.user.id, institutionId }
}
