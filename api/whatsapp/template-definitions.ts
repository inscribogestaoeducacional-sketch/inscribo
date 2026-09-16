import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getSupabaseAdmin,
  errorResponse,
  authenticateSuperAdmin,
  GRAPH_URL,
} from '../_lib/whatsappAuth.js'

// ── Templates Automáticos (Super Admin) ─────────────────────────────────────
// Endpoint único (economiza função serverless — ver comentário sobre limite
// de funções em api/_lib/whatsappAuth.ts) que cadastra/reenvia templates de
// WhatsApp pra Meta em massa, em nome de todas (ou algumas) instituições.
//
// Roda no servidor (nunca no navegador) de propósito: o token usado
// (platform_settings.wa_access_token) é o MESMO token global já usado hoje
// por api/whatsapp/send-template.ts, api/whatsapp/webhook.ts e pelas telas
// AdminSchools.tsx/InstitutionDetails.tsx pra criar/listar template em UM
// WABA de cada vez — na prática é um token de System User da Business
// Manager da Áion, com permissão sobre o WABA padrão da Áion (platform_
// settings.wa_waba_id) e sobre qualquer WABA de terceiro (de uma escola)
// que tenha passado pelo fluxo de compartilhamento/Embedded Signup — nunca
// o `whatsapp_phone_numbers.access_token` individual (gravado por
// embedded-signup.ts mas não lido em NENHUM outro ponto do projeto hoje).
// Ver resumo da investigação na resposta que acompanha esta implementação.
//
// Body:
//   { action: 'submit', template_definition_ids?: string[], institution_ids?: string[] }
//     — submete os templates indicados (ou TODOS, se omitido) pras
//       instituições indicadas (ou TODAS as elegíveis, se omitido).
//   { action: 'check-status', institution_ids?: string[] }
//     — reconsulta a Meta e atualiza o status de todas as combinações já
//       existentes em template_institution_status pras instituições
//       indicadas (ou TODAS, se omitido).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

  const auth = await authenticateSuperAdmin(req)
  if (!auth) return errorResponse(res, 403, 'Apenas Super Admin pode gerenciar templates automáticos')

  const { action } = req.body || {}
  const supabase = getSupabaseAdmin()

  try {
    if (action === 'submit') return await handleSubmit(req, res, supabase)
    if (action === 'check-status') return await handleCheckStatus(req, res, supabase)
    return errorResponse(res, 400, 'action deve ser "submit" ou "check-status"')
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[template-definitions] erro:', message)
    return errorResponse(res, 500, message)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any

interface TemplateDefinition {
  id: string
  name: string
  category: string
  language: string
  body_text: string
  variable_examples: Record<string, string> | null
  button_config: { type?: string; text?: string; url_base?: string } | null
}

interface EligibleInstitution {
  institution_id: string
  institution_name: string
  waba_id: string
}

// ── Só instituições com WABA de fato configurado — institutions.
// whatsapp_business_id/whatsapp_token (colunas de 20260322000000_whatsapp_
// meta_api.sql) NUNCA são lidas por nenhum código do projeto hoje (confirmado
// via busca em todo o repo); a fonte de verdade real é whatsapp_phone_numbers.
// waba_id, é o que toda tela de template existente (AdminSchools.tsx,
// InstitutionDetails.tsx) já usa. ──
async function getEligibleInstitutions(supabase: Supa, institutionIds?: string[]): Promise<EligibleInstitution[]> {
  let query = supabase
    .from('whatsapp_phone_numbers')
    .select('institution_id, waba_id, is_active, institutions(id, name)')
    .eq('is_active', true)
    .not('waba_id', 'is', null)

  if (institutionIds?.length) query = query.in('institution_id', institutionIds)

  const { data, error } = await query
  if (error) throw new Error(`Erro ao buscar instituições elegíveis: ${error.message}`)

  return (data || [])
    .filter((r: any) => r.waba_id)
    .map((r: any) => ({
      institution_id:   r.institution_id,
      institution_name: r.institutions?.name || r.institution_id,
      waba_id:          r.waba_id as string,
    }))
}

async function getGlobalToken(supabase: Supa): Promise<string> {
  const { data } = await supabase
    .from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
  const token = data?.value || process.env.WA_ACCESS_TOKEN || ''
  if (!token) throw new Error('Token de acesso da Meta não configurado (platform_settings.wa_access_token)')
  return token
}

function slugifyTemplateName(raw: string): string {
  return raw
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 512)
}

