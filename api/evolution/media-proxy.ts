import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, instanceName, messageId } = req.query
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param required' })
  }

  const mediaUrl = decodeURIComponent(url)

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=86400')

  // ── Attempt 1: Direct fetch ──────────────────────────────────────────
  try {
    const response = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WhatsApp/2.24.1)',
        'Accept': '*/*',
      }
    })

    if (response.ok) {
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const buffer = await response.arrayBuffer()
      res.setHeader('Content-Type', contentType)
      return res.send(Buffer.from(buffer))
    }

    console.warn('[media-proxy] direct fetch returned', response.status, mediaUrl.slice(0, 80))
  } catch (directErr) {
    console.warn('[media-proxy] direct fetch error:', directErr)
  }

  // ── Attempt 2: Evolution API getBase64FromMediaMessage ───────────────
  if (instanceName && messageId) {
    try {
      const instance = typeof instanceName === 'string' ? instanceName : instanceName[0]
      const msgId    = typeof messageId === 'string' ? messageId : messageId[0]

      const evoRes = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${instance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ message: { key: { id: msgId } }, convertToMp4: false })
      })

      if (evoRes.ok) {
        const data = await evoRes.json()
        if (data?.base64) {
          const mime = data.mimetype || 'application/octet-stream'
          const buf = Buffer.from(data.base64, 'base64')
          res.setHeader('Content-Type', mime)
          return res.send(buf)
        }
      }
      console.warn('[media-proxy] Evolution API fallback failed:', evoRes.status)
    } catch (evoErr) {
      console.warn('[media-proxy] Evolution API fallback error:', evoErr)
    }
  }

  return res.status(404).json({ error: 'Media not available' })
}
