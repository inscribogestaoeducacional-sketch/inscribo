-- =============================================================================
-- 20261012150000_extensoes_pg_trgm_unaccent.sql
-- Pré-requisito da Fase 2 (base de alunos): semelhança de nomes no casamento
-- aluno ↔ lead (docs/produto/fase2-base-de-alunos-desenho.md §5).
-- Autorizado pelo Victor em 12/10/2026. Só liga as extensões, no schema
-- extensions (mesmo lugar de pgcrypto e uuid-ossp); nenhuma tabela muda.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm  WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
