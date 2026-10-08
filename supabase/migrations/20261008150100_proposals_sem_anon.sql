-- 20261008150100_proposals_sem_anon.sql
--
-- Parte 2 da correção de proposals (ver 20261008150000): com a página
-- pública já usando proposal_public_view/proposal_public_feedback, anon
-- deixa de acessar a tabela. Policies de admin_geral e consultores não mudam.

DROP POLICY IF EXISTS proposals_anon_view ON public.proposals;
REVOKE ALL ON public.proposals FROM anon;
