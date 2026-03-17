import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EVOLUTION_URL,
  evolutionHeaders,
  getSupabaseAdmin,
} from '../_config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Respond immediately so Evolution doesn't retry
  res.status(200).json({ status: 'ok' })

  const body = req.body
  const event = ((body?.event || '') as string).toLowerCase().replace('.', '_')

  // institution_id can come from query param (set when we registered the webhook URL)
  // or from the body itself
  let institution_id = (req.query.institution_id as string) || body?.institution_id || null

  // If not in query, look up institution by the instance name
  if (!institution_id && body?.instance) {
    try {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase
        .from('institutions')
        .select('id')
        .eq('evolution_instance', body.instance)
        .single()
      if (data?.id) institution_id = data.id as string
    } catch (_) { /* not found */ }
  }

  console.log('[webhook] event:', event, '| institution:', institution_id, '| instance:', body?.instance)

  // ── CONNECTION_UPDATE ────────────────────────────────────────────────────
  if (event === 'connection_update' && institution_id) {
    const state = body?.data?.state || ''
    const connected = state === 'open'
    try {
      const supabase = getSupabaseAdmin()
      await supabase
        .from('institutions')
        .update({ whatsapp_connected: connected } as never)
        .eq('id', institution_id)
    } catch (e) {
      console.error('[webhook] connection_update save error:', e)
    }
    return
  }

  // ── MESSAGES_UPSERT ──────────────────────────────────────────────────────
  if (event === 'messages_upsert') {
    if (!institution_id) {
      console.warn('[webhook] messages_upsert without institution_id — skipping')
      return
    }

    const msg = body?.data
    const key = msg?.key
    const message = msg?.message || {}
    const msgType = Object.keys(message)[0] || 'conversation'
    const remoteJid: string = key?.remoteJid || ''

    // Skip status broadcasts and groups
    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return

    // Extract content
    let content = '[mídia]'
    let media_url: string | null = null

    if (message.conversation) {
      content = message.conversation
    } else if (message.extendedTextMessage?.text) {
      content = message.extendedTextMessage.text
    } else if (message.imageMessage) {
      content = message.imageMessage.caption || '[Imagem]'
      media_url = message.imageMessage.url || null
    } else if (message.audioMessage) {
      content = '[Áudio]'
      media_url = message.audioMessage.url || null
    } else if (message.pttMessage) {
      content = '[Áudio]'
      media_url = message.pttMessage.url || null
    } else if (message.videoMessage) {
      content = message.videoMessage.caption || '[Vídeo]'
      media_url = message.videoMessage.url || null
    } else if (message.documentMessage) {
      content = message.documentMessage.fileName || '[Documento]'
      media_url = message.documentMessage.url || null
    } else if (message.stickerMessage) {
      content = '[Figurinha]'
    }

    const contact_name = key?.fromMe ? null : (msg?.pushName || null)
    const timestamp = msg?.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()

    // Try to upload media to Supabase Storage for persistence
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'pttMessage']
    if (mediaTypes.includes(msgType) && key?.id) {
      try {
        const supabase = getSupabaseAdmin()
        const b64Res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${body.instance}`, {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({ message: msg.message, convertToMp4: false }),
          signal: AbortSignal.timeout(12000),
        })
        if (b64Res.ok) {
          const b64Data = await b64Res.json()
          const base64 = b64Data.base64 || b64Data.data
          if (base64) {
            const mimeType = b64Data.mimetype || 'application/octet-stream'
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
            const storagePath = `${institution_id}/${key.id}.${ext}`
            const { error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, Buffer.from(base64, 'base64'), { contentType: mimeType, upsert: true })
            if (!uploadError) {
              const { data: pub } = supabase.storage.from('whatsapp-media').getPublicUrl(storagePath)
              media_url = pub.publicUrl
            }
          }
        }
      } catch (e) {
        console.warn('[webhook] media upload error:', (e as Error).message)
      }
    }

    // Match lead by phone
    const phoneDigits = remoteJid.replace(/\D/g, '').replace(/^55/, '')
    let lead_id: string | null = null
    if (phoneDigits.length >= 8) {
      try {
        const supabase = getSupabaseAdmin()
        const { data: leads } = await supabase
          .from('leads')
          .select('id, phone')
          .eq('institution_id', institution_id)
          .limit(200)
        if (leads) {
          const match = leads.find((l: { id: string; phone?: string }) =>
            l.phone && l.phone.replace(/\D/g, '').endsWith(phoneDigits.slice(-8))
          )
          if (match) lead_id = match.id as string
        }
      } catch (_) { /* lead lookup optional */ }
    }

    try {
      const supabase = getSupabaseAdmin()

      // Upsert message — idempotent by message_id (TEXT), not id (UUID)
      const { error: msgErr } = await supabase.from('whatsapp_messages').upsert({
        message_id:     key?.id,
        institution_id,
        instance_name:  body?.instance,
        remote_jid:     remoteJid,
        from_me:        key?.fromMe ?? false,
        message_type:   msgType,
        content,
        media_url,
        contact_name,
        lead_id,
        timestamp,
        raw_data:       msg,
      }, { onConflict: 'message_id' })

      if (msgErr) console.error('[webhook] upsert message error:', msgErr)

      // Upsert conversation
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('status')
        .eq('institution_id', institution_id)
        .eq('remote_jid', remoteJid)
        .single()

      const isNew = !existingConv
      const shouldReopen = existingConv?.status === 'closed'

      await supabase.from('whatsapp_conversations').upsert({
        institution_id,
        remote_jid: remoteJid,
        contact_name: contact_name || null,
        lead_id,
        last_message_at: timestamp,
        ...(isNew && { status: 'waiting' }),
        ...(shouldReopen && { status: 'waiting', assigned_user_id: null, assigned_user_name: null }),
      }, { onConflict: 'institution_id,remote_jid' })

      // Increment unread count for inbound messages
      if (!key?.fromMe) {
        await supabase.rpc('increment_conversation_unread', {
          p_institution_id: institution_id,
          p_remote_jid: remoteJid,
        }).catch(() => {})

        // Log event
        void supabase.from('whatsapp_conversation_events').insert({
          institution_id,
          remote_jid: remoteJid,
          event_type: 'message_received',
          description: `Mensagem recebida${contact_name ? ` de ${contact_name}` : ''}`,
          created_at: timestamp,
        }).catch(() => {})
      }
    } catch (e) {
      console.error('[webhook] db error:', e)
    }
  }
}
