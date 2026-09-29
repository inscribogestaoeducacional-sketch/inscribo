// api/_lib/vitrineRender.ts
//
// HTML da página pública da Vitrine (aionedu.com.br/<slug>). Módulo puro,
// sem import nenhum, pra servir aos dois lados:
//   - api/_lib/vitrinePage.ts (via api/public.ts): página renderizada no servidor (prévia de
//     compartilhamento com as meta tags certas, primeira pintura sem JS);
//   - editor da Vitrine (Fase 3): prévia em <iframe srcdoc> com o mesmo HTML,
//     sem o script de registro (opção preview).
//
// Os dados chegam de vitrine_public_page() (20260929060000_vitrine.sql), que
// já validou tudo na gravação. Mesmo assim, aqui tudo passa de novo por
// escape/validação (defesa em profundidade): texto sempre escapado, URL só
// http(s), cor só #RRGGBB, fonte só da lista, vídeo só por ID.

export interface VitrinePage {
  id: string
  slug: string
  title: string | null
  bio: string | null
  logo_url: string | null
  cover_url: string | null
  theme: Record<string, unknown> | null
  seo_description: string | null
  institution_name: string | null
}

export interface VitrineBlock {
  id: string
  type: string
  config: Record<string, any>
}

export interface VitrinePublicData {
  page: VitrinePage
  blocks: VitrineBlock[]
}

