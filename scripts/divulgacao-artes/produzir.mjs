// Produz as peças A04–A48 e os Reels R01–R32 do calendário v2.
//   node scripts/divulgacao-artes/produzir.mjs A04 A05 R01 ...   (códigos)
//   ... --sem-video   só PNG          ... --conferir   salva quadros início/meio/fim
// Textos: lidos de docs/marketing/calendario-divulgacao-v2.md (calendario.mjs).
// Telas e enquadramento: Pecas.tsx. A01–A03 (aprovadas) seguem em render.mjs.
// Saída: docs/marketing/artes/ (PNG + Axx-anim.mp4) e docs/marketing/reels/ (Rxx.mp4).
// Precisa de ffmpeg com libx264 em FFMPEG (o do Playwright só tem VP8) e do
// pacote playwright (não está no package.json do projeto). Sem depender do
// PATH, instalando numa pasta de ferramentas fora do git:
//   npm install --prefix node_modules/.cache/ffmpeg-tool ffmpeg-static@5 playwright@1.63.0
//   (playwright 1.63.0 = chromium 1243; troque a versão se o navegador instalado for outro)
//   FFMPEG="$PWD/node_modules/.cache/ffmpeg-tool/node_modules/ffmpeg-static/ffmpeg.exe" \
//   NODE_PATH="$PWD/node_modules/.cache/ffmpeg-tool/node_modules" \
//   node scripts/divulgacao-artes/produzir.mjs A31 R19
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { lerCalendario } from './calendario.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../..')
const OUT_A = join(ROOT, 'docs/marketing/artes')
const OUT_R = join(ROOT, 'docs/marketing/reels')
const CONF = process.env.CONFERIR_DIR || join(ROOT, 'node_modules/.cache/divulgacao-artes/conferir')
const require = createRequire(join(ROOT, 'package.json'))
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const { chromium } = require('playwright')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'

const tmp = join(ROOT, 'node_modules/.cache/divulgacao-artes')
for (const d of [tmp, OUT_A, OUT_R, CONF]) mkdirSync(d, { recursive: true })
const url = p => pathToFileURL(p).href
const pub = url(join(ROOT, 'public'))
const page = (body, css = '') => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #1A2B4A; }
${css}</style></head><body>${body}</body></html>`

const args = process.argv.slice(2)
const codes = args.filter(a => /^[AR]\d\d$/.test(a))
const comVideo = !args.includes('--sem-video')
const conferir = args.includes('--conferir')

// ── Imagens fictícias servidas por http (logo e fotos da Vitrine) ───────────
const svgFoto = n => {
  const cores = [['#0F766E', '#5EEAD4'], ['#1D4ED8', '#93C5FD'], ['#B45309', '#FCD34D'], ['#7C3AED', '#C4B5FD']][n % 4]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${cores[0]}"/><stop offset="1" stop-color="${cores[1]}"/></linearGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="430" cy="170" r="70" fill="#fff" opacity=".35"/><path d="M0 470 L170 300 L320 430 L420 340 L600 500 L600 600 L0 600Z" fill="#fff" opacity=".28"/></svg>`
}
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#0F766E"/><circle cx="100" cy="100" r="78" fill="none" stroke="#fff" stroke-width="6"/><text x="100" y="124" text-anchor="middle" font-family="Georgia,serif" font-size="72" font-weight="700" fill="#fff">CH</text></svg>`
const banner = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 300"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B91C1C"/><stop offset="1" stop-color="#F97316"/></linearGradient></defs><rect width="900" height="300" fill="url(#b)"/><text x="450" y="140" text-anchor="middle" font-family="Arial,sans-serif" font-size="76" font-weight="800" fill="#fff">ÚLTIMAS VAGAS 2027</text><text x="450" y="210" text-anchor="middle" font-family="Arial,sans-serif" font-size="36" fill="#fff">Infantil ao Ensino Médio · fale com a secretaria</text></svg>`
const srv = createServer((req, res) => {
  const m = req.url.match(/foto(\d)/)
  res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); res.end(req.url.includes('banner') ? banner : m ? svgFoto(Number(m[1])) : logo)
})
await new Promise(r => srv.listen(0, '127.0.0.1', r))
process.env.DEMO_ASSETS = `http://127.0.0.1:${srv.address().port}`

