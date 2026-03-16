import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, remoteJid, message, institutionId } = req.body
  if (!instanceName || !remoteJid || !message) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number: remoteJid, text: message })
  })

  const data = await response.json()

  // Save sent message to Supabase
  if (institutionId) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('whatsapp_messages').insert({
      institution_id: institutionId,
      remote_jid: remoteJid,
      from_me: true,
      message_id: data?.key?.id || null,
      message_type: 'conversation',
      content: message,
      timestamp: new Date().toISOString(),
    })
  }

  return res.status(response.ok ? 200 : response.status).json(data)
}
