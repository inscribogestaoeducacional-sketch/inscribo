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
//   { action: 'register_existing', template_definition_id: string, institution_ids?: string[] }
//     — pra template que já existe/está aprovado na Meta de ANTES dessa
//       ferramenta, criado na mão no WhatsApp Manager (ex reais confirmados em
//       produção: iniciar_contato, reativar_atendimento — 4 escolas cada,
//       com corpo divergindo levemente numa delas). Institution por
//       instituição: se whatsapp_templates (cache já sincronizado por
//       InstitutionDetails.tsx) mostra esse nome+idioma+CORPO EXATO como
//       'approved' pra ela, só grava template_institution_status direto,
//       SEM chamar a Meta de novo; senão, cai no fluxo normal de submissão
//       (submitDefinitionToInstitutions) só pra essa instituição.
//   { action: 'list_all_templates' }
//     — lista TODOS os grupos (nome, idioma) aprovados em whatsapp_templates
//       de qualquer escola, cadastrados em template_definitions ou não, com
//       as variantes de corpo detectadas dentro de cada grupo (uma escola
//       com WABA própria pode ter editado o corpo manualmente — nome+idioma
//       sozinhos não garantem texto igual). Base da aba "Todos os
//       Templates" — visão permanente, substitui o antigo modal de
//       importação única.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

  const auth = await authenticateSuperAdmin(req)
  if (!auth) return errorResponse(res, 403, 'Apenas Super Admin pode gerenciar templates automáticos')

  const { action } = req.body || {}
  const supabase = getSupabaseAdmin()

  try {
    if (action === 'submit') return await handleSubmit(req, res, supabase)
    if (action === 'check-status') return await handleCheckStatus(req, res, supabase)
    if (action === 'register_existing') return await handleRegisterExisting(req, res, supabase)
    if (action === 'list_all_templates') return await handleListAllTemplates(req, res, supabase)
    return errorResponse(res, 400, 'action deve ser "submit", "check-status", "register_existing" ou "list_all_templates"')
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

// ── Extrai o texto do componente BODY de uma lista de components no formato
// Graph API (mesmo shape gravado em whatsapp_templates.components — cache
// por escola, sincronizado direto da resposta da Meta por InstitutionDetails.tsx). ──
function extractBodyText(components: unknown): string {
  if (!Array.isArray(components)) return ''
  const body = components.find((c: any) => (c?.type || '').toUpperCase() === 'BODY')
  return body?.text || ''
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

// ── Submete UM def a um conjunto de instituições já elegíveis, agrupando por
// WABA (ver comentário de submitToWaba() sobre por que isso evita chamadas
// redundantes/erros de "já existe") — usado tanto por handleSubmit() (todas
// as instituições elegíveis) quanto por handleRegisterExisting() (só o
// subconjunto que ainda não tinha o template aprovado no cache da escola). ──
async function submitDefinitionToInstitutions(
  supabase: Supa, def: TemplateDefinition, institutions: EligibleInstitution[], token: string
): Promise<SubmitResult[]> {
  const byWaba = new Map<string, EligibleInstitution[]>()
  for (const inst of institutions) {
    if (!byWaba.has(inst.waba_id)) byWaba.set(inst.waba_id, [])
    byWaba.get(inst.waba_id)!.push(inst)
  }

  const results: SubmitResult[] = []
  const now = new Date().toISOString()

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

  return results
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

  const results: SubmitResult[] = []
  for (const def of defs as TemplateDefinition[]) {
    results.push(...await submitDefinitionToInstitutions(supabase, def, institutions, token))
  }

  return res.status(200).json({ results })
}

// ── Registra um template que já existia/estava aprovado na Meta ANTES dessa
// ferramenta (ex: confirmacao_visita, lembrete_visita — criados na mão no
// WhatsApp Manager). Por instituição elegível:
//   - se whatsapp_templates (cache por escola, sincronizado da Meta por
//     InstitutionDetails.tsx → loadWaTemplates) já mostra esse nome+idioma+
//     CORPO EXATO como 'approved', grava template_institution_status direto
//     como 'approved' — NUNCA chama a Meta de novo pra essas.
//   - senão, cai no fluxo normal de submissão (submitDefinitionToInstitutions),
//     só pra esse subconjunto.
// Comparação "é o mesmo template" = name + language + corpo exato: nome+
// idioma sozinhos são a chave de unicidade da Meta DENTRO de um WABA, mas
// escolas com WABA própria podem ter templates de mesmo nome com corpo
// editado manualmente — só nome+idioma bateria errado nesse caso. Exigir o
// corpo idêntico evita registrar como "aprovado" uma instituição cujo
// template de verdade é outro texto (decisão confirmada com o usuário).
async function handleRegisterExisting(req: VercelRequest, res: VercelResponse, supabase: Supa) {
  const { template_definition_id, institution_ids } = req.body || {}
  if (!template_definition_id) return errorResponse(res, 400, 'template_definition_id é obrigatório')

  const { data: def, error: defErr } = await supabase
    .from('template_definitions')
    .select('*')
    .eq('id', template_definition_id)
    .single()
  if (defErr || !def) return errorResponse(res, 404, 'Template não encontrado')

  const institutions = await getEligibleInstitutions(
    supabase, Array.isArray(institution_ids) && institution_ids.length ? institution_ids : undefined
  )
  if (!institutions.length) return res.status(200).json({ results: [] })

  const instIds = institutions.map(i => i.institution_id)
  const { data: existingRows, error: existingErr } = await supabase
    .from('whatsapp_templates')
    .select('institution_id, template_id, components')
    .in('institution_id', instIds)
    .eq('name', (def as TemplateDefinition).name)
    .eq('language', (def as TemplateDefinition).language || 'pt_BR')
    .eq('status', 'approved')
  if (existingErr) return errorResponse(res, 500, `Erro ao consultar templates já aprovados: ${existingErr.message}`)

  const approvedTemplateIdByInst = new Map<string, string | null>()
  for (const row of (existingRows || []) as { institution_id: string; template_id: string | null; components: unknown }[]) {
    if (extractBodyText(row.components) === (def as TemplateDefinition).body_text) {
      approvedTemplateIdByInst.set(row.institution_id, row.template_id)
    }
  }

  const alreadyApprovedInsts = institutions.filter(i => approvedTemplateIdByInst.has(i.institution_id))
  const needSubmitInsts     = institutions.filter(i => !approvedTemplateIdByInst.has(i.institution_id))

  const results: SubmitResult[] = []
  const now = new Date().toISOString()

  if (alreadyApprovedInsts.length > 0) {
    const rows = alreadyApprovedInsts.map(inst => ({
      template_definition_id: (def as TemplateDefinition).id,
      institution_id:          inst.institution_id,
      status:                  'approved' as const,
      meta_template_id:        approvedTemplateIdByInst.get(inst.institution_id) || null,
      last_synced_at:          now,
      error_message:           null,
    }))
    const { error: upsertErr } = await supabase
      .from('template_institution_status')
      .upsert(rows, { onConflict: 'template_definition_id,institution_id' })
    if (upsertErr) console.error('[template-definitions] erro ao registrar já-aprovados:', upsertErr.message)

    for (const inst of alreadyApprovedInsts) {
      results.push({
        institution_id:          inst.institution_id,
        institution_name:        inst.institution_name,
        template_definition_id: (def as TemplateDefinition).id,
        template_name:           (def as TemplateDefinition).name,
        status:                  'approved',
        meta_template_id:        approvedTemplateIdByInst.get(inst.institution_id) || null,
        error_message:           null,
      })
    }
  }

  if (needSubmitInsts.length > 0) {
    const token = await getGlobalToken(supabase)
    results.push(...await submitDefinitionToInstitutions(supabase, def as TemplateDefinition, needSubmitInsts, token))
  }

  return res.status(200).json({ results })
}

interface TemplateVariant {
  body_text: string
  category: 'UTILITY' | 'MARKETING'
  approved_institution_ids: string[]
  approved_institution_names: string[]
  // Presente quando essa variante EXATA (nome+idioma+corpo) já tem uma linha
  // em template_definitions — é o que a tela usa pra decidir entre mostrar
  // "Configurar" (cria) ou os controles de edição inline (atualiza).
  template_definition_id: string | null
  display_name: string | null
}

interface TemplateGroup {
  name: string
  language: string
  variants: TemplateVariant[]
}

// ── Lista TODOS os templates aprovados em whatsapp_templates de QUALQUER
// escola — cadastrados em template_definitions ou não — agrupados por
// (nome, idioma), com as variantes de corpo detectadas dentro de cada
// grupo. Base da aba "Todos os Templates" (visão permanente, substitui o
// antigo modal de importação única).
//
// Roda com service role de propósito — whatsapp_templates tem RLS restrita
// à própria instituição (institution_isolation), então o Super Admin nunca
// enxergaria o cache de outra escola numa query direto do navegador.
//
// Variantes por corpo exato (não só nome+idioma): escola com WABA própria
// pode ter editado o texto manualmente — confirmado em produção com
// iniciar_contato e reativar_atendimento, cada um com 1 das 4 escolas
// aprovadas usando um corpo levemente diferente (emoji/typo). Cada corpo
// distinto vira uma variante própria, com seu próprio template_definition_id
// (se já configurada) — nunca mistura conteúdo sob um único cadastro, e
// nunca força escolher "qual versão é a certa" (decisão confirmada com o
// usuário; mesmo critério em handleRegisterExisting).
async function handleListAllTemplates(req: VercelRequest, res: VercelResponse, supabase: Supa) {
  const { data: allTemplates, error: wtErr } = await supabase
    .from('whatsapp_templates')
    .select('institution_id, name, language, category, components, institutions(name)')
    .eq('status', 'approved')
  if (wtErr) return errorResponse(res, 500, `Erro ao consultar templates aprovados: ${wtErr.message}`)

  const { data: defs, error: defsErr } = await supabase
    .from('template_definitions')
    .select('id, name, language, body_text, display_name')
  if (defsErr) return errorResponse(res, 500, `Erro ao consultar templates já cadastrados: ${defsErr.message}`)

  const defByKey = new Map<string, { id: string; display_name: string | null }>()
  for (const d of (defs || []) as any[]) {
    defByKey.set(`${d.name} ${d.language || 'pt_BR'} ${d.body_text}`, { id: d.id, display_name: d.display_name })
  }

  // groupKey (nome idioma) -> variantKey (corpo) -> dados acumulados
  const groups = new Map<string, Map<string, {
    category: 'UTILITY' | 'MARKETING'; institutionIds: Set<string>; institutionNames: Set<string>
  }>>()

  for (const row of (allTemplates || []) as any[]) {
    const bodyText = extractBodyText(row.components)
    if (!bodyText) continue // sem componente BODY — não tem o que listar/importar

    const language = row.language || 'pt_BR'
    const groupKey = `${row.name} ${language}`
    if (!groups.has(groupKey)) groups.set(groupKey, new Map())
    const variants = groups.get(groupKey)!

    if (!variants.has(bodyText)) {
      variants.set(bodyText, {
        category: row.category === 'MARKETING' ? 'MARKETING' : 'UTILITY',
        institutionIds: new Set(),
        institutionNames: new Set(),
      })
    }
    const v = variants.get(bodyText)!
    v.institutionIds.add(row.institution_id)
    v.institutionNames.add(row.institutions?.name || row.institution_id)
  }

  const result: TemplateGroup[] = [...groups.entries()].map(([groupKey, variantsMap]) => {
    const [name, language] = groupKey.split(' ')
    const variants: TemplateVariant[] = [...variantsMap.entries()]
      .map(([bodyText, v]) => {
        const defMatch = defByKey.get(`${name} ${language} ${bodyText}`)
        return {
          body_text:                   bodyText,
          category:                    v.category,
          approved_institution_ids:    [...v.institutionIds],
          approved_institution_names:  [...v.institutionNames],
          template_definition_id:      defMatch?.id || null,
          display_name:                defMatch?.display_name || null,
        }
      })
      .sort((a, b) => b.approved_institution_ids.length - a.approved_institution_ids.length)
    return { name, language, variants }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return res.status(200).json({ groups: result })
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
