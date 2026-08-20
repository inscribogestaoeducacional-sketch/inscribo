import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

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

const GRAPH_URL = 'https://graph.facebook.com/v19.0'
const META_FETCH_TIMEOUT_MS = 30000

type MsgType = 'text' | 'image' | 'video' | 'audio' | 'document' | 'template'

// ── Build Meta Cloud API payload per message type ────────────────────────────
function buildPayload(
  to: string,
  type: MsgType,
  opts: {
    message?: string; mediaUrl?: string; caption?: string; filename?: string; quotedMessageId?: string
    templateName?: string; templateLanguage?: string; templateComponents?: unknown[]
  }
): object {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type }
  const context = opts.quotedMessageId ? { context: { message_id: opts.quotedMessageId } } : {}

  switch (type) {
    case 'text':
      return { ...base, ...context, text: { body: opts.message!, preview_url: false } }
    case 'image':
      return { ...base, image: { link: opts.mediaUrl!, ...(opts.caption ? { caption: opts.caption } : {}) } }
    case 'video':
      return { ...base, video: { link: opts.mediaUrl!, ...(opts.caption ? { caption: opts.caption } : {}) } }
    case 'audio':
      return { ...base, audio: { link: opts.mediaUrl! } }
    case 'document':
      return {
        ...base,
        document: {
          link: opts.mediaUrl!,
          filename: opts.filename || 'documento',
          ...(opts.caption ? { caption: opts.caption } : {}),
        },
      }
    case 'template':
      // Mesmo shape já usado por aion-scheduled-send (components em minúsculo,
      // sem normalização de case — Meta aceita, é o mesmo payload que a Edge
      // Function envia hoje pras mensagens agendadas).
      return {
        ...base,
        template: {
          name:     opts.templateName!,
          language: { code: opts.templateLanguage || 'pt_BR' },
          ...(opts.templateComponents && opts.templateComponents.length > 0
            ? { components: opts.templateComponents }
            : {}),
        },
      }
    default:
      return { ...base, text: { body: '[unsupported type]', preview_url: false } }
  }
}

// ── Content preview for last_message ────────────────────────────────────────
function contentPreview(type: MsgType, message?: string, caption?: string, filename?: string): string {
  if (type === 'text')     return message!
  if (type === 'image')    return caption || '[Imagem]'
  if (type === 'video')    return caption || '[Vídeo]'
  if (type === 'audio')    return '[Áudio]'
  if (type === 'document') return filename ? `[Documento] ${filename}` : '[Documento]'
  if (type === 'template') return caption || '[Template]'
  return '[Mídia]'
}

