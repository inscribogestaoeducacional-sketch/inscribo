-- 20261008150000_proposals_acesso_publico_por_token.sql
--
-- Brecha ALTO: a policy proposals_anon_view (SELECT, anon, USING true)
-- deixava qualquer anônimo listar TODAS as propostas comerciais (nome,
-- e-mail e telefone do prospect, valores). A página pública /proposta/:token
-- só precisa da proposta daquele token.
--
-- Agora anon não acessa a tabela; a página usa duas funções que exigem o
-- view_token exato (UUID):
--   proposal_public_view(token)     devolve a proposta (sem ids internos) e
--                                   registra a visualização
--   proposal_public_feedback(token, aceitou)  grava aceite/recusa
-- Efeito colateral bom: o registro de visualização e o aceitar/recusar feitos
-- pela página nunca gravavam (anon não tinha UPDATE); agora gravam.
-- Parte 2 (retirar o acesso anônimo à tabela) fica em 20261008150100, aplicada
-- depois do front novo estar no ar.
-- Policies de admin_geral e consultores não mudam. Nenhum dado é alterado.
CREATE OR REPLACE FUNCTION public.proposal_public_view(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v proposals%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN NULL; END IF;

  UPDATE proposals p
  SET view_count      = COALESCE(p.view_count, 0) + 1,
      first_viewed_at = COALESCE(p.first_viewed_at, now()),
      last_viewed_at  = now(),
      status          = CASE WHEN p.status IN ('sent', 'delivered') THEN 'opened' ELSE p.status END
  WHERE p.view_token = p_token
  RETURNING p.* INTO v;

  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN to_jsonb(v) - 'lead_id' - 'consultant_id' - 'institution_id';
END;
$function$;

CREATE OR REPLACE FUNCTION public.proposal_public_feedback(p_token text, p_accepted boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_token IS NULL OR length(p_token) < 20 THEN RETURN false; END IF;
  UPDATE proposals
  SET status = CASE WHEN p_accepted THEN 'accepted' ELSE 'rejected' END,
      updated_at = now()
  WHERE view_token = p_token AND status <> 'draft';
  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.proposal_public_view(text), public.proposal_public_feedback(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proposal_public_view(text), public.proposal_public_feedback(text, boolean) TO anon, authenticated;
