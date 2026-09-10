-- =============================================================================
-- 20260910000000_leads_year_interest.sql
-- Ano de interesse do lead (ex: 2027) — permite identificar e agrupar leads
-- captados antes mesmo de existir uma campanha oficial pra aquele ano, pra
-- depois vincular em lote via LinkLeadsToCampaignModal (aba "Por período",
-- filtro por year_interest além do intervalo de datas).
--
-- Nome segue o padrão já usado nesta tabela (grade_interest, shift_interest
-- — sufixo _interest). Nullable, sem default: cobre todos os leads
-- existentes sem migração de dado, e reflete que a maioria dos leads do
-- fluxo normal (já vinculados a uma campanha via campaign_cycle_id) nunca
-- precisa preencher isso.
-- =============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS year_interest INTEGER;

COMMENT ON COLUMN leads.year_interest IS
  'Ano em que a família pretende matricular (ex: 2027), preenchido quando ainda não existe campanha oficial pra esse ano. Sem relação de FK formal com campaign_cycles.year — mesmo padrão solto que campaign_cycle_id já tem.';
