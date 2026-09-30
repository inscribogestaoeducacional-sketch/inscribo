// api/_lib/vitrineVcard.ts (servido por api/public.ts?route=vcard)
//
// Cartão de contato (.vcf) do bloco "Salvar contato" da Vitrine:
// /api/public?route=vcard&slug=<slug>&b=<id do bloco>. Os dados vêm de
// vitrine_public_page() (chave anônima, mesma lista fechada da página): o
// bloco só é achado se a página está publicada e o bloco visível. Nada de
// entrada do visitante vai pro arquivo além de escolher o bloco.
//
// vCard 3.0 (o que iPhone, Android e Outlook importam sem pedir nada):
// empresa (X-ABShowAs:COMPANY faz o iPhone mostrar como empresa), telefone,
// e-mail, site, link da página e endereço; a logo entra como foto quando é
// JPEG/PNG pequena (AVIF/WebP os celulares não leem no vCard).
import type { VercelRequest, VercelResponse } from '@vercel/node'

const SITE_URL = 'https://aionedu.com.br'
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const PHOTO_MAX = 150 * 1024

export interface VcardData {
  name: string
  phone?: string | null
  email?: string | null
  website?: string | null
  address?: string | null
  pageUrl: string
  photo?: { type: 'JPEG' | 'PNG'; base64: string } | null
}

// Texto de propriedade: \ ; , e quebra de linha escapados (RFC 2426).
const vtext = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Linhas com mais de 75 bytes continuam na seguinte começando com espaço.
// Corta por caractere (não parte acentos no meio).
function fold(line: string): string {
  const out: string[] = []
  let cur = '', bytes = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch)
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0 }
    cur += ch; bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

// "83999998888" → "+5583999998888"; já com 55 (12–13 dígitos) só ganha o +.
export function e164(digits: string): string {
  const d = digits.replace(/\D/g, '')
  return d.length <= 11 ? `+55${d}` : `+${d}`
}

export function buildVcard(v: VcardData): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:;;;;',
    `FN:${vtext(v.name)}`,
    `ORG:${vtext(v.name)}`,
    'X-ABShowAs:COMPANY',
  ]
  if (v.phone) lines.push(`TEL;TYPE=WORK,VOICE:${e164(v.phone)}`)
  if (v.email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vtext(v.email)}`)
  if (v.website) lines.push(`URL;TYPE=WORK:${v.website}`)
  lines.push(`URL:${v.pageUrl}`)
  if (v.address) lines.push(`ADR;TYPE=WORK:;;${vtext(v.address)};;;;`)
  if (v.photo) lines.push(`PHOTO;ENCODING=b;TYPE=${v.photo.type}:${v.photo.base64}`)
  lines.push('END:VCARD')
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Nome de arquivo seguro: "Colégio Ágape" → "colegio-agape.vcf".
export function vcardFileName(name: string): string {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${base || 'contato'}.vcf`
}

async function logoPhoto(url: unknown): Promise<VcardData['photo']> {
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) return null
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 2500)
    const r = await fetch(url, { signal: ctl.signal })
    clearTimeout(t)
    const type = (r.headers.get('content-type') || '').split(';')[0].trim()
    const kind = type === 'image/jpeg' ? 'JPEG' : type === 'image/png' ? 'PNG' : null
    if (!r.ok || !kind) return null
    const buf = Buffer.from(await r.arrayBuffer())
    return buf.length <= PHOTO_MAX ? { type: kind, base64: buf.toString('base64') } : null
  } catch { return null }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }
  const slug = String(req.query.slug || '').toLowerCase()
  const blockId = String(req.query.b || '').toLowerCase()
  if (!SLUG_RE.test(slug) || !UUID_RE.test(blockId)) return res.status(404).send('Contato não encontrado.')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) return res.status(503).send('Indisponível.')

  let data: any = null
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/vitrine_public_page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_slug: slug }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    data = await r.json()
  } catch (e: any) {
    console.error('[vitrine vcard] erro ao buscar página', slug, e?.message)
    return res.status(503).send('Indisponível.')
  }
  const block = (data?.blocks || []).find((b: any) => b?.id === blockId && b?.type === 'contact')
  if (!block) return res.status(404).setHeader('Cache-Control', 'public, s-maxage=30').send('Contato não encontrado.')

  const c = block.config || {}
  const name = String(c.name || data.page?.institution_name || 'Escola').trim()
  const vcf = buildVcard({
    name,
    phone: typeof c.phone === 'string' && /^[0-9]{10,13}$/.test(c.phone) ? c.phone : null,
    email: typeof c.email === 'string' && c.email.length <= 120 ? c.email : null,
    website: typeof c.website === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(c.website) ? c.website : null,
    address: typeof c.address === 'string' ? c.address.slice(0, 300) : null,
    pageUrl: `${SITE_URL}/${slug}`,
    photo: await logoPhoto(data.page?.logo_url),
  })
  res.setHeader('Content-Type', 'text/vcard; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${vcardFileName(name)}"`)
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600')
  return res.status(200).send(vcf)
}
