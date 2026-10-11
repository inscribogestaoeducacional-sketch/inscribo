-- Snapshot SOMENTE LEITURA do que existe em producao em 2026-10-11 (exportado via pg_get_functiondef/pg_get_triggerdef).
-- Estas funcoes/gatilhos foram criados direto no banco, sem migration. NAO e migration: nao aplicar.
-- Fase 0A: referencia pra comparar antes/depois.

-- ===== funcao compare_years_funnel =====
CREATE OR REPLACE FUNCTION public.compare_years_funnel(p_institution_id uuid, p_year1 integer, p_year2 integer)
 RETURNS TABLE(month integer, month_name character varying, year1_registrations integer, year2_registrations integer, registrations_variation numeric, year1_enrollments integer, year2_enrollments integer, enrollments_variation numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(y1.month, y2.month) as month,
    COALESCE(y1.month_name, y2.month_name) as month_name,
    COALESCE(y1.registrations, 0) as year1_registrations,
    COALESCE(y2.registrations, 0) as year2_registrations,
    CASE 
      WHEN COALESCE(y1.registrations, 0) > 0 
      THEN ROUND(((COALESCE(y2.registrations, 0) - COALESCE(y1.registrations, 0))::NUMERIC / y1.registrations::NUMERIC * 100), 2)
      ELSE 0 
    END as registrations_variation,
    COALESCE(y1.enrollments, 0) as year1_enrollments,
    COALESCE(y2.enrollments, 0) as year2_enrollments,
    CASE 
      WHEN COALESCE(y1.enrollments, 0) > 0 
      THEN ROUND(((COALESCE(y2.enrollments, 0) - COALESCE(y1.enrollments, 0))::NUMERIC / y1.enrollments::NUMERIC * 100), 2)
      ELSE 0 
    END as enrollments_variation
  FROM 
    (SELECT * FROM funnel_metrics WHERE institution_id = p_institution_id AND year = p_year1) y1
  FULL OUTER JOIN
    (SELECT * FROM funnel_metrics WHERE institution_id = p_institution_id AND year = p_year2) y2
    ON y1.month = y2.month
  ORDER BY COALESCE(y1.month, y2.month);
END;
$function$;

-- ===== funcao get_annual_funnel_totals =====
CREATE OR REPLACE FUNCTION public.get_annual_funnel_totals(p_institution_id uuid, p_year integer)
 RETURNS TABLE(year integer, total_registrations bigint, total_schedules bigint, total_visits bigint, total_enrollments bigint, annual_registrations_target integer, annual_schedules_target integer, annual_visits_target integer, annual_enrollments_target integer, overall_conversion_rate numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p_year as year,
    SUM(fm.registrations) as total_registrations,
    SUM(fm.schedules) as total_schedules,
    SUM(fm.visits) as total_visits,
    SUM(fm.enrollments) as total_enrollments,
    MAX(fm.annual_registrations_target) as annual_registrations_target,
    MAX(fm.annual_schedules_target) as annual_schedules_target,
    MAX(fm.annual_visits_target) as annual_visits_target,
    MAX(fm.annual_enrollments_target) as annual_enrollments_target,
    CASE 
      WHEN SUM(fm.registrations) > 0 
      THEN ROUND((SUM(fm.enrollments)::NUMERIC / SUM(fm.registrations)::NUMERIC * 100), 2)
      ELSE 0 
    END as overall_conversion_rate
  FROM funnel_metrics fm
  WHERE fm.institution_id = p_institution_id
    AND fm.year = p_year
  GROUP BY p_year;
END;
$function$;

-- ===== funcao sync_funnel_metrics =====
CREATE OR REPLACE FUNCTION public.sync_funnel_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_institution_id uuid;
  v_cycle record;
  v_period text;
  v_registrations int;
  v_visits int;
  v_enrollments int;
BEGIN
  -- Pega institution_id dependendo da tabela
  IF TG_TABLE_NAME = 'leads' THEN
    v_institution_id := COALESCE(NEW.institution_id, OLD.institution_id);
  ELSIF TG_TABLE_NAME = 'visits' THEN
    v_institution_id := COALESCE(NEW.institution_id, OLD.institution_id);
  ELSIF TG_TABLE_NAME = 'enrollments' THEN
    v_institution_id := COALESCE(NEW.institution_id, OLD.institution_id);
  END IF;

  -- Busca o ciclo ativo
  SELECT * INTO v_cycle
  FROM campaign_cycles
  WHERE institution_id = v_institution_id
    AND status IN ('active', 'released')
    AND start_date IS NOT NULL
    AND end_date IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cycle IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Período atual (YYYY-MM)
  v_period := to_char(NOW(), 'YYYY-MM');

  -- Verifica se o período está dentro do ciclo
  IF NOW()::date < v_cycle.start_date OR NOW()::date > v_cycle.end_date THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Conta registrations (leads criados no período dentro do ciclo)
  SELECT COUNT(*) INTO v_registrations
  FROM leads
  WHERE institution_id = v_institution_id
    AND deleted_at IS NULL
    AND to_char(created_at, 'YYYY-MM') = v_period
    AND created_at::date >= v_cycle.start_date
    AND created_at::date <= v_cycle.end_date;

  -- Conta visits (visitas agendadas no período dentro do ciclo)
  SELECT COUNT(*) INTO v_visits
  FROM visits
  WHERE institution_id = v_institution_id
    AND to_char(scheduled_date, 'YYYY-MM') = v_period
    AND scheduled_date::date >= v_cycle.start_date
    AND scheduled_date::date <= v_cycle.end_date;

  -- Conta enrollments (matrículas no período dentro do ciclo)
  SELECT COUNT(*) INTO v_enrollments
  FROM enrollments
  WHERE institution_id = v_institution_id
    AND to_char(created_at, 'YYYY-MM') = v_period
    AND created_at::date >= v_cycle.start_date
    AND created_at::date <= v_cycle.end_date;

  -- Upsert no funnel_metrics
  INSERT INTO funnel_metrics (
    institution_id, period,
    registrations, visits, enrollments,
    registrations_target, visits_target, enrollments_target,
    schedules, schedules_target
  )
  VALUES (
    v_institution_id, v_period,
    v_registrations, v_visits, v_enrollments,
    0, 0, 0, 0, 0
  )
  ON CONFLICT (period, institution_id)
  DO UPDATE SET
    registrations = v_registrations,
    visits = v_visits,
    enrollments = v_enrollments;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- ===== funcao update_updated_at_column =====
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- ===== gatilhos (leads, visits, enrollments) =====
CREATE TRIGGER trg_sync_funnel_enrollments AFTER INSERT OR DELETE OR UPDATE ON public.enrollments FOR EACH ROW EXECUTE FUNCTION sync_funnel_metrics();
CREATE TRIGGER trg_leads_check_unit BEFORE INSERT OR UPDATE OF unit_id, institution_id ON public.leads FOR EACH ROW EXECUTE FUNCTION leads_check_unit();
CREATE TRIGGER trg_sync_funnel_leads AFTER INSERT OR DELETE OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION sync_funnel_metrics();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sync_funnel_visits AFTER INSERT OR DELETE OR UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION sync_funnel_metrics();
CREATE TRIGGER update_visits_updated_at BEFORE UPDATE ON public.visits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
