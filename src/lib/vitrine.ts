// =============================================================================
// src/lib/vitrine.ts
//
// Vitrine Áion — página pública tipo Linktree por escola
// (aionedu.com.br/<slug>). Tabelas, RLS e funções em
// supabase/migrations/20260929060000_vitrine.sql; página pública em
// api/_lib/vitrinePage.ts + api/_lib/vitrineRender.ts.
//
// Tipos, catálogo, validação e prévia ficam em ./vitrineCore (sem Supabase);
// aqui, o upload pro bucket vitrine-media.
// =============================================================================
import { supabase } from './supabase'
import { VITRINE_BUCKET, type BlockType } from './vitrineCore'

export * from './vitrineCore'

// ── Upload ──────────────────────────────────────────────────────────────────
const IMAGE_MIMES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export const IMAGE_ACCEPT = Object.keys(IMAGE_MIMES).join(',')
const IMAGE_MAX = 5 * 1024 * 1024        // limite do bucket (arquivo final)
const IMAGE_PICK_MAX = 20 * 1024 * 1024  // o que dá pra escolher: reduz antes de enviar

// Larguras máximas por uso. A página é vista no celular (até ~560 px de
// largura, 3× em tela de alta densidade): 1600 px sobra; logo e miniatura
// aparecem pequenas.
export const IMAGE_WIDTH = { large: 1600, small: 600 } as const

// Reduz no navegador antes do upload: foto de celular de 4–8 MB vira algumas
// centenas de KB (WebP), o que mais pesa na página no 4G. Mantém o original
// quando já é pequena ou quando a versão reduzida não fica menor. Navegador
// que não gera WebP (Safari antigo) cai pra JPEG, ou PNG se a origem é PNG
// (pode ter transparência — logo).
export async function shrinkImage(file: File, maxWidth: number): Promise<File> {
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file) } catch { return file }
  const scale = Math.min(1, maxWidth / bmp.width)
  if (scale === 1 && file.size <= 300 * 1024) { bmp.close?.(); return file }
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bmp.close?.(); return file }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  const toBlob = (type: string, q?: number) => new Promise<Blob | null>(r => canvas.toBlob(r, type, q))
  let out = await toBlob('image/webp', 0.82)
  if (!out || out.type !== 'image/webp') out = await toBlob(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85)
  if (!out || out.size >= file.size) return file
  const ext = IMAGE_MIMES[out.type] || 'jpg'
  return new File([out], file.name.replace(/.[^.]+$/, '') + '.' + ext, { type: out.type })
}

export async function uploadVitrineImage(institutionId: string, original: File, maxWidth: number = IMAGE_WIDTH.large): Promise<string> {
  if (!IMAGE_MIMES[original.type]) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (original.size > IMAGE_PICK_MAX) throw new Error('A imagem pode ter no máximo 20 MB.')
  const file = await shrinkImage(original, maxWidth)
  if (file.size > IMAGE_MAX) throw new Error('Mesmo reduzida, a imagem passou de 5 MB. Tente outra imagem.')
  const ext = IMAGE_MIMES[file.type]
  const path = `${institutionId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(VITRINE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(`Não foi possível enviar a imagem: ${error.message}`)
  return supabase.storage.from(VITRINE_BUCKET).getPublicUrl(path).data.publicUrl
}

// Apaga do bucket uma imagem que saiu da página (troca de logo/capa, foto
// removida da galeria, bloco excluído). Só mexe em arquivo da pasta da
// própria escola no vitrine-media — a logo que veio de institutions
// (institution-logos) nunca é apagada. Falha em silêncio: arquivo órfão não
// quebra nada.
export async function removeVitrineImage(institutionId: string, url: string | null | undefined) {
  if (!url) return
  const marker = `/storage/v1/object/public/${VITRINE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i < 0) return
  const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  if (!path.startsWith(`${institutionId}/`)) return
  await supabase.storage.from(VITRINE_BUCKET).remove([path]).catch(() => {})
}

// Imagens do bucket usadas por um bloco (pra limpar ao excluir o bloco).
export function blockImageUrls(type: BlockType, c: Record<string, any>): string[] {
  if (type === 'gallery') return (c.images || []).map((i: any) => i?.url).filter(Boolean)
  if (type === 'link' && c.thumbnail_url) return [c.thumbnail_url]
  if (type === 'banner' && c.image_url) return [c.image_url]
  return []
}

