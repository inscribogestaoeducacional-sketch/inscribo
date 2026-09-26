-- =============================================================================
-- 20260926040000_broadcast_campaigns_api.sql
-- Transmissões — etapa 4 (endpoint broadcast-campaigns + envio de template de
-- escola). Só funções/constraint; nenhuma tabela nova.
-- =============================================================================

-- ── 1. Permissão com usuário explícito ─────────────────────────────────────
-- A API da Vercel (template-definitions.ts) autentica pelo token e sabe o
-- user_id, mas não roda com o JWT do usuário (auth.uid() seria nulo). Pra não
-- duplicar a regra em TypeScript, a regra passa a morar aqui, com o usuário
-- como parâmetro; broadcast_user_can_manage() (M3) vira atalho pra ela.
CREATE OR REPLACE FUNCTION public.broadcast_user_can_manage_as(p_user_id UUID, p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_user_id
      AND coalesce(u.active, true)
      AND p_institution_id IN (u.institution_id, u.active_institution_id)
      AND (
        u.role IN ('admin','manager')
        OR EXISTS (
          SELECT 1 FROM user_permissions p
          WHERE p.user_id = u.id AND p.institution_id = p_institution_id
            AND p.module = 'transmissoes' AND p.enabled
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.broadcast_user_can_manage_as(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_user_can_manage_as(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.broadcast_user_can_manage(p_institution_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT broadcast_user_can_manage_as(auth.uid(), p_institution_id)
$$;

-- ── 2. Cancelamento no meio do envio ───────────────────────────────────────
-- Destinatário ainda não enviado de campanha cancelada vira 'skipped' com
-- failure_kind 'cancelled' — e entra no crédito como qualquer falha
-- (broadcast_credit_failures conta failed/skipped).
ALTER TABLE broadcast_recipients DROP CONSTRAINT IF EXISTS broadcast_recipients_failure_kind_check;
ALTER TABLE broadcast_recipients ADD CONSTRAINT broadcast_recipients_failure_kind_check
  CHECK (failure_kind IN ('permanent','temporary_exhausted','unknown','suppressed','cancelled'));

-- ── 3. Resolução da audiência ──────────────────────────────────────────────
-- Uma função pra prévia e pra criação (mesmo resultado nas duas). Devolve
-- TODOS os candidatos, com excluded_reason preenchido pros que ficam de fora
-- — a tela mostra quantos saíram e por quê.
--
-- p_filter (E entre critérios, OU dentro de cada lista):
--   { "all": true }                              → todos os contatos da escola
--   { "tags": [...] }                            → tem alguma das etiquetas
--   { "contact_types": ["client","lead",...] }
--   { "grades": [...] }                          → whatsapp_contacts.student_grade
--   { "capture_trigger_ids": [...] }             → primeiro toque da Captação
--   { "previous_campaign": { "id": uuid, "only": "sent"|"replied"|"clicked" } }
--   Sem nenhum critério (e sem "all") = nenhum contato da base — evita disparo
--   pra base inteira por esquecimento.
-- p_import: [{ "phone": "...", "name": "...", "variables": {...} }]
--
-- v1: só números brasileiros (55 + DDD + 8/9 dígitos) — preço é por país e a
-- campanha tem um preço unitário só. Deduplicação por broadcast_phone_key
-- (mesmo celular com e sem o 9º dígito = uma pessoa); prefere o registro da
-- base (tem contato) ao importado. Exclusões: supressão ativa (escopo 'all',
-- ou 'marketing' se a campanha é MARKETING) e whatsapp_blacklist.
CREATE OR REPLACE FUNCTION public.broadcast_resolve_audience(
  p_institution_id UUID,
  p_filter         JSONB,
  p_import         JSONB,
  p_category       TEXT
)
RETURNS TABLE (contact_id UUID, phone TEXT, name TEXT, variables JSONB, source TEXT, excluded_reason TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH f AS (
    SELECT
      coalesce((p_filter->>'all')::boolean, false)                                                        AS all_contacts,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'tags', '[]')))                           AS tags,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'contact_types', '[]')))                  AS types,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'grades', '[]')))                         AS grades,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filter->'capture_trigger_ids', '[]'))::uuid)      AS triggers,
      nullif(p_filter #>> '{previous_campaign,id}', '')::uuid                                             AS prev_id,
      coalesce(p_filter #>> '{previous_campaign,only}', 'sent')                                           AS prev_only
  ),
  crit AS (
    SELECT f.*, (f.all_contacts OR cardinality(f.tags) > 0 OR cardinality(f.types) > 0
                 OR cardinality(f.grades) > 0 OR cardinality(f.triggers) > 0 OR f.prev_id IS NOT NULL) AS any_criteria
    FROM f
  ),
  prev AS (
    SELECT DISTINCT r.phone_key
    FROM broadcast_recipients r, crit
    WHERE crit.prev_id IS NOT NULL
      AND r.campaign_id = crit.prev_id AND r.institution_id = p_institution_id
      AND CASE crit.prev_only
            WHEN 'replied' THEN r.first_reply_at IS NOT NULL
            WHEN 'clicked' THEN r.clicked_button_index IS NOT NULL
            ELSE r.sent_at IS NOT NULL
          END
  ),
  contacts AS (
    SELECT c.id, c.name, c.phone, c.tags, c.type, c.student_grade, c.origin_capture_trigger_id,
           broadcast_phone_key(c.phone) AS k
    FROM whatsapp_contacts c
    WHERE c.institution_id = p_institution_id
  ),
  from_filter AS (
    SELECT c.id AS contact_id, regexp_replace(c.phone, '\D', '', 'g') AS phone, c.name,
           '{}'::jsonb AS variables, 'filter'::text AS source, c.k
    FROM contacts c, crit
    WHERE crit.any_criteria
      AND (cardinality(crit.tags)     = 0 OR c.tags && crit.tags)
      AND (cardinality(crit.types)    = 0 OR c.type = ANY(crit.types))
      AND (cardinality(crit.grades)   = 0 OR c.student_grade = ANY(crit.grades))
      AND (cardinality(crit.triggers) = 0 OR c.origin_capture_trigger_id = ANY(crit.triggers))
      AND (crit.prev_id IS NULL OR c.k IN (SELECT phone_key FROM prev))
  ),
  from_import AS (
    SELECT NULL::uuid AS contact_id,
           -- Com '+' na frente = já internacional (não prefixa 55: "+1 415…"
           -- tem 11 dígitos e viraria "celular brasileiro" de mentira).
           CASE WHEN btrim(coalesce(i->>'phone', '')) !~ '^\+' AND length(x.d) IN (10, 11) THEN '55' || x.d ELSE x.d END AS phone,
           nullif(btrim(i->>'name'), '') AS name,
           CASE WHEN jsonb_typeof(i->'variables') = 'object' THEN i->'variables' ELSE '{}'::jsonb END AS variables,
           'import'::text AS source
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_import) = 'array' THEN p_import ELSE '[]'::jsonb END) i,
    LATERAL (SELECT regexp_replace(coalesce(i->>'phone', ''), '\D', '', 'g') AS d) x
  ),
  candidates AS (
    SELECT contact_id, phone, name, variables, source, k FROM from_filter
    UNION ALL
    SELECT fi.contact_id, fi.phone, fi.name, fi.variables, fi.source, broadcast_phone_key(fi.phone) FROM from_import fi
  ),
  dedup AS (
    SELECT DISTINCT ON (c.k) c.*
    FROM candidates c
    ORDER BY c.k, (c.source = 'filter') DESC, (c.name IS NOT NULL AND c.name !~ '^[0-9+ ()-]+$') DESC
  )
  SELECT
    coalesce(d.contact_id, ct.id)                                        AS contact_id,
    d.phone,
    coalesce(d.name, ct.name)                                            AS name,
    d.variables,
    d.source,
    CASE
      WHEN d.phone !~ '^[0-9]{8,15}$'        THEN 'invalid_phone'
      WHEN d.phone !~ '^55'                  THEN 'non_br'
      -- 55 + DDD (11–99) + 9 + 8 dígitos (celular atual) ou 8 dígitos (formato
      -- antigo, sem o 9 — é como 6.9 mil contatos estão gravados, e como a
      -- Meta costuma mandar; o envio normaliza pra 13 dígitos). "+1 415…"
      -- prefixado errado vira 55 14 1555… → 9 dígitos sem o 9 → inválido.
      WHEN d.phone !~ '^55[1-9][0-9](9[0-9]{8}|[2-9][0-9]{7})$' THEN 'invalid_phone'
      WHEN EXISTS (SELECT 1 FROM broadcast_suppressions s
                   WHERE s.institution_id = p_institution_id AND s.phone_key = d.k AND s.lifted_at IS NULL
                     AND (s.scope = 'all' OR upper(coalesce(p_category, '')) = 'MARKETING'))
                                              THEN 'suppressed'
      WHEN EXISTS (SELECT 1 FROM whatsapp_blacklist b
                   WHERE b.institution_id = p_institution_id AND broadcast_phone_key(b.phone_number) = d.k)
                                              THEN 'blacklisted'
    END                                                                   AS excluded_reason
  FROM dedup d
  LEFT JOIN LATERAL (
    SELECT c2.id, c2.name FROM contacts c2 WHERE c2.k = d.k
    ORDER BY (c2.name IS NOT NULL AND c2.name !~ '^[0-9+ ()-]+$') DESC LIMIT 1
  ) ct ON d.contact_id IS NULL
