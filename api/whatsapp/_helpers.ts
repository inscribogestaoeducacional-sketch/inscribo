import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface WAConfig {
  accessToken:  string
  verifyToken:  string
  appSecret:    string
  wabaId:       string
}

let cache: { config: WAConfig; at: number } | null = null
const CACHE_TTL_MS = 5 * 60_000 // 5 min

export async function getWAConfig(): Promise<WAConfig> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.config

  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token', 'wa_verify_token', 'wa_app_secret', 'wa_waba_id'])

  const map: Record<string, string> = {}
  for (const row of data || []) map[row.key] = row.value

  const config: WAConfig = {
    accessToken: map['wa_access_token'] || process.env.WA_ACCESS_TOKEN || '',
    verifyToken: map['wa_verify_token'] || process.env.WA_VERIFY_TOKEN || '',
    appSecret:   map['wa_app_secret']   || process.env.WA_APP_SECRET   || '',
    wabaId:      map['wa_waba_id']      || process.env.WA_WABA_ID      || '',
  }

  console.log('WA Config loaded:', {
    hasToken: !!config.accessToken,
    tokenLength: config.accessToken?.length,
    hasWabaId: !!config.wabaId,
  })

  cache = { config, at: Date.now() }
  return config
}
