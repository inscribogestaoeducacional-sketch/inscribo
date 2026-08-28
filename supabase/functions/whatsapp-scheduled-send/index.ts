import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Envia mensagens agendadas (template) de uma conversa específica do
// WhatsApp Hub das escolas. Reaproveita o máximo possível do que já existe:
// - claim atômico igual a aion-scheduled-send/index.ts (FOR UPDATE SKIP LOCKED
//   via claim_whatsapp_scheduled_messages, otimista: já marca 'sent' na
//   reivindicação, desfaz pra 'failed' se o envio de fato não der certo).
// - payload/preview do template igual a api/whatsapp/send-template.ts.
// - reabertura de conversa fechada igual ao bloco de re-open de
//   api/whatsapp/webhook.ts (valida se o atendente que agendou ainda está
//   ativo antes de reatribuir; senão cai pra fila sem dono).
const GRAPH_URL = 'https://graph.facebook.com/v19.0'
const BATCH_LIMIT = 50

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ClaimedRow {
  id: string
  institution_id: string
  conversation_id: string
  remote_jid: string
  template_name: string
  template_variables: Record<string, string> | null
  created_by: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: claimed, error: claimErr } = await supabase
      .rpc('claim_whatsapp_scheduled_messages', { p_limit: BATCH_LIMIT })

    if (claimErr) {
      console.error('[whatsapp-scheduled-send] erro ao reivindicar lote:', claimErr.message)
      return new Response(JSON.stringify({ error: claimErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rows = (claimed ?? []) as ClaimedRow[]
    if (rows.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0, failed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: tokenData } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'wa_access_token')
      .maybeSingle()
    const accessToken = tokenData?.value || Deno.env.get('WA_ACCESS_TOKEN')

    let sent = 0
    let failed = 0

    for (const row of rows) {
      try {
        // ── Falha e notifica o atendente que agendou, sem derrubar o lote inteiro ──
        const fail = async (message: string) => {
          await supabase.from('whatsapp_scheduled_messages')
            .update({ status: 'failed', error_message: message.slice(0, 500), sent_at: null })
            .eq('id', row.id)

          // system_notifications não tem coluna de usuário-alvo (só
          // institution_id) — aproximação pragmática: notificação com
          // escopo de instituição citando o nome do atendente no texto, pra
          // não falhar silenciosamente (exigência explícita do pedido).
          let attendantName = 'Atendente'
          if (row.created_by) {
            const { data: u } = await supabase.from('users').select('full_name').eq('id', row.created_by).maybeSingle()
            if (u?.full_name) attendantName = u.full_name
          }
          await supabase.from('system_notifications').insert({
            institution_id: row.institution_id,
            type:           'whatsapp_scheduled_failed',
            title:          'Falha ao enviar mensagem agendada',
            message:        `${attendantName}: falha ao enviar template "${row.template_name}" (${row.remote_jid}) — ${message.slice(0, 300)}`,
            severity:       'error',
          })

          failed++
        }

        // ── Template aprovado + componentes Meta (mesma fonte do painel de envio manual) ──
        const { data: tmpl } = await supabase
          .from('whatsapp_templates')
          .select('language, components')
          .eq('institution_id', row.institution_id)
          .eq('name', row.template_name)
          .maybeSingle()

        if (!tmpl) {
          await fail(`Template "${row.template_name}" não encontrado`)
          continue
        }

        const bodyTmpl = ((tmpl.components as any[]) || []).find((c: any) => c.type === 'BODY')
        const vars = row.template_variables || {}
        let preview = `[Template: ${row.template_name}]`
        const parameters: { type: string; text: string }[] = []

        if (bodyTmpl?.text) {
          let text: string = bodyTmpl.text
          const varCount = (text.match(/\{\{\d+\}\}/g) || []).length
          for (let i = 1; i <= varCount; i++) {
            const value = vars[String(i)] || ''
            parameters.push({ type: 'text', text: value })
            text = text.replace(`{{${i}}}`, value)
          }
          preview = text
        }

        // ── Se a conversa estiver fechada, reabre e reatribui ao atendente
        // que agendou — mesma lógica validada de webhook.ts (reopen block):
        // só preserva o dono se ele ainda existir e estiver ativo. ──
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('id, status, assigned_user_id')
          .eq('id', row.conversation_id)
          .maybeSingle()

        if (!conv) {
          await fail('Conversa não encontrada')
          continue
        }

        if (conv.status === 'closed') {
          let reopenAssigneeId: string | null = null
          let reopenAssigneeName: string | null = null
          if (row.created_by) {
            const { data: stillActiveUser } = await supabase
              .from('users')
              .select('id, full_name, active')
              .eq('id', row.created_by)
              .maybeSingle()
            if (stillActiveUser?.active) {
              reopenAssigneeId   = stillActiveUser.id
              reopenAssigneeName = stillActiveUser.full_name
            }
          }

          await supabase.from('whatsapp_conversations')
            .update({
              status:              'waiting',
              assigned_user_id:    reopenAssigneeId,
              assigned_user_name:  reopenAssigneeName,
              bot_active:          false,
            })
            .eq('id', conv.id)

          await supabase.from('whatsapp_conversation_events').insert({
            institution_id: row.institution_id,
            remote_jid:     row.remote_jid,
            event_type:     'reopened',
            description:    reopenAssigneeName
              ? `Mensagem agendada reabriu a conversa, encerrada anteriormente — voltou para ${reopenAssigneeName}`
              : 'Mensagem agendada reabriu a conversa, encerrada anteriormente — voltou para fila',
            metadata:       { previous_status: 'closed', reason: 'scheduled_message', scheduled_message_id: row.id },
          })
        }

        // ── Número + envio via Cloud API ──
        const { data: phoneRecord } = await supabase
          .from('whatsapp_phone_numbers')
          .select('phone_number_id')
          .eq('institution_id', row.institution_id)
          .eq('is_active', true)
          .maybeSingle()

        if (!phoneRecord?.phone_number_id) {
          await fail('Número WhatsApp não configurado para esta escola')
          continue
        }
        if (!accessToken) {
          await fail('Access token do WhatsApp não configurado')
          continue
        }

        const templatePayload: any = {
          name:     row.template_name,
          language: { code: tmpl.language || 'pt_BR' },
        }
        if (parameters.length > 0) {
          templatePayload.components = [{ type: 'body', parameters }]
        }

        const metaRes = await fetch(`${GRAPH_URL}/${phoneRecord.phone_number_id}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type:    'individual',
            to:   row.remote_jid,
            type: 'template',
            template: templatePayload,
          }),
        })
        const metaData = await metaRes.json()

        if (!metaRes.ok) {
          await fail(metaData.error?.message || 'Erro ao enviar template via Meta Cloud API')
          continue
        }

        const wamid = metaData.messages?.[0]?.id

        await supabase.from('whatsapp_messages').insert({
          institution_id: row.institution_id,
          conversation_id: row.conversation_id,
          remote_jid:      row.remote_jid,
          message_id:      wamid,
          instance_name:   'cloud-api',
          content:         preview,
          message_type:    'template',
          from_me:         true,
          sender_user_id:  row.created_by,
          status:          'sent',
          direction:       'outbound',
          timestamp:       new Date().toISOString(),
        })

        await supabase.from('whatsapp_conversations')
          .update({ last_message: preview, last_message_at: new Date().toISOString() })
          .eq('id', row.conversation_id)

        sent++
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error('[whatsapp-scheduled-send] erro ao processar', row.id, message)
        await supabase.from('whatsapp_scheduled_messages')
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
    console.error('[whatsapp-scheduled-send]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
