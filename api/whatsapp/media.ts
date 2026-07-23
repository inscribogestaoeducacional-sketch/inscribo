import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import formidable from 'formidable'
import { readFile } from 'fs/promises'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB — sem base64, sem inflação de 33%
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

  try {
    const form = formidable({ maxFileSize: MAX_FILE_SIZE, maxFiles: 1 })
    const { fields, files } = await new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err)
        resolve({ fields, files })
      })
    })

    const field = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v
    const institution_id = field(fields.institution_id as any)
    const filenameField  = field(fields.filename as any)

    const fileField = files.file
    const file = Array.isArray(fileField) ? fileField[0] : fileField

    if (!file) {
      return res.status(400).json({ error: 'file é obrigatório' })
    }

    const mimetype = file.mimetype || 'application/octet-stream'
    const pathPrefix = institution_id || 'aion'
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
      return res.status(413).json({ error: `Arquivo excede o limite de ${MAX_FILE_SIZE / (1024 * 1024)}MB` })
    }
    console.error('❌ Media upload error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
