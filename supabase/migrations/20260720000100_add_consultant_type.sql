-- =============================================================================
-- 20260720000100_add_consultant_type.sql
-- Primeiro passo da distinção "consultor interno vs. externo" pedida para o
-- modelo de usuários do Áion Edu (achado da investigação de permissões:
-- essa distinção não existia em nenhum lugar do código/banco).
--
-- Esta migration só adiciona a coluna. NÃO mexe em RLS nem em
-- is_super_admin_user() — isso fica para uma migration futura, depois que
-- este campo existir de fato e os consultores já cadastrados tiverem sido
-- classificados manualmente.
--
-- ⚠️ AÇÃO MANUAL NECESSÁRIA APÓS O DEPLOY DESTA MIGRATION:
-- propositalmente NÃO há DEFAULT — todo consultor já cadastrado
-- (user_type = 'consultant') fica com consultant_type = NULL até alguém
-- classificar cada um manualmente como 'interno' ou 'externo' (pela tela
-- AdminConsultants.tsx, ou direto via UPDATE no SQL Editor). Só consultores
-- criados a partir de agora, pela tela atualizada, já nascem classificados.
-- =============================================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consultant_type TEXT
  CHECK (consultant_type IN ('interno', 'externo') OR consultant_type IS NULL);

COMMENT ON COLUMN users.consultant_type IS
  'Só aplicável quando user_type = ''consultant''. NULL para todos os demais usuários. Consultores cadastrados antes desta migration ficam NULL até classificação manual.';
