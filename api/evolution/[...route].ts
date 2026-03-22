import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  EVOLUTION_URL,
  EVOLUTION_KEY,
  evolutionHeaders,
  getSupabaseAdmin,
  getInstanceForInstitution,
  APP_URL,
  errorResponse,
} from './_config.js'

// ─── router ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  let routeArr = Array.isArray(req.query.route)
    ? req.query.route
    : [req.query.route].filter(Boolean) as string[]

  // Fallback: se req.query.route não foi populado pelo rewrite do Vercel,
  // extrair a rota a partir de req.url diretamente
  if (routeArr.length === 0 && req.url) {
    const urlPath = req.url.split('?')[0]
    const marker = '/api/evolution/'
    const idx = urlPath.indexOf(marker)
    if (idx !== -1) {
      const after = urlPath.slice(idx + marker.length)
      routeArr = after.split('/').filter(Boolean)
    }
  }

  const route = routeArr.join('/')
  console.log('[evolution router] route:', route, '| url:', req.url)

  switch (route) {
    case 'get-qrcode':       return handleGetQrcode(req, res)
    case 'connection-state': return handleConnectionState(req, res)
    case 'create-instance':  return handleCreateInstance(req, res)
    case 'delete-instance':  return handleDeleteInstance(req, res)
    case 'send-message':     return handleSendMessage(req, res)
    case 'send-media':       return handleSendMedia(req, res)
    case 'webhook':          return handleWebhook(req, res)
    case 'sync-messages':    return handleSyncMessages(req, res)
    case 'media-proxy':      return handleMediaProxy(req, res)
    case 'fetch-profile':    return handleFetchProfile(req, res)
    case 'get-profile-picture': return handleGetProfilePicture(req, res)
    case 'set-webhook':      return handleSetWebhook(req, res)
    default:
      return res.status(404).json({ error: `Unknown evolution route: ${route}` })
  }
}

// ═══════════════════════════════════════════════════════════
//  get-qrcode
// ═══════════════════════════════════════════════════════════
async function handleGetQrcode(req: VercelRequest, res: VercelResponse) {
  const institutionId = (req.query.institutionId || req.body?.institutionId) as string | undefined

  if (!institutionId) {
    return errorResponse(res, 400, 'institutionId required')
  }

  try {
    const supabase = getSupabaseAdmin()

    let instanceName = await getInstanceForInstitution(institutionId)

    if (!instanceName) {
      instanceName = `inst_${institutionId.replace(/-/g, '').slice(0, 16)}`
      await supabase
        .from('institutions')
        .update({ evolution_instance: instanceName } as never)
        .eq('id', institutionId)
    }

    // Check current connection state
    const stateRes = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instanceName}`, {
      headers: evolutionHeaders(),
      signal: AbortSignal.timeout(8000),
    })

    if (stateRes.ok) {
      const stateData = await stateRes.json()
      const state = stateData?.instance?.state || stateData?.state || ''
      if (state === 'open') {
        return res.json({ connected: true, instanceName })
      }
    }

    // Try to connect / get QR
    const connectRes = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
      headers: evolutionHeaders(),
      signal: AbortSignal.timeout(10000),
    })

    if (!connectRes.ok) {
      // Instance may not exist yet — create it first
      const createRes = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: evolutionHeaders(),
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (!createRes.ok) {
        const err = await createRes.text().catch(() => '')
        console.error('[get-qrcode] create instance failed:', createRes.status, err.slice(0, 300))
        return errorResponse(res, 502, 'Failed to create Evolution instance')
      }

      // Register webhook with stable APP_URL
      if (APP_URL) {
        const webhookUrl = `${APP_URL}/api/evolution/webhook?institution_id=${institutionId}`
        await fetch(`${EVOLUTION_URL}/webhook/set/${instanceName}`, {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: false,
              events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
            },
          }),
          signal: AbortSignal.timeout(10000),
        }).catch(e => console.warn('[get-qrcode] webhook set error:', e))
      }

      const connectRes2 = await fetch(`${EVOLUTION_URL}/instance/connect/${instanceName}`, {
        headers: evolutionHeaders(),
        signal: AbortSignal.timeout(10000),
      })
      const data2 = await connectRes2.json()
      return res.json({ ...data2, instanceName })
    }

    const data = await connectRes.json()
    return res.json({ ...data, instanceName })
  } catch (err) {
    console.error('[get-qrcode] error:', err)
    return errorResponse(res, 500, (err as Error).message || 'Internal error')
  }
}

// ═══════════════════════════════════════════════════════════
//  connection-state
// ═══════════════════════════════════════════════════════════
async function handleConnectionState(req: VercelRequest, res: VercelResponse) {
  let instanceName = (req.query.instanceName as string) || req.body?.instanceName

  if (!instanceName) {
    const institutionId = (req.query.institutionId as string) || req.body?.institutionId
    if (institutionId) {
      instanceName = (await getInstanceForInstitution(institutionId)) ?? undefined
    }
  }

  if (!instanceName) {
    return res.json({ instance: { state: 'close' } })
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
    return res.json({ instance: { state: 'close' }, instanceName })
  }
}

// ═══════════════════════════════════════════════════════════
//  create-instance
// ═══════════════════════════════════════════════════════════
async function handleCreateInstance(req: VercelRequest, res: VercelResponse) {
  const { instanceName, institutionId } = req.body

  const baseUrl = APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173')

  const webhookUrl = institutionId
    ? `${baseUrl}/api/evolution/webhook?institution_id=${institutionId}`
    : undefined

  const response = await fetch(`${EVOLUTION_URL}/instance/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
      ...(webhookUrl && {
        webhook: {
          url: webhookUrl,
          enabled: true,
          events: ['MESSAGES_UPSERT'],
        },
      }),
    }),
  })
  const data = await response.json()
  return res.json(data)
}

