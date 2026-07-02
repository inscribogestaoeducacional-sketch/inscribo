
-- =============================================================================
-- 20260701000015_fix_legacy_true_policies.sql
-- Mesma classe de bug encontrada em whatsapp_messages/whatsapp_conversations
-- (20260701000010): policies legadas "USING (true) FOR ALL TO authenticated"
-- que tornam qualquer policy institution-scoped mais nova irrelevante, já
-- que o Postgres combina policies PERMISSIVE do mesmo comando com OR.
--
-- Escopo desta migration: contracts, crm_leads, crm_meetings, payments,
-- proposals — exatamente as tabelas apontadas. NÃO inclui as policies
-- "anon SELECT (true)" (contracts_anon_select, payments_anon_select,
-- proposals_anon_view) — essas parecem servir um fluxo legítimo de link
-- público (ex: src/pages/ProposalView.tsx lê proposals por view_token na
-- URL), mas hoje expõem a tabela INTEIRA a qualquer requisição anônima,
-- não só a linha do token — isso é uma falha separada, de design de
-- acesso público, e fica registrada como pendência, não corrigida aqui.
--
-- Por tabela:
--
-- contracts: já tem "contracts_safe" (institution_id = get_my_institution_id()
-- OR is_super_admin_user()) e "consultant_own_contracts" e
-- "super_admin_contracts" corretamente escopadas — só derruba a policy
-- "true" (contracts_auth_all).
--
-- payments: mesma situação — "payments_select_safe" e "super_admin_payments"
-- já cobrem o caso legítimo — só derruba "payments_auth_all".
--
-- crm_leads: é o CRM interno da própria Áion (consultores/admin_geral
-- vendendo pra escolas, usado só em src/components/superadmin/**, sem
-- institution_id — não é dado de uma escola). Já tem "admin_crm_leads"
-- corretamente escopada por role/user_type — só derruba "crm_leads_auth".
--
-- crm_meetings: mesmo domínio do crm_leads (reuniões ligadas a crm_leads
-- via lead_id, sem institution_id/consultant_id próprio), mas SEM
-- nenhuma policy além da "true" — precisa de uma nova policy antes de
-- remover "crm_meetings_auth", senão a funcionalidade quebra por inteiro
-- pra todo mundo, inclusive admin_geral/consultant.
--
-- proposals: mesmo problema do crm_meetings — só tem "proposals_auth"
-- (true) pra authenticated e "proposals_anon_view" (true) pra anon; sem
-- essa primeira, ninguém autenticado teria acesso. proposals TEM
-- institution_id, então replica o padrão de contracts_safe/payments_select_safe.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- contracts / payments: só remove a policy perigosa, substitutas já existem
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "contracts_auth_all" ON contracts;
DROP POLICY IF EXISTS "payments_auth_all" ON payments;

-- ─────────────────────────────────────────────────────────────────────────────
-- crm_leads: só remove a policy perigosa, admin_crm_leads já cobre o uso real
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crm_leads_auth" ON crm_leads;

-- ─────────────────────────────────────────────────────────────────────────────
-- crm_meetings: cria a policy que faltava (mesmo padrão de admin_crm_leads)
-- antes de derrubar a "true"
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admin_crm_meetings" ON crm_meetings;
CREATE POLICY "admin_crm_meetings" ON crm_meetings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND (
          users.role = ANY (ARRAY['super_admin', 'admin_geral'])
          OR users.user_type = ANY (ARRAY['admin_geral', 'consultant'])
        )
    )
  );

DROP POLICY IF EXISTS "crm_meetings_auth" ON crm_meetings;

-- ─────────────────────────────────────────────────────────────────────────────
-- proposals: cria a policy que faltava pra authenticated (mesmo padrão de
-- contracts_safe/payments_select_safe) antes de derrubar a "true". NÃO
-- mexe em proposals_anon_view (fora do escopo, ver nota no cabeçalho).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "proposals_safe" ON proposals;
CREATE POLICY "proposals_safe" ON proposals
  FOR ALL
  USING (
    institution_id = get_my_institution_id()
    OR is_super_admin_user()
  );

DROP POLICY IF EXISTS "proposals_auth" ON proposals;
