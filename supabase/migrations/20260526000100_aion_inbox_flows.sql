-- =============================================================================
-- 20260526000100_aion_inbox_flows.sql
-- Tabelas: aion_flows, aion_keywords
-- Bot visual e QR Codes para o Inbox Corporativo da Áion
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. aion_flows — fluxo visual do bot da Áion (sem institution_id)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aion_flows (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL DEFAULT 'Fluxo Principal' UNIQUE,
  is_active           BOOLEAN     DEFAULT false,
  bot_enabled         BOOLEAN     DEFAULT false,
  bot_flow            JSONB       DEFAULT '{"nodes":[],"edges":[]}',
  welcome_message     TEXT        DEFAULT 'Olá! Bem-vindo à Áion EDU. Como posso ajudar?',
  off_hours_message   TEXT        DEFAULT 'Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.',
  working_days        TEXT[]      DEFAULT ARRAY['MON','TUE','WED','THU','FRI'],
  working_start       TEXT        DEFAULT '08:00',
  working_end         TEXT        DEFAULT '18:00',
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE aion_flows DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. aion_keywords — keywords/QR Codes configuráveis
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aion_keywords (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword        TEXT        NOT NULL UNIQUE,
  label          TEXT        NOT NULL,
  description    TEXT,
  auto_response  TEXT,
  tag            TEXT,
  source         TEXT        DEFAULT 'whatsapp',
  create_lead    BOOLEAN     DEFAULT true,
  whatsapp_link  TEXT        GENERATED ALWAYS AS (
    'https://wa.me/5583993444383?text=' || replace(keyword, ' ', '%20')
  ) STORED,
  is_active      BOOLEAN     DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE aion_keywords DISABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Fluxo padrão
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO aion_flows (name, is_active, bot_enabled, welcome_message)
VALUES (
  'Fluxo Principal Áion',
  true,
  true,
  E'Olá! Bem-vindo à Áion EDU 👋\n\nSou o assistente virtual da Áion. Para te atender melhor, me diga:\n\n1️⃣ Sou cliente Áion e preciso de suporte\n2️⃣ Quero conhecer o sistema\n3️⃣ Falar com um consultor'
)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. bot_flow padrão (menu de 3 opções + transfers)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE aion_flows
SET bot_flow = '{
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": {"x": 200, "y": 80},
      "data": {},
      "width": 240,
      "height": 82
    },
    {
      "id": "menu-1",
      "type": "menu",
      "position": {"x": 200, "y": 220},
      "data": {
        "menuText": "Olá! Bem-vindo à Áion EDU 👋\n\nComo posso ajudar?",
        "options": [
          {"text": "Sou cliente - Suporte", "id": "opt-support"},
          {"text": "Quero conhecer o sistema", "id": "opt-sales"},
          {"text": "Falar com consultor", "id": "opt-human"}
        ]
      },
      "width": 240,
      "height": 200
    },
    {
      "id": "transfer-support",
      "type": "transfer",
      "position": {"x": 0, "y": 500},
      "data": {
        "message": "Perfeito! Vou te direcionar para nosso time de suporte. Aguarde um momento 🔧",
        "transferType": "attendant"
      },
      "width": 240,
      "height": 120
    },
    {
      "id": "transfer-sales",
      "type": "transfer",
      "position": {"x": 260, "y": 500},
      "data": {
        "message": "Ótimo! Vou te conectar com um de nossos consultores que vai apresentar o sistema 🚀",
        "transferType": "attendant"
      },
      "width": 240,
      "height": 120
    },
    {
      "id": "transfer-human",
      "type": "transfer",
      "position": {"x": 520, "y": 500},
      "data": {
        "message": "Claro! Conectando você com um de nossos consultores agora 👤",
        "transferType": "attendant"
      },
      "width": 240,
      "height": 120
    }
  ],
  "edges": [
    {"id": "e1", "fromNodeId": "start-1",      "fromPortId": "out",   "toNodeId": "menu-1",          "toPortId": "in"},
    {"id": "e2", "fromNodeId": "menu-1",        "fromPortId": "opt-0", "toNodeId": "transfer-support", "toPortId": "in"},
    {"id": "e3", "fromNodeId": "menu-1",        "fromPortId": "opt-1", "toNodeId": "transfer-sales",   "toPortId": "in"},
    {"id": "e4", "fromNodeId": "menu-1",        "fromPortId": "opt-2", "toNodeId": "transfer-human",   "toPortId": "in"}
  ]
}'::jsonb
WHERE name = 'Fluxo Principal Áion';
