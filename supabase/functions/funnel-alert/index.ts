// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Mesmos rótulos usados na tela de Relatórios (GestorReports.tsx) — mantém a
// notificação consistente com o que o gestor já vê lá.
const METRIC_LABELS: Record<string, string> = {
  registrations: 'Cadastros',
  schedules:     'Agendamentos',
  visits:        'Visitas',
  enrollments:   'Matrículas',
}
const METRIC_KEYS = ['registrations', 'schedules', 'visits', 'enrollments'] as const

const UNDERPERFORM_THRESHOLD = 0.6

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: institutions } = await supabase
    .from('institutions')
    .select('id, name')
    .eq('plan_status', 'active')

  if (!institutions?.length) return new Response('no institutions', { status: 200 })

  // funnel_metrics não tem mais goal/actual/stage — o schema real (desde a
  // reforma do módulo de Leads) é 4 pares *_target/*_actual em colunas fixas
  // (registrations/schedules/visits/enrollments), uma linha por instituição
  // por mês. O mês é identificado pela coluna `period` ('YYYY-MM', mesmo
  // formato que já era usado aqui) — a UNIQUE constraint real da tabela é
  // (period, institution_id), não (year, month): as colunas year/month/
  // month_name existem mas estão sempre NULL em todas as linhas de produção
  // (confirmado por amostragem antes de escrever este arquivo); period é a
  // chave de fato usada por quem grava a tabela (GestorReports.tsx e afins).
  const currentPeriod = new Date().toISOString().slice(0, 7) // YYYY-MM

  const results = await Promise.allSettled(
    institutions.map(async (inst: { id: string; name: string }) => {
      const { data: row, error } = await supabase
        .from('funnel_metrics')
        .select('registrations, registrations_target, schedules, schedules_target, visits, visits_target, enrollments, enrollments_target')
        .eq('institution_id', inst.id)
        .eq('period', currentPeriod)
        .maybeSingle()

      if (error) throw error
      if (!row) return // sem linha de meta cadastrada pro mês corrente — nada a avaliar

      const underperforming = METRIC_KEYS
        .map(key => {
          const actual = row[key] ?? 0
          const target = row[`${key}_target`] ?? 0
          // Meta zerada/não definida: mesmo critério do código original
          // (`if (!m.goal || m.goal === 0) return false`) — sem meta não dá
          // pra calcular % nem faz sentido alertar.
          if (!target) return null
          const ratio = actual / target
          if (ratio >= UNDERPERFORM_THRESHOLD) return null
          return { key, pct: Math.round(ratio * 100) }
        })
        .filter((m): m is { key: string; pct: number } => m !== null)

      if (underperforming.length === 0) return

      const stageList = underperforming
        .map(m => `${METRIC_LABELS[m.key] ?? m.key} (${m.pct}% da meta)`)
        .join(', ')

      const { error: insertErr } = await supabase.from('system_notifications').insert({
        institution_id: inst.id,
        type: 'goal_deviation',
        title: 'Alerta de funil abaixo da meta',
        message: `Etapas com menos de ${Math.round(UNDERPERFORM_THRESHOLD * 100)}% da meta: ${stageList}`,
        severity: 'warning',
        action_url: null,
        created_at: new Date().toISOString(),
      })
      if (insertErr) throw insertErr
    })
  )

  const failed = results.filter(r => r.status === 'rejected').length
  return new Response(JSON.stringify({ processed: institutions.length, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
