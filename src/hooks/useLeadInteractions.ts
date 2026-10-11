import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { NO_CONTACT_DAYS, type ReminderOptions } from '../lib/leadReminders'

// Fase 0A — base do lembrete "sem contato": última interação real de cada lead
// em aberto (função SQL lead_last_interactions) + limite de dias da escola
// (lead_reminder_settings). Usado no Kanban, no Início do gestor e no do
// atendente, pra regra ser a mesma nas três telas.
export function useLeadInteractions(institutionId: string | null | undefined) {
  const [lastByLead, setLastByLead] = useState<Map<string, string | null>>(new Map())
  const [noContactDays, setNoContactDays] = useState(NO_CONTACT_DAYS)
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(async () => {
    if (!institutionId) return
    const [{ data: rows, error }, { data: cfg }] = await Promise.all([
      supabase.rpc('lead_last_interactions', { p_institution_id: institutionId }),
      supabase.from('lead_reminder_settings').select('no_contact_days').eq('institution_id', institutionId).maybeSingle(),
    ])
    if (error) console.error('[useLeadInteractions] lead_last_interactions:', error)
    setLastByLead(new Map(((rows ?? []) as { lead_id: string; last_interaction_at: string | null }[]).map(r => [r.lead_id, r.last_interaction_at])))
    setNoContactDays((cfg as { no_contact_days?: number } | null)?.no_contact_days ?? NO_CONTACT_DAYS)
    setLoaded(true)
  }, [institutionId])

  useEffect(() => { refresh() }, [refresh])

  const optsFor = useCallback((leadId: string): ReminderOptions => ({
    lastInteractionAt: lastByLead.get(leadId) ?? null,
    noContactDays,
  }), [lastByLead, noContactDays])

  return { lastByLead, noContactDays, optsFor, loaded, refresh }
}
