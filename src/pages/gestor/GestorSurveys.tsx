import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  ClipboardList, Plus, Copy, Eye, Brain, X, Check, AlertTriangle,
  MoreVertical, Star, Users, TrendingUp, BarChart3, StopCircle,
  Hash, AlignLeft, List, GripVertical, ExternalLink, Send, Pencil, Trash2,
  Sparkles, Gauge,
} from 'lucide-react'
import {
  DndContext, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SurveyQuestion, { SurveyQuestionData, SurveyQuestionType } from '../../components/survey/SurveyQuestion'

// ─── tipos ──────────────────────────────────────────────────
interface Survey {
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

interface QuestionRow extends SurveyQuestionData {
  survey_id: string
  institution_id: string
  order_index: number
}

interface SurveyResponse {
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

interface AiReport {
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
function fmt(date: string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function avg(nums: number[]) {
  const valid = nums.filter(n => typeof n === 'number' && !isNaN(n))
  return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : 0
}

function scaleToTen(val: number) {
  return Math.round(((val - 1) / 4) * 10 * 10) / 10
}

// Nota geral (0–10) de UM respondente, a partir das 5 categorias fixas do
// modo default. Usado tanto pra ordenar a tabela quanto pra exibir na linha.
function respondentOverallScore10(r: SurveyResponse): number {
  const a = r.answers || {}
  const nums = [a.general, a.teaching, a.communication, a.infrastructure, a.cost_benefit]
    .filter((v): v is number => typeof v === 'number')
  return nums.length > 0 ? scaleToTen(avg(nums)) : 0
}

// NPS clássico (%promotores − %detratores) a partir de notas 0–10.
// Serve tanto pra "nota geral" do modo default (reaproveitada como proxy de
// NPS, já que o modo default não tem uma pergunta 0–10 nativa) quanto pra
// perguntas do tipo `nps` no modo custom (que já são 0–10 de verdade).
function npsFromScores(scores: number[]): number {
  if (scores.length === 0) return 0
  const promoters  = scores.filter(s => s >= 9).length
  const detractors = scores.filter(s => s <= 6).length
  return Math.round(((promoters - detractors) / scores.length) * 100)
}

type ReenrollBucket = 'sim' | 'nao' | 'talvez'

function reenrollBucket(value: string | undefined | null): ReenrollBucket | null {
  if (!value) return null
  if (value === 'Com certeza vou rematricular' || value === 'Provavelmente sim') return 'sim'
  if (value === 'Não vou rematricular' || value === 'Provavelmente não') return 'nao'
  if (value === 'Ainda não decidi') return 'talvez'
  return null
}

function reenrollmentBreakdown(responses: SurveyResponse[]) {
  const buckets = responses.map(r => reenrollBucket(r.answers?.reenrollment as string | undefined)).filter((b): b is ReenrollBucket => b !== null)
  const total = buckets.length
  const pct = (b: ReenrollBucket) => total > 0 ? Math.round((buckets.filter(x => x === b).length / total) * 100) : 0
  return { total, yesPct: pct('sim'), noPct: pct('nao'), maybePct: pct('talvez') }
}

const REENROLL_BADGE_STYLE: Record<ReenrollBucket, { bg: string; color: string }> = {
  sim:    { bg: '#D1FAE5', color: '#065F46' },
  nao:    { bg: '#FEE2E2', color: '#991B1B' },
  talvez: { bg: '#FEF3C7', color: '#92400E' },
}

function ReenrollmentBadge({ value }: { value: string | undefined | null }) {
  const bucket = reenrollBucket(value)
  if (!bucket) return <span style={{ color: '#CBD5E1' }}>—</span>
  const s = REENROLL_BADGE_STYLE[bucket]
  return (
    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {value}
    </span>
  )
}

// ─── pills de filtro rápido por rematrícula (aba "Respostas") ─────────
const REENROLL_PILL_ACCENT: Record<'' | ReenrollBucket, string> = {
  '':      '#00A896',
  sim:     '#10B981',
  talvez:  '#F59E0B',
  nao:     '#EF4444',
}

function ReenrollmentPills({ value, counts, onChange }: {
  value: '' | ReenrollBucket
  counts: { total: number; sim: number; nao: number; talvez: number }
  onChange: (v: '' | ReenrollBucket) => void
}) {
  const options: { key: '' | ReenrollBucket; label: string; count: number }[] = [
    { key: '',       label: 'Todos',            count: counts.total },
    { key: 'sim',    label: '✅ Vai renovar',     count: counts.sim },
    { key: 'talvez', label: '⚠️ Talvez',          count: counts.talvez },
    { key: 'nao',    label: '❌ Não vai renovar', count: counts.nao },
  ]
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {options.map(opt => {
        const active = value === opt.key
        const accent = REENROLL_PILL_ACCENT[opt.key]
        return (
          <button
            key={opt.key || 'todos'}
            onClick={() => onChange(opt.key)}
            style={{
              padding: '7px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1.5px solid ${accent}`,
              background: active ? accent : 'transparent',
              color: active ? 'white' : accent,
            }}
          >
            {opt.label} ({opt.count})
          </button>
        )
      })}
    </div>
  )
}

// Default do filtro de período: da criação da pesquisa até hoje — assim o
// gestor vê TODAS as respostas ao abrir o painel, não só uma janela recente.
function defaultDateRange(createdAt: string) {
  const to = new Date()
  const from = new Date(createdAt)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}

const REENROLL_OPTIONS = [
  'Com certeza vou rematricular',
  'Provavelmente sim',
  'Ainda não decidi',
  'Provavelmente não',
  'Não vou rematricular',
]

const PIE_COLORS = ['#10B981', '#6EE7B7', '#FCD34D', '#F97316', '#EF4444']

// ─── segmentos ──────────────────────────────────────────────
// Não existe coluna dedicada de segmento no banco — é derivado do texto
// livre de respondent_grade por palavra-chave. Cada escola nomeia suas
// séries de um jeito diferente, então este é o único lugar a ajustar caso
// apareça uma nomenclatura que não caia em nenhum padrão abaixo.
const SEGMENT_OPTIONS = ['Infantil', 'Fundamental I', 'Fundamental II', 'Médio', 'EJA'] as const
type Segment = typeof SEGMENT_OPTIONS[number]

const SEGMENT_KEYWORDS: Record<Segment, RegExp> = {
  'Infantil':       /berç|matern|jardim|infantil|\bpr[eé]\b/i,
  'Fundamental I':  /fund(amental)?\s*i\b(?!i)|\b[1-5]º?\s*ano\b/i,
  'Fundamental II': /fund(amental)?\s*ii\b|\b[6-9]º?\s*ano\b/i,
  'Médio':          /m[eé]dio/i,
  'EJA':            /\beja\b/i,
}

function inferSegment(grade: string | null | undefined): Segment | null {
  if (!grade) return null
  for (const seg of SEGMENT_OPTIONS) {
    if (SEGMENT_KEYWORDS[seg].test(grade)) return seg
  }
  return null
}

// Séries efetivamente usadas no filtro server-side: se há seleção explícita
// no multi-select, usa ela; senão, se um segmento está escolhido, usa todas
// as séries daquele segmento; senão, não filtra por série.
function effectiveGradeFilter(selectedGrades: string[], segment: Segment | '', allGrades: string[]): string[] {
  if (selectedGrades.length > 0) return selectedGrades
  if (segment) return allGrades.filter(g => inferSegment(g) === segment)
  return []
}

const QUESTION_TYPES: { type: SurveyQuestionType; label: string; icon: typeof Star }[] = [
  { type: 'scale', label: 'Escala (1 a 5)', icon: Star },
  { type: 'nps', label: 'NPS (0 a 10)', icon: Gauge },
  { type: 'multiple_choice', label: 'Múltipla escolha', icon: List },
  { type: 'text', label: 'Texto livre', icon: AlignLeft },
]

function emptyQuestionForm(): { title: string; description: string; question_type: SurveyQuestionType; required: boolean; min_label: string; max_label: string; options: string[] } {
  return { title: '', description: '', question_type: 'scale', required: true, min_label: '', max_label: '', options: ['', ''] }
}

// ─── estilos ─────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'white', borderRadius: 16, padding: 24,
  border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

// Cards de métricas (KPIs) da aba "Visão Geral" — padding reduzido pra
// caber mais informação na tela sem precisar rolar tanto.
const cardCompact: React.CSSProperties = { ...card, padding: 14 }

const btn = (bg: string, color = 'white'): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 10, border: 'none',
  background: bg, color, fontWeight: 600, fontSize: 13,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
})

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 6, display: 'block',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 9,
  border: '1.5px solid #E2E8F0', fontSize: 13, color: '#1A2B4A',
  outline: 'none', boxSizing: 'border-box', background: '#FAFAFA',
}

// ─── relatório por pergunta (pesquisas custom) ─────────────────
function CustomSurveyReport({ questions, responses }: { questions: QuestionRow[]; responses: SurveyResponse[] }) {
  const [expandedText, setExpandedText] = useState<Record<string, boolean>>({})

  if (questions.length === 0) {
    return (
      <div style={{ ...card, textAlign: 'center', padding: 64 }}>
        <p style={{ color: '#94A3B8', fontSize: 15 }}>Esta pesquisa não tem perguntas configuradas.</p>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={cardCompact}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Total de respostas</p>
        <p style={{ fontSize: 30, fontWeight: 900, color: '#1A2B4A', margin: 0 }}>{responses.length}</p>
      </div>

      {questions.map(q => {
        const values = responses
          .map(r => r.custom_answers?.[q.id])
          .filter(v => v !== undefined && v !== null && v !== '')

        return (
          <div key={q.id} style={cardCompact}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 2, marginTop: 0 }}>{q.title}</p>
            <p style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10, marginTop: 0, textTransform: 'uppercase', fontWeight: 600 }}>
              {values.length} resposta{values.length !== 1 ? 's' : ''}
            </p>

            {(q.question_type === 'scale' || q.question_type === 'nps') && (() => {
              const nums = values.filter(v => typeof v === 'number') as number[]
              const min = q.question_type === 'nps' ? 0 : (q.options?.min ?? 1)
              const max = q.question_type === 'nps' ? 10 : (q.options?.max ?? 5)
              const buckets = Array.from({ length: max - min + 1 }, (_, i) => i + min)
              const barData = buckets.map(n => ({ name: String(n), value: nums.filter(v => v === n).length }))
              const average = avg(nums)
              // Pergunta nps é 0–10 de verdade (não precisa reescalar) — dá pra
              // calcular o NPS real (%promotores − %detratores) direto.
              const nps = q.question_type === 'nps' ? npsFromScores(nums) : null
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 16, flexBasis: '30%', minWidth: 120, flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#1A2B4A' }}>{average.toFixed(1)}</div>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>média (0–{max})</p>
                    </div>
                    {nps !== null && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 32, fontWeight: 900, color: nps >= 0 ? '#10B981' : '#EF4444' }}>{nps >= 0 ? '+' : ''}{nps}</div>
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>NPS</p>
                      </div>
                    )}
                  </div>
                  <div style={{ flexBasis: '70%', flexGrow: 1, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={barData} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                        <RTooltip />
                        <Bar dataKey="value" fill="#F97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {q.question_type === 'multiple_choice' && (() => {
              const opts = q.options?.options || []
              const pieData = opts.map((opt, i) => ({
                name: opt, value: values.filter(v => v === opt).length, color: PIE_COLORS[i % PIE_COLORS.length],
              })).filter(d => d.value > 0)
              if (pieData.length === 0) return <p style={{ fontSize: 13, color: '#94A3B8' }}>Sem respostas ainda.</p>
              return (
                <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pieData.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
                        <span style={{ color: '#374151' }}>{entry.name}</span>
                        <span style={{ fontWeight: 700, color: '#1A2B4A' }}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {q.question_type === 'text' && (() => {
              const isExpanded = !!expandedText[q.id]
              const texts = values as string[]
              const visible = isExpanded ? texts : texts.slice(0, 5)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {texts.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#94A3B8' }}>Sem respostas ainda.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: isExpanded ? 400 : undefined, overflowY: isExpanded ? 'auto' : undefined }}>
                        {visible.map((t, i) => (
                          <p key={i} style={{ fontSize: 13, color: '#374151', background: '#F8FAFC', borderRadius: 8, padding: '8px 12px', margin: 0, fontStyle: 'italic' }}>"{t}"</p>
                        ))}
                      </div>
                      {texts.length > 5 && (
                        <button
                          onClick={() => setExpandedText(prev => ({ ...prev, [q.id]: !isExpanded }))}
                          style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: '#00A896', fontSize: 12, fontWeight: 600, padding: '4px 0' }}
                        >
                          {isExpanded ? 'Mostrar menos' : `Ver todas (${texts.length})`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}

// ─── filtro de série com múltipla seleção ──────────────────────
function MultiSelectDropdown({ label, options, selected, onChange, placeholder = 'Todas' }: {
  label: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === 0
  const buttonLabel = allSelected
    ? placeholder
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionadas`

  function toggleOne(opt: string) {
    onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
  }

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, width: 200, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buttonLabel}</span>
        <span style={{ color: '#94A3B8', fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: 66, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200, maxHeight: 260, overflowY: 'auto', padding: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', borderRadius: 8 }}>
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} />
            Todas
          </label>
          {options.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94A3B8', padding: '8px 10px', margin: 0 }}>Nenhuma opção.</p>
          ) : options.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, color: '#374151', cursor: 'pointer', borderRadius: 8 }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOne(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
    </div>
  )
}

// ─── tabela de respostas individuais (Aba "Respostas") ─────────
type SortColumn = 'name' | 'grade' | 'score' | 'reenrollment' | 'date'

function SortableTh({ label, column, sortColumn, sortDir, onSort }: {
  label: string; column: SortColumn | null; sortColumn: SortColumn; sortDir: 'asc' | 'desc'; onSort: (c: SortColumn) => void
}) {
  const active = column !== null && column === sortColumn
  return (
    <th
      onClick={column ? () => onSort(column) : undefined}
      style={{
        padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: active ? '#00A896' : '#64748B',
        borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap', cursor: column ? 'pointer' : 'default', userSelect: 'none',
      }}
    >
      {label}{active && (sortDir === 'asc' ? ' ▲' : ' ▼')}
    </th>
  )
}

function ResponsesTable({
  isDefault, loading, rows, questions, sortColumn, sortDir, onSort,
  expandedRowId, onToggleExpand, onViewContact, page, pageSize, totalCount, onPageChange,
}: {
  isDefault: boolean
  loading: boolean
  rows: SurveyResponse[]
  questions: QuestionRow[]
  sortColumn: SortColumn
  sortDir: 'asc' | 'desc'
  onSort: (c: SortColumn) => void
  expandedRowId: string | null
  onToggleExpand: (id: string) => void
  onViewContact: (name: string) => void
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const categoryLabels: { key: 'general' | 'teaching' | 'communication' | 'infrastructure' | 'cost_benefit'; label: string }[] = [
    { key: 'general', label: 'Satisfação geral' },
    { key: 'teaching', label: 'Ensino' },
    { key: 'communication', label: 'Atendimento' },
    { key: 'infrastructure', label: 'Infraestrutura' },
    { key: 'cost_benefit', label: 'Custo-benefício' },
  ]

  return (
    <div style={card}>
      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>
        Respostas individuais ({totalCount})
      </p>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Carregando...</div>
      ) : rows.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>Nenhuma resposta com os filtros atuais.</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th style={{ width: 28, borderBottom: '1px solid #E2E8F0' }} />
                  <SortableTh label="Nome" column="name" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                  <SortableTh label="Série" column="grade" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                  {isDefault && <SortableTh label="Nota geral" column="score" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />}
                  {isDefault && <SortableTh label="Rematrícula" column="reenrollment" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />}
                  <SortableTh label="Data" column="date" sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                  <SortableTh label="" column={null} sortColumn={sortColumn} sortDir={sortDir} onSort={onSort} />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isExpanded = expandedRowId === r.id
                  const score10 = respondentOverallScore10(r)
                  const scoreColor = score10 >= 8 ? '#10B981' : score10 >= 6 ? '#F59E0B' : '#EF4444'
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => onToggleExpand(r.id)}
                        style={{ borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: isExpanded ? '#F0FDFB' : undefined }}
                      >
                        <td style={{ padding: '10px 14px', color: '#CBD5E1' }}>{isExpanded ? '▾' : '▸'}</td>
                        <td style={{ padding: '10px 14px', color: '#1A2B4A', fontWeight: 500 }}>
                          {r.respondent_name || <span style={{ color: '#CBD5E1', fontStyle: 'italic' }}>Anônimo</span>}
                        </td>
                        <td style={{ padding: '10px 14px', color: '#64748B' }}>{r.respondent_grade || '—'}</td>
                        {isDefault && (
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{ fontWeight: 700, color: scoreColor }}>{score10.toFixed(1)}</span>
                          </td>
                        )}
                        {isDefault && (
                          <td style={{ padding: '10px 14px' }}>
                            <ReenrollmentBadge value={r.answers?.reenrollment as string | undefined} />
                          </td>
                        )}
                        <td style={{ padding: '10px 14px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                        <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                          {r.respondent_name && (
                            <button
                              onClick={() => onViewContact(r.respondent_name!)}
                              style={{ padding: '4px 10px', borderRadius: 8, background: '#EFF6FF', color: '#3B82F6', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              Ver em Contatos
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ background: '#FAFCFC' }}>
                          <td colSpan={isDefault ? 7 : 5} style={{ padding: '4px 14px 18px 42px' }}>
                            {isDefault ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420 }}>
                                {categoryLabels.map(c => {
                                  const val = r.answers?.[c.key] as number | undefined
                                  return (
                                    <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <span style={{ fontSize: 12, color: '#64748B', width: 130, flexShrink: 0 }}>{c.label}</span>
                                      <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden' }}>
                                        <div style={{ width: `${typeof val === 'number' ? (val / 5) * 100 : 0}%`, height: '100%', background: '#F97316' }} />
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1A2B4A', width: 24, textAlign: 'right' }}>{typeof val === 'number' ? val : '—'}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 520 }}>
                                {questions.map(q => {
                                  const val = r.custom_answers?.[q.id]
                                  return (
                                    <div key={q.id}>
                                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase' }}>{q.title}</p>
                                      {val === undefined || val === null || val === '' ? (
                                        <span style={{ fontSize: 13, color: '#CBD5E1' }}>Não respondida</span>
                                      ) : q.question_type === 'scale' || q.question_type === 'nps' ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <div style={{ flex: 1, height: 6, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', maxWidth: 200 }}>
                                            <div style={{ width: `${(Number(val) / (q.question_type === 'nps' ? 10 : (q.options?.max ?? 5))) * 100}%`, height: '100%', background: '#F97316' }} />
                                          </div>
                                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>{String(val)}</span>
                                        </div>
                                      ) : q.question_type === 'multiple_choice' ? (
                                        <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: '#EFF6FF', color: '#3B82F6' }}>{String(val)}</span>
                                      ) : (
                                        <p style={{ fontSize: 13, color: '#374151', margin: 0, fontStyle: 'italic' }}>"{String(val)}"</p>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 20 }}>
              <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
                style={{ ...btn('#F1F5F9', '#374151'), opacity: page <= 1 ? 0.5 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
                ← Anterior
              </button>
              <span style={{ fontSize: 13, color: '#64748B' }}>Página {page} de {totalPages}</span>
              <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
                style={{ ...btn('#F1F5F9', '#374151'), opacity: page >= totalPages ? 0.5 : 1, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
                Próximo →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── aba "Relatório IA" ──────────────────────────────────────
function AiReportTab({ survey, report, generating, hasResponses, onGenerate }: {
  survey: Survey; report: AiReport | null; generating: boolean; hasResponses: boolean; onGenerate: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Análise gerada por IA</p>
          {survey.ai_analysis_generated_at && (
            <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>Gerada em {fmt(survey.ai_analysis_generated_at)}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {report && (
            <button onClick={() => window.print()} style={btn('#1A2B4A')}>Exportar PDF</button>
          )}
          <button onClick={onGenerate} disabled={generating || !hasResponses} style={{ ...btn('#8B5CF6'), opacity: generating || !hasResponses ? 0.6 : 1 }}>
            <Brain size={15} /> {generating ? 'Gerando...' : report ? 'Gerar novamente' : 'Gerar relatório'}
          </button>
        </div>
      </div>

      {generating ? (
        <div style={{ ...card, textAlign: 'center', padding: 48 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #8B5CF6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#8B5CF6', fontWeight: 600 }}>Analisando respostas com IA...</p>
        </div>
      ) : !report ? (
        <div style={{ ...card, textAlign: 'center', padding: 64 }}>
          <Brain size={40} color="#CBD5E1" style={{ margin: '0 auto 16px', display: 'block' }} />
          <p style={{ color: '#94A3B8', fontSize: 15, margin: '0 0 4px' }}>Nenhuma análise gerada ainda.</p>
          {!hasResponses && <p style={{ color: '#CBD5E1', fontSize: 13 }}>É preciso ter respostas no período filtrado.</p>}
        </div>
      ) : (
        <div style={card}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              {(() => {
                const sc = report.overall_score
                const c = sc >= 8 ? '#10B981' : sc >= 6 ? '#F59E0B' : '#EF4444'
                const riskCfg = { baixo: { bg: '#D1FAE5', color: '#065F46' }, médio: { bg: '#FEF3C7', color: '#92400E' }, alto: { bg: '#FEE2E2', color: '#991B1B' } }
                const rc = riskCfg[report.reenrollment_risk as keyof typeof riskCfg] ?? riskCfg.médio
                return (
                  <>
                    <div style={{ fontSize: 64, fontWeight: 900, color: c, lineHeight: 1 }}>{Number(sc).toFixed(1)}</div>
                    <p style={{ color: '#94A3B8', marginTop: 4, marginBottom: 12 }}>/ 10</p>
                    <span style={{ padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, background: rc.bg, color: rc.color }}>
                      Risco de rematrícula: {report.reenrollment_risk}
                    </span>
                  </>
                )
              })()}
            </div>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 8px' }}>Resumo executivo</p>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{report.summary}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#065F46', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fortes</p>
                {report.strengths.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', marginBottom: 6 }}>
                    <Check size={14} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} /> {s}
                  </div>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', margin: '0 0 10px' }}>Pontos fracos</p>
                {report.weaknesses.map((w, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: '#374151', marginBottom: 6 }}>
                    <X size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} /> {w}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', margin: '0 0 10px' }}>Ações prioritárias</p>
              {report.priority_actions.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#374151', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#3B82F6', flexShrink: 0 }}>{i + 1}.</span> {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── linha arrastável do editor de perguntas ───────────────────
function SortableQuestionRow({ question, onEdit, onDelete }: { question: QuestionRow; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const QIcon = QUESTION_TYPES.find(t => t.type === question.question_type)?.icon || Star
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition,
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: isDragging ? '#F0FDF4' : '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
        opacity: isDragging ? 0.6 : 1,
      }}
    >
      <span {...attributes} {...listeners} style={{ cursor: 'grab', color: '#CBD5E1', display: 'flex' }}><GripVertical size={14} /></span>
      <QIcon size={14} color="#64748B" />
      <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{question.title}</span>
      <span style={{ fontSize: 11, color: '#94A3B8', background: '#F1F5F9', padding: '2px 8px', borderRadius: 6 }}>
        {QUESTION_TYPES.find(t => t.type === question.question_type)?.label}
      </span>
      {question.required && <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 700 }}>*</span>}
      <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2 }}><Pencil size={13} /></button>
      <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', padding: 2 }}><Trash2 size={13} /></button>
    </div>
  )
}

// ─── componente ──────────────────────────────────────────────
export default function GestorSurveys() {
  const { user } = useAuth()
  const institutionId = user?.institution_id!
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [newModalStep, setNewModalStep] = useState<'mode' | 'form'>('mode')
  const [pendingMode, setPendingMode] = useState<'default' | 'custom'>('default')
  const [showLinkModal, setShowLinkModal] = useState<{ survey: Survey } | null>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const [form, setForm] = useState({ title: '', description: '', askId: false, requireId: false })
  const [saving, setSaving] = useState(false)

  // editor de perguntas customizadas
  const [editorSurvey, setEditorSurvey] = useState<Survey | null>(null)
  const [editorQuestions, setEditorQuestions] = useState<QuestionRow[]>([])
  const [loadingEditor, setLoadingEditor] = useState(false)
  const [showQuestionModal, setShowQuestionModal] = useState<QuestionRow | 'new' | null>(null)
  const [questionForm, setQuestionForm] = useState(emptyQuestionForm())
  const [redirectDraft, setRedirectDraft] = useState('')

  const [viewingSurvey, setViewingSurvey] = useState<Survey | null>(null)
  // responses = conjunto agregado (respeita filtro de data/série, até 500
  // linhas) usado pela aba "Visão Geral" e por CustomSurveyReport — não é
  // paginado, é só pra cálculo de médias/gráficos.
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [reportQuestions, setReportQuestions] = useState<QuestionRow[]>([])
  const [loadingResponses, setLoadingResponses] = useState(false)

  const [aiReport, setAiReport] = useState<AiReport | null>(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  // ── painel de respostas: abas, filtros, tabela paginada, ordenação ──
  const [activeTab, setActiveTab] = useState<'overview' | 'responses' | 'ai'>('overview')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterSegment, setFilterSegment] = useState<Segment | ''>('')
  const [filterGrades, setFilterGrades] = useState<string[]>([])
  const [filterName, setFilterName] = useState('')
  const [filterReenrollment, setFilterReenrollment] = useState('')
  const [gradeOptions, setGradeOptions] = useState<string[]>([])

  const TABLE_PAGE_SIZE = 20
  const [tableResponses, setTableResponses] = useState<SurveyResponse[]>([])
  const [tableTotalCount, setTableTotalCount] = useState(0)
  const [tablePage, setTablePage] = useState(1)
  const [loadingTable, setLoadingTable] = useState(false)

  const [sortColumn, setSortColumn] = useState<SortColumn>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null)

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('satisfaction_surveys')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false })
    if (mountedRef.current) {
      setSurveys(data ?? [])
      setLoading(false)
    }
  }

  async function createSurvey() {
    if (!form.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('satisfaction_surveys')
      .insert({
        institution_id: institutionId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        require_identification: form.askId,
        status: pendingMode === 'custom' ? 'draft' : 'active',
        survey_mode: pendingMode,
        created_by: user?.full_name ?? null,
      })
      .select()
      .single()

    setSaving(false)
    if (error || !data) { showToast('Erro ao criar pesquisa.'); return }

    setShowNewModal(false)
    setForm({ title: '', description: '', askId: false, requireId: false })
    await load()

    if (pendingMode === 'custom') openEditor(data)
    else setShowLinkModal({ survey: data })
  }

  async function closeSurvey(id: string) {
    if (!confirm('Encerrar esta pesquisa? Ela não aceitará mais respostas.')) return
    await supabase.from('satisfaction_surveys')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', id)
    showToast('Pesquisa encerrada.')
    load()
  }

  async function deleteSurvey(id: string, responseCount: number) {
    if (!confirm(`Tem certeza? ${responseCount > 0 ? `${responseCount} resposta(s) será(ão) perdida(s).` : 'Esta ação não pode ser desfeita.'}`)) return
    const { error } = await supabase.rpc('delete_survey_cascade', { survey_uuid: id })
    if (error) { showToast('Erro ao excluir pesquisa.'); return }
    showToast('Pesquisa excluída.')
    load()
  }

  function openNewModal() {
    setNewModalStep('mode')
    setPendingMode('default')
    setShowNewModal(true)
  }

  function surveyLink(token: string) {
    return `${window.location.origin}/satisfaction/${token}`
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(surveyLink(token))
    showToast('Link copiado para a área de transferência.')
    setOpenMenu(null)
  }

  // Datas do filtro vêm de <input type="date"> (yyyy-mm-dd) — "De" cobre o
  // dia inteiro a partir de 00:00, "Até" cobre até 23:59:59 do dia informado.
  function applyDateFilter(q: any, dateFrom: string, dateTo: string) {
    if (dateFrom) q = q.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`)
    return q
  }

  function applyGradeFilter(q: any, grades: string[]) {
    if (grades.length > 0) q = q.in('respondent_grade', grades)
    return q
  }

  async function fetchGradeOptions(surveyId: string) {
    const { data } = await supabase
      .from('satisfaction_responses')
      .select('respondent_grade')
      .eq('survey_id', surveyId)
      .not('respondent_grade', 'is', null)
    if (!mountedRef.current) return
    const uniq = Array.from(new Set((data ?? []).map(r => r.respondent_grade).filter((g): g is string => !!g)))
    setGradeOptions(uniq.sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }

  // Conjunto agregado pra Visão Geral — respeita data/série, capado em 500
  // pra não puxar uma pesquisa inteira de uma escola grande de uma vez só;
  // a contagem exata (pro card "Respostas" e pro NPS/% de rematrícula) usa
  // tableTotalCount, que vem de uma query separada com count exato.
  async function fetchOverview(surveyId: string, dateFrom: string, dateTo: string, grades: string[]) {
    setLoadingResponses(true)
    let q = supabase.from('satisfaction_responses').select('*').eq('survey_id', surveyId).order('created_at', { ascending: false }).limit(500)
    q = applyDateFilter(q, dateFrom, dateTo)
    q = applyGradeFilter(q, grades)
    const { data } = await q
    if (mountedRef.current) {
      setResponses(data ?? [])
      setLoadingResponses(false)
    }
  }

  async function fetchTablePage(surveyId: string, dateFrom: string, dateTo: string, grades: string[], page: number) {
    setLoadingTable(true)
    const from = (page - 1) * TABLE_PAGE_SIZE
    const to = from + TABLE_PAGE_SIZE - 1
    let q = supabase.from('satisfaction_responses').select('*', { count: 'exact' }).eq('survey_id', surveyId).order('created_at', { ascending: false }).range(from, to)
    q = applyDateFilter(q, dateFrom, dateTo)
    q = applyGradeFilter(q, grades)
    const { data, count } = await q
    if (mountedRef.current) {
      setTableResponses(data ?? [])
      setTableTotalCount(count ?? 0)
      setLoadingTable(false)
    }
  }

  async function openResponses(survey: Survey) {
    setViewingSurvey(survey)
    setActiveTab('overview')
    setSortColumn('date')
    setSortDir('desc')
    setExpandedRowId(null)
    setAiReport(survey.ai_analysis ?? null)

    const range = defaultDateRange(survey.created_at)
    setFilterDateFrom(range.from)
    setFilterDateTo(range.to)
    setFilterSegment('')
    setFilterGrades([])
    setFilterName('')
    setFilterReenrollment('')
    setTablePage(1)
    // Os dados em si (overview + tabela) são carregados pelos useEffects
    // logo abaixo, que reagem tanto à troca de pesquisa (viewingSurvey.id)
    // quanto à troca de filtro — os setState acima já disparam isso.

    fetchGradeOptions(survey.id)

    if (survey.survey_mode === 'custom') {
      setLoadingResponses(true)
      const { data } = await supabase.from('satisfaction_questions').select('*').eq('survey_id', survey.id).order('order_index', { ascending: true })
      if (mountedRef.current) setReportQuestions(data ?? [])
    } else {
      setReportQuestions([])
    }
  }

  // Séries visíveis no multi-select — restritas ao segmento escolhido (se houver).
  const segmentGradeOptions = useMemo(
    () => filterSegment ? gradeOptions.filter(g => inferSegment(g) === filterSegment) : gradeOptions,
    [gradeOptions, filterSegment]
  )

  // Séries efetivamente aplicadas na query server-side (ver effectiveGradeFilter).
  const effectiveGrades = useMemo(
    () => effectiveGradeFilter(filterGrades, filterSegment, gradeOptions),
    [filterGrades, filterSegment, gradeOptions]
  )

  // Refetch da Visão Geral quando a pesquisa aberta ou os filtros server-side mudam.
  useEffect(() => {
    if (!viewingSurvey) return
    fetchOverview(viewingSurvey.id, filterDateFrom, filterDateTo, effectiveGrades)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades])

  // Volta pra página 1 sempre que pesquisa/filtro server-side mudam (mudança
  // de filtro invalida a página atual da tabela).
  useEffect(() => {
    setTablePage(1)
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades])

  // Refetch da tabela paginada quando pesquisa, filtros server-side, ou a
  // página mudam.
  useEffect(() => {
    if (!viewingSurvey) return
    fetchTablePage(viewingSurvey.id, filterDateFrom, filterDateTo, effectiveGrades, tablePage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSurvey?.id, filterDateFrom, filterDateTo, effectiveGrades, tablePage])

  // Busca por nome e filtro de rematrícula são client-side, aplicados só
  // dentro da página de 20 já carregada (por isso uma página pode mostrar
  // menos de 20 linhas quando esses dois filtros estão ativos).
  const visibleTableResponses = useMemo(() => {
    let list = tableResponses
    if (filterName.trim()) {
      const q = filterName.trim().toLowerCase()
      list = list.filter(r => (r.respondent_name || '').toLowerCase().includes(q))
    }
    if (filterReenrollment) {
      list = list.filter(r => reenrollBucket(r.answers?.reenrollment as string | undefined) === filterReenrollment)
    }
    return list
  }, [tableResponses, filterName, filterReenrollment])

  const sortedTableResponses = useMemo(() => {
    const list = [...visibleTableResponses]
    const dir = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      switch (sortColumn) {
        case 'name':  return (a.respondent_name || '').localeCompare(b.respondent_name || '') * dir
        case 'grade': return (a.respondent_grade || '').localeCompare(b.respondent_grade || '') * dir
        case 'date':  return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir
        case 'score': return (respondentOverallScore10(a) - respondentOverallScore10(b)) * dir
        case 'reenrollment': return String(a.answers?.reenrollment || '').localeCompare(String(b.answers?.reenrollment || '')) * dir
        default: return 0
      }
    })
    return list
  }, [visibleTableResponses, sortColumn, sortDir])

  // Contagem pros pills de rematrícula (aba Respostas) — usa `responses`
  // (conjunto agregado já filtrado por data/segmento/série, capado em 500)
  // em vez da página de 20 da tabela, senão os números só refletiriam a
  // página atual. Aplica a busca por nome também, pra bater com o que o
  // gestor está vendo; não aplica o próprio filtro de rematrícula, já que
  // o objetivo é mostrar quanto cada opção renderia.
  const reenrollmentPillCounts = useMemo(() => {
    const base = filterName.trim()
      ? responses.filter(r => (r.respondent_name || '').toLowerCase().includes(filterName.trim().toLowerCase()))
      : responses
    const buckets = { sim: 0, nao: 0, talvez: 0 }
    for (const r of base) {
      const b = reenrollBucket(r.answers?.reenrollment as string | undefined)
      if (b) buckets[b]++
    }
    return { total: base.length, ...buckets }
  }, [responses, filterName])

  const hasReenrollmentField = useMemo(
    () => responses.some(r => r.answers && Object.prototype.hasOwnProperty.call(r.answers, 'reenrollment')),
    [responses]
  )

  async function generateReport(survey: Survey) {
    if (responses.length === 0) { showToast('Sem respostas para gerar relatório.'); return }
    setGeneratingReport(true)
    const { data: inst } = await supabase.from('institutions').select('name').eq('id', institutionId).maybeSingle()
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'survey_report',
          payload: {
            responses, surveyTitle: survey.title, institutionName: inst?.name ?? 'Escola',
            surveyMode: survey.survey_mode, questions: survey.survey_mode === 'custom' ? reportQuestions : [],
          },
        }),
      })
      const json = await res.json()
      if (json.result) {
        setAiReport(json.result)
        const generatedAt = new Date().toISOString()
        // Análise agregada da pesquisa inteira, salva em satisfaction_surveys
        // (não em satisfaction_responses.ai_analysis, que é por resposta e
        // não é usado aqui) — assim a aba não precisa gerar de novo toda
        // vez que o gestor reabrir a pesquisa.
        await supabase.from('satisfaction_surveys')
          .update({ ai_analysis: json.result, ai_analysis_generated_at: generatedAt })
          .eq('id', survey.id)
        setViewingSurvey(prev => prev && prev.id === survey.id ? { ...prev, ai_analysis: json.result, ai_analysis_generated_at: generatedAt } : prev)
        setSurveys(prev => prev.map(s => s.id === survey.id ? { ...s, ai_analysis: json.result, ai_analysis_generated_at: generatedAt } : s))
      } else {
        showToast('Erro ao gerar relatório.')
      }
    } catch { showToast('Erro ao gerar relatório.') }
    setGeneratingReport(false)
  }

  // ─── editor de perguntas customizadas ──────────────────────
  async function openEditor(survey: Survey) {
    setEditorSurvey(survey)
    setRedirectDraft(survey.redirect_url ?? '')
    setLoadingEditor(true)
    const { data } = await supabase
      .from('satisfaction_questions')
      .select('*')
      .eq('survey_id', survey.id)
      .order('order_index', { ascending: true })
    setEditorQuestions(data ?? [])
    setLoadingEditor(false)
  }

  function closeEditor() {
    setEditorSurvey(null)
    setEditorQuestions([])
  }

  function openQuestionForm(q: QuestionRow | 'new') {
    if (q === 'new') {
      setQuestionForm(emptyQuestionForm())
    } else {
      const opts = q.options || {}
      setQuestionForm({
        title: q.title, description: q.description || '', question_type: q.question_type,
        required: q.required, min_label: opts.min_label || '', max_label: opts.max_label || '',
        options: opts.options && opts.options.length > 0 ? opts.options : ['', ''],
      })
    }
    setShowQuestionModal(q)
  }

  async function saveQuestion() {
    if (!editorSurvey || !questionForm.title.trim()) return
    const options =
      questionForm.question_type === 'multiple_choice' ? { options: questionForm.options.filter(o => o.trim()) } :
      questionForm.question_type === 'scale' ? { min: 1, max: 5, min_label: questionForm.min_label || undefined, max_label: questionForm.max_label || undefined } :
      questionForm.question_type === 'nps' ? { min_label: questionForm.min_label || undefined, max_label: questionForm.max_label || undefined } :
      null

    if (showQuestionModal === 'new') {
      const { data, error } = await supabase.from('satisfaction_questions').insert({
        survey_id: editorSurvey.id,
        institution_id: institutionId,
        order_index: editorQuestions.length,
        question_type: questionForm.question_type,
        title: questionForm.title.trim(),
        description: questionForm.description.trim() || null,
        required: questionForm.required,
        options,
      }).select().single()
      if (error || !data) { showToast('Erro ao adicionar pergunta.'); return }
      setEditorQuestions(prev => [...prev, data])
    } else if (showQuestionModal) {
      const id = showQuestionModal.id
      const { error } = await supabase.from('satisfaction_questions').update({
        question_type: questionForm.question_type,
        title: questionForm.title.trim(),
        description: questionForm.description.trim() || null,
        required: questionForm.required,
        options,
      }).eq('id', id)
      if (error) { showToast('Erro ao salvar pergunta.'); return }
      setEditorQuestions(prev => prev.map(q => q.id === id
        ? { ...q, question_type: questionForm.question_type, title: questionForm.title.trim(), description: questionForm.description.trim() || null, required: questionForm.required, options }
        : q))
    }
    setShowQuestionModal(null)
  }

  async function deleteQuestion(id: string) {
    if (!confirm('Excluir esta pergunta? Respostas já recebidas para ela serão mantidas, mas ela some do formulário.')) return
    const { error } = await supabase.from('satisfaction_questions').delete().eq('id', id)
    if (error) { showToast('Erro ao excluir pergunta.'); return }
    setEditorQuestions(prev => prev.filter(q => q.id !== id))
  }

  async function handleQuestionDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = editorQuestions.findIndex(q => q.id === active.id)
    const newIndex = editorQuestions.findIndex(q => q.id === over.id)
    const reordered = arrayMove(editorQuestions, oldIndex, newIndex).map((q, i) => ({ ...q, order_index: i }))
    setEditorQuestions(reordered)
    await Promise.all(reordered.map(q => supabase.from('satisfaction_questions').update({ order_index: q.order_index }).eq('id', q.id)))
  }

  async function saveRedirectUrl() {
    if (!editorSurvey) return
    const url = redirectDraft.trim() || null
    await supabase.from('satisfaction_surveys').update({ redirect_url: url }).eq('id', editorSurvey.id)
    setEditorSurvey(prev => prev ? { ...prev, redirect_url: url } : prev)
    showToast('Redirecionamento salvo.')
  }

  async function publishEditorSurvey() {
    if (!editorSurvey) return
    if (editorQuestions.length === 0) { showToast('Adicione ao menos uma pergunta antes de publicar.'); return }
    await supabase.from('satisfaction_surveys').update({ status: 'active' }).eq('id', editorSurvey.id)
    const updated = { ...editorSurvey, status: 'active' as const }
    setEditorSurvey(updated)
    await load()
    showToast('Pesquisa publicada!')
    setShowLinkModal({ survey: updated })
  }

  const total = surveys.length
  const active = surveys.filter(s => s.status === 'active').length
  const totalResponses = surveys.reduce((sum, s) => sum + (s.response_count ?? 0), 0)
  const avgResponses = total > 0 ? Math.round(totalResponses / total) : 0

  const kpis = [
    { label: 'Total de pesquisas', value: total, Icon: ClipboardList, color: '#F97316', bg: '#FFF7ED' },
    { label: 'Pesquisas ativas', value: active, Icon: TrendingUp, color: '#10B981', bg: '#F0FDF4' },
    { label: 'Total de respostas', value: totalResponses, Icon: Users, color: '#3B82F6', bg: '#EFF6FF' },
    { label: 'Média por pesquisa', value: avgResponses, Icon: BarChart3, color: '#8B5CF6', bg: '#EDE9FE' },
  ]

  function StatusBadge({ status }: { status: Survey['status'] }) {
    const cfg = {
      draft:  { label: 'Rascunho', bg: '#F1F5F9', color: '#64748B' },
      active: { label: 'Ativa',    bg: '#D1FAE5', color: '#065F46' },
      closed: { label: 'Encerrada', bg: '#DBEAFE', color: '#1E40AF' },
    }[status]
    return (
      <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
        {cfg.label}
      </span>
    )
  }

  // ─── PAINEL DE RESPOSTAS ───────────────────────────────────
  if (viewingSurvey) {
    const isDefault = viewingSurvey.survey_mode !== 'custom'

    const avgGeneral  = avg(responses.map(r => r.answers.general as number))
    const avgTeaching = avg(responses.map(r => r.answers.teaching as number))
    const avgComm     = avg(responses.map(r => r.answers.communication as number))
    const avgInfra    = avg(responses.map(r => r.answers.infrastructure as number))
    const avgCost     = avg(responses.map(r => r.answers.cost_benefit as number))
    const overallAvg  = avg([avgGeneral, avgTeaching, avgComm, avgInfra, avgCost])
    const overallScore10 = scaleToTen(overallAvg)
    const scoreColor = overallScore10 >= 8 ? '#10B981' : overallScore10 >= 6 ? '#F59E0B' : '#EF4444'

    const barData = [
      { name: 'Satisfação geral', value: avgGeneral },
      { name: 'Ensino',           value: avgTeaching },
      { name: 'Atendimento',      value: avgComm },
      { name: 'Infraestrutura',   value: avgInfra },
      { name: 'Custo-benefício',  value: avgCost },
    ]

    const pieData = REENROLL_OPTIONS.map((opt, i) => ({
      name: opt,
      value: responses.filter(r => r.answers.reenrollment === opt).length,
      color: PIE_COLORS[i],
    })).filter(d => d.value > 0)

    const evasionRisk = responses.filter(r =>
      r.answers.reenrollment === 'Provavelmente não' || r.answers.reenrollment === 'Não vou rematricular'
    ).length
    const undecided = responses.filter(r => r.answers.reenrollment === 'Ainda não decidi').length

    const reenroll = reenrollmentBreakdown(responses)
    const nps = isDefault ? npsFromScores(responses.map(respondentOverallScore10)) : 0

    return (
      <div style={{ padding: 24, background: '#f8f9fb', minHeight: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <button onClick={() => setViewingSurvey(null)} style={{ ...btn('#F1F5F9', '#374151'), padding: '8px 14px' }}>
            ← Voltar
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{viewingSurvey.title}</h1>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>{tableTotalCount} resposta{tableTotalCount !== 1 ? 's' : ''} no período selecionado</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {viewingSurvey.survey_mode === 'custom' && (
              <button onClick={() => openEditor(viewingSurvey)} style={{ ...btn('#F1F5F9', '#374151') }}>
                <Pencil size={14} /> Editar perguntas
              </button>
            )}
            {viewingSurvey.status === 'active' && (
              <button onClick={() => closeSurvey(viewingSurvey.id)} style={{ ...btn('#FEF2F2', '#DC2626'), border: '1px solid #FECACA' }}>
                <StopCircle size={14} /> Encerrar pesquisa
              </button>
            )}
          </div>
        </div>

        {/* Barra de filtros — aplicada nas 3 abas */}
        <div style={{ ...card, marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
          <div>
            <label style={labelStyle}>De</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} style={{ ...inputStyle, width: 158 }} />
          </div>
          <div>
            <label style={labelStyle}>Até</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} style={{ ...inputStyle, width: 158 }} />
          </div>
          <div>
            <label style={labelStyle}>Segmento</label>
            <select
              value={filterSegment}
              onChange={e => { setFilterSegment(e.target.value as Segment | ''); setFilterGrades([]) }}
              style={{ ...inputStyle, width: 160 }}
            >
              <option value="">Todos</option>
              {SEGMENT_OPTIONS.map(seg => <option key={seg} value={seg}>{seg}</option>)}
            </select>
          </div>
          <MultiSelectDropdown
            label="Série / Turma"
            options={segmentGradeOptions}
            selected={filterGrades}
            onChange={setFilterGrades}
            placeholder="Todas as séries"
          />
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={labelStyle}>Buscar por nome</label>
            <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Nome do respondente..." style={inputStyle} />
          </div>
          {isDefault && (
            <div>
              <label style={labelStyle}>Rematrícula</label>
              <select value={filterReenrollment} onChange={e => setFilterReenrollment(e.target.value)} style={{ ...inputStyle, width: 140 }}>
                <option value="">Todos</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
                <option value="talvez">Talvez</option>
              </select>
            </div>
          )}
          <button
            onClick={() => {
              const range = defaultDateRange(viewingSurvey.created_at)
              setFilterDateFrom(range.from); setFilterDateTo(range.to)
              setFilterSegment(''); setFilterGrades([]); setFilterName(''); setFilterReenrollment('')
            }}
            style={{ ...btn('#F1F5F9', '#374151'), height: 38 }}
          >
            Limpar filtros
          </button>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #E2E8F0' }}>
          {([
            { key: 'overview' as const,  label: 'Visão Geral' },
            { key: 'responses' as const, label: 'Respostas' },
            { key: 'ai' as const,        label: 'Relatório IA' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, color: activeTab === t.key ? '#00A896' : '#94A3B8',
                borderBottom: activeTab === t.key ? '2px solid #00A896' : '2px solid transparent',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          loadingResponses ? (
            <div style={{ textAlign: 'center', padding: 80, color: '#94A3B8' }}>Carregando...</div>
          ) : responses.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: 64 }}>
              <ClipboardList size={40} color="#CBD5E1" style={{ margin: '0 auto 16px', display: 'block' }} />
              <p style={{ color: '#94A3B8', fontSize: 15 }}>Nenhuma resposta no período/filtro selecionado.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Cards de métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: isDefault ? 'repeat(4, 1fr)' : '1fr', gap: 16 }}>
                <div style={cardCompact}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Respostas</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: '#1A2B4A', margin: 0 }}>{tableTotalCount}</p>
                </div>
                {isDefault && (
                  <>
                    <div style={cardCompact}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Nota geral</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: scoreColor, margin: 0 }}>{overallScore10.toFixed(1)} <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>/ 10</span></p>
                    </div>
                    <div style={cardCompact}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>Rematrícula</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: '#10B981', margin: 0 }}>{reenroll.yesPct}%</p>
                      <p style={{ fontSize: 11, color: '#94A3B8', margin: '4px 0 0' }}>{reenroll.noPct}% não · {reenroll.maybePct}% talvez</p>
                    </div>
                    <div style={cardCompact}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: '0 0 6px' }}>NPS</p>
                      <p style={{ fontSize: 28, fontWeight: 900, color: nps >= 0 ? '#10B981' : '#EF4444', margin: 0 }}>{nps >= 0 ? '+' : ''}{nps}</p>
                    </div>
                  </>
                )}
              </div>

              {isDefault ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
                    <div style={{ ...cardCompact, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', margin: 0 }}>Nota geral</p>
                      <div style={{ fontSize: 56, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{overallScore10.toFixed(1)}</div>
                      <p style={{ fontSize: 14, color: '#94A3B8', margin: 0 }}>de 10</p>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={16} fill={s <= Math.round(overallAvg) ? scoreColor : 'none'} color={scoreColor} />
                        ))}
                      </div>
                    </div>
                    <div style={cardCompact}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 16, marginTop: 0 }}>Média por categoria (1–5)</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                          <RTooltip formatter={(v) => typeof v === 'number' ? v.toFixed(1) : v} />
                          <Bar dataKey="value" fill="#F97316" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {pieData.length > 0 && (
                    <div style={cardCompact}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1A2B4A', marginBottom: 10, marginTop: 0 }}>Distribuição — probabilidade de rematrícula</p>
                      <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap' }}>
                        <ResponsiveContainer width={160} height={160}>
                          <PieChart>
                            <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                              {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                            </Pie>
                            <RTooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pieData.map((entry, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                              <div style={{ width: 12, height: 12, borderRadius: 3, background: entry.color, flexShrink: 0 }} />
                              <span style={{ color: '#374151' }}>{entry.name}</span>
                              <span style={{ fontWeight: 700, color: '#1A2B4A' }}>{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(evasionRisk > 0 || undecided > 0) && (
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {evasionRisk > 0 && (
                        <div style={{ ...card, flex: 1, minWidth: 240, border: '1px solid #FECACA', background: '#FFF5F5', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <AlertTriangle size={24} color="#EF4444" />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#991B1B', margin: '0 0 2px' }}>
                              {evasionRisk} {evasionRisk === 1 ? 'família indicou' : 'famílias indicaram'} que não vai rematricular
                            </p>
                            <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>Ação imediata recomendada</p>
                          </div>
                        </div>
                      )}
                      {undecided > 0 && (
                        <div style={{ ...card, flex: 1, minWidth: 240, border: '1px solid #FDE68A', background: '#FFFBEB', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <AlertTriangle size={24} color="#F59E0B" />
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#92400E', margin: '0 0 2px' }}>
                              {undecided} {undecided === 1 ? 'família ainda indecisa' : 'famílias ainda indecisos'}
                            </p>
                            <p style={{ fontSize: 12, color: '#F59E0B', margin: 0 }}>Entre em contato proativamente</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <CustomSurveyReport questions={reportQuestions} responses={responses} />
              )}
            </div>
          )
        )}

        {activeTab === 'responses' && (
          <>
            {isDefault && hasReenrollmentField && (
              <ReenrollmentPills
                value={filterReenrollment as '' | ReenrollBucket}
                counts={reenrollmentPillCounts}
                onChange={setFilterReenrollment}
              />
            )}
            <ResponsesTable
              isDefault={isDefault}
              loading={loadingTable}
              rows={sortedTableResponses}
              questions={reportQuestions}
              sortColumn={sortColumn}
              sortDir={sortDir}
              onSort={col => {
                if (sortColumn === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                else { setSortColumn(col); setSortDir('desc') }
              }}
              expandedRowId={expandedRowId}
              onToggleExpand={id => setExpandedRowId(prev => prev === id ? null : id)}
              onViewContact={name => navigate(`/contacts?search=${encodeURIComponent(name)}`)}
              page={tablePage}
              pageSize={TABLE_PAGE_SIZE}
              totalCount={tableTotalCount}
              onPageChange={setTablePage}
            />
          </>
        )}

        {activeTab === 'ai' && (
          <AiReportTab
            survey={viewingSurvey}
            report={aiReport}
            generating={generatingReport}
            hasResponses={responses.length > 0}
            onGenerate={() => generateReport(viewingSurvey)}
          />
        )}
      </div>
    )
  }

  // ─── MOBILE ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#f8f9fb', paddingBottom: 96 }}>
        {toast && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Check size={14} /> {toast}
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '16px 16px 8px', background: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardList size={18} color="#F97316" />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Pesquisas</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{active} ativa{active !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs 2x2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px 16px' }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <k.Icon size={15} color={k.color} />
                </div>
                <div>
                  <p style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{k.value}</p>
                  <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0', lineHeight: 1.2 }}>{k.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Survey list */}
        <div style={{ flex: 1, padding: '0 0 16px' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94A3B8', padding: 32, fontSize: 14 }}>Carregando...</p>
          ) : surveys.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <ClipboardList size={40} color="#CBD5E1" style={{ marginBottom: 12 }} />
              <p style={{ color: '#94A3B8', fontSize: 14 }}>Nenhuma pesquisa criada ainda.</p>
            </div>
          ) : surveys.map(s => {
            const isActive = s.status === 'active'
            const scoreable = responses.filter(r => typeof r.answers?.satisfaction === 'number')
            return (
              <div key={s.id} style={{ padding: '14px 16px', background: '#fff', borderRadius: 14, margin: '0 16px 10px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, flex: 1, paddingRight: 8 }}>{s.title}</p>
                  <span style={{
                    padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0,
                    background: isActive ? '#F0FDF4' : '#F1F5F9',
                    color: isActive ? '#10B981' : '#94A3B8',
                  }}>
                    {isActive ? 'Ativa' : 'Encerrada'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#64748B', marginBottom: 10 }}>
                  <span>📊 {s.response_count ?? 0} respostas</span>
                  <span>📅 {fmt(s.created_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => openResponses(s)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#EFF6FF', color: '#3B82F6', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 44 }}
                  >
                    Ver respostas
                  </button>
                  <button
                    onClick={() => copyLink(s.survey_token)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', background: '#F0FDF4', color: '#10B981', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 44 }}
                  >
                    Copiar link
                  </button>
                  {isActive && (
                    <button
                      onClick={() => closeSurvey(s.id)}
                      style={{ padding: '10px 12px', borderRadius: 10, border: 'none', background: '#FEF2F2', color: '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer', minHeight: 44 }}
                    >
                      Encerrar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* FAB */}
        <button
          onClick={openNewModal}
          style={{ position: 'fixed', bottom: 80, right: 20, width: 56, height: 56, borderRadius: '50%', background: '#00A896', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(0,168,150,0.4)', cursor: 'pointer', zIndex: 100 }}
        >
          <Plus size={24} />
        </button>

        {/* New Survey Modal */}
        {showNewModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Nova Pesquisa</p>
                <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
              </div>
              <label style={labelStyle}>Título</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Pesquisa 2025" style={{ ...inputStyle, fontSize: 16, marginBottom: 12 }} />
              <label style={labelStyle}>Descrição (opcional)</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição..." rows={3} style={{ ...inputStyle, fontSize: 16, resize: 'none', marginBottom: 12 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1A2B4A', marginBottom: 16, cursor: 'pointer' }}>
                <input type="checkbox" checked={form.askId} onChange={e => setForm(f => ({ ...f, askId: e.target.checked }))} />
                Solicitar identificação do respondente
              </label>
              <button
                onClick={createSurvey}
                disabled={saving || !form.title.trim()}
                style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: saving || !form.title.trim() ? '#94A3B8' : '#00A896', color: 'white', fontWeight: 700, fontSize: 15, cursor: saving || !form.title.trim() ? 'not-allowed' : 'pointer', minHeight: 48 }}
              >
                {saving ? 'Criando...' : 'Criar pesquisa'}
              </button>
            </div>
          </div>
        )}

        {/* Link Modal */}
        {showLinkModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1A2B4A', margin: 0 }}>Pesquisa criada!</p>
                <button onClick={() => setShowLinkModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Compartilhe o link abaixo com as famílias:</p>
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 12px', border: '1px solid #E2E8F0', fontSize: 13, color: '#1A2B4A', wordBreak: 'break-all', marginBottom: 12 }}>
                {surveyLink(showLinkModal.survey.survey_token)}
              </div>
              <button
                onClick={() => { copyLink(showLinkModal.survey.survey_token); setShowLinkModal(null) }}
                style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: '#00A896', color: 'white', fontWeight: 700, fontSize: 15, cursor: 'pointer', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Copy size={16} /> Copiar link
              </button>
            </div>
          </div>
        )}

      </div>
    )
  }

  // ─── LISTA ────────────────────────────────────────────────
  return (
    <div style={{ padding: 24, background: '#f8f9fb', minHeight: '100%' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1A2B4A', color: 'white', padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <Check size={14} /> {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: '#FFF7ED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={18} color="#F97316" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e2d6b', margin: 0 }}>Pesquisas de Satisfação</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>Entenda o que as famílias pensam e antecipe rematrículas</p>
          </div>
        </div>
        <button onClick={openNewModal} style={btn('#00A896')}>
          <Plus size={16} /> Nova pesquisa
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {kpis.map(k => (
          <div key={k.label} style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <k.Icon size={18} color={k.color} />
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1 }}>{k.value}</p>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '3px 0 0' }}>{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94A3B8' }}>
            <div style={{ width: 32, height: 32, border: '3px solid #00A896', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Carregando...
          </div>
        ) : surveys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 64 }}>
            <ClipboardList size={48} color="#CBD5E1" style={{ margin: '0 auto 16px', display: 'block' }} />
            <p style={{ fontSize: 16, fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' }}>Nenhuma pesquisa criada ainda</p>
            <button onClick={openNewModal} style={btn('#00A896')}>
              <Plus size={15} /> Criar primeira pesquisa
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Título', 'Status', 'Respostas', 'Criada em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: 0 }}>{s.title}</p>
                    {s.description && <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{s.description}</p>}
                    {s.survey_mode === 'custom' && (
                      <p style={{ fontSize: 11, color: '#00A896', margin: '4px 0 0', fontWeight: 600 }}>✦ Pesquisa personalizada</p>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusBadge status={s.status} /></td>
                  <td style={{ padding: '14px 16px', fontWeight: 700, color: '#1A2B4A' }}>{s.response_count ?? 0}</td>
                  <td style={{ padding: '14px 16px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => setOpenMenu(openMenu === s.id ? null : s.id)}
                        style={{ background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#64748B' }}
                      >
                        <MoreVertical size={15} />
                      </button>
                      {openMenu === s.id && (
                        <div style={{ position: 'absolute', right: 0, top: 36, background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
                          {[
                            { label: 'Visualizar pesquisa', icon: <ExternalLink size={13} />, action: () => window.open(surveyLink(s.survey_token), '_blank') },
                            { label: 'Copiar link', icon: <Copy size={13} />, action: () => copyLink(s.survey_token) },
                            ...(s.survey_mode === 'custom' ? [{ label: 'Editar perguntas', icon: <Pencil size={13} />, action: () => { setOpenMenu(null); openEditor(s) } }] : []),
                            { label: 'Ver respostas', icon: <Eye size={13} />, action: () => { setOpenMenu(null); openResponses(s) } },
                            { label: 'Gerar relatório IA', icon: <Brain size={13} />, action: () => { setOpenMenu(null); openResponses(s); setActiveTab('ai') } },
                            ...(s.status !== 'closed' ? [{ label: 'Encerrar pesquisa', icon: <StopCircle size={13} />, action: () => { setOpenMenu(null); closeSurvey(s.id) } }] : []),
                            { label: 'Excluir', icon: <X size={13} />, action: () => { setOpenMenu(null); deleteSurvey(s.id, s.response_count ?? 0) }, danger: true },
                          ].map((item, i) => (
                            <button key={i} onClick={item.action}
                              style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 500, color: (item as any).danger ? '#EF4444' : '#374151', display: 'flex', alignItems: 'center', gap: 8 }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                            >
                              {item.icon} {item.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {openMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpenMenu(null)} />}

      {/* Modal nova pesquisa */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Nova pesquisa</h2>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>

            {newModalStep === 'mode' ? (
              <div>
                <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 18px' }}>Qual tipo de pesquisa você quer usar?</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <button
                    onClick={() => { setPendingMode('default'); setNewModalStep('form') }}
                    style={{ textAlign: 'left', padding: 20, borderRadius: 14, border: '2px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer' }}
                  >
                    <ClipboardList size={22} color="#F97316" style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Pesquisa padrão do sistema</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>7 perguntas fixas, prontas para usar imediatamente</p>
                  </button>
                  <button
                    onClick={() => { setPendingMode('custom'); setNewModalStep('form') }}
                    style={{ textAlign: 'left', padding: 20, borderRadius: 14, border: '2px solid #E2E8F0', background: '#F8FAFC', cursor: 'pointer' }}
                  >
                    <Sparkles size={22} color="#00A896" style={{ marginBottom: 10 }} />
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A2B4A', margin: '0 0 4px' }}>Criar minha própria pesquisa</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Personalize as perguntas e os tipos de resposta</p>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <button onClick={() => setNewModalStep('mode')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 12, padding: 0 }}>
                  ← Trocar tipo de pesquisa
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: pendingMode === 'custom' ? '#00A896' : '#F97316' }}>
                  {pendingMode === 'custom' ? <Sparkles size={14} /> : <ClipboardList size={14} />}
                  {pendingMode === 'custom' ? 'Pesquisa personalizada' : 'Pesquisa padrão do sistema'}
                </div>
                <div>
                  <label style={labelStyle}>Título da pesquisa *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder='Ex: Pesquisa de Satisfação 2026' style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Descrição (opcional)</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder='Informe às famílias o objetivo desta pesquisa...' rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
                </div>

                {/* Toggle identificação */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderRadius: 12 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2B4A', margin: '0 0 2px' }}>Solicitar identificação da família</p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Formulário pedirá nome e série antes das perguntas</p>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, askId: !f.askId }))}
                    style={{ width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', background: form.askId ? '#00A896' : '#CBD5E1', position: 'relative', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: 3, left: form.askId ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                  </button>
                </div>

                {pendingMode === 'custom' && (
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px' }}>
                    Depois de criar, você vai montar as perguntas no editor. A pesquisa fica como rascunho até você publicar.
                  </p>
                )}

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={() => setShowNewModal(false)} style={btn('#F1F5F9', '#374151')}>Cancelar</button>
                  <button onClick={createSurvey} disabled={!form.title.trim() || saving} style={{ ...btn('#00A896'), opacity: !form.title.trim() || saving ? 0.6 : 1 }}>
                    {saving ? 'Criando...' : pendingMode === 'custom' ? 'Criar e montar perguntas' : 'Criar pesquisa'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal editor de perguntas (pesquisa custom) */}
      {editorSurvey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 620, maxHeight: '90vh', overflowY: 'auto', padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{editorSurvey.title}</h2>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                  {editorSurvey.status === 'draft' ? 'Rascunho — publique quando as perguntas estiverem prontas' : 'Pesquisa ativa'}
                </p>
              </div>
              <button onClick={closeEditor} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
              <button onClick={() => window.open(surveyLink(editorSurvey.survey_token), '_blank')} style={{ ...btn('#F1F5F9', '#374151'), fontSize: 12 }}>
                <ExternalLink size={13} /> Visualizar pesquisa
              </button>
              {editorSurvey.status === 'draft' && (
                <button onClick={publishEditorSurvey} style={{ ...btn('#00A896'), fontSize: 12 }}>
                  <Send size={13} /> Publicar pesquisa
                </button>
              )}
            </div>

            {loadingEditor ? (
              <p style={{ textAlign: 'center', color: '#94A3B8', padding: 32 }}>Carregando...</p>
            ) : (
              <>
                <DndContext sensors={dndSensors} onDragEnd={handleQuestionDragEnd}>
                  <SortableContext items={editorQuestions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {editorQuestions.map(q => (
                        <SortableQuestionRow key={q.id} question={q} onEdit={() => openQuestionForm(q)} onDelete={() => deleteQuestion(q.id)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                {editorQuestions.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '16px', background: '#F8FAFC', borderRadius: 10, border: '1px dashed #E2E8F0', marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>Nenhuma pergunta ainda. Adicione ao menos uma para publicar.</p>
                  </div>
                )}

                <button onClick={() => openQuestionForm('new')} style={{ ...btn('#F0FDF4', '#16A34A'), border: '1px solid #BBF7D0', padding: '8px 14px', fontSize: 12, marginBottom: 20 }}>
                  <Plus size={13} /> Adicionar pergunta
                </button>

                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
                  <label style={labelStyle}>URL de redirecionamento após resposta (opcional)</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={redirectDraft} onChange={e => setRedirectDraft(e.target.value)} placeholder='https://...' style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={saveRedirectUrl} style={btn('#F1F5F9', '#374151')}>Salvar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal adicionar/editar pergunta */}
      {showQuestionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>{showQuestionModal === 'new' ? 'Nova pergunta' : 'Editar pergunta'}</h3>
              <button onClick={() => setShowQuestionModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Tipo de pergunta</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {QUESTION_TYPES.map(t => {
                    const Icon = t.icon
                    const active = questionForm.question_type === t.type
                    return (
                      <button key={t.type} onClick={() => setQuestionForm(q => ({ ...q, question_type: t.type }))}
                        style={{ padding: '10px 12px', borderRadius: 10, border: `2px solid ${active ? '#00A896' : '#E2E8F0'}`, background: active ? '#E6F7F5' : '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: active ? '#00A896' : '#64748B' }}>
                        <Icon size={14} /> {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>Título da pergunta *</label>
                <input value={questionForm.title} onChange={e => setQuestionForm(q => ({ ...q, title: e.target.value }))} placeholder='Ex: Como você avalia a comunicação da escola?' style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Descrição / subtítulo (opcional)</label>
                <input value={questionForm.description} onChange={e => setQuestionForm(q => ({ ...q, description: e.target.value }))} placeholder='Contexto adicional para a pergunta' style={inputStyle} />
              </div>

              {(questionForm.question_type === 'scale' || questionForm.question_type === 'nps') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>Label mínimo</label>
                    <input value={questionForm.min_label} onChange={e => setQuestionForm(q => ({ ...q, min_label: e.target.value }))} placeholder={questionForm.question_type === 'nps' ? 'Nada provável' : 'Péssimo'} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Label máximo</label>
                    <input value={questionForm.max_label} onChange={e => setQuestionForm(q => ({ ...q, max_label: e.target.value }))} placeholder={questionForm.question_type === 'nps' ? 'Muito provável' : 'Ótimo'} style={inputStyle} />
                  </div>
                </div>
              )}

              {questionForm.question_type === 'multiple_choice' && (
                <div>
                  <label style={labelStyle}>Opções (mínimo 2)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {questionForm.options.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6 }}>
                        <input value={opt} onChange={e => { const opts = [...questionForm.options]; opts[i] = e.target.value; setQuestionForm(q => ({ ...q, options: opts })) }} placeholder={`Opção ${i + 1}`} style={{ ...inputStyle, flex: 1 }} />
                        {questionForm.options.length > 2 && (
                          <button onClick={() => setQuestionForm(q => ({ ...q, options: q.options.filter((_, fi) => fi !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}><X size={14} /></button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setQuestionForm(q => ({ ...q, options: [...q.options, ''] }))}
                      style={{ fontSize: 12, color: '#00A896', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '4px 0' }}>
                      + Adicionar opção
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Obrigatória</span>
                <button onClick={() => setQuestionForm(q => ({ ...q, required: !q.required }))}
                  style={{ width: 40, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: questionForm.required ? '#00A896' : '#CBD5E1', position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: questionForm.required ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowQuestionModal(null)} style={btn('#F1F5F9', '#374151')}>Cancelar</button>
                <button onClick={saveQuestion} disabled={!questionForm.title.trim()} style={{ ...btn('#00A896'), opacity: !questionForm.title.trim() ? 0.6 : 1 }}>
                  {showQuestionModal === 'new' ? 'Adicionar pergunta' : 'Salvar pergunta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal link gerado */}
      {showLinkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 480, padding: 32, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, background: '#F0FDF4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '3px solid #BBF7D0' }}>
              <Check size={28} color="#16A34A" />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1A2B4A', margin: '0 0 8px' }}>Pesquisa criada!</h2>
            <p style={{ fontSize: 14, color: '#64748B', margin: '0 0 24px' }}>Compartilhe o link abaixo com as famílias via WhatsApp, e-mail ou redes sociais.</p>
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
              <span style={{ fontSize: 12, color: '#64748B', wordBreak: 'break-all', lineHeight: 1.4 }}>
                {surveyLink(showLinkModal.survey.survey_token)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => { navigator.clipboard.writeText(surveyLink(showLinkModal.survey.survey_token)); showToast('Link copiado!') }} style={btn('#00A896')}>
                <Copy size={15} /> Copiar link
              </button>
              <button onClick={() => setShowLinkModal(null)} style={btn('#F1F5F9', '#374151')}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}