// Dados e utilitários do site público (páginas de módulos, integrações e guias).
import { useEffect } from 'react'
import modulesJson from './content/modules.json'

export type ModuleFeature = { t: string; d: string }
export type ModuleFaq = { q: string; a: string }
export type SiteModule = {
  slug: string; name: string; icon: string; color: string; bg: string
  headline: string; sub: string; problem: string; solution: string
  features: ModuleFeature[]; faq: ModuleFaq[]; shot: string; group: string; paid: boolean; seo: string
}
export const MODULES = modulesJson as SiteModule[]
export const moduleBySlug = (slug: string) => MODULES.find(m => m.slug === slug)

export const SITE_URL = 'https://aionedu.com.br'
export const WA_NUMBER = '5583993444383'
export const WA_TEXT = 'Oi! Quero conhecer a Áion Edu para a minha escola.'
export const waLink = (text = WA_TEXT) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`
export const WA_DISPLAY = '(83) 9 9344-4383'

export const shotUrl = (key: string, dev: 'd' | 'm') => `/site/shots/${key}-${dev}.webp`

export const MODULE_GROUPS = ['Comercial', 'Matrículas', 'Análise', 'Ajuda', 'Administração']

/** Define título, descrição, canonical e JSON-LD da página (o HTML pré-gerado no build já traz os mesmos). */
export function useSeo(opts: { title: string; description: string; path: string; jsonLd?: object[] }) {
  useEffect(() => {
    document.title = opts.title
    const set = (sel: string, attr: string, val: string, create: () => HTMLElement) => {
      let el = document.head.querySelector(sel) as HTMLElement | null
      if (!el) { el = create(); document.head.appendChild(el) }
      el.setAttribute(attr, val)
    }
    set('meta[name="description"]', 'content', opts.description, () => { const m = document.createElement('meta'); m.setAttribute('name', 'description'); return m })
    set('link[rel="canonical"]', 'href', SITE_URL + opts.path, () => { const l = document.createElement('link'); l.setAttribute('rel', 'canonical'); return l })
    set('meta[property="og:title"]', 'content', opts.title, () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:title'); return m })
    set('meta[property="og:description"]', 'content', opts.description, () => { const m = document.createElement('meta'); m.setAttribute('property', 'og:description'); return m })
    const ld = (opts.jsonLd ?? []).map(o => { const s = document.createElement('script'); s.type = 'application/ld+json'; s.setAttribute('data-site-ld', '1'); s.text = JSON.stringify(o); return s })
    document.head.querySelectorAll('script[data-site-ld]').forEach(n => n.remove())
    ld.forEach(s => document.head.appendChild(s))
    return () => { document.head.querySelectorAll('script[data-site-ld]').forEach(n => n.remove()) }
  }, [opts.title, opts.description, opts.path]) // eslint-disable-line react-hooks/exhaustive-deps
}

/** Entra na tela com fade/subida. Quem pede menos movimento vê tudo parado (regra no CSS). */
export function useInView<T extends HTMLElement>(once = true) {
  const ref = (node: T | null) => {
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') { node.classList.add('in'); return }
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { node.classList.add('in'); if (once) o.disconnect() } }, { threshold: 0.12 })
    o.observe(node)
  }
  return ref
}
