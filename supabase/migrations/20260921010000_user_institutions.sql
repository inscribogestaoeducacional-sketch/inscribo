-- =============================================================================
-- 20260921010000_user_institutions.sql
-- Fase 1 de "usuário em múltiplas instituições, com cargo diferente em cada
-- uma": SÓ schema, RLS da tabela nova e migração de dado (backfill). Login,
-- UI (seletor/tela de seleção) e as ~27 policies legadas que ainda leem
-- users.institution_id direto (ver comentário no fim) ficam para as
-- próximas fases — não são tocadas aqui.
--
-- Estratégia de baixo risco: users.institution_id/role/can_see_all_conversations/
-- can_see_full_history/is_available/working_hours_* continuam existindo e
-- passam a ser um CACHE do vínculo "ativo" do usuário em user_institutions,
-- mantido por trigger. Isso significa que TODAS as ~27 tabelas com RLS que
-- hoje leem institution_id direto de users continuam funcionando sem
-- nenhuma alteração — o cache é escrito de volta pelo trigger de sync
-- sempre que o vínculo ativo muda.
-- =============================================================================

-- ── Drift documentado ────────────────────────────────────────────────────────
-- As 3 policies abaixo existem hoje no banco de produção mas NUNCA tiveram
-- CREATE POLICY versionado neste repo (foram criadas direto via SQL editor
-- em algum momento entre 20260701000014 e 20260701000015). Capturado via
-- `supabase db query --linked` em 2026-09-21, ANTES de qualquer alteração
-- desta migration, para não perder esse conhecimento. Esta migration NÃO
-- altera nenhuma das três — só documenta.
--
-- contracts (cmd ALL, permissive, roles {public}):
--   CREATE POLICY "contracts_safe" ON contracts
--     USING ((institution_id = get_my_institution_id()) OR is_super_admin_user());
--
-- payments (cmd ALL, permissive, roles {public}):
--   CREATE POLICY "payments_select_safe" ON payments
--     USING ((institution_id = get_my_institution_id()) OR is_super_admin_user());
--
-- users (cmd SELECT, permissive, roles {public}):
--   CREATE POLICY "users_select_safe" ON users
--     FOR SELECT USING (
--       (institution_id = get_my_institution_id())
--       OR (id = auth.uid())
--       OR is_super_admin_user()
--     );
--
-- Todas as três dependem de get_my_institution_id()/is_super_admin_user(),
-- ou seja, já se beneficiam automaticamente de qualquer generalização futura
-- dessas funções — não precisam ser recriadas quando isso acontecer, só
-- confirmadas contra este comentário.

