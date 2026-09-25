-- =============================================================================
-- 20260926010000_broadcast_settings_prices_suppressions.sql
-- Transmissões — Fase M2: configuração por escola, tabela de preço com
-- histórico de versões e lista de supressão.
--
-- Decisões já aprovadas que valem aqui:
--   - limites de envio (hora/dia) e "conta própria na Meta" só o Super Admin
--     altera — por isso ficam em broadcast_settings, não em institutions
--     (que a escola edita nas próprias configurações).
--   - margem da Áion = valor fixo por mensagem e categoria (aion_unit_fee_brl).
--   - supressão: 131050 bloqueia só marketing; 131026 e "parar/sair" são
--     alimentados pelo backend (M3); a escola pode suprimir/liberar à mão.
-- =============================================================================

-- ── 0. Chave canônica de telefone ──────────────────────────────────────────
-- whatsapp_contacts tem o mesmo número brasileiro gravado com e sem o 9º
-- dígito (6976 linhas com 12 dígitos, 4370 com 13; 390 pessoas aparecem nas
-- duas formas na mesma escola). Supressão e deduplicação de destinatário
-- comparam por esta chave, nunca pelo texto: 55 + DDD + 9 + 8 dígitos vira
-- 55 + DDD + 8 dígitos. Número estrangeiro: só os dígitos.
CREATE OR REPLACE FUNCTION public.broadcast_phone_key(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN d ~ '^55[0-9]{2}9[0-9]{8}$' THEN left(d, 4) || right(d, 8)
    ELSE d
  END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') AS d) s
$$;

-- ── 1. broadcast_settings — uma linha por escola ───────────────────────────
-- Sem linha = módulo desligado (o endpoint trata ausência como enabled=false).
CREATE TABLE IF NOT EXISTS broadcast_settings (
  institution_id     UUID        PRIMARY KEY REFERENCES institutions(id) ON DELETE CASCADE,
  enabled            BOOLEAN     NOT NULL DEFAULT false,
  -- Conta própria na Meta: a Meta cobra a escola direto → Áion cobra só a taxa.
  meta_own_account   BOOLEAN     NOT NULL DEFAULT false,
  hourly_limit       INTEGER     NOT NULL DEFAULT 250  CHECK (hourly_limit > 0),
  daily_limit        INTEGER     NOT NULL DEFAULT 1000 CHECK (daily_limit > 0),
  reply_window_hours INTEGER     NOT NULL DEFAULT 72   CHECK (reply_window_hours BETWEEN 1 AND 720),
  updated_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (daily_limit >= hourly_limit)
);

DROP TRIGGER IF EXISTS update_broadcast_settings_updated_at ON broadcast_settings;
CREATE TRIGGER update_broadcast_settings_updated_at
  BEFORE UPDATE ON broadcast_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE broadcast_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_settings_school_select" ON broadcast_settings;
CREATE POLICY "broadcast_settings_school_select" ON broadcast_settings
  FOR SELECT TO authenticated
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "broadcast_settings_super_admin_all" ON broadcast_settings;
CREATE POLICY "broadcast_settings_super_admin_all" ON broadcast_settings
  FOR ALL TO authenticated
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

-- ── 2. Tabela de preço com histórico de versões ────────────────────────────
-- Versão em vigor = maior effective_from <= now(). Versão que já entrou em
-- vigor (ou passada) é CONGELADA, junto com seus itens — pra mudar preço, cria
-- versão nova. Só versão futura (effective_from > now()) pode ser editada ou
-- apagada. Congelar pela data (e não "quando alguma campanha usar") dá a
-- garantia já na M2, sem depender da tabela de campanhas, e é mais forte: o
-- preço de qualquer momento passado fica reconstruível.
CREATE TABLE IF NOT EXISTS broadcast_price_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sequencial sem buraco (IDENTITY pularia número a cada tentativa
  -- recusada) — atribuído por broadcast_create_price_version, único caminho
  -- de criação (sem ele o NOT NULL recusa).
  version_number INTEGER     NOT NULL UNIQUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes          TEXT,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_broadcast_price_versions_effective
  ON broadcast_price_versions(effective_from);

CREATE TABLE IF NOT EXISTS broadcast_price_items (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id         UUID          NOT NULL REFERENCES broadcast_price_versions(id) ON DELETE RESTRICT,
  category           TEXT          NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION')),
  country_code       TEXT          NOT NULL DEFAULT 'BR' CHECK (country_code ~ '^([A-Z]{2}|\*)$'),  -- '*' = demais países
  meta_unit_cost_brl NUMERIC(10,4) NOT NULL CHECK (meta_unit_cost_brl >= 0),
  aion_unit_fee_brl  NUMERIC(10,4) NOT NULL CHECK (aion_unit_fee_brl >= 0),
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (version_id, category, country_code)
);

CREATE OR REPLACE FUNCTION public.broadcast_price_version_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_effective TIMESTAMPTZ;
BEGIN
  IF TG_TABLE_NAME = 'broadcast_price_versions' THEN
    -- Vigência retroativa reescreveria o histórico — nunca.
    IF TG_OP = 'INSERT' THEN
      IF NEW.effective_from < now() - interval '1 minute' THEN
        RAISE EXCEPTION 'Vigência não pode ser retroativa';
      END IF;
      RETURN NEW;
    END IF;
    -- broadcast_create_price_version: cria com vigência 'infinity', insere os
    -- itens e só então fixa a vigência real — única passagem liberada.
    IF TG_OP = 'UPDATE' AND current_setting('broadcast.finalizing_version', true) = OLD.id::text THEN
      RETURN NEW;
    END IF;
    IF TG_OP IN ('UPDATE','DELETE') AND OLD.effective_from <= now() THEN
      RAISE EXCEPTION 'Versão de preço já em vigor não pode ser alterada — crie uma nova versão';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.effective_from <= now() AND NEW.effective_from IS DISTINCT FROM OLD.effective_from THEN
      RAISE EXCEPTION 'Nova data de vigência precisa ser futura';
    END IF;
  ELSE
    SELECT effective_from INTO v_effective FROM broadcast_price_versions
      WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.version_id ELSE NEW.version_id END;
    IF v_effective <= now() THEN
      RAISE EXCEPTION 'Itens de versão de preço já em vigor não podem ser alterados — crie uma nova versão';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.version_id IS DISTINCT FROM OLD.version_id THEN
      RAISE EXCEPTION 'Não é permitido mover item entre versões';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_price_versions_guard ON broadcast_price_versions;
CREATE TRIGGER trg_broadcast_price_versions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON broadcast_price_versions
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_price_version_guard();

DROP TRIGGER IF EXISTS trg_broadcast_price_items_guard ON broadcast_price_items;
CREATE TRIGGER trg_broadcast_price_items_guard
  BEFORE INSERT OR UPDATE OR DELETE ON broadcast_price_items
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_price_version_guard();

-- Criar versão já em vigor (effective_from = now()) seguido dos itens no
-- mesmo instante bateria no guard dos itens. Por isso a tela cria versão +
-- itens pela função abaixo, numa transação só: a versão nasce com os itens e
-- já congelada.
CREATE OR REPLACE FUNCTION public.broadcast_create_price_version(
  p_effective_from TIMESTAMPTZ,
  p_notes          TEXT,
  p_items          JSONB   -- [{category, country_code?, meta_unit_cost_brl, aion_unit_fee_brl}]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT is_super_admin_user() THEN
    RAISE EXCEPTION 'Apenas Super Admin pode criar versão de preço';
  END IF;
  IF p_effective_from < now() - interval '1 minute' THEN
    RAISE EXCEPTION 'Vigência não pode ser retroativa';
  END IF;
  IF (SELECT count(DISTINCT i->>'category') FROM jsonb_array_elements(p_items) i
        WHERE coalesce(i->>'country_code', 'BR') = 'BR') < 3 THEN
    RAISE EXCEPTION 'A versão precisa ter preço BR das 3 categorias (MARKETING, UTILITY, AUTHENTICATION)';
  END IF;

  -- Nasce com vigência 'infinity' (futura) pra o guard aceitar os itens; a
  -- vigência real é fixada no fim, pela única passagem que o guard libera.
  -- Trava contra duas criações simultâneas pegarem o mesmo número.
  LOCK TABLE broadcast_price_versions IN SHARE ROW EXCLUSIVE MODE;
  INSERT INTO broadcast_price_versions(version_number, effective_from, notes, created_by)
    VALUES ((SELECT coalesce(max(version_number), 0) + 1 FROM broadcast_price_versions),
            'infinity', p_notes, auth.uid())
    RETURNING id INTO v_id;

  INSERT INTO broadcast_price_items(version_id, category, country_code, meta_unit_cost_brl, aion_unit_fee_brl)
  SELECT v_id,
         upper(i->>'category'),
         upper(coalesce(i->>'country_code', 'BR')),
         (i->>'meta_unit_cost_brl')::numeric,
         (i->>'aion_unit_fee_brl')::numeric
  FROM jsonb_array_elements(p_items) i;

  PERFORM set_config('broadcast.finalizing_version', v_id::text, true);
  UPDATE broadcast_price_versions
    SET effective_from = greatest(p_effective_from, now())
    WHERE id = v_id;
  PERFORM set_config('broadcast.finalizing_version', '', true);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_create_price_version(TIMESTAMPTZ, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.broadcast_create_price_version(TIMESTAMPTZ, TEXT, JSONB) TO authenticated;

-- Preço vigente num instante: item da versão em vigor pro país; se não houver
-- linha do país, cai pra '*'. NULL = tabela incompleta (o endpoint recusa
-- precificar em vez de adivinhar). Usado pelo backend (M3) — service role.
CREATE OR REPLACE FUNCTION public.broadcast_price_at(
  p_category     TEXT,
  p_country_code TEXT DEFAULT 'BR',
  p_at           TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (version_id UUID, version_number INTEGER, meta_unit_cost_brl NUMERIC, aion_unit_fee_brl NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH v AS (
    SELECT id, version_number FROM broadcast_price_versions
    WHERE effective_from <= p_at
    ORDER BY effective_from DESC
    LIMIT 1
  )
  SELECT v.id, v.version_number, i.meta_unit_cost_brl, i.aion_unit_fee_brl
  FROM v
  JOIN broadcast_price_items i ON i.version_id = v.id
  WHERE i.category = upper(p_category)
    AND i.country_code IN (upper(p_country_code), '*')
  ORDER BY (i.country_code = '*')
  LIMIT 1
$$;

ALTER TABLE broadcast_price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_price_items    ENABLE ROW LEVEL SECURITY;

-- Só Super Admin (escola não lê a tabela — recebe o valor já calculado).
DROP POLICY IF EXISTS "broadcast_price_versions_super_admin" ON broadcast_price_versions;
CREATE POLICY "broadcast_price_versions_super_admin" ON broadcast_price_versions
  FOR ALL TO authenticated
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

DROP POLICY IF EXISTS "broadcast_price_items_super_admin" ON broadcast_price_items;
CREATE POLICY "broadcast_price_items_super_admin" ON broadcast_price_items
  FOR ALL TO authenticated
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());

-- ── 3. Lista de supressão por escola ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcast_suppressions (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id     UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  phone              TEXT        NOT NULL CHECK (phone ~ '^[0-9]{8,15}$'),
  phone_key          TEXT        GENERATED ALWAYS AS (broadcast_phone_key(phone)) STORED,
  scope              TEXT        NOT NULL CHECK (scope IN ('marketing','all')),
  reason             TEXT        NOT NULL CHECK (reason IN ('opt_out_keyword','meta_permanent_error','manual')),
  meta_error_code    INTEGER,
  source_campaign_id UUID,       -- FK pra broadcast_campaigns entra na M3
  note               TEXT,
  created_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  lifted_at          TIMESTAMPTZ,
  lifted_by          UUID        REFERENCES users(id) ON DELETE SET NULL,  -- null quando o backend libera
  CHECK (lifted_by IS NULL OR lifted_at IS NOT NULL)
);

-- Uma supressão ativa por (escola, pessoa, escopo); liberar mantém a linha.
CREATE UNIQUE INDEX IF NOT EXISTS uq_broadcast_suppressions_active
  ON broadcast_suppressions(institution_id, phone_key, scope) WHERE lifted_at IS NULL;

-- Montagem de audiência (M3): exclui por (escola, chave) as ativas.
CREATE INDEX IF NOT EXISTS idx_broadcast_suppressions_lookup
  ON broadcast_suppressions(institution_id, phone_key) WHERE lifted_at IS NULL;

-- Só liberar muda depois de criada; e a escola só libera supressão manual —
-- opt-out e erro permanente da Meta nunca são desfeitos pela escola.
CREATE OR REPLACE FUNCTION public.broadcast_suppressions_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.institution_id, NEW.phone, NEW.scope, NEW.reason, NEW.meta_error_code, NEW.source_campaign_id, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.institution_id, OLD.phone, OLD.scope, OLD.reason, OLD.meta_error_code, OLD.source_campaign_id, OLD.created_by, OLD.created_at)
  THEN
    RAISE EXCEPTION 'Supressão não pode ser editada — só liberada';
  END IF;
  IF OLD.lifted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Supressão já liberada';
  END IF;
  IF NEW.lifted_at IS NOT NULL THEN
    NEW.lifted_by := coalesce(auth.uid(), NEW.lifted_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_suppressions_guard ON broadcast_suppressions;
CREATE TRIGGER trg_broadcast_suppressions_guard
  BEFORE UPDATE ON broadcast_suppressions
  FOR EACH ROW EXECUTE FUNCTION public.broadcast_suppressions_guard();

ALTER TABLE broadcast_suppressions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "broadcast_suppressions_school_select" ON broadcast_suppressions;
CREATE POLICY "broadcast_suppressions_school_select" ON broadcast_suppressions
  FOR SELECT TO authenticated
  USING (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    OR is_super_admin_user()
  );

-- Escola cria só supressão manual, em nome próprio.
DROP POLICY IF EXISTS "broadcast_suppressions_school_insert" ON broadcast_suppressions;
CREATE POLICY "broadcast_suppressions_school_insert" ON broadcast_suppressions
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND reason = 'manual'
    AND lifted_at IS NULL
    AND created_by = auth.uid()
  );

-- Escola libera só supressão manual da própria escola.
DROP POLICY IF EXISTS "broadcast_suppressions_school_lift" ON broadcast_suppressions;
CREATE POLICY "broadcast_suppressions_school_lift" ON broadcast_suppressions
  FOR UPDATE TO authenticated
  USING (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND reason = 'manual'
  )
  WITH CHECK (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND reason = 'manual'
  );

DROP POLICY IF EXISTS "broadcast_suppressions_super_admin_all" ON broadcast_suppressions;
CREATE POLICY "broadcast_suppressions_super_admin_all" ON broadcast_suppressions
  FOR ALL TO authenticated
  USING (is_super_admin_user()) WITH CHECK (is_super_admin_user());
