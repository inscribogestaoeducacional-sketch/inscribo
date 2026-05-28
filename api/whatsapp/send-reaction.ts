import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

async function getAccessToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token'])
  const cfg: Record<string, string> = {}
  data?.forEach((r: any) => { cfg[r.key] = r.value })
  return cfg['wa_access_token'] || process.env.WA_ACCESS_TOKEN || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { institution_id, message_id, emoji, remote_jid } = req.body ?? {}

  if (!message_id) return res.status(400).json({ error: 'message_id é obrigatório' })
  if (!remote_jid)  return res.status(400).json({ error: 'remote_jid é obrigatório' })

  try {
    // ── Resolve phone_number_id ──
    let phoneNumberId: string
    let accessToken: string

    if (!institution_id) {
      // AionInbox path: use platform_whatsapp
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
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle()

      if (phoneRecord?.phone_number_id) {
        phoneNumberId = phoneRecord.phone_number_id
      } else {
        const { data: instRecord } = await supabase
          .from('institutions')
          .select('whatsapp_phone_id')
          .eq('id', institution_id)
          .maybeSingle()

        if (!instRecord?.whatsapp_phone_id) {
          return res.status(400).json({ error: 'Número WhatsApp não configurado para esta escola' })
        }
        phoneNumberId = instRecord.whatsapp_phone_id
      }

      accessToken = await getAccessToken(supabase)
      if (!accessToken) {
        return res.status(500).json({ error: 'Access token do WhatsApp não configurado' })
      }
    }

    // Strip @-suffix — Meta API expects plain phone number
    const to = remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')

    // ── Call Meta Cloud API ──
    const metaRes = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type: 'reaction',
        reaction: {
          message_id: message_id,
          emoji:      emoji || '',  // empty string removes the reaction
        },
      }),
    })

    const metaData = await metaRes.json()
    if (!metaRes.ok) {
      console.error('[send-reaction] Meta API error:', metaData)
      return res.status(500).json({ error: metaData.error?.message || 'Erro ao enviar reação' })
    }

    // ── Update DB ──
    await supabase
      .from('whatsapp_messages')
      .update({ reaction_attendant: emoji || null })
      .eq('message_id', message_id)
      .eq('institution_id', institution_id)

    console.log('[send-reaction] reação enviada:', emoji || '(removida)', '→', to, '| msg:', message_id)
    return res.status(200).json({ success: true })

  } catch (err: any) {
    console.error('[send-reaction] erro:', err?.message)
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
}
