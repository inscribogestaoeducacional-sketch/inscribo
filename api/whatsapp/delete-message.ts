import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

async function getWAConfig() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token'])
  const cfg: Record<string, string> = {}
  data?.forEach((r: any) => { cfg[r.key] = r.value })
  return { accessToken: cfg['wa_access_token'] || process.env.WA_ACCESS_TOKEN || '' }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { institution_id, message_id, phone_number_id } = req.body ?? {}

  if (!message_id) return res.status(400).json({ error: 'message_id é obrigatório' })

  try {
    // ── Resolve phone_number_id ──────────────────────────────────────────────
    let resolvedPhoneNumberId: string = phone_number_id

    if (!resolvedPhoneNumberId && institution_id) {
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle()

      if (phoneRecord?.phone_number_id) {
        resolvedPhoneNumberId = phoneRecord.phone_number_id
      } else {
        const { data: instRecord } = await supabase
          .from('institutions')
          .select('whatsapp_phone_id')
          .eq('id', institution_id)
          .maybeSingle()
        resolvedPhoneNumberId = instRecord?.whatsapp_phone_id || ''
      }
    }

    if (!resolvedPhoneNumberId) {
      return res.status(400).json({ error: 'phone_number_id não encontrado' })
    }

    // ── Call Meta Cloud API to delete the message ────────────────────────────
    const { accessToken } = await getWAConfig()

    const metaRes = await fetch(
      `${GRAPH_URL}/${resolvedPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status:            'read',            // required wrapper field
          message_id,
        }),
      }
    )

    // Fire-and-forget: even if Meta rejects, we mark it deleted locally
    if (!metaRes.ok) {
      const errBody = await metaRes.json().catch(() => ({}))
      console.warn('[delete-message] Meta API warn:', metaRes.status, JSON.stringify(errBody))
    }

    // ── Mark deleted in DB ───────────────────────────────────────────────────
    const { error: dbErr } = await supabase
      .from('whatsapp_messages')
      .update({ content: '🚫 Mensagem apagada', message_type: 'deleted' })
      .eq('message_id', message_id)

    if (dbErr) {
      console.error('[delete-message] DB update error:', dbErr.message)
      return res.status(500).json({ error: 'Erro ao marcar mensagem no banco' })
    }

    console.log('[delete-message] mensagem apagada:', message_id)
    return res.status(200).json({ success: true })

  } catch (err: any) {
    console.error('[delete-message] erro:', err?.message)
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
}
