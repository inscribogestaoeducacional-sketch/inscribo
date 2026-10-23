-- Mensagens de visita enviadas pelo sistema (confirmação e lembrete): a escola pode
-- trocar o modelo padrão da Áion por um modelo próprio aprovado. Sem linha, ou com
-- template_definition_id nulo, vale o padrão. O banco só aceita modelo da própria escola.
CREATE TABLE IF NOT EXISTS public.template_slot_choice (
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('confirmacao_visita', 'lembrete_visita')),
  template_definition_id uuid REFERENCES public.template_definitions(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, slot)
);
ALTER TABLE public.template_slot_choice ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_slot_choice_select ON public.template_slot_choice FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY template_slot_choice_insert ON public.template_slot_choice FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id) AND (template_definition_id IS NULL OR EXISTS (SELECT 1 FROM public.template_definitions d WHERE d.id = template_definition_id AND d.institution_id = template_slot_choice.institution_id)));
CREATE POLICY template_slot_choice_update ON public.template_slot_choice FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id))
  WITH CHECK (lead_unit_user_can_manage(institution_id) AND (template_definition_id IS NULL OR EXISTS (SELECT 1 FROM public.template_definitions d WHERE d.id = template_definition_id AND d.institution_id = template_slot_choice.institution_id)));
