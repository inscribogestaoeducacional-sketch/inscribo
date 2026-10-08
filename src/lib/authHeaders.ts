// src/lib/authHeaders.ts
//
// Headers com o Bearer token da sessão atual, pra endpoints de api/whatsapp/
// que agora exigem autenticação (ver api/_lib/whatsappAuth.ts). Mesmo padrão
// já usado em AdminWhatsAppTemplates.tsx (authHeaders local) — centralizado
// aqui pra ser reaproveitado pelos vários chamadores de /api/whatsapp/send.
import { supabase } from './supabase'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
}

// /api/ai com o Bearer da sessão (o endpoint exige login e cobra cota da
// escola). Mesma assinatura do fetch, só sem a URL. Sem sessão, lança erro
// — os chamadores já tratam falha de rede/HTTP no catch.
export async function aiFetch(init: RequestInit): Promise<Response> {
  const auth = await getBearerHeader()
  return fetch('/api/ai', {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined), ...auth },
  })
}

// Só o header de Authorization, sem Content-Type — pra upload multipart
// (FormData), onde o browser precisa setar o Content-Type sozinho (com o
// boundary correto); sobrescrever manualmente pra 'application/json' quebra
// o upload.
export async function getBearerHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')
  return { Authorization: `Bearer ${session.access_token}` }
}
