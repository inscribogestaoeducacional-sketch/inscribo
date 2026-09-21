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

// Só o header de Authorization, sem Content-Type — pra upload multipart
// (FormData), onde o browser precisa setar o Content-Type sozinho (com o
// boundary correto); sobrescrever manualmente pra 'application/json' quebra
// o upload.
export async function getBearerHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sessão expirada — faça login novamente.')
  return { Authorization: `Bearer ${session.access_token}` }
}
