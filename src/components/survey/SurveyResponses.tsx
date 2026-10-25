import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Brain, Check, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUpDown, SlidersHorizontal, Search, FileDown, Sparkles, UserRound, TrendingUp, AlertTriangle,
} from 'lucide-react'
import { cardBtn } from '../mobile/StatStrip'
import { Sheet, EmptyState } from './ui'
import {
  Survey, QuestionRow, SurveyResponse, AiReport, ReenrollBucket, ReenrollmentBadge, SEGMENT_OPTIONS, Segment,
  fmt, avg, npsFromScores, respondentOverallScore10, PIE_COLORS, card, cardCompact, labelStyle, inputStyle, sectionTitle,
} from './surveyShared'

const GREEN = '#05907B'

// ─── barra de progresso simples (nota de 1 a 5, etc.) ──────────────────────
function ProgressRow({ label, value, max, shown, labelWidth = 120, color = GREEN }: {
  label: string; value: number | null | undefined; max: number; shown?: string; labelWidth?: number; color?: string
}) {
  const has = typeof value === 'number' && !isNaN(value)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontSize: 12.5, color: '#5B6B86', width: labelWidth, flexShrink: 0, lineHeight: 1.25 }}>{label}</span>}
      <div style={{ flex: 1, height: 8, background: '#E8EEF3', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${has ? Math.max(0, Math.min(100, (value! / max) * 100)) : 0}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#1A2B4A', width: 34, textAlign: 'right', flexShrink: 0 }}>{has ? (shown ?? String(value)) : '—'}</span>
    </div>
  )
}

export function CategoryBars({ data, labelWidth }: { data: { name: string; value: number }[]; labelWidth?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map(d => <ProgressRow key={d.name} label={d.name} value={d.value} max={5} shown={d.value.toFixed(1)} labelWidth={labelWidth ?? 112} />)}
    </div>
  )
}

