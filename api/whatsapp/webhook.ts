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

// Item A — janela de "reabertura silenciosa": se o cliente manda mensagem
// nova dentro desse intervalo após a conversa ter sido fechada (encerrada
// pelo atendente ou pelo bot, ver whatsapp_conversations.closed_at), reabre
// pro mesmo atendente sem repetir boas-vindas/menu. Passado esse intervalo,
// comportamento normal de atendimento novo.
const REOPEN_RECENT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 horas

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
      const { data: conv } = await supabase
        .from('whatsapp_conversations')
        .select('first_response_at, id')
        .eq('remote_jid', to)
        .eq('institution_id', institutionId)
        .single()
      if (conv && !conv.first_response_at) {
        await supabase
          .from('whatsapp_conversations')
          .update({ first_response_at: new Date().toISOString() })
          .eq('id', conv.id)
      }
      await supabase.from('whatsapp_messages').insert({
        institution_id: institutionId,
        remote_jid:     to,
        message_id:     wamid,
        instance_name:  'cloud-api',
        content:        text,
        message_type:   'text',
        from_me:        true,
        contact_name:   '_bot_',
        is_bot_message: true,
        status:         'sent',
        direction:      'outbound',
        timestamp:      new Date().toISOString(),
      })
    }
  } catch (e) {
    console.error('❌ sendAutoMessage error:', e)
  }
}

// ── Disponibilidade manual (toggle no TopBar) ────────────────────────────────
// Retorna o subconjunto de memberIds com users.is_available !== false.
// Usado por toda seleção round-robin de grupo (timeout_group_id) — nunca
// atribui conversa a quem marcou "Ausente". Não mexe em conversas já
// atribuídas a alguém que ficou ausente depois.
async function getAvailableMemberIds(memberIds: string[]): Promise<Set<string>> {
  if (!memberIds.length) return new Set()
  const { data } = await supabase.from('users').select('id, is_available').in('id', memberIds)
  return new Set((data || []).filter((u: any) => u.is_available !== false).map((u: any) => u.id))
}

// ── Send interactive menu (buttons ≤3 / list 4-10) via Meta Cloud API ────────
async function sendInteractiveMenu(
  institutionId: string,
  to:            string,
  headerText:    string,
  bodyText:      string,
  options:       Array<{ text: string }>
): Promise<void> {
  const fallbackText = [headerText, options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')]
    .filter(Boolean).join('\n\n')
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('institution_id', institutionId)
      .eq('is_active', true)
      .single()

    const waConfig = await getWAConfig()
    if (!phone?.phone_number_id || !waConfig.accessToken) {
      if (fallbackText.trim()) await sendAutoMessage(institutionId, to, fallbackText)
      return
    }

    const count = Math.min(options.length, 10)
    let interactive: any

    if (count <= 3) {
      interactive = {
        type: 'button',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          buttons: options.slice(0, 3).map((o, i) => ({
            type: 'reply',
            reply: { id: `opt_${i}`, title: o.text.slice(0, 20) },
          })),
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    } else {
      interactive = {
        type: 'list',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          button: 'Ver opções',
          sections: [{
            title: 'Opções',
            rows: options.slice(0, 10).map((o, i) => ({
              id: `opt_${i}`,
              title: o.text.slice(0, 24),
            })),
          }],
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    }

    const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'interactive',
        interactive,
      }),
    })

    if (resp.ok) {
      const d     = await resp.json()
      const wamid = d.messages?.[0]?.id
      await supabase.from('whatsapp_messages').insert({
        institution_id: institutionId,
        remote_jid:     to,
        message_id:     wamid,
        instance_name:  'cloud-api',
        content:        fallbackText,
        message_type:   'interactive',
        from_me:        true,
        contact_name:   '_bot_',
        is_bot_message: true,
        status:         'sent',
        direction:      'outbound',
        timestamp:      new Date().toISOString(),
      })
    } else {
      console.error('[sendInteractiveMenu] Meta error:', await resp.text())
      if (fallbackText.trim()) await sendAutoMessage(institutionId, to, fallbackText)
    }
  } catch (e) {
    console.error('❌ sendInteractiveMenu error:', e)
    try { if (fallbackText.trim()) await sendAutoMessage(institutionId, to, fallbackText) } catch {}
  }
}

// ── Grupos Escolares: WhatsApp compartilhado (pré-roteamento) ───────────────
// Versões de sendAutoMessage/sendInteractiveMenu que buscam as credenciais em
// whatsapp_phone_numbers por school_group_id em vez de institution_id — usadas
// SÓ enquanto o contato ainda não escolheu a unidade (nenhuma institution real
// resolvida ainda). De propósito não gravam em whatsapp_messages: ainda não
// existe uma conversa de uma institution real pra anexar a mensagem. O rastro
// dessa fase fica só no whatsapp_conversations de pré-roteamento
// (institution_id NULL + school_group_id preenchido).
async function sendGroupAutoMessage(schoolGroupId: string, to: string, text: string): Promise<void> {
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('school_group_id', schoolGroupId)
      .eq('is_active', true)
      .single()
    const waConfig = await getWAConfig()
    if (!phone?.phone_number_id || !waConfig.accessToken) return
    await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
    })
  } catch (e) {
    console.error('❌ sendGroupAutoMessage error:', e)
  }
}

async function sendGroupInteractiveMenu(
  schoolGroupId: string,
  to:            string,
  headerText:    string,
  bodyText:      string,
  options:       Array<{ text: string }>
): Promise<void> {
  const fallbackText = [headerText, options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')]
    .filter(Boolean).join('\n\n')
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('school_group_id', schoolGroupId)
      .eq('is_active', true)
      .single()
    const waConfig = await getWAConfig()
    if (!phone?.phone_number_id || !waConfig.accessToken) {
      if (fallbackText.trim()) await sendGroupAutoMessage(schoolGroupId, to, fallbackText)
      return
    }

    const count = Math.min(options.length, 10)
    let interactive: any
    if (count <= 3) {
      interactive = {
        type: 'button',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          buttons: options.slice(0, 3).map((o, i) => ({
            type: 'reply',
            reply: { id: `opt_${i}`, title: o.text.slice(0, 20) },
          })),
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    } else {
      interactive = {
        type: 'list',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          button: 'Ver opções',
          sections: [{
            title: 'Opções',
            rows: options.slice(0, 10).map((o, i) => ({
              id: `opt_${i}`,
              title: o.text.slice(0, 24),
            })),
          }],
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    }

    const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'interactive',
        interactive,
      }),
    })

    if (!resp.ok) {
      console.error('[sendGroupInteractiveMenu] Meta error:', await resp.text())
      if (fallbackText.trim()) await sendGroupAutoMessage(schoolGroupId, to, fallbackText)
    }
  } catch (e) {
    console.error('❌ sendGroupInteractiveMenu error:', e)
    try { if (fallbackText.trim()) await sendGroupAutoMessage(schoolGroupId, to, fallbackText) } catch {}
  }
}

// Resolve o institution_id real a partir de uma mensagem chegada no WhatsApp
// compartilhado de um school_group. Retorna o institution_id quando resolvido
// (conversa já existente em alguma unidade do grupo, OU o contato acabou de
// responder o menu de unidade com uma opção mapeada) — nesse caso o chamador
// deixa o resto do webhook seguir 100% inalterado, idêntico ao caminho de
// telefone dedicado a uma escola. Retorna null quando ainda não dá pra
// resolver — a função já cuidou de mandar a mensagem/menu necessária, o
// chamador só responde 200 e para.
//
// Suporta apenas os tipos de nó 'start' / 'message' / 'menu' no bot_flow do
// grupo — os demais (transfer/action/lead/condition/...) não fazem sentido
// antes de a unidade ser resolvida, já que dependem de uma institution real
// (usuários, tags, leads etc. são todos escopados por institution_id).
async function resolveOrRouteGroupSharedContact(
  schoolGroupId: string,
  value:         any
): Promise<string | null> {
  const msg = value.messages?.[0]
  if (!msg) return null // status update etc. sem mensagem — nada pra rotear

  const rawJid = (msg.from as string || '')
    .replace(/@s\.whatsapp\.net$/, '')
    .replace(/@g\.us$/, '')
  if (!rawJid || rawJid.includes('@')) return null
  const remoteJid = normalizePhone(rawJid)

  // 1. Essa pessoa já tem conversa em alguma unidade do grupo? Já foi
  //    triada antes — continua na mesma unidade, sem perguntar de novo.
  const { data: groupInstitutions } = await supabase
    .from('institutions')
    .select('id')
    .eq('school_group_id', schoolGroupId)
  const groupInstIds = (groupInstitutions || []).map((i: any) => i.id)

  if (groupInstIds.length) {
    const { data: existingRows } = await supabase
      .from('whatsapp_conversations')
      .select('institution_id')
      .eq('remote_jid', remoteJid)
      .in('institution_id', groupInstIds)
      .limit(1)
    if (existingRows?.length) return existingRows[0].institution_id
  }

  // 2. Contato novo pro número compartilhado — roda o mini-fluxo de menu do
  //    grupo (fonte: whatsapp_flows.school_group_id).
  const { data: groupFlow } = await supabase
    .from('whatsapp_flows')
    .select('bot_flow, bot_enabled, is_active')
    .eq('school_group_id', schoolGroupId)
    .maybeSingle()

  const bf = groupFlow?.bot_flow as { nodes: any[]; edges: any[] } | null
  if (!groupFlow?.is_active || !groupFlow?.bot_enabled || !bf?.nodes?.length) {
    console.log('[group-flow] sem fluxo de menu ativo pro grupo:', schoolGroupId)
    return null
  }

  const { data: groupRow } = await supabase
    .from('school_groups')
    .select('menu_institution_map')
    .eq('id', schoolGroupId)
    .maybeSingle()
  const menuMap: Array<{ option_index: number; institution_id: string }> = groupRow?.menu_institution_map || []

  const msgType = msg.type as string
  const text = msg.text?.body || ''
  let interactiveChoiceId = ''
  if (msgType === 'interactive') {
    const ia = msg.interactive
    if (ia?.type === 'button_reply') interactiveChoiceId = ia.button_reply?.id || ''
    else if (ia?.type === 'list_reply') interactiveChoiceId = ia.list_reply?.id || ''
  }

  // Placeholder de conversa (institution_id NULL) — só existe pra rastrear
  // bot_current_node/bot_variables até a unidade ser resolvida. Mesmo padrão
  // já usado pelo Inbox Áion (institution_id NULL + is_aion_inbox).
  const { data: placeholder } = await supabase
    .from('whatsapp_conversations')
    .select('id, bot_current_node, bot_variables')
    .is('institution_id', null)
    .eq('school_group_id', schoolGroupId)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  let conversationId = placeholder?.id as string | undefined
  let currentNodeId  = placeholder?.bot_current_node || 'start'
  let variables: Record<string, string> = (placeholder?.bot_variables as any) || {}

  if (!conversationId) {
    const { data: created } = await supabase
      .from('whatsapp_conversations')
      .insert({
        institution_id:   null,
        school_group_id:  schoolGroupId,
        remote_jid:       remoteJid,
        status:           'waiting',
        last_message:     text || `[${msgType}]`,
        last_message_at:  new Date().toISOString(),
      })
      .select('id')
      .maybeSingle()
    conversationId = created?.id
  }

  const findNode = (id: string) => bf.nodes.find((n: any) => n.id === id)
  const edgesFrom = (fromId: string): any[] => bf.edges.filter((e: any) => (e.fromNodeId ?? e.from) === fromId)
  const nextId = (e: any): string => e.toNodeId ?? e.to

  let current = findNode(currentNodeId)
  if (!current) {
    current = bf.nodes.find((n: any) => n.type === 'start')
    currentNodeId = current?.id ?? 'start'
  }

  const persist = async () => {
    if (conversationId) {
      await supabase.from('whatsapp_conversations')
        .update({ bot_current_node: currentNodeId, bot_variables: variables })
        .eq('id', conversationId)
    }
  }

  // Já mandamos o menu e essa mensagem é a resposta — resolve a unidade.
  if (current?.type === 'menu' && variables[`__menu_sent_${currentNodeId}`]) {
    const options = current.data?.options || []
    let optIdx = -1
    if (/^opt_\d+$/.test(interactiveChoiceId)) {
      const parsed = parseInt(interactiveChoiceId.replace('opt_', ''), 10)
      if (parsed >= 0 && parsed < options.length) optIdx = parsed
    }
    if (optIdx < 0) {
      const choice = parseInt(text.trim(), 10)
      if (!isNaN(choice)) optIdx = options.findIndex((o: any, i: number) => (o.number ?? i + 1) === choice)
    }

    const mapped = optIdx >= 0 ? menuMap.find(m => m.option_index === optIdx) : undefined
    if (mapped?.institution_id) {
      return mapped.institution_id
    }

    // Opção inválida ou sem unidade mapeada pra essa opção — reenvia o menu.
    const menuHeader = current.data?.menuText || current.data?.text || 'Escolha uma opção:'
    await sendGroupAutoMessage(schoolGroupId, remoteJid, 'Não entendi sua resposta 😊 Por favor escolha uma das opções abaixo:')
    await sendGroupInteractiveMenu(schoolGroupId, remoteJid, menuHeader, menuHeader, options)
    await persist()
    return null
  }

  // Ainda não chegou no nó de menu — anda pelos nós (start/message) até
  // achar um 'menu' e mandar as opções.
  let guard = 10
  while (current && guard-- > 0) {
    if (current.type === 'start') {
      const nexts = edgesFrom(current.id)
      if (!nexts.length) { current = null; break }
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }
    if (current.type === 'message') {
      if (current.data?.text) await sendGroupAutoMessage(schoolGroupId, remoteJid, current.data.text)
      const nexts = edgesFrom(current.id)
      if (!nexts.length) { current = null; break }
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }
    if (current.type === 'menu') {
      const options = current.data?.options || []
      const menuHeader = current.data?.menuText || current.data?.text || 'Escolha uma opção:'
      await sendGroupInteractiveMenu(schoolGroupId, remoteJid, menuHeader, menuHeader, options)
      variables[`__menu_sent_${current.id}`] = '1'
      currentNodeId = current.id
      await persist()
      return null
    }
    console.warn('[group-flow] tipo de nó não suportado no pré-roteamento:', current.type)
    current = null
  }

  return null
}

