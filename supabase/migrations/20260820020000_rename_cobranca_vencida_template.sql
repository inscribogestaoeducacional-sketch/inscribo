-- =============================================================================
-- 20260820020000_rename_cobranca_vencida_template.sql
-- Renomeia o identificador do template de cobrança vencida de
-- 'cobranca_vencida' pra 'cobranca_em_atraso' — precisa bater EXATAMENTE com o
-- nome aprovado na Meta (Cloud API rejeita o envio se o nome do template
-- divergir, mesmo que só na grafia). Código-fonte já atualizado em
-- src/lib/collectionTemplates.ts e src/components/superadmin/AdminFinancial.tsx.
--
-- 20260820010000_manual_collection_sends.sql já foi aplicada em produção (a
-- tabela e a constraint antiga existem de verdade), então o rename precisa de
-- uma migration nova em vez de só editar a original — editar um arquivo já
-- aplicado não muda o banco.
--
-- Não mexe em linhas já existentes: um envio antigo com
-- template_used='cobranca_vencida' é um registro histórico do que foi
-- efetivamente enviado (usando o nome antigo, antes deste rename) — reescrever
-- isso seria falsificar auditoria, não corrigir um erro de dado.
-- =============================================================================

ALTER TABLE manual_collection_sends
  DROP CONSTRAINT IF EXISTS manual_collection_sends_template_used_check;

ALTER TABLE manual_collection_sends
  ADD CONSTRAINT manual_collection_sends_template_used_check
  CHECK (template_used IN ('cobranca_em_atraso', 'link_mensalidade', 'cobranca_vencida'));

-- 'cobranca_vencida' fica na lista só pra não quebrar a constraint contra
-- linhas históricas (a tabela não tem coluna de soft-delete/arquivamento pra
-- separar "valores válidos pra novos envios" de "valores que já existiram") —
-- o código-fonte não usa mais esse valor pra novos envios a partir de agora.