// ═══════════════════════════════════════════════════════════
//  delete-instance
// ═══════════════════════════════════════════════════════════
async function handleDeleteInstance(req: VercelRequest, res: VercelResponse) {
  const { instanceName } = req.body
  const response = await fetch(`${EVOLUTION_URL}/instance/delete/${instanceName}`, {
    method: 'DELETE',
    headers: { apikey: EVOLUTION_KEY },
  })
  const data = await response.json()
  return res.json(data)
}

// ═══════════════════════════════════════════════════════════
//  send-message
// ═══════════════════════════════════════════════════════════
async function handleSendMessage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, remoteJid, message, institutionId } = req.body
  if (!instanceName || !remoteJid || !message) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const response = await fetch(`${EVOLUTION_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body: JSON.stringify({ number: remoteJid, text: message }),
  })

  const data = await response.json()

  if (institutionId) {
    const supabase = getSupabaseAdmin()
    await supabase.from('whatsapp_messages').insert({
      institution_id: institutionId,
      remote_jid: remoteJid,
      from_me: true,
      message_id: data?.key?.id || null,
      message_type: 'conversation',
      content: message,
      timestamp: new Date().toISOString(),
    })
  }

  return res.status(response.ok ? 200 : response.status).json(data)
}

// ═══════════════════════════════════════════════════════════
//  send-media
// ═══════════════════════════════════════════════════════════
async function handleSendMedia(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { instanceName, remoteJid, mediatype, mimetype, media, fileName, caption } = req.body
  if (!instanceName || !remoteJid || !media) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    if (mediatype === 'audio') {
      const response = await fetch(`${EVOLUTION_URL}/message/sendWhatsAppAudio/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({ number: remoteJid, audio: media, encoding: true, ...(mimetype ? { mimetype } : {}) }),
      })
      const data = await response.json()
      console.log('[send-audio] response:', JSON.stringify(data).slice(0, 300))
      return res.status(response.ok ? 200 : response.status).json(data)
    }

    const response = await fetch(`${EVOLUTION_URL}/message/sendMedia/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({ number: remoteJid, mediatype, mimetype, media, fileName, caption: caption || '' }),
    })
    const data = await response.json()
    console.log('[send-media] response:', JSON.stringify(data).slice(0, 300))
    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (err) {
    console.error('[send-media] error:', err)
    return res.status(500).json({ error: (err as Error).message })
  }
}

// ═══════════════════════════════════════════════════════════
//  webhook
// ═══════════════════════════════════════════════════════════
async function handleWebhook(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Respond immediately so Evolution doesn't retry
  res.status(200).json({ status: 'ok' })

  const body = req.body
  const event = ((body?.event || '') as string).toLowerCase().replace('.', '_')

  let institution_id = (req.query.institution_id as string) || body?.institution_id || null

  if (!institution_id && body?.instance) {
    try {
      const supabase = getSupabaseAdmin()
      const { data } = await supabase
        .from('institutions')
        .select('id')
        .eq('evolution_instance', body.instance)
        .single()
      if (data?.id) institution_id = data.id as string
    } catch (_) { /* not found */ }
  }

  console.log('[webhook] event:', event, '| institution:', institution_id, '| instance:', body?.instance)

  // CONNECTION_UPDATE
  if (event === 'connection_update' && institution_id) {
    const state = body?.data?.state || ''
    const connected = state === 'open'
    try {
      const supabase = getSupabaseAdmin()
      await supabase
        .from('institutions')
        .update({ whatsapp_connected: connected } as never)
        .eq('id', institution_id)
    } catch (e) {
      console.error('[webhook] connection_update save error:', e)
    }
    return
  }

  // MESSAGES_UPSERT
  if (event === 'messages_upsert') {
    if (!institution_id) {
      console.warn('[webhook] messages_upsert without institution_id — skipping')
      return
    }

    const msg = body?.data
    const key = msg?.key
    const message = msg?.message || {}
    const msgType = Object.keys(message)[0] || 'conversation'
    const remoteJid: string = key?.remoteJid || ''

    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) return

    let content = '[mídia]'
    let media_url: string | null = null

    if (message.conversation) {
      content = message.conversation
    } else if (message.extendedTextMessage?.text) {
      content = message.extendedTextMessage.text
    } else if (message.imageMessage) {
      content = message.imageMessage.caption || '[Imagem]'
      media_url = message.imageMessage.url || null
    } else if (message.audioMessage) {
      content = '[Áudio]'
      media_url = message.audioMessage.url || null
    } else if (message.pttMessage) {
      content = '[Áudio]'
      media_url = message.pttMessage.url || null
    } else if (message.videoMessage) {
      content = message.videoMessage.caption || '[Vídeo]'
      media_url = message.videoMessage.url || null
    } else if (message.documentMessage) {
      content = message.documentMessage.fileName || '[Documento]'
      media_url = message.documentMessage.url || null
    } else if (message.stickerMessage) {
      content = '[Figurinha]'
    }

    const contact_name = key?.fromMe ? null : (msg?.pushName || null)
    const timestamp = msg?.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString()

    // Try to upload media to Supabase Storage
    const mediaTypes = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'pttMessage']
    if (mediaTypes.includes(msgType) && key?.id) {
      try {
        const supabase = getSupabaseAdmin()
        const b64Res = await fetch(`${EVOLUTION_URL}/chat/getBase64FromMediaMessage/${body.instance}`, {
          method: 'POST',
          headers: evolutionHeaders(),
          body: JSON.stringify({ message: msg.message, convertToMp4: false }),
          signal: AbortSignal.timeout(12000),
        })
        if (b64Res.ok) {
          const b64Data = await b64Res.json()
          const base64 = b64Data.base64 || b64Data.data
          if (base64) {
            const mimeType = b64Data.mimetype || 'application/octet-stream'
            const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
            const storagePath = `${institution_id}/${key.id}.${ext}`
            const { error: uploadError } = await supabase.storage
              .from('whatsapp-media')
              .upload(storagePath, Buffer.from(base64, 'base64'), { contentType: mimeType, upsert: true })
            if (!uploadError) {
              const { data: pub } = supabase.storage.from('whatsapp-media').getPublicUrl(storagePath)
              media_url = pub.publicUrl
            }
          }
        }
      } catch (e) {
        console.warn('[webhook] media upload error:', (e as Error).message)
      }
    }

    // Match lead by phone
    const phoneDigits = remoteJid.replace(/\D/g, '').replace(/^55/, '')
    let lead_id: string | null = null
    if (phoneDigits.length >= 8) {
      try {
        const supabase = getSupabaseAdmin()
        const { data: leads } = await supabase
          .from('leads')
          .select('id, phone')
          .eq('institution_id', institution_id)
          .limit(200)
        if (leads) {
          const match = leads.find((l: { id: string; phone?: string }) =>
            l.phone && l.phone.replace(/\D/g, '').endsWith(phoneDigits.slice(-8))
          )
          if (match) lead_id = match.id as string
        }
      } catch (_) { /* lead lookup optional */ }
    }

    try {
      const supabase = getSupabaseAdmin()

      const { error: msgErr } = await supabase.from('whatsapp_messages').upsert({
        message_id:     key?.id,
        institution_id,
        instance_name:  body?.instance,
        remote_jid:     remoteJid,
        from_me:        key?.fromMe ?? false,
        message_type:   msgType,
        content,
        media_url,
        contact_name,
        lead_id,
        timestamp,
        raw_data:       msg,
      }, { onConflict: 'message_id' })

      if (msgErr) console.error('[webhook] upsert message error:', msgErr)

      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('status')
        .eq('institution_id', institution_id)
        .eq('remote_jid', remoteJid)
        .single()

      const isNew = !existingConv
      const shouldReopen = existingConv?.status === 'closed'

      await supabase.from('whatsapp_conversations').upsert({
        institution_id,
        remote_jid: remoteJid,
        contact_name: contact_name || null,
        lead_id,
        last_message_at: timestamp,
        ...(isNew && { status: 'waiting' }),
        ...(shouldReopen && { status: 'waiting', assigned_user_id: null, assigned_user_name: null }),
      }, { onConflict: 'institution_id,remote_jid' })

      if (!key?.fromMe) {
        await supabase.rpc('increment_conversation_unread', {
          p_institution_id: institution_id,
          p_remote_jid: remoteJid,
        }).catch(() => {})

        void supabase.from('whatsapp_conversation_events').insert({
          institution_id,
          remote_jid: remoteJid,
          event_type: 'message_received',
          description: `Mensagem recebida${contact_name ? ` de ${contact_name}` : ''}`,
          created_at: timestamp,
        }).catch(() => {})
      }
    } catch (e) {
      console.error('[webhook] db error:', e)
    }
  }
}

// ═══════════════════════════════════════════════════════════
//  sync-messages
// ═══════════════════════════════════════════════════════════
async function handleSyncMessages(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { institutionId, instanceName: instanceNameParam } = req.body

  if (!institutionId) {
    return res.status(400).json({ error: 'institutionId required' })
  }

  const instanceName = await getInstanceForInstitution(institutionId) || instanceNameParam
  if (!instanceName) {
    return res.status(400).json({ error: 'No evolution_instance found for this institution' })
  }

  const since = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)
  console.log(`[sync] ${instanceName} since ${new Date(since * 1000).toISOString()}`)

  const supabase = getSupabaseAdmin()

  let chats: Record<string, unknown>[] = []
  try {
    const chatsRes = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
      method: 'POST',
      headers: evolutionHeaders(),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15000),
    })
    if (chatsRes.ok) {
      const raw = await chatsRes.json()
      chats = (Array.isArray(raw) ? raw : raw.chats || [])
        .filter((c: any) => c.id?.endsWith('@s.whatsapp.net'))
        .slice(0, 50)
    } else {
      console.warn('[sync] findChats failed:', chatsRes.status)
    }
  } catch (e) {
    console.warn('[sync] findChats error:', e)
  }

  let totalSynced = 0

  for (const chat of chats) {
    try {
      const msgsRes = await fetch(`${EVOLUTION_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: evolutionHeaders(),
        body: JSON.stringify({
          where: {
            key: { remoteJid: chat.id },
            messageTimestamp: { $gte: since },
          },
          limit: 100,
        }),
        signal: AbortSignal.timeout(10000),
      })
      if (!msgsRes.ok) continue

      const msgsData = await msgsRes.json()
      const msgs: any[] = Array.isArray(msgsData) ? msgsData : msgsData.messages || []
      if (msgs.length === 0) continue

      const phone = (chat.id as string).replace('@s.whatsapp.net', '')
      const rows = msgs
        .map((msg: any) => {
          const remoteJid: string = msg.key?.remoteJid || ''
          if (!msg.key?.id || !remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return null

          const m = msg.message || {}
          const content =
            m.conversation ||
            m.extendedTextMessage?.text ||
            m.imageMessage?.caption ||
            m.videoMessage?.caption ||
            m.documentMessage?.fileName ||
            (m.audioMessage || m.pttMessage ? '[Áudio]' : '') ||
            (m.stickerMessage ? '[Figurinha]' : '') ||
            '[mídia]'
          const message_type =
            m.imageMessage    ? 'imageMessage'    :
            m.videoMessage    ? 'videoMessage'    :
            m.audioMessage    ? 'audioMessage'    :
            m.pttMessage      ? 'audioMessage'    :
            m.documentMessage ? 'documentMessage' :
            m.stickerMessage  ? 'stickerMessage'  :
            'conversation'
          const media_url =
            m.imageMessage?.url    ||
            m.videoMessage?.url    ||
            m.audioMessage?.url    ||
            m.pttMessage?.url      ||
            m.documentMessage?.url ||
            null
          const timestamp = msg.messageTimestamp
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString()

          return {
            message_id:     msg.key.id,
            institution_id: institutionId,
            instance_name:  instanceName,
            remote_jid:     remoteJid,
            from_me:        msg.key.fromMe ?? false,
            message_type,
            content,
            media_url,
            contact_name:   msg.pushName || msg.notifyName || (chat as any).name || phone,
            timestamp,
            raw_data:       msg,
          }
        })
        .filter((m: any) => m?.message_id)

      if (rows.length > 0) {
        const { error } = await supabase
          .from('whatsapp_messages')
          .upsert(rows, { onConflict: 'message_id' })
        if (error) console.warn('[sync] upsert error:', error.message)
        else totalSynced += rows.length
      }

      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg) {
        const lastTs = lastMsg.messageTimestamp
          ? new Date(Number(lastMsg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString()
        const chatPhone = (chat.id as string).replace('@s.whatsapp.net', '')

        await supabase.from('whatsapp_conversations').upsert({
          institution_id: institutionId,
          remote_jid: chat.id,
          contact_name: (chat as any).name || (chat as any).pushName || chatPhone,
          last_message_at: lastTs,
          unread_count: (chat as any).unreadCount || 0,
        }, { onConflict: 'institution_id,remote_jid' })
      }

      await new Promise(r => setTimeout(r, 60))
    } catch (e) {
      console.warn('[sync] error on chat', chat.id, e)
    }
  }

  console.log(`[sync] done: ${totalSynced} messages synced from ${chats.length} chats`)
  return res.json({ success: true, synced: totalSynced, chats: chats.length })
}

