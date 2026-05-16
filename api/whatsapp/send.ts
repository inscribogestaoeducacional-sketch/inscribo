import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { getWAConfig } from './_helpers'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

type MsgType = 'text' | 'image' | 'video' | 'audio' | 'document'

// ── Upload base64 to Supabase Storage → return public URL ────────────────────
async function uploadToStorage(
  base64: string,
  mimetype: string,
  filename: string,
  institutionId: string
): Promise<string> {
  const buffer   = Buffer.from(base64, 'base64')
  const ext      = mimetype.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin'
  const safeName = (filename || `upload.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const path     = `${institutionId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from('whatsapp-media')
    .upload(path, buffer, { contentType: mimetype, upsert: false })

  if (error) throw new Error(`Storage upload falhou: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('whatsapp-media')
    .getPublicUrl(path)

  return publicUrl
}

// ── Build Meta Cloud API payload per message type ────────────────────────────
function buildPayload(
  to: string,
  type: MsgType,
  opts: { message?: string; mediaUrl?: string; caption?: string; filename?: string }
): object {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type }

  switch (type) {
    case 'text':
      return { ...base, text: { body: opts.message!, preview_url: false } }
    case 'image':
      return { ...base, image: { link: opts.mediaUrl!, ...(opts.caption ? { caption: opts.caption } : {}) } }
    case 'video':
      return { ...base, video: { link: opts.mediaUrl!, ...(opts.caption ? { caption: opts.caption } : {}) } }
    case 'audio':
      return { ...base, audio: { link: opts.mediaUrl! } }
    case 'document':
      return {
        ...base,
        document: {
          link: opts.mediaUrl!,
          filename: opts.filename || 'documento',
          ...(opts.caption ? { caption: opts.caption } : {}),
        },
      }
  }
}

// ── Content preview for last_message ────────────────────────────────────────
function contentPreview(type: MsgType, message?: string, caption?: string, filename?: string): string {
  if (type === 'text')     return message!
  if (type === 'image')    return caption || '[Imagem]'
  if (type === 'video')    return caption || '[Vídeo]'
  if (type === 'audio')    return '[Áudio]'
  if (type === 'document') return filename ? `[Documento] ${filename}` : '[Documento]'
  return '[Mídia]'
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    institution_id,
    isAionSend   = false,
    to,
    type         = 'text' as MsgType,
    message,               // text only
    mediaUrl,              // pre-uploaded public URL (image/video/audio/document)
    base64,                // alternative: raw base64 file (frontend sends this)
    mimetype,              // required when base64 provided
    filename    = '',
    caption     = '',
    sender_name = '',
    conversation_id,
  } = req.body

  // ── Validation ──
  if (!to)                                 return res.status(400).json({ error: 'to é obrigatório' })
  if (!isAionSend && !institution_id)      return res.status(400).json({ error: 'institution_id é obrigatório para envio de escola' })
  if (type === 'text' && !message)         return res.status(400).json({ error: 'message é obrigatório para type=text' })
  if (type !== 'text' && !mediaUrl && !base64)
    return res.status(400).json({ error: `mediaUrl ou base64 é obrigatório para type=${type}` })

  try {
    let phoneNumberId: string
    let accessToken: string

    if (isAionSend) {
      // ── Áion corporate inbox: fetch credentials from platform_whatsapp ──
      const { data: platformWA, error: platformErr } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id, access_token')
        .eq('connected', true)
        .single()

      if (platformErr || !platformWA) {
        return res.status(400).json({ error: 'WhatsApp da Áion não configurado ou desconectado' })
      }

      phoneNumberId = platformWA.phone_number_id
      accessToken   = platformWA.access_token
    } else {
      // ── School inbox: fetch from whatsapp_phone_numbers ──
      const { data: phoneRecord, error: phoneErr } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .single()

      if (phoneErr || !phoneRecord) {
        return res.status(400).json({ error: 'Número WhatsApp não configurado para esta escola' })
      }

      phoneNumberId = phoneRecord.phone_number_id
      accessToken   = (await getWAConfig()).accessToken
    }

    // ── Resolve media URL (upload if base64 provided) ──
    let resolvedMediaUrl: string | undefined = mediaUrl
    if (type !== 'text' && !resolvedMediaUrl && base64 && mimetype) {
      resolvedMediaUrl = await uploadToStorage(
        base64,
        mimetype,
        filename || `media.${mimetype.split('/')[1] || 'bin'}`,
        institution_id
      )
    }

    // ── Send via Meta Cloud API ──
    const payload = buildPayload(to, type as MsgType, {
      message,
      mediaUrl: resolvedMediaUrl,
      caption:  caption || undefined,
      filename: filename || undefined,
    })

    const metaRes = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    })

    const metaData = await metaRes.json()
    if (!metaRes.ok) {
      console.error('❌ Meta API error:', metaData)
      return res.status(500).json({ error: metaData.error?.message || 'Erro ao enviar mensagem' })
    }

    const wamid   = metaData.messages?.[0]?.id
    const preview = contentPreview(type as MsgType, message, caption, filename)

    // ── Persist message ──
    await supabase.from('whatsapp_messages').insert({
      institution_id:  isAionSend ? null : institution_id,
      remote_jid:      to,
      message_id:      wamid,
      instance_name:   'cloud-api',
      content:         type === 'text' ? message : (caption || preview),
      message_type:    type,
      media_url:       resolvedMediaUrl || null,
      from_me:         true,
      contact_name:    sender_name || null,
      status:          'sent',
      direction:       'outbound',
      is_aion_inbox:   isAionSend,
      timestamp:       new Date().toISOString(),
      ...(conversation_id ? { conversation_id } : {}),
    })

    // ── Update conversation last_message ──
    const convUpdate = supabase
      .from('whatsapp_conversations')
      .update({ last_message: preview, last_message_at: new Date().toISOString() })

    if (conversation_id) {
      await convUpdate.eq('id', conversation_id)
    } else if (isAionSend) {
      await convUpdate.eq('is_aion_inbox', true).eq('remote_jid', to)
    } else {
      await convUpdate.eq('institution_id', institution_id).eq('remote_jid', to)
    }

    return res.status(200).json({ success: true, wamid })

  } catch (err: any) {
    console.error('❌ Send error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
