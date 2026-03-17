import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Accept instanceName from query (GET) or body (POST)
  const instanceName = (req.query.instanceName as string) || req.body?.instanceName
  if (!instanceName) return res.status(400).json({ error: 'instanceName required' })

  try {
    const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      headers: { apikey: EVOLUTION_KEY }
    })
    const data = await response.json()
    console.log('[connection-state] raw response:', JSON.stringify(data))
    return res.json(data)
  } catch (err) {
    console.error('[connection-state] fetch error:', err)
    return res.status(500).json({ error: 'Failed to fetch connection state' })
  }
}
