import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Transmissões — gestão de campanha pela escola. Toda escrita de campanha
// passa por aqui (RLS só deixa o navegador LER campanhas/destinatários):
// quem chama precisa passar em broadcast_user_can_manage_as (mesma regra do
// módulo no front: admin/manager, ou permissão 'transmissoes').
//
// Ações (POST { action, ... }):
//   preview  { institution_id, template_definition_id, filter, import_rows?, manual?, variable_mapping? }
//            → contagem da audiência (e por que cada um ficou de fora),
//              amostra da mensagem e estimativa de custo. Não grava nada.
//   audience_page { institution_id, template_definition_id, filter, import_rows?, manual?, q?, page? }
//            → a lista (50 por página, busca por nome/telefone) com o motivo
//              de cada contato, contagens, contatos da escola fora da lista
//              que batem com a busca, e estimativa de custo. Não grava nada.
//   create   { institution_id, name, template_definition_id, variable_mapping,
//              filter, import_rows?, manual?, opt_in_confirmed?, reply_actions?,
//              send_mode, scheduled_at? }  → campanha em rascunho + destinatários
// manual = { include_contact_ids: [uuid], exclude_phone_keys: [text] } — ajustes
// feitos à mão na lista. O navegador nunca manda telefones: a audiência é
// sempre recalculada aqui (broadcast_resolve_audience), com dedup e as mesmas
// exclusões (opt-out, blacklist, número inválido) valendo pra quem entra à mão.
//   price    { campaign_id } → congela o preço, usa crédito, libera se não
//              houver o que cobrar (broadcast_price_campaign, atômica no banco)
//   pause    { campaign_id }   resume { campaign_id }   cancel { campaign_id }
// A cobrança em si é o asaas-create-charge { campaign_id } (etapa 3).

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY')!

const MAX_RECIPIENTS    = 20_000
const MAX_IMPORT_ROWS   = 20_000
const MAX_MANUAL        = 20_000
const PAGE_SIZE         = 50
const RPC_PAGE          = 1_000     // PostgREST devolve no máximo 1000 linhas por chamada
const INSERT_BATCH      = 500
const MIN_SCHEDULE_MIN  = 5
const MAX_SCHEDULE_DAYS = 60
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Supa = ReturnType<typeof createClient>

class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message) }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) throw new HttpError(401, 'Não autenticado')
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData?.user) throw new HttpError(401, 'Não autenticado')
    const userId = userData.user.id

    const sb   = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    const body = await req.json().catch(() => ({}))

    switch (body?.action) {
      case 'preview': return json(200, await actionPreview(sb, userId, body))
      case 'audience_page': return json(200, await actionAudiencePage(sb, userId, body))
      case 'create':  return json(200, await actionCreate(sb, userId, body))
      case 'price':   return json(200, await actionPrice(sb, userId, body))
      case 'pause':   return json(200, await actionPause(sb, userId, body))
      case 'resume':  return json(200, await actionResume(sb, userId, body))
      case 'cancel':  return json(200, await actionCancel(sb, userId, body))
      default: throw new HttpError(400, 'action deve ser preview, audience_page, create, price, pause, resume ou cancel')
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.message, ...(err.details ? { details: err.details } : {}) })
    const message = err instanceof Error ? err.message : String(err)
    console.error('[broadcast-campaigns]', message)
    return json(500, { error: message })
  }
})

// ── Permissão, módulo e template ────────────────────────────────────────────

async function requireManage(sb: Supa, userId: string, institutionId: string) {
  if (typeof institutionId !== 'string' || !UUID_RE.test(institutionId)) throw new HttpError(400, 'institution_id inválido')
  const { data, error } = await sb.rpc('broadcast_user_can_manage_as', { p_user_id: userId, p_institution_id: institutionId })
  if (error) throw new Error(`permissão: ${error.message}`)
  if (data !== true) throw new HttpError(403, 'Sem permissão para gerenciar Transmissões desta escola')
}

