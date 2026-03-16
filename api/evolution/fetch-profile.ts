import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { instanceName, number } = req.query
  if (!instanceName || !number) return res.status(400).json({ error: 'Missing params' })
  try {
    const response = await fetch(`${EVOLUTION_URL}/chat/fetchProfile/${instanceName}?number=${number}`, {
      headers: { apikey: EVOLUTION_KEY }
    })
    const data = await response.json()
    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
