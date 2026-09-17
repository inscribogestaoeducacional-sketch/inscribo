-- =============================================================================
-- 20260917000000_template_definitions_scope.sql
-- "Templates Automáticos" — escopo de escolas na criação/importação de
-- template: 'all' (todas as escolas elegíveis, comportamento de sempre) ou
-- 'specific' (só as instituições marcadas pelo Super Admin no formulário).
--
-- Guarda só a ESCOLHA original ('all'/'specific'), não a lista de
-- institution_ids em si — quem realmente recebeu submissão/registro já fica
-- em template_institution_status (uma linha por instituição efetivamente
-- processada). scope='specific' existe pra a UI saber mostrar "Escolas
-- selecionadas" em vez de tratar o template como universal, e serve de
-- lembrete caso o Super Admin queira "sincronizar" esse template depois pra
-- mais escolas (reenviar a submissão escolhendo outro conjunto).
-- =============================================================================

ALTER TABLE template_definitions
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'all';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'template_definitions_scope_check'
  ) THEN
    ALTER TABLE template_definitions
      ADD CONSTRAINT template_definitions_scope_check
        CHECK (scope IN ('all', 'specific'));
  END IF;
END $$;