async function requireModule(sb: Supa, institutionId: string) {
  const { data: settings } = await sb.from('broadcast_settings')
    .select('enabled, reply_window_hours').eq('institution_id', institutionId).maybeSingle()
  if (!(settings as any)?.enabled) throw new HttpError(403, 'Módulo Transmissões não liberado para esta escola')
  // Número compartilhado de grupo escolar fica fora da v1.
  const { data: phone } = await sb.from('whatsapp_phone_numbers')
    .select('phone_number_id, school_group_id').eq('institution_id', institutionId).eq('is_active', true)
    .limit(1).maybeSingle()
  if (!(phone as any)?.phone_number_id) throw new HttpError(409, 'Escola sem número de WhatsApp ativo')
  if ((phone as any).school_group_id) throw new HttpError(409, 'Número compartilhado de grupo escolar ainda não é suportado em Transmissões')
  return settings as { enabled: boolean; reply_window_hours: number }
}

interface TemplateCtx {
  def: { id: string; name: string; language: string; category: string; body_text: string;
         header_config: { format?: string; text?: string; media?: { public_url?: string } } | null; buttons: { type?: string; text?: string }[];
         institution_id: string | null }
  category: string          // categoria aprovada pela Meta (é ela que define o preço)
  bodyVars: number[]
  headerHasVar: boolean
  // Cabeçalho de imagem/vídeo: mídia fixa do template (link público no
  // bucket broadcast-media), mandada em todo envio — a Meta busca o link.
  headerMedia: { kind: 'image' | 'video'; link: string } | null
  urlButtons: number[]      // índices (na lista de botões) de botões de URL
  quickReplies: number[]    // índices de botões de resposta rápida
}

async function loadTemplate(sb: Supa, institutionId: string, defId: string): Promise<TemplateCtx> {
  if (typeof defId !== 'string' || !UUID_RE.test(defId)) throw new HttpError(400, 'template_definition_id inválido')
  const { data: def } = await sb.from('template_definitions')
    .select('id, name, language, category, body_text, header_config, buttons, button_config, institution_id, available_contexts')
    .eq('id', defId).maybeSingle()
  if (!def) throw new HttpError(404, 'Template não encontrado')
  const d = def as any
  if (d.institution_id && d.institution_id !== institutionId) throw new HttpError(404, 'Template não encontrado')
  if (!d.institution_id && !(d.available_contexts || []).includes('broadcast')) {
    throw new HttpError(409, 'Este template da Áion não está liberado para Transmissões')
  }
  const { data: st } = await sb.from('template_institution_status')
    .select('status, approved_category, visible_to_school')
    .eq('template_definition_id', defId).eq('institution_id', institutionId).maybeSingle()
  if ((st as any)?.status !== 'approved' || (st as any)?.visible_to_school === false) {
    throw new HttpError(409, 'Template ainda não aprovado pela Meta para esta escola')
  }
  const header = d.header_config as TemplateCtx['def']['header_config']
  const headerFormat = (header?.format || '').toUpperCase()
  let headerMedia: TemplateCtx['headerMedia'] = null
  if (headerFormat === 'IMAGE' || headerFormat === 'VIDEO') {
    const link = header?.media?.public_url || ''
    if (!/^https:\/\//.test(link)) throw new HttpError(409, 'Template com cabeçalho de mídia sem o arquivo publicado — envie o template de novo')
    headerMedia = { kind: headerFormat === 'IMAGE' ? 'image' : 'video', link }
  } else if (headerFormat && headerFormat !== 'TEXT') {
    throw new HttpError(409, 'Cabeçalho de documento ainda não é suportado em Transmissões')
  }
  // button_config (legado, 1 botão URL) entra como lista, do mesmo jeito que
  // o template foi criado na Meta (template-definitions.ts).
  const buttons = (Array.isArray(d.buttons) && d.buttons.length ? d.buttons
    : d.button_config?.url_base ? [{ type: 'URL', text: d.button_config.text }] : []) as { type?: string; text?: string }[]

  const bodyVars = [...new Set([...(d.body_text as string).matchAll(/\{\{(\d+)\}\}/g)].map(m => Number(m[1])))].sort((a, b) => a - b)
  if (bodyVars.some((n, i) => n !== i + 1)) throw new HttpError(409, 'Variáveis do corpo do template fora de sequência ({{1}}, {{2}}, …)')

  return {
    def: { ...d, buttons },
    category:     String((st as any).approved_category || d.category).toUpperCase(),
    bodyVars,
    headerHasVar: headerFormat === 'TEXT' && /\{\{1\}\}/.test(header?.text || ''),
    headerMedia,
    urlButtons:   buttons.map((b, i) => ((b.type || '').toUpperCase() === 'URL' ? i : -1)).filter(i => i >= 0),
    quickReplies: buttons.map((b, i) => ((b.type || '').toUpperCase() === 'QUICK_REPLY' ? i : -1)).filter(i => i >= 0),
  }
}

// ── Variáveis ───────────────────────────────────────────────────────────────
// variable_mapping: { "1": {source, value?, key?, fallback?}, "header_1": …, "button_0": … }
//   source: 'contact.name' | 'contact.first_name' | 'fixed' | 'import'
type VarSource = { source: string; value?: string; key?: string; fallback?: string }

function sanitizeParam(v: string): string {
  // Meta recusa parâmetro com quebra de linha/tab ou mais de 4 espaços seguidos.
  return v.replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 1000)
}

