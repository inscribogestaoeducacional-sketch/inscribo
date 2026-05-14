-- Add bot flow state columns to whatsapp_conversations
-- bot_current_node: tracks which node the conversation is currently at
-- bot_variables: stores variables collected during the flow (e.g. {"nome_aluno": "Pedro"})

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS bot_current_node TEXT,
  ADD COLUMN IF NOT EXISTS bot_variables    JSONB DEFAULT '{}'::jsonb;

-- Add bot_flow column to whatsapp_flows if it doesn't exist
ALTER TABLE whatsapp_flows
  ADD COLUMN IF NOT EXISTS bot_flow JSONB;

COMMENT ON COLUMN whatsapp_conversations.bot_current_node IS 'ID of the current flow node for this conversation';
COMMENT ON COLUMN whatsapp_conversations.bot_variables    IS 'Variables collected during bot flow execution';
COMMENT ON COLUMN whatsapp_flows.bot_flow                 IS 'Visual flow definition: {nodes: FlowNode[], edges: FlowEdge[]}';
