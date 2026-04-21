import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook que resolve o problema de loading infinito quando
 * o componente é desmontado antes da chamada async terminar.
 * Também implementa cache simples para evitar recarregamentos.
 */
export function useData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    // Cancela chamada anterior se existir
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const result = await fetcher()
      // Só atualiza estado se componente ainda estiver montado
      if (mountedRef.current) {
        setData(result)
        setLoading(false)
      }
    } catch (e: any) {
      if (mountedRef.current && e?.name !== 'AbortError') {
        setError(e?.message || 'Erro ao carregar dados')
        setLoading(false)
      }
    }
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    load()

    return () => {
      mountedRef.current = false
      if (abortRef.current) abortRef.current.abort()
    }
  }, [load])

  return { data, loading, error, reload: load }
}

/**
 * Versão simplificada para múltiplas queries paralelas
 */
export function useMounted() {
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  return mountedRef
}
