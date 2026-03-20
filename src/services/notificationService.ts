import { supabase } from '../lib/supabase'

export async function checkWeeklyAlerts(institutionId: string) {
  try {
    await _checkWeeklyAlerts(institutionId)
  } catch (err) {
    console.warn('checkWeeklyAlerts indisponível (tabela não existe?):', err)
  }
}

async function _checkWeeklyAlerts(institutionId: string) {
  const { data: cycle } = await supabase
    .from('campaign_cycles')
    .select('*')
    .eq('institution_id', institutionId)
    .eq('year', new Date().getFullYear())
    .maybeSingle()

  if (!cycle?.applied_at) {
    await createNotificationIfNew(institutionId, 'suggestion', {
      title: 'Configure sua campanha de matrículas',
      message: 'Gere um plano inteligente com metas baseadas no mercado da sua cidade.',
      severity: 'warning',
      action_url: '/reports'
    })
    return
  }

  const { data: metrics } = await supabase
    .from('funnel_metrics')
    .select('*')
    .eq('institution_id', institutionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!metrics) return

  const threshold = 15

  const phases = [
    { key: 'registrations', label: 'Cadastros' },
    { key: 'schedules', label: 'Agendas' },
    { key: 'visits', label: 'Visitas' },
    { key: 'enrollments', label: 'Matrículas' }
  ]

  for (const phase of phases) {
    const actual = (metrics as Record<string, number>)[phase.key] || 0
    const target = (metrics as Record<string, number>)[`${phase.key}_target`] || 0
    if (target === 0) continue

    const deviation = ((actual - target) / target) * 100

    if (deviation < -threshold) {
      await createNotificationIfNew(institutionId, 'goal_deviation', {
        title: `${phase.label} ${Math.abs(Math.round(deviation))}% abaixo da meta`,
        message: `Você tem ${actual} ${phase.label.toLowerCase()} vs meta de ${target}. Período: ${(metrics as Record<string, string>).period}.`,
        severity: Math.abs(deviation) > 30 ? 'danger' : 'warning',
        action_url: '/reports'
      })
    } else if (deviation > threshold) {
      await createNotificationIfNew(institutionId, 'milestone', {
        title: `${phase.label} acima da meta! 🎉`,
        message: `Parabéns! ${actual} ${phase.label.toLowerCase()} vs meta de ${target}. +${Math.round(deviation)}%`,
        severity: 'success',
        action_url: '/reports'
      })
    }
  }
}

async function createNotificationIfNew(
  institutionId: string,
  type: string,
  data: { title: string; message: string; severity: string; action_url?: string }
) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const { data: existing, error } = await supabase
      .from('system_notifications')
      .select('id')
      .eq('institution_id', institutionId)
      .eq('title', data.title)
      .gte('created_at', `${today}T00:00:00`)
      .limit(1)

    if (error && (error as { code?: string }).code === '42P01') return
    if (existing && existing.length > 0) return

    await supabase.from('system_notifications').insert({
      institution_id: institutionId,
      type,
      ...data
    })
  } catch (err) {
    console.warn('Não foi possível criar notificação (tabela não existe?):', err)
  }
}
