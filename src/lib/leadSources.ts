// Origens do lead por escola (Configurações > Funil e leads > Origens).
// Sem linhas no banco = a lista padrão de sempre. O sistema usa 4 origens por
// conta própria (WhatsApp, Concurso de Bolsas, Vitrine, Outros): essas não saem.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export const DEFAULT_SOURCES = ['Facebook', 'Instagram', 'Google', 'Site', 'Indicação', 'WhatsApp', 'Concurso de Bolsas', 'Vitrine', 'Outros']
export const RESERVED_SOURCES = ['WhatsApp', 'Concurso de Bolsas', 'Vitrine', 'Outros']

export interface LeadSourceRow { id: string; institution_id: string; name: string; active: boolean; sort_order: number }

const CHANGED = 'aion:lead-sources-changed'
export const notifyLeadSourcesChanged = () => window.dispatchEvent(new Event(CHANGED))

/** Linhas da escola; sem nenhuma, devolve a lista padrão (sem id: ainda não gravada). */
export function useLeadSources(institutionId: string | undefined | null) {
  const [rows, setRows] = useState<LeadSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(async () => {
    if (!institutionId) { setRows([]); setLoading(false); return }
    const { data, error } = await supabase.from('lead_source_options')
      .select('id, institution_id, name, active, sort_order').eq('institution_id', institutionId).order('sort_order', { ascending: true })
    if (error) console.error('[useLeadSources]', error.message)
    setRows((data as LeadSourceRow[]) ?? [])
    setLoading(false)
  }, [institutionId])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { window.addEventListener(CHANGED, reload); return () => window.removeEventListener(CHANGED, reload) }, [reload])

  const configured = rows.length > 0
  const sources = configured ? rows.filter(r => r.active).map(r => r.name) : DEFAULT_SOURCES
  return { rows, configured, sources, loading, reload }
}

/** Lista para um select: as ativas e, se preciso, a origem que o lead já tem. */
export const withCurrent = (sources: string[], current?: string | null) =>
  current && !sources.includes(current) ? [...sources, current] : sources
