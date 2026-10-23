CREATE OR REPLACE FUNCTION public.base_set_pre_counts(p_institution_id uuid, p_on boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT base_user_is_admin(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  INSERT INTO student_base_settings (institution_id, count_prematricula_as_reenrolled, updated_by, updated_at)
  VALUES (p_institution_id, p_on, auth.uid(), now())
  ON CONFLICT (institution_id) DO UPDATE SET count_prematricula_as_reenrolled = EXCLUDED.count_prematricula_as_reenrolled, updated_by = EXCLUDED.updated_by, updated_at = now();
END $function$;

CREATE OR REPLACE FUNCTION public.base_sync_info(p_institution_id uuid)
 RETURNS TABLE(last_seen timestamptz, sources text[], pre_counts boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT base_user_can_see_list(p_institution_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  PERFORM base_require_module(p_institution_id);
  RETURN QUERY
  SELECT max(e.last_seen_at), array_agg(DISTINCT e.source),
         COALESCE((SELECT s.count_prematricula_as_reenrolled FROM student_base_settings s WHERE s.institution_id = p_institution_id), false)
    FROM class_enrollments e WHERE e.institution_id = p_institution_id;
END $function$;
REVOKE EXECUTE ON FUNCTION public.base_set_pre_counts(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.base_sync_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_set_pre_counts(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.base_sync_info(uuid) TO authenticated;
