-- Novas rotas públicas do site (módulos, integrações, guias, /site/ com imagens) e rotas do app que faltavam na lista.
INSERT INTO vitrine_reserved_slugs (slug) VALUES
  ('modulos'),('integracoes'),('guias'),('site'),('entrar'),('base-alunos'),('campanha'),('academia'),('roteiro'),('brand')
ON CONFLICT DO NOTHING;
