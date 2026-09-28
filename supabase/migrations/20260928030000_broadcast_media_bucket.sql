-- Transmissões — imagem/vídeo no cabeçalho do template da escola.
--
-- A mídia do cabeçalho tem dois usos na Meta:
--   1. exemplo pra aprovação: o servidor (submit_school_template) baixa o
--      arquivo daqui e sobe pela Resumable Upload API (App ID) → header_handle;
--   2. envio: cada mensagem manda o link público do arquivo no componente
--      header (a Meta busca o link na hora) — por isso o bucket é público.
-- O arquivo sobe direto do navegador pra cá (vídeo de até 16 MB não passa
-- pelo limite de corpo das funções da Vercel). Caminho:
-- <institution_id>/<uuid>.<ext> — nome aleatório, uma pasta por escola.
--
-- Limites da Meta (docs Cloud API, conferidos em 2026-09-28):
--   imagem JPEG/PNG até 5 MB; vídeo MP4 (H.264 + AAC) até 16 MB.
-- O bucket trava no maior (16 MB) e nos tipos; o limite de 5 MB da imagem e
-- a checagem do conteúdo real (bytes iniciais) ficam no servidor, no envio
-- pra Meta — o navegador só antecipa o aviso.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('broadcast-media', 'broadcast-media', true, 16777216,
        ARRAY['image/jpeg', 'image/png', 'video/mp4'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Pasta da escola a partir do caminho (NULL se não for um uuid).
CREATE OR REPLACE FUNCTION public.broadcast_media_institution(p_name TEXT)
RETURNS UUID
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN split_part(p_name, '/', 1)::uuid END
$$;

-- Escrita: só quem gerencia Transmissões na escola, com o módulo liberado,
-- e só na pasta da própria escola. O arquivo em si é servido pela URL
-- pública do bucket (não passa por RLS); a policy de SELECT só governa a
-- LISTAGEM via API — restrita à pasta da escola, pra ninguém enumerar os
-- arquivos das outras.
DROP POLICY IF EXISTS broadcast_media_school_insert ON storage.objects;
CREATE POLICY broadcast_media_school_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'broadcast-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.broadcast_user_can_manage(public.broadcast_media_institution(name))
    AND EXISTS (SELECT 1 FROM public.broadcast_settings s
                WHERE s.institution_id = public.broadcast_media_institution(name) AND s.enabled)
  );

DROP POLICY IF EXISTS broadcast_media_school_delete ON storage.objects;
CREATE POLICY broadcast_media_school_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'broadcast-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.broadcast_user_can_manage(public.broadcast_media_institution(name))
  );

DROP POLICY IF EXISTS broadcast_media_school_read ON storage.objects;
CREATE POLICY broadcast_media_school_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'broadcast-media'
    AND public.broadcast_media_institution(name) IS NOT NULL
    AND public.broadcast_user_can_manage(public.broadcast_media_institution(name))
  );
