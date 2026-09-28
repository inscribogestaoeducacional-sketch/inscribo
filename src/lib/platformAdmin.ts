// Chamadas à Edge Function platform-admin: tudo que usa o token global da
// Meta ou segredos da plataforma roda lá. O navegador nunca lê
// platform_settings.wa_access_token (nem outros segredos) — só recebe o
// resultado da operação, e segredos só mascarados.
import { supabase } from './supabase'

export class PlatformAdminError extends Error {}

export async function platformAdmin<T = any>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await supabase.functions.invoke('platform-admin', { body: { action, ...body } })
  if (!res.error) return res.data as T
  // invoke devolve só "non-2xx" no erro — a mensagem real vem no corpo.
  let message = res.error.message || 'Erro inesperado'
  try {
    const b = await (res.error as any).context?.json?.()
    if (b?.error) message = String(b.error)
  } catch { /* corpo não-JSON */ }
  throw new PlatformAdminError(message)
}

export interface MaskedSecret { set: boolean; masked: string; length: number }
