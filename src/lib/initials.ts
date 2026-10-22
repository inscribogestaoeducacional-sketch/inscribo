// Nome e iniciais para avatar. Aceitam qualquer valor: nulo, vazio, só espaços
// ou só símbolos. Um perfil do WhatsApp com nome " " (um espaço) derrubava o Hub
// inteiro (tela branca) porque a função antiga lia a primeira letra de uma
// palavra que não existia.

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/** Nome sem espaços nas pontas; '' quando não sobra nada (use `|| telefone`). */
export function cleanName(name: string | null | undefined): string {
  return typeof name === 'string' ? name.trim() : ''
}

/** Iniciais (até 2). Sem nenhuma letra ou número → "?". */
export function getInitials(name: string | null | undefined): string {
  const words = cleanName(name).split(/\s+/)
    .map(w => Array.from(w).filter(ch => LETTER_OR_DIGIT.test(ch)))
    .filter(chars => chars.length > 0)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).join('').toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
