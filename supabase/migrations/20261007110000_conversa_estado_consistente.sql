-- 20261007110000_conversa_estado_consistente.sql
--
-- Modelo de status do Inbox (conversas de escola):
--   waiting = sem atendente (robô ou fila geral)
--   open    = atendente humano atendendo (robô desligado)
--   closed  = encerrada (robô desligado)
--
-- Vários caminhos gravavam combinações contraditórias — 'waiting' COM dono
-- (cron de timeout antigo, reabertura recente, envio agendado,
-- transferência de conversa em fila), 'open' SEM dono (toggle "Robô",
-- resposta a template), 'open' com dono e robô ligado (assumir/transferir
-- antes da correção 20261007100000) e 'closed' com robô ligado. 'waiting'
-- com dono some da fila de todo mundo menos do dono; 'open' sem dono some
-- da fila "Aguardando".
--
-- 1. Backup das linhas que a limpeza vai mudar (tabela de apoio, sem acesso
--    pela API — RLS ligado e nenhuma policy).
-- 2. Trigger BEFORE INSERT/UPDATE que normaliza qualquer escrita futura,
--    de qualquer caminho (webhook, cron, edge functions, frontend):
--      com dono e não encerrada → 'open' + robô desligado
--      sem dono e 'open'        → 'waiting'
--      'closed'                 → robô desligado
--    Não mexe em Inbox Áion, grupos nem em status fora do modelo. A
--    reabertura pelo webhook grava 'waiting' ANTES de religar o robô, então
--    a regra de 'closed' não a atrapalha.
-- 3. Limpeza das linhas contraditórias já existentes. 'waiting' com dono
--    depende de atividade humana: com mensagem de atendente
--    (sender_user_id preenchido) nos últimos 7 dias vira 'open' e mantém o
--    dono; sem isso volta pra fila (sem dono) com robô desligado — ligado,
--    o cron process_bot_timeouts a reatribuiria na hora.
--
-- Efeito colateral aceito: o RLS deixava atendente restrito ver/resgatar
-- conversa de colega só quando ela estava 'waiting' COM dono e parada —
-- estado que deixa de existir. Resgate continua pra quem vê todas as
-- conversas (admin/gestor/can_see_all_conversations).

-- ── 1. Backup ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations_backup_20261007
  (LIKE public.whatsapp_conversations);
ALTER TABLE public.whatsapp_conversations_backup_20261007
  ADD COLUMN IF NOT EXISTS backup_reason TEXT,
  ADD COLUMN IF NOT EXISTS backed_up_at  TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.whatsapp_conversations_backup_20261007 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversations_backup_20261007 FROM anon, authenticated;

INSERT INTO public.whatsapp_conversations_backup_20261007
SELECT c.*,
       CASE
         WHEN c.status = 'waiting' AND c.assigned_user_id IS NOT NULL THEN
           CASE WHEN EXISTS (
             SELECT 1 FROM public.whatsapp_messages m
             WHERE m.institution_id = c.institution_id
               AND m.base_jid = c.base_jid
               AND m.from_me
               AND m.sender_user_id IS NOT NULL
               AND m."timestamp" > now() - interval '7 days'
           ) THEN 'waiting_com_dono_recente' ELSE 'waiting_com_dono_antiga' END
         WHEN c.status = 'open'    AND c.assigned_user_id IS NULL     THEN 'open_sem_dono'
         WHEN c.status = 'closed'                                     THEN 'closed_robo_ligado'
         ELSE 'open_dono_robo_ligado'
       END,
       now()
FROM public.whatsapp_conversations c
WHERE NOT COALESCE(c.is_aion_inbox, false)
  AND c.remote_jid NOT LIKE '%@g.us'
  AND (
       (c.status = 'waiting' AND c.assigned_user_id IS NOT NULL)
    OR (c.status = 'open'    AND c.assigned_user_id IS NULL)
    OR (c.status = 'open'    AND c.assigned_user_id IS NOT NULL AND c.bot_active)
    OR (c.status = 'closed'  AND c.bot_active)
  );

-- ── 2. Trigger de consistência ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.whatsapp_conversations_normalize_state()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF COALESCE(NEW.is_aion_inbox, false) OR NEW.remote_jid LIKE '%@g.us' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('waiting', 'open') THEN
    IF NEW.assigned_user_id IS NOT NULL THEN
      NEW.status     := 'open';
      NEW.bot_active := false;
    ELSIF NEW.status = 'open' THEN
      NEW.status := 'waiting';
    END IF;
  ELSIF NEW.status = 'closed' THEN
    NEW.bot_active := false;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_normalize_conversation_state ON public.whatsapp_conversations;
CREATE TRIGGER trg_normalize_conversation_state
  BEFORE INSERT OR UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_conversations_normalize_state();

-- ── 3. Limpeza ───────────────────────────────────────────────────────────────
-- 'waiting' com dono antiga: volta pra fila, sem dono e sem robô.
UPDATE public.whatsapp_conversations c
SET assigned_user_id   = NULL,
    assigned_user_name = NULL,
    status             = 'waiting',
    bot_active         = false
WHERE c.id IN (SELECT b.id FROM public.whatsapp_conversations_backup_20261007 b
               WHERE b.backup_reason = 'waiting_com_dono_antiga');

-- Demais casos: as próprias regras da trigger resolvem (com dono → 'open'
-- sem robô; 'open' sem dono → 'waiting'; 'closed' → sem robô). O SET
-- explícito deixa a limpeza independente da trigger.
UPDATE public.whatsapp_conversations c
SET status     = CASE WHEN c.status = 'closed' THEN 'closed'
                      WHEN c.assigned_user_id IS NOT NULL THEN 'open'
                      ELSE 'waiting' END,
    bot_active = CASE WHEN c.status = 'closed' OR c.assigned_user_id IS NOT NULL THEN false
                      ELSE c.bot_active END
WHERE c.id IN (SELECT b.id FROM public.whatsapp_conversations_backup_20261007 b
               WHERE b.backup_reason <> 'waiting_com_dono_antiga');
