-- Add satisfaction_score to track CSAT after conversation close
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS satisfaction_score INTEGER;

-- Add satisfaction_survey_enabled flag to flow config
ALTER TABLE whatsapp_flows
  ADD COLUMN IF NOT EXISTS satisfaction_survey_enabled BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN whatsapp_conversations.satisfaction_score IS 'CSAT score 1-5 collected after conversation close via WhatsApp survey';
COMMENT ON COLUMN whatsapp_flows.satisfaction_survey_enabled IS 'Send satisfaction survey message automatically when conversation is closed';
