-- Seed de dados demo — Colégio Áion
-- institution_id: 169b10a1-024d-4ac8-b3a8-199f34d1f360

-- 3. Métricas do funil
INSERT INTO funnel_metrics (institution_id, period, registrations, registrations_target, schedules, schedules_target, visits, visits_target, enrollments, enrollments_target, created_at)
VALUES
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', '2026-05', 28, 30, 16, 18, 11, 12, 7, 8, now()),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', '2026-04', 24, 30, 14, 18, 9, 12, 6, 8, now() - interval '30 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', '2026-03', 20, 30, 12, 18, 8, 12, 5, 8, now() - interval '60 days')
ON CONFLICT (period, institution_id) DO NOTHING;

-- 4. Leads
INSERT INTO leads (institution_id, student_name, responsible_name, phone, email, grade_interest, source, status, created_at)
VALUES
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Ana Clara Souza', 'Maria Souza', '83991110001', 'maria.souza@email.com', '1º Ano EF', 'Instagram', 'new', now() - interval '2 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Pedro Henrique Lima', 'João Lima', '83991110002', 'joao.lima@email.com', '6º Ano EF', 'Google', 'contact', now() - interval '5 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Beatriz Costa', 'Sandra Costa', '83991110003', 'sandra.costa@email.com', 'Infantil III', 'Indicação', 'scheduled', now() - interval '7 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Lucas Ferreira', 'Roberto Ferreira', '83991110004', 'roberto.f@email.com', '9º Ano EF', 'WhatsApp', 'visit', now() - interval '10 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Mariana Oliveira', 'Carla Oliveira', '83991110005', 'carla.o@email.com', '1ª Série EM', 'Facebook', 'proposal', now() - interval '12 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Gabriel Santos', 'Ana Santos', '83991110006', 'ana.santos@email.com', '2º Ano EF', 'Instagram', 'enrolled', now() - interval '15 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Isabella Martins', 'Paulo Martins', '83991110007', 'paulo.m@email.com', 'Infantil V', 'Google', 'new', now() - interval '1 day'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Rafael Alves', 'Fernanda Alves', '83991110008', 'fernanda.a@email.com', '7º Ano EF', 'Indicação', 'contact', now() - interval '4 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Sophia Pereira', 'Marcos Pereira', '83991110009', 'marcos.p@email.com', '3ª Série EM', 'WhatsApp', 'visit', now() - interval '8 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Davi Rodrigues', 'Juliana Rodrigues', '83991110010', 'juliana.r@email.com', '4º Ano EF', 'Site', 'scheduled', now() - interval '3 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Laura Nascimento', 'Carlos Nascimento', '83991110011', 'carlos.n@email.com', '5º Ano EF', 'Instagram', 'proposal', now() - interval '6 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Matheus Carvalho', 'Patricia Carvalho', '83991110012', 'patricia.c@email.com', '8º Ano EF', 'Google', 'enrolled', now() - interval '20 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Valentina Gomes', 'Ricardo Gomes', '83991110013', 'ricardo.g@email.com', '2ª Série EM', 'Indicação', 'new', now() - interval '1 day'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Enzo Ribeiro', 'Luciana Ribeiro', '83991110014', 'luciana.r@email.com', 'Infantil II', 'WhatsApp', 'contact', now() - interval '3 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Alice Barbosa', 'Thiago Barbosa', '83991110015', 'thiago.b@email.com', '3º Ano EF', 'Facebook', 'lost', now() - interval '25 days')
ON CONFLICT DO NOTHING;

-- 5. Visitas
INSERT INTO visits (institution_id, lead_id, student_name, scheduled_date, status, notes, created_at)
SELECT
  '169b10a1-024d-4ac8-b3a8-199f34d1f360',
  id,
  student_name,
  CASE
    WHEN status = 'scheduled' THEN now() + interval '3 days'
    WHEN status = 'visit' THEN now() - interval '2 days'
    ELSE now() + interval '5 days'
  END,
  CASE
    WHEN status = 'visit' THEN 'completed'
    WHEN status = 'scheduled' THEN 'scheduled'
    ELSE 'scheduled'
  END,
  'Visita agendada pela equipe de captação',
  now()
FROM leads
WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360'
  AND status IN ('scheduled', 'visit', 'proposal')
  AND NOT EXISTS (
    SELECT 1 FROM visits v
    WHERE v.lead_id = leads.id
  );

-- 6. Transferências
INSERT INTO student_transfers (institution_id, student_name, course_grade, transfer_date, stated_reason, created_at)
VALUES
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Felipe Araújo', '7º Ano EF', '2026-04-15', 'Mudança de cidade', now() - interval '15 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Camila Teixeira', '2ª Série EM', '2026-04-20', 'Valor da mensalidade', now() - interval '10 days'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'Bruno Mendes', '5º Ano EF', '2026-05-01', 'Escolheu outra escola', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- 7. Pesquisa de satisfação
INSERT INTO satisfaction_surveys (institution_id, title, description, status, created_at)
VALUES (
  '169b10a1-024d-4ac8-b3a8-199f34d1f360',
  'Pesquisa de Satisfação — 1º Semestre 2026',
  'Avalie sua experiência com o Colégio Áion',
  'active',
  now() - interval '20 days'
)
ON CONFLICT DO NOTHING;

