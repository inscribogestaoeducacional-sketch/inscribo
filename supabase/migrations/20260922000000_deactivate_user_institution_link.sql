-- =============================================================================
-- 20260922000000_deactivate_user_institution_link.sql
-- Corrige "excluir usuário de uma instituição": as duas telas que tinham
-- botão de excluir (UserManagement.tsx "Equipe" e InstitutionDetails.tsx no
-- Super Admin) faziam DELETE FROM users direto, o que:
--   1. Estourava violação de FK (23503) pra qualquer usuário com histórico
--      mínimo (leads.assigned_to, consultant_commissions.consultant_id,
--      whatsapp_conversations.assigned_user_id e ~15 outras colunas sem
--      ON DELETE CASCADE/SET NULL) — a ação nunca funcionava de verdade.
--   2. Mesmo se funcionasse, apagaria a conta em TODAS as instituições onde
--      o usuário tem vínculo (user_institutions.user_id é ON DELETE CASCADE),
--      não só na instituição de onde o admin está removendo — errado no
--      modelo de múltiplas instituições da Fase 1/2.
-- Diagnóstico completo + proposta de comportamento validados com o usuário
-- antes desta migration. Novo comportamento: "excluir" vira "desativar o
-- vínculo" (user_institutions.active = false) — reversível, preserva
-- histórico, não mexe em auth.users nem nos outros vínculos da pessoa.
-- =============================================================================

-- ── RPC: deactivate_user_institution_link ───────────────────────────────────
-- Único caminho permitido pro front-end pra "remover" um usuário de uma
-- instituição. Faz o que duas chamadas separadas do cliente (checar
-- pendências + desativar) não conseguem fazer com segurança: SECURITY
-- DEFINER pra enxergar TODOS os leads/conversas do usuário-alvo nesta
-- instituição, mesmo que o admin que está removendo tenha visibilidade
-- restrita (ex.: can_see_all_conversations=false não pode esconder um lead
-- em aberto que ficaria órfão). A checagem de autorização é feita
-- manualmente dentro da função (mesmo critério de
-- user_institutions_delete): quem chama precisa ser admin/manager da
-- instituição alvo ou super admin.
--
-- Retorna (success, pending_leads, pending_conversations):
--   - Se houver lead em aberto (status fora de 'enrolled'/'lost') ou
--     conversa de WhatsApp não encerrada (status <> 'closed') atribuídos ao
--     usuário NESTA instituição, NÃO desativa nada — devolve success=false
--     e as contagens, pro front-end mostrar "transfira antes de remover"
--     com o número exato.
--   - Caso contrário, desativa o vínculo (active=false) e devolve
--     success=true.
CREATE OR REPLACE FUNCTION public.deactivate_user_institution_link(p_user_id UUID, p_institution_id UUID)
 RETURNS TABLE(success BOOLEAN, pending_leads INT, pending_conversations INT)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_can_manage BOOLEAN;
  v_pending_leads INT;
  v_pending_conversations INT;
  v_rows_updated INT;
BEGIN
  v_can_manage :=
    current_user_role_in_institution(p_institution_id) IN ('admin', 'manager')
    OR is_super_admin_user();

  IF NOT COALESCE(v_can_manage, false) THEN
    RAISE EXCEPTION 'Sem permissão para remover vínculo desta instituição.';
  END IF;

  SELECT count(*) INTO v_pending_leads
    FROM leads
    WHERE assigned_to = p_user_id
      AND institution_id = p_institution_id
      AND status NOT IN ('enrolled', 'lost');

  SELECT count(*) INTO v_pending_conversations
    FROM whatsapp_conversations
    WHERE assigned_user_id = p_user_id
      AND institution_id = p_institution_id
      AND status <> 'closed';

  IF v_pending_leads > 0 OR v_pending_conversations > 0 THEN
    RETURN QUERY SELECT false, v_pending_leads, v_pending_conversations;
    RETURN;
  END IF;

  UPDATE user_institutions
    SET active = false, updated_at = now()
    WHERE user_id = p_user_id
      AND institution_id = p_institution_id
      AND active = true;
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Vínculo não encontrado ou já estava inativo.';
  END IF;

  RETURN QUERY SELECT true, 0, 0;
END;
$function$;

