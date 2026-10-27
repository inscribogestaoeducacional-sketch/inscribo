// Depois do `vite build`: gera um HTML próprio para cada página pública do site (título, descrição,
// texto, perguntas e dados estruturados), além de sitemap.xml e robots.txt. O React assume a página ao abrir.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const DIST = path.join(ROOT, 'dist')
const SITE = 'https://aionedu.com.br'
const read = (p, fallback) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')) } catch { return fallback } }

const modules = read('src/site/content/modules.json', [])
const home = read('src/site/content/home.json', null)
const integrations = read('src/site/content/integrations.json', [])
const guides = read('src/site/content/guides.json', [])

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const org = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Áion Edu', legalName: 'Áion Soluções Tecnológicas LTDA', url: SITE, logo: SITE + '/aion-logo-icon.png', address: { '@type': 'PostalAddress', addressLocality: 'Patos', addressRegion: 'PB', addressCountry: 'BR' } }
const app = (name, description, p) => ({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name, description, url: SITE + p, applicationCategory: 'BusinessApplication', operatingSystem: 'Web, Android, iOS', inLanguage: 'pt-BR', publisher: { '@type': 'Organization', name: 'Áion Edu' } })
const faqLd = faq => ({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) })
const crumbLd = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.path })) })

const pages = []
if (home) pages.push({ path: '/', file: 'home.html', title: home.title, description: home.description, h1: home.h1, intro: [home.sub], sections: [], faq: home.faq, jsonLd: [org, app('Áion Edu', home.description, '/'), faqLd(home.faq)] })
pages.push({ path: '/modulos', title: 'Módulos da Áion Edu: CRM, WhatsApp, campanha e matrículas', description: 'Conheça os módulos da Áion Edu: CRM de leads, WhatsApp, robô, captação, vitrine, campanha de matrículas, base de alunos, rematrícula e mais.', h1: `${modules.length} módulos, um sistema só`, intro: ['Cada módulo resolve um problema da rotina da escola e todos conversam entre si.'], sections: [], faq: [], jsonLd: [crumbLd([{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }])] })
for (const m of modules) {
  const description = `${m.headline}. ${m.sub}`
  pages.push({
    path: `/modulos/${m.slug}`, title: `${m.name} para escolas | Áion Edu`, description, h1: m.headline, intro: [m.sub],
    sections: [{ h: 'O problema', p: m.problem }, { h: 'A solução', p: m.solution }, { h: `${m.name} na prática`, items: m.features.map(f => ({ t: f.t, d: f.d })) }],
    faq: m.faq, crumbs: [{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }, { name: m.name, path: `/modulos/${m.slug}` }],
    jsonLd: [app(m.name, description, `/modulos/${m.slug}`), faqLd(m.faq), crumbLd([{ name: 'Início', path: '/' }, { name: 'Módulos', path: '/modulos' }, { name: m.name, path: `/modulos/${m.slug}` }])],
  })
}
for (const g of [...integrations, ...guides]) {
  pages.push({ path: g.path, title: g.title, description: g.description, h1: g.h1, intro: g.intro ?? [], sections: g.sections ?? [], faq: g.faq ?? [], jsonLd: [app(g.h1, g.description, g.path), ...(g.faq?.length ? [faqLd(g.faq)] : []), crumbLd([{ name: 'Início', path: '/' }, { name: g.h1, path: g.path }])] })
}

const shell = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const navLinks = modules.map(m => `<a href="/modulos/${m.slug}">${esc(m.name)}</a>`).join(' ')
const body = p => {
  let h = `<div style="max-width:880px;margin:0 auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.6"><nav aria-label="Principal"><a href="/">Áion Edu</a> · <a href="/modulos">Módulos</a> · <a href="/integracoes/whatsapp">Integrações</a> · <a href="/raio-x">Raio-X grátis</a> · <a href="/blog">Blog</a></nav><main>`
  h += `<h1>${esc(p.h1)}</h1>` + (p.intro ?? []).map(t => `<p>${esc(t)}</p>`).join('')
  for (const s of p.sections ?? []) {
    h += `<section><h2>${esc(s.h)}</h2>` + (s.p ? `<p>${esc(s.p)}</p>` : '') + (s.items ? `<ul>${s.items.map(i => `<li><strong>${esc(i.t)}</strong>: ${esc(i.d)}</li>`).join('')}</ul>` : '') + '</section>'
  }
  if (p.faq?.length) h += `<section><h2>Perguntas frequentes</h2>${p.faq.map(f => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>`
  h += `</main><footer><p>Módulos: ${navLinks}</p><p>Áion Soluções Tecnológicas LTDA, Patos, Paraíba.</p></footer></div>`
  return h
}
const head = p => [
  `<meta name="description" content="${esc(p.description)}" />`,
  `<link rel="canonical" href="${SITE}${p.path === '/' ? '/' : p.path}" />`,
  `<meta property="og:type" content="website" /><meta property="og:locale" content="pt_BR" /><meta property="og:site_name" content="Áion Edu" />`,
  `<meta property="og:title" content="${esc(p.title)}" /><meta property="og:description" content="${esc(p.description)}" /><meta property="og:url" content="${SITE}${p.path}" />`,
  ...(p.jsonLd ?? []).map(j => `<script type="application/ld+json" data-site-ld="1">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
].join('\n    ')

let written = 0
for (const p of pages) {
  let html = shell
    .replace('<html lang="en">', '<html lang="pt-BR">')
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(p.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, '')
    .replace('</head>', `    ${head(p)}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body(p)}</div>`)
  const out = p.file ? path.join(DIST, p.file) : path.join(DIST, p.path, 'index.html')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, html)
  written++
}

const today = new Date().toISOString().slice(0, 10)
const extra = ['/raio-x', '/sobre', '/blog', '/parceiros', '/parceria-meta', '/privacidade', '/termos']
const urls = [...pages.map(p => p.path), ...extra]
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${SITE}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /super-admin\nDisallow: /home\nDisallow: /leads\nDisallow: /whatsapp\nDisallow: /settings\n\nSitemap: ${SITE}/sitemap.xml\n`)
console.log(`prerender-site: ${written} páginas, ${urls.length} URLs no sitemap`)
