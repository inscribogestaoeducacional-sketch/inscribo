-- ============================================================================
-- 20261014120000_aditivo_lgpd_aceite.sql — Etapa C: aceite do aditivo LGPD na tela.
-- NÃO APLICADA. Ensaio: supabase/pendentes/aditivo_lgpd_ensaio.sql.
--
--   * lgpd_text_versions: versões PUBLICADAS do texto (versão + SHA-256 do
--     arquivo public/legal/aditivo-lgpd-<versão>.md). Só se aceita versão
--     publicada; a v1 entra quando o texto final aprovado estiver no repositório.
--   * lgpd_acceptances: registro imutável de cada aceite/liberação/revogação —
--     escola, usuário, data/hora, versão, hash, IP e navegador.
--   * base_accept_lgpd: "Li e aceito", só admin da escola (não gestor, não
--     atendente, não Super Admin). Liga student_base_settings.names_allowed —
--     a mesma chave que o Super Admin liga à mão.
--   * base_set_names_allowed (Super Admin, manual) passa a registrar também.
-- Nomes NÃO são reidratados: voltam só na próxima planilha com "Guardar nomes"
-- marcada ou na próxima carga do Activesoft.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.lgpd_text_versions (
  version       text PRIMARY KEY CHECK (version ~ '^v[0-9]+$'),
  text_sha256   text NOT NULL CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  published_at  timestamptz NOT NULL DEFAULT now(),
  notes         text
);
ALTER TABLE public.lgpd_text_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_text_versions FROM anon;
DROP POLICY IF EXISTS lgpd_text_versions_select ON public.lgpd_text_versions;
CREATE POLICY lgpd_text_versions_select ON public.lgpd_text_versions FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.lgpd_text_versions TO authenticated;

CREATE TABLE IF NOT EXISTS public.lgpd_acceptances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  action         text NOT NULL CHECK (action IN ('aceite', 'liberado_manual', 'revogado')),
  user_id        uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_name      text,
  user_role      text,
  text_version   text REFERENCES public.lgpd_text_versions(version),
  text_sha256    text,
  ip             text,
  user_agent     text,
  note           text,
  -- dados da escola e de quem aceitou, como estavam no aceite (o texto é um modelo
  -- com campos {{escola_*}} preenchidos pelo sistema; o hash é o do modelo)
  school_name         text,
  school_cnpj         text,
  school_address      text,
  representative_name text,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lgpd_acceptances_inst ON public.lgpd_acceptances (institution_id, created_at DESC);
ALTER TABLE public.lgpd_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lgpd_acceptances FROM anon, authenticated;
GRANT SELECT ON public.lgpd_acceptances TO authenticated;
DROP POLICY IF EXISTS lgpd_acceptances_select ON public.lgpd_acceptances;
CREATE POLICY lgpd_acceptances_select ON public.lgpd_acceptances FOR SELECT TO authenticated
  USING (base_user_can_read(institution_id));            -- admin/gestor da escola e Super Admin

-- só inserção (mesmo padrão de student_status_events)
CREATE OR REPLACE FUNCTION public.lgpd_acceptances_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'lgpd_acceptances é somente-inserção (% bloqueado)', TG_OP;
END $$;
DROP TRIGGER IF EXISTS trg_lgpd_acceptances_immutable ON public.lgpd_acceptances;
CREATE TRIGGER trg_lgpd_acceptances_immutable BEFORE UPDATE OR DELETE ON public.lgpd_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.lgpd_acceptances_immutable();

-- IP e navegador de quem chamou (cabeçalhos repassados pelo PostgREST)
CREATE OR REPLACE FUNCTION public.request_client_ip()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(btrim(COALESCE(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(h->>'x-forwarded-for', ',', 1))), '')
    FROM (SELECT NULLIF(current_setting('request.headers', true), '')::json AS h) x
$$;
CREATE OR REPLACE FUNCTION public.request_user_agent()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT left((NULLIF(current_setting('request.headers', true), '')::json)->>'user-agent', 300)
$$;

-- Versão em vigor (a publicada mais recente) — a tela pergunta isto
CREATE OR REPLACE FUNCTION public.base_lgpd_status(p_institution_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN NOT (user_is_school_member(p_institution_id) OR is_super_admin_user()) THEN NULL ELSE jsonb_build_object(
    'names_allowed', COALESCE((SELECT names_allowed FROM student_base_settings WHERE institution_id = p_institution_id), false),
    'current_version', (SELECT version FROM lgpd_text_versions ORDER BY published_at DESC LIMIT 1),
    'current_sha256', (SELECT text_sha256 FROM lgpd_text_versions ORDER BY published_at DESC LIMIT 1),
    'last', (SELECT jsonb_build_object('action', action, 'user_name', user_name, 'created_at', created_at, 'text_version', text_version)
               FROM lgpd_acceptances WHERE institution_id = p_institution_id ORDER BY created_at DESC LIMIT 1),
    'can_accept', EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND COALESCE(u.active, true) AND u.role = 'admin'
                            AND COALESCE(u.user_type, '') <> 'admin_geral'
                            AND p_institution_id IN (u.institution_id, u.active_institution_id))
  ) END
