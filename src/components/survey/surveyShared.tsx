import React from 'react'
import { Star, List, AlignLeft, Gauge } from 'lucide-react'
import type { SurveyQuestionData, SurveyQuestionType } from './SurveyQuestion'

// ─── tipos ──────────────────────────────────────────────────
export interface Survey {
  id: string
  institution_id: string
  title: string
  description: string | null
  require_identification: boolean
  status: 'draft' | 'active' | 'closed'
  survey_token: string
  created_by: string | null
  created_at: string
  closed_at: string | null
  response_count: number
  survey_mode: 'default' | 'custom'
  redirect_url: string | null
  ai_analysis: AiReport | null
  ai_analysis_generated_at: string | null
}

export interface QuestionRow extends SurveyQuestionData {
  survey_id: string
  institution_id: string
  order_index: number
}

export interface SurveyResponse {
  id: string
  survey_id: string
  institution_id: string
  respondent_name: string | null
  respondent_grade: string | null
  answers: Record<string, number | string>
  custom_answers: Record<string, number | string> | null
  ai_analysis: Record<string, unknown> | null
  created_at: string
}

export interface AiReport {
  overall_score: number
  summary: string
  strengths: string[]
  weaknesses: string[]
  reenrollment_risk: string
  reenrollment_analysis: string
  priority_actions: string[]
  retention_opportunities: string
}

