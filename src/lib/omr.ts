// Leitura do cartão-resposta: acha os 4 quadrados dos cantos, corrige a perspectiva, lê o QR e mede o preenchimento dos círculos.
import jsQR from 'jsqr'
import { BUBBLE_D, MARK_CENTERS_MM, QR_BOX_MM, bubbleCenter } from './concursoLayout'

export type Flag = { q: number; kind: 'double' | 'faint' }
export type ReadResult = {
  ok: boolean; error?: string
  qr: { contestId: string; number: number; version: string } | null
  answers: (string | null)[]; flags: Flag[]; fills: number[][]
  rectified?: { data: Uint8ClampedArray; w: number; h: number; pxPerMm: number }
}

const PPM = 8 // pixels por mm na imagem corrigida
const LETTERS = 'ABCDE'

function toGray(img: ImageData): Uint8Array {
  const g = new Uint8Array(img.width * img.height); const d = img.data
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 299 + d[j + 1] * 587 + d[j + 2] * 114) / 1000
  return g
}
function otsu(g: Uint8Array | Uint8ClampedArray, step = 1): number {
  const h = new Array(256).fill(0); let n = 0
  for (let i = 0; i < g.length; i += step) { h[g[i]]++; n++ }
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * h[t]
  let sB = 0, wB = 0, best = 0, thr = 128
  for (let t = 0; t < 256; t++) {
    wB += h[t]; if (!wB) continue
    const wF = n - wB; if (!wF) break
    sB += t * h[t]
    const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF)
    if (v > best) { best = v; thr = t }
  }
  return thr
}

// maior bloco escuro quase quadrado dentro da janela
function findMark(gray: Uint8Array, W: number, H: number, thr: number, cx: number, cy: number, rad: number, pxmm: number): [number, number] | null {
  const x0 = Math.max(0, Math.round(cx - rad)), x1 = Math.min(W - 1, Math.round(cx + rad))
  const y0 = Math.max(0, Math.round(cy - rad)), y1 = Math.min(H - 1, Math.round(cy + rad))
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const lab = new Int32Array(w * h).fill(0); let next = 1
  let best: { d: number; minx: number; maxx: number; miny: number; maxy: number } | null = null
  const stack: number[] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const idx = y * w + x
    if (lab[idx] || gray[(y0 + y) * W + x0 + x] > thr) continue
    let n = 0, sx = 0, sy = 0, minx = x, maxx = x, miny = y, maxy = y
    stack.push(idx); lab[idx] = next
    while (stack.length) {
      const k = stack.pop()!; const kx = k % w, ky = (k / w) | 0
      n++; sx += kx; sy += ky
      if (kx < minx) minx = kx; if (kx > maxx) maxx = kx; if (ky < miny) miny = ky; if (ky > maxy) maxy = ky
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = kx + dx, ny = ky + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (!lab[ni] && gray[(y0 + ny) * W + x0 + nx] <= thr) { lab[ni] = next; stack.push(ni) }
      }
    }
    next++
    const bw = maxx - minx + 1, bh = maxy - miny + 1
    const sizeMm = Math.max(bw, bh) / pxmm
    const fill = n / (bw * bh)
    if (sizeMm >= 5 && sizeMm <= 11 && Math.abs(bw - bh) / Math.max(bw, bh) < 0.25 && fill > 0.8) {
      const d = Math.hypot(x0 + (minx + maxx) / 2 - cx, y0 + (miny + maxy) / 2 - cy)
      if (n > (5 * pxmm) ** 2 * 0.8 && (!best || d < best.d)) best = { d, minx, maxx, miny, maxy }
    }
  }
  return best ? [x0 + (best.minx + best.maxx) / 2, y0 + (best.miny + best.maxy) / 2] : null
}

// transformação projetiva mm -> px a partir de 4 pontos
function homography(src: [number, number][], dst: [number, number][]): number[] | null {
  const A: number[][] = []
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i]
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]); A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v])
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r
    if (Math.abs(A[p][c]) < 1e-9) return null
    ;[A[c], A[p]] = [A[p], A[c]]
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k] }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1]
}
const apply = (h: number[], x: number, y: number): [number, number] => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d] }

function rotate180(img: ImageData): ImageData { const o = new ImageData(img.width, img.height); const n = img.width * img.height; for (let i = 0; i < n; i++) { const j = n - 1 - i; o.data.set(img.data.subarray(i * 4, i * 4 + 4), j * 4) } return o }

