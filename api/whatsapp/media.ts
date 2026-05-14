import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/whatsapp/media
 *
 * Upload a file to the whatsapp-media Supabase Storage bucket and return
 * a permanent public URL that can be used as the `mediaUrl` parameter in
 * /api/whatsapp/send.
 *
 * Body (JSON):
 *   institution_id  UUID    — for path namespacing
 *   base64          string  — base64-encoded file content (no data: prefix)
 *   mimetype        string  — MIME type, e.g. "image/jpeg", "audio/webm"
 *   filename        string? — original filename (used for content-disposition)
 *
 * Response:
 *   { success: true, url: string, path: string }
 *
 * The frontend (WhatsAppHub) should:
 *   1. Convert file to base64 (already done via toBase64())
 *   2. POST to /api/whatsapp/media → get url
 *   3. POST to /api/whatsapp/send  with { type, mediaUrl: url, ... }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { institution_id, base64, mimetype, filename } = req.body

  if (!institution_id || !base64 || !mimetype) {
    return res.status(400).json({ error: 'institution_id, base64 e mimetype são obrigatórios' })
  }

  try {
    const buffer   = Buffer.from(base64, 'base64')
    const ext      = mimetype.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin'
    const safeName = (filename || `upload.${ext}`)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100) // cap length
    const storagePath = `${institution_id}/${Date.now()}_${safeName}`

    const { error: uploadErr } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, buffer, { contentType: mimetype, upsert: false })

    if (uploadErr) {
      console.error('❌ Storage upload error:', uploadErr.message)
      return res.status(500).json({ error: `Erro ao fazer upload: ${uploadErr.message}` })
    }

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    return res.status(200).json({ success: true, url: publicUrl, path: storagePath })

  } catch (err: any) {
    console.error('❌ Media upload error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
