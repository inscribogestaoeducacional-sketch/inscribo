import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { instanceName, webhookUrl } = req.body

  const response = await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify({
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: false,
      events: [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
      ],
    })
  })

  const text = await response.text()
  console.log('[webhook/set] status:', response.status, 'body:', text)

  try {
    res.status(response.status).json(JSON.parse(text))
  } catch {
    res.status(response.status).send(text)
  }
}
