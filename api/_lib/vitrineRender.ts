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
  cover_video_url?: string | null   // capa em vídeo (MP4/WebM); cover_url vira o quadro de espera
  theme: Record<string, unknown> | null
  seo_description: string | null
  social_links?: unknown   // [{network, handle}] — fileira de redes do topo
  floating_block_id?: string | null   // bloco de WhatsApp que vira botão flutuante
  show_share?: boolean                // botão "compartilhar" (ausente = ligado)
  social_position?: 'top' | 'bottom'  // fileira de redes no topo ou no rodapé
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
  cardStyle: 'flat' | 'bordered' | 'elevated'; logoShape: 'circle' | 'rounded' | 'none'
  animation: 'none' | 'subtle' | 'lively'
  socialStyle: 'brand' | 'theme' | 'plain'
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
    logoShape:     oneOf('logo_shape', ['circle', 'rounded', 'none'] as const, 'circle'),
    animation:     oneOf('animation', ['none', 'subtle', 'lively'] as const, 'none'),
    socialStyle:   oneOf('social_style', ['brand', 'theme', 'plain'] as const, 'brand'),
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
  pdf:      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zm0 0v5h5M9 13h6M9 17h4"/></svg>',
  share:    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M7 8l5-5 5 5M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  contact:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10-2v6m3-3h-6"/></svg>',
}

// Dados da página que alguns blocos precisam (link do vCard).
interface BlockCtx { siteUrl: string; slug: string }

// "1234567" bytes → "1,2 MB"
function fmtSize(n: unknown): string {
  const b = Number(n)
  if (!Number.isFinite(b) || b <= 0) return ''
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

// ── Redes sociais ───────────────────────────────────────────────────────────
// Reconhecidas pela URL do bloco de link (nada disso fica no banco). Ícones:
// Simple Icons 16.33 (CC0, domínio público); o do LinkedIn é um "in"
// geométrico próprio — a marca pediu a retirada do Simple Icons.
export type SocialNet = 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'youtube' | 'linkedin' | 'x' | 'threads' | 'telegram'

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
  whatsapp: {
    label: "WhatsApp", hosts: ["wa.me","whatsapp.com"],
    bg: "#25D366",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z\"/></svg>",
  },
  threads: {
    label: "Threads", hosts: ["threads.net","threads.com"],
    bg: "#000000",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z\"/></svg>",
  },
  telegram: {
    label: "Telegram", hosts: ["t.me","telegram.me"],
    bg: "#26A5E4",
    svg: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z\"/></svg>",
  },
}

// Rede social de uma URL (host exato ou subdomínio: m.facebook.com,
// vm.tiktok.com, br.linkedin.com...). null = link comum.
export function detectSocial(url: unknown): SocialNet | null {
  if (typeof url !== 'string') return null
  let host: string
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
  for (const [k, n] of Object.entries(SOCIAL) as [SocialNet, (typeof SOCIAL)[SocialNet]][]) {
    if (n.hosts.some(h => host === h || host.endsWith('.' + h))) return k
  }
  return null
}

// ── Redes sociais do topo (vitrine_pages.social_links) ──────────────────────
// A escola digita só o perfil; o link é montado aqui. Mesmas regras de
// formato do banco (vitrine_pages_validate).
export const TOP_NETWORKS: SocialNet[] = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'youtube', 'linkedin', 'x', 'threads', 'telegram']
const HANDLE_RE = /^[A-Za-z0-9._-]{1,60}(\/[A-Za-z0-9._-]{1,60})?$/

export function socialUrl(net: SocialNet, handle: string): string | null {
  const h = String(handle || '')
  if (net === 'whatsapp') {
    if (!/^[0-9]{10,13}$/.test(h)) return null
    return `https://wa.me/${h.length <= 11 ? '55' + h : h}`
  }
  if (!HANDLE_RE.test(h)) return null
  switch (net) {
    case 'instagram': return `https://instagram.com/${h}`
    case 'facebook':  return `https://facebook.com/${h}`
    case 'tiktok':    return `https://tiktok.com/@${h}`
    // Canal antigo ("channel/UC…", "c/nome") vai como está; o resto é @nome.
    case 'youtube':   return /^(channel|c|user)\//.test(h) ? `https://youtube.com/${h}` : `https://youtube.com/@${h}`
    // Escola costuma ser página de empresa; perfil pessoal com "in/nome".
    case 'linkedin':  return /^(in|company|school)\//.test(h) ? `https://linkedin.com/${h}` : `https://linkedin.com/company/${h}`
    case 'x':         return `https://x.com/${h}`
    case 'threads':   return `https://threads.net/@${h}`
    case 'telegram':  return `https://t.me/${h}`
  }
  return null
}

// O que a escola digitou → perfil: aceita "@perfil", "perfil" ou a URL
// colada da própria rede (tira domínio, @, barras e parâmetros).
export function normalizeHandle(net: SocialNet, raw: string): string {
  let s = String(raw || '').trim()
  if (net === 'whatsapp') {
    const d = s.replace(/\D/g, '')
    return d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
  }
  if (/^(https?:\/\/)?([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\//i.test(s)) {
    try { s = new URL(/^https?:/i.test(s) ? s : `https://${s}`).pathname } catch { /* segue como texto */ }
  }
  s = s.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '').replace(/^@/, '')
  if (net === 'tiktok' || net === 'threads') s = s.replace(/^@/, '')
  if (net === 'youtube' && s.startsWith('@')) s = s.slice(1)
  return s.replace(/\/@/, '/').slice(0, 121)
}

function topSocialRow(links: unknown): string {
  const items = (Array.isArray(links) ? links : [])
    .map((l: any) => ({ net: l?.network as SocialNet, url: SOCIAL[l?.network as SocialNet] ? socialUrl(l.network, l.handle) : null }))
    .filter(x => x.url)
  if (!items.length) return ''
  return `<nav class="social top" aria-label="Redes sociais">` + items.map(({ net, url }) =>
    `<a href="${esc(url)}" data-s="${net}" target="_blank" rel="noopener noreferrer" aria-label="${SOCIAL[net].label}" title="${SOCIAL[net].label}" `
    + `style="--brand:${SOCIAL[net].bg}">${SOCIAL[net].svg}</a>`).join('') + `</nav>`
}

// ── Blocos ──────────────────────────────────────────────────────────────────

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEK = [1, 2, 3, 4, 5, 6, 0]   // semana começando na segunda

interface HoursDay { dow: number; open?: string; close?: string; closed: boolean }

// Dias seguidos (seg→dom) com o mesmo horário viram um grupo: [[1..5],[6,0]].
function groupDays(days: HoursDay[]): number[][] {
  const out: number[][] = []
  const key = (d: HoursDay) => (d.closed ? 'x' : `${d.open}-${d.close}`)
  for (const dow of WEEK) {
    const d = days.find(x => x.dow === dow)
    if (!d) continue
    const last = out[out.length - 1]
    const prev = last && days.find(x => x.dow === last[last.length - 1])
    if (last && prev && key(prev) === key(d) && WEEK.indexOf(last[last.length - 1]) === WEEK.indexOf(dow) - 1) last.push(dow)
    else out.push([dow])
  }
  return out
}

// Dia da semana e minuto do dia no horário de Brasília (a escola atende em
// horário local; o servidor e o celular podem estar em outro fuso).
function spNow(date: Date): { dow: number; min: number } {
  try {
    const o: Record<string, string> = {}
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).forEach(p => { o[p.type] = p.value })
    return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday), min: parseInt(o.hour, 10) * 60 + parseInt(o.minute, 10) }
  } catch { return { dow: date.getDay(), min: date.getHours() * 60 + date.getMinutes() } }
}

