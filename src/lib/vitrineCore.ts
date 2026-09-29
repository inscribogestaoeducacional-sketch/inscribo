// =============================================================================
// src/lib/vitrineCore.ts
//
// Vitrine Áion — página pública tipo Linktree por escola
// (aionedu.com.br/<slug>). Tabelas, RLS e funções em
// supabase/migrations/20260929060000_vitrine.sql; página pública em
// api/_lib/vitrinePage.ts + api/_lib/vitrineRender.ts.
//
// Parte pura (sem Supabase): tipos, catálogo dos blocos, validação (espelho
// da vitrine_validate_block do banco — o banco continua sendo a regra; isto
// só antecipa o aviso enquanto a pessoa digita) e a montagem dos dados da
// prévia no mesmo formato que vitrine_public_page() devolve. Sem Supabase de
// propósito: dá pra importar fora do app (ex.: teste que compara
// validateBlock com o banco). O app importa de ./vitrine, que reexporta
// tudo daqui e acrescenta o upload.
// =============================================================================
import type { VitrinePublicData, VitrineBlock as PublicBlock } from '../../api/_lib/vitrineRender'

export const VITRINE_SITE_URL = 'https://aionedu.com.br'
export const VITRINE_BUCKET = 'vitrine-media'
export const VITRINE_MAX_BLOCKS = 50

export type BlockType = 'link' | 'whatsapp' | 'text' | 'gallery' | 'video' | 'map' | 'hours' | 'enroll'

export type ButtonStyle = 'filled' | 'outline' | 'soft' | 'glass' | 'shadow' | 'minimal'
export type BgType = 'solid' | 'gradient' | 'image'

// Chaves validadas no banco (20260929060000 + 20260929090000_vitrine_theme_v2).
export interface VitrineTheme {
  primary: string
  background: string          // fundo sólido / cor inicial do gradiente / cor de apoio da imagem
  text: string
  button_style: ButtonStyle
  radius: 0 | 8 | 16 | 999
  font?: string               // fonte única das páginas antigas (antes dos pares)
  font_pair?: string          // chave de FONT_PAIRS
  bg_type?: BgType
  bg_gradient_to?: string
  bg_gradient_angle?: 0 | 45 | 90 | 135 | 180
  bg_image_url?: string | null
  bg_overlay?: number         // 0–80, de 10 em 10
  bg_overlay_tone?: 'dark' | 'light'
  shadow?: 'none' | 'soft' | 'strong'
  spacing?: 'compact' | 'normal' | 'relaxed'
  card_style?: 'flat' | 'bordered' | 'elevated'
  logo_shape?: 'circle' | 'rounded'
  animation?: 'none' | 'subtle' | 'lively'
  template?: string
}

export interface VitrinePageRow {
  id: string
  institution_id: string
  slug: string
  is_published: boolean
  published_at: string | null
  title: string
  bio: string | null
  logo_url: string | null
  cover_url: string | null
  theme: Partial<VitrineTheme>
  seo_description: string | null
  updated_at: string
}

export interface VitrineBlockRow {
  id: string
  institution_id: string
  page_id: string
  type: BlockType
  position: number
  is_visible: boolean
  config: Record<string, any>
  capture_trigger_id: string | null
}

// Pares de fonte: definidos no renderizador (uma fonte só da verdade pra
// página pública e editor).
export { FONT_PAIRS, fontsHref } from '../../api/_lib/vitrineRender'

// Padrões = aparência da página antes da Fase 5 (o renderizador usa os
// mesmos quando a chave não existe). font_pair fica sem padrão de propósito:
// página antiga continua na fonte única dela até a escola escolher um par.
export const DEFAULT_THEME: VitrineTheme = {
  primary: '#00A896', background: '#FFFFFF', text: '#111827',
  button_style: 'filled', radius: 16,
  bg_type: 'solid', bg_gradient_angle: 180, bg_overlay: 40, bg_overlay_tone: 'dark',
  shadow: 'none', spacing: 'normal', card_style: 'bordered', logo_shape: 'circle', animation: 'none',
}

