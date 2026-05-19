import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'
// Disable body-parser — raw buffer needed for HMAC-SHA256 validation
export const config = {
  api: { bodyParser: false },
}

async function getWAConfig() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token', 'wa_verify_token', 'wa_app_secret', 'wa_waba_id'])
  const cfg: Record<string, string> = {}
  data?.forEach((r: any) => { cfg[r.key] = r.value })
  return {
    accessToken:  cfg['wa_access_token']  || process.env.WA_ACCESS_TOKEN  || '',
    verifyToken:  cfg['wa_verify_token']  || process.env.WA_VERIFY_TOKEN  || '',
    appSecret:    cfg['wa_app_secret']    || process.env.WA_APP_SECRET    || '',
    wabaId:       cfg['wa_waba_id']       || '',
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

const MEDIA_TYPES = ['image', 'video', 'audio', 'document', 'sticker', 'voice'] as const
type MediaType = (typeof MEDIA_TYPES)[number]

// ── Read raw body buffer (required for HMAC before JSON.parse) ───────────────
async function readRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    )
    req.on('end',   () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ── Send automatic text message via Meta Cloud API ───────────────────────────
async function sendAutoMessage(
  institutionId: string,
  to:            string,
  text:          string
): Promise<void> {
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .single()

    const waConfig = await getWAConfig()
    if (!phone?.phone_number_id || !waConfig.accessToken) return

    const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${waConfig.accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      }),
    })

    if (resp.ok) {
      const d    = await resp.json()
      const wamid = d.messages?.[0]?.id
      await supabase.from('whatsapp_messages').insert({
        institution_id: institutionId,
        remote_jid:     to,
        message_id:     wamid,
        instance_name:  'cloud-api',
        content:        text,
        message_type:   'text',
        from_me:        true,
        contact_name:   '_bot_',
        status:         'sent',
        direction:      'outbound',
        timestamp:      new Date().toISOString(),
      })
    }
  } catch (e) {
    console.error('❌ sendAutoMessage error:', e)
  }
}

// ── Fetch media from Meta, upload to Supabase Storage, return public URL ─────
// Falls back to the temporary Meta URL if download/upload fails.
async function resolveMediaUrl(
  mediaId:       string,
  institutionId: string,
  mimeType:      string
): Promise<string | null> {
  const waConfig = await getWAConfig()
  if (!waConfig.accessToken || !mediaId) return null

  try {
    // 1. Get media metadata (temporary download URL)
    const metaRes = await fetch(`${GRAPH_URL}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}` },
      signal:  AbortSignal.timeout(5_000),
    })
    if (!metaRes.ok) return null

    const meta    = await metaRes.json()
    const tempUrl = meta.url as string | undefined
    if (!tempUrl) return null

    // 2. Download binary (skip files > 10 MB to stay within function timeout)
    const dlRes = await fetch(tempUrl, {
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}` },
      signal:  AbortSignal.timeout(20_000),
    })
    if (!dlRes.ok) return tempUrl

    const buffer = Buffer.from(await dlRes.arrayBuffer())
    if (buffer.length > 10 * 1024 * 1024) {
      // Too large for inline processing — return temporary URL as fallback
      return tempUrl
    }

    // 3. Upload to Supabase Storage (permanent URL)
    const ext         = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin'
    const storagePath = `${institutionId}/${Date.now()}_${mediaId}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false })

    if (uploadErr) {
      console.error('❌ Storage upload error:', uploadErr.message)
      return tempUrl // fallback
    }

    const { data: { publicUrl } } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(storagePath)

    return publicUrl
  } catch (e) {
    console.error('❌ resolveMediaUrl error:', e)
    return null
  }
}

// ── Auto-link lead by phone number ───────────────────────────────────────────
async function autoLinkLead(institutionId: string, remoteJid: string): Promise<void> {
  try {
    const phone   = remoteJid.replace(/@.*/, '')           // strip @s.whatsapp.net
    const noCode  = phone.startsWith('55') ? phone.slice(2) : phone

    // Try phone variants: raw, with 55, with +55, without country code
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('institution_id', institutionId)
      .or(
        [
          `phone.eq.${phone}`,
          `phone.eq.55${noCode}`,
          `phone.eq.+55${noCode}`,
          `phone.eq.${noCode}`,
        ].join(',')
      )
      .limit(1)
      .maybeSingle()

    if (lead?.id) {
      await supabase
        .from('whatsapp_conversations')
        .update({ lead_id: lead.id })
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .is('lead_id', null) // only update if not yet linked
    }
  } catch (e) {
    console.error('❌ autoLinkLead error:', e)
  }
}

