import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

export const config = { maxDuration: 30 }

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

async function getWAConfig() {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token'])
  const cfg: Record<string, string> = {}
  data?.forEach((r: any) => { cfg[r.key] = r.value })
  return { accessToken: cfg['wa_access_token'] || process.env.WA_ACCESS_TOKEN || '' }
}

async function sendMessage(phoneNumberId: string, to: string, text: string, token: string) {
  try {
    await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    })
  } catch (e) {
    console.error('[timeout-check] sendMessage error:', e)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end()

  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  console.log('[timeout-check] iniciando verificação', new Date().toISOString())

  try {
    const { data: flows } = await supabase
      .from('whatsapp_flows')
      .select('institution_id, timeout_minutes, timeout_group_id, timeout_assignee_id, timeout_assignee_name, timeout_message')
      .eq('is_active', true)
      .not('timeout_minutes', 'is', null)

    if (!flows?.length) {
      return res.status(200).json({ message: 'Nenhum flow com timeout', processed: 0 })
    }

    const waConfig = await getWAConfig()
    let totalTransferred = 0

    for (const flow of flows) {
      const timeoutMs  = (flow.timeout_minutes || 15) * 60 * 1000
      const cutoffTime = new Date(Date.now() - timeoutMs).toISOString()

      const { data: staleConvs } = await supabase
        .from('whatsapp_conversations')
        .select('id, remote_jid, institution_id')
        .eq('institution_id', flow.institution_id)
        .eq('bot_active', true)
        .eq('status', 'waiting')
        .lt('last_message_at', cutoffTime)
        .is('assigned_user_id', null)

      if (!staleConvs?.length) continue

      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', flow.institution_id)
        .eq('is_active', true)
        .maybeSingle()

      for (const conv of staleConvs) {
        let assigneeId:   string | null = null
        let assigneeName: string | null = null

        if (flow.timeout_group_id) {
          const { data: group } = await supabase
            .from('whatsapp_groups')
            .select('*')
            .eq('id', flow.timeout_group_id)
            .maybeSingle()

          if (group?.member_ids?.length) {
            const nextIndex = (group.last_assigned_index + 1) % group.member_ids.length
            assigneeId      = group.member_ids[nextIndex]
            const { data: u } = await supabase
              .from('users').select('full_name').eq('id', assigneeId).maybeSingle()
            assigneeName = (u as any)?.full_name || null
            await supabase.from('whatsapp_groups')
              .update({ last_assigned_index: nextIndex }).eq('id', flow.timeout_group_id)
          }
        } else if (flow.timeout_assignee_id) {
          assigneeId   = flow.timeout_assignee_id
          assigneeName = flow.timeout_assignee_name
        }

        const msg = flow.timeout_message || 'Um momento, estou te conectando com um atendente! 👋'
        if (phoneRecord?.phone_number_id && waConfig.accessToken) {
          await sendMessage(phoneRecord.phone_number_id, conv.remote_jid, msg, waConfig.accessToken)
        }

        await supabase.from('whatsapp_conversations')
          .update({ bot_active: false, status: 'open', assigned_user_id: assigneeId, assigned_user_name: assigneeName })
          .eq('id', conv.id)

        await supabase.from('whatsapp_conversation_events').insert({
          institution_id: flow.institution_id,
          remote_jid:     conv.remote_jid,
          event_type:     'transfer',
          description:    `Transferido por inatividade (${flow.timeout_minutes}min) para ${assigneeName || 'atendente'}`,
        })

        totalTransferred++
        console.log('[timeout-check] transferido:', conv.remote_jid, '→', assigneeName || '(sem atribuição)')
      }
    }

    return res.status(200).json({ message: 'OK', processed: totalTransferred, timestamp: new Date().toISOString() })
  } catch (e: any) {
    console.error('[timeout-check] erro:', e)
    return res.status(500).json({ error: e.message })
  }
}
