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

export type BlockType = 'link' | 'whatsapp' | 'text' | 'gallery' | 'video' | 'map' | 'hours' | 'enroll' | 'banner' | 'faq' | 'testimonials' | 'team' | 'stats' | 'pdf' | 'contact'
export type LinkStyle = 'button' | 'icon' | 'card' | 'featured'
export type BannerAspect = '3:1' | '16:9'
export type VideoSize = 'normal' | 'featured'
export type VideoFormat = '16:9' | '9:16'

// Limites dos blocos com lista (iguais aos do banco, 20260929130000).
export const LIST_LIMITS = { faq: 20, testimonials: 12, team: 24, stats: 6 } as const
export type HoursLayout = 'table' | 'compact' | 'today'
export const MAP_MAX_UNITS = 4   // além da principal

// Efeito por botão (config.effect): blocos que viram botão na página.
export type ButtonEffect = 'none' | 'pulse' | 'shine' | 'shake'
export const EFFECT_TYPES: BlockType[] = ['link', 'whatsapp', 'enroll', 'pdf', 'contact']
export const EFFECTS: { value: ButtonEffect; label: string; hint: string }[] = [
  { value: 'none',  label: 'Nenhum',   hint: 'Botão parado.' },
  { value: 'pulse', label: 'Pulsar',   hint: 'Um anel sai do botão de tempos em tempos. Bom pra matrícula e WhatsApp.' },
  { value: 'shine', label: 'Brilho',   hint: 'Um reflexo de luz atravessa o botão a cada poucos segundos.' },
  { value: 'shake', label: 'Balançar', hint: 'O botão dá uma balançada curta a cada 4 segundos. Use em um botão só.' },
]
// Link só vira botão no estilo "Botão" (cartão, destaque e ícone não têm efeito).
export const effectApplies = (type: BlockType, c: Record<string, any>) =>
  EFFECT_TYPES.includes(type) && (type !== 'link' || !c.style || c.style === 'button') && (type !== 'pdf' || c.style !== 'card')
export const PDF_MAX_BYTES = 10 * 1024 * 1024   // limite do bucket vitrine-docs

// Tamanho recomendado de cada formato de banner (mostrado no upload).
export const BANNER_ASPECTS: Record<BannerAspect, { label: string; size: string; ratio: number }> = {
  '3:1':  { label: 'Faixa',    size: '1200 × 400 px', ratio: 3 },
  '16:9': { label: 'Destaque', size: '1200 × 675 px', ratio: 16 / 9 },
}

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
  logo_shape?: 'circle' | 'rounded' | 'none'
  animation?: 'none' | 'subtle' | 'lively'
  social_style?: 'brand' | 'theme' | 'plain'
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
  social_links: SocialLink[]
  floating_block_id: string | null   // bloco de WhatsApp que vira botão flutuante
  show_share: boolean
  social_position: 'top' | 'bottom'
  cover_video_url: string | null      // capa em vídeo (MP4); cover_url vira o quadro de espera
  publish_at: string | null           // agenda da página (ISO); vazio = sem limite
  unpublish_at: string | null
  updated_at: string
}

// Rede social do topo: a escola digita só o perfil (ou o número, no
// WhatsApp); a página monta o link (socialUrl).
export interface SocialLink { network: SocialNet; handle: string }

export interface VitrineBlockRow {
  id: string
  institution_id: string
  page_id: string
  type: BlockType
  position: number
  is_visible: boolean
  config: Record<string, any>
  capture_trigger_id: string | null
  visible_from: string | null         // agenda do bloco (ISO); vazio = sem limite
  visible_until: string | null
}

