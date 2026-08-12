// Lembrete por lead (item 2d da reforma do módulo de Leads) — usado no card
// do LeadKanban, no agregado do GestorHome e na lista "Meus lembretes" do
// AttendantHome, pra não triplicar a mesma regra em 3 arquivos.
//
// Dois sinais independentes, o manual tem prioridade quando os dois existem:
// - manual: leads.next_followup, data que o usuário define explicitamente.
// - automático: mesmo critério do alerta "leads sem contato" que já existia
//   no GestorHome (status aberto + N dias desde created_at), só que agora
//   por lead individual em vez de só contagem agregada.
export const NO_CONTACT_DAYS = 5

export type ReminderUrgency = 'overdue' | 'today' | 'upcoming' | 'stale'

export interface LeadReminderInfo {
  kind: 'manual' | 'auto'
  urgency: ReminderUrgency
  label: string
  date: string | null
}

export function getLeadReminderInfo(lead: { status: string; next_followup?: string | null; created_at: string }): LeadReminderInfo | null {
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

  const createdDays = Math.floor((now.getTime() - new Date(lead.created_at).getTime()) / 86400000)
  if (createdDays >= NO_CONTACT_DAYS) return { kind: 'auto', urgency: 'stale', label: `Sem contato há ${createdDays}d`, date: null }
  return null
}

export const REMINDER_COLORS: Record<ReminderUrgency, { color: string; bg: string; border: string }> = {
  overdue:  { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  today:    { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  upcoming: { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  stale:    { color: '#64748B', bg: '#F1F5F9', border: '#E2E8F0' },
}
