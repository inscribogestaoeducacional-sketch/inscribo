-- =============================================================================
-- Trava as views user_context e funnel_analysis_view.
--
-- Antes (conferido ao vivo em 2026-09-29, como anon em transação desfeita):
-- as duas são donas do postgres e sem security_invoker — ignoram a RLS das
-- tabelas de baixo —, auto-atualizáveis e com GRANT ALL pra anon e
-- authenticated.
--   - user_context (SELECT id, role, institution_id FROM users): qualquer
--     visitante sem login lia os 60 usuários e conseguia ALTERAR role e
--     institution_id de qualquer um — quem tivesse uma conta virava admin de
--     qualquer escola.
--   - funnel_analysis_view: leitura e escrita das metas/funil de todas as
--     escolas.
-- Nenhuma das duas é usada no código (src/, api/, Edge Functions), nem por
-- função, policy ou outra view (pg_depend/pg_proc/pg_policies).
--
-- Depois: security_invoker (se alguém voltar a conceder acesso, vale a RLS
-- das tabelas de baixo) e nenhum privilégio pra anon/authenticated. Servidor
-- (service role) não muda.
-- =============================================================================

ALTER VIEW public.user_context SET (security_invoker = true);
REVOKE ALL ON public.user_context FROM anon;
REVOKE ALL ON public.user_context FROM authenticated;

ALTER VIEW public.funnel_analysis_view SET (security_invoker = true);
REVOKE ALL ON public.funnel_analysis_view FROM anon;
REVOKE ALL ON public.funnel_analysis_view FROM authenticated;
