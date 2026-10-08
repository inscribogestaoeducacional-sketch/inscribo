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
    if (digits.length === 12 && isBrazilianMobileLocal(digits[4])) {
      // Celular no formato antigo de 8 dígitos: insere o 9º dígito após o DDD.
      // Fixo (local começando com 2 a 5) NÃO ganha 9 — o número inventado
      // não existe e todo envio pra ele falha (caso Escola Semear).
      digits = digits.slice(0, 4) + '9' + digits.slice(4)
    }
    return digits
  }

  // Qualquer outro número: já é internacional (Meta sempre manda E.164 completo).
  // Retorna sem alterar — NÃO prefixa 55.
  return digits
}

// Celular brasileiro antigo (8 dígitos locais) começa com 6, 7, 8 ou 9; fixo
// começa com 2, 3, 4 ou 5. Só celular ganhou o 9º dígito.
export function isBrazilianMobileLocal(firstLocalDigit: string | undefined): boolean {
  return !!firstLocalDigit && firstLocalDigit >= '6' && firstLocalDigit <= '9'
}

// =============================================================================
// Normaliza telefone digitado livremente por uma pessoa (form manual de
// contato/lead, import de CSV, campo de busca do "Iniciar Conversa") — que
// pode ou não incluir o "55" na frente, e pode ou não ter o 9º dígito.
// Sempre resolve pro mesmo formato canônico (55 + DDD + 9 + 8 dígitos),
// indiferente de como foi digitado, então nunca duplica contato por causa
// disso.
//
// Diferente de normalizePhone() acima: aquela assume que o DDI já está
// presente (payload da Meta) e por isso NUNCA prefixa 55 sozinha — prefixar
// às cegas corromperia um número internacional real. Esta função só assume
// "número BR sem DDI" quando o comprimento bate exatamente com DDD+8 (10
// dígitos) ou DDD+9+8 (11 dígitos), que é como brasileiro digita celular sem
// código de país; qualquer outro comprimento é tratado como já-internacional
// e não é mexido.
// =============================================================================
export function normalizeBrazilianInput(raw: string): string {
  const digits = raw.replace(/\D/g, '')

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return normalizePhone(digits)
  }

  // Sem DDI: 10 dígitos = DDD + 8 (sem 9º); 11 dígitos = DDD + 9 + 8.
  if (digits.length === 10 || digits.length === 11) {
    return normalizePhone(`55${digits}`)
  }

  return digits
}