-- ── Tabela user_institutions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_institutions (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_id              UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  role                        TEXT        NOT NULL CHECK (role IN ('admin','manager','user')),
  can_see_all_conversations   BOOLEAN     NOT NULL DEFAULT false,
  can_see_full_history        BOOLEAN     NOT NULL DEFAULT false,
  is_available                BOOLEAN     NOT NULL DEFAULT true,
  working_hours_start         TEXT,
  working_hours_end           TEXT,
  working_days                TEXT[],
  active                      BOOLEAN     NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_user_institutions_user ON user_institutions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_institutions_institution ON user_institutions(institution_id);

-- ── Helper: role do usuário logado numa instituição específica ─────────────
-- SECURITY DEFINER pra poder ler user_institutions (que tem RLS habilitado
-- logo abaixo) sem recursão — mesmo padrão já usado por
-- current_user_institution_id()/get_my_institution_id() pra ler `users`.
CREATE OR REPLACE FUNCTION public.current_user_role_in_institution(target_institution_id UUID)
 RETURNS TEXT
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT role FROM user_institutions
  WHERE user_id = auth.uid()
    AND institution_id = target_institution_id
    AND active = true
  LIMIT 1;
$function$;

-- ── RLS de user_institutions ─────────────────────────────────────────────────
ALTER TABLE user_institutions ENABLE ROW LEVEL SECURITY;

-- Usuário vê o próprio vínculo; admin/manager da instituição vê os vínculos
-- dela; super admin vê tudo.
DROP POLICY IF EXISTS "user_institutions_select" ON user_institutions;
CREATE POLICY "user_institutions_select" ON user_institutions
  FOR SELECT USING (
    user_id = auth.uid()
    OR current_user_role_in_institution(institution_id) IN ('admin','manager')
    OR is_super_admin_user()
  );

-- Criar vínculo é ação de gestão (evita que um usuário se auto-vincule a
-- qualquer instituição) — só admin/manager da instituição alvo ou super admin.
DROP POLICY IF EXISTS "user_institutions_insert" ON user_institutions;
CREATE POLICY "user_institutions_insert" ON user_institutions
  FOR INSERT WITH CHECK (
    current_user_role_in_institution(institution_id) IN ('admin','manager')
    OR is_super_admin_user()
  );

-- Usuário pode atualizar o próprio vínculo (ex: is_available, working_hours —
-- ver trigger de anti-escalação abaixo pra saber o que fica bloqueado nessa
-- auto-edição); admin/manager da instituição gerencia qualquer vínculo dela;
-- super admin gerencia tudo.
DROP POLICY IF EXISTS "user_institutions_update" ON user_institutions;
CREATE POLICY "user_institutions_update" ON user_institutions
  FOR UPDATE USING (
    user_id = auth.uid()
    OR current_user_role_in_institution(institution_id) IN ('admin','manager')
    OR is_super_admin_user()
  ) WITH CHECK (
    user_id = auth.uid()
    OR current_user_role_in_institution(institution_id) IN ('admin','manager')
    OR is_super_admin_user()
  );

-- Remover vínculo é ação de gestão — só admin/manager da instituição ou super
-- admin (usuário comum não se desvincula sozinho nesta fase).
DROP POLICY IF EXISTS "user_institutions_delete" ON user_institutions;
CREATE POLICY "user_institutions_delete" ON user_institutions
  FOR DELETE USING (
    current_user_role_in_institution(institution_id) IN ('admin','manager')
    OR is_super_admin_user()
  );

-- ── Backfill ─────────────────────────────────────────────────────────────────
-- Todo usuário com institution_id preenchido hoje ganha exatamente 1 vínculo
-- em user_institutions, espelhando o que já tinha — zero mudança de
-- comportamento. Usuários gestor_rede (institution_id NULL, escolhem a
-- unidade via school_group_id/active_institution_id) ficam de fora desta
-- fase de propósito: generalizar esse mecanismo pra também virar N vínculos
-- em user_institutions é trabalho de uma fase futura, não deste backfill.
INSERT INTO user_institutions (
  user_id, institution_id, role, can_see_all_conversations, can_see_full_history,
  is_available, working_hours_start, working_hours_end, working_days, active
)
SELECT
  id, institution_id, role, can_see_all_conversations, can_see_full_history,
  COALESCE(is_available, true), working_hours_start, working_hours_end, working_days,
  COALESCE(active, true)
FROM users
WHERE institution_id IS NOT NULL
ON CONFLICT (user_id, institution_id) DO NOTHING;

-- ── Trigger de sincronização (cache em users) ───────────────────────────────
-- Quando o vínculo alterado em user_institutions é o que corresponde à
-- instituição ATIVA do usuário (active_institution_id, ou o institution_id
-- atual de users se active_institution_id for NULL — mesmo COALESCE de
-- current_user_institution_id()/get_my_institution_id()), espelha
-- role/permissões de volta pra users. Isso é o que permite que as ~27
-- tabelas com RLS "institution_id = (SELECT institution_id FROM users ...)"
-- continuem funcionando sem nenhuma alteração enquanto não forem migradas
-- pra ler o vínculo diretamente.
--
-- Limitação conhecida (fora de escopo nesta fase): trocar de instituição via
-- switch_active_institution() só atualiza users.active_institution_id — não
-- dispara este trigger (que escuta mudanças em user_institutions, não em
-- users) nem re-sincroniza o cache pra refletir a nova instituição ativa.
-- Isso precisa ser resolvido na fase de login/troca de instituição.
CREATE OR REPLACE FUNCTION public.sync_active_user_institution_to_users()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_active_institution_id UUID;
  v_current_institution_id UUID;
BEGIN
  SELECT active_institution_id, institution_id
    INTO v_active_institution_id, v_current_institution_id
    FROM users WHERE id = NEW.user_id;

  IF NEW.institution_id = COALESCE(v_active_institution_id, v_current_institution_id) THEN
    UPDATE users SET
      institution_id             = NEW.institution_id,
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
        institution_id            IS DISTINCT FROM NEW.institution_id
        OR role                       IS DISTINCT FROM NEW.role
        OR can_see_all_conversations IS DISTINCT FROM NEW.can_see_all_conversations
        OR can_see_full_history      IS DISTINCT FROM NEW.can_see_full_history
        OR is_available               IS DISTINCT FROM NEW.is_available
        OR working_hours_start       IS DISTINCT FROM NEW.working_hours_start
        OR working_hours_end         IS DISTINCT FROM NEW.working_hours_end
        OR working_days              IS DISTINCT FROM NEW.working_days
      );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_active_user_institution ON user_institutions;
CREATE TRIGGER trg_sync_active_user_institution
  AFTER INSERT OR UPDATE ON user_institutions
  FOR EACH ROW EXECUTE FUNCTION sync_active_user_institution_to_users();

-- ── Trigger de anti-autopromoção em user_institutions ───────────────────────
-- Equivalente a prevent_self_privilege_escalation() (que já protege a linha
-- de `users`), mas avaliando a autoridade do ator NA INSTITUIÇÃO DO VÍNCULO
-- sendo editado (não o role global) — assim um usuário que é 'user' na
-- instituição A não consegue se promover editando o próprio vínculo em A,
-- mesmo que seja 'admin' em outra instituição B.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation_user_institutions()
 RETURNS TRIGGER
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_actor_can_admin BOOLEAN;
BEGIN
  v_actor_can_admin :=
    current_user_role_in_institution(NEW.institution_id) IN ('admin', 'manager')
    OR is_super_admin_user();

  IF NOT COALESCE(v_actor_can_admin, false) THEN
    NEW.user_id                   := OLD.user_id;
    NEW.institution_id            := OLD.institution_id;
    NEW.role                      := OLD.role;
    NEW.can_see_all_conversations := OLD.can_see_all_conversations;
    NEW.can_see_full_history      := OLD.can_see_full_history;
    NEW.active                    := OLD.active;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation_user_institutions ON user_institutions;
CREATE TRIGGER trg_prevent_self_privilege_escalation_user_institutions
  BEFORE UPDATE ON user_institutions
  FOR EACH ROW EXECUTE FUNCTION prevent_self_privilege_escalation_user_institutions();
