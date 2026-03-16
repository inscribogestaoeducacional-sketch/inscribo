import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, webhookUrl } = req.body
  if (!instanceName || !webhookUrl) {
    return res.status(400).json({ error: 'Missing instanceName or webhookUrl' })
  }

  const response = await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({
      url: webhookUrl,
      enabled: true,
      events: ['MESSAGES_UPSERT'],
    })
  })

  const data = await response.json()
  return res.status(response.ok ? 200 : response.status).json(data)
}
