import type { VercelRequest } from '@vercel/node'
import { authenticateSchoolAdmin, authenticateSuperAdmin, getSupabaseAdmin } from './whatsappAuth.js'

// ── Quem pode conectar o WhatsApp de qual escola ────────────────────────────
// Usado por api/whatsapp/embedded-signup.ts (conexão, reconexão e eventos do
// popup). Regras:
//   - Super Admin (authenticateSuperAdmin: user_type admin_geral/consultant)
//     conecta QUALQUER escola, informando `institution_id` no corpo — é como
//     a equipe da Áion conecta a escola em chamada de vídeo, pela ficha dela.
//   - Admin da escola conecta só a PRÓPRIA escola, resolvida pelo token de
//     sessão. Se mandar `institution_id` de outra escola, é recusado (403) —
//     nunca "escolhe" outra escola.
//   - Qualquer outro usuário (atendente, sem login, token inválido): 403.
//
// As dependências vêm por parâmetro só pra o teste automático
// (embedded-signup.security.test.ts) rodar sem banco nem rede.

export type ConnectActor = 'superadmin' | 'school_admin'

export interface ConnectContext {
  institutionId: string
  userId: string
  actor: ConnectActor
}

export type ConnectAuthResult =
  | { ok: true; ctx: ConnectContext }
  | { ok: false; status: number; message: string }

export interface ConnectAuthDeps {
  authenticateSuperAdmin: (req: VercelRequest) => Promise<{ userId: string } | null>
  authenticateSchoolAdmin: (req: VercelRequest) => Promise<{ userId: string; institutionId: string } | null>
  institutionExists: (institutionId: string) => Promise<boolean>
}

async function institutionExists(institutionId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('institutions').select('id').eq('id', institutionId).maybeSingle()
  return !!data?.id
}

const defaultDeps: ConnectAuthDeps = { authenticateSuperAdmin, authenticateSchoolAdmin, institutionExists }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function resolveConnectContext(
  req: VercelRequest, deps: ConnectAuthDeps = defaultDeps,
): Promise<ConnectAuthResult> {
  const raw = req.body?.institution_id
  const requested = typeof raw === 'string' ? raw.trim() : ''

  // Com escola no corpo: só Super Admin escolhe a escola.
  if (requested) {
    const superAdmin = await deps.authenticateSuperAdmin(req)
    if (superAdmin) {
      if (!UUID_RE.test(requested) || !(await deps.institutionExists(requested))) {
        return { ok: false, status: 404, message: 'Escola não encontrada' }
      }
      return { ok: true, ctx: { institutionId: requested, userId: superAdmin.userId, actor: 'superadmin' } }
    }
    // Admin da escola mandando o próprio id: aceito (é a escola dele mesmo).
    const schoolAdmin = await deps.authenticateSchoolAdmin(req)
    if (schoolAdmin && schoolAdmin.institutionId === requested) {
      return { ok: true, ctx: { ...schoolAdmin, actor: 'school_admin' } }
    }
    return { ok: false, status: 403, message: 'Sem permissão para conectar o WhatsApp desta escola' }
  }

  // Sem escola no corpo: a escola é a do admin logado.
  const schoolAdmin = await deps.authenticateSchoolAdmin(req)
  if (schoolAdmin) return { ok: true, ctx: { ...schoolAdmin, actor: 'school_admin' } }
  return { ok: false, status: 403, message: 'Apenas o admin da escola ou a equipe Áion pode conectar o WhatsApp desta instituição' }
}

// ── Conta (WABA) devolvida pelo popup numa conexão nova ─────────────────────
// Mesma regra de src/lib/whatsappSaveGuard.ts (resolveWabaForSave), repetida
// aqui porque api/ não importa de src/: a conta já salva da escola nunca é
// trocada, e o WABA da plataforma (platform_settings.wa_waba_id, que é o de
// TESTE — caso Universo 19/10/2026) nunca vira o WABA de uma escola.
export function checkPopupWaba(
  popupWabaId: string, savedWabaId: string | null | undefined, platformWabaId: string | null | undefined,
): { ok: true } | { ok: false; motivo: string; message: string } {
  const popup = String(popupWabaId || '').trim()
  const saved = String(savedWabaId || '').trim()
  const platform = String(platformWabaId || '').trim()
  if (!popup) {
    return { ok: false, motivo: 'sem_waba', message: 'A Meta não devolveu a conta (WABA). Nada foi alterado.' }
  }
  if (platform && popup === platform) {
    return {
      ok: false, motivo: 'waba_da_plataforma',
      message: `A conta escolhida (${popup}) é a conta de teste da Áion, não a da escola. Nada foi alterado.`,
    }
  }
  if (saved && popup !== saved) {
    return {
      ok: false, motivo: 'waba_diferente',
      message: `A conta escolhida (${popup}) não é a conta desta escola (${saved}). Nada foi alterado. Refaça escolhendo a conta já existente.`,
    }
  }
  return { ok: true }
}