// ── Funções que rodam no navegador ──────────────────────────────────────────
const BROWSER = String.raw`
window.__ease = x => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
window.__byFocus = (d, f, up) => {
  let el = null;
  if (f && f[0] === '@') el = d.querySelector(f.slice(1));
  else if (f) el = [...d.body.querySelectorAll('*')].filter(e => e.textContent.trim() === f).sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length)[0];
  for (let i = 0; el && i < (up || 0); i++) el = el.parentElement;
  return el;
};
// Ajusta largura/altura do iframe ao conteúdo (#shot)
window.__fitFrame = (fr, native) => {
  const d = fr.contentDocument, shot = d.querySelector('#shot') || d.body;
  const w = Math.ceil(shot.getBoundingClientRect().width) || native;
  const n = d.querySelector('#shot') ? Math.min(native, w) : native;
  fr.style.width = n + 'px';
  const h = Math.ceil((d.querySelector('#shot') || d.documentElement).getBoundingClientRect().height || d.documentElement.scrollHeight);
  fr.style.height = h + 'px';
  return { d, n, h };
};
window.__layout = () => {
  for (const f of document.querySelectorAll('[data-fit]')) {
    const fr = f.querySelector('iframe'); const { n, h } = __fitFrame(fr, Number(f.dataset.fit));
    const s = f.clientWidth / n; fr.dataset.s = s;
    fr.style.transform = 'scale(' + s + ')';
    const maxh = Number(f.dataset.maxh || 0);
    f.style.height = (maxh ? Math.min(h * s, maxh) : h * s) + 'px';
  }
  for (const r of document.querySelectorAll('[data-recorte]')) {
    const fr = r.querySelector('iframe'); const { d } = __fitFrame(fr, 4000);
    const el = __byFocus(d, r.dataset.focus, Number(r.dataset.up));
    if (!el) throw new Error('recorte: não achei ' + r.dataset.focus);
    const er = el.getBoundingClientRect(), z = Number(r.dataset.zoom);
    fr.style.transform = 'translate(' + (r.clientWidth * 0.42 - (er.left + er.width / 2) * z) + 'px,' + (r.clientHeight * 0.34 - (er.top + er.height / 2) * z) + 'px) scale(' + z + ')';
  }
  for (const st of document.querySelectorAll('[data-stage]')) {
    const fr = st.querySelector('iframe'); const { d, n, h } = __fitFrame(fr, Number(st.dataset.native));
    const W = st.clientWidth, H = st.clientHeight, s0 = W / n;
    const start = { z: s0, x: 0, y: h * s0 < H ? (H - h * s0) / 2 : 0 };
    const reel = !!st.closest('.reel');
    // Reel: a tela preenche a altura do quadro vertical (até 1,9× o encaixe na largura)
    const base = reel ? Math.min(Math.max(s0, H / h), s0 * 1.9) : s0;
    let z = base * Number(st.dataset.zoom || 1), x = 0, y = 0;
    const el = __byFocus(d, st.dataset.focusCam, Number(st.dataset.up));
    if (st.dataset.focusCam && !el) throw new Error('câmera: não achei ' + st.dataset.focusCam);
    if (el) {
      const er = el.getBoundingClientRect();
      // Reel: o elemento em foco nunca fica cortado na largura do quadro
      if (reel && er.width * z > W * 0.96) z = Math.max(W * 0.96 / er.width, s0);
      x = W / 2 - (er.left + er.width / 2) * z; y = H * 0.42 - (er.top + er.height / 2) * z;
    } else { x = reel ? 0 : (W - n * z) / 2; y = 0 }
    x = n * z > W ? Math.min(0, Math.max(W - n * z, x)) : (W - n * z) / 2;
    y = h * z > H ? Math.min(0, Math.max(H - h * z, y)) : (H - h * z) / 2 * (el || reel ? 1 : 0);
    st.__cam = { start, end: { z, x, y } };
    fr.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')';
  }
  return [...document.querySelectorAll('h1,h2,p,.btn-g')]
    .filter(el => { const r = el.getBoundingClientRect(); return r.bottom > document.querySelector('.slide').clientHeight - 20 || r.right > 1080 - 20 })
    .map(el => el.textContent.slice(0, 50));
};
window.__cam = (st, k) => {
  const c = st.__cam; if (!c) return; const e = __ease(k);
  const z = c.start.z + (c.end.z - c.start.z) * e, x = c.start.x + (c.end.x - c.start.x) * e, y = c.start.y + (c.end.y - c.start.y) * e;
  st.querySelector('iframe').style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')';
};
// Animação genérica de uma tela (documento do iframe)
window.__initDoc = (d, extra) => {
  if (d.__ok) return; d.__ok = true; extra = extra || {};
  for (const a of extra.alvos || []) { const el = a.sel ? d.querySelector(a.sel) : __byFocus(d, a.txt, a.up || 0); if (el) el.setAttribute('data-focus', a.t) }
  const num = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(,\d+)?(\D*)$/;
  const counts = [...d.querySelectorAll('[data-count]')];
  if (extra.autocount) counts.push(...[...d.body.querySelectorAll('*')].filter(e => !e.children.length && /^\d[\d.]*(,\d+)?%?$/.test(e.textContent.trim())));
  d.__nums = counts.map(e => { const m = e.textContent.trim().match(num); if (!m) return null; const inEl = e.closest('[data-in]');
    return { e, pre: m[1], v: Number((m[2] + (m[3] || '')).replace(/\./g, '').replace(',', '.')), dec: m[3] ? m[3].length - 1 : 0, suf: m[4], start: inEl ? Number(inEl.dataset.in) + 0.2 : 0, grp: m[2].includes('.') } }).filter(Boolean);
  d.__types = [...d.querySelectorAll('[data-type]')].map(e => ({ e, full: e.textContent, t: e.dataset.type.split(',').map(Number) }));
  d.__rings = [...d.querySelectorAll('[data-focus]')].map(e => {
    const ring = d.createElement('div');
    Object.assign(ring.style, { position: 'absolute', border: '4px solid #0DD3BF', borderRadius: '14px', boxShadow: '0 0 0 8px rgba(13,211,191,.25), 0 0 28px rgba(13,211,191,.55)', pointerEvents: 'none', zIndex: 9999, opacity: 0 });
    d.body.appendChild(ring); return { e, ring, v: Number(e.dataset.focus) };
  });
  d.__extra = extra;
};
window.__animDoc = (d, t, modo, fr) => {
  const ease = __ease;
  const te = modo === 'loop' ? (t < 7 ? t : 7 * (8 - t)) : t;
  const vis = e => { const i = e.closest('[data-in]'), o = e.closest('[data-out]');
    return (!i || te >= Number(i.dataset.in) + 0.25) && (!o || te < Number(o.dataset.out)) };
  for (const n of d.__nums) { const p = ease((te - n.start) / 2.0); const val = n.v * p;
    n.e.textContent = n.pre + val.toLocaleString('pt-BR', { minimumFractionDigits: n.dec, maximumFractionDigits: n.dec, useGrouping: n.grp || n.v >= 10000 }) + n.suf }
  for (const g of d.querySelectorAll('[data-grow]')) { const i = g.closest('[data-in]'); const p = ease((te - (i ? Number(i.dataset.in) + 0.2 : 0)) / 2.0);
    g.style.transformOrigin = 'left center'; g.style.transform = 'scaleX(' + Math.max(0.001, p) + ')' }
  for (const ty of d.__types) { const k = Math.max(0, Math.min(1, (te - ty.t[0]) / Math.max(0.01, ty.t[1] - ty.t[0]))); ty.e.textContent = ty.full.slice(0, Math.round(ty.full.length * k)) }
  for (const e of d.querySelectorAll('[data-in],[data-out],[data-move],[data-press]')) {
    let op = 1, tr = '';
    if (e.dataset.in != null) { const v = Number(e.dataset.in); const a = v >= 90 ? 0 : ease((te - v) / 0.4); op *= a; tr += 'translateY(' + ((1 - a) * 14) + 'px) ' }
    if (e.dataset.out != null) { op *= 1 - ease((te - Number(e.dataset.out)) / 0.3) }
    if (e.dataset.move) { const [dx, dy, t0, t1] = e.dataset.move.split(',').map(Number); const k = ease((te - t0) / (t1 - t0)); tr += 'translate(' + dx * (1 - k) + 'px,' + dy * (1 - k) + 'px) '; e.style.zIndex = 10;
      e.style.boxShadow = k > 0 && k < 1 ? '0 18px 40px rgba(0,0,0,.25)' : '' }
    if (e.dataset.press) { const k = te - Number(e.dataset.press); if (k >= 0 && k < 0.35) tr += 'scale(' + (1 - 0.1 * Math.sin(Math.PI * k / 0.35)) + ') ' }
    e.style.opacity = op; e.style.transform = tr;
    if (e.hasAttribute('data-collapse')) e.style.display = op < 0.02 ? 'none' : '';
  }
  const until = modo === 'loop' ? 6.9 : 99;
  for (const r of d.__rings) {
    const on = te >= r.v && te < until && vis(r.e);
    if (!on) { r.ring.style.opacity = 0; continue }
    const b = r.e.getBoundingClientRect(), pad = 7, sx = d.defaultView.scrollX, sy = d.defaultView.scrollY;
    Object.assign(r.ring.style, { left: (b.left - pad + sx) + 'px', top: (b.top - pad + sy) + 'px', width: (b.width + pad * 2) + 'px', height: (b.height + pad * 2) + 'px', opacity: 0.55 + 0.45 * Math.sin((te - r.v) * Math.PI * 2 / 1.2) });
  }
  const sc = d.__extra && d.__extra.scroll;
  if (sc && fr) { const k = ease((te - sc.t0) / (sc.t1 - sc.t0)); const s = Number(fr.dataset.s || 1);
    fr.style.transform = 'translate(0,' + (-sc.y * k * s) + 'px) scale(' + s + ')' }
};
window.__artFrame = (t, extra) => {
  const fr = document.querySelector('[data-anim-root] iframe'); const d = fr.contentDocument;
  extra = extra || JSON.parse(document.querySelector('[data-extra]')?.dataset.extra || '{}');
  __initDoc(d, extra); __animDoc(d, t, 'loop', fr);
};
window.__reelFrame = T => {
  const b = [0, 3, 9, 15, 21, 27, 30];
  const layers = [...document.querySelectorAll('[data-layer]')];
  layers.forEach((L, i) => {
    const s = b[i], e = b[i + 1], f = 0.35;
    let op = T >= s && T < e ? 1 : 0;
    if (i > 0 && T >= s && T < s + f) op = (T - s) / f;
    if (i < 5 && T >= e - 0.01 && T < e + f) op = Math.max(op, 1 - (T - e) / f);
    L.style.opacity = op; L.style.zIndex = T >= s ? i : 0;
    if (i >= 1 && i <= 4 && op > 0) {
      const t = T - s; const st = L.querySelector('[data-stage]'); const fr = L.querySelector('[data-anim-root] iframe');
      if (st) __cam(st, (t - 0.2) / 1.4);
      const extra = JSON.parse(L.querySelector('[data-extra]')?.dataset.extra || '{}');
      if (fr) { __initDoc(fr.contentDocument, extra); __animDoc(fr.contentDocument, t, 'reel', fr) }
    }
  });
};
`

