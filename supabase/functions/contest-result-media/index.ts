import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Entrega links temporários das imagens das questões para o aluno que consulta o resultado.
// Só responde se a inscrição + data de nascimento forem válidas e a escola já tiver liberado a etapa 1.
// Assina apenas as imagens das questões da prova daquele aluno.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { slug, number, birth } = await req.json()
    if (!slug || !number || !birth) return json({ ok: false, urls: {} }, 400)
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data } = await sb.rpc('contest_public_result', { p_slug: String(slug), p_number: Number(number), p_birth: String(birth) })
    if (!data?.ok) return json({ ok: false, urls: {} })
    const paths = new Set<string>()
    for (const q of data.questions ?? []) for (const p of q.images ?? []) if (typeof p === 'string') paths.add(p)
    const urls: Record<string, string> = {}
    if (paths.size) {
      const { data: signed } = await sb.storage.from('contest-media').createSignedUrls(Array.from(paths), 3600)
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
    }
    return json({ ok: true, urls })
  } catch (_e) {
    return json({ ok: false, urls: {} }, 500)
  }
})
