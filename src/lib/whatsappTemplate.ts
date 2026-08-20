import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Distingue o formato de DEFINIÇÃO de template (GET .../message_templates —
// { type, format?, text?, buttons? }) do formato de ENVIO (POST .../messages
// — template.components: [{ type, parameters }]). Ver investigação: reenviar
// a definição crua (com a chave "format") causa
// "Unexpected key 'format' on param 'template.components.0'" na Meta.
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphTemplateComponentDef {
  type: string
  format?: string
  text?: string
  buttons?: unknown[]
}

export interface GraphTemplateLike {
  name: string
  components?: GraphTemplateComponentDef[]
}

const MEDIA_HEADER_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'] as const
export type MediaHeaderFormat = typeof MEDIA_HEADER_FORMATS[number]

export function getTemplateHeaderMediaFormat(tmpl: GraphTemplateLike | undefined | null): MediaHeaderFormat | null {
  const headerDef = tmpl?.components?.find(c => c.type === 'HEADER')
  const format = headerDef?.format?.toUpperCase()
  return format && (MEDIA_HEADER_FORMATS as readonly string[]).includes(format) ? (format as MediaHeaderFormat) : null
}

// Números de variável {{n}} presentes no corpo do template, na ordem em que
// aparecem no texto — mesma extração usada em todos os pontos de envio.
export function getTemplateBodyVarNumbers(tmpl: GraphTemplateLike | undefined | null): string[] {
  const bodyComp = tmpl?.components?.find(c => c.type === 'BODY')
  if (!bodyComp?.text) return []
  return [...bodyComp.text.matchAll(/\{\{(\d+)\}\}/g)].map(m => m[1])
}

// Monta o array "components" no formato de ENVIO — a única função que deveria
// existir pra isso no projeto (substitui os 4 pontos que faziam
// `tmpl.components ?? []`/similar na mão). Lança erro se o template tiver
// header de mídia dinâmica (IMAGE/VIDEO/DOCUMENT) e nenhuma URL for informada
// — não há como enviar esse tipo de template sem o arquivo.
//
// urlButtonParam: valor do único parâmetro dinâmico do botão de URL (index
// '0') — a Meta concatena esse valor na base já cadastrada no template
// aprovado. Suporte adicionado pro fluxo de cobrança manual (AdminFinancial),
// que usa botão de URL dinâmica (.../pagar/{{4}}); os 3 chamadores
// pré-existentes não passam esse argumento e continuam sem gerar o component
// de botão, como antes.
export function buildSendComponents(
  tmpl: GraphTemplateLike,
  bodyVars: Record<string, string>,
  headerMediaUrl?: string | null,
  urlButtonParam?: string
): any[] {
  const components: any[] = []

  const headerFormat = getTemplateHeaderMediaFormat(tmpl)
  if (headerFormat) {
    if (!headerMediaUrl) {
      throw new Error(`Este template exige um arquivo de ${headerFormat.toLowerCase()} no cabeçalho — envie o arquivo antes de continuar.`)
    }
    const kind = headerFormat.toLowerCase()
    components.push({ type: 'header', parameters: [{ type: kind, [kind]: { link: headerMediaUrl } }] })
  }

  const bodyVarNumbers = getTemplateBodyVarNumbers(tmpl)
  if (bodyVarNumbers.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyVarNumbers.map(n => ({ type: 'text', text: bodyVars[n] || '' })),
    })
  }

  // Botões QUICK_REPLY e URL estático (sem {{n}}) não precisam de component —
  // a Meta resolve a partir da definição aprovada do template.
  if (urlButtonParam !== undefined) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlButtonParam }],
    })
  }

  return components
}

// Upload de mídia de header pro mesmo bucket já usado pra mídia enviada via
// WhatsApp (api/whatsapp/send.ts:uploadToStorage, api/whatsapp/media.ts) —
// mais apropriado que o bucket "proposals" (PDFs de proposta comercial, outro
// domínio) já que este arquivo é, literalmente, mídia de mensagem WhatsApp.
export async function uploadTemplateHeaderMedia(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `template-headers/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabase.storage
    .from('whatsapp-media')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) throw new Error(`Falha no upload: ${error.message}`)

  const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(path)
  return publicUrl
}
