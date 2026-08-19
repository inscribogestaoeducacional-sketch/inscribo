// src/lib/leadSave.ts
//
// Fonte única de verdade pra "o que acontece quando um formulário de lead é
// submetido" (insert/update em `leads`, log de auditoria, resolução de
// família/irmãos, sync com whatsapp_contacts/whatsapp_conversations).
// Extraído do handleSave que vivia só dentro de LeadKanban.tsx — reaproveitado
// agora também pelo WhatsAppHub (NewLeadModal unificado), que antes tinha seu
// próprio caminho de criação divergente (handleCreateLead) sem boa parte
// dessa lógica (ex.: item F — assigned_to nunca era setado por lá).
//
// O que fica DE FORA daqui, por ser específico de cada tela: recarregar a
// lista/estado local do chamador, fechar modal, e (no caso do WhatsApp)
// vincular o lead à conversa ativa (lead_id/contact_type em
// whatsapp_conversations, lead_id em whatsapp_messages) — isso continua no
// onSave de cada componente.
import { supabase } from './supabase'
import type { Lead } from './supabase'
import { logAudit } from '../hooks/useAudit'
import { normalizeBrazilianInput } from './phone'
import type { StudentEntry, SimpleUser } from '../components/leads/leadFormShared'

export interface SaveLeadParams {
  institutionId: string
  currentUser: { id: string; full_name: string; role: string }
  users: SimpleUser[]
  editingLead: Lead | null
  data: Partial<Lead> & { familyMatchId?: string | null; additionalStudents?: StudentEntry[] }
  // Só usado ao criar um lead novo (LeadKanban) — o fluxo do WhatsApp não
  // tem conceito de campanha ativa, então passa undefined/null.
  campaignCycleId?: string | null
}

