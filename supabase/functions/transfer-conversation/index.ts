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
      .select('id, institution_id, remote_jid, contact_name, assigned_user_id, assigned_user_name, status, last_message_at')
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
      .select('id, institution_id, active, full_name')
      .eq('id', newUserId)
      .maybeSingle()

    if (!targetUser || !targetUser.active || targetUser.institution_id !== institutionId) {
      return new Response(JSON.stringify({ error: 'Usuário de destino inválido para esta instituição' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Dono anterior lido do banco (não do corpo da requisição): é ele que
    // aparece na linha de sistema e recebe o aviso.
    const prevOwnerId   = conv.assigned_user_id as string | null
    const prevOwnerName = (conv.assigned_user_name as string | null) || null
    const { data: callerRow } = await admin.from('users').select('full_name, email').eq('id', callerId).maybeSingle()
    const callerName = callerRow?.full_name || callerRow?.email || fromUserName || 'Alguém'
    const targetName = targetUser.full_name || newUserName

    // ── 5. Update com service role — o trigger trg_snapshot_visibility_on_transfer
    //    continua disparando normalmente (é um trigger de tabela, roda
    //    independente de qual role fez o UPDATE), preservando o acesso do
    //    atendente anterior ao histórico como sempre fez. ──
    // unread_count = 1: a conversa chega como nova (não lida) pra quem recebe.
    // Não preserva o contador acumulado: whatsapp_messages_select só libera
    // pro novo dono restrito mensagens com timestamp >= transferred_at, então
    // o número antigo contaria mensagens que ele nem consegue ver.
    const updatePayload: Record<string, unknown> = {
      assigned_user_id:   newUserId,
      assigned_user_name: targetName,
      transferred_at:     new Date().toISOString(),
      unread_count:       1,
      // Transferida pra um humano: robô desligado e 'open' — inclusive a
      // partir de 'closed' ("Atribuir" numa concluída reabre pro destino).
      bot_active:         false,
      status:             'open',
    }
    if (prevOwnerId) updatePayload.transferred_from = prevOwnerId

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

    // ── 6. Evento e avisos gravados aqui, no servidor — antes o navegador
    //    gravava o evento depois, e ele se perdia se a aba fechasse. ──
    const contactLabel = conv.contact_name || String(conv.remote_jid)
    const description = prevOwnerId
      ? `Transferida de ${prevOwnerName || 'outro atendente'} para ${targetName}`
      : `Transferida da fila para ${targetName}`
    const { error: eventErr } = await admin.from('whatsapp_conversation_events').insert({
      institution_id: institutionId,
      remote_jid:     raw,
      event_type:     'transfer',
      description:    callerId !== prevOwnerId && callerId !== newUserId ? `${description} (por ${callerName})` : description,
      user_id:        callerId,
      user_name:      callerName,
      metadata:       { from_user_id: prevOwnerId, to_user_id: newUserId, by_user_id: callerId },
    })
    if (eventErr) console.error('[transfer-conversation] event error:', eventErr.message)

    const notifications: Record<string, unknown>[] = []
    if (newUserId !== callerId) {
      notifications.push({
        user_id: newUserId, institution_id: institutionId, type: 'conversation_transferred',
        title: `${callerName} transferiu uma conversa para você`, body: contactLabel,
        remote_jid: conv.remote_jid, conversation_id: conv.id, actor_user_id: callerId,
      })
    }
    if (prevOwnerId && prevOwnerId !== callerId && prevOwnerId !== newUserId) {
      notifications.push({
        user_id: prevOwnerId, institution_id: institutionId, type: 'conversation_taken',
        title: `${callerName} transferiu uma conversa sua para ${targetName}`, body: contactLabel,
        remote_jid: conv.remote_jid, conversation_id: conv.id, actor_user_id: callerId,
      })
    }
    if (notifications.length) {
      const { error: notifErr } = await admin.from('user_notifications').insert(notifications)
      if (notifErr) console.error('[transfer-conversation] notification error:', notifErr.message)
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
