-- =============================================================================
-- 20260916040000_template_definitions_variable_labels.sql
-- Rótulos legíveis por variável — { "1": "Nome do responsável", "2": "Assunto",
-- "3": "Mensagem" } — em vez do genérico "Variável N" mostrado hoje em toda
-- tela que pede pra preencher variável de template (envio manual no
-- WhatsAppHub, "Agendar mensagem", inbox interno da Áion etc.).
--
-- Fica em template_definitions (catálogo central, "Templates Automáticos"),
-- não em whatsapp_templates: essa última é um CACHE por escola, resincronizado
-- por completo (delete + upsert) a partir da lista da Meta toda vez que a
-- aba "Templates" de InstitutionDetails.tsx carrega (ver loadWaTemplates) —
-- qualquer coluna extra gravada lá seria apagada no próximo sync, já que o
-- payload de upsert não inclui esse campo. Por isso todo consumidor busca o
-- rótulo em template_definitions casando por `name` (nome técnico, único),
-- com fallback pra "Variável N" quando não achar (templates criados antes
-- dessa feature, ou direto no WhatsApp Manager, fora do catálogo).
--
-- SELECT liberado pra todo `authenticated` (não só super admin): o conteúdo
-- não é sensível (é o texto do template já aprovado, público pro destinatário
-- de qualquer mensagem) e toda tela de envio de qualquer escola precisa ler
-- isso pra montar o formulário de variáveis. Escrita continua exclusiva do
-- Super Admin, via a policy "FOR ALL" já existente.
-- =============================================================================

ALTER TABLE template_definitions
  ADD COLUMN IF NOT EXISTS variable_labels JSONB DEFAULT '{}';

DROP POLICY IF EXISTS "authenticated_select_template_definitions" ON template_definitions;
CREATE POLICY "authenticated_select_template_definitions"
  ON template_definitions FOR SELECT
  TO authenticated
  USING (true);
