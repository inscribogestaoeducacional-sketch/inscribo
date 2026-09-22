-- =============================================================================
-- 20260922010000_user_permissions_institution_scope.sql
-- Corrige "permissão de módulo vazando entre instituições": user_permissions
-- já tem a coluna institution_id (NOT NULL) desde sempre, mas a UNIQUE
-- constraint real em produção é só (user_id, module) — sem institution_id.
-- Isso nunca foi versionado neste repo (mesmo padrão de drift já registrado
-- em 20260701000014_fix_users_rls.sql e 20260921010000_user_institutions.sql):
--
--   user_permissions_user_id_module_key   UNIQUE (user_id, module)   <- troca por baixo
--
-- Consequência prática, agora que a Fase 2 permite um usuário ter vínculo
-- (user_institutions) em 2+ instituições com role diferente em cada: o
-- upsert em UserManagement.tsx (onConflict: 'user_id,module') e a leitura em
-- PermissionsContext.tsx (só eq('user_id', ...)) tratavam os módulos
-- liberados/bloqueados de um consultor como GLOBAIS — o admin da Escola B
-- editando os módulos desse usuário SOBRESCREVIA (não duplicava) a mesma
-- linha criada pelo admin da Escola A, porque o conflito colidia em
-- (user_id, module) mesmo vindo de institution_id diferente.
--
-- LEVANTAMENTO (supabase db query --linked, 2026-09-22, antes de qualquer
-- alteração desta migration):
--   - 57 users, 55 linhas em user_institutions, só 1 usuário com 2+ vínculos
--     ATIVOS — e esse usuário é 'admin' nas 3 instituições (PermissionsContext
--     trata admin/manager como "sempre libera tudo", nem chega a ler
--     user_permissions) — ou seja, ZERO caso hoje em que o vazamento já
--     produziu comportamento errado observável, mas o próximo consultor com
--     vínculo em 2+ escolas cairia nele.
--   - 370 linhas em user_permissions, 37 usuários distintos.
--   - ZERO linhas duplicadas por (user_id, module) com institution_id
--     diferente — a própria UNIQUE(user_id, module) atual impede que
--     existam, então não há ambiguidade nenhuma pra resolver: nenhuma linha
--     precisa ser escolhida/descartada, só trocar a constraint por baixo.
--   - institution_id é NOT NULL em 100% das 370 linhas (0 NULL) — não tem
--     caso de linha "órfã" sem instituição pra decidir o que fazer.
-- Dado isso, a migration é uma troca direta de constraint, sem passo de
-- limpeza/backfill de dado.
-- =============================================================================

ALTER TABLE user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_user_id_module_key;

ALTER TABLE user_permissions
  ADD CONSTRAINT user_permissions_user_id_institution_id_module_key
  UNIQUE (user_id, institution_id, module);

-- Nota: a RLS de escrita ("admins manage permissions") já exigia
-- users.institution_id = user_permissions.institution_id pra admin/manager
-- gerenciar a linha — ou seja, o "vazamento de escrita" já não passava pela
-- policy quando o CLIENTE mandava o institution_id certo; o problema real
-- era o onConflict errado do lado da aplicação (corrigido em
-- UserManagement.tsx nesta mesma leva) fazendo a escrita de uma instituição
-- sobrescrever a linha de outra em vez de criar uma nova. A policy de leitura
-- ("users read own permissions", USING user_id = auth.uid()) continua sem
-- filtro de instituição — mantida como está por ora: o filtro correto agora
-- é aplicado no client (PermissionsContext.tsx), e apertar a RLS aqui não
-- foi pedido nem investigado a fundo nesta leva.
