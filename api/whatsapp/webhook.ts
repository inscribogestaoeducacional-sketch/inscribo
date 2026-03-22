import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

  // ── Verificação do webhook (GET) — Meta valida a URL ──────────
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[whatsapp/webhook] verificação ok')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Token inválido' })
  }

  // ── Receber mensagens (POST) ──────────────────────────────────
  if (req.method === 'POST') {
    // Responder imediatamente para Meta não retentar
    res.status(200).json({ status: 'ok' })

    const body = req.body
    if (body?.object !== 'whatsapp_business_account') return

    const supabase = getSupabase()

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue

        const value         = change.value
        const phoneNumberId = value.metadata?.phone_number_id as string
        const messages      = value.messages || []
        const statuses      = value.statuses || []

        // Atualizar status de mensagens enviadas
        for (const statusUpdate of statuses) {
          await supabase
            .from('whatsapp_messages')
            .update({ status: statusUpdate.status })
            .eq('message_id', statusUpdate.id)
            .catch(() => {})
        }

        for (const message of messages) {
          const from      = message.from as string
          const messageId = message.id as string
          const tsRaw     = message.timestamp as string
          const createdAt = new Date(parseInt(tsRaw) * 1000).toISOString()

          // Extrair conteúdo por tipo
          let text = ''
          let msgType = message.type as string

          if (message.type === 'text') {
            text = message.text?.body || ''
          } else if (message.type === 'image') {
            text = message.image?.caption || '[Imagem]'
          } else if (message.type === 'audio') {
            text = '[Áudio]'
          } else if (message.type === 'video') {
            text = message.video?.caption || '[Vídeo]'
          } else if (message.type === 'document') {
            text = message.document?.filename || '[Documento]'
          } else if (message.type === 'sticker') {
            text = '[Figurinha]'
          } else {
            text = `[${message.type}]`
          }

          // Buscar instituição pelo phone_id
          const { data: institution } = await supabase
            .from('institutions')
            .select('id, whatsapp_phone_id, whatsapp_token')
            .eq('whatsapp_phone_id', phoneNumberId)
            .single()
            .catch(() => ({ data: null }))

          // Fallback: usar credenciais globais se só existe uma instituição com Meta
          let institutionId = institution?.id as string | undefined
          if (!institutionId) {
            // Tentar pela env WHATSAPP_PHONE_ID (instância de teste)
            if (phoneNumberId === process.env.WHATSAPP_PHONE_ID) {
              const { data: first } = await supabase
                .from('institutions')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(1)
                .single()
                .catch(() => ({ data: null }))
              institutionId = first?.id as string | undefined
            }
            if (!institutionId) {
              console.warn('[whatsapp/webhook] nenhuma instituição encontrada para phone_id:', phoneNumberId)
              continue
            }
          }

          // Verificar/criar conversa
          const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id, bot_active, status')
            .eq('institution_id', institutionId)
            .eq('remote_jid', from)
            .single()
            .catch(() => ({ data: null }))

          let conversationId = (existingConv as any)?.id as string | undefined

          if (!conversationId) {
            // Nova conversa — inserir e contar uso mensal
            const { data: newConv } = await supabase
              .from('whatsapp_conversations')
              .insert({
                institution_id: institutionId,
                remote_jid: from,
                phone_number: from,
                contact_name: (value.contacts?.[0]?.profile?.name) || null,
                bot_active: true,
                status: 'waiting',
                last_message_at: createdAt,
                unread_count: 1,
              })
              .select('id')
              .single()
              .catch(() => ({ data: null }))

            conversationId = (newConv as any)?.id as string | undefined

            // Contar conversa no uso mensal
            const monthYear = new Date().toISOString().slice(0, 7)
            await supabase.from('whatsapp_usage').upsert({
              institution_id: institutionId,
              month_year: monthYear,
              conversation_count: 1,
            }, { onConflict: 'institution_id,month_year', ignoreDuplicates: false })
              .catch(() => {})
            await supabase.rpc('increment_conversation_count', {
              p_institution_id: institutionId,
              p_month_year: monthYear,
            }).catch(() => {})
          } else {
            // Atualizar última mensagem e reabrir se fechada
            const updates: Record<string, unknown> = {
              last_message_at: createdAt,
            }
            if ((existingConv as any)?.status === 'closed') {
              updates.status = 'waiting'
              updates.bot_active = true
            }
            await supabase
              .from('whatsapp_conversations')
              .update(updates)
              .eq('id', conversationId)
              .catch(() => {})

            await supabase.rpc('increment_conversation_unread', {
              p_institution_id: institutionId,
              p_remote_jid: from,
            }).catch(() => {})
          }

          // Salvar mensagem recebida
          await supabase.from('whatsapp_messages').upsert({
            message_id:     messageId,
            institution_id: institutionId,
            remote_jid:     from,
            phone_number:   from,
            from_me:        false,
            direction:      'inbound',
            message_type:   msgType,
            content:        text,
            status:         'received',
            conversation_id: conversationId || null,
            contact_name:   value.contacts?.[0]?.profile?.name || null,
            timestamp:      createdAt,
            raw_data:       message,
          }, { onConflict: 'message_id' }).catch((e: unknown) => {
            console.error('[whatsapp/webhook] upsert error:', e)
          })

          // Tentar match com lead pelo telefone
          const phoneDigits = from.replace(/\D/g, '').replace(/^55/, '')
          if (phoneDigits.length >= 8) {
            const { data: leads } = await supabase
              .from('leads')
              .select('id, phone')
              .eq('institution_id', institutionId)
              .limit(200)
              .catch(() => ({ data: null }))

            const match = (leads || []).find((l: { id: string; phone?: string }) =>
              l.phone && l.phone.replace(/\D/g, '').endsWith(phoneDigits.slice(-8))
            )
            if (match) {
              await supabase
                .from('whatsapp_messages')
                .update({ lead_id: match.id })
                .eq('message_id', messageId)
                .catch(() => {})
            }
          }

          // Resposta do bot (apenas texto)
          if (message.type === 'text') {
            const botActive = (existingConv as any)?.bot_active !== false
            if (botActive) {
              const effectiveToken = institution?.whatsapp_token || process.env.WHATSAPP_TOKEN!
              await handleBotResponse(
                institutionId,
                effectiveToken,
                phoneNumberId,
                from,
                text,
                conversationId,
              )
            }
          }
        }
      }
    }

    return
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Bot ──────────────────────────────────────────────────────────────────────
async function handleBotResponse(
  institutionId: string,
  token: string,
  phoneNumberId: string,
  to: string,
  userMessage: string,
  conversationId: string | undefined,
) {
  const supabase = getSupabase()

  const { data: botConfig } = await supabase
    .from('whatsapp_bot_config')
    .select('*')
    .eq('institution_id', institutionId)
    .single()
    .catch(() => ({ data: null }))

  if (!botConfig || !(botConfig as any).bot_enabled) return

  const cfg = botConfig as Record<string, unknown>

  // Verificar palavras de handoff
  const handoffKeywords = (cfg.handoff_keywords as string[]) || ['atendente', 'humano']
  const wantsHuman = handoffKeywords.some(kw =>
    userMessage.toLowerCase().includes(kw.toLowerCase())
  )

  if (wantsHuman) {
    await sendWhatsAppMessage(token, phoneNumberId, to,
      'Vou te transferir para um de nossos atendentes. Em breve alguém entrará em contato! 😊'
    )
    if (conversationId) {
      await supabase
        .from('whatsapp_conversations')
        .update({ bot_active: false, status: 'waiting' })
        .eq('id', conversationId)
        .catch(() => {})
    }
    return
  }

  // Histórico recente da conversa
  const { data: history } = await supabase
    .from('whatsapp_messages')
    .select('direction, content')
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(10)
    .catch(() => ({ data: null }))

  const historyText = ((history || []) as Array<{direction: string; content: string}>)
    .reverse()
    .map(m => `${m.direction === 'inbound' ? 'Pai/Responsável' : 'Bot'}: ${m.content}`)
    .join('\n')

  const toneLabel = cfg.bot_tone === 'friendly'
    ? 'amigável e acolhedor'
    : cfg.bot_tone === 'formal'
    ? 'formal e profissional'
    : 'descontraído'

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Você é o assistente virtual da escola ${cfg.school_name}.
Tom: ${toneLabel}.
Séries: ${((cfg.grades_offered as string[]) || []).join(', ') || 'Educação Infantil ao Ensino Médio'}.
Mensalidade: ${cfg.monthly_fee_info || 'consulte nossa secretaria'}.
FAQ: ${JSON.stringify(cfg.faq_data || {})}.

Histórico:
${historyText || '(primeira mensagem)'}

Última mensagem: "${userMessage}"

Responda de forma natural. Se for primeiro contato, dê boas-vindas e pergunte qual série busca. Se já souber, ofereça agendar visita. Máximo 3 linhas. Sem markdown. Emojis com moderação.`,
      }],
    }),
  }).catch(() => null)

  let botMessage = 'Olá! Como posso te ajudar? 😊'
  if (aiRes?.ok) {
    const aiData = await aiRes.json().catch(() => ({}))
    botMessage = aiData?.content?.[0]?.text || botMessage
  }

  await sendWhatsAppMessage(token, phoneNumberId, to, botMessage)

  // Salvar resposta enviada
  await supabase.from('whatsapp_messages').insert({
    institution_id:  institutionId,
    remote_jid:      to,
    phone_number:    to,
    from_me:         true,
    direction:       'outbound',
    message_type:    'text',
    content:         botMessage,
    status:          'sent',
    conversation_id: conversationId || null,
    timestamp:       new Date().toISOString(),
  }).catch(() => {})

  // Criar lead automaticamente se não existir
  await supabase.from('leads').upsert({
    institution_id: institutionId,
    phone:          to,
    source:         'whatsapp_bot',
    status:         'novo',
    created_at:     new Date().toISOString(),
  }, { onConflict: 'phone,institution_id', ignoreDuplicates: true }).catch(() => {})
}

async function sendWhatsAppMessage(
  token:         string,
  phoneNumberId: string,
  to:            string,
  message:       string,
) {
  await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  }).catch(e => console.warn('[whatsapp] send error:', e))
}
