// IA de escrita do WhatsApp (modelo pequeno, uso limitado por dia). O servidor
// confere login, escola e limite; aqui só chamamos e devolvemos texto.
import { aiFetch } from './authHeaders'

export type ImproveMode = 'fix' | 'warm' | 'short' | 'persuade' | 'custom'

async function call(action: 'wa_improve' | 'wa_summary', payload: Record<string, unknown>): Promise<string> {
  let resp: Response
  try { resp = await aiFetch({ method: 'POST', body: JSON.stringify({ action, payload }) }) }
  catch { throw new Error('Sem conexão. Tente de novo.') }
  const json = await resp.json().catch(() => ({} as any))
  if (!resp.ok || typeof json.result !== 'string') throw new Error(json.error || 'A IA não respondeu agora. Tente de novo.')
  return json.result
}

export const improveText = (text: string, mode: ImproveMode, instruction?: string, institutionId?: string) =>
  call('wa_improve', { text, mode, instruction, institutionId })

export const summarizeConversation = (conversationId: string, institutionId?: string) =>
  call('wa_summary', { conversationId, institutionId })
