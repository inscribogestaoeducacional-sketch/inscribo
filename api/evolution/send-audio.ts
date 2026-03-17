import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, remoteJid, audio, mimetype } = req.body
  if (!instanceName || !remoteJid || !audio) {
    return res.status(400).json({ error: 'instanceName, remoteJid and audio required' })
  }

  try {
    // Use sendWhatsAppAudio which handles PTT (push-to-talk) audio natively
    const response = await fetch(`${EVOLUTION_URL}/message/sendWhatsAppAudio/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({
        number: remoteJid,
        audio,          // base64-encoded audio
        encoding: true, // signal that audio is base64
        ...(mimetype ? { mimetype } : {}),
      })
    })

    const data = await response.json()
    console.log('[send-audio] response:', JSON.stringify(data).slice(0, 300))
    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (err) {
    console.error('[send-audio] error:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
}