function mapMetaStatus(raw?: string): 'pending' | 'approved' | 'rejected' {
  const s = (raw || '').toUpperCase()
  if (s === 'APPROVED') return 'approved'
  if (s === 'REJECTED' || s === 'DISABLED') return 'rejected'
  return 'pending' // PENDING, IN_APPEAL, PAUSED etc. — tratado como "em análise"
}

// ── Monta o payload de CRIAÇÃO (POST .../message_templates) — formato de
// DEFINIÇÃO, diferente do formato de ENVIO usado em buildSendComponents()
// (src/lib/whatsappTemplate.ts). Botão de URL dinâmica: mesmo padrão já
// usado nos templates de cobrança (collectionTemplates.ts,
// COLLECTION_PAY_BASE_URL) — só 1 variável dinâmica no fim da URL, que é o
// máximo que a Meta permite num botão URL. ──
function buildCreateTemplatePayload(def: TemplateDefinition) {
  const bodyVarNumbers = [...def.body_text.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1])
  const examples = def.variable_examples || {}

  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: def.body_text }
  if (bodyVarNumbers.length > 0) {
    bodyComponent.example = {
      body_text: [bodyVarNumbers.map(n => examples[n] || 'exemplo')],
    }
  }

  const components: Record<string, unknown>[] = [bodyComponent]

  if (def.button_config?.url_base) {
    components.push({
      type: 'BUTTONS',
      buttons: [{
        type:    'URL',
        text:    def.button_config.text || 'Acessar',
        url:     `${def.button_config.url_base}{{1}}`,
        example: [examples.button || 'exemplo'],
      }],
    })
  }

  return {
    name:     def.name,
    language: def.language || 'pt_BR',
    category: def.category,
    components,
  }
}

interface SubmitResult {
  institution_id: string
  institution_name: string
  template_definition_id: string
  template_name: string
  status: 'pending' | 'approved' | 'rejected'
  meta_template_id: string | null
  error_message: string | null
}

