import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Transmissões — envio das campanhas das escolas (cron a cada 1 minuto, ver
// 20260926030000_school_broadcast_send_cron.sql). Mesma estrutura de fila do
// aion-broadcast-send (linha por destinatário, claim atômico), corrigindo o
// que lá era frágil:
//   - destinatário só vira 'sent' com o wamid da Meta em mãos (o claim marca
//     'sending'); travado em 'sending' vira failed/unknown pelo reaper, nunca
//     é reenviado (decisão 1 — reenviar arriscaria mensagem duplicada);
//   - limite por escola, não um teto global: a função decide o RITMO (cota
//     por minuto = ceil(hourly_limit/60)) e a ORDEM (escola que enviou há mais
//     tempo primeiro); claim_broadcast_recipients garante o TETO de hora/dia
//     contando o que está em trânsito. Campanha grande de uma escola só gasta
//     a cota da própria escola em cada minuto — nunca segura as outras;
//   - erro classificado (decisão 7): supressão, nova tentativa ou pausa.
// Campanha NÃO conta no limite mensal de conversas do plano (decisão 3):
// whatsapp_conversation_usage não é tocado aqui.

const GRAPH_URL = 'https://graph.facebook.com/v25.0'
const TIME_BUDGET_MS      = 45_000   // depois disso não pega trabalho novo
const SCHOOL_CONCURRENCY  = 4        // escolas processadas em paralelo
const STALE_SENDING_MIN   = 10       // reaper: 'sending' há mais que isso
const MAX_ATTEMPTS        = 3
const RETRY_DELAYS_MIN    = [5, 30]  // espera antes da 2ª e da 3ª tentativa

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

type Supa = ReturnType<typeof createClient>

interface PlanRow {
  institution_id: string
  campaign_id:    string
  hourly_limit:   number
  daily_limit:    number
  last_sent_at:   string | null
}

interface Recipient {
  id:                  string
  campaign_id:         string
  institution_id:      string
  contact_id:          string | null
  phone:               string
  template_components: any[] | null
  attempts:            number
}

interface CampaignCtx {
  id:               string
  institution_id:   string
  name:             string
  template_name:    string
  template_language: string
  priced_category:  string | null
  body_text:        string
  buttons:          { type?: string; text?: string }[]
}

// ── Classificação de erro da Meta (decisão 7) ──────────────────────────────
// MESMO mapa de api/whatsapp/webhook.ts:classifyBroadcastError (falha que
// chega depois, pelo webhook de status) — mudar os dois juntos.
type ErrorAction =
  | { kind: 'suppress'; scope: 'marketing' | 'all' }
  | { kind: 'retry' }
  | { kind: 'pause'; reason: string }
  | { kind: 'fail' }

function classifyMetaError(code: number | null, httpStatus: number | null): ErrorAction {
  if (code === 131050) return { kind: 'suppress', scope: 'marketing' }
  if (code === 131026) return { kind: 'suppress', scope: 'all' }
  if (code === 131049 || code === 130429) return { kind: 'retry' }
  if (code === 131042 || code === 131048) return { kind: 'pause', reason: `meta_${code}` }
  if (code !== null && code >= 132000 && code < 133000) return { kind: 'pause', reason: 'template_error' }
  if (httpStatus === null || httpStatus >= 500) return { kind: 'retry' }   // rede / Meta fora
  return { kind: 'fail' }
}

// Igual a api/whatsapp/webhook.ts:normalizePhone — celular BR sempre com o 9º
// dígito (13 dígitos), que é o formato em que o webhook grava remote_jid.
function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.startsWith('55') && d.length === 12) return d.slice(0, 4) + '9' + d.slice(4)
  return d
}
// Forma antiga (12 dígitos, sem o 9) — ainda existe em conversas legadas.
function legacyPhone(normalized: string): string | null {
  return /^55\d{2}9\d{8}$/.test(normalized) ? normalized.slice(0, 4) + normalized.slice(5) : null
}

function resolvePreview(bodyText: string, components: any[]): string {
  const body = components.find((c: any) => (c?.type || '').toLowerCase() === 'body')
  const params: any[] = body?.parameters || []
  return bodyText.replace(/\{\{(\d+)\}\}/g, (_m, n) => params[Number(n) - 1]?.text ?? '')
}

