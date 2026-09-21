-- =============================================================================
-- 20260921000000_contact_notes_author_id_and_rls.sql
-- Edição/exclusão de nota interna (contact_notes) restrita ao próprio autor.
--
-- 1. author_id — author_name (texto livre) era a única referência até agora,
--    e nome pode duplicar entre pessoas diferentes na mesma escola. Coluna
--    nova + backfill por (author_name, institution_id) → users.full_name:
--    checado ao vivo antes desta migration, as 3 notas existentes em
--    produção batem 1:1 com exatamente um usuário cada, sem ambiguidade.
--    Nota cujo autor não bater em ninguém (nome mudou, usuário removido)
--    fica com author_id NULL — sem dono claro, então ninguém consegue
--    editar/apagar via RLS (mais seguro que herdar de qualquer jeito).
--
-- 2. RLS — investigação encontrou só UMA policy cobrindo a tabela inteira,
--    sem FOR (= FOR ALL implícito no Postgres), então SELECT/INSERT/UPDATE/
--    DELETE já eram tecnicamente permitidos pra qualquer um da mesma escola
--    — "append-only" descrito antes era só a UI (ContactProfile.tsx/
--    WhatsAppHub.tsx nunca tinham botão de editar/apagar; ContactCard.tsx
--    tinha botão de apagar SEM checagem de autor nenhuma). A policy única
--    já viveu com dois nomes diferentes ao longo do projeto (`notes_inst`
--    no arquivo original contacts.sql, `contact_notes_inst` aplicada
--    manualmente em produção depois — ver comentário em
--    20260821050000_create_contact_custom_fields_tables.sql) — o DROP
--    cobre os dois pra garantir que nenhuma policy antiga e permissiva
--    sobreviva ao lado das novas (policies permissivas do Postgres se
--    somam com OR; deixar a antiga junto anularia a restrição por autor).
-- =============================================================================

ALTER TABLE contact_notes
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id);

UPDATE contact_notes cn
SET author_id = u.id
FROM users u
WHERE cn.author_id IS NULL
  AND u.full_name = cn.author_name
  AND u.institution_id = cn.institution_id;

DROP POLICY IF EXISTS "notes_inst" ON contact_notes;
DROP POLICY IF EXISTS "contact_notes_inst" ON contact_notes;

-- Leitura e criação continuam por instituição inteira — nota interna é log
-- de equipe, todo mundo da escola deve ver e poder registrar a sua.
CREATE POLICY "contact_notes_select_inst" ON contact_notes
  FOR SELECT
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

CREATE POLICY "contact_notes_insert_inst" ON contact_notes
  FOR INSERT
  WITH CHECK (
    institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid())
    AND author_id = auth.uid()
  );

-- Editar/apagar: só o próprio autor. WITH CHECK repete a mesma condição no
-- UPDATE pra impedir "doar" a nota mudando author_id pra outra pessoa.
CREATE POLICY "contact_notes_update_own" ON contact_notes
  FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "contact_notes_delete_own" ON contact_notes
  FOR DELETE
  USING (author_id = auth.uid());
