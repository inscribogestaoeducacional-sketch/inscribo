-- =============================================================================
-- 20260928000000_broadcast_finance_functions.sql
-- Transmissões — etapa 6 (Financeiro da escola + Admin), item 1: suporte no
-- banco pras telas. Nenhuma tabela nova.
--
--   1. Motivo obrigatório em todo ajuste manual de crédito (CHECK).
--   2. broadcast_adjust_credit — ajuste do Super Admin, atômico, com saldo
--      esperado (recusa se outra pessoa lançou algo no meio) e saldo
--      antes/depois na resposta.
--   3. broadcast_credit_statement — extrato paginado com saldo após cada
--      lançamento (calculado sobre o histórico inteiro, não só a página).
--   4. broadcast_institution_summary — resumo por escola (ou de todas, pro
--      Super Admin: visão consolidada). Margem da Áion e custo estimado da
--      Meta só pro Super Admin.
--
-- Definição de margem aprovada:
--   mensagens faturadas = precificadas − as que voltaram como crédito
--                         (falha, cancelamento: credit_entry_id preenchido);
--   margem da Áion      = taxa por mensagem × faturadas
--                         + acréscimo do mínimo do Asaas (quando a cobrança
--                           subiu pro piso: cobrado − (subtotal − crédito usado));
--   custo Meta estimado = custo Meta por mensagem × faturadas; zero com conta
--                         própria na Meta (a Meta cobra a escola direto).
-- "Estimado": vem da tabela de preço mantida pela Áion, não da fatura da Meta.
-- =============================================================================

-- ── 1. Motivo obrigatório no ajuste manual ─────────────────────────────────
-- Conferido antes: o único manual_adjust existente (crédito de teste do
-- Ágape) tem motivo. broadcast_cancel_campaign já grava motivo ao devolver.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'broadcast_credit_ledger_manual_reason_check') THEN
    ALTER TABLE broadcast_credit_ledger ADD CONSTRAINT broadcast_credit_ledger_manual_reason_check
      CHECK (kind <> 'manual_adjust' OR char_length(btrim(coalesce(note, ''))) >= 3);
  END IF;
END $$;

-- Ordem estável do extrato: lançamentos da mesma transação têm o mesmo
-- created_at (now() é fixo por transação) e o desempate por id (uuid) é
-- aleatório — o saldo acumulado sairia embaralhado. seq é a ordem real de
-- gravação. (ADD COLUMN não dispara o trigger de "extrato imutável".)
ALTER TABLE broadcast_credit_ledger
  ADD COLUMN IF NOT EXISTS seq BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE INDEX IF NOT EXISTS idx_broadcast_credit_ledger_institution_seq
  ON broadcast_credit_ledger(institution_id, seq);

