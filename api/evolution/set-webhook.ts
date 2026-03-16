import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { instanceName, webhookUrl } = req.body

  console.log('[set-webhook] instanceName:', instanceName)
  console.log('[set-webhook] webhookUrl:', webhookUrl)

  const body = {
    url: webhookUrl,
    enabled: true,
    events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
  }

  console.log('[set-webhook] body:', JSON.stringify(body))

  const response = await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: EVOLUTION_KEY,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  console.log('[set-webhook] response status:', response.status)
  console.log('[set-webhook] response body:', text)

  res.status(200).json({
    evolutionStatus: response.status,
    evolutionBody: text,
  })
}
