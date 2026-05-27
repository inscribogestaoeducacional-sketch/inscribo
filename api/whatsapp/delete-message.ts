import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// NOTE: Meta Cloud API v19+ does NOT expose an endpoint that deletes a message
// on the recipient's side. The only available action is to mark it as read.
// Therefore, deletion is local-only: we update our DB and the hub UI reflects it.
// The message remains visible in the customer's WhatsApp app.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { institution_id, message_id } = req.body ?? {}

  if (!message_id) return res.status(400).json({ error: 'message_id é obrigatório' })

  try {
    // Build a scoped query: if institution_id is provided, scope to it so RLS is respected
    let query = supabase
      .from('whatsapp_messages')
      .update({ content: '🚫 Mensagem apagada', message_type: 'deleted' })
      .eq('message_id', message_id)

    if (institution_id) {
      query = query.eq('institution_id', institution_id) as typeof query
    }

    const { error: dbErr } = await query

    if (dbErr) {
      console.error('[delete-message] DB update error:', dbErr.message)
      return res.status(500).json({ error: 'Erro ao marcar mensagem no banco' })
    }

    console.log('[delete-message] mensagem marcada como apagada no hub:', message_id)
    // hub_only: true signals to the frontend that deletion is local-only
    return res.status(200).json({ success: true, hub_only: true })

  } catch (err: any) {
    console.error('[delete-message] erro:', err?.message)
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
}
