// src/lib/baseModule.ts
//
// Módulo "Base de alunos" liberado por escola pelo Super Admin
// (student_base_settings.module_enabled — mesmo mecanismo das Transmissões).
// Sem ele a escola não vê "Matrículas › Base de alunos" nem o envio do
// relatório; o banco também recusa (base_require_module).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useBaseModuleEnabled(institutionId: string | null | undefined): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!institutionId) { setEnabled(false); return }
    let alive = true
    setEnabled(null)
    supabase.rpc('base_module_enabled', { p_institution_id: institutionId })
      .then(({ data, error }) => { if (alive) setEnabled(!error && data === true) })
    return () => { alive = false }
  }, [institutionId])
  return enabled
}
