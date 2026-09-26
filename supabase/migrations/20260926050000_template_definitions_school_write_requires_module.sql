-- =============================================================================
-- 20260926050000_template_definitions_school_write_requires_module.sql
-- Antes do lançamento oficial, Transmissões não é vitrine: a escola só grava
-- template próprio (rascunho) com o módulo liberado pela Áion
-- (broadcast_settings.enabled). Fecha o que sobrava da opção A (menu escondido,
-- página só com aviso, submit_school_template recusando): a RLS de
-- 20260926000000 ainda deixava gravar rascunho chamando o banco direto.
-- Só as duas policies de escrita da escola mudam; leitura e Super Admin iguais.
-- =============================================================================

DROP POLICY IF EXISTS "template_definitions_school_insert" ON template_definitions;
CREATE POLICY "template_definitions_school_insert" ON template_definitions
  FOR INSERT TO authenticated
  WITH CHECK (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM broadcast_settings s
                WHERE s.institution_id = template_definitions.institution_id AND s.enabled)
  );

DROP POLICY IF EXISTS "template_definitions_school_update" ON template_definitions;
CREATE POLICY "template_definitions_school_update" ON template_definitions
  FOR UPDATE TO authenticated
  USING (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM broadcast_settings s
                WHERE s.institution_id = template_definitions.institution_id AND s.enabled)
  )
  WITH CHECK (
    institution_id IS NOT NULL
    AND institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM broadcast_settings s
                WHERE s.institution_id = template_definitions.institution_id AND s.enabled)
  );
