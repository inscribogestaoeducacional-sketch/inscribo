// Gera as peças do calendário de divulgação em docs/marketing/artes/:
//   node scripts/divulgacao-artes/render.mjs            → todas (PNG + MP4)
//   node scripts/divulgacao-artes/render.mjs A02        → só as indicadas
//   ... --sem-video                                     → só os PNGs
// Artes.tsx (molde dos carrosséis de novidade) com as telas VIVAS dentro:
// aqui a escala ([data-fit]) e os recortes da capa ([data-recorte]) são
// ajustados no navegador. PNG = estado final. MP4 = 8 s a 30 fps da imagem
// que tem a tela do sistema; só a tela se mexe (números, barras, linhas,
// mensagens, destaque pulsando) e o fim volta ao começo pra repetir sem corte.
// Precisa de um ffmpeg com libx264: FFMPEG=caminho, ou ffmpeg-static instalado
// fora do projeto (o do Playwright só tem VP8).
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const OUT = join(ROOT, 'docs/marketing/artes')
const require = createRequire(join(ROOT, 'package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { chromium } = require('playwright')

const tmp = join(ROOT, 'node_modules/.cache/divulgacao-artes')
mkdirSync(tmp, { recursive: true })
mkdirSync(OUT, { recursive: true })
const url = p => pathToFileURL(p).href
const pub = url(join(ROOT, 'public'))
const page = (body, css = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #1A2B4A; }
${css}</style></head><body>${body}</body></html>`

const args = process.argv.slice(2)
const only = args.filter(a => /^A\d\d$/.test(a))
const comVideo = !args.includes('--sem-video')
const want = code => !only.length || only.includes(code)

// ── Ajustes de layout no navegador ──────────────────────────────────────────
function layout() {
  // altura do iframe = altura do conteúdo (#shot)
  const fitFrame = fr => {
    const d = fr.contentDocument, shot = d.querySelector('#shot') || d.body
    const h = Math.ceil(shot.getBoundingClientRect().bottom)
    fr.style.height = `${h}px`
    return { d, h }
  }
  for (const f of document.querySelectorAll('[data-fit]')) {
    const fr = f.querySelector('iframe'), { h } = fitFrame(fr), s = f.clientWidth / Number(f.dataset.fit)
    fr.style.transform = `scale(${s})`
    f.style.height = `${h * s}px`
  }
  const byText = (root, text) => [...root.querySelectorAll('*')]
    .filter(e => e.textContent.trim() === text)
    .sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0]
  for (const r of document.querySelectorAll('[data-recorte]')) {
    const inner = r.querySelector('iframe'), { d } = fitFrame(inner)
    let el = byText(d.body, r.dataset.focus)
    if (!el) throw new Error(`recorte: não achei "${r.dataset.focus}"`)
    for (let i = 0; i < Number(r.dataset.up); i++) el = el.parentElement
    const er = el.getBoundingClientRect(), z = Number(r.dataset.zoom)
    const cx = er.left + er.width / 2, cy = er.top + er.height / 2
    inner.style.transform = `translate(${r.clientWidth * 0.42 - cx * z}px, ${r.clientHeight * 0.34 - cy * z}px) scale(${z})`
  }
  // Texto da arte que passou da borda (o que está dentro das telas não conta)
  return [...document.querySelectorAll('h1,h2,p,.btn-g')]
    .filter(el => !el.closest('[data-fit],[data-recorte]'))
    .filter(el => { const r = el.getBoundingClientRect(); return r.bottom > 1350 - 24 || r.right > 1080 - 24 })
    .map(el => el.textContent.slice(0, 40))
}

// ── Animação (roda no navegador; t em segundos, 0 a 8) ─────────────────────
function animar(kind, t) {
  const fr = document.querySelector('[data-anim-root] iframe')
  const root = fr.contentDocument.body
  const esc = fr.getBoundingClientRect().width / fr.offsetWidth
  const ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3)
  // vai de 0 a 1 até 2,2 s, segura, e volta a 0 entre 7 e 8 s (repetição sem corte)
  const p = t < 2.2 ? ease(t / 2.2) : t < 7 ? 1 : 1 - ease(t - 7)
  const volta = t < 7 ? 1 : 1 - ease((t - 7) / 0.8)
  if (!window.__init) {
    window.__init = true
    const num = /^(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?(%)?$/
    window.__nums = [...root.querySelectorAll('*')].filter(e => !e.children.length && num.test(e.textContent.trim())
      && (e.namespaceURI !== 'http://www.w3.org/2000/svg' || e.getAttribute('font-weight') === '600'))
      .map(e => { const m = e.textContent.trim().match(num); return { e, v: Number((m[1] + (m[2] || '')).replace(/\./g, '').replace(',', '.')), dec: m[2] ? m[2].length - 1 : 0, pct: m[3] || '' } })
    window.__bars = [...root.querySelectorAll('path[fill="#00A896"]')]
    for (const b of window.__bars) { b.style.transformBox = 'fill-box'; b.style.transformOrigin = 'left center' }
    const ring = document.createElement('div')
    Object.assign(ring.style, { position: 'absolute', border: '4px solid #0DD3BF', borderRadius: '16px', boxShadow: '0 0 0 8px rgba(13,211,191,.25), 0 0 28px rgba(13,211,191,.55)', pointerEvents: 'none', zIndex: 50, opacity: 0 })
    document.body.appendChild(ring)
    window.__ring = ring
  }
  for (const n of window.__nums) n.e.textContent = (n.v * p).toLocaleString('pt-BR', { minimumFractionDigits: n.dec, maximumFractionDigits: n.dec }) + n.pct
  for (const b of window.__bars) b.style.transform = `scaleX(${Math.max(0.001, p)})`
  // destaque pulsando sobre o ponto principal
  let alvo = null
  if (kind === 'dash') {
    alvo = [...root.querySelectorAll('*')].find(e => !e.children.length && e.textContent.trim() === 'Matrículas (1º toque)')
    if (alvo) alvo = alvo.parentElement.parentElement
  } else if (kind === 'pesq') alvo = root.querySelector('[data-focus]')
  if (alvo) {
    const o = fr.getBoundingClientRect(), a = alvo.getBoundingClientRect(), pad = 8
    const r = { left: o.left + a.left * esc, top: o.top + a.top * esc, width: a.width * esc, height: a.height * esc }
    Object.assign(window.__ring.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` })
    const on = t > 2.4 && t < 6.9 ? 1 : 0
    window.__ring.style.opacity = on * (0.55 + 0.45 * Math.sin((t - 2.4) * Math.PI * 2 / 1.2))
  }
  // linhas da tabela entrando uma a uma
  root.querySelectorAll('[data-row]').forEach((row, i) => {
    const a = ease((t - 0.2 - i * 0.3) / 0.35) * volta
    row.style.opacity = a; row.style.transform = `translateY(${(1 - a) * 12}px)`
  })
  // mensagens chegando no celular
  const tempos = [0.3, 1.1, 2.0, 2.8, 3.7, 4.6]
  root.querySelectorAll('[data-msg]').forEach((m, i) => {
    const a = ease((t - tempos[i]) / 0.35) * (t < 7.2 ? 1 : 1 - ease((t - 7.2) / 0.6))
    m.style.opacity = a; m.style.transform = `translateY(${(1 - a) * 16}px) scale(${0.96 + 0.04 * a})`
  })
}