// ── Upload base64 to Supabase Storage → return public URL ────────────────────
async function uploadToStorage(
  supabase: ReturnType<typeof createClient>,
  base64: string,
  mimetype: string,
  filename: string,
  institutionId: string
): Promise<string> {
  const buffer   = Buffer.from(base64, 'base64')
  const ext      = mimetype.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') || 'bin'
  const safeName = (filename || `upload.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_')
  const path     = `${institutionId}/${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from('whatsapp-media')
    .upload(path, buffer, { contentType: mimetype, upsert: false })

  if (error) throw new Error(`Storage upload falhou: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage
    .from('whatsapp-media')
    .getPublicUrl(path)

  return publicUrl
}

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Always return JSON — catch anything that leaks past the inner try/catch
  try {
    return await handleSend(req, res)
  } catch (fatal: any) {
    console.error('❌ [send.ts] fatal error:', fatal)
    return res.status(500).json({ error: fatal?.message || 'Erro interno fatal' })
  }
}

async function handleSend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  console.log('[SEND] method:', req.method)
  console.log('[SEND] body:', JSON.stringify(req.body))
  console.log('[SEND] início', {
    hasSupabaseUrl:  !!process.env.SUPABASE_URL,
    hasServiceKey:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })

  // Create client lazily inside the handler so module-level crashes cannot
  // produce an HTML 500 response instead of JSON
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('send.ts - env vars missing', { supabaseUrl: !!supabaseUrl, serviceKey: !!serviceKey })
    return res.status(500).json({ error: 'Server misconfiguration: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const {
    institution_id,
    isAionSend       = false,
    to,
    type             = 'text' as MsgType,
    message,
    mediaUrl,
    base64,
    mimetype,
    filename         = '',
    caption          = '',
    sender_name      = '',
    sender_user_id,
    conversation_id,
    quoted_message_id,
    quoted_content,
    quoted_from_me,
    templateName,
    templateLanguage,
    templateComponents = [],
    // Só usados quando isAionSend && !conversation_id && a conversa ainda não
    // existe — nome sugerido pro contato/conversa nova (ex: nome da escola
    // sendo cobrada) e a origem a gravar em aion_contacts.source (ver
    // AdminFinancial.tsx: 'cobranca_manual').
    newContactName,
    contactSource = 'whatsapp_send',
  } = req.body ?? {}

  // ── Validation ──
  if (!to)                            return res.status(400).json({ error: 'to é obrigatório' })
  if (!isAionSend && !institution_id) return res.status(400).json({ error: 'institution_id é obrigatório para envio de escola' })
  if (type === 'text' && !message)    return res.status(400).json({ error: 'message é obrigatório para type=text' })
  if (type === 'template' && !templateName)
    return res.status(400).json({ error: 'templateName é obrigatório para type=template' })
  if (type !== 'text' && type !== 'template' && !mediaUrl && !base64)
    return res.status(400).json({ error: `mediaUrl ou base64 é obrigatório para type=${type}` })

  try {
    let phoneNumberId: string
    let accessToken: string

    if (isAionSend) {
      const { data: platformWA, error: platformErr } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id, access_token')
        .eq('connected', true)
        .single()

      if (platformErr || !platformWA) {
        return res.status(400).json({ error: 'WhatsApp da Áion não configurado ou desconectado' })
      }

      phoneNumberId = platformWA.phone_number_id
      accessToken   = platformWA.access_token
    } else {
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle()

      if (phoneRecord?.phone_number_id) {
        phoneNumberId = phoneRecord.phone_number_id
      } else {
        const { data: instRecord } = await supabase
          .from('institutions')
          .select('whatsapp_phone_id')
          .eq('id', institution_id)
          .maybeSingle()

        if (!instRecord?.whatsapp_phone_id) {
          return res.status(400).json({ error: 'Número WhatsApp não configurado para esta escola' })
        }

        phoneNumberId = instRecord.whatsapp_phone_id
      }
      const waConfig = await getWAConfig()
      console.log('[SEND] waConfig:', { hasToken: !!waConfig.accessToken, tokenLength: waConfig.accessToken?.length })
      accessToken   = waConfig.accessToken
    }

    console.log('[SEND] phoneRecord:', JSON.stringify({ phoneNumberId }))
    console.log('[SEND] token ok:', !!accessToken, '| phoneNumberId:', phoneNumberId)

    // ── Resolve media URL (upload if base64 provided) ──
    let resolvedMediaUrl: string | undefined = mediaUrl
    if (type !== 'text' && type !== 'template' && !resolvedMediaUrl && base64 && mimetype) {
      resolvedMediaUrl = await uploadToStorage(supabase, base64, mimetype,
        filename || `media.${mimetype.split('/')[1] || 'bin'}`,
        institution_id
      )
    }

    // ── Send via Meta Cloud API ──
    const payload = buildPayload(to, type as MsgType, {
      message,
      mediaUrl:       resolvedMediaUrl,
      caption:        caption || undefined,
      filename:       filename || undefined,
      quotedMessageId: quoted_message_id || undefined,
      templateName,
      templateLanguage,
      templateComponents,
    })

    console.log('send.ts - payload:', JSON.stringify(payload))

    const metaRes = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify(payload),
      signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
    })

    console.log('send.ts - meta response:', metaRes.status)

    const metaData = await metaRes.json()
    if (!metaRes.ok) {
      console.error('❌ Meta API error:', metaData)
      return res.status(500).json({ error: metaData.error?.message || 'Erro ao enviar mensagem' })
    }

    const wamid   = metaData.messages?.[0]?.id
    const preview = contentPreview(type as MsgType, message, caption, filename)

    // ── Aion inbox: garante conversa (+ contato) ANTES de gravar a mensagem ──
    // Bug corrigido: o client (AdminFinancial.tsx → cobrança manual) tentava
    // criar a linha em whatsapp_conversations direto do navegador com
    // institution_id=null e caía num 403 de RLS — a policy de INSERT só
    // libera institution_id = current_user_institution_id(), sem a exceção
    // is_aion_inbox que as policies de SELECT/UPDATE têm. Esse endpoint já
    // roda com service role (bypassa RLS de propósito, é código de servidor
    // nunca exposto ao cliente), então é aqui — e só aqui — que essa escrita
    // deve acontecer. Mesmo padrão de busca-ou-cria já usado em
    // api/whatsapp/webhook.ts (processAionMessage) pra conversas novas.
    let resolvedConversationId: string | undefined = conversation_id || undefined
    if (isAionSend && !resolvedConversationId) {
      const jid = String(to).includes('@') ? to : `${to}@s.whatsapp.net`
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('is_aion_inbox', true)
        .eq('remote_jid', jid)
        .maybeSingle()

      if (existingConv) {
        resolvedConversationId = existingConv.id
      } else {
        const { data: newConv, error: newConvErr } = await supabase
          .from('whatsapp_conversations')
          .insert({
            remote_jid:         jid,
            institution_id:     null,
            is_aion_inbox:      true,
            contact_name:       newContactName || to,
            status:             'open',
            assigned_user_id:   sender_user_id || null,
            assigned_user_name: sender_name || null,
            bot_active:         false,
            last_message_at:    new Date().toISOString(),
          })
          .select('id')
          .single()
        if (newConvErr) console.error('❌ [send.ts] erro ao criar conversa Aion:', newConvErr.message)
        resolvedConversationId = newConv?.id
      }

      // aion_contacts não sofre do mesmo bug de RLS (is_super_admin_user()
      // funciona client-side), mas cria aqui junto — precisa do
      // conversation_id recém-resolvido pra vincular, e evita depender de
      // dois passos client/server separados pra uma única ação do usuário.
      const { data: existingContact } = await supabase
        .from('aion_contacts')
        .select('id')
        .eq('phone', to)
        .maybeSingle()
      if (!existingContact) {
        const { error: contactErr } = await supabase.from('aion_contacts').insert({
          phone:           to,
          name:            newContactName || null,
          source:          contactSource,
          conversation_id: resolvedConversationId || null,
          created_by:      sender_user_id || null,
        })
        if (contactErr) console.error('❌ [send.ts] erro ao criar aion_contacts:', contactErr.message)
      }
    }

    // ── Persist message ──
    await supabase.from('whatsapp_messages').insert({
      institution_id:    isAionSend ? null : institution_id,
      remote_jid:        to,
      message_id:        wamid,
      instance_name:     'cloud-api',
      content:           type === 'text' ? message : (caption || preview),
      message_type:      type,
      media_url:         resolvedMediaUrl || null,
      from_me:           true,
      contact_name:      sender_name || null,
      sender_user_id:    sender_user_id || null,
      status:            'sent',
      direction:         'outbound',
      is_aion_inbox:     isAionSend,
      timestamp:         new Date().toISOString(),
      ...(resolvedConversationId ? { conversation_id: resolvedConversationId } : {}),
      ...(quoted_message_id ? { quoted_message_id, quoted_content: quoted_content || null, quoted_from_me: quoted_from_me ?? null } : {}),
    })

    // ── Find the conversation to know whether this is its first human reply ──
    // (first_response_at, gravado só por sendAutoMessage() em webhook.ts, mede
    // o bot — first_human_response_at é o equivalente pra mensagem humana,
    // usado pelo KPI "Tempo de resposta" e pelo Ranking em GestorHome.tsx)
    let convSelect = supabase.from('whatsapp_conversations').select('id, first_human_response_at')
    if (resolvedConversationId) {
      convSelect = convSelect.eq('id', resolvedConversationId)
    } else if (isAionSend) {
      convSelect = convSelect.eq('is_aion_inbox', true).eq('remote_jid', to)
    } else {
      convSelect = convSelect.eq('institution_id', institution_id).eq('remote_jid', to)
    }
    const { data: convRow } = await convSelect.maybeSingle()

    // ── Update conversation last_message (+ first_human_response_at se ainda não tiver) ──
    const convUpdatePayload: Record<string, any> = { last_message: preview, last_message_at: new Date().toISOString() }
    if (convRow && !convRow.first_human_response_at) {
      convUpdatePayload.first_human_response_at = new Date().toISOString()
    }
    const convUpdate = supabase
      .from('whatsapp_conversations')
      .update(convUpdatePayload)

    if (resolvedConversationId) {
      await convUpdate.eq('id', resolvedConversationId)
    } else if (isAionSend) {
      await convUpdate.eq('is_aion_inbox', true).eq('remote_jid', to)
    } else {
      await convUpdate.eq('institution_id', institution_id).eq('remote_jid', to)
    }

    return res.status(200).json({ success: true, wamid })

  } catch (err: any) {
    console.error('[SEND] ERRO:', err?.message, err?.stack)
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
}
