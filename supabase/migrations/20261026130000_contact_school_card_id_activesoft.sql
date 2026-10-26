-- Aplicada via MCP (contact_school_card_id_activesoft_historico).
-- contact_school_card passa a devolver, por aluno: student_id, external_id (id do aluno na Activesoft,
-- o número que aparece na URL /alunos/{id}/...) e history (série/turma/situação de cada ano), e no topo
-- 'erp' = 'activesoft' quando a escola tem a integração ativa. Definição completa: ver o banco (pg_get_functiondef).

-- Aplicadas via MCP em seguida: contact_school_card_erp_generico (qualquer provedor ativo, external_id do mesmo provedor),
-- enrollment_leads_check (conferência leads matriculados × alunos novos; lê só tabelas comuns) — ver pg_get_functiondef.
