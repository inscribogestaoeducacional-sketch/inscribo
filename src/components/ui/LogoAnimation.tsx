// Animação da logo do Áion Edu (abertura e carregamentos):
// 1) um ponto surge · 2) vira o quadrado e gira · 3) o A entra · 4) a barra menta corta o A
// 5) ÁION sai de dentro do quadrado, letra por letra, e forma a marca · 6) EDU aparece.
// variant="mark": só o quadrado (para espaços pequenos), repetindo em ciclo.
// Tudo em CSS; "reduzir movimento" mostra a logo pronta.
const W = 63.2 // largura do nome (em % da logo inteira)
const L = 36.8 // onde o nome começa
const T = 1577 // largura do recorte do nome
const piece = (x0: number, x1: number) => ({ left: L + (W * x0) / T, width: (W * (x1 - x0)) / T })
const PIECES = [
  { k: 'a', ...piece(0, 498), d: 1.75 },
  { k: 'i', ...piece(498, 625), d: 1.9 },
  { k: 'o', ...piece(625, 1105), d: 2.05 },
  { k: 'n', ...piece(1105, 1577), d: 2.2 },
]

export default function LogoAnimation({ width = 260, variant = 'full', loop = false }: { width?: number; variant?: 'full' | 'mark'; loop?: boolean }) {
  const mark = variant === 'mark'
  const boxW = mark ? width : width
  const ratio = mark ? 1 : 7641 / 2256
  const sq = mark ? { left: 0, top: 0, width: 100, height: 100 } : { left: 0, top: 0, width: 31, height: 99.2 }
  const it = loop || mark ? 'infinite' : '1'
  const total = mark ? 2.6 : 3.4
  const cls = (n: string) => `aion-la-${n}`
  return (
    <div className="aion-la" role="img" aria-label="Áion Edu" style={{ position: 'relative', width: boxW, aspectRatio: String(ratio), ['--la-total' as any]: `${total}s`, ['--la-it' as any]: it }}>
      {/* quadrado: ponto → quadrado girando */}
      <div className={cls('sq')} style={{ position: 'absolute', zIndex: 3, ...pct(sq), background: 'linear-gradient(180deg, #05987F 0%, #00695F 100%)' }} />
      <img src="/brand/mark-a.png" alt="" className={cls('a')} style={{ position: 'absolute', zIndex: 4, ...pct(sq), objectFit: 'fill' }} />
      <img src="/brand/mark-bar.png" alt="" className={cls('bar')} style={{ position: 'absolute', zIndex: 5, ...pct(sq), objectFit: 'fill' }} />
      {!mark && PIECES.map(p => (
        <img key={p.k} src={`/brand/w-${p.k}.png`} alt="" className={cls('w')}
          style={{ position: 'absolute', zIndex: 2, top: 0, height: '78.2%', left: `${p.left}%`, width: `${p.width}%`, objectFit: 'fill', ['--la-d' as any]: `${p.d}s`, ['--la-shift' as any]: `${-((p.left - 12) / p.width) * 100}%` }} />
      ))}
      {!mark && <img src="/brand/w-edu.png" alt="" className={cls('edu')} style={{ position: 'absolute', zIndex: 2, left: `${L + (W * 1135) / T}%`, top: '79.6%', height: '20.4%', width: `${(W * (T - 1135)) / T}%`, objectFit: 'fill' }} />}
    </div>
  )
}
const pct = (s: { left: number; top: number; width: number; height: number }) => ({ left: `${s.left}%`, top: `${s.top}%`, width: `${s.width}%`, height: `${s.height}%` })
