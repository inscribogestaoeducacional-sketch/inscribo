-- Aluno matriculado ↔ lead. A Campanha casava só pelo telefone do responsável no sistema da escola;
-- quando o lead tem o telefone de outro familiar, o aluno aparecia como "sem lead" mesmo com lead matriculado.
-- Agora: vínculo manual (ou sugerido por nome+série) guardado aqui, "não é lead" também.
CREATE TABLE IF NOT EXISTS public.student_lead_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('linked','dismissed')),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, student_id)
);
ALTER TABLE public.student_lead_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sll_select ON public.student_lead_links;
CREATE POLICY sll_select ON public.student_lead_links FOR SELECT TO authenticated
  USING (is_super_admin_user() OR institution_id = get_my_institution_id());

CREATE OR REPLACE FUNCTION public.campaign_enrollments_without_lead(p_inst uuid, p_year integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF NOT (base_is_system() OR base_user_can_see_list(p_inst)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  WITH nov AS (
    SELECT DISTINCT ON (s.id) s.id, s.full_name, g.name AS grade
      FROM students s
      JOIN class_enrollments e ON e.student_id = s.id AND e.academic_year = p_year AND e.status = 'ativo'
      LEFT JOIN school_grade_levels g ON g.id = e.grade_level_id
     WHERE s.institution_id = p_inst AND COALESCE(s.first_year, p_year) = p_year
     ORDER BY s.id
  ), ph AS (
    SELECT n.id, n.full_name, n.grade,
           array_remove(array_agg(DISTINCT right(gd.phone_norm, 11)), NULL) AS keys,
           (array_agg(gd.full_name ORDER BY gd.full_name))[1] AS guardian
      FROM nov n
      LEFT JOIN student_guardians sg ON sg.student_id = n.id
      LEFT JOIN guardians gd ON gd.id = sg.guardian_id AND gd.phone_norm IS NOT NULL
     GROUP BY n.id, n.full_name, n.grade
  ), sem AS (
    SELECT p.* FROM ph p
     WHERE NOT EXISTS (SELECT 1 FROM student_lead_links k WHERE k.institution_id = p_inst AND k.student_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.institution_id = p_inst AND l.deleted_at IS NULL
                        AND right(regexp_replace(coalesce(l.phone,''), '\D', '', 'g'), 11) = ANY(p.keys))
  ), enr AS (
    SELECT s.*,
      (SELECT jsonb_build_object('lead_id', l.id, 'name', l.student_name, 'status', l.status, 'phone', l.phone)
         FROM leads l
        WHERE l.institution_id = p_inst AND l.deleted_at IS NULL
          AND lower(split_part(unaccent(trim(l.student_name)), ' ', 1)) = lower(split_part(unaccent(trim(s.full_name)), ' ', 1))
          AND (l.grade_interest IS NULL OR l.grade_interest IN ('Não informado','') OR l.grade_interest = s.grade)
          AND NOT EXISTS (SELECT 1 FROM student_lead_links k2 WHERE k2.lead_id = l.id)
        ORDER BY (l.status = 'enrolled') DESC, (l.grade_interest = s.grade) DESC, l.created_at DESC LIMIT 1) AS suggestion,
      (SELECT jsonb_build_object('id', c.id, 'name', c.contact_name, 'lead_id', c.lead_id)
         FROM whatsapp_conversations c
        WHERE c.institution_id = p_inst AND right(regexp_replace(c.remote_jid, '\D', '', 'g'), 11) = ANY(s.keys)
        ORDER BY c.last_message_at DESC NULLS LAST LIMIT 1) AS conversation
      FROM sem s
  )
  SELECT jsonb_build_object('year', p_year, 'novos_matriculados', (SELECT count(*) FROM nov), 'sem_lead', (SELECT count(*) FROM sem),
    'lista', COALESCE((SELECT jsonb_agg(jsonb_build_object('student_id', id, 'student', full_name, 'grade', grade, 'guardian', guardian,
         'phone', keys[1], 'suggestion', suggestion, 'conversation', conversation) ORDER BY full_name)
         FROM (SELECT * FROM enr ORDER BY full_name LIMIT 100) x), '[]'::jsonb))
  INTO r;
  RETURN r;
END $$;

-- Ação sobre um aluno: 'link' (vincula a um lead; p_mark marca o lead como matriculado), 'create' (cria o lead já matriculado),
-- 'dismiss' (não é lead) ou 'unlink' (desfaz).
CREATE OR REPLACE FUNCTION public.student_lead_action(p_inst uuid, p_student uuid, p_action text, p_lead uuid DEFAULT NULL, p_mark boolean DEFAULT false, p_year integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record; g record; new_id uuid; yr int;
BEGIN
  IF NOT (base_is_system() OR base_user_can_see_list(p_inst)) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  SELECT st.id, st.full_name INTO s FROM students st WHERE st.id = p_student AND st.institution_id = p_inst;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Aluno não encontrado'; END IF;
  IF p_action = 'link' THEN
    IF p_lead IS NULL OR NOT EXISTS (SELECT 1 FROM leads WHERE id = p_lead AND institution_id = p_inst) THEN RAISE EXCEPTION 'Lead inválido'; END IF;
    INSERT INTO student_lead_links (institution_id, student_id, lead_id, status) VALUES (p_inst, p_student, p_lead, 'linked')
      ON CONFLICT (institution_id, student_id) DO UPDATE SET lead_id = EXCLUDED.lead_id, status = 'linked';
    IF p_mark THEN UPDATE leads SET status = 'enrolled', updated_at = now() WHERE id = p_lead AND status <> 'enrolled'; END IF;
    RETURN jsonb_build_object('ok', true, 'lead_id', p_lead);
  ELSIF p_action = 'dismiss' THEN
    INSERT INTO student_lead_links (institution_id, student_id, lead_id, status) VALUES (p_inst, p_student, NULL, 'dismissed')
      ON CONFLICT (institution_id, student_id) DO UPDATE SET lead_id = NULL, status = 'dismissed';
    RETURN jsonb_build_object('ok', true);
  ELSIF p_action = 'unlink' THEN
    DELETE FROM student_lead_links WHERE institution_id = p_inst AND student_id = p_student;
    RETURN jsonb_build_object('ok', true);
  ELSIF p_action = 'create' THEN
    yr := COALESCE(p_year, (SELECT max(academic_year) FROM class_enrollments WHERE student_id = p_student AND status = 'ativo'));
    SELECT gd.full_name AS name, gd.phone_norm AS phone INTO g
      FROM student_guardians sg JOIN guardians gd ON gd.id = sg.guardian_id
     WHERE sg.student_id = p_student AND gd.phone_norm IS NOT NULL ORDER BY gd.full_name LIMIT 1;
    INSERT INTO leads (institution_id, student_name, responsible_name, phone, grade_interest, year_interest, source, status, notes)
      VALUES (p_inst, s.full_name, g.name, g.phone,
              (SELECT gl.name FROM class_enrollments e JOIN school_grade_levels gl ON gl.id = e.grade_level_id WHERE e.student_id = p_student AND e.academic_year = yr AND e.status = 'ativo' LIMIT 1),
              yr, 'Matrícula direta', 'enrolled', 'Criado a partir do aluno matriculado no sistema da escola (sem lead anterior).')
      RETURNING id INTO new_id;
    INSERT INTO student_lead_links (institution_id, student_id, lead_id, status) VALUES (p_inst, p_student, new_id, 'linked')
      ON CONFLICT (institution_id, student_id) DO UPDATE SET lead_id = EXCLUDED.lead_id, status = 'linked';
    RETURN jsonb_build_object('ok', true, 'lead_id', new_id);
  END IF;
  RAISE EXCEPTION 'Ação inválida';
END $$;
REVOKE ALL ON FUNCTION public.student_lead_action(uuid, uuid, text, uuid, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_lead_action(uuid, uuid, text, uuid, boolean, integer) TO authenticated;
NOTIFY pgrst, 'reload schema';
