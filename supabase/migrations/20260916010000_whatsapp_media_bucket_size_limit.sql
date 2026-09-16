-- =============================================================================
-- 20260916010000_whatsapp_media_bucket_size_limit.sql
-- O bucket whatsapp-media (20260316000000_whatsapp_storage.sql) foi criado
-- com file_size_limit de 50MB. Documentos agora podem ter até 100MB (teto
-- real da Meta Cloud API, ver api/whatsapp/media-upload-url.ts e
-- src/components/whatsapp/WhatsAppHub.tsx) — sem esse ajuste, o próprio
-- Supabase Storage rejeitaria o upload de um documento entre 50MB e 100MB
-- mesmo com o app já validando corretamente esse tamanho como permitido.
-- =============================================================================

UPDATE storage.buckets
SET file_size_limit = 104857600 -- 100MB — o maior dos quatro tetos por tipo (documento)
WHERE id = 'whatsapp-media';
