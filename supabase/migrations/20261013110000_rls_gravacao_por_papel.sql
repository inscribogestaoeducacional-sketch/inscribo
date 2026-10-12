-- ============================================================================
-- 20261013110000_rls_gravacao_por_papel.sql
-- Fecha o risco de gravação por qualquer usuário da escola (achado de 12/10):
-- respostas rápidas, etiquetas, bloqueios, grupos, configuração do WhatsApp,
-- séries e o cadastro da escola aceitavam INSERT/UPDATE/DELETE de atendente.
-- Agora cada tabela exige o papel do item correspondente em
-- src/lib/settingsAccess.ts (a tela e o banco dizem a mesma coisa).
--
--   tabela                    | lê               | grava
--   --------------------------+------------------+----------------------------------
--   whatsapp_tags             | membro da escola | admin, gestor
--   whatsapp_blacklist        | membro da escola | admin, gestor
--   whatsapp_groups           | membro da escola | admin, gestor
--   school_grade_levels       | membro da escola | admin, gestor
--   whatsapp_quick_replies    | (sem mudança)    | a PRÓPRIA (qualquer papel); as da escola: admin, gestor
--   whatsapp_flows            | membro da escola | admin, gestor — colunas de Conexão/Horário só admin (gatilho)
--   institutions              | (sem mudança)    | admin, gestor — colunas por papel (gatilho); plano/cobrança/
--                             |                  | integrações só Super Admin ou servidor (service role)
--
-- Super Admin (is_super_admin_user) e a equipe da plataforma (users.user_type
-- = 'admin_geral') mantêm o acesso que já tinham. O servidor (service role:
-- webhook, edge functions, crons) não passa por RLS nem pelos gatilhos
-- (auth.uid() nulo).
-- NÃO APLICADA: ensaio em supabase/pendentes/rls_gravacao_por_papel_ensaio.sql.
-- ============================================================================

-- ── Funções de papel ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.user_school_role_in(p_institution_id uuid, p_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid() AND COALESCE(u.active, true)
       AND p_institution_id IN (u.institution_id, u.active_institution_id)
       AND u.role = ANY (p_roles)
  )
