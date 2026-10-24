// Celular com cara de app (Fase 5c, 22/10/2026):
//  - "puxar para atualizar": com a tela no topo, puxar para baixo mostra a
//    bolinha da Áion; soltando, a tela atual é montada de novo e busca os
//    dados outra vez (evento aion:refresh, ouvido pelo PageAnim);
//  - vibração curta (Android) ao tocar nos botões principais.
// Fica fora de janelas por cima (modais, menus), das conversas do WhatsApp,
// das páginas públicas e do computador.
const BP = 768
const MAX = 110      // quanto a bolinha desce no máximo
const TRIGGER = 72   // a partir daqui, soltar atualiza
const PUBLIC = /^\/(login|reset-password|privacidade|termos|sobre|parceiros|parceria-meta|blog|novidades|satisfaction|proposta|raio-x|\w+-pesquisa)(\/|$)/

let el: HTMLDivElement | null = null
let ring: HTMLDivElement | null = null

function ensureEl() {
  if (el) return
  el = document.createElement('div')
  el.className = 'aion-ptr'
  el.setAttribute('aria-hidden', 'true')
  el.innerHTML = '<div class="aion-ptr-ball"><div class="aion-ptr-ring"></div><img src="/aion-logo-icon.png" alt="" /></div>'
  document.body.appendChild(el)
  ring = el.querySelector('.aion-ptr-ring')
}

function scrollParent(node: Element | null): HTMLElement | null {
  for (let n = node as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight + 2) return n
  }
  return document.scrollingElement as HTMLElement
}

function blocked(target: Element): boolean {
  if (PUBLIC.test(location.pathname)) return true
  if (target.closest('input, textarea, select, [contenteditable="true"], .aion-wa-open, [data-ptr="off"], .aion-dock, .aa')) return true
  // dentro de janela por cima (posição fixa) não puxa
  for (let n = target as HTMLElement | null; n && n !== document.body; n = n.parentElement) {
    if (getComputedStyle(n).position === 'fixed') return true
  }
  return false
}

function vibrate() { try { (navigator as any).vibrate?.(8) } catch { /* ok */ } }

export function installPullToRefresh() {
  if (typeof window === 'undefined' || (window as any).__aionPtr) return
  if (!window.matchMedia('(pointer: coarse)').matches) return
  ;(window as any).__aionPtr = true
  document.documentElement.classList.add('aion-touch')

  let startY = 0, startX = 0, pull = 0, active = false, decided = false, busy = false
  let scroller: HTMLElement | null = null

  const set = (d: number, anim = false) => {
    ensureEl()
    el!.style.transition = anim ? 'transform .3s cubic-bezier(.2,.9,.25,1), opacity .3s' : 'none'
    el!.style.transform = `translate(-50%, ${d - 60}px)`
    el!.style.opacity = String(Math.min(1, d / 40))
    if (ring) ring.style.transform = `rotate(${d * 3.2}deg)`
    el!.classList.toggle('ready', d >= TRIGGER)
  }

  window.addEventListener('touchstart', e => {
    if (busy || window.innerWidth >= BP || e.touches.length !== 1) return
    const t = e.target as Element
    if (blocked(t)) return
    scroller = scrollParent(t)
    if (!scroller || scroller.scrollTop > 0) return
    startY = e.touches[0].clientY; startX = e.touches[0].clientX
    active = true; decided = false; pull = 0
  }, { passive: true })

  window.addEventListener('touchmove', e => {
    if (!active) return
    const dy = e.touches[0].clientY - startY, dx = e.touches[0].clientX - startX
    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      decided = true
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || (scroller && scroller.scrollTop > 0)) { active = false; return }
    }
    if (dy <= 0) { pull = 0; set(0); return }
    if (e.cancelable) e.preventDefault()
    pull = Math.min(MAX, dy * 0.5)
    set(pull)
  }, { passive: false })

  const end = () => {
    if (!active) return
    active = false
    if (pull >= TRIGGER) {
      busy = true; vibrate()
      set(TRIGGER, true); el!.classList.add('spin')
      window.dispatchEvent(new CustomEvent('aion:refresh'))
      setTimeout(() => { el!.classList.remove('spin'); set(0, true); busy = false }, 900)
    } else if (pull > 0) set(0, true)
    pull = 0
  }
  window.addEventListener('touchend', end, { passive: true })
  window.addEventListener('touchcancel', end, { passive: true })

  // Vibração curta nos botões principais (Android; o iPhone não deixa).
  document.addEventListener('click', e => {
    if (window.innerWidth >= BP) return
    const b = (e.target as Element).closest('button, [role="button"]') as HTMLElement | null
    if (!b || (b as HTMLButtonElement).disabled) return
    const bg = getComputedStyle(b).backgroundImage
    if ((b as HTMLButtonElement).type === 'submit' || bg.includes('gradient')) vibrate()
  }, true)
}
