// Gera as imagens de public/novidades/img/ a partir de Mockups.tsx:
//   captacao-gatilhos.jpg, captacao-modal.jpg, captacao-dashboard.jpg (2x)
//   captacao-og.jpg (1200x630, prévia do link no WhatsApp)
// Uso: node scripts/novidades-mockups/render.mjs
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const OUT = join(ROOT, 'public/novidades/img')
const require = createRequire(join(ROOT, 'package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { chromium } = require('playwright')

// dentro de node_modules pra o bundle achar react/lucide-react
const tmp = join(ROOT, 'node_modules/.cache/novidades-mockups')
mkdirSync(tmp, { recursive: true })
const bundle = join(tmp, 'mockups.cjs')
await build({
  entryPoints: [join(HERE, 'Mockups.tsx')], outfile: bundle, bundle: true, platform: 'node', format: 'cjs',
  jsx: 'automatic', external: ['react', 'react-dom', 'lucide-react'], nodePaths: [join(ROOT, 'node_modules')], logLevel: 'warning',
})
const M = require(bundle)

// Fonte do sistema, igual ao app (index.css)
const page = (body, extra = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #1A2B4A; }
${extra}</style></head><body>${body}</body></html>`

// ── Carrossel de posts: node render.mjs --carrossel ─────────────────────────
// 5 slides 1080x1350 em 2x (2160x2700) em divulgacao/captacao-inteligente/carrossel/
if (process.argv.includes('--carrossel')) {
  const cBundle = join(tmp, 'carrossel.cjs')
  await build({
    entryPoints: [join(HERE, 'Carrossel.tsx')], outfile: cBundle, bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', external: ['react', 'react-dom'], nodePaths: [join(ROOT, 'node_modules')], logLevel: 'warning',
  })
  const C = require(cBundle)
  const pub = pathToFileURL(join(ROOT, 'public')).href
  // Caminhos absolutos do site (/fonts, /novidades/img, logo) → arquivos de public/
  const css = C.SHARED_CSS.replace(/url\('\//g, `url('${pub}/`)
  const outDir = join(ROOT, 'divulgacao/captacao-inteligente/carrossel')
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 })
  for (const [i, Slide] of C.SLIDES.entries()) {
    const markup = renderToStaticMarkup(React.createElement(Slide)).replace(/src="\//g, `src="${pub}/`)
    const file = join(tmp, `slide-${i + 1}.html`)
    writeFileSync(file, page(markup, `${css}\nbody { width:1080px; height:1350px; overflow:hidden; }`))
    await p.goto(pathToFileURL(file).href, { waitUntil: 'load' })
    await p.evaluate(() => document.fonts.ready)
    const path = join(outDir, `captacao-inteligente-${i + 1}.png`)
    await p.locator('.slide').screenshot({ path })
    console.log('ok', path)
  }
  await browser.close()
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
const shot = async (name, Comp) => {
  const file = join(tmp, `${name}.html`)
  writeFileSync(file, page(renderToStaticMarkup(React.createElement(Comp))))
  const p = await ctx.newPage()
  await p.goto(pathToFileURL(file).href)
  const path = join(OUT, `${name}.jpg`)
  await p.locator('#shot').screenshot({ path, type: 'jpeg', quality: 86 })
  await p.close()
  console.log('ok', path)
  return path
}
await shot('captacao-gatilhos', M.ListaGatilhos)
await shot('captacao-modal', M.ModalGatilho)
const dash = await shot('captacao-dashboard', M.Dashboard)

// Prévia do link (og:image) — visual da landing + mockup do dashboard
const font = f => pathToFileURL(join(ROOT, 'public/fonts', f)).href
const og = `
@font-face { font-family:'Bricolage Grotesque'; src:url('${font('BricolageGrotesque-ExtraBold.woff2')}') format('woff2'); font-weight:800; }
@font-face { font-family:'Plus Jakarta Sans'; src:url('${font('PlusJakartaSans-Bold.woff2')}') format('woff2'); font-weight:700; }
@font-face { font-family:'Plus Jakarta Sans'; src:url('${font('PlusJakartaSans-Medium.woff2')}') format('woff2'); font-weight:500; }
body { margin:0; width:1200px; height:630px; overflow:hidden; font-family:'Plus Jakarta Sans',sans-serif; position:relative;
  background: radial-gradient(ellipse 70% 80% at 10% 40%, rgba(0,82,60,.98) 0%, transparent 65%), radial-gradient(ellipse 40% 50% at 92% 8%, rgba(219,39,119,.2) 0%, transparent 60%), #00301F; }
.grid { position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px); background-size:64px 64px; }
.txt { position:absolute; left:72px; top:78px; width:520px; }
.pill { display:inline-flex; align-items:center; gap:10px; border-radius:999px; padding:9px 20px; font-size:17px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; background:rgba(244,114,182,.16); color:#FBCFE8; border:1px solid rgba(244,114,182,.45); }
.dot { width:9px; height:9px; border-radius:50%; background:#F472B6; }
h1 { font-family:'Bricolage Grotesque',sans-serif; font-weight:800; font-size:64px; line-height:1.02; letter-spacing:-.035em; color:#fff; margin:30px 0 22px; }
h1 span { color:#0DD3BF; }
p { font-size:23px; line-height:1.5; color:rgba(255,255,255,.78); font-weight:500; margin:0; }
.brand { position:absolute; left:72px; bottom:56px; } .brand img { height:40px; }
.shot { position:absolute; left:640px; top:96px; width:760px; border-radius:16px; overflow:hidden; border:4px solid rgba(255,255,255,.14); box-shadow:0 40px 80px rgba(0,0,0,.5); background:#fff; }
.bar { height:30px; background:#FAFAFA; border-bottom:1px solid #eee; display:flex; align-items:center; gap:6px; padding:0 12px; }
.bar i { width:10px; height:10px; border-radius:50%; display:block; } .shot img { display:block; width:100%; }
.seal { position:absolute; left:668px; bottom:34px; font-size:14px; font-weight:700; color:#BE185D; background:#FDF2F8; border:1.5px dashed #F9A8D4; border-radius:999px; padding:6px 14px; box-shadow:0 8px 24px rgba(0,0,0,.25); }`
const ogHtml = `<div class="grid"></div>
<div class="txt"><span class="pill"><span class="dot"></span>Novidade · Captação Inteligente</span>
<h1>Saiba de qual anúncio veio <span>cada matrícula</span></h1>
<p>Cada conversa do WhatsApp chega marcada com a campanha de origem.</p></div>
<div class="brand"><img src="${pathToFileURL(join(ROOT, 'public/aion-logo-full.png')).href}"></div>
<div class="shot"><div class="bar"><i style="background:#FF5F57"></i><i style="background:#FFBD2E"></i><i style="background:#28C840"></i></div>
<img src="data:image/jpeg;base64,${readFileSync(dash).toString('base64')}"></div>
<span class="seal">Tela ilustrativa · dados de exemplo</span>`
const ogFile = join(tmp, 'og.html')
writeFileSync(ogFile, page(ogHtml, og))
const ogPage = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await ogPage.goto(pathToFileURL(ogFile).href)
await ogPage.evaluate(() => document.fonts.ready)
await ogPage.screenshot({ path: join(OUT, 'captacao-og.jpg'), type: 'jpeg', quality: 86 })
console.log('ok', join(OUT, 'captacao-og.jpg'))
await browser.close()