// ── Custom flow state-machine processor ─────────────────────────────────────
async function processCustomFlow(
  institutionId:     string,
  remoteJid:         string,
  text:              string,
  flow:              any,
  isNewConversation: boolean
): Promise<void> {
  const bf = flow.bot_flow as { nodes: any[]; edges: any[] } | null
  if (!bf?.nodes?.length) return

  // 1. Fetch conversation state
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('bot_current_node, bot_variables')
    .eq('institution_id', institutionId)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  let currentNodeId: string = isNewConversation ? 'start' : (conv?.bot_current_node || 'start')
  let variables: Record<string, string> = isNewConversation ? {} : (conv?.bot_variables || {})

  const findNode = (id: string) => bf.nodes.find((n: any) => n.id === id)

  // Support both old format (from/fromPort/to) and new format (fromNodeId/fromPortId/toNodeId)
  const PORT_ALIASES: Record<string, string> = {
    output: 'out', input: 'in', true: 'yes', false: 'no',
  }
  const normalizePort = (p: string) => PORT_ALIASES[p] ?? p

  const edgesFrom = (fromId: string, port?: string): any[] => {
    const normPort = port ? normalizePort(port) : undefined
    return bf.edges.filter((e: any) => {
      const eFrom = e.fromNodeId ?? e.from
      const ePort = normalizePort(e.fromPortId ?? e.fromPort ?? '')
      return eFrom === fromId && (!normPort || ePort === normPort)
    })
  }
  const nextId = (e: any): string => e.toNodeId ?? e.to

  function interp(str: string): string {
    return str.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => variables[k] ?? `{{${k}}}`)
  }

  let current = findNode(currentNodeId)
  // Fall back to first start node if stored id not found
  if (!current) {
    current = bf.nodes.find((n: any) => n.type === 'start')
    currentNodeId = current?.id ?? 'start'
  }

  // 2. Handle user input for the CURRENT node (before advancing)
  if (current?.type === 'question' && current.data?.variable && text.trim()) {
    variables[current.data.variable] = text.trim()
    const nexts = edgesFrom(currentNodeId, 'out')
    if (nexts.length) { currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId) }
  } else if (current?.type === 'menu' && variables[`__menu_sent_${currentNodeId}`]) {
    // Menu was already displayed — process user's choice
    console.log('[MENU S2] processando resposta do menu, texto:', text, '| options:', JSON.stringify(current.data?.options))
    const choice  = parseInt(text.trim(), 10)
    const options = current.data?.options || []
    const menuHeader = interp(current.data?.menuText || current.data?.text || 'Escolha uma opção:')
    const optionsText = options.map((o: any, i: number) => `${i + 1}. ${o.text}`).join('\n')
    const optIdx  = options.findIndex((o: any, i: number) => (o.number ?? i + 1) === choice)
    if (optIdx >= 0) {
      const opt = options[optIdx]
      let nexts = edgesFrom(currentNodeId, `opt-${optIdx}`)
      if (!nexts.length && opt.id) nexts = edgesFrom(currentNodeId, opt.id)
      if (nexts.length) {
        delete variables[`__menu_sent_${currentNodeId}`]
        currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId)
      } else {
        // Valid choice but no connecting edge — keep waiting
        const msg = `Opção inválida. Por favor escolha:\n\n${menuHeader}\n\n${optionsText}`
        await sendAutoMessage(institutionId, remoteJid, msg)
        await supabase.from('whatsapp_conversations')
          .update({ bot_current_node: currentNodeId, bot_variables: variables })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        return
      }
    } else {
      // Invalid choice — re-display full menu
      const msg = `Opção inválida. Por favor escolha:\n\n${menuHeader}\n\n${optionsText}`
      await sendAutoMessage(institutionId, remoteJid, msg)
      await supabase.from('whatsapp_conversations')
        .update({ bot_current_node: currentNodeId, bot_variables: variables })
        .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
      return
    }
  }

  // 3. Execute nodes until user input required or end reached
  let guard = 25
  while (current && guard-- > 0) {
    if (guard === 0) console.warn('[flow] guard limit reached — possible infinite loop in bot flow')
    const node = current
    console.log('[flow] nó:', node.id, 'tipo:', node.type, 'texto:', text)

    if (node.type === 'start') {
      const nexts = edgesFrom(node.id)
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'message') {
      const msg = interp(node.data?.text || '')
      if (msg) await sendAutoMessage(institutionId, remoteJid, msg)
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'question') {
      const q = interp(node.data?.text || '')
      if (q) await sendAutoMessage(institutionId, remoteJid, q)
      break  // Wait for answer
    }

    if (node.type === 'menu') {
      const menuHeader  = interp(node.data?.menuText || node.data?.text || '')
      const options     = node.data?.options || []
      const optionsText = options.map((o: any, i: number) => `${i + 1}. ${o.text}`).join('\n')
      const fullText    = [menuHeader, optionsText].filter(Boolean).join('\n\n')
      console.log('[MENU] options:', JSON.stringify(options))
      console.log('[MENU] menuText:', menuHeader)
      console.log('[MENU] fullText:', fullText)
      console.log('[MENU] __menu_sent flag:', variables[`__menu_sent_${node.id}`])
      if (fullText.trim()) await sendAutoMessage(institutionId, remoteJid, fullText)
      variables[`__menu_sent_${node.id}`] = 'true'
      break  // Section 4 saves currentNodeId and variables
    }

    if (node.type === 'transfer') {
      const transferMsg = node.data?.message || node.data?.transferMessage
      if (transferMsg) await sendAutoMessage(institutionId, remoteJid, interp(transferMsg))
      const assigneeId = node.data?.assignee_id || node.data?.assigneeId
      if (assigneeId) {
        let assigneeName: string | null = node.data.assignee_name || node.data.assigneeName || null
        if (!assigneeName) {
          const { data: u } = await supabase
            .from('users').select('full_name').eq('id', assigneeId).maybeSingle()
          assigneeName = (u as any)?.full_name || null
        }
        await supabase.from('whatsapp_conversations').update({
          assigned_user_id:   assigneeId,
          assigned_user_name: assigneeName,
          bot_active: false,
          status: 'open',
        }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
      } else {
        console.warn('[flow] transfer node has no assigneeId — deactivating bot without assigning')
        await supabase.from('whatsapp_conversations').update({
          bot_active: false,
        }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
      }
      currentNodeId = 'end'; break
    }

    if (node.type === 'condition') {
      let result = false
      if (node.data?.conditionType === 'business_hours') {
        const tz  = flow.timezone || 'America/Fortaleza'
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
        const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
        const isDay = ((flow.working_days as string[]) ?? []).includes(days[now.getDay()])
        const [sh, sm] = (flow.working_start || '08:00').split(':').map(Number)
        const [eh, em] = (flow.working_end   || '18:00').split(':').map(Number)
        const cur = now.getHours() * 60 + now.getMinutes()
        result = isDay && cur >= sh * 60 + sm && cur <= eh * 60 + em
      } else if (node.data?.conditionType === 'lunch_break') {
        const tz  = flow.timezone || 'America/Fortaleza'
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
        const [lsh, lsm] = (flow.lunch_start || '12:00').split(':').map(Number)
        const [leh, lem] = (flow.lunch_end   || '13:00').split(':').map(Number)
        const cur = now.getHours() * 60 + now.getMinutes()
        result = cur >= lsh * 60 + lsm && cur <= leh * 60 + lem
      } else if (node.data?.conditionType === 'keyword') {
        result = text.toLowerCase().includes((node.data.keyword || '').toLowerCase())
      } else if (node.data?.conditionType === 'first_message') {
        result = isNewConversation
      }
      // 'yes'/'no' (new) and 'true'/'false' (old) both resolved by normalizePort
      const nexts = edgesFrom(node.id, result ? 'yes' : 'no')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'action' || node.type === 'lead') {
      if (node.data?.actionType === 'create_lead') {
        const phone  = remoteJid.replace(/@.*/, '')
        const noCode = phone.startsWith('55') ? phone.slice(2) : phone
        const { data: existing } = await supabase.from('leads').select('id')
          .eq('institution_id', institutionId)
          .or(`phone.eq.${phone},phone.eq.55${noCode},phone.eq.+55${noCode}`)
          .maybeSingle()
        if (!existing) {
          await supabase.from('leads').insert({
            institution_id: institutionId,
            phone: phone.startsWith('55') ? phone : `55${noCode}`,
            student_name: variables.nome_aluno || variables.nome || '',
            status: 'novo',
          })
        }
      } else if (node.data?.actionType === 'add_tag') {
        const tag = node.data.tag?.trim()
        if (tag) {
          const { data: conv } = await supabase.from('whatsapp_conversations')
            .select('tags').eq('institution_id', institutionId).eq('remote_jid', remoteJid).maybeSingle()
          const tags: string[] = conv?.tags || []
          if (!tags.includes(tag)) {
            await supabase.from('whatsapp_conversations')
              .update({ tags: [...tags, tag] })
              .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
          }
        }
      } else if (node.data?.actionType === 'close_conversation') {
        await supabase.from('whatsapp_conversations')
          .update({ status: 'closed', bot_active: false })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
      }
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'wait') {
      // Serverless: can't truly sleep — advance immediately
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'media') {
      const mediaUrl = node.data?.url || node.data?.mediaUrl
      if (mediaUrl) {
        const rawType = (node.data?.mediaType || 'image') as string
        const metaType = rawType === 'audio' ? 'audio'
          : rawType === 'video' ? 'video'
          : rawType === 'document' ? 'document'
          : 'image'
        try {
          const { data: phone } = await supabase
            .from('whatsapp_phone_numbers')
            .select('phone_number_id')
            .eq('institution_id', institutionId)
            .eq('is_active', true)
            .single()
          const waConfig = await getWAConfig()
          if (phone?.phone_number_id && waConfig.accessToken) {
            const mediaBody: Record<string, any> = { link: mediaUrl }
            if (node.data?.caption) mediaBody.caption = interp(node.data.caption)
            if (metaType === 'document' && node.data?.filename) mediaBody.filename = node.data.filename
            const payload: Record<string, any> = {
              messaging_product: 'whatsapp', recipient_type: 'individual',
              to: remoteJid, type: metaType, [metaType]: mediaBody,
            }
            const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (resp.ok) {
              const d = await resp.json()
              await supabase.from('whatsapp_messages').insert({
                institution_id: institutionId, remote_jid: remoteJid,
                message_id: d.messages?.[0]?.id, instance_name: 'cloud-api',
                content: node.data?.caption || `[${metaType}]`,
                message_type: metaType, media_url: mediaUrl,
                from_me: true, contact_name: '_bot_', status: 'sent',
                direction: 'outbound', timestamp: new Date().toISOString(),
              })
            } else {
              console.error('[flow] media send failed:', await resp.text())
            }
          }
        } catch (e) {
          console.error('[flow] media node send error:', e)
        }
      }
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'distribute') {
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'end') { currentNodeId = 'end'; break }
    break
  }

  // 4. Persist conversation state
  await supabase.from('whatsapp_conversations').update({
    bot_current_node: currentNodeId,
    bot_variables:    variables,
  }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
}

// ── Full automated flow processor ───────────────────────────────────────────
async function processFlow(
  institutionId:     string,
  remoteJid:         string,
  text:              string,
  isNewConversation: boolean
): Promise<void> {
  try {
    // a) Blacklist check
    const { data: blocked } = await supabase
      .from('whatsapp_blacklist')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('phone_number', remoteJid)
      .maybeSingle()

    if (blocked) {
      console.log('[flow] número em blacklist, ignorando:', remoteJid)
      return
    }

    // b) Fetch flow configuration
    const { data: flow, error: flowErr } = await supabase
      .from('whatsapp_flows')
      .select('*')
      .eq('institution_id', institutionId)
      .maybeSingle()

    console.log('[FLOW] iniciando processFlow', {
      institutionId,
      remoteJid,
      isNewConversation,
      flowFound:      !!flow,
      flowErr:        flowErr?.message,
      is_active:      flow?.is_active,
      bot_enabled:    flow?.bot_enabled,
      botFlowNodes:   flow?.bot_flow?.nodes?.length ?? 0,
    })

    if (!flow || !flow.is_active) {
      console.log('[FLOW] sem fluxo ativo — is_active:', flow?.is_active, '| flow null?', !flow)
      return
    }

    // c) Custom bot_flow — highest priority, bypasses working-hours gate entirely.
    //    The flow itself can handle off-hours via condition nodes.
    if (flow.bot_enabled && flow.bot_flow?.nodes?.length) {
      const { data: convState } = await supabase
        .from('whatsapp_conversations')
        .select('bot_active, assigned_user_id')
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .maybeSingle()

      console.log('[FLOW] convState:', { bot_active: convState?.bot_active, assigned_user_id: convState?.assigned_user_id })

      // Bot already running — continue flow from current node
      if (convState?.bot_active === true) {
        await processCustomFlow(institutionId, remoteJid, text, flow, false)
        return
      }

      // Human agent attending — skip bot entirely
      if (convState?.bot_active === false && convState?.assigned_user_id) {
        console.log('[flow] humano atendendo, robô pausado')
        return
      }

      // bot_active=false + no assignee: only activate for truly first messages
      if (isNewConversation) {
        const { count } = await supabase
          .from('whatsapp_messages')
          .select('id', { count: 'exact', head: true })
          .eq('remote_jid', remoteJid)
          .eq('institution_id', institutionId)

        if ((count ?? 0) <= 1) {
          const { error: botErr } = await supabase.from('whatsapp_conversations').update({
            bot_active: true, bot_current_node: null, bot_variables: {},
          }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
          if (botErr) console.error('❌ bot activation error:', botErr.message)
          await processCustomFlow(institutionId, remoteJid, text, flow, true)
        } else {
          console.log('[flow] conversa reaberta com histórico, robô não ativado')
        }
        return
      }

      // Not new + bot_active=false + no assignee → bot finished, skip
      console.log('[flow] robô inativo e sem atendente, ignorando')
      return
    }

    // d) Standard flow: working hours check (only reached when no custom bot_flow)
    const tz             = flow.timezone || 'America/Fortaleza'
    const now            = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
    const dayKeys        = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const currentDay     = dayKeys[now.getDay()]
    const isWorkingDay   = ((flow.working_days as string[]) ?? []).includes(currentDay)
    const [startH, startM] = (flow.working_start || '08:00').split(':').map(Number)
    const [endH,   endM  ] = (flow.working_end   || '18:00').split(':').map(Number)
    const currentMin     = now.getHours() * 60 + now.getMinutes()
    const isWorkingHours = currentMin >= startH * 60 + startM && currentMin <= endH * 60 + endM
    const isOpen         = isWorkingDay && isWorkingHours

    console.log('[flow]', {
      isOpen, isWorkingDay, isWorkingHours,
      day: currentDay,
      time: `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      isNewConversation,
      text: text.slice(0, 60),
    })

    // Off-hours: only notify on new conversations
    if (!isOpen) {
      if (isNewConversation && flow.off_hours_message) {
        await sendAutoMessage(institutionId, remoteJid, flow.off_hours_message)
      }
      return
    }

    // e) Standard flow: new conversation → welcome + menu
    if (isNewConversation) {
      const { data: recentAuto } = await supabase
        .from('whatsapp_messages')
        .select('id')
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .eq('from_me', true)
        .gte('timestamp', new Date(Date.now() - 5 * 60_000).toISOString())
        .maybeSingle()

      if (!recentAuto) {
        if (flow.welcome_message) {
          await sendAutoMessage(institutionId, remoteJid, flow.welcome_message)
        }
        if (flow.menu_enabled && flow.menu_message) {
          await sendAutoMessage(institutionId, remoteJid, flow.menu_message)
        }
      } else {
        console.log('[flow] boas-vindas suprimidas (mensagem automática recente)')
      }
      return
    }

    // e) Menu choice: user typed a number or keyword
    if (flow.menu_enabled) {
      const menuOptions: any[] = flow.menu_options || []
      const trimmed = text.trim()
      const num = parseInt(trimmed, 10)
      const menuChoice = menuOptions.find((o: any) =>
        (!isNaN(num) && o.number === num) || o.keyword === trimmed
      )

      if (menuChoice) {
        const responseMsg = menuChoice.response || menuChoice.response_message
        if (responseMsg) await sendAutoMessage(institutionId, remoteJid, responseMsg)

        const convUpdates: any = { bot_active: false }
        if (menuChoice.assignee_id) {
          let assigneeName: string | null = menuChoice.assignee_name || null
          if (!assigneeName) {
            const { data: u } = await supabase
              .from('users').select('name').eq('id', menuChoice.assignee_id).maybeSingle()
            assigneeName = (u as any)?.name || null
          }
          convUpdates.assigned_user_id   = menuChoice.assignee_id
          convUpdates.assigned_user_name = assigneeName
        }
        await supabase.from('whatsapp_conversations').update(convUpdates)
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        const { error: evtErr } = await supabase.from('whatsapp_conversation_events').insert({
          institution_id: institutionId,
          remote_jid:     remoteJid,
          event_type:     'transfer',
          description:    `Robô transferiu para ${convUpdates.assigned_user_name || 'atendente'} via opção ${trimmed}`,
        })
        if (evtErr) console.error('❌ event insert error:', evtErr.message)
        console.log('[flow] menu option:', trimmed, '→ assignee:', convUpdates.assigned_user_name)
        return
      }

      // Invalid number typed — resend menu
      if (!isNaN(num) && menuOptions.length > 0 && flow.menu_message) {
        await sendAutoMessage(institutionId, remoteJid, flow.menu_message)
        return
      }
    }

    // f) Bot message count → transfer to default assignee after threshold
    if ((flow.transfer_after_messages ?? 0) > 0 && flow.default_assignee_id) {
      const { count } = await supabase
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .eq('from_me', true)

      if ((count ?? 0) >= flow.transfer_after_messages) {
        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('assigned_user_id')
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
          .maybeSingle()

        if (!conv?.assigned_user_id) {
          await supabase
            .from('whatsapp_conversations')
            .update({ assigned_user_id: flow.default_assignee_id })
            .eq('institution_id', institutionId)
            .eq('remote_jid', remoteJid)
          console.log('[flow] transferido para atendente padrão após', count, 'msg do bot')
        }
      }
    }

  } catch (e) {
    console.error('❌ processFlow error:', e)
  }
}

// ── Áion corporate inbox processor ──────────────────────────────────────────
async function detectAionQueue(rawPhone: string, supabase: ReturnType<typeof createClient>): Promise<string> {
  const phone = rawPhone.replace(/\D/g, '').replace(/^55/, '')

  const { data: lead } = await supabase
    .from('crm_leads')
    .select('id, stage')
    .or(`phone.ilike.%${phone}%`)
    .maybeSingle()
  if (lead && lead.stage !== 'cliente') return 'leads'

  const { data: inst } = await supabase
    .from('institutions')
    .select('id')
    .or(`phone.ilike.%${phone}%`)
    .eq('plan_status', 'active')
    .maybeSingle()
  if (inst) return 'schools'

  return 'general'
}

async function processAionMessage({
  msg,
  value,
  supabase,
}: {
  msg: any
  value: any
  supabase: ReturnType<typeof createClient>
}): Promise<void> {
  try {
    const remoteJid   = msg.from as string
    const rawPhone    = remoteJid.replace(/@.*/, '')
    const contactName = (value.contacts?.[0]?.profile?.name as string | undefined) || remoteJid
    const msgType     = (msg.type as string) || 'text'
    const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()

    const text =
      msg.text?.body        ||
      msg.image?.caption    ||
      msg.video?.caption    ||
      msg.document?.caption ||
      ''

    const queue = await detectAionQueue(rawPhone, supabase)

    // Upsert conversation
    const { data: conv, error: convErr } = await supabase
      .from('whatsapp_conversations')
      .upsert(
        {
          remote_jid:      remoteJid,
          institution_id:  null,
          is_aion_inbox:   true,
          queue,
          contact_name:    contactName,
          status:          'waiting',
          last_message:    text || `[${msgType}]`,
          last_message_at: timestamp,
        },
        { onConflict: 'remote_jid,institution_id' }
      )
      .select('id')
      .maybeSingle()

    if (convErr) {
      console.error('❌ [aion] conv upsert error:', convErr.message)
      return
    }

    // Increment unread
    const { error: rpcErr1 } = await supabase
      .rpc('increment_conversation_unread', {
        p_institution_id: null,
        p_remote_jid:     remoteJid,
      })
    if (rpcErr1) console.error('❌ rpc error:', rpcErr1.message)

    // Insert message
    await supabase.from('whatsapp_messages').insert({
      institution_id: null,
      conversation_id: conv?.id || null,
      remote_jid:     remoteJid,
      message_id:     msg.id,
      instance_name:  'cloud-api',
      content:        text || `[${msgType}]`,
      message_type:   msgType,
      from_me:        false,
      contact_name:   contactName,
      timestamp,
      status:         'received',
      direction:      'inbound',
      is_aion_inbox:  true,
      raw_data:       msg,
    })

    console.log('[aion] mensagem recebida de', rawPhone, '→ fila:', queue)
  } catch (e) {
    console.error('❌ [aion] processAionMessage error:', e)
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {

  const waConfig = await getWAConfig()

  // ── GET: Meta webhook verification ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode']
    const token     = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === waConfig.verifyToken) {
      console.log('✅ Webhook verificado')
      return res.status(200).send(challenge)
    }
    return res.status(403).json({ error: 'Token inválido' })
  }

  // ── POST: incoming messages + delivery status updates ──
  if (req.method === 'POST') {
    const rawBody = await readRawBody(req)

    // HMAC-SHA256 validation (timing-safe)
    const signature = req.headers['x-hub-signature-256'] as string | undefined
    if (waConfig.appSecret) {
      if (!signature) return res.status(401).json({ error: 'Missing x-hub-signature-256' })

      const expected = `sha256=${crypto
        .createHmac('sha256', waConfig.appSecret)
        .update(rawBody)
        .digest('hex')}`

      if (
        signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
      ) {
        console.warn('⚠️ Webhook signature inválida')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    try {
      const body  = JSON.parse(rawBody.toString())
      const value = body?.entry?.[0]?.changes?.[0]?.value
      if (!value) return res.status(200).end()

      const phoneNumberId = value.metadata?.phone_number_id

      // Check if this is the Áion platform inbox number
      const { data: platformWA } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id')
        .eq('connected', true)
        .maybeSingle()

      if (platformWA?.phone_number_id && platformWA.phone_number_id === phoneNumberId) {
        // Process messages for the Áion corporate inbox
        for (const msg of value.messages || []) {
          await processAionMessage({ msg, value, supabase })
        }
        for (const status of value.statuses || []) {
          await supabase.from('whatsapp_messages')
            .update({ status: status.status, status_updated_at: new Date().toISOString() })
            .eq('message_id', status.id)
            .eq('is_aion_inbox', true)
        }
        return res.status(200).json({ status: 'ok' })
      }

      // Map phone_number_id → institution (school inbox)
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('institution_id')
        .eq('phone_number_id', phoneNumberId)
        .single()

      if (!phoneRecord?.institution_id) {
        console.log('⚠️ phone_number_id não mapeado:', phoneNumberId)
        return res.status(200).json({ status: 'ignored', reason: 'phone_number_id not registered' })
      }

      const institutionId = phoneRecord.institution_id

      // ── Process incoming messages ──────────────────────────────────────────
      for (const msg of value.messages || []) {
        // Always store remote_jid without @-suffix to avoid duplicate rows
        const remoteJid   = (msg.from as string).replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
        const rawPhone    = remoteJid.replace(/@.*/, '')

        // ── Early blacklist check ──
        const { data: isBlocked } = await supabase
          .from('whatsapp_blacklist')
          .select('id')
          .eq('institution_id', institutionId)
          .eq('phone_number', rawPhone)
          .maybeSingle()
        if (isBlocked) {
          console.log('[webhook] número em blacklist, ignorando:', rawPhone)
          continue
        }

        // ── Deleted message (unsupported type from Meta) ──
        if ((msg.type as string) === 'unsupported') {
          const originalId = msg.context?.id as string | undefined
          if (originalId) {
            await supabase.from('whatsapp_messages')
              .update({ content: '🚫 Mensagem apagada', message_type: 'deleted' })
              .eq('message_id', originalId)
              .eq('institution_id', institutionId)
          }
          continue
        }
        const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()
        const contactName = (value.contacts?.[0]?.profile?.name as string | undefined) || remoteJid
        const msgType     = (msg.type as string) || 'text'

        // Extract text body
        const text =
          msg.text?.body         ||
          msg.image?.caption     ||
          msg.video?.caption     ||
          msg.document?.caption  ||
          ''

        // ── Resolve media URL (download + re-upload to Storage) ──
        let mediaUrl: string | null = null

        if (MEDIA_TYPES.includes(msgType as MediaType)) {
          const mediaObj = msg[msgType as keyof typeof msg] as any
          if (mediaObj?.id) {
            const mimeType = (mediaObj.mime_type as string) || 'application/octet-stream'
            mediaUrl = await resolveMediaUrl(mediaObj.id, institutionId, mimeType)
          }
        }

        // ── Check existing conversation ──
        const { data: existingConv } = await supabase
          .from('whatsapp_conversations')
          .select('status, lead_id')
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
          .maybeSingle()

        // ── Satisfaction survey response (closed conversation, score 1-5) ──
        if (existingConv?.status === 'closed' && /^[1-5]$/.test(text.trim())) {
          const { data: sf } = await supabase
            .from('whatsapp_flows')
            .select('satisfaction_survey_enabled')
            .eq('institution_id', institutionId)
            .maybeSingle()
          if (sf?.satisfaction_survey_enabled) {
            const score = parseInt(text.trim(), 10)
            await supabase.from('whatsapp_conversations')
              .update({ satisfaction_score: score, last_message: text.trim(), last_message_at: timestamp })
              .eq('institution_id', institutionId)
              .eq('remote_jid', remoteJid)
            await supabase.from('whatsapp_messages').insert({
              institution_id: institutionId, remote_jid: remoteJid, message_id: msg.id,
              instance_name: 'cloud-api', content: text, message_type: 'text',
              from_me: false, contact_name: contactName, timestamp,
              status: 'received', direction: 'inbound', raw_data: msg,
            })
            await sendAutoMessage(institutionId, remoteJid, 'Obrigado pelo seu feedback! 🙏')
            continue
          }
        }

        const isNewConversation = !existingConv || existingConv.status === 'closed'
        const contentPreview    = text || `[${msgType}]`
        const upsertStatus      = isNewConversation ? 'waiting' : (existingConv?.status ?? 'waiting')

        console.log('[WEBHOOK UPSERT]', {
          remoteJid,
          existingStatus: existingConv?.status ?? null,
          newStatus: upsertStatus,
          isNewConversation,
        })

        // ── Upsert conversation ──
        const { error: convErr } = await supabase
          .from('whatsapp_conversations')
          .upsert(
            {
              institution_id:  institutionId,
              remote_jid:      remoteJid,
              contact_name:    contactName,
              last_message:    contentPreview,
              last_message_at: timestamp,
              status:          upsertStatus,
            },
            { onConflict: 'institution_id,remote_jid' }
          )

        if (convErr) console.error('❌ conv upsert error:', convErr.message)

        // ── Re-open: clear assignee and reset bot so flow restarts clean ──
        if (isNewConversation && existingConv) {
          await supabase.from('whatsapp_conversations')
            .update({
              assigned_user_id: null,
              assigned_user_name: null,
              bot_active: true,
              bot_current_node: null,
              bot_variables: {},
            })
            .eq('institution_id', institutionId)
            .eq('remote_jid', remoteJid)
        }

        // ── Increment unread count (notification badge) ──
        const { error: rpcErr } = await supabase
          .rpc('increment_conversation_unread', {
            p_institution_id: institutionId,
            p_remote_jid:     remoteJid,
          })
        if (rpcErr) console.error('❌ unread increment error:', rpcErr.message)

        // ── Insert message ──
        const { error: msgErr } = await supabase
          .from('whatsapp_messages')
          .insert({
            institution_id: institutionId,
            remote_jid:     remoteJid,
            message_id:     msg.id,
            instance_name:  'cloud-api',
            content:        text || contentPreview,
            message_type:   msgType,
            media_url:      mediaUrl,
            from_me:        false,
            contact_name:   contactName,
            timestamp,
            status:         'received',
            direction:      'inbound',
            raw_data:       msg,
          })

        if (msgErr) console.error('❌ msg insert error:', msgErr.message)

        // ── Auto-link lead by phone (skip if already linked) ──
        if (!existingConv?.lead_id) {
          await autoLinkLead(institutionId, remoteJid)
        }

        // ── Automated flow ──
        await processFlow(institutionId, remoteJid, text, isNewConversation)
      }

      // ── Process delivery/read status updates ──────────────────────────────
      for (const status of value.statuses || []) {
        if (status.status === 'deleted') {
          await supabase.from('whatsapp_messages')
            .update({ content: '🚫 Mensagem apagada', message_type: 'deleted' })
            .eq('message_id', status.id)
            .eq('institution_id', institutionId)
          continue
        }
        const { error: statusErr } = await supabase
          .from('whatsapp_messages')
          .update({
            status:            status.status,
            status_updated_at: new Date().toISOString(),
          })
          .eq('message_id', status.id)

        if (statusErr) console.error('❌ status update error:', statusErr.message)
      }

    } catch (err) {
      console.error('❌ Webhook error:', err)
      // Always return 200 — Meta disables webhooks on consecutive 5xx responses
    }

    return res.status(200).json({ status: 'ok' })
  }

  return res.status(405).end()
}
