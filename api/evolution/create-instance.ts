import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { instanceName } = req.body
  const response = await fetch(`${EVOLUTION_URL}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ instanceName, qrcode: true, integration: 'WHATSAPP-BAILEYS' })
  })
  const data = await response.json()
  res.json(data)
}
