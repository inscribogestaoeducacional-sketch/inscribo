// Identidade AION Business (out/2026): o degradê do "A" da logo
// (#07614F → #0E7293 → #1A53CD) em ícones de cabeçalho, botões principais e
// destaques; azul Áion como cor sólida (links, foco, texto de destaque).
// Verde vivo só como cor de significado (pago, ativo, WhatsApp).
// Use estes tokens em telas novas e ao mexer nas antigas — todo módulo segue
// o mesmo padrão (cabeçalho com PageHeader, botão principal em degradê,
// cartões brancos com borda fina, raio 14–16, texto ink/muted).
export const BRAND = {
  ink: '#0B1B34',        // títulos e texto principal
  text: '#334155',       // texto de leitura
  muted: '#5B6B86',      // texto secundário
  faint: '#94A3B8',      // dicas, placeholders
  line: '#E3E8F0',       // bordas
  bg: '#F6F8FB',         // fundo das páginas
  primary: '#2563EB',    // azul Áion (links, ícones, foco, botões)
  primaryDark: '#1D4ED8',
  deep: '#1E40AF',
  sky: '#0EA5E9',
  soft: '#EFF6FF',       // fundo suave azul
  softer: '#F5F8FF',
  success: '#15803D',    // pago / ativo
  successSoft: '#F0FDF4',
  danger: '#DC2626',
} as const
export const GRAD = 'linear-gradient(135deg, #07614F 0%, #0E7293 48%, #1A53CD 100%)'
export const GRAD_SOFT = 'linear-gradient(135deg, #EAF6F3, #EAF3FB 50%, #EEF2FD)'
/** Cores do degradê da logo, para quem precisa delas separadas. */
export const LOGO = { from: '#07614F', mid: '#0E7293', to: '#1A53CD', light: '#7CD3FA' } as const
export const SHADOW = '0 1px 2px rgba(11,27,52,.04), 0 4px 16px rgba(11,27,52,.05)'

/** Ícone de cartão/KPI no padrão novo: fundo suave + ícone colorido.
 *  Recebe a classe de degradê antiga (Tailwind) e devolve só o "tom":
 *  vermelho/âmbar/cinza quando o sentido é alerta/neutro; azul no resto. */
export function softTone(legacy: string = ''): { bg: string; fg: string } {
  if (/red|rose/.test(legacy)) return { bg: '#FEF2F2', fg: '#B91C1C' }
  if (/amber|orange|yellow/.test(legacy)) return { bg: '#FFFBEB', fg: '#B45309' }
  if (/gray|slate/.test(legacy)) return { bg: '#F1F5F9', fg: '#64748B' }
  if (/green|emerald|07614F/.test(legacy) && !/blue|1A53CD/.test(legacy)) return { bg: '#F0FDF4', fg: '#15803D' }
  return { bg: '#EFF6FF', fg: '#2563EB' }
}
