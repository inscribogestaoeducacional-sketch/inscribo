// Mensagens que o próprio sistema envia sozinho com modelo da Meta (hoje: as duas da
// visita). A escola pode trocar o modelo padrão pelo dela, desde que aprovado na Meta
// e com as mesmas variáveis. Sem escolha, valem os modelos padrão de sempre.
import { supabase } from './supabase'

export type TemplateSlot = 'confirmacao_visita' | 'lembrete_visita' | 'pesquisa_saida'

export const TEMPLATE_SLOTS: Record<TemplateSlot, { label: string; desc: string; vars: number; varsHelp: string }> = {
  confirmacao_visita: { label: 'Confirmação de visita', desc: 'Enviada na hora em que a visita é agendada.', vars: 3, varsHelp: '{{1}} nome da escola, {{2}} data e {{3}} horário' },
  lembrete_visita:    { label: 'Lembrete de visita',    desc: 'Enviada de manhã, no dia da visita.',         vars: 2, varsHelp: '{{1}} nome da escola e {{2}} horário' },
  pesquisa_saida:     { label: 'Pesquisa de saída',     desc: 'Enviada em Transferências quando a conversa está fechada. Leva o botão com o link da pesquisa.', vars: 2, varsHelp: '{{1}} nome da escola e {{2}} nome do aluno' },
}
export const TEMPLATE_SLOT_KEYS = Object.keys(TEMPLATE_SLOTS) as TemplateSlot[]

/** Quantas variáveis o texto usa ({{1}}, {{2}}…): o maior número encontrado. */
export function countTemplateVars(text: string | null | undefined): number {
  const nums = Array.from((text || '').matchAll(/\{\{\s*(\d+)\s*\}\}/g)).map(m => Number(m[1]))
  return nums.length ? Math.max(...nums) : 0
}

/** Serve de troca só o modelo aprovado, com o mesmo número de variáveis e sem variável no cabeçalho. */
export function fitsSlot(slot: TemplateSlot, def: { body_text?: string | null; header_config?: unknown }): boolean {
  return countTemplateVars(def.body_text) === TEMPLATE_SLOTS[slot].vars && !JSON.stringify(def.header_config || '').includes('{{')
}

/** Nome do modelo a enviar: o da escola, se escolheu e ainda vale; senão o padrão. */
export async function resolveSlotTemplate(institutionId: string, slot: TemplateSlot): Promise<string> {
  try {
    const { data: ch } = await supabase.from('template_slot_choice').select('template_definition_id').eq('institution_id', institutionId).eq('slot', slot).maybeSingle()
    const id = (ch as any)?.template_definition_id
    if (!id) return slot
    const [{ data: def }, { data: st }] = await Promise.all([
      supabase.from('template_definitions').select('name, body_text, header_config').eq('id', id).maybeSingle(),
      supabase.from('template_institution_status').select('status').eq('template_definition_id', id).eq('institution_id', institutionId).maybeSingle(),
    ])
    if (def && (st as any)?.status === 'approved' && fitsSlot(slot, def as any)) return (def as any).name
  } catch (e) { console.error('[templateSlots]', e) }
  return slot
}
