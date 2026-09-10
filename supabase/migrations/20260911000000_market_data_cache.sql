-- =============================================================================
-- 20260911000000_market_data_cache.sql
-- Conserta um bug ativo: GestorHome.tsx tentava gravar
-- campaign_cycles.market_data_fetched_at pra controlar o cache de 30 dias
-- do fetch_ibge (api/ai.ts), mas essa coluna nunca existiu — o UPDATE falhava
-- inteiro (silenciosamente, só console.error), então o "cache" nunca
-- funcionou: toda carga do dashboard chamava a API da Anthropic de novo.
--
-- Esta tabela substitui esse mecanismo por um cache de verdade, chaveado por
-- cidade+estado (não por campaign_cycle_id) — várias escolas da mesma cidade
-- reaproveitam a mesma busca, e serve tanto pro dashboard (GestorHome.tsx)
-- quanto pro motor de metas (api/ai.ts, generate_campaign).
-- =============================================================================

CREATE TABLE market_data_cache (
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (city, state)
);

ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;

-- Dado agregado por cidade/estado, sem informação sensível de nenhuma
-- instituição específica — qualquer usuário autenticado pode ler e
-- atualizar o cache (mesmo padrão de "authenticated" já usado em outras
-- tabelas de referência compartilhada do projeto).
DROP POLICY IF EXISTS "authenticated_read_write_market_data_cache" ON market_data_cache;
CREATE POLICY "authenticated_read_write_market_data_cache"
  ON market_data_cache
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
