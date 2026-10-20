import type { VercelRequest, VercelResponse } from '@vercel/node'
import { errorResponse } from '../_lib/whatsappAuth.js'
import { handleReconnect, handleReconnectEvent } from '../_lib/whatsappReconnect.js'
import { resolveConnectContext, type ConnectAuthDeps, type ConnectContext } from '../_lib/whatsappConnectAuth.js'
import { runConnect, defaultConnectDeps, type ConnectDeps } from '../_lib/whatsappConnect.js'

// ── Cadastro Incorporado (Embedded Signup) da Meta ──────────────────────────
// Segunda forma de conectar o WhatsApp de uma escola, além do formulário
// manual que só o superadmin usa (handleSaveWa em AdminSchools.tsx). Chamado
// pelo painel do gestor da escola (Configurações → WhatsApp) e pela ficha da
// escola no Super Admin (InstitutionDetails → WhatsApp), onde a equipe Áion
// conecta a escola em chamada de vídeo, com a escola lendo o QR code.
//
// Body: { code?, phone_number_id, waba_id, institution_id?, mode?, event? }
//   - code: retornado pelo popup FB.login(). Pode faltar: a Meta às vezes fecha
//     o popup sem ele com o número já conectado. Sem code, só admin_geral
//     conclui (api/_lib/whatsappConnect.ts confere a conta no portfólio da Áion).
//   - phone_number_id / waba_id: do evento WA_EMBEDDED_SIGNUP (FINISH).
//   - institution_id: só vale para Super Admin.
//   - event: só registro (clique, resultado do popup, FINISH, verificação antes
//     do popup) — api/_lib/whatsappReconnect.ts.
//
// IMPORTANTE — invariante de segurança (api/_lib/whatsappConnectAuth.ts):
// admin de escola conecta só a própria escola, resolvida pelo token de sessão;
// `institution_id` do corpo só é aceito de Super Admin. Roteiro e teste
// automático em embedded-signup.SECURITY_TEST.md.
export function createEmbeddedSignupHandler(authDeps?: ConnectAuthDeps, connectDeps: ConnectDeps = defaultConnectDeps) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return errorResponse(res, 405, 'Method not allowed')

    const auth = await resolveConnectContext(req, authDeps)
    if ('status' in auth) return errorResponse(res, auth.status, auth.message)
    return connect(req, res, auth.ctx, connectDeps)
  }
}

export default createEmbeddedSignupHandler()

async function connect(req: VercelRequest, res: VercelResponse, ctx: ConnectContext, deps: ConnectDeps) {
  // Reconexão em coexistência de escola que já tem número (api/_lib/whatsappReconnect.ts)
  if (req.body?.event) return handleReconnectEvent(res, ctx, req.body)
  if (req.body?.mode === 'reconnect') return handleReconnect(res, ctx, req.body)

  const { code, phone_number_id, waba_id } = req.body || {}
  const out = await runConnect(ctx, { code, phone_number_id, waba_id }, deps)
  return res.status(out.status).json(out.body)
}
