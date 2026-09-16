import { supabase } from './supabase'

export type VariableLabels = Record<string, string>

// Rótulos legíveis por variável de template ({{1}}, {{2}}...), cadastrados
// uma única vez no catálogo central "Templates Automáticos"
// (template_definitions.variable_labels, Super Admin) e reaproveitados por
// toda tela que pede pra preencher variável de template — envio manual no
// WhatsAppHub, "Agendar mensagem", inbox interno da Áion etc.
//
// Casamento por `name` (nome técnico do template, único em
// template_definitions): é o único jeito de ligar um template concreto
// (whatsapp_templates, cache por escola sincronizado da Meta — sem coluna
// própria de rótulo, reescrita por completo a cada sync) ao rótulo
// cadastrado no catálogo. Template fora do catálogo (criado direto no
// WhatsApp Manager, ou legado, anterior a essa feature) simplesmente não
// aparece no mapa retornado — quem consome isso trata com variableLabel().

// Busca em lote os rótulos de vários templates de uma vez (evita 1 query por
// template numa tela com lista de vários templates disponíveis).
export async function fetchTemplateVariableLabels(templateNames: string[]): Promise<Record<string, VariableLabels>> {
  const uniqueNames = [...new Set(templateNames.filter(Boolean))]
  if (uniqueNames.length === 0) return {}
  const { data, error } = await supabase
    .from('template_definitions')
    .select('name, variable_labels')
    .in('name', uniqueNames)
  if (error || !data) return {}
  const map: Record<string, VariableLabels> = {}
  for (const row of data as { name: string; variable_labels: VariableLabels | null }[]) {
    if (row.variable_labels && Object.keys(row.variable_labels).length > 0) {
      map[row.name] = row.variable_labels
    }
  }
  return map
}

// Rótulo de UMA variável — cadastrado se existir, senão o genérico de
// sempre ("Variável N"), pra nunca deixar um campo sem label nenhum.
export function variableLabel(
  labelsByTemplate: Record<string, VariableLabels> | undefined,
  templateName: string | undefined,
  n: string | number
): string {
  const label = templateName ? labelsByTemplate?.[templateName]?.[String(n)] : undefined
  return label || `Variável ${n}`
}
