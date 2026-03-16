import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const institution_id = req.query.institution_id as string
  const body = req.body

  console.log('[webhook] institution_id:', institution_id)
  console.log('[webhook] event:', body?.event)
  console.log('[webhook] body:', JSON.stringify(body).slice(0, 500))

  const event = (body?.event || '').toLowerCase().replace('.', '_')

  if (event === 'messages_upsert') {
    const msg = body?.data
    const key = msg?.key
    const message = msg?.message

    console.log('[webhook] saving message:', key?.id)

    const content =
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      message?.imageMessage?.caption ||
      '[mídia]'

    const { error } = await supabase.from('whatsapp_messages').upsert({
      institution_id,
      instance_name: body?.instance,
      remote_jid: key?.remoteJid,
      message_id: key?.id,
      from_me: key?.fromMe ?? false,
      message_type: Object.keys(message || {})[0] || 'text',
      content,
      timestamp: new Date(msg?.messageTimestamp * 1000).toISOString(),
    }, { onConflict: 'message_id' })

    if (error) {
      console.error('[webhook] supabase error:', error)
      return res.status(500).json({ error: error.message })
    }

    console.log('[webhook] saved successfully')
  }

  res.status(200).json({ status: 'ok' })
}
