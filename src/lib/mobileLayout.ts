// Celular sem tabelas largas e sem faixas que deslizam para o lado (pedido do
// Victor, 22/10/2026). Vale para o sistema inteiro, Super Admin e cliente:
//  - cada célula de tabela ganha o nome da coluna (data-label), e o CSS em
//    index.css mostra cada linha como um cartão (primeira coluna = título);
//  - faixas de botões/abas mais largas que a tela passam a quebrar linha.
// Exceções: tabela com a classe "keep-table" e faixa com "aion-hscroll"
// (blocos do Início que deslizam de propósito).
const BP = 768

function labelTables(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>('table:not(.keep-table)').forEach(t => {
    const heads = Array.from(t.querySelectorAll('thead tr:last-child th, thead tr:last-child td')).map(h => (h.textContent || '').trim())
    if (!heads.length) return
    t.classList.add('aion-rt')
    t.querySelectorAll<HTMLTableRowElement>('tbody tr, tfoot tr').forEach(tr => {
      let col = 0
      Array.from(tr.cells).forEach(td => {
        const span = td.colSpan || 1
        if (span > 1) td.setAttribute('data-wide', '1')
        const label = span > 1 ? '' : heads[col] || ''
        if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label)
        col += span
      })
    })
  })
}

function wrapStrips(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[style*="overflow-x: auto"], [style*="overflow-x: scroll"], .overflow-x-auto, .overflow-x-scroll').forEach(el => {
    if (el.dataset.stripChecked === '1' || el.classList.contains('aion-hscroll') || el.closest('.aion-hscroll') || el.querySelector(':scope > table, :scope > div > table')) return
    const kids = Array.from(el.children) as HTMLElement[]
    if (kids.length < 2) return
    el.dataset.stripChecked = '1'
    const cs = getComputedStyle(el)
    if (cs.display !== 'flex' || cs.flexDirection.startsWith('column')) return
    const clickable = kids.filter(k => k.tagName === 'BUTTON' || k.tagName === 'A' || k.getAttribute('role') === 'tab').length
    if (clickable / kids.length < 0.6) return
    el.classList.add('aion-wrap')
  })
}

let raf = 0
function run() {
  raf = 0
  if (window.innerWidth >= BP) return
  labelTables(document)
  wrapStrips(document)
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(run) }

export function installMobileLayout() {
  if (typeof window === 'undefined' || (window as any).__aionMobileLayout) return
  ;(window as any).__aionMobileLayout = true
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  schedule()
}
