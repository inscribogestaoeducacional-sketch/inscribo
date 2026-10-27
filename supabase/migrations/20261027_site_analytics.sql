-- Estatística própria do site público (aionedu.com.br): visitas, páginas, origem, tempo na página e cliques no WhatsApp.
-- Sem cookie de terceiros: o navegador guarda só um código anônimo. Leitura só do super admin.
CREATE TABLE IF NOT EXISTS site_visits (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id  text NOT NULL,
  session_id  text NOT NULL,
  path        text NOT NULL,
  referrer    text,
  ref_host    text,
  utm_source  text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  device      text, browser text, os text, tz text, lang text,
  screen_w    int,
  duration_s  int NOT NULL DEFAULT 0,
  max_scroll  int NOT NULL DEFAULT 0,
  is_new      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_visits_created_idx ON site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_visitor_idx ON site_visits (visitor_id);

CREATE TABLE IF NOT EXISTS site_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id  text NOT NULL,
  session_id  text NOT NULL,
  kind        text NOT NULL,           -- wa_click | raiox_click | outros
  path        text,
  code        text,                    -- código curto que vai na mensagem do WhatsApp
  ref_host    text, utm_source text, utm_campaign text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS site_events_created_idx ON site_events (created_at DESC);
CREATE INDEX IF NOT EXISTS site_events_code_idx ON site_events (code);

ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_visits_admin ON site_visits;
CREATE POLICY site_visits_admin ON site_visits FOR SELECT USING (is_super_admin_user());
DROP POLICY IF EXISTS site_events_admin ON site_events;
CREATE POLICY site_events_admin ON site_events FOR SELECT USING (is_super_admin_user());
REVOKE ALL ON site_visits, site_events FROM anon, authenticated;
GRANT SELECT ON site_visits, site_events TO authenticated;

-- Registra a visita (anônimo). Devolve o id para o ping de tempo.
CREATE OR REPLACE FUNCTION site_hit(p jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v uuid; t text := left(coalesce(p->>'path','/'), 200);
BEGIN
  IF coalesce(p->>'visitor_id','') = '' OR coalesce(p->>'session_id','') = '' THEN RETURN NULL; END IF;
  INSERT INTO site_visits (visitor_id, session_id, path, referrer, ref_host, utm_source, utm_medium, utm_campaign, utm_content, utm_term, device, browser, os, tz, lang, screen_w, is_new)
  VALUES (left(p->>'visitor_id',40), left(p->>'session_id',40), t, left(p->>'referrer',300), left(p->>'ref_host',120),
          left(p->>'utm_source',80), left(p->>'utm_medium',80), left(p->>'utm_campaign',120), left(p->>'utm_content',120), left(p->>'utm_term',120),
          left(p->>'device',20), left(p->>'browser',30), left(p->>'os',30), left(p->>'tz',60), left(p->>'lang',20),
          nullif(p->>'screen_w','')::int, coalesce((p->>'is_new')::boolean,false))
  RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION site_ping(p_id uuid, p_dur int, p_scroll int) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE site_visits SET duration_s = greatest(duration_s, least(coalesce(p_dur,0), 3600)),
                         max_scroll = greatest(max_scroll, least(coalesce(p_scroll,0), 100))
  WHERE id = p_id AND created_at > now() - interval '1 day';
$$;

CREATE OR REPLACE FUNCTION site_event(p jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO site_events (visitor_id, session_id, kind, path, code, ref_host, utm_source, utm_campaign)
  SELECT left(p->>'visitor_id',40), left(p->>'session_id',40), left(coalesce(p->>'kind','outros'),30), left(p->>'path',200),
         left(p->>'code',20), left(p->>'ref_host',120), left(p->>'utm_source',80), left(p->>'utm_campaign',120)
  WHERE coalesce(p->>'visitor_id','') <> '';
$$;
GRANT EXECUTE ON FUNCTION site_hit(jsonb), site_ping(uuid,int,int), site_event(jsonb) TO anon, authenticated;

-- Resumo para a aba "Site" do Super Admin.
CREATE OR REPLACE FUNCTION site_stats(p_days int DEFAULT 30) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d timestamptz := now() - make_interval(days => greatest(1, least(p_days, 365))); r jsonb;
BEGIN
  IF NOT is_super_admin_user() THEN RAISE EXCEPTION 'sem permissão'; END IF;
  SELECT jsonb_build_object(
    'visitors',   (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= d),
    'new_visitors', (SELECT count(DISTINCT visitor_id) FROM site_visits WHERE created_at >= d AND is_new),
    'sessions',   (SELECT count(DISTINCT session_id) FROM site_visits WHERE created_at >= d),
    'pageviews',  (SELECT count(*) FROM site_visits WHERE created_at >= d),
    'avg_seconds',(SELECT coalesce(round(avg(nullif(duration_s,0))),0) FROM site_visits WHERE created_at >= d),
    'wa_clicks',  (SELECT count(*) FROM site_events WHERE created_at >= d AND kind='wa_click'),
    'wa_people',  (SELECT count(DISTINCT visitor_id) FROM site_events WHERE created_at >= d AND kind='wa_click'),
    'raiox_clicks',(SELECT count(*) FROM site_events WHERE created_at >= d AND kind='raiox_click'),
    'daily', (SELECT coalesce(jsonb_agg(x ORDER BY x->>'day'),'[]') FROM (
        SELECT jsonb_build_object('day', to_char(dd,'YYYY-MM-DD'), 'visitors', count(DISTINCT visitor_id), 'views', count(*)) x
        FROM (SELECT date_trunc('day', created_at AT TIME ZONE 'America/Fortaleza') dd, visitor_id FROM site_visits WHERE created_at >= d) s GROUP BY dd) a),
    'pages', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
        SELECT jsonb_build_object('path', path, 'views', count(*), 'visitors', count(DISTINCT visitor_id),
               'avg_seconds', round(avg(nullif(duration_s,0))), 'avg_scroll', round(avg(max_scroll))) x
        FROM site_visits WHERE created_at >= d GROUP BY path ORDER BY count(*) DESC LIMIT 25) a),
    'origins', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
        SELECT jsonb_build_object('origin', o, 'medium', m, 'visitors', count(DISTINCT visitor_id), 'views', count(*)) x
        FROM (SELECT coalesce(nullif(utm_source,''), nullif(ref_host,''), 'Direto') o, coalesce(utm_medium,'') m, visitor_id
              FROM site_visits WHERE created_at >= d) s GROUP BY o, m ORDER BY count(DISTINCT visitor_id) DESC LIMIT 20) a),
    'devices', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
        SELECT jsonb_build_object('device', coalesce(device,'?'), 'visitors', count(DISTINCT visitor_id)) x
        FROM site_visits WHERE created_at >= d GROUP BY device) a),
    'places', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
        SELECT jsonb_build_object('tz', coalesce(tz,'?'), 'visitors', count(DISTINCT visitor_id)) x
        FROM site_visits WHERE created_at >= d GROUP BY tz ORDER BY count(DISTINCT visitor_id) DESC LIMIT 10) a),
    'wa', (SELECT coalesce(jsonb_agg(x),'[]') FROM (
        SELECT jsonb_build_object('at', created_at, 'path', path, 'code', code, 'origin', coalesce(nullif(utm_source,''), nullif(ref_host,''), 'Direto'), 'campaign', utm_campaign) x
        FROM site_events WHERE kind='wa_click' AND created_at >= d ORDER BY created_at DESC LIMIT 50) a)
  ) INTO r;
  RETURN r;
END $$;
GRANT EXECUTE ON FUNCTION site_stats(int) TO authenticated;
