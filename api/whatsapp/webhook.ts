import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    try {
      const value = req.body?.entry?.[0]?.changes?.[0]?.value
      if (!value) return res.status(200).end()

      const phoneNumberId = value.metadata?.phone_number_id

      // Busca a escola pelo phone_number_id
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('institution_id')
        .eq('phone_number_id', phoneNumberId)
        .single()

      const institutionId = phoneRecord?.institution_id ?? null
      if (!institutionId) {
        console.log('⚠️ phone_number_id não mapeado:', phoneNumberId)
        return res.status(200).end()
      }

      // ── Mensagens recebidas ──
      for (const msg of value.messages || []) {
        const remoteJid   = msg.from
        const text        = msg.text?.body || ''
        const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()
        const contactName = value.contacts?.[0]?.profile?.name || remoteJid

        // Upsert da conversa
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

        // Insert da mensagem com campos corretos da tabela
        const { error: msgErr } = await supabase
          .from('whatsapp_messages')
          .insert({
            institution_id: institutionId,
            remote_jid:     remoteJid,
            message_id:     msg.id,           // coluna correta (não wa_message_id)
            instance_name:  'cloud-api',      // obrigatório na tabela
            content:        text,
            message_type:   msg.type || 'conversation',
            from_me:        false,
            contact_name:   contactName,
            timestamp:      timestamp,
            status:         'received',
            raw_data:       msg,
          })

        if (msgErr) console.error('❌ msg insert error:', msgErr.message)
      }

      // ── Atualiza status de entrega (sent/delivered/read/failed) ──
      for (const status of value.statuses || []) {
        const { error: statusErr } = await supabase
          .from('whatsapp_messages')
          .update({
            status:            status.status,
            status_updated_at: new Date().toISOString(),
          })
          .eq('message_id', status.id)   // coluna correta

        if (statusErr) console.error('❌ status update error:', statusErr.message)
      }

    } catch (err) {
      console.error('❌ Webhook error:', err)
      // Sempre 200 — a Meta desativa o webhook se receber 5xx
    }

    return res.status(200).json({ status: 'ok' })
  }

  return res.status(405).end()
}