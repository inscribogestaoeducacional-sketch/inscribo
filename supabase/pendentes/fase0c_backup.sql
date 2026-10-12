-- Fase 0C — backup antes da migration + backfill (rodar imediatamente antes).
-- Guarda as linhas inteiras de campaign_cycles e as colunas de leads que o
-- backfill pode mudar, em dedup_backup_rows (run_tag fase0c_<data>).
-- Desfazer: restaurar campaign_cycle_id / year_interest / lost_reason /
-- lost_reason_detail dos leads e label dos ciclos a partir destas linhas.
INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
SELECT 'fase0c_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD'), 'campaign_cycles', c.id::text, to_jsonb(c)
FROM campaign_cycles c;

INSERT INTO dedup_backup_rows (run_tag, table_name, row_id, row_data)
SELECT 'fase0c_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD'), 'leads', l.id::text,
       jsonb_build_object('id', l.id, 'institution_id', l.institution_id, 'campaign_cycle_id', l.campaign_cycle_id,
                          'year_interest', l.year_interest, 'status', l.status, 'lost_reason', l.lost_reason,
                          'lost_reason_detail', l.lost_reason_detail, 'created_at', l.created_at)
FROM leads l;

SELECT table_name, count(*) FROM dedup_backup_rows
 WHERE run_tag = 'fase0c_' || to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYYMMDD') GROUP BY 1;
