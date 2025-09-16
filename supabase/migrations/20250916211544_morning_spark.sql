/*
  # Create Sample Data for Inscribo System

  1. Sample Institution
  2. Sample Users with different roles
  3. Sample Leads
  4. Sample Marketing Campaigns
  5. Sample Enrollments
  6. Sample Visits

  This migration creates realistic sample data for testing and demonstration.
*/

-- Insert sample institution
INSERT INTO institutions (id, name, primary_color, secondary_color) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'Colégio Exemplo', '#3B82F6', '#10B981')
ON CONFLICT (id) DO NOTHING;

-- Insert sample users
INSERT INTO users (id, email, full_name, role, institution_id, active) VALUES 
('550e8400-e29b-41d4-a716-446655440001', 'admin@escola.com', 'Administrador Sistema', 'admin', '550e8400-e29b-41d4-a716-446655440000', true),
('550e8400-e29b-41d4-a716-446655440002', 'gestor@escola.com', 'Gestor Comercial', 'manager', '550e8400-e29b-41d4-a716-446655440000', true),
('550e8400-e29b-41d4-a716-446655440003', 'consultor@escola.com', 'Consultor Vendas', 'user', '550e8400-e29b-41d4-a716-446655440000', true)
ON CONFLICT (id) DO NOTHING;

-- Insert sample leads
INSERT INTO leads (student_name, responsible_name, phone, email, grade_interest, source, status, institution_id, notes) VALUES 
('Ana Silva Santos', 'Maria Silva', '(11) 99999-1111', 'maria.silva@email.com', '1º Ano', 'Facebook', 'new', '550e8400-e29b-41d4-a716-446655440000', 'Interessada em período integral'),
('João Pedro Lima', 'Carlos Lima', '(11) 99999-2222', 'carlos.lima@email.com', '5º Ano', 'Instagram', 'contact', '550e8400-e29b-41d4-a716-446655440000', 'Mudança de escola'),
('Beatriz Costa', 'Ana Costa', '(11) 99999-3333', 'ana.costa@email.com', '3º Ano', 'Indicação', 'scheduled', '550e8400-e29b-41d4-a716-446655440000', 'Visita agendada para sexta'),
('Lucas Oliveira', 'Pedro Oliveira', '(11) 99999-4444', 'pedro.oliveira@email.com', '2º Médio', 'Google', 'visit', '550e8400-e29b-41d4-a716-446655440000', 'Interessado em curso técnico'),
('Camila Santos', 'Julia Santos', '(11) 99999-5555', 'julia.santos@email.com', '6º Ano', 'Site', 'proposal', '550e8400-e29b-41d4-a716-446655440000', 'Proposta enviada'),
('Rafael Souza', 'Marcos Souza', '(11) 99999-6666', 'marcos.souza@email.com', '4º Ano', 'WhatsApp', 'enrolled', '550e8400-e29b-41d4-a716-446655440000', 'Matrícula confirmada'),
('Isabella Ferreira', 'Carla Ferreira', '(11) 99999-7777', 'carla.ferreira@email.com', 'Infantil', 'Facebook', 'new', '550e8400-e29b-41d4-a716-446655440000', 'Primeira filha na escola'),
('Gabriel Alves', 'Roberto Alves', '(11) 99999-8888', 'roberto.alves@email.com', '8º Ano', 'Instagram', 'contact', '550e8400-e29b-41d4-a716-446655440000', 'Retorno de ex-aluno'),
('Sophia Rodrigues', 'Fernanda Rodrigues', '(11) 99999-9999', 'fernanda.rodrigues@email.com', '1º Médio', 'Indicação', 'scheduled', '550e8400-e29b-41d4-a716-446655440000', 'Indicação de atual aluno'),
('Matheus Pereira', 'José Pereira', '(11) 99999-0000', 'jose.pereira@email.com', '7º Ano', 'Google', 'visit', '550e8400-e29b-41d4-a716-446655440000', 'Visita realizada ontem');

