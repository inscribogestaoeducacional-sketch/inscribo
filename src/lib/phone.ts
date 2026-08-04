// =============================================================================
// src/lib/phone.ts
//
// Normaliza um wa_id/telefone da Meta Cloud API pro formato canônico usado
// como remote_jid em toda a Fase B do Raio-X e no webhook real
// (api/whatsapp/webhook.ts:normalizePhone, linhas 361-377). Extraída de lá —
// é a mesma lógica já validada em produção, agora compartilhada em vez de
// copiada (com pequenas divergências) em cada tela/função.
//
// Números brasileiros da Meta sempre vêm com código do país 55; números não
// brasileiros (US +1, Portugal +351, UK +44 etc.) chegam com seu próprio
// código de país e NÃO devem ser modificados — prefixar 55 corromperia esses
// números.
//
// Atenção: esta função assume que o código do país já está presente (é o que
// a Meta sempre manda no campo `from`/`wa_id`). Pra normalizar telefone
// digitado livremente por alguém em um formulário (que pode não incluir o
// 55), garanta o prefixo do país ANTES de chamar esta função — ver
// src/pages/RaioXPage.tsx.
// =============================================================================
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, '')

  // Número brasileiro já com código do país: 55 + DDD(2) + [9] + local(8) = 12-13 dígitos
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    if (digits.length === 12) {
      // Formato antigo de 8 dígitos locais: insere o 9º dígito obrigatório após o DDD
      digits = digits.slice(0, 4) + '9' + digits.slice(4)
    }
    return digits
  }

  // Qualquer outro número: já é internacional (Meta sempre manda E.164 completo).
  // Retorna sem alterar — NÃO prefixa 55.
  return digits
}
