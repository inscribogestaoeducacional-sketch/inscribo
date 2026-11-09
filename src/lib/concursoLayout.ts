// Geometria do cartão-resposta (em mm, página A4). FONTE ÚNICA: a impressão e a leitura usam estas mesmas contas.
export const MARK_CENTERS_MM: [number, number][] = [[12, 12], [198, 12], [12, 285], [198, 285]] // quadrados 8mm a 8mm das bordas
export const QR_BOX_MM = { x: 158, y: 14, w: 36, h: 36 }
export const BUBBLE_D = 5.2       // diâmetro do círculo
export const BUBBLE_STEP = 6.8    // distância entre os centros das alternativas

export function cardGrid(n: number) {
  const blocks = n > 25 ? 4 : Math.max(1, Math.ceil(n / 25))
  const rows = Math.min(30, Math.ceil(n / blocks))
  const pitch = Math.min(8, 180 / Math.max(rows, 1))
  return { blocks, rows, pitch, blockW: 170 / blocks }
}
export const rowLeft = (n: number, i: number) => { const g = cardGrid(n); return 20 + Math.floor(i / g.rows) * g.blockW }
export const rowTop = (n: number, i: number) => { const g = cardGrid(n); return 72 + (i % g.rows) * g.pitch }
// centro (mm) da alternativa k da questão i: número (7mm) + margem (1mm) + espaço (1,6mm) + metade do círculo
export const bubbleCenter = (n: number, i: number, k: number): [number, number] => [rowLeft(n, i) + 7 + 1 + 1.6 + BUBBLE_D / 2 + k * BUBBLE_STEP, rowTop(n, i) + 3]
