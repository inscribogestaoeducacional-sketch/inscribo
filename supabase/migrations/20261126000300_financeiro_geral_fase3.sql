-- =============================================================================
-- 20261126000300_financeiro_geral_fase3.sql
-- Financeiro geral (Fase 3): Asaas de todas as empresas + investimentos rateados.
--   - Empresas Áion FIES e QSL Concursos (com contas padrão)
--   - fin_asaas_charges: caixa de entrada com TODAS as cobranças do Asaas
--   - fin_asaas_rules: "este cliente / este Pix é da empresa X, categoria Y"
--   - fin_investments (+ parcelas e rateio entre empresas)
-- Aditivo: nada existente é removido.
-- =============================================================================

INSERT INTO fin_companies (id, name, color, sort_order) VALUES
  ('00000000-0000-4000-8000-0000000000e3', 'Áion FIES',     '#f59e0b', 3),
  ('00000000-0000-4000-8000-0000000000e4', 'QSL Concursos', '#dc2626', 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO fin_accounts (company_id, name, kind, sort_order)
SELECT c.id, a.name, a.kind, a.ord
FROM fin_companies c
CROSS JOIN (VALUES ('Conta bancária','banco',1), ('Asaas','asaas',2), ('Caixa (dinheiro)','caixa',3)) AS a(name, kind, ord)
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO fin_categories (name, grp, legacy_key, system_key, sort_order) VALUES
  ('Investimentos', 'despesa', 'outro', 'investimento', 30)
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION fin_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND user_type = 'admin_geral');
$$;

-- ── Asaas ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_asaas_charges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_id      TEXT NOT NULL UNIQUE,
  customer_id   TEXT,
  customer_name TEXT,
  customer_doc  TEXT,
  description   TEXT,
  value         NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_type  TEXT,
  status        TEXT NOT NULL,
  due_date      DATE,
  paid_date     DATE,
  company_id    UUID REFERENCES fin_companies(id),
  category_id   UUID REFERENCES fin_categories(id),
  entry_id      UUID,
  ignored       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fin_asaas_charges_pending_class ON fin_asaas_charges (company_id) WHERE company_id IS NULL AND NOT ignored;

CREATE TABLE IF NOT EXISTS fin_asaas_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_field TEXT NOT NULL CHECK (match_field IN ('customer_id','customer_doc','description_contains')),
  match_value TEXT NOT NULL,
  label       TEXT,
  company_id  UUID NOT NULL REFERENCES fin_companies(id),
  category_id UUID REFERENCES fin_categories(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_field, match_value)
);

-- ── Investimentos ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fin_investments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  notes        TEXT,
  total        NUMERIC(12,2) NOT NULL CHECK (total > 0),
  installments INT NOT NULL CHECK (installments BETWEEN 1 AND 120),
  first_due    DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','cancelado')),
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fin_investment_shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES fin_investments(id) ON DELETE CASCADE,
  company_id    UUID NOT NULL REFERENCES fin_companies(id),
  pct           NUMERIC(6,3) NOT NULL CHECK (pct > 0 AND pct <= 100),
  UNIQUE (investment_id, company_id)
);
CREATE TABLE IF NOT EXISTS fin_investment_installments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_id UUID NOT NULL REFERENCES fin_investments(id) ON DELETE CASCADE,
  no            INT NOT NULL,
  due_date      DATE NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at       DATE,
  UNIQUE (investment_id, no)
);

ALTER TABLE fin_asaas_charges            ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_asaas_rules              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_investments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_investment_shares        ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin_investment_installments  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_geral_fin_asaas_charges" ON fin_asaas_charges FOR ALL USING (fin_is_admin()) WITH CHECK (fin_is_admin());
CREATE POLICY "admin_geral_fin_asaas_rules"   ON fin_asaas_rules   FOR ALL USING (fin_is_admin()) WITH CHECK (fin_is_admin());
CREATE POLICY "admin_geral_fin_investments"   ON fin_investments   FOR ALL USING (fin_is_admin()) WITH CHECK (fin_is_admin());
CREATE POLICY "admin_geral_fin_inv_shares"    ON fin_investment_shares FOR ALL USING (fin_is_admin()) WITH CHECK (fin_is_admin());
CREATE POLICY "admin_geral_fin_inv_installs"  ON fin_investment_installments FOR ALL USING (fin_is_admin()) WITH CHECK (fin_is_admin());

