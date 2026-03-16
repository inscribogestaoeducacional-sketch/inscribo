import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const institution_id = req.query.institution_id as string
  if (!institution_id) return res.status(400).json({ error: 'Missing institution_id' })

  const { event, data } = req.body
  if (event !== 'MESSAGES_UPSERT' || !data) return res.status(200).json({ ok: true })

  const key = data.key || {}
  const remoteJid: string = key.remoteJid || ''
  const fromMe: boolean = !!key.fromMe

  // Skip group messages and status broadcasts
  if (remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') {
    return res.status(200).json({ ok: true })
  }

  const msgType: string = data.messageType || 'conversation'
  const msgObj = data.message || {}
  const content: string =
    msgObj.conversation ||
    msgObj.extendedTextMessage?.text ||
    msgObj.imageMessage?.caption ||
    msgObj.videoMessage?.caption ||
    `[${msgType}]`

  const supabase = createClient(supabaseUrl, supabaseKey)

  const timestamp = data.messageTimestamp
    ? new Date(data.messageTimestamp * 1000).toISOString()
    : new Date().toISOString()

  const { error } = await supabase.from('whatsapp_messages').upsert({
    institution_id,
    remote_jid: remoteJid,
    from_me: fromMe,
    message_id: key.id || null,
    message_type: msgType,
    content,
    timestamp,
  }, { onConflict: 'message_id' })

  if (error) console.error('webhook insert error:', error)

  return res.status(200).json({ ok: true })
}
