// api/_lib/vitrineRender.ts
//
// HTML da página pública da Vitrine (aionedu.com.br/<slug>). Módulo puro,
// sem import nenhum, pra servir aos dois lados:
//   - api/_lib/vitrinePage.ts (via api/public.ts): página renderizada no servidor (prévia de
//     compartilhamento com as meta tags certas, primeira pintura sem JS);
//   - editor da Vitrine (Fase 3): prévia em <iframe srcdoc> com o mesmo HTML,
//     sem o script de registro (opção preview).
//
// Os dados chegam de vitrine_public_page() (20260929060000_vitrine.sql), que
// já validou tudo na gravação. Mesmo assim, aqui tudo passa de novo por
// escape/validação (defesa em profundidade): texto sempre escapado, URL só
// http(s), cor só #RRGGBB, fonte só da lista, vídeo só por ID.

export interface VitrinePage {
  id: string
  slug: string
  title: string | null
  bio: string | null
  logo_url: string | null
  cover_url: string | null
  theme: Record<string, unknown> | null
  seo_description: string | null
  institution_name: string | null
}

export interface VitrineBlock {
  id: string
  type: string
  config: Record<string, any>
}

export interface VitrinePublicData {
  page: VitrinePage
  blocks: VitrineBlock[]
}

export interface RenderOptions {
  siteUrl: string          // https://aionedu.com.br
  supabaseUrl?: string     // registro de eventos (omitido no preview)
  anonKey?: string
  preview?: boolean        // editor: sem script de registro, links sem sair do iframe
  animatePreview?: boolean // editor: botão "Ver animação" (na prévia a entrada fica desligada)
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const isHttpUrl = (u: unknown): u is string =>
  typeof u === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(u) && u.length <= 2048

const HEX = /^#[0-9A-Fa-f]{6}$/

// JSON dentro de <script>: "<" escapado pra "</script>" nunca fechar a tag.
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Texto sobre a cor da escola: branco enquanto tiver contraste >= 3:1 (WCAG
// pra componente de interface/texto grande — cor de marca com texto branco é
// o esperado, ex.: azul #3B82F6 = 3,7:1); abaixo disso, quase-preto (ex.:
// laranja #F59E0B, branco daria 2,1:1).
function onColor(hex: string): string {
  return 1.05 / (luminance(hex) + 0.05) >= 3 ? '#FFFFFF' : '#111827'
}

// Mistura `a` sobre `b` com opacidade `t` (0–1) — fundo do botão "suave".
function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  const m = ca.map((v, i) => Math.round(v * t + cb[i] * (1 - t)))
  return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('')
}

// Mesma codificação de buildWaMeLink (src/lib/captureTriggers.ts): o texto
// precisa chegar idêntico ao gatilho do Captação, e . ! ' ( ) * ~ crus no
// fim do link são cortados por quem transforma texto em link clicável.
export function waMeLink(phone: string, text: string): string | null {
  let digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  const encoded = encodeURIComponent((text || '').trim())
    .replace(/[.!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `https://wa.me/${digits}?text=${encoded}`
}

// ── Tema ────────────────────────────────────────────────────────────────────
// Pares prontos de fonte (título + texto) — theme.font_pair (Fase 5). Só
// Google Fonts e só os pesos usados: no máximo 2 famílias por página.
// Chaves validadas no banco (20260929090000_vitrine_theme_v2.sql).
export const FONT_PAIRS: Record<string, { label: string; heading: string; body: string }> = {
  'inter':                 { label: 'Moderna',       heading: 'Inter',             body: 'Inter' },
  'jakarta':               { label: 'Contemporânea', heading: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans' },
  'poppins':               { label: 'Amigável',      heading: 'Poppins',           body: 'Poppins' },
  'playfair-inter':        { label: 'Elegante',      heading: 'Playfair Display',  body: 'Inter' },
  'merriweather-dmsans':   { label: 'Tradicional',   heading: 'Merriweather',      body: 'DM Sans' },
  'fredoka-nunito':        { label: 'Divertida',     heading: 'Fredoka',           body: 'Nunito' },
  'montserrat-sourcesans': { label: 'Institucional', heading: 'Montserrat',        body: 'Source Sans 3' },
  'dmserif-dmsans':        { label: 'Sofisticada',   heading: 'DM Serif Display',  body: 'DM Sans' },
}
// Fonte única das páginas criadas antes dos pares (theme.font).
const LEGACY_FONTS = ['Inter', 'Poppins', 'Montserrat', 'Nunito', 'Lora', 'Playfair Display']
// Peso do título por família (as que não têm 600/700 usam o que existe).
const HEADING_WEIGHT: Record<string, number> = { 'Merriweather': 700, 'DM Serif Display': 400 }

export function fontsHref(heading: string, body: string): string {
  const hw = HEADING_WEIGHT[heading] ?? 700
  const weights = new Map<string, Set<number>>()
  const add = (fam: string, ws: number[]) => { const s = weights.get(fam) || new Set<number>(); ws.forEach(w => s.add(w)); weights.set(fam, s) }
  add(heading, [hw])   // título só usa um peso (h1/h2)
  add(body, body === 'Merriweather' ? [400, 700] : [400, 500, 600])
  const fams = [...weights].map(([fam, ws]) => `family=${fam.replace(/ /g, '+')}:wght@${[...ws].sort((x, y) => x - y).join(';')}`)
  return `https://fonts.googleapis.com/css2?${fams.join('&')}&display=swap`
}

type ButtonStyle = 'filled' | 'outline' | 'soft' | 'glass' | 'shadow' | 'minimal'

interface Theme {
  primary: string; background: string; text: string
  buttonStyle: ButtonStyle; radius: number
  heading: string; body: string; headingWeight: number
  bgType: 'solid' | 'gradient' | 'image'; bgTo: string; bgAngle: number
  bgImage: string | null; bgOverlay: number; bgOverlayTone: 'dark' | 'light'
  shadow: 'none' | 'soft' | 'strong'; spacing: 'compact' | 'normal' | 'relaxed'
  cardStyle: 'flat' | 'bordered' | 'elevated'; logoShape: 'circle' | 'rounded'
  animation: 'none' | 'subtle' | 'lively'
}

// Página sem as chaves novas (criada antes da Fase 5) sai igual a antes:
// fundo sólido, cartão com borda, logo redonda, sem sombra nem animação.
function readTheme(t: Record<string, unknown> | null): Theme {
  const th = t || {}
  const pick = (k: string, def: string) => (typeof th[k] === 'string' && HEX.test(th[k] as string) ? th[k] as string : def)
  const oneOf = <T extends string>(k: string, list: readonly T[], def: T): T => (list.includes(th[k] as T) ? th[k] as T : def)
  const radius = Number(th.radius)
  const pair = typeof th.font_pair === 'string' ? FONT_PAIRS[th.font_pair] : undefined
  const legacy = typeof th.font === 'string' && LEGACY_FONTS.includes(th.font) ? th.font : 'Inter'
  const heading = pair ? pair.heading : legacy
  const body = pair ? pair.body : legacy
  const angle = Number(th.bg_gradient_angle)
  const overlay = Number(th.bg_overlay)
  const background = pick('background', '#FFFFFF')
  const bgType = oneOf('bg_type', ['solid', 'gradient', 'image'] as const, 'solid')
  const bgImage = isHttpUrl(th.bg_image_url) ? th.bg_image_url : null
  return {
    primary:       pick('primary', '#00A896'),
    background,
    text:          pick('text', '#111827'),
    buttonStyle:   oneOf('button_style', ['filled', 'outline', 'soft', 'glass', 'shadow', 'minimal'] as const, 'filled'),
    radius:        [0, 8, 16, 999].includes(radius) ? radius : 16,
    heading, body,
    headingWeight: HEADING_WEIGHT[heading] ?? 700,
    // Imagem sem URL cai pro sólido (nunca página sem fundo).
    bgType:        bgType === 'image' && !bgImage ? 'solid' : bgType,
    bgTo:          pick('bg_gradient_to', background),
    bgAngle:       [0, 45, 90, 135, 180].includes(angle) ? angle : 180,
    bgImage,
    bgOverlay:     overlay >= 0 && overlay <= 80 && overlay % 10 === 0 ? overlay : 40,
    bgOverlayTone: oneOf('bg_overlay_tone', ['dark', 'light'] as const, 'dark'),
    shadow:        oneOf('shadow', ['none', 'soft', 'strong'] as const, 'none'),
    spacing:       oneOf('spacing', ['compact', 'normal', 'relaxed'] as const, 'normal'),
    cardStyle:     oneOf('card_style', ['flat', 'bordered', 'elevated'] as const, 'bordered'),
    logoShape:     oneOf('logo_shape', ['circle', 'rounded'] as const, 'circle'),
    animation:     oneOf('animation', ['none', 'subtle', 'lively'] as const, 'none'),
  }
}

// rgba() a partir de #RRGGBB.
function alpha(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

// URL dentro de url('...') no CSS: já é https validada (e o banco recusa
// esses caracteres); aspas, parênteses, barra invertida, espaço, ; { } < >
// viram %XX — nada da URL consegue fechar a string, o url() ou a regra.
const cssUrl = (u: string) => u.replace(/['"()\\\s;{}<>]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))

// ── Ícones (SVG inline, sem requisição extra) ───────────────────────────────

const ICON = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.07c-.24.68-1.42 1.3-1.95 1.38-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.41.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37z"/></svg>',
  link:     '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
  pin:      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  clock:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 7v5l3 2"/></svg>',
  school:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 9l10-5 10 5-10 5L2 9zm4 2.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8"/></svg>',
}

// ── Redes sociais ───────────────────────────────────────────────────────────
// Reconhecidas pela URL do bloco de link (nada disso fica no banco). Ícones:
// Simple Icons 16.33 (CC0, domínio público); o do LinkedIn é um "in"
// geométrico próprio — a marca pediu a retirada do Simple Icons.
export type SocialNet = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'linkedin' | 'x'

export const SOCIAL: Record<SocialNet, { label: string; hosts: string[]; bg: string; svg: string }> = {
  instagram: {
    label: "Instagram", hosts: ["instagram.com","instagr.am"],
    bg: "radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285aeb 90%)",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077\"/></svg>",
  },
  facebook: {
    label: "Facebook", hosts: ["facebook.com","fb.com","fb.me"],
    bg: "#0866FF",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z\"/></svg>",
  },
  tiktok: {
    label: "TikTok", hosts: ["tiktok.com"],
    bg: "#000000",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z\"/></svg>",
  },
  youtube: {
    label: "YouTube", hosts: ["youtube.com","youtu.be"],
    bg: "#FF0000",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z\"/></svg>",
  },
  linkedin: {
    label: "LinkedIn", hosts: ["linkedin.com","lnkd.in"],
    bg: "#0A66C2",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"6.2\" cy=\"5.6\" r=\"2\" fill=\"currentColor\"/><rect x=\"4.4\" y=\"8.8\" width=\"3.6\" height=\"10.8\" rx=\".4\" fill=\"currentColor\"/><path fill=\"currentColor\" d=\"M10.2 8.8h3.4v1.6c.6-1.1 1.9-1.9 3.6-1.9 2.8 0 4.1 1.8 4.1 4.9v6.2h-3.6v-5.6c0-1.5-.6-2.4-1.8-2.4-1.3 0-2.1.9-2.1 2.6v5.4h-3.6z\"/></svg>",
  },
  x: {
    label: "X", hosts: ["x.com","twitter.com"],
    bg: "#000000",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z\"/></svg>",
  },
}

// Rede social de uma URL (host exato ou subdomínio: m.facebook.com,
// vm.tiktok.com, br.linkedin.com...). null = link comum.
export function detectSocial(url: unknown): SocialNet | null {
  if (typeof url !== 'string') return null
  let host: string
  try { host = new URL(url).hostname.toLowerCase().replace(/^www./, '') } catch { return null }
  for (const [k, n] of Object.entries(SOCIAL) as [SocialNet, (typeof SOCIAL)[SocialNet]][]) {
    if (n.hosts.some(h => host === h || host.endsWith('.' + h))) return k
  }
  return null
}

// ── Blocos ──────────────────────────────────────────────────────────────────

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function button(blockId: string, href: string, label: string, icon: string, cls = ''): string {
  return `<a class="btn ${cls}" href="${esc(href)}" data-b="${esc(blockId)}" target="_blank" rel="noopener noreferrer">`
    + `<span class="ic">${icon}</span><span class="lb">${esc(label)}</span><span class="ic"></span></a>`
}

function paragraphs(text: string): string {
  return String(text || '').trim().split(/\n{2,}/)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

// Domínio curto pro rodapé do cartão ("instagram.com").
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

// Link de rede social que entra na fileira de ícones: estilo botão (padrão)
// e URL reconhecida. Cartão/destaque escolhidos pela escola continuam cartão.
function socialOf(b: VitrineBlock): SocialNet | null {
  if (b.type !== 'link' || !isHttpUrl(b.config?.url)) return null
  if ((b.config?.style || 'button') !== 'button') return null
  return detectSocial(b.config.url)
}

function socialRow(items: VitrineBlock[]): string {
  return `<nav class="social" aria-label="Redes sociais">` + items.map(b => {
    const net = SOCIAL[socialOf(b)!]
    return `<a href="${esc(b.config.url)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer" `
      + `aria-label="${esc(b.config.label || net.label)}" title="${esc(b.config.label || net.label)}" style="background:${net.bg}">${net.svg}</a>`
  }).join('') + `</nav>`
}

function linkCard(b: VitrineBlock, featured: boolean, loading: 'eager' | 'lazy'): string {
  const c = b.config
  const net = detectSocial(c.url)
  const img = isHttpUrl(c.thumbnail_url)
    ? `<img src="${esc(c.thumbnail_url)}" alt="" loading="${featured ? loading : 'lazy'}" decoding="async">`
    // Sem imagem: quadro na cor da marca (rede) ou na cor principal.
    : `<span class="lph"${net ? ` style="background:${SOCIAL[net].bg};color:#fff"` : ''}>${net ? SOCIAL[net].svg : ICON.link}</span>`
  const body = `<span class="lbody"><span class="ltitle">${esc(c.label)}</span>`
    + (c.description ? `<span class="ldesc">${esc(c.description)}</span>` : '')
    + `<span class="ldom">${esc(domainOf(c.url))}</span></span>`
  return `<a class="${featured ? 'lfeat' : 'lcard'}" href="${esc(c.url)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">`
    + `<span class="limg">${img}</span>${body}${featured ? '' : '<span class="larrow" aria-hidden="true">→</span>'}</a>`
}

// Monta os blocos na ordem; 2+ links de rede social EM SEQUÊNCIA viram uma
// fileira de ícones (cada ícone conta clique no próprio bloco).
function renderBlocks(blocks: VitrineBlock[], preview: boolean): string {
  const out: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (socialOf(blocks[i])) {
      let j = i
      while (j + 1 < blocks.length && socialOf(blocks[j + 1])) j++
      if (j > i) { out.push(socialRow(blocks.slice(i, j + 1))); i = j; continue }
    }
    // Imagem grande nos 2 primeiros blocos (banner/destaque no topo) é o que
    // o celular mostra primeiro: carrega na hora; o resto fica "lazy".
    const html = renderBlock(blocks[i], preview, out.length < 2)
    if (html) out.push(html)
  }
  return out.join('\n')
}

function renderBlock(b: VitrineBlock, preview = false, eager = false): string {
  const c = b.config || {}
  const loading = eager ? 'eager' : 'lazy'
  switch (b.type) {
    case 'link': {
      if (!isHttpUrl(c.url)) return ''
      if (c.style === 'card' || c.style === 'featured') return linkCard(b, c.style === 'featured', loading)
      // Rede social sozinha (sem outra rede ao lado): botão normal do tema com
      // o ícone da rede. Em sequência, vira fileira de ícones (renderBlocks).
      const net = detectSocial(c.url)
      const thumb = isHttpUrl(c.thumbnail_url)
        ? `<img class="thumb" src="${esc(c.thumbnail_url)}" alt="" loading="lazy">`
        : net ? SOCIAL[net].svg : ICON.link
      return button(b.id, c.url, c.label, thumb)
    }
    case 'banner': {
      if (!isHttpUrl(c.image_url)) return ''
      const ratio = c.aspect === '16:9' ? '16/9' : '3/1'
      const img = `<img src="${esc(c.image_url)}" alt="${esc(c.alt || '')}" style="aspect-ratio:${ratio}" loading="${loading}" decoding="async">`
      return isHttpUrl(c.link_url)
        ? `<a class="banner" href="${esc(c.link_url)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">${img}</a>`
        : `<figure class="banner">${img}</figure>`
    }
    case 'whatsapp': {
      const href = waMeLink(c.phone, c.message)
      return href ? button(b.id, href, c.label, ICON.whatsapp, 'wa') : ''
    }
    case 'enroll': {
      const href = c.mode === 'link' ? (isHttpUrl(c.url) ? c.url : null) : waMeLink(c.phone, c.message)
      return href ? button(b.id, href, c.label, c.mode === 'link' ? ICON.school : ICON.whatsapp, 'cta') : ''
    }
    case 'text': {
      if (!c.body) return ''
      return `<section class="card text">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}${paragraphs(c.body)}</section>`
    }
    case 'gallery': {
      const imgs = (Array.isArray(c.images) ? c.images : []).filter((i: any) => isHttpUrl(i?.url))
      if (!imgs.length) return ''
      const cls = c.layout === 'carousel' ? 'carousel' : 'grid'
      return `<section class="gallery ${cls}">` + imgs.map((i: any) =>
        `<figure><img src="${esc(i.url)}" alt="${esc(i.caption || '')}" loading="lazy">`
        + (i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : '') + '</figure>').join('') + '</section>'
    }
    case 'video': {
      const id = String(c.video_id || '')
      let src = ''
      if (c.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id)) src = `https://www.youtube-nocookie.com/embed/${id}`
      if (c.provider === 'vimeo' && /^[0-9]{6,12}$/.test(id)) src = `https://player.vimeo.com/video/${id}`
      if (!src) return ''
      // Prévia do editor (iframe em sandbox, sem o player funcionando):
      // miniatura do YouTube / quadro neutro do Vimeo com ícone de play.
      if (preview) {
        const thumb = c.provider === 'youtube'
          ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ''
        return `<section class="video">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}<div class="frame">${thumb}`
          + `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">`
          + `<span style="width:64px;height:44px;border-radius:12px;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center">`
          + `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#fff" d="M8 5v14l11-7z"/></svg></span></span></div></section>`
      }
      return `<section class="video">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}`
        + `<div class="frame"><iframe src="${src}" title="${esc(c.title || 'Vídeo')}" loading="lazy" `
        + `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>`
    }
    case 'map': {
      const addr = String(c.address || '').trim()
      if (!addr) return ''
      // "Nome da escola, endereço": o Google acha o lugar cadastrado e o pino
      // cai na escola. Só o endereço cai onde o Google estima o número da rua
      // (no Ágape, ~110 m ao lado). place_name vazio = só endereço.
      const place = typeof c.place_name === 'string' ? c.place_name.trim() : ''
      const q = encodeURIComponent(place ? `${place}, ${addr}` : addr)
      return `<section class="card map"><h2><span class="ic">${ICON.pin}</span>${esc(c.label || 'Onde estamos')}</h2>`
        + `<p>${esc(addr)}</p>`
        + `<div class="frame map-frame"><iframe src="https://www.google.com/maps?q=${q}&amp;output=embed" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
        + `<a class="link-inline" href="https://www.google.com/maps/search/?api=1&amp;query=${q}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">Como chegar →</a></section>`
    }
    case 'hours': {
      const days = (Array.isArray(c.days) ? c.days : [])
        .filter((d: any) => /^[0-6]$/.test(String(d?.dow)))
      if (!days.length && !c.note) return ''
      const order = [1, 2, 3, 4, 5, 6, 0]
      const rows = order.map(dow => {
        const d = days.find((x: any) => Number(x.dow) === dow)
        if (!d) return ''
        const val = d.closed ? 'Fechado'
          : (/^\d{2}:\d{2}$/.test(d.open) && /^\d{2}:\d{2}$/.test(d.close) ? `${esc(d.open)} – ${esc(d.close)}` : '')
        return val ? `<tr data-dow="${dow}"><th>${DAYS[dow]}</th><td>${val}</td></tr>` : ''
      }).join('')
      const data = days.map((d: any) => ({ dow: Number(d.dow), open: d.open, close: d.close, closed: !!d.closed }))
      return `<section class="card hours" data-hours="${esc(JSON.stringify(data))}">`
        + `<h2><span class="ic">${ICON.clock}</span>Horário de atendimento <span class="now" hidden></span></h2>`
        + (rows ? `<table>${rows}</table>` : '')
        + (c.note ? `<p class="note">${esc(c.note)}</p>` : '') + '</section>'
    }
    default:
      return ''
  }
}

// ── Página ──────────────────────────────────────────────────────────────────

const SHADOWS = { none: 'none', soft: '0 2px 10px rgba(0,0,0,.08)', strong: '0 10px 28px rgba(0,0,0,.18)' }
const GAPS = { compact: 8, normal: 12, relaxed: 18 }

function css(t: Theme): string {
  const solid = t.bgType === 'solid'
  const darkText = luminance(t.text) < 0.4
  const onPrimary = onColor(t.primary)
  // Cores derivadas: sobre fundo sólido, misturas opacas (como antes); sobre
  // gradiente/imagem, transparências que funcionam em qualquer ponto do fundo.
  const surface = solid ? mix(t.text, t.background, 0.04) : (darkText ? 'rgba(255,255,255,.86)' : 'rgba(15,23,42,.55)')
  const raised = solid ? (darkText ? '#FFFFFF' : mix(t.text, t.background, 0.08)) : surface
  const border = solid ? mix(t.text, t.background, 0.12) : alpha(t.text, 0.18)
  const muted = solid ? mix(t.text, t.background, 0.68) : alpha(t.text, 0.8)
  const soft = solid ? mix(t.primary, t.background, 0.14) : alpha(t.primary, 0.18)
  // Placa da logo: logo de escola quase sempre é feita pra fundo claro — em
  // tema escuro (texto claro) a placa é branca, senão a logo some no fundo.
  // Tema claro sólido mantém a placa na cor do fundo (igual a antes).
  const logoPlate = !darkText ? '#FFFFFF' : solid ? t.background : raised
  const logoRing = !darkText ? 'rgba(255,255,255,.25)' : solid ? t.background : 'rgba(255,255,255,.6)'
  const r = t.radius === 999 ? '999px' : `${t.radius}px`
  const rCard = t.radius === 999 ? '24px' : `${Math.max(t.radius, 8)}px`
  const sh = SHADOWS[t.shadow]
  const gap = GAPS[t.spacing]
  const lively = t.animation === 'lively'

  const btn: Record<ButtonStyle, string> = {
    filled:  `background:${t.primary};color:${onPrimary};border:2px solid ${t.primary};box-shadow:${sh};`,
    outline: `background:transparent;color:${t.text};border:2px solid ${t.primary};box-shadow:${sh};`,
    soft:    `background:${soft};color:${t.text};border:2px solid transparent;box-shadow:${sh};`,
    glass:   `background:${darkText ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.14)'};color:${t.text};`
           + `border:1px solid ${darkText ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.3)'};`
           + `-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);box-shadow:${sh};`,
    shadow:  `background:${t.primary};color:${onPrimary};border:2px solid ${t.text};box-shadow:4px 4px 0 ${t.text};`,
    minimal: `background:transparent;color:${t.text};border:0;border-bottom:1px solid ${border};border-radius:0;min-height:52px;padding:10px 4px;`,
  }
  // Hover: sem animação só muda a sombra; sutil sobe 1px; chamativa sobe 3px.
  const lift = t.animation === 'none' ? 0 : lively ? 3 : 1
  const hover = t.buttonStyle === 'shadow'
    ? `transform:translate(-2px,-2px);box-shadow:6px 6px 0 ${t.text}`
    : t.buttonStyle === 'minimal'
      ? `border-bottom-color:${t.primary}`
      : `transform:translateY(-${lift}px);box-shadow:${lively ? '0 12px 28px rgba(0,0,0,.18)' : '0 4px 14px rgba(0,0,0,.10)'}`

  const card = t.cardStyle === 'flat'
    ? `background:${surface};border:1px solid transparent;`
    : t.cardStyle === 'elevated'
      ? `background:${raised};border:1px solid transparent;box-shadow:${t.shadow === 'none' ? SHADOWS.soft : sh};`
      : `background:${surface};border:1px solid ${border};box-shadow:${sh};`

  const bgLayer = t.bgType === 'gradient'
    ? `linear-gradient(${t.bgAngle}deg,${t.background},${t.bgTo})`
    : t.bgType === 'image' && t.bgImage
      ? `linear-gradient(${t.bgOverlayTone === 'dark' ? `rgba(0,0,0,${t.bgOverlay / 100})` : `rgba(255,255,255,${t.bgOverlay / 100})`},`
        + `${t.bgOverlayTone === 'dark' ? `rgba(0,0,0,${t.bgOverlay / 100})` : `rgba(255,255,255,${t.bgOverlay / 100})`}),`
        + `url('${cssUrl(t.bgImage)}') center/cover no-repeat ${t.background}`
      : ''

  // Entrada dos blocos: só opacidade/transform (GPU), sem biblioteca.
  const enter = lively
    ? { from: 'translateY(18px) scale(.98)', dur: '.5s', ease: 'cubic-bezier(.2,.7,.2,1)' }
    : { from: 'translateY(8px)', dur: '.35s', ease: 'ease-out' }

  return `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:${t.background};color:${t.text};font-family:'${t.body}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
${bgLayer ? `.bgl{position:fixed;inset:0;z-index:-1;background:${bgLayer}}` : ''}
h1,h2{font-family:'${t.heading}','${t.body}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.wrap{max-width:560px;margin:0 auto;padding:0 16px 40px}
.cover{display:block;width:calc(100% + 32px);height:180px;margin:0 -16px;object-fit:cover;background:${soft}}
@media(min-width:600px){.cover{width:100%;margin:16px 0 0;border-radius:${rCard}}}
header{text-align:center;padding-top:24px}
.has-cover header{padding-top:0}
.logo{width:96px;height:96px;border-radius:${t.logoShape === 'rounded' ? '24px' : '50%'};object-fit:contain;padding:8px;background:${logoPlate};border:4px solid ${logoRing};box-shadow:0 2px 12px rgba(0,0,0,.08)}
.has-cover .logo{margin-top:-48px}
h1{font-size:${t.heading === 'DM Serif Display' || t.heading === 'Playfair Display' ? 28 : 24}px;line-height:1.25;margin:12px 0 4px;font-weight:${t.headingWeight};text-wrap:balance}
.bio{margin:0 auto;max-width:44ch;color:${muted};font-size:15px}
main{display:flex;flex-direction:column;gap:${gap}px;margin-top:${gap * 2}px}
.btn{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;border-radius:${r};text-decoration:none;font-weight:600;font-size:16px;${btn[t.buttonStyle]}transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease}
.btn:hover{${hover}}
.btn:active{transform:${t.buttonStyle === 'shadow' ? `translate(2px,2px);box-shadow:2px 2px 0 ${t.text}` : 'translateY(0)'}}
.btn:focus-visible,.link-inline:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}
.btn .lb{flex:1;text-align:${t.buttonStyle === 'minimal' ? 'left' : 'center'}}
.btn .ic{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center}
.btn .ic svg{width:22px;height:22px}
${t.buttonStyle === 'minimal' ? `.btn:not(.cta) .ic:last-child::after{content:'→';font-size:18px;color:${t.primary}}` : ''}
.btn .thumb{width:36px;height:36px;border-radius:${t.radius === 0 ? '0' : '8px'};object-fit:cover}
.btn.cta{min-height:64px;font-size:17px;background:${t.primary};color:${onPrimary};border:2px solid ${t.buttonStyle === 'shadow' ? t.text : t.primary};border-radius:${t.buttonStyle === 'minimal' ? rCard : r};padding:10px 14px}
${t.buttonStyle === 'minimal' ? '.btn.cta .lb{text-align:center}' : ''}
.card{${card}border-radius:${rCard};padding:16px 18px}
.card h2,.video h2{font-size:16px;margin:0 0 8px;display:flex;align-items:center;gap:8px;font-weight:${t.headingWeight === 400 ? 400 : 700}}
.card h2 .ic{display:inline-flex;width:20px;height:20px;color:${t.primary}}
.card h2 .ic svg{width:20px;height:20px}
.card p{margin:0 0 8px}.card p:last-child{margin-bottom:0}
.text p{white-space:normal}
.social{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;padding:4px 0}
.social a{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;${darkText ? '' : 'box-shadow:0 0 0 2px rgba(255,255,255,.22);'}transition:transform .15s ease}
.social a svg{width:24px;height:24px}
.social a:hover{transform:translateY(-${lift || 1}px) scale(1.05)}
.social a:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}
.lcard,.lfeat{${card}border-radius:${rCard};color:${t.text};text-decoration:none;transition:transform .15s ease,box-shadow .15s ease}
.lcard:hover,.lfeat:hover{transform:translateY(-${lift || 1}px)}
.lcard:focus-visible,.lfeat:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}
.lcard{display:flex;align-items:center;gap:14px;padding:10px 14px 10px 10px}
.lcard .limg{flex:none;width:64px;height:64px;border-radius:${t.radius === 0 ? 0 : 10}px;overflow:hidden}
.lfeat{display:block;overflow:hidden}
.lfeat .limg{display:block;aspect-ratio:16/9}
.limg img{display:block;width:100%;height:100%;object-fit:cover}
.lph{display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:${soft};color:${t.primary}}
.lph svg{width:28px;height:28px}
.lfeat .lph svg{width:44px;height:44px}
.lbody{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.lfeat .lbody{padding:12px 16px 14px}
.ltitle{font-weight:700;font-size:16px;line-height:1.3}
.ldesc{font-size:14px;color:${muted};line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ldom{font-size:12px;color:${muted};opacity:.85}
.larrow{flex:none;color:${t.primary};font-size:18px}
.banner{display:block;margin:0 -16px;padding:0}
.banner img{display:block;width:100%;object-fit:cover;background:${surface}}
@media(min-width:600px){.banner{margin:0}.banner img{border-radius:${rCard}}}
a.banner:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}
.gallery.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gallery.grid figure:only-child{grid-column:1/-1}
.gallery.carousel{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px;scrollbar-width:none}
.gallery.carousel::-webkit-scrollbar{display:none}
.gallery.carousel figure{flex:0 0 82%;scroll-snap-align:center}
.gallery figure{margin:0}
.gallery img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:${rCard};background:${surface}}
.gallery.carousel img{aspect-ratio:4/3}
.gallery figcaption{font-size:13px;color:${muted};margin-top:4px;text-align:center}
.frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:${rCard};overflow:hidden;background:${surface}}
.frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.map-frame{aspect-ratio:4/3;margin:8px 0 10px}
.link-inline{color:${t.text};font-weight:600;text-decoration:underline;text-decoration-color:${t.primary};text-underline-offset:3px}
.hours table{width:100%;border-collapse:collapse;font-size:15px}
.hours th{text-align:left;font-weight:500;padding:5px 0}
.hours td{text-align:right;padding:5px 0;font-variant-numeric:tabular-nums}
.hours tr+tr th,.hours tr+tr td{border-top:1px solid ${border}}
.hours tr.today th,.hours tr.today td{font-weight:700}
.hours .note{font-size:13px;color:${muted};margin-top:8px}
.now{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;background:${border}}
.now.open{background:#DCFCE7;color:#166534}.now.closed{background:#FEE2E2;color:#991B1B}
footer{margin-top:32px;text-align:center;font-size:12px;color:${muted}}
footer a{color:inherit;text-decoration:none;font-weight:600}
${t.animation !== 'none' ? `
html.anim header,html.anim main>*{opacity:0;transform:${enter.from};animation:rvsafe 0s 6s forwards}
html.anim header.in,html.anim main>.in{opacity:1;transform:none;animation:none;transition:opacity ${enter.dur} ${enter.ease} var(--d,0ms),transform ${enter.dur} ${enter.ease} var(--d,0ms)}
@keyframes rvsafe{to{opacity:1;transform:none}}
${lively ? `html.anim main>.btn.cta.in{animation:cta 2.4s ease-out .8s 3}
@keyframes cta{0%{box-shadow:0 0 0 0 ${alpha(t.primary, 0.45)}}100%{box-shadow:0 0 0 16px ${alpha(t.primary, 0)}}}` : ''}` : ''}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}.btn:hover{transform:none}html.anim header,html.anim main>*{opacity:1;transform:none}}
`
}

// Liga a animação antes da primeira pintura (no <head>), só se a pessoa não
// pediu menos movimento no aparelho. Sem JS, nada fica escondido.
const ANIM_HEAD = `<script>try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('anim')}catch(e){}</script>`

// Revela cabeçalho e blocos quando entram na tela, em cascata. Trava de
// segurança no CSS (rvsafe): se este script falhar, tudo aparece em 6 s.
function animScript(stagger: number): string {
  return `(function(){var h=document.documentElement;if(!h.classList.contains('anim'))return;
var els=[].slice.call(document.querySelectorAll('header,main>*'));
function show(e,k){e.style.setProperty('--d',(k*${stagger})+'ms');e.classList.add('in')}
if(!('IntersectionObserver' in window)){els.forEach(function(e,k){show(e,k)});return}
var io=new IntersectionObserver(function(es){var k=0;es.forEach(function(x){if(x.isIntersecting){show(x.target,k++);io.unobserve(x.target)}})},{rootMargin:'0px 0px -6% 0px'});
els.forEach(function(e){io.observe(e)})})();`
}

// Registro de visualização/clique + "aberto agora" do horário. Roda no
// navegador do visitante; falha em silêncio (nunca atrapalha o clique).
function trackingScript(pageId: string, supabaseUrl: string, anonKey: string): string {
  return `(function(){
var P=${jsonForScript(pageId)},U=${jsonForScript(supabaseUrl)},K=${jsonForScript(anonKey)};
function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c=='x'?r:(r&3|8)).toString(16)})}
var V;try{V=localStorage.getItem('aion_vitrine_vid');if(!V){V=uuid();localStorage.setItem('aion_vitrine_vid',V)}}catch(e){V=uuid()}
var q=new URLSearchParams(location.search),ref=null;
try{if(document.referrer){var h=new URL(document.referrer).hostname;if(h!==location.hostname)ref=h}}catch(e){}
var ua=navigator.userAgent,dev=/iPad|Tablet/i.test(ua)?'tablet':(/Mobi|Android|iPhone/i.test(ua)?'mobile':'desktop');
function send(b,ev){try{fetch(U+'/rest/v1/rpc/vitrine_track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:K,Authorization:'Bearer '+K},body:JSON.stringify({p_page_id:P,p_block_id:b,p_event:ev,p_visitor_id:V,p_referrer_host:ref,p_utm_source:q.get('utm_source'),p_utm_medium:q.get('utm_medium'),p_utm_campaign:q.get('utm_campaign'),p_device:dev})}).catch(function(){})}catch(e){}}
send(null,'view');
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[data-b]');if(a)send(a.getAttribute('data-b'),'click')},true);
try{var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),o={};p.forEach(function(x){o[x.type]=x.value});
var dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday),min=parseInt(o.hour,10)*60+parseInt(o.minute,10);
function m(s){var t=String(s||'').split(':');return parseInt(t[0],10)*60+parseInt(t[1],10)}
document.querySelectorAll('[data-hours]').forEach(function(s){var d=JSON.parse(s.getAttribute('data-hours')||'[]'),t=null;d.forEach(function(x){if(x.dow===dow)t=x});
var row=s.querySelector('tr[data-dow="'+dow+'"]');if(row)row.className='today';
var b=s.querySelector('.now');if(!b||!t)return;var open=!t.closed&&min>=m(t.open)&&min<m(t.close);
b.textContent=open?'Aberto agora':'Fechado agora';b.className='now '+(open?'open':'closed');b.hidden=false})}catch(e){}
})();`
}

export function renderVitrinePage(data: VitrinePublicData, opts: RenderOptions): string {
  const p = data.page
  const t = readTheme(p.theme)
  const name = (p.title || p.institution_name || 'Escola').trim()
  const desc = (p.seo_description || p.bio || `Links, contato e informações de ${name}.`).trim()
  const url = `${opts.siteUrl}/${p.slug}`
  const cover = isHttpUrl(p.cover_url) ? p.cover_url : null
  const logo = isHttpUrl(p.logo_url) ? p.logo_url : null
  const ogImage = cover || logo
  const blocks = renderBlocks(data.blocks || [], !!opts.preview)
  const script = !opts.preview && opts.supabaseUrl && opts.anonKey
    ? `<script>${trackingScript(p.id, opts.supabaseUrl, opts.anonKey)}</script>` : ''
  // Animação: página pública sempre; prévia do editor só quando pedida
  // ("Ver animação") — senão repetiria a cada tecla digitada.
  const animate = t.animation !== 'none' && (!opts.preview || !!opts.animatePreview)
  // Preview (iframe no editor): link abre em nova aba igual à página real;
  // <base target> garante isso também pro "Como chegar".
  const base = opts.preview ? '<base target="_blank">' : ''
  const themeColor = t.bgType === 'image' && t.bgOverlayTone === 'dark' ? '#000000' : t.background

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(name)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="${themeColor}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(desc)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="${cover ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
${logo ? `<link rel="icon" href="${esc(logo)}">` : ''}
${base}
${t.bgType === 'image' && t.bgImage ? `<link rel="preload" as="image" href="${esc(t.bgImage)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${esc(fontsHref(t.heading, t.body))}">
<style>${css(t)}</style>
${animate ? ANIM_HEAD : ''}
</head>
<body class="${cover ? 'has-cover' : ''}">
${t.bgType !== 'solid' ? '<div class="bgl" aria-hidden="true"></div>' : ''}
<div class="wrap">
${cover ? `<img class="cover" src="${esc(cover)}" alt="">` : ''}
<header>
${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo ${esc(name)}">` : ''}
<h1>${esc(name)}</h1>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
</header>
<main>
${blocks}
</main>
<footer>Página criada com <a href="${esc(opts.siteUrl)}/?utm_source=vitrine&amp;utm_medium=rodape" target="_blank" rel="noopener">Áion Edu</a></footer>
</div>
${animate ? `<script>${animScript(t.animation === 'lively' ? 70 : 40)}</script>` : ''}
${script}
</body>
</html>`
}

export function renderVitrineNotFound(siteUrl: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Página não encontrada — Áion Edu</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9FAFB;color:#1A2B4A;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;text-align:center;background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:40px 32px}
  h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#64748B;margin:0 0 20px;line-height:1.5}
  a{color:#00A896;font-weight:600;text-decoration:none}
</style></head>
<body><div class="card">
  <h1>Página não encontrada</h1>
  <p>Este endereço não existe ou a escola ainda não publicou a página dela.</p>
  <a href="${esc(siteUrl)}">Conhecer a Áion Edu →</a>
</div></body></html>`
}
