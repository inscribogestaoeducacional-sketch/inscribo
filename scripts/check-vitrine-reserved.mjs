// scripts/check-vitrine-reserved.mjs
//
// A Vitrine mora na raiz (aionedu.com.br/<slug>), então todo primeiro
// segmento de rota do app precisa estar nas DUAS listas de nomes proibidos:
//   - vercel.json: exclusão no rewrite /:slug → /api/vitrine/render
//     (senão a rota do app cai na Vitrine e vira 404);
//   - vitrine_reserved_slugs (migrations): senão uma escola pode pegar o
//     slug e a página dela nunca abre (o app responde antes).
// E as duas listas precisam ser iguais.
//
// Uso: node scripts/check-vitrine-reserved.mjs   (sai com código 1 se faltar algo)
// Rodar depois de criar rota nova de primeiro nível no App.tsx, pasta nova
// em public/ ou rewrite novo no vercel.json.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = p => readFileSync(join(root, p), 'utf8')
const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

// 1. Rotas do app: primeiro segmento de path="/x..." e pathname.startsWith('/x')
const app = read('src/App.tsx')
const routes = new Set()
for (const m of app.matchAll(/path="\/([^/"*:]+)/g)) routes.add(m[1])
for (const m of app.matchAll(/pathname\.startsWith\('\/([^/']+)/g)) routes.add(m[1])

// 2. Pastas e arquivos sem extensão em public/ e rewrites do vercel.json
for (const f of readdirSync(join(root, 'public'))) {
  if (statSync(join(root, 'public', f)).isDirectory() || !f.includes('.')) routes.add(f)
}
const vercel = JSON.parse(read('vercel.json'))
for (const r of vercel.rewrites) {
  const m = r.source.match(/^\/([a-z0-9-]+)/)
  if (m && !r.destination.startsWith('/api/vitrine')) routes.add(m[1])
}
routes.add('assets') // saída do build (vite)

// 3. Lista do vercel.json
const rule = vercel.rewrites.find(r => r.destination.startsWith('/api/vitrine'))
if (!rule) { console.error('Rewrite da Vitrine não encontrado no vercel.json'); process.exit(1) }
const vercelList = new Set(rule.source.match(/\(\?:([^)]+)\)\(\?:\$\|\/\)/)[1].split('|'))

// 4. Lista das migrations (todas as INSERT INTO vitrine_reserved_slugs)
const migDir = join(root, 'supabase/migrations')
const dbList = new Set()
for (const f of readdirSync(migDir).filter(f => f.endsWith('.sql'))) {
  const sql = readFileSync(join(migDir, f), 'utf8')
  for (const block of sql.matchAll(/INSERT INTO vitrine_reserved_slugs[\s\S]*?;/g)) {
    for (const m of block[0].matchAll(/\('([a-z0-9-]+)'\)/g)) dbList.add(m[1])
  }
}

const problems = []
for (const r of [...routes].sort()) {
  if (!SLUG.test(r)) continue // 1–2 letras ou com caractere inválido: nunca vira slug
  if (!vercelList.has(r)) problems.push(`rota "/${r}" fora da exclusão do vercel.json`)
  if (!dbList.has(r)) problems.push(`rota "/${r}" fora de vitrine_reserved_slugs (migration)`)
}
for (const s of vercelList) if (!dbList.has(s)) problems.push(`"${s}" está no vercel.json e não na migration`)
for (const s of dbList) if (!vercelList.has(s)) problems.push(`"${s}" está na migration e não no vercel.json`)

if (problems.length) {
  console.error('Lista de slugs reservados da Vitrine dessincronizada:\n  - ' + problems.join('\n  - '))
  process.exit(1)
}
console.log(`ok — ${routes.size} rotas do app cobertas; ${vercelList.size} nomes reservados iguais no vercel.json e no banco`)
