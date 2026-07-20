-- =============================================================================
-- 20260720000000_document_is_super_admin_user_function.sql
-- DOCUMENTAÇÃO DE DRIFT — não altera comportamento nenhum.
--
-- `is_super_admin_user()` já está ATIVA em produção e é usada por várias
-- policies RLS desde 20260701000014_fix_users_rls.sql (linhas 80, 98) e
-- 20260701000015_fix_legacy_true_policies.sql (linha 86), mas nunca teve um
-- `CREATE FUNCTION` próprio em nenhuma migration deste repositório — foi
-- criada direto no banco em algum momento, fora do controle de versão
-- (mesma situação já registrada para a Edge Function `create-user` em
-- 20260701000014_fix_users_rls.sql, linhas 58-65).
--
-- Esta migration só traz o código-fonte real, hoje em produção, para dentro
-- do repo, usando `CREATE OR REPLACE FUNCTION` — reaplicá-la sobre a função
-- já existente é um no-op. Não é o passo de consolidação role/user_type/
-- super_admins em si (isso fica para uma migration futura, planejada à
-- parte); é só o pré-requisito de segurança: não dá pra tocar em nenhuma
-- policy que dependa desta função sem primeiro saber exatamente o que ela
-- verifica.
--
-- COMPORTAMENTO DOCUMENTADO (confirmado com o código-fonte de produção):
-- retorna true se o usuário autenticado (`auth.uid()`) tem uma linha em
-- `users` com `user_type IN ('admin_geral', 'consultant')` — ou seja, tanto
-- admin geral quanto consultor são tratados como "super admin" para efeito
-- de RLS. Não consulta a tabela `super_admins` nem a coluna `role`.
--
-- NOTA DE ESTILO: `is_super_admin(user_email text)` (20250923124346_
-- quiet_king.sql, linha 61) usa `LANGUAGE plpgsql` com bloco BEGIN/END.
-- A função abaixo é mantida em `LANGUAGE sql` porque é assim que ela existe
-- de fato em produção hoje — alterar para plpgsql aqui seria documentar uma
-- função diferente da que roda no banco, o que este arquivo existe
-- justamente para evitar. `SECURITY DEFINER` já bate com o padrão do
-- projeto (mesmo padrão de `is_super_admin`, `get_current_user_email`,
-- `prevent_self_privilege_escalation`).
-- =============================================================================

CREATE OR REPLACE FUNCTION is_super_admin_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND user_type IN ('admin_geral', 'consultant')
    LIMIT 1
  );
$$;
