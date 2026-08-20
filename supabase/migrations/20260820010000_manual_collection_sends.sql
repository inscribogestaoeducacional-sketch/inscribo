-- =============================================================================
-- 20260820000000_manual_collection_sends.sql
-- Auditoria + fonte do redirect pra cobrança manual via WhatsApp (Admin
-- Financeiro → AdminFinancial.tsx). Cada envio de template (cobranca_vencida /
-- link_mensalidade) grava uma linha aqui, com um código curto único que vira
-- o sufixo da URL do botão do template (https://www.aionedu.com.br/pagar/{{4}}
-- — ver templates). O redirect público (api/pagar-redirect.ts) busca por
-- `codigo` com service role (bypassa a RLS abaixo de propósito) e manda 302
-- pro `payment_link_real` (link de verdade do Asaas).
--
-- Sem cron/trigger algum — é sempre ação manual e síncrona disparada por
-- clique de admin. O cron overdue-payment-reminders existente continua
-- exclusivamente e-mail, não tem relação com esta tabela.
-- =============================================================================

CREATE TABLE IF NOT EXISTS manual_collection_sends (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            TEXT        UNIQUE NOT NULL,
  payment_id        UUID        NOT NULL REFERENCES payments(id),
  institution_id    UUID        REFERENCES institutions(id),
  template_used     TEXT        NOT NULL CHECK (template_used IN ('cobranca_vencida', 'link_mensalidade')),
  recipient_phone   TEXT        NOT NULL,
  recipient_label   TEXT,
  payment_link_real TEXT        NOT NULL,
  sent_by           UUID        REFERENCES users(id),
  status            TEXT        NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- UNIQUE já cria índice implícito, mas nomeado explicitamente porque é a
-- própria query do redirect público (alto tráfego relativo, um lookup por
-- clique no WhatsApp) — deixa claro que esse é o acesso que importa otimizar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_manual_collection_sends_codigo
  ON manual_collection_sends(codigo);

CREATE INDEX IF NOT EXISTS idx_manual_collection_sends_payment
  ON manual_collection_sends(payment_id);

ALTER TABLE manual_collection_sends ENABLE ROW LEVEL SECURITY;

-- Leitura/escrita só super admin — o redirect público NUNCA passa por RLS
-- (usa a service role key em api/pagar-redirect.ts), então não precisa (e não
-- deve) existir policy pra anon/authenticated aqui.
DROP POLICY IF EXISTS "manual_collection_sends_admin_geral" ON manual_collection_sends;
CREATE POLICY "manual_collection_sends_admin_geral" ON manual_collection_sends
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());