// ─── relatório por pergunta (pesquisas personalizadas) ─────────────────────
export function CustomSurveyReport({ questions, responses, isMobile }: { questions: QuestionRow[]; responses: SurveyResponse[]; isMobile: boolean }) {
  const [expandedText, setExpandedText] = useState<Record<string, boolean>>({})

  if (questions.length === 0) {
    return <EmptyState icon={Sparkles} title="Esta pesquisa não tem perguntas" hint="Abra “Editar perguntas” para montar o formulário." />
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {questions.map((q, qi) => {
        const values = responses
          .map(r => r.custom_answers?.[q.id])
          .filter(v => v !== undefined && v !== null && v !== '')

        return (
          <div key={q.id} style={cardCompact}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ width: 26, height: 26, borderRadius: 9, background: '#E6F7F5', color: '#00695F', fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{qi + 1}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#1A2B4A', margin: 0, lineHeight: 1.35 }}>{q.title}</p>
                <p style={{ fontSize: 12, color: '#5B6B86', margin: '2px 0 0', fontWeight: 600 }}>
                  {values.length} resposta{values.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {(q.question_type === 'scale' || q.question_type === 'nps') && (() => {
              const nums = values.filter(v => typeof v === 'number') as number[]
              const min = q.question_type === 'nps' ? 0 : (q.options?.min ?? 1)
              const max = q.question_type === 'nps' ? 10 : (q.options?.max ?? 5)
              const buckets = Array.from({ length: max - min + 1 }, (_, i) => i + min)
              const barData = buckets.map(n => ({ name: String(n), value: nums.filter(v => v === n).length }))
              const average = avg(nums)
              // Pergunta nps é 0–10 de verdade: dá pra calcular o NPS real (%promotores − %detratores).
              const nps = q.question_type === 'nps' ? npsFromScores(nums) : null
              return (
                <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 22, flexShrink: 0, justifyContent: isMobile ? 'flex-start' : 'center', minWidth: isMobile ? 0 : 150 }}>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, color: '#1A2B4A', lineHeight: 1 }}>{average.toFixed(1)}</div>
                      <p style={{ fontSize: 11.5, color: '#5B6B86', margin: '4px 0 0' }}>média (0–{max})</p>
                    </div>
                    {nps !== null && (
                      <div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: nps >= 0 ? '#10B981' : '#EF4444', lineHeight: 1 }}>{nps >= 0 ? '+' : ''}{nps}</div>
                        <p style={{ fontSize: 11.5, color: '#5B6B86', margin: '4px 0 0' }}>NPS</p>
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
                    <ResponsiveContainer width="100%" height={isMobile ? 130 : 120}>
                      <BarChart data={barData} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={24} />
                        <RTooltip />
                        <Bar dataKey="value" fill={GREEN} radius={[4, 4, 0, 0]} />
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
              if (pieData.length === 0) return <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Sem respostas ainda.</p>
              return (
                <div style={{ display: 'flex', gap: isMobile ? 12 : 24, alignItems: 'center', flexDirection: isMobile ? 'column' : 'row' }}>
                  <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={68} paddingAngle={2}>
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, width: '100%', minWidth: 0 }}>
                    {pieData.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <div style={{ width: 11, height: 11, borderRadius: 4, background: entry.color, flexShrink: 0 }} />
                        <span style={{ color: '#334155', flex: 1, minWidth: 0 }}>{entry.name}</span>
                        <span style={{ fontWeight: 800, color: '#1A2B4A' }}>{entry.value}</span>
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
                    <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>Sem respostas ainda.</p>
                  ) : (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: isExpanded ? 420 : undefined, overflowY: isExpanded ? 'auto' : undefined }}>
                        {visible.map((t, i) => (
                          <p key={i} style={{ fontSize: 13.5, color: '#334155', background: '#F5FAF9', border: '1px solid #E3E8F0', borderRadius: 12, padding: '9px 12px', margin: 0, lineHeight: 1.45 }}>“{t}”</p>
                        ))}
                      </div>
                      {texts.length > 5 && (
                        <button onClick={() => setExpandedText(prev => ({ ...prev, [q.id]: !isExpanded }))}
                          style={{ ...cardBtn('ghost'), flex: '0 0 auto', alignSelf: 'flex-start', minHeight: 38, color: '#00695F' }}>
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

// ─── filtros ───────────────────────────────────────────────────────────────
export interface FilterState {
  isDefault: boolean
  dateFrom: string; setDateFrom: (v: string) => void
  dateTo: string; setDateTo: (v: string) => void
  segment: Segment | ''; setSegment: (v: Segment | '') => void
  grades: string[]; setGrades: (v: string[]) => void
  gradeOptions: string[]
  name: string; setName: (v: string) => void
  reenrollment: string; setReenrollment: (v: string) => void
  onClear: () => void
}

export function activeFilterCount(f: Pick<FilterState, 'segment' | 'grades' | 'name' | 'reenrollment'>) {
  return (f.segment ? 1 : 0) + (f.grades.length > 0 ? 1 : 0) + (f.name.trim() ? 1 : 0) + (f.reenrollment ? 1 : 0)
}

function MultiSelectDropdown({ label, options, selected, onChange, placeholder = 'Todas' }: {
  label: string; options: string[]; selected: string[]; onChange: (next: string[]) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const allSelected = selected.length === 0
  const buttonLabel = allSelected ? placeholder : selected.length === 1 ? selected[0] : `${selected.length} selecionadas`
  const toggleOne = (opt: string) => onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ ...inputStyle, width: 210, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{buttonLabel}</span>
        <ChevronDown size={14} color="#94A3B8" />
      </button>
      {open && (
        <div style={{ position: 'absolute', left: 0, top: 70, background: '#fff', border: '1px solid #E3E8F0', borderRadius: 14, boxShadow: '0 12px 30px -10px rgba(26,43,74,.25)', zIndex: 100, minWidth: 210, maxHeight: 260, overflowY: 'auto', padding: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, fontWeight: 700, color: '#1A2B4A', cursor: 'pointer', borderRadius: 8 }}>
            <input type="checkbox" checked={allSelected} onChange={() => onChange([])} /> Todas
          </label>
          {options.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94A3B8', padding: '8px 10px', margin: 0 }}>Nenhuma opção.</p>
          ) : options.map(opt => (
            <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', fontSize: 13, color: '#334155', cursor: 'pointer', borderRadius: 8 }}>
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggleOne(opt)} /> {opt}
            </label>
          ))}
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
    </div>
  )
}

// Computador: barra de filtros em cartão
export function FiltersBar(f: FilterState) {
  return (
    <div style={{ ...card, padding: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 14 }}>
      <div>
        <label style={labelStyle}>De</label>
        <input type="date" value={f.dateFrom} onChange={e => f.setDateFrom(e.target.value)} style={{ ...inputStyle, width: 160 }} />
      </div>
      <div>
        <label style={labelStyle}>Até</label>
        <input type="date" value={f.dateTo} onChange={e => f.setDateTo(e.target.value)} style={{ ...inputStyle, width: 160 }} />
      </div>
      <div>
        <label style={labelStyle}>Segmento</label>
        <select value={f.segment} onChange={e => { f.setSegment(e.target.value as Segment | ''); f.setGrades([]) }} style={{ ...inputStyle, width: 160 }}>
          <option value="">Todos</option>
          {SEGMENT_OPTIONS.map(seg => <option key={seg} value={seg}>{seg}</option>)}
        </select>
      </div>
      <MultiSelectDropdown label="Série / turma" options={f.gradeOptions} selected={f.grades} onChange={f.setGrades} placeholder="Todas as séries" />
      <div style={{ flex: 1, minWidth: 190 }}>
        <label style={labelStyle}>Buscar por nome</label>
        <div style={{ position: 'relative' }}>
          <Search size={15} color="#94A3B8" style={{ position: 'absolute', left: 12, top: 15 }} />
          <input value={f.name} onChange={e => f.setName(e.target.value)} placeholder="Nome de quem respondeu..." style={{ ...inputStyle, paddingLeft: 34 }} />
        </div>
      </div>
      {f.isDefault && (
        <div>
          <label style={labelStyle}>Rematrícula</label>
          <select value={f.reenrollment} onChange={e => f.setReenrollment(e.target.value)} style={{ ...inputStyle, width: 140 }}>
            <option value="">Todos</option>
            <option value="sim">Sim</option>
            <option value="nao">Não</option>
            <option value="talvez">Talvez</option>
          </select>
        </div>
      )}
      <button type="button" onClick={f.onClear} style={{ ...cardBtn('ghost'), flex: '0 0 auto', minHeight: 44 }}>Limpar filtros</button>
    </div>
  )
}

// Celular: resumo + botão que abre os filtros em tela cheia
export function FiltersSummary({ f, total, onOpen }: { f: FilterState; total: number; onOpen: () => void }) {
  const n = activeFilterCount(f)
  const fmtIso = (iso: string) => iso ? iso.split('-').reverse().slice(0, 2).join('/') : '…'
  const parts = [`${fmtIso(f.dateFrom)} a ${fmtIso(f.dateTo)}`]
  if (f.segment) parts.push(f.segment)
  if (f.grades.length) parts.push(f.grades.length === 1 ? f.grades[0] : `${f.grades.length} séries`)
  return (
    <button type="button" onClick={onOpen} className="ld-card aion-tap"
      style={{ ...card, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
      <span style={{ width: 36, height: 36, borderRadius: 12, background: '#E6F7F5', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
        <SlidersHorizontal size={17} />
        {n > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 99, background: '#DC2626', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{n}</span>}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 800, color: '#1A2B4A' }}>Filtros · {total} resposta{total !== 1 ? 's' : ''}</span>
        <span style={{ display: 'block', fontSize: 12, color: '#5B6B86', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parts.join(' · ')}</span>
      </span>
      <ChevronRight size={18} color="#94A3B8" />
    </button>
  )
}

export function FiltersSheet({ f, total, onClose }: { f: FilterState; total: number; onClose: () => void }) {
  const chip = (on: boolean): React.CSSProperties => ({
    minHeight: 40, padding: '8px 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    border: on ? 'none' : '1px solid #E3E8F0', background: on ? 'var(--aion-grad)' : '#fff', color: on ? '#fff' : '#5B6B86',
  })
  return (
    <Sheet onClose={onClose} icon={SlidersHorizontal} title="Filtros" subtitle={`${total} resposta${total !== 1 ? 's' : ''} com os filtros atuais`}
      footer={<>
        <button type="button" onClick={f.onClear} style={cardBtn('ghost')}>Limpar filtros</button>
        <button type="button" onClick={onClose} style={cardBtn('primary')}>Ver resultados</button>
      </>}>
      <div style={{ ...card, padding: 14 }}>
        <p style={{ ...sectionTitle, marginBottom: 10 }}>Período</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 140px' }}>
            <label style={labelStyle}>De</label>
            <input type="date" value={f.dateFrom} onChange={e => f.setDateFrom(e.target.value)} style={inputStyle} />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <label style={labelStyle}>Até</label>
            <input type="date" value={f.dateTo} onChange={e => f.setDateTo(e.target.value)} style={inputStyle} />
          </div>
        </div>
      </div>

      <div style={{ ...card, padding: 14 }}>
        <p style={{ ...sectionTitle, marginBottom: 10 }}>Segmento</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" style={chip(f.segment === '')} onClick={() => { f.setSegment(''); f.setGrades([]) }}>Todos</button>
          {SEGMENT_OPTIONS.map(seg => (
            <button key={seg} type="button" style={chip(f.segment === seg)} onClick={() => { f.setSegment(seg); f.setGrades([]) }}>{seg}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 14 }}>
        <p style={{ ...sectionTitle, marginBottom: 10 }}>Série / turma</p>
        {f.gradeOptions.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#94A3B8' }}>Nenhuma série informada nas respostas.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" style={chip(f.grades.length === 0)} onClick={() => f.setGrades([])}>Todas</button>
            {f.gradeOptions.map(g => {
              const on = f.grades.includes(g)
              return <button key={g} type="button" style={chip(on)} onClick={() => f.setGrades(on ? f.grades.filter(x => x !== g) : [...f.grades, g])}>{g}</button>
            })}
          </div>
        )}
      </div>

      <div style={{ ...card, padding: 14 }}>
        <p style={{ ...sectionTitle, marginBottom: 10 }}>Nome</p>
        <input value={f.name} onChange={e => f.setName(e.target.value)} placeholder="Buscar por nome..." style={inputStyle} />
      </div>

      {f.isDefault && (
        <div style={{ ...card, padding: 14 }}>
          <p style={{ ...sectionTitle, marginBottom: 10 }}>Rematrícula</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {([['', 'Todos'], ['sim', 'Sim'], ['talvez', 'Talvez'], ['nao', 'Não']] as const).map(([k, l]) => (
              <button key={k} type="button" style={chip(f.reenrollment === k)} onClick={() => f.setReenrollment(k)}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  )
}

// ─── pílulas de rematrícula (aba Respostas) ────────────────────────────────
const PILL_ACCENT: Record<'' | ReenrollBucket, string> = { '': GREEN, sim: '#10B981', talvez: '#F59E0B', nao: '#EF4444' }

export function ReenrollmentPills({ value, counts, onChange }: {
  value: '' | ReenrollBucket
  counts: { total: number; sim: number; nao: number; talvez: number }
  onChange: (v: '' | ReenrollBucket) => void
}) {
  const options: { key: '' | ReenrollBucket; label: string; count: number }[] = [
    { key: '', label: 'Todos', count: counts.total },
    { key: 'sim', label: 'Vai renovar', count: counts.sim },
    { key: 'talvez', label: 'Talvez', count: counts.talvez },
    { key: 'nao', label: 'Não vai renovar', count: counts.nao },
  ]
  return (
    <div className="aion-hscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px', padding: '2px 12px' }}>
      {options.map(opt => {
        const active = value === opt.key
        const accent = PILL_ACCENT[opt.key]
        return (
          <button key={opt.key || 'todos'} onClick={() => onChange(opt.key)} className="aion-tap"
            style={{ flexShrink: 0, minHeight: 38, padding: '7px 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', border: `1.5px solid ${accent}`, background: active ? accent : '#fff', color: active ? '#fff' : accent }}>
            {opt.label} ({opt.count})
          </button>
        )
      })}
    </div>
  )
}

// ─── lista de respostas individuais ────────────────────────────────────────
export type SortColumn = 'name' | 'grade' | 'score' | 'reenrollment' | 'date'

const CATEGORY_LABELS: { key: 'general' | 'teaching' | 'communication' | 'infrastructure' | 'cost_benefit'; label: string }[] = [
  { key: 'general', label: 'Satisfação geral' },
  { key: 'teaching', label: 'Ensino' },
  { key: 'communication', label: 'Atendimento' },
  { key: 'infrastructure', label: 'Infraestrutura' },
  { key: 'cost_benefit', label: 'Custo-benefício' },
]

function scoreColorOf(score10: number) { return score10 >= 8 ? '#10B981' : score10 >= 6 ? '#F59E0B' : '#EF4444' }

function ResponseDetails({ r, isDefault, questions }: { r: SurveyResponse; isDefault: boolean; questions: QuestionRow[] }) {
  if (isDefault) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
        {CATEGORY_LABELS.map(c => <ProgressRow key={c.key} label={c.label} value={r.answers?.[c.key] as number | undefined} max={5} labelWidth={116} />)}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 560 }}>
      {questions.map(q => {
        const val = r.custom_answers?.[q.id]
        return (
          <div key={q.id}>
            <p style={{ fontSize: 12, color: '#5B6B86', margin: '0 0 4px', fontWeight: 700, lineHeight: 1.35 }}>{q.title}</p>
            {val === undefined || val === null || val === '' ? (
              <span style={{ fontSize: 13, color: '#94A3B8' }}>Não respondida</span>
            ) : q.question_type === 'scale' || q.question_type === 'nps' ? (
              <ProgressRow label="" labelWidth={0} value={Number(val)} max={q.question_type === 'nps' ? 10 : (q.options?.max ?? 5)} />
            ) : q.question_type === 'multiple_choice' ? (
              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, background: '#EFF6FF', color: '#1E40AF' }}>{String(val)}</span>
            ) : (
              <p style={{ fontSize: 13.5, color: '#334155', margin: 0, lineHeight: 1.45 }}>“{String(val)}”</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Pager({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6 }}>
      <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}
        style={{ ...cardBtn('ghost'), flex: '0 0 auto', opacity: page <= 1 ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <ChevronLeft size={15} /> Anterior
      </button>
      <span style={{ fontSize: 13, color: '#5B6B86', fontWeight: 700, whiteSpace: 'nowrap' }}>{page} de {totalPages}</span>
      <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}
        style={{ ...cardBtn('ghost'), flex: '0 0 auto', opacity: page >= totalPages ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        Próxima <ChevronRight size={15} />
      </button>
    </div>
  )
}

function SortableTh({ label, column, sortColumn, sortDir, onSort }: {
  label: string; column: SortColumn | null; sortColumn: SortColumn; sortDir: 'asc' | 'desc'; onSort: (c: SortColumn) => void
}) {
  const active = column !== null && column === sortColumn
  return (
    <th onClick={column ? () => onSort(column) : undefined}
      style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12.5, color: active ? GREEN : '#5B6B86', borderBottom: '1px solid #E3E8F0', whiteSpace: 'nowrap', cursor: column ? 'pointer' : 'default', userSelect: 'none' }}>
      {label}{active && (sortDir === 'asc' ? ' ▲' : ' ▼')}
    </th>
  )
}

export function ResponsesList({
  isMobile, isDefault, loading, rows, questions, sortColumn, sortDir, onSort, onToggleDir,
  expandedRowId, onToggleExpand, onViewContact, page, pageSize, totalCount, onPageChange,
}: {
  isMobile: boolean; isDefault: boolean; loading: boolean; rows: SurveyResponse[]; questions: QuestionRow[]
  sortColumn: SortColumn; sortDir: 'asc' | 'desc'; onSort: (c: SortColumn) => void; onToggleDir: () => void
  expandedRowId: string | null; onToggleExpand: (id: string) => void; onViewContact: (name: string) => void
  page: number; pageSize: number; totalCount: number; onPageChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const sortOptions: { key: SortColumn; label: string }[] = [
    { key: 'date', label: 'Data' }, { key: 'name', label: 'Nome' }, { key: 'grade', label: 'Série' },
    ...(isDefault ? [{ key: 'score' as const, label: 'Nota geral' }, { key: 'reenrollment' as const, label: 'Rematrícula' }] : []),
  ]

  const body = loading ? (
    <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 14 }}>Carregando...</div>
  ) : rows.length === 0 ? (
    <EmptyState icon={UserRound} title="Nenhuma resposta" hint="Nenhuma resposta com os filtros atuais." />
  ) : isMobile ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map(r => {
        const open = expandedRowId === r.id
        const score10 = respondentOverallScore10(r)
        const initial = (r.respondent_name || '?').trim().charAt(0).toUpperCase()
        return (
          <div key={r.id} className="ld-card" style={{ ...card, padding: 0, overflow: 'hidden', borderColor: open ? '#BDEBE4' : '#E3E8F0' }}>
            <button type="button" onClick={() => onToggleExpand(r.id)} className="aion-tap"
              style={{ width: '100%', background: 'none', border: 'none', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span style={{ width: 40, height: 40, borderRadius: 14, background: r.respondent_name ? '#E6F7F5' : '#F1F5F9', color: r.respondent_name ? '#00695F' : '#94A3B8', fontWeight: 800, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initial}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: '#1A2B4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.respondent_name || 'Anônimo'}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: '#5B6B86', marginTop: 1 }}>
                  {[r.respondent_grade, fmt(r.created_at)].filter(Boolean).join(' · ')}
                </span>
                {isDefault && (
                  <span style={{ display: 'block', marginTop: 6 }}><ReenrollmentBadge value={r.answers?.reenrollment as string | undefined} /></span>
                )}
              </span>
              {isDefault && (
                <span style={{ textAlign: 'center', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontSize: 20, fontWeight: 800, color: scoreColorOf(score10), lineHeight: 1 }}>{score10.toFixed(1)}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: '#94A3B8', marginTop: 2 }}>nota</span>
                </span>
              )}
              {open ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </button>
            {open && (
              <div style={{ padding: '4px 14px 14px', borderTop: '1px solid #EEF2F6', background: '#FAFEFD', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ paddingTop: 12 }}><ResponseDetails r={r} isDefault={isDefault} questions={questions} /></div>
                {r.respondent_name && (
                  <button type="button" onClick={() => onViewContact(r.respondent_name!)} style={{ ...cardBtn('ghost'), flex: '0 0 auto' }}>Ver em Contatos</button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  ) : (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: '#F5FAF9' }}>
            <th style={{ width: 28, borderBottom: '1px solid #E3E8F0' }} />
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
            const open = expandedRowId === r.id
            const score10 = respondentOverallScore10(r)
            return (
              <React.Fragment key={r.id}>
                <tr onClick={() => onToggleExpand(r.id)} style={{ borderBottom: '1px solid #EEF2F6', cursor: 'pointer', background: open ? '#F0FDFB' : undefined }}>
                  <td style={{ padding: '11px 8px 11px 14px', color: '#94A3B8' }}>{open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</td>
                  <td style={{ padding: '11px 14px', color: '#1A2B4A', fontWeight: 700 }}>
                    {r.respondent_name || <span style={{ color: '#94A3B8', fontStyle: 'italic', fontWeight: 500 }}>Anônimo</span>}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#5B6B86' }}>{r.respondent_grade || '—'}</td>
                  {isDefault && <td style={{ padding: '11px 14px' }}><span style={{ fontWeight: 800, color: scoreColorOf(score10) }}>{score10.toFixed(1)}</span></td>}
                  {isDefault && <td style={{ padding: '11px 14px' }}><ReenrollmentBadge value={r.answers?.reenrollment as string | undefined} /></td>}
                  <td style={{ padding: '11px 14px', color: '#5B6B86', whiteSpace: 'nowrap' }}>{fmt(r.created_at)}</td>
                  <td style={{ padding: '11px 14px' }} onClick={e => e.stopPropagation()}>
                    {r.respondent_name && (
                      <button onClick={() => onViewContact(r.respondent_name!)} style={{ ...cardBtn('ghost'), flex: '0 0 auto', minHeight: 32, padding: '4px 10px', fontSize: 12, whiteSpace: 'nowrap' }}>Ver em Contatos</button>
                    )}
                  </td>
                </tr>
                {open && (
                  <tr style={{ background: '#FAFEFD', borderBottom: '1px solid #EEF2F6' }}>
                    <td colSpan={isDefault ? 7 : 5} style={{ padding: '10px 14px 18px 46px' }}>
                      <ResponseDetails r={r} isDefault={isDefault} questions={questions} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <p style={{ ...sectionTitle, fontSize: 14 }}>Respostas individuais ({totalCount})</p>
        {isMobile && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={sortColumn} onChange={e => onSort(e.target.value as SortColumn)} aria-label="Ordenar por"
              style={{ ...inputStyle, width: 'auto', minHeight: 38, padding: '6px 10px', fontSize: 13, fontWeight: 700 }}>
              {sortOptions.map(o => <option key={o.key} value={o.key}>Ordenar: {o.label}</option>)}
            </select>
            <button type="button" onClick={onToggleDir} aria-label={sortDir === 'asc' ? 'Ordem crescente' : 'Ordem decrescente'} className="aion-tap"
              style={{ width: 38, height: 38, borderRadius: 12, border: '1px solid #E3E8F0', background: '#fff', color: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              {sortDir === 'asc' ? <ChevronUp size={17} /> : <ArrowUpDown size={16} />}
            </button>
          </div>
        )}
      </div>
      {isMobile ? body : <div style={{ ...card, padding: 0, overflow: 'hidden' }}>{body}</div>}
      <Pager page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  )
}

// ─── aba "Relatório IA" ────────────────────────────────────────────────────
export function AiReportTab({ isMobile, survey, report, generating, hasResponses, onGenerate }: {
  isMobile: boolean; survey: Survey; report: AiReport | null; generating: boolean; hasResponses: boolean; onGenerate: () => void
}) {
  const sc = report ? Number(report.overall_score) : 0
  const scColor = sc >= 8 ? '#10B981' : sc >= 6 ? '#F59E0B' : '#EF4444'
  const riskCfg = { baixo: { bg: '#D1FAE5', color: '#065F46' }, médio: { bg: '#FEF3C7', color: '#92400E' }, alto: { bg: '#FEE2E2', color: '#991B1B' } }
  const rc = report ? (riskCfg[report.reenrollment_risk as keyof typeof riskCfg] ?? riskCfg.médio) : riskCfg.médio
  const blockTitle = (t: string, color: string): React.CSSProperties => ({ fontSize: 12, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.04em', margin: '0 0 10px' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ width: 40, height: 40, borderRadius: 14, background: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Brain size={20} /></span>
        <div style={{ flex: 1, minWidth: 150 }}>
          <p style={{ fontSize: 14.5, fontWeight: 800, color: '#1A2B4A', margin: 0 }}>Análise gerada por IA</p>
          <p style={{ fontSize: 12.5, color: '#5B6B86', margin: '2px 0 0' }}>
            {survey.ai_analysis_generated_at ? `Gerada em ${fmt(survey.ai_analysis_generated_at)}` : 'Resume as respostas e sugere o que fazer.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', width: isMobile ? '100%' : undefined }}>
          <button onClick={onGenerate} disabled={generating || !hasResponses}
            style={{ ...cardBtn('primary'), flex: isMobile ? '1 1 140px' : '0 0 auto', opacity: generating || !hasResponses ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Brain size={15} /> {generating ? 'Gerando...' : report ? 'Gerar novamente' : 'Gerar relatório'}
          </button>
          {report && (
            <button onClick={() => window.print()} style={{ ...cardBtn('ghost'), flex: isMobile ? '1 1 120px' : '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <FileDown size={15} /> Exportar PDF
            </button>
          )}
        </div>
      </div>

      {generating ? (
        <div style={{ ...card, textAlign: 'center', padding: 44 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #7C3AED', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#7C3AED', fontWeight: 700, margin: 0 }}>Analisando as respostas com IA...</p>
        </div>
      ) : !report ? (
        <EmptyState icon={Brain} title="Nenhuma análise gerada ainda"
          hint={!hasResponses ? 'É preciso ter respostas no período filtrado.' : 'Toque em “Gerar relatório” para a IA resumir as respostas.'} />
      ) : (
        <>
          <div style={{ ...card, textAlign: 'center', padding: '22px 16px' }}>
            <div style={{ fontSize: 60, fontWeight: 800, color: scColor, lineHeight: 1, letterSpacing: '-.02em' }}>{sc.toFixed(1)}</div>
            <p style={{ color: '#5B6B86', margin: '4px 0 12px', fontSize: 13 }}>nota geral, de 0 a 10</p>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 800, background: rc.bg, color: rc.color }}>
              Risco de rematrícula: {report.reenrollment_risk}
            </span>
          </div>

          <div style={cardCompact}>
            <p style={blockTitle('', '#5B6B86')}>Resumo executivo</p>
            <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.6 }}>{report.summary}</p>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12 }}>
            <div style={{ ...cardCompact, flex: 1, background: '#F6FEF9', borderColor: '#BBF7D0' }}>
              <p style={blockTitle('', '#065F46')}>Pontos fortes</p>
              {(report.strengths || []).map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: '#334155', marginBottom: 8, lineHeight: 1.45 }}>
                  <Check size={15} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} /> <span>{s}</span>
                </div>
              ))}
            </div>
            <div style={{ ...cardCompact, flex: 1, background: '#FFF8F8', borderColor: '#FECACA' }}>
              <p style={blockTitle('', '#991B1B')}>Pontos fracos</p>
              {(report.weaknesses || []).map((w, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13.5, color: '#334155', marginBottom: 8, lineHeight: 1.45 }}>
                  <X size={15} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} /> <span>{w}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardCompact}>
            <p style={blockTitle('', '#1E40AF')}>Ações prioritárias</p>
            {(report.priority_actions || []).map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: '#334155', marginBottom: 10, lineHeight: 1.45 }}>
                <span style={{ width: 22, height: 22, borderRadius: 8, background: '#DBEAFE', color: '#1E40AF', fontWeight: 800, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <span>{a}</span>
              </div>
            ))}
          </div>

          {report.reenrollment_analysis && (
            <div style={cardCompact}>
              <p style={{ ...blockTitle('', '#92400E'), display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Análise da rematrícula</p>
              <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.6 }}>{report.reenrollment_analysis}</p>
            </div>
          )}
          {report.retention_opportunities && (
            <div style={cardCompact}>
              <p style={{ ...blockTitle('', '#00695F'), display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={14} /> Oportunidades de retenção</p>
              <p style={{ fontSize: 14, color: '#334155', margin: 0, lineHeight: 1.6 }}>{report.retention_opportunities}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export { ProgressRow }
