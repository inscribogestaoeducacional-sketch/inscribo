import type { VercelRequest, VercelResponse } from '@vercel/node'
import { EVOLUTION_URL, evolutionHeaders, getSupabaseAdmin } from './_config'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url, instanceName, messageId } = req.query

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url query param required' })
  }

  const decodedUrl = decodeURIComponent(url)
  const msgId = typeof messageId === 'string' ? messageId : (Array.isArray(messageId) ? messageId[0] : '')
  const inst  = typeof instanceName === 'string' ? instanceName : (Array.isArray(instanceName) ? instanceName[0] : '')

  console.log('[media-proxy] url:', decodedUrl.slice(0, 100), '| msgId:', msgId, '| inst:', inst)

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Cache-Control', 'public, max-age=86400')

  // ── Attempt 1: Direct fetch ──────────────────────────────────────────────
  try {
    const directRes = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': 'https://web.whatsapp.com/',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (directRes.ok) {
      const contentType = directRes.headers.get('content-type') || 'application/octet-stream'
      const buffer = Buffer.from(await directRes.arrayBuffer())
      res.setHeader('Content-Type', contentType)
      console.log('[media-proxy] direct ok, bytes:', buffer.length)
      return res.send(buffer)
    }
    console.log('[media-proxy] direct failed:', directRes.status)
  } catch (err) {
    console.log('[media-proxy] direct error:', (err as Error).message)
  }

  // ── Attempt 2: Evolution getBase64FromMediaMessage ───────────────────────
  if (msgId && inst) {
    try {
      const b64Res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${inst}`, {
        method: 'POST',
        headers: evolutionHeaders(),
        body: JSON.stringify({ message: { key: { id: msgId } }, convertToMp4: false }),
        signal: AbortSignal.timeout(12000),
      })

      if (b64Res.ok) {
        const b64Data = await b64Res.json()
        const base64 = b64Data.base64 || b64Data.data || b64Data.media
        const mime   = b64Data.mimetype || b64Data.mediaType || 'application/octet-stream'

        if (base64) {
          const buffer = Buffer.from(base64, 'base64')
          res.setHeader('Content-Type', mime)
          console.log('[media-proxy] b64 ok, bytes:', buffer.length)
          return res.send(buffer)
        }
      }
      console.log('[media-proxy] b64 failed:', b64Res.status)
    } catch (err) {
      console.log('[media-proxy] b64 error:', (err as Error).message)
    }
  }

  // ── Attempt 3: Look up stored URL in Supabase ────────────────────────────
  if (msgId) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: row } = await supabase
        .from('whatsapp_messages')
        .select('media_url')
        .eq('message_id', msgId)
        .single()

      if (row?.media_url && row.media_url !== decodedUrl) {
        const storedRes = await fetch(row.media_url as string, {
          signal: AbortSignal.timeout(8000),
        })
        if (storedRes.ok) {
          const contentType = storedRes.headers.get('content-type') || 'application/octet-stream'
          const buffer = Buffer.from(await storedRes.arrayBuffer())
          res.setHeader('Content-Type', contentType)
          console.log('[media-proxy] supabase storage ok, bytes:', buffer.length)
          return res.send(buffer)
        }
      }
    } catch (err) {
      console.log('[media-proxy] supabase lookup error:', (err as Error).message)
    }
  }

  console.log('[media-proxy] all attempts failed:', decodedUrl.slice(0, 100))
  return res.status(404).json({ error: 'media not found' })
}