function validateMapping(tpl: TemplateCtx, mapping: Record<string, VarSource>, hasImport: boolean): string[] {
  const errors: string[] = []
  const check = (key: string, label: string, onlyFixed = false) => {
    const m = mapping?.[key]
    if (!m?.source) { errors.push(`${label}: defina o valor`); return }
    if (onlyFixed && m.source !== 'fixed') { errors.push(`${label}: só aceita valor fixo`); return }
    if (m.source === 'fixed') {
      if (!sanitizeParam(m.value || '')) errors.push(`${label}: valor fixo vazio`)
    } else if (['contact.name', 'contact.first_name', 'import'].includes(m.source)) {
      if (m.source === 'import' && (!hasImport || !m.key)) errors.push(`${label}: coluna da lista importada não informada`)
      if (!sanitizeParam(m.fallback || '')) errors.push(`${label}: informe um valor padrão pra quem não tiver o dado`)
    } else {
      errors.push(`${label}: origem "${m.source}" inválida`)
    }
  }
  tpl.bodyVars.forEach(n => check(String(n), `Variável {{${n}}}`))
  if (tpl.headerHasVar) check('header_1', 'Variável do cabeçalho')
  tpl.urlButtons.forEach(i => check(`button_${i}`, `Botão de link "${tpl.def.buttons[i]?.text || i + 1}"`, true))
  return errors
}

function resolveVar(m: VarSource, rec: { name: string | null; variables: Record<string, unknown> }): string {
  const name = rec.name && !/^[\d+ ()-]+$/.test(rec.name) ? rec.name.trim() : ''
  let v = ''
  if (m.source === 'fixed') v = m.value || ''
  else if (m.source === 'contact.name') v = name
  else if (m.source === 'contact.first_name') v = name.split(/\s+/)[0] || ''
  else if (m.source === 'import') v = String(rec.variables?.[m.key || ''] ?? '')
  return sanitizeParam(v) || sanitizeParam(m.fallback || '')
}

function buildComponents(tpl: TemplateCtx, mapping: Record<string, VarSource>, rec: { name: string | null; variables: Record<string, unknown> }) {
  const components: any[] = []
  if (tpl.headerHasVar) {
    components.push({ type: 'header', parameters: [{ type: 'text', text: resolveVar(mapping.header_1, rec) }] })
  } else if (tpl.headerMedia) {
    const { kind, link } = tpl.headerMedia
    components.push({ type: 'header', parameters: [{ type: kind, [kind]: { link } }] })
  }
  if (tpl.bodyVars.length) {
    components.push({ type: 'body', parameters: tpl.bodyVars.map(n => ({ type: 'text', text: resolveVar(mapping[String(n)], rec) })) })
  }
  for (const i of tpl.urlButtons) {
    components.push({
      type: 'button', sub_type: 'url', index: String(i),
      // Vai colado no fim da URL do botão — codifica em vez de mutilar
      // (espaço, acento, "&" etc.).
      parameters: [{ type: 'text', text: encodeURIComponent(resolveVar(mapping[`button_${i}`], rec)) }],
    })
  }
  // Botões de resposta rápida: o payload bc:<destinatário>:<índice> é
  // colocado no envio (school-broadcast-send), que conhece o id da linha.
  return components
}

// ── Audiência ───────────────────────────────────────────────────────────────

interface AudienceRow { contact_id: string | null; phone: string; name: string | null; variables: Record<string, unknown>; source: string; excluded_reason: string | null }