// ── Execução ────────────────────────────────────────────────────────────────
const outfile = join(tmp, 'artes.cjs')
await build({ entryPoints: [join(HERE, 'Artes.tsx')], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react-dom', 'lucide-react'], nodePaths: [join(ROOT, 'node_modules')], logLevel: 'warning' })
const A = require(outfile)
const css = A.SHARED_CSS.replace(/url\('\//g, `url('${pub}/`)
const pieces = [
  ...Object.entries(A.CARROSSEIS).flatMap(([code, slides]) => slides.map((S, i) => ({ code, name: `${code}-${i + 1}`, S, anim: i === 2 ? (code === 'A01' ? 'dash' : 'pesq') : null }))),
  { code: 'A03', name: 'A03', S: A.A03, anim: 'robo' },
]
const ffmpeg = process.env.FFMPEG || (() => { try { return require(join(process.env.FFMPEG_STATIC_DIR || '', 'node_modules/ffmpeg-static')) } catch { return 'ffmpeg' } })()
const bp = await chromium.launch()
const p = await bp.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 })
for (const { code, name, S, anim } of pieces.filter(x => want(x.code))) {
  const html = join(tmp, `${name}.html`)
  writeFileSync(html, page(renderToStaticMarkup(React.createElement(S)).replace(/src="\//g, `src="${pub}/`), `${css}\nbody { width:1080px; height:1350px; overflow:hidden; }`))
  await p.goto(url(html), { waitUntil: 'load' })
  await p.evaluate(() => document.fonts.ready)
  const over = await p.evaluate(layout)
  await p.locator('.slide').screenshot({ path: join(OUT, `${name}.png`) })
  let msg = `${name}.png ok${over.length ? `  ⚠ texto fora: ${over.join(' | ')}` : ''}`
  if (anim && comVideo) {
    const dir = join(tmp, `frames-${code}`)
    rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)
    const FPS = 30, DUR = 8
    for (let f = 0; f < FPS * DUR; f++) {
      await p.evaluate(([fn, k, t]) => { (0, eval)(`(${fn})`)(k, t) }, [animar.toString(), anim, f / FPS])
      await p.screenshot({ path: join(dir, `f${String(f).padStart(4, '0')}.png`) })
    }
    const mp4 = join(OUT, `${code}-anim.mp4`)
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', mp4])
    msg += `  + ${code}-anim.mp4`
  }
  console.log(msg)
}
await bp.close()
