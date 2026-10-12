-- =============================================================================
-- 20261012150100_normalize_phone_br_so_celular.sql
-- Fase B, item 5: normalize_phone_br põe o 9º dígito SÓ em celular (primeiro
-- dígito local 6–9). Fixo (2–5) fica com 12 dígitos (55 + DDD + 8). Mesma
-- regra de src/lib/phone.ts, api/whatsapp/webhook.ts e send.ts desde 905a84b.
-- Rascunho anterior: supabase/pendentes/normalize_phone_br_so_celular.sql.
-- Aprovada pelo Victor em 12/10/2026 depois do ensaio.
--
-- whatsapp_conversations.base_jid e whatsapp_messages.base_jid são colunas
-- GERADAS (whatsapp_base_jid → normalize_phone_br). Trocar a função não
-- recalcula as linhas gravadas; por isso a migration regrava remote_jid
-- (sem mudar o valor) só nas linhas cujo base_jid muda, e o RLS de
-- mensagens, que casa por base_jid, continua vendo conversa e mensagens
-- juntas.
--
-- Ensaio de 12/10 (desfeito): mudam 8 conversas e 66 mensagens, TODAS de
-- telefone fixo (base_jid de 13 com 9 inventado → 12). 0 celulares, 0 pares
-- novos, status/dono/lead/robô iguais. O UPDATE das conversas dispara
-- sync_contact_from_conversation; sem o passo dos contatos abaixo ele criaria
-- 5 contatos duplicados (com ele: 0).
-- =============================================================================

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

-- Contato gravado com o 9 inventado (13) e sem o de 12: corrige o telefone
-- (e o nome, quando o nome é o próprio número antigo) ANTES do recálculo,
-- pra o gatilho sync_contact_from_conversation achar o contato e não criar outro.
UPDATE public.whatsapp_contacts w
   SET phone = public.whatsapp_base_jid(c.remote_jid),
       name  = CASE WHEN w.name = w.phone THEN public.whatsapp_base_jid(c.remote_jid) ELSE w.name END
  FROM public.whatsapp_conversations c
 WHERE c.base_jid IS DISTINCT FROM public.whatsapp_base_jid(c.remote_jid)
   AND w.institution_id = c.institution_id
   AND w.phone = c.base_jid
   AND NOT EXISTS (SELECT 1 FROM public.whatsapp_contacts w2
                    WHERE w2.institution_id = c.institution_id
                      AND w2.phone = public.whatsapp_base_jid(c.remote_jid));

-- Recalcula o base_jid gerado só onde ele muda (fixos).
UPDATE public.whatsapp_messages
   SET remote_jid = remote_jid
 WHERE base_jid IS DISTINCT FROM public.whatsapp_base_jid(remote_jid);

UPDATE public.whatsapp_conversations
   SET remote_jid = remote_jid
 WHERE base_jid IS DISTINCT FROM public.whatsapp_base_jid(remote_jid);
