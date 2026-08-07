import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Processa a fila de aion_broadcast_recipients — mesmo padrão de
// aion-scheduled-send/index.ts (claim atômico + fetch direto à Graph API),
// com dois comportamentos a mais:
//   1. Checagem de limite de mensageria da Meta (rate limit da conta) antes
//      de cada lote — adia o ciclo em vez de falhar a campanha.
//   2. Pra cada envio bem-sucedido, find-or-create em whatsapp_conversations
//      + insert em whatsapp_messages (mesmo padrão de
//      raio-x-followup/index.ts) — a mensagem fica visível no histórico do
//      Inbox mesmo que o contato nunca responda, e se responder o webhook
//      (que sempre reabre uma conversa existente pra 'waiting') encontra essa
//      conversa e trata a resposta normalmente, sem lógica especial.
const GRAPH_URL = 'https://graph.facebook.com/v19.0'
const BATCH_LIMIT = 50

// Margem de segurança sobre o limite real de mensageria confirmado na conta
// (2000 conversas business-initiated / 24h) — ver investigação: não há campo
// de tier armazenado hoje, esse número é hardcoded até isso ser mapeado.
const RATE_LIMIT_THRESHOLD = 1900

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Broadcast {
  id: string
  status: string
  template_name: string
  template_language: string | null
  // Corpo cru do template (com {{n}} ainda não substituídos) — usado só pra
  // reconstruir o preview individual de cada destinatário (ver
  // resolvePreviewText); o envio de fato usa
  // ClaimedRecipient.template_components, já resolvido por destinatário.
  template_body_text: string | null
  preview_text: string | null
  scheduled_at: string | null
}

interface ClaimedRecipient {
  id: string
  broadcast_id: string
  contact_id: string | null
  remote_jid: string
  template_components: any[] | null
}

interface ContactInfo {
  id: string
  name: string | null
  aion_lead_id: string | null
}

async function messagesSentLast24h(supabase: ReturnType<typeof createClient>): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_aion_inbox', true)
    .eq('direction', 'outbound')
    .gte('created_at', since)
  return count ?? 0
}