// ── Send satisfaction survey buttons via Meta Cloud API ─────────────────────
async function sendSatisfactionSurvey(institutionId: string, remoteJid: string, message: string): Promise<void> {
  try {
    const { data: phone } = await supabase
      .from('whatsapp_phone_numbers').select('phone_number_id')
      .eq('institution_id', institutionId).eq('is_active', true).single()
    const waConfig = await getWAConfig()
    if (!phone?.phone_number_id || !waConfig.accessToken) return
    const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to: remoteJid, type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: message.slice(0, 1024) },
          action: {
            buttons: [
              { type: 'reply', reply: { id: 'survey_1', title: '😞 Ruim' } },
              { type: 'reply', reply: { id: 'survey_2', title: '😐 Regular' } },
              { type: 'reply', reply: { id: 'survey_3', title: '😊 Ótimo' } },
            ],
          },
        },
      }),
    })
    if (resp.ok) {
      const d = await resp.json()
      await supabase.from('whatsapp_messages').insert({
        institution_id: institutionId, remote_jid: remoteJid, message_id: d.messages?.[0]?.id,
        instance_name: 'cloud-api', content: message, message_type: 'interactive',
        from_me: true, contact_name: '_bot_', is_bot_message: true, status: 'sent', direction: 'outbound',
        timestamp: new Date().toISOString(),
      })
    }
  } catch (e) { console.error('❌ sendSatisfactionSurvey error:', e) }
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
    const rawPhone       = remoteJid.replace(/@.*/, '')    // strip @s.whatsapp.net
    const normalizedPhone = normalizePhone(rawPhone)        // 13-digit BR format
    const noCode         = rawPhone.startsWith('55') ? rawPhone.slice(2) : rawPhone
    console.log('[LINK] buscando lead por:', normalizedPhone)

    // Try phone variants: raw, with 55, with +55, without country code
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('institution_id', institutionId)
      .or(
        [
          `phone.eq.${rawPhone}`,
          `phone.eq.55${noCode}`,
          `phone.eq.+55${noCode}`,
          `phone.eq.${noCode}`,
        ].join(',')
      )
      .limit(1)
      .maybeSingle()
    console.log('[LINK] lead encontrado:', lead?.id)

    if (lead?.id) {
      await supabase
        .from('whatsapp_conversations')
        .update({ lead_id: lead.id })
        .eq('institution_id', institutionId)
        .eq('remote_jid', remoteJid)
        .is('lead_id', null) // only update if not yet linked
      // Use normalized phone to match what upsertContact stores
      await supabase
        .from('whatsapp_contacts')
        .update({ lead_id: lead.id, type: 'lead' })
        .eq('institution_id', institutionId)
        .eq('phone', normalizedPhone)
    }
  } catch (e) {
    console.error('❌ autoLinkLead error:', e)
  }
}

// Normalizes a Meta Cloud API wa_id (already E.164 without '+').
// Brazilian numbers from Meta always include country code 55; non-Brazilian numbers
// (US +1, Portugal +351, UK +44, etc.) arrive with their own country code and must
// NOT be modified — prepending 55 would corrupt them.
function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  // Brazilian number already has country code: 55 + DDD(2) + [9] + local(8) = 12-13 digits
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    if (digits.length === 12) {
      // Old 8-digit local format: insert the mandatory 9th digit after DDD
      digits = digits.slice(0, 4) + '9' + digits.slice(4)
    }
    return digits
  }

  // Any other number: already international (Meta always sends full E.164).
  // Return unchanged — do NOT prepend 55.
  console.log('[NORMALIZE]', 'raw:', raw, 'result:', digits, 'length:', digits.length)
  return digits
}

// Normaliza telefone digitado livremente por um humano (ex: campo "Telefone"
// do nó de contato no FlowEditor) — pode ou não vir com o "55" na frente,
// pode ou não ter o 9º dígito. Diferente de normalizePhone() acima, que
// assume DDI já presente (payload vindo da própria Meta) e por isso nunca
// prefixa 55 sozinha. Mesma lógica de src/lib/phone.ts:normalizeBrazilianInput,
// duplicada aqui pelo mesmo motivo de normalizePhone já ser local a este
// arquivo — api/ não importa de src/lib neste projeto.
function normalizeBrazilianInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return normalizePhone(digits)
  }
  if (digits.length === 10 || digits.length === 11) {
    return normalizePhone(`55${digits}`)
  }
  return digits
}

// ── Create / update contact record ───────────────────────────────────────────
async function upsertContact(
  institutionId: string,
  remoteJid:     string,
  name:          string,
  profilePicUrl?: string
): Promise<void> {
  console.log('[UPSERT] iniciando para:', remoteJid, institutionId)
  try {
    const rawPhone = remoteJid.replace(/@.*/, '')
    // normalizeBrazilianInput (não normalizePhone) — normalizePhone assume
    // que o DDI já está presente e devolve os dígitos crus sem prefixar 55
    // quando não está, o que geraria uma chave diferente da que
    // normalize_phone_br() (função Postgres usada pelo trigger
    // sync_contact_from_conversation) geraria pro mesmo número real, caso
    // o wa_id chegue sem DDI por algum motivo — mesma classe de bug que já
    // causou 425 grupos de contato duplicados (ver
    // 20260821020000_fix_sync_contact_phone_normalization.sql).
    const phone = normalizeBrazilianInput(rawPhone)
    console.log('[UPSERT] phone normalizado:', phone)

    // Upsert real (ON CONFLICT institution_id+phone — mesma constraint usada
    // pelo trigger SQL) em vez do SELECT-then-INSERT/UPDATE manual que havia
    // aqui antes: esse check-then-write tinha uma janela de corrida — duas
    // mensagens quase simultâneas do mesmo contato NOVO podiam ambas ler
    // "não existe" e tentar INSERT; a segunda batia na constraint única e
    // falhava silenciosamente (log apenas), perdendo nome/foto daquele
    // evento.
    //
    // `type` fica de fora do payload de propósito: em INSERT, a coluna usa o
    // DEFAULT 'unknown' (20260521000004_contact_types.sql); em UPDATE
    // (conflito), como `type` não está no payload ele não entra no SET,
    // então o type já setado manualmente por um agente nunca é sobrescrito —
    // mesmo comportamento seletivo que o UPDATE manual tinha, e o mesmo que
    // o ON CONFLICT DO UPDATE do trigger SQL já faz (também nunca toca type).
    const { error } = await supabase
      .from('whatsapp_contacts')
      .upsert(
        {
          institution_id: institutionId,
          phone,
          remote_jid:     remoteJid,
          name,
          updated_at:     new Date().toISOString(),
          ...(profilePicUrl ? { profile_picture_url: profilePicUrl } : {}),
        },
        { onConflict: 'institution_id,phone' }
      )
    if (error) throw error
    console.log('[UPSERT DETAIL] operação concluída via upsert')
  } catch (e: any) {
    console.error('❌ upsertContact error:', {
      message: e?.message,
      code: e?.code,
      details: e?.details,
      hint: e?.hint,
      phone: normalizeBrazilianInput(remoteJid.replace(/@.*/, '')),
      institutionId
    })
    console.log('[UPSERT DETAIL] ERRO:', JSON.stringify(e))
  }
}