interface ManualAdjust { include_contact_ids: string[]; exclude_phone_keys: string[] }

async function resolveAudience(sb: Supa, institutionId: string, filter: unknown, importRows: unknown, category: string, manual: ManualAdjust): Promise<AudienceRow[]> {
  const rows: AudienceRow[] = []
  for (let from = 0; ; from += RPC_PAGE) {
    // order: cada página é uma nova execução da função — sem ordem total as
    // páginas podiam repetir/pular linhas (phone é único depois do dedup).
    const { data, error } = await sb.rpc('broadcast_resolve_audience', {
      p_institution_id: institutionId,
      p_filter:         filter && typeof filter === 'object' ? filter : {},
      p_import:         Array.isArray(importRows) ? importRows : [],
      p_category:       category,
      p_manual:         manual,
    }).order('phone').range(from, from + RPC_PAGE - 1)
    if (error) throw new Error(`audiência: ${error.message}`)
    rows.push(...((data || []) as AudienceRow[]))
    if (!data || data.length < RPC_PAGE) break
  }
  return rows
}

function summarize(rows: AudienceRow[]) {
  const excluded: Record<string, number> = {}
  let eligible = 0
  for (const r of rows) {
    if (r.excluded_reason) excluded[r.excluded_reason] = (excluded[r.excluded_reason] || 0) + 1
    else eligible++
  }
  return { eligible, excluded }
}

function checkManual(raw: unknown): ManualAdjust {
  if (raw == null) return { include_contact_ids: [], exclude_phone_keys: [] }
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'manual deve ser um objeto')
  const m = raw as Record<string, unknown>
  const inc = m.include_contact_ids ?? []
  const exc = m.exclude_phone_keys ?? []
  if (!Array.isArray(inc) || !Array.isArray(exc)) throw new HttpError(400, 'manual: listas inválidas')
  if (inc.length > MAX_MANUAL || exc.length > MAX_MANUAL) throw new HttpError(400, `Ajustes manuais acima de ${MAX_MANUAL}`)
  if (inc.some(x => typeof x !== 'string' || !UUID_RE.test(x))) throw new HttpError(400, 'manual: contato inválido')
  if (exc.some(x => typeof x !== 'string' || !/^[0-9]{8,15}$/.test(x))) throw new HttpError(400, 'manual: telefone inválido')
  return { include_contact_ids: [...new Set(inc as string[])], exclude_phone_keys: [...new Set(exc as string[])] }
}

function checkImport(importRows: unknown) {
  if (importRows == null) return []
  if (!Array.isArray(importRows)) throw new HttpError(400, 'import_rows deve ser uma lista')
  if (importRows.length > MAX_IMPORT_ROWS) throw new HttpError(400, `Lista importada acima de ${MAX_IMPORT_ROWS} linhas`)
  return importRows
}

// ── Estimativa (só leitura) — mesma regra de broadcast_price_campaign ──────

async function estimate(sb: Supa, institutionId: string, category: string, n: number) {
  const [{ data: priceRows }, { data: settings }, { data: balance }, { data: minRow }] = await Promise.all([
    sb.rpc('broadcast_price_at', { p_category: category, p_country_code: 'BR' }),
    sb.from('broadcast_settings').select('meta_own_account').eq('institution_id', institutionId).maybeSingle(),
    sb.rpc('broadcast_credit_balance', { p_institution_id: institutionId }),
    sb.from('platform_settings').select('value').eq('key', 'asaas_min_charge_brl').maybeSingle(),
  ])
  const price = (priceRows as any[] | null)?.[0]
  if (!price) return { available: false, reason: 'Tabela de preço sem valor vigente para ' + category }

  const own   = !!(settings as any)?.meta_own_account
  const unit  = Number(price.aion_unit_fee_brl) + (own ? 0 : Number(price.meta_unit_cost_brl))
  const sub   = Math.round(unit * n * 100) / 100
  const bal   = Number(balance || 0)
  const rawMin = String((minRow as any)?.value ?? '').trim().replace(',', '.')
  const min   = /^[0-9]+(\.[0-9]{1,2})?$/.test(rawMin) && Number(rawMin) > 0 ? Number(rawMin) : null

  let credit = 0, total = 0
  if (sub <= 0) { credit = 0; total = 0 }
  else if (bal >= sub) { credit = sub; total = 0 }
  else if (min === null) return { available: false, reason: 'Cobrança de campanha indisponível: valor mínimo do Asaas ainda não configurado pela Áion', unit_brl: unit, subtotal_brl: sub, credit_balance_brl: bal }
  else if (sub - bal >= min) { credit = bal; total = sub - bal }
  else if (sub >= min) { credit = Math.round((sub - min) * 100) / 100; total = min }
  else { credit = 0; total = min }

  return {
    available: true, category, own_account: own, price_version: price.version_number,
    unit_brl: unit, subtotal_brl: sub, credit_balance_brl: bal,
    credit_applied_brl: Math.round(credit * 100) / 100, total_brl: Math.round(total * 100) / 100,
    // Cobra mais que o devido (subtotal − crédito) só quando o mínimo do Asaas entra.
    minimum_applied: Math.round(total * 100) > Math.round((sub - credit) * 100),
  }
}

