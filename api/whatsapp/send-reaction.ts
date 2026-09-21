import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ── Auth inline — cópia de api/_lib/whatsappAuth.ts, sem import cross-file.
// Vercel apresentou ERR_MODULE_NOT_FOUND pra esse import em produção mesmo
// com o arquivo corretamente commitado/rastreado (nenhuma causa encontrada
// em git/.gitignore/.vercelignore/vercel.json) — suspeita de cache de build
// desatualizado no file-tracing da Vercel. Copiado aqui pra eliminar
// qualquer dependência de resolução de módulo entre arquivos de api/.
// api/_lib/whatsappAuth.ts continua existindo e sendo usado por
// embedded-signup.ts/template-definitions.ts.
let _authSupabaseAdmin: ReturnType<typeof createClient> | null = null
function getAuthSupabaseAdmin(): ReturnType<typeof createClient> {
  if (!_authSupabaseAdmin) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
    _authSupabaseAdmin = createClient(url, key, { auth: { persistSession: false } })
  }
  return _authSupabaseAdmin
}

interface InstitutionUserAuthContext {
  userId: string
  institutionId: string
  role: string | null
}

async function authenticateInstitutionUser(req: VercelRequest): Promise<InstitutionUserAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = getAuthSupabaseAdmin()
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabaseAuth
    .from('users')
    .select('role, user_type, institution_id, active_institution_id, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!row || !row.active) return null

  const institutionId: string | null = row.user_type === 'gestor_rede'
    ? row.active_institution_id
    : row.institution_id
  if (!institutionId) return null

  return { userId: data.user.id, institutionId, role: row.role ?? null }
}

interface SuperAdminAuthContext {
  userId: string
}

async function authenticateSuperAdmin(req: VercelRequest): Promise<SuperAdminAuthContext | null> {
  const authHeader = (req.headers.authorization || '') as string
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return null

  const supabaseAuth = getAuthSupabaseAdmin()
  const { data, error } = await supabaseAuth.auth.getUser(token)
  if (error || !data?.user) return null

  const { data: row } = await supabaseAuth
    .from('users')
    .select('user_type, active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!row || row.active === false) return null
  if (!['admin_geral', 'consultant'].includes(row.user_type as string)) return null

  return { userId: data.user.id }
}

const GRAPH_URL = 'https://graph.facebook.com/v25.0'

async function getAccessToken(supabase: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await supabase
    .from('platform_settings')
    .select('key, value')
    .in('key', ['wa_access_token'])
  const cfg: Record<string, string> = {}
  data?.forEach((r: any) => { cfg[r.key] = r.value })
  return cfg['wa_access_token'] || process.env.WA_ACCESS_TOKEN || ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { institution_id, message_id, emoji, remote_jid } = req.body ?? {}

  if (!message_id) return res.status(400).json({ error: 'message_id é obrigatório' })
  if (!remote_jid)  return res.status(400).json({ error: 'remote_jid é obrigatório' })

  // ── Auth — mesmo padrão de api/whatsapp/send.ts. institution_id ausente
  // já é, neste endpoint, o mesmo sinal que o resto do handler usa pra
  // decidir o caminho do Inbox Áion (ver resolução de phoneNumberId abaixo),
  // então reaproveita esse mesmo sinal pra escolher o papel exigido.
  try {
    if (!institution_id) {
      const auth = await authenticateSuperAdmin(req)
      if (!auth) return res.status(403).json({ error: 'Não autenticado ou sem permissão para reagir pelo Inbox Áion.' })
    } else {
      const auth = await authenticateInstitutionUser(req)
      if (!auth) return res.status(403).json({ error: 'Não autenticado.' })
      if (auth.institutionId !== institution_id) {
        return res.status(403).json({ error: 'institution_id não corresponde ao usuário autenticado.' })
      }
    }
  } catch (authErr: any) {
    console.error('❌ Reaction auth error:', authErr)
    return res.status(500).json({ error: 'Erro ao autenticar requisição' })
  }

  try {
    // ── Resolve phone_number_id ──
    let phoneNumberId: string
    let accessToken: string

    if (!institution_id) {
      // AionInbox path: use platform_whatsapp
      const { data: platformWA, error: platformErr } = await supabase
        .from('platform_whatsapp')
        .select('phone_number_id, access_token')
        .eq('connected', true)
        .single()

      if (platformErr || !platformWA) {
        return res.status(400).json({ error: 'WhatsApp da Áion não configurado ou desconectado' })
      }

      phoneNumberId = platformWA.phone_number_id
      accessToken   = platformWA.access_token
    } else {
      const { data: phoneRecord } = await supabase
        .from('whatsapp_phone_numbers')
        .select('phone_number_id')
        .eq('institution_id', institution_id)
        .eq('is_active', true)
        .maybeSingle()

      if (phoneRecord?.phone_number_id) {
        phoneNumberId = phoneRecord.phone_number_id
      } else {
        const { data: instRecord } = await supabase
          .from('institutions')
          .select('whatsapp_phone_id')
          .eq('id', institution_id)
          .maybeSingle()

        if (!instRecord?.whatsapp_phone_id) {
          return res.status(400).json({ error: 'Número WhatsApp não configurado para esta escola' })
        }
        phoneNumberId = instRecord.whatsapp_phone_id
      }

      accessToken = await getAccessToken(supabase)
      if (!accessToken) {
        return res.status(500).json({ error: 'Access token do WhatsApp não configurado' })
      }
    }

    // Strip @-suffix — Meta API expects plain phone number
    const to = remote_jid.replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')

    // ── Call Meta Cloud API ──
    const metaRes = await fetch(`${GRAPH_URL}/${phoneNumberId}/messages`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to,
        type: 'reaction',
        reaction: {
          message_id: message_id,
          emoji:      emoji || '',  // empty string removes the reaction
        },
      }),
    })

    const metaData = await metaRes.json()
    if (!metaRes.ok) {
      console.error('[send-reaction] Meta API error:', metaData)
      return res.status(500).json({ error: metaData.error?.message || 'Erro ao enviar reação' })
    }

    // ── Update DB ──
    await supabase
      .from('whatsapp_messages')
      .update({ reaction_attendant: emoji || null })
      .eq('message_id', message_id)
      .eq('institution_id', institution_id)

    console.log('[send-reaction] reação enviada:', emoji || '(removida)', '→', to, '| msg:', message_id)
    return res.status(200).json({ success: true })

  } catch (err: any) {
    console.error('[send-reaction] erro:', err?.message)
    return res.status(500).json({ error: err?.message || 'Erro interno' })
  }
}