-- Insert sample marketing campaigns
INSERT INTO marketing_campaigns (month_year, investment, leads_generated, cpa_target, institution_id) VALUES 
('2024-01', 5000.00, 25, 200.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023-12', 4500.00, 30, 180.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023-11', 6000.00, 20, 200.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023-10', 3500.00, 28, 150.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023-09', 4000.00, 32, 180.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023-08', 5500.00, 22, 220.00, '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample enrollments
INSERT INTO enrollments (student_name, course_grade, enrollment_value, enrollment_date, institution_id) VALUES 
('Rafael Souza', '4º Ano', 1200.00, '2024-01-15', '550e8400-e29b-41d4-a716-446655440000'),
('Mariana Costa', '2º Ano', 1100.00, '2024-01-10', '550e8400-e29b-41d4-a716-446655440000'),
('Pedro Santos', '6º Ano', 1300.00, '2024-01-08', '550e8400-e29b-41d4-a716-446655440000'),
('Laura Oliveira', '1º Médio', 1500.00, '2024-01-05', '550e8400-e29b-41d4-a716-446655440000'),
('Diego Silva', '8º Ano', 1350.00, '2023-12-20', '550e8400-e29b-41d4-a716-446655440000'),
('Amanda Lima', '3º Ano', 1150.00, '2023-12-18', '550e8400-e29b-41d4-a716-446655440000'),
('Bruno Ferreira', '5º Ano', 1250.00, '2023-12-15', '550e8400-e29b-41d4-a716-446655440000'),
('Carla Rodrigues', '9º Ano', 1400.00, '2023-12-12', '550e8400-e29b-41d4-a716-446655440000'),
('Eduardo Alves', '7º Ano', 1300.00, '2023-12-10', '550e8400-e29b-41d4-a716-446655440000'),
('Fernanda Souza', '2º Médio', 1600.00, '2023-12-08', '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample visits
INSERT INTO visits (lead_id, scheduled_date, status, notes, institution_id) VALUES 
((SELECT id FROM leads WHERE student_name = 'Beatriz Costa' LIMIT 1), '2024-01-19 09:00:00+00', 'scheduled', 'Visita agendada para conhecer as instalações', '550e8400-e29b-41d4-a716-446655440000'),
((SELECT id FROM leads WHERE student_name = 'Lucas Oliveira' LIMIT 1), '2024-01-18 14:00:00+00', 'completed', 'Visita realizada, família interessada', '550e8400-e29b-41d4-a716-446655440000'),
((SELECT id FROM leads WHERE student_name = 'Sophia Rodrigues' LIMIT 1), '2024-01-20 10:30:00+00', 'scheduled', 'Visita para conhecer o ensino médio', '550e8400-e29b-41d4-a716-446655440000'),
((SELECT id FROM leads WHERE student_name = 'Matheus Pereira' LIMIT 1), '2024-01-17 15:30:00+00', 'completed', 'Visita concluída, aguardando decisão', '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample funnel metrics
INSERT INTO funnel_metrics (period, registrations, registrations_target, schedules, schedules_target, visits, visits_target, enrollments, enrollments_target, institution_id) VALUES 
('2024-01', 150, 120, 85, 90, 72, 80, 18, 24, '550e8400-e29b-41d4-a716-446655440000'),
('2023-12', 130, 120, 95, 90, 82, 80, 24, 24, '550e8400-e29b-41d4-a716-446655440000'),
('2023-11', 140, 120, 88, 90, 75, 80, 20, 24, '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample re-enrollment data
INSERT INTO re_enrollments (period, total_base, re_enrolled, defaulters, transferred, target_percentage, institution_id) VALUES 
('2024', 1350, 1248, 52, 50, 85.00, '550e8400-e29b-41d4-a716-446655440000'),
('2023', 1280, 1152, 78, 50, 85.00, '550e8400-e29b-41d4-a716-446655440000'),
('2022', 1200, 1080, 70, 50, 85.00, '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample actions
INSERT INTO actions (title, description, action_type, priority, status, due_date, institution_id) VALUES 
('Campanha Facebook Janeiro', 'Criar campanha de captação para o mês de janeiro', 'marketing', 'high', 'in_progress', '2024-01-25', '550e8400-e29b-41d4-a716-446655440000'),
('Follow-up Leads Pendentes', 'Entrar em contato com leads sem retorno há mais de 3 dias', 'sales', 'urgent', 'pending', '2024-01-20', '550e8400-e29b-41d4-a716-446655440000'),
('Análise Taxa Conversão', 'Analisar motivos da baixa conversão no funil', 'sales', 'medium', 'pending', '2024-01-30', '550e8400-e29b-41d4-a716-446655440000'),
('Campanha Rematrícula', 'Iniciar campanha de rematrícula para 2024', 'retention', 'high', 'completed', '2024-01-15', '550e8400-e29b-41d4-a716-446655440000');