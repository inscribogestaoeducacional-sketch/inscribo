-- Create whatsapp-media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  52428800,  -- 50MB
  ARRAY['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: allow all operations on whatsapp-media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_whatsapp_media' AND tablename = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY allow_all_whatsapp_media ON storage.objects
      FOR ALL
      USING (bucket_id = ''whatsapp-media'')
      WITH CHECK (bucket_id = ''whatsapp-media'')';
  END IF;
END $$;
