-- =============================================================================
-- 20260820000000_whatsapp_contacts_student_link.sql
-- Suporte a "contato vinculado a aluno" na aba Contatos (import CSV em massa
-- de pais/responsáveis já matriculados, sem intenção comercial nova — por
-- isso não cria lead, ver 20260820000001 no código do import).
--
-- email/address: whatsapp_contacts nunca teve essas colunas. O import de CSV
-- (ContactsModule.tsx) sempre leu "email" e "endereco" do arquivo mas, ao
-- migrar o destino do insert de `leads` (que tem as duas colunas) pra
-- `whatsapp_contacts` (que não tinha nenhuma das duas), esses dados seriam
-- descartados silenciosamente de novo — mesmo bug que "endereco" já tinha
-- antes dessa mudança. Adicionadas aqui pra não reintroduzir o problema.
--
-- linked_student_name/student_grade/relationship: texto livre, informativo —
-- não usar como fonte de verdade de matrícula (isso é papel de `leads` /
-- futura tabela de alunos, se vier a existir). student_grade é livre porque
-- o CSV importado pode não bater com as séries oficiais cadastradas em
-- school_grade_levels (ex: "6º Ano B" com turma, enquanto a série oficial é
-- só "6º Ano").
-- =============================================================================

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS address              TEXT,
  ADD COLUMN IF NOT EXISTS linked_student_name   TEXT,
  ADD COLUMN IF NOT EXISTS student_grade         TEXT,
  ADD COLUMN IF NOT EXISTS relationship          TEXT;
