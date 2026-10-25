// Gera public/academy-lessons.json: o texto das aulas da Academia, que a assistente "Tire suas dúvidas" lê.
// Roda sozinho antes do build (npm run build -> prebuild). Se falhar, o build segue com o arquivo anterior.
import { build } from 'esbuild'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const out = join(tmpdir(), `academy-bundle-${process.pid}.mjs`)
try {
  await build({ entryPoints: [join(root, 'src/lib/academy/academyContent.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
  const m = await import(pathToFileURL(out).href)
  const lessons = m.LESSONS.map(l => ({
    key: l.key, module: l.module, title: l.title, summary: l.summary, steps: l.steps, tip: l.tip || null, to: l.to, routes: l.routes,
    managerOnly: !!l.managerOnly, adminOnly: !!l.adminOnly, attendantOnly: !!l.attendantOnly,
  }))
  mkdirSync(join(root, 'public'), { recursive: true })
  writeFileSync(join(root, 'public/academy-lessons.json'), JSON.stringify({ generated_at: new Date().toISOString(), lessons }))
  console.log(`[academy] public/academy-lessons.json: ${lessons.length} aulas`)
} catch (e) {
  console.warn('[academy] não foi possível gerar academy-lessons.json (segue com o anterior):', e?.message || e)
} finally {
  try { rmSync(out) } catch { /* nada */ }
}
