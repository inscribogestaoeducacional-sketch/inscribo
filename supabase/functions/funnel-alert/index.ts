// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  const { data: institutions } = await supabase
    .from('institutions')
    .select('id, name')
    .eq('plan_status', 'active')

  if (!institutions?.length) return new Response('no institutions', { status: 200 })

  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const results = await Promise.allSettled(
    institutions.map(async (inst: { id: string; name: string }) => {
      const { data: metrics } = await supabase
        .from('funnel_metrics')
        .select('goal, actual, stage')
        .eq('institution_id', inst.id)
        .eq('month', currentMonth)

      if (!metrics?.length) return

      const underperforming = metrics.filter(m => {
        if (!m.goal || m.goal === 0) return false
        return (m.actual / m.goal) < 0.6
      })

      if (underperforming.length === 0) return

      const stageLabels: Record<string, string> = {
        new: 'Novos leads',
        contact: 'Em contato',
        visit: 'Visitas',
        proposal: 'Proposta',
        enrolled: 'Matrículas',
      }

      const stageList = underperforming
        .map(m => {
          const pct = m.goal > 0 ? Math.round((m.actual / m.goal) * 100) : 0
          const label = stageLabels[m.stage] ?? m.stage
          return `${label} (${pct}% da meta)`
        })
        .join(', ')

      await supabase.from('system_notifications').insert({
        institution_id: inst.id,
        type: 'goal_deviation',
        title: 'Alerta de funil abaixo da meta',
        message: `Etapas com menos de 60% da meta: ${stageList}`,
        severity: 'warning',
        action_url: null,
        created_at: new Date().toISOString(),
      })
    })
  )

  const failed = results.filter(r => r.status === 'rejected').length
  return new Response(JSON.stringify({ processed: institutions.length, failed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