// Components do envio: os já resolvidos do destinatário (corpo/cabeçalho/URL)
// + payload de cada botão de resposta rápida — bc:<recipient_id>:<índice> é o
// que permite casar o clique no webhook mesmo sem context.id.
function buildComponents(row: Recipient, ctx: CampaignCtx): any[] {
  const base = (row.template_components || []).filter((c: any) =>
    !((c?.type || '').toLowerCase() === 'button' && (c?.sub_type || '').toLowerCase() === 'quick_reply'))
  ctx.buttons.forEach((b, i) => {
    if ((b?.type || '').toUpperCase() === 'QUICK_REPLY') {
      base.push({
        type: 'button', sub_type: 'quick_reply', index: String(i),
        parameters: [{ type: 'payload', payload: `bc:${row.id}:${i}` }],
      })
    }
  })
  return base
}

function isServiceRoleCall(req: Request): boolean {
  // verify_jwt=true: o gateway já validou a assinatura; aqui só conferimos o
  // papel — anon key (que também é JWT válido) não dispara o envio.
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return payload?.role === 'service_role'
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isServiceRoleCall(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS
  const supabase  = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const summary = { reaped: 0, released: 0, schools: 0, sent: 0, failed: 0, retried: 0, paused: 0, recounted: 0 }

  try {
    // 1. Travados (execução anterior que morreu no meio) → failed/unknown.
    const { data: reaped, error: reapErr } = await supabase.rpc('broadcast_reap_stale_sending', { p_minutes: STALE_SENDING_MIN })
    if (reapErr) console.error('[school-broadcast-send] reaper:', reapErr.message)
    summary.reaped = (reaped as number) || 0

    // 2. Agendadas que venceram + varredura de liberações perdidas.
    const { data: released, error: relErr } = await supabase.rpc('broadcast_release_due')
    if (relErr) console.error('[school-broadcast-send] release_due:', relErr.message)
    summary.released = (released as number) || 0

    // 3. Despacho justo entre escolas.
    const { data: plan, error: planErr } = await supabase.rpc('broadcast_dispatch_plan')
    if (planErr) throw new Error(`dispatch_plan: ${planErr.message}`)

    const bySchool = new Map<string, PlanRow[]>()
    for (const row of (plan || []) as PlanRow[]) {
      if (!bySchool.has(row.institution_id)) bySchool.set(row.institution_id, [])
      bySchool.get(row.institution_id)!.push(row)
    }
    const schools = [...bySchool.values()]   // já vem na ordem de revezamento

    const { data: tokenRow } = await supabase.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
    const accessToken = (tokenRow as any)?.value || Deno.env.get('WA_ACCESS_TOKEN') || ''

    let next = 0
    const worker = async () => {
      while (next < schools.length && !outOfTime()) {
        const campaigns = schools[next++]
        summary.schools++
        await processSchool(supabase, campaigns, accessToken, outOfTime, summary)
      }
    }
    await Promise.all(Array.from({ length: SCHOOL_CONCURRENCY }, worker))

    // 4. Contadores (e crédito das falhas de quem concluiu).
    const { data: recounted, error: recErr } = await supabase.rpc('broadcast_recount_active')
    if (recErr) console.error('[school-broadcast-send] recount_active:', recErr.message)
    summary.recounted = (recounted as number) || 0

    console.log('[school-broadcast-send]', JSON.stringify({ ...summary, ms: Date.now() - startedAt }))
    return new Response(JSON.stringify(summary), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[school-broadcast-send]', message)
    return new Response(JSON.stringify({ error: message, ...summary }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function pauseCampaign(supabase: Supa, campaignId: string, reason: string) {
  const { error } = await supabase.from('broadcast_campaigns')
    .update({ status: 'paused', paused_reason: reason })
    .eq('id', campaignId).eq('status', 'sending')
  if (error) console.error('[school-broadcast-send] erro ao pausar campanha', campaignId, error.message)
}

// Linhas pegas que não chegaram a ser enviadas (campanha pausada no meio do
// lote) voltam pra fila sem gastar tentativa.
async function releaseUnsent(supabase: Supa, rows: Recipient[]) {
  for (const r of rows) {
    await supabase.from('broadcast_recipients')
      .update({ status: 'pending', claimed_at: null, attempts: Math.max(0, r.attempts - 1) })
      .eq('id', r.id).eq('status', 'sending')
  }
}

async function loadCampaignCtx(supabase: Supa, campaignId: string): Promise<CampaignCtx | null> {
  const { data: c } = await supabase.from('broadcast_campaigns')
    .select('id, institution_id, name, template_name, template_language, priced_category, template_definition_id')
    .eq('id', campaignId).maybeSingle()
  if (!c) return null
  const { data: def } = await supabase.from('template_definitions')
    .select('body_text, buttons').eq('id', (c as any).template_definition_id).maybeSingle()
  return {
    id:                (c as any).id,
    institution_id:    (c as any).institution_id,
    name:              (c as any).name,
    template_name:     (c as any).template_name,
    template_language: (c as any).template_language || 'pt_BR',
    priced_category:   (c as any).priced_category,
    body_text:         (def as any)?.body_text || '',
    buttons:           Array.isArray((def as any)?.buttons) ? (def as any).buttons : [],
  }
}

async function processSchool(
  supabase: Supa, campaigns: PlanRow[], accessToken: string,
  outOfTime: () => boolean, summary: Record<string, number>,
) {
  const institutionId = campaigns[0].institution_id
  let quota = Math.max(1, Math.ceil(campaigns[0].hourly_limit / 60))

  // Número da escola. Número compartilhado de grupo escolar fica fora da v1
  // (decisão 5 do plano de banco) — pausa em vez de enviar pelo número errado.
  const { data: phone } = await supabase.from('whatsapp_phone_numbers')
    .select('phone_number_id, school_group_id')
    .eq('institution_id', institutionId).eq('is_active', true)
    .limit(1).maybeSingle()
  const blockReason = !phone?.phone_number_id ? 'no_phone_number'
    : (phone as any).school_group_id ? 'shared_number_unsupported'
    : !accessToken ? 'no_access_token' : null
  if (blockReason) {
    for (const c of campaigns) await pauseCampaign(supabase, c.campaign_id, blockReason)
    summary.paused += campaigns.length
    return
  }

  for (const plan of campaigns) {
    if (quota <= 0 || outOfTime()) break

    const { data: claimed, error: claimErr } = await supabase
      .rpc('claim_broadcast_recipients', { p_campaign_id: plan.campaign_id, p_limit: quota })
    if (claimErr) { console.error('[school-broadcast-send] claim:', claimErr.message); continue }
    const rows = (claimed || []) as Recipient[]
    if (!rows.length) continue          // teto de hora/dia atingido ou só retentativas futuras
    quota -= rows.length

    const ctx = await loadCampaignCtx(supabase, plan.campaign_id)
    if (!ctx) { await releaseUnsent(supabase, rows); continue }

    for (let i = 0; i < rows.length; i++) {
      const outcome = await sendOne(supabase, rows[i], ctx, (phone as any).phone_number_id, accessToken)
      summary[outcome]++
      if (outcome === 'paused') {
        await releaseUnsent(supabase, rows.slice(i + 1))
        return                               // conta/escola com problema: para a escola nesta execução
      }
    }
  }
}

async function sendOne(
  supabase: Supa, row: Recipient, ctx: CampaignCtx, phoneNumberId: string, accessToken: string,
): Promise<'sent' | 'failed' | 'retried' | 'paused'> {
  const to         = normalizePhone(row.phone)
  const components = buildComponents(row, ctx)

  let httpStatus: number | null = null
  let data: any = null
  try {
    const res = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type:     'template',
        template: {
          name:     ctx.template_name,
          language: { code: ctx.template_language },
          ...(components.length ? { components } : {}),
        },
      }),
    })
    httpStatus = res.status
    data = await res.json().catch(() => null)
  } catch (e) {
    data = { error: { message: e instanceof Error ? e.message : String(e) } }
  }

  const wamid = data?.messages?.[0]?.id as string | undefined
  if (httpStatus !== null && httpStatus < 300 && wamid) {
    await recordSent(supabase, row, ctx, to, wamid, resolvePreview(ctx.body_text, components))
    return 'sent'
  }

  const code: number | null = data?.error?.code != null ? Number(data.error.code) : null
  const message = [data?.error?.error_user_msg || data?.error?.message, data?.error?.error_data?.details]
    .filter(Boolean).join(' — ') || `HTTP ${httpStatus ?? 'sem resposta'}`
  const action = classifyMetaError(code, httpStatus)
  console.warn('[school-broadcast-send] falha', row.id, code, httpStatus, action.kind, message.slice(0, 200))

  if (action.kind === 'pause') {
    // Não é culpa do destinatário: ele volta pra fila (releaseUnsent no
    // chamador cuida dos demais do lote).
    await supabase.from('broadcast_recipients')
      .update({ status: 'pending', claimed_at: null, attempts: Math.max(0, row.attempts - 1), error_code: code, error_message: message.slice(0, 500) })
      .eq('id', row.id).eq('status', 'sending')
    await pauseCampaign(supabase, ctx.id, action.reason)
    return 'paused'
  }

  if (action.kind === 'retry' && row.attempts < MAX_ATTEMPTS) {
    const delay = RETRY_DELAYS_MIN[Math.min(row.attempts - 1, RETRY_DELAYS_MIN.length - 1)]
    await supabase.from('broadcast_recipients')
      .update({
        status: 'pending', claimed_at: null, error_code: code, error_message: message.slice(0, 500),
        next_attempt_at: new Date(Date.now() + delay * 60_000).toISOString(),
      })
      .eq('id', row.id).eq('status', 'sending')
    return 'retried'
  }

  await supabase.from('broadcast_recipients')
    .update({
      status: 'failed',
      failure_kind: action.kind === 'retry' ? 'temporary_exhausted' : 'permanent',
      error_code: code, error_message: message.slice(0, 500), failed_at: new Date().toISOString(),
    })
    .eq('id', row.id).eq('status', 'sending')

  if (action.kind === 'suppress' && (action.scope === 'all' || ctx.priced_category === 'MARKETING')) {
    const { error: supErr } = await supabase.from('broadcast_suppressions').insert({
      institution_id: row.institution_id, phone: row.phone, scope: action.scope,
      reason: 'meta_permanent_error', meta_error_code: code, source_campaign_id: ctx.id,
    })
    // 23505 = já suprimido (índice único parcial) — esperado, ignora.
    if (supErr && supErr.code !== '23505') console.error('[school-broadcast-send] supressão:', supErr.message)
  }
  return 'failed'
}

// Envio confirmado: destinatário 'sent' + mensagem no histórico da conversa.
// Conversa: procura nas duas formas do número (legado de 12 dígitos) e, se não
// existe, cria FECHADA no formato de 13 — a resposta do contato reabre como
// atendimento novo, e o webhook casa pela campanha. Conversa existente só
// ganha a última mensagem: status e atendente não mudam.
async function recordSent(supabase: Supa, row: Recipient, ctx: CampaignCtx, to: string, wamid: string, preview: string) {
  const now = new Date().toISOString()
  const forms = [to, legacyPhone(to)].filter(Boolean) as string[]

  const { data: convs } = await supabase.from('whatsapp_conversations')
    .select('id, remote_jid')
    .eq('institution_id', row.institution_id).in('remote_jid', forms)
  const conv = ((convs || []) as any[]).sort((a, b) => (a.remote_jid === to ? -1 : 1) - (b.remote_jid === to ? -1 : 1))[0]

  let contactName: string | null = null
  if (row.contact_id) {
    const { data: ct } = await supabase.from('whatsapp_contacts').select('name').eq('id', row.contact_id).maybeSingle()
    contactName = (ct as any)?.name || null
  }

  let convId: string | null = conv?.id ?? null
  const remoteJid = conv?.remote_jid ?? to
  if (conv) {
    await supabase.from('whatsapp_conversations')
      .update({ last_message: preview, last_message_at: now })
      .eq('id', conv.id)
  } else {
    const { data: created, error: convErr } = await supabase.from('whatsapp_conversations')
      .insert({
        institution_id: row.institution_id, remote_jid: to, contact_name: contactName || to,
        status: 'closed', last_message: preview, last_message_at: now,
      })
      .select('id').maybeSingle()
    if (convErr) console.error('[school-broadcast-send] conversa:', convErr.message)
    convId = (created as any)?.id ?? null
  }

  const { error: recErr } = await supabase.from('broadcast_recipients')
    .update({ status: 'sent', wamid, sent_at: now, conversation_id: convId, error_code: null, error_message: null })
    .eq('id', row.id).eq('status', 'sending')
  if (recErr) console.error('[school-broadcast-send] destinatário enviado:', row.id, recErr.message)

  const { error: msgErr } = await supabase.from('whatsapp_messages').insert({
    institution_id:  row.institution_id,
    conversation_id: convId,
    remote_jid:      remoteJid,
    message_id:      wamid,
    instance_name:   'cloud-api',
    content:         preview || `[Template: ${ctx.template_name}]`,
    message_type:    'template',
    from_me:         true,
    contact_name:    contactName || remoteJid,
    status:          'sent',
    direction:       'outbound',
    timestamp:       now,
  })
  if (msgErr) console.error('[school-broadcast-send] mensagem:', msgErr.message)
}