-- ── Aplica regras e cria os lançamentos das cobranças do Asaas ───────────────
-- Chamada pela função fin-asaas-sync (service role) e pela tela (admin).
CREATE OR REPLACE FUNCTION fin_asaas_apply() RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rules INT := 0; v_linked INT := 0; v_new INT := 0; v_upd INT := 0; v_del INT := 0;
  c RECORD; v_account UUID; v_cat TEXT; v_status TEXT; v_date DATE; v_method TEXT; v_entry UUID; v_desc TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT fin_is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;

  -- 1) regras salvas: cliente / CPF-CNPJ / trecho da descrição
  UPDATE fin_asaas_charges ch SET company_id = r.company_id, category_id = COALESCE(ch.category_id, r.category_id), updated_at = now()
  FROM fin_asaas_rules r
  WHERE ch.company_id IS NULL AND NOT ch.ignored AND (
       (r.match_field = 'customer_id'  AND r.match_value = ch.customer_id)
    OR (r.match_field = 'customer_doc' AND r.match_value = ch.customer_doc)
    OR (r.match_field = 'description_contains' AND ch.description ILIKE '%' || r.match_value || '%'));
  GET DIAGNOSTICS v_rules = ROW_COUNT;

  -- 2) cobranças que o Edu já tem em payments: já viram lançamento pelo gatilho; só vincula
  UPDATE fin_asaas_charges ch SET company_id = '00000000-0000-4000-8000-0000000000e1',
         entry_id = fe.id, updated_at = now()
  FROM payments p JOIN financial_entries fe ON fe.external_ref = 'asaas:' || p.id
  WHERE (p.asaas_payment_id = ch.asaas_id OR p.asaas_id = ch.asaas_id) AND ch.entry_id IS NULL;
  GET DIAGNOSTICS v_linked = ROW_COUNT;
  -- cobrança do Edu sem lançamento (valor zero/cancelada): fica fora
  UPDATE fin_asaas_charges ch SET company_id = '00000000-0000-4000-8000-0000000000e1', ignored = true, updated_at = now()
  FROM payments p
  WHERE (p.asaas_payment_id = ch.asaas_id OR p.asaas_id = ch.asaas_id) AND ch.entry_id IS NULL AND ch.company_id IS NULL;

  -- 3) cria / atualiza / remove lançamentos das cobranças já classificadas (de outras empresas)
  FOR c IN SELECT * FROM fin_asaas_charges WHERE company_id IS NOT NULL AND NOT ignored LOOP
    v_status := CASE WHEN c.status IN ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH') THEN 'pago'
                     WHEN c.status IN ('PENDING','OVERDUE','AWAITING_RISK_ANALYSIS') THEN 'pendente'
                     ELSE NULL END;
    IF c.entry_id IS NOT NULL THEN
      -- só mexe em lançamentos criados por aqui (os do Edu seguem o gatilho de payments)
      IF EXISTS (SELECT 1 FROM financial_entries WHERE id = c.entry_id AND external_ref = 'asaasc:' || c.asaas_id) THEN
        IF v_status IS NULL THEN
          DELETE FROM financial_entries WHERE id = c.entry_id AND status = 'pendente';
          UPDATE fin_asaas_charges SET entry_id = NULL WHERE id = c.id; v_del := v_del + 1;
        ELSE
          UPDATE financial_entries SET status = v_status, amount = c.value,
                 entry_date = CASE WHEN v_status = 'pago' THEN COALESCE(c.paid_date, c.due_date, CURRENT_DATE) ELSE COALESCE(c.due_date, CURRENT_DATE) END,
                 due_date = c.due_date, updated_at = now()
          WHERE id = c.entry_id AND (status IS DISTINCT FROM v_status OR amount IS DISTINCT FROM c.value);
          IF FOUND THEN v_upd := v_upd + 1; END IF;
        END IF;
      END IF;
      CONTINUE;
    END IF;
    IF v_status IS NULL OR COALESCE(c.value, 0) <= 0 THEN CONTINUE; END IF;

    SELECT id INTO v_account FROM fin_accounts WHERE company_id = c.company_id AND kind = 'asaas' ORDER BY sort_order LIMIT 1;
    SELECT legacy_key INTO v_cat FROM fin_categories WHERE id = c.category_id;
    v_method := CASE c.billing_type WHEN 'PIX' THEN 'pix' WHEN 'BOLETO' THEN 'boleto' WHEN 'CREDIT_CARD' THEN 'cartao_credito'
                                    WHEN 'DEBIT_CARD' THEN 'cartao_debito' WHEN 'TRANSFER' THEN 'transferencia' ELSE NULL END;
    v_date := CASE WHEN v_status = 'pago' THEN COALESCE(c.paid_date, c.due_date, CURRENT_DATE) ELSE COALESCE(c.due_date, CURRENT_DATE) END;
    v_desc := COALESCE(NULLIF(c.customer_name, ''), 'Cliente Asaas') || COALESCE(' — ' || NULLIF(c.description, ''), '');

    INSERT INTO financial_entries (type, amount, description, category, category_id, account_id, payment_method,
                                   entry_date, due_date, status, source, company_id, external_ref)
    VALUES ('entrada', c.value, v_desc, COALESCE(v_cat, 'outro'), c.category_id, v_account, v_method,
            v_date, c.due_date, v_status, 'asaas', c.company_id, 'asaasc:' || c.asaas_id)
    ON CONFLICT (external_ref) WHERE external_ref IS NOT NULL DO NOTHING
    RETURNING id INTO v_entry;
    IF v_entry IS NULL THEN SELECT id INTO v_entry FROM financial_entries WHERE external_ref = 'asaasc:' || c.asaas_id; ELSE v_new := v_new + 1; END IF;
    UPDATE fin_asaas_charges SET entry_id = v_entry, updated_at = now() WHERE id = c.id;
  END LOOP;

  RETURN json_build_object('regras', v_rules, 'vinculadas_edu', v_linked, 'novos', v_new, 'atualizados', v_upd, 'removidos', v_del,
                           'sem_classificacao', (SELECT count(*) FROM fin_asaas_charges WHERE company_id IS NULL AND NOT ignored));
