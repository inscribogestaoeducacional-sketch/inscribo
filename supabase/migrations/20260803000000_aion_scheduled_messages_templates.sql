-- =============================================================================
-- 20260803000000_aion_scheduled_messages_templates.sql
-- Mensagens agendadas do Inbox Áion passam a usar templates oficiais da Meta
-- em vez de texto livre — o caso de uso real é reativar contato fora da
-- janela de 24h, cenário em que a Meta exige template aprovado (texto livre
-- é rejeitado pela API nessa condição).
--
-- Por que não reaproveitar whatsapp_templates (cache já usado por
-- WhatsAppHub.tsx / InstitutionDetails.tsx)? Porque whatsapp_templates.
-- institution_id é UUID NOT NULL REFERENCES institutions(id) — FK de verdade,
-- diferente de whatsapp_flows/whatsapp_quick_replies (que não têm FK e por
-- isso aceitam platform_whatsapp.id como pseudo-institution_id). Inserir ali
-- com platform_whatsapp.id violaria a FK. Em vez de alterar essa constraint
-- (usada por dado real de escola), o Inbox Áion busca templates direto da
-- Graph API no momento de abrir o modal de agendamento (mesmo padrão de
-- fetch ao vivo já usado em InstitutionDetails.tsx:loadWaTemplates(), só sem
-- o passo de cache) e grava o payload já resolvido aqui.
-- =============================================================================

ALTER TABLE aion_scheduled_messages
  ADD COLUMN IF NOT EXISTS template_name       TEXT,
  ADD COLUMN IF NOT EXISTS template_language   TEXT,
  ADD COLUMN IF NOT EXISTS template_components JSONB DEFAULT '[]';

COMMENT ON COLUMN aion_scheduled_messages.content IS
  'Texto de pré-visualização (corpo do template já com as variáveis resolvidas, ou texto livre legado) — sempre preenchido, mesmo pra mensagens de template.';
COMMENT ON COLUMN aion_scheduled_messages.message_type IS
  'text (legado) ou template — reaproveita o mesmo vocabulário de whatsapp_messages.message_type.';
COMMENT ON COLUMN aion_scheduled_messages.template_components IS
  'Array de components já resolvido (mesmo formato enviado à Meta em template.components) — a Edge Function reenvia como está, sem precisar resolver variáveis de novo.';
