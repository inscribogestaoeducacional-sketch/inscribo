-- =============================================================================
-- Fecha a leitura aberta de institutions.
--
-- Antes (conferido em pg_policies/pg_class ao vivo em 2026-09-28):
--   - temp_authenticated_select (SELECT USING true, authenticated) deixava
--     QUALQUER usuário logado ler todas as escolas, com whatsapp_token e
--     evolution_key.
--   - A view institutions_safe (dona postgres, sem security_invoker) ignorava
--     a RLS de institutions e tinha GRANT ALL pra anon: sem login dava pra
--     LER e ALTERAR (view auto-atualizável) as 8 escolas — inclusive
--     plan_status. Nenhum código usa a view.
--   - anon tinha todos os privilégios de tabela em institutions (só a falta
--     de policy segurava).
--
-- Depois:
--   - Leitura: Super Admin; a escola do próprio usuário (institution_id ou
--     active_institution_id); escolas com vínculo ativo em user_institutions
--     (seletor de escola do AuthContext); escolas do mesmo grupo escolar
--     (gestor de rede legado, AuthContext); escolas do consultor
--     (consultant_id — ConsultantHome/ConsultantContracts e os joins
--     institutions(name) de contratos/comissões/treinamentos, que só
--     apontam pra escolas do próprio consultor).
--   - whatsapp_token e evolution_key: nem leitura nem escrita pelo navegador
--     (privilégio por coluna). Só servidor (service role — webhook, api/,
--     Edge Functions), que não passa por nada disso.
--   - anon: nada. As páginas públicas de pesquisa já não recebiam linha
--     nenhuma (não havia policy pra anon) e tratam o vazio.
--   - institutions_safe: security_invoker + sem privilégio pra anon e
--     authenticated.
--
-- ATENÇÃO pra migrations futuras: coluna nova em institutions NÃO fica
-- legível/gravável pelo navegador até entrar nos GRANTs de coluna abaixo.
-- SELECT * em institutions pelo navegador passa a dar "permission denied" —
-- use lista de colunas.
--
-- Escrita (inst_insert_safe / inst_update_safe) não muda neste commit.
-- =============================================================================

-- ── Leitura ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: lê users/user_institutions/institutions sem depender da
-- RLS delas (e sem recursão na própria institutions).
CREATE OR REPLACE FUNCTION public.institution_readable_by_me(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND (
        u.user_type = 'admin_geral'
        OR p_institution_id IN (u.institution_id, u.active_institution_id)
        OR EXISTS (
          SELECT 1 FROM user_institutions ui
          WHERE ui.user_id = u.id AND ui.institution_id = p_institution_id AND ui.active
        )
        OR (u.school_group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM institutions i
          WHERE i.id = p_institution_id AND i.school_group_id = u.school_group_id
        ))
        OR (u.user_type = 'consultant' AND EXISTS (
          SELECT 1 FROM institutions i
          WHERE i.id = p_institution_id AND i.consultant_id = u.id
        ))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.institution_readable_by_me(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.institution_readable_by_me(UUID) TO authenticated;

DROP POLICY IF EXISTS temp_authenticated_select ON institutions;
DROP POLICY IF EXISTS inst_select_safe ON institutions;
CREATE POLICY inst_select_safe ON institutions
  FOR SELECT TO authenticated
  USING (public.institution_readable_by_me(id));

-- ── Privilégios ────────────────────────────────────────────────────────────
REVOKE ALL ON institutions FROM anon;
REVOKE ALL ON institutions FROM authenticated;

-- Todas as colunas menos whatsapp_token e evolution_key.
GRANT SELECT (
  id, name, logo_url, primary_color, secondary_color, created_at, updated_at, active,
  evolution_instance, evolution_url, evolution_connected_at, whatsapp_connected, whatsapp_state,
  notification_settings, city, state, consultant_id, plan, plan_status, trial_ends_at,
  asaas_customer_id, cnpj, phone, email, monthly_value, implementation_value, billing_due_day,
  asaas_subscription_id, whatsapp_phone_id, whatsapp_phone_number, whatsapp_display_name,
  address, manager_cpf, manager_role, whatsapp_business_id, inep_code, ibge_city_code,
  nf_issue_timing, school_group_id, show_agent_name_in_messages
) ON institutions TO authenticated;

GRANT INSERT (
  id, name, logo_url, primary_color, secondary_color, created_at, updated_at, active,
  evolution_instance, evolution_url, evolution_connected_at, whatsapp_connected, whatsapp_state,
  notification_settings, city, state, consultant_id, plan, plan_status, trial_ends_at,
  asaas_customer_id, cnpj, phone, email, monthly_value, implementation_value, billing_due_day,
  asaas_subscription_id, whatsapp_phone_id, whatsapp_phone_number, whatsapp_display_name,
  address, manager_cpf, manager_role, whatsapp_business_id, inep_code, ibge_city_code,
  nf_issue_timing, school_group_id, show_agent_name_in_messages
) ON institutions TO authenticated;

GRANT UPDATE (
  name, logo_url, primary_color, secondary_color, updated_at, active,
  evolution_instance, evolution_url, evolution_connected_at, whatsapp_connected, whatsapp_state,
  notification_settings, city, state, consultant_id, plan, plan_status, trial_ends_at,
  asaas_customer_id, cnpj, phone, email, monthly_value, implementation_value, billing_due_day,
  asaas_subscription_id, whatsapp_phone_id, whatsapp_phone_number, whatsapp_display_name,
  address, manager_cpf, manager_role, whatsapp_business_id, inep_code, ibge_city_code,
  nf_issue_timing, school_group_id, show_agent_name_in_messages
) ON institutions TO authenticated;

-- DELETE continua como estava (sem policy de DELETE, a RLS já barra).
GRANT DELETE ON institutions TO authenticated;

-- ── institutions_safe ──────────────────────────────────────────────────────
ALTER VIEW public.institutions_safe SET (security_invoker = true);
REVOKE ALL ON public.institutions_safe FROM anon;
REVOKE ALL ON public.institutions_safe FROM authenticated;
