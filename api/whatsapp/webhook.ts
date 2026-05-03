import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

// Desabilita o body-parser automático para que possamos ler o buffer bruto
// necessário para a validação HMAC-SHA256 da Meta
export const config = {
  api: { bodyParser: false },
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Envia mensagem automática via Cloud API ──────────────────────────────────
async function sendAutoMessage(institutionId: string, to: string, text: string) {
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .single()

    if (!phone?.phone_number_id) return

    const token = process.env.WA_ACCESS_TOKEN
    if (!token) return

    await fetch(`https://graph.facebook.com/v19.0/${phone.phone_number_id}/messages`, {
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
    console.error('❌ sendAutoMessage error:', e)
  }
}

// ── Lógica de fluxo automático ───────────────────────────────────────────────
async function processFlow(
  institutionId: string,
  remoteJid: string,
  text: string,
  isNewConversation: boolean
) {
  console.log('[flow] iniciando para:', { institutionId, remoteJid, isNewConversation, text: text.slice(0, 80) })
  try {
    const { data: flow } = await supabase
      .from('whatsapp_flows')
      .select('*')
      .eq('institution_id', institutionId)
      .single()

    if (!flow || !flow.is_active) {
      console.log('[flow] sem fluxo ativo, pulando')
      return
    }

    const tz             = flow.timezone || 'America/Fortaleza'
    const now            = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    const dayKeys        = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const currentDay     = dayKeys[now.getDay()]
    const isWorkingDay   = (flow.working_days as string[])?.includes(currentDay)

    const [startH, startM] = (flow.working_start || '07:00').split(':').map(Number)
    const [endH, endM]     = (flow.working_end   || '17:00').split(':').map(Number)
    const currentMinutes   = now.getHours() * 60 + now.getMinutes()
    const isWorkingHours   = currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM
    const isOpen           = isWorkingDay && isWorkingHours

    console.log('[flow] isOpen:', isOpen, '| isWorkingDay:', isWorkingDay, '| isWorkingHours:', isWorkingHours, '| day:', currentDay, '| time:', `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`)

    const menuOptions: any[] = flow.menu_options || []
    const trimmedText = text.trim()
    const menuChoice  = menuOptions.find((opt: any) => opt.keyword === trimmedText)

    const action = !isOpen ? 'off-hours' : isNewConversation ? 'new-conv' : menuChoice ? 'menu-choice' : 'none'
    console.log('[flow] ação:', action)

    if (!isOpen && flow.off_hours_message) {
      if (isNewConversation) {
        await sendAutoMessage(institutionId, remoteJid, flow.off_hours_message)
      }
    } else if (isOpen && isNewConversation) {
      const { data: recentAuto } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .eq('from_me', true)
        .gte('timestamp', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .maybeSingle()

      if (!recentAuto) {
        if (flow.welcome_message) {
          await sendAutoMessage(institutionId, remoteJid, flow.welcome_message)
        }
        if (flow.menu_enabled && flow.menu_message) {
          await sendAutoMessage(institutionId, remoteJid, flow.menu_message)
        }
      } else {
        console.log('[flow] boas-vindas suprimidas (mensagem automática recente detectada)')
      }
    } else if (isOpen && menuChoice && flow.menu_enabled) {
      if (menuChoice.assignee_id) {
        await supabase
          .from('whatsapp_conversations')
          .update({
            assigned_user_id:   menuChoice.assignee_id,
            assigned_user_name: menuChoice.assignee_name,
            status:             'open',
          })
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
        console.log('[flow] atendente atribuído:', menuChoice.assignee_name)
      }
    }
  } catch (e) {
    console.error('❌ processFlow error:', e)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // ── GET: verificação do webhook pela Meta ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']

    if (mode === 'subscribe' && token === process.env.WA_VERIFY_TOKEN) {
      console.log('✅ Webhook verificado')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Token inválido' })
  }

  // ── POST: mensagens e status recebidos ──
  if (req.method === 'POST') {
    // Lê o body como buffer bruto (necessário para HMAC antes do JSON.parse)
    const rawBody = await readRawBody(req)

    // Valida assinatura HMAC-SHA256 enviada pela Meta
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (process.env.WA_APP_SECRET) {
      if (!signature) {
        return res.status(401).json({ error: 'Missing x-hub-signature-256' })
      }
      const expected = `sha256=${crypto
        .createHmac('sha256', process.env.WA_APP_SECRET)
        .update(rawBody)
        .digest('hex')}`
      // timingSafeEqual previne timing attacks
      if (
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        console.warn('⚠️ Webhook signature inválida — request rejeitado')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    try {
      const body  = JSON.parse(rawBody.toString())
      const value = body?.entry?.[0]?.changes?.[0]?.value
      if (!value) return res.status(200).end()

      const phoneNumberId = value.metadata?.phone_number_id

      // Busca a escola pelo phone_number_id — aborta se não mapeado
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('institution_id')
        .eq('phone_number_id', phoneNumberId)
        .single()

      if (!phoneRecord?.institution_id) {
        console.log('⚠️ phone_number_id não mapeado:', phoneNumberId)
        return res.status(200).json({ status: 'ignored', reason: 'phone_number_id not registered' })
      }

      const institutionId = phoneRecord.institution_id

      // ── Mensagens recebidas ──
      for (const msg of value.messages || []) {
        const remoteJid   = msg.from
        const text        = msg.text?.body || ''
        const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()
        const contactName = value.contacts?.[0]?.profile?.name || remoteJid

        const { data: existingConv } = await supabase
          .from('whatsapp_conversations')
          .select('status, last_message_at')
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
          .maybeSingle()

        const isNewConversation = !existingConv || existingConv.status === 'closed'

        const { error: convErr } = await supabase
          .from('whatsapp_conversations')
          .upsert({
            institution_id:  institutionId,
            remote_jid:      remoteJid,
            contact_name:    contactName,
            last_message:    text,
            last_message_at: timestamp,
            status:          'waiting',
          }, { onConflict: 'institution_id,remote_jid' })

        if (convErr) console.error('❌ conv upsert error:', convErr.message)

        const { error: msgErr } = await supabase
          .from('whatsapp_messages')
          .insert({
            institution_id: institutionId,
            remote_jid:     remoteJid,
            message_id:     msg.id,
            instance_name:  'cloud-api',
            content:        text,
            message_type:   msg.type || 'conversation',
            from_me:        false,
            contact_name:   contactName,
            timestamp:      timestamp,
            status:         'received',
            raw_data:       msg,
          })

        if (msgErr) console.error('❌ msg insert error:', msgErr.message)

        // Fluxo automático isolado — erro aqui não derruba o processamento da mensagem
        try {
          await processFlow(institutionId, remoteJid, text, isNewConversation)
        } catch (e) {
          console.error('❌ processFlow call error:', e)
        }
      }

      // ── Atualiza status de entrega (sent/delivered/read/failed) ──
      for (const status of value.statuses || []) {
        const { error: statusErr } = await supabase
          .from('whatsapp_messages')
          .update({
            status:            status.status,
            status_updated_at: new Date().toISOString(),
          })
          .eq('message_id', status.id)

        if (statusErr) console.error('❌ status update error:', statusErr.message)
      }

    } catch (err) {
      console.error('❌ Webhook error:', err)
      // Sempre retorna 200 — a Meta desativa o webhook se receber 5xx consecutivos
    }

    return res.status(200).json({ status: 'ok' })
  }

  return res.status(405).end()
}
