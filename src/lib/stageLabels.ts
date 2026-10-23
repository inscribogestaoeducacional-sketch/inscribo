// Nomes das etapas do funil, por escola. Só o NOME muda: as etapas (new, contact…) e a
// lógica do funil continuam as mesmas. Sem nome próprio, vale o padrão do sistema.
// Os nomes próprios são aplicados sobre statusConfig (fonte única das telas) assim que
// carregam, então Kanban, formulário, contatos e relatórios passam a mostrar o nome novo.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { statusConfig, LEAD_STAGES } from '../components/leads/leadFormShared'

export const STAGE_KEYS = ['new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled', 'lost'] as const
export type StageKey = typeof STAGE_KEYS[number]

const DEFAULT_LABEL: Record<string, string> = Object.fromEntries(STAGE_KEYS.map(k => [k, statusConfig[k].label]))
const DEFAULT_SHORT: Record<string, string> = Object.fromEntries(LEAD_STAGES.map(s => [s.key, s.label]))
let custom: Record<string, string> = {}
let version = 0
const EVENT = 'stage-labels-changed'

export const defaultStageLabel = (k: string) => DEFAULT_LABEL[k] ?? k

/** Nome atual da etapa: o da escola, se houver; senão o `fallback` informado ou o padrão. */
export function stageLabel(key: string, fallback?: string): string {
  return custom[key] || fallback || DEFAULT_LABEL[key] || key
}

/** Aplica os nomes da escola (ou volta ao padrão) sobre as telas. Devolve true se algo mudou. */
export function applyStageLabels(rows: { stage: string; label: string | null }[]): boolean {
  const next: Record<string, string> = {}
  rows.forEach(r => { if (r.label && r.label.trim()) next[r.stage] = r.label.trim() })
  const changed = JSON.stringify(next) !== JSON.stringify(custom)
  custom = next
  for (const k of STAGE_KEYS) (statusConfig as any)[k].label = next[k] || DEFAULT_LABEL[k]
  for (const s of LEAD_STAGES as unknown as { key: string; label: string }[]) s.label = next[s.key] ? next[s.key].slice(0, 10) : DEFAULT_SHORT[s.key]
  return changed
}

export function notifyStageLabelsChanged() { window.dispatchEvent(new Event(EVENT)) }

export async function fetchStageLabels(institutionId: string) {
  const { data, error } = await supabase.from('lead_stage_labels').select('stage, label').eq('institution_id', institutionId)
  if (error) throw error
  return (data || []) as { stage: string; label: string | null }[]
}

/** Carrega os nomes da escola, aplica e devolve um número que muda quando eles mudam
 *  (use como `key` para redesenhar as telas já abertas). */
export function useStageLabelsVersion(institutionId: string | null | undefined): number {
  const [v, setV] = useState(version)
  useEffect(() => {
    if (!institutionId) return
    let alive = true
    const load = async () => {
      try {
        const rows = await fetchStageLabels(institutionId)
        if (alive && applyStageLabels(rows)) { version += 1; setV(version) }
      } catch (e) { console.error('[stageLabels]', e) }
    }
    load()
    window.addEventListener(EVENT, load)
    return () => { alive = false; window.removeEventListener(EVENT, load) }
  }, [institutionId])
  return v
}
