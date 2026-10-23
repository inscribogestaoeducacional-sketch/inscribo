-- Nomes das etapas do funil por escola (Configurações > Funil e leads > Nomes das etapas).
-- Só o nome muda; as etapas (new, contact, …) e a lógica do funil continuam as mesmas.
-- label nulo ou sem linha = nome padrão do sistema.
CREATE TABLE IF NOT EXISTS public.lead_stage_labels (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('new','contact','scheduled','visit','proposal','enrolled','lost')),
  label text CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, stage)
);
CREATE UNIQUE INDEX IF NOT EXISTS lead_stage_labels_unique_label ON public.lead_stage_labels (institution_id, lower(btrim(label))) WHERE label IS NOT NULL;
ALTER TABLE public.lead_stage_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_stage_labels_select ON public.lead_stage_labels FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lead_stage_labels_insert ON public.lead_stage_labels FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lead_stage_labels_update ON public.lead_stage_labels FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id)) WITH CHECK (lead_unit_user_can_manage(institution_id));
