import { supabase, WHATSAPP_PHONE_COLUMNS } from './supabase'

// ── Proteções do "Salvar WhatsApp" do Super Admin ──────────────────────────
// Usado por InstitutionDetails.handleSaveWhatsApp e AdminSchools.handleSaveWa.
//
// Caso Universo (19/10/2026): o formulário foi salvo com o campo WABA vazio e
// o código caiu no WABA da plataforma (platform_settings.wa_waba_id, que é o
// WABA de TESTE), trocando o WABA real da escola sem deixar rastro. Regras:
//   - campo vazio + número já tem WABA salvo → mantém o WABA salvo;
//   - campo vazio + sem WABA salvo → WABA da Áion (comportamento antigo);
//   - número já tem WABA próprio e o campo traz o WABA da Áion → recusa;
//   - todo salvar vai pro audit_logs (quem, escola, o que mudou).

export interface SavedWhatsAppRow {
  id: string
  phone_number_id: string | null
  phone_number: string | null
  display_name: string | null
  waba_id: string | null
  is_active: boolean | null
  use_meta_api: boolean | null
}

export const WABA_FIELD_LABEL = 'WABA ID (vazio = mantém o atual; sem atual, usa o da Áion)'
export const WABA_FIELD_PLACEHOLDER = 'Vazio = mantém o WABA já salvo'

export async function loadSavedWhatsApp(institutionId: string): Promise<SavedWhatsAppRow | null> {
  const { data, error } = await supabase.from('whatsapp_phone_numbers')
    .select(WHATSAPP_PHONE_COLUMNS)
    .eq('institution_id', institutionId)
    .maybeSingle()
  // Sem conseguir ler o cadastro atual não dá pra garantir que o WABA não
  // será trocado — melhor não salvar.
  if (error) throw new Error(`Não foi possível ler o WhatsApp atual da escola: ${error.message}`)
  return (data as unknown as SavedWhatsAppRow) ?? null
}

export function resolveWabaForSave(typed: string, saved: SavedWhatsAppRow | null, platformWabaId: string): string {
  const typedId = typed.trim()
  const savedId = saved?.waba_id?.trim() || ''
  if (typedId) {
    if (savedId && savedId !== platformWabaId && typedId === platformWabaId) {
      throw new Error(
        `Este número já tem o WABA ${savedId} salvo. O WABA da Áion (${platformWabaId}) não pode substituí-lo. ` +
        'Deixe o campo vazio para manter o atual.',
      )
    }
    return typedId
  }
  return savedId || platformWabaId
}

const AUDITED_FIELDS = ['phone_number_id', 'phone_number', 'display_name', 'waba_id', 'is_active', 'use_meta_api'] as const

// Nunca bloqueia o salvar: se o registro falhar, só avisa no console.
export async function auditWhatsAppSave(
  institutionId: string,
  before: SavedWhatsAppRow | null,
  after: Record<(typeof AUDITED_FIELDS)[number], unknown>,
): Promise<void> {
  try {
    const changed = AUDITED_FIELDS.filter(k => String(before?.[k] ?? '') !== String(after[k] ?? ''))
    const pick = (row: Record<string, unknown> | null) =>
      row ? Object.fromEntries(changed.map(k => [k, row[k] ?? null])) : null

    const { data: { user } } = await supabase.auth.getUser()
    const { data } = user
      ? await supabase.from('users').select('full_name, role').eq('id', user.id).maybeSingle()
      : { data: null }
    const u = data as { full_name: string | null; role: string | null } | null
    const { data: row } = await supabase.from('whatsapp_phone_numbers')
      .select('id').eq('institution_id', institutionId).maybeSingle()

    const { error } = await supabase.from('audit_logs').insert({
      institution_id: institutionId,
      module:         'whatsapp',
      record_id:      row?.id ?? before?.id ?? null,
      action:         'WhatsApp salvo pelo Super Admin',
      field_changed:  changed.length ? changed.join(', ') : 'sem_alteracao',
      old_value:      before ? JSON.stringify(pick(before as unknown as Record<string, unknown>)) : 'sem cadastro anterior',
      new_value:      JSON.stringify(pick(after)),
      user_id:        user?.id ?? null,
      user_name:      u?.full_name ?? user?.email ?? null,
      user_role:      u?.role ?? null,
    })
    if (error) console.warn('[WA] falha ao registrar o salvar no audit_logs:', error.message)
  } catch (e) {
    console.warn('[WA] falha ao registrar o salvar no audit_logs:', e)
  }
}
