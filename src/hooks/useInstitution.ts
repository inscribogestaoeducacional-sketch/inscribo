import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'

/**
 * Hook com cache para dados da instituição.
 * Evita recarregamentos desnecessários ao navegar entre páginas.
 */
export function useInstitution(institutionId: string) {
  const [institution, setInstitution] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [institutionId])

  const load = async (forceRefresh = false) => {
    if (!institutionId) { setLoading(false); return }

    const cacheKey = `institution:${institutionId}`

    // Usa cache se disponível e não forçar refresh
    if (!forceRefresh) {
      const cached = queryClient.get(cacheKey)
      if (cached) {
        if (mountedRef.current) {
          setInstitution(cached)
          setLoading(false)
        }
        // Recarrega em background
        loadFromDB(institutionId, cacheKey)
        return
      }
    }

    setLoading(true)
    await loadFromDB(institutionId, cacheKey)
  }

  const loadFromDB = async (id: string, cacheKey: string) => {
    try {
      const { data } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', id)
        .single()

      if (data) {
        queryClient.set(cacheKey, data)
        if (mountedRef.current) {
          setInstitution(data)
          setLoading(false)
        }
      }
    } catch (e) {
      if (mountedRef.current) setLoading(false)
    }
  }

  const refresh = () => {
    queryClient.invalidate(`institution:${institutionId}`)
    load(true)
  }

  return { institution, loading, refresh }
}
