/* Áion Edu — service worker só para avisos (Web Push).
   Não guarda páginas em cache: o app sempre carrega a versão mais nova. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

const IOS = /iPhone|iPad|iPod/.test(self.navigator.userAgent)

self.addEventListener('push', (event) => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch (_) { d = { title: 'Áion Edu', body: event.data ? event.data.text() : '' } }
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const focused = list.find((c) => c.focused && c.visibilityState === 'visible')
    // Com o painel aberto na frente, o próprio app mostra o aviso (toast/som).
    // No iPhone o sistema exige mostrar sempre, então lá mostramos de qualquer jeito.
    if (focused && !IOS) { focused.postMessage({ type: 'aion-push', data: d }); return }
    await self.registration.showNotification(d.title || 'Áion Edu', {
      body: d.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url: d.url || '/whatsapp', id: d.id || null },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const target = new URL((data.url || '/whatsapp') + (data.id ? '#aviso=' + data.id : ''), self.location.origin).href
  event.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const same = list.find((c) => new URL(c.url).origin === self.location.origin)
    if (same) {
      await same.focus()
      same.postMessage({ type: 'aion-open', url: data.url || '/whatsapp', id: data.id || null })
      return
    }
    await self.clients.openWindow(target)
  })())
})
