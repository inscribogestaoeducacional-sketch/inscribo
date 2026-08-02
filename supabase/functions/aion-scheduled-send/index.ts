import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Envio de template replica api/whatsapp/send-template.ts (adaptado pro
// runtime Deno, mesmo padrão já usado no envio de texto da rodada anterior
// — sendAionMessage() em api/whatsapp/webhook.ts). O caso de uso real é
// reativar contato fora da janela de 24h, onde a Meta exige template
// aprovado; o path de texto livre abaixo fica só como fallback legado, pra
// qualquer linha 'pending' antiga que ainda não tenha template_name.
const GRAPH_URL = 'https://graph.facebook.com/v19.0'
const BATCH_LIMIT = 50

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ClaimedMessage {
  id: string
  conversation_id: string | null
  remote_jid: string
  message_type: string
  content: string
  template_name: string | null
  template_language: string | null
  template_components: unknown[] | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Reivindica o lote atomicamente (UPDATE ... WHERE id IN (SELECT ... FOR
    // UPDATE SKIP LOCKED) dentro de claim_aion_scheduled_messages) — evita
    // enviar a mesma mensagem duas vezes se o cron disparar em paralelo.
    const { data: claimed, error: claimErr } = await supabase
      .rpc('claim_aion_scheduled_messages', { p_limit: BATCH_LIMIT })

    if (claimErr) {
      console.error('[aion-scheduled-send] erro ao reivindicar lote:', claimErr.message)
      return new Response(JSON.stringify({ error: claimErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = (claimed ?? []) as ClaimedMessage[]
    if (rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: platformWA } = await supabase
      .from('platform_whatsapp')
      .select('phone_number_id, access_token')
      .eq('connected', true)
      .maybeSingle()

    let sent = 0
    let failed = 0

    for (const row of rows) {
      if (!platformWA?.phone_number_id || !platformWA?.access_token) {
        await supabase.from('aion_scheduled_messages')
          .update({ status: 'failed', error_message: 'WhatsApp da Áion não configurado/conectado' })
          .eq('id', row.id)
        failed++
        continue
      }

      try {
        const isTemplate = !!row.template_name

        // Mesmo shape de payload que api/whatsapp/send-template.ts monta
        // pro Meta (type: 'template', template: {name, language, components}).
        const metaBody = isTemplate
          ? {
              messaging_product: 'whatsapp',
              recipient_type:    'individual',
              to:   row.remote_jid,
              type: 'template',
              template: {
                name:     row.template_name,
                language: { code: row.template_language || 'pt_BR' },
                ...(row.template_components && row.template_components.length > 0
                  ? { components: row.template_components }
                  : {}),
              },
            }
          : {
              messaging_product: 'whatsapp',
              to: row.remote_jid,
              type: 'text',
              text: { body: row.content },
            }

        const resp = await fetch(`${GRAPH_URL}/${platformWA.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${platformWA.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metaBody),
        })
        const data = await resp.json()

        if (!resp.ok) {
          throw new Error(data.error?.message || 'Falha ao enviar via Meta Cloud API')
        }

        await supabase.from('whatsapp_messages').insert({
          institution_id: null,
          remote_jid:     row.remote_jid,
          message_id:     data.messages?.[0]?.id,
          instance_name:  'cloud-api',
          content:        row.content, // preview já resolvido (com variáveis), tanto pra template quanto texto
          message_type:   isTemplate ? 'template' : 'text',
          from_me:        true,
          status:         'sent',
          direction:      'outbound',
          is_aion_inbox:  true,
          timestamp:      new Date().toISOString(),
        })

        sent++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[aion-scheduled-send] erro ao enviar', row.id, message)
        // claim_aion_scheduled_messages() já marcou 'sent' otimista — desfaz pra 'failed'
        await supabase.from('aion_scheduled_messages')
          .update({ status: 'failed', error_message: message.slice(0, 500), sent_at: null })
          .eq('id', row.id)
        failed++
      }
    }

    return new Response(
      JSON.stringify({ processed: rows.length, sent, failed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[aion-scheduled-send]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
