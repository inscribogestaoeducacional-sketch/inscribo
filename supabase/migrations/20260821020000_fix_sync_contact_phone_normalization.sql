-- =============================================================================
-- 20260821020000_fix_sync_contact_phone_normalization.sql
-- Corrige a causa raiz da duplicação de linhas em whatsapp_contacts (425
-- grupos / 850 linhas confirmadas em auditoria anterior — mesmo telefone em
-- formatos diferentes, ex: 12 dígitos sem o 9º vs 13 dígitos já normalizado).
--
-- CAUSA RAIZ confirmada: sync_contact_from_conversation() (dispara via
-- trg_sync_contact / trg_sync_contact_from_conversation, ambos AFTER INSERT
-- OR UPDATE em whatsapp_conversations — dois triggers idênticos, redundantes
-- mas não é o que causa a duplicata, só faz o upsert rodar 2x) gravava
-- v_phone := SPLIT_PART(NEW.remote_jid, '@', 1) cru, sem normalizar, e usava
-- esse valor cru como parte do ON CONFLICT (institution_id, phone). Uma
-- conversa chegando em formato antigo (sem o 9º dígito) nunca colidia com um
-- contato já existente em formato novo — criava linha nova em vez de
-- atualizar.
--
-- Correção: normaliza v_phone com normalize_phone_br() (já existente desde
-- 20260521000002_normalize_phones_br.sql — mesma função usada pra normalizar
-- os dados existentes de whatsapp_contacts/leads naquela migration) ANTES do
-- insert/upsert, garantindo que o valor usado como chave de conflito seja
-- sempre o canônico (55 + DDD + 9 + 8 dígitos), igual ao resto do sistema.
--
-- NÃO mescla/atualiza linhas já duplicadas existentes — só estanca a criação
-- de duplicatas novas. O relatório dos 425 grupos existentes é entregue à
-- parte, sem alterar nenhuma linha de whatsapp_contacts.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_contact_from_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_phone TEXT;
BEGIN
  -- Conversas do Inbox Áion não pertencem a nenhuma instituição — não criar
  -- "contato de escola" para elas (lead do CRM já é tratado via aion_lead_id).
  IF NEW.institution_id IS NULL OR COALESCE(NEW.is_aion_inbox, false) = true THEN
    RETURN NEW;
  END IF;

  -- Skip WhatsApp groups
  IF NEW.remote_jid LIKE '%@g.us' THEN
    RETURN NEW;
  END IF;

  -- Normaliza pro formato canônico (55 + DDD + 9 + 8 dígitos) ANTES de
  -- qualquer uso — é isso que garante que o ON CONFLICT abaixo encontre o
  -- contato certo independente de o remote_jid ter vindo com ou sem o 9º
  -- dígito.
  v_phone := normalize_phone_br(SPLIT_PART(NEW.remote_jid, '@', 1));

  -- Skip if no valid phone
  IF v_phone IS NULL OR v_phone = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO whatsapp_contacts (institution_id, phone, name, type, last_seen_at, created_at)
  VALUES (
    NEW.institution_id,
    v_phone,
    COALESCE(NEW.contact_name, v_phone),
    'unknown',
    COALESCE(NEW.last_message_at, NOW()),
    NOW()
  )
  ON CONFLICT (institution_id, phone) DO UPDATE
    SET
      name         = COALESCE(EXCLUDED.name, whatsapp_contacts.name),
      last_seen_at = GREATEST(EXCLUDED.last_seen_at, whatsapp_contacts.last_seen_at);

  RETURN NEW;
END;
$function$;