// ── Custom flow state-machine processor ─────────────────────────────────────
async function processCustomFlow(
  institutionId:      string,
  remoteJid:          string,
  text:               string,
  flow:               any,
  isNewConversation:  boolean,
  interactiveChoiceId = ''   // raw Meta reply ID, e.g. 'opt_0', 'opt_1'
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
    console.log('[MENU S2] resposta do menu, interactiveChoiceId:', interactiveChoiceId, '| texto:', text, '| options:', JSON.stringify(current.data?.options))
    const options    = current.data?.options || []
    const menuHeader = interp(current.data?.menuText || current.data?.text || 'Escolha uma opção:')

    // Priority 1: use raw interactive reply ID (opt_0, opt_1…) — direct index, no roundtrip
    let optIdx = -1
    if (/^opt_\d+$/.test(interactiveChoiceId)) {
      const parsed = parseInt(interactiveChoiceId.replace('opt_', ''), 10)
      if (parsed >= 0 && parsed < options.length) optIdx = parsed
    }
    // Fallback: parse 1-based number typed by user
    if (optIdx < 0) {
      const choice = parseInt(text.trim(), 10)
      if (!isNaN(choice)) {
        optIdx = options.findIndex((o: any, i: number) => (o.number ?? i + 1) === choice)
      }
    }

    if (optIdx >= 0) {
      const opt = options[optIdx]
      // Edge fromPortId uses hyphen format (opt-0); Meta reply IDs use underscore (opt_0)
      let nexts = edgesFrom(currentNodeId, `opt-${optIdx}`)
      if (!nexts.length && opt.id) nexts = edgesFrom(currentNodeId, opt.id)
      if (nexts.length) {
        delete variables[`__menu_sent_${currentNodeId}`]
        currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId)
      } else {
        // Valid index but no edge configured — re-prompt with interactive menu
        await sendAutoMessage(institutionId, remoteJid, 'Não entendi sua resposta 😊 Por favor escolha uma das opções abaixo:')
        await sendInteractiveMenu(institutionId, remoteJid, menuHeader, menuHeader, options)
        await supabase.from('whatsapp_conversations')
          .update({ bot_current_node: currentNodeId, bot_variables: variables })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        return
      }
    } else {
      // Unrecognised choice — re-display interactive menu
      await sendAutoMessage(institutionId, remoteJid, 'Não entendi sua resposta 😊 Por favor escolha uma das opções abaixo:')
      await sendInteractiveMenu(institutionId, remoteJid, menuHeader, menuHeader, options)
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
      const mediaType = node.data?.mediaType
      if (!mediaType || mediaType === 'text') {
        const msg = interp(node.data?.text || '')
        if (msg) await sendAutoMessage(institutionId, remoteJid, msg)
      } else if (['image', 'video', 'document', 'audio'].includes(mediaType)) {
        const mediaUrl = node.data?.mediaUrl
        if (mediaUrl) {
          try {
            const { data: phone } = await supabase
              .from('whatsapp_phone_numbers').select('phone_number_id')
              .eq('institution_id', institutionId).eq('is_active', true).single()
            const waConfig = await getWAConfig()
            if (phone?.phone_number_id && waConfig.accessToken) {
              const mediaBody: Record<string, any> = { link: mediaUrl }
              if (node.data?.caption) mediaBody.caption = interp(node.data.caption)
              if (mediaType === 'document' && node.data?.filename) mediaBody.filename = node.data.filename
              const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: remoteJid, type: mediaType, [mediaType]: mediaBody }),
              })
              if (resp.ok) {
                const d = await resp.json()
                await supabase.from('whatsapp_messages').insert({
                  institution_id: institutionId, remote_jid: remoteJid, message_id: d.messages?.[0]?.id,
                  instance_name: 'cloud-api', content: node.data?.caption || `[${mediaType}]`,
                  message_type: mediaType, media_url: mediaUrl, from_me: true, contact_name: '_bot_',
                  is_bot_message: true, status: 'sent', direction: 'outbound', timestamp: new Date().toISOString(),
                })
              } else { console.error('[flow] message media send failed:', await resp.text()) }
            }
          } catch (e) { console.error('[flow] message media node error:', e) }
        }
      } else if (mediaType === 'contact') {
        try {
          const { data: phone } = await supabase
            .from('whatsapp_phone_numbers').select('phone_number_id')
            .eq('institution_id', institutionId).eq('is_active', true).single()
          const waConfig = await getWAConfig()
          if (phone?.phone_number_id && waConfig.accessToken) {
            // wa_id precisa ser o número completo em E.164 sem formatação
            // (só dígitos, com DDI) — é o que a Cloud API usa pra reconhecer
            // o contato como "já no WhatsApp" e mostrar botão de conversa em
            // vez de "Convidar para o WhatsApp". Sem wa_id (ou com ele igual
            // a um "phone" formatado/incompleto), o destinatário sempre vê o
            // convite, mesmo com o número certo.
            const contactPhoneDigits = normalizeBrazilianInput(node.data?.contactPhone || '')
            const payload: Record<string, any> = {
              messaging_product: 'whatsapp', to: remoteJid, type: 'contacts',
              contacts: [{
                name: { formatted_name: node.data?.contactName || '', first_name: node.data?.contactName || '' },
                phones: contactPhoneDigits
                  ? [{ phone: `+${contactPhoneDigits}`, wa_id: contactPhoneDigits, type: 'CELL' }]
                  : [],
                ...(node.data?.contactCompany ? { org: { company: node.data.contactCompany } } : {}),
              }],
            }
            const resp = await fetch(`${GRAPH_URL}/${phone.phone_number_id}/messages`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${waConfig.accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            if (resp.ok) {
              const d = await resp.json()
              await supabase.from('whatsapp_messages').insert({
                institution_id: institutionId, remote_jid: remoteJid, message_id: d.messages?.[0]?.id,
                instance_name: 'cloud-api', content: `[Contato: ${node.data?.contactName}]`,
                message_type: 'contacts', from_me: true, contact_name: '_bot_',
                is_bot_message: true, status: 'sent', direction: 'outbound', timestamp: new Date().toISOString(),
              })
            }
          }
        } catch (e) { console.error('[flow] message contact send error:', e) }
      }
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
      if (options.length > 0) {
        await sendInteractiveMenu(institutionId, remoteJid, menuHeader, menuHeader, options)
      } else if (fullText.trim()) {
        await sendAutoMessage(institutionId, remoteJid, fullText)
      }
      variables[`__menu_sent_${node.id}`] = 'true'
      break  // Section 4 saves currentNodeId and variables
    }

    if (node.type === 'transfer') {
      const transferMsg  = node.data?.message || node.data?.transferMessage
      const transferType = node.data?.transferType || 'attendant'
      const groupId      = node.data?.group_id

      // Schedule check: are we within business hours?
      const tz       = (flow as any).timezone || 'America/Sao_Paulo'
      const nowTz    = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
      const dayKeys  = ['SUN','MON','TUE','WED','THU','FRI','SAT']
      const curDay   = dayKeys[nowTz.getDay()]
      const curMins  = nowTz.getHours() * 60 + nowTz.getMinutes()
      const [sh, sm] = ((flow as any).working_start || '08:00').split(':').map(Number)
      const [eh, em] = ((flow as any).working_end   || '18:00').split(':').map(Number)
      const withinHours = ((flow as any).working_days ?? []).includes(curDay)
        && curMins >= sh * 60 + sm && curMins <= eh * 60 + em

      const outsideMsg = (flow as any).outside_hours_message || (flow as any).off_hours_message || ''
      const lunchMsgText = (flow as any).lunch_message || ''

      const isOnLunch = (att: { lunch_start?: string | null; lunch_end?: string | null } | null) => {
        if (!att?.lunch_start || !att?.lunch_end) return false
        const [lsh, lsm] = att.lunch_start.split(':').map(Number)
        const [leh, lem] = att.lunch_end.split(':').map(Number)
        return curMins >= lsh * 60 + lsm && curMins <= leh * 60 + lem
      }

      if (!withinHours) {
        console.log('[flow] transfer bloqueado — fora do horário:', curDay, `${nowTz.getHours()}:${String(nowTz.getMinutes()).padStart(2,'0')}`)
        // Resolve um responsável de fallback: grupo (round-robin, mesmo critério
        // de timeout-check.ts) tem prioridade, depois o atendente fixo do flow.
        // Sem nenhum dos dois configurados, NÃO inventa um assigned_user_id — cai
        // em 'waiting' (sem dono), que é a única combinação que a fila "Aguardando
        // atendimento" e a RLS de atendente restrito enxergam. Atribuir a um
        // assigneeId inexistente e marcar status='open' deixava a conversa presa:
        // invisível pra quem não tem "ver todas as conversas" e o bot nunca mais
        // reagia a mensagens seguintes do cliente.
        let assigneeId:   string | null = null
        let assigneeName: string | null = null
        if ((flow as any).timeout_group_id) {
          const { data: group } = await supabase
            .from('whatsapp_groups').select('*').eq('id', (flow as any).timeout_group_id).maybeSingle()
          if (group?.member_ids?.length) {
            const availableSet = await getAvailableMemberIds(group.member_ids)
            const availableIds = group.member_ids.filter((id: string) => availableSet.has(id))
            if (availableIds.length) {
              const nextIndex = ((group.last_assigned_index ?? -1) + 1) % availableIds.length
              assigneeId = availableIds[nextIndex]
              const { data: u } = await supabase.from('users').select('full_name').eq('id', assigneeId).maybeSingle()
              assigneeName = (u as any)?.full_name || null
              await supabase.from('whatsapp_groups').update({ last_assigned_index: nextIndex }).eq('id', (flow as any).timeout_group_id)
            }
            // Grupo inteiro ausente: assigneeId fica null, cai no fallback pra
            // timeout_assignee_id (abaixo) ou, sem nenhum dos dois, 'waiting'.
          }
        }
        if (!assigneeId && (flow as any).timeout_assignee_id) {
          assigneeId = (flow as any).timeout_assignee_id
          const { data: assigneeUser } = await supabase
            .from('users').select('full_name').eq('id', assigneeId as string).single()
          assigneeName = (assigneeUser as any)?.full_name || (flow as any).timeout_assignee_name || null
        }

        await supabase.from('whatsapp_conversations')
          .update({
            // 'open' só quando realmente há um dono; sem assigneeId resolvido,
            // 'waiting' (assigned_user_id NULL) é a rede de segurança mínima.
            status:             assigneeId ? 'open' : 'waiting',
            bot_active:         false,
            assigned_user_id:   assigneeId,
            assigned_user_name: assigneeName,
            last_message_at:    new Date().toISOString(),
          })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        if (outsideMsg) await sendAutoMessage(institutionId, remoteJid, outsideMsg)
        await supabase.from('whatsapp_conversation_events').insert({
          institution_id: institutionId,
          remote_jid:     remoteJid,
          event_type:     'assignment',
          description:    `Atribuído automaticamente fora do horário para ${assigneeName || 'fila geral (sem responsável configurado)'}`,
        })
        currentNodeId = 'end'; break
      }

      if (transferType === 'group' && groupId) {
        // Round-robin distribution across group members, skipping those on
        // lunch or marcados "Ausente" (users.is_available=false, toggle no
        // TopBar — não afeta conversas já atribuídas, só a escolha do próximo).
        const { data: group } = await supabase
          .from('whatsapp_groups').select('*').eq('id', groupId).maybeSingle()

        if (group && group.member_ids?.length > 0) {
          const { data: members } = await supabase
            .from('users').select('id,full_name,lunch_start,lunch_end,is_available')
            .in('id', group.member_ids)

          // Find next available member (not on lunch, not ausente) starting after last assigned index
          const totalMembers = group.member_ids.length
          let assignee: any = null
          let newIndex = group.last_assigned_index
          for (let i = 1; i <= totalMembers; i++) {
            const idx      = ((group.last_assigned_index ?? -1) + i) % totalMembers
            const memberId = group.member_ids[idx]
            const member   = (members || []).find((m: any) => m.id === memberId)
            if (member && member.is_available !== false && !isOnLunch(member as any)) {
              assignee = member; newIndex = idx; break
            }
          }

          if (!assignee) {
            // Ninguém disponível (todos em almoço e/ou ausentes): nunca deixa
            // status='open' sem dono — mesmo limbo já corrigido pro gate de
            // horário (invisível pra atendente sem "ver todas", bot para de
            // reagir). 'waiting' garante que apareça na fila geral.
            console.log('[flow] nenhum membro disponível no grupo (almoço ou ausente):', group.name)
            if (lunchMsgText) await sendAutoMessage(institutionId, remoteJid, lunchMsgText)
            await supabase.from('whatsapp_conversations')
              .update({ bot_active: false, status: 'waiting' })
              .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
          } else {
            if (transferMsg) await sendAutoMessage(institutionId, remoteJid, interp(transferMsg))
            await supabase.from('whatsapp_conversations').update({
              assigned_user_id: assignee.id, assigned_user_name: assignee.full_name,
              bot_active: false, status: 'open',
            }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
            await supabase.from('whatsapp_groups')
              .update({ last_assigned_index: newIndex }).eq('id', groupId)
            console.log('[flow] grupo round-robin:', group.name, '→', assignee.full_name, `(índice ${newIndex})`)
          }
        } else {
          console.warn('[flow] grupo sem membros:', groupId)
          await supabase.from('whatsapp_conversations')
            .update({ bot_active: false })
            .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        }
      } else {
        // Specific attendant
        const assigneeId = node.data?.assignee_id || node.data?.assigneeId
        if (assigneeId) {
          const { data: u } = await supabase
            .from('users').select('full_name,lunch_start,lunch_end').eq('id', assigneeId).maybeSingle()
          const assigneeName = (u as any)?.full_name || node.data.assignee_name || node.data.assigneeName || null

          if (isOnLunch(u as any)) {
            console.log('[flow] atendente em almoço, encaminhando mesmo assim:', assigneeName)
            if (lunchMsgText) await sendAutoMessage(institutionId, remoteJid, lunchMsgText)
          } else {
            if (transferMsg) await sendAutoMessage(institutionId, remoteJid, interp(transferMsg))
          }
          await supabase.from('whatsapp_conversations').update({
            assigned_user_id: assigneeId, assigned_user_name: assigneeName,
            bot_active: false, status: 'open',
          }).eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        } else {
          console.warn('[flow] transfer node has no assigneeId — deactivating bot without assigning')
          await supabase.from('whatsapp_conversations')
            .update({ bot_active: false })
            .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        }
      }
      currentNodeId = 'end'; break
    }

    if (node.type === 'condition') {
      // Support legacy single-condition and new multi-condition array format
      const conditions: Array<Record<string, any>> = node.data?.conditions?.length
        ? node.data.conditions
        : node.data?.conditionType
          ? [{ conditionType: node.data.conditionType, operator: 'AND', ...node.data }]
          : []

      const results: boolean[] = []
      for (const cond of conditions) {
        let r = false
        if (cond.conditionType === 'business_hours') {
          const tz  = flow.timezone || 'America/Fortaleza'
          const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
          const days = ['SUN','MON','TUE','WED','THU','FRI','SAT']
          const isDay = ((flow.working_days as string[]) ?? []).includes(days[now.getDay()])
          const [sh, sm] = (flow.working_start || '08:00').split(':').map(Number)
          const [eh, em] = (flow.working_end   || '18:00').split(':').map(Number)
          const cur = now.getHours() * 60 + now.getMinutes()
          r = isDay && cur >= sh * 60 + sm && cur <= eh * 60 + em
        } else if (cond.conditionType === 'lunch_break') {
          const tz  = flow.timezone || 'America/Fortaleza'
          const now = new Date(new Date().toLocaleString('en-US', { timeZone: tz }))
          const [lsh, lsm] = (flow.lunch_start || '12:00').split(':').map(Number)
          const [leh, lem] = (flow.lunch_end   || '13:00').split(':').map(Number)
          const cur = now.getHours() * 60 + now.getMinutes()
          r = cur >= lsh * 60 + lsm && cur <= leh * 60 + lem
        } else if (cond.conditionType === 'keyword') {
          r = text.toLowerCase().includes((cond.keyword || '').toLowerCase())
        } else if (cond.conditionType === 'first_message') {
          r = isNewConversation
        } else if (cond.conditionType === 'has_tag') {
          // [FIX P4] Case-insensitive + trimmed comparison (was .includes which is exact-match)
          const tag   = (cond.tag || '').trim().toLowerCase()
          const scope = cond.tagScope || 'conversation'
          const tagMatch = (arr: string[]) =>
            arr.some(t => t.trim().toLowerCase() === tag)
          console.log('[FLOW CONDITION] has_tag', { tag, scope })
          if (tag) {
            if (scope === 'conversation' || scope === 'both') {
              const { data: convTagData } = await supabase
                .from('whatsapp_conversations')
                .select('tags')
                .eq('institution_id', institutionId)
                .eq('remote_jid', remoteJid)
                .maybeSingle()
              r = tagMatch((convTagData?.tags as string[]) || [])
              console.log('[FLOW CONDITION] conv tags:', convTagData?.tags, '→', r)
            }
            if (!r && (scope === 'lead' || scope === 'both')) {
              const { data: convLead } = await supabase
                .from('whatsapp_conversations')
                .select('lead_id')
                .eq('institution_id', institutionId)
                .eq('remote_jid', remoteJid)
                .maybeSingle()
              if (convLead?.lead_id) {
                const { data: leadTagData } = await supabase
                  .from('leads')
                  .select('tags')
                  .eq('id', convLead.lead_id)
                  .maybeSingle()
                r = tagMatch(((leadTagData as any)?.tags as string[]) || [])
                console.log('[FLOW CONDITION] lead tags:', (leadTagData as any)?.tags, '→', r)
              }
            }
          }
        }
        results.push(r)
      }

      // Combine left-to-right: each condition's operator applies between it and the next
      let result = results[0] ?? false
      for (let i = 0; i < conditions.length - 1; i++) {
        const op = conditions[i].operator || 'AND'
        result = op === 'OR' ? result || results[i + 1] : result && results[i + 1]
      }

      // 'yes'/'no' (new) and 'true'/'false' (old) both resolved by normalizePort
      const nexts = edgesFrom(node.id, result ? 'yes' : 'no')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'action' || node.type === 'lead') {
      // Support legacy single-action format and new multi-action array format
      const actions: Array<Record<string, any>> = node.data?.actions?.length
        ? node.data.actions
        : node.data?.actionType
          ? [{ actionType: node.data.actionType, ...node.data }]
          : []

      for (const action of actions) {
        if (action.actionType === 'create_lead') {
          const phone  = remoteJid.replace(/@.*/, '')
          const noCode = phone.startsWith('55') ? phone.slice(2) : phone
          const { data: existing } = await supabase.from('leads').select('id')
            .eq('institution_id', institutionId)
            .or(`phone.eq.${phone},phone.eq.55${noCode},phone.eq.+55${noCode}`)
            .maybeSingle()
          if (!existing) {
            await supabase.from('leads').insert({
              institution_id: institutionId,
              phone: phone,
              student_name: variables.nome_aluno || variables.nome || '',
              status: 'novo',
            })
          }
        } else if (action.actionType === 'add_tag') {
          const tag = action.tag?.trim()
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
        } else if (action.actionType === 'close_conversation') {
          await supabase.from('whatsapp_conversations')
            .update({ status: 'closed', bot_active: false, closed_at: new Date().toISOString() })
            .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        } else if (action.actionType === 'upsert_lead') {
          const phone  = remoteJid.replace(/@.*/, '')
          const noCode = phone.startsWith('55') ? phone.slice(2) : phone
          const { data: existingLead } = await supabase.from('leads').select('id')
            .eq('institution_id', institutionId)
            .or(`phone.eq.${phone},phone.eq.55${noCode},phone.eq.+55${noCode}`)
            .maybeSingle()
          const leadFields: Record<string, any> = {}
          if (action.student_name) leadFields.student_name = interp(action.student_name)
          if (action.email)        leadFields.email        = interp(action.email)
          if (action.status)       leadFields.status       = action.status
          if (existingLead) {
            if (Object.keys(leadFields).length) {
              await supabase.from('leads').update(leadFields).eq('id', existingLead.id)
            }
          } else {
            await supabase.from('leads').insert({
              institution_id: institutionId,
              phone:          phone,
              student_name:   leadFields.student_name || variables.nome_aluno || variables.nome || '',
              status:         action.status || 'novo',
              ...(leadFields.email ? { email: leadFields.email } : {}),
            })
          }
          // Link whatsapp_contacts to the created/found lead
          const { data: upsertedLead } = await supabase.from('leads').select('id')
            .eq('institution_id', institutionId)
            .or(`phone.eq.${phone},phone.eq.55${noCode},phone.eq.+55${noCode}`)
            .maybeSingle()
          if (upsertedLead?.id) {
            await supabase.from('whatsapp_contacts')
              .update({ lead_id: upsertedLead.id, type: 'lead' })
              .eq('institution_id', institutionId)
              .eq('phone', phone)
          }
        } else if (action.actionType === 'add_conversation_tag') {
          const tag = (action.tag || '').trim()
          if (tag) {
            const { data: convTagData } = await supabase.from('whatsapp_conversations')
              .select('tags').eq('institution_id', institutionId).eq('remote_jid', remoteJid).maybeSingle()
            const tags: string[] = (convTagData?.tags as string[]) || []
            if (!tags.includes(tag)) {
              await supabase.from('whatsapp_conversations')
                .update({ tags: [...tags, tag] })
                .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
            }
          }
        } else if (action.actionType === 'remove_conversation_tag') {
          const tag = (action.tag || '').trim()
          if (tag) {
            const { data: convTagData } = await supabase.from('whatsapp_conversations')
              .select('tags').eq('institution_id', institutionId).eq('remote_jid', remoteJid).maybeSingle()
            const tags: string[] = (convTagData?.tags as string[]) || []
            if (tags.includes(tag)) {
              await supabase.from('whatsapp_conversations')
                .update({ tags: tags.filter((t: string) => t !== tag) })
                .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
            }
          }
        }
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
                from_me: true, contact_name: '_bot_', is_bot_message: true, status: 'sent',
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

    if (node.type === 'end') {
      if (node.data?.message) {
        await sendAutoMessage(institutionId, remoteJid, interp(node.data.message))
      }
      await supabase.from('whatsapp_conversations')
        .update({ status: 'closed', bot_active: false, assigned_user_id: null, assigned_user_name: null, closed_at: new Date().toISOString() })
        .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
      const { data: flowCfg } = await supabase
        .from('whatsapp_flows')
        .select('satisfaction_survey_enabled, satisfaction_message')
        .eq('institution_id', institutionId)
        .maybeSingle()
      if (flowCfg?.satisfaction_survey_enabled) {
        const surveyMsg = (flowCfg.satisfaction_message as string) || 'Como você avalia nosso atendimento hoje? Seu feedback é muito importante para nós! 😊'
        await sendSatisfactionSurvey(institutionId, remoteJid, surveyMsg)
      }
      currentNodeId = 'end'; break
    }
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
  institutionId:      string,
  remoteJid:          string,
  text:               string,
  isNewConversation:  boolean,
  interactiveChoiceId = ''
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

    // Humano já atendendo (bot desativado quando o atendente respondeu) —
    // nunca deixa o robô processar essa conversa, nem no fluxo customizado
    // nem no fluxo padrão (menu_enabled). Sem isso, a seção "Menu choice"
    // do fluxo padrão respondia e podia até reatribuir a conversa mesmo com
    // um atendente humano já conversando (race condition cliente↔atendente↔bot).
    const { data: guardConvState } = await supabase
      .from('whatsapp_conversations')
      .select('bot_active, assigned_user_id, bot_variables, status')
      .eq('institution_id', institutionId)
      .eq('remote_jid', remoteJid)
      .maybeSingle()

    if (guardConvState?.bot_active === false && guardConvState?.assigned_user_id) {
      console.log('[flow] humano atendendo, robô pausado (guard global)')
      return
    }

    // c) Custom bot_flow — highest priority, bypasses working-hours gate entirely.
    //    The flow itself can handle off-hours via condition nodes.
    if (flow.bot_enabled && flow.bot_flow?.nodes?.length) {
      // Reaproveita a leitura do guard acima — mesma linha, sem round-trip extra.
      const convState = guardConvState

      console.log('[FLOW] convState:', { bot_active: convState?.bot_active, assigned_user_id: convState?.assigned_user_id })

      // ── button/list reply mid-flow: honour __menu_sent_* regardless of isNewConversation ──
      const botVars = (convState?.bot_variables as Record<string, string>) || {}
      const hasMenuPending = !!interactiveChoiceId && Object.keys(botVars).some(k => k.startsWith('__menu_sent_'))
      if (hasMenuPending) {
        await processCustomFlow(institutionId, remoteJid, text, flow, false, interactiveChoiceId)
        return
      }

      // Bot already running — continue flow from current node
      if (convState?.bot_active === true) {
        await processCustomFlow(institutionId, remoteJid, text, flow, false, interactiveChoiceId)
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
          await processCustomFlow(institutionId, remoteJid, text, flow, true, interactiveChoiceId)
        } else {
          console.log('[flow] conversa reaberta com histórico, robô não ativado')
        }
        return
      }

      // Not new + bot_active=false + no assignee: bot terminou e ninguém foi
      // atribuído (herança do limbo status='open'+assigned_user_id NULL do gate
      // de horário antigo, ou qualquer outra origem — dado antigo já existente).
      // Nunca ignora silenciosamente uma mensagem nova do cliente: se a conversa
      // ainda estiver marcada 'open' (não deveria mais acontecer via o gate de
      // horário, que agora só usa 'open' com dono real), devolve pra 'waiting'
      // pra aparecer na fila "Aguardando atendimento" de quem tem permissão de
      // ver todas. Já 'waiting'/'closed' não mexe — não é essa mensagem que
      // decide reabrir uma conversa encerrada.
      if (convState?.status === 'open') {
        await supabase.from('whatsapp_conversations')
          .update({ status: 'waiting', last_message_at: new Date().toISOString() })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        console.log('[flow] robô inativo e sem atendente — conversa em limbo (open+sem dono), devolvida pra waiting')
      } else {
        console.log('[flow] robô inativo e sem atendente, ignorando')
      }
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

    console.log('[HORARIO]', {
      timezone:       flow.timezone,
      currentDay,
      isWorkingDay,
      working_days:   flow.working_days,
      currentTime:    `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`,
      working_start:  flow.working_start,
      working_end:    flow.working_end,
      isWorkingHours,
      isOpen,
    })

    // Off-hours: only notify on new conversations
    if (!isOpen) {
      if (isNewConversation && flow.off_hours_message) {
        // Mesma resolução de fallback do nó 'transfer' (grupo round-robin →
        // atendente fixo → 'waiting' sem dono) — ver comentário lá pra detalhe
        // do porquê nunca deixar status='open' com assigned_user_id NULL.
        let assigneeId:   string | null = null
        let assigneeName: string | null = null
        if ((flow as any).timeout_group_id) {
          const { data: group } = await supabase
            .from('whatsapp_groups').select('*').eq('id', (flow as any).timeout_group_id).maybeSingle()
          if (group?.member_ids?.length) {
            const availableSet = await getAvailableMemberIds(group.member_ids)
            const availableIds = group.member_ids.filter((id: string) => availableSet.has(id))
            if (availableIds.length) {
              const nextIndex = ((group.last_assigned_index ?? -1) + 1) % availableIds.length
              assigneeId = availableIds[nextIndex]
              const { data: u } = await supabase.from('users').select('full_name').eq('id', assigneeId).maybeSingle()
              assigneeName = (u as any)?.full_name || null
              await supabase.from('whatsapp_groups').update({ last_assigned_index: nextIndex }).eq('id', (flow as any).timeout_group_id)
            }
            // Grupo inteiro ausente: assigneeId fica null, cai no fallback pra
            // timeout_assignee_id (abaixo) ou, sem nenhum dos dois, 'waiting'.
          }
        }
        if (!assigneeId && (flow as any).timeout_assignee_id) {
          assigneeId = (flow as any).timeout_assignee_id
          const { data: assigneeUser } = await supabase
            .from('users').select('full_name').eq('id', assigneeId as string).single()
          assigneeName = (assigneeUser as any)?.full_name || (flow as any).timeout_assignee_name || null
        }

        await supabase.from('whatsapp_conversations')
          .update({
            status:             assigneeId ? 'open' : 'waiting',
            bot_active:         false,
            assigned_user_id:   assigneeId,
            assigned_user_name: assigneeName,
            last_message_at:    new Date().toISOString(),
          })
          .eq('institution_id', institutionId).eq('remote_jid', remoteJid)
        await sendAutoMessage(institutionId, remoteJid, flow.off_hours_message)
        await supabase.from('whatsapp_conversation_events').insert({
          institution_id: institutionId,
          remote_jid:     remoteJid,
          event_type:     'assignment',
          description:    `Atribuído automaticamente fora do horário para ${assigneeName || 'fila geral (sem responsável configurado)'}`,
        })
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

    // f) "Bot message count → transfer to default assignee after threshold"
    // removido: dependia de flow.default_assignee_id, coluna que não existe em
    // whatsapp_flows — a condição `&& flow.default_assignee_id` era sempre
    // false (undefined), então este bloco nunca executava.

  } catch (e) {
    console.error('❌ processFlow error:', e)
  }
}

// ── Send text message via Áion platform_whatsapp ────────────────────────────
async function sendAionMessage(to: string, text: string): Promise<void> {
  try {
    const { data: platformWA } = await supabase
      .from('platform_whatsapp')
      .select('phone_number_id, access_token')
      .eq('connected', true)
      .maybeSingle()

    if (!platformWA?.phone_number_id || !platformWA.access_token) return

    const resp = await fetch(`${GRAPH_URL}/${platformWA.phone_number_id}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${platformWA.access_token}`,
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
      const d = await resp.json()
      await supabase.from('whatsapp_messages').insert({
        institution_id: null,
        remote_jid:     to,
        message_id:     d.messages?.[0]?.id,
        instance_name:  'cloud-api',
        content:        text,
        message_type:   'text',
        from_me:        true,
        contact_name:   '_bot_',
        is_bot_message: true,
        status:         'sent',
        direction:      'outbound',
        is_aion_inbox:  true,
        timestamp:      new Date().toISOString(),
      })
    }
  } catch (e) {
    console.error('❌ sendAionMessage error:', e)
  }
}

// ── Send interactive menu via Áion platform_whatsapp ─────────────────────────
async function sendAionInteractiveMenu(
  to:         string,
  headerText: string,
  bodyText:   string,
  options:    Array<{ text: string }>
): Promise<void> {
  const fallbackText = [headerText, options.map((o, i) => `${i + 1}. ${o.text}`).join('\n')]
    .filter(Boolean).join('\n\n')

  try {
    const { data: platformWA } = await supabase
      .from('platform_whatsapp')
      .select('phone_number_id, access_token')
      .eq('connected', true)
      .maybeSingle()

    if (!platformWA?.phone_number_id || !platformWA.access_token) {
      if (fallbackText.trim()) await sendAionMessage(to, fallbackText)
      return
    }

    const count = Math.min(options.length, 10)
    let interactive: any

    if (count <= 3) {
      interactive = {
        type: 'button',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          buttons: options.slice(0, 3).map((o, i) => ({
            type:  'reply',
            reply: { id: `opt_${i}`, title: o.text.slice(0, 20) },
          })),
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    } else {
      interactive = {
        type: 'list',
        body: { text: (bodyText || headerText).slice(0, 1024) },
        action: {
          button: 'Ver opções',
          sections: [{
            title: 'Opções',
            rows: options.slice(0, 10).map((o, i) => ({
              id:    `opt_${i}`,
              title: o.text.slice(0, 24),
            })),
          }],
        },
      }
      if (headerText && bodyText && headerText !== bodyText) {
        interactive.header = { type: 'text', text: headerText.slice(0, 60) }
      }
    }

    const resp = await fetch(`${GRAPH_URL}/${platformWA.phone_number_id}/messages`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${platformWA.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'interactive',
        interactive,
      }),
    })

    if (resp.ok) {
      const d = await resp.json()
      await supabase.from('whatsapp_messages').insert({
        institution_id: null,
        remote_jid:     to,
        message_id:     d.messages?.[0]?.id,
        instance_name:  'cloud-api',
        content:        fallbackText,
        message_type:   'interactive',
        from_me:        true,
        contact_name:   '_bot_',
        is_bot_message: true,
        status:         'sent',
        direction:      'outbound',
        is_aion_inbox:  true,
        timestamp:      new Date().toISOString(),
      })
    } else {
      if (fallbackText.trim()) await sendAionMessage(to, fallbackText)
    }
  } catch (e) {
    console.error('❌ sendAionInteractiveMenu error:', e)
    try { if (fallbackText.trim()) await sendAionMessage(to, fallbackText) } catch {}
  }
}

// ── Send a CTA URL button via Áion platform_whatsapp ──────────────────────────
// Usado pela resposta automática de aion_keywords quando cta_button_text e
// cta_button_url estão preenchidos (ver CampaignsTab). Cai pra texto puro
// (sendAionMessage) se platformWA não estiver conectado ou se o envio falhar.
async function sendAionCtaButton(
  to:         string,
  bodyText:   string,
  buttonText: string,
  buttonUrl:  string
): Promise<void> {
  try {
    const { data: platformWA } = await supabase
      .from('platform_whatsapp')
      .select('phone_number_id, access_token')
      .eq('connected', true)
      .maybeSingle()

    if (!platformWA?.phone_number_id || !platformWA.access_token) {
      await sendAionMessage(to, bodyText)
      return
    }

    const resp = await fetch(`${GRAPH_URL}/${platformWA.phone_number_id}/messages`, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${platformWA.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: bodyText.slice(0, 1024) },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: buttonText.slice(0, 20),
              url:          buttonUrl,
            },
          },
        },
      }),
    })

    if (resp.ok) {
      const d = await resp.json()
      await supabase.from('whatsapp_messages').insert({
        institution_id: null,
        remote_jid:     to,
        message_id:     d.messages?.[0]?.id,
        instance_name:  'cloud-api',
        content:        bodyText,
        message_type:   'interactive',
        from_me:        true,
        contact_name:   '_bot_',
        is_bot_message: true,
        status:         'sent',
        direction:      'outbound',
        is_aion_inbox:  true,
        timestamp:      new Date().toISOString(),
      })
    } else {
      await sendAionMessage(to, bodyText)
    }
  } catch (e) {
    console.error('❌ sendAionCtaButton error:', e)
    try { await sendAionMessage(to, bodyText) } catch {}
  }
}