export interface RenderOptions {
  siteUrl: string          // https://aionedu.com.br
  supabaseUrl?: string     // registro de eventos (omitido no preview)
  anonKey?: string
  preview?: boolean        // editor: sem script de registro, links sem sair do iframe
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const isHttpUrl = (u: unknown): u is string =>
  typeof u === 'string' && /^https?:\/\/[^\s<>"]+$/i.test(u) && u.length <= 2048

const HEX = /^#[0-9A-Fa-f]{6}$/

// JSON dentro de <script>: "<" escapado pra "</script>" nunca fechar a tag.
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Texto sobre a cor da escola: branco enquanto tiver contraste >= 3:1 (WCAG
// pra componente de interface/texto grande — cor de marca com texto branco é
// o esperado, ex.: azul #3B82F6 = 3,7:1); abaixo disso, quase-preto (ex.:
// laranja #F59E0B, branco daria 2,1:1).
function onColor(hex: string): string {
  return 1.05 / (luminance(hex) + 0.05) >= 3 ? '#FFFFFF' : '#111827'
}

// Mistura `a` sobre `b` com opacidade `t` (0–1) — fundo do botão "suave".
function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b)
  const m = ca.map((v, i) => Math.round(v * t + cb[i] * (1 - t)))
  return '#' + m.map(v => v.toString(16).padStart(2, '0')).join('')
}

// Mesma codificação de buildWaMeLink (src/lib/captureTriggers.ts): o texto
// precisa chegar idêntico ao gatilho do Captação, e . ! ' ( ) * ~ crus no
// fim do link são cortados por quem transforma texto em link clicável.
export function waMeLink(phone: string, text: string): string | null {
  let digits = (phone || '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  const encoded = encodeURIComponent((text || '').trim())
    .replace(/[.!'()*~]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  return `https://wa.me/${digits}?text=${encoded}`
}

const FONTS: Record<string, string> = {
  'Inter':            'Inter:wght@400;500;600;700',
  'Poppins':          'Poppins:wght@400;500;600;700',
  'Montserrat':       'Montserrat:wght@400;500;600;700',
  'Nunito':           'Nunito:wght@400;600;700;800',
  'Lora':             'Lora:wght@400;500;600;700',
  'Playfair Display': 'Playfair+Display:wght@400;600;700',
}

interface Theme {
  primary: string; background: string; text: string
  buttonStyle: 'filled' | 'outline' | 'soft'; radius: number; font: string
}

function readTheme(t: Record<string, unknown> | null): Theme {
  const th = t || {}
  const pick = (k: string, def: string) => (typeof th[k] === 'string' && HEX.test(th[k] as string) ? th[k] as string : def)
  const bs = th.button_style
  const radius = Number(th.radius)
  const font = typeof th.font === 'string' && FONTS[th.font] ? th.font : 'Inter'
  return {
    primary:     pick('primary', '#00A896'),
    background:  pick('background', '#FFFFFF'),
    text:        pick('text', '#111827'),
    buttonStyle: bs === 'outline' || bs === 'soft' ? bs : 'filled',
    radius:      [0, 8, 16, 999].includes(radius) ? radius : 16,
    font,
  }
}

// ── Ícones (SVG inline, sem requisição extra) ───────────────────────────────

const ICON = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.07c-.24.68-1.42 1.3-1.95 1.38-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.8-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-3 0-1.43.75-2.13 1.02-2.42.27-.29.58-.36.78-.36h.56c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.19-.14.31-.29.48-.14.17-.3.37-.43.5-.14.14-.29.3-.13.59.17.29.74 1.22 1.59 1.97 1.09.97 2.01 1.27 2.3 1.41.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.29.38-.24.65-.14.26.1 1.68.79 1.97.94.29.14.48.22.55.34.07.12.07.69-.17 1.37z"/></svg>',
  link:     '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>',
  pin:      '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  clock:    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 7v5l3 2"/></svg>',
  school:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 9l10-5 10 5-10 5L2 9zm4 2.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.8"/></svg>',
}

// ── Blocos ──────────────────────────────────────────────────────────────────

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function button(blockId: string, href: string, label: string, icon: string, cls = ''): string {
  return `<a class="btn ${cls}" href="${esc(href)}" data-b="${esc(blockId)}" target="_blank" rel="noopener noreferrer">`
    + `<span class="ic">${icon}</span><span class="lb">${esc(label)}</span><span class="ic"></span></a>`
}

function paragraphs(text: string): string {
  return String(text || '').trim().split(/\n{2,}/)
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('')
}

function renderBlock(b: VitrineBlock, preview = false): string {
  const c = b.config || {}
  switch (b.type) {
    case 'link': {
      if (!isHttpUrl(c.url)) return ''
      const thumb = isHttpUrl(c.thumbnail_url)
        ? `<img class="thumb" src="${esc(c.thumbnail_url)}" alt="" loading="lazy">` : ICON.link
      return button(b.id, c.url, c.label, thumb)
    }
    case 'whatsapp': {
      const href = waMeLink(c.phone, c.message)
      return href ? button(b.id, href, c.label, ICON.whatsapp, 'wa') : ''
    }
    case 'enroll': {
      const href = c.mode === 'link' ? (isHttpUrl(c.url) ? c.url : null) : waMeLink(c.phone, c.message)
      return href ? button(b.id, href, c.label, c.mode === 'link' ? ICON.school : ICON.whatsapp, 'cta') : ''
    }
    case 'text': {
      if (!c.body) return ''
      return `<section class="card text">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}${paragraphs(c.body)}</section>`
    }
    case 'gallery': {
      const imgs = (Array.isArray(c.images) ? c.images : []).filter((i: any) => isHttpUrl(i?.url))
      if (!imgs.length) return ''
      const cls = c.layout === 'carousel' ? 'carousel' : 'grid'
      return `<section class="gallery ${cls}">` + imgs.map((i: any) =>
        `<figure><img src="${esc(i.url)}" alt="${esc(i.caption || '')}" loading="lazy">`
        + (i.caption ? `<figcaption>${esc(i.caption)}</figcaption>` : '') + '</figure>').join('') + '</section>'
    }
    case 'video': {
      const id = String(c.video_id || '')
      let src = ''
      if (c.provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id)) src = `https://www.youtube-nocookie.com/embed/${id}`
      if (c.provider === 'vimeo' && /^[0-9]{6,12}$/.test(id)) src = `https://player.vimeo.com/video/${id}`
      if (!src) return ''
      // Prévia do editor (iframe em sandbox, sem o player funcionando):
      // miniatura do YouTube / quadro neutro do Vimeo com ícone de play.
      if (preview) {
        const thumb = c.provider === 'youtube'
          ? `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ''
        return `<section class="video">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}<div class="frame">${thumb}`
          + `<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">`
          + `<span style="width:64px;height:44px;border-radius:12px;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center">`
          + `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#fff" d="M8 5v14l11-7z"/></svg></span></span></div></section>`
      }
      return `<section class="video">${c.title ? `<h2>${esc(c.title)}</h2>` : ''}`
        + `<div class="frame"><iframe src="${src}" title="${esc(c.title || 'Vídeo')}" loading="lazy" `
        + `allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></section>`
    }
    case 'map': {
      const addr = String(c.address || '').trim()
      if (!addr) return ''
      // "Nome da escola, endereço": o Google acha o lugar cadastrado e o pino
      // cai na escola. Só o endereço cai onde o Google estima o número da rua
      // (no Ágape, ~110 m ao lado). place_name vazio = só endereço.
      const place = typeof c.place_name === 'string' ? c.place_name.trim() : ''
      const q = encodeURIComponent(place ? `${place}, ${addr}` : addr)
      return `<section class="card map"><h2><span class="ic">${ICON.pin}</span>${esc(c.label || 'Onde estamos')}</h2>`
        + `<p>${esc(addr)}</p>`
        + `<div class="frame map-frame"><iframe src="https://www.google.com/maps?q=${q}&amp;output=embed" title="Mapa" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
        + `<a class="link-inline" href="https://www.google.com/maps/search/?api=1&amp;query=${q}" data-b="${esc(b.id)}" target="_blank" rel="noopener noreferrer">Como chegar →</a></section>`
    }
    case 'hours': {
      const days = (Array.isArray(c.days) ? c.days : [])
        .filter((d: any) => /^[0-6]$/.test(String(d?.dow)))
      if (!days.length && !c.note) return ''
      const order = [1, 2, 3, 4, 5, 6, 0]
      const rows = order.map(dow => {
        const d = days.find((x: any) => Number(x.dow) === dow)
        if (!d) return ''
        const val = d.closed ? 'Fechado'
          : (/^\d{2}:\d{2}$/.test(d.open) && /^\d{2}:\d{2}$/.test(d.close) ? `${esc(d.open)} – ${esc(d.close)}` : '')
        return val ? `<tr data-dow="${dow}"><th>${DAYS[dow]}</th><td>${val}</td></tr>` : ''
      }).join('')
      const data = days.map((d: any) => ({ dow: Number(d.dow), open: d.open, close: d.close, closed: !!d.closed }))
      return `<section class="card hours" data-hours="${esc(JSON.stringify(data))}">`
        + `<h2><span class="ic">${ICON.clock}</span>Horário de atendimento <span class="now" hidden></span></h2>`
        + (rows ? `<table>${rows}</table>` : '')
        + (c.note ? `<p class="note">${esc(c.note)}</p>` : '') + '</section>'
    }
    default:
      return ''
  }
}

// ── Página ──────────────────────────────────────────────────────────────────

function css(t: Theme): string {
  const onPrimary = onColor(t.primary)
  const soft = mix(t.primary, t.background, 0.14)
  const card = mix(t.text, t.background, 0.04)
  const border = mix(t.text, t.background, 0.12)
  const muted = mix(t.text, t.background, 0.68)
  const r = t.radius === 999 ? '999px' : `${t.radius}px`
  const rCard = t.radius === 999 ? '24px' : `${Math.max(t.radius, 8)}px`
  const btn = t.buttonStyle === 'outline'
    ? `background:transparent;color:${t.text};border:2px solid ${t.primary};`
    : t.buttonStyle === 'soft'
      ? `background:${soft};color:${t.text};border:2px solid transparent;`
      : `background:${t.primary};color:${onPrimary};border:2px solid ${t.primary};`
  return `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:${t.background};color:${t.text};font-family:'${t.font}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.5;-webkit-font-smoothing:antialiased}
.wrap{max-width:560px;margin:0 auto;padding:0 16px 40px}
.cover{display:block;width:calc(100% + 32px);height:180px;margin:0 -16px;object-fit:cover;background:${soft}}
@media(min-width:600px){.cover{width:100%;margin:16px 0 0;border-radius:${rCard}}}
header{text-align:center;padding-top:24px}
.has-cover header{padding-top:0}
.logo{width:96px;height:96px;border-radius:50%;object-fit:contain;padding:8px;background:${t.background};border:4px solid ${t.background};box-shadow:0 2px 12px rgba(0,0,0,.08)}
.has-cover .logo{margin-top:-48px}
h1{font-size:24px;line-height:1.25;margin:12px 0 4px;font-weight:700;text-wrap:balance}
.bio{margin:0 auto;max-width:44ch;color:${muted};font-size:15px}
main{display:flex;flex-direction:column;gap:12px;margin-top:24px}
.btn{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;border-radius:${r};text-decoration:none;font-weight:600;font-size:16px;${btn}transition:transform .12s ease,box-shadow .12s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.10)}
.btn:active{transform:translateY(0)}
.btn:focus-visible,.link-inline:focus-visible{outline:3px solid ${t.primary};outline-offset:3px}
.btn .lb{flex:1;text-align:center}
.btn .ic{width:28px;height:28px;flex:none;display:flex;align-items:center;justify-content:center}
.btn .ic svg{width:22px;height:22px}
.btn .thumb{width:36px;height:36px;border-radius:${t.radius === 0 ? '0' : '8px'};object-fit:cover}
.btn.cta{min-height:64px;font-size:17px;background:${t.primary};color:${onPrimary};border-color:${t.primary}}
.card{background:${card};border:1px solid ${border};border-radius:${rCard};padding:16px 18px}
.card h2,.video h2{font-size:16px;margin:0 0 8px;display:flex;align-items:center;gap:8px}
.card h2 .ic{display:inline-flex;width:20px;height:20px;color:${t.primary}}
.card h2 .ic svg{width:20px;height:20px}
.card p{margin:0 0 8px}.card p:last-child{margin-bottom:0}
.text p{white-space:normal}
.gallery.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.gallery.grid figure:only-child{grid-column:1/-1}
.gallery.carousel{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -16px;padding:0 16px;scrollbar-width:none}
.gallery.carousel::-webkit-scrollbar{display:none}
.gallery.carousel figure{flex:0 0 82%;scroll-snap-align:center}
.gallery figure{margin:0}
.gallery img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:${rCard};background:${card}}
.gallery.carousel img{aspect-ratio:4/3}
.gallery figcaption{font-size:13px;color:${muted};margin-top:4px;text-align:center}
.frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:${rCard};overflow:hidden;background:${card}}
.frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.map-frame{aspect-ratio:4/3;margin:8px 0 10px}
.link-inline{color:${t.text};font-weight:600;text-decoration:underline;text-decoration-color:${t.primary};text-underline-offset:3px}
.hours table{width:100%;border-collapse:collapse;font-size:15px}
.hours th{text-align:left;font-weight:500;padding:5px 0}
.hours td{text-align:right;padding:5px 0;font-variant-numeric:tabular-nums}
.hours tr+tr th,.hours tr+tr td{border-top:1px solid ${border}}
.hours tr.today th,.hours tr.today td{font-weight:700}
.hours .note{font-size:13px;color:${muted};margin-top:8px}
.now{margin-left:auto;flex:none;white-space:nowrap;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;background:${border}}
.now.open{background:#DCFCE7;color:#166534}.now.closed{background:#FEE2E2;color:#991B1B}
footer{margin-top:32px;text-align:center;font-size:12px;color:${muted}}
footer a{color:inherit;text-decoration:none;font-weight:600}
@media(prefers-reduced-motion:reduce){.btn{transition:none}.btn:hover{transform:none}}
`
}

// Registro de visualização/clique + "aberto agora" do horário. Roda no
// navegador do visitante; falha em silêncio (nunca atrapalha o clique).
function trackingScript(pageId: string, supabaseUrl: string, anonKey: string): string {
  return `(function(){
var P=${jsonForScript(pageId)},U=${jsonForScript(supabaseUrl)},K=${jsonForScript(anonKey)};
function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c=='x'?r:(r&3|8)).toString(16)})}
var V;try{V=localStorage.getItem('aion_vitrine_vid');if(!V){V=uuid();localStorage.setItem('aion_vitrine_vid',V)}}catch(e){V=uuid()}
var q=new URLSearchParams(location.search),ref=null;
try{if(document.referrer){var h=new URL(document.referrer).hostname;if(h!==location.hostname)ref=h}}catch(e){}
var ua=navigator.userAgent,dev=/iPad|Tablet/i.test(ua)?'tablet':(/Mobi|Android|iPhone/i.test(ua)?'mobile':'desktop');
function send(b,ev){try{fetch(U+'/rest/v1/rpc/vitrine_track',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:K,Authorization:'Bearer '+K},body:JSON.stringify({p_page_id:P,p_block_id:b,p_event:ev,p_visitor_id:V,p_referrer_host:ref,p_utm_source:q.get('utm_source'),p_utm_medium:q.get('utm_medium'),p_utm_campaign:q.get('utm_campaign'),p_device:dev})}).catch(function(){})}catch(e){}}
send(null,'view');
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[data-b]');if(a)send(a.getAttribute('data-b'),'click')},true);
try{var p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),o={};p.forEach(function(x){o[x.type]=x.value});
var dow=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(o.weekday),min=parseInt(o.hour,10)*60+parseInt(o.minute,10);
function m(s){var t=String(s||'').split(':');return parseInt(t[0],10)*60+parseInt(t[1],10)}
document.querySelectorAll('[data-hours]').forEach(function(s){var d=JSON.parse(s.getAttribute('data-hours')||'[]'),t=null;d.forEach(function(x){if(x.dow===dow)t=x});
var row=s.querySelector('tr[data-dow="'+dow+'"]');if(row)row.className='today';
var b=s.querySelector('.now');if(!b||!t)return;var open=!t.closed&&min>=m(t.open)&&min<m(t.close);
b.textContent=open?'Aberto agora':'Fechado agora';b.className='now '+(open?'open':'closed');b.hidden=false})}catch(e){}
})();`
}

export function renderVitrinePage(data: VitrinePublicData, opts: RenderOptions): string {
  const p = data.page
  const t = readTheme(p.theme)
  const name = (p.title || p.institution_name || 'Escola').trim()
  const desc = (p.seo_description || p.bio || `Links, contato e informações de ${name}.`).trim()
  const url = `${opts.siteUrl}/${p.slug}`
  const cover = isHttpUrl(p.cover_url) ? p.cover_url : null
  const logo = isHttpUrl(p.logo_url) ? p.logo_url : null
  const ogImage = cover || logo
  const blocks = (data.blocks || []).map(b => renderBlock(b, !!opts.preview)).filter(Boolean).join('\n')
  const script = !opts.preview && opts.supabaseUrl && opts.anonKey
    ? `<script>${trackingScript(p.id, opts.supabaseUrl, opts.anonKey)}</script>` : ''
  // Preview (iframe no editor): link abre em nova aba igual à página real;
  // <base target> garante isso também pro "Como chegar".
  const base = opts.preview ? '<base target="_blank">' : ''

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(name)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="${t.background}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(name)}">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${esc(url)}">
<meta property="og:title" content="${esc(name)}">
<meta property="og:description" content="${esc(desc)}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="twitter:card" content="${cover ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(name)}">
<meta name="twitter:description" content="${esc(desc)}">
${ogImage ? `<meta name="twitter:image" content="${esc(ogImage)}">` : ''}
${logo ? `<link rel="icon" href="${esc(logo)}">` : ''}
${base}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${FONTS[t.font]}&amp;display=swap">
<style>${css(t)}</style>
</head>
<body class="${cover ? 'has-cover' : ''}">
<div class="wrap">
${cover ? `<img class="cover" src="${esc(cover)}" alt="">` : ''}
<header>
${logo ? `<img class="logo" src="${esc(logo)}" alt="Logo ${esc(name)}">` : ''}
<h1>${esc(name)}</h1>
${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
</header>
<main>
${blocks}
</main>
<footer>Página criada com <a href="${esc(opts.siteUrl)}/?utm_source=vitrine&amp;utm_medium=rodape" target="_blank" rel="noopener">Áion Edu</a></footer>
</div>
${script}
</body>
</html>`
}

export function renderVitrineNotFound(siteUrl: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Página não encontrada — Áion Edu</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F9FAFB;color:#1A2B4A;min-height:100vh;margin:0;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{max-width:420px;text-align:center;background:#fff;border:1px solid #E2E8F0;border-radius:20px;padding:40px 32px}
  h1{font-size:18px;margin:0 0 8px}p{font-size:14px;color:#64748B;margin:0 0 20px;line-height:1.5}
  a{color:#00A896;font-weight:600;text-decoration:none}
</style></head>
<body><div class="card">
  <h1>Página não encontrada</h1>
  <p>Este endereço não existe ou a escola ainda não publicou a página dela.</p>
  <a href="${esc(siteUrl)}">Conhecer a Áion Edu →</a>
</div></body></html>`
}
