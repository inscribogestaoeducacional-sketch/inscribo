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

// ── Etapas extras ────────────────────────────────────────────────────────────
// O lead continua numa das 7 etapas originais (leads.status). A etapa extra é uma marca
// (leads.custom_stage_id) que só muda onde o lead aparece: logo depois da etapa original.
export interface CustomStage { id: string; label: string; after_stage: string; position: number; active: boolean }
let customStages: CustomStage[] = []

/** Etapas extras ativas, na ordem escolhida pela escola. */
export const getCustomStages = (): CustomStage[] => customStages.filter(c => c.active)
export const getCustomStage = (id?: string | null): CustomStage | undefined => id ? customStages.find(c => c.id === id && c.active) : undefined

export function applyCustomStages(rows: CustomStage[]): boolean {
  const next = [...rows].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
  const changed = JSON.stringify(next) !== JSON.stringify(customStages)
  customStages = next
  return changed
}

/** Extra válida do lead (ativa e ligada à etapa em que ele está), se houver. */
export function leadCustomStage(lead: { status: string; custom_stage_id?: string | null }, statusOverride?: string): CustomStage | undefined {
  const c = getCustomStage(lead.custom_stage_id)
  return c && c.after_stage === (statusOverride ?? lead.status) ? c : undefined
}

/** Chave da coluna do Kanban: 'x:<id>' para etapa extra; a própria etapa para as originais. */
export const customColumnKey = (id: string) => `x:${id}`
export const isCustomColumnKey = (k: string) => k.startsWith('x:')
export function leadColumnKey(lead: { status: string; custom_stage_id?: string | null }, statusOverride?: string): string {
  const c = leadCustomStage(lead, statusOverride)
  return c ? customColumnKey(c.id) : (statusOverride ?? lead.status)
}

/** Colunas na ordem do funil: cada etapa original seguida das suas extras. */
export function stageColumns(): { key: string; status: string; custom?: CustomStage }[] {
  const out: { key: string; status: string; custom?: CustomStage }[] = []
  for (const k of STAGE_KEYS) {
    out.push({ key: k, status: k })
    for (const c of getCustomStages().filter(c => c.after_stage === k)) out.push({ key: customColumnKey(c.id), status: k, custom: c })
  }
  return out
}

/** Nome que a equipe vê para o lead: o da extra, se estiver nela; senão o da etapa original. */
export function leadStageName(lead: { status: string; custom_stage_id?: string | null }): string {
  return leadCustomStage(lead)?.label || stageLabel(lead.status)
}

export async function fetchCustomStages(institutionId: string) {
  const { data, error } = await supabase.from('lead_custom_stages').select('id, label, after_stage, position, active').eq('institution_id', institutionId)
  if (error) throw error
  return (data || []) as CustomStage[]
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
        const [rows, extras] = await Promise.all([fetchStageLabels(institutionId), fetchCustomStages(institutionId).catch(() => [] as CustomStage[])])
        if (!alive) return
        const a = applyStageLabels(rows), b = applyCustomStages(extras)
        if (a || b) { version += 1; setV(version) }
      } catch (e) { console.error('[stageLabels]', e) }
    }
    load()
    window.addEventListener(EVENT, load)
    return () => { alive = false; window.removeEventListener(EVENT, load) }
  }, [institutionId])
  return v
}
