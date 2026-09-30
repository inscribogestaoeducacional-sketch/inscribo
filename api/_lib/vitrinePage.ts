// api/_lib/vitrinePage.ts (servido por api/public.ts?route=vitrine)
//
// Página pública da Vitrine: aionedu.com.br/<slug> chega aqui pelo rewrite do
// vercel.json (só slugs no formato válido e fora da lista de rotas do app —
// ver scripts/check-vitrine-reserved.mjs).
//
// Chama vitrine_public_page() com a chave ANÔNIMA: a função é SECURITY
// DEFINER, liberada pra anon e devolve só a lista fechada de campos pra
// renderizar (20260929060000_vitrine.sql) — aqui não precisa de service role.
//
// Cache na CDN da Vercel: página publicada 60 s (+10 min servindo a versão
// anterior enquanto revalida), então edição no editor aparece em ~1 min.
// 404 com cache curto, pra página recém-publicada aparecer logo.
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { renderVitrinePage, renderVitrineNotFound, type VitrinePublicData } from './vitrineRender.js'

const SITE_URL = 'https://aionedu.com.br'
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

function sendHtml(res: VercelResponse, status: number, html: string, cache: string) {
  res.status(status)
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', cache)
  res.send(html)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).end()
  }

  const slug = String(req.query.slug || '').toLowerCase()
  if (!SLUG_RE.test(slug)) {
    return sendHtml(res, 404, renderVitrineNotFound(SITE_URL), 'public, s-maxage=30')
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
  if (!supabaseUrl || !anonKey) {
    console.error('[vitrine] SUPABASE_URL/anon key ausentes no ambiente')
    return sendHtml(res, 503, renderVitrineNotFound(SITE_URL), 'no-store')
  }

  let data: (VitrinePublicData & { redirect?: string }) | null = null
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/vitrine_public_page`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ p_slug: slug }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
    data = await r.json()
  } catch (e: any) {
    console.error('[vitrine] erro ao buscar página', slug, e?.message)
    return sendHtml(res, 503, renderVitrineNotFound(SITE_URL), 'no-store')
  }

  if (!data) {
    return sendHtml(res, 404, renderVitrineNotFound(SITE_URL), 'public, s-maxage=30')
  }

  if (data.redirect && SLUG_RE.test(data.redirect)) {
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    res.setHeader('Location', `/${data.redirect}`)
    return res.status(301).end()
  }

  const html = renderVitrinePage(data, { siteUrl: SITE_URL, supabaseUrl, anonKey })
  return sendHtml(res, 200, html, cacheFor((data as any).next_change_at))
}

// Cache normal: 60 s + até 10 min servindo a versão anterior enquanto
// revalida. Com virada de agenda (bloco entrando/saindo, página saindo do ar)
// antes disso, o cache vai só até a virada e sem versão antiga — senão o
// bloco agendado apareceria (ou sumiria) até 11 min atrasado.
export function cacheFor(nextChangeAt: unknown, now = Date.now()): string {
  const t = typeof nextChangeAt === 'string' ? Date.parse(nextChangeAt) : NaN
  const secs = Number.isFinite(t) ? Math.floor((t - now) / 1000) : Infinity
  if (secs >= 660) return 'public, s-maxage=60, stale-while-revalidate=600'
  return `public, s-maxage=${Math.max(1, Math.min(60, secs))}, stale-while-revalidate=0`
}
