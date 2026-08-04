-- =============================================================================
-- 20260803010000_fix_stuck_onboarding_contract_tasks.sql
--
-- Correção pontual e retroativa da divergência histórica entre
-- InstitutionDetails.tsx e AdminOnboarding.tsx (ambos duplicavam a lógica de
-- onboarding_processes/onboarding_tasks com taxonomias de fase diferentes,
-- agora consolidadas em InstitutionDetails.tsx só).
--
-- Causa raiz: o handleInitProcess() antigo de InstitutionDetails.tsx criava o
-- processo direto em current_phase='implementation', sem semear as 3 tarefas
-- da fase 'contract' (essas só existiam em processos criados via
-- AdminOnboarding.tsx). Resultado: qualquer processo criado pela tela de
-- Escolas ficava com a fase "Contrato" sempre vazia (0 tarefas) — e, como o
-- avanço de fase agora também pode depender de checklist completo, esses
-- processos ficam "presos" sem nenhuma tarefa de contrato pra marcar.
--
-- Esta migration:
--   1. Encontra processos com current_phase='implementation' que não têm
--      NENHUMA tarefa phase='contract' (ou seja, nasceram pelo caminho antigo).
--   2. Semeia retroativamente as 3 tarefas padrão da fase 'contract' pra esses
--      processos, com sort_order negativo (ficam antes das tarefas de
--      implementation já existentes, mantendo a ordem cronológica esperada).
--   3. Marca as 3 tarefas como concluídas (done=true, done_at=now()) quando
--      contracts.status='signed' já é verdade pra instituição do processo —
--      critério único pedido, sem checar payments separadamente.
-- =============================================================================

DO $$
DECLARE
  proc RECORD;
  is_signed BOOLEAN;
BEGIN
  FOR proc IN
    SELECT p.id, p.institution_id
    FROM onboarding_processes p
    WHERE p.current_phase = 'implementation'
      AND NOT EXISTS (
        SELECT 1 FROM onboarding_tasks t
        WHERE t.process_id = p.id AND t.phase = 'contract'
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM contracts c
      WHERE c.institution_id = proc.institution_id AND c.status = 'signed'
    ) INTO is_signed;

    INSERT INTO onboarding_tasks (process_id, phase, title, description, done, done_at, sort_order)
    VALUES
      (proc.id, 'contract', 'Contrato enviado via Autentique',     'Enviar contrato para assinatura digital',
        is_signed, CASE WHEN is_signed THEN now() ELSE NULL END, -3),
      (proc.id, 'contract', 'Contrato assinado pela escola',       'Confirmar assinatura do responsável',
        is_signed, CASE WHEN is_signed THEN now() ELSE NULL END, -2),
      (proc.id, 'contract', 'Pagamento da implantação confirmado', 'Verificar pagamento no Asaas',
        is_signed, CASE WHEN is_signed THEN now() ELSE NULL END, -1);
  END LOOP;
END $$;