// Pares de fonte: definidos no renderizador (uma fonte só da verdade pra
// página pública e editor).
export { FONT_PAIRS, fontsHref, SOCIAL, detectSocial, TOP_NETWORKS, socialUrl, normalizeHandle, type SocialNet } from '../../api/_lib/vitrineRender'
import type { SocialNet } from '../../api/_lib/vitrineRender'

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
  banner:   { label: 'Banner',               description: 'Imagem em largura total, com link opcional', color: '#EA580C', bg: '#FFEDD5' },
  faq:      { label: 'Perguntas frequentes', description: 'Dúvidas dos pais, com resposta ao tocar',    color: '#0D9488', bg: '#CCFBF1' },
  testimonials: { label: 'Depoimentos',      description: 'O que as famílias dizem, com nota',          color: '#CA8A04', bg: '#FEF9C3' },
  team:     { label: 'Equipe',               description: 'Direção e professores, com foto e cargo',    color: '#4F46E5', bg: '#E0E7FF' },
  stats:    { label: 'Números',              description: 'Alunos, anos de história, aprovações…',      color: '#0891B2', bg: '#CFFAFE' },
  pdf:      { label: 'Arquivo PDF',          description: 'Cardápio, calendário, lista de material',    color: '#E11D48', bg: '#FFE4E6' },
  contact:  { label: 'Salvar contato',       description: 'Botão que salva a escola na agenda do celular', color: '#0D9488', bg: '#CCFBF1' },
}

export const BLOCK_ORDER: BlockType[] = ['whatsapp', 'enroll', 'link', 'banner', 'text', 'gallery', 'video', 'faq', 'testimonials', 'team', 'stats', 'pdf', 'contact', 'map', 'hours']

export function defaultConfig(type: BlockType, ctx: { address?: string | null; placeName?: string | null }): Record<string, any> {
  switch (type) {
    case 'link':     return { label: '', url: '' }
    case 'whatsapp': return { label: 'Fale com a escola', message: MSG_INFO, phone_source: 'school', track_capture: true }
    case 'enroll':   return { label: 'Quero matricular', mode: 'whatsapp', message: MSG_ENROLL }
    case 'text':     return { title: 'Sobre a escola', body: '' }
    case 'gallery':  return { layout: 'grid', images: [] }
    case 'video':    return { url: '', provider: '', video_id: '', title: '', size: 'normal', format: '16:9', description: '' }
    case 'map':      return { label: 'Onde estamos', address: ctx.address || '', place_name: ctx.placeName || '' }
    case 'hours':    return {
      days: [1, 2, 3, 4, 5].map(dow => ({ dow, open: '07:00', close: '18:00' }))
        .concat([{ dow: 6, closed: true } as any, { dow: 0, closed: true } as any]),
      note: '',
    }
    case 'banner':   return { image_url: '', aspect: '3:1', alt: '', link_url: '' }
    case 'faq':      return { title: 'Perguntas frequentes', items: [{ q: '', a: '' }] }
    case 'testimonials': return { title: 'O que as famílias dizem', items: [{ quote: '', name: '', role: '', photo_url: '', rating: 5 }] }
    case 'team':     return { title: 'Nossa equipe', layout: 'grid', items: [{ name: '', role: '', photo_url: '', bio: '' }] }
    case 'stats':    return { title: '', animate: true, items: [{ value: null, prefix: '', suffix: '', label: '' }] }
    case 'pdf':      return { label: '', file_url: '', file_name: '', style: 'button' }
    case 'contact':  return { label: 'Salvar contato na agenda', name: '', phone_source: 'school', email: '', website: '', address: ctx.address || '' }
  }
}

// Título curto do bloco na lista do editor.
export function blockSummary(type: BlockType, c: Record<string, any>): string {
  switch (type) {
    case 'link': case 'whatsapp': case 'enroll': return c.label || BLOCK_TYPES[type].label
    case 'text':    return c.title || (c.body ? String(c.body).slice(0, 60) : 'Texto')
    case 'gallery': return c.images?.[0]?.caption || 'Galeria de fotos'
    case 'video':   return c.title || (c.video_id ? `${c.provider === 'vimeo' ? 'Vimeo' : 'YouTube'} · ${c.video_id}` : 'Vídeo')
    case 'map':     return c.address || 'Endereço'
    case 'hours':   return 'Horário de atendimento'
    case 'banner':  return c.alt || (c.image_url ? `Banner ${c.aspect === '16:9' ? '16:9' : '3:1'}` : 'Banner')
    case 'faq':     return c.title || 'Perguntas frequentes'
    case 'testimonials': return c.title || 'Depoimentos'
    case 'team':    return c.title || 'Equipe'
    case 'stats':   return c.title || 'Números'
    case 'pdf':     return c.label || 'Arquivo PDF'
    case 'contact': return c.label || 'Salvar contato'
  }
}