// ─── utils ──────────────────────────────────────────────────
export function fmt(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function avg(nums: number[]) {
  const valid = nums.filter(n => typeof n === 'number' && !isNaN(n))
  return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0
}

export function scaleToTen(val: number) {
  return Math.round(((val - 1) / 4) * 10 * 10) / 10
}

// Nota geral (0–10) de UM respondente, a partir das 5 categorias fixas do
// modo default. Usado tanto pra ordenar a tabela quanto pra exibir na linha.
export function respondentOverallScore10(r: SurveyResponse): number {
  const a = r.answers || {}
  const nums = [a.general, a.teaching, a.communication, a.infrastructure, a.cost_benefit]
    .filter((v): v is number => typeof v === 'number')
  return nums.length > 0 ? scaleToTen(avg(nums)) : 0
}

// NPS clássico (%promotores − %detratores) a partir de notas 0–10.
// Serve tanto pra "nota geral" do modo default (reaproveitada como proxy de
// NPS, já que o modo default não tem uma pergunta 0–10 nativa) quanto pra
// perguntas do tipo `nps` no modo custom (que já são 0–10 de verdade).
export function npsFromScores(scores: number[]): number {
  if (scores.length === 0) return 0
  const promoters  = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  return Math.round(((promoters - detractors) / scores.length) * 100)
}

export type ReenrollBucket = 'sim' | 'nao' | 'talvez'

export function reenrollBucket(value: string | undefined | null): ReenrollBucket | null {
  if (!value) return null
  if (value === 'Com certeza vou rematricular' || value === 'Provavelmente sim') return 'sim'
  if (value === 'Não vou rematricular' || value === 'Provavelmente não') return 'nao'
  if (value === 'Ainda não decidi') return 'talvez'
  return null
}

export function reenrollmentBreakdown(responses: SurveyResponse[]) {
  const buckets = responses.map(r => reenrollBucket(r.answers?.reenrollment as string | undefined)).filter((b): b is ReenrollBucket => b !== null)
  const total = buckets.length
  const pct = (b: ReenrollBucket) => total > 0 ? Math.round((buckets.filter(x => x === b).length / total) * 100) : 0
  return { total, yesPct: pct('sim'), noPct: pct('nao'), maybePct: pct('talvez') }
}

export const REENROLL_BADGE_STYLE: Record<ReenrollBucket, { bg: string; color: string }> = {
  sim:    { bg: '#D1FAE5', color: '#065F46' },
  nao:    { bg: '#FEE2E2', color: '#991B1B' },
  talvez: { bg: '#FEF3C7', color: '#92400E' },
}

export function ReenrollmentBadge({ value }: { value: string | undefined | null }) {
  const bucket = reenrollBucket(value)
  if (!bucket) return <span style={{ color: '#CBD5E1' }}>—</span>
  const s = REENROLL_BADGE_STYLE[bucket]
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

// Default do filtro de período: da criação da pesquisa até hoje — assim o
// gestor vê TODAS as respostas ao abrir o painel, não só uma janela recente.
export function defaultDateRange(createdAt: string) {
  const to = new Date()
  const from = new Date(createdAt)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}

export const REENROLL_OPTIONS = [
  'Com certeza vou rematricular',
  'Provavelmente sim',
  'Ainda não decidi',
  'Provavelmente não',
  'Não vou rematricular',
]

export const PIE_COLORS = ['#10B981', '#6EE7B7', '#FCD34D', '#F97316', '#EF4444']

// ─── segmentos ──────────────────────────────────────────────
// Não existe coluna dedicada de segmento no banco — é derivado do texto
// livre de respondent_grade por palavra-chave. Cada escola nomeia suas
// séries de um jeito diferente, então este é o único lugar a ajustar caso
// apareça uma nomenclatura que não caia em nenhum padrão abaixo.
export const SEGMENT_OPTIONS = ['Infantil', 'Fundamental I', 'Fundamental II', 'Médio', 'EJA'] as const
export type Segment = typeof SEGMENT_OPTIONS[number]

export const SEGMENT_KEYWORDS: Record<Segment, RegExp> = {
  'Infantil':       /berç|matern|jardim|infantil|\bpr[eé]\b/i,
  'Fundamental I':  /fund(amental)?\s*i\b(?!i)|\b[1-5]º?\s*ano\b/i,
  'Fundamental II': /fund(amental)?\s*ii\b|\b[6-9]º?\s*ano\b/i,
  'Médio':          /m[eé]dio/i,
  'EJA':            /\beja\b/i,
}

export function inferSegment(grade: string | null | undefined): Segment | null {
  if (!grade) return null
  for (const seg of SEGMENT_OPTIONS) {
    if (SEGMENT_KEYWORDS[seg].test(grade)) return seg
  }
  return null
}

// Séries efetivamente usadas no filtro server-side: se há seleção explícita
// no multi-select, usa ela; senão, se um segmento está escolhido, usa todas
// as séries daquele segmento; senão, não filtra por série.
export function effectiveGradeFilter(selectedGrades: string[], segment: Segment | '', allGrades: string[]): string[] {
  if (selectedGrades.length > 0) return selectedGrades
  if (segment) return allGrades.filter(g => inferSegment(g) === segment)
  return []
}

export const QUESTION_TYPES: { type: SurveyQuestionType; label: string; icon: typeof Star }[] = [
  { type: 'scale', label: 'Escala (1 a 5)', icon: Star },
  { type: 'nps', label: 'NPS (0 a 10)', icon: Gauge },
  { type: 'multiple_choice', label: 'Múltipla escolha', icon: List },
  { type: 'text', label: 'Texto livre', icon: AlignLeft },
]

export function emptyQuestionForm(): { title: string; description: string; question_type: SurveyQuestionType; required: boolean; min_label: string; max_label: string; options: string[] } {
  return { title: '', description: '', question_type: 'scale', required: true, min_label: '', max_label: '', options: ['', ''] }
}

// ─── estilos ─────────────────────────────────────────────────
export const card: React.CSSProperties = {
  background: '#fff', borderRadius: 18, padding: 20,
  border: '1px solid #E3E8F0', boxShadow: '0 1px 2px rgba(26,43,74,.04)',
}
export const cardCompact: React.CSSProperties = { ...card, padding: 16 }

export const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#5B6B86', marginBottom: 6, display: 'block',
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 12px', borderRadius: 12, minHeight: 44,
  border: '1.5px solid #E3E8F0', fontSize: 14, color: '#1A2B4A', fontFamily: 'inherit',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}

export const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#1A2B4A', margin: 0 }
