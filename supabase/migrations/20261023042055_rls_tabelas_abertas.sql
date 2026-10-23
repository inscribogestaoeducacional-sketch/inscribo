-- Fecha 6 tabelas que estavam sem RLS (qualquer pessoa com a chave pública lia e alterava tudo).
-- inep_escolas: dado público do Censo; leitura aberta (a página pública /raio-x usa), escrita só super admin.
-- aion_keywords / aion_keyword_hits: só super admin (o webhook usa a chave de serviço e não é afetado).
-- demo_requests: o formulário público só insere; ler e mexer, só super admin.
-- student_exits / grade_exit_config: sem uso no app; leitura da própria escola, escrita só super admin.
ALTER TABLE public.inep_escolas ENABLE ROW LEVEL SECURITY;
CREATE POLICY inep_escolas_leitura ON public.inep_escolas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY inep_escolas_super ON public.inep_escolas FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

ALTER TABLE public.aion_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY aion_keywords_super ON public.aion_keywords FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());
ALTER TABLE public.aion_keyword_hits ENABLE ROW LEVEL SECURITY;
CREATE POLICY aion_keyword_hits_super ON public.aion_keyword_hits FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_requests_envio ON public.demo_requests FOR INSERT TO anon, authenticated
  WITH CHECK (length(btrim(coalesce(name, ''))) > 0 AND position('@' in coalesce(email, '')) > 1);
CREATE POLICY demo_requests_super ON public.demo_requests FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

ALTER TABLE public.student_exits ENABLE ROW LEVEL SECURITY;
CREATE POLICY student_exits_leitura ON public.student_exits FOR SELECT TO authenticated USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY student_exits_super ON public.student_exits FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());
ALTER TABLE public.grade_exit_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY grade_exit_config_leitura ON public.grade_exit_config FOR SELECT TO authenticated USING (institution_id = current_user_institution_id() OR is_super_admin_user());
CREATE POLICY grade_exit_config_super ON public.grade_exit_config FOR ALL TO authenticated USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

-- permissões em excesso: o visitante anônimo só lê o INEP e envia o formulário de demonstração
REVOKE ALL ON public.inep_escolas, public.aion_keywords, public.aion_keyword_hits, public.demo_requests, public.student_exits, public.grade_exit_config FROM anon;
GRANT SELECT ON public.inep_escolas TO anon;
GRANT INSERT ON public.demo_requests TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.inep_escolas, public.aion_keywords, public.aion_keyword_hits, public.demo_requests, public.student_exits, public.grade_exit_config FROM authenticated;

-- funções de gatilho das etapas extras não precisam ser chamáveis por ninguém de fora
REVOKE EXECUTE ON FUNCTION public.lead_custom_stages_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leads_custom_stage_check() FROM PUBLIC, anon, authenticated;
