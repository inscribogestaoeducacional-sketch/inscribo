import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Séries/etapas de ensino configuráveis por escola (school_grade_levels) —
// antes hardcoded em ~10 arquivos, com duas listas divergentes dentro do
// próprio LeadKanban.tsx (uma pra salvar, outra pro filtro). Toda escola já
// nasce com a lista padrão (seed automático via trigger, ver migration
// 20260812000200_school_grade_levels.sql); o gestor pode editar/reordenar em
// Configurações → Escola.
export interface GradeLevel {
  id: string
  institution_id: string
  name: string
  sort_order: number
}

export function useGradeLevels(institutionId: string | undefined | null) {
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!institutionId) { setGradeLevels([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('school_grade_levels')
      .select('id, institution_id, name, sort_order')
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true })
    if (error) console.error('[useGradeLevels] erro ao carregar séries:', error)
    setGradeLevels((data as GradeLevel[]) ?? [])
    setLoading(false)
  }, [institutionId])

  useEffect(() => { reload() }, [reload])

  // Atalho pro caso comum (select/filtro só precisa dos nomes, na ordem certa).
  const names = gradeLevels.map(g => g.name)

  return { gradeLevels, names, loading, reload }
}