// Situação agora + frase curta. AUTOCONTIDA de propósito: vai como texto
// (toString) pro script da página, que refaz a conta no navegador — mesma
// regra nos dois lados.
function hoursStatus(days: { dow: number; open?: string; close?: string; closed: boolean }[], dow: number, min: number): { open: boolean; text: string } {
  const names = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const m = (s?: string) => { const t = String(s || '').split(':'); return parseInt(t[0], 10) * 60 + parseInt(t[1], 10) }
  const get = (d: number) => { for (let i = 0; i < days.length; i++) if (days[i].dow === d && !days[i].closed) return days[i]; return null }
  const t = get(dow)
  if (t && min >= m(t.open) && min < m(t.close)) return { open: true, text: 'Aberto agora · fecha às ' + t.close }
  if (t && min < m(t.open)) return { open: false, text: 'Fechado agora · abre hoje às ' + t.open }
  for (let k = 1; k <= 7; k++) {
    const d = (dow + k) % 7, n = get(d)
    if (n) return { open: false, text: 'Fechado agora · abre ' + (k === 1 ? 'amanhã' : names[d]) + ' às ' + n.open }
  }
  return { open: false, text: 'Fechado' }
}

// 1234567.5 → "1.234.567,5" (sem depender do Intl do servidor).
function fmtNum(v: number, dec: number): string {
  const [i, f] = v.toFixed(dec).split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (f ? ',' + f : '')
}

// Efeito do botão (config.effect, lista fechada no banco): vira classe.
const fx = (c: Record<string, any>) => (['pulse', 'shine', 'shake'].includes(c?.effect) ? ` fx-${c.effect}` : '')

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

// Link que a escola marcou como "Ícone" e cuja URL é de rede reconhecida.
// Ícones em sequência dividem a mesma fileira. Botão continua botão
// (nada de conversão automática); ícone com URL que não é de rede cai pra
// botão.
function socialOf(b: VitrineBlock): SocialNet | null {
  if (b.type !== 'link' || !isHttpUrl(b.config?.url)) return null
  if (b.config?.style !== 'icon') return null
  return detectSocial(b.config.url)
}

