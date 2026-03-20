import { supabase } from '../lib/supabase'

export async function checkRecalibration(institutionId: string) {
  const now = new Date()
  const monthKey = `recalibration_${now.getFullYear()}_${now.getMonth()}`
  if (localStorage.getItem(monthKey)) return

  const { data: cycle } = await supabase
    .from('campaign_cycles')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('year', now.getFullYear())
    .eq('generation_mode', 'benchmark')
    .not('applied_at', 'is', null)
    .maybeSingle()

  if (!cycle) return

  const daysSinceApply = Math.floor(
    (Date.now() - new Date(cycle.applied_at).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceApply < 60) return

  const { count } = await supabase
    .from('funnel_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('institution_id', institutionId)
    .gt('registrations', 0)

  if (!count || count < 3) return

  const today = now.toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('system_notifications')
    .select('id')
    .eq('institution_id', institutionId)
    .eq('title', 'Suas metas podem ser mais precisas agora')
    .gte('created_at', `${today}T00:00:00`)
    .limit(1)

  if (existing && existing.length > 0) {
    localStorage.setItem(monthKey, '1')
    return
  }

  await supabase.from('system_notifications').insert({
    institution_id: institutionId,
    type: 'suggestion',
    severity: 'info',
    title: 'Suas metas podem ser mais precisas agora',
    message: `Com ${count} meses de dados reais, a IA pode recalibrar suas metas com muito mais precisão. Clique para regerar a campanha.`,
    action_url: '/reports?recalibrate=true'
  })

  localStorage.setItem(monthKey, '1')
}
