-- =============================================================================
-- 20260814000000_showcase_schools.sql
-- Prova social na landing page pública: logos de escolas clientes + mapa do
-- Brasil por estado. Leitura pública (a landing não tem usuário logado),
-- escrita restrita a super admin — gerenciado pela tela Admin "Escolas em
-- Destaque" (AdminShowcaseSchools.tsx).
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabela
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS showcase_schools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id  UUID REFERENCES institutions(id) ON DELETE SET NULL,
  school_name     TEXT NOT NULL,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  logo_url        TEXT NOT NULL,
  display_order   INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showcase_schools_active_order
  ON showcase_schools(is_active, display_order);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RLS — tabela nova e dedicada só para dado de marketing/institucional,
-- então o SELECT público (USING true) aqui não repete o problema de
-- "USING(true) numa tabela com dado sensível" já documentado e corrigido em
-- 20260701000015_fix_legacy_true_policies.sql. Ainda assim o público só
-- enxerga linhas ativas — inativas exigem a policy de admin.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE showcase_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "showcase_schools_public_select" ON showcase_schools;
CREATE POLICY "showcase_schools_public_select" ON showcase_schools
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "showcase_schools_admin_all" ON showcase_schools;
CREATE POLICY "showcase_schools_admin_all" ON showcase_schools
  FOR ALL
  USING (is_super_admin_user())
  WITH CHECK (is_super_admin_user());

GRANT SELECT ON showcase_schools TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON showcase_schools TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Storage — bucket dedicado (não reaproveita institution-logos, que é
-- 1-arquivo-por-institution_id e usado pelo painel da própria escola; aqui
-- pode haver escola-vitrine sem institution_id nenhum).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'showcase-logos',
  'showcase-logos',
  true,
  5242880,  -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'showcase_logos_public_read' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY showcase_logos_public_read ON storage.objects
      FOR SELECT
      USING (bucket_id = ''showcase-logos'')';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'showcase_logos_admin_write' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY showcase_logos_admin_write ON storage.objects
      FOR ALL
      USING (bucket_id = ''showcase-logos'' AND is_super_admin_user())
      WITH CHECK (bucket_id = ''showcase-logos'' AND is_super_admin_user())';
  END IF;
END $$;
