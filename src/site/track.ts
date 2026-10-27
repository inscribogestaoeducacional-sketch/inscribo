// Estatística própria do site público. Sem cookie de terceiros: o navegador guarda só um código anônimo.
// Respeita "Não rastrear" do navegador e a escolha feita no aviso de privacidade.
import { supabase } from '../lib/supabase'

const K_VISITOR = 'aion_site_v', K_SESSION = 'aion_site_s', K_CHOICE = 'aion_site_ok'
const URL_ = import.meta.env.VITE_SUPABASE_URL as string
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
const lsGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignora */ } }
const ssGet = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }
const ssSet = (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignora */ } }

export function trackingAllowed(): boolean {
  if (typeof navigator === 'undefined') return false
  if ((navigator as Navigator & { doNotTrack?: string }).doNotTrack === '1') return false
  return lsGet(K_CHOICE) !== 'no'
}
export const trackingChoice = () => lsGet(K_CHOICE)
export function setTrackingChoice(v: 'yes' | 'no') { lsSet(K_CHOICE, v); if (v === 'no') { try { localStorage.removeItem(K_VISITOR); sessionStorage.removeItem(K_SESSION) } catch { /* ignora */ } } }

function ids() {
  let isNew = false
  let v = lsGet(K_VISITOR); if (!v) { v = rid(); lsSet(K_VISITOR, v); isNew = true }
  let s = ssGet(K_SESSION); if (!s) { s = rid(); ssSet(K_SESSION, s) }
  return { v, s, isNew }
}

/** Código curto da sessão: vai na mensagem do WhatsApp para ligar a conversa à visita. */
export const sessionCode = () => (ids().s.slice(0, 6) || 'site').toUpperCase()

function utm() {
  const q = new URLSearchParams(location.search)
  const pick = (k: string) => q.get(k) ?? undefined
  const cur = { utm_source: pick('utm_source'), utm_medium: pick('utm_medium'), utm_campaign: pick('utm_campaign'), utm_content: pick('utm_content'), utm_term: pick('utm_term') }
  // a origem da sessão fica guardada para as páginas seguintes
  if (cur.utm_source || cur.utm_campaign) { ssSet('aion_site_u', JSON.stringify(cur)); return cur }
  try { return JSON.parse(ssGet('aion_site_u') || '{}') } catch { return {} }
}
function refHost() {
  const stored = ssGet('aion_site_r'); if (stored !== null) return stored
  let h = ''
  try { if (document.referrer) { h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h.endsWith('aionedu.com.br')) h = '' } } catch { /* ignora */ }
  ssSet('aion_site_r', h); return h
}
function device() {
  const ua = navigator.userAgent
  const dev = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'celular' : 'computador'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Outro'
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : 'Outro'
  return { device: dev, browser, os }
}

let curId: string | null = null
let curStart = 0
let maxScroll = 0
let listening = false

function scrollPct() {
  const h = document.documentElement
  const total = h.scrollHeight - h.clientHeight
  return total <= 0 ? 100 : Math.min(100, Math.round((h.scrollTop / total) * 100))
}
function ping() {
  if (!curId) return
  const dur = Math.round((Date.now() - curStart) / 1000)
  try {
    fetch(`${URL_}/rest/v1/rpc/site_ping`, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: KEY_, Authorization: `Bearer ${KEY_}` },
      body: JSON.stringify({ p_id: curId, p_dur: dur, p_scroll: maxScroll }),
    }).catch(() => {})
  } catch { /* ignora */ }
}
function listen() {
  if (listening) return; listening = true
  window.addEventListener('scroll', () => { maxScroll = Math.max(maxScroll, scrollPct()) }, { passive: true })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') ping() })
  window.addEventListener('pagehide', ping)
}

/** Registra a abertura de uma página do site. */
export async function trackPage(path: string) {
  if (!trackingAllowed()) return
  ping() // fecha o tempo da página anterior
  curId = null; curStart = Date.now(); maxScroll = 0
  const { v, s, isNew } = ids()
  try {
    const { data } = await supabase.rpc('site_hit', {
      p: { visitor_id: v, session_id: s, path, referrer: document.referrer || undefined, ref_host: refHost(), ...utm(), ...device(),
           tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: navigator.language, screen_w: window.innerWidth, is_new: isNew },
    })
    curId = (data as string | null) ?? null
    listen()
  } catch { /* estatística nunca atrapalha o site */ }
}

/** Registra um clique importante (WhatsApp, Raio-X). */
export function trackEvent(kind: 'wa_click' | 'raiox_click', code?: string) {
  if (!trackingAllowed()) return
  const { v, s } = ids(); const u = utm()
  try { supabase.rpc('site_event', { p: { visitor_id: v, session_id: s, kind, path: location.pathname, code, ref_host: refHost(), utm_source: u.utm_source, utm_campaign: u.utm_campaign } }).then(() => {}, () => {}) } catch { /* ignora */ }
}
