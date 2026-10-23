-- Contatos: "Relação com a escola" (um cartão por contato, rolando de ano), vindo da Base de alunos.
-- Aplicado no banco em 2026-10-23 (ver base_sync_contacts, contact_school_card, filtro "relations" em broadcast_resolve_audience,
-- e a chamada de base_sync_contacts ao fim de base_erp_apply). Colunas auto_* de erp_connections também.
ALTER TABLE public.erp_connections
  ADD COLUMN IF NOT EXISTS auto_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_last_ping timestamptz,
  ADD COLUMN IF NOT EXISTS auto_last_full_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_state text;
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS school_relation text,
  ADD COLUMN IF NOT EXISTS school_relation_year int,
  ADD COLUMN IF NOT EXISTS school_relation_label text,
  ADD COLUMN IF NOT EXISTS school_relation_at timestamptz;
CREATE INDEX IF NOT EXISTS whatsapp_contacts_relation_idx ON public.whatsapp_contacts (institution_id, school_relation) WHERE school_relation IS NOT NULL;
-- Funções: ver o banco (pg_get_functiondef) — contacts_campaign_year, base_sync_contacts, contact_school_card.
