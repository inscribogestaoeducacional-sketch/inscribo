// Envia avisos (Web Push) para os aparelhos de uma ou mais pessoas.
// Chamada só pelo banco (push_notify) com o cabeçalho x-push-secret.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: cfg } = await admin.from('push_config').select('*').eq('id', 1).maybeSingle()
  if (!cfg || req.headers.get('x-push-secret') !== cfg.secret) return new Response('forbidden', { status: 401 })

  const { user_ids, title, body, url, tag } = await req.json()
  if (!Array.isArray(user_ids) || !user_ids.length) return new Response(JSON.stringify({ sent: 0 }))

  webpush.setVapidDetails(cfg.subject, cfg.vapid_public, cfg.vapid_private)
  const { data: subs } = await admin.from('push_subscriptions').select('id,endpoint,p256dh,auth').in('user_id', user_ids)
  const payload = JSON.stringify({ title, body, url: url || '/whatsapp', tag: tag || undefined })
  let sent = 0
  await Promise.all((subs ?? []).map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
    }
  }))
  return new Response(JSON.stringify({ sent }), { headers: { 'content-type': 'application/json' } })
})