$$;
REVOKE ALL ON FUNCTION public.base_lgpd_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_lgpd_status(uuid) TO authenticated;

-- "Li e aceito": só admin da escola, versão publicada e texto com o mesmo hash
CREATE OR REPLACE FUNCTION public.base_accept_lgpd(p_institution_id uuid, p_version text, p_text_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE u record; v_id uuid;
BEGIN
  SELECT id, full_name, role INTO u FROM users
   WHERE id = auth.uid() AND COALESCE(active, true) AND role = 'admin'
     AND COALESCE(user_type, '') <> 'admin_geral'          -- Super Admin usa a chave manual
     AND p_institution_id IN (institution_id, active_institution_id);
  IF u.id IS NULL THEN
    RAISE EXCEPTION 'Só o administrador da escola aceita o aditivo' USING ERRCODE = '42501';
  END IF;
  PERFORM base_require_module(p_institution_id);
  IF NOT EXISTS (SELECT 1 FROM lgpd_text_versions WHERE version = p_version AND text_sha256 = lower(p_text_sha256)) THEN
    RAISE EXCEPTION 'Versão do aditivo não publicada ou texto diferente do aprovado' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO lgpd_acceptances (institution_id, action, user_id, user_name, user_role, text_version, text_sha256, ip, user_agent,
                                school_name, school_cnpj, school_address, representative_name)
  SELECT p_institution_id, 'aceite', u.id, u.full_name, u.role, p_version, lower(p_text_sha256), request_client_ip(), request_user_agent(),
         i.name, i.cnpj, concat_ws(', ', NULLIF(i.address, ''), NULLIF(i.city, ''), NULLIF(i.state, '')), u.full_name
    FROM institutions i WHERE i.id = p_institution_id
  RETURNING id INTO v_id;

  INSERT INTO student_base_settings (institution_id, names_allowed, updated_by, updated_at)
  VALUES (p_institution_id, true, u.id, now())
  ON CONFLICT (institution_id) DO UPDATE SET names_allowed = true, updated_by = u.id, updated_at = now();

  INSERT INTO audit_logs (institution_id, module, record_id, action, field_changed, new_value, user_id, user_name, user_role)
  VALUES (p_institution_id, 'integracoes', v_id, 'Aditivo LGPD aceito na tela', 'names_allowed', 'true (' || p_version || ')', u.id, u.full_name, u.role);
  RETURN jsonb_build_object('id', v_id, 'version', p_version);
END $$;
REVOKE ALL ON FUNCTION public.base_accept_lgpd(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.base_accept_lgpd(uuid, text, text) TO authenticated;

-- Super Admin à mão (contrato assinado no Autentique): agora também registra
CREATE OR REPLACE FUNCTION public.base_set_names_allowed(p_institution_id uuid, p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT is_super_admin_user() THEN RAISE EXCEPTION 'Só o Super Admin registra o aditivo da LGPD' USING ERRCODE = '42501'; END IF;
  INSERT INTO student_base_settings (institution_id, names_allowed, updated_by, updated_at)
  VALUES (p_institution_id, p_allowed, auth.uid(), now())
  ON CONFLICT (institution_id) DO UPDATE SET names_allowed = EXCLUDED.names_allowed, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO lgpd_acceptances (institution_id, action, user_id, user_name, user_role, ip, user_agent, note)
  SELECT p_institution_id, CASE WHEN p_allowed THEN 'liberado_manual' ELSE 'revogado' END, u.id, u.full_name, 'super_admin',
         request_client_ip(), request_user_agent(),
         CASE WHEN p_allowed THEN 'Liberado pelo Super Admin (aditivo assinado fora da tela)' ELSE 'Revogado pelo Super Admin' END
    FROM users u WHERE u.id = auth.uid();
  INSERT INTO audit_logs (institution_id, module, record_id, action, field_changed, new_value, user_id, user_name, user_role)
  SELECT p_institution_id, 'integracoes', p_institution_id, 'Aditivo LGPD (nomes da base)', 'names_allowed', p_allowed::text, u.id, u.full_name, u.role
    FROM users u WHERE u.id = auth.uid();
END $$;
