// Fase 0A — baixa de visita num lugar só (tela Visitas, Kanban, modal do
// lead, Hub). Regra aprovada: visita só conta como realizada com baixa.
//
// O banco (gatilho visits_before_write) grava outcome_at/outcome_by e o
// responsável (quem agendou) quando o front não informa; o histórico de
// status do lead é gravado pelo gatilho de leads.
import { supabase, DatabaseService, type Visit } from './supabase'
import { logAudit } from '../hooks/useAudit'

export type VisitOutcome = 'completed' | 'no_show' | 'cancelled'

export const VISIT_OUTCOME_LABEL: Record<VisitOutcome, string> = {
  completed: 'Aconteceu',
  no_show: 'Faltou',
  cancelled: 'Cancelada',
}

export interface PendingVisit {
  id: string
  lead_id: string | null
  scheduled_date: string
  student_name?: string | null
}

// Mesmo intervalo do gatilho no banco: até 60 dias pra trás, até 18 meses pra frente.
export function visitDateError(date: Date): string | null {
  if (isNaN(date.getTime())) return 'Data da visita inválida.'
  const now = Date.now()
  if (date.getTime() < now - 60 * 86400000) return `Data da visita muito no passado (${date.toLocaleDateString('pt-BR')}). Confira o ano.`
  const max = new Date(); max.setMonth(max.getMonth() + 18)
  if (date.getTime() > max.getTime()) return `Data da visita muito no futuro (${date.toLocaleDateString('pt-BR')}). Confira o ano.`
  return null
}

// Ordem do funil — agendar/dar baixa só AVANÇA o lead, nunca faz voltar
// (antes, agendar visita pra um lead em proposta o devolvia pra 'scheduled').
const STAGE_ORDER = ['new', 'contact', 'scheduled', 'visit', 'proposal', 'enrolled']

/** Move o lead pra `target` só se ele estiver numa etapa anterior (perdido não mexe). */
export async function advanceLeadTo(leadId: string, target: 'scheduled' | 'visit'): Promise<string | null> {
  const { data } = await supabase.from('leads').select('status').eq('id', leadId).maybeSingle()
  const cur = (data as { status: string } | null)?.status
  if (!cur || cur === 'lost') return cur ?? null
  if (STAGE_ORDER.indexOf(cur) < STAGE_ORDER.indexOf(target)) {
    await DatabaseService.updateLead(leadId, { status: target })
    return target
  }
  return cur
}

export function isPastVisit(v: { scheduled_date: string }): boolean {
  return new Date(v.scheduled_date).getTime() < Date.now()
}

/** Visitas ainda sem baixa (status 'scheduled'), agrupadas por lead. */
export async function fetchPendingVisitsByLead(institutionId: string): Promise<Map<string, PendingVisit[]>> {
  const { data, error } = await supabase
    .from('visits')
    .select('id, lead_id, scheduled_date, student_name')
    .eq('institution_id', institutionId)
    .eq('status', 'scheduled')
    .order('scheduled_date', { ascending: true })
  if (error) { console.error('[visitOutcome] pendentes:', error); return new Map() }
  const map = new Map<string, PendingVisit[]>()
  for (const v of (data ?? []) as PendingVisit[]) {
    if (!v.lead_id) continue
    const list = map.get(v.lead_id) ?? []
    list.push(v)
    map.set(v.lead_id, list)
  }
  return map
}

export async function setVisitOutcome(params: {
  visit: { id: string; lead_id?: string | null }
  outcome: VisitOutcome
  notes?: string
  user: { id: string; full_name: string; role: string; institution_id: string }
  /** true = se "aconteceu" e o lead ainda está antes da visita, avança pra 'visit' */
  advanceLead?: boolean
}): Promise<void> {
  const { visit, outcome, notes, user, advanceLead = true } = params
  await DatabaseService.updateVisit(visit.id, { status: outcome, ...(notes ? { notes } : {}) } as Partial<Visit>)
  await logAudit({
    institution_id: user.institution_id, module: 'visits', record_id: visit.id,
    action: outcome === 'cancelled' ? 'deleted' : 'status_changed',
    old_value: 'scheduled', new_value: outcome,
    user_id: user.id, user_name: user.full_name, user_role: user.role,
  })
  if (outcome === 'completed' && advanceLead && visit.lead_id) {
    await advanceLeadTo(visit.lead_id, 'visit')
  }
}
