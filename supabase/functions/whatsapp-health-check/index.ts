// @ts-nocheck
// ── Conferência do WhatsApp das escolas (a cada 10 min, pg_cron) ────────────
// ETAPA 2 — Central de notificações. Para cada número ativo de escola, SÓ GET
// na Meta (status, plataforma, is_on_biz_app) com o token da plataforma, e
// grava pelo banco (whatsapp_health_record), que abre "WhatsApp desconectou"
// para o Super Admin e o gestor sem repetir e resolve quando volta.
// NUNCA chama /register nem grava nada na Meta. Não imprime tokens.
// Agendada em supabase/migrations/20261022100100_central_notificacoes_cron.sql.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GRAPH = 'https://graph.facebook.com/v25.0'
const META_TIMEOUT_MS = 15000

serve(async (req: Request) => {
  // Só o agendamento (service role) chama: a chave anônima também passa pelo
  // verify_jwt do gateway, então confere aqui.
  const bearer = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!bearer || bearer !== SUPABASE_SERVICE_KEY) return new Response('forbidden', { status: 403 })

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data: tok } = await sb.from('platform_settings').select('value').eq('key', 'wa_access_token').maybeSingle()
  const token = tok?.value || Deno.env.get('WA_ACCESS_TOKEN') || ''
  if (!token) return new Response(JSON.stringify({ error: 'sem token da plataforma' }), { status: 500 })

  const { data: phones, error } = await sb.from('whatsapp_phone_numbers')
    .select('phone_number_id')
    .not('institution_id', 'is', null)
    .eq('is_active', true)
    .eq('use_meta_api', true)
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })

  const ids = [...new Set((phones ?? []).map((p: { phone_number_id: string | null }) => p.phone_number_id).filter(Boolean))]
  const results: Record<string, string> = {}

  for (const id of ids) {
    let status: string | null = null
    let platform: string | null = null
    let bizApp: boolean | null = null
    let erro: string | null = null
    try {
      const r = await fetch(`${GRAPH}/${id}?fields=status,platform_type,is_on_biz_app`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(META_TIMEOUT_MS),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d?.status) {
        status = String(d.status)
        platform = d.platform_type ?? null
        bizApp = typeof d.is_on_biz_app === 'boolean' ? d.is_on_biz_app : null
      } else if (d?.error?.code === 100 && d?.error?.error_subcode === 33) {
        // "Object ... does not exist, cannot be loaded due to missing
        // permissions": o número saiu da conta ou a Áion perdeu o acesso a
        // ele — conta como queda (caso Colégio Áion 22/10/2026). Token
        // vencido/inválido (código 190) NÃO entra aqui: fica "não conferido",
        // senão todas as escolas "cairiam" juntas.
        status = 'INACESSIVEL'
        erro = `${d.error.message || 'número inacessível'} (código 100/33)`
      } else {
        // só código, mensagem e fbtrace_id — nunca o token
        erro = `${d?.error?.message || `HTTP ${r.status}`}${d?.error?.code ? ` (código ${d.error.code})` : ''}${d?.error?.fbtrace_id ? ` fbtrace ${d.error.fbtrace_id}` : ''}`
      }
    } catch (e) {
      erro = e instanceof Error ? e.message : String(e)
    }
    const { data: res, error: rpcErr } = await sb.rpc('whatsapp_health_record', {
      p_phone_number_id: id, p_status: status, p_platform_type: platform, p_is_on_biz_app: bizApp, p_error: erro,
    })
    results[id] = rpcErr ? `erro ao gravar: ${rpcErr.message}` : String(res)
  }

  return new Response(JSON.stringify({ conferidos: ids.length, resultados: results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
