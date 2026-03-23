import { supabase } from '../lib/supabase'

interface AuditEntry {
  institution_id: string
  module: 'leads' | 'visits' | 'transfers'
  record_id: string
  action: 'created' | 'updated' | 'deleted' | 'status_changed'
  field_changed?: string
  old_value?: string
  new_value?: string
  user_name: string
  user_role: string
  user_id: string
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('audit_logs').insert(entry)
  } catch {
    // silently ignore — audit must never block the main flow
  }
}