END $$;

-- ── Classifica cobranças (e lembra a regra para as próximas) ─────────────────
CREATE OR REPLACE FUNCTION fin_asaas_classify(p_charge_ids UUID[], p_company UUID, p_category UUID, p_remember BOOLEAN DEFAULT false)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c RECORD; n INT := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT fin_is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  FOR c IN SELECT * FROM fin_asaas_charges WHERE id = ANY(p_charge_ids) LOOP
    UPDATE fin_asaas_charges SET company_id = p_company, category_id = p_category, ignored = false, updated_at = now() WHERE id = c.id;
    IF c.entry_id IS NOT NULL THEN
      UPDATE financial_entries SET company_id = p_company, category_id = p_category,
             category = COALESCE((SELECT legacy_key FROM fin_categories WHERE id = p_category), 'outro'),
             account_id = (SELECT id FROM fin_accounts WHERE company_id = p_company AND kind = 'asaas' ORDER BY sort_order LIMIT 1),
             updated_at = now()
      WHERE id = c.entry_id;
    END IF;
    IF p_remember AND c.customer_id IS NOT NULL THEN
      INSERT INTO fin_asaas_rules (match_field, match_value, label, company_id, category_id)
      VALUES ('customer_id', c.customer_id, c.customer_name, p_company, p_category)
      ON CONFLICT (match_field, match_value) DO UPDATE SET company_id = EXCLUDED.company_id, category_id = EXCLUDED.category_id;
    END IF;
    n := n + 1;
  END LOOP;
  RETURN fin_asaas_apply();
END $$;

CREATE OR REPLACE FUNCTION fin_asaas_ignore(p_charge_ids UUID[]) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT fin_is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  UPDATE fin_asaas_charges SET ignored = true, updated_at = now() WHERE id = ANY(p_charge_ids);
END $$;