function locate(img: ImageData, gray: Uint8Array) {
  const W = img.width, H = img.height, pxmm = W / 210
  const thr = otsu(gray, 3)
  const found = MARK_CENTERS_MM.map(([x, y]) => findMark(gray, W, H, thr, x * pxmm, y * (H / 297), 16 * pxmm, pxmm))
  if (found.some(f => !f)) return null
  const hm = homography(MARK_CENTERS_MM, found as [number, number][])
  return hm
}

export function readCard(source: ImageData, n: number, altCount: number): ReadResult {
  // folha de ponta-cabeça: os quadrados dos cantos são simétricos, então só o QR denuncia. Tenta normal e girada.
  const a = readOnce(source, n, altCount)
  if (a.ok && a.qr) return a
  const b = readOnce(rotate180(source), n, altCount)
  if (b.ok && b.qr) return b
  return a.ok ? a : b.ok ? b : a
}

function readOnce(img: ImageData, n: number, altCount: number): ReadResult {
  const gray = toGray(img); const hm = locate(img, gray)
  if (!hm) return { ok: false, error: 'Não encontrei os quadrados pretos dos cantos (folha cortada, escura ou muito torta).', qr: null, answers: [], flags: [], fills: [] }
  return readWithHm(img, gray, hm, n, altCount)
}

function readWithHm(img: ImageData, gray: Uint8Array, hm: number[], n: number, altCount: number): ReadResult {

  // imagem corrigida (px = mm * PPM)
  const RW = Math.round(210 * PPM), RH = Math.round(297 * PPM)
  const rect = new Uint8ClampedArray(RW * RH); const W = img.width, H = img.height
  for (let y = 0; y < RH; y++) for (let x = 0; x < RW; x++) {
    const [sx, sy] = apply(hm, x / PPM, y / PPM)
    const ix = Math.floor(sx), iy = Math.floor(sy)
    if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) { rect[y * RW + x] = 255; continue }
    const fx = sx - ix, fy = sy - iy, i0 = iy * W + ix
    rect[y * RW + x] = gray[i0] * (1 - fx) * (1 - fy) + gray[i0 + 1] * fx * (1 - fy) + gray[i0 + W] * (1 - fx) * fy + gray[i0 + W + 1] * fx * fy
  }

  // QR (recorte com margem branca em volta; se falhar, tenta com mais margem e com limiar próprio)
  let code: ReturnType<typeof jsQR> = null
  for (const pad of [4, 8, 2]) {
    const qx = Math.max(0, Math.round((QR_BOX_MM.x - pad) * PPM)), qy = Math.max(0, Math.round((QR_BOX_MM.y - pad) * PPM))
    const qw = Math.min(RW - qx, Math.round((QR_BOX_MM.w + pad * 2) * PPM)), qh = Math.min(RH - qy, Math.round((QR_BOX_MM.h + pad * 2) * PPM))
    const qd = new Uint8ClampedArray(qw * qh * 4)
    for (let y = 0; y < qh; y++) for (let x = 0; x < qw; x++) { const v = rect[(qy + y) * RW + qx + x]; const j = (y * qw + x) * 4; qd[j] = qd[j + 1] = qd[j + 2] = v; qd[j + 3] = 255 }
    code = jsQR(qd, qw, qh, { inversionAttempts: 'attemptBoth' })
    if (code?.data) break
    // binariza com Otsu local e tenta de novo
    const g = new Uint8ClampedArray(qw * qh); for (let i = 0; i < g.length; i++) g[i] = qd[i * 4]
    const tq = otsu(g, 1)
    for (let i = 0; i < g.length; i++) { const v = g[i] < tq ? 0 : 255; qd[i * 4] = qd[i * 4 + 1] = qd[i * 4 + 2] = v }
    code = jsQR(qd, qw, qh, { inversionAttempts: 'attemptBoth' })
    if (code?.data) break
  }
  let qr: ReadResult['qr'] = null
  if (code?.data) { const m = /^aion-cr\|([^|]+)\|(\d+)\|([A-Z])$/.exec(code.data); if (m) qr = { contestId: m[1], number: Number(m[2]), version: m[3] } }

  // círculos
  const t = otsu(rect, 7)
  const r = (BUBBLE_D / 2 - 0.5) * PPM, r2 = r * r
  const fills: number[][] = []
  for (let i = 0; i < n; i++) {
    const row: number[] = []
    for (let k = 0; k < altCount; k++) {
      const [cx, cy] = bubbleCenter(n, i, k); const px = cx * PPM, py = cy * PPM
      let dark = 0, tot = 0
      for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        const dx = x - px, dy = y - py; if (dx * dx + dy * dy > r2) continue
        tot++; if (rect[y * RW + x] < t) dark++
      }
      row.push(tot ? dark / tot : 0)
    }
    fills.push(row)
  }
  // linha de base: preenchimento típico de um círculo vazio (a letra impressa dentro conta um pouco)
  const all = fills.flat().sort((a, b) => a - b); const base = all[Math.floor(all.length * 0.4)] ?? 0
  const norm = fills.map(row => row.map(f => Math.max(0, (f - base) / Math.max(0.2, 1 - base))))
  const answers: (string | null)[] = []; const flags: Flag[] = []
  norm.forEach((row, i) => {
    const strong = row.map((f, k) => (f >= 0.5 ? k : -1)).filter(k => k >= 0)
    const weak = row.map((f, k) => (f >= 0.2 && f < 0.5 ? k : -1)).filter(k => k >= 0)
    if (strong.length === 1) { answers.push(LETTERS[strong[0]]); if (weak.length) flags.push({ q: i, kind: 'faint' }) }
    else if (strong.length > 1) { answers.push(null); flags.push({ q: i, kind: 'double' }) }
    else if (weak.length) { answers.push(LETTERS[row.indexOf(Math.max(...row))]); flags.push({ q: i, kind: 'faint' }) }
    else answers.push(null)
  })
  return { ok: true, qr, answers, flags, fills: norm, rectified: { data: rect, w: RW, h: RH, pxPerMm: PPM } }
}