// ── Simplified flow processor for the Áion inbox ─────────────────────────────
// Handles node types: start, message, menu, transfer, end
async function processAionFlow(
  flow:               any,
  remoteJid:          string,
  text:               string,
  interactiveChoiceId: string,
  isNewConversation:  boolean
): Promise<void> {
  const bf = flow.bot_flow as { nodes: any[]; edges: any[] } | null
  if (!bf?.nodes?.length) return

  // Fetch current conversation state
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('bot_current_node, bot_variables')
    .eq('is_aion_inbox', true)
    .eq('remote_jid', remoteJid)
    .maybeSingle()

  let currentNodeId: string = isNewConversation ? 'start' : (conv?.bot_current_node || 'start')
  let variables: Record<string, string> = isNewConversation ? {} : ((conv?.bot_variables as Record<string, string>) || {})

  const findNode = (id: string) => bf.nodes.find((n: any) => n.id === id)

  const PORT_ALIASES: Record<string, string> = { output: 'out', input: 'in', true: 'yes', false: 'no' }
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

  let current = findNode(currentNodeId)
  if (!current) {
    current = bf.nodes.find((n: any) => n.type === 'start')
    currentNodeId = current?.id ?? 'start'
  }

  // Handle user reply to a pending menu
  if (current?.type === 'menu' && variables[`__menu_sent_${currentNodeId}`]) {
    const options    = current.data?.options || []
    const menuHeader = current.data?.menuText || current.data?.text || 'Escolha uma opção:'

    let optIdx = -1
    if (/^opt_\d+$/.test(interactiveChoiceId)) {
      const parsed = parseInt(interactiveChoiceId.replace('opt_', ''), 10)
      if (parsed >= 0 && parsed < options.length) optIdx = parsed
    }
    if (optIdx < 0) {
      const choice = parseInt(text.trim(), 10)
      if (!isNaN(choice)) {
        optIdx = options.findIndex((_: any, i: number) => i + 1 === choice)
      }
    }

    if (optIdx >= 0) {
      let nexts = edgesFrom(currentNodeId, `opt-${optIdx}`)
      if (!nexts.length && options[optIdx]?.id) nexts = edgesFrom(currentNodeId, options[optIdx].id)
      if (nexts.length) {
        delete variables[`__menu_sent_${currentNodeId}`]
        currentNodeId = nextId(nexts[0])
        current       = findNode(currentNodeId)
      } else {
        await sendAionMessage(remoteJid, 'Não entendi sua resposta 😊 Por favor escolha uma das opções abaixo:')
        await sendAionInteractiveMenu(remoteJid, menuHeader, menuHeader, options)
        await supabase.from('whatsapp_conversations')
          .update({ bot_current_node: currentNodeId, bot_variables: variables })
          .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
        return
      }
    } else {
      await sendAionMessage(remoteJid, 'Não entendi sua resposta 😊 Por favor escolha uma das opções abaixo:')
      await sendAionInteractiveMenu(remoteJid, menuHeader, menuHeader, options)
      await supabase.from('whatsapp_conversations')
        .update({ bot_current_node: currentNodeId, bot_variables: variables })
        .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
      return
    }
  }

  // Execute nodes until user input required or end reached
  let guard = 20
  while (current && guard-- > 0) {
    const node = current

    if (node.type === 'start') {
      const nexts = edgesFrom(node.id)
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'message') {
      const msg = node.data?.text || ''
      if (msg) await sendAionMessage(remoteJid, msg)
      const nexts = edgesFrom(node.id, 'out')
      if (!nexts.length) break
      currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
    }

    if (node.type === 'menu') {
      const menuHeader = node.data?.menuText || node.data?.text || ''
      const options    = node.data?.options || []
      if (options.length > 0) {
        await sendAionInteractiveMenu(remoteJid, menuHeader, menuHeader, options)
      } else if (menuHeader.trim()) {
        await sendAionMessage(remoteJid, menuHeader)
      }
      variables[`__menu_sent_${node.id}`] = 'true'
      break
    }

    if (node.type === 'transfer') {
      const transferMsg = node.data?.message || node.data?.transferMessage
      if (transferMsg) await sendAionMessage(remoteJid, transferMsg)
      await supabase.from('whatsapp_conversations')
        .update({ bot_active: false, status: 'open' })
        .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
      currentNodeId = 'end'
      break
    }

    if (node.type === 'end') {
      if (node.data?.message) await sendAionMessage(remoteJid, node.data.message)
      await supabase.from('whatsapp_conversations')
        .update({ bot_active: false, status: 'open' })
        .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
      currentNodeId = 'end'
      break
    }

    // Skip unknown node types — advance via 'out' port
    const nexts = edgesFrom(node.id, 'out')
    if (!nexts.length) break
    currentNodeId = nextId(nexts[0]); current = findNode(currentNodeId); continue
  }

  // Persist flow state
  await supabase.from('whatsapp_conversations')
    .update({ bot_current_node: currentNodeId, bot_variables: variables })
    .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
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
  platformWAId = '',
}: {
  msg: any
  value: any
  supabase: ReturnType<typeof createClient>
  platformWAId?: string
}): Promise<void> {
  try {
    // Normalizado (fonte de verdade — ver comentário de normalizePhone acima)
    // em vez de usar msg.from cru: números BR chegam da Meta às vezes sem o
    // 9º dígito, então o remote_jid cru divergia do que raio-x-followup e
    // outras origens "outbound-first" já gravam, causando conversas
    // duplicadas para o mesmo contato.
    const remoteJid   = normalizePhone((msg.from as string).replace(/@.*/, ''))
    const rawPhone    = remoteJid
    const contactName = (value.contacts?.[0]?.profile?.name as string | undefined) || remoteJid
    const msgType     = (msg.type as string) || 'text'
    const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()

    // ── Reaction — mesmo padrão do lado escola (linha ~2159): atualiza a
    // mensagem original, não cria linha nova, e não mexe em conversa/unread
    // (não é uma mensagem nova pedindo resposta do atendente). Antes disso,
    // processAionMessage não tinha esse caso e a reação virava uma linha
    // órfã com message_type='reaction', nunca aparecendo anexada à mensagem
    // reagida no frontend (que só lê a coluna `reaction` da msg original).
    if (msgType === 'reaction') {
      const { message_id: reactionTargetId, emoji } = (msg as any).reaction || {}
      if (reactionTargetId) {
        const emojiValue = emoji || null // null = reação removida
        const { error: reactionErr } = await supabase
          .from('whatsapp_messages')
          .update({ reaction: emojiValue })
          .eq('message_id', reactionTargetId)
          .eq('is_aion_inbox', true)
        if (reactionErr) console.error('❌ [aion] erro ao gravar reaction:', reactionErr)
        console.log('[aion] reaction', emojiValue, 'em', reactionTargetId)
      }
      return
    }

    const text =
      msg.text?.body        ||
      msg.image?.caption    ||
      msg.video?.caption    ||
      msg.document?.caption ||
      ''

    // Extract interactive reply ID (roteamento de bot) + título legível (o
    // que o usuário efetivamente clicou) — mesmo padrão do lado escola
    // (linha ~2189-2204). Antes só capturava o ID (opt_0, opt_1...), então
    // o content gravado abaixo caía sempre no placeholder genérico
    // `[interactive]`, nunca no texto real do botão.
    let interactiveChoiceId = ''
    let interactiveTitle    = ''
    if (msgType === 'interactive') {
      const ia = msg.interactive
      if (ia?.type === 'button_reply') {
        interactiveChoiceId = (ia.button_reply?.id as string) || ''
        interactiveTitle    = ia.button_reply?.title || ''
      } else if (ia?.type === 'list_reply') {
        interactiveChoiceId = (ia.list_reply?.id as string) || ''
        interactiveTitle    = ia.list_reply?.title || ''
      }
    }
    // type:'unsupported' — confirmado via raw_data de mensagens reais (3
    // ocorrências, 17-25/08/2026): a Meta manda `errors:[{code:131051,
    // message:"Message type unknown"}]` e `unsupported:{raw_type:"unknown"}`,
    // SEM nenhum campo de conteúdo (sem text/image/video/document/caption) —
    // não é bug de parsing nosso, a Cloud API genuinamente não repassa o
    // conteúdo pra esses casos (visualização única, enquete, alguns
    // stickers/encaminhamentos restritos). Sem este caso especial, `text`
    // fica vazio e o fallback `[${msgType}]` gravava o literal "[unsupported]"
    // como content, sem explicar nada pro atendente.
    const contentText =
      msgType === 'unsupported'
        ? '📎 Este tipo de conteúdo não pode ser recebido pelo WhatsApp Business (ex: visualização única, enquete, sticker restrito) — peça para reenviarem como texto, imagem ou documento comum.'
        : (interactiveTitle || text)

    const queue = await detectAionQueue(rawPhone, supabase)

    // Select or create conversation
    const { data: existingConv, error: existingConvErr } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('remote_jid', remoteJid)
      .is('institution_id', null)
      .maybeSingle()
    if (existingConvErr) console.error('❌ [aion] erro ao buscar conversa existente:', existingConvErr)

    let conv: { id: string } | null = null

    if (existingConv) {
      const { data: updated, error: updateConvErr } = await supabase
        .from('whatsapp_conversations')
        .update({
          contact_name:    contactName,
          queue,
          status:          'waiting',
          last_message:    contentText || `[${msgType}]`,
          last_message_at: timestamp,
          last_customer_message_at: timestamp,
          is_aion_inbox:   true,
        })
        .eq('id', existingConv.id)
        .select('id')
        .maybeSingle()
      if (updateConvErr) console.error('❌ [aion] erro ao atualizar whatsapp_conversations:', updateConvErr)
      conv = updated
    } else {
      const { data: created, error: insertConvErr } = await supabase
        .from('whatsapp_conversations')
        .insert({
          remote_jid:      remoteJid,
          institution_id:  null,
          is_aion_inbox:   true,
          queue,
          contact_name:    contactName,
          status:          'waiting',
          last_message:    contentText || `[${msgType}]`,
          last_message_at: timestamp,
          last_customer_message_at: timestamp,
        })
        .select('id')
        .maybeSingle()
      if (insertConvErr) console.error('❌ [aion] erro ao criar whatsapp_conversations:', insertConvErr)
      conv = created
    }

    // Increment unread
    const { error: rpcErr1 } = await supabase
      .rpc('increment_conversation_unread', {
        p_institution_id: null,
        p_remote_jid:     remoteJid,
      })
    if (rpcErr1) console.error('❌ rpc error:', rpcErr1.message)

    // ── Resolve media URL (download + re-upload to Storage) — mesmo padrão
    // do fluxo de escola acima; institutionId aqui é só um prefixo de path no
    // Storage (bucket whatsapp-media), não precisa ser um institutions.id real.
    let mediaUrl: string | null = null
    if (MEDIA_TYPES.includes(msgType as MediaType)) {
      const mediaObj = msg[msgType as keyof typeof msg] as any
      if (mediaObj?.id) {
        const mimeType = (mediaObj.mime_type as string) || 'application/octet-stream'
        // TEMP LOG — investigação do achado não confirmado de que figurinha
        // não aparece no Inbox: confirma se o upload pro Storage funciona ou
        // se resolveMediaUrl está caindo no fallback de URL temporária da
        // Meta (que expira e não bate no filtro de getMediaUrl no frontend).
        // Remover depois de confirmar.
        if (msgType === 'sticker') {
          console.log('[STICKER DEBUG] mediaId:', mediaObj.id, '| mimeType:', mimeType)
        }
        mediaUrl = await resolveMediaUrl(mediaObj.id, 'aion', mimeType)
        if (msgType === 'sticker') {
          const isStorageUrl = !!mediaUrl && mediaUrl.includes('.supabase.co/storage/')
          console.log('[STICKER DEBUG] resolved url:', mediaUrl, '| isSupabaseStorage:', isStorageUrl,
            isStorageUrl ? '' : '⚠️ fallback pra URL temporária da Meta ou upload falhou')
        }
      }
    }

    // Insert message
    const { error: insertMsgErr } = await supabase.from('whatsapp_messages').insert({
      institution_id:  null,
      conversation_id: conv?.id || null,
      remote_jid:      remoteJid,
      message_id:      msg.id,
      instance_name:   'cloud-api',
      content:         contentText || `[${msgType}]`,
      message_type:    msgType,
      from_me:         false,
      contact_name:    contactName,
      timestamp,
      status:          'received',
      direction:       'inbound',
      is_aion_inbox:   true,
      media_url:       mediaUrl,
      raw_data:        msg,
    })
    if (insertMsgErr) console.error('❌ [aion] erro ao inserir whatsapp_messages:', insertMsgErr)

    console.log('[aion] mensagem recebida de', rawPhone, '→ fila:', queue)

    // ── Bot processing ────────────────────────────────────────────────────────
    // Fonte de verdade: whatsapp_flows (editado pelo FlowEditor visual, "🤖
    // Robô ativo/inativo"), sempre que existir uma linha explícita pra esse
    // platformWAId — inclusive quando ela diz "desabilitado" (bot_enabled=
    // false). aion_flows é uma tabela LEGADA: um único registro global, sem
    // institution_id nem qualquer outro escopo de plataforma, editado à
    // parte na aba "Configurações" (SettingsTab) sem relação nenhuma com o
    // FlowEditor. Ela só deve ser consultada quando NÃO existir nenhuma
    // configuração em whatsapp_flows pra essa instância — nunca como
    // substituto silencioso de um "desligado" explícito. Antes desta
    // correção, "existe mas desabilitado" e "não existe nenhuma linha"
    // caíam no mesmo `if (!aionFlow)`, então desligar o bot no editor visual
    // não impedia o fluxo legado (sempre ativo desde a migration que o
    // seedou) de responder no lugar, com uma mensagem completamente
    // diferente da configurada.
    let aionFlow: any = null
    let whatsappFlowsRowExists = false
    if (platformWAId) {
      const { data: wflow, error: wflowErr } = await supabase
        .from('whatsapp_flows')
        .select('*')
        .eq('platform_whatsapp_id', platformWAId)
        .maybeSingle()
      if (wflowErr) console.error('❌ [aion] erro ao buscar whatsapp_flows:', wflowErr)
      if (wflow) {
        whatsappFlowsRowExists = true
        if (wflow.is_active && wflow.bot_enabled && wflow.bot_flow?.nodes?.length) {
          aionFlow = wflow
        }
      }
    }
    // Fallback: tabela legada aion_flows — só quando não há NENHUMA
    // configuração em whatsapp_flows pra essa plataforma (linha inexistente).
    // Se a linha existe e está desabilitada, respeita essa decisão e não
    // busca nada aqui.
    if (!aionFlow && !whatsappFlowsRowExists) {
      const { data: legacyFlow, error: legacyFlowErr } = await supabase
        .from('aion_flows')
        .select('*')
        .eq('is_active', true)
        .eq('bot_enabled', true)
        .maybeSingle()
      if (legacyFlowErr) console.error('❌ [aion] erro ao buscar aion_flows:', legacyFlowErr)
      aionFlow = legacyFlow
    }

    if (!aionFlow?.bot_flow?.nodes?.length) return

    // Keyword / QR Code detection
    const trimmedText = text.trim().toUpperCase()
    if (trimmedText) {
      const { data: keyword, error: keywordErr } = await supabase
        .from('aion_keywords')
        .select('*')
        .eq('keyword', trimmedText)
        .eq('is_active', true)
        .maybeSingle()
      if (keywordErr) console.error('❌ [aion] erro ao buscar aion_keywords:', keywordErr)

      if (keyword) {
        // Log de todo match — inclusive repetido, inclusive quando não vira
        // lead — pra medir "quantas vezes essa keyword foi mandada", separado
        // da atribuição de primeiro toque abaixo (que é 1 valor por conversa).
        const { error: hitErr } = await supabase.from('aion_keyword_hits').insert({
          keyword_id:      keyword.id,
          remote_jid:      remoteJid,
          conversation_id: conv?.id ?? null,
          matched_at:      new Date().toISOString(),
        })
        if (hitErr) console.error('❌ [aion] erro ao gravar aion_keyword_hits:', hitErr)

        // Atribuição de primeiro toque — só grava se a conversa ainda não tem
        // uma keyword de origem (o .is('source_keyword_id', null) no WHERE
        // faz isso atomicamente: se já tiver valor, o update casa 0 linhas e
        // não sobrescreve, sem precisar ler o valor atual antes).
        if (conv?.id) {
          const { error: srcKwErr } = await supabase
            .from('whatsapp_conversations')
            .update({
              source_keyword_id:         keyword.id,
              source_keyword_matched_at: new Date().toISOString(),
            })
            .eq('id', conv.id)
            .is('source_keyword_id', null)
          if (srcKwErr) console.error('❌ [aion] erro ao gravar source_keyword_id:', srcKwErr)
        }

        if (keyword.create_lead) {
          const cleanPhone = rawPhone.replace(/^55/, '')
          const { data: existingLead, error: existingLeadErr } = await supabase
            .from('crm_leads')
            .select('id')
            .or(`phone.ilike.%${cleanPhone}%`)
            .maybeSingle()
          if (existingLeadErr) console.error('❌ [aion] erro ao buscar crm_leads existente (keyword):', existingLeadErr)
          if (!existingLead) {
            const { error: insertLeadErr } = await supabase.from('crm_leads').insert({
              name:       contactName,
              phone:      rawPhone,
              origin:     keyword.source || 'whatsapp',
              stage:      'interesse',
              notes:      `Veio via QR Code: ${keyword.label}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            if (insertLeadErr) console.error('❌ [aion] erro ao criar crm_leads (keyword):', insertLeadErr)
          }
        }
        if (keyword.tag) {
          const { data: convTagData, error: convTagErr } = await supabase
            .from('whatsapp_conversations')
            .select('tags')
            .eq('is_aion_inbox', true)
            .eq('remote_jid', remoteJid)
            .maybeSingle()
          if (convTagErr) console.error('❌ [aion] erro ao buscar tags da conversa:', convTagErr)
          const tags: string[] = (convTagData?.tags as string[]) || []
          if (!tags.includes(keyword.tag)) {
            const { error: updateTagErr } = await supabase.from('whatsapp_conversations')
              .update({ tags: [...tags, keyword.tag] })
              .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
            if (updateTagErr) console.error('❌ [aion] erro ao atualizar tags da conversa:', updateTagErr)
          }
        }
        if (keyword.auto_response) {
          if (keyword.cta_button_text && keyword.cta_button_url) {
            await sendAionCtaButton(remoteJid, keyword.auto_response, keyword.cta_button_text, keyword.cta_button_url)
          } else {
            await sendAionMessage(remoteJid, keyword.auto_response)
          }
        }
        return
      }
    }

    // Auto-create lead for new general-queue contacts
    if (queue === 'general') {
      const cleanPhone = rawPhone.replace(/^55/, '')
      const { data: existingLead, error: existingLeadErr2 } = await supabase
        .from('crm_leads')
        .select('id')
        .or(`phone.ilike.%${cleanPhone}%`)
        .maybeSingle()
      if (existingLeadErr2) console.error('❌ [aion] erro ao buscar crm_leads existente (general):', existingLeadErr2)
      if (!existingLead) {
        const { error: insertLeadErr2 } = await supabase.from('crm_leads').insert({
          name:       contactName,
          phone:      rawPhone,
          origin:     'whatsapp',
          stage:      'interesse',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        if (insertLeadErr2) console.error('❌ [aion] erro ao criar crm_leads (general):', insertLeadErr2)
      }
    }

    // Fetch conversation bot state
    const { data: convState, error: convStateErr } = await supabase
      .from('whatsapp_conversations')
      .select('bot_active, bot_variables')
      .eq('is_aion_inbox', true)
      .eq('remote_jid', remoteJid)
      .maybeSingle()
    if (convStateErr) console.error('❌ [aion] erro ao buscar estado do bot:', convStateErr)

    const botVars = (convState?.bot_variables as Record<string, string>) || {}
    const hasMenuPending = !!interactiveChoiceId &&
      Object.keys(botVars).some(k => k.startsWith('__menu_sent_'))

    // Count messages to detect truly new conversations
    const { count: msgCount, error: msgCountErr } = await supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_aion_inbox', true)
      .eq('remote_jid', remoteJid)
    if (msgCountErr) console.error('❌ [aion] erro ao contar whatsapp_messages:', msgCountErr)

    const isNewConv = (msgCount ?? 0) <= 1

    if (isNewConv) {
      const { error: resetBotErr } = await supabase.from('whatsapp_conversations')
        .update({ bot_active: true, bot_current_node: null, bot_variables: {} })
        .eq('is_aion_inbox', true).eq('remote_jid', remoteJid)
      if (resetBotErr) console.error('❌ [aion] erro ao resetar estado do bot:', resetBotErr)
      await processAionFlow(aionFlow, remoteJid, text, interactiveChoiceId, true)
    } else if (hasMenuPending || convState?.bot_active === true) {
      await processAionFlow(aionFlow, remoteJid, text, interactiveChoiceId, false)
    }

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

    // Diagnostic logs — always run before any validation or early return
    try {
      const _body = JSON.parse(rawBody.toString())
      console.log('[WEBHOOK RAW] body keys:', Object.keys(_body || {}))
      console.log('[WEBHOOK RAW] entry count:', _body?.entry?.length || 0)
      console.log('[WEBHOOK RAW] entry[0] keys:', Object.keys(_body?.entry?.[0] || {}))
      console.log('[WEBHOOK RAW] changes[0] field:', _body?.entry?.[0]?.changes?.[0]?.field)
      console.log('[WEBHOOK RAW] changes[0] value keys:', Object.keys(_body?.entry?.[0]?.changes?.[0]?.value || {}))
      console.log('[WEBHOOK RAW] messages:', _body?.entry?.[0]?.changes?.[0]?.value?.messages?.length || 0)
      console.log('[WEBHOOK RAW] statuses:', _body?.entry?.[0]?.changes?.[0]?.value?.statuses?.length || 0)
    } catch (parseErr) {
      console.log('[WEBHOOK RAW] parse error:', parseErr)
      console.log('[WEBHOOK RAW] rawBody length:', rawBody?.length || 0)
      console.log('[WEBHOOK RAW] rawBody preview:', rawBody?.toString()?.slice(0, 200) || 'empty')
    }

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
      console.log('[WEBHOOK] changes[0]:',
        JSON.stringify(body?.entry?.[0]?.changes?.[0]))
      console.log('[WEBHOOK] field:',
        body?.entry?.[0]?.changes?.[0]?.field)
      const value = body?.entry?.[0]?.changes?.[0]?.value
      if (!value) {
        console.log('[WEBHOOK] value undefined - payload:',
          JSON.stringify(body?.entry?.[0]?.changes?.[0]))
        return res.status(200).end()
      }

      console.log('[WEBHOOK] value field:',
        body?.entry?.[0]?.changes?.[0]?.field)
      console.log('[WEBHOOK] messages count:',
        value?.messages?.length || 0)
      console.log('[WEBHOOK] statuses count:',
        value?.statuses?.length || 0)

      const phoneNumberId = value.metadata?.phone_number_id

      // Check if this is the Áion platform inbox number
      const { data: platformWA } = await supabase
        .from('platform_whatsapp')
        .select('id, phone_number_id')
        .eq('connected', true)
        .maybeSingle()
      if (platformWA?.phone_number_id && platformWA.phone_number_id === phoneNumberId) {
        // Process messages for the Áion corporate inbox
        for (const msg of value.messages || []) {
          await processAionMessage({ msg, value, supabase, platformWAId: platformWA.id ?? '' })
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
      // Step A: look up in whatsapp_phone_numbers
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('institution_id, school_group_id')
        .eq('phone_number_id', phoneNumberId)
        .maybeSingle()

      let institutionId: string | null = phoneRecord?.institution_id ?? null
      const schoolGroupId: string | null = phoneRecord?.school_group_id ?? null

      // Step B: fallback to institutions.whatsapp_phone_id — só faz sentido
      // pro caso de telefone dedicado a UMA escola (schoolGroupId null).
      if (!institutionId && !schoolGroupId) {
        const { data: instRecord } = await supabase
          .from('institutions')
          .select('id')
          .eq('whatsapp_phone_id', phoneNumberId)
          .maybeSingle()
        institutionId = instRecord?.id ?? null
      }

      // Grupos Escolares — WhatsApp compartilhado entre unidades. Resolve pra
      // um institution_id real (conversa já existente no grupo, ou acabou de
      // responder o menu de unidade) e cai no MESMO caminho de baixo, sem
      // nenhuma outra mudança — ou ainda não dá pra resolver (a função já
      // mandou a mensagem/menu necessária) e simplesmente respondemos 200.
      if (!institutionId && schoolGroupId) {
        institutionId = await resolveOrRouteGroupSharedContact(schoolGroupId, value)
        if (!institutionId) {
          return res.status(200).json({ status: 'ok', reason: 'group_pre_routing' })
        }
      }

      if (!institutionId) {
        console.log('⚠️ Phone ID não cadastrado:', phoneNumberId)
        return res.status(200).json({ status: 'ignored', reason: 'phone_number_id not registered' })
      }

      console.log('[WEBHOOK] payload entries:', Object.keys(body?.entry?.[0] || {}))
      console.log('[WEBHOOK] changes:', JSON.stringify(body?.entry?.[0]?.changes?.[0]?.value ? Object.keys(body?.entry?.[0]?.changes?.[0]?.value) : 'sem value'))
      console.log('[WEBHOOK] messages count:', body?.entry?.[0]?.changes?.[0]?.value?.messages?.length || 0)
      console.log('[WEBHOOK] statuses count:', body?.entry?.[0]?.changes?.[0]?.value?.statuses?.length || 0)

      // Criar contatos para TODAS as mensagens do payload
      // antes de qualquer processamento
      const allMessages = value.messages || []
      const allStatuses = value.statuses || []

      console.log('[PRE-LOOP] msgs:', allMessages.length,
        'statuses:', allStatuses.length)

      for (const m of allMessages) {
        const rawJid = (m.from as string || '')
          .replace(/@s\.whatsapp\.net$/, '')
          .replace(/@g\.us$/, '')
        if (!rawJid || rawJid.includes('@')) continue

        const contactName =
          value.contacts?.find((c: any) =>
            c.wa_id === rawJid
          )?.profile?.name || rawJid

        const picUrl = value.contacts?.find((c: any) =>
          c.wa_id === rawJid
        )?.profile?.picture_url

        // rawJid crua só serve pra casar com value.contacts[].wa_id acima
        // (vem do mesmo payload da Meta, no mesmo formato); o que vai pro
        // banco é sempre a versão normalizada, pro remote_jid do contato
        // ficar no mesmo formato canônico das conversas/mensagens.
        const normalizedJid = normalizePhone(rawJid)
        console.log('[PRE-LOOP] criando contato:', normalizedJid)

        await upsertContact(
          institutionId,
          normalizedJid,
          contactName,
          picUrl
        )
      }

      // ── Process incoming messages ──────────────────────────────────────────
      for (const msg of value.messages || []) {
        // Always store remote_jid without @-suffix to avoid duplicate rows.
        // Normalizado (não só o sufixo @jid): números BR às vezes chegam da
        // Meta sem o 9º dígito — sem normalizar aqui, essa mesma escola podia
        // acabar com duas conversas pro mesmo contato (uma com o 9, criada
        // por um envio outbound-first, outra sem, criada por esta mensagem
        // recebida). normalizePhone() é a mesma função usada em todo o
        // arquivo (ver definição acima) — agora é ela quem decide o formato
        // canônico do remote_jid, não o valor cru que a Meta manda.
        const remoteJid   = normalizePhone((msg.from as string).replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, ''))
        const rawPhone    = remoteJid
        console.log('[LOOP] msg recebida:', msg.type, remoteJid, institutionId)

        // Sempre criar/atualizar contato ao receber mensagem (antes de qualquer continue)
        console.log('[LOOP] chamando upsertContact:', remoteJid)
        await upsertContact(
          institutionId,
          remoteJid,
          (value.contacts?.[0]?.profile?.name as string | undefined) || remoteJid,
          value.contacts?.[0]?.profile?.picture_url as string | undefined
        )

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
            const { data: originalMsg } = await supabase
              .from('whatsapp_messages')
              .select('content')
              .eq('message_id', originalId)
              .eq('institution_id', institutionId)
              .maybeSingle()
            await supabase.from('whatsapp_messages')
              .update({
                content: originalMsg?.content
                  ? `~~${originalMsg.content}~~ 🚫 Apagada`
                  : '🚫 Mensagem apagada',
                message_type: 'deleted',
              })
              .eq('message_id', originalId)
              .eq('institution_id', institutionId)
          }
          continue
        }

        // ── Reaction message — update the original message, do NOT insert a new row ──
        if ((msg.type as string) === 'reaction') {
          const { message_id: reactionTargetId, emoji } = (msg as any).reaction || {}
          if (reactionTargetId) {
            const emojiValue = emoji || null // null means the reaction was removed
            await supabase
              .from('whatsapp_messages')
              .update({ reaction: emojiValue })
              .eq('message_id', reactionTargetId)
              .eq('institution_id', institutionId)
            console.log('[WEBHOOK] reaction', emojiValue, 'on', reactionTargetId)
          }
          continue
        }

        const timestamp   = new Date(parseInt(msg.timestamp) * 1000).toISOString()
        const contactName = (value.contacts?.[0]?.profile?.name as string | undefined) || remoteJid
        console.log('[WEBHOOK] institutionId:', institutionId)
        console.log('[WEBHOOK] remoteJid:', remoteJid)
        console.log('[WEBHOOK] contactName:', contactName)
        const msgType     = (msg.type as string) || 'text'

        // Extract text body
        const text =
          msg.text?.body         ||
          msg.image?.caption     ||
          msg.video?.caption     ||
          msg.document?.caption  ||
          ''

        // Detect interactive button/list reply — capture raw ID for bot flow menu routing
        let interactiveReply  = ''
        let interactiveTitle  = ''
        let interactiveChoiceId = '' // raw Meta ID, e.g. 'opt_0', 'opt_1' — passed to processCustomFlow
        if (msgType === 'interactive') {
          const ia = msg.interactive
          if (ia?.type === 'button_reply') {
            interactiveChoiceId = (ia.button_reply?.id as string) || ''
            interactiveTitle    = ia.button_reply?.title || ''
            const idx = parseInt(interactiveChoiceId.replace('opt_', ''), 10)
            if (!isNaN(idx)) interactiveReply = String(idx + 1)
          } else if (ia?.type === 'list_reply') {
            interactiveChoiceId = (ia.list_reply?.id as string) || ''
            interactiveTitle    = ia.list_reply?.title || ''
            const idx = parseInt(interactiveChoiceId.replace('opt_', ''), 10)
            if (!isNaN(idx)) interactiveReply = String(idx + 1)
          }
        }
        const effectiveText = interactiveReply || text

        // ── Extract quoted/reply context ──
        const quotedMsgId: string | null = (msg.context as any)?.id || null
        let quotedContent: string | null = null
        let quotedFromMe: boolean | null = null

        if (quotedMsgId) {
          const { data: qMsg } = await supabase
            .from('whatsapp_messages')
            .select('content, from_me')
            .eq('message_id', quotedMsgId)
            .eq('institution_id', institutionId)
            .maybeSingle()
          if (qMsg) {
            quotedContent = qMsg.content
            quotedFromMe  = qMsg.from_me
          }
        }

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
        // assigned_user_id/assigned_user_name e closed_at entram aqui pro item
        // A (reabertura recente) — antes só vinham 3 campos e o bloco de
        // reopen mais abaixo lia (existingConv as any).assigned_user_id de um
        // objeto que nunca tinha essa coluna selecionada (sempre undefined).
        const { data: existingConv } = await supabase
          .from('whatsapp_conversations')
          .select('status, lead_id, contact_name, assigned_user_id, assigned_user_name, closed_at')
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
          .maybeSingle()

        // ── Satisfaction survey response (button survey_1/2/3 or text 1-5 fallback) ──
        const isSurveyReply =
          (existingConv?.status === 'closed') && (
            (msgType === 'interactive' &&
             msg.interactive?.type === 'button_reply' &&
             ['survey_1','survey_2','survey_3'].includes(msg.interactive.button_reply?.id || '')) ||
            (msgType !== 'interactive' && /^[1-5]$/.test(text.trim()))
          )

        if (isSurveyReply) {
          const { data: sf } = await supabase
            .from('whatsapp_flows')
            .select('satisfaction_survey_enabled')
            .eq('institution_id', institutionId)
            .maybeSingle()

          if (sf?.satisfaction_survey_enabled) {
            let score = 0
            if (msgType === 'interactive') {
              const btnId = msg.interactive?.button_reply?.id
              if (btnId === 'survey_1') score = 1
              if (btnId === 'survey_2') score = 2
              if (btnId === 'survey_3') score = 3
            } else {
              // Fallback de texto livre é 1-5 (regex isSurveyReply acima), mas
              // satisfaction_score usa a mesma escala 1-3 dos botões — mapeia
              // em vez de gravar o dígito cru, senão 4/5 nunca batiam no
              // filtro `<= 3` do GestorHome.tsx e eram descartados em
              // silêncio (achado da auditoria anterior).
              const rawScore = parseInt(text.trim(), 10)
              score = rawScore <= 1 ? 1 : rawScore <= 3 ? 2 : 3
            }

            if (score > 0) {
              const scoreLabel = interactiveTitle || text.trim() || `Avaliação: ${score}`
              await supabase.from('whatsapp_conversations')
                .update({ satisfaction_score: score, last_message: scoreLabel, last_message_at: timestamp, last_customer_message_at: timestamp })
                .eq('institution_id', institutionId)
                .eq('remote_jid', remoteJid)
              await supabase.from('whatsapp_messages').insert({
                institution_id: institutionId, remote_jid: remoteJid, message_id: msg.id,
                instance_name: 'cloud-api', content: scoreLabel,
                message_type: msgType,
                from_me: false, contact_name: contactName, timestamp,
                status: 'received', direction: 'inbound', raw_data: msg,
              })
              await sendAutoMessage(institutionId, remoteJid, 'Obrigado pelo seu feedback! 🙏 Estamos sempre buscando melhorar nosso atendimento.')
            }
            continue
          }
        }

        const isNewConversation = !existingConv || existingConv.status === 'closed'
        const contentPreview    = interactiveTitle || effectiveText || `[${msgType}]`
        const upsertStatus      = isNewConversation ? 'waiting' : (existingConv?.status ?? 'waiting')

        // Item A — reabertura recente: a conversa foi fechada DE PROPÓSITO
        // (atendente encerrou / bot chegou no fim do fluxo) há menos de
        // REOPEN_RECENT_WINDOW_MS. Diferente do limbo "open + sem dono" (bug
        // de silêncio do bot corrigido antes) — aqui o fechamento foi
        // intencional, então uma mensagem nova do cliente não deve reiniciar
        // boas-vindas/menu do zero, só reabrir silenciosamente.
        const isRecentReopen = isNewConversation && !!existingConv?.closed_at &&
          (Date.now() - new Date(existingConv.closed_at as unknown as string).getTime()) < REOPEN_RECENT_WINDOW_MS

        console.log('[WEBHOOK UPSERT]', {
          remoteJid,
          existingStatus: existingConv?.status ?? null,
          newStatus: upsertStatus,
          isNewConversation,
          isRecentReopen,
        })

        // Preserve agent-edited name: only use Meta profile name on first message
        const finalContactName = existingConv?.contact_name || contactName

        // ── Upsert conversation ──
        const { error: convErr } = await supabase
          .from('whatsapp_conversations')
          .upsert(
            {
              institution_id:  institutionId,
              remote_jid:      remoteJid,
              contact_name:    finalContactName,
              last_message:    contentPreview,
              last_message_at: timestamp,
              last_customer_message_at: timestamp,
              status:          upsertStatus,
            },
            { onConflict: 'institution_id,remote_jid' }
          )

        if (convErr) console.error('❌ conv upsert error:', convErr.message)

        // ── Check if last outbound was a template (used in re-open block AND flow decision) ──
        // [FIX P3 / P2] Query BEFORE re-open block so we can preserve assignee when needed.
        const { data: lastOut } = await supabase
          .from('whatsapp_messages')
          .select('message_type')
          .eq('institution_id', institutionId)
          .eq('remote_jid', remoteJid)
          .eq('from_me', true)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle()
        const lastWasTemplate = lastOut?.message_type === 'template'
        console.log('[WEBHOOK] lastOut:', lastOut?.message_type, '| lastWasTemplate:', lastWasTemplate)

        // ── Re-open: reset bot and clear assignee — UNLESS last outbound was a template ──
        // When last msg was a template the attendant sent it intentionally to re-engage
        // the customer; preserve that assignment so the attendant stays on the conversation.
        if (isNewConversation && existingConv && isRecentReopen) {
          // Item A: valida se o atendente atribuído ainda existe/está ativo
          // antes de preservá-lo — senão cai pro comportamento padrão de fila
          // (sem dono), igual ao fallback "attendant não existe mais" do spec.
          let reopenAssigneeId: string | null = null
          let reopenAssigneeName: string | null = null
          const priorAssigneeId = (existingConv as any).assigned_user_id as string | null
          if (priorAssigneeId) {
            const { data: stillActiveUser } = await supabase
              .from('users')
              .select('id, full_name, active')
              .eq('id', priorAssigneeId)
              .maybeSingle()
            if (stillActiveUser?.active) {
              reopenAssigneeId   = stillActiveUser.id
              reopenAssigneeName = stillActiveUser.full_name
            }
          }

          await supabase.from('whatsapp_conversations')
            .update({
              assigned_user_id:   reopenAssigneeId,
              assigned_user_name: reopenAssigneeName,
              bot_active:         false,
            })
            .eq('institution_id', institutionId)
            .eq('remote_jid', remoteJid)

          await supabase.from('whatsapp_conversation_events').insert({
            institution_id: institutionId,
            remote_jid:     remoteJid,
            event_type:     'reopened',
            description:    reopenAssigneeName
              ? `Cliente respondeu pouco depois do encerramento — conversa reaberta para ${reopenAssigneeName}`
              : 'Cliente respondeu pouco depois do encerramento — conversa reaberta e voltou para fila',
            metadata:       { previous_status: 'closed', recent_reopen: true },
          })
        } else if (isNewConversation && existingConv) {
          await supabase.from('whatsapp_conversations')
            .update({
              assigned_user_id:   lastWasTemplate ? (existingConv as any).assigned_user_id   : null,
              assigned_user_name: lastWasTemplate ? (existingConv as any).assigned_user_name : null,
              bot_active:         !lastWasTemplate,
              bot_current_node:   null,
              bot_variables:      {},
            })
            .eq('institution_id', institutionId)
            .eq('remote_jid', remoteJid)

          // Só registra "reaberta" quando o dono foi de fato limpo (voltou pra
          // fila geral) — no caso lastWasTemplate o atendente é mantido, não
          // é uma reabertura para a fila.
          if (!lastWasTemplate) {
            await supabase.from('whatsapp_conversation_events').insert({
              institution_id: institutionId,
              remote_jid:     remoteJid,
              event_type:     'reopened',
              description:    'Cliente enviou mensagem — conversa reaberta e voltou para fila',
              metadata:       { previous_status: 'closed' },
            })
          }
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
            content:        interactiveTitle || text || contentPreview,
            message_type:   msgType,
            media_url:      mediaUrl,
            from_me:           false,
            contact_name:      contactName,
            timestamp,
            status:            'received',
            direction:         'inbound',
            raw_data:          msg,
            quoted_message_id: quotedMsgId,
            quoted_content:    quotedContent,
            quoted_from_me:    quotedFromMe,
          })

        if (msgErr) console.error('❌ msg insert error:', msgErr.message)

        // ── Upsert contact record ──
        console.log('[WEBHOOK] chamando upsertContact...')
        await upsertContact(institutionId, remoteJid, contactName, value.contacts?.[0]?.profile?.picture_url as string | undefined)

        // ── Track received conversations (client-initiated, does not count against limit) ──
        if (isNewConversation) {
          try {
            const monthYear = new Date().toISOString().slice(0, 7)
            const { data: usageRow } = await supabase
              .from('whatsapp_conversation_usage')
              .select('id, received_count')
              .eq('institution_id', institutionId)
              .eq('month_year', monthYear)
              .maybeSingle()
            if (usageRow) {
              await supabase.from('whatsapp_conversation_usage')
                .update({ received_count: usageRow.received_count + 1, updated_at: new Date().toISOString() })
                .eq('id', usageRow.id)
            } else {
              await supabase.from('whatsapp_conversation_usage')
                .insert({ institution_id: institutionId, month_year: monthYear, received_count: 1 })
            }
          } catch (e) {
            console.error('❌ usage tracking error:', e)
          }
        }

        // ── Auto-link lead by phone (skip if already linked) ──
        if (!existingConv?.lead_id) {
          await autoLinkLead(institutionId, remoteJid)
        }

        // ── Automated flow ──
        // [FIX P2 / P3] lastWasTemplate computed before the re-open block above.
        // When the customer responds to a template, keep the conversation waiting for
        // the attendant who sent it — do NOT restart the bot.
        if (lastWasTemplate) {
          console.log('[flow] última mensagem saída era template — aguardando atendente, robô não ativado')
          // status: 'open' — a conversa continua atribuída ao atendente que mandou o
          // template; 'waiting' é reservado para assigned_user_id IS NULL, senão essa
          // conversa vira elegível pra fila de resgate de outros atendentes.
          await supabase.from('whatsapp_conversations')
            .update({ bot_active: false, status: 'open' })
            .eq('institution_id', institutionId)
            .eq('remote_jid', remoteJid)
        } else if (isRecentReopen) {
          // Item A: reabertura silenciosa — não roda processFlow (nem custom
          // bot_flow nem fluxo padrão de menu), só confirma o recebimento.
          // Texto fixo por enquanto, sem configuração por escola.
          console.log('[flow] reabertura recente pós-encerramento — pulando boas-vindas/menu, só confirmando recebimento')
          await sendAutoMessage(institutionId, remoteJid, 'Recebemos sua mensagem! Já estamos verificando, um instante 🙂')
        } else {
          await processFlow(institutionId, remoteJid, effectiveText, isNewConversation, interactiveChoiceId)
        }
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
