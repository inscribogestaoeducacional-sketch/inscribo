-- =============================================================================
-- 20260701000011_fix_visibility_snapshot_trigger.sql
-- Segunda causa raiz do vazamento (a primeira foi 20260701000010 — policies
-- legadas permissivas). Confirmado ao vivo: mesmo com whatsapp_messages_select
-- correta e sem policy legada nenhuma, o Luan CONTINUAVA vendo as mensagens
-- de abril/maio via o branch de whatsapp_message_visibility — ele tinha
-- grants permanentes ali para essas mensagens, criados pelo próprio sistema.
--
-- CAUSA: snapshot_visibility_on_transfer() (20260701000000_whatsapp_permissions.sql)
-- roda BEFORE UPDATE OF assigned_user_id e, quando alguém SAI de uma
-- conversa (OLD.assigned_user_id preenchido, mudando), grava em
-- whatsapp_message_visibility acesso permanente a TODAS as mensagens
-- daquele remote_jid, sem nenhum corte — mesmo que o PRÓPRIO OLD attendant
-- só devesse enxergar a partir do transferred_at que estava em vigor
-- quando ele assumiu (ou tivesse can_see_full_history = false).
--
-- Isso não importava enquanto o corte por transferência não funcionava (o
-- vazamento já existia por outro caminho). Agora que 20260701000008-010
-- corrigiram o corte de verdade, esse trigger virou a fonte do vazamento:
-- toda vez que alguém SAI de uma conversa, ele recebe um passe permanente
-- pra tudo, que ressurge se essa mesma pessoa for reatribuída à mesma
-- conversa depois — foi exatamente o que aconteceu com o Luan: a conversa
-- foi transferida pra longe dele e de volta (em produção, entre os testes)
-- e o grant de saída de antes ressuscitou o histórico de abril/maio que
-- ele nunca deveria ter visto em primeiro lugar sob o corte atual.
--
-- FIX:
-- 1. snapshot_visibility_on_transfer() passa a respeitar, na hora de
--    conceder o grant de saída, o MESMO corte que valia pro OLD attendant
--    (OLD.transferred_at / can_see_full_history dele) — só grava
--    visibilidade pro que ele realmente podia ver.
-- 2. Limpeza pontual: remove os grants indevidos já criados pra este caso
--    reportado (Luan, conversa do Victor Almeida) que cobrem mensagens
--    anteriores ao corte que estava em vigor pra ele.
--
-- ESCOPO NÃO COBERTO AQUI: pode haver grants antigos, de OUTRAS conversas/
-- atendentes, criados por esse mesmo trigger antes desta correção, que
-- também são mais amplos do que deveriam. Uma limpeza retroativa completa
-- exigiria reconstruir o transferred_at que estava em vigor pra cada
-- atendente em cada grant histórico (via whatsapp_conversation_events), o
-- que não foi feito aqui — fica registrado como pendência separada.
-- =============================================================================

CREATE OR REPLACE FUNCTION snapshot_visibility_on_transfer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_jid           TEXT;
  v_old_can_see_full   BOOLEAN;
BEGIN
  IF NEW.assigned_user_id IS DISTINCT FROM OLD.assigned_user_id
     AND OLD.assigned_user_id IS NOT NULL THEN
    v_base_jid := whatsapp_base_jid(OLD.remote_jid);

    SELECT can_see_full_history INTO v_old_can_see_full
    FROM users WHERE id = OLD.assigned_user_id;

    -- Só concede visibilidade permanente ao que o atendente que está
    -- saindo realmente podia ver: histórico completo se ele tinha
    -- can_see_full_history = true, senão só a partir do corte que estava
    -- em vigor pra ele (OLD.transferred_at).
    INSERT INTO whatsapp_message_visibility (institution_id, message_id, visible_to_user_id)
    SELECT wm.institution_id, wm.id, OLD.assigned_user_id
    FROM whatsapp_messages wm
    WHERE wm.institution_id = OLD.institution_id
      AND whatsapp_base_jid(wm.remote_jid) = v_base_jid
      AND (
        COALESCE(v_old_can_see_full, false)
        OR OLD.transferred_at IS NULL
        OR wm.timestamp >= OLD.transferred_at
      )
    ON CONFLICT (message_id, visible_to_user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Limpeza pontual do caso reportado: remove grants do Luan, nesta conversa,
-- para mensagens anteriores ao corte que estava em vigor quando ele foi
-- transferido pra fora dela (2026-07-02 02:04:28, sem can_see_full_history).
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM whatsapp_message_visibility wmv
USING whatsapp_messages wm
WHERE wmv.message_id = wm.id
  AND wmv.visible_to_user_id = 'e57a8414-40ab-486d-b47d-25f310b7b115'
  AND whatsapp_base_jid(wm.remote_jid) = whatsapp_base_jid('558396035018')
  AND wm.timestamp < '2026-07-02 02:04:28.541+00'::timestamptz;