export function gradeAnswers(answers: (string | null)[], key: string[], subjectOf: string[]) {
  let score = 0; const by: Record<string, { hits: number; total: number }> = {}
  key.forEach((k, i) => {
    const s = subjectOf[i] ?? '-'; by[s] = by[s] || { hits: 0, total: 0 }; by[s].total++
    if (answers[i] && answers[i] === k) { score++; by[s].hits++ }
  })
  return { score, total: key.length, by }
}


// ---------------------------------------------------------------------------------------------
// Leitura por câmera/foto: a folha pode estar em qualquer lugar do quadro, girada e em perspectiva.
// Acha os 4 quadrados pretos em qualquer posição, e usa o QR code para saber a orientação da folha.
// (A leitura de PDF escaneado continua usando readCard, sem nenhuma mudança.)

type Blob = { cx: number; cy: number; w: number; h: number; area: number }

function findBlobs(gray: Uint8Array, W: number, H: number): Blob[] {
  // limiar local (média de uma janela) para aguentar luz irregular
  const R = Math.max(12, Math.round(Math.min(W, H) / 16))
  const integ = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += gray[y * W + x]; integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row } }
  const dark = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1)
    for (let x = 0; x < W; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1)
      const sum = integ[y1 * (W + 1) + x1] - integ[y0 * (W + 1) + x1] - integ[y1 * (W + 1) + x0] + integ[y0 * (W + 1) + x0]
      const mean = sum / ((x1 - x0) * (y1 - y0))
      const g = gray[y * W + x]
      if (g < mean * 0.62 && g < 115) dark[y * W + x] = 1
    }
  }
  const out: Blob[] = []; const seen = new Uint8Array(W * H); const stack: number[] = []
  const maxSide = Math.max(W, H)
  for (let i = 0; i < W * H; i++) {
    if (!dark[i] || seen[i]) continue
    let n = 0, minx = W, maxx = 0, miny = H, maxy = 0
    stack.push(i); seen[i] = 1
    while (stack.length) {
      const k = stack.pop()!; const kx = k % W, ky = (k / W) | 0
      n++; if (kx < minx) minx = kx; if (kx > maxx) maxx = kx; if (ky < miny) miny = ky; if (ky > maxy) maxy = ky
      if (kx > 0 && dark[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; stack.push(k - 1) }
      if (kx < W - 1 && dark[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; stack.push(k + 1) }
      if (ky > 0 && dark[k - W] && !seen[k - W]) { seen[k - W] = 1; stack.push(k - W) }
      if (ky < H - 1 && dark[k + W] && !seen[k + W]) { seen[k + W] = 1; stack.push(k + W) }
    }
    const bw = maxx - minx + 1, bh = maxy - miny + 1
    if (Math.max(bw, bh) < 7 || Math.max(bw, bh) > maxSide * 0.12) continue
    if (Math.abs(bw - bh) / Math.max(bw, bh) > 0.4) continue
    if (n / (bw * bh) < 0.62) continue
    out.push({ cx: (minx + maxx) / 2, cy: (miny + maxy) / 2, w: bw, h: bh, area: n })
  }
  return out.sort((a, b) => b.area - a.area).slice(0, 14)
}

// 4 quadrados que formam o retângulo da folha (maior quadrilátero plausível), em ordem horária
function pickSheetCorners(blobs: Blob[]): [number, number][] | null {
  let best: { area: number; pts: [number, number][] } | null = null
  const n = blobs.length
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const q = [blobs[a], blobs[b], blobs[c], blobs[d]]
    const areas = q.map(z => z.area); if (Math.max(...areas) / Math.min(...areas) > 3.2) continue
    const mx = (q[0].cx + q[1].cx + q[2].cx + q[3].cx) / 4, my = (q[0].cy + q[1].cy + q[2].cy + q[3].cy) / 4
    const pts = q.map(z => [z.cx, z.cy] as [number, number]).sort((p1, p2) => Math.atan2(p1[1] - my, p1[0] - mx) - Math.atan2(p2[1] - my, p2[0] - mx))
    // convexo e com lados coerentes com uma folha A4 (proporção dos quadrados: 186 x 273 mm)
    let ok = true; let area2 = 0
    for (let i = 0; i < 4; i++) {
      const p = pts[i], q1 = pts[(i + 1) % 4], r = pts[(i + 2) % 4]
      const cross = (q1[0] - p[0]) * (r[1] - q1[1]) - (q1[1] - p[1]) * (r[0] - q1[0])
      if (cross <= 0) { ok = false; break }
      area2 += p[0] * q1[1] - q1[0] * p[1]
    }
    if (!ok) continue
    const side = (i: number) => Math.hypot(pts[(i + 1) % 4][0] - pts[i][0], pts[(i + 1) % 4][1] - pts[i][1])
    const s0 = (side(0) + side(2)) / 2, s1 = (side(1) + side(3)) / 2
    const ratio = Math.min(s0, s1) / Math.max(s0, s1)
    if (ratio < 0.5 || ratio > 0.9) continue
    if (Math.max(side(0), side(2)) / Math.min(side(0), side(2)) > 1.6 || Math.max(side(1), side(3)) / Math.min(side(1), side(3)) > 1.6) continue
    const area = Math.abs(area2) / 2
    if (!best || area > best.area) best = { area, pts }
  }
  return best ? best.pts : null
}