export async function saveLead({ institutionId, currentUser, users, editingLead, data, campaignCycleId = null }: SaveLeadParams): Promise<string> {
  const instId = institutionId
  let savedLeadId: string = editingLead?.id ?? ''
  const { familyMatchId, additionalStudents, ...leadData } = data

  // Um insert por aluno, compartilhando os dados da família (telefone,
  // responsável, origem, atendente, etc.) e o family_id resolvido pelo
  // chamador. Reaproveitado tanto ao criar um lead novo (com filhos extras
  // na mesma tela) quanto ao editar um lead existente (adicionar um irmão).
  const insertStudentLead = async (
    student: { student_name?: string | null; grade_interest?: string | null; shift_interest?: string | null; origin_school?: string | null },
    shared: {
      responsible_name?: string; phone?: string; email?: string; address?: string; city?: string | null
      source?: string; budget_range?: string; notes?: string; assigned_to?: string | null
      next_followup?: string | null; lead_temperature?: 'frio' | 'morno' | 'quente' | null
      referral_source?: string | null; contest_name?: string | null
      family_id: string | null; campaign_cycle_id?: string | null; auditSuffix?: string
    }
  ) => {
    const { data: newLead, error } = await supabase.from('leads').insert({
      institution_id:   instId,
      student_name:     student.student_name,
      responsible_name: shared.responsible_name,
      phone:             shared.phone,
      email:             shared.email,
      address:           shared.address,
      city:              shared.city || null,
      grade_interest:    student.grade_interest || null,
      shift_interest:    student.shift_interest || null,
      source:            shared.source,
      budget_range:      shared.budget_range,
      notes:             shared.notes,
      status:            'new',
      assigned_to:       shared.assigned_to || null,
      next_followup:     shared.next_followup || null,
      lead_temperature:  shared.lead_temperature || null,
      origin_school:     student.origin_school || null,
      referral_source:   shared.referral_source || null,
      contest_name:      shared.contest_name || null,
      family_id:         shared.family_id,
      campaign_cycle_id: shared.campaign_cycle_id ?? null,
    }).select().single()
    if (error) throw error
    await supabase.from('audit_logs').insert({
      institution_id: instId, module: 'lead', record_id: newLead.id,
      action: 'Lead criado',
      field_changed: `Aluno: ${newLead.student_name}${newLead.grade_interest ? ` · ${newLead.grade_interest}` : ''}${newLead.source ? ` · Origem: ${newLead.source}` : ''}${shared.auditSuffix ?? ''}`,
      new_value: newLead.phone || '',
      user_id: currentUser.id, user_name: currentUser.full_name, user_role: currentUser.role,
    })
    await logAudit({ institution_id: instId, module: 'leads', record_id: newLead.id, action: 'created', new_value: `${newLead.student_name} — ${newLead.grade_interest}`, user_id: currentUser.id, user_name: currentUser.full_name, user_role: currentUser.role })
    return newLead
  }

  if (editingLead) {
    const { error } = await supabase.from('leads').update({
      student_name:      leadData.student_name      ?? editingLead.student_name,
      responsible_name:  leadData.responsible_name  ?? editingLead.responsible_name,
      phone:             leadData.phone              ?? editingLead.phone,
      email:             leadData.email              ?? editingLead.email,
      address:           leadData.address            ?? editingLead.address,
      city:              leadData.city               ?? editingLead.city,
      grade_interest:    leadData.grade_interest      ?? editingLead.grade_interest,
      shift_interest:    (leadData as any).shift_interest ?? (editingLead as any).shift_interest,
      source:            leadData.source              ?? editingLead.source,
      budget_range:      leadData.budget_range        ?? editingLead.budget_range,
      notes:             leadData.notes               ?? editingLead.notes,
      status:            leadData.status              || editingLead.status,
      assigned_to:       leadData.assigned_to !== undefined ? (leadData.assigned_to || null) : editingLead.assigned_to,
      next_followup:     leadData.next_followup !== undefined ? (leadData.next_followup || null) : editingLead.next_followup,
      lead_temperature:  leadData.lead_temperature !== undefined ? (leadData.lead_temperature || null) : editingLead.lead_temperature,
      origin_school:     leadData.origin_school !== undefined ? (leadData.origin_school || null) : editingLead.origin_school,
      referral_source:   leadData.referral_source !== undefined ? (leadData.referral_source || null) : editingLead.referral_source,
      contest_name:      leadData.contest_name !== undefined ? (leadData.contest_name || null) : editingLead.contest_name,
      updated_at:        new Date().toISOString(),
    }).eq('id', editingLead.id)
    if (error) throw error

    const changes: Record<string, unknown> = {}
    Object.keys(leadData).forEach(key => {
      const nv = (leadData as Record<string, unknown>)[key]
      const ov = (editingLead as unknown as Record<string, unknown>)[key]
      if (nv !== ov && nv !== undefined && nv !== null && nv !== '') { changes[key] = nv }
    })
    if (Object.keys(changes).length > 0) {
      await supabase.from('audit_logs').insert({
        institution_id: instId, module: 'lead', record_id: editingLead.id,
        action: 'Lead editado',
        field_changed: `Campos: ${Object.keys(changes).join(', ')}`,
        new_value: leadData.student_name || editingLead.student_name,
        user_id: currentUser.id, user_name: currentUser.full_name, user_role: currentUser.role,
      })
    }
    await logAudit({ institution_id: instId, module: 'leads', record_id: editingLead.id, action: 'updated', field_changed: 'dados', old_value: editingLead.student_name, new_value: leadData.student_name || editingLead.student_name, user_id: currentUser.id, user_name: currentUser.full_name, user_role: currentUser.role })

    // Item 2e — transferência de responsável, logada separadamente pra ficar
    // clara no histórico ("quem passou pra quem"), não misturada no log
    // genérico de edição.
    if (leadData.assigned_to !== undefined && (leadData.assigned_to || null) !== (editingLead.assigned_to || null)) {
      const fromName = users.find(u => u.id === editingLead.assigned_to)?.full_name || 'Sem responsável'
      const toName = users.find(u => u.id === leadData.assigned_to)?.full_name || 'Sem responsável'
      await supabase.from('audit_logs').insert({
        institution_id: instId, module: 'lead', record_id: editingLead.id,
        action: 'Responsável alterado',
        field_changed: `${fromName} → ${toName}`,
        new_value: toName,
        user_id: currentUser.id, user_name: currentUser.full_name, user_role: currentUser.role,
      })
    }

    // Item 3 (fluxo de edição) — "+ Adicionar outro filho" também disponível
    // ao editar. Se o lead ainda não tem family_id, cria a família na hora e
    // promove o próprio lead editado pra ela; se já tem, só usa o family_id
    // existente.
    if (additionalStudents && additionalStudents.length > 0) {
      let familyId = editingLead.family_id ?? null
      const sharedEdit = {
        responsible_name: leadData.responsible_name ?? editingLead.responsible_name,
        phone:            leadData.phone ?? editingLead.phone,
        email:            leadData.email ?? editingLead.email,
        address:          leadData.address ?? editingLead.address,
        city:             leadData.city !== undefined ? leadData.city : editingLead.city,
        source:           leadData.source ?? editingLead.source,
        budget_range:     leadData.budget_range ?? editingLead.budget_range,
        notes:            leadData.notes ?? editingLead.notes,
        assigned_to:      leadData.assigned_to !== undefined ? (leadData.assigned_to || null) : (editingLead.assigned_to || null),
        next_followup:    leadData.next_followup !== undefined ? (leadData.next_followup || null) : (editingLead.next_followup || null),
        lead_temperature: leadData.lead_temperature !== undefined ? (leadData.lead_temperature || null) : (editingLead.lead_temperature || null),
        referral_source:  leadData.referral_source !== undefined ? (leadData.referral_source || null) : (editingLead.referral_source || null),
        contest_name:     leadData.contest_name !== undefined ? (leadData.contest_name || null) : (editingLead.contest_name || null),
        family_id:        null as string | null,
        campaign_cycle_id: editingLead.campaign_cycle_id ?? null,
        auditSuffix:      ` (irmão de ${editingLead.student_name})`,
      }
      if (!familyId) {
        const { data: newFamily, error: famErr } = await supabase.from('lead_families').insert({
          institution_id: instId,
          responsible_name: sharedEdit.responsible_name,
          phone: sharedEdit.phone,
          email: sharedEdit.email || null,
          address: sharedEdit.address || null,
        }).select().single()
        if (famErr) throw famErr
        familyId = newFamily.id
        await supabase.from('leads').update({ family_id: familyId }).eq('id', editingLead.id)
      }
      sharedEdit.family_id = familyId
      for (const student of additionalStudents) {
        await insertStudentLead(student, sharedEdit)
      }
    }
  } else {
    // Item 3 — família com múltiplos filhos. Caminho principal: todos os
    // filhos preenchidos na mesma tela (additionalStudents) viram 1
    // lead_families + N leads criados juntos. A detecção por telefone
    // (familyMatchId) continua existindo como fallback pro caso de alguém
    // criar um lead novo separadamente meses depois — se ela encontrar uma
    // família, tem prioridade sobre criar uma nova.
    let familyId: string | null = null
    if (familyMatchId) {
      if (familyMatchId.startsWith('retro:')) {
        const soloLeadId = familyMatchId.slice('retro:'.length)
        const { data: newFamily, error: famErr } = await supabase.from('lead_families').insert({
          institution_id: instId,
          responsible_name: leadData.responsible_name,
          phone: leadData.phone,
          email: leadData.email || null,
          address: leadData.address || null,
        }).select().single()
        if (!famErr && newFamily) {
          familyId = newFamily.id
          await supabase.from('leads').update({ family_id: familyId }).eq('id', soloLeadId)
        }
      } else {
        familyId = familyMatchId
      }
    } else if (additionalStudents && additionalStudents.length > 0) {
      const { data: newFamily, error: famErr } = await supabase.from('lead_families').insert({
        institution_id: instId,
        responsible_name: leadData.responsible_name,
        phone: leadData.phone,
        email: leadData.email || null,
        address: leadData.address || null,
      }).select().single()
      if (famErr) throw famErr
      familyId = newFamily.id
    }

    const sharedCreate = {
      responsible_name: leadData.responsible_name,
      phone:             leadData.phone,
      email:             leadData.email,
      address:           leadData.address,
      city:              leadData.city || null,
      source:            leadData.source,
      budget_range:      leadData.budget_range,
      notes:             leadData.notes,
      assigned_to:       leadData.assigned_to || null,
      next_followup:     leadData.next_followup || null,
      lead_temperature:  leadData.lead_temperature || null,
      referral_source:   leadData.referral_source || null,
      contest_name:      leadData.contest_name || null,
      family_id:         familyId,
      campaign_cycle_id: campaignCycleId,
    }

    const newLead = await insertStudentLead({
      student_name: leadData.student_name,
      grade_interest: leadData.grade_interest,
      shift_interest: (leadData as any).shift_interest,
      origin_school: leadData.origin_school,
    }, sharedCreate)
    savedLeadId = newLead.id

    if (additionalStudents) {
      for (const student of additionalStudents) {
        await insertStudentLead(student, sharedCreate)
      }
    }
  }

  // Sync com whatsapp_contacts (upsert) e whatsapp_conversations.contact_name
  // — mantém o nome do contato no Hub do WhatsApp coerente com o lead, não
  // importa se o lead foi criado/editado pelo Kanban ou pelo próprio Hub.
  const phone = (leadData.phone || editingLead?.phone || '').trim()
  const responsibleName = leadData.responsible_name || editingLead?.responsible_name || ''
  if (phone) {
    try {
      const normPhone = normalizeBrazilianInput(phone)
      await supabase.from('whatsapp_contacts').upsert({
        institution_id: instId, phone: normPhone, name: responsibleName || normPhone,
        type: 'lead', ...(savedLeadId ? { lead_id: savedLeadId } : {}), updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id,phone' })
      await supabase.from('whatsapp_conversations').update({ contact_name: responsibleName })
        .eq('institution_id', instId).eq('remote_jid', `${normPhone}@s.whatsapp.net`)
    } catch { /* sync best-effort — não deve bloquear o save do lead */ }
  }

  return savedLeadId
}
