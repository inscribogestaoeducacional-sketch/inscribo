import { getSupabaseAdmin, GRAPH_URL, WA_APP_ID, WA_APP_SECRET } from './whatsappAuth.js'

// ── App da Meta: segredo, troca do code e erro da Graph API ─────────────────
// Usado pela conexão (api/_lib/whatsappConnect.ts) e pela reconexão
// (api/_lib/whatsappReconnect.ts) do Cadastro Incorporado.
//
// Segredo do app: PRIMEIRO platform_settings.wa_app_secret (o mesmo que o
// webhook e o envio usam), WA_APP_SECRET da Vercel só como reserva. Caso
// Colégio Áion 21/10/2026: o da Vercel/.env estava desatualizado ("Error
// validating client secret") e toda troca de code era recusada.
//
// Erro da Meta: só código, subcódigo, tipo, mensagem e fbtrace_id — nunca
// token, code ou segredo (metaErrorText ainda apaga qualquer coisa parecida).

const META_FETCH_TIMEOUT_MS = 30000

export type SecretOrigin = 'banco' | 'vercel'

export function pickAppSecret(
  fromDb: string | null | undefined, fromEnv: string | null | undefined,
): { secret: string; origem: SecretOrigin } | null {
  const db = String(fromDb || '').trim()
  if (db) return { secret: db, origem: 'banco' }
  const env = String(fromEnv || '').trim()
  if (env) return { secret: env, origem: 'vercel' }
  return null
}

export async function getAppSecret(): Promise<{ secret: string; origem: SecretOrigin } | null> {
  let fromDb: string | null = null
  try {
    const { data } = await getSupabaseAdmin().from('platform_settings')
      .select('value').eq('key', 'wa_app_secret').maybeSingle()
    fromDb = data?.value ?? null
  } catch (e) {
    console.warn('[metaApp] não leu wa_app_secret do banco:', e instanceof Error ? e.message : String(e))
  }
  return pickAppSecret(fromDb, WA_APP_SECRET)
}

export interface MetaError {
  code?: number
  subcode?: number
  type?: string
  message: string
  fbtrace_id?: string
}

// Tokens da Meta (EAA…), segredos e codes nunca vão para o audit.
const scrub = (s: string) => s
  .replace(/EAA[A-Za-z0-9]{10,}/g, '<token>')
  .replace(/(client_secret|access_token|code)=[^&\s]+/gi, '$1=<oculto>')

// Corpo de resposta da Graph API (ou exceção de rede) → erro só com os campos permitidos.
export function metaError(body: unknown, fallback = 'falha na Meta'): MetaError {
  const e = (body as { error?: Record<string, unknown> } | null)?.error
  if (!e || typeof e !== 'object') return { message: scrub(fallback).slice(0, 300) }
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined)
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)
  const out: MetaError = { message: scrub(String(e.message || fallback)).slice(0, 300) }
  if (num(e.code) !== undefined) out.code = num(e.code)
  if (num(e.error_subcode) !== undefined) out.subcode = num(e.error_subcode)
  if (str(e.type)) out.type = str(e.type)
  if (str(e.fbtrace_id)) out.fbtrace_id = str(e.fbtrace_id)
  return out
}

// "mensagem (código 1/2, fbtrace X)" — para mensagens de tela e audit.
export function metaErrorText(m: MetaError): string {
  const extra = [
    m.code !== undefined ? `código ${m.code}${m.subcode !== undefined ? `/${m.subcode}` : ''}` : '',
    m.fbtrace_id ? `fbtrace ${m.fbtrace_id}` : '',
  ].filter(Boolean).join(', ')
  return extra ? `${m.message} (${extra})` : m.message
}

export const errorFromException = (e: unknown): MetaError =>
  ({ message: scrub(e instanceof Error ? e.message : String(e)).slice(0, 300) })

// Troca o code do popup pelo token da empresa. Nunca lança.
export async function exchangeCodeForToken(
  code: string,
): Promise<{ token?: string; erro?: string; meta?: MetaError; segredo: SecretOrigin | null }> {
  const app = await getAppSecret()
  if (!WA_APP_ID || !app) {
    return { erro: 'WA_APP_ID ou o segredo do app (wa_app_secret / WA_APP_SECRET) não configurado', segredo: app?.origem ?? null }
  }
  try {
    const r = await fetch(
      `${GRAPH_URL}/oauth/access_token?client_id=${WA_APP_ID}&client_secret=${encodeURIComponent(app.secret)}&code=${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS) },
    )
    const d = await r.json().catch(() => ({}))
    if (r.ok && d?.access_token) return { token: d.access_token, segredo: app.origem }
    const meta = metaError(d, `HTTP ${r.status}`)
    return { erro: metaErrorText(meta), meta, segredo: app.origem }
  } catch (e) {
    const meta = errorFromException(e)
    return { erro: meta.message, meta, segredo: app.origem }
  }
}
