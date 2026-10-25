// Achar a opção na tela pelo que a pessoa vê (nada de marcar cada botão no código).
// Ordem: [data-tour="nome"] → botão pelo texto → rótulo do campo → texto → css.
// Toda a interface da aula tem data-tour-ui e fica de fora da busca (o balão não pode ser achado como "janela").
import type { TourTarget } from './academy'

const norm = (s: string | null | undefined) => (s || '').replace(/\s+/g, ' ').replace(/[​-‍﻿]/g, '').trim().toLowerCase()
const clean = (s: string) => norm(s).replace(/[*:]+$/g, '').trim()

export const inTourUi = (el: Element | null) => !!el?.closest?.('[data-tour-ui]')

export function isVisible(el: Element): boolean {
  if (!(el instanceof HTMLElement || el instanceof SVGElement)) return false
  if (inTourUi(el)) return false
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return false
  const cs = getComputedStyle(el)
  if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity || '1') === 0) return false
  // escondido por um ancestral com display:none/visibility já é pego pelo tamanho zero; aqui só o "recortado"
  return true
}

/** A janela aberta por cima: .aion-pop, [role=dialog], [aria-modal] ou o último elemento fixo grande da página. */
export function modalRoot(): HTMLElement | null {
  const vw = window.innerWidth, vh = window.innerHeight
  const cands = Array.from(document.querySelectorAll<HTMLElement>('.aion-pop, [role="dialog"], [aria-modal="true"], .m-sheet, [style*="position: fixed"]'))
  let best: { el: HTMLElement; z: number; order: number } | null = null
  cands.forEach((el, order) => {
    if (inTourUi(el) || !isVisible(el)) return
    if (el.closest('nav.aion-dock, header.aion-topbar, aside')) return
    const r = el.getBoundingClientRect()
    const big = r.width >= vw * 0.45 && r.height >= vh * 0.3
    const explicit = el.matches('.aion-pop, [role="dialog"], [aria-modal="true"], .m-sheet')
    if (!big && !explicit) return
    // janelas que cobrem a tela quase toda ou painéis com cara de janela
    const cs = getComputedStyle(el)
    const z = parseInt(cs.zIndex || '0', 10) || 0
    // um elemento fixo que seja filho de outro candidato é parte dele: fica o de fora
    if (!best || z > best.z || (z === best.z && order >= best.order)) best = { el, z, order }
  })
  if (!best) return null
  // se o candidato é o fundo escuro, a janela de verdade é o filho principal; a busca dentro do fundo já cobre
  return (best as { el: HTMLElement }).el
}

function ownText(el: Element): string {
  let t = ''
  el.childNodes.forEach(n => { if (n.nodeType === 3) t += n.textContent })
  return norm(t)
}

const CONTROL = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [contenteditable="true"], [role="combobox"]'

function controlFor(labelEl: Element): HTMLElement | null {
  if (labelEl instanceof HTMLLabelElement && labelEl.control) return labelEl.control as HTMLElement
  const inside = labelEl.querySelector<HTMLElement>(CONTROL)
  if (inside) return inside
  // ao lado: irmão seguinte (ou o que ele contém)
  let sib = labelEl.nextElementSibling
  for (let i = 0; sib && i < 3; i++, sib = sib.nextElementSibling) {
    if (sib.matches(CONTROL)) return sib as HTMLElement
    const c = sib.querySelector<HTMLElement>(CONTROL)
    if (c) return c
    if (sib.matches('button') && i === 0) return sib as HTMLElement
  }
  // o rótulo e o campo são irmãos dentro de um mesmo bloco
  const p = labelEl.parentElement
  if (p) {
    const c = p.querySelector<HTMLElement>(CONTROL)
    if (c) return c
  }
  return null
}

export function findTarget(t: TourTarget | undefined): HTMLElement | null {
  if (!t) return null
  const root: ParentNode = t.in === 'modal' ? (modalRoot() ?? document.body) : document.body
  if (t.in === 'modal' && root === document.body) return null
  const vis = (els: Element[]) => els.filter(isVisible) as HTMLElement[]
  const choose = (els: HTMLElement[]) => els.length ? (t.pick === 'last' ? els[els.length - 1] : els[0]) : null

  if (t.tour) {
    const r = choose(vis(Array.from(root.querySelectorAll(`[data-tour="${t.tour}"]`))))
    if (r) return r
  }
  if (t.button) {
    const want = clean(t.button)
    const all = vis(Array.from(root.querySelectorAll('button, [role="button"], a[href], input[type="button"], input[type="submit"], [role="tab"]')))
    const txt = (el: HTMLElement) => clean((el as HTMLInputElement).value && el.tagName === 'INPUT' ? (el as HTMLInputElement).value : (el.innerText || el.textContent || '') + ' ' + (el.getAttribute('aria-label') || ''))
    const label = (el: HTMLElement) => clean((el.innerText || el.textContent || '') as string)
    const exact = all.filter(el => label(el) === want || clean(el.getAttribute('aria-label') || '') === want || clean(el.getAttribute('title') || '') === want)
    const r = choose(exact) || choose(all.filter(el => txt(el).includes(want)))
    if (r) return r
  }
  if (t.label) {
    const want = clean(t.label)
    const labs = Array.from(root.querySelectorAll('label, span, div, p, legend, h3, h4, b, strong')).filter(el => {
      if (inTourUi(el)) return false
      const o = clean(ownText(el))
      return o === want || (o.startsWith(want) && o.length <= want.length + 4)
    }) as HTMLElement[]
    const hits: HTMLElement[] = []
    for (const l of labs) { const c = controlFor(l); if (c && isVisible(c)) hits.push(c) }
    const r = choose(hits)
    if (r) return r
    // campo sem rótulo ligado: pelo placeholder ou aria-label
    const alt = vis(Array.from(root.querySelectorAll('input, select, textarea'))).filter(el => clean(el.getAttribute('aria-label') || '') === want || clean((el as HTMLInputElement).placeholder || '').startsWith(want))
    const r2 = choose(alt)
    if (r2) return r2
  }
  if (t.text) {
    const want = clean(t.text)
    const els = Array.from(root.querySelectorAll('*')).filter(el => {
      if (inTourUi(el) || !isVisible(el)) return false
      if (['SCRIPT', 'STYLE', 'OPTION', 'OPTGROUP'].includes(el.tagName)) return false
      const o = ownText(el)
      return o.includes(want)
    }) as HTMLElement[]
    const exact = els.filter(el => clean(ownText(el)) === want)
    const r = choose(exact) || choose(els)
    if (r) return r
  }
  if (t.css) {
    for (const sel of t.css.split(/\s*,\s*(?![^[]*\])/)) {
      try { const r = choose(vis(Array.from(root.querySelectorAll(sel)))); if (r) return r } catch { /* seletor inválido */ }
    }
  }
  return null
}

export function isLocked(el: HTMLElement): boolean {
  const b = el.closest('button, input, select, textarea') as (HTMLButtonElement | null)
  return !!(b && (b as HTMLButtonElement).disabled) || el.getAttribute('aria-disabled') === 'true'
}