// ── Ações ───────────────────────────────────────────────────────────────────

async function actionPreview(sb: Supa, userId: string, body: any) {
  await requireManage(sb, userId, body.institution_id)
  await requireModule(sb, body.institution_id)
  const tpl = await loadTemplate(sb, body.institution_id, body.template_definition_id)
  const importRows = checkImport(body.import_rows)
  const manual = checkManual(body.manual)

  const rows = await resolveAudience(sb, body.institution_id, body.filter, importRows, tpl.category, manual)
  const { eligible, excluded } = summarize(rows)
  const mapping = (body.variable_mapping || {}) as Record<string, VarSource>
  const mappingErrors = body.variable_mapping ? validateMapping(tpl, mapping, importRows.length > 0) : []

  const sample = rows.filter(r => !r.excluded_reason).slice(0, 5).map(r => ({
    name: r.name, phone: r.phone, source: r.source,
    ...(mappingErrors.length || !body.variable_mapping ? {} : {
      preview: tpl.def.body_text.replace(/\{\{(\d+)\}\}/g, (_m, n) => resolveVar(mapping[n], r)),
    }),
  }))

  return {
    template: { name: tpl.def.name, category: tpl.category, body_vars: tpl.bodyVars, header_var: tpl.headerHasVar, header_media: tpl.headerMedia,
                url_buttons: tpl.urlButtons, quick_replies: tpl.quickReplies.map(i => ({ index: i, text: tpl.def.buttons[i]?.text })) },
    audience: { candidates: rows.length, eligible, excluded, over_limit: eligible > MAX_RECIPIENTS, max: MAX_RECIPIENTS },
    mapping_errors: mappingErrors,
    sample,
    estimate: eligible > 0 ? await estimate(sb, body.institution_id, tpl.category, Math.min(eligible, MAX_RECIPIENTS)) : null,
  }
}

async function actionAudiencePage(sb: Supa, userId: string, body: any) {
  await requireManage(sb, userId, body.institution_id)
  await requireModule(sb, body.institution_id)
  const tpl = await loadTemplate(sb, body.institution_id, body.template_definition_id)
  const importRows = checkImport(body.import_rows)
  const manual = checkManual(body.manual)
  const q = String(body.q ?? '').trim().slice(0, 100)
  const page = Math.max(0, Math.min(Number.isInteger(body.page) ? body.page : 0, 10_000))

  const { data, error } = await sb.rpc('broadcast_audience_page', {
    p_institution_id: body.institution_id,
    p_filter:         body.filter && typeof body.filter === 'object' ? body.filter : {},
    p_import:         importRows,
    p_category:       tpl.category,
    p_manual:         manual,
    p_q:              q,
    p_limit:          PAGE_SIZE,
    p_offset:         page * PAGE_SIZE,
  })
  if (error) throw new Error(`audiência: ${error.message}`)
  const eligible = Number((data as any)?.counts?.eligible) || 0
  return {
    ...(data as Record<string, unknown>),
    page, page_size: PAGE_SIZE,
    over_limit: eligible > MAX_RECIPIENTS, max: MAX_RECIPIENTS,
    estimate: eligible > 0 ? await estimate(sb, body.institution_id, tpl.category, Math.min(eligible, MAX_RECIPIENTS)) : null,
  }
}

