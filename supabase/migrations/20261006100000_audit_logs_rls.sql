-- =============================================================================
-- Liga a RLS de audit_logs e tira o acesso do visitante sem login.
--
-- Antes (conferido ao vivo em 2026-10-01 e 2026-10-06, como anon em transação
-- desfeita): a tabela tinha as policies certas (audit_logs_all_institution,
-- _insert, _select, _super_admin), mas a RLS estava DESLIGADA — as policies não
-- valiam nada. Com GRANT ALL pra anon, qualquer um com a chave pública do site
-- lia o histórico de todas as escolas (1.773 linhas: quem mudou o quê, valor
-- antigo e novo) e conseguia apagar ou forjar registros.
--
-- Depois: valem as policies existentes — a equipe lê, grava e apaga só as
-- linhas da própria escola (LeadKanban apaga os logs ao excluir um lead) e o
-- Super Admin vê tudo. Nenhuma tela sem login usa a tabela, então anon fica
-- sem privilégio nenhum. Servidor (service role) não muda.
-- =============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
