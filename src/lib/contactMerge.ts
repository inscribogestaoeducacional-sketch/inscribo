// src/lib/contactMerge.ts
//
// Detecção e merge de duplicatas em whatsapp_contacts pela UI (módulo
// Contatos → "Duplicados"). Porta pra TS a MESMA regra de prioridade já usada
// nas migrations de limpeza manual anteriores
// (20260821040000_merge_identical_name_duplicates.sql), generalizada pra
// grupos de qualquer tamanho (a migration original só tratava grupos de
// exatamente 2 linhas com nome idêntico) e com a decisão exposta pra UI
// permitir o usuário trocar o sobrevivente antes de confirmar.
//
// has_conversation NÃO é coluna de whatsapp_contacts — é sempre calculada
// contra whatsapp_conversations (mesma lógica das migrations: casa
// SPLIT_PART(remote_jid, '@', 1) com o telefone já normalizado).
import { supabase } from './supabase'
import { normalizeBrazilianInput } from './phone'

export interface DupContactRow {
  id: string
  institution_id: string
  phone: string | null
  name: string | null
  tags: string[] | null
  lead_id: string | null
  type: string | null
  last_seen_at: string | null
  created_at: string | null
}

export interface DupGroup {
  normPhone: string
  contacts: DupContactRow[]
  hasConversation: Record<string, boolean>
  suggestedSurvivorId: string
  leadConflict: boolean
}

// Mesma ordem de critérios de 20260821040000_merge_identical_name_duplicates.sql:
// 1) has_conversation=true vence sempre (histórico de conversa não é reconstruível);
// 2) empate -> mais tags;
// 3) empate residual -> last_seen_at mais recente;
// 4) empate total (não deveria acontecer na prática) -> primeiro por created_at.
export function decideSurvivor(contacts: DupContactRow[], hasConversation: Record<string, boolean>): string {
  const sorted = [...contacts].sort((a, b) => {
    const convA = hasConversation[a.id] ? 1 : 0
    const convB = hasConversation[b.id] ? 1 : 0
    if (convA !== convB) return convB - convA

    const tagsA = a.tags?.length || 0
    const tagsB = b.tags?.length || 0
    if (tagsA !== tagsB) return tagsB - tagsA

    const lsA = a.last_seen_at ? new Date(a.last_seen_at).getTime() : 0
    const lsB = b.last_seen_at ? new Date(b.last_seen_at).getTime() : 0
    if (lsA !== lsB) return lsB - lsA

    const caA = a.created_at ? new Date(a.created_at).getTime() : 0
    const caB = b.created_at ? new Date(b.created_at).getTime() : 0
    return caA - caB
  })
  return sorted[0].id
}

// Busca todos os grupos de duplicata (>1 linha por telefone normalizado) da
// instituição, já com has_conversation calculado e a sugestão de sobrevivente
// — exclui grupos marcados como "ignorar" (whatsapp_contacts_duplicate_ignore).
export async function findDuplicateGroups(institutionId: string): Promise<DupGroup[]> {
  const { data: contacts, error } = await supabase
    .from('whatsapp_contacts')
    .select('id, institution_id, phone, name, tags, lead_id, type, last_seen_at, created_at')
    .eq('institution_id', institutionId)
  if (error) throw error
  if (!contacts?.length) return []

  const byPhone = new Map<string, DupContactRow[]>()
  for (const c of contacts as DupContactRow[]) {
    const norm = normalizeBrazilianInput(c.phone || '')
    if (!norm) continue
    const arr = byPhone.get(norm) ?? []
    arr.push(c)
    byPhone.set(norm, arr)
  }

  const candidateGroups = [...byPhone.entries()].filter(([, rows]) => rows.length > 1)
  if (!candidateGroups.length) return []

  const { data: ignored } = await supabase
    .from('whatsapp_contacts_duplicate_ignore')
    .select('norm_phone')
    .eq('institution_id', institutionId)
  const ignoredSet = new Set((ignored || []).map(r => r.norm_phone))

  const { data: convs } = await supabase
    .from('whatsapp_conversations')
    .select('remote_jid')
    .eq('institution_id', institutionId)
  const convPhones = new Set((convs || []).map(c => (c.remote_jid || '').split('@')[0]))

  const groups: DupGroup[] = []
  for (const [normPhone, rows] of candidateGroups) {
    if (ignoredSet.has(normPhone)) continue
    const hasConversation: Record<string, boolean> = {}
    for (const r of rows) hasConversation[r.id] = convPhones.has(r.phone || '')
    const leadIds = new Set(rows.map(r => r.lead_id).filter(Boolean) as string[])
    groups.push({
      normPhone,
      contacts: rows,
      hasConversation,
      suggestedSurvivorId: decideSurvivor(rows, hasConversation),
      leadConflict: leadIds.size > 1,
    })
  }
  return groups
}

export async function ignoreDuplicateGroup(institutionId: string, normPhone: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_contacts_duplicate_ignore')
    .upsert({ institution_id: institutionId, norm_phone: normPhone, ignored_by: userId }, { onConflict: 'institution_id,norm_phone' })
  if (error) throw error
}

// Mescla um grupo inteiro num único sobrevivente (survivorId, escolhido ou
// confirmado pelo usuário na UI). Tags: união de todas as linhas do grupo.
// lead_id: copia pro sobrevivente se ele não tiver e alguma descartada tiver
// — bloqueado antes de chegar aqui se houver conflito (ver leadConflict em
// DupGroup, checado pela UI antes de chamar isto).
export async function mergeDuplicateGroup(params: {
  institutionId: string
  normPhone: string
  survivorId: string
  contacts: DupContactRow[]
  mergedBy: string | null
}): Promise<void> {
  const { institutionId, normPhone, survivorId, contacts, mergedBy } = params
  const survivor = contacts.find(c => c.id === survivorId)
  if (!survivor) throw new Error('Sobrevivente não encontrado no grupo.')
  const discarded = contacts.filter(c => c.id !== survivorId)
  if (!discarded.length) return

  const leadIds = new Set(contacts.map(c => c.lead_id).filter(Boolean) as string[])
  if (leadIds.size > 1) {
    throw new Error('Conflito de lead — os contatos deste grupo apontam para leads diferentes. Resolva manualmente antes de mesclar.')
  }
  const finalLeadId = survivor.lead_id || [...leadIds][0] || null
  const leadIdCopied = !survivor.lead_id && finalLeadId ? finalLeadId : null

  const unionTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])))

  const { error: updateErr } = await supabase
    .from('whatsapp_contacts')
    .update({ tags: unionTags, ...(leadIdCopied ? { lead_id: leadIdCopied } : {}) })
    .eq('id', survivorId)
  if (updateErr) throw updateErr

  for (const d of discarded) {
    const { error: logErr } = await supabase.from('whatsapp_contacts_merge_log').insert({
      institution_id: institutionId,
      norm_phone: normPhone,
      discarded_contact_id: d.id,
      surviving_contact_id: survivorId,
      lead_id_copied: leadIdCopied,
      merge_reason: 'manual_merge_ui',
      merged_by: mergedBy,
    })
    if (logErr) throw logErr

    const { error: delErr } = await supabase.from('whatsapp_contacts').delete().eq('id', d.id)
    if (delErr) throw delErr
  }
}
