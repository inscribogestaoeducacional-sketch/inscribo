-- =============================================================================
-- 20260916050000_template_definitions_dynamic_controls.sql
-- "Templates Automáticos" — controles mais dinâmicos sobre a tela criada em
-- 20260916030000_template_definitions.sql / 20260916040000_..._variable_labels.sql:
--
-- 1. display_name — nome amigável mostrado pro atendente/gestor em vez do
--    nome técnico (o que a Meta exige, ex: "contato_assunto_escola").
--    Obrigatório pra templates novos (aplicado na tela, não aqui — templates
--    já existentes ficam com display_name NULL, tratado com fallback pro
--    nome técnico em todo consumidor, ver templateVariableLabels.ts).
--
-- 2. template_institution_status.visible_to_school — esconde um template já
--    aprovado de uma escola específica sem precisar desaprovar na Meta (ex:
--    template só faz sentido pra algumas escolas). DEFAULT true: ausência de
--    linha (ou de override) nunca bloqueia nada por padrão.
--
-- 3. available_contexts — em quais telas o template pode ser ESCOLHIDO
--    manualmente: 'manual_send' (botão de enviar template numa conversa),
--    'new_conversation' (template ao iniciar conversa nova), 'scheduled_message'
--    (modal "Agendar mensagem"), 'broadcast' (Transmissão em massa / Inbox
--    Áion). DEFAULT '{}': template sem nenhum contexto marcado não aparece em
--    nenhum picker — é o caso de templates disparados só por automação (ex:
--    confirmacao_visita, lembrete_visita — WhatsAppHub.tsx handleScheduleVisitFromLead).
--
--    IMPORTANTE pra quem for filtrar pickers com isso: um template que não
--    tem NENHUMA linha em template_definitions (criado direto no WhatsApp
--    Manager, ou legado — todo template aprovado hoje, já que este catálogo é
--    novo) não deve ser escondido por essa regra. A regra "sem contexto = não
--    aparece" vale só pra quem JÁ está no catálogo; ausência total do
--    catálogo é passthrough (mantém o comportamento de sempre visível que
--    existia antes dessa feature). Ver filterTemplatesForContext() em
--    src/lib/templateVariableLabels.ts.
-- =============================================================================

ALTER TABLE template_definitions
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS available_contexts TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_definitions_available_contexts_check'
  ) THEN
    ALTER TABLE template_definitions
      ADD CONSTRAINT template_definitions_available_contexts_check
        CHECK (available_contexts <@ ARRAY['manual_send','new_conversation','scheduled_message','broadcast']::TEXT[]);
  END IF;
END $$;

ALTER TABLE template_institution_status
  ADD COLUMN IF NOT EXISTS visible_to_school BOOLEAN NOT NULL DEFAULT true;

-- SELECT liberado pro atendente/gestor da própria escola — precisa ler
-- visible_to_school pra filtrar os pickers de template (item 3). Escrita
-- continua exclusiva do Super Admin (policy "FOR ALL" já existente).
DROP POLICY IF EXISTS "authenticated_select_own_institution_template_status" ON template_institution_status;
CREATE POLICY "authenticated_select_own_institution_template_status"
  ON template_institution_status FOR SELECT
  TO authenticated
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));
