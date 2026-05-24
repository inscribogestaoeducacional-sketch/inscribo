CREATE OR REPLACE FUNCTION update_matriculas_batch(
  records jsonb,
  p_ano   int
) RETURNS void AS $$
BEGIN
  UPDATE inep_escolas e
  SET
    qt_mat_total = (elem->>'qt_mat_total')::int,
    qt_mat_inf   = (elem->>'qt_mat_inf')::int,
    qt_mat_fund  = (elem->>'qt_mat_fund')::int,
    qt_mat_med   = (elem->>'qt_mat_med')::int
  FROM jsonb_array_elements(records) AS elem
  WHERE e.co_entidade  = elem->>'co_entidade'
    AND e.ano_censo     = p_ano
    AND e.no_entidade  IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