// ── Submete UM template a UM WABA — checa antes se já existe (mesmo idioma
// já usado em AdminSchools.tsx/createDefaultTemplates: GET ?name=X antes de
// POST), pra nunca tentar recriar o mesmo nome duas vezes no mesmo WABA.
// Isso importa porque VÁRIAS escolas podem compartilhar o WABA padrão da
// Áion (platform_settings.wa_waba_id) — submeter uma vez por escola sem essa
// checagem geraria N-1 erros de "template já existe" pra cada WABA
// compartilhado por N escolas. ──
async function submitToWaba(
  def: TemplateDefinition, wabaId: string, token: string
): Promise<{ status: 'pending' | 'approved' | 'rejected'; metaTemplateId: string | null; errorMessage: string | null }> {
  try {
    const checkRes = await fetch(
      `${GRAPH_URL}/${wabaId}/message_templates?name=${encodeURIComponent(def.name)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const checkData = await checkRes.json().catch(() => null)
    const existing = checkData?.data?.[0]
    if (existing) {
      return { status: mapMetaStatus(existing.status), metaTemplateId: existing.id || null, errorMessage: null }
    }

    const createRes = await fetch(`${GRAPH_URL}/${wabaId}/message_templates`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildCreateTemplatePayload(def)),
    })
    const createData = await createRes.json().catch(() => null)

    if (!createRes.ok) {
      return { status: 'rejected', metaTemplateId: null, errorMessage: createData?.error?.message || 'Erro ao criar template na Meta' }
    }

    return { status: 'pending', metaTemplateId: createData?.id || null, errorMessage: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { status: 'rejected', metaTemplateId: null, errorMessage: message }
  }
}

async function handleSubmit(req: VercelRequest, res: VercelResponse, supabase: Supa) {
  const { template_definition_ids, institution_ids } = req.body || {}

  let defsQuery = supabase.from('template_definitions').select('*')
  if (Array.isArray(template_definition_ids) && template_definition_ids.length) {
    defsQuery = defsQuery.in('id', template_definition_ids)
  }
  const { data: defs, error: defsErr } = await defsQuery
  if (defsErr) return errorResponse(res, 500, `Erro ao buscar templates: ${defsErr.message}`)
  if (!defs?.length) return res.status(200).json({ results: [] })

  const institutions = await getEligibleInstitutions(
    supabase, Array.isArray(institution_ids) && institution_ids.length ? institution_ids : undefined
  )
  if (!institutions.length) return res.status(200).json({ results: [] })

  const token = await getGlobalToken(supabase)

  // Agrupa instituições por WABA — ver comentário de submitToWaba() sobre
  // por que isso evita chamadas redundantes/erros de "já existe".
  const byWaba = new Map<string, EligibleInstitution[]>()
  for (const inst of institutions) {
    if (!byWaba.has(inst.waba_id)) byWaba.set(inst.waba_id, [])
    byWaba.get(inst.waba_id)!.push(inst)
  }

  const results: SubmitResult[] = []
  const now = new Date().toISOString()

  for (const def of defs as TemplateDefinition[]) {
    for (const [wabaId, insts] of byWaba) {
      const outcome = await submitToWaba(def, wabaId, token)

      const rows = insts.map(inst => ({
        template_definition_id: def.id,
        institution_id:          inst.institution_id,
        status:                  outcome.status,
        meta_template_id:        outcome.metaTemplateId,
        last_synced_at:          now,
        error_message:           outcome.errorMessage,
      }))
      const { error: upsertErr } = await supabase
        .from('template_institution_status')
        .upsert(rows, { onConflict: 'template_definition_id,institution_id' })
      if (upsertErr) console.error('[template-definitions] erro ao gravar status:', upsertErr.message)

      for (const inst of insts) {
        results.push({
          institution_id:          inst.institution_id,
          institution_name:        inst.institution_name,
          template_definition_id: def.id,
          template_name:           def.name,
          status:                  outcome.status,
          meta_template_id:        outcome.metaTemplateId,
          error_message:           outcome.errorMessage,
        })
      }
    }
  }

  return res.status(200).json({ results })
}

async function handleCheckStatus(req: VercelRequest, res: VercelResponse, supabase: Supa) {
  const { institution_ids } = req.body || {}

  const institutions = await getEligibleInstitutions(
    supabase, Array.isArray(institution_ids) && institution_ids.length ? institution_ids : undefined
  )
  if (!institutions.length) return res.status(200).json({ updated: 0 })

  const token = await getGlobalToken(supabase)
  const institutionIds = institutions.map(i => i.institution_id)

  const { data: rows, error: rowsErr } = await supabase
    .from('template_institution_status')
    .select('id, institution_id, template_definition_id, template_definitions(name)')
    .in('institution_id', institutionIds)
  if (rowsErr) return errorResponse(res, 500, `Erro ao buscar status atuais: ${rowsErr.message}`)
  if (!rows?.length) return res.status(200).json({ updated: 0 })

  const byWaba = new Map<string, EligibleInstitution[]>()
  for (const inst of institutions) {
    if (!byWaba.has(inst.waba_id)) byWaba.set(inst.waba_id, [])
    byWaba.get(inst.waba_id)!.push(inst)
  }

  const now = new Date().toISOString()
  let updated = 0

  for (const [wabaId, insts] of byWaba) {
    const listRes = await fetch(
      `${GRAPH_URL}/${wabaId}/message_templates?fields=name,status,id&limit=250`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const listData = await listRes.json().catch(() => null)
    if (!listRes.ok) {
      console.error('[template-definitions] erro ao listar templates do WABA', wabaId, listData?.error?.message)
      continue
    }
    const byName = new Map<string, { status: string; id: string }>()
    for (const t of listData?.data || []) byName.set(t.name, { status: t.status, id: t.id })

    const instIdSet = new Set(insts.map(i => i.institution_id))
    const relevantRows = rows.filter((r: any) => instIdSet.has(r.institution_id))

    for (const row of relevantRows) {
      const name = (row as any).template_definitions?.name
      const found = name ? byName.get(name) : undefined
      const update = found
        ? { status: mapMetaStatus(found.status), meta_template_id: found.id, last_synced_at: now, error_message: null }
        : { status: 'not_submitted' as const, meta_template_id: null, last_synced_at: now, error_message: null }

      const { error: updErr } = await supabase
        .from('template_institution_status').update(update).eq('id', row.id)
      if (!updErr) updated++
    }
  }

  return res.status(200).json({ updated })
}
