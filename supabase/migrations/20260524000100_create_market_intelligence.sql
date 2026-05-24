CREATE TABLE IF NOT EXISTS inep_escolas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  co_entidade TEXT NOT NULL,
  no_entidade TEXT,
  co_municipio TEXT,
  no_municipio TEXT,
  sg_uf TEXT,
  tp_dependencia INT,
  tp_situacao_funcionamento INT,
  qt_mat_total INT,
  qt_mat_fund INT,
  qt_mat_med INT,
  qt_mat_inf INT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  ano_censo INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(co_entidade, ano_censo)
);

CREATE TABLE IF NOT EXISTS ibge_setores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  co_setor TEXT NOT NULL,
  co_municipio TEXT NOT NULL,
  no_municipio TEXT,
  sg_uf TEXT,
  no_bairro TEXT,
  renda_media DECIMAL(10,2),
  total_domicilios INT,
  total_moradores INT,
  criancas_0_5 INT,
  criancas_6_10 INT,
  criancas_11_14 INT,
  jovens_15_17 INT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  ano_referencia INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(co_setor, ano_referencia)
);

CREATE TABLE IF NOT EXISTS inep_import_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  ano_censo INT,
  total_registros INT,
  status TEXT DEFAULT 'pending',
  erro TEXT,
  imported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE inep_escolas DISABLE ROW LEVEL SECURITY;
ALTER TABLE ibge_setores DISABLE ROW LEVEL SECURITY;
ALTER TABLE inep_import_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_inep_municipio ON inep_escolas(co_municipio);
CREATE INDEX IF NOT EXISTS idx_inep_ano ON inep_escolas(ano_censo);
CREATE INDEX IF NOT EXISTS idx_ibge_municipio ON ibge_setores(co_municipio);