async function actionCreate(sb: Supa, userId: string, body: any) {
  const institutionId = body.institution_id
  await requireManage(sb, userId, institutionId)
  const settings = await requireModule(sb, institutionId)
  const tpl = await loadTemplate(sb, institutionId, body.template_definition_id)
  const importRows = checkImport(body.import_rows)
  const manual = checkManual(body.manual)

  const name = String(body.name || '').trim()
  if (!name || name.length > 120) throw new HttpError(400, 'Nome da campanha obrigatório (até 120 caracteres)')

  const mapping = (body.variable_mapping || {}) as Record<string, VarSource>
  const mappingErrors = validateMapping(tpl, mapping, importRows.length > 0)
  if (mappingErrors.length) throw new HttpError(400, 'Variáveis do template incompletas', mappingErrors)

  if (importRows.length > 0 && body.opt_in_confirmed !== true) {
    throw new HttpError(400, 'Confirme que os contatos da lista importada autorizaram receber mensagens da escola')
  }

  const sendMode = body.send_mode === 'scheduled' ? 'scheduled' : 'now'
  let scheduledAt: string | null = null
  if (sendMode === 'scheduled') {
    const t = Date.parse(body.scheduled_at)
    if (!Number.isFinite(t)) throw new HttpError(400, 'Data de agendamento inválida')
    if (t < Date.now() + MIN_SCHEDULE_MIN * 60_000) throw new HttpError(400, `Agende com pelo menos ${MIN_SCHEDULE_MIN} minutos de antecedência`)
    if (t > Date.now() + MAX_SCHEDULE_DAYS * 86_400_000) throw new HttpError(400, `Agendamento até ${MAX_SCHEDULE_DAYS} dias`)
    scheduledAt = new Date(t).toISOString()
  }

  const actions = await validateReplyActions(sb, institutionId, tpl, body.reply_actions)

  const rows = (await resolveAudience(sb, institutionId, body.filter, importRows, tpl.category, manual)).filter(r => !r.excluded_reason)
  if (!rows.length) throw new HttpError(400, 'Nenhum destinatário elegível com essa seleção')
  if (rows.length > MAX_RECIPIENTS) throw new HttpError(400, `Audiência acima do limite de ${MAX_RECIPIENTS} destinatários — refine os filtros`)

  const now = new Date().toISOString()
  const { data: campaign, error: campErr } = await sb.from('broadcast_campaigns').insert({
    institution_id:             institutionId,
    name,
    template_definition_id:     tpl.def.id,
    template_name:              tpl.def.name,
    template_language:          tpl.def.language || 'pt_BR',
    variable_mapping:           mapping,
    audience_filter:            { ...(body.filter && typeof body.filter === 'object' ? body.filter : {}), imported_rows: importRows.length },
    audience_manual:            manual,
    has_imported_list:          importRows.length > 0,
    import_opt_in_confirmed_by: importRows.length > 0 ? userId : null,
    import_opt_in_confirmed_at: importRows.length > 0 ? now : null,
    status:                     'draft',
    send_mode:                  sendMode,
    scheduled_at:               scheduledAt,
    reply_window_hours:         settings.reply_window_hours || 72,
    created_by:                 userId,
  }).select('id').single()
  if (campErr || !campaign) throw new Error(`campanha: ${campErr?.message}`)
  const campaignId = (campaign as any).id as string

  try {
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const batch = rows.slice(i, i + INSERT_BATCH).map(r => ({
        campaign_id:         campaignId,
        institution_id:      institutionId,
        contact_id:          r.contact_id,
        phone:               r.phone,
        source:              r.source === 'import' || r.source === 'manual' ? r.source : 'filter',
        variables:           r.variables || {},
        template_components: buildComponents(tpl, mapping, r),
      }))
      const { error } = await sb.from('broadcast_recipients').insert(batch)
      if (error) throw new Error(`destinatários: ${error.message}`)
    }

    for (const a of actions) {
      const { data: act, error: actErr } = await sb.from('broadcast_reply_actions').insert({
        campaign_id: campaignId, institution_id: institutionId,
        match_kind: a.match_kind, button_index: a.button_index, button_text: a.button_text,
        tag_name: a.tag_name, skip_bot: a.skip_bot,
      }).select('id').single()
      if (actErr || !act) throw new Error(`ações: ${actErr?.message}`)
      if (a.assignees.length) {
        const { error: asgErr } = await sb.from('broadcast_reply_action_assignees').insert(
          a.assignees.map(x => ({ institution_id: institutionId, action_id: (act as any).id, user_id: x.user_id, group_id: x.group_id })))
        if (asgErr) throw new Error(`atendentes: ${asgErr.message}`)
      }
    }
  } catch (e) {
    // Rascunho pela metade não fica: apaga (destinatários/ações vão em cascata).
    await sb.from('broadcast_campaigns').delete().eq('id', campaignId)
    throw e
  }

  await sb.rpc('broadcast_recount', { p_campaign_id: campaignId })
  console.log('[broadcast-campaigns] criada', campaignId, '| destinatários:', rows.length, '| escola:', institutionId)
  return { campaign_id: campaignId, recipients: rows.length, status: 'draft' }
}

