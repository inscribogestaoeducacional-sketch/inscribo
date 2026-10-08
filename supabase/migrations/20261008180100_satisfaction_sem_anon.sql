-- 20261008180100_satisfaction_sem_anon.sql
--
-- Parte 2 da correção da pesquisa de satisfação (ver 20261008180000): com a
-- página pública usando satisfaction_survey_view/submit, saem as policies que
-- liberavam leitura/alteração/inserção anônima. As policies da escola
-- (institution_surveys, *_institution_manage, institution_read_responses)
-- não mudam.

DROP POLICY IF EXISTS public_read_surveys_by_token               ON public.satisfaction_surveys;
DROP POLICY IF EXISTS satisfaction_surveys_public_select         ON public.satisfaction_surveys;
DROP POLICY IF EXISTS satisfaction_surveys_public_response_count ON public.satisfaction_surveys;
DROP POLICY IF EXISTS satisfaction_questions_public_select       ON public.satisfaction_questions;
DROP POLICY IF EXISTS public_insert_responses                    ON public.satisfaction_responses;
DROP POLICY IF EXISTS satisfaction_responses_public_insert       ON public.satisfaction_responses;

REVOKE ALL ON public.satisfaction_surveys, public.satisfaction_questions, public.satisfaction_responses FROM anon;
