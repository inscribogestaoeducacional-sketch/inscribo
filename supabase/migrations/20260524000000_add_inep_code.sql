ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS inep_code TEXT;

ALTER TABLE institutions
ADD COLUMN IF NOT EXISTS ibge_city_code TEXT;

COMMENT ON COLUMN institutions.inep_code IS 'Código INEP da escola (7 dígitos) — usado para cruzar com microdados do Censo Escolar';
COMMENT ON COLUMN institutions.ibge_city_code IS 'Código IBGE do município (7 dígitos) — usado para filtrar dados demográficos';
