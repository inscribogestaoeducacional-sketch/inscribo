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
  essay_by_grade: Record<string, { enabled: boolean; prompt: string; images?: string[] }>; form_config: { fields?: Record<string, { label?: string; required?: boolean; enabled?: boolean }> }
  email_auto_confirm: boolean; email_confirmation: { subject?: string; body?: string }
  essay_rubric: { id: string; name: string; max: number }[]; essay_weight: number; scholarship_tiers: { label: string; percent: number }[]
  cover_instructions?: string | null; take_home: { message?: string; image?: string | null; qr_url?: string; qr_label?: string } | null }
export type Essay = { id: string; candidate_id: string; scan_path: string | null; scores: Record<string, number>; total: number | null; max_total: number | null; annulled: boolean; note: string | null }
export type Decision = { id: string; candidate_id: string; scholarship_pct: number | null; status: 'pending' | 'granted' | 'waitlist' | 'denied'; note: string | null }
export type ExtraField = { id: string; label: string; type: 'text' | 'select'; options?: string[]; required?: boolean }
export type Candidate = { id: string; contest_id: string; lead_id: string | null; number: number; student_name: string; grade: string; responsible_name: string; phone: string; email: string | null; origin_school: string | null; answers: Record<string, string>; created_at: string; version: string | null; birth_date: string | null; student_cpf: string | null; room_id?: string | null; present?: boolean | null }
export type Room = { id: string; institution_id: string; contest_id: string; name: string; capacity: number; grade: string | null; position: number }
export const slugify = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
export type Subject = { id: string; contest_id: string; name: string; position: number; grades?: string[] | null }
// grades NULL = disciplina vale para todas as séries do concurso (comportamento antigo).
export const subjectHasGrade = (s: Subject, grade: string, contestGrades: string[] = []) => (s.grades ? s.grades.includes(grade) : contestGrades.length === 0 || contestGrades.includes(grade))
export type Teacher = { id: string; institution_id: string; user_id: string; full_name: string; email: string; phone: string | null; active: boolean; nda_accepted_at?: string | null }
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

export const fmtDate = (s?: string | null) => {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.slice(0, 10)) // data pura: não passa pelo fuso (evita sair 1 dia antes)
  if (m && (s.length === 10 || s.slice(10).startsWith('T00:00:00'))) return `${m[3]}/${m[2]}/${m[1]}`
  return new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Data da prova = dia puro (guardado como meia-noite UTC; nunca passa pelo fuso, senão anda 1 dia).
// Instruções da capa do caderno: uma por linha. Trechos entre chaves viram o valor real na impressão.
export const COVER_TOKENS: [string, string][] = [['{questoes}', 'nº de questões'], ['{versao}', 'versão do caderno'], ['{duracao}', 'duração da prova']]
export const DEFAULT_COVER = [
  'Este caderno tem {questoes} questões objetivas. Confira se a versão {versao} é a mesma do seu cartão-resposta.',
  'Cada questão tem uma única alternativa correta. No cartão-resposta, preencha todo o círculo com caneta azul ou preta.',
  'Não rasure nem dobre o cartão-resposta.',
  'Duração da prova: {duracao}.',
  'Ao terminar, entregue o caderno e o cartão-resposta. Nada pode ser levado.',
  'É proibido o uso de celular, calculadora e qualquer material de consulta.',
].join('\n')
// Nas séries com redação, o sistema acrescenta sozinho esta última instrução.
export const COVER_ESSAY_LINE = 'Esta prova tem redação, com folha de rascunho. Não escreva seu nome na folha de redação e entregue-a junto com o caderno e o cartão-resposta.'

export const examDateToInput = (s?: string | null) => (s ? s.slice(0, 10) : '')
export const examDateFromInput = (v: string) => (v ? `${v}T00:00:00+00:00` : null)
export const examDateLong = (s?: string | null) => {
  if (!s) return ''
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
}
// "Inscrições até" = data e hora no horário de Fortaleza/São Paulo (UTC-3, sem horário de verão).
export const deadlineToInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - 3 * 3600000).toISOString().slice(0, 16) : '')
export const deadlineFromInput = (v: string) => (v ? new Date(`${v}:00-03:00`).toISOString() : null)
export const deadlineLong = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '')

// Redação por série: se a série não tem configuração própria, vale o padrão do concurso.
export function essayFor(c: Contest, grade: string): { enabled: boolean; prompt: string; images: string[] } {
  const g = c.essay_by_grade?.[grade]
  if (g) return { enabled: !!g.enabled, prompt: g.prompt || '', images: g.images ?? [] }
  return { enabled: c.has_essay, prompt: c.essay_prompt || '', images: [] }
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

export const EMAIL_VARS: [string, string][] = [['aluno', 'Nome do aluno'], ['responsavel', 'Responsável'], ['numero', 'Nº da inscrição'], ['serie', 'Série'], ['concurso', 'Nome do concurso'], ['data_prova', 'Data da prova'], ['local', 'Local'], ['duracao', 'Duração'], ['escola', 'Nome da escola'], ['link', 'Link da inscrição'], ['link_resultado', 'Link do resultado']]
export const DEFAULT_CONFIRMATION = {
  subject: 'Inscrição confirmada — {{concurso}}',
  body: 'Olá, {{responsavel}}!\n\nA inscrição de {{aluno}} ({{serie}}) no {{concurso}} foi recebida.\n\nNúmero de inscrição: {{numero}}\nData da prova: {{data_prova}}\nLocal: {{local}}\n\nGuarde este número: ele será pedido no dia da prova. Em breve a escola envia as demais orientações.\n\n{{escola}}',
}

// Nota final (0–100): objetiva + redação (peso configurável) nas séries que têm redação.
export function finalScore(c: Contest, grade: string, r?: { score: number; total: number } | null, e?: Essay | null) {
  const hasEssay = essayFor(c, grade).enabled
  const obj = r && r.total > 0 ? Math.round(1000 * r.score / r.total) / 10 : null
  const essay = e ? (e.annulled ? 0 : e.total != null && (e.max_total ?? 0) > 0 ? Math.round(1000 * e.total / e.max_total!) / 10 : null) : null
  const w = hasEssay ? c.essay_weight : 0
  const final = obj == null ? null : w > 0 ? Math.round(((obj * (100 - w) + (essay ?? 0) * w) / 100) * 10) / 10 : obj
  return { hasEssay, obj, essay, final, pending: obj != null && w > 0 && essay == null }
}

// Termo de confidencialidade que o professor aceita no primeiro acesso ao portal.
export const NDA_VERSION = '1'
export const NDA_TITLE = 'Termo de confidencialidade'
export const NDA_PARAGRAPHS = [
  'As questões, os gabaritos, as propostas de redação e as notas do Concurso de Bolsas são informações confidenciais da escola até a divulgação oficial do resultado.',
  'Ao aceitar este termo, eu me comprometo a: (1) não compartilhar, copiar, fotografar nem divulgar nenhuma questão, alternativa, gabarito ou proposta de redação, por qualquer meio, inclusive aplicativos de mensagem e redes sociais; (2) não usar as questões que escrevi ou corrigi em aulas, listas, simulados ou materiais antes da aplicação da prova; (3) não revelar a candidatos, famílias ou colegas qualquer informação sobre o conteúdo da prova; (4) manter em sigilo a correção das redações e as notas que eu atribuir; (5) usar o acesso somente para a minha função e não repassar meu login e minha senha.',
  'Estou ciente de que meu aceite fica registrado com data e hora, e de que o descumprimento deste termo pode gerar as medidas cabíveis previstas em contrato e na lei.',
]
