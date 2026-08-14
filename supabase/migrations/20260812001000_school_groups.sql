-- =============================================================================
-- 20260812001000_school_groups.sql
-- Arquitetura de Grupos Escolares (múltiplas unidades com WhatsApp
-- compartilhado opcional). Cada unidade continua sendo uma institution
-- independente (CRM/financeiro/nota fiscal 100% isolados) — o grupo é só um
-- agrupador + dono opcional do número de WhatsApp compartilhado.
--
-- ORDEM IMPORTA: toda ALTER TABLE ... ADD COLUMN vem antes de qualquer
-- CREATE POLICY/CHECK que referencie essa coluna. Uma tentativa anterior de
-- aplicar esta migration falhou (42703 column "school_group_id" does not
-- exist) porque a policy school_groups_member_select vinha antes do
-- ALTER TABLE users ADD COLUMN school_group_id — corrigido reordenando pra:
-- school_groups (tabela) → institutions.school_group_id →
-- users.school_group_id/active_institution_id → só então RLS/policies →
-- funções (que dependem de active_institution_id já existir).
-- =============================================================================

CREATE TABLE IF NOT EXISTS school_groups (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   TEXT        NOT NULL,
  -- Mapeamento "opção do menu do bot → unidade", configurado na tela Admin
  -- "Grupos Escolares". Formato: [{ option_index: 0, institution_id: "..." }].
  -- Consultado pelo webhook (api/whatsapp/webhook.ts) só quando o WhatsApp é
  -- compartilhado e ainda não existe conversa pra decidir a unidade.
  menu_institution_map   JSONB       NOT NULL DEFAULT '[]',
  created_at             TIMESTAMPTZ DEFAULT now()
);

-- ── institutions.school_group_id ────────────────────────────────────────────
-- Aditivo: escola sem grupo (school_group_id NULL) continua funcionando
-- exatamente como hoje.
ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS school_group_id UUID REFERENCES school_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_institutions_school_group ON institutions(school_group_id);

-- ── users: papel "gestor de rede" ───────────────────────────────────────────
-- institution_id fica NULL pro gestor de rede; school_group_id identifica o
-- grupo. active_institution_id guarda qual unidade do grupo ele está vendo
-- agora — é o que faz o seletor de unidade (TopBar) funcionar sem precisar
-- logout/login: ver redefinição de current_user_institution_id()/
-- get_my_institution_id() logo abaixo.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS school_group_id      UUID REFERENCES school_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_school_group ON users(school_group_id);

-- user_type é um CHECK sobre TEXT livre (não enum) — adiciona 'gestor_rede'
-- ao conjunto de valores aceitos.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_user_type_check
  CHECK (user_type = ANY (ARRAY['school_user'::text, 'consultant'::text, 'admin_geral'::text, 'gestor_rede'::text]));

-- ── RLS de school_groups — só agora, com users.school_group_id já existindo ─
ALTER TABLE school_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_groups_admin_all" ON school_groups;
CREATE POLICY "school_groups_admin_all" ON school_groups
  FOR ALL USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

-- Gestor de rede enxerga (só leitura) o próprio grupo.
DROP POLICY IF EXISTS "school_groups_member_select" ON school_groups;
CREATE POLICY "school_groups_member_select" ON school_groups
  FOR SELECT USING (
    id IN (SELECT school_group_id FROM users WHERE id = auth.uid() AND school_group_id IS NOT NULL)
  );

-- ── RLS: COALESCE(institution_id, active_institution_id) ───────────────────
-- Mudança mínima e retrocompatível: pra todo usuário que já tem institution_id
-- fixo (100% dos usuários hoje), o COALESCE devolve exatamente o mesmo valor
-- de antes — zero mudança de comportamento. Só ativa o fallback pra
-- gestor_rede (institution_id NULL), fazendo TODAS as políticas de RLS que já
-- usam essas duas funções (leads, financeiro, whatsapp, propostas etc.)
-- respeitarem a unidade selecionada, sem precisar editar policy por policy.
CREATE OR REPLACE FUNCTION public.current_user_institution_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(institution_id, active_institution_id) FROM users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_my_institution_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT COALESCE(institution_id, active_institution_id) FROM users WHERE id = auth.uid() LIMIT 1;
$function$;

-- ── switch_active_institution ───────────────────────────────────────────────
-- Único jeito permitido de alterar active_institution_id: valida que a
-- unidade alvo pertence ao MESMO school_group_id do usuário logado, impedindo
-- um gestor de rede de "escolher" uma instituição fora do próprio grupo e
-- vazar dado de outra rede via RLS.
CREATE OR REPLACE FUNCTION public.switch_active_institution(target_institution_id UUID)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  my_group_id UUID;
  target_group_id UUID;
BEGIN
  SELECT school_group_id INTO my_group_id FROM users WHERE id = auth.uid();

  IF my_group_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence a um grupo escolar.';
  END IF;

  SELECT school_group_id INTO target_group_id FROM institutions WHERE id = target_institution_id;

  IF target_group_id IS DISTINCT FROM my_group_id THEN
    RAISE EXCEPTION 'Unidade não pertence ao grupo escolar do usuário.';
  END IF;

  UPDATE users SET active_institution_id = target_institution_id WHERE id = auth.uid();
END;
$function$;
