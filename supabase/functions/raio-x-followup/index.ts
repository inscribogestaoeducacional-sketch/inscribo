// @ts-nocheck
// =============================================================================
// raio-x-followup — Fase B do Raio-X Estratégico.
//
// Disparada por supabase/functions/raio-x-lead/index.ts logo após a criação do
// crm_lead — único sinal server-side que existe hoje: o PDF é gerado e baixado
// 100% no client (src/pages/RaioXPage.tsx:generateReport()), sem round-trip
// que pudesse ser usado como gatilho de "download concluído".
//
// Envia o template de WhatsApp "raio-x pronto" + o e-mail de boas-vindas, e
// registra a conversa/mensagem em whatsapp_conversations/whatsapp_messages
// (mesmo padrão de api/whatsapp/webhook.ts:processAionMessage e de
// supabase/functions/aion-scheduled-send/index.ts) com status 'closed' — pra
// que, se o diretor responder depois, o webhook (que sempre reabre uma
// conversa existente pra 'waiting' ao receber uma mensagem nova) encontre a
// conversa e trate a resposta como réplica a um template comum, sem lógica
// especial adicional.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { normalizePhone } from '../_shared/phone.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const GRAPH_URL = 'https://graph.facebook.com/v19.0'

// Texto de referência do template a ser criado/aprovado manualmente na Meta
// Business Manager com o nome abaixo (categoria UTILITY, pt_BR). Só o nome do
// template e os parâmetros posicionais são enviados de fato pela API — este
// texto documenta o corpo esperado pra quem for cadastrar/aprovar o template.
// {{1}} = nome do diretor, {{2}} = nome da escola.
const RAIO_X_PRONTO_TEMPLATE_NAME = 'raio_x_pronto'
const RAIO_X_PRONTO_TEMPLATE_TEXT =
  'Olá {{1}}! 👋 Vimos que você acabou de baixar o Raio-X Estratégico da {{2}} - esperamos que os dados tenham sido úteis! Se quiser entender melhor como transformar esse diagnóstico em mais matrículas para 2027, um consultor da Áion Edu pode te mostrar isso sem compromisso. Responda esta mensagem quando quiser conversar! 🚀'

// normalizePhone (import acima) assume que o DDI já está presente — é o que
// a Meta sempre manda, mas o `phone` aqui vem de um formulário público
// (src/pages/RaioXPage.tsx) que um diretor de escola brasileira normalmente
// preenche SEM o 55 na frente. Garante o DDI antes de normalizar, senão um
// número de 10-11 dígitos sem código de país passaria batido sem o 55 (a
// função só mexe em números que já começam com 55).
function toRemoteJid(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, '')
  const withCountryCode = digits.startsWith('55') ? digits : `55${digits}`
  return normalizePhone(withCountryCode)
}

function buildPreview(directorName: string, schoolName: string): string {
  return RAIO_X_PRONTO_TEMPLATE_TEXT.replace('{{1}}', directorName).replace('{{2}}', schoolName)
}

const CORS_JSON = { ...CORS, 'Content-Type': 'application/json' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  try {
    const { leadId, director_name, phone, email, school_name } = await req.json()

    if (!director_name?.trim() || !phone?.trim() || !school_name?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Campos obrigatórios faltando.' }),
        { status: 400, headers: CORS_JSON }
      )
    }

    const remoteJid = toRemoteJid(phone)
    const directorTrim = director_name.trim()
    const schoolTrim = school_name.trim()
    const preview = buildPreview(directorTrim, schoolTrim)

    const results: { whatsapp: boolean; email: boolean; error?: string } = { whatsapp: false, email: false }

    // ── 1. Envia o template via Meta Cloud API (mesmo padrão de
    // aion-scheduled-send/index.ts) ──
    let messageId: string | undefined
    try {
      const { data: platformWA } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id, access_token')
        .eq('connected', true)
        .maybeSingle()

      if (!platformWA?.phone_number_id || !platformWA?.access_token) {
        throw new Error('WhatsApp da Áion não configurado/conectado')
      }

      const resp = await fetch(`${GRAPH_URL}/${platformWA.phone_number_id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformWA.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: remoteJid,
          type: 'template',
          template: {
            name: RAIO_X_PRONTO_TEMPLATE_NAME,
            language: { code: 'pt_BR' },
            components: [{
              type: 'body',
              parameters: [
                { type: 'text', text: directorTrim },
                { type: 'text', text: schoolTrim },
              ],
            }],
          },
        }),
      })
      const waData = await resp.json()
      if (!resp.ok) throw new Error(waData.error?.message || 'Falha ao enviar via Meta Cloud API')
      messageId = waData.messages?.[0]?.id
      results.whatsapp = true
    } catch (e) {
      console.error('[raio-x-followup] erro ao enviar WhatsApp:', e instanceof Error ? e.message : e)
      results.error = e instanceof Error ? e.message : String(e)
    }

    // ── 2. Registra a conversa (find-or-create — não duplica) + a mensagem.
    // Mesmo se o envio acima tiver falhado, registramos o registro com
    // status 'failed' pra manter o histórico consistente com o que
    // efetivamente chegou (ou não) ao lead. ──
    try {
      const { data: existingConv } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('remote_jid', remoteJid)
        .eq('is_aion_inbox', true)
        .maybeSingle()

      const convPayload = {
        contact_name: directorTrim,
        queue: 'leads',
        status: 'closed',
        last_message: preview,
        last_message_at: new Date().toISOString(),
        aion_lead_id: leadId || null,
      }

      let convId: string | undefined
      if (existingConv) {
        await supabase.from('whatsapp_conversations').update(convPayload).eq('id', existingConv.id)
        convId = existingConv.id
      } else {
        const { data: created } = await supabase
          .from('whatsapp_conversations')
          .insert({ remote_jid: remoteJid, institution_id: null, is_aion_inbox: true, ...convPayload })
          .select('id')
          .maybeSingle()
        convId = created?.id
      }

      await supabase.from('whatsapp_messages').insert({
        institution_id: null,
        conversation_id: convId || null,
        remote_jid: remoteJid,
        message_id: messageId,
        instance_name: 'cloud-api',
        content: preview,
        message_type: 'template',
        from_me: true,
        contact_name: directorTrim,
        timestamp: new Date().toISOString(),
        status: results.whatsapp ? 'sent' : 'failed',
        direction: 'outbound',
        is_aion_inbox: true,
      })
    } catch (e) {
      console.error('[raio-x-followup] erro ao registrar conversa/mensagem:', e instanceof Error ? e.message : e)
    }

    // ── 3. E-mail de boas-vindas — best-effort, não bloqueia a resposta ──
    if (email?.trim()) {
      try {
        const emailRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            type: 'raio_x_boas_vindas',
            to: email.trim(),
            data: { escola: schoolTrim, diretor: directorTrim },
          }),
        })
        results.email = emailRes.ok
        if (!emailRes.ok) console.error('[raio-x-followup] send-email falhou:', await emailRes.text())
      } catch (e) {
        console.error('[raio-x-followup] erro ao chamar send-email:', e instanceof Error ? e.message : e)
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      status: 200, headers: CORS_JSON,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    console.error('[raio-x-followup] erro:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: CORS_JSON }
    )
  }
})