const PAGE_CORNERS_CW: [number, number][] = [MARK_CENTERS_MM[0], MARK_CENTERS_MM[1], MARK_CENTERS_MM[3], MARK_CENTERS_MM[2]]

/** Procura a folha em um quadro de câmera (ou foto) onde ela não ocupa a imagem toda. */
export function findSheet(img: ImageData): { corners: [number, number][] } | null {
  const full = toGray(img)
  const s = Math.max(1, Math.ceil(Math.max(img.width, img.height) / 900))
  const W = Math.floor(img.width / s), H = Math.floor(img.height / s)
  const small = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) small[y * W + x] = full[y * s * img.width + x * s]
  const pts = pickSheetCorners(findBlobs(small, W, H))
  if (!pts) return null
  return { corners: pts.map(([x, y]) => [x * s + s / 2, y * s + s / 2] as [number, number]) }
}

/** Lê o cartão/folha numa foto qualquer. O QR code decide em qual das 4 rotações a folha está. */
export function readCardFree(source: ImageData, n: number, altCount: number): ReadResult {
  const found = findSheet(source)
  if (!found) return { ok: false, error: 'Não achei a folha: mostre a página inteira, com os 4 quadrados pretos dos cantos.', qr: null, answers: [], flags: [], fills: [] }
  const gray = toGray(source)
  let fallback: ReadResult | null = null
  for (let r = 0; r < 4; r++) {
    const dst = [0, 1, 2, 3].map(i => found.corners[(i + r) % 4])
    const hm = homography(PAGE_CORNERS_CW, dst); if (!hm) continue
    const res = readWithHm(source, gray, hm, n, altCount)
    if (res.ok && res.qr) return res
    fallback = fallback ?? res
  }
  return fallback ? { ...fallback, qr: null, error: 'Folha achada, mas o QR code não foi lido (aproxime ou melhore a luz).' } : { ok: false, error: 'Folha achada, mas não consegui ler.', qr: null, answers: [], flags: [], fills: [] }
}
