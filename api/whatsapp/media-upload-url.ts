import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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
    const { institution_id, filename } = req.body ?? {}
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'filename é obrigatório' })
    }

    const pathPrefix = institution_id || 'aion'
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
