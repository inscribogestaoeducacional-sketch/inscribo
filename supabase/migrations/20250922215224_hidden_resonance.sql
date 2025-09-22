/*
  # Adicionar coluna student_name à tabela visits

  1. Alterações
    - Adiciona coluna `student_name` à tabela `visits`
    - Permite armazenar nome do visitante quando não há lead associado
  
  2. Segurança
    - Mantém RLS existente
    - Não afeta políticas de segurança
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visits' AND column_name = 'student_name'
  ) THEN
    ALTER TABLE visits ADD COLUMN student_name text;
  END IF;
END $$;