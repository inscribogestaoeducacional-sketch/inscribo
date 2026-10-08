-- 20261008170100_student_transfers_sem_anon.sql
--
-- Parte 2 da correção de student_transfers (ver 20261008170000): com a
-- página pública usando transfer_survey_view/transfer_survey_submit, saem as
-- policies públicas que liberavam qualquer linha com token. A escola segue
-- com institution_isolation; o servidor (api/ai, service role) não muda.

DROP POLICY IF EXISTS public_survey_access ON public.student_transfers;
DROP POLICY IF EXISTS public_survey_update ON public.student_transfers;
REVOKE ALL ON public.student_transfers FROM anon;
