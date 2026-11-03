// Liberar campanha: um só caminho, usado pela lista de escolas e pela aba Campanhas da escola.
// A Áion libera só o ANO LETIVO (target_school_year). As datas começam sugeridas (set/ano anterior a mar/ano)
// e o gestor da escola acerta, junto com a meta, na página Campanha de Matrículas.
import { supabase } from '../../../lib/supabase'
import { toReenrollFraction } from '../../../lib/campaignApply'

export const cycleYear = (c: any): number => c?.target_school_year ?? c?.year

export function suggestedDates(year: number) {
  return { start: `${year - 1}-09-01`, end: `${year}-03-31` }
}

type Args = {
  institutionId: string
  year: number              // ano letivo da campanha (ex.: 2027)
  existing?: any | null     // ciclo já existente desse ano (rascunho/setup), se houver
  userId?: string | null
}

export type ReleaseResult = { ok: true; year: number } | { ok: false; error: string }

export async function releaseCampaignCycle({ institutionId, year, existing, userId }: Args): Promise<ReleaseResult> {
  try {
    if (existing?.status === 'active') return { ok: false, error: `A campanha ${year} já está ativa nesta escola.` }
    if (existing?.status === 'released') return { ok: false, error: `A campanha ${year} já foi liberada para esta escola.` }
    const { start, end } = suggestedDates(year)
    const releasedFields = { status: 'released', released_at: new Date().toISOString(), released_by: userId || null }

    if (existing) {
      const { error } = await supabase.from('campaign_cycles').update({
        ...releasedFields,
        campaign_start_month: existing.start_date ? new Date(existing.start_date + 'T12:00:00').getMonth() + 1 : 9,
        start_date: existing.start_date ?? start, end_date: existing.end_date ?? end,
      }).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('campaign_cycles').insert({
        institution_id: institutionId, ...releasedFields,
        campaign_start_month: 9, year: year - 1, target_school_year: year,
        label: `Campanha ${year}`, start_date: start, end_date: end,
        target_new_students: 0, target_reenrollment_rate: toReenrollFraction(85),
        base_students: 0, monthly_targets: [], market_data: {},
        historical_input: [], generation_mode: 'benchmark',
        ai_reasoning: '', realism_score: 'realistic',
      })
      if (error) throw error
    }

    const { error: notifErr } = await supabase.from('system_notifications').insert({
      institution_id: institutionId,
      title: `Campanha ${year} liberada! 🎉`,
      message: `Sua campanha de matrículas ${year} foi liberada. Abra Campanha de Matrículas para conferir a meta sugerida e ativar.`,
      type: 'info', read: false,
    })
    if (notifErr) console.error('[releaseCampaignCycle] erro ao notificar escola:', notifErr.message)
    return { ok: true, year }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Erro ao liberar campanha.' }
  }
}