-- ── 2. Ajuste manual de crédito (Super Admin) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_adjust_credit(
  p_institution_id   UUID,
  p_amount           NUMERIC,
  p_reason           TEXT,
  p_expected_balance NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_amount  NUMERIC(12,2) := round(coalesce(p_amount, 0), 2);
  v_reason  TEXT := btrim(coalesce(p_reason, ''));
  v_before  NUMERIC(12,2);
  v_entry   UUID;
BEGIN
  IF NOT is_super_admin_user() THEN
    RAISE EXCEPTION 'Apenas Super Admin pode ajustar crédito';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM institutions WHERE id = p_institution_id) THEN
    RAISE EXCEPTION 'Escola não encontrada';
  END IF;
  IF v_amount = 0 THEN RAISE EXCEPTION 'Informe um valor diferente de zero'; END IF;
  IF char_length(v_reason) < 3 THEN RAISE EXCEPTION 'Informe o motivo do ajuste'; END IF;
  IF char_length(v_reason) > 500 THEN RAISE EXCEPTION 'Motivo com mais de 500 caracteres'; END IF;

  -- Mesma trava por escola do extrato: nada entra entre a leitura e a gravação.
  PERFORM pg_advisory_xact_lock(hashtext('broadcast_credit:' || p_institution_id::text));
  v_before := broadcast_credit_balance(p_institution_id);

  IF p_expected_balance IS NOT NULL AND v_before <> round(p_expected_balance, 2) THEN
    RAISE EXCEPTION 'O saldo mudou enquanto você preparava o ajuste (agora R$ %). Revise antes de confirmar.', v_before;
  END IF;
  IF v_before + v_amount < 0 THEN
    RAISE EXCEPTION 'Débito maior que o saldo (saldo R$ %, débito R$ %)', v_before, -v_amount;
  END IF;

  INSERT INTO broadcast_credit_ledger(institution_id, amount_brl, kind, note, created_by)
  VALUES (p_institution_id, v_amount, 'manual_adjust', v_reason, auth.uid())
  RETURNING id INTO v_entry;

  RETURN jsonb_build_object(
    'entry_id', v_entry,
    'balance_before_brl', v_before,
    'amount_brl', v_amount,
    'balance_after_brl', v_before + v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_adjust_credit(UUID, NUMERIC, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_adjust_credit(UUID, NUMERIC, TEXT, NUMERIC) TO authenticated;

-- ── Acesso comum às funções de leitura ─────────────────────────────────────
-- Mesmo critério da RLS de leitura do módulo: usuário da própria escola, ou
-- Super Admin.
CREATE OR REPLACE FUNCTION public.broadcast_can_read_institution(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_super_admin_user()
      OR p_institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.broadcast_can_read_institution(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_can_read_institution(UUID) TO authenticated;

-- ── 3. Extrato do crédito ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.broadcast_credit_statement(
  p_institution_id UUID,
  p_limit          INTEGER DEFAULT 20,
  p_offset         INTEGER DEFAULT 0
)
RETURNS TABLE (
  id               UUID,
  created_at       TIMESTAMPTZ,
  kind             TEXT,
  amount_brl       NUMERIC,
  balance_after    NUMERIC,
  description      TEXT,
  campaign_id      UUID,
  campaign_name    TEXT,
  recipient_count  INTEGER,
  created_by_name  TEXT,
  total_count      BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_admin BOOLEAN := is_super_admin_user();
BEGIN
  IF NOT broadcast_can_read_institution(p_institution_id) THEN
    RAISE EXCEPTION 'Sem acesso ao extrato desta escola';
  END IF;

  RETURN QUERY
  WITH l AS (
    SELECT e.*,
           sum(e.amount_brl) OVER (ORDER BY e.seq) AS running,
           count(*) OVER ()                        AS total
    FROM broadcast_credit_ledger e
    WHERE e.institution_id = p_institution_id
  )
  SELECT l.id, l.created_at, l.kind, l.amount_brl, l.running,
         CASE l.kind
           WHEN 'failed_recipients'   THEN 'Mensagens não enviadas viraram crédito — ' || coalesce('"' || c.name || '"', 'campanha excluída')
           WHEN 'applied_to_campaign' THEN 'Crédito usado na campanha ' || coalesce('"' || c.name || '"', '(excluída)')
           ELSE CASE WHEN l.campaign_id IS NOT NULL THEN l.note   -- gerado pelo sistema (ex.: devolução ao cancelar)
                     ELSE 'Ajuste da Áion: ' || l.note END
         END,
         l.campaign_id, c.name, l.recipient_count,
         CASE WHEN v_admin THEN u.full_name END,
         l.total
  FROM l
  LEFT JOIN broadcast_campaigns c ON c.id = l.campaign_id
  LEFT JOIN users u ON u.id = l.created_by
  ORDER BY l.seq DESC
  LIMIT greatest(1, least(coalesce(p_limit, 20), 200))
  OFFSET greatest(0, coalesce(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_credit_statement(UUID, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_credit_statement(UUID, INTEGER, INTEGER) TO authenticated;

-- ── 4. Resumo por escola / consolidado ─────────────────────────────────────
-- p_institution_id NULL = todas as escolas (só Super Admin).
-- Período (opcional): financeiro e mensagens pelas campanhas LIBERADAS no
-- período (paid_at — inclui as cobertas por crédito); cobrança paga/estornada
-- pela data da cobrança; "criadas" pela data de criação. Saldo de crédito é
-- sempre o atual.
CREATE OR REPLACE FUNCTION public.broadcast_institution_summary(
  p_institution_id UUID DEFAULT NULL,
  p_start          TIMESTAMPTZ DEFAULT NULL,
  p_end            TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  institution_id        UUID,
  institution_name      TEXT,
  module_enabled        BOOLEAN,
  own_account           BOOLEAN,
  credit_balance_brl    NUMERIC,
  campaigns_created     BIGINT,
  campaigns_active      BIGINT,
  campaigns_completed   BIGINT,
  campaigns_released    BIGINT,
  messages_priced       BIGINT,
  messages_billed       BIGINT,
  messages_sent         BIGINT,
  messages_delivered    BIGINT,
  messages_read         BIGINT,
  replies               BIGINT,
  charged_brl           NUMERIC,
  refunded_brl          NUMERIC,
  credit_used_brl       NUMERIC,
  aion_margin_brl       NUMERIC,
  meta_cost_est_brl     NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_admin BOOLEAN := is_super_admin_user();
  v_start TIMESTAMPTZ := coalesce(p_start, '-infinity');
  v_end   TIMESTAMPTZ := coalesce(p_end, 'infinity');
BEGIN
  IF p_institution_id IS NULL AND NOT v_admin THEN
    RAISE EXCEPTION 'Visão consolidada só pro Super Admin';
  END IF;
  IF p_institution_id IS NOT NULL AND NOT broadcast_can_read_institution(p_institution_id) THEN
    RAISE EXCEPTION 'Sem acesso ao resumo desta escola';
  END IF;

  RETURN QUERY
  WITH insts AS (
    -- Uma escola, ou (consolidado) toda escola que já tocou no módulo.
    SELECT i.id, i.name FROM institutions i
    WHERE (p_institution_id IS NOT NULL AND i.id = p_institution_id)
       OR (p_institution_id IS NULL AND (
             EXISTS (SELECT 1 FROM broadcast_settings s WHERE s.institution_id = i.id)
          OR EXISTS (SELECT 1 FROM broadcast_campaigns c WHERE c.institution_id = i.id)
          OR EXISTS (SELECT 1 FROM broadcast_credit_ledger l WHERE l.institution_id = i.id)))
  ),
  released AS (
    SELECT c.*,
           (SELECT count(*) FROM broadcast_recipients r WHERE r.campaign_id = c.id AND r.credit_entry_id IS NOT NULL) AS credited
    FROM broadcast_campaigns c
    WHERE c.institution_id IN (SELECT id FROM insts)
      AND c.paid_at IS NOT NULL AND c.paid_at >= v_start AND c.paid_at < v_end
  ),
  per_campaign AS (
    SELECT r.institution_id,
           coalesce(r.priced_recipients, 0)                                       AS priced,
           greatest(coalesce(r.priced_recipients, 0) - r.credited, 0)            AS billed,
           r.sent_count, r.delivered_count, r.read_count, r.replied_count,
           coalesce(r.credit_applied_brl, 0)                                      AS credit_used,
           coalesce(r.unit_fee_brl, 0)                                            AS fee,
           CASE WHEN coalesce(r.priced_own_account, false) THEN 0 ELSE coalesce(r.unit_meta_cost_brl, 0) END AS meta,
           greatest(coalesce(r.total_charged_brl, 0)
                    - (coalesce(r.subtotal_brl, 0) - coalesce(r.credit_applied_brl, 0)), 0) AS min_surcharge
    FROM released r
  ),
  agg AS (
    SELECT p.institution_id,
           count(*)                                            AS released_n,
           sum(p.priced)                                       AS priced,
           sum(p.billed)                                       AS billed,
           sum(p.sent_count)                                   AS sent,
           sum(p.delivered_count)                              AS delivered,
           sum(p.read_count)                                   AS read,
           sum(p.replied_count)                                AS replies,
           sum(p.credit_used)                                  AS credit_used,
           sum(round(p.fee * p.billed, 2) + p.min_surcharge)   AS margin,
           sum(round(p.meta * p.billed, 2))                    AS meta_cost
    FROM per_campaign p
    GROUP BY p.institution_id
  ),
  pays AS (
    SELECT p.institution_id,
           sum(p.amount) FILTER (WHERE p.status = 'paid'     AND coalesce(p.paid_at, p.created_at) >= v_start AND coalesce(p.paid_at, p.created_at) < v_end) AS charged,
           sum(p.amount) FILTER (WHERE p.status = 'refunded' AND p.created_at >= v_start AND p.created_at < v_end) AS refunded
    FROM payments p
    WHERE p.payment_type = 'broadcast' AND p.institution_id IN (SELECT id FROM insts)
    GROUP BY p.institution_id
  ),
  counts AS (
    SELECT c.institution_id,
           count(*) FILTER (WHERE c.created_at >= v_start AND c.created_at < v_end)                          AS created,
           count(*) FILTER (WHERE c.status IN ('pending_template','pending_payment','scheduled','sending','paused')) AS active,
           count(*) FILTER (WHERE c.status = 'completed' AND c.completed_at >= v_start AND c.completed_at < v_end) AS completed
    FROM broadcast_campaigns c
    WHERE c.institution_id IN (SELECT id FROM insts)
    GROUP BY c.institution_id
  )
  -- Tipos explícitos: sum() de inteiro vira numeric no Postgres.
  SELECT i.id, i.name::text,
         coalesce(s.enabled, false), coalesce(s.meta_own_account, false),
         broadcast_credit_balance(i.id)::numeric,
         coalesce(k.created, 0)::bigint, coalesce(k.active, 0)::bigint, coalesce(k.completed, 0)::bigint,
         coalesce(a.released_n, 0)::bigint,
         coalesce(a.priced, 0)::bigint, coalesce(a.billed, 0)::bigint, coalesce(a.sent, 0)::bigint,
         coalesce(a.delivered, 0)::bigint, coalesce(a.read, 0)::bigint, coalesce(a.replies, 0)::bigint,
         coalesce(py.charged, 0)::numeric, coalesce(py.refunded, 0)::numeric, coalesce(a.credit_used, 0)::numeric,
         CASE WHEN v_admin THEN coalesce(a.margin, 0)::numeric END,
         CASE WHEN v_admin THEN coalesce(a.meta_cost, 0)::numeric END
  FROM insts i
  LEFT JOIN broadcast_settings s ON s.institution_id = i.id
  LEFT JOIN agg    a  ON a.institution_id  = i.id
  LEFT JOIN pays   py ON py.institution_id = i.id
  LEFT JOIN counts k  ON k.institution_id  = i.id
  ORDER BY coalesce(py.charged, 0) DESC, i.name;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_institution_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_institution_summary(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
