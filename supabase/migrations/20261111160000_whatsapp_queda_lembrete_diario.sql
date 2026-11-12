-- Registro da alteração aplicada via MCP (whatsapp_queda_lembrete_diario).
-- whatsapp_health_record: o aviso ativo (push + e-mail ao dono) agora sai
--   1) na queda;
--   2) depois, 1 lembrete a cada 24 h, só nas primeiras 72 h da queda.
-- Antes era a cada 30 min, sem limite. Sino do painel e banner não mudaram.
-- Para silenciar uma escola de vez: incluir o id em platform_settings.wa_alertas_ignorar.
select 1;
