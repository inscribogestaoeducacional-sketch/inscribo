// Abre um PDF (ou imagem) escaneado e entrega cada página como ImageData (A4 em ~200 dpi), sem enviar nada para fora do navegador.
import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const TARGET_W = 1654 // A4 a 200 dpi

export async function countPages(file: File): Promise<number> {
  if (file.type.startsWith('image/')) return 1
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  return pdf.numPages
}

export async function* pdfPages(file: File): AsyncGenerator<{ page: number; image: ImageData }> {
  if (file.type.startsWith('image/')) {
    const bmp = await createImageBitmap(file)
    const c = document.createElement('canvas'); const s = TARGET_W / bmp.width
    c.width = TARGET_W; c.height = Math.round(bmp.height * s)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    yield { page: 1, image: ctx.getImageData(0, 0, c.width, c.height) }
    return
  }
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const base = page.getViewport({ scale: 1 }); const vp = page.getViewport({ scale: TARGET_W / base.width })
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height)
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    yield { page: p, image: ctx.getImageData(0, 0, c.width, c.height) }
    page.cleanup()
  }
}