$$;
REVOKE ALL ON FUNCTION public.user_school_role_in(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_school_role_in(uuid, text[]) TO authenticated;

-- Membro (qualquer papel) — mesmo critério das políticas antigas, agora
-- também com a escola ativa de quem trabalha em mais de uma.
CREATE OR REPLACE FUNCTION public.user_is_school_member(p_institution_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = auth.uid()
       AND p_institution_id IN (u.institution_id, u.active_institution_id)
  )
$$;
REVOKE ALL ON FUNCTION public.user_is_school_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_school_member(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_is_platform_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT is_super_admin_user()
      OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.user_type = 'admin_geral')
$$;
REVOKE ALL ON FUNCTION public.user_is_platform_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_platform_staff() TO authenticated;

-- ── Tabelas simples: lê membro, grava admin/gestor ──────────────────────────
DO $p$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['whatsapp_tags', 'whatsapp_blacklist', 'whatsapp_groups', 'school_grade_levels'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_le', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insere', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_altera', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_apaga', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated
                      USING (user_is_school_member(institution_id) OR user_is_platform_staff())', t || '_le', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated
                      WITH CHECK (user_school_role_in(institution_id, ARRAY[''admin'',''manager'']) OR user_is_platform_staff())', t || '_insere', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
                      USING (user_school_role_in(institution_id, ARRAY[''admin'',''manager'']) OR user_is_platform_staff())
                      WITH CHECK (user_school_role_in(institution_id, ARRAY[''admin'',''manager'']) OR user_is_platform_staff())', t || '_altera', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
                      USING (user_school_role_in(institution_id, ARRAY[''admin'',''manager'']) OR user_is_platform_staff())', t || '_apaga', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $p$;
-- políticas antigas (permitiam tudo a qualquer membro)
DROP POLICY IF EXISTS "users can manage their institution tags" ON public.whatsapp_tags;
DROP POLICY IF EXISTS institution_isolation ON public.whatsapp_blacklist;
DROP POLICY IF EXISTS "users can manage own institution groups" ON public.whatsapp_groups;
DROP POLICY IF EXISTS "Users can access their institution grade levels" ON public.school_grade_levels;

-- ── Respostas rápidas: a própria qualquer um; as da escola só admin/gestor ──
-- (antes, "da escola" também valia pra atendente com can_see_all_conversations)
DROP POLICY IF EXISTS institution_isolation ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS quick_replies_insert ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS quick_replies_update ON public.whatsapp_quick_replies;
DROP POLICY IF EXISTS quick_replies_delete ON public.whatsapp_quick_replies;
CREATE POLICY quick_replies_insert ON public.whatsapp_quick_replies FOR INSERT TO authenticated
  WITH CHECK (institution_id = current_user_institution_id()
              AND (user_id = auth.uid()
                   OR (user_id IS NULL AND (user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff()))));
CREATE POLICY quick_replies_update ON public.whatsapp_quick_replies FOR UPDATE TO authenticated
  USING (institution_id = current_user_institution_id()
         AND (user_id = auth.uid() OR user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff()))
  WITH CHECK (institution_id = current_user_institution_id()
              AND (user_id = auth.uid() OR user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff()));
CREATE POLICY quick_replies_delete ON public.whatsapp_quick_replies FOR DELETE TO authenticated
  USING (institution_id = current_user_institution_id()
         AND (user_id = auth.uid() OR user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff()));
-- quick_replies_select e as *_pseudo_owner_* (Super Admin) ficam como estão.

-- ── Configuração do WhatsApp ────────────────────────────────────────────────
DROP POLICY IF EXISTS institution_isolation ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_isolation ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_safe ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_le ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_insere ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_altera ON public.whatsapp_flows;
DROP POLICY IF EXISTS whatsapp_flows_apaga ON public.whatsapp_flows;
CREATE POLICY whatsapp_flows_le ON public.whatsapp_flows FOR SELECT TO authenticated
  USING (user_is_school_member(institution_id) OR user_is_platform_staff());
CREATE POLICY whatsapp_flows_insere ON public.whatsapp_flows FOR INSERT TO authenticated
  WITH CHECK (user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff());
CREATE POLICY whatsapp_flows_altera ON public.whatsapp_flows FOR UPDATE TO authenticated
  USING (user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff())
  WITH CHECK (user_school_role_in(institution_id, ARRAY['admin','manager']) OR user_is_platform_staff());
CREATE POLICY whatsapp_flows_apaga ON public.whatsapp_flows FOR DELETE TO authenticated
  USING (user_school_role_in(institution_id, ARRAY['admin']) OR user_is_platform_staff());
REVOKE ALL ON public.whatsapp_flows FROM anon;

-- Gestor só mexe nos campos de Equipe (grupo/tempo de inatividade) e da
-- Avaliação do atendimento; Conexão, robô e Horário são do admin
-- (settingsAccess: whatsapp.conexao / whatsapp.horario).
CREATE OR REPLACE FUNCTION public.whatsapp_flows_guard_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_allowed text[] := ARRAY['timeout_minutes', 'timeout_group_id', 'timeout_assignee_id', 'timeout_assignee_name',
                            'timeout_message', 'satisfaction_survey_enabled', 'satisfaction_message', 'updated_at'];
  v_old jsonb; v_new jsonb; k text;
BEGIN
  IF auth.uid() IS NULL OR user_is_platform_staff()
     OR user_school_role_in(NEW.institution_id, ARRAY['admin']) THEN
    RETURN NEW;
  END IF;
  v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  FOREACH k IN ARRAY v_allowed LOOP v_old := v_old - k; v_new := v_new - k; END LOOP;
  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'Só o administrador altera conexão, robô e horário do WhatsApp'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_whatsapp_flows_guard_columns ON public.whatsapp_flows;
CREATE TRIGGER trg_whatsapp_flows_guard_columns
  BEFORE UPDATE ON public.whatsapp_flows
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_flows_guard_columns();

-- ── Cadastro da escola ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS inst_update_safe ON public.institutions;
CREATE POLICY inst_update_safe ON public.institutions FOR UPDATE
  USING ((id = get_my_institution_id() AND user_school_role_in(id, ARRAY['admin','manager'])) OR is_super_admin_user())
  WITH CHECK ((id = get_my_institution_id() AND user_school_role_in(id, ARRAY['admin','manager'])) OR is_super_admin_user());

-- Colunas por papel (o resto — plano, cobrança, consultor, rede, conexão do
-- WhatsApp/Evolution, nota fiscal — só Super Admin ou o servidor):
--   admin : Geral (nome, contato, CNPJ, cidade/UF), Identidade (logo/cores),
--           nome do atendente nas mensagens, INEP/IBGE, endereço, notificações
--   gestor: só o que o assistente da escola grava (cidade/UF, INEP/IBGE)
CREATE OR REPLACE FUNCTION public.institutions_guard_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_allowed text[];
  v_old jsonb; v_new jsonb; k text;
BEGIN
  IF auth.uid() IS NULL OR is_super_admin_user() THEN RETURN NEW; END IF;
  IF user_school_role_in(NEW.id, ARRAY['admin']) THEN
    v_allowed := ARRAY['name', 'email', 'phone', 'cnpj', 'city', 'state', 'address', 'logo_url', 'primary_color',
                       'secondary_color', 'show_agent_name_in_messages', 'inep_code', 'ibge_city_code',
                       'notification_settings', 'updated_at'];
  ELSIF user_school_role_in(NEW.id, ARRAY['manager']) THEN
    v_allowed := ARRAY['city', 'state', 'inep_code', 'ibge_city_code', 'updated_at'];
  ELSE
    RAISE EXCEPTION 'Sem permissão para alterar o cadastro da escola' USING ERRCODE = '42501';
  END IF;
  v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  FOREACH k IN ARRAY v_allowed LOOP v_old := v_old - k; v_new := v_new - k; END LOOP;
  IF v_old IS DISTINCT FROM v_new THEN
    RAISE EXCEPTION 'Campo do cadastro da escola que só a Áion altera (plano, cobrança, integrações)'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_institutions_guard_columns ON public.institutions;
CREATE TRIGGER trg_institutions_guard_columns
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW EXECUTE FUNCTION public.institutions_guard_columns();
