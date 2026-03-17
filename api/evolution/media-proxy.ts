import type { VercelRequest, VercelResponse } from '@vercel/node'

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, instanceName, messageId } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param required' })
  }

  const decodedUrl = decodeURIComponent(url)
  console.log('[media-proxy] tentando:', decodedUrl.slice(0, 100))

  // Always set CORS + CORP headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Cache-Control', 'public, max-age=86400')

  // ── Attempt 1: Direct fetch ──────────────────────────────────────────────
  try {
    const directRes = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://web.whatsapp.com/',
      },
    })

    if (directRes.ok) {
      const contentType = directRes.headers.get('content-type') || 'application/octet-stream'
      const buffer = Buffer.from(await directRes.arrayBuffer())
      res.setHeader('Content-Type', contentType)
      console.log('[media-proxy] sucesso direto, bytes:', buffer.length, 'type:', contentType)
      return res.send(buffer)
    }

    console.log('[media-proxy] fetch direto falhou:', directRes.status, directRes.statusText)
  } catch (err) {
    console.log('[media-proxy] fetch direto erro:', (err as Error).message)
  }

  // ── Attempt 2: Evolution API getBase64FromMediaMessage ───────────────────
  const msgId = typeof messageId === 'string' ? messageId : (messageId?.[0] ?? '')
  const inst  = typeof instanceName === 'string' ? instanceName : (instanceName?.[0] ?? '')

  if (msgId) {
    try {
      const b64Res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${inst}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ message: { key: { id: msgId } }, convertToMp4: false }),
      })

      if (b64Res.ok) {
        const b64Data = await b64Res.json()
        console.log('[media-proxy] b64 response keys:', Object.keys(b64Data))

        const base64 = b64Data.base64 || b64Data.data || b64Data.media
        const mime   = b64Data.mimetype || b64Data.mediaType || 'application/octet-stream'

        if (base64) {
          const buffer = Buffer.from(base64, 'base64')
          res.setHeader('Content-Type', mime)
          console.log('[media-proxy] sucesso b64, bytes:', buffer.length, 'mime:', mime)
          return res.send(buffer)
        }
        console.log('[media-proxy] b64 sem dados:', JSON.stringify(b64Data).slice(0, 200))
      } else {
        const errText = await b64Res.text().catch(() => '')
        console.log('[media-proxy] b64 falhou:', b64Res.status, errText.slice(0, 200))
      }
    } catch (err) {
      console.log('[media-proxy] b64 erro:', (err as Error).message)
    }
  }

  console.log('[media-proxy] todas tentativas falharam para:', decodedUrl.slice(0, 100))
  return res.status(404).json({ error: 'media not found' })
}
