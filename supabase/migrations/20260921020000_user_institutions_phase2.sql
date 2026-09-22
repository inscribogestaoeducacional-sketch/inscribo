-- =============================================================================
-- 20260921020000_user_institutions_phase2.sql
-- Fase 2 de "usuário em múltiplas instituições": suporte SQL pro cadastro
-- inteligente (create-user reaproveitando conta por e-mail) e pra
-- generalização de switch_active_institution além do caso "gestor de rede".
-- Fase 1 (tabela user_institutions, trigger de sync, backfill) já está em
-- produção e não é recriada aqui.
-- =============================================================================

-- ── Lookup de conta existente por e-mail (só pro create-user) ───────────────
-- auth.users não é exposto via PostgREST — a edge function precisa desta
-- função (SECURITY DEFINER) pra descobrir se já existe conta com o e-mail
-- informado antes de decidir entre "criar conta nova" e "só adicionar
-- vínculo". Só service_role pode chamar (revoga de PUBLIC/authenticated):
-- expõe existência de contas por e-mail, não é pra ficar acessível via RPC
-- comum.
CREATE OR REPLACE FUNCTION public.get_auth_user_id_by_email(target_email TEXT)
 RETURNS UUID
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT id FROM auth.users WHERE email = target_email LIMIT 1;
$function$;

-- REVOKE explícito de anon/authenticated: o Supabase concede EXECUTE em
-- funções novas diretamente a essas roles via ALTER DEFAULT PRIVILEGES (não
-- via PUBLIC) — "REVOKE ALL FROM PUBLIC" sozinho não bloqueia.
REVOKE ALL ON FUNCTION public.get_auth_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_user_id_by_email(TEXT) TO service_role;

-- ── switch_active_institution generalizado ──────────────────────────────────
-- Validação original (20260812001000_school_groups.sql): só permitia trocar
-- pra uma instituição do MESMO school_group_id do usuário (gestor de rede).
-- Generalização: permite trocar TAMBÉM quando existe vínculo direto em
-- user_institutions pra esse user_id + institution_id (mecanismo novo, sem
-- exigir grupo escolar). As duas validações são independentes (OR) — o
-- caminho do gestor de rede continua exatamente como era, incluindo pra
-- usuários que não têm nenhuma linha em user_institutions (backfill da Fase
-- 1 excluiu de propósito quem tem institution_id NULL).
--
-- Além disso, depois de atualizar active_institution_id, agora também "toca"
-- a linha correspondente em user_institutions (quando ela existe) só pra
-- disparar trg_sync_active_user_institution (Fase 1) e atualizar o cache em
-- users (institution_id/role/flags) pra refletir a instituição recém-
-- selecionada. Sem isso, trocar de instituição só mudava
-- active_institution_id e as ~27 tabelas de RLS que ainda leem
-- users.institution_id direto ficariam vendo a instituição errada até a
-- próxima escrita em user_institutions. Pra quem só tem o caminho de grupo
-- (sem linha em user_institutions), não há o que tocar — comportamento
-- idêntico ao de antes (institution_id em users continua NULL pra esses
-- usuários, como já era).
CREATE OR REPLACE FUNCTION public.switch_active_institution(target_institution_id UUID)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  my_group_id UUID;
  target_group_id UUID;
  has_direct_link BOOLEAN;
BEGIN
  SELECT school_group_id INTO my_group_id FROM users WHERE id = auth.uid();
  SELECT school_group_id INTO target_group_id FROM institutions WHERE id = target_institution_id;

  SELECT EXISTS (
    SELECT 1 FROM user_institutions
    WHERE user_id = auth.uid() AND institution_id = target_institution_id AND active = true
  ) INTO has_direct_link;

  IF NOT has_direct_link AND (my_group_id IS NULL OR target_group_id IS DISTINCT FROM my_group_id) THEN
    RAISE EXCEPTION 'Usuário não tem vínculo com esta instituição.';
  END IF;

  UPDATE users SET active_institution_id = target_institution_id WHERE id = auth.uid();

  UPDATE user_institutions
    SET updated_at = now()
    WHERE user_id = auth.uid() AND institution_id = target_institution_id;
END;
$function$;
