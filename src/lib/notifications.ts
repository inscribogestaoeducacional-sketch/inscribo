import { supabase } from './supabase'

export async function createNotification({
  institution_id,
  type,
  title,
  message,
  severity = 'info',
  action_url = null,
}: {
  institution_id: string
  type: 'weekly_alert' | 'goal_deviation' | 'milestone' | 'suggestion' | 'overdue_reminder'
  title: string
  message: string
  severity?: 'info' | 'warning' | 'danger' | 'success'
  action_url?: string | null
}) {
  const { error } = await supabase.from('system_notifications').insert({
    institution_id,
    type,
    title,
    message,
    severity,
    action_url,
    created_at: new Date().toISOString(),
  })
  if (error) console.error('Erro ao criar notificação:', error)
}
