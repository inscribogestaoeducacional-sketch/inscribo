import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

/**
 * POST /api/whatsapp/send-template
 *
 * Body:
 *   institution_id  UUID
 *   to              string  — destination phone (digits only, e.g. "5583991110001")
 *   template_name   string  — approved template name in Meta Business Manager
 *   language        string  — BCP-47 code, default "pt_BR"
 *   components      array   — Meta template components with variable parameters
 *   conversation_id UUID?   — optional, used for conversation update
 *
 * components example (BODY with variables):
 *   [{ type: "body", parameters: [{ type: "text", text: "João" }] }]
 *
 * components example (HEADER image + BODY):
 *   [
 *     { type: "header", parameters: [{ type: "image", image: { link: "https://..." } }] },
 *     { type: "body",   parameters: [{ type: "text", text: "João" }] }
 *   ]
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const {
    institution_id,
    to,
    template_name,
    language       = 'pt_BR',
    components     = [],
    conversation_id,
  } = req.body

  if (!institution_id || !to || !template_name) {
    return res.status(400).json({ error: 'institution_id, to e template_name são obrigatórios' })
  }

  try {
    // ── Fetch phone_number_id ──
    const { data: phoneRecord, error: phoneErr } = await supabase
      .from('whatsapp_phone_numbers')
      .select('phone_number_id')
      .eq('institution_id', institution_id)
      .eq('is_active', true)
      .single()

    if (phoneErr || !phoneRecord) {
      return res.status(400).json({ error: 'Número WhatsApp não configurado para esta escola' })
    }

    // ── Fetch access token (per-platform, with env fallback) ──
    const { data: tokenData } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'wa_access_token')
      .single()
    const accessToken = tokenData?.value || process.env.WA_ACCESS_TOKEN

    // ── Check monthly conversation limit before sending ──
    const monthYear = new Date().toISOString().slice(0, 7)
    const { data: usageRow } = await supabase
      .from('whatsapp_conversation_usage')
      .select('id, initiated_count, limit_count')
      .eq('institution_id', institution_id)
      .eq('month_year', monthYear)
      .maybeSingle()

    const initiatedCount = usageRow?.initiated_count ?? 0
    const limitCount     = usageRow?.limit_count     ?? 1000

    if (initiatedCount >= limitCount) {
      console.warn('[usage] limite atingido:', institution_id, initiatedCount, '>=', limitCount)
      return res.status(429).json({ error: 'Limite mensal de conversas atingido' })
    }

    // ── Build template payload ──
    const templatePayload: any = {
      name:     template_name,
      language: { code: language },
    }
    if (Array.isArray(components) && components.length > 0) {
      templatePayload.components = components.map((c: any) => ({
        ...c,
        type: c.type?.toUpperCase(),
        parameters: c.parameters?.map((p: any) => ({
          ...p,
          type: p.type?.toLowerCase(),
        })),
      }))
    }

    // ── Send via Meta Cloud API ──
    console.log('📤 Payload Meta:', JSON.stringify({ to, template: templatePayload }, null, 2))
    const metaRes = await fetch(`${GRAPH_URL}/${phoneRecord.phone_number_id}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:              'template',
        template:          templatePayload,
      }),
    })

    const metaData = await metaRes.json()
    if (!metaRes.ok) {
      console.error('❌ Meta template error:', metaData)
      return res.status(500).json({
        error:   metaData.error?.message || 'Erro ao enviar template',
        code:    metaData.error?.code,
        details: metaData.error,
      })
    }

    const wamid   = metaData.messages?.[0]?.id
    console.log('✅ Template enviado:', { wamid, to, template_name, metaData })

    // ── Build real preview text from template body ──
    const bodyComp = components?.find((c: any) => c.type?.toUpperCase() === 'BODY')
    let preview = `[Template: ${template_name}]`
    if (bodyComp?.parameters) {
      const { data: tmplData } = await supabase
        .from('whatsapp_templates')
        .select('components')
        .eq('institution_id', institution_id)
        .eq('name', template_name)
        .single()
      if (tmplData?.components) {
        const bodyTmpl = (tmplData.components as any[]).find((c: any) => c.type === 'BODY')
        if (bodyTmpl?.text) {
          let text: string = bodyTmpl.text
          ;(bodyComp.parameters as any[]).forEach((p: any, i: number) => {
            text = text.replace(`{{${i + 1}}}`, p.text || '')
          })
          preview = text
        }
      }
    }

    // ── Persist message ──
    await supabase.from('whatsapp_messages').insert({
      institution_id,
      remote_jid:    to,
      message_id:    wamid,
      instance_name: 'cloud-api',
      content:       preview,
      message_type:  'template',
      from_me:       true,
      status:        'sent',
      direction:     'outbound',
      timestamp:     new Date().toISOString(),
      ...(conversation_id ? { conversation_id } : {}),
    })

    // ── Update conversation last_message ──
    const convUpdate = supabase
      .from('whatsapp_conversations')
      .update({ last_message: preview, last_message_at: new Date().toISOString() })

    await (conversation_id
      ? convUpdate.eq('id', conversation_id)
      : convUpdate.eq('institution_id', institution_id).eq('remote_jid', to))

    // ── Increment initiated_count (school-initiated conversation) ──
    try {
      if (usageRow) {
        await supabase.from('whatsapp_conversation_usage')
          .update({ initiated_count: usageRow.initiated_count + 1, updated_at: new Date().toISOString() })
          .eq('id', usageRow.id)
      } else {
        await supabase.from('whatsapp_conversation_usage')
          .insert({ institution_id, month_year: monthYear, initiated_count: 1 })
      }
    } catch (e) {
      console.error('❌ usage increment error:', e)
    }

    return res.status(200).json({ success: true, wamid })

  } catch (err: any) {
    console.error('❌ Template send error:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
