// Gera as imagens das páginas de novidade em public/novidades/img/:
//   node scripts/novidades-mockups/render.mjs                → Captação (Mockups.tsx):
//       captacao-gatilhos.jpg, captacao-modal.jpg, captacao-dashboard.jpg (2x) e captacao-og.jpg
//   node scripts/novidades-mockups/render.mjs --vitrine      → Vitrine (MockupsVitrine.tsx):
//       vitrine-editor.jpg, vitrine-modelos.jpg, vitrine-pagina.jpg, vitrine-desempenho.jpg e vitrine-og.jpg
//   node scripts/novidades-mockups/render.mjs --transmissoes → Transmissões (MockupsTransmissoes.tsx):
//       transmissoes-detalhe.jpg, -publico.jpg, -respostas.jpg, -mensagem.jpg e transmissoes-og.jpg
//   node scripts/novidades-mockups/render.mjs --carrossel[=captacao-inteligente|vitrine|transmissoes]
//       → posts do Instagram em divulgacao/<módulo>/carrossel/ (Carrossel.tsx)
// *-og.jpg = 1200x630, prévia do link no WhatsApp (vite.config.ts → SHARE_PAGES).
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
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
const bundleOf = async (entry, name) => {
  const outfile = join(tmp, `${name}.cjs`)
  await build({
    entryPoints: [join(HERE, entry)], outfile, bundle: true, platform: 'node', format: 'cjs',
    jsx: 'automatic', external: ['react', 'react-dom', 'lucide-react'], nodePaths: [join(ROOT, 'node_modules')], logLevel: 'warning',
  })
  return require(outfile)
}

// Fonte do sistema, igual ao app (index.css)
const page = (body, extra = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #1A2B4A; }
${extra}</style></head><body>${body}</body></html>`

const arg = name => process.argv.find(a => a === `--${name}` || a.startsWith(`--${name}=`))

// ── Carrossel de posts: --carrossel[=módulo] ────────────────────────────────
// 5 slides 1080x1350 em 2x (2160x2700) em divulgacao/<módulo>/carrossel/
const carrossel = arg('carrossel')
if (carrossel) {
  const key = carrossel.includes('=') ? carrossel.split('=')[1] : 'captacao-inteligente'
  const C = await bundleOf('Carrossel.tsx', 'carrossel')
  const slides = C.CARROSSEIS[key]
  if (!slides) throw new Error(`carrossel desconhecido: ${key} (use ${Object.keys(C.CARROSSEIS).join(', ')})`)
  const pub = pathToFileURL(join(ROOT, 'public')).href
  // Caminhos absolutos do site (/fonts, /novidades/img, logo) → arquivos de public/
  const css = C.SHARED_CSS.replace(/url\('\//g, `url('${pub}/`)
  const outDir = join(ROOT, `divulgacao/${key}/carrossel`)
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  const p = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 })
  for (const [i, Slide] of slides.entries()) {
    const markup = renderToStaticMarkup(React.createElement(Slide)).replace(/src="\//g, `src="${pub}/`)
    const file = join(tmp, `slide-${i + 1}.html`)
    writeFileSync(file, page(markup, `${css}\nbody { width:1080px; height:1350px; overflow:hidden; }`))
    await p.goto(pathToFileURL(file).href, { waitUntil: 'load' })
    await p.evaluate(() => document.fonts.ready)
    const path = join(outDir, `${key}-${i + 1}.png`)
    await p.locator('.slide').screenshot({ path })
    console.log('ok', path)
  }
  await browser.close()
  process.exit(0)
}

// Prévia do link (og:image) — visual da landing + uma tela do módulo
async function renderOg(browser, { file, pill, title, hl, sub, shot }) {
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
<div class="txt"><span class="pill"><span class="dot"></span>${pill}</span>
<h1>${title} <span>${hl}</span></h1>
<p>${sub}</p></div>
<div class="brand"><img src="${pathToFileURL(join(ROOT, 'public/aion-logo-full.png')).href}"></div>
<div class="shot"><div class="bar"><i style="background:#FF5F57"></i><i style="background:#FFBD2E"></i><i style="background:#28C840"></i></div>
<img src="data:image/jpeg;base64,${readFileSync(shot).toString('base64')}"></div>
<span class="seal">Tela ilustrativa · dados de exemplo</span>`
  const ogFile = join(tmp, 'og.html')
  writeFileSync(ogFile, page(ogHtml, og))
  const ogPage = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await ogPage.goto(pathToFileURL(ogFile).href)
  await ogPage.evaluate(() => document.fonts.ready)
  await ogPage.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 86 })
  await ogPage.close()
  console.log('ok', join(OUT, file))
}

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
// wait: telas com iframe (página da Vitrine) esperam as fontes do Google carregarem.
const shot = async (name, Comp, wait = 0) => {
  const file = join(tmp, `${name}.html`)
  writeFileSync(file, page(renderToStaticMarkup(React.createElement(Comp))))
  const p = await ctx.newPage()
  await p.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  if (wait) await p.waitForTimeout(wait)
  const path = join(OUT, `${name}.jpg`)
  await p.locator('#shot').screenshot({ path, type: 'jpeg', quality: 86 })
  await p.close()
  console.log('ok', path)
  return path
}

