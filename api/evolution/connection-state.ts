import type { VercelRequest, VercelResponse } from '@vercel/node'
import { EVOLUTION_URL, evolutionHeaders, getInstanceForInstitution } from './_config.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Accept instanceName directly OR look up by institutionId
  let instanceName = (req.query.instanceName as string) || req.body?.instanceName

  if (!instanceName) {
    const institutionId = (req.query.institutionId as string) || req.body?.institutionId
    if (institutionId) {
      instanceName = (await getInstanceForInstitution(institutionId)) ?? undefined
    }
  }

  if (!instanceName) {
    return res.status(400).json({ error: 'instanceName or institutionId required' })
  }

  try {
    const response = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      headers: evolutionHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    const data = await response.json()
    console.log('[connection-state] raw response:', JSON.stringify(data))
    return res.json(data)
  } catch (err) {
    console.error('[connection-state] fetch error:', err)
    // Return a safe "disconnected" shape instead of an HTTP error
    // so the frontend can always parse the response
    return res.json({ instance: { state: 'close' }, instanceName })
  }
}
