// Sequência para lead sem resposta — regras compartilhadas com a função lead-sequence.
export const SEQ_MAX_STEPS = 5
export type SeqStep = { days: number; template: string }
export const SEQ_DEFAULT_STEPS: SeqStep[] = [
  { days: 3, template: 'reativacao2' }, { days: 4, template: 'ainda_da_tempo' }, { days: 7, template: 'escassez_ultima_chamada' },
]
/** O que o sistema sabe preencher numa variável do modelo (pelo rótulo cadastrado). */
export function seqVarKind(label: string | undefined | null): 'responsavel' | 'escola' | 'aluno' | 'atendente' | null {
  const l = String(label || '').toLowerCase()
  if (/respons|fam[ií]lia|pai|m[aã]e/.test(l)) return 'responsavel'
  if (/institu|escola|col[eé]gio/.test(l)) return 'escola'
  if (/aluno|estudante|filh/.test(l)) return 'aluno'
  if (/atendente/.test(l)) return 'atendente'
  return null
}
