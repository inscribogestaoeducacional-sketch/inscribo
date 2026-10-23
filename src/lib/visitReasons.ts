// Motivos de a visita não ter acontecido. A escola pode editar a lista
// (tabela visit_reasons); sem nada cadastrado valem os padrões abaixo.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type ReasonKind = 'no_show' | 'cancelled'

export const DEFAULT_REASONS: Record<ReasonKind, string[]> = {
  no_show: ['Não avisou', 'Imprevisto da família', 'Esqueceu a visita', 'Escolheu outra escola', 'Pediu para remarcar'],
  cancelled: ['Família desistiu', 'Escolheu outra escola', 'Pediu para remarcar', 'Escola precisou cancelar', 'Agendada por engano'],
}

export interface ReasonRow { id: string; kind: ReasonKind; label: string; sort_order: number; active: boolean }

export function useVisitReasons(institutionId: string | null | undefined) {
  const [rows, setRows] = useState<ReasonRow[]>([])
  const refresh = useCallback(async () => {
    if (!institutionId) return
    const { data } = await supabase.from('visit_reasons').select('id, kind, label, sort_order, active')
      .eq('institution_id', institutionId).order('sort_order').order('created_at')
    setRows((data ?? []) as ReasonRow[])
  }, [institutionId])
  useEffect(() => { refresh() }, [refresh])

  const labelsFor = useCallback((kind: ReasonKind): string[] => {
    const custom = rows.filter(r => r.kind === kind)
    // Se a escola já cadastrou algum motivo desse tipo, vale só o que ela tem (ativo).
    return custom.length > 0 ? custom.filter(r => r.active).map(r => r.label) : DEFAULT_REASONS[kind]
  }, [rows])

  return { rows, labelsFor, refresh }
}
