-- 20261008130000_ai_cota_mensal.sql
--
-- Cota mensal de uso da IA (/api/ai) por escola.
--
--   ai_usage_monthly   chamadas por escola por mês (YYYY-MM, fuso de Fortaleza)
--   ai_school_quota    limite próprio da escola (opcional); sem linha vale o
--                      padrão passado pelo /api/ai (platform_settings
--                      'ai_monthly_quota' ou o valor fixo do código)
--   ai_consume_quota() reserva 1 chamada de forma atômica: devolve
--                      allowed=false quando a escola já está no limite.
--
-- Só o servidor (service role) usa: nenhuma escola lê ou altera a própria cota
-- pela API. Nenhum dado existente é alterado.

CREATE TABLE IF NOT EXISTS public.ai_usage_monthly (
  institution_id UUID        NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  month_year     TEXT        NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$'),
  calls          INTEGER     NOT NULL DEFAULT 0 CHECK (calls >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, month_year)
);

CREATE TABLE IF NOT EXISTS public.ai_school_quota (
  institution_id UUID        PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  monthly_limit  INTEGER     NOT NULL CHECK (monthly_limit >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_school_quota  ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_monthly, public.ai_school_quota FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ai_consume_quota(p_institution_id uuid, p_default_limit integer)
RETURNS TABLE (allowed boolean, calls integer, monthly_limit integer, month_year text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_month text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY-MM');
  v_limit integer;
  v_calls integer;
BEGIN
  SELECT q.monthly_limit INTO v_limit FROM ai_school_quota q WHERE q.institution_id = p_institution_id;
  v_limit := COALESCE(v_limit, p_default_limit);

  INSERT INTO ai_usage_monthly AS u (institution_id, month_year, calls)
  SELECT p_institution_id, v_month, 1 WHERE v_limit > 0
  ON CONFLICT (institution_id, month_year) DO UPDATE
    SET calls = u.calls + 1, updated_at = now()
    WHERE u.calls < v_limit
  RETURNING u.calls INTO v_calls;

  IF v_calls IS NULL THEN
    SELECT u.calls INTO v_calls FROM ai_usage_monthly u
    WHERE u.institution_id = p_institution_id AND u.month_year = v_month;
    RETURN QUERY SELECT false, COALESCE(v_calls, 0), v_limit, v_month;
  ELSE
    RETURN QUERY SELECT true, v_calls, v_limit, v_month;
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.ai_consume_quota(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_consume_quota(uuid, integer) TO service_role;
