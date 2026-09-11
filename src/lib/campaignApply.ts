// src/lib/campaignApply.ts
//
// Lógica de gravação de um plano de campanha — extraída de
// CampaignGeneratorModal.tsx (applyCampaign) pra ser reaproveitada também
// pela aprovação de um pedido de ajuste (InstitutionDetails.tsx, aba
// Campanhas). Mesmos campos, mesmas colunas, mesmo onConflict de sempre —
// extração pura, sem mudança de comportamento pro fluxo já em produção.
import { supabase } from './supabase'

// campaign_cycles.target_reenrollment_rate é sempre fração 0-1 (é o que
// GestorReports.tsx:887 — `cycle.target_reenrollment_rate * 100` — e o
// prompt da IA em api/ai.ts:538 — `avgReenrollRate.toFixed(3)` — já esperam).
// Bug real encontrado: InstitutionDetails.tsx e AdminSchools.tsx gravavam
// 85 (escala 0-100) direto nos ciclos criados manualmente pelo admin, antes
// do gestor rodar o wizard — isso aparecia como "8500%" de meta de
// rematrícula na tela do gestor. Centraliza a normalização aqui pra um
// futuro escritor não repetir o erro: aceita tanto uma fração já correta
// (0.85) quanto um valor escrito por engano em escala 0-100 (85) e sempre
// devolve fração.
export function toReenrollFraction(value: number): number {
  if (value == null || isNaN(value)) return value
  return value > 1 ? value / 100 : value
}

export interface MonthlyTargetInput {
  month: string | number
  year: number
  registrations: number
  schedules: number
  visits: number
  enrollments_new?: number
  enrollments_returning?: number
  cpa_target: number
}

export interface CampaignCycleData {
  id?: string
  institution_id: string
  year: number
  label: string
  start_date: string
  end_date: string
  target_new_students: number
  target_reenrollment_rate: number
  base_students: number
  projected_cpa: number
  monthly_targets: MonthlyTargetInput[]
  market_data: Record<string, unknown>
  historical_data: unknown[]
  generation_mode: string
  ai_reasoning: string
  realism_score: string
  applied_at: string
}

// Gera a lista de meses (com period "YYYY-MM") entre duas datas — mesma
// função que já vivia em CampaignGeneratorModal.tsx, movida pra cá como
// fonte única (o componente agora importa daqui em vez de ter cópia própria).
export function getCampaignMonths(startDate: string, endDate: string) {
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const months: { label: string; month: number; year: number; period: string }[] = []
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const cur = new Date(start)
  while (cur <= end && months.length < 24) {
    months.push({ label: `${names[cur.getMonth()]}/${cur.getFullYear()}`, month: cur.getMonth() + 1, year: cur.getFullYear(), period: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}` })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

export interface ApplyCampaignCycleParams {
  institutionId: string
  cycleData: CampaignCycleData
  campaignStartMonthNum: number
  schoolDataSnapshot: Record<string, unknown>
  erpFiles: unknown[]
  currentStudents: number
  // Se informado, atualiza esse ciclo diretamente por id (caso da aprovação
  // de um ajuste, onde já se sabe exatamente qual campaign_cycle_id é o
  // alvo). Se ausente, mantém a busca por status='released' que o fluxo
  // normal (gestor aplicando pela primeira vez) já usa hoje.
  cycleId?: string
}

export async function applyCampaignCycle(params: ApplyCampaignCycleParams): Promise<{ cycleId: string }> {
  const { institutionId, cycleData, campaignStartMonthNum, schoolDataSnapshot, erpFiles, currentStudents } = params

  const cyclePayload = {
    ...cycleData,
    status: 'active',
    campaign_start_month: campaignStartMonthNum,
    school_data: schoolDataSnapshot,
    erp_files: erpFiles,
  }

  let cycleId = params.cycleId
  if (cycleId) {
    const { error } = await supabase.from('campaign_cycles').update(cyclePayload).eq('id', cycleId)
    if (error) throw error
  } else {
    const { data: existingCycle, error: findErr } = await supabase
      .from('campaign_cycles')
      .select('id')
      .eq('institution_id', institutionId)
      .in('status', ['released'])
      .order('created_at', { ascending: false })
      .maybeSingle()
    if (findErr) throw findErr

    if (existingCycle) {
      const { error } = await supabase.from('campaign_cycles').update(cyclePayload).eq('id', existingCycle.id)
      if (error) throw error
      cycleId = existingCycle.id
    } else {
      const { data: created, error } = await supabase.from('campaign_cycles').insert(cyclePayload).select('id').single()
      if (error) throw error
      cycleId = created.id
    }
  }

  const campaignMonths = getCampaignMonths(cycleData.start_date, cycleData.end_date)
  for (let mi = 0; mi < cycleData.monthly_targets.length; mi++) {
    const month = cycleData.monthly_targets[mi]
    const cm = campaignMonths[mi]
    const period = cm ? cm.period : `${month.year}-${String(month.month).padStart(2, '0')}`
    // Só as colunas de META entram no payload — nunca os contadores reais
    // (registrations/schedules/visits/enrollments sem sufixo _target,
    // confirmed, investment, leads_generated), que representam fatos já
    // ocorridos. Omitir essas chaves faz o upsert preservá-las quando a
    // linha já existe (Prefer: resolution=merge-duplicates só atualiza o
    // que está no payload).
    const { error: fmErr } = await supabase.from('funnel_metrics').upsert(
      { institution_id: institutionId, period, registrations_target: month.registrations, schedules_target: month.schedules, visits_target: month.visits, enrollments_target: month.enrollments_new ?? 0 },
      { onConflict: 'period,institution_id', ignoreDuplicates: false }
    )
    if (fmErr) throw fmErr

    if ((month.enrollments_returning ?? 0) > 0) {
      const { error: mrErr } = await supabase.from('monthly_reenrollments').upsert(
        { institution_id: institutionId, period, target: month.enrollments_returning ?? 0, base_total: currentStudents },
        { onConflict: 'institution_id,period', ignoreDuplicates: false }
      )
      if (mrErr) throw mrErr
    }

    const { error: mcErr } = await supabase.from('marketing_campaigns').upsert(
      { institution_id: institutionId, month_year: cm ? `${cm.month}-${cm.year}` : `${month.month}-${month.year}`, cpa_target: month.cpa_target },
      { onConflict: 'month_year,institution_id', ignoreDuplicates: false }
    )
    if (mcErr) throw mcErr
  }

  return { cycleId: cycleId! }
}