// ═══════════════════════════════════════════════════════════
//  media-proxy
// ═══════════════════════════════════════════════════════════
async function handleMediaProxy(req: VercelRequest, res: VercelResponse) {
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

  // Attempt 1: Direct fetch
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

  // Attempt 2: Evolution getBase64FromMediaMessage
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

  // Attempt 3: Look up stored URL in Supabase
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

// ═══════════════════════════════════════════════════════════
//  fetch-profile (GET)
// ═══════════════════════════════════════════════════════════
async function handleFetchProfile(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { instanceName, number } = req.query
  if (!instanceName || !number) return res.status(400).json({ error: 'Missing params' })
  try {
    const response = await fetch(`${EVOLUTION_URL}/chat/fetchProfile/${instanceName}?number=${number}`, {
      headers: { apikey: EVOLUTION_KEY },
    })
    const data = await response.json()
    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}

// ═══════════════════════════════════════════════════════════
//  get-profile-picture (POST)
// ═══════════════════════════════════════════════════════════
async function handleGetProfilePicture(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { instanceName, number } = req.body
  if (!instanceName || !number) return res.status(400).json({ error: 'Missing params' })
  try {
    const response = await fetch(`${EVOLUTION_URL}/chat/fetchProfile/${instanceName}`, {
      method: 'POST',
      headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number }),
    })
    const data = await response.json()
    return res.status(response.ok ? 200 : response.status).json(data)
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}

// ═══════════════════════════════════════════════════════════
//  set-webhook
// ═══════════════════════════════════════════════════════════
async function handleSetWebhook(req: VercelRequest, res: VercelResponse) {
  const { instanceName, webhookUrl } = req.body

  console.log('[set-webhook] instanceName:', instanceName)
  console.log('[set-webhook] webhookUrl:', webhookUrl)

  // v2.3.x requer wrapper "webhook:" no body
  const body = {
    webhook: {
      url: webhookUrl,
      enabled: true,
      webhookByEvents: false,
      webhookBase64: false,
      events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
    },
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

  return res.status(200).json({
    evolutionStatus: response.status,
    evolutionBody: text,
  })
}
