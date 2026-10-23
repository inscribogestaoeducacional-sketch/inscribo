-- Motivos de perda por escola (Configurações > Funil e leads).
-- Sem linhas = a escola usa os 10 motivos padrão do sistema; a primeira edição grava os padrões.
-- Motivos nunca são apagados, só desativados (histórico e relatórios mantêm o nome).
-- "outro" é reservado: não pode ser desativado nem renomeado.
CREATE TABLE IF NOT EXISTS public.lost_reason_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  value text NOT NULL CHECK (length(btrim(value)) BETWEEN 1 AND 40),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  short text NOT NULL CHECK (length(btrim(short)) BETWEEN 1 AND 30),
  fator text NOT NULL CHECK (fator IN ('Interno', 'Externo')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS lost_reason_options_unique_value ON public.lost_reason_options (institution_id, value);
CREATE UNIQUE INDEX IF NOT EXISTS lost_reason_options_unique_label ON public.lost_reason_options (institution_id, lower(label));
CREATE INDEX IF NOT EXISTS lost_reason_options_inst ON public.lost_reason_options (institution_id, sort_order);
ALTER TABLE public.lost_reason_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY lost_reason_options_select ON public.lost_reason_options FOR SELECT TO authenticated
  USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY lost_reason_options_insert ON public.lost_reason_options FOR INSERT TO authenticated
  WITH CHECK (lead_unit_user_can_manage(institution_id));
CREATE POLICY lost_reason_options_update ON public.lost_reason_options FOR UPDATE TO authenticated
  USING (lead_unit_user_can_manage(institution_id)) WITH CHECK (lead_unit_user_can_manage(institution_id));

CREATE OR REPLACE FUNCTION public.lost_reason_options_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.value IS DISTINCT FROM OLD.value OR NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
      RAISE EXCEPTION 'value e escola não podem ser alterados';
    END IF;
    IF OLD.value = 'outro' AND (NEW.active IS DISTINCT FROM true OR NEW.label IS DISTINCT FROM OLD.label OR NEW.fator IS DISTINCT FROM OLD.fator) THEN
      RAISE EXCEPTION 'o motivo "Outro" é reservado e não pode ser alterado';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lost_reason_options_guard_trg BEFORE UPDATE ON public.lost_reason_options FOR EACH ROW EXECUTE FUNCTION public.lost_reason_options_guard();
