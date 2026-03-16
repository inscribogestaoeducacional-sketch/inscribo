import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

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

    // Skip group messages and status broadcasts
    const remoteJid: string = key?.remoteJid || ''
    if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
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
  }

  res.status(200).json({ status: 'ok' })
}
