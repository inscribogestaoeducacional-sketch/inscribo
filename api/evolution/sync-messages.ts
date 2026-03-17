import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
)

const EVOLUTION_URL = process.env.EVOLUTION_URL || process.env.VITE_EVOLUTION_URL || 'https://evolution-api-production-a00c.up.railway.app'
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || process.env.VITE_EVOLUTION_KEY || '08234626b6cf2b4a47e750a38f98d53a36846971a58bb4290c78eb67c5003da5'

function extractContent(message: any): { content: string; msgType: string; mediaUrl: string | null } {
  const msg = message || {}
  if (msg.conversation)                 return { content: msg.conversation,                               msgType: 'conversation',      mediaUrl: null }
  if (msg.extendedTextMessage?.text)    return { content: msg.extendedTextMessage.text,                   msgType: 'extendedTextMessage', mediaUrl: null }
  if (msg.imageMessage)                 return { content: msg.imageMessage.caption || '[Imagem]',         msgType: 'imageMessage',      mediaUrl: msg.imageMessage.url || null }
  if (msg.videoMessage)                 return { content: msg.videoMessage.caption || '[Vídeo]',          msgType: 'videoMessage',      mediaUrl: msg.videoMessage.url || null }
  if (msg.audioMessage)                 return { content: '[Áudio]',                                      msgType: 'audioMessage',      mediaUrl: msg.audioMessage.url || null }
  if (msg.pttMessage)                   return { content: '[Áudio]',                                      msgType: 'audioMessage',      mediaUrl: msg.pttMessage.url || null }
  if (msg.documentMessage)              return { content: msg.documentMessage.fileName || '[Documento]',  msgType: 'documentMessage',   mediaUrl: msg.documentMessage.url || null }
  if (msg.stickerMessage)               return { content: '[Figurinha]',                                  msgType: 'stickerMessage',    mediaUrl: null }
  return { content: '[mídia]', msgType: 'unknown', mediaUrl: null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { institutionId, instanceName } = req.body
  if (!institutionId || !instanceName) {
    return res.status(400).json({ error: 'institutionId and instanceName required' })
  }

  const since = Math.floor((Date.now() - 48 * 60 * 60 * 1000) / 1000)
  console.log(`[sync] ${instanceName} desde ${new Date(since * 1000).toISOString()}`)

  // ── 1. Fetch all chats from Evolution API ────────────────────────────────
  let chats: any[] = []
  try {
    const chatsRes = await fetch(`${EVOLUTION_URL}/chat/findChats/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
      body: JSON.stringify({}),
    })
    if (chatsRes.ok) {
      const raw = await chatsRes.json()
      chats = (Array.isArray(raw) ? raw : raw.chats || [])
        .filter((c: any) => c.id?.endsWith('@s.whatsapp.net'))
        .slice(0, 50) // cap at 50 conversations
    } else {
      console.warn('[sync] findChats failed:', chatsRes.status)
    }
  } catch (e) {
    console.warn('[sync] findChats error:', e)
  }

  let totalSynced = 0

  // ── 2. For each chat, fetch messages from last 48h ───────────────────────
  for (const chat of chats) {
    try {
      const msgsRes = await fetch(`${EVOLUTION_URL}/chat/findMessages/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
        body: JSON.stringify({
          where: {
            key: { remoteJid: chat.id },
            messageTimestamp: { $gte: since },
          },
          limit: 100,
        }),
      })
      if (!msgsRes.ok) continue
      const msgsData = await msgsRes.json()
      const msgs: any[] = Array.isArray(msgsData) ? msgsData : msgsData.messages || []
      if (msgs.length === 0) continue

      for (const msg of msgs) {
        if (!msg?.key?.id) continue
        const remoteJid: string = msg.key.remoteJid || ''
        if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') continue

        const { content, msgType, mediaUrl } = extractContent(msg.message)
        const contactName = msg.pushName || msg.notifyName || null
        const timestamp = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString()

        await supabase.from('whatsapp_messages').upsert({
          institution_id: institutionId,
          instance_name: instanceName,
          remote_jid: remoteJid,
          message_id: msg.key.id,
          from_me: msg.key.fromMe ?? false,
          message_type: msgType,
          content,
          media_url: mediaUrl,
          contact_name: contactName,
          timestamp,
        }, { onConflict: 'message_id' })

        totalSynced++
      }

      // Upsert conversation record
      const lastMsg = msgs[msgs.length - 1]
      if (lastMsg) {
        const { content: lastContent } = extractContent(lastMsg.message)
        const lastTs = lastMsg.messageTimestamp
          ? new Date(Number(lastMsg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString()
        const phone = chat.id.replace('@s.whatsapp.net', '')

        await supabase.from('whatsapp_conversations').upsert({
          institution_id: institutionId,
          remote_jid: chat.id,
          contact_name: chat.name || chat.pushName || phone,
          last_message_at: lastTs,
          unread_count: chat.unreadCount || 0,
        }, { onConflict: 'institution_id,remote_jid' })
      }

      await new Promise(r => setTimeout(r, 80))
    } catch (e) {
      console.warn('[sync] error on chat', chat.id, e)
    }
  }

  console.log(`[sync] done: ${totalSynced} messages synced`)
  return res.json({ success: true, synced: totalSynced, chats: chats.length })
}
