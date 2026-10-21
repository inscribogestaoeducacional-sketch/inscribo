// Regras puras (sem banco) do WhatsApp da escola: conta própria x conta da
// plataforma. Usadas pelo "Salvar WhatsApp" (whatsappSaveGuard.ts) e pela
// ficha da escola (InstitutionDetails). Testadas em
// tests/embedded-signup.security.test.ts.

// ── Proteções do "Salvar WhatsApp" do Super Admin ──────────────────────────
// Usado por InstitutionDetails.handleSaveWhatsApp e AdminSchools.handleSaveWa.
//
// Caso Universo (19/10/2026): o formulário foi salvo com o campo WABA vazio e
// o código caiu no WABA da plataforma (platform_settings.wa_waba_id, que é o
// WABA de TESTE), trocando o WABA real da escola sem deixar rastro. Caso
// Colégio Áion (21/10/2026): escola sem conta, campo WABA vazio e o ID da
// conta colado no campo do número → gravou a conta de teste como da escola
// (e a ficha passou a mostrar "Conectado" e "Reconectar"). Regras:
//   - a conta da plataforma/teste NUNCA é conta de escola: digitada → recusa;
//     já salva numa escola → tratada como "sem conta própria";
//   - campo vazio + escola com conta própria → mantém a conta salva;
//   - campo vazio + sem conta própria → recusa (pede o WABA da escola);
//   - o "Phone Number ID" tem de ser de um número na Meta (assertIsPhoneNumber);
//   - todo salvar vai pro audit_logs (quem, escola, o que mudou).

// Conta de teste da Áion — fixa aqui também, caso platform_settings mude ou
// venha vazio. Mesmo valor de TEST_WABA_ID em api/_lib/whatsappConnectAuth.ts.
export const AION_TEST_WABA_ID = '2812701862456294'

export function isPlatformWaba(wabaId: string | null | undefined, platformWabaId?: string | null): boolean {
  const w = String(wabaId || '').trim()
  if (!w) return false
  return w === AION_TEST_WABA_ID || (!!platformWabaId?.trim() && w === platformWabaId.trim())
}

// Conta PRÓPRIA da escola: a da linha dela em whatsapp_phone_numbers, nunca a
// da plataforma (platform_settings / platform_whatsapp).
export function ownSchoolWaba(
  saved: { waba_id?: string | null } | null | undefined, platformWabaId?: string | null,
): string | null {
  const w = saved?.waba_id?.trim() || ''
  return w && !isPlatformWaba(w, platformWabaId) ? w : null
}

export function resolveWabaForSave(
  typed: string, saved: { waba_id?: string | null } | null, platformWabaId: string,
): string {
  const typedId = typed.trim()
  const ownId = ownSchoolWaba(saved, platformWabaId)
  if (typedId) {
    if (isPlatformWaba(typedId, platformWabaId)) {
      throw new Error(
        `A conta ${typedId} é a conta de teste da Áion e não pode ser a conta de uma escola. ` +
        (ownId ? 'Deixe o campo vazio para manter a conta atual.' : 'Informe o WABA ID da conta da escola.'),
      )
    }
    return typedId
  }
  if (ownId) return ownId
  throw new Error('Esta escola ainda não tem conta (WABA) própria: informe o WABA ID da conta da escola. ' +
    'Para conta criada no WhatsApp Manager da Áion, use "Vincular conta da Áion".')
}

// O "Phone Number ID" tem de ser de um número: a Meta devolve o telefone. Se
// não devolve, quase sempre é o ID da conta (WABA) colado no campo errado.
export function assertIsPhoneNumber(phoneId: string, info: { display_phone_number?: string | null } | null | undefined): void {
  if (!String(info?.display_phone_number || '').trim()) {
    throw new Error(
      `O Phone Number ID ${phoneId} não é de um número na Meta (não veio telefone). ` +
      'Confira se não colou o ID da conta (WABA) no lugar do ID do número. Nada foi salvo.',
    )
  }
}
