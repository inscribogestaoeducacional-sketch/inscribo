/**
 * Cache simples em memória para evitar recarregamentos
 * desnecessários quando o usuário navega entre páginas.
 */

const cache = new Map<string, { data: any; timestamp: number }>()
const TTL = 30 * 1000 // 30 segundos

export const queryClient = {
  get: (key: string) => {
    const entry = cache.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > TTL) {
      cache.delete(key)
      return null
    }
    return entry.data
  },

  set: (key: string, data: any) => {
    cache.set(key, { data, timestamp: Date.now() })
  },

  invalidate: (key: string) => {
    cache.delete(key)
  },

  invalidateAll: () => {
    cache.clear()
  },

  invalidatePrefix: (prefix: string) => {
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) cache.delete(key)
    }
  }
}
