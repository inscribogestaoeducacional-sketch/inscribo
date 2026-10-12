-- ============================================================================
-- Fase 0C — backfill (roda DEPOIS da migration 20261013100000, na mesma janela).
-- Backup antes: supabase/pendentes/fase0c_backup.sql.
--
--   a) Ciclos: campaign_year e target_school_year pelas datas; rótulo
--      "Campanha AAAA" passa a mostrar o ano letivo alvo (gatilho).
--   b) Leads sem ciclo das escolas com ciclo ativo:
--        criados a partir do início do ciclo        → ciclo, 'campanha'
--        criados antes, ainda em aberto             → ciclo, 'herdado'
--        criados antes e já fechados (matr./perdido) → ficam sem ciclo
--      Leads JÁ vinculados ao ciclo ganham o tipo pela data de criação
--      (criado antes do início = 'herdado', mesmo vinculado à mão).
--   c) year_interest vazio em lead com ciclo → ano letivo alvo do ciclo.
--   d) Perdidos sem motivo → 'nao_informado' + detalhe (roda primeiro); valida a regra no fim.
-- Escolas sem ciclo ativo (só 'setup': Universo Uno, Espaço Criativo) não
-- mudam: os leads seguem sem ciclo até a campanha ser liberada.
-- ============================================================================

-- d) Perdidos sem motivo — PRIMEIRO: qualquer UPDATE num perdido sem motivo
--    (inclusive os de b e c) seria recusado pela regra nova
UPDATE public.leads
   SET lost_reason = 'nao_informado',
       lost_reason_detail = COALESCE(NULLIF(btrim(lost_reason_detail), ''),
                                     'Marcado como perdido antes do motivo ser obrigatório (Fase 0C, 12/10/2026)')
 WHERE status = 'lost' AND NULLIF(btrim(COALESCE(lost_reason, '')), '') IS NULL;

-- a) Ciclos
UPDATE public.campaign_cycles
   SET campaign_year      = COALESCE(extract(year FROM start_date)::int, year),
       target_school_year = public.campaign_cycle_target_year(end_date, year);

-- b) Leads soltos → ciclo ativo (o gatilho calcula cycle_link_kind e year_interest)
WITH ativo AS (
  SELECT i.id AS institution_id, public.active_campaign_cycle_id(i.id) AS cycle_id FROM public.institutions i
), alvo AS (
  SELECT l.id, a.cycle_id
  FROM public.leads l
  JOIN ativo a ON a.institution_id = l.institution_id AND a.cycle_id IS NOT NULL
  JOIN public.campaign_cycles c ON c.id = a.cycle_id
  WHERE l.campaign_cycle_id IS NULL
    AND l.deleted_at IS NULL
    AND l.created_at < ((c.end_date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')
    AND (l.created_at >= (c.start_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
         OR l.status NOT IN ('enrolled', 'lost'))
)
UPDATE public.leads l SET campaign_cycle_id = alvo.cycle_id
  FROM alvo WHERE l.id = alvo.id;

-- Já vinculados: tipo pela data de criação
UPDATE public.leads l
   SET cycle_link_kind = CASE WHEN l.created_at < (c.start_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
                              THEN 'herdado' ELSE 'campanha' END
  FROM public.campaign_cycles c
 WHERE c.id = l.campaign_cycle_id AND l.cycle_link_kind IS NULL;

-- c) Ano de interesse vazio → ano letivo alvo do ciclo
UPDATE public.leads l
   SET year_interest = c.target_school_year
  FROM public.campaign_cycles c
 WHERE c.id = l.campaign_cycle_id AND l.year_interest IS NULL AND c.target_school_year IS NOT NULL;

ALTER TABLE public.leads VALIDATE CONSTRAINT leads_lost_requires_reason;