REVOKE ALL ON FUNCTION public.deactivate_user_institution_link(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_user_institution_link(UUID, UUID) TO authenticated;

-- ── Trigger de sync: resolve o cache quando o vínculo ATIVO é desativado ───
-- A versão original (20260921010000_user_institutions.sql) só sabia
-- espelhar user_institutions -> users quando o vínculo alterado continuava
-- ativo. Ao desativar o vínculo que hoje é o refletido em
-- users.institution_id/role/etc (via deactivate_user_institution_link
-- acima), o cache ficava apontando pra uma instituição da qual o usuário
-- não faz mais parte — e como ~27 policies de RLS em outras tabelas leem
-- esse cache direto (não user_institutions), o usuário ficaria com o
-- front-end mostrando uma instituição enquanto o banco bloqueava tudo dela,
-- ou pior, continuaria com RLS liberado numa instituição da qual já foi
-- removido.
--
-- Duas mudanças:
--   1. Ao desativar o vínculo ativo: procura outro vínculo ativo da pessoa
--      pra virar o novo cache; se não sobrar nenhum, zera (NULL) — usuário
--      sem instituição nenhuma até ganhar um vínculo novo.
--   2. Ao (re)ativar um vínculo enquanto o cache está vazio (NULL) — caso
--      de alguém sendo reativado numa escola depois de ter sido removido de
--      todas: adota esse vínculo como o novo ativo automaticamente, mesmo
--      padrão que o front-end (AuthContext.loadUserProfile) já usa quando a
--      pessoa tem exatamente 1 vínculo. Sem isso, reativar deixaria a
--      pessoa "visível" na tela mas ainda bloqueada por RLS até algum outro
--      evento tocar o cache.
CREATE OR REPLACE FUNCTION public.sync_active_user_institution_to_users()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_active_institution_id UUID;
  v_current_institution_id UUID;
  v_target_institution_id UUID;
  v_fallback RECORD;
BEGIN
  SELECT active_institution_id, institution_id
    INTO v_active_institution_id, v_current_institution_id
    FROM users WHERE id = NEW.user_id;

  v_target_institution_id := COALESCE(v_active_institution_id, v_current_institution_id);

  IF NEW.active AND (NEW.institution_id = v_target_institution_id OR v_target_institution_id IS NULL) THEN
    UPDATE users SET
      institution_id             = NEW.institution_id,
      active_institution_id      = COALESCE(v_active_institution_id, NEW.institution_id),
      role                       = NEW.role,
      can_see_all_conversations  = NEW.can_see_all_conversations,
      can_see_full_history       = NEW.can_see_full_history,
      is_available               = NEW.is_available,
      working_hours_start        = NEW.working_hours_start,
      working_hours_end          = NEW.working_hours_end,
      working_days               = NEW.working_days,
      updated_at                 = now()
    WHERE id = NEW.user_id
      AND (
        institution_id             IS DISTINCT FROM NEW.institution_id
        OR active_institution_id     IS DISTINCT FROM COALESCE(v_active_institution_id, NEW.institution_id)
        OR role                       IS DISTINCT FROM NEW.role
        OR can_see_all_conversations IS DISTINCT FROM NEW.can_see_all_conversations
        OR can_see_full_history      IS DISTINCT FROM NEW.can_see_full_history
        OR is_available               IS DISTINCT FROM NEW.is_available
        OR working_hours_start       IS DISTINCT FROM NEW.working_hours_start
        OR working_hours_end         IS DISTINCT FROM NEW.working_hours_end
        OR working_days              IS DISTINCT FROM NEW.working_days
      );

  ELSIF NOT NEW.active AND NEW.institution_id = v_target_institution_id THEN
    SELECT * INTO v_fallback
      FROM user_institutions
      WHERE user_id = NEW.user_id
        AND active = true
        AND institution_id IS DISTINCT FROM NEW.institution_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

    IF FOUND THEN
      UPDATE users SET
        institution_id             = v_fallback.institution_id,
        active_institution_id      = v_fallback.institution_id,
        role                       = v_fallback.role,
        can_see_all_conversations  = v_fallback.can_see_all_conversations,
        can_see_full_history       = v_fallback.can_see_full_history,
        is_available               = v_fallback.is_available,
        working_hours_start        = v_fallback.working_hours_start,
        working_hours_end          = v_fallback.working_hours_end,
        working_days               = v_fallback.working_days,
        updated_at                 = now()
      WHERE id = NEW.user_id;
    ELSE
      UPDATE users SET
        institution_id        = NULL,
        active_institution_id = NULL,
        updated_at             = now()
      WHERE id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ── RPC: list_institution_removed_users ──────────────────────────────────────
-- Lista de "removidos desta escola" (pra reativar). Não dá pra fazer isso com
-- um SELECT direto do cliente em user_institutions + join em users: a RLS de
-- users (users_select_safe) só libera a linha se users.institution_id
-- (CACHE da instituição ATIVA) bater com a do admin logado — e um usuário
-- removido, se tiver outro vínculo ativo em outra instituição, tem o cache
-- apontando pra lá, não mais pra esta. O join silenciosamente voltaria
-- full_name/email nulos. SECURITY DEFINER pra sempre enxergar o nome/e-mail
-- de quem foi removido, independente de qual instituição está no cache dele
-- agora.
CREATE OR REPLACE FUNCTION public.list_institution_removed_users(p_institution_id UUID)
 RETURNS TABLE(user_id UUID, full_name TEXT, email TEXT)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT (
    current_user_role_in_institution(p_institution_id) IN ('admin', 'manager')
    OR is_super_admin_user()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ver usuários removidos desta instituição.';
  END IF;

  RETURN QUERY
    SELECT ui.user_id, u.full_name, u.email
    FROM user_institutions ui
    JOIN users u ON u.id = ui.user_id
    WHERE ui.institution_id = p_institution_id
      AND ui.active = false
    ORDER BY u.full_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.list_institution_removed_users(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_institution_removed_users(UUID) TO authenticated;
