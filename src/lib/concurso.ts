// Concurso de Bolsas — tipos e textos compartilhados (coordenação e portal do professor).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const db: any = supabase

export const GRADES = [
  'Infantil 3', 'Infantil 4', 'Infantil 5',
  '1º ano', '2º ano', '3º ano', '4º ano', '5º ano', '6º ano', '7º ano', '8º ano', '9º ano',
  '1ª série EM', '2ª série EM', '3ª série EM',
]
export const DEFAULT_SUBJECTS = ['Língua Portuguesa', 'Matemática', 'Ciências', 'História', 'Geografia']
export const LETTERS = ['A', 'B', 'C', 'D', 'E']

export type Contest = { id: string; institution_id: string; name: string; year: number; status: 'draft' | 'open' | 'closed' | 'published'; exam_date: string | null; grades: string[]; alternatives_count: 4 | 5; versions_count: number; has_essay: boolean
  public_slug: string | null; edital: string | null; location: string | null; registration_deadline: string | null; extra_fields: ExtraField[]; essay_prompt: string | null; exam_duration: string | null; print_color: string | null
  essay_by_grade: Record<string, { enabled: boolean; prompt: string }>; form_config: { fields?: Record<string, { label?: string; required?: boolean; enabled?: boolean }> }
  email_auto_confirm: boolean; email_confirmation: { subject?: string; body?: string } }
export type ExtraField = { id: string; label: string; type: 'text' | 'select'; options?: string[]; required?: boolean }
export type Candidate = { id: string; contest_id: string; lead_id: string | null; number: number; student_name: string; grade: string; responsible_name: string; phone: string; email: string | null; origin_school: string | null; answers: Record<string, string>; created_at: string; version: string | null; birth_date: string | null; student_cpf: string | null }
export const slugify = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
export type Subject = { id: string; contest_id: string; name: string; position: number }
export type Teacher = { id: string; institution_id: string; user_id: string; full_name: string; email: string; phone: string | null; active: boolean }
export type Quota = { id: string; contest_id: string; teacher_id: string; subject_id: string; grade: string; quantity: number; due_date: string | null }
export type Alt = { text: string; image?: string | null }
export type Question = {
  id: string; contest_id: string; quota_id: string | null; subject_id: string; grade: string; author_teacher_id: string | null
  statement: string; statement_images: string[]; alternatives: Alt[]; correct_index: number | null
  difficulty: 'facil' | 'media' | 'dificil' | null; comment: string | null; no_shuffle: boolean
  status: 'draft' | 'sent' | 'returned' | 'approved'; review_note: string | null; updated_at: string
  position: number; in_exam: boolean
}

export const CONTEST_STATUS: Record<string, string> = { draft: 'Em preparação', open: 'Inscrições abertas', closed: 'Encerrado', published: 'Resultado divulgado' }
export const Q_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  draft: { label: 'Rascunho', bg: '#F1F5F9', fg: '#475569' },
  sent: { label: 'Enviada', bg: '#DBEAFE', fg: '#1D4ED8' },
  returned: { label: 'Devolvida', bg: '#FEF3C7', fg: '#B45309' },
  approved: { label: 'Aprovada', bg: '#D1FAE5', fg: '#047857' },
}

export function useConcursoModuleEnabled(institutionId: string | null | undefined): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  useEffect(() => {
    if (!institutionId) { setEnabled(false); return }
    let alive = true
    setEnabled(null)
    db.from('contest_settings').select('module_enabled').eq('institution_id', institutionId).maybeSingle()
      .then(({ data }: any) => { if (alive) setEnabled(data?.module_enabled === true) })
    return () => { alive = false }
  }, [institutionId])
  return enabled
}

export const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

// Redação por série: se a série não tem configuração própria, vale o padrão do concurso.
export function essayFor(c: Contest, grade: string): { enabled: boolean; prompt: string } {
  const g = c.essay_by_grade?.[grade]
  if (g) return { enabled: !!g.enabled, prompt: g.prompt || '' }
  return { enabled: c.has_essay, prompt: c.essay_prompt || '' }
}

// Perguntas fixas da inscrição. "locked": a coordenação edita o texto, mas não pode desligar nem tornar opcional.
export const FORM_FIELDS = [
  { key: 'student_name', label: 'Nome completo do aluno', locked: true },
  { key: 'grade', label: 'Série em 2027', locked: true },
  { key: 'birth_date', label: 'Data de nascimento do aluno', locked: false },
  { key: 'student_cpf', label: 'CPF do aluno', locked: false },
  { key: 'responsible_name', label: 'Nome do responsável', locked: true },
  { key: 'phone', label: 'WhatsApp do responsável', locked: true },
  { key: 'email', label: 'E-mail do responsável', locked: false },
  { key: 'origin_school', label: 'Escola onde estuda hoje', locked: false },
] as const
export function fieldCfg(fc: Contest['form_config'] | undefined, key: string) {
  const d = FORM_FIELDS.find(f => f.key === key)!; const c = fc?.fields?.[key] ?? {}
  return { label: c.label?.trim() || d.label, required: d.locked ? true : c.required !== false, enabled: d.locked ? true : c.enabled !== false }
}

export const EMAIL_VARS: [string, string][] = [['aluno', 'Nome do aluno'], ['responsavel', 'Responsável'], ['numero', 'Nº da inscrição'], ['serie', 'Série'], ['concurso', 'Nome do concurso'], ['data_prova', 'Data da prova'], ['local', 'Local'], ['duracao', 'Duração'], ['escola', 'Nome da escola'], ['link', 'Link da inscrição']]
export const DEFAULT_CONFIRMATION = {
  subject: 'Inscrição confirmada — {{concurso}}',
  body: 'Olá, {{responsavel}}!\n\nA inscrição de {{aluno}} ({{serie}}) no {{concurso}} foi recebida.\n\nNúmero de inscrição: {{numero}}\nData da prova: {{data_prova}}\nLocal: {{local}}\n\nGuarde este número: ele será pedido no dia da prova. Em breve a escola envia as demais orientações.\n\n{{escola}}',
}
