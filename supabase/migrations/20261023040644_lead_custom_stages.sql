-- Etapas extras do funil (Configurações > Funil e leads > Etapas do funil).
-- O lead continua com leads.status numa das 7 etapas originais (a lógica, os relatórios e as automações
-- não mudam). A etapa extra é uma "sub-etapa": leads.custom_stage_id aponta para ela e a tela mostra
-- o lead na coluna extra, logo depois da etapa original (after_stage). Extras nunca são apagadas, só desativadas.
CREATE TABLE IF NOT EXISTS public.lead_custom_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 30),
  after_stage text NOT NULL CHECK (after_stage IN ('new','contact','scheduled','visit','proposal')),
  position int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_custom_stages_unique_label ON public.lead_custom_stages (institution_id, lower(btrim(label)));
CREATE INDEX IF NOT EXISTS lead_custom_stages_inst ON public.lead_custom_stages (institution_id);
ALTER TABLE public.lead_custom_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_custom_stages_select ON public.lead_custom_stages FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lead_custom_stages_insert ON public.lead_custom_stages FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_custom_stages_update ON public.lead_custom_stages FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id)) WITH CHECK (lead_unit_user_can_manage(institution_id));

-- instituição e etapa-mãe não mudam depois de criada; desativar solta os leads de volta para a etapa original
CREATE OR REPLACE FUNCTION public.lead_custom_stages_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.institution_id IS DISTINCT FROM OLD.institution_id OR NEW.after_stage IS DISTINCT FROM OLD.after_stage THEN
    RAISE EXCEPTION 'Não é possível mudar a escola nem a etapa de origem de uma etapa extra.';
  END IF;
  IF OLD.active AND NOT NEW.active THEN
    UPDATE leads SET custom_stage_id = NULL WHERE custom_stage_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_lead_custom_stages_guard BEFORE UPDATE ON public.lead_custom_stages
  FOR EACH ROW EXECUTE FUNCTION public.lead_custom_stages_guard();

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS custom_stage_id uuid REFERENCES public.lead_custom_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_custom_stage_idx ON public.leads (custom_stage_id) WHERE custom_stage_id IS NOT NULL;

-- trocou de etapa original → sai da extra; extra só vale na mesma escola e na etapa-mãe dela
CREATE OR REPLACE FUNCTION public.leads_custom_stage_check() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.custom_stage_id IS NOT DISTINCT FROM OLD.custom_stage_id THEN
    NEW.custom_stage_id := NULL;
  END IF;
  IF NEW.custom_stage_id IS NOT NULL THEN
    SELECT institution_id, after_stage, active INTO s FROM lead_custom_stages WHERE id = NEW.custom_stage_id;
    IF NOT FOUND OR s.institution_id IS DISTINCT FROM NEW.institution_id OR s.after_stage IS DISTINCT FROM NEW.status OR NOT s.active THEN
      RAISE EXCEPTION 'Etapa extra inválida para este lead.';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE TRIGGER trg_leads_custom_stage_check BEFORE INSERT OR UPDATE OF status, custom_stage_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_custom_stage_check();
