CREATE TABLE IF NOT EXISTS ibge_municipios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ibge TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  uf TEXT NOT NULL,
  nome_estado TEXT,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  populacao INT,
  renda_media DECIMAL(10,2),
  ano_referencia INT DEFAULT 2022,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ibge_municipios DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ibge_municipios_uf_idx   ON ibge_municipios (uf);
CREATE INDEX IF NOT EXISTS ibge_municipios_nome_idx ON ibge_municipios (nome);
