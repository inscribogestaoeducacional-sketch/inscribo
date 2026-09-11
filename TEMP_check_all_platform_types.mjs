import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const envText = readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: settingsRows } = await admin.from('platform_settings').select('key, value').in('key', ['wa_access_token'])
const token = settingsRows.find(r => r.key === 'wa_access_token').value

const schools = [
  { name: 'Centro Educacional Marcella Araújo (CEMA)', id: '1264125370114075' },
  { name: 'Colégio Ágape Patos', id: '1214617431733213' },
  { name: 'Colégio Áion', id: '1007880222413531' },
  { name: 'Colégio STJ (Santa Teresa de Jesus)', id: '1321735544345758' },
]

for (const s of schools) {
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${s.id}?fields=display_phone_number,verified_name,platform_type,code_verification_status,is_on_biz_app`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    console.log(`\n=== ${s.name} (${s.id}) ===`)
    console.log('HTTP status:', res.status)
    console.log(JSON.stringify(data, null, 2))
  } catch (e) {
    console.log(`\n=== ${s.name} (${s.id}) === ERRO:`, e.message)
  }
}