function socialRow(items: VitrineBlock[]): string {
  return `<nav class="social" aria-label="Redes sociais">` + items.map(b => {
    const net = SOCIAL[socialOf(b)!]
    return `<a href="${esc(b.config.url)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer" `
      + `aria-label="${esc(b.config.label || net.label)}" title="${esc(b.config.label || net.label)}" style="--brand:${net.bg}">${net.svg}</a>`
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

// Foto redonda da pessoa (depoimento/equipe); sem foto, as iniciais.
function avatar(url: unknown, name: string, loading: 'eager' | 'lazy'): string {
  if (isHttpUrl(url)) return `<img class="av" src="${esc(url)}" alt="" loading="${loading}" decoding="async">`
  const ini = String(name || '').trim().split(/\s+/).filter(Boolean)
  const txt = ini.length > 1 ? ini[0][0] + ini[ini.length - 1][0] : (ini[0] || '?').slice(0, 2)
  return `<span class="av ini" aria-hidden="true">${esc(txt.toUpperCase())}</span>`
}

// FAQ no formato que o Google lê (FAQPage). Só na página pública; todas as
// perguntas da página num único bloco de dados.
function faqJsonLd(blocks: VitrineBlock[]): string {
  const qs = blocks.filter(b => b.type === 'faq' && Array.isArray(b.config?.items))
    .flatMap(b => b.config.items).filter((i: any) => i?.q && i?.a)
  if (!qs.length) return ''
  const data = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: qs.map((i: any) => ({ '@type': 'Question', name: String(i.q), acceptedAnswer: { '@type': 'Answer', text: String(i.a) } })),
  }
  return `<script type="application/ld+json">${jsonForScript(data)}</script>`
}

// Vídeo leve: no clique, troca a miniatura pelo player do YouTube já tocando.
// Ctrl/Cmd/botão do meio mantêm o comportamento normal do link. O clique
// continua contando (o registro escuta na fase de captura, antes daqui).
const VIDEO_SCRIPT = `document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[data-yt]');
if(!a||e.defaultPrevented||e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;var id=a.getAttribute('data-yt');if(!/^[A-Za-z0-9_-]{11}$/.test(id))return;e.preventDefault();
var f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&playsinline=1&rel=0';f.title=a.getAttribute('aria-label')||'Vídeo';
f.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';f.allowFullscreen=true;
var d=document.createElement('div');d.className='frame';d.appendChild(f);a.parentNode.replaceChild(d,a)});`

// Capa em vídeo: quem pediu menos movimento ou está economizando dados fica
// só com o quadro de espera (a imagem de capa), sem baixar o vídeo todo.
const COVER_SCRIPT = `(function(){var v=document.querySelector('video.cover');if(!v)return;var c=navigator.connection;
try{if(matchMedia('(prefers-reduced-motion: reduce)').matches||(c&&c.saveData)){v.removeAttribute('autoplay');v.preload='none';v.pause()}}catch(e){}})();`

// WhatsApp flutuante: some enquanto o bloco de origem está na tela (evita
// dois botões iguais lado a lado) e volta ao rolar.
const FAB_SCRIPT = `(function(){var f=document.querySelector('.fab');if(!f||!('IntersectionObserver' in window))return;
var src=document.querySelector('main [data-b="'+f.getAttribute('data-b')+'"]');if(!src)return;
new IntersectionObserver(function(es){es.forEach(function(x){f.classList.toggle('off',x.isIntersecting)})},{threshold:0.4}).observe(src)})();`

// Compartilhar: menu nativo do celular; sem ele (computador), copia o link e
// avisa. Cancelar o menu não é erro.
const SHARE_SCRIPT = `(function(){var b=document.querySelector('.share'),t=document.querySelector('.toast');if(!b)return;b.hidden=false;var tm;
function say(m){if(!t)return;t.textContent=m;t.hidden=false;t.classList.add('in');clearTimeout(tm);tm=setTimeout(function(){t.classList.remove('in');setTimeout(function(){t.hidden=true},250)},2200)}
b.addEventListener('click',function(){var u=b.getAttribute('data-url'),ti=b.getAttribute('data-title');
if(navigator.share){navigator.share({title:ti,url:u}).catch(function(){});return}
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(u).then(function(){say('Link copiado')},function(){say(u)})}else say(u)})})();`

// Mapa com várias unidades: mostra os botões "Ver no mapa" e troca o mapa.
const MAP_SCRIPT = `document.querySelectorAll('.map.multi').forEach(function(s){var f=s.querySelector('iframe');
s.querySelectorAll('.unit').forEach(function(li){var bt=li.querySelector('.see');if(!bt)return;bt.hidden=false;
bt.addEventListener('click',function(){f.src=li.getAttribute('data-embed');s.querySelectorAll('.unit').forEach(function(o){o.classList.toggle('on',o===li);o.querySelector('.see').setAttribute('aria-pressed',o===li?'true':'false')})})})});`

// Monta os blocos na ordem; links marcados como "Ícone" em sequência dividem
// uma fileira (um sozinho vira fileira de um). Cada ícone conta clique no
// próprio bloco.
function renderBlocks(blocks: VitrineBlock[], preview: boolean, ctx: BlockCtx): string {
  const out: string[] = []
  for (let i = 0; i < blocks.length; i++) {
    if (socialOf(blocks[i])) {
      let j = i
      while (j + 1 < blocks.length && socialOf(blocks[j + 1])) j++
      out.push(socialRow(blocks.slice(i, j + 1))); i = j; continue
    }
    // Imagem grande nos 2 primeiros blocos (banner/destaque no topo) é o que
    // o celular mostra primeiro: carrega na hora; o resto fica "lazy".
    const html = renderBlock(blocks[i], preview, out.length < 2, ctx)
    if (html) out.push(html)
  }
  return out.join('\n')
}

function renderBlock(b: VitrineBlock, preview = false, eager = false, ctx: BlockCtx = { siteUrl: '', slug: '' }): string {
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
      return button(b.id, c.url, c.label, thumb, fx(c))
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
      return href ? button(b.id, href, c.label, ICON.whatsapp, 'wa' + fx(c)) : ''
    }
    case 'enroll': {
      const href = c.mode === 'link' ? (isHttpUrl(c.url) ? c.url : null) : waMeLink(c.phone, c.message)
      return href ? button(b.id, href, c.label, c.mode === 'link' ? ICON.school : ICON.whatsapp, 'cta' + fx(c)) : ''
    }
    case 'text': {
      if (!c.body) return ''
      // Estilo por classe (listas fechadas, validadas no banco): tamanho,
      // peso e cor do título, tamanho do texto, alinhamento, com/sem cartão.
      const pick = (v: unknown, list: string[], def: string) => (list.includes(v as string) ? v as string : def)
      const cls = [
        'text',
        pick(c.surface, ['card', 'plain'], 'card') === 'card' ? 'card' : 'plain',
        `ts-${pick(c.title_size, ['sm', 'md', 'lg'], 'md')}`,
        `tw-${pick(c.title_weight, ['regular', 'semibold', 'bold'], 'bold')}`,
        `bs-${pick(c.body_size, ['sm', 'md', 'lg'], 'md')}`,
        pick(c.align, ['left', 'center'], 'left') === 'center' ? 'center' : '',
        pick(c.title_color, ['text', 'primary'], 'text') === 'primary' ? 'tc-primary' : '',
      ].filter(Boolean).join(' ')
      return `<section class="${cls}">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}${paragraphs(c.body)}</section>`
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
      const yt = c.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id)
      const vm = c.provider === 'vimeo' && /^[0-9]{6,12}$/.test(id)
      if (!yt && !vm) return ''
      const vertical = c.format === '9:16'
      const cls = ['video', c.size === 'featured' ? 'feat' : '', vertical ? 'vert' : ''].filter(Boolean).join(' ')
      const head = c.title ? `<h2>${esc(c.title)}</h2>` : ''
      const foot = c.description ? `<p class="vdesc">${esc(c.description)}</p>` : ''
      const play = `<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="#fff" d="M8 5v14l11-7z"/></svg></span>`
      // YouTube "leve": só a miniatura (i.ytimg, ~20 KB) + link pro vídeo.
      // O player (~1 MB de script) só carrega no clique, trocado pelo script
      // da página (videoScript); sem JS, o link abre o YouTube. hqdefault tem
      // faixas pretas (4:3): object-fit:cover corta exatamente no vídeo, seja
      // 16:9 ou vertical.
      if (yt) {
        const watch = vertical ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`
        return `<section class="${cls}">${head}`
          + `<a class="frame vlite" href="${watch}" data-b="${esc(b.id)}" data-yt="${id}" target="_blank" rel="noopener noreferrer" aria-label="Assistir: ${esc(c.title || 'vídeo')}">`
          + `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="${loading}" decoding="async">${play}</a>${foot}</section>`
      }
      // Vimeo: sem miniatura pública sem API — na prévia, quadro neutro;
      // na página, o player do Vimeo (leve o bastante, só carrega perto da tela).
      if (preview) return `<section class="${cls}">${head}<div class="frame">${play}</div>${foot}</section>`
      return `<section class="${cls}">${head}`
        + `<div class="frame"><iframe src="https://player.vimeo.com/video/${id}" title="${esc(c.title || 'Vídeo')}" loading="lazy" `
        + `allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>${foot}</section>`
    }
    case 'faq': {
      const items = (Array.isArray(c.items) ? c.items : []).filter((i: any) => i?.q && i?.a)
      if (!items.length) return ''
      return `<section class="card faq"><h2>${esc(c.title || 'Perguntas frequentes')}</h2>`
        + items.map((i: any) => `<details><summary>${esc(i.q)}</summary><div class="ans">${paragraphs(i.a)}</div></details>`).join('')
        + '</section>'
    }
    case 'testimonials': {
      const items = (Array.isArray(c.items) ? c.items : []).filter((i: any) => i?.quote && i?.name)
      if (!items.length) return ''
      const row = items.map((i: any) => {
        const n = Number(i.rating)
        const stars = n >= 1 && n <= 5
          ? `<span class="stars" role="img" aria-label="Nota ${n} de 5">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>` : ''
        return `<figure class="tcard">${stars}<blockquote>${esc(i.quote)}</blockquote>`
          + `<figcaption>${avatar(i.photo_url, i.name, 'lazy')}<span><b>${esc(i.name)}</b>${i.role ? `<small>${esc(i.role)}</small>` : ''}</span></figcaption></figure>`
      }).join('')
      return `<section class="tst${items.length === 1 ? ' one' : ''}">${c.title ? `<h2 class="sh">${esc(c.title)}</h2>` : ''}<div class="hrow">${row}</div></section>`
    }
    case 'team': {
      const items = (Array.isArray(c.items) ? c.items : []).filter((i: any) => i?.name)
      if (!items.length) return ''
      const carousel = c.layout === 'carousel' && items.length > 1
      const cards = items.map((i: any) => `<figure class="person">${avatar(i.photo_url, i.name, 'lazy')}`
        + `<figcaption><b>${esc(i.name)}</b>${i.role ? `<small>${esc(i.role)}</small>` : ''}${i.bio ? `<span class="pbio">${esc(i.bio)}</span>` : ''}</figcaption></figure>`).join('')
      return `<section class="team">${c.title ? `<h2 class="sh">${esc(c.title)}</h2>` : ''}<div class="${carousel ? 'hrow' : 'tgrid'}">${cards}</div></section>`
    }
    case 'map': {
      const addr = String(c.address || '').trim()
      if (!addr) return ''
      // "Nome da escola, endereço": o Google acha o lugar cadastrado e o pino
      // cai na escola. Só o endereço cai onde o Google estima o número da rua
      // (no Ágape, ~110 m ao lado). place_name vazio = só endereço.
      const query = (place: unknown, a: string) => {
        const p = typeof place === 'string' ? place.trim() : ''
        return encodeURIComponent(p ? `${p}, ${a}` : a)
      }
      const q = query(c.place_name, addr)
      const embed = (qq: string) => `https://www.google.com/maps?q=${qq}&amp;output=embed`
      const route = (qq: string) => `https://www.google.com/maps/search/?api=1&amp;query=${qq}`
      const head = `<h2><span class="ic">${ICON.pin}</span>${esc(c.label || 'Onde estamos')}</h2>`
      const frame = `<div class="frame map-frame"><iframe src="${embed(q)}" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
      const units = (Array.isArray(c.units) ? c.units : [])
        .filter((u: any) => u?.name && String(u?.address || '').trim().length >= 5)
      if (!units.length) {
        return `<section class="card map">${head}<p>${esc(addr)}</p>${frame}`
          + `<a class="link-inline" href="${route(q)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">Como chegar →</a></section>`
      }
      // Várias unidades: um mapa só (o da unidade escolhida) e a lista com
      // endereço + "Como chegar" de cada uma. "Ver no mapa" troca o mapa
      // (script da página); sem JS, a lista e os links continuam valendo.
      const all = [{ name: c.unit_name || 'Unidade principal', address: addr, q }]
        .concat(units.map((u: any) => ({ name: u.name, address: String(u.address).trim(), q: query(u.place_name, String(u.address).trim()) })))
      const rows = all.map((u, i) => `<li class="unit${i === 0 ? ' on' : ''}" data-embed="${embed(u.q)}">`
        + `<span class="ub"><b>${esc(u.name)}</b><span>${esc(u.address)}</span></span>`
        + `<span class="ua"><button type="button" class="see" hidden aria-pressed="${i === 0}">Ver no mapa</button>`
        + `<a class="link-inline" href="${route(u.q)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer" aria-label="Como chegar: ${esc(u.name)}">Como chegar →</a></span></li>`).join('')
      return `<section class="card map multi">${head}${frame}<ul class="units">${rows}</ul></section>`
    }
    case 'pdf': {
      if (!isHttpUrl(c.file_url)) return ''
      const meta = ['PDF', fmtSize(c.file_size)].filter(Boolean).join(' · ')
      if (c.style === 'card') {
        return `<a class="lcard pdf" href="${esc(c.file_url)}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">`
          + `<span class="limg"><span class="lph">${ICON.pdf}</span></span>`
          + `<span class="lbody"><span class="ltitle">${esc(c.label)}</span>`
          + (c.description ? `<span class="ldesc">${esc(c.description)}</span>` : '')
          + `<span class="ldom">${esc(meta)}</span></span><span class="larrow" aria-hidden="true">↓</span></a>`
      }
      return button(b.id, c.file_url, c.label, ICON.pdf, fx(c))
    }
    case 'contact': {
      if (!c.label || !ctx.slug) return ''
      // O .vcf é gerado na hora (api/public?route=vcard) com os dados do bloco.
      // Na página, caminho relativo (mesma origem: o "download" vale); na
      // prévia (iframe srcdoc, sem origem), o endereço completo.
      const href = `${preview ? ctx.siteUrl : ''}/api/public?route=vcard&amp;slug=${encodeURIComponent(ctx.slug)}&amp;b=${encodeURIComponent(b.id)}`
      return `<a class="btn${fx(c)}" href="${href}" data-b="${esc(b.id)}" download>`
        + `<span class="ic">${ICON.contact}</span><span class="lb">${esc(c.label)}</span><span class="ic"></span></a>`
    }
    case 'hours': {
      const HHMM = /^\d{2}:\d{2}$/
      const data: HoursDay[] = (Array.isArray(c.days) ? c.days : [])
        .filter((d: any) => /^[0-6]$/.test(String(d?.dow)) && (d.closed || (HHMM.test(d.open) && HHMM.test(d.close))))
        .map((d: any) => ({ dow: Number(d.dow), open: d.open, close: d.close, closed: !!d.closed }))
      if (!data.length && !c.note) return ''
      const layout = c.layout === 'compact' || c.layout === 'today' ? c.layout : 'table'
      // Linhas: um dia por linha (tabela) ou dias seguidos com o mesmo
      // horário juntos ("Seg a Sex"). data-dow lista os dias da linha (o
      // script marca a de hoje).
      const groups = layout === 'table'
        ? WEEK.filter(dow => data.some(d => d.dow === dow)).map(dow => [dow])
        : groupDays(data)
      const val = (d: HoursDay) => (d.closed ? 'Fechado' : `${esc(d.open)} – ${esc(d.close)}`)
      const { dow: today, min } = spNow(new Date())
      const rows = groups.map(g => {
        const d = data.find(x => x.dow === g[0])!
        const name = g.length === 1 ? DAYS[g[0]] : `${DAY_SHORT[g[0]]} a ${DAY_SHORT[g[g.length - 1]]}`
        return `<tr data-dow="${g.join(' ')}"${g.includes(today) ? ' class="today"' : ''}><th>${name}</th><td>${val(d)}</td></tr>`
      }).join('')
      // "Aberto agora": calculado já na renderização (prévia, sem JS) e
      // refeito no navegador (a página fica até ~10 min no cache).
      const st = data.length ? hoursStatus(data, today, min) : null
      const badge = st && layout !== 'today' ? `<span class="now ${st.open ? 'open' : 'closed'}">${st.open ? 'Aberto agora' : 'Fechado agora'}</span>` : ''
      const table = rows ? `<table>${rows}</table>` : ''
      const body = layout === 'today' && st
        ? `<p class="htoday ${st.open ? 'open' : 'closed'}"><span class="dot" aria-hidden="true"></span><span class="ht">${esc(st.text)}</span></p>`
          + `<details class="hweek"><summary>Ver horários da semana</summary>${table}</details>`
        : table
      return `<section class="card hours ${layout}" data-hours="${esc(JSON.stringify(data))}">`
        + `<h2><span class="ic">${ICON.clock}</span>Horário de atendimento ${badge}</h2>`
        + body + (c.note ? `<p class="note">${esc(c.note)}</p>` : '') + '</section>'
    }
    case 'stats': {
      const items = (Array.isArray(c.items) ? c.items : [])
        .filter((i: any) => typeof i?.value === 'number' && Number.isFinite(i.value) && i.value >= 0 && i?.label)
      if (!items.length) return ''
      const n = items.length
      const cols = n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3
      const animate = c.animate !== false
      // Tamanho do número: o maior que cabe na coluna (em 390 px de tela)
      // pro valor mais comprido do bloco — dígito ≈ 0,6em, prefixo/sufixo
      // em 0,62 do tamanho.
      const units = Math.max(...items.map((i: any) =>
        fmtNum(i.value, Number.isInteger(i.value) ? 0 : 1).length + 0.62 * (String(i.prefix || '').length + String(i.suffix || '').length)))
      const avail = { 1: 300, 2: 140, 3: 88 }[cols]!
      const fs = Math.max(16, Math.min({ 1: 40, 2: 32, 3: 26 }[cols]!, Math.floor(avail / (units * 0.6))))
      const cells = items.map((i: any) => {
        const dec = Number.isInteger(i.value) ? 0 : 1
        return `<div class="stat"><span class="sv">${i.prefix ? `<span class="sa">${esc(i.prefix)}</span>` : ''}`
          + `<b${animate ? ` data-v="${i.value}" data-d="${dec}"` : ''}>${fmtNum(i.value, dec)}</b>`
          + `${i.suffix ? `<span class="sa">${esc(i.suffix)}</span>` : ''}</span><span class="sl">${esc(i.label)}</span></div>`
      }).join('')
      return `<section class="card stats">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}<div class="sgrid c${cols}" style="--fs:${fs}px">${cells}</div></section>`
    }
    default:
      return ''
  }
}

// ── Página ──────────────────────────────────────────────────────────────────

// Espaço entre blocos (theme.spacing). Um pouco mais de respiro que a v1,
// na escala de espaçamento do painel do Áion.
const GAPS = { compact: 10, normal: 14, relaxed: 20 }

// Sombras do design system do Áion (src/index.css: --shadow-sm/md/lg): duas
// camadas, a maior no tom da cor principal (no painel, o verde do Áion; aqui,
// a cor da escola). Em tema escuro, sombra neutra mais forte (tom colorido
// some no fundo escuro).
function shadowScale(primary: string, darkText: boolean) {
  return darkText
    ? {
        sm: `0 1px 3px ${alpha(primary, 0.08)},0 1px 2px rgba(15,23,42,.05)`,
        md: `0 4px 16px ${alpha(primary, 0.12)},0 2px 4px rgba(15,23,42,.05)`,
        lg: `0 12px 32px ${alpha(primary, 0.16)},0 4px 8px rgba(15,23,42,.06)`,
      }
    : { sm: '0 1px 2px rgba(0,0,0,.18)', md: '0 6px 20px rgba(0,0,0,.22)', lg: '0 14px 36px rgba(0,0,0,.30)' }
}

function css(t: Theme): string {
  const solid = t.bgType === 'solid'
  const darkText = luminance(t.text) < 0.4
  const onPrimary = onColor(t.primary)
  // Cores derivadas: sobre fundo sólido, misturas opacas (como antes); sobre
  // gradiente/imagem, transparências que funcionam em qualquer ponto do fundo.
  // Texto claro sobre gradiente: vidro claro (fica leve sobre a cor); sobre
  // foto, vidro escuro (a foto pode ter áreas claras atrás do texto).
  const surface = solid ? mix(t.text, t.background, 0.04)
    : darkText ? 'rgba(255,255,255,.86)'
    : t.bgType === 'image' ? 'rgba(15,23,42,.42)' : 'rgba(255,255,255,.12)'
  const raised = solid ? (darkText ? '#FFFFFF' : mix(t.text, t.background, 0.08)) : surface
  const border = solid ? mix(t.text, t.background, 0.12) : alpha(t.text, 0.18)
  // Borda fina dos cartões (acabamento): sobre fundo sólido, a borda do tema;
  // sobre gradiente/imagem, um fio de luz.
  const edge = solid ? border : darkText ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.16)'
  const glass = solid ? '' : '-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);'
  const SH = shadowScale(t.primary, darkText)
  const muted = solid ? mix(t.text, t.background, 0.68) : alpha(t.text, 0.8)
  const soft = solid ? mix(t.primary, t.background, 0.14) : alpha(t.primary, 0.18)
  // Cor dos detalhes (ícones, "+", aspas, iniciais, contorno de foco): a
  // principal, ou a do texto quando a principal quase some no fundo (ex.:
  // azul sobre gradiente azul). No gradiente, vale o pior dos dois extremos.
  const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const minRatio = Math.min(ratio(t.primary, t.background), t.bgType === 'gradient' ? ratio(t.primary, t.bgTo) : Infinity)
  const accent = minRatio >= 2 ? t.primary : t.text
  const accentSoft = accent === t.primary ? soft : solid ? mix(t.text, t.background, 0.12) : alpha(t.text, 0.16)
  // Placa da logo: logo de escola quase sempre é feita pra fundo claro — em
  // tema escuro (texto claro) a placa é branca, senão a logo some no fundo.
  // Tema claro sólido mantém a placa na cor do fundo (igual a antes).
  const logoPlate = !darkText ? '#FFFFFF' : solid ? t.background : raised
  const logoRing = !darkText ? 'rgba(255,255,255,.25)' : solid ? t.background : 'rgba(255,255,255,.6)'
  const r = t.radius === 999 ? '999px' : `${t.radius}px`
  // Raios na escala do Áion (--radius-sm/md/lg/xl = 8/12/16/20): cartão um
  // degrau acima do botão; mídia dentro de cartão, 12.
  const rCard = t.radius === 999 ? '24px' : t.radius === 16 ? '20px' : t.radius === 8 ? '12px' : '8px'
  const rInner = t.radius === 0 ? '4px' : '12px'
  const sh = t.shadow === 'none' ? 'none' : t.shadow === 'soft' ? SH.md : SH.lg
  const gap = GAPS[t.spacing]
  const lively = t.animation === 'lively'
  // Botão cheio nunca fica "chapado": sem sombra escolhida, a menor do Áion.
  const btnSh = t.shadow === 'none' ? SH.sm : sh
  const ease = 'cubic-bezier(.4,0,.2,1)'   // --transition do Áion

  const btn: Record<ButtonStyle, string> = {
    filled:  `background:${t.primary};color:${onPrimary};border:2px solid ${t.primary};box-shadow:${btnSh};`,
    outline: `background:transparent;color:${t.text};border:2px solid ${t.primary};box-shadow:${sh};`,
    soft:    `background:${soft};color:${t.text};border:2px solid transparent;box-shadow:${btnSh};`,
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
      : `transform:translateY(-${lift}px);box-shadow:${lively ? SH.lg : SH.md}`

  // Cartões: plano = só a superfície; com borda = superfície clara + fio +
  // sombra mínima; elevado = superfície + sombra média (padrão dos cartões do
  // painel do Áion).
  const card = t.cardStyle === 'flat'
    ? `background:${surface};border:1px solid ${solid ? 'transparent' : edge};${glass}`
    : t.cardStyle === 'elevated'
      ? `background:${raised};border:1px solid ${solid ? 'transparent' : edge};box-shadow:${t.shadow === 'none' ? SH.md : sh};${glass}`
      : `background:${solid && darkText ? raised : surface};border:1px solid ${edge};box-shadow:${t.shadow === 'none' ? SH.sm : sh};${glass}`

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
body{margin:0;background:${t.background};color:${t.text};font-family:'${t.body}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.55;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
${bgLayer ? `.bgl{position:fixed;inset:0;z-index:-1;background:${bgLayer}}` : ''}
h1,h2{font-family:'${t.heading}','${t.body}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:-.01em}
.wrap{max-width:560px;margin:0 auto;padding:0 16px 32px}
.cover{display:block;width:calc(100% + 32px);height:200px;margin:0 -16px;object-fit:cover;background:${soft}}
@media(min-width:600px){.cover{width:100%;margin:16px 0 0;border-radius:${rCard};box-shadow:${SH.md}}}
header{text-align:center;padding-top:36px}
.has-cover header{padding-top:0}
${t.logoShape === 'none'
  // Sem moldura: a imagem "flutua" (PNG transparente), maior e sem placa.
  ? `.logo{display:block;margin:0 auto;width:auto;height:auto;max-width:220px;max-height:112px;object-fit:contain}
.has-cover .logo{margin-top:-40px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.18))}`
  : `.logo{width:96px;height:96px;border-radius:${t.logoShape === 'rounded' ? '24px' : '50%'};object-fit:contain;padding:8px;background:${logoPlate};border:4px solid ${logoRing};box-shadow:${SH.md}}
