-- ============================================================================
-- 20261013100000_fase0c_ciclo_ano_perda.sql
-- Fase 0C, itens 1–3 (proposta aprovada pelo Victor em 12/10/2026; aplicar só
-- depois do ensaio e do ok, na ordem: backup → migration → backfill → front).
--
--   0. Ciclo com ANO DA CAMPANHA (campaign_year, ano em que a captação começa)
--      e ANO LETIVO ALVO (target_school_year, o ano que a escola está enchendo).
--      Exibição: "Campanha <ano letivo alvo>". Hoje `year` mistura os dois
--      (Ágape: "Campanha 2026", de 08/09/2026 a 31/03/2027, enche 2027).
--   1. Todo lead novo é vinculado ao ciclo ATIVO da escola por qualquer
--      caminho de criação (formulário, robô, Captação Inteligente, Vitrine,
--      importação). Ciclo ativo = mesma regra de recompute_funnel_metrics
--      (status active/released, com datas, o mais recente). Lead criado ANTES
--      do início do ciclo entra como pipeline herdado (cycle_link_kind
--      'herdado') e não conta como lead da campanha.
--   2. year_interest ganha o padrão do ano letivo alvo do ciclo quando vazio.
--   3. Perdido exige motivo: CHECK no banco (NOT VALID aqui; o backfill
--      preenche os antigos e valida).
-- O backfill dos dados existentes está em supabase/pendentes/fase0c_backfill.sql.
-- ============================================================================

-- ── 0. Ciclo: ano da campanha e ano letivo alvo ─────────────────────────────
ALTER TABLE public.campaign_cycles
  ADD COLUMN IF NOT EXISTS campaign_year      INTEGER,
  ADD COLUMN IF NOT EXISTS target_school_year INTEGER;

-- Ano letivo alvo pela data de término: campanha que termina no 1º semestre
-- enche o ano letivo daquele ano; a que termina no 2º semestre enche o seguinte.
CREATE OR REPLACE FUNCTION public.campaign_cycle_target_year(p_end date, p_year integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_end IS NULL THEN p_year
    WHEN extract(month FROM p_end) >= 7 THEN extract(year FROM p_end)::int + 1
    ELSE extract(year FROM p_end)::int
  END
$$;

CREATE OR REPLACE FUNCTION public.campaign_cycles_years()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.campaign_year      := COALESCE(NEW.campaign_year, extract(year FROM NEW.start_date)::int, NEW.year);
    NEW.target_school_year := COALESCE(NEW.target_school_year, campaign_cycle_target_year(NEW.end_date, NEW.year));
  ELSE
    -- Datas mudaram e o ano não foi informado junto: recalcula pelo novo período.
    IF NEW.start_date IS DISTINCT FROM OLD.start_date AND NEW.campaign_year IS NOT DISTINCT FROM OLD.campaign_year THEN
      NEW.campaign_year := COALESCE(extract(year FROM NEW.start_date)::int, NEW.year);
    END IF;
    IF NEW.end_date IS DISTINCT FROM OLD.end_date AND NEW.target_school_year IS NOT DISTINCT FROM OLD.target_school_year THEN
      NEW.target_school_year := campaign_cycle_target_year(NEW.end_date, NEW.year);
    END IF;
  END IF;
  -- Rótulo padrão "Campanha AAAA" sempre mostra o ano letivo alvo
  -- (o sufixo, ex. " — Colégio Áion", é mantido).
  IF NEW.target_school_year IS NOT NULL AND COALESCE(NEW.label, '') ~ '^Campanha [0-9]{4}' THEN
    NEW.label := regexp_replace(NEW.label, '^Campanha [0-9]{4}', 'Campanha ' || NEW.target_school_year);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_campaign_cycles_years ON public.campaign_cycles;
CREATE TRIGGER trg_campaign_cycles_years
  BEFORE INSERT OR UPDATE ON public.campaign_cycles
  FOR EACH ROW EXECUTE FUNCTION public.campaign_cycles_years();

-- Ciclo ativo da escola (mesma regra de recompute_funnel_metrics).
CREATE OR REPLACE FUNCTION public.active_campaign_cycle_id(p_institution_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM campaign_cycles
   WHERE institution_id = p_institution_id
     AND status IN ('active', 'released')
     AND start_date IS NOT NULL AND end_date IS NOT NULL
   ORDER BY created_at DESC
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.active_campaign_cycle_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.active_campaign_cycle_id(uuid) TO authenticated;

-- ── 1 e 2. Lead: ciclo, tipo de vínculo e ano de interesse ──────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cycle_link_kind TEXT;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_cycle_link_kind_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_cycle_link_kind_check
  CHECK (cycle_link_kind IS NULL OR cycle_link_kind IN ('campanha', 'herdado'));
COMMENT ON COLUMN public.leads.cycle_link_kind IS
  'campanha = criado dentro do ciclo (conta como lead da campanha); herdado = criado antes do início do ciclo (pipeline herdado, não conta).';

CREATE OR REPLACE FUNCTION public.leads_campaign_cycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cycle record;
BEGIN
  -- 1. Lead novo sem ciclo: vincula ao ciclo ativo da escola, se o lead não
  --    for de depois do fim do ciclo.
  IF TG_OP = 'INSERT' AND NEW.campaign_cycle_id IS NULL THEN
    SELECT c.id, c.end_date INTO v_cycle FROM campaign_cycles c
     WHERE c.id = active_campaign_cycle_id(NEW.institution_id);
    IF v_cycle.id IS NOT NULL
       AND COALESCE(NEW.created_at, now()) < ((v_cycle.end_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo') THEN
      NEW.campaign_cycle_id := v_cycle.id;
    END IF;
  END IF;

  -- Tipo do vínculo: recalculado sempre que o ciclo muda.
  IF TG_OP = 'INSERT' OR NEW.campaign_cycle_id IS DISTINCT FROM OLD.campaign_cycle_id THEN
    IF NEW.campaign_cycle_id IS NULL THEN
      NEW.cycle_link_kind := NULL;
    ELSE
      SELECT CASE WHEN COALESCE(NEW.created_at, now()) < (c.start_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
                  THEN 'herdado' ELSE 'campanha' END
        INTO NEW.cycle_link_kind
        FROM campaign_cycles c WHERE c.id = NEW.campaign_cycle_id;
    END IF;
  END IF;

  -- 2. Ano de interesse vazio: ano letivo alvo do ciclo.
  IF NEW.year_interest IS NULL AND NEW.campaign_cycle_id IS NOT NULL THEN
    SELECT c.target_school_year INTO NEW.year_interest FROM campaign_cycles c WHERE c.id = NEW.campaign_cycle_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_leads_campaign_cycle ON public.leads;
CREATE TRIGGER trg_leads_campaign_cycle
  BEFORE INSERT OR UPDATE OF campaign_cycle_id, year_interest ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_campaign_cycle();

CREATE INDEX IF NOT EXISTS idx_leads_cycle_kind ON public.leads (campaign_cycle_id, cycle_link_kind) WHERE deleted_at IS NULL;

-- ── 3. Perdido exige motivo ─────────────────────────────────────────────────
-- NOT VALID: vale já para todo INSERT/UPDATE; os 8 antigos sem motivo são
-- preenchidos pelo backfill ('nao_informado'), que então valida a regra.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lost_requires_reason;
ALTER TABLE public.leads ADD CONSTRAINT leads_lost_requires_reason
  CHECK (status IS DISTINCT FROM 'lost' OR NULLIF(btrim(COALESCE(lost_reason, '')), '') IS NOT NULL) NOT VALID;
