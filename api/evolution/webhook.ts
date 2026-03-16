import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const institution_id = req.query.institution_id as string
  const body = req.body

  console.log('[webhook] institution_id:', institution_id)
  console.log('[webhook] event:', body?.event)
  console.log('[webhook] body:', JSON.stringify(body).slice(0, 500))

  const event = (body?.event || '').toLowerCase().replace('.', '_')

  if (event === 'messages_upsert') {
    const msg = body?.data
    const key = msg?.key
    const message = msg?.message || {}
    const msgType = Object.keys(message)[0] || 'conversation'

    // Skip status broadcasts only; groups (@g.us) are now saved and shown in hub
    const remoteJid: string = key?.remoteJid || ''
    if (remoteJid === 'status@broadcast') {
      return res.status(200).json({ status: 'ok' })
    }

    // Extract content based on message type
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
      ? new Date(msg.messageTimestamp * 1000).toISOString()
      : new Date().toISOString()

    console.log('[webhook] saving message:', key?.id, 'from:', remoteJid, 'content:', content)

    // Download media and upload to Supabase Storage
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage']
    if (mediaTypes.includes(msgType) && institution_id && key?.id) {
      try {
        const mediaRes = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${body.instance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_KEY },
          body: JSON.stringify({ message: msg.message, convertToMp4: false })
        })
        if (mediaRes.ok) {
          const mediaData = await mediaRes.json()
          if (mediaData.base64) {
            const buffer = Buffer.from(mediaData.base64, 'base64')
            const mimeType = mediaData.mimetype || 'application/octet-stream'
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
            const storagePath = `${institution_id}/${key.id}.${ext}`
            const { error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, buffer, { contentType: mimeType, upsert: true })
            if (!uploadError) {
              const { data: publicUrlData } = supabase.storage
                .from('whatsapp-media')
                .getPublicUrl(storagePath)
              media_url = publicUrlData.publicUrl
            }
          }
        }
      } catch (e) {
        console.error('[webhook] media upload error:', e)
      }
    }

    // Try to find matching lead by phone number
    const phoneDigits = remoteJid.replace(/\D/g, '').replace(/^55/, '')
    let lead_id: string | null = null
    if (institution_id && phoneDigits.length >= 8) {
      const { data: leads } = await supabase
        .from('leads')
        .select('id, phone')
        .eq('institution_id', institution_id)
        .limit(100)
      if (leads) {
        const match = leads.find((l: { id: string; phone?: string }) => l.phone && l.phone.replace(/\D/g, '').endsWith(phoneDigits.slice(-8)))
        if (match) lead_id = match.id
      }
    }

    const { error } = await supabase.from('whatsapp_messages').upsert({
      institution_id,
      instance_name: body?.instance,
      remote_jid: remoteJid,
      message_id: key?.id,
      from_me: key?.fromMe ?? false,
      message_type: msgType,
      content,
      media_url,
      contact_name,
      lead_id,
      timestamp,
    }, { onConflict: 'message_id' })

    if (error) {
      console.error('[webhook] supabase error:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log('[webhook] saved successfully')

    // Upsert conversation record
    await supabase.from('whatsapp_conversations').upsert({
      institution_id,
      remote_jid: remoteJid,
      contact_name: contact_name || null,
      lead_id,
      last_message_at: timestamp,
    }, { onConflict: 'institution_id,remote_jid' })

    // Increment unread count for received messages
    if (!key?.fromMe) {
      await supabase.rpc('increment_conversation_unread', {
        p_institution_id: institution_id,
        p_remote_jid: remoteJid,
      })
    }

    // Log conversation event for received messages
    if (!key?.fromMe && institution_id) {
      void Promise.resolve(supabase.from('whatsapp_conversation_events').insert({
        institution_id,
        remote_jid: remoteJid,
        event_type: 'message_received',
        description: `Mensagem recebida${contact_name ? ` de ${contact_name}` : ''}`,
        created_at: timestamp,
      })).catch(() => {})
    }
  }

  res.status(200).json({ status: 'ok' })
}