-- 8. Respostas da pesquisa
INSERT INTO satisfaction_responses (institution_id, survey_id, respondent_name, answers, created_at)
SELECT
  '169b10a1-024d-4ac8-b3a8-199f34d1f360',
  s.id,
  v.respondent_name,
  v.answers::jsonb,
  v.created_at
FROM satisfaction_surveys s
CROSS JOIN (VALUES
  ('Maria Souza',     '{"general":5,"teaching":5,"communication":4,"infrastructure":4,"cost_benefit":4}', now() - interval '15 days'),
  ('João Lima',       '{"general":4,"teaching":5,"communication":3,"infrastructure":4,"cost_benefit":3}', now() - interval '12 days'),
  ('Sandra Costa',    '{"general":5,"teaching":4,"communication":5,"infrastructure":3,"cost_benefit":4}', now() - interval '8 days'),
  ('Roberto Ferreira','{"general":3,"teaching":4,"communication":3,"infrastructure":3,"cost_benefit":3}', now() - interval '5 days'),
  ('Carla Oliveira',  '{"general":5,"teaching":5,"communication":5,"infrastructure":4,"cost_benefit":5}', now() - interval '2 days')
) AS v(respondent_name, answers, created_at)
WHERE s.institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360'
  AND NOT EXISTS (
    SELECT 1 FROM satisfaction_responses r
    WHERE r.survey_id = s.id AND r.respondent_name = v.respondent_name
  )
LIMIT 1;

-- 9. Diagnóstico IA
INSERT INTO ai_monthly_reports (institution_id, period, content, created_at)
VALUES (
  '169b10a1-024d-4ac8-b3a8-199f34d1f360',
  '2026-04',
  '📊 DIAGNÓSTICO IA — ABRIL 2026 | Colégio Áion

RESUMO EXECUTIVO
O mês de abril apresentou performance consistente, com captação atingindo 80% da meta mensal. O funil demonstra conversão saudável nas etapas intermediárias, porém com oportunidade de melhoria no fechamento.

ANÁLISE DO FUNIL
- Cadastros: 24 de 30 (80%) — Dentro do esperado para o período
- Agendamentos: 14 de 18 (78%) — Boa conversão de cadastro para agendamento
- Visitas: 9 de 12 (75%) — Taxa de comparecimento satisfatória
- Matrículas: 6 de 8 (75%) — Conversão final pode ser melhorada

PONTOS DE ATENÇÃO
1. Taxa de conversão visita → matrícula está em 67% — abaixo da meta de 75%
2. Tempo médio entre cadastro e matrícula: 18 dias — considere ações de urgência
3. Canal Instagram gerando 40% dos leads — concentração elevada, diversifique

AÇÕES RECOMENDADAS PARA MAIO
✅ Implementar follow-up em 24h para todos os leads agendados
✅ Criar pacote de benefícios para matrículas até 15 de maio
✅ Investir em Google Ads para diversificar canais
✅ Treinar equipe no fechamento de matrículas pós-visita

PROJEÇÃO
Se mantiver o ritmo atual com as ações acima, projeção de 85-90 matrículas ao final da campanha (meta: 120). Intensificação necessária a partir de agosto.',
  now() - interval '5 days'
)
ON CONFLICT DO NOTHING;

-- 10. Notificações
INSERT INTO system_notifications (institution_id, type, title, message, severity, created_at)
VALUES
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'milestone', 'Bem-vindo ao Colégio Áion Demo!', 'Este é um ambiente de demonstração com dados reais simulados. Explore todos os módulos!', 'success', now()),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'goal_deviation', 'Meta de maio em 93%', 'Cadastros em 28 de 30 (93%). Continue assim!', 'info', now() - interval '1 day'),
  ('169b10a1-024d-4ac8-b3a8-199f34d1f360', 'weekly_alert', 'Resumo do dia', '28 leads cadastrados · 11 visitas agendadas · 7 matrículas confirmadas', 'info', now() - interval '2 days')
ON CONFLICT DO NOTHING;

-- Verifica tudo
SELECT
  (SELECT COUNT(*) FROM leads WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as leads,
  (SELECT COUNT(*) FROM visits WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as visitas,
  (SELECT COUNT(*) FROM student_transfers WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as transferencias,
  (SELECT COUNT(*) FROM satisfaction_surveys WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as pesquisas,
  (SELECT COUNT(*) FROM satisfaction_responses WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as respostas,
  (SELECT COUNT(*) FROM campaign_cycles WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as campanhas,
  (SELECT COUNT(*) FROM system_notifications WHERE institution_id = '169b10a1-024d-4ac8-b3a8-199f34d1f360') as notificacoes;
