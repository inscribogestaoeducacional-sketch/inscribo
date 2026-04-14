import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { institution_id, to, text } = req.body

  if (!institution_id || !to || !text) {
    return res.status(400).json({ error: 'institution_id, to e text são obrigatórios' })
  }

  try {
    // Busca o phone_number_id da escola
    const { data: phoneRecord, error: phoneErr } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .single()

    if (phoneErr || !phoneRecord) {
      return res.status(404).json({ error: 'Número WhatsApp não configurado para esta escola' })
    }

    // Envia via Meta Cloud API
    const response = await fetch(`${GRAPH_URL}/${phoneRecord.phone_number_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text, preview_url: false }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Meta API error:', data)
      return res.status(500).json({ error: data.error?.message || 'Erro ao enviar mensagem' })
    }

    const wamid = data.messages?.[0]?.id

    // Salva a mensagem enviada no Supabase
    await supabase.from('whatsapp_messages').insert({
      institution_id,
      remote_jid:    to,
      message_id:    wamid,
      instance_name: 'cloud-api',
      content:       text,
      message_type:  'text',
      from_me:       true,
      status:        'sent',
      timestamp:     new Date().toISOString(),
    })

    // Atualiza last_message da conversa
    await supabase.from('whatsapp_conversations')
      .update({
        last_message:    text,
        last_message_at: new Date().toISOString(),
      })
      .eq('institution_id', institution_id)
      .eq('remote_jid', to)

    return res.status(200).json({ success: true, wamid })

  } catch (err) {
    console.error('❌ Send error:', err)
    return res.status(500).json({ error: 'Erro interno' })
  }
}