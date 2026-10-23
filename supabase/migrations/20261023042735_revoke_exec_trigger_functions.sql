-- Funções de gatilho (trigger) não precisam ser chamáveis por ninguém: o gatilho dispara igual.
-- Tirar a permissão de execução só impede que alguém de fora chame a função direto pela API.
REVOKE EXECUTE ON FUNCTION public.increment_survey_response_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.institutions_guard_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.internal_messages_restrict_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lead_status_changed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leads_campaign_cycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.leads_check_unit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_privilege_escalation_user_institutions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_grade_levels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_visibility_on_transfer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_active_user_institution_to_users() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_aion_contact_from_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_aion_contact_from_lead() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_contact_from_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_funnel_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.visits_before_write() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.whatsapp_flows_guard_columns() FROM PUBLIC, anon, authenticated;
