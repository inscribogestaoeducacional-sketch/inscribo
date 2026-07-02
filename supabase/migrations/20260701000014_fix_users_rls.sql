-- =============================================================================
-- 20260701000014_fix_users_rls.sql
-- Remove o bypass total em `users` (users_auth_all: FOR ALL TO authenticated
-- USING (true)) e fecha uma escalação de privilégio que sobrevive mesmo
-- sem ela.
--
-- LEVANTAMENTO (pg_policies ao vivo, não só migrations rastreadas — a
-- users_auth_all nem tem migration própria no repo, foi criada direto no
-- banco em algum momento):
--
--   users_auth_all                        FOR ALL   USING(true)                          <- remove
--   users_select_safe                     SELECT    institution match OR own row OR
--                                                    is_super_admin_user()                <- já correta, mantém
--   users_insert_own                      INSERT    auth.uid() = id                       <- já correta (signup em
--                                                                                             InitialSetup.tsx insere
--                                                                                             a própria linha)
--   "Admins can insert same institution"  INSERT    institution do admin logado           <- já correta (UserManagement.tsx
--                                                                                             cria atendente)
--   "Admins can update same institution"  UPDATE    institution do admin logado           <- já correta
--   "Super admins can update all users"   UPDATE    is_super_admin(email)                 <- já correta
--   users_update_own                      UPDATE    auth.uid() = id, SEM restrição de
--                                                    coluna                                <- PROBLEMA (ver abaixo)
--   "Admins can delete same institution"  DELETE    institution do admin logado           <- já correta
--   (nenhuma policy de DELETE pra admin_geral/super_admin)                                <- FALTA (InstitutionDetails.tsx
--                                                                                             deleta usuário de QUALQUER
--                                                                                             instituição, só funcionava
--                                                                                             hoje por causa da
--                                                                                             users_auth_all)
--
-- PROBLEMA REAL: RLS não sabe restringir por COLUNA, só por LINHA. A
-- policy `users_update_own` (auth.uid() = id) permite ao próprio usuário
-- atualizar QUALQUER coluna da própria linha — inclusive role,
-- institution_id, can_see_all_conversations, can_see_full_history,
-- user_type. Ou seja: mesmo derrubando só a users_auth_all, um atendente
-- comum ainda poderia fazer PATCH na própria linha e virar admin, ou se
-- autoconceder can_see_full_history/can_see_all_conversations — exatamente
-- o vazamento que este projeto inteiro vem corrigindo em whatsapp_messages.
-- Corrigir isso via RLS puro exigiria comparar NEW contra OLD dentro da
-- própria policy, o que o Postgres não expõe em USING/WITH CHECK (só em
-- triggers) — por isso a proteção por coluna é feita por trigger BEFORE
-- UPDATE, não por policy.
--
-- MAPEAMENTO DE USO (levantado no código antes de escrever isto, pra não
-- quebrar login/signup):
--   - Login (AuthContext.loadUserProfile) só lê a própria linha — não afetado.
--   - InitialSetup.tsx insere a própria linha (id = auth.uid()) — coberto
--     por users_insert_own, mantida.
--   - UserProfile.tsx / AdminProfile.tsx (self-edit) só tocam full_name e
--     phone — nunca role/institution_id/flags — não afetado pelo trigger.
--   - UserManagement.tsx, WhatsAppPermissionsPanel.tsx, SystemSettings.tsx,
--     InstitutionDetails.tsx, AdminConsultants.tsx (edição de OUTRO
--     usuário) são sempre admin/super-admin agindo — o trigger libera
--     esses campos quando quem está agindo é admin/manager/admin_geral/
--     consultant/super_admin.
--   - AuditModal.tsx precisa resolver full_name de outros IDs da mesma
--     instituição pra atendente comum — já coberto por users_select_safe
--     (institution match), que não foi tocada aqui.
--   - api/** e supabase/functions/** usam SUPABASE_SERVICE_ROLE_KEY (bypassa
--     RLS) — não afetados. A função create-user (usada por AdminConsultants/
--     AdminSchools/AdminCRM/InstitutionDetails pra criar OUTRO usuário) está
--     ACTIVE no projeto mas o código-fonte dela não está neste repo; não foi
--     possível confirmar 100% que usa service role — assumido que sim (é o
--     padrão pra Edge Functions que chamam auth.admin.createUser, e é a
--     única forma de criar a conta de OUTRA pessoa), mas fica registrado
--     como não verificado diretamente.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Remove o bypass total
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_auth_all" ON users;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Policy de DELETE que faltava pra admin_geral/consultant/super_admin
--    (mesmo critério já usado em users_select_safe pra esta tabela)
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins can delete all users" ON users;
CREATE POLICY "Super admins can delete all users" ON users
  FOR DELETE
  USING (is_super_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: barra escalação de privilégio por quem não é admin
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_role      TEXT;
  v_actor_can_admin BOOLEAN;
BEGIN
  SELECT role INTO v_actor_role FROM users WHERE id = auth.uid();

  v_actor_can_admin :=
    v_actor_role IN ('admin', 'manager')
    OR is_super_admin_user();

  IF NOT COALESCE(v_actor_can_admin, false) THEN
    NEW.role                      := OLD.role;
    NEW.institution_id            := OLD.institution_id;
    NEW.can_see_all_conversations := OLD.can_see_all_conversations;
    NEW.can_see_full_history      := OLD.can_see_full_history;
    NEW.user_type                 := OLD.user_type;
    NEW.active                    := OLD.active;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON users;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_privilege_escalation();
