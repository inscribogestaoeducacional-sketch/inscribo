import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url } = req.query
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param required' })
  }

  const mediaUrl = decodeURIComponent(url)

  try {
    const response = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'WhatsApp/2.24.1 A',
        'Accept': '*/*',
      }
    })

    if (!response.ok) {
      console.error('[media-proxy] upstream error:', response.status, mediaUrl.slice(0, 80))
      return res.status(response.status).json({ error: `Upstream HTTP ${response.status}` })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('[media-proxy] error:', err)
    return res.status(500).json({ error: 'Failed to fetch media' })
  }
}
