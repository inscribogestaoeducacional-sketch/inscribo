-- 20261008120000_lead_unidade.sql
--
-- Etapa 5A — campo "Unidade" no lead, OPCIONAL e por escola.
--
--   lead_unit_settings  liga/desliga + rótulo (Unidade, Campus, Polo...).
--                       Sem linha = desligado: escola que não liga não vê nada.
--   lead_units          opções que a escola cadastra (ativar/desativar).
--                       Opção em uso não pode ser apagada (FK RESTRICT),
--                       só desativada.
--   leads.unit_id       nullable. A unidade vive SÓ no lead; a conversa
--                       mostra a do lead vinculado.
--
-- Não restringe visibilidade de leads (atendente da A ainda vê leads da B).
-- Não confundir com a "unidade" de rede de escolas (school_groups).
--
-- Dados existentes: nenhuma linha é alterada. ADD COLUMN nullable sem
-- default não reescreve a tabela leads.

-- ── Permissão de configurar: admin/gestor ativo da escola ─────────────────
CREATE OR REPLACE FUNCTION public.lead_unit_user_can_manage(p_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND coalesce(u.active, true)
      AND p_institution_id IN (u.institution_id, u.active_institution_id)
      AND u.role IN ('admin', 'manager')
  ) OR is_super_admin_user()
$function$;
REVOKE ALL ON FUNCTION public.lead_unit_user_can_manage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_unit_user_can_manage(uuid) TO authenticated;

-- ── Configuração por escola ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_unit_settings (
  institution_id UUID        PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  enabled        BOOLEAN     NOT NULL DEFAULT false,
  label          TEXT        NOT NULL DEFAULT 'Unidade'
                 CHECK (char_length(btrim(label)) BETWEEN 1 AND 30),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL
);

-- ── Opções ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_units (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  active         BOOLEAN     NOT NULL DEFAULT true,
  sort_order     INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_units_inst_name_key
  ON public.lead_units (institution_id, lower(btrim(name)));
CREATE INDEX IF NOT EXISTS lead_units_inst_idx ON public.lead_units (institution_id, sort_order);

-- ── Lead ──────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.lead_units(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS leads_unit_id_idx ON public.leads (unit_id) WHERE unit_id IS NOT NULL;

-- A opção precisa ser da mesma escola do lead. Ao ESCOLHER uma opção
-- (insert ou troca de unit_id) ela precisa estar ativa; lead que já tem uma
-- opção depois desativada continua editável normalmente.
CREATE OR REPLACE FUNCTION public.leads_check_unit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_inst   uuid;
  v_active boolean;
BEGIN
  IF NEW.unit_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.unit_id IS NOT DISTINCT FROM OLD.unit_id
     AND NEW.institution_id IS NOT DISTINCT FROM OLD.institution_id THEN
    RETURN NEW;
  END IF;

  SELECT institution_id, active INTO v_inst, v_active
  FROM lead_units WHERE id = NEW.unit_id;

  IF v_inst IS DISTINCT FROM NEW.institution_id THEN
    RAISE EXCEPTION 'Unidade inválida para esta escola' USING ERRCODE = '23514';
  END IF;
  IF NOT v_active AND (TG_OP = 'INSERT' OR NEW.unit_id IS DISTINCT FROM OLD.unit_id) THEN
    RAISE EXCEPTION 'Esta unidade está desativada' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_leads_check_unit ON public.leads;
CREATE TRIGGER trg_leads_check_unit
  BEFORE INSERT OR UPDATE OF unit_id, institution_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_check_unit();

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.lead_unit_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_units         ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_unit_settings_select ON public.lead_unit_settings
  FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lead_unit_settings_insert ON public.lead_unit_settings
  FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_unit_settings_update ON public.lead_unit_settings
  FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id))
  WITH CHECK (lead_unit_user_can_manage(institution_id));

CREATE POLICY lead_units_select ON public.lead_units
  FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lead_units_insert ON public.lead_units
  FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_units_update ON public.lead_units
  FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id))
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_units_delete ON public.lead_units
  FOR DELETE TO authenticated
  USING (lead_unit_user_can_manage(institution_id));

REVOKE ALL ON public.lead_unit_settings, public.lead_units FROM anon;
GRANT SELECT, INSERT, UPDATE         ON public.lead_unit_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_units         TO authenticated;
