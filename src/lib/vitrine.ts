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
const IMAGE_MAX = 5 * 1024 * 1024

export async function uploadVitrineImage(institutionId: string, file: File): Promise<string> {
  const ext = IMAGE_MIMES[file.type]
  if (!ext) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > IMAGE_MAX) throw new Error('A imagem pode ter no máximo 5 MB.')
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
  return []
}

