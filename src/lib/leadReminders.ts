// Lembrete por lead (item 2d da reforma do módulo de Leads) — usado no card
// do LeadKanban, no agregado do GestorHome e na lista "Meus lembretes" do
// AttendantHome, pra não triplicar a mesma regra em 3 arquivos.
//
// Dois sinais independentes, o manual tem prioridade quando os dois existem:
// - manual: leads.next_followup, data que o usuário define explicitamente.
// - automático: N dias sem interação real. Fase 0A: conta desde a ÚLTIMA
//   INTERAÇÃO (mensagem ENVIADA pela equipe na conversa vinculada — recebida e
//   robô não contam —, atividade registrada no lead ou
//   nota do contato — função SQL lead_last_interactions, carregada pelo hook
//   useLeadInteractions); sem nenhuma interação, conta desde o cadastro.
//   N é configurável por escola (lead_reminder_settings); 5 é o padrão.
export const NO_CONTACT_DAYS = 5

export interface ReminderOptions {
  /** Última interação real do lead (null/undefined = nunca houve) */
  lastInteractionAt?: string | null
  /** Limite de dias da escola (padrão NO_CONTACT_DAYS) */
  noContactDays?: number
}

export type ReminderUrgency = 'overdue' | 'today' | 'upcoming' | 'stale'

export interface LeadReminderInfo {
  kind: 'manual' | 'auto'
  urgency: ReminderUrgency
  label: string
  date: string | null
}

export function getLeadReminderInfo(lead: { status: string; next_followup?: string | null; created_at: string }, opts: ReminderOptions = {}): LeadReminderInfo | null {
  if (lead.status === 'enrolled' || lead.status === 'lost') return null
  const now = new Date()

  if (lead.next_followup) {
    const due = new Date(lead.next_followup)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate())
    const diffDays = Math.round((dueStart.getTime() - todayStart.getTime()) / 86400000)
    const dueLabel = due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    if (diffDays < 0) return { kind: 'manual', urgency: 'overdue', label: `Atrasado desde ${dueLabel}`, date: lead.next_followup }
    if (diffDays === 0) return { kind: 'manual', urgency: 'today', label: 'Follow-up hoje', date: lead.next_followup }
    return { kind: 'manual', urgency: 'upcoming', label: `Follow-up em ${dueLabel}`, date: lead.next_followup }
  }

  const limit = opts.noContactDays ?? NO_CONTACT_DAYS
  const base = opts.lastInteractionAt ?? lead.created_at
  const idleDays = Math.floor((now.getTime() - new Date(base).getTime()) / 86400000)
  if (idleDays >= limit) {
    const label = opts.lastInteractionAt ? `Sem contato há ${idleDays}d` : `Sem contato desde o cadastro (${idleDays}d)`
    return { kind: 'auto', urgency: 'stale', label, date: null }
  }
  return null
}

export const REMINDER_COLORS: Record<ReminderUrgency, { color: string; bg: string; border: string }> = {
  overdue:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  today:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  upcoming: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  stale:    { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
}
