// src/lib/leadUnits.ts
//
// Campo de unidade do lead — OPCIONAL, por escola (migration
// 20261008120000_lead_unidade.sql). Não confundir com a "unidade" de rede de
// escolas (school_groups): aqui é só uma etiqueta no lead.
//
//   lead_unit_settings  liga/desliga + rótulo (Unidade, Campus, Polo...)
//   lead_units          opções da escola (ativar/desativar)
//   leads.unit_id       nullable; a conversa mostra a do lead vinculado
//
// Escola sem linha em lead_unit_settings (ou com enabled=false) não vê nada
// novo: `enabled` volta false e as telas não renderizam o campo.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export interface LeadUnit {
  id: string
  institution_id: string
  name: string
  active: boolean
  sort_order: number
}

export interface LeadUnitConfig {
  enabled: boolean
  label: string
  units: LeadUnit[]        // todas, inclusive desativadas (pra nomear lead antigo)
  activeUnits: LeadUnit[]  // só as que podem ser escolhidas
  loading: boolean
  reload: () => Promise<void>
  unitName: (id: string | null | undefined) => string | null
}

export const DEFAULT_UNIT_LABEL = 'Unidade'
// Valores do filtro "Unidade: Todas / A / B / Sem unidade".
export const UNIT_FILTER_ALL = 'all'
export const UNIT_FILTER_NONE = 'none'

// Telas diferentes da mesma escola (Configurações, Kanban, Hub) recarregam
// juntas quando a configuração muda — sem isso, ligar o campo em
// Configurações só apareceria no Kanban depois de um reload da página.
const CHANGED_EVENT = 'lead-units-changed'
export function notifyLeadUnitsChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT))
}

export function useLeadUnits(institutionId: string | undefined | null): LeadUnitConfig {
  const [enabled, setEnabled] = useState(false)
  const [label, setLabel] = useState(DEFAULT_UNIT_LABEL)
  const [units, setUnits] = useState<LeadUnit[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!institutionId) { setEnabled(false); setUnits([]); setLoading(false); return }
    setLoading(true)
    const [{ data: cfg, error: cfgErr }, { data: rows, error: rowsErr }] = await Promise.all([
      supabase.from('lead_unit_settings').select('enabled, label').eq('institution_id', institutionId).maybeSingle(),
      supabase.from('lead_units').select('id, institution_id, name, active, sort_order')
        .eq('institution_id', institutionId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ])
    // Erro (ex.: tabela ainda não existe) = campo desligado, nunca quebra a tela.
    if (cfgErr) console.warn('[useLeadUnits] configuração indisponível:', cfgErr.message)
    if (rowsErr) console.warn('[useLeadUnits] opções indisponíveis:', rowsErr.message)
    setEnabled(!cfgErr && !!cfg?.enabled)
    setLabel(cfg?.label?.trim() || DEFAULT_UNIT_LABEL)
    setUnits(rowsErr ? [] : ((rows as LeadUnit[]) ?? []))
    setLoading(false)
  }, [institutionId])

  useEffect(() => { reload() }, [reload])
  useEffect(() => {
    const handler = () => { reload() }
    window.addEventListener(CHANGED_EVENT, handler)
    return () => window.removeEventListener(CHANGED_EVENT, handler)
  }, [reload])

  const unitName = useCallback(
    (id: string | null | undefined) => (id ? units.find(u => u.id === id)?.name ?? null : null),
    [units],
  )

  return { enabled, label, units, activeUnits: units.filter(u => u.active), loading, reload, unitName }
}

// Opções do select de um lead: as ativas + a atual, se estiver desativada
// (senão o select mostraria vazio e, ao salvar, apagaria a unidade do lead).
export function unitOptionsFor(cfg: Pick<LeadUnitConfig, 'units' | 'activeUnits'>, currentId: string | null | undefined): LeadUnit[] {
  if (!currentId || cfg.activeUnits.some(u => u.id === currentId)) return cfg.activeUnits
  const current = cfg.units.find(u => u.id === currentId)
  return current ? [...cfg.activeUnits, current] : cfg.activeUnits
}

// Filtro "Unidade" compartilhado (Kanban, lista mobile e, na 5B, Hub).
export function matchesUnitFilter(unitId: string | null | undefined, filter: string): boolean {
  if (filter === UNIT_FILTER_ALL) return true
  if (filter === UNIT_FILTER_NONE) return !unitId
  return unitId === filter
}
