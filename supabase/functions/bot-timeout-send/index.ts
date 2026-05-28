// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Buscar itens não enviados da fila
  const { data: queueItems, error: queueError } = await supabase
    .from('bot_timeout_queue')
    .select('id, institution_id, remote_jid, message')
    .eq('sent', false)
    .order('created_at', { ascending: true })
    .limit(50)

  if (queueError) {
    console.error('[bot-timeout-send] Erro ao ler fila:', queueError.message)
    return new Response(JSON.stringify({ error: queueError.message }), { status: 500 })
  }

  if (!queueItems?.length) {
    return new Response(
      JSON.stringify({ processed: 0, sent: 0, failed: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 2. Buscar token global da Meta API
  const { data: tokenRow } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', 'wa_access_token')
    .maybeSingle()

  const token = tokenRow?.value || ''

  let sent   = 0
  let failed = 0

  for (const item of queueItems) {
    try {
      // 3. Buscar phone_number_id da escola
      const { data: phoneData } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', item.institution_id)
        .eq('is_active', true)
        .maybeSingle()

      if (!phoneData?.phone_number_id || !token) {
        console.warn('[bot-timeout-send] Sem phone_number_id ou token para institution:', item.institution_id)
        failed++
        continue
      }

      // 4. Limpar número de destino (remover sufixo @s.whatsapp.net)
      const to = item.remote_jid
        .replace(/@s\.whatsapp\.net$/, '')
        .replace(/@.*/, '')
        .replace(/\D/g, '')

      // 5. Enviar mensagem via Meta Cloud API
      const apiRes = await fetch(
        `https://graph.facebook.com/v18.0/${phoneData.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: item.message },
          }),
        }
      )

      if (!apiRes.ok) {
        const errBody = await apiRes.json().catch(() => ({}))
        console.error('[bot-timeout-send] Meta API error para', to, JSON.stringify(errBody))
        failed++
        continue
      }

      const apiData = await apiRes.json()
      const waMessageId = apiData.messages?.[0]?.id

      // 6. Inserir mensagem no histórico
      await supabase.from('whatsapp_messages').insert({
        remote_jid:     item.remote_jid,
        institution_id: item.institution_id,
        from_me:        true,
        message_type:   'text',
        content:        item.message,
        timestamp:      new Date().toISOString(),
        status:         'sent',
        ...(waMessageId ? { message_id: waMessageId } : {}),
      })

      // 7. Marcar como enviado na fila
      await supabase
        .from('bot_timeout_queue')
        .update({ sent: true })
        .eq('id', item.id)

      sent++
    } catch (err) {
      console.error('[bot-timeout-send] Exceção ao processar item', item.id, err)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ processed: queueItems.length, sent, failed }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
