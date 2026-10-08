-- 20261008100000_assumir_conversa_notificacoes.sql
--
-- Etapas 2 e 3 do Inbox: assumir conversa com regra no servidor, troca de
-- dono só por caminho autorizado, e notificação por usuário.
--
-- 1. user_notifications — aviso por pessoa (transferência recebida, conversa
--    assumida por outro). Cada um só lê/marca como lida as próprias; ninguém
--    insere pelo cliente (só funções SECURITY DEFINER e service role).
--    Entra na publicação do Realtime: o canal respeita o RLS, então cada
--    usuário só recebe as suas.
-- 2. assume_conversation(remote_jid, force, reason) — regra aprovada:
--      sem dono               → qualquer um que enxerga a conversa assume
--      dono = outro, admin/gestor (role admin|manager, admin_geral) → assume
--      dono = outro, can_see_all_conversations → só com force (confirmação)
--      dono = outro, atendente restrito → recusado (pede transferência)
--    Atualiza dono/status/robô, grava o evento e avisa o dono anterior na
--    MESMA transação.
-- 3. Trava de dono (trigger BEFORE INSERT/UPDATE): pelo cliente
--    (auth.role() = 'authenticated') o dono só muda de nenhum → eu (assumir
--    da fila) ou de alguém → nenhum quando sou o dono ou admin/gestor (sair do
--    atendimento, devolver ao robô/fila). Trocar de uma pessoa pra outra só
--    pela RPC (marca app.owner_change_ok na transação) ou pela edge function
--    transfer-conversation (service role). Webhook/cron/edge (service role) e
--    Inbox Áion não passam pela trava. A policy de UPDATE continua igual
--    (quem enxerga a conversa pode editar tags, notas, status...); a trava é
--    por trigger porque policy não compara valor antigo com novo.

