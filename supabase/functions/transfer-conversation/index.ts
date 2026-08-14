// @ts-nocheck
// Contorna o 42501 "new row violates row-level security policy for table
// whatsapp_conversations" ao atualizar assigned_user_id, que persistiu
// mesmo depois de esgotada toda a investigação possível via SQL (policy
// relaxada pra `true`, todos os triggers dessa tabela desligados um a um e
// juntos, FK dropada, grants de coluna conferidos, índice removido — nada
// mudou o resultado). Em vez de continuar tentando decifrar isso por RLS,
// esta function faz a atualização com a service role (que sempre ignora
// RLS) e valida manualmente, em código, exatamente as mesmas regras que a
// policy de UPDATE de whatsapp_conversations já expressa — então a
// segurança da operação não depende de RLS estar funcionando nessa tabela.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '')
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!
    const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente com a chave anônima + o JWT de quem chamou, só pra confirmar
    // que o token é válido e descobrir quem é o usuário — nenhuma escrita
    // passa por este cliente.
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })
    const { data: authData, error: authError } = await authClient.auth.getUser()
    if (authError || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida ou expirada' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const callerId = authData.user.id

    // Cliente com service role — bypassa RLS. Toda leitura/escrita a
    // partir daqui usa este cliente; a autorização é feita manualmente
    // abaixo, não pelo Postgres.
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

    const body = await req.json()
    const { institutionId, remoteJid, newUserId, newUserName, fromUserId, fromUserName } = body

    if (!institutionId || !remoteJid || !newUserId || !newUserName) {
      return new Response(JSON.stringify({ error: 'institutionId, remoteJid, newUserId e newUserName são obrigatórios' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 1. Quem está chamando: role, institution_id e flags de permissão ──
    const { data: caller, error: callerErr } = await admin
      .from('users')
      .select('id, institution_id, role, user_type, can_see_all_conversations, active')
      .eq('id', callerId)
      .maybeSingle()

    if (callerErr || !caller || !caller.active) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado ou inativo' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Mesmo critério de user_can_see_all_conversations() (20260701000000).
    const canSeeAll =
      caller.role === 'admin' ||
      caller.role === 'manager' ||
      caller.user_type === 'admin_geral' ||
      caller.can_see_all_conversations === true

    // Corta imediatamente se o caller nem pertence à instituição que ele
    // está alegando — institutionId do payload nunca é usado sozinho pra
    // decidir nada, só depois de bater com o institution_id real do
    // usuário lido do banco.
    if (caller.institution_id !== institutionId && !canSeeAll) {
      return new Response(JSON.stringify({ error: 'Usuário não pertence a esta instituição' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. A conversa: mesma lógica de matching de remote_jid usada em
    //    DatabaseService.transferConversation (src/lib/supabase.ts) —
    //    cobre tanto o formato cru (Meta Cloud API) quanto o sufixado
    //    com @s.whatsapp.net (Evolution/Baileys) numa única query. ──
    const raw  = String(remoteJid).replace(/@s\.whatsapp\.net$/, '').replace(/@g\.us$/, '')
    const norm = `${raw}@s.whatsapp.net`

    const { data: conv, error: convErr } = await admin
      .from('whatsapp_conversations')
      .select('id, institution_id, assigned_user_id, status, last_message_at')
      .eq('institution_id', institutionId)
      .in('remote_jid', [raw, norm])
      .maybeSingle()

    if (convErr || !conv) {
      return new Response(JSON.stringify({ error: 'Conversa não encontrada' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Autorização — replica USING de whatsapp_conversations_update:
    //    admin/liberado, dono atual, fila sem dono, ou resgate de conversa
    //    parada (mesmo cálculo de stale_conversation_hours do RLS). ──
    let authorized = canSeeAll || conv.assigned_user_id === callerId
    if (!authorized && !conv.assigned_user_id && conv.status === 'waiting') {
      authorized = true
    }
    if (!authorized && conv.assigned_user_id && conv.assigned_user_id !== callerId && conv.status === 'waiting') {
      const { data: flow } = await admin
        .from('whatsapp_flows')
        .select('stale_conversation_hours')
        .eq('institution_id', institutionId)
        .maybeSingle()
      const staleHours = flow?.stale_conversation_hours ?? 24
      if (conv.last_message_at) {
        const ageMs = Date.now() - new Date(conv.last_message_at).getTime()
        authorized = ageMs > staleHours * 3600 * 1000
      }
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Você não tem permissão para transferir esta conversa' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. O novo responsável precisa ser da mesma instituição ──
    const { data: targetUser } = await admin
      .from('users')
      .select('id, institution_id, active')
      .eq('id', newUserId)
      .maybeSingle()

    if (!targetUser || !targetUser.active || targetUser.institution_id !== institutionId) {
      return new Response(JSON.stringify({ error: 'Usuário de destino inválido para esta instituição' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // ── 5. Update com service role — o trigger trg_snapshot_visibility_on_transfer
    //    continua disparando normalmente (é um trigger de tabela, roda
    //    independente de qual role fez o UPDATE), preservando o acesso do
    //    atendente anterior ao histórico como sempre fez. ──
    // unread_count zerado aqui: sem isso, o contador acumulado antes da
    // transferência sobrevive no badge do novo atendente, mas
    // whatsapp_messages_select só libera pra ele mensagens com
    // timestamp >= transferred_at — as mensagens que geraram aquele contador
    // ficam invisíveis, então o badge mostra "não lidas" que não existem
    // pra quem está olhando.
    const updatePayload: Record<string, unknown> = {
      assigned_user_id:   newUserId,
      assigned_user_name: newUserName,
      transferred_at:     new Date().toISOString(),
      unread_count:       0,
    }
    if (fromUserId) updatePayload.transferred_from = fromUserId

    const { error: updateErr } = await admin
      .from('whatsapp_conversations')
      .update(updatePayload)
      .eq('id', conv.id)

    if (updateErr) {
      console.error('[transfer-conversation] update error:', updateErr.message)
      return new Response(JSON.stringify({ error: updateErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[transfer-conversation]', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