-- ── Investimentos: cria parcelas e o rateio nos lançamentos de cada empresa ──
CREATE OR REPLACE FUNCTION fin_create_investment(p_name TEXT, p_notes TEXT, p_total NUMERIC, p_installments INT, p_first_due DATE, p_shares JSONB)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id UUID; v_cat UUID; v_sum NUMERIC := 0; s JSONB; i INT; j INT; n_sh INT;
  v_cents BIGINT; v_base BIGINT; v_inst_cents BIGINT; v_inst UUID; v_inst_amount NUMERIC; v_due DATE;
  v_sh_cents BIGINT; v_sh_acc BIGINT; v_company UUID; v_pct NUMERIC;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT fin_is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_total <= 0 OR p_installments < 1 THEN RAISE EXCEPTION 'valor e parcelas inválidos'; END IF;
  FOR s IN SELECT * FROM jsonb_array_elements(p_shares) LOOP v_sum := v_sum + (s->>'pct')::NUMERIC; END LOOP;
  IF abs(v_sum - 100) > 0.001 THEN RAISE EXCEPTION 'o rateio precisa somar 100%% (soma atual: %)', v_sum; END IF;
  n_sh := jsonb_array_length(p_shares);
  SELECT id INTO v_cat FROM fin_categories WHERE system_key = 'investimento';

  INSERT INTO fin_investments (name, notes, total, installments, first_due, created_by)
  VALUES (p_name, p_notes, p_total, p_installments, p_first_due, auth.uid()) RETURNING id INTO v_id;
  FOR s IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    INSERT INTO fin_investment_shares (investment_id, company_id, pct) VALUES (v_id, (s->>'company_id')::UUID, (s->>'pct')::NUMERIC);
  END LOOP;

  v_cents := round(p_total * 100); v_base := v_cents / p_installments;
  FOR i IN 1..p_installments LOOP
    v_inst_cents := CASE WHEN i = p_installments THEN v_cents - v_base * (p_installments - 1) ELSE v_base END;
    v_inst_amount := v_inst_cents / 100.0;
    v_due := (p_first_due + ((i - 1) || ' months')::INTERVAL)::DATE;
    INSERT INTO fin_investment_installments (investment_id, no, due_date, amount) VALUES (v_id, i, v_due, v_inst_amount) RETURNING id INTO v_inst;

    v_sh_acc := 0; j := 0;
    FOR s IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
      j := j + 1; v_company := (s->>'company_id')::UUID; v_pct := (s->>'pct')::NUMERIC;
      v_sh_cents := CASE WHEN j = n_sh THEN v_inst_cents - v_sh_acc ELSE round(v_inst_cents * v_pct / 100) END;
      v_sh_acc := v_sh_acc + v_sh_cents;
      IF v_sh_cents > 0 THEN
        INSERT INTO financial_entries (type, amount, description, category, category_id, account_id, entry_date, due_date, status, source,
                                       company_id, installment_no, installment_total, group_id, external_ref, created_by)
        VALUES ('saida', v_sh_cents / 100.0, 'Investimento: ' || p_name, 'outro', v_cat,
                (SELECT id FROM fin_accounts WHERE company_id = v_company AND kind = 'banco' ORDER BY sort_order LIMIT 1),
                v_due, v_due, 'pendente', 'manual', v_company, i, p_installments, v_id, 'inv:' || v_inst || ':' || v_company, auth.uid());
      END IF;
    END LOOP;
  END LOOP;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION fin_pay_investment_installment(p_installment UUID, p_date DATE, p_paid BOOLEAN DEFAULT true) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_due DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT fin_is_admin() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT due_date INTO v_due FROM fin_investment_installments WHERE id = p_installment;
  IF v_due IS NULL THEN RAISE EXCEPTION 'parcela não encontrada'; END IF;
  UPDATE fin_investment_installments SET paid_at = CASE WHEN p_paid THEN p_date ELSE NULL END WHERE id = p_installment;
  UPDATE financial_entries SET status = CASE WHEN p_paid THEN 'pago' ELSE 'pendente' END,
         entry_date = CASE WHEN p_paid THEN p_date ELSE v_due END, updated_at = now()
  WHERE external_ref LIKE 'inv:' || p_installment || ':%';
END $$;

-- Cancelar investimento é feito pelo app (apaga parcelas pendentes e marca como cancelado).

REVOKE ALL ON FUNCTION fin_asaas_apply(), fin_asaas_classify(UUID[], UUID, UUID, BOOLEAN), fin_asaas_ignore(UUID[]),
  fin_create_investment(TEXT, TEXT, NUMERIC, INT, DATE, JSONB), fin_pay_investment_installment(UUID, DATE, BOOLEAN),
  fin_generate_recurrences() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fin_asaas_apply(), fin_asaas_classify(UUID[], UUID, UUID, BOOLEAN), fin_asaas_ignore(UUID[]),
  fin_create_investment(TEXT, TEXT, NUMERIC, INT, DATE, JSONB), fin_pay_investment_installment(UUID, DATE, BOOLEAN),
  fin_generate_recurrences() TO authenticated, service_role;
