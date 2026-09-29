-- =============================================================================
-- 20260929090000_vitrine_theme_v2.sql
-- Vitrine, Fase 5 / etapa 1 (visual premium): tema com mais opções.
--
-- Chaves novas em vitrine_pages.theme (todas viram CSS na página pública,
-- então cada uma tem lista fechada / formato validado aqui):
--   bg_type            solid | gradient | image
--   bg_gradient_to     #RRGGBB (o "de" do gradiente é o background)
--   bg_gradient_angle  0 | 45 | 90 | 135 | 180
--   bg_image_url       https (vitrine-media)
--   bg_overlay         0–80, de 10 em 10 (película sobre a imagem, %)
--   bg_overlay_tone    dark | light
--   font_pair          par pronto título+texto (substitui "font"; páginas
--                      antigas sem font_pair continuam usando "font")
--   button_style       + glass | shadow | minimal
--   shadow             none | soft | strong
--   spacing            compact | normal | relaxed
--   card_style         flat | bordered | elevated
--   logo_shape         circle | rounded
--   animation          none | subtle | lively
--   template           essencial | vibrante | institucional | matriculas
--                      (só registro do modelo aplicado — etapa 4)
-- Chave desconhecida passa a ser recusada.
-- Só muda o trecho do tema; o resto da função é o de 20260929060000.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.vitrine_pages_validate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_theme  JSONB := NEW.theme;
  v_bad    TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.institution_id := OLD.institution_id;
    NEW.created_at     := OLD.created_at;
  END IF;

  NEW.slug := lower(btrim(NEW.slug));
  IF TG_OP = 'INSERT' OR NEW.slug IS DISTINCT FROM OLD.slug THEN
    v_status := public.vitrine_slug_status(NEW.slug, NEW.id);
    IF v_status = 'invalid' THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = 'Endereço inválido: use de 3 a 40 letras minúsculas, números ou hífen (sem acento, sem espaço).';
    ELSIF v_status = 'reserved' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Esse endereço é reservado pelo sistema. Escolha outro.';
    ELSIF v_status = 'taken' THEN
      RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'Esse endereço já está em uso por outra escola.';
    END IF;
  END IF;

  NEW.title := btrim(coalesce(NEW.title, ''));
  IF char_length(NEW.title) > 80 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O título pode ter no máximo 80 caracteres.';
  END IF;
  IF char_length(coalesce(NEW.bio, '')) > 300 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A descrição pode ter no máximo 300 caracteres.';
  END IF;
  IF char_length(coalesce(NEW.seo_description, '')) > 200 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'O texto de compartilhamento pode ter no máximo 200 caracteres.';
  END IF;
  IF NEW.logo_url IS NOT NULL AND NOT public.vitrine_is_https_url(NEW.logo_url) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da logo inválido.';
  END IF;
  IF NEW.cover_url IS NOT NULL AND NOT public.vitrine_is_https_url(NEW.cover_url) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da capa inválido.';
  END IF;

  IF jsonb_typeof(v_theme) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Tema inválido.';
  END IF;
  -- Só chaves conhecidas (tudo aqui vira CSS na página pública).
  SELECT string_agg(k, ', ') INTO v_bad FROM jsonb_object_keys(v_theme) k
   WHERE k NOT IN ('primary','background','text','button_style','radius','font','font_pair',
                   'bg_type','bg_gradient_to','bg_gradient_angle','bg_image_url','bg_overlay','bg_overlay_tone',
                   'shadow','spacing','card_style','logo_shape','animation','template');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de aparência desconhecida: ' || v_bad;
  END IF;
  IF (v_theme ? 'primary'        AND coalesce(v_theme->>'primary', '')        !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'background'     AND coalesce(v_theme->>'background', '')     !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'text'           AND coalesce(v_theme->>'text', '')           !~ '^#[0-9A-Fa-f]{6}$')
  OR (v_theme ? 'bg_gradient_to' AND coalesce(v_theme->>'bg_gradient_to', '') !~ '^#[0-9A-Fa-f]{6}$') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Cor inválida (use o formato #RRGGBB).';
  END IF;
  IF (v_theme ? 'button_style' AND coalesce(v_theme->>'button_style', '') NOT IN ('filled','outline','soft','glass','shadow','minimal')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Estilo de botão inválido.';
  END IF;
  IF (v_theme ? 'radius' AND coalesce(v_theme->>'radius', '') NOT IN ('0','8','16','999')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Arredondamento inválido.';
  END IF;
  -- font: fonte única da primeira versão (páginas antigas); font_pair: pares
  -- prontos (título + texto) da Fase 5 — quando existe, vale ele.
  IF (v_theme ? 'font' AND coalesce(v_theme->>'font', '') NOT IN ('Inter','Poppins','Montserrat','Nunito','Lora','Playfair Display')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Fonte inválida.';
  END IF;
  IF (v_theme ? 'font_pair' AND coalesce(v_theme->>'font_pair', '') NOT IN ('inter','jakarta','poppins','playfair-inter','merriweather-dmsans','fredoka-nunito','montserrat-sourcesans','dmserif-dmsans')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Par de fontes inválido.';
  END IF;
  IF (v_theme ? 'bg_type' AND coalesce(v_theme->>'bg_type', '') NOT IN ('solid','gradient','image'))
  OR (v_theme ? 'bg_gradient_angle' AND coalesce(v_theme->>'bg_gradient_angle', '') NOT IN ('0','45','90','135','180'))
  OR (v_theme ? 'bg_overlay' AND coalesce(v_theme->>'bg_overlay', '') NOT IN ('0','10','20','30','40','50','60','70','80'))
  OR (v_theme ? 'bg_overlay_tone' AND coalesce(v_theme->>'bg_overlay_tone', '') NOT IN ('dark','light')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de fundo inválida.';
  END IF;
  IF v_theme ? 'bg_image_url' AND v_theme->>'bg_image_url' IS NOT NULL
     AND (NOT public.vitrine_is_https_url(v_theme->>'bg_image_url')
          -- vai dentro de url('...') no CSS: sem aspas, parênteses, chaves,
          -- ponto e vírgula nem barra invertida (URL do Storage nunca tem).
          OR v_theme->>'bg_image_url' ~ '["''(){};\\]') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Endereço da imagem de fundo inválido.';
  END IF;
  IF (v_theme ? 'shadow' AND coalesce(v_theme->>'shadow', '') NOT IN ('none','soft','strong'))
  OR (v_theme ? 'spacing' AND coalesce(v_theme->>'spacing', '') NOT IN ('compact','normal','relaxed'))
  OR (v_theme ? 'card_style' AND coalesce(v_theme->>'card_style', '') NOT IN ('flat','bordered','elevated'))
  OR (v_theme ? 'logo_shape' AND coalesce(v_theme->>'logo_shape', '') NOT IN ('circle','rounded'))
  OR (v_theme ? 'animation' AND coalesce(v_theme->>'animation', '') NOT IN ('none','subtle','lively'))
  OR (v_theme ? 'template' AND coalesce(v_theme->>'template', '') NOT IN ('essencial','vibrante','institucional','matriculas')) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Opção de aparência inválida.';
  END IF;

  IF NEW.is_published AND (TG_OP = 'INSERT' OR NOT OLD.is_published) THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;