-- ── 1. Notificações por usuário ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  institution_id  UUID        REFERENCES public.institutions(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT,
  remote_jid      TEXT,
  conversation_id UUID,
  actor_user_id   UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON public.user_notifications (user_id, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_notifications_select ON public.user_notifications;
CREATE POLICY user_notifications_select ON public.user_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS user_notifications_update ON public.user_notifications;
CREATE POLICY user_notifications_update ON public.user_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.user_notifications FROM anon, authenticated;
GRANT SELECT ON public.user_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.user_notifications TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;

-- ── 2. Trava de troca de dono ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_is_inbox_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND (u.role IN ('admin', 'manager') OR u.user_type = 'admin_geral')
  ) OR is_super_admin(get_current_user_email());
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_conversations_guard_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Só chamadas do cliente; service role (webhook, cron, edge functions) e
  -- SQL direto passam. Inbox Áion tem fluxo próprio.
  IF auth.role() IS DISTINCT FROM 'authenticated' OR COALESCE(NEW.is_aion_inbox, false) THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.owner_change_ok', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_user_id IS NOT NULL AND NEW.assigned_user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Não é possível criar conversa atribuída a outra pessoa.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.assigned_user_id IS NOT DISTINCT FROM OLD.assigned_user_id THEN
    RETURN NEW;
  END IF;
  -- Assumir da fila.
  IF OLD.assigned_user_id IS NULL AND NEW.assigned_user_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  -- Soltar (sair do atendimento, devolver ao robô/fila): dono ou admin/gestor.
  IF NEW.assigned_user_id IS NULL AND (OLD.assigned_user_id = auth.uid() OR public.user_is_inbox_manager()) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'A troca de atendente só pode ser feita por "Assumir conversa" ou "Transferir".' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_conversation_owner ON public.whatsapp_conversations;
CREATE TRIGGER trg_guard_conversation_owner
  BEFORE INSERT OR UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_conversations_guard_owner();

-- ── 3. assume_conversation ───────────────────────────────────────────────────
-- Identifica a conversa pelo remote_jid (cru ou com @s.whatsapp.net) na
-- escola ativa de quem chama — é a chave que o Hub tem em mãos; o id da linha
-- não existe pra conversas recém-criadas na tela.
CREATE OR REPLACE FUNCTION public.assume_conversation(
  p_remote_jid TEXT,
  p_force      BOOLEAN DEFAULT false,
  p_reason     TEXT    DEFAULT NULL   -- 'rescue' grava o evento como resgate
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_me         RECORD;
  v_conv       RECORD;
  v_my_name    TEXT;
  v_prev_id    UUID;
  v_prev_name  TEXT;
  v_manager    BOOLEAN;
  v_desc       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT id, full_name, email, active, COALESCE(can_see_all_conversations, false) AS can_see_all
    INTO v_me FROM users WHERE id = v_uid;
  IF v_me.id IS NULL OR v_me.active IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuário inativo.' USING ERRCODE = '42501';
  END IF;
  v_my_name := COALESCE(NULLIF(v_me.full_name, ''), v_me.email);
  v_manager := public.user_is_inbox_manager();

  SELECT * INTO v_conv FROM whatsapp_conversations
  WHERE institution_id = public.current_user_institution_id()
    AND remote_jid IN (regexp_replace(p_remote_jid, '@s\.whatsapp\.net$', ''),
                       regexp_replace(p_remote_jid, '@s\.whatsapp\.net$', '') || '@s.whatsapp.net')
    AND NOT COALESCE(is_aion_inbox, false)
  ORDER BY last_message_at DESC NULLS LAST
  LIMIT 1
  FOR UPDATE;

  IF v_conv.id IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada.' USING ERRCODE = 'P0002';
  END IF;

  v_prev_id   := v_conv.assigned_user_id;
  v_prev_name := v_conv.assigned_user_name;

  IF v_prev_id = v_uid THEN
    RETURN jsonb_build_object('status', 'already_mine');
  END IF;

  IF v_prev_id IS NOT NULL THEN
    IF NOT v_manager THEN
      IF NOT v_me.can_see_all THEN
        RAISE EXCEPTION 'Esta conversa está com %. Peça a transferência a um gestor.', COALESCE(v_prev_name, 'outro atendente')
          USING ERRCODE = '42501';
      END IF;
      IF NOT p_force THEN
        RETURN jsonb_build_object('status', 'needs_confirmation', 'owner_id', v_prev_id, 'owner_name', v_prev_name);
      END IF;
    END IF;
  END IF;

  PERFORM set_config('app.owner_change_ok', 'on', true);
  UPDATE whatsapp_conversations
     SET assigned_user_id   = v_uid,
         assigned_user_name = v_my_name,
         status             = 'open',
         bot_active         = false,
         assigned_at        = now(),
         transferred_from   = CASE WHEN v_prev_id IS NOT NULL THEN v_prev_id ELSE transferred_from END,
         transferred_at     = CASE WHEN v_prev_id IS NOT NULL THEN now()     ELSE transferred_at END
   WHERE id = v_conv.id;
  PERFORM set_config('app.owner_change_ok', 'off', true);

  v_desc := CASE
    WHEN p_reason = 'rescue' AND v_prev_id IS NOT NULL THEN format('%s resgatou a conversa de %s', v_my_name, COALESCE(v_prev_name, 'outro atendente'))
    WHEN v_prev_id IS NOT NULL THEN format('%s assumiu a conversa (estava com %s)', v_my_name, COALESCE(v_prev_name, 'outro atendente'))
    ELSE format('%s assumiu a conversa', v_my_name)
  END;

  INSERT INTO whatsapp_conversation_events (institution_id, remote_jid, event_type, description, user_id, user_name, metadata)
  VALUES (v_conv.institution_id,
          regexp_replace(v_conv.remote_jid, '@(s\.whatsapp\.net|g\.us)$', ''),
          CASE WHEN p_reason = 'rescue' AND v_prev_id IS NOT NULL THEN 'rescue' ELSE 'assignment' END,
          v_desc, v_uid, v_my_name,
          jsonb_build_object('from_user_id', v_prev_id, 'to_user_id', v_uid, 'forced', p_force));

  IF v_prev_id IS NOT NULL THEN
    INSERT INTO user_notifications (user_id, institution_id, type, title, body, remote_jid, conversation_id, actor_user_id)
    VALUES (v_prev_id, v_conv.institution_id, 'conversation_taken',
            format('%s assumiu uma conversa sua', v_my_name),
            COALESCE(v_conv.contact_name, v_conv.remote_jid),
            v_conv.remote_jid, v_conv.id, v_uid);
  END IF;

  RETURN jsonb_build_object('status', 'assumed', 'previous_owner_id', v_prev_id, 'previous_owner_name', v_prev_name);
END;
$function$;

REVOKE ALL ON FUNCTION public.assume_conversation(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assume_conversation(TEXT, BOOLEAN, TEXT) TO authenticated;