.has-cover .logo{margin-top:-48px}`}
h1{font-size:${t.heading === 'DM Serif Display' || t.heading === 'Playfair Display' ? 30 : 26}px;line-height:1.2;margin:16px 0 6px;font-weight:${t.headingWeight};letter-spacing:-.02em;text-wrap:balance}
.bio{margin:0 auto;max-width:40ch;color:${muted};font-size:15px;line-height:1.55;text-wrap:pretty}
main{display:flex;flex-direction:column;gap:${gap}px;margin-top:${Math.max(28, gap * 2)}px}
main>section:not(.card):not(.banner){margin:4px 0}
.btn{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 16px;border-radius:${r};text-decoration:none;font-weight:600;font-size:16px;letter-spacing:-.005em;${btn[t.buttonStyle]}transition:transform .18s ${ease},box-shadow .18s ${ease},border-color .18s ${ease},background-color .18s ${ease}}
.btn:hover{${hover}}
.btn:active{transform:${t.buttonStyle === 'shadow' ? `translate(2px,2px);box-shadow:2px 2px 0 ${t.text}` : 'translateY(0)'}}
.btn:focus-visible,.link-inline:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.btn .lb{flex:1;text-align:${t.buttonStyle === 'minimal' ? 'left' : 'center'}}
.btn .ic{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center}
.btn .ic svg{width:22px;height:22px}
${t.buttonStyle === 'minimal' ? `.btn:not(.cta) .ic:last-child::after{content:'→';font-size:18px;color:${t.primary}}` : ''}
.btn .thumb{width:36px;height:36px;border-radius:${t.radius === 0 ? '0' : '8px'};object-fit:cover}
.btn{position:relative}
.fx-pulse::before{content:'';position:absolute;inset:-2px;border-radius:inherit;border:2px solid ${alpha(accent, 0.55)};pointer-events:none;animation:fxpulse 2.4s ${ease} infinite}
@keyframes fxpulse{0%{opacity:.9;transform:scale(1)}70%,100%{opacity:0;transform:scale(1.08,1.3)}}
.fx-shine{overflow:hidden}
.fx-shine::after{content:'';position:absolute;top:0;bottom:0;left:-60%;width:40%;pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);animation:fxshine 3.2s ease-in-out infinite}
@keyframes fxshine{0%,55%{left:-60%}85%,100%{left:130%}}
.fx-shake{animation:fxshake 4s ease-in-out infinite}
/* Com animação de entrada, o bloco revelado (.in) recebe animation:none (e o
   de matrícula, o pulso "cta"): o balanço precisa vencer as duas regras. A
   trava de segurança (rvsafe) antes do .in continua valendo. */
html.anim main>.btn.fx-shake.fx-shake.in{animation:fxshake 4s ease-in-out infinite}
.fx-shake:hover{animation-play-state:paused}
@keyframes fxshake{0%,82%,100%{transform:none}84%{transform:rotate(-2.5deg)}87%{transform:rotate(2.5deg)}90%{transform:rotate(-2deg)}93%{transform:rotate(1.5deg)}96%{transform:rotate(-.5deg)}}
.btn.cta{min-height:64px;font-size:17px;background:${t.primary};color:${onPrimary};border:2px solid ${t.buttonStyle === 'shadow' ? t.text : t.primary};border-radius:${t.buttonStyle === 'minimal' ? rCard : r};padding:10px 14px}
${t.buttonStyle === 'minimal' ? '.btn.cta .lb{text-align:center}' : ''}
.card{${card}border-radius:${rCard};padding:18px 20px}
.card h2,.video h2,.sh{font-size:17px;line-height:1.3;margin:0 0 10px;display:flex;align-items:center;gap:10px;font-weight:${t.headingWeight === 400 ? 400 : 700}}
.card h2 .ic{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;border-radius:50%;background:${accentSoft};color:${accent}}
.card h2 .ic svg{width:17px;height:17px}
.card p{margin:0 0 8px;font-size:15px}.card p:last-child{margin-bottom:0}
.text p{white-space:normal}
.text.plain{padding:4px 2px}
.text.plain p{margin:0 0 8px}.text.plain p:last-child{margin-bottom:0}
.text.center{text-align:center}
.text.center h2{justify-content:center}
.text.ts-sm h2{font-size:14px}.text.ts-md h2{font-size:16px}.text.ts-lg h2{font-size:22px;line-height:1.25}
.text.tw-regular h2{font-weight:400}.text.tw-semibold h2{font-weight:600}.text.tw-bold h2{font-weight:${t.headingWeight}}
.text.tc-primary h2{color:${t.primary}}
.text.bs-sm p{font-size:14px}.text.bs-md p{font-size:15px}.text.bs-lg p{font-size:17px;line-height:1.6}
.text h2{margin:0 0 8px}
.social{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;padding:4px 0}
.social a{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:transform .18s ${ease},box-shadow .18s ${ease};${t.socialStyle === 'plain' ? '' : `box-shadow:${SH.sm};`}${
  // Estilo das bolinhas (theme.social_style): cor de cada marca, cor da
  // escola, ou só o ícone na cor do texto (sem bolinha).
  t.socialStyle === 'plain'
    ? `background:none;color:${t.text};width:44px;height:44px`
    : t.socialStyle === 'theme'
      ? `background:${t.primary};color:${onPrimary}`
      : `background:var(--brand);color:#fff;${darkText ? '' : 'box-shadow:0 0 0 2px rgba(255,255,255,.22);'}`}}