export function readTheme(t: Partial<VitrineTheme> | null | undefined): VitrineTheme {
  const th = { ...DEFAULT_THEME, ...(t || {}) } as VitrineTheme
  if (!th.font_pair && !th.font) th.font = 'Inter'
  return th
}

// Par de fontes selecionado no editor: font_pair, ou o equivalente exato da
// fonte única antiga (Inter e Poppins viram os pares de mesmo nome).
export function currentFontPair(th: VitrineTheme): string | null {
  if (th.font_pair) return th.font_pair
  if (th.font === 'Inter') return 'inter'
  if (th.font === 'Poppins') return 'poppins'
  return null
}

// ── Catálogo dos blocos ─────────────────────────────────────────────────────
// Mensagens padrão sem o nome da escola: "do/da" dependeria do nome. O texto
// vira o gatilho do Captação (match por "contém", escopado à escola).
export const MSG_INFO = 'Olá! Vim pela página da escola e gostaria de mais informações.'
export const MSG_ENROLL = 'Olá! Vim pela página da escola e quero fazer a matrícula.'

export const BLOCK_TYPES: Record<BlockType, { label: string; description: string; color: string; bg: string }> = {
  whatsapp: { label: 'WhatsApp',             description: 'Botão que abre uma conversa com a escola', color: '#16A34A', bg: '#DCFCE7' },
  enroll:   { label: 'Botão de matrícula',   description: 'Destaque pra matrícula: link ou WhatsApp',  color: '#00A896', bg: '#E6F7F5' },
  link:     { label: 'Link',                 description: 'Site, Instagram, formulário, qualquer link', color: '#3B82F6', bg: '#DBEAFE' },
  text:     { label: 'Texto / Sobre',        description: 'Um parágrafo sobre a escola',                color: '#7C3AED', bg: '#EDE9FE' },
  gallery:  { label: 'Galeria de imagens',   description: 'Até 12 fotos em grade ou carrossel',         color: '#DB2777', bg: '#FCE7F3' },
  video:    { label: 'Vídeo',                description: 'Vídeo do YouTube ou do Vimeo',               color: '#DC2626', bg: '#FEE2E2' },
  map:      { label: 'Mapa / Endereço',      description: 'Endereço com mapa e "Como chegar"',          color: '#D97706', bg: '#FEF3C7' },
  hours:    { label: 'Horário de atendimento', description: 'Dias e horários, com "Aberto agora"',      color: '#0284C7', bg: '#E0F2FE' },
}

export const BLOCK_ORDER: BlockType[] = ['whatsapp', 'enroll', 'link', 'text', 'gallery', 'video', 'map', 'hours']

export function defaultConfig(type: BlockType, ctx: { address?: string | null; placeName?: string | null }): Record<string, any> {
  switch (type) {
    case 'link':     return { label: '', url: '' }
    case 'whatsapp': return { label: 'Fale com a escola', message: MSG_INFO, phone_source: 'school', track_capture: true }
    case 'enroll':   return { label: 'Quero matricular', mode: 'whatsapp', message: MSG_ENROLL }
    case 'text':     return { title: 'Sobre a escola', body: '' }
    case 'gallery':  return { layout: 'grid', images: [] }
    case 'video':    return { url: '', provider: '', video_id: '', title: '' }
    case 'map':      return { label: 'Onde estamos', address: ctx.address || '', place_name: ctx.placeName || '' }
    case 'hours':    return {
      days: [1, 2, 3, 4, 5].map(dow => ({ dow, open: '07:00', close: '18:00' }))
        .concat([{ dow: 6, closed: true } as any, { dow: 0, closed: true } as any]),
      note: '',
    }
  }
}

