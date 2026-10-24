import { supabase } from './supabase'
const IS_SUPPORT_TAB = false
// Avisos push: liga quando as tabelas e a função de envio estiverem no banco.
export const PUSH_ENABLED = false
export const PUSH_CHANGED_EVENT = 'aion:push-changed'

// Avisos no celular/computador (Web Push). A chave pública VAPID pode ficar no
// código; a privada fica só no servidor.
export const VAPID_PUBLIC_KEY = 'BBnoq7TckDzq3OQOIyYW-DLoyNAQQwmfUpHsXrRkR_T0rHldgOC3np9WFAgoaV26lhbOQM-gc-jd1iFwyFUltgc'

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'

export type PushState = 'ativo' | 'desligado' | 'bloqueado' | 'sem_suporte' | 'iphone_instalar'

// Instalar o app (Android/Chrome/Edge): o navegador oferece o evento
// beforeinstallprompt uma vez; guardamos para o cartão "Instale o Áion".
interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }
let installEvt: InstallPromptEvent | null = null
export const INSTALL_READY_EVENT = 'aion:install-ready'
export const canPromptInstall = () => !!installEvt
export async function promptInstall(): Promise<boolean> {
  if (!installEvt) return false
  const e = installEvt
  installEvt = null
  await e.prompt()
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }))
  return r.outcome === 'accepted'
}

export function registerServiceWorker() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvt = e as InstallPromptEvent
    window.dispatchEvent(new Event(INSTALL_READY_EVENT))
  })
  window.addEventListener('appinstalled', () => { installEvt = null; window.dispatchEvent(new Event(INSTALL_READY_EVENT)) })
  if (!('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* sem SW: só o sino funciona */ })
  })
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

export async function pushState(): Promise<PushState> {
  if (!PUSH_ENABLED) return 'sem_suporte'
  if (isIOS() && !isStandalone()) return 'iphone_instalar'
  if (!pushSupported()) return 'sem_suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'ativo' : 'desligado'
}

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

function deviceName() {
  const ua = navigator.userAgent
  const os = /Android/.test(ua) ? 'Android' : isIOS() ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ''
  return `${os}${br ? ' · ' + br : ''}${isStandalone() ? ' (app)' : ''}`
}

/** Pede permissão e registra este aparelho para receber avisos. */
export async function enablePush(): Promise<{ ok: boolean; error?: string }> {
  if (IS_SUPPORT_TAB) return { ok: false, error: 'Na entrada do suporte os avisos ficam desligados.' }
  if (isIOS() && !isStandalone()) return { ok: false, error: 'No iPhone, primeiro adicione o Áion à Tela de Início (veja o passo a passo abaixo).' }
  if (!pushSupported()) return { ok: false, error: 'Este navegador não recebe avisos. Use o Chrome, Edge, Firefox ou Safari atualizado.' }
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, error: 'Permissão negada. Libere as notificações deste site nas configurações do navegador.' }
  try {
    const reg = await registration()
    if (!reg) return { ok: false, error: 'Não foi possível preparar os avisos neste navegador.' }
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const { error } = await supabase.rpc('push_register', {
      p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_device: deviceName(),
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha ao ativar os avisos' }
  }
}

export async function disablePush() {
  if (IS_SUPPORT_TAB) return
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.rpc('push_unregister', { p_endpoint: sub.endpoint })
  await sub.unsubscribe().catch(() => {})
}

/** Garante que a inscrição deste aparelho está com a pessoa logada (troca de conta no mesmo navegador). */
export async function syncPushOwner() {
  // Aba do suporte: o aparelho continua avisando quem está logado nas outras abas.
  if (IS_SUPPORT_TAB) return
  try {
    if (!pushSupported() || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    await supabase.rpc('push_register', { p_endpoint: j.endpoint, p_p256dh: j.keys?.p256dh, p_auth: j.keys?.auth, p_device: deviceName() })
  } catch { /* silencioso */ }
}

/** Ao sair da conta: este aparelho para de receber os avisos dessa pessoa (a inscrição do navegador fica, e volta a valer no próximo login). */
export async function unlinkPushOnLogout() {
  if (IS_SUPPORT_TAB) return
  try {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.getRegistration('/')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await supabase.rpc('push_unregister', { p_endpoint: sub.endpoint })
  } catch { /* silencioso */ }
}