.social a svg{width:${t.socialStyle === 'plain' ? 30 : 24}px;height:${t.socialStyle === 'plain' ? 30 : 24}px}
.social a:hover{transform:translateY(-${lift || 1}px) scale(1.05)${t.socialStyle === 'plain' ? '' : `;box-shadow:${SH.md}`}}
.social.top{margin-top:18px;gap:${t.socialStyle === 'plain' ? 14 : 12}px}
.social a:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.lcard,.lfeat{${card}border-radius:${rCard};color:${t.text};text-decoration:none;transition:transform .18s ${ease},box-shadow .18s ${ease}}
.lcard:hover,.lfeat:hover{transform:translateY(-${lift || 1}px);box-shadow:${SH.md}}
.lcard:focus-visible,.lfeat:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.lcard{display:flex;align-items:center;gap:14px;padding:12px 16px 12px 12px}
.lcard .limg{flex:none;width:64px;height:64px;border-radius:${rInner};overflow:hidden}
.lfeat{display:block;overflow:hidden}
.lfeat .limg{display:block;aspect-ratio:16/9}
.limg img{display:block;width:100%;height:100%;object-fit:cover}
.lph{display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:${accentSoft};color:${accent}}
.lph svg{width:28px;height:28px}
.lfeat .lph svg{width:44px;height:44px}
.lbody{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.lfeat .lbody{padding:14px 18px 16px}
.ltitle{font-weight:700;font-size:16px;line-height:1.3;letter-spacing:-.01em}
.ldesc{font-size:14px;color:${muted};line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ldom{font-size:12px;color:${muted};opacity:.85}
.larrow{flex:none;color:${accent};font-size:18px}
.banner{display:block;margin:0;padding:0}
.banner img{display:block;width:100%;object-fit:cover;background:${surface};border-radius:${rCard};box-shadow:${sh}}
a.banner:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.gallery.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.gallery.grid figure:only-child{grid-column:1/-1}
.gallery.carousel{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px;scrollbar-width:none}
.gallery.carousel::-webkit-scrollbar{display:none}
.gallery.carousel figure{flex:0 0 82%;scroll-snap-align:center}
.gallery figure{margin:0}
.gallery img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:${rCard};background:${surface}}
.gallery.carousel img{aspect-ratio:4/3}
.gallery figcaption{font-size:13px;color:${muted};margin-top:6px;text-align:center}
.frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:${rCard};overflow:hidden;background:${surface};box-shadow:${t.shadow === 'none' ? SH.sm : sh}}
.frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.card .frame{border-radius:${rInner};box-shadow:none;border:1px solid ${edge}}
.map-frame{aspect-ratio:4/3;margin:12px 0 14px}
.map>p{color:${muted};font-size:14px}
.map.multi .map-frame{margin:4px 0 6px}
.units{list-style:none;margin:0;padding:0}
.unit{display:flex;align-items:center;gap:12px;padding:12px 0;border-top:1px solid ${border}}
.unit:first-child{border-top:0}
.unit .ub{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.unit .ub b{font-size:15px;line-height:1.3;display:flex;align-items:center;gap:6px}
.unit.on .ub b::before{content:'';width:8px;height:8px;border-radius:50%;background:${accent};flex:none}
.unit .ub span{font-size:13px;line-height:1.4;color:${muted}}
.unit .ua{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.unit .link-inline{padding:6px 12px;font-size:13px}
.see{font:inherit;font-size:13px;font-weight:600;color:${muted};background:none;border:0;padding:2px 4px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.see[aria-pressed="true"]{color:${accent};text-decoration:none;cursor:default}
.see:focus-visible{outline:3px solid ${accent};outline-offset:2px;border-radius:4px}
.lcard.pdf .lph{background:${accentSoft};color:${accent}}
.video .vdesc{margin:10px 2px 0;font-size:14px;color:${muted}}
.vlite{display:block;color:inherit}
.vlite img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.play{position:absolute;left:50%;top:50%;width:64px;height:44px;margin:-22px 0 0 -32px;border-radius:12px;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;transition:background .15s ease,transform .15s ease}
.vlite:hover .play{background:#FF0000;transform:scale(1.06)}
.vlite:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.video.vert .frame{aspect-ratio:9/16;max-width:300px;margin:0 auto}
.video.vert h2,.video.vert .vdesc{text-align:center;justify-content:center}
.video.feat h2{font-size:20px;line-height:1.25}
.video.feat .frame{box-shadow:${t.shadow === 'none' ? SH.md : SH.lg}}
.video.feat .play{width:76px;height:52px;margin:-26px 0 0 -38px}
.video.feat.vert .frame{max-width:380px}
@media(max-width:599px){.video.feat:not(.vert) .frame{width:calc(100% + 32px);margin:0 -16px;border-radius:0}}
.sh{padding:0 2px}
.faq details{border-top:1px solid ${border}}
.faq h2+details{border-top:0}
.faq summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 0;font-weight:600;font-size:15px;line-height:1.4}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';margin-left:auto;flex:none;width:24px;height:24px;border-radius:50%;background:${accentSoft};color:${accent};display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;transition:transform .2s ease}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq summary:focus-visible{outline:3px solid ${accent};outline-offset:2px;border-radius:4px}
.faq .ans{padding:0 0 14px;color:${muted};font-size:15px;line-height:1.6}
.faq .ans p{margin:0 0 8px}.faq .ans p:last-child{margin:0}
.hrow{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:4px 16px 14px;scrollbar-width:none}
.hrow::-webkit-scrollbar{display:none}
.hrow>*{scroll-snap-align:center}
.tcard{${card}border-radius:${rCard};margin:0;padding:18px 20px;flex:0 0 84%;display:flex;flex-direction:column;gap:12px}
.tst.one .hrow{overflow:visible}.tst.one .tcard{flex-basis:100%}
.tcard blockquote{margin:0;font-size:15px;line-height:1.55;flex:1}
.tcard blockquote::before{content:'“';display:block;font-family:Georgia,serif;font-size:40px;line-height:.6;height:18px;color:${accent}}
.stars{color:#F59E0B;letter-spacing:2px;font-size:15px}.stars .off{color:${border}}
.tcard figcaption,.person{display:flex;align-items:center;gap:10px}
.tcard figcaption span{display:flex;flex-direction:column;min-width:0}
.tcard small,.person small{color:${muted};font-size:13px}
.av{flex:none;width:44px;height:44px;border-radius:50%;object-fit:cover;background:${accentSoft}}
.av.ini{display:flex;align-items:center;justify-content:center;color:${accent};font-weight:700;font-size:15px}
.tgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.person{${card}border-radius:${rCard};margin:0;padding:18px 12px;flex-direction:column;text-align:center;gap:10px}
.team .hrow .person{flex:0 0 44%}
.person .av{width:72px;height:72px}.person .av.ini{font-size:22px}
.person figcaption{display:flex;flex-direction:column;gap:2px;min-width:0}
.person b{font-size:15px;line-height:1.3}
.pbio{font-size:13px;line-height:1.4;margin-top:4px}
.link-inline{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:999px;background:${accentSoft};color:${t.text};font-size:14px;font-weight:600;text-decoration:none;transition:background-color .18s ${ease}}
.link-inline:hover{background:${solid ? mix(accent, t.background, 0.24) : alpha(accent, 0.28)}}
.hours table{width:100%;border-collapse:collapse;font-size:15px}
.hours th{text-align:left;font-weight:500;padding:8px 0}
.hours td{text-align:right;padding:8px 0;font-variant-numeric:tabular-nums;color:${muted}}
.hours tr+tr th,.hours tr+tr td{border-top:1px solid ${border}}
.hours tr.today th,.hours tr.today td{font-weight:700;color:${t.text}}
.hours .note{font-size:13px;color:${muted};margin-top:10px}
.now{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:${border}}
.now.open{background:#D1FAE5;color:#047857}.now.closed{background:#FFE4E6;color:#BE123C}
.htoday{display:flex;align-items:center;gap:10px;margin:2px 0 4px;font-size:17px;font-weight:600;line-height:1.35}
.htoday .dot{flex:none;width:10px;height:10px;border-radius:50%;background:#F43F5E;box-shadow:0 0 0 4px rgba(244,63,94,.18)}
.htoday.open .dot{background:#10B981;box-shadow:0 0 0 4px rgba(16,185,129,.2)}
.hweek{margin-top:10px;border-top:1px solid ${border}}
.hweek summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:6px;padding:12px 0 2px;font-size:14px;font-weight:600;color:${muted}}
.hweek summary::-webkit-details-marker{display:none}
.hweek summary::after{content:'';width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translate(-2px,-2px);transition:transform .2s ${ease}}
.hweek[open] summary::after{transform:rotate(-135deg) translate(-2px,-2px)}
.hweek summary:focus-visible{outline:3px solid ${accent};outline-offset:2px;border-radius:4px}
.hweek table{margin-top:6px}
.sgrid{display:grid;gap:10px}
.sgrid.c2{grid-template-columns:repeat(2,minmax(0,1fr))}.sgrid.c3{grid-template-columns:repeat(3,minmax(0,1fr))}
.stat{text-align:center;padding:14px 6px 12px;border-radius:${rInner};background:${accentSoft}}
.sv{display:flex;align-items:baseline;justify-content:center;font-family:'${t.heading}','${t.body}',sans-serif;font-weight:${t.headingWeight === 400 ? 400 : 700};font-size:var(--fs,32px);line-height:1.1;letter-spacing:-.02em;color:${accent};font-variant-numeric:tabular-nums;white-space:nowrap}
.sv .sa{font-size:.62em;white-space:pre}
.sl{display:block;margin-top:6px;font-size:13px;line-height:1.35;color:${muted}}
html.cnt b[data-v]:not(.go){opacity:0;animation:cntsafe 0s 3s forwards}
@keyframes cntsafe{to{opacity:1}}
footer{margin-top:40px;text-align:center;font-size:12px;color:${muted}}
.social.bottom{margin-top:36px}
.wrap{position:relative}
.share{position:absolute;top:14px;right:16px;z-index:2;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;
background:rgba(255,255,255,.88);color:#1A2B4A;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);box-shadow:${SH.sm};transition:transform .18s ${ease},box-shadow .18s ${ease}}
.share[hidden]{display:none}
.share svg{width:18px;height:18px}
.share:hover{transform:translateY(-1px);box-shadow:${SH.md}}
.share:focus-visible{outline:3px solid ${accent};outline-offset:3px}
.has-fab .wrap{padding-bottom:104px}
.fab{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));z-index:20;width:58px;height:58px;border-radius:50%;background:#25D366;color:#fff;display:flex;align-items:center;justify-content:center;
box-shadow:0 8px 24px rgba(37,211,102,.38),0 2px 6px rgba(0,0,0,.16);transition:transform .25s ${ease},opacity .25s ${ease},box-shadow .18s ${ease};animation:fabin .4s ${ease} .6s backwards}
.fab svg{width:30px;height:30px}
.fab:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 28px rgba(37,211,102,.45),0 4px 8px rgba(0,0,0,.16)}
.fab:focus-visible{outline:3px solid #25D366;outline-offset:4px}
.fab.off{opacity:0;transform:scale(.7);pointer-events:none}
@keyframes fabin{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@media(min-width:600px){.fab{right:max(28px,calc(50vw - 330px))}}
.toast{position:fixed;left:50%;bottom:calc(max(18px,env(safe-area-inset-bottom)) + 76px);transform:translate(-50%,8px);z-index:30;max-width:calc(100% - 32px);padding:10px 16px;border-radius:12px;background:#1A2B4A;color:#fff;font-size:14px;font-weight:600;box-shadow:0 12px 32px rgba(15,23,42,.24);opacity:0;transition:opacity .25s ${ease},transform .25s ${ease};overflow-wrap:anywhere}
.toast.in{opacity:1;transform:translate(-50%,0)}
footer .made{display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:999px;border:1px solid ${edge}}
footer a{color:${t.text};text-decoration:none;font-weight:700}
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
function send(b,ev,tg){try{var d={p_page_id:P,p_block_id:b,p_event:ev,p_visitor_id:V,p_referrer_host:ref,p_utm_source:q.get('utm_source'),p_utm_medium:q.get('utm_medium'),p_utm_campaign:q.get('utm_campaign'),p_device:dev};if(tg)d.p_target=tg;fetch(U+'/rest/v1/rpc/vitrine_track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:K,Authorization:'Bearer '+K},body:JSON.stringify(d)}).catch(function(){})}catch(e){}}
send(null,'view');
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[data-b],a[data-s],button[data-t]');if(!a)return;var s=a.getAttribute('data-s'),tg=a.getAttribute('data-t');if(tg)send(null,'click',tg);else if(s)send(null,'click','social:'+s);else send(a.getAttribute('data-b'),'click')},true);
})();`
}

// Horário: refaz "aberto agora", a linha de hoje e a frase do layout "Hoje"
// no relógio do visitante (a página renderizada pode ter até ~10 min).
// Usa as mesmas spNow/hoursStatus da renderização (autocontidas).
function hoursScript(): string {
  return `(function(){try{var S=(${spNow.toString()})(new Date()),H=(${hoursStatus.toString()});
document.querySelectorAll('[data-hours]').forEach(function(s){var d=JSON.parse(s.getAttribute('data-hours')||'[]');if(!d.length)return;var st=H(d,S.dow,S.min);
s.querySelectorAll('tr[data-dow]').forEach(function(r){r.className=(' '+r.getAttribute('data-dow')+' ').indexOf(' '+S.dow+' ')>=0?'today':''});
var b=s.querySelector('.now');if(b){b.textContent=st.open?'Aberto agora':'Fechado agora';b.className='now '+(st.open?'open':'closed')}
var p=s.querySelector('.htoday');if(p){p.className='htoday '+(st.open?'open':'closed');p.querySelector('.ht').textContent=st.text}})}catch(e){}})();`
}

// Contador dos números: começa em 0 e sobe até o valor quando o bloco entra
// na tela (1,4 s, desacelerando). O HTML já traz o valor final (sem JS, ou
// pra quem pediu menos movimento, nada muda). Trava no CSS (cntsafe): se o
// script falhar, o número aparece em 3 s.
const COUNT_HEAD = `<script>try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&'IntersectionObserver' in window)document.documentElement.classList.add('cnt')}catch(e){}</script>`
const COUNT_SCRIPT = `(function(){var h=document.documentElement;if(!h.classList.contains('cnt'))return;
function f(v,d){var s=v.toFixed(d).split('.');return s[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g,'.')+(s[1]?','+s[1]:'')}
function run(b){var v=parseFloat(b.getAttribute('data-v')),d=+b.getAttribute('data-d')||0,t0=null;b.textContent=f(0,d);b.classList.add('go');
function step(t){if(t0===null)t0=t;var k=Math.min(1,(t-t0)/1400),e=1-Math.pow(1-k,3);b.textContent=f(v*e,d);if(k<1)requestAnimationFrame(step);else b.textContent=f(v,d)}requestAnimationFrame(step)}
var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){run(x.target);io.unobserve(x.target)}})},{rootMargin:'0px 0px -10% 0px'});
document.querySelectorAll('b[data-v]').forEach(function(b){io.observe(b)})})();`

export function renderVitrinePage(data: VitrinePublicData, opts: RenderOptions): string {
  const p = data.page
  const t = readTheme(p.theme)
  const name = (p.title || p.institution_name || 'Escola').trim()
  const desc = (p.seo_description || p.bio || `Links, contato e informações de ${name}.`).trim()
  const url = `${opts.siteUrl}/${p.slug}`
  const cover = isHttpUrl(p.cover_url) ? p.cover_url : null
  // Capa em vídeo: só MP4/WebM por https (o banco já exige); a imagem de capa
  // vira o quadro de espera (poster) e a prévia do link continua sendo ela.
  const coverVideo = isHttpUrl(p.cover_video_url) && /\.(mp4|webm)(\?|$)/i.test(p.cover_video_url) ? p.cover_video_url : null
  const logo = isHttpUrl(p.logo_url) ? p.logo_url : null
  const ogImage = cover || logo
  const blocks = renderBlocks(data.blocks || [], !!opts.preview, { siteUrl: opts.siteUrl, slug: p.slug })
  const script = !opts.preview && opts.supabaseUrl && opts.anonKey
    ? `<script>${trackingScript(p.id, opts.supabaseUrl, opts.anonKey)}</script>` : ''
  const videoScript = !opts.preview && blocks.includes('data-yt=') ? `<script>${VIDEO_SCRIPT}</script>` : ''
  const hoursJs = !opts.preview && blocks.includes('data-hours=') ? `<script>${hoursScript()}</script>` : ''
  const mapJs = !opts.preview && blocks.includes('class="card map multi"') ? `<script>${MAP_SCRIPT}</script>` : ''
  // Contador: página pública; na prévia só com "Ver animação".
  const counting = blocks.includes(' data-v="') && (!opts.preview || !!opts.animatePreview)
  const jsonLd = opts.preview ? '' : faqJsonLd(data.blocks || [])
  // Animação: página pública sempre; prévia do editor só quando pedida
  // ("Ver animação") — senão repetiria a cada tecla digitada.
  const animate = t.animation !== 'none' && (!opts.preview || !!opts.animatePreview)
  // Preview (iframe no editor): link abre em nova aba igual à página real;
  // <base target> garante isso também pro "Como chegar".
  const base = opts.preview ? '<base target="_blank">' : ''
  const themeColor = t.bgType === 'image' && t.bgOverlayTone === 'dark' ? '#000000' : t.background

  // WhatsApp flutuante: reusa um bloco de WhatsApp (ou matrícula por
  // WhatsApp) que ESTÁ na página — mesma mensagem, mesmo gatilho do
  // Captação, clique contado no mesmo bloco. Bloco oculto ou sem número =
  // sem flutuante.
  const fb = p.floating_block_id ? (data.blocks || []).find(b => b.id === p.floating_block_id) : null
  const fbHref = fb && (fb.type === 'whatsapp' || (fb.type === 'enroll' && fb.config?.mode === 'whatsapp'))
    ? waMeLink(fb.config.phone, fb.config.message) : null
  const fab = fb && fbHref
    ? `<a class="fab" href="${esc(fbHref)}" data-b="${esc(fb.id)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(fb.config.label || 'Conversar no WhatsApp')}" title="${esc(fb.config.label || 'Conversar no WhatsApp')}">${ICON.whatsapp}</a>`
    : ''
  // Compartilhar: menu do celular (Web Share) ou copia o link. O link leva
  // utm_source=compartilhar (a visita chega marcada no painel). Sem JS o
  // botão não faria nada: fica escondido até o script ligar (na prévia,
  // aparece pra escola ver).
  const shareUrl = `${url}?utm_source=compartilhar&utm_medium=vitrine`
  const share = p.show_share !== false
    ? `<button type="button" class="share" data-t="share" data-url="${esc(shareUrl)}" data-title="${esc(name)}" aria-label="Compartilhar esta página"${opts.preview ? '' : ' hidden'}>${ICON.share}</button>`
    : ''
  const socialRow = topSocialRow(p.social_links)
  const socialBottom = p.social_position === 'bottom'

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
${counting ? COUNT_HEAD : ''}
${jsonLd}
</head>
<body class="${[cover || coverVideo ? 'has-cover' : '', fab ? 'has-fab' : ''].filter(Boolean).join(' ')}">
${t.bgType !== 'solid' ? '<div class="bgl" aria-hidden="true"></div>' : ''}
<div class="wrap">
${share}
${coverVideo
  ? `<video class="cover" autoplay muted loop playsinline preload="metadata" aria-hidden="true"${cover ? ` poster="${esc(cover)}"` : ''}><source src="${esc(coverVideo)}" type="video/${/\.webm(\?|$)/i.test(coverVideo) ? 'webm' : 'mp4'}"></video>`
  : cover ? `<img class="cover" src="${esc(cover)}" alt="">` : ''}
<header>
${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo ${esc(name)}">` : ''}
<h1>${esc(name)}</h1>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
${socialBottom ? '' : socialRow}
</header>
<main>
${blocks}
</main>
${socialBottom && socialRow ? socialRow.replace('class="social top"', 'class="social bottom"') : ''}
<footer><span class="made">Página criada com <a href="${esc(opts.siteUrl)}/?utm_source=vitrine&amp;utm_medium=rodape" target="_blank" rel="noopener">Áion Edu</a></span></footer>
</div>
${fab}
${share ? '<div class="toast" role="status" aria-live="polite" hidden></div>' : ''}
${animate ? `<script>${animScript(t.animation === 'lively' ? 70 : 40)}</script>` : ''}
${videoScript}
${hoursJs}
${mapJs}
${counting ? `<script>${COUNT_SCRIPT}</script>` : ''}
${coverVideo && !opts.preview ? `<script>${COVER_SCRIPT}</script>` : ''}
${fab && !opts.preview ? `<script>${FAB_SCRIPT}</script>` : ''}
${share && !opts.preview ? `<script>${SHARE_SCRIPT}</script>` : ''}
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
