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
  active?: boolean
}

// Séries desativadas (active=false) ficam de fora de formulários e filtros; só o editor de
// Configurações pede includeInactive para poder reativá-las.
export function useGradeLevels(institutionId: string | undefined | null, opts?: { includeInactive?: boolean }) {
  const includeInactive = !!opts?.includeInactive
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!institutionId) { setGradeLevels([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('school_grade_levels')
      .select('id, institution_id, name, sort_order, active')
      .eq('institution_id', institutionId)
      .order('sort_order', { ascending: true })
    if (error) console.error('[useGradeLevels] erro ao carregar séries:', error)
    const all = (data as GradeLevel[]) ?? []
    setGradeLevels(includeInactive ? all : all.filter(g => g.active !== false))
    setLoading(false)
  }, [institutionId, includeInactive])

  useEffect(() => { reload() }, [reload])

  // Atalho pro caso comum (select/filtro só precisa dos nomes, na ordem certa).
  const names = gradeLevels.map(g => g.name)

  return { gradeLevels, names, loading, reload }
}
