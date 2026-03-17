import type { VercelRequest, VercelResponse } from '@vercel/node'
import { EVOLUTION_URL, evolutionHeaders, getSupabaseAdmin, getInstanceForInstitution } from '../_config'

function extractContent(message: Record<string, unknown>): { content: string; msgType: string; mediaUrl: string | null } {
  const msg = message || {}
  if (msg.conversation)                 return { content: msg.conversation as string,                                       msgType: 'conversation',       mediaUrl: null }
  if ((msg as any).extendedTextMessage?.text) return { content: (msg as any).extendedTextMessage.text,                    msgType: 'extendedTextMessage', mediaUrl: null }
  if ((msg as any).imageMessage)        return { content: (msg as any).imageMessage.caption || '[Imagem]',                 msgType: 'imageMessage',       mediaUrl: (msg as any).imageMessage.url || null }
  if ((msg as any).videoMessage)        return { content: (msg as any).videoMessage.caption || '[Vídeo]',                  msgType: 'videoMessage',       mediaUrl: (msg as any).videoMessage.url || null }
  if ((msg as any).audioMessage)        return { content: '[Áudio]',                                                        msgType: 'audioMessage',       mediaUrl: (msg as any).audioMessage.url || null }
  if ((msg as any).pttMessage)          return { content: '[Áudio]',                                                        msgType: 'audioMessage',       mediaUrl: (msg as any).pttMessage.url || null }
  if ((msg as any).documentMessage)     return { content: (msg as any).documentMessage.fileName || '[Documento]',          msgType: 'documentMessage',    mediaUrl: (msg as any).documentMessage.url || null }
  if ((msg as any).stickerMessage)      return { content: '[Figurinha]',                                                    msgType: 'stickerMessage',     mediaUrl: null }
  return { content: '[mídia]', msgType: 'unknown', mediaUrl: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { institutionId, instanceName: instanceNameParam } = req.body

  if (!institutionId) {
    return res.status(400).json({ error: 'institutionId required' })
  }

  // Always look up the canonical instance from the DB; body param is a fallback only
  const instanceName = await getInstanceForInstitution(institutionId) || instanceNameParam
  if (!instanceName) {
    return res.status(400).json({ error: 'No evolution_instance found for this institution' })
  }

  const since = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)
  console.log(`[sync] ${instanceName} since ${new Date(since * 1000).toISOString()}`)

  const supabase = getSupabaseAdmin()

  // ── 1. Fetch chats ───────────────────────────────────────────────────────
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

  // ── 2. For each chat, fetch recent messages ──────────────────────────────
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

      const rows = msgs
        .filter((msg: any) => msg?.key?.id)
        .map((msg: any) => {
          const remoteJid: string = msg.key.remoteJid || ''
          if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return null

          const { content, msgType, mediaUrl } = extractContent(msg.message || {})
          const timestamp = msg.messageTimestamp
            ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
            : new Date().toISOString()

          return {
            institution_id: institutionId,
            instance_name: instanceName,
            remote_jid: remoteJid,
            message_id: msg.key.id,
            from_me: msg.key.fromMe ?? false,
            message_type: msgType,
            content,
            media_url: mediaUrl,
            contact_name: msg.pushName || msg.notifyName || null,
            timestamp,
          }
        })
        .filter(Boolean)

      if (rows.length > 0) {
        const { error } = await supabase
          .from('whatsapp_messages')
          .upsert(rows, { onConflict: 'message_id' })
        if (error) console.warn('[sync] upsert error:', error.message)
        else totalSynced += rows.length
      }

      // Upsert conversation
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg) {
        const lastTs = lastMsg.messageTimestamp
          ? new Date(Number(lastMsg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString()
        const phone = (chat.id as string).replace('@s.whatsapp.net', '')

        await supabase.from('whatsapp_conversations').upsert({
          institution_id: institutionId,
          remote_jid: chat.id,
          contact_name: (chat as any).name || (chat as any).pushName || phone,
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