// ── Execução ────────────────────────────────────────────────────────────────
const cal = lerCalendario(join(ROOT, 'docs/marketing/calendario-divulgacao-v2.md'))
const outfile = join(tmp, 'pecas.cjs')
await build({ entryPoints: [join(HERE, 'Pecas.tsx')], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
  external: ['react', 'react-dom', 'lucide-react'], nodePaths: [join(ROOT, 'node_modules')], logLevel: 'warning' })
delete require.cache[outfile]
const P = require(outfile)
const css = P.SHARED_CSS.replace(/url\('\//g, `url('${pub}/`)
const bp = await chromium.launch()
const fix = html => html.replace(/src="\//g, `src="${pub}/`)

async function abrir(Comp, w, h, nome) {
  const pg = await bp.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const file = join(tmp, `${nome}.html`)
  writeFileSync(file, page(fix(renderToStaticMarkup(React.createElement(Comp))), `${css}\nbody { width:${w}px; height:${h}px; overflow:hidden; }`))
  await pg.goto(url(file), { waitUntil: 'load' })
  await pg.evaluate(() => document.fonts.ready)
  await pg.addScriptTag({ content: BROWSER })
  await pg.waitForTimeout(400)
  const over = await pg.evaluate(() => window.__layout())
  return { pg, over }
}
function encode(dir, ext, out) {
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', '30', '-i', join(dir, `f%04d.${ext}`),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '19', '-preset', 'medium', '-movflags', '+faststart', '-an', out])
}
function quadros(video, nome, tempos, w) {
  const out = join(CONF, `${nome}.png`)
  const sel = tempos.map(s => `eq(n\\,${Math.round(s * 30)})`).join('+')
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', video, '-vf', `select='${sel}',scale=${w}:-1,tile=${tempos.length}x1`, '-frames:v', '1', '-fps_mode', 'vfr', out])
  return out
}

for (const code of codes) {
  if (code.startsWith('A')) {
    const make = P.ARTES[code]; const txt = cal.artes[code]
    if (!make) { console.log(`${code} — sem configuração (pulada)`); continue }
    const r = make(txt); const slides = Array.isArray(r) ? r : [r]
    const extra = (P.EXTRAS && P.EXTRAS[code]) || undefined
    for (const [i, S] of slides.entries()) {
      const nome = slides.length > 1 ? `${code}-${i + 1}` : code
      const { pg, over } = await abrir(S, 1080, 1350, nome)
      // Imagem parada no estado final da animação (antes do rebobinar; anéis já apagados)
      if (await pg.evaluate(() => !!document.querySelector('[data-anim-root] iframe'))) await pg.evaluate(ex => window.__artFrame(6.95, ex), extra)
      await pg.locator('.slide').screenshot({ path: join(OUT_A, `${nome}.png`) })
      let msg = `${nome}.png${over.length ? `  ⚠ texto fora: ${over.join(' | ')}` : ''}`
      const temTela = await pg.evaluate(() => !!document.querySelector('[data-anim-root] iframe'))
      if (comVideo && temTela) {
        const dir = join(tmp, `frames-${code}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)
        for (let f = 0; f < 240; f++) {
          await pg.evaluate(([t, ex]) => window.__artFrame(t, ex), [f / 30, extra])
          await pg.screenshot({ path: join(dir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 93 })
        }
        const mp4 = join(OUT_A, `${code}-anim.mp4`); encode(dir, 'jpg', mp4)
        msg += `  + ${code}-anim.mp4`
        if (conferir) quadros(mp4, `${code}-anim`, [0.3, 4, 7.6], 540)
      }
      console.log(msg)
      await pg.close()
    }
  } else {
    const make = P.REELS[code]; const txt = cal.reels[code]
    if (!make) { console.log(`${code} — sem configuração (pulado)`); continue }
    const { pg, over } = await abrir(make(txt), 1080, 1920, code)
    const dir = join(tmp, `frames-${code}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir)
    for (let f = 0; f < 900; f++) {
      await pg.evaluate(T => window.__reelFrame(T), f / 30)
      await pg.screenshot({ path: join(dir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 92 })
    }
    const mp4 = join(OUT_R, `${code}.mp4`); encode(dir, 'jpg', mp4)
    if (conferir) quadros(mp4, code, [1.5, 5, 8.5, 11, 14.5, 17, 20.5, 23, 26.5, 28.5], 270)
    console.log(`${code}.mp4${over.length ? `  ⚠ texto fora: ${over.join(' | ')}` : ''}`)
    await pg.close()
  }
}
await bp.close(); srv.close()
