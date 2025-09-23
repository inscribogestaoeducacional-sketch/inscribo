/*
  # Enhance leads table with additional fields

  1. New Columns
    - `responsible_cpf` (text) - CPF do responsável
    - `whatsapp` (text) - WhatsApp do responsável
    - `address` (text) - Endereço completo
    - `birth_date` (date) - Data de nascimento do aluno
    - `budget_range` (text) - Faixa de orçamento
    - `preferred_period` (text) - Período preferido
    - `how_found_us` (text) - Detalhes de como nos conheceu

  2. Changes
    - Make phone field required by updating existing records
*/

-- Add new columns to leads table
DO $$
BEGIN
  -- Add responsible_cpf column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'responsible_cpf'
  ) THEN
    ALTER TABLE leads ADD COLUMN responsible_cpf text;
  END IF;

  -- Add whatsapp column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE leads ADD COLUMN whatsapp text;
  END IF;

  -- Add address column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'address'
  ) THEN
    ALTER TABLE leads ADD COLUMN address text;
  END IF;

  -- Add birth_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'birth_date'
  ) THEN
    ALTER TABLE leads ADD COLUMN birth_date date;
  END IF;

  -- Add budget_range column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'budget_range'
  ) THEN
    ALTER TABLE leads ADD COLUMN budget_range text;
  END IF;

  -- Add preferred_period column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'preferred_period'
  ) THEN
    ALTER TABLE leads ADD COLUMN preferred_period text;
  END IF;

  -- Add how_found_us column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'how_found_us'
  ) THEN
    ALTER TABLE leads ADD COLUMN how_found_us text;
  END IF;
END $$;

-- Create activity log table for tracking lead movements
CREATE TABLE IF NOT EXISTS lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  old_status text,
  new_status text,
  notes text,
  institution_id uuid REFERENCES institutions(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on lead_activities
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;

-- Create policy for lead_activities
CREATE POLICY "Users can access their institution lead activities"
  ON lead_activities
  FOR ALL
  TO authenticated
  USING (institution_id IN (
    SELECT users.institution_id
    FROM users
    WHERE users.id = uid()
  ));

-- Create function to log lead status changes
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO lead_activities (
      lead_id,
      user_id,
      action,
      old_status,
      new_status,
      notes,
      institution_id
    ) VALUES (
      NEW.id,
      auth.uid(),
      'status_change',
      OLD.status,
      NEW.status,
      CASE 
        WHEN NEW.status = 'enrolled' THEN 'Lead convertido em matrícula'
        WHEN NEW.status = 'lost' THEN 'Lead perdido'
        WHEN NEW.status = 'scheduled' THEN 'Visita agendada'
        WHEN NEW.status = 'visit' THEN 'Visita realizada'
        WHEN NEW.status = 'proposal' THEN 'Proposta enviada'
        WHEN NEW.status = 'contact' THEN 'Primeiro contato realizado'
        ELSE 'Status alterado'
      END,
      NEW.institution_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for lead status changes
DROP TRIGGER IF EXISTS lead_status_change_trigger ON leads;
CREATE TRIGGER lead_status_change_trigger
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_lead_status_change();