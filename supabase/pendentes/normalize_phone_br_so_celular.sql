-- RASCUNHO — NÃO está em supabase/migrations de propósito (db push ignora esta
-- pasta). Vira migration no item 5 da Fase B, junto com o recálculo do
-- base_jid das linhas de telefone fixo, depois do ok.
--
-- normalize_phone_br: 9º dígito só em celular (primeiro dígito local 6–9).
-- Fixo (2–5) fica com 12 dígitos (55 + DDD + 8). Mesma regra de
-- src/lib/phone.ts, api/whatsapp/webhook.ts e api/whatsapp/send.ts.
--
-- Por que não pode ir sozinha: whatsapp_conversations.base_jid e
-- whatsapp_messages.base_jid são colunas GERADAS a partir desta função. Trocar
-- a função não recalcula as linhas existentes — só as novas/alteradas. Uma
-- conversa de fixo antiga ficaria com base_jid "13 dígitos" e as mensagens
-- novas com "12", e o RLS de mensagens (que casa por base_jid) esconderia o
-- histórico do atendente restrito. O recálculo (UPDATE ... SET remote_jid =
-- remote_jid nas linhas de fixo) vai na mesma migration.

CREATE OR REPLACE FUNCTION public.normalize_phone_br(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  digits TEXT;
BEGIN
  digits := regexp_replace(p, '[^0-9]', '', 'g');

  -- Remove o 55 quando o total é 12 ou 13 dígitos
  IF length(digits) IN (12, 13) AND left(digits, 2) = '55' THEN
    digits := substring(digits from 3);
  END IF;

  -- 10 dígitos (DDD + 8): só celular (local começando com 6–9) ganha o 9
  IF length(digits) = 10 AND substring(digits from 3 for 1) BETWEEN '6' AND '9' THEN
    digits := left(digits, 2) || '9' || substring(digits from 3);
  END IF;

  -- 11 (celular) ou 10 (fixo) dígitos: prefixa 55
  IF length(digits) IN (10, 11) THEN
    RETURN '55' || digits;
  END IF;

  RETURN regexp_replace(p, '[^0-9]', '', 'g');
END;
$function$;
