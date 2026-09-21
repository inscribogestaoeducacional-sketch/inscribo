import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import { readFile, unlink } from 'fs/promises'

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

// Tetos reais da Meta Cloud API por tipo de mídia — não dá pra passar disso,
// a Meta rejeita o envio (https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media)
const MEDIA_SIZE_LIMITS: Record<'image' | 'video' | 'audio' | 'document', number> = {
  image:    5   * 1024 * 1024,
  video:    16  * 1024 * 1024,
  audio:    16  * 1024 * 1024,
  document: 100 * 1024 * 1024,
}
const MEDIA_TYPE_LABELS: Record<keyof typeof MEDIA_SIZE_LIMITS, string> = {
  image: 'Imagens', video: 'Vídeos', audio: 'Áudios', document: 'Documentos',
}
const formatMB = (bytes: number) => {
  const mb = bytes / (1024 * 1024)
  return (Math.round(mb * 10) / 10).toString().replace(/\.0$/, '')
}
function mediaTypeFromMime(mime: string): keyof typeof MEDIA_SIZE_LIMITS {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'document'
}

// Teto absoluto pro parser (o maior dos quatro, documento) — formidable só
// sabe o mimetype da parte durante o streaming, então o corte por tipo real
// é feito abaixo, depois do parse, já com file.mimetype em mãos.
const MAX_FILE_SIZE = MEDIA_SIZE_LIMITS.document
const UPLOAD_TIMEOUT_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), ms)
    promise.then(
      v => { clearTimeout(timer); resolve(v) },
      err => { clearTimeout(timer); reject(err) }
    )
  })
}

/**
 * POST /api/whatsapp/media
 *
 * Upload a file (multipart/form-data) to the whatsapp-media Supabase Storage
 * bucket and return a permanent public URL that can be used as the `mediaUrl`
 * parameter in /api/whatsapp/send.
 *
 * Body (multipart/form-data):
 *   file            File    — o arquivo em si
 *   institution_id  string? — para namespacing do path
 *   filename        string? — nome original (sobrepõe o nome do arquivo enviado)
 *
 * Response:
 *   { success: true, url: string, path: string }
 *
 * The frontend (WhatsAppHub) should:
 *   1. Montar um FormData com o File direto (sem conversão pra base64)
 *   2. POST to /api/whatsapp/media → get url
 *   3. POST to /api/whatsapp/send  with { type, mediaUrl: url, ... }
 */
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  // ── Auth — mesmo padrão de api/whatsapp/send.ts. Feita antes do parse do
  // multipart (form.parse abaixo), pra não gastar tempo/banda processando
  // upload de quem não está autenticado. Tenta primeiro como usuário de
  // escola (institution_id efetivo vem da própria sessão, nunca do campo
  // institution_id do form — que existia antes só de nome, sem checagem
  // nenhuma); se não resolver institutionId (ex.: admin_geral/consultant,
  // que não têm institution_id na tabela users), cai pro papel de Super
  // Admin, mesmo exigido pra abrir o Inbox Áion.
  let sessionInstitutionId: string | null = null
  try {
    const instAuth = await authenticateInstitutionUser(req)
    if (instAuth) {
      sessionInstitutionId = instAuth.institutionId
    } else {
      const superAuth = await authenticateSuperAdmin(req)
      if (!superAuth) return res.status(403).json({ error: 'Não autenticado.' })
    }
  } catch (authErr: any) {
    console.error('❌ Media auth error:', authErr)
    return res.status(500).json({ error: 'Erro ao autenticar requisição' })
  }

  try {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE, maxFiles: 1 })
    const { fields, files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err)
        resolve({ fields, files })
      })
    })

    const field = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v
    // institution_id do form field é ignorado pra montar o path (aceito só
    // por compatibilidade, caso algum chamador ainda o envie) — o valor real
    // é sempre sessionInstitutionId, resolvido acima a partir da sessão.
    const filenameField  = field(fields.filename as any)

    const fileField = files.file
    const file = Array.isArray(fileField) ? fileField[0] : fileField

    if (!file) {
      return res.status(400).json({ error: 'file é obrigatório' })
    }

    const mimetype = file.mimetype || 'application/octet-stream'

    const mediaType = mediaTypeFromMime(mimetype)
    const typeLimit = MEDIA_SIZE_LIMITS[mediaType]
    if (file.size > typeLimit) {
      await unlink(file.filepath).catch(() => {})
      return res.status(413).json({
        error: `${MEDIA_TYPE_LABELS[mediaType]} podem ter até ${formatMB(typeLimit)}MB — esse arquivo tem ${formatMB(file.size)}MB.`,
      })
    }

    const pathPrefix = sessionInstitutionId || 'aion'
    const ext = mimetype.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin'
    const safeName = (filenameField || file.originalFilename || `upload.${ext}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100) // cap length
    const storagePath = `${pathPrefix}/${Date.now()}_${safeName}`

    const buffer = await readFile(file.filepath)

    const { error: uploadErr } = await withTimeout(
      supabase.storage.from('whatsapp-media').upload(storagePath, buffer, { contentType: mimetype, upsert: false }),
      UPLOAD_TIMEOUT_MS,
      'Timeout ao subir arquivo para o Storage'
    )

    if (uploadErr) {
      console.error('❌ Storage upload error:', uploadErr.message)
      return res.status(500).json({ error: `Erro ao fazer upload: ${uploadErr.message}` })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    return res.status(200).json({ success: true, url: publicUrl, path: storagePath })

  } catch (err: any) {
    if (err?.code === 1016 || err?.httpCode === 413) {
      // Formidable abortou o streaming antes do parse terminar — o arquivo já
      // passou do teto absoluto (documento, o maior dos quatro tipos). O corte
      // por tipo específico (imagem/vídeo/áudio) acontece depois do parse, ver acima.
      return res.status(413).json({ error: `Arquivo excede o limite máximo de ${formatMB(MAX_FILE_SIZE)}MB.` })
    }
    console.error('❌ Media upload error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