// Título curto do bloco na lista do editor.
export function blockSummary(type: BlockType, c: Record<string, any>): string {
  switch (type) {
    case 'link': case 'whatsapp': case 'enroll': return c.label || BLOCK_TYPES[type].label
    case 'text':    return c.title || (c.body ? String(c.body).slice(0, 60) : 'Texto')
    case 'gallery': return `${(c.images || []).length} imagem(ns)`
    case 'video':   return c.title || (c.video_id ? `${c.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} · ${c.video_id}` : 'Vídeo')
    case 'map':     return c.address || 'Endereço'
    case 'hours':   return 'Horário de atendimento'
  }
}

// ── Validação (espelho de vitrine_validate_block) ───────────────────────────
export const isHttpUrl = (u: unknown): u is string =>
  typeof u === 'string' && /^https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?(\/[^\s<>"]*)?$/i.test(u) && u.length <= 2048

// "instagram.com/escola" → "https://instagram.com/escola"
export function normalizeUrl(raw: string): string {
  const s = (raw || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export function validateBlock(type: BlockType, c: Record<string, any>): string | null {
  const label = String(c.label || '').trim()
  const msg = String(c.message || '').trim()
  if (['link', 'whatsapp', 'enroll'].includes(type) && (!label || label.length > 80)) {
    return 'O texto do botão é obrigatório (até 80 caracteres).'
  }
  switch (type) {
    case 'link':
      if (!isHttpUrl(c.url)) return 'Informe um link válido (ex.: https://instagram.com/suaescola).'
      return null
    case 'whatsapp':
      if (c.phone_source !== undefined && c.phone_source !== 'school' && c.phone_source !== 'custom') return 'Origem do número inválida.'
      if (c.phone_source === 'custom' &&!/^[0-9]{10,13}$/.test(String(c.custom_phone || ''))) {
        return 'Número de WhatsApp inválido: DDD + número, só dígitos.'
      }
      if (msg.length > 500) return 'A mensagem pode ter no máximo 500 caracteres.'
      if (c.track_capture !== false && c.phone_source !== 'custom' && msg.length < 10) {
        return 'A mensagem precisa ter pelo menos 10 caracteres pra identificar a origem no Captação.'
      }
      return null
    case 'enroll':
      if (c.mode === 'link' && !isHttpUrl(c.url)) return 'Informe o link da matrícula (ex.: https://...).'
      if (c.mode === 'whatsapp' && (msg.length < 10 || msg.length > 500)) return 'A mensagem precisa ter de 10 a 500 caracteres.'
      if (c.mode !== 'link' && c.mode !== 'whatsapp') return 'Escolha se o botão abre um link ou o WhatsApp.'
      return null
    case 'text':
      if (!String(c.body || '').trim() || String(c.body).length > 2000) return 'Escreva o texto (até 2000 caracteres).'
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      return null
    case 'gallery': {
      const imgs = Array.isArray(c.images) ? c.images : []
      if (imgs.length < 1 || imgs.length > 12) return 'Adicione de 1 a 12 imagens.'
      if (c.layout !== undefined && c.layout !== 'grid' && c.layout !== 'carousel') return 'Layout da galeria inválido.'
      if (imgs.some((i: any) => !isHttpUrl(i?.url) || String(i?.caption || '').length > 150)) return 'Imagem da galeria inválida.'
      return null
    }
    case 'video':
      if (!((c.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(c.video_id || ''))
         || (c.provider === 'vimeo' && /^[0-9]{6,12}$/.test(c.video_id || '')))) {
        return 'Cole o link de um vídeo do YouTube ou do Vimeo.'
      }
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      return null
    case 'map': {
      const a = String(c.address || '').trim()
      if (a.length < 5 || a.length > 300) return 'Informe o endereço (de 5 a 300 caracteres).'
      if (String(c.place_name || '').length > 120) return 'O nome no Google Maps pode ter no máximo 120 caracteres.'
      return null
    }
    case 'hours': {
      const days = Array.isArray(c.days) ? c.days : []
      if (days.length > 7 || days.some((d: any) => !/^[0-6]$/.test(String(d?.dow)))) return 'Horário inválido.'
      if (days.some((d: any) => !d.closed && (!HHMM.test(d.open || '') || !HHMM.test(d.close || '')))) {
        return 'Horário inválido: use HH:MM em cada dia aberto.'
      }
      // Mais estrito que o banco de propósito: fechamento antes da abertura
      // (o banco aceita) quase sempre é erro de digitação.
      if (days.some((d: any) => !d.closed && d.open >= d.close)) return 'O horário de fechamento precisa ser depois da abertura.'
      if (String(c.note || '').length > 200) return 'A observação pode ter no máximo 200 caracteres.'
      return null
    }
  }
}

// YouTube (watch, youtu.be, shorts, embed, live) e Vimeo → provider + ID.
export function parseVideoUrl(raw: string): { provider: 'youtube' | 'vimeo'; video_id: string } | null {
  const s = (raw || '').trim()
  let m = s.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (m) return { provider: 'youtube', video_id: m[1] }
  m = s.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?([0-9]{6,12})/)
  if (m) return { provider: 'vimeo', video_id: m[1] }
  return null
}

// ── Slug ────────────────────────────────────────────────────────────────────
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

export function slugify(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

export type SlugStatus = 'ok' | 'invalid' | 'reserved' | 'taken'

export const SLUG_STATUS_MSG: Record<Exclude<SlugStatus, 'ok'>, string> = {
  invalid:  'Use de 3 a 40 letras minúsculas, números ou hífen (sem acento, sem espaço).',
  reserved: 'Esse endereço é reservado pelo sistema.',
  taken:    'Esse endereço já está em uso por outra escola.',
}

export const publicUrl = (slug: string) => `${VITRINE_SITE_URL}/${slug}`

// ── Prévia ──────────────────────────────────────────────────────────────────
// Mesmo formato de vitrine_public_page(): só blocos visíveis, WhatsApp com o
// número resolvido (escola ou do bloco) e sem campos internos.
export function buildPreviewData(
  page: VitrinePageRow,
  blocks: { id: string; type: BlockType; config: Record<string, any>; is_visible: boolean }[],
  ctx: { schoolPhone: string | null; institutionName: string },
): VitrinePublicData {
  const phone = (ctx.schoolPhone || '').replace(/\D/g, '') || null
  const out: PublicBlock[] = []
  for (const b of blocks) {
    if (!b.is_visible) continue
    const c = b.config || {}
    if (b.type === 'whatsapp') {
      const p = c.phone_source === 'custom' ? c.custom_phone : phone
      if (!p) continue
      out.push({ id: b.id, type: b.type, config: { label: c.label, message: c.message, phone: p } })
    } else if (b.type === 'enroll') {
      if (c.mode === 'whatsapp' && !phone) continue
      out.push({ id: b.id, type: b.type, config: c.mode === 'link'
        ? { label: c.label, mode: 'link', url: c.url }
        : { label: c.label, mode: 'whatsapp', message: c.message, phone } })
    } else {
      // Mapa sem place_name: a página pública usa o nome da escola (ver
      // 20260929080000_vitrine_map_place_name.sql) — a prévia faz igual.
      const cfg = b.type === 'map' && !('place_name' in c) ? { ...c, place_name: ctx.institutionName } : c
      out.push({ id: b.id, type: b.type, config: cfg })
    }
  }
  return {
    page: {
      id: page.id, slug: page.slug, title: page.title, bio: page.bio,
      logo_url: page.logo_url, cover_url: page.cover_url, theme: page.theme as Record<string, unknown>,
      seo_description: page.seo_description, institution_name: ctx.institutionName,
    },
    blocks: out,
  }
}

// Contraste WCAG entre duas cores #RRGGBB (aviso de legibilidade na aparência).
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) })
      .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0)
  }
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

export const HEX_RE = /^#[0-9A-Fa-f]{6}$/
