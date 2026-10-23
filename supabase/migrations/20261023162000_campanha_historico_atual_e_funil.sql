-- Campanha: taxas do funil, metas depois do fim e o ano em andamento junto do histórico.
ALTER TABLE public.campaign_cycles
  ADD COLUMN IF NOT EXISTS funnel_rates jsonb,
  ADD COLUMN IF NOT EXISTS plan_after jsonb;
COMMENT ON COLUMN public.campaign_cycles.funnel_rates IS 'Taxas do funil usadas no plano: {registration_to_schedule, schedule_to_visit, visit_to_enrollment} em fracao 0-1.';
COMMENT ON COLUMN public.campaign_cycles.plan_after IS 'Metas que caem depois do fim da campanha: {rematriculas, novos}.';

CREATE OR REPLACE FUNCTION public.campaign_history(p_institution_id uuid, p_target_year int, p_years int DEFAULT 3)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  y int; v jsonb := '[]'::jsonb; h jsonb; cur jsonb;
BEGIN
  IF NOT (base_is_system() OR base_user_can_see_list(p_institution_id)) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;
  FOR y IN SELECT g FROM generate_series(p_target_year - GREATEST(p_years, 1), p_target_year - 1) g LOOP
    h := campaign_history_year(p_institution_id, y);
    IF (h->>'base')::int > 0 THEN v := v || jsonb_build_array(h); END IF;
  END LOOP;
  cur := campaign_history_year(p_institution_id, p_target_year);
  RETURN jsonb_build_object(
    'target_year', p_target_year,
    'years', v,
    'current', cur,
    'current_base', (cur->>'base')::int,
    'current_students', COALESCE((SELECT (campaign_history_year(p_institution_id, p_target_year - 1)->>'total_students')::int), 0)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.campaign_history(uuid, int, int) TO authenticated;
