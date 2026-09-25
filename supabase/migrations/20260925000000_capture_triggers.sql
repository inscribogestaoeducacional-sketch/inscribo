-- =============================================================================
-- 20260925000000_capture_triggers.sql
-- Módulo "Captação Inteligente" — gatilhos de captação por anúncio/publicação.
--
-- Cada gatilho representa um anúncio (Meta Ads, Google Ads, Instagram orgânico
-- etc.). Quando um lead manda no WhatsApp a mensagem pré-preenchida daquele
-- anúncio (ou chega com `referral.source_id` de um anúncio Meta "Clique para
-- WhatsApp" cadastrado), o webhook (api/whatsapp/webhook.ts) identifica a
-- campanha, marca conversa/contato com a origem e, opcionalmente, pula o bot,
-- manda resposta automática e distribui pra atendentes/grupos (round-robin).
--
-- Modelo inspirado em aion_keywords/aion_keyword_hits/source_keyword_id
-- (20260526000100, 20260811000000), com duas diferenças de propósito:
--   - RLS habilitada (Padrão A) — aqui os dados são por escola, lá era painel
--     interno da Áion sem isolamento.
--   - Sem coluna gerada de link wa.me: o link é montado no frontend com
--     encodeURIComponent (o replace(' ', '%20') de aion_keywords não codifica
--     acento, &, #, quebra de linha) e usa o número atual da escola em
--     whatsapp_phone_numbers, que pode mudar.
--
-- Sem coluna de texto normalizado: não há extensão unaccent no banco
-- (confirmado via pg_extension), e a normalização (minúsculas, sem acento,
-- espaços colapsados) acontece em tempo de match no webhook, sobre poucos
-- gatilhos por escola.
-- =============================================================================

-- ── 1. capture_triggers ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS capture_triggers (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name           TEXT        NOT NULL,
  channel        TEXT        NOT NULL DEFAULT 'meta_ads'
                   CHECK (channel IN ('meta_ads','google_ads','instagram','facebook','tiktok','site','outro')),
  -- Texto pré-preenchido do anúncio. Mínimo de 10 caracteres (decisão da
  -- Fase 1): evita gatilho tipo "oi" casando com qualquer mensagem, já que o
  -- match é por "contém".
  trigger_text   TEXT        NOT NULL CHECK (char_length(btrim(trigger_text)) >= 10),
  -- source_id dos anúncios Meta (referral.source_id no payload do webhook).
  -- Opcional; quando bate, tem prioridade sobre o match por texto.
  meta_ad_ids    TEXT[]      NOT NULL DEFAULT '{}',
  auto_reply     TEXT,
  skip_bot_flow  BOOLEAN     NOT NULL DEFAULT false,
  -- Etiqueta aplicada no contato/conversa/lead (sistema de tags existente,
  -- whatsapp_tags + tags TEXT[]). NULL = usa o próprio name.
  tag_name       TEXT,
  -- Ponteiro do round-robin sobre o pool (atendentes diretos + membros dos
  -- grupos) — mesmo esquema de whatsapp_groups.last_assigned_index.
  rr_index       INTEGER     NOT NULL DEFAULT -1,
  is_active      BOOLEAN     NOT NULL DEFAULT true,
  -- Exclusão lógica: gatilho "excluído" some da listagem mas continua
  -- existindo pro histórico do dashboard (hits/origem de contatos).
  archived_at    TIMESTAMPTZ,
  created_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Alvo da FK composta de capture_trigger_assignees (garante que o
  -- atendente/grupo vinculado pertence à mesma escola do gatilho).
  UNIQUE (id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_capture_triggers_institution_active
  ON capture_triggers(institution_id) WHERE is_active AND archived_at IS NULL;

DROP TRIGGER IF EXISTS update_capture_triggers_updated_at ON capture_triggers;
CREATE TRIGGER update_capture_triggers_updated_at
  BEFORE UPDATE ON capture_triggers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 2. capture_trigger_assignees ─────────────────────────────────────────────
-- Atendentes e/ou grupos (whatsapp_groups) que recebem as conversas do
-- gatilho. Só usados quando skip_bot_flow = true (decisão da Fase 1: com o
-- robô rodando, quem decide a transferência é o próprio fluxo).
CREATE TABLE IF NOT EXISTS capture_trigger_assignees (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  trigger_id     UUID        NOT NULL,
  user_id        UUID        REFERENCES users(id) ON DELETE CASCADE,
  group_id       UUID        REFERENCES whatsapp_groups(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (trigger_id, institution_id)
    REFERENCES capture_triggers(id, institution_id) ON DELETE CASCADE,
  CHECK ((user_id IS NULL) <> (group_id IS NULL)),
  UNIQUE (trigger_id, user_id),
  UNIQUE (trigger_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_capture_trigger_assignees_trigger
  ON capture_trigger_assignees(trigger_id);

-- ── 3. capture_trigger_hits ──────────────────────────────────────────────────
-- Log de TODO match (inclusive repetido, inclusive em conversa já em
-- andamento) — base das métricas de acionamento/volume/primeira resposta.
-- Conversão (lead/matrícula) NÃO sai daqui: usa o primeiro toque em
-- whatsapp_contacts.origin_capture_trigger_id (ver RPC abaixo), pra soma
-- das conversões por campanha nunca passar do total real.
-- Escrito só pelo webhook (service role).
CREATE TABLE IF NOT EXISTS capture_trigger_hits (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id      UUID        NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  trigger_id          UUID        NOT NULL REFERENCES capture_triggers(id) ON DELETE CASCADE,
  conversation_id     UUID        REFERENCES whatsapp_conversations(id) ON DELETE SET NULL,
  contact_id          UUID        REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  remote_jid          TEXT        NOT NULL,
  message_id          TEXT,
  match_type          TEXT        NOT NULL CHECK (match_type IN ('referral','text')),
  -- Objeto referral cru da Meta (source_id, source_url, source_type,
  -- headline, body, ctwa_clid, media_type...), quando veio.
  referral            JSONB,
  -- true = o match abriu um atendimento novo (conversa nova ou reaberta de
  -- closed) e as ações (resposta/pular robô/distribuição) foram avaliadas.
  is_new_conversation BOOLEAN     NOT NULL DEFAULT false,
  bot_skipped         BOOLEAN     NOT NULL DEFAULT false,
  assigned_user_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  matched_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capture_trigger_hits_inst_trigger_time
  ON capture_trigger_hits(institution_id, trigger_id, matched_at);

-- ── 4. Origem na conversa ────────────────────────────────────────────────────
-- capture_trigger_id: último gatilho que abriu um atendimento nessa conversa
-- (badge no inbox). capture_bot_skipped: vale só pro atendimento atual — o
-- webhook volta pra false quando um atendimento novo começa sem gatilho, pra
-- o aviso "Robô não ativado — Captação Inteligente" não ficar pendurado.
ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS capture_trigger_id  UUID REFERENCES capture_triggers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS capture_matched_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS capture_bot_skipped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capture_referral    JSONB;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_capture_trigger
  ON whatsapp_conversations(capture_trigger_id) WHERE capture_trigger_id IS NOT NULL;

-- ── 5. Origem no contato (primeiro toque, permanente) ────────────────────────
-- Nunca sobrescrito — o webhook grava com .is('origin_capture_trigger_id',
-- null) no WHERE, mesmo padrão de source_keyword_id. É a base da métrica de
-- conversão (lead → matrícula) do dashboard e do filtro por origem.
ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS origin_capture_trigger_id UUID REFERENCES capture_triggers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_captured_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_origin_capture
  ON whatsapp_contacts(institution_id, origin_capture_trigger_id, origin_captured_at)
  WHERE origin_capture_trigger_id IS NOT NULL;

-- enrollments não tinha índice em lead_id (confirmado via pg_indexes) — a RPC
-- abaixo faz lookup por lead_id.
CREATE INDEX IF NOT EXISTS idx_enrollments_lead_id
  ON enrollments(lead_id) WHERE lead_id IS NOT NULL;

-- ── 6. RLS — Padrão A ────────────────────────────────────────────────────────
ALTER TABLE capture_triggers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_trigger_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE capture_trigger_hits      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capture_triggers_inst" ON capture_triggers;
CREATE POLICY "capture_triggers_inst" ON capture_triggers
  USING      (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "capture_trigger_assignees_inst" ON capture_trigger_assignees;
CREATE POLICY "capture_trigger_assignees_inst" ON capture_trigger_assignees
  USING      (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()))
  WITH CHECK (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

-- Hits: só leitura pra usuário da escola — escrita exclusiva do webhook
-- (service role ignora RLS). É log de auditoria/métrica, não editável.
DROP POLICY IF EXISTS "capture_trigger_hits_inst_select" ON capture_trigger_hits;
CREATE POLICY "capture_trigger_hits_inst_select" ON capture_trigger_hits
  FOR SELECT
  USING (institution_id IN (SELECT institution_id FROM users WHERE id = auth.uid()));

-- ── 7. RPC de métricas do dashboard ─────────────────────────────────────────
-- SECURITY INVOKER: roda com a RLS de quem chama, então mesmo passando um
-- p_institution_id alheio só enxerga linhas da própria escola.
--
-- Por gatilho (inclui arquivados — o frontend decide se mostra):
--   hits                       acionamentos no período (todo match)
--   conversations              conversas distintas que acionaram no período
--   first_touch_contacts       contatos cujo PRIMEIRO toque foi esse gatilho,
--                              com origin_captured_at no período (coorte)
--   first_touch_leads          desses, quantos viraram lead (lead do contato
--                              ou da conversa — contact.lead_id não é
--                              sincronizado a partir da conversa)
--   first_touch_enrollments    desses leads, quantos matricularam (linha em
--                              enrollments OU leads.status='enrolled' — há
--                              leads enrolled sem linha em enrollments, ver
--                              comentário em GestorHome.tsx), sem limite de
--                              data: é conversão da coorte
--   avg_first_response_seconds média do tempo entre o match que abriu um
--                              atendimento e a 1ª mensagem HUMANA enviada
--                              depois (não usa first_human_response_at, que
--                              é gravado uma vez na vida da conversa)
--   responded_entries          quantos atendimentos entraram na média acima
CREATE OR REPLACE FUNCTION public.capture_trigger_stats(
  p_institution_id UUID,
  p_start          TIMESTAMPTZ,
  p_end            TIMESTAMPTZ
)
RETURNS TABLE (
  trigger_id                 UUID,
  hits                       BIGINT,
  conversations              BIGINT,
  first_touch_contacts       BIGINT,
  first_touch_leads          BIGINT,
  first_touch_enrollments    BIGINT,
  avg_first_response_seconds NUMERIC,
  responded_entries          BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $function$
  WITH hit_agg AS (
    SELECT h.trigger_id,
           count(*)                          AS hits,
           count(DISTINCT h.conversation_id) AS conversations
    FROM capture_trigger_hits h
    WHERE h.institution_id = p_institution_id
      AND h.matched_at >= p_start AND h.matched_at < p_end
    GROUP BY h.trigger_id
  ),
  resp AS (
    SELECT h.trigger_id,
           EXTRACT(EPOCH FROM (fr.ts - h.matched_at)) AS secs
    FROM capture_trigger_hits h
    CROSS JOIN LATERAL (
      SELECT min(m."timestamp") AS ts
      FROM whatsapp_messages m
      WHERE m.institution_id = h.institution_id
        AND m.remote_jid     = h.remote_jid
        AND m.from_me        = true
        AND COALESCE(m.is_bot_message,  false) = false
        AND COALESCE(m.is_history_sync, false) = false
        AND m."timestamp" > h.matched_at
    ) fr
    WHERE h.institution_id = p_institution_id
      AND h.is_new_conversation
      AND h.matched_at >= p_start AND h.matched_at < p_end
      AND fr.ts IS NOT NULL
  ),
  resp_agg AS (
    SELECT r.trigger_id, avg(r.secs) AS avg_secs, count(*) AS responded
    FROM resp r
    GROUP BY r.trigger_id
  ),
  ft AS (
    SELECT ct.origin_capture_trigger_id AS trigger_id,
           ct.id                        AS contact_id,
           l.id                         AS lead_id,
           (l.id IS NOT NULL AND (
              l.status = 'enrolled'
              OR EXISTS (SELECT 1 FROM enrollments e WHERE e.lead_id = l.id)
           ))                           AS enrolled
    FROM whatsapp_contacts ct
    LEFT JOIN whatsapp_conversations cv
      ON cv.institution_id = ct.institution_id AND cv.remote_jid = ct.phone
    LEFT JOIN leads l
      ON l.id = COALESCE(ct.lead_id, cv.lead_id) AND l.deleted_at IS NULL
    WHERE ct.institution_id = p_institution_id
      AND ct.origin_capture_trigger_id IS NOT NULL
      AND ct.origin_captured_at >= p_start AND ct.origin_captured_at < p_end
  ),
  ft_agg AS (
    SELECT ft.trigger_id,
           count(DISTINCT ft.contact_id)                      AS contacts,
           count(DISTINCT ft.lead_id)                         AS leads,
           count(DISTINCT ft.lead_id) FILTER (WHERE ft.enrolled) AS enrollments
    FROM ft
    GROUP BY ft.trigger_id
  )
  SELECT t.id,
         COALESCE(ha.hits, 0),
         COALESCE(ha.conversations, 0),
         COALESCE(fa.contacts, 0),
         COALESCE(fa.leads, 0),
         COALESCE(fa.enrollments, 0),
         ra.avg_secs,
         COALESCE(ra.responded, 0)
  FROM capture_triggers t
  LEFT JOIN hit_agg  ha ON ha.trigger_id = t.id
  LEFT JOIN resp_agg ra ON ra.trigger_id = t.id
  LEFT JOIN ft_agg   fa ON fa.trigger_id = t.id
  WHERE t.institution_id = p_institution_id;
$function$;

GRANT EXECUTE ON FUNCTION public.capture_trigger_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
