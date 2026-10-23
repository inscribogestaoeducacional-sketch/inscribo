-- Campanha: meta editável (modo crescimento ou total), retenção, taxa de conversão, origem do plano e relatório da IA.
ALTER TABLE public.campaign_cycles
  ADD COLUMN IF NOT EXISTS goal_mode text DEFAULT 'growth' CHECK (goal_mode IN ('growth','total')),
  ADD COLUMN IF NOT EXISTS growth_pct numeric,
  ADD COLUMN IF NOT EXISTS goal_total integer,
  ADD COLUMN IF NOT EXISTS goal_reenrollments integer,
  ADD COLUMN IF NOT EXISTS lead_conversion_rate numeric,
  ADD COLUMN IF NOT EXISTS plan_source text CHECK (plan_source IN ('activesoft','planilha','manual','estimativa')),
  ADD COLUMN IF NOT EXISTS plan_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_report jsonb,
  ADD COLUMN IF NOT EXISTS ai_report_at timestamptz;
COMMENT ON COLUMN public.campaign_cycles.goal_total IS 'Meta de alunos do ano letivo alvo (rematriculas + novos). Editavel pelo gestor.';
COMMENT ON COLUMN public.campaign_cycles.goal_reenrollments IS 'Meta de rematriculas. target_new_students guarda a meta de novos.';
COMMENT ON COLUMN public.campaign_cycles.lead_conversion_rate IS 'Taxa lead -> matricula (fracao 0-1) usada para estimar leads necessarios.';
