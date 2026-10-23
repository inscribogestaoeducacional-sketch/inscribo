-- Base de alunos: guarda a data de efetivação da matrícula e o campo "novato" que a Activesoft informa,
-- e deixa o sistema (cron/serviço) rodar a integração sem usuário logado.

CREATE OR REPLACE FUNCTION public.base_is_system() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT session_user IN ('postgres', 'supabase_admin', 'service_role') $$;

CREATE OR REPLACE FUNCTION public.base_parse_date(t text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR btrim(t) = '' THEN RETURN NULL; END IF;
  IF t ~ '^\d{4}-\d{2}-\d{2}' THEN RETURN substring(t from 1 for 10)::date; END IF;
  IF t ~ '^\d{2}/\d{2}/\d{4}' THEN RETURN to_date(substring(t from 1 for 10), 'DD/MM/YYYY'); END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.base_parse_bool(t text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(btrim(COALESCE(t, '')))
    WHEN 'true' THEN true WHEN 't' THEN true WHEN '1' THEN true WHEN 'sim' THEN true WHEN 's' THEN true
    WHEN 'false' THEN false WHEN 'f' THEN false WHEN '0' THEN false WHEN 'nao' THEN false WHEN 'não' THEN false WHEN 'n' THEN false
    ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public.base_erp_require_admin(p_institution_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF base_is_system() THEN RETURN; END IF;
  IF NOT base_user_is_admin(p_institution_id) THEN
    RAISE EXCEPTION 'Só o administrador da escola mexe na integração' USING ERRCODE = '42501';
  END IF;
  PERFORM base_require_module(p_institution_id);
END $$;

DO $mig$
DECLARE d text;
BEGIN
  -- linhas da Activesoft levam efetivação e novato
  d := pg_get_functiondef('public.base_erp_rows(uuid,uuid)'::regprocedure);
  IF position($$'ano', f.ano,$$ in d) = 0 THEN RAISE EXCEPTION 'base_erp_rows mudou'; END IF;
  d := replace(d, $$'ano', f.ano,$$, $$'ano', f.ano, 'efetivacao', f.ent->>'efetivacao', 'novato', f.ent->>'novato',$$);
  EXECUTE d;

  d := pg_get_functiondef('public.base_import_rows(uuid,integer,jsonb,boolean,text,text,uuid)'::regprocedure);
  IF position($$source, status_changed_at)$$ in d) = 0 OR position($$btrim(r->>'situacao'), p_source, now());$$ in d) = 0
     OR position($$      ELSE
        -- divergência entre fontes$$ in d) = 0 THEN RAISE EXCEPTION 'base_import_rows mudou'; END IF;
  d := replace(d, $$source, status_changed_at)$$, $$source, status_changed_at, enrolled_at, is_new_student)$$);
  d := replace(d, $$btrim(r->>'situacao'), p_source, now());$$,
    $$btrim(r->>'situacao'), p_source, now(), base_parse_date(r->>'efetivacao'), base_parse_bool(r->>'novato'));$$);
  d := replace(d, $$      ELSE
        -- divergência entre fontes$$, $$      ELSE
        UPDATE class_enrollments SET
               enrolled_at    = COALESCE(base_parse_date(r->>'efetivacao'), enrolled_at),
               is_new_student = COALESCE(base_parse_bool(r->>'novato'), is_new_student)
         WHERE id = v_enr.id
           AND (enrolled_at IS DISTINCT FROM COALESCE(base_parse_date(r->>'efetivacao'), enrolled_at)
             OR is_new_student IS DISTINCT FROM COALESCE(base_parse_bool(r->>'novato'), is_new_student));
        -- divergência entre fontes$$);
  EXECUTE d;
END $mig$;