// Substitui {{1}}, {{2}}... no corpo cru do template pelos valores já
// resolvidos em ClaimedRecipient.template_components (mesma ordem posicional
// com que o client montou o array de parameters — ver
// AdminAionInbox.tsx:resolveRecipientComponents). Cai pro preview genérico da
// campanha (broadcast.preview_text) se o corpo cru não tiver sido gravado.
function resolvePreviewText(bodyText: string | null, components: any[] | null, fallback: string | null): string {
  if (!bodyText) return fallback || '[Template]'
  const bodyComp = (components ?? []).find((c: any) => c?.type === 'body')
  const params = bodyComp?.parameters ?? []
  let i = 0
  return bodyText.replace(/\{\{\d+\}\}/g, () => {
    const val = params[i]?.text
    i++
    return val ?? ''
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // scheduled_at NULL = dispara assim que sair de 'draft' (comportamento de
    // sempre); preenchido = só entra na lista quando now() >= scheduled_at —
    // até lá a campanha fica 'scheduled' sem ser tocada por este cron.
    const nowIso = new Date().toISOString()
    const { data: broadcasts, error: broadcastsErr } = await supabase
      .from('aion_broadcasts')
      .select('id, status, template_name, template_language, template_body_text, preview_text, scheduled_at')
      .in('status', ['scheduled', 'sending'])
      .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })

    if (broadcastsErr) {
      console.error('[aion-broadcast-send] erro ao buscar campanhas ativas:', broadcastsErr.message)
      return new Response(JSON.stringify({ error: broadcastsErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const activeBroadcasts = (broadcasts ?? []) as Broadcast[]
    if (activeBroadcasts.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0, rate_limited: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: platformWA } = await supabase
      .from('platform_whatsapp')
      .select('phone_number_id, access_token')
      .eq('connected', true)
      .maybeSingle()

    let totalProcessed = 0
    let totalSent = 0
    let totalFailed = 0
    let rateLimited = false

    for (const broadcast of activeBroadcasts) {
      // ── Checagem de limite de mensageria — feita de novo antes de CADA
      // lote (não só uma vez por invocação), porque os envios do lote
      // anterior nesta mesma execução já contam pra janela de 24h. ──
      const sentLast24h = await messagesSentLast24h(supabase)
      if (sentLast24h >= RATE_LIMIT_THRESHOLD) {
        console.warn(`[aion-broadcast-send] limite de mensageria atingido (${sentLast24h}/${RATE_LIMIT_THRESHOLD}) — adiando ciclo`)
        rateLimited = true
        break
      }

      if (broadcast.status === 'scheduled') {
        await supabase.from('aion_broadcasts')
          .update({ status: 'sending', started_at: new Date().toISOString() })
          .eq('id', broadcast.id)
      }

      const { data: claimed, error: claimErr } = await supabase
        .rpc('claim_aion_broadcast_recipients', { p_broadcast_id: broadcast.id, p_limit: BATCH_LIMIT })

      if (claimErr) {
        console.error('[aion-broadcast-send] erro ao reivindicar lote:', claimErr.message)
        continue
      }

      const rows = (claimed ?? []) as ClaimedRecipient[]

      if (rows.length === 0) {
        // Sem mais pending — campanha terminou.
        await supabase.from('aion_broadcasts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', broadcast.id)
          .neq('status', 'completed')
        continue
      }

      // Busca os contatos do lote de uma vez (nome + vínculo com crm_leads)
      const contactIds = rows.map(r => r.contact_id).filter((id): id is string => !!id)
      const contactsById = new Map<string, ContactInfo>()
      if (contactIds.length > 0) {
        const { data: contacts } = await supabase
          .from('aion_contacts')
          .select('id, name, aion_lead_id')
          .in('id', contactIds)
        for (const c of (contacts ?? []) as ContactInfo[]) contactsById.set(c.id, c)
      }

      let sent = 0
      let failed = 0

      for (const row of rows) {
        if (!platformWA?.phone_number_id || !platformWA?.access_token) {
          await supabase.from('aion_broadcast_recipients')
            .update({ status: 'failed', error_message: 'WhatsApp da Áion não configurado/conectado' })
            .eq('id', row.id)
          failed++
          continue
        }

        const contact = row.contact_id ? contactsById.get(row.contact_id) : undefined
        const contactName = contact?.name || row.remote_jid

        try {
          const metaBody = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: row.remote_jid,
            type: 'template',
            template: {
              name: broadcast.template_name,
              language: { code: broadcast.template_language || 'pt_BR' },
              ...(row.template_components && row.template_components.length > 0
                ? { components: row.template_components }
                : {}),
            },
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

          const wamid = data.messages?.[0]?.id
          const preview = resolvePreviewText(broadcast.template_body_text, row.template_components, broadcast.preview_text || `[Template: ${broadcast.template_name}]`)

          // ── find-or-create em whatsapp_conversations — mesmo padrão de
          // raio-x-followup/index.ts, só roda pra envio bem-sucedido. ──
          const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('remote_jid', row.remote_jid)
            .eq('is_aion_inbox', true)
            .maybeSingle()

          const convPayload = {
            contact_name: contactName,
            queue: contact?.aion_lead_id ? 'leads' : 'general',
            status: 'closed',
            last_message: preview,
            last_message_at: new Date().toISOString(),
            aion_lead_id: contact?.aion_lead_id || null,
          }

          let convId: string | undefined
          if (existingConv) {
            await supabase.from('whatsapp_conversations').update(convPayload).eq('id', existingConv.id)
            convId = existingConv.id
          } else {
            const { data: created } = await supabase
              .from('whatsapp_conversations')
              .insert({ remote_jid: row.remote_jid, institution_id: null, is_aion_inbox: true, ...convPayload })
              .select('id')
              .maybeSingle()
            convId = created?.id
          }

          await supabase.from('whatsapp_messages').insert({
            institution_id: null,
            conversation_id: convId || null,
            remote_jid: row.remote_jid,
            message_id: wamid,
            instance_name: 'cloud-api',
            content: preview,
            message_type: 'template',
            from_me: true,
            contact_name: contactName,
            timestamp: new Date().toISOString(),
            status: 'sent',
            direction: 'outbound',
            is_aion_inbox: true,
          })

          await supabase.from('aion_broadcast_recipients')
            .update({ status: 'sent', wamid: wamid || null, sent_at: new Date().toISOString() })
            .eq('id', row.id)

          sent++
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          console.error('[aion-broadcast-send] erro ao enviar', row.id, message)
          // claim_aion_broadcast_recipients já marcou 'sent' otimista — desfaz pra 'failed'
          await supabase.from('aion_broadcast_recipients')
            .update({ status: 'failed', error_message: message.slice(0, 500), sent_at: null })
            .eq('id', row.id)
          failed++
        }
      }

      totalProcessed += rows.length
      totalSent += sent
      totalFailed += failed

      await supabase.rpc('increment_aion_broadcast_counts', {
        p_broadcast_id: broadcast.id, p_sent_delta: sent, p_failed_delta: failed,
      })

      const { count: remaining } = await supabase
        .from('aion_broadcast_recipients')
        .select('id', { count: 'exact', head: true })
        .eq('broadcast_id', broadcast.id)
        .eq('status', 'pending')

      if ((remaining ?? 0) === 0) {
        await supabase.from('aion_broadcasts')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', broadcast.id)
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, sent: totalSent, failed: totalFailed, rate_limited: rateLimited }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[aion-broadcast-send]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