interface ValidAction { match_kind: 'any_reply' | 'button'; button_index: number | null; button_text: string | null; tag_name: string | null; skip_bot: boolean; assignees: { user_id: string | null; group_id: string | null }[] }

async function validateReplyActions(sb: Supa, institutionId: string, tpl: TemplateCtx, raw: unknown): Promise<ValidAction[]> {
  if (raw == null) return []
  if (!Array.isArray(raw)) throw new HttpError(400, 'reply_actions deve ser uma lista')
  const out: ValidAction[] = []
  const seen = new Set<string>()
  const userIds = new Set<string>(), groupIds = new Set<string>()

  for (const a of raw as any[]) {
    const kind = a?.match_kind === 'button' ? 'button' : a?.match_kind === 'any_reply' ? 'any_reply' : null
    if (!kind) throw new HttpError(400, 'Ação com match_kind inválido')
    const idx = kind === 'button' ? Number(a.button_index) : null
    if (kind === 'button' && !tpl.quickReplies.includes(idx as number)) throw new HttpError(400, `Botão ${idx} não é um botão de resposta rápida deste template`)
    const slot = `${kind}:${idx ?? '-'}`
    if (seen.has(slot)) throw new HttpError(400, 'Ação repetida pro mesmo botão')
    seen.add(slot)

    const tag = typeof a.tag_name === 'string' && a.tag_name.trim() ? a.tag_name.trim().slice(0, 50) : null
    const assignees = (Array.isArray(a.assignees) ? a.assignees : []).map((x: any) => ({
      user_id:  typeof x?.user_id === 'string' && UUID_RE.test(x.user_id) ? x.user_id : null,
      group_id: typeof x?.group_id === 'string' && UUID_RE.test(x.group_id) ? x.group_id : null,
    })).filter((x: any) => (x.user_id === null) !== (x.group_id === null))
    if (assignees.length && a.skip_bot !== true) throw new HttpError(400, 'Atendentes/grupos só valem com "pular robô" ligado')
    assignees.forEach((x: any) => { if (x.user_id) userIds.add(x.user_id); if (x.group_id) groupIds.add(x.group_id) })

    out.push({ match_kind: kind, button_index: idx, button_text: kind === 'button' ? (tpl.def.buttons[idx as number]?.text || null) : null,
               tag_name: tag, skip_bot: a.skip_bot === true, assignees })
  }

  // Atendentes e grupos precisam ser DESTA escola.
  if (userIds.size) {
    const { data } = await sb.from('user_institutions').select('user_id')
      .eq('institution_id', institutionId).eq('active', true).in('user_id', [...userIds])
    const ok = new Set((data || []).map((r: any) => r.user_id))
    const { data: direct } = await sb.from('users').select('id')
      .in('id', [...userIds]).or(`institution_id.eq.${institutionId},active_institution_id.eq.${institutionId}`)
    ;(direct || []).forEach((r: any) => ok.add(r.id))
    if ([...userIds].some(u => !ok.has(u))) throw new HttpError(400, 'Atendente que não é desta escola')
  }
  if (groupIds.size) {
    const { data } = await sb.from('whatsapp_groups').select('id').eq('institution_id', institutionId).in('id', [...groupIds])
    if ((data || []).length !== groupIds.size) throw new HttpError(400, 'Grupo que não é desta escola')
  }
  return out
}

