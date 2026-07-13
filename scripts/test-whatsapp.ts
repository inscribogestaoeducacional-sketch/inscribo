/**
 * scripts/test-whatsapp.ts
 * Teste básico de integração com a Meta Cloud API (WhatsApp).
 *
 * Uso:
 *   WA_ACCESS_TOKEN=EAAxxxx WABA_ID=2812... npx tsx scripts/test-whatsapp.ts
 *
 * Ou crie um .env.local com as variáveis e rode:
 *   npx tsx --env-file=.env.local scripts/test-whatsapp.ts
 */

const TOKEN   = process.env.WA_ACCESS_TOKEN
const WABA_ID = process.env.WABA_ID || '2812701862456294'
const BASE    = 'https://graph.facebook.com/v19.0'

// ── Helpers ─────────────────────────────────────────────────────────────────

function ok(label: string)  { console.log(`  ✅ ${label}`) }
function err(label: string) { console.log(`  ❌ ${label}`) }
function info(label: string){ console.log(`  ℹ️  ${label}`) }
function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

async function get(url: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  })
  const json = await res.json() as any
  return { status: res.status, ok: res.ok, data: json }
}

// ── 1. Verificar variáveis de ambiente ───────────────────────────────────────

section('1. Variáveis de ambiente')

const required = [
  { key: 'WA_ACCESS_TOKEN', val: process.env.WA_ACCESS_TOKEN },
  { key: 'WA_VERIFY_TOKEN', val: process.env.WA_VERIFY_TOKEN },
  { key: 'WA_APP_SECRET',   val: process.env.WA_APP_SECRET   },
  { key: 'SUPABASE_URL',    val: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL },
]

for (const v of required) {
  if (v.val) {
    const preview = v.key.includes('SECRET') || v.key.includes('TOKEN')
      ? `${v.val.slice(0, 8)}...`
      : v.val
    ok(`${v.key} = ${preview}`)
  } else {
    err(`${v.key} — NÃO DEFINIDA`)
  }
}

if (!TOKEN) {
  console.log('\n⛔  WA_ACCESS_TOKEN ausente — abortando testes de API.\n')
  console.log('   Defina a variável e rode novamente:')
  console.log('   WA_ACCESS_TOKEN=EAAxxxx npx tsx scripts/test-whatsapp.ts\n')
  process.exit(1)
}

// ── 2. Verificar token — GET /me ─────────────────────────────────────────────

section('2. Verificar token (GET /me)')

const me = await get(`${BASE}/me?access_token=${TOKEN}`)
if (me.ok) {
  ok(`Token válido`)
  info(`id   : ${me.data.id}`)
  info(`name : ${me.data.name}`)
} else {
  err(`Token inválido ou expirado`)
  info(`Erro: ${me.data?.error?.message || JSON.stringify(me.data)}`)
}

// ── 3. Listar números cadastrados na WABA ────────────────────────────────────

section(`3. Phone numbers da WABA ${WABA_ID}`)

const phones = await get(`${BASE}/${WABA_ID}/phone_numbers?fields=display_phone_number,verified_name,status,quality_rating`)

if (phones.ok) {
  const list: any[] = phones.data?.data || []
  if (list.length === 0) {
    info('Nenhum número encontrado nesta WABA.')
  } else {
    ok(`${list.length} número(s) encontrado(s):`)
    for (const p of list) {
      console.log(`\n     📱 ${p.display_phone_number}`)
      console.log(`        verified_name  : ${p.verified_name}`)
      console.log(`        status         : ${p.status}`)
      console.log(`        quality_rating : ${p.quality_rating}`)
      console.log(`        id             : ${p.id}`)
    }
  }
} else {
  err(`Falha ao consultar phone_numbers`)
  info(`Status HTTP: ${phones.status}`)
  info(`Erro: ${phones.data?.error?.message || JSON.stringify(phones.data)}`)
  if (phones.status === 403) {
    info('Possível causa: token não tem permissão whatsapp_business_management')
  }
}

// ── 4. Verificar configuração do webhook ─────────────────────────────────────

section('4. Resumo da configuração')

const waVerifyToken = process.env.WA_VERIFY_TOKEN
const waAppSecret   = process.env.WA_APP_SECRET

console.log()
console.log(`  WA_ACCESS_TOKEN : ${TOKEN ? '✅ presente' : '❌ ausente'}`)
console.log(`  WA_VERIFY_TOKEN : ${waVerifyToken ? '✅ presente' : '❌ ausente — webhook GET vai rejeitar'}`)
console.log(`  WA_APP_SECRET   : ${waAppSecret   ? '✅ presente' : '⚠️  ausente — validação HMAC desativada'}`)
console.log(`  WABA_ID usado   : ${WABA_ID}`)
console.log()
