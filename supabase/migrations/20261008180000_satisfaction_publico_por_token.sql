-- 20261008180000_satisfaction_publico_por_token.sql
--
-- Brecha ALTO em satisfaction_surveys (e vizinhas):
--   public_read_surveys_by_token / satisfaction_surveys_public_select
--       anon lia TODAS as pesquisas (USING true / survey_token IS NOT NULL)
--   satisfaction_surveys_public_response_count
--       anon ALTERAVA qualquer pesquisa com token — inclusive redirect_url,
--       pra onde a família é levada ao terminar (risco de golpe)
--   satisfaction_questions_public_select   perguntas de todas as pesquisas
--   public_insert_responses (CHECK true)   resposta anônima em qualquer escola
--
-- A página pública /satisfaction/:token passa a usar duas funções que exigem
-- o token exato:
--   satisfaction_survey_view(token)   pesquisa + perguntas + marca da escola
--   satisfaction_survey_submit(token, nome, série, respostas, respostas_custom)
--       grava a resposta só em pesquisa ativa e avisa a escola (a página
--       anônima tentava criar a notificação pelo navegador)
-- O contador de respostas continua no trigger trg_increment_survey_response_count.
-- Parte 2 (retirar as policies públicas) em 20261008180100, depois do front.
-- Nenhum dado é alterado.

CREATE OR REPLACE FUNCTION public.satisfaction_survey_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s satisfaction_surveys%ROWTYPE;
  v_inst jsonb;
  v_questions jsonb := '[]'::jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN NULL; END IF;
  SELECT * INTO s FROM satisfaction_surveys WHERE survey_token::text = p_token;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object('name', i.name, 'logo_url', i.logo_url, 'primary_color', i.primary_color)
    INTO v_inst FROM institutions i WHERE i.id = s.institution_id;

  IF s.survey_mode = 'custom' THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', q.id, 'order_index', q.order_index, 'question_type', q.question_type,
             'title', q.title, 'description', q.description, 'required', q.required, 'options', q.options)
           ORDER BY q.order_index), '[]'::jsonb)
      INTO v_questions FROM satisfaction_questions q WHERE q.survey_id = s.id;
  END IF;

  RETURN jsonb_build_object(
    'survey', jsonb_build_object(
      'id', s.id, 'title', s.title, 'description', s.description, 'status', s.status,
      'survey_mode', s.survey_mode, 'require_identification', s.require_identification,
      'redirect_url', s.redirect_url),
    'questions', v_questions,
    'institution', v_inst
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.satisfaction_survey_submit(
  p_token text, p_name text, p_grade text, p_answers jsonb, p_custom_answers jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s satisfaction_surveys%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN false; END IF;
  IF octet_length(COALESCE(p_answers, '{}'::jsonb)::text) + octet_length(COALESCE(p_custom_answers, '{}'::jsonb)::text) > 20000
     OR length(COALESCE(p_name, '')) > 200 OR length(COALESCE(p_grade, '')) > 100 THEN
    RETURN false;
  END IF;

  SELECT * INTO s FROM satisfaction_surveys WHERE survey_token::text = p_token AND status = 'active';
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO satisfaction_responses (survey_id, institution_id, respondent_name, respondent_grade, answers, custom_answers)
  VALUES (s.id, s.institution_id, NULLIF(btrim(COALESCE(p_name, '')), ''), NULLIF(btrim(COALESCE(p_grade, '')), ''),
          COALESCE(p_answers, '{}'::jsonb), p_custom_answers);

  IF EXISTS (SELECT 1 FROM users u WHERE u.institution_id = s.institution_id AND u.role = 'user') THEN
    INSERT INTO system_notifications (institution_id, type, title, message, severity, action_url)
    VALUES (s.institution_id, 'milestone', 'Nova resposta de pesquisa',
            COALESCE(NULLIF(btrim(COALESCE(p_name, '')), ''), 'Anônimo') || ' respondeu à pesquisa "' || s.title || '"',
            'info', '/surveys');
  END IF;
  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.satisfaction_survey_view(text),
                       public.satisfaction_survey_submit(text, text, text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.satisfaction_survey_view(text),
                          public.satisfaction_survey_submit(text, text, text, jsonb, jsonb) TO anon, authenticated;
