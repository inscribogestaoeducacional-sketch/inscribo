// Mensagens automáticas da visita (confirmação na hora + lembrete no dia),
// para quem agenda FORA do painel do WhatsApp (calendário, cartão do lead).
// Tudo sai pela API oficial do WhatsApp, com os modelos da escola
// (lib/templateSlots). Só envia se a escola ligou "mensagem automática ao
// agendar" em Visitas (lead_reminder_settings.visit_auto_message).
import { supabase } from './supabase'
import { getAuthHeaders } from './authHeaders'
import { normalizeBrazilianInput } from './phone'
import { resolveSlotTemplate } from './templateSlots'

export async function isVisitAutoMessageOn(institutionId: string): Promise<boolean> {
  const { data } = await supabase.from('lead_reminder_settings').select('visit_auto_message').eq('institution_id', institutionId).maybeSingle()
  return !!(data as { visit_auto_message?: boolean } | null)?.visit_auto_message
}

export async function setVisitAutoMessage(institutionId: string, on: boolean, userId: string): Promise<void> {
  const { error } = await supabase.from('lead_reminder_settings').upsert({ institution_id: institutionId, visit_auto_message: on, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'institution_id' })
  if (error) throw error
}

export interface VisitMsgResult { sent: boolean; reminder: boolean; note?: string }

export async function sendVisitMessages(p: {
  institutionId: string
  lead: { id: string; phone?: string | null }
  visitId: string
  visitDate: Date
  userId: string
}): Promise<VisitMsgResult> {
  if (!(await isVisitAutoMessageOn(p.institutionId))) return { sent: false, reminder: false }
  if (!p.lead.phone) return { sent: false, reminder: false, note: 'O lead não tem telefone, a mensagem não foi enviada.' }

  const to = normalizeBrazilianInput(p.lead.phone).replace(/\D/g, '')
  const [{ data: inst }, { data: conv }] = await Promise.all([
    supabase.from('institutions').select('name').eq('id', p.institutionId).maybeSingle(),
    supabase.from('whatsapp_conversations').select('id, remote_jid').eq('institution_id', p.institutionId).eq('lead_id', p.lead.id).order('last_message_at', { ascending: false, nullsFirst: false }).limit(1).maybeSingle(),
  ])
  const schoolName = (inst as { name?: string } | null)?.name ?? ''
  const d = p.visitDate
  const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  const timeLabel = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  let sent = false
  let note: string | undefined
  try {
    const confirmTemplate = await resolveSlotTemplate(p.institutionId, 'confirmacao_visita')
    const res = await fetch('/api/whatsapp/send-template', {
      method: 'POST', headers: await getAuthHeaders(),
      body: JSON.stringify({
        institution_id: p.institutionId, to, template_name: confirmTemplate, language: 'pt_BR',
        components: [{ type: 'body', parameters: [{ type: 'text', text: schoolName }, { type: 'text', text: dateLabel }, { type: 'text', text: timeLabel }] }],
        ...(conv?.id ? { conversation_id: conv.id } : {}), sender_user_id: p.userId,
      }),
    })
    sent = res.ok
    if (!res.ok) note = 'A visita foi agendada, mas a confirmação por WhatsApp não saiu.'
  } catch { note = 'A visita foi agendada, mas a confirmação por WhatsApp não saiu.' }

  // Lembrete: 08:00 do dia da visita (ou 3h antes se for antes das 9h); pula se já passou.
  let reminder = false
  if (conv?.id) {
    const reminderDate = d.getHours() < 9 ? new Date(d.getTime() - 3 * 3600000) : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 0, 0, 0)
    if (reminderDate.getTime() > Date.now()) {
      const reminderTemplate = await resolveSlotTemplate(p.institutionId, 'lembrete_visita')
      const { error } = await supabase.from('whatsapp_scheduled_messages').insert({
        institution_id: p.institutionId, conversation_id: conv.id, remote_jid: conv.remote_jid, visit_id: p.visitId,
        template_name: reminderTemplate, template_variables: { '1': schoolName, '2': timeLabel },
        scheduled_for: reminderDate.toISOString(), created_by: p.userId,
      })
      reminder = !error
    }
  } else if (!note) note = 'Confirmação enviada. Sem conversa aberta com a família, o lembrete do dia não foi agendado.'
  return { sent, reminder, note }
}
