-- =============================================================================
-- 20260812000100_lead_families.sql
-- Reforma do módulo de Leads — parte 2: agrupamento de família com múltiplos
-- filhos. `leads` continua 1 linha = 1 aluno (não muda) — `lead_families` é
-- só uma chave de agrupamento + lookup pra detectar telefone já cadastrado,
-- sem virar fonte única dos dados de contato (cada linha de `leads` continua
-- com seu próprio responsible_name/phone/email/address, exatamente como
-- hoje — mesmo padrão de redundância simples já usado no schema atual,
-- evita reescrever todo consumidor de lead.responsible_name/phone existente).
-- =============================================================================

CREATE TABLE IF NOT EXISTS lead_families (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  responsible_name  TEXT        NOT NULL,
  phone             TEXT,
  email             TEXT,
  address           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_families_institution_phone ON lead_families(institution_id, phone);

ALTER TABLE lead_families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their institution lead_families" ON lead_families;
CREATE POLICY "Users can access their institution lead_families"
  ON lead_families
  FOR ALL
  TO authenticated
  USING (institution_id IN (
    SELECT institution_id FROM users WHERE id = auth.uid()
  ));

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES lead_families(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_leads_family_id ON leads(family_id) WHERE family_id IS NOT NULL;