// Segunda linha do cartão do bloco na lista (resumo do conteúdo).
const DAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export function blockDetail(type: BlockType, c: Record<string, any>): string {
  const clip = (s: unknown, n = 60) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }
  const host = (u: unknown) => { try { return new URL(String(u)).hostname.replace(/^www\./, '') } catch { return '' } }
  switch (type) {
    case 'link': {
      const style = c.style === 'icon' ? 'Ícone' : c.style === 'card' ? 'Cartão' : c.style === 'featured' ? 'Destaque' : 'Botão'
      return [style, host(c.url)].filter(Boolean).join(' · ')
    }
    case 'whatsapp': return clip(c.message) || 'Sem mensagem'
    case 'enroll':   return c.mode === 'link' ? `Link · ${host(c.url) || 'sem link'}` : `WhatsApp · ${clip(c.message, 48)}`
    case 'banner':   return [c.aspect === '16:9' ? 'Destaque 16:9' : 'Faixa 3:1', c.link_url ? host(c.link_url) : 'sem link'].join(' · ')
    case 'text':     return clip(c.body) || 'Sem texto'
    case 'gallery':  return `${(c.images || []).length} foto(s) · ${c.layout === 'carousel' ? 'carrossel' : 'grade'}`
    case 'video': {
      if (!c.video_id) return 'Sem vídeo'
      return [c.provider === 'vimeo' ? 'Vimeo' : 'YouTube', c.size === 'featured' ? 'destaque' : '', c.format === '9:16' ? 'vertical' : ''].filter(Boolean).join(' · ')
    }
    case 'faq': {
      const n = (c.items || []).length
      return n === 1 ? '1 pergunta' : `${n} perguntas`
    }
    case 'testimonials': {
      const names = (c.items || []).map((i: any) => String(i?.name || '').trim()).filter(Boolean)
      return names.length ? clip(names.join(', ')) : 'Sem depoimentos'
    }
    case 'team': {
      const n = (c.items || []).length
      return `${n} pessoa${n === 1 ? '' : 's'} · ${c.layout === 'carousel' ? 'carrossel' : 'grade'}`
    }
    case 'stats': {
      const parts = (c.items || []).filter((i: any) => typeof i?.value === 'number')
        .map((i: any) => `${i.prefix || ''}${String(i.value).replace('.', ',')}${i.suffix || ''} ${i.label || ''}`.trim())
      return parts.length ? clip(parts.join(' · ')) : 'Sem números'
    }
    case 'map': {
      const n = Array.isArray(c.units) ? c.units.length : 0
      return (n ? `${n + 1} unidades · ` : '') + (clip(c.address, n ? 44 : 60) || 'Sem endereço')
    }
    case 'pdf': {
      const kb = Number(c.file_size) > 0 ? (Number(c.file_size) < 1048576 ? `${Math.max(1, Math.round(c.file_size / 1024))} KB` : `${(c.file_size / 1048576).toFixed(1).replace('.', ',')} MB`) : ''
      return c.file_url ? [c.style === 'card' ? 'Cartão' : 'Botão', c.file_name, kb].filter(Boolean).join(' · ') : 'Sem arquivo'
    }
    case 'contact': {
      const bits = [c.phone_source === 'none' ? '' : c.phone_source === 'custom' ? 'telefone próprio' : 'WhatsApp da escola', c.email, c.website ? 'site' : ''].filter(Boolean)
      return bits.length ? clip(bits.join(' · ')) : 'Só o nome'
    }
    case 'hours': {
      const lay = c.layout === 'compact' ? 'Compacto · ' : c.layout === 'today' ? 'Hoje · ' : ''
      const open = (Array.isArray(c.days) ? c.days : []).filter((d: any) => !d.closed)
      if (!open.length) return lay + 'Todos os dias fechado'
      const first = open.sort((a: any, b: any) => ((a.dow + 6) % 7) - ((b.dow + 6) % 7))
      const same = first.every((d: any) => d.open === first[0].open && d.close === first[0].close)
      return lay + (same
        ? `${DAY_SHORT[first[0].dow]}–${DAY_SHORT[first[first.length - 1].dow]} · ${first[0].open}–${first[0].close}`
        : `${open.length} dia(s) com horário`)
    }
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
// Texto obrigatório com tamanho (sem contar espaços nas pontas, como o btrim do banco).
const between = (v: unknown, min: number, max: number) => { const n = String(v ?? '').trim().length; return n >= min && n <= max }
// Foto opcional: vazia vale; preenchida tem que ser http(s).
const badPhoto = (u: unknown) => u != null && u !== '' && !isHttpUrl(u)

export function validateBlock(type: BlockType, c: Record<string, any>): string | null {
  const e = validateBlockType(type, c)
  if (e) return e
  if (c.effect !== undefined && (!EFFECT_TYPES.includes(type) || !['none', 'pulse', 'shine', 'shake'].includes(c.effect))) return 'Efeito do botão inválido.'
  return null
}

function validateBlockType(type: BlockType, c: Record<string, any>): string | null {
  const label = String(c.label || '').trim()
  const msg = String(c.message || '').trim()
  if (['link', 'whatsapp', 'enroll'].includes(type) && (!label || label.length > 80)) {
    return 'O texto do botão é obrigatório (até 80 caracteres).'
  }
  switch (type) {
    case 'link':
      if (!isHttpUrl(c.url)) return 'Informe um link válido (ex.: https://instagram.com/suaescola).'
      if (c.style !== undefined && !['button', 'icon', 'card', 'featured'].includes(c.style)) return 'Estilo do link inválido.'
      if (String(c.description || '').length > 120) return 'A descrição pode ter no máximo 120 caracteres.'
      return null
    case 'banner':
      if (!isHttpUrl(c.image_url)) return 'Envie a imagem do banner.'
      if (c.aspect !== undefined && c.aspect !== '3:1' && c.aspect !== '16:9') return 'Formato do banner inválido.'
      if (String(c.alt || '').length > 150) return 'A descrição da imagem pode ter no máximo 150 caracteres.'
      if (c.link_url && !isHttpUrl(c.link_url)) return 'Link do banner inválido: use um endereço começando com https://'
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
      if ((c.title_size !== undefined && !['sm', 'md', 'lg'].includes(c.title_size))
       || (c.title_weight !== undefined && !['regular', 'semibold', 'bold'].includes(c.title_weight))
       || (c.title_color !== undefined && !['text', 'primary'].includes(c.title_color))
       || (c.body_size !== undefined && !['sm', 'md', 'lg'].includes(c.body_size))
       || (c.align !== undefined && !['left', 'center'].includes(c.align))
       || (c.surface !== undefined && !['card', 'plain'].includes(c.surface))) return 'Opção de estilo do texto inválida.'
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
      if (c.size !== undefined && c.size !== 'normal' && c.size !== 'featured') return 'Tamanho do vídeo inválido.'
      if (c.format !== undefined && c.format !== '16:9' && c.format !== '9:16') return 'Formato do vídeo inválido.'
      if (String(c.description || '').length > 200) return 'A descrição pode ter no máximo 200 caracteres.'
      return null
    case 'faq': {
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      const items = Array.isArray(c.items) ? c.items : null
      if (!items || items.length < 1 || items.length > LIST_LIMITS.faq) return 'Adicione de 1 a 20 perguntas.'
      if (items.some((i: any) => !between(i?.q, 1, 200))) return 'Toda pergunta precisa de texto (até 200 caracteres).'
      if (items.some((i: any) => !between(i?.a, 1, 1000))) return 'Toda pergunta precisa de resposta (até 1000 caracteres).'
      return null
    }
    case 'testimonials': {
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      const items = Array.isArray(c.items) ? c.items : null
      if (!items || items.length < 1 || items.length > LIST_LIMITS.testimonials) return 'Adicione de 1 a 12 depoimentos.'
      if (items.some((i: any) => !between(i?.quote, 1, 400))) return 'Todo depoimento precisa de texto (até 400 caracteres).'
      if (items.some((i: any) => !between(i?.name, 1, 60) || String(i?.role || '').length > 60)) return 'Informe o nome (até 60 caracteres) de quem deu o depoimento.'
      if (items.some((i: any) => badPhoto(i?.photo_url) || (i?.rating != null && !/^[1-5]$/.test(String(i.rating))))) return 'Foto ou nota do depoimento inválida.'
      return null
    }
    case 'team': {
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      if (c.layout !== undefined && c.layout !== 'grid' && c.layout !== 'carousel') return 'Layout da equipe inválido.'
      const items = Array.isArray(c.items) ? c.items : null
      if (!items || items.length < 1 || items.length > LIST_LIMITS.team) return 'Adicione de 1 a 24 pessoas.'
      if (items.some((i: any) => !between(i?.name, 1, 60) || String(i?.role || '').length > 60 || String(i?.bio || '').length > 160)) {
        return 'Toda pessoa precisa de nome (até 60); cargo até 60 e frase até 160 caracteres.'
      }
      if (items.some((i: any) => badPhoto(i?.photo_url))) return 'Foto da equipe inválida.'
      return null
    }
    case 'map': {
      const a = String(c.address || '').trim()
      if (a.length < 5 || a.length > 300) return 'Informe o endereço (de 5 a 300 caracteres).'
      if (String(c.place_name || '').length > 120) return 'O nome no Google Maps pode ter no máximo 120 caracteres.'
      if (String(c.unit_name || '').length > 80) return 'O nome da unidade pode ter no máximo 80 caracteres.'
      if (c.units !== undefined && (!Array.isArray(c.units) || c.units.length > MAP_MAX_UNITS)) return 'Adicione no máximo 4 outras unidades.'
      if (Array.isArray(c.units) && c.units.some((u: any) => !between(u?.name, 1, 80) || !between(u?.address, 5, 300) || String(u?.place_name || '').length > 120)) {
        return 'Toda unidade precisa de nome (até 80) e endereço (de 5 a 300 caracteres).'
      }
      return null
    }
    case 'pdf':
      if (!between(c.label, 1, 80)) return 'O texto do botão é obrigatório (até 80 caracteres).'
      if (!isHttpUrl(c.file_url)) return 'Envie o arquivo PDF.'
      if (String(c.file_name || '').length > 120) return 'Nome do arquivo muito longo.'
      if (c.file_size != null && (typeof c.file_size !== 'number' || !/^[0-9]{1,9}$/.test(String(c.file_size)))) return 'Tamanho do arquivo inválido.'
      if (String(c.description || '').length > 120) return 'A descrição pode ter no máximo 120 caracteres.'
      if (c.style !== undefined && c.style !== 'button' && c.style !== 'card') return 'Estilo do bloco inválido.'
      return null
    case 'contact':
      if (!between(c.label, 1, 80)) return 'O texto do botão é obrigatório (até 80 caracteres).'
      if (String(c.name || '').length > 100) return 'O nome pode ter no máximo 100 caracteres.'
      if (c.phone_source !== undefined && !['school', 'custom', 'none'].includes(c.phone_source)) return 'Origem do telefone inválida.'
      if (c.phone_source === 'custom' && !/^[0-9]{10,13}$/.test(String(c.phone || ''))) return 'Telefone inválido: DDD + número, só dígitos.'
      if (c.email && (String(c.email).length > 120 || !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(c.email))) return 'E-mail inválido.'
      if (c.website && !isHttpUrl(c.website)) return 'Site inválido: use um endereço começando com https://'
      if (String(c.address || '').length > 300) return 'O endereço pode ter no máximo 300 caracteres.'
      return null
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
      if (c.layout !== undefined && !['table', 'compact', 'today'].includes(c.layout)) return 'Layout do horário inválido.'
      return null
    }
    case 'stats': {
      if (String(c.title || '').length > 100) return 'O título pode ter no máximo 100 caracteres.'
      if (c.animate !== undefined && typeof c.animate !== 'boolean') return 'Opção de animação inválida.'
      const items = Array.isArray(c.items) ? c.items : null
      if (!items || items.length < 1 || items.length > LIST_LIMITS.stats) return 'Adicione de 1 a 6 números.'
      if (items.some((i: any) => typeof i?.value !== 'number' || !/^[0-9]{1,7}(\.[0-9])?$/.test(String(i.value)))) {
        return 'Todo número precisa de um valor (de 0 a 9.999.999, até 1 casa decimal).'
      }
      if (items.some((i: any) => !between(i?.label, 1, 60))) return 'Todo número precisa de uma legenda (até 60 caracteres).'
      if (items.some((i: any) => String(i?.prefix || '').length > 4 || String(i?.suffix || '').length > 12)) return 'Antes do número: até 4 caracteres; depois: até 12.'
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
      out.push({ id: b.id, type: b.type, config: { label: c.label, message: c.message, phone: p, effect: c.effect } })
    } else if (b.type === 'enroll') {
      if (c.mode === 'whatsapp' && !phone) continue
      out.push({ id: b.id, type: b.type, config: c.mode === 'link'
        ? { label: c.label, mode: 'link', url: c.url, effect: c.effect }
        : { label: c.label, mode: 'whatsapp', message: c.message, phone, effect: c.effect } })
    } else {
      // Mapa sem place_name: a página pública usa o nome da escola (ver
      // 20260929080000_vitrine_map_place_name.sql) — a prévia faz igual.
      let cfg = b.type === 'map' && !('place_name' in c) ? { ...c, place_name: ctx.institutionName } : c
      if (b.type === 'map' && Array.isArray(c.units)) {
        cfg = { ...cfg, units: c.units.map((u: any) => ('place_name' in (u || {}) ? u : { ...u, place_name: ctx.institutionName })) }
      }
      if (b.type === 'contact') {
        const src = c.phone_source || 'school'
        cfg = { label: c.label, name: String(c.name || '').trim() || ctx.institutionName, email: c.email || null, website: c.website || null,
          address: c.address || null, phone: src === 'school' ? phone : src === 'custom' ? c.phone : null, effect: c.effect }
      }
      out.push({ id: b.id, type: b.type, config: cfg })
    }
  }
  return {
    page: {
      id: page.id, slug: page.slug, title: page.title, bio: page.bio,
      logo_url: page.logo_url, cover_url: page.cover_url, cover_video_url: page.cover_video_url, theme: page.theme as Record<string, unknown>,
      seo_description: page.seo_description, institution_name: ctx.institutionName,
      social_links: page.social_links,
      floating_block_id: page.floating_block_id, show_share: page.show_share, social_position: page.social_position,
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

// ── Agenda (página e blocos) ────────────────────────────────────────────────
// <input type="datetime-local"> trabalha no horário do aparelho, sem fuso:
// "2026-10-05T08:00". O banco guarda o instante (ISO/UTC).
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
// "05/10 às 08:00" (com o ano só se não for o atual).
export function fmtWhen(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const year = d.getFullYear() !== now.getFullYear() ? `/${d.getFullYear()}` : ''
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}${year} às ${p(d.getHours())}:${p(d.getMinutes())}`
}
export type ScheduleState = 'none' | 'future' | 'active' | 'expired'
// Situação de uma janela [de, até) agora. 'active' com "até" = no ar, mas vai sair.
export function scheduleState(from: string | null | undefined, until: string | null | undefined, now = Date.now()): ScheduleState {
  const f = from ? Date.parse(from) : NaN, u = until ? Date.parse(until) : NaN
  if (Number.isNaN(f) && Number.isNaN(u)) return 'none'
  if (!Number.isNaN(u) && now >= u) return 'expired'
  if (!Number.isNaN(f) && now < f) return 'future'
  return 'active'
}
export function scheduleLabel(from: string | null | undefined, until: string | null | undefined, now = Date.now()): string | null {
  const st = scheduleState(from, until, now)
  if (st === 'none') return null
  if (st === 'expired') return `Encerrado em ${fmtWhen(until!)}`
  if (st === 'future') return until ? `De ${fmtWhen(from!)} até ${fmtWhen(until)}` : `A partir de ${fmtWhen(from!)}`
  return until ? `No ar até ${fmtWhen(until)}` : null
}
