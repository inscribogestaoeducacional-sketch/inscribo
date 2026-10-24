// Identidade visual do Áion Edu nas telas de Configurações (out/2026).
// O desenho segue o do AION Business (cabeçalho em faixa degradê, cartões brancos
// com borda fina, raio 14–18, botão principal em degradê), com as cores do Edu:
// verde-água #00A896 no lugar do azul do Business.
export const BRAND = {
  ink: '#1A2B4A',        // títulos e texto principal
  text: '#334155',       // texto de leitura
  muted: '#5B6B86',      // texto secundário
  faint: '#94A3B8',      // dicas, placeholders
  line: '#E3E8F0',       // bordas
  bg: '#F5FAF9',         // fundo das páginas
  primary: '#00A896',    // verde-água do Edu
  primaryDark: '#007A6E',
  soft: '#E6F7F5',       // fundo suave
  softer: '#F0FDFB',
  softLine: '#BDEBE4',
  success: '#15803D',
  successSoft: '#F0FDF4',
  warn: '#B45309',
  warnSoft: '#FFFBEB',
  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
} as const

export const GRAD = 'var(--aion-grad)'
export const SHADOW = '0 1px 2px rgba(26,43,74,.04), 0 4px 16px rgba(26,43,74,.05)'
