// @ts-nocheck
// Lembrete da avaliação e Conversa parada (ver logic.ts). Chamada a cada 5 minutos pelo pg_cron.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { runFollowups } from './logic.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('APP_SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('APP_SERVICE_ROLE_KEY')!
const GRAPH = 'https://graph.facebook.com/v25.0'

serve(async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const { data: tok } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
    const token = tok?.value || ''
    const phones = new Map<string, string | null>()

    const send = async ({ institutionId, to, remoteJid, text, automation }) => {
      if (!token) return { ok: false }
      if (!phones.has(institutionId)) {
        const { data } = await sb.from('whatsapp_phone_numbers').select('phone_number_id')
          .eq('institution_id', institutionId).eq('is_active', true).limit(1).maybeSingle()
        phones.set(institutionId, data?.phone_number_id || null)
      }
      const phoneId = phones.get(institutionId)
      if (!phoneId) return { ok: false }
      const resp = await fetch(`${GRAPH}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
      })
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        console.error('[whatsapp-followups] Meta recusou', to, resp.status, JSON.stringify(err).slice(0, 300))
        return { ok: false, permanent: resp.status >= 400 && resp.status < 500 && resp.status !== 429 }
      }
      const d = await resp.json().catch(() => ({}))
      await sb.from('whatsapp_messages').insert({
        institution_id: institutionId, remote_jid: remoteJid, message_id: d.messages?.[0]?.id,
        instance_name: 'cloud-api', content: text, message_type: 'text',
        from_me: true, contact_name: '_bot_', is_bot_message: true, automation,
        status: 'sent', direction: 'outbound', timestamp: new Date().toISOString(),
      })
      return { ok: true }
    }

    const result = await runFollowups(sb, send)
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[whatsapp-followups]', e)
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500 })
  }
})