if (arg('vitrine')) {
  // Logo fictícia servida por http (o renderizador da Vitrine só aceita http(s)).
  const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#1D4ED8"/><circle cx="100" cy="100" r="78" fill="none" stroke="#fff" stroke-width="6"/><text x="100" y="124" text-anchor="middle" font-family="Georgia,serif" font-size="72" font-weight="700" fill="#fff">CE</text></svg>`
  const srv = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end(logo) })
  await new Promise(r => srv.listen(0, '127.0.0.1', r))
  process.env.DEMO_ASSETS = `http://127.0.0.1:${srv.address().port}`
  // "Aberto agora" do bloco de horário sai calculado na renderização: fixa
  // uma terça às 10h (Brasília) pra imagem não depender da hora em que rodou.
  const RealDate = Date, FIXED = RealDate.parse('2026-10-06T13:00:00Z')
  globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [FIXED])) } static now() { return FIXED } }
  const M = await bundleOf('MockupsVitrine.tsx', 'mockups-vitrine')
  const editor = await shot('vitrine-editor', M.Editor, 2500)
  await shot('vitrine-modelos', M.Modelos, 2500)
  await shot('vitrine-pagina', M.Pagina, 2500)
  await shot('vitrine-desempenho', M.Desempenho, 2500)
  globalThis.Date = RealDate
  await renderOg(browser, { file: 'vitrine-og.jpg', pill: 'Novidade · Vitrine Áion', title: 'Um link só com', hl: 'tudo o que a família procura', sub: 'WhatsApp, matrícula, redes, horário e endereço da escola num endereço só.', shot: editor })
  srv.close()
} else if (arg('transmissoes')) {
  const M = await bundleOf('MockupsTransmissoes.tsx', 'mockups-transmissoes')
  const detalhe = await shot('transmissoes-detalhe', M.Detalhe)
  await shot('transmissoes-publico', M.Publico)
  await shot('transmissoes-respostas', M.Respostas)
  await shot('transmissoes-mensagem', M.Mensagem)
  await renderOg(browser, { file: 'transmissoes-og.jpg', pill: 'Novidade · Transmissões', title: 'Fale com todas as famílias', hl: 'pelo WhatsApp oficial', sub: 'Campanhas com público, custo e respostas à vista.', shot: detalhe })
} else {
  const M = await bundleOf('Mockups.tsx', 'mockups')
  await shot('captacao-gatilhos', M.ListaGatilhos)
  await shot('captacao-modal', M.ModalGatilho)
  const dash = await shot('captacao-dashboard', M.Dashboard)
  await renderOg(browser, { file: 'captacao-og.jpg', pill: 'Novidade · Captação Inteligente', title: 'Saiba de qual anúncio veio', hl: 'cada matrícula', sub: 'Cada conversa do WhatsApp chega marcada com a campanha de origem.', shot: dash })
}
await browser.close()
