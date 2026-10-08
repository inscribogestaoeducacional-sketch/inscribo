-- 20261008170000_transfer_survey_publico_por_token.sql
--
-- Brecha ALTO: as policies public_survey_access (SELECT) e
-- public_survey_update (UPDATE) de student_transfers usavam
-- USING (survey_token IS NOT NULL) — não comparavam com o token informado,
-- então qualquer anônimo lia e alterava TODAS as transferências com token
-- (nome do aluno, motivo, respostas).
--
-- A página pública da pesquisa de saída (/survey/:token) passa a usar duas
-- funções que exigem o token exato (UUID):
--   transfer_survey_view(token)              status + aluno/série + marca da escola
--   transfer_survey_submit(token, respostas) grava as respostas uma vez só
-- De quebra a marca da escola volta a aparecer: a página lia institutions
-- direto, o que anon não pode desde o travamento de institutions.
-- Parte 2 (retirar as policies públicas) em 20261008170100, depois do front.
-- Nenhum dado é alterado.

CREATE OR REPLACE FUNCTION public.transfer_survey_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token uuid;
  t record;
BEGIN
  BEGIN v_token := p_token::uuid; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;

  SELECT st.student_name, st.course_grade, st.survey_completed_at,
         i.name AS inst_name, i.logo_url, i.primary_color
    INTO t
  FROM student_transfers st
  LEFT JOIN institutions i ON i.id = st.institution_id
  WHERE st.survey_token = v_token;

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'status',       CASE WHEN t.survey_completed_at IS NOT NULL THEN 'completed' ELSE 'active' END,
    'student_name', t.student_name,
    'course_grade', t.course_grade,
    'institution',  jsonb_build_object('name', t.inst_name, 'logo_url', t.logo_url, 'primary_color', t.primary_color)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_survey_submit(p_token text, p_responses jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_token uuid;
BEGIN
  BEGIN v_token := p_token::uuid; EXCEPTION WHEN OTHERS THEN RETURN false; END;
  IF p_responses IS NULL OR jsonb_typeof(p_responses) <> 'object' OR octet_length(p_responses::text) > 20000 THEN
    RETURN false;
  END IF;
  UPDATE student_transfers
  SET survey_responses    = p_responses,
      survey_completed_at = now()
  WHERE survey_token = v_token AND survey_completed_at IS NULL;
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.transfer_survey_view(text), public.transfer_survey_submit(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_survey_view(text), public.transfer_survey_submit(text, jsonb) TO anon, authenticated;
