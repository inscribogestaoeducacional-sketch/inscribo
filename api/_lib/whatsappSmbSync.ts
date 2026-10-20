import { GRAPH_URL } from './whatsappAuth.js'

// ── Pede à Meta os contatos e o histórico do app WhatsApp Business ─────────
// Depois de uma conexão em coexistência, a Meta só manda os webhooks
// `smb_app_state_sync` (contatos) e `history` (conversas antigas) se alguém
// chamar POST /{phone_number_id}/smb_app_data — primeiro os contatos, depois o
// histórico. Só vale nas 24h seguintes ao onboarding e só uma vez por
// onboarding. Caso Universo (19/10/2026): o número reconectou, a chamada
// nunca foi feita e o histórico da queda não veio.
//
// Os dados chegam depois, pelo webhook (handleSmbAppStateSync /
// handleHistorySync em api/whatsapp/webhook.ts). Aqui só se faz o pedido.

const META_FETCH_TIMEOUT_MS = 30000
const SYNC_TYPES = ['smb_app_state_sync', 'history'] as const

export type SmbSyncType = (typeof SYNC_TYPES)[number]
export interface SmbSyncResult {
  sync_type: SmbSyncType
  ok: boolean
  request_id: string | null
  erro: string | null
}

async function requestOne(phoneNumberId: string, syncType: SmbSyncType, tokens: string[]): Promise<SmbSyncResult> {
  let lastError = 'sem token'
  for (const token of tokens) {
    try {
      const r = await fetch(`${GRAPH_URL}/${phoneNumberId}/smb_app_data`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
        signal: AbortSignal.timeout(META_FETCH_TIMEOUT_MS),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && !d?.error) {
        return { sync_type: syncType, ok: true, request_id: d?.request_id ?? null, erro: null }
      }
      lastError = d?.error?.message || `HTTP ${r.status}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
  }
  console.warn(`[smb_app_data] ${syncType} falhou:`, lastError)
  return { sync_type: syncType, ok: false, request_id: null, erro: lastError.slice(0, 200) }
}

// Tokens em ordem de preferência (o da empresa recém-autorizada primeiro,
// depois o de sistema da plataforma). Nunca lança: devolve o resultado de
// cada pedido pra ir pro audit_logs.
export async function requestSmbAppSync(phoneNumberId: string, tokens: string[]): Promise<SmbSyncResult[]> {
  const usable = [...new Set(tokens.filter(Boolean))]
  const results: SmbSyncResult[] = []
  for (const syncType of SYNC_TYPES) {
    results.push(await requestOne(phoneNumberId, syncType, usable))
  }
  return results
}

export function summarizeSmbSync(results: SmbSyncResult[]): string {
  return results.map(r => `${r.sync_type}=${r.ok ? 'pedido' : `falhou (${r.erro})`}`).join('; ')
}
