import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ── Auth inline — cópia de api/_lib/whatsappAuth.ts, sem import cross-file.
// Vercel apresentou ERR_MODULE_NOT_FOUND pra esse import em produção mesmo
// com o arquivo corretamente commitado/rastreado (nenhuma causa encontrada
// em git/.gitignore/.vercelignore/vercel.json) — suspeita de cache de build
// desatualizado no file-tracing da Vercel. Copiado aqui pra eliminar
// qualquer dependência de resolução de módulo entre arquivos de api/.
// api/_lib/whatsappAuth.ts continua existindo e sendo usado por
// embedded-signup.ts/template-definitions.ts.
let _authSupabaseAdmin: ReturnType<typeof createClient> | null = null
function getAuthSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!_authSupabaseAdmin) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
    _authSupabaseAdmin = createClient(url, key, { auth: { persistSession: false } })
  }
  return _authSupabaseAdmin
}

interface InstitutionUserAuthContext {
  userId: string
  institutionId: string
  role: string | null
}

async function authenticateInstitutionUser(req: VercelRequest): Promise<InstitutionUserAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = getAuthSupabaseAdmin()
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabaseAuth
    .from('users')
    .select('role, user_type, institution_id, active_institution_id, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!row || !row.active) return null

  const institutionId: string | null = row.user_type === 'gestor_rede'
    ? row.active_institution_id
    : row.institution_id
  if (!institutionId) return null

  return { userId: data.user.id, institutionId, role: row.role ?? null }
}

interface SuperAdminAuthContext {
  userId: string
}

async function authenticateSuperAdmin(req: VercelRequest): Promise<SuperAdminAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = getAuthSupabaseAdmin()
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabaseAuth
    .from('users')
    .select('user_type, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!row || row.active === false) return null
  if (!['admin_geral', 'consultant'].includes(row.user_type as string)) return null

  return { userId: data.user.id }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/whatsapp/media-upload-url
 *
 * Gera uma signed upload URL do Supabase Storage (bucket whatsapp-media) pro
 * navegador do atendente subir o arquivo DIRETO pro Storage — sem passar
 * pelos bytes do arquivo pelo servidor Vercel, que tem um teto de payload de
 * requisição de ~4.5MB pra Serverless Functions (@vercel/node) que não dá
 * pra configurar via código (é limite de plataforma, aplicado antes do
 * handler rodar). Esse endpoint só recebe nome do arquivo (payload minúsculo,
 * nunca o arquivo em si), então nunca esbarra nesse teto — documento de
 * 100MB, vídeo de 16MB etc. sobem direto do navegador pro Storage.
 *
 * Body (JSON):
 *   institution_id  string? — namespacing do path (ausente = 'aion', inbox interno)
 *   filename        string  — nome original do arquivo
 *
 * Response:
 *   { path: string, token: string, publicUrl: string }
 *
 * O frontend usa { path, token } com
 *   supabase.storage.from('whatsapp-media').uploadToSignedUrl(path, token, file)
 * pra subir direto, e manda `publicUrl` pro /api/whatsapp/send como mediaUrl
 * — a Meta Cloud API busca o arquivo desse link ela mesma (o nosso servidor
 * nunca reenvia os bytes pra Meta, só o link).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { filename } = req.body ?? {}
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename é obrigatório' })
    }

    // ── Auth — mesmo padrão de api/whatsapp/send.ts. institution_id do
    // corpo é ignorado pra montar o path (aceito só por compatibilidade,
    // caso algum chamador ainda o envie) — o path é sempre resolvido a
    // partir da sessão, nunca de um campo confiado cegamente do body. Tenta
    // primeiro como usuário de escola; se não resolver institutionId (ex.:
    // admin_geral/consultant, sem institution_id na tabela users), cai pro
    // papel de Super Admin, mesmo exigido pra abrir o Inbox Áion.
    let sessionInstitutionId: string | null = null
    const instAuth = await authenticateInstitutionUser(req)
    if (instAuth) {
      sessionInstitutionId = instAuth.institutionId
    } else {
      const superAuth = await authenticateSuperAdmin(req)
      if (!superAuth) return res.status(403).json({ error: 'Não autenticado.' })
    }

    const pathPrefix = sessionInstitutionId || 'aion'
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    const storagePath = `${pathPrefix}/${Date.now()}_${safeName}`

    const { data, error } = await supabase.storage
      .from('whatsapp-media')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('❌ createSignedUploadUrl error:', error?.message)
      return res.status(500).json({ error: error?.message || 'Erro ao gerar URL de upload' })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    return res.status(200).json({ path: data.path, token: data.token, publicUrl })
  } catch (err: any) {
    console.error('❌ media-upload-url error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
