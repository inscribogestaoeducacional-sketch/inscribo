const TOKEN  = process.env.WA_ACCESS_TOKEN
const PHONE_ID = '1007880222413531'
const WABA_ID  = '1222972209822315'
const BASE     = 'https://graph.facebook.com/v19.0'

async function get(url: string) {
  const res  = await fetch(url)
  const json = await res.json()
  return { status: res.status, ok: res.ok, body: json }
}

async function main() {
  if (!TOKEN) {
    console.error('❌  WA_ACCESS_TOKEN não encontrado em .env.local')
    process.exit(1)
  }
  console.log('Token (primeiros 20 chars):', TOKEN.slice(0, 20) + '…\n')

  // 1. Token validity
  console.log('━━━  1. Validade do token  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const me = await get(`${BASE}/me?access_token=${TOKEN}`)
  console.log(`HTTP ${me.status}`, JSON.stringify(me.body, null, 2))

  // 2. Phone number status
  console.log('\n━━━  2. Status do número de sandbox  ━━━━━━━━━━━━━━━━━━━━━')
  const phone = await get(
    `${BASE}/${PHONE_ID}?fields=display_phone_number,verified_name,status,quality_rating&access_token=${TOKEN}`
  )
  console.log(`HTTP ${phone.status}`, JSON.stringify(phone.body, null, 2))

  // 3. WABA phone numbers list
  console.log('\n━━━  3. Números da WABA  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  const list = await get(
    `${BASE}/${WABA_ID}/phone_numbers?access_token=${TOKEN}`
  )
  console.log(`HTTP ${list.status}`, JSON.stringify(list.body, null, 2))
}

main().catch(console.error)
