-- =============================================================================
-- 20261126000200_financeiro_geral_fase2.sql
-- Financeiro geral (Fase 2): estrutura completa para TODAS as empresas.
--   - fin_accounts: contas por empresa (onde o dinheiro entra/sai)
--   - fin_categories: categorias (receita / custo / despesa), iguais para todas
--   - fin_recurrences: contas recorrentes (aluguel, água, luz...)
--   - financial_entries: conta, categoria, forma de pagamento, parcelas, recorrência
--   - Asaas: pagamentos do Edu entram sozinhos no financeiro (trigger em payments)
-- Aditivo: nenhuma coluna existente é removida ou alterada.
-- =============================================================================

CREATE TABLE IF NOT EXISTS fin_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES fin_companies(id),
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'banco' CHECK (kind IN ('banco','asaas','caixa','cartao','outro')),
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS fin_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  grp         TEXT NOT NULL CHECK (grp IN ('receita','custo','despesa')),
  legacy_key  TEXT NOT NULL DEFAULT 'outro',
  system_key  TEXT UNIQUE,
  active      BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fin_recurrences (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES fin_companies(id),
  type           TEXT NOT NULL CHECK (type IN ('entrada','saida')),
  description    TEXT NOT NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category_id    UUID REFERENCES fin_categories(id),
  account_id     UUID REFERENCES fin_accounts(id),
  payment_method TEXT CHECK (payment_method IN ('pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','outro')),
  frequency      TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','yearly')),
  next_date      DATE NOT NULL,
  end_date       DATE,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE financial_entries
  ADD COLUMN IF NOT EXISTS account_id         UUID REFERENCES fin_accounts(id),
  ADD COLUMN IF NOT EXISTS category_id        UUID REFERENCES fin_categories(id),
  ADD COLUMN IF NOT EXISTS payment_method     TEXT CHECK (payment_method IN ('pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','outro')),
  ADD COLUMN IF NOT EXISTS installment_no     INT,
  ADD COLUMN IF NOT EXISTS installment_total  INT,
  ADD COLUMN IF NOT EXISTS group_id           UUID,
  ADD COLUMN IF NOT EXISTS recurrence_id      UUID REFERENCES fin_recurrences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_ref       TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_entries_external_ref
  ON financial_entries (external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_group ON financial_entries (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_entries_account ON financial_entries (account_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_category ON financial_entries (category_id);

-- RLS: somente admin_geral
ALTER TABLE fin_accounts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_recurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geral_fin_accounts" ON fin_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));
CREATE POLICY "admin_geral_fin_categories" ON fin_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));
CREATE POLICY "admin_geral_fin_recurrences" ON fin_recurrences FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral'));

-- Categorias iniciais (legacy_key mantém a aba antiga "Visão Geral (Edu)" funcionando)
INSERT INTO fin_categories (name, grp, legacy_key, system_key, sort_order) VALUES
  ('Mensalidades',          'receita', 'venda',              'mensalidade',   1),
  ('Implantação',           'receita', 'implantacao_avulsa', 'implantacao',   2),
  ('Transmissão WhatsApp',  'receita', 'venda',              'transmissao',   3),
  ('Venda / Assinatura',    'receita', 'venda',              NULL,            4),
  ('Consultoria',           'receita', 'consultoria',        NULL,            5),
  ('Patrocínio',            'receita', 'patrocinio',         NULL,            6),
  ('Outras receitas',       'receita', 'outro',              NULL,            7),
  ('Infraestrutura e hospedagem', 'custo', 'infraestrutura', NULL,            10),
  ('Software e ferramentas','custo',   'software',           NULL,            11),
  ('Taxas e comissões',     'custo',   'outro',              NULL,            12),
  ('Aluguel',               'despesa', 'infraestrutura',     NULL,            20),
  ('Energia',               'despesa', 'infraestrutura',     NULL,            21),
  ('Água',                  'despesa', 'infraestrutura',     NULL,            22),
  ('Internet e telefone',   'despesa', 'infraestrutura',     NULL,            23),
  ('Folha e colaboradores', 'despesa', 'folha',              NULL,            24),
  ('Retirada de sócios',    'despesa', 'folha',              NULL,            25),
  ('Marketing e tráfego pago','despesa','marketing',         NULL,            26),
  ('Impostos',              'despesa', 'imposto',            NULL,            27),
  ('Serviços de terceiros', 'despesa', 'outro',              NULL,            28),
  ('Outras despesas',       'despesa', 'outro',              NULL,            29)
ON CONFLICT (name) DO NOTHING;

-- Contas iniciais: cada empresa começa com Banco, Asaas e Caixa
INSERT INTO fin_accounts (company_id, name, kind, sort_order)
SELECT c.id, a.name, a.kind, a.ord
FROM fin_companies c
CROSS JOIN (VALUES ('Conta bancária','banco',1), ('Asaas','asaas',2), ('Caixa (dinheiro)','caixa',3)) AS a(name, kind, ord)
ON CONFLICT (company_id, name) DO NOTHING;

-- Lançamentos antigos: ganham categoria nova (pela descrição, depois pela categoria antiga) e a conta bancária
UPDATE financial_entries e SET category_id = (SELECT id FROM fin_categories WHERE name =
  CASE
    WHEN e.description ILIKE '%aluguel%'                                   THEN 'Aluguel'
    WHEN e.description ILIKE '%energisa%' OR e.description ILIKE '%energia%' THEN 'Energia'
    WHEN e.description ILIKE '%internet%'                                  THEN 'Internet e telefone'
    WHEN e.description ILIKE '%claude%'                                    THEN 'Software e ferramentas'
    WHEN e.description ILIKE '%trafego%' OR e.description ILIKE '%tráfego%' THEN 'Marketing e tráfego pago'
    WHEN e.category = 'folha'                                              THEN 'Folha e colaboradores'
    WHEN e.category = 'marketing'                                          THEN 'Marketing e tráfego pago'
    WHEN e.category = 'software'                                           THEN 'Software e ferramentas'
    WHEN e.category = 'infraestrutura'                                     THEN 'Infraestrutura e hospedagem'
    WHEN e.category = 'imposto'                                            THEN 'Impostos'
    WHEN e.category = 'venda'                                              THEN 'Venda / Assinatura'
    WHEN e.category = 'consultoria'                                        THEN 'Consultoria'
    WHEN e.category = 'patrocinio'                                         THEN 'Patrocínio'
    WHEN e.type = 'entrada'                                                THEN 'Outras receitas'
    ELSE 'Outras despesas'
  END)
WHERE e.category_id IS NULL AND e.source = 'manual';

UPDATE financial_entries e SET account_id = (SELECT id FROM fin_accounts a WHERE a.company_id = e.company_id AND a.name = 'Conta bancária')
WHERE e.account_id IS NULL AND e.source = 'manual';

-- Gera os lançamentos "a pagar/receber" das recorrentes (até 35 dias à frente).
CREATE OR REPLACE FUNCTION fin_generate_recurrences()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r RECORD; n INT := 0; v_legacy TEXT; v_next DATE; step INTERVAL;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  FOR r IN SELECT * FROM fin_recurrences WHERE active LOOP
    step := CASE r.frequency WHEN 'weekly' THEN INTERVAL '1 week' WHEN 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;
    SELECT legacy_key INTO v_legacy FROM fin_categories WHERE id = r.category_id;
    v_next := r.next_date;
    WHILE v_next <= CURRENT_DATE + 35 AND (r.end_date IS NULL OR v_next <= r.end_date) LOOP
      INSERT INTO financial_entries (type, amount, description, category, category_id, account_id, payment_method,
                                     entry_date, due_date, status, source, company_id, recurrence_id, external_ref)
      VALUES (r.type, r.amount, r.description, COALESCE(v_legacy, 'outro'), r.category_id, r.account_id, r.payment_method,
              v_next, v_next, 'pendente', 'recorrente', r.company_id, r.id, 'rec:' || r.id || ':' || v_next)
      ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO NOTHING;
      n := n + 1;
      v_next := (v_next + step)::date;
    END LOOP;
    UPDATE fin_recurrences SET next_date = v_next WHERE id = r.id;
  END LOOP;
  RETURN n;
END $$;

-- Asaas -> financeiro: cada cobrança do Edu vira um lançamento (pago, a receber ou removido se cancelada).
CREATE OR REPLACE FUNCTION fin_sync_asaas_payment()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref TEXT := 'asaas:' || NEW.id;
  v_company UUID := '00000000-0000-4000-8000-0000000000e1';
  v_account UUID; v_cat UUID; v_legacy TEXT; v_key TEXT;
BEGIN
  -- Nunca pode derrubar o webhook do Asaas: qualquer erro aqui só vira aviso no log.
  BEGIN
  IF COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled','refunded') THEN
    DELETE FROM financial_entries WHERE external_ref = v_ref AND status = 'pendente';
    RETURN NEW;
  END IF;
  v_key := CASE NEW.payment_type WHEN 'monthly' THEN 'mensalidade' WHEN 'implementation' THEN 'implantacao' WHEN 'broadcast' THEN 'transmissao' ELSE NULL END;
  SELECT id, legacy_key INTO v_cat, v_legacy FROM fin_categories WHERE system_key = v_key;
  SELECT id INTO v_account FROM fin_accounts WHERE company_id = v_company AND kind = 'asaas' ORDER BY sort_order LIMIT 1;

  INSERT INTO financial_entries (type, amount, description, category, category_id, account_id,
                                 entry_date, due_date, status, source, company_id, external_ref)
  VALUES ('entrada', COALESCE(NEW.amount, 0),
          COALESCE(NULLIF(NEW.description, ''), 'Cobrança Asaas'),
          COALESCE(v_legacy, 'outro'), v_cat, v_account,
          CASE WHEN NEW.status = 'paid' THEN COALESCE(NEW.paid_at::date, CURRENT_DATE) ELSE COALESCE(NEW.due_date, CURRENT_DATE) END,
          NEW.due_date,
          CASE WHEN NEW.status = 'paid' THEN 'pago' ELSE 'pendente' END,
          'asaas', v_company, v_ref)
  ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO UPDATE SET
    amount = EXCLUDED.amount, description = EXCLUDED.description, status = EXCLUDED.status,
    entry_date = EXCLUDED.entry_date, due_date = EXCLUDED.due_date, updated_at = now();
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fin_sync_asaas_payment: %', SQLERRM;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fin_sync_asaas_payment
  AFTER INSERT OR UPDATE OF status, amount, paid_at, due_date ON payments
  FOR EACH ROW EXECUTE FUNCTION fin_sync_asaas_payment();

-- Traz as cobranças que já existem (idempotente: external_ref é único)
INSERT INTO financial_entries (type, amount, description, category, category_id, account_id,
                               entry_date, due_date, status, source, company_id, external_ref)
SELECT 'entrada', COALESCE(p.amount, 0), COALESCE(NULLIF(p.description, ''), 'Cobrança Asaas'),
       COALESCE(c.legacy_key, 'outro'), c.id,
       (SELECT id FROM fin_accounts a WHERE a.company_id = '00000000-0000-4000-8000-0000000000e1' AND a.kind = 'asaas' ORDER BY sort_order LIMIT 1),
       CASE WHEN p.status = 'paid' THEN COALESCE(p.paid_at::date, CURRENT_DATE) ELSE COALESCE(p.due_date, CURRENT_DATE) END,
       p.due_date,
       CASE WHEN p.status = 'paid' THEN 'pago' ELSE 'pendente' END,
       'asaas', '00000000-0000-4000-8000-0000000000e1', 'asaas:' || p.id
FROM payments p
LEFT JOIN fin_categories c ON c.system_key = CASE p.payment_type WHEN 'monthly' THEN 'mensalidade' WHEN 'implementation' THEN 'implantacao' WHEN 'broadcast' THEN 'transmissao' END
WHERE p.status IN ('paid','pending','overdue')
  AND COALESCE(p.amount, 0) > 0
ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO NOTHING;
