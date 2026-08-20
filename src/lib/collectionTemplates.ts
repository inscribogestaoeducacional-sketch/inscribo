// src/lib/collectionTemplates.ts
//
// Definição LOCAL dos dois templates de cobrança manual (AdminFinancial.tsx →
// "Enviar cobrança via WhatsApp"). Esses templates ainda não foram submetidos
// à Meta quando este código foi escrito — por isso a definição não vem de
// GET .../message_templates (como o fluxo de broadcast faz, que só lista
// templates já APPROVED), e sim hardcoded aqui a partir do texto que será
// submetido. Se o texto aprovado divergir deste (contagem de variáveis,
// nome), o envio falha com erro da Meta — tratado na UI como "template não
// aprovado ou nome incorreto" (ver handleSendCollection em AdminFinancial.tsx).
import type { GraphTemplateLike } from './whatsappTemplate'

export type CollectionTemplateKey = 'cobranca_em_atraso' | 'link_mensalidade'

export interface CollectionTemplateMeta {
  name: CollectionTemplateKey
  label: string
  bodyText: string
  // Só faz sentido sugerir/habilitar por padrão quando a parcela já está
  // vencida — mas nada impede o admin de escolher 'link_mensalidade' pra uma
  // parcela vencida também (por isso o outro template não tem essa trava).
  requiresOverdue: boolean
}

export const COLLECTION_TEMPLATES: Record<CollectionTemplateKey, CollectionTemplateMeta> = {
  cobranca_em_atraso: {
    name: 'cobranca_em_atraso',
    label: 'Cobrança em atraso',
    bodyText: 'Olá! Identificamos que a mensalidade de {{1}} referente a {{2}} está com pagamento em atraso desde {{3}}. Para evitar a suspensão do acesso, regularize agora.',
    requiresOverdue: true,
  },
  link_mensalidade: {
    name: 'link_mensalidade',
    label: 'Enviar link da mensalidade',
    bodyText: 'Olá! O link de pagamento da mensalidade de {{1}} referente a {{2}} já está disponível. Vencimento em {{3}}.',
    requiresOverdue: false,
  },
}

// Base cadastrada na Meta pro botão de URL dinâmica de ambos os templates —
// só o código curto (variável {{4}}) é enviado no payload; a Meta concatena
// com essa base aprovada.
export const COLLECTION_PAY_BASE_URL = 'https://www.aionedu.com.br/pagar/'

// Objeto no formato que buildSendComponents() espera — só o suficiente pra
// extrair os números de variável do corpo ({{1}}/{{2}}/{{3}}), já que não há
// header nem botão de resposta rápida nesses templates.
export function collectionTemplateAsGraphLike(key: CollectionTemplateKey): GraphTemplateLike {
  const meta = COLLECTION_TEMPLATES[key]
  return {
    name: meta.name,
    components: [{ type: 'BODY', text: meta.bodyText }],
  }
}
