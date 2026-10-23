-- Origens do lead por escola (Configurações > Funil e leads > Origens). Aplicada no banco em 23/10.
-- Sem linhas para a escola = lista padrão do código. Origem só é desligada, nunca apagada
-- (os leads e relatórios guardam o nome). WhatsApp, Concurso de Bolsas, Vitrine e Outros
-- são preenchidas pelo sistema: o banco impede desligar ou renomear.
CREATE TABLE IF NOT EXISTS public.lead_source_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 40),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_source_options_unique_name ON public.lead_source_options (institution_id, lower(name));
CREATE INDEX IF NOT EXISTS lead_source_options_inst ON public.lead_source_options (institution_id, sort_order);
ALTER TABLE public.lead_source_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_source_options_select ON public.lead_source_options FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lead_source_options_insert ON public.lead_source_options FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_source_options_update ON public.lead_source_options FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id)) WITH CHECK (lead_unit_user_can_manage(institution_id));

CREATE OR REPLACE FUNCTION public.lead_source_options_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.name IN ('WhatsApp', 'Concurso de Bolsas', 'Vitrine', 'Outros') THEN
    IF NEW.name <> OLD.name OR NEW.active = false THEN
      RAISE EXCEPTION 'Esta origem é usada pelo sistema e não pode ser desligada ou renomeada' USING ERRCODE = '23514';
    END IF;
  END IF;
  NEW.name := btrim(NEW.name);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lead_source_options_guard BEFORE INSERT OR UPDATE ON public.lead_source_options
  FOR EACH ROW EXECUTE FUNCTION public.lead_source_options_guard();
