CREATE OR REPLACE FUNCTION update_matriculas_batch(
  records jsonb
) RETURNS void AS $$
BEGIN
  UPDATE inep_escolas e
  SET
    qt_mat_total = (r->>'qt_mat_total')::int,
    qt_mat_inf   = (r->>'qt_mat_inf')::int,
    qt_mat_fund  = (r->>'qt_mat_fund')::int,
    qt_mat_med   = (r->>'qt_mat_med')::int
  FROM jsonb_array_elements(records) AS r
  WHERE e.co_entidade = r->>'co_entidade'
    AND e.ano_censo   = (r->>'ano_censo')::int;
END;
$$ LANGUAGE plpgsql;
