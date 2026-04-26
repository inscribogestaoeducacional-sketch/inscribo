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

  const results = await Promise.allSettled(
    institutions.map(async (inst: { id: string; name: string }) => {
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

      const [leadsRes, enrolledRes, transfersRes] = await Promise.all([
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('institution_id', inst.id)
          .gte('created_at', startOfDay),
        supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('institution_id', inst.id)
          .eq('status', 'enrolled')
          .gte('updated_at', startOfDay),
        supabase.from('transfer_requests').select('id', { count: 'exact', head: true })
          .eq('institution_id', inst.id)
          .eq('status', 'pending'),
      ])

      const newLeads = leadsRes.count ?? 0
      const newEnrolled = enrolledRes.count ?? 0
      const pendingTransfers = transfersRes.count ?? 0

      const parts: string[] = []
      if (newLeads > 0) parts.push(`${newLeads} novo${newLeads > 1 ? 's' : ''} lead${newLeads > 1 ? 's' : ''}`)
      if (newEnrolled > 0) parts.push(`${newEnrolled} matrícula${newEnrolled > 1 ? 's' : ''} confirmada${newEnrolled > 1 ? 's' : ''}`)
      if (pendingTransfers > 0) parts.push(`${pendingTransfers} transferência${pendingTransfers > 1 ? 's' : ''} pendente${pendingTransfers > 1 ? 's' : ''}`)

      if (parts.length === 0) return

      await supabase.from('system_notifications').insert({
        institution_id: inst.id,
        type: 'weekly_alert',
        title: 'Resumo do dia',
        message: parts.join(' · '),
        severity: 'info',
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