$$;

REVOKE ALL ON FUNCTION public.broadcast_resolve_audience(UUID, JSONB, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_resolve_audience(UUID, JSONB, JSONB, TEXT) TO service_role;

-- ── 4. Precificação (atômica) ──────────────────────────────────────────────
-- Tudo numa transação: preço vigente, saldo de crédito (com a mesma trava
-- por escola do extrato), débito do crédito, preço congelado na campanha e
-- liberação. Regra do mínimo do Asaas (decisão 1):
--   - crédito cobre tudo              → não cobra (paid_at já preenchido);
--   - sobra ≥ mínimo                  → usa o crédito todo, cobra a sobra;
--   - sobra < mínimo, subtotal ≥ mín. → usa só o crédito que deixa a cobrança
--                                       exatamente no mínimo (o resto do
--                                       crédito fica pra próxima);
--   - subtotal < mínimo, sem crédito que cubra tudo → cobra o mínimo.
-- Mínimo = platform_settings.asaas_min_charge_brl; sem ele, precificar com
-- valor a cobrar é recusado (não adivinha).
-- Só com template APROVADO na escola: a categoria que a Meta aprovou define
-- o preço (fluxo aprovado: template primeiro, depois audiência).
CREATE OR REPLACE FUNCTION public.broadcast_price_campaign(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c          broadcast_campaigns%ROWTYPE;
  v_tpl      TEXT;
  v_cat      TEXT;
  v_own      BOOLEAN;
  v_price    RECORD;
  v_n        INTEGER;
  v_unit     NUMERIC(12,4);
  v_sub      NUMERIC(12,2);
  v_bal      NUMERIC(12,2);
  v_min_raw  TEXT;
  v_min      NUMERIC(12,2);
  v_credit   NUMERIC(12,2);
  v_total    NUMERIC(12,2);
  v_status   TEXT;
BEGIN
  SELECT * INTO c FROM broadcast_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
  IF c.status <> 'draft' OR c.priced_at IS NOT NULL THEN
    RAISE EXCEPTION 'Campanha já foi precificada';
  END IF;

  SELECT s.status, s.approved_category INTO v_tpl, v_cat
  FROM template_institution_status s
  WHERE s.template_definition_id = c.template_definition_id AND s.institution_id = c.institution_id;
  IF v_tpl IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Template ainda não aprovado pela Meta para esta escola';
  END IF;
  v_cat := upper(coalesce(v_cat, (SELECT category FROM template_definitions WHERE id = c.template_definition_id)));

  SELECT meta_own_account INTO v_own FROM broadcast_settings
  WHERE institution_id = c.institution_id AND enabled;
  IF NOT FOUND THEN RAISE EXCEPTION 'Módulo Transmissões não liberado para esta escola'; END IF;

  SELECT count(*) INTO v_n FROM broadcast_recipients WHERE campaign_id = c.id AND status = 'pending';
  IF v_n = 0 THEN RAISE EXCEPTION 'Campanha sem destinatários'; END IF;

  SELECT * INTO v_price FROM broadcast_price_at(v_cat, 'BR');
  IF v_price.version_id IS NULL THEN
    RAISE EXCEPTION 'Tabela de preço sem valor vigente para %', v_cat;
  END IF;

  v_unit := v_price.aion_unit_fee_brl + CASE WHEN v_own THEN 0 ELSE v_price.meta_unit_cost_brl END;
  v_sub  := round(v_unit * v_n, 2);

  PERFORM pg_advisory_xact_lock(hashtext('broadcast_credit:' || c.institution_id::text));
  v_bal := broadcast_credit_balance(c.institution_id);

  IF v_sub <= 0 THEN
    v_credit := 0; v_total := 0;
  ELSIF v_bal >= v_sub THEN
    v_credit := v_sub; v_total := 0;
  ELSE
    SELECT value INTO v_min_raw FROM platform_settings WHERE key = 'asaas_min_charge_brl';
    v_min_raw := replace(btrim(coalesce(v_min_raw, '')), ',', '.');
    IF v_min_raw !~ '^[0-9]+(\.[0-9]{1,2})?$' OR v_min_raw::numeric <= 0 THEN
      RAISE EXCEPTION 'Cobrança de campanha indisponível: valor mínimo do Asaas ainda não configurado pela Áion';
    END IF;
    v_min := v_min_raw::numeric;
    IF v_sub - v_bal >= v_min THEN
      v_credit := v_bal;         v_total := v_sub - v_bal;
    ELSIF v_sub >= v_min THEN
      v_credit := v_sub - v_min; v_total := v_min;
    ELSE
      v_credit := 0;             v_total := v_min;
    END IF;
  END IF;

  IF v_credit > 0 THEN
    INSERT INTO broadcast_credit_ledger(institution_id, amount_brl, kind, campaign_id, recipient_count, note)
    VALUES (c.institution_id, -v_credit, 'applied_to_campaign', c.id, v_n,
            'Crédito usado na campanha "' || c.name || '"');
  END IF;

  UPDATE broadcast_campaigns
  SET price_version_id   = v_price.version_id,
      priced_category    = v_cat,
      priced_own_account = v_own,
      unit_meta_cost_brl = v_price.meta_unit_cost_brl,
      unit_fee_brl       = v_price.aion_unit_fee_brl,
      priced_recipients  = v_n,
      subtotal_brl       = v_sub,
      credit_applied_brl = v_credit,
      total_charged_brl  = v_total,
      priced_at          = now(),
      paid_at            = CASE WHEN v_total = 0 THEN now() END,
      status             = 'pending_template'
  WHERE id = c.id;

  v_status := broadcast_try_release(c.id);

  RETURN jsonb_build_object(
    'status', v_status, 'category', v_cat, 'own_account', v_own,
    'price_version', v_price.version_number, 'recipients', v_n,
    'unit_brl', v_unit, 'subtotal_brl', v_sub, 'credit_applied_brl', v_credit,
    'total_brl', v_total, 'needs_charge', v_total > 0
  );
END;
$$;

-- ── 5. Cancelamento (atômico) ──────────────────────────────────────────────
-- Pendentes viram skipped/cancelled. Já paga → esses (e as falhas) viram
-- crédito pelo preço unitário cobrado (falha vira crédito, não estorno).
-- Não paga → devolve o crédito que tinha sido usado na precificação. Devolve
-- a cobrança do Asaas a cancelar (a Edge Function chama o Asaas).
CREATE OR REPLACE FUNCTION public.broadcast_cancel_campaign(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  c          broadcast_campaigns%ROWTYPE;
  v_skipped  INTEGER;
  v_credited NUMERIC := 0;
  v_returned NUMERIC := 0;
  v_pay_id   UUID;
  v_pay_st   TEXT;
  v_asaas_id TEXT;
BEGIN
  SELECT * INTO c FROM broadcast_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
  IF c.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Campanha já %', CASE c.status WHEN 'completed' THEN 'concluída' ELSE 'cancelada' END;
  END IF;

  UPDATE broadcast_recipients SET status = 'skipped', failure_kind = 'cancelled'
  WHERE campaign_id = c.id AND status = 'pending';
  GET DIAGNOSTICS v_skipped = ROW_COUNT;

  UPDATE broadcast_campaigns SET status = 'cancelled', cancelled_at = now() WHERE id = c.id;

  IF c.paid_at IS NOT NULL THEN
    v_credited := broadcast_credit_failures(c.id);
  ELSIF coalesce(c.credit_applied_brl, 0) > 0 THEN
    INSERT INTO broadcast_credit_ledger(institution_id, amount_brl, kind, campaign_id, note)
    VALUES (c.institution_id, c.credit_applied_brl, 'manual_adjust', c.id,
            'Crédito devolvido: campanha "' || c.name || '" cancelada antes do pagamento');
    v_returned := c.credit_applied_brl;
  END IF;

  PERFORM broadcast_recount(c.id);

  IF c.payment_id IS NOT NULL THEN
    SELECT id, status, asaas_payment_id INTO v_pay_id, v_pay_st, v_asaas_id FROM payments WHERE id = c.payment_id;
  END IF;

  RETURN jsonb_build_object(
    'skipped', v_skipped, 'credited_brl', v_credited, 'credit_returned_brl', v_returned,
    'payment_id', v_pay_id,
    'asaas_payment_to_cancel', CASE WHEN v_pay_st IN ('pending','overdue') THEN v_asaas_id END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_price_campaign(UUID)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.broadcast_cancel_campaign(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.broadcast_price_campaign(UUID)  TO service_role;
GRANT EXECUTE ON FUNCTION public.broadcast_cancel_campaign(UUID) TO service_role;
