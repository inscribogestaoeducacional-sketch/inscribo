/*
  # Criar Super Admin no Supabase

  1. Tabelas
    - Garantir que `super_admins` existe
    - Inserir usuário super admin padrão
  
  2. Segurança
    - Políticas RLS para super_admins
    - Função para verificar super admin
  
  3. Dados
    - Super admin: admin@inscribo.com
    - Dados de exemplo para testes
*/

-- Criar tabela super_admins se não existir
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- Criar função para verificar super admin
CREATE OR REPLACE FUNCTION is_super_admin(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM super_admins 
    WHERE email = user_email AND active = true
  );
END;
$$;

-- Criar função para obter email do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (SELECT email FROM auth.users WHERE id = auth.uid());
END;
$$;

-- Políticas RLS para super_admins
CREATE POLICY "Super admins can read their own data"
  ON super_admins
  FOR SELECT
  TO authenticated
  USING (email = get_current_user_email());

CREATE POLICY "Super admins can update their own data"
  ON super_admins
  FOR UPDATE
  TO authenticated
  USING (email = get_current_user_email())
  WITH CHECK (email = get_current_user_email());

-- Inserir super admin padrão
INSERT INTO super_admins (email, full_name, active) 
VALUES ('admin@inscribo.com', 'Super Administrador', true)
ON CONFLICT (email) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  active = EXCLUDED.active,
  updated_at = now();

-- Criar tabela saas_metrics se não existir
CREATE TABLE IF NOT EXISTS saas_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date DEFAULT CURRENT_DATE,
  total_institutions integer DEFAULT 0,
  active_institutions integer DEFAULT 0,
  total_users integer DEFAULT 0,
  total_leads integer DEFAULT 0,
  total_enrollments integer DEFAULT 0,
  mrr numeric(10,2) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS para saas_metrics
ALTER TABLE saas_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas para saas_metrics (apenas super admins)
CREATE POLICY "Super admins can read saas metrics"
  ON saas_metrics
  FOR SELECT
  TO authenticated
  USING (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can insert saas metrics"
  ON saas_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(get_current_user_email()));

CREATE POLICY "Super admins can update saas metrics"
  ON saas_metrics
  FOR UPDATE
  TO authenticated
  USING (is_super_admin(get_current_user_email()))
  WITH CHECK (is_super_admin(get_current_user_email()));

-- Inserir dados de exemplo para saas_metrics
INSERT INTO saas_metrics (
  metric_date,
  total_institutions,
  active_institutions,
  total_users,
  total_leads,
  total_enrollments,
  mrr
) VALUES 
  (CURRENT_DATE, 15, 12, 45, 1250, 320, 4850.00),
  (CURRENT_DATE - INTERVAL '1 month', 12, 10, 38, 980, 285, 3890.00),
  (CURRENT_DATE - INTERVAL '2 months', 10, 8, 32, 750, 210, 2970.00),
  (CURRENT_DATE - INTERVAL '3 months', 8, 7, 28, 620, 180, 2430.00),
  (CURRENT_DATE - INTERVAL '4 months', 6, 5, 22, 480, 145, 1940.00),
  (CURRENT_DATE - INTERVAL '5 months', 5, 4, 18, 350, 120, 1460.00)
ON CONFLICT (metric_date) DO UPDATE SET
  total_institutions = EXCLUDED.total_institutions,
  active_institutions = EXCLUDED.active_institutions,
  total_users = EXCLUDED.total_users,
  total_leads = EXCLUDED.total_leads,
  total_enrollments = EXCLUDED.total_enrollments,
  mrr = EXCLUDED.mrr;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_super_admins_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_super_admins_updated_at
  BEFORE UPDATE ON super_admins
  FOR EACH ROW
  EXECUTE FUNCTION update_super_admins_updated_at();