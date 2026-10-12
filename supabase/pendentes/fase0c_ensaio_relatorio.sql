-- Fase 0C — ENSAIO, parte final: relatório antes × depois por escola e RAISE
-- (desfaz tudo). Testa também os gatilhos com inserts de mentira.
DO $$
DECLARE
  r      record;
  v_out  text := '';
  v_inst uuid;
  v_id   uuid;
  v_kind text;
  v_year int;
  v_cyc  uuid;
  v_ok   boolean;
BEGIN
  -- Ciclos
  v_out := v_out || E'\n== CICLOS (antes → depois)';
  FOR r IN
    SELECT i.name, a.label AS antes, c.label AS depois, a.year, c.campaign_year, c.target_school_year, c.status, c.start_date, c.end_date
    FROM campaign_cycles c JOIN _antes_ciclos a ON a.id = c.id JOIN institutions i ON i.id = c.institution_id ORDER BY i.name, c.start_date
  LOOP
    v_out := v_out || format(E'\n%s | %s → %s | year=%s campanha=%s alvo=%s | %s %s→%s', r.name, r.antes, r.depois, r.year, r.campaign_year, r.target_school_year, r.status, r.start_date, r.end_date);
  END LOOP;

  -- Leads por escola
  v_out := v_out || E'\n== LEADS POR ESCOLA (não excluídos): com ciclo antes → depois [campanha / herdado / sem ciclo] | ano alvo preenchido antes → depois | perdidos com motivo antes → depois';
  FOR r IN
    SELECT i.name,
      count(*) FILTER (WHERE a.campaign_cycle_id IS NOT NULL) ciclo_antes,
      count(*) FILTER (WHERE l.campaign_cycle_id IS NOT NULL) ciclo_depois,
      count(*) FILTER (WHERE l.cycle_link_kind = 'campanha') campanha,
      count(*) FILTER (WHERE l.cycle_link_kind = 'herdado') herdado,
      count(*) FILTER (WHERE l.campaign_cycle_id IS NULL) sem,
      count(*) FILTER (WHERE a.year_interest IS NOT NULL) ano_antes,
      count(*) FILTER (WHERE l.year_interest IS NOT NULL) ano_depois,
      string_agg(DISTINCT l.year_interest::text, ',') anos,
      count(*) FILTER (WHERE a.status = 'lost' AND NULLIF(btrim(COALESCE(a.lost_reason, '')), '') IS NOT NULL) perd_mot_antes,
      count(*) FILTER (WHERE l.status = 'lost' AND NULLIF(btrim(COALESCE(l.lost_reason, '')), '') IS NOT NULL) perd_mot_depois,
      count(*) FILTER (WHERE l.status = 'lost') perdidos
    FROM leads l JOIN _antes_leads a ON a.id = l.id JOIN institutions i ON i.id = l.institution_id
    WHERE l.deleted_at IS NULL GROUP BY i.name ORDER BY i.name
  LOOP
    v_out := v_out || format(E'\n%s | ciclo %s → %s [%s / %s / %s] | ano alvo %s → %s (%s) | perdidos c/ motivo %s → %s de %s',
      r.name, r.ciclo_antes, r.ciclo_depois, r.campanha, r.herdado, r.sem, r.ano_antes, r.ano_depois, COALESCE(r.anos, '-'), r.perd_mot_antes, r.perd_mot_depois, r.perdidos);
  END LOOP;

  -- Leads da campanha por mês (só 'campanha'), antes (vinculados) × depois
  v_out := v_out || E'\n== LEADS DA CAMPANHA POR MÊS (antes = vinculados ao ciclo; depois = cycle_link_kind campanha)';
  FOR r IN
    SELECT i.name, to_char(l.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') mes,
      count(*) FILTER (WHERE a.campaign_cycle_id IS NOT NULL) antes,
      count(*) FILTER (WHERE l.cycle_link_kind = 'campanha') depois,
      count(*) FILTER (WHERE l.cycle_link_kind = 'herdado') herdado
    FROM leads l JOIN _antes_leads a ON a.id = l.id JOIN institutions i ON i.id = l.institution_id
    WHERE l.deleted_at IS NULL AND (a.campaign_cycle_id IS NOT NULL OR l.campaign_cycle_id IS NOT NULL)
    GROUP BY 1, 2 ORDER BY 1, 2
  LOOP
    v_out := v_out || format(E'\n%s | %s | antes %s → campanha %s (+ herdado %s)', r.name, r.mes, r.antes, r.depois, r.herdado);
  END LOOP;

  -- funnel_metrics não pode mudar (cadastros contam por data de criação)
  SELECT count(*) INTO v_year FROM funnel_metrics f JOIN _antes_funil a USING (institution_id, period)
   WHERE (f.registrations, f.schedules, f.visits, f.enrollments) IS DISTINCT FROM (a.registrations, a.schedules, a.visits, a.enrollments);
  v_out := v_out || format(E'\n== funnel_metrics: %s linhas mudaram (esperado 0)', v_year);

  -- Regra do perdido validada?
  SELECT convalidated INTO v_ok FROM pg_constraint WHERE conname = 'leads_lost_requires_reason';
  v_out := v_out || format(E'\n== leads_lost_requires_reason validada: %s', v_ok);

  -- ── Testes dos gatilhos (desfeitos junto) ─────────────────────────────────
  SELECT id INTO v_inst FROM institutions WHERE name = 'Colégio Ágape Patos';
  INSERT INTO leads (institution_id, student_name, responsible_name, phone, grade_interest, source, status)
  VALUES (v_inst, 'ENSAIO 0C', 'ENSAIO 0C', '5583900000000', '1º Ano', 'WhatsApp', 'new')
  RETURNING id, campaign_cycle_id, cycle_link_kind, year_interest INTO v_id, v_cyc, v_kind, v_year;
  v_out := v_out || format(E'\n== TESTE lead novo (Ágape, robô/WhatsApp): ciclo=%s tipo=%s ano=%s', left(v_cyc::text, 8), v_kind, v_year);

  BEGIN
    UPDATE leads SET status = 'lost' WHERE id = v_id;
    v_out := v_out || E'\n== TESTE perdido SEM motivo: ACEITO (ERRO!)';
  EXCEPTION WHEN check_violation THEN
    v_out := v_out || E'\n== TESTE perdido SEM motivo: recusado (ok)';
  END;
  UPDATE leads SET status = 'lost', lost_reason = 'preco_alto' WHERE id = v_id;
  v_out := v_out || E'\n== TESTE perdido COM motivo: aceito (ok)';

  SELECT id INTO v_inst FROM institutions WHERE name = 'Colégio Universo Uno';
  INSERT INTO leads (institution_id, student_name, responsible_name, phone, grade_interest, source, status)
  VALUES (v_inst, 'ENSAIO 0C', 'ENSAIO 0C', '5583900000001', '1º Ano', 'Vitrine', 'new')
  RETURNING campaign_cycle_id, cycle_link_kind, year_interest INTO v_cyc, v_kind, v_year;
  v_out := v_out || format(E'\n== TESTE lead novo (Universo Uno, sem ciclo ativo): ciclo=%s tipo=%s ano=%s', COALESCE(left(v_cyc::text, 8), 'nenhum'), COALESCE(v_kind, '-'), COALESCE(v_year::text, '-'));

  RAISE EXCEPTION E'ENSAIO 0C (desfeito):%', v_out;
END $$;
