import { supabase } from './supabase'

export type VariableLabels = Record<string, string>

// Onde um template pode ser ESCOLHIDO manualmente numa tela — casa com o
// CHECK de template_definitions.available_contexts (migration
// 20260916050000_template_definitions_dynamic_controls.sql). Templates
// disparados só por automação (confirmacao_visita, lembrete_visita) não
// marcam nenhum desses e por isso não aparecem em nenhum picker.
export type TemplateContext = 'manual_send' | 'new_conversation' | 'scheduled_message' | 'broadcast'

export interface TemplateMeta {
  display_name: string | null
  variable_labels: VariableLabels
  available_contexts: TemplateContext[]
}

// Metadados cadastrados uma única vez no catálogo central "Templates
// Automáticos" (template_definitions, Super Admin) e reaproveitados por toda
// tela que lista/preenche template pra enviar — envio manual no WhatsAppHub,
// nova conversa, "Agendar mensagem", inbox interno da Áion, transmissão em
// massa etc.
//
// Casamento por `name` (nome técnico do template, único em
// template_definitions): é o único jeito de ligar um template concreto
// (whatsapp_templates, cache por escola sincronizado da Meta — sem colunas
// próprias, reescrito por completo a cada sync) ao que foi cadastrado no
// catálogo. Template fora do catálogo (criado direto no WhatsApp Manager, ou
// qualquer template aprovado antes dessa feature existir) simplesmente não
// aparece no mapa retornado — cada helper abaixo trata essa ausência como
// "passthrough" (nome técnico como rótulo, sempre visível em todo picker),
// nunca como bloqueio, pra não quebrar templates que já funcionavam.

// Busca em lote os metadados de vários templates de uma vez (evita 1 query
// por template numa tela com lista de vários templates disponíveis).
export async function fetchTemplateMeta(templateNames: string[]): Promise<Record<string, TemplateMeta>> {
  const uniqueNames = [...new Set(templateNames.filter(Boolean))]
  if (uniqueNames.length === 0) return {}
  const { data, error } = await supabase
    .from('template_definitions')
    .select('name, display_name, variable_labels, available_contexts')
    .in('name', uniqueNames)
  if (error || !data) return {}
  const map: Record<string, TemplateMeta> = {}
  for (const row of data as {
    name: string
    display_name: string | null
    variable_labels: VariableLabels | null
    available_contexts: TemplateContext[] | null
  }[]) {
    map[row.name] = {
      display_name:        row.display_name || null,
      variable_labels:     row.variable_labels || {},
      available_contexts:  row.available_contexts || [],
    }
  }
  return map
}

// Nomes de template escondidos (visible_to_school = false) pra UMA
// instituição específica — só faz sentido pra contexto institution-scoped
// (manual_send/new_conversation/scheduled_message do lado escola); Inbox
// Áion/transmissão em massa não têm institution_id, então nunca chamam isto.
export async function fetchHiddenTemplateNames(institutionId: string): Promise<Set<string>> {
  if (!institutionId) return new Set()
  const { data, error } = await supabase
    .from('template_institution_status')
    .select('template_definitions(name)')
    .eq('institution_id', institutionId)
    .eq('visible_to_school', false)
  if (error || !data) return new Set()
  return new Set(
    (data as unknown as { template_definitions: { name: string } | { name: string }[] | null }[])
      .map(r => Array.isArray(r.template_definitions) ? r.template_definitions[0]?.name : r.template_definitions?.name)
      .filter((n): n is string => !!n)
  )
}

// Nome de exibição — o cadastrado no catálogo, senão o nome técnico (nunca
// deixa o picker sem rótulo nenhum).
export function templateDisplayName(metaByName: Record<string, TemplateMeta> | undefined, name: string | undefined): string {
  if (!name) return ''
  return metaByName?.[name]?.display_name || name
}

// Rótulo de UMA variável — cadastrado se existir, senão o genérico de
// sempre ("Variável N").
export function variableLabel(
  metaByName: Record<string, TemplateMeta> | undefined,
  templateName: string | undefined,
  n: string | number
): string {
  const label = templateName ? metaByName?.[templateName]?.variable_labels?.[String(n)] : undefined
  return label || `Variável ${n}`
}

// Filtra uma lista de templates (já aprovados) pra manter só os disponíveis
// nesse contexto de picker:
// - sem registro no catálogo → passa sempre (legado/fora do catálogo);
// - com registro → só passa se `context` estiver em available_contexts;
// - hiddenNames (visible_to_school=false pra essa instituição) sempre barra,
//   mesmo com o contexto marcado.
export function filterTemplatesForContext<T extends { name: string }>(
  items: T[],
  metaByName: Record<string, TemplateMeta> | undefined,
  context: TemplateContext,
  hiddenNames?: Set<string>
): T[] {
  return items.filter(t => {
    if (hiddenNames?.has(t.name)) return false
    const meta = metaByName?.[t.name]
    if (!meta) return true
    return meta.available_contexts.includes(context)
  })
}
