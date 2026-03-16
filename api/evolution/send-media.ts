import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, remoteJid, mediatype, mimetype, media, caption } = req.body
  if (!instanceName || !remoteJid || !media) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const response = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number: remoteJid, mediatype, mimetype, media, caption })
  })

  const data = await response.json()
  return res.status(response.ok ? 200 : response.status).json(data)
}