async function loadCampaignForManage(sb: Supa, userId: string, campaignId: string) {
  if (typeof campaignId !== 'string' || !UUID_RE.test(campaignId)) throw new HttpError(400, 'campaign_id inválido')
  const { data: c } = await sb.from('broadcast_campaigns').select('id, institution_id, status, paused_reason').eq('id', campaignId).maybeSingle()
  if (!c) throw new HttpError(404, 'Campanha não encontrada')
  await requireManage(sb, userId, (c as any).institution_id)
  return c as { id: string; institution_id: string; status: string; paused_reason: string | null }
}

async function actionPrice(sb: Supa, userId: string, body: any) {
  const c = await loadCampaignForManage(sb, userId, body.campaign_id)
  const { data, error } = await sb.rpc('broadcast_price_campaign', { p_campaign_id: c.id })
  if (error) throw new HttpError(409, error.message)
  return data
}

async function actionPause(sb: Supa, userId: string, body: any) {
  const c = await loadCampaignForManage(sb, userId, body.campaign_id)
  const { data } = await sb.from('broadcast_campaigns')
    .update({ status: 'paused', paused_reason: 'manual' })
    .eq('id', c.id).in('status', ['scheduled', 'sending']).select('status')
  if (!data?.length) throw new HttpError(409, `Campanha não pode ser pausada no status "${c.status}"`)
  return { status: 'paused' }
}

async function actionResume(sb: Supa, userId: string, body: any) {
  const c = await loadCampaignForManage(sb, userId, body.campaign_id)
  // Volta pra reavaliação: broadcast_try_release confere de novo template,
  // pagamento (estornado → pausa de novo) e agendamento.
  const { data } = await sb.from('broadcast_campaigns')
    .update({ status: 'pending_template', paused_reason: null })
    .eq('id', c.id).eq('status', 'paused').select('status')
  if (!data?.length) throw new HttpError(409, `Campanha não está pausada (status "${c.status}")`)
  const { data: newStatus, error } = await sb.rpc('broadcast_try_release', { p_campaign_id: c.id })
  if (error) throw new Error(`retomar: ${error.message}`)
  return { status: newStatus }
}

async function actionCancel(sb: Supa, userId: string, body: any) {
  const c = await loadCampaignForManage(sb, userId, body.campaign_id)
  const { data, error } = await sb.rpc('broadcast_cancel_campaign', { p_campaign_id: c.id })
  if (error) throw new HttpError(409, error.message)
  const result = data as any

  // Cobrança em aberto no Asaas: cancela lá também (o webhook PAYMENT_DELETED
  // chega depois e só confirma). Falha no Asaas não desfaz o cancelamento —
  // fica registrada pra o Super Admin resolver.
  if (result?.asaas_payment_to_cancel) {
    try {
      await cancelAsaasCharge(sb, result.asaas_payment_to_cancel)
      await sb.from('payments').update({ status: 'cancelled' }).eq('id', result.payment_id)
      result.asaas_cancelled = true
    } catch (e) {
      console.error('[broadcast-campaigns] erro ao cancelar cobrança no Asaas:', e instanceof Error ? e.message : String(e))
      result.asaas_cancelled = false
    }
  }
  return { status: 'cancelled', ...result }
}

async function cancelAsaasCharge(sb: Supa, asaasPaymentId: string) {
  const { data: cfgRows } = await sb.from('platform_settings').select('key, value').in('key', ['asaas_api_key', 'asaas_environment'])
  const cfg: Record<string, string> = {}
  ;(cfgRows || []).forEach((r: any) => { cfg[r.key] = r.value })
  const apiKey = cfg.asaas_api_key || Deno.env.get('ASAAS_API_KEY') || ''
  if (!apiKey) throw new Error('Chave Asaas não configurada')
  const url = (cfg.asaas_environment || 'production') === 'sandbox' ? 'https://sandbox.asaas.com/api/v3' : 'https://www.asaas.com/api/v3'
  const res = await fetch(`${url}/payments/${encodeURIComponent(asaasPaymentId)}`, { method: 'DELETE', headers: { access_token: apiKey } })
  if (!res.ok) {
    const d = await res.json().catch(() => null)
    throw new Error(d?.errors?.[0]?.description || `Asaas HTTP ${res.status}`)
  }
}
