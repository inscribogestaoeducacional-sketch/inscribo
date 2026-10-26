// Tipos, textos e peças pequenas da Base de alunos (usados pelo computador e pelo celular).
import type { CSSProperties, ReactNode } from 'react'
import { BRAND } from '../../lib/brand'

export type Row = {
  student_id: string; registration_code: string | null; student_name: string; guardian_name: string | null; guardian_phone: string | null
  category: string; origin: 'rematricula' | 'novato' | 'ex_aluno' | null; state: 'matriculado' | 'pre_matriculado' | null
  grade_id: string | null; grade_name: string | null; grade_sort: number | null; prev_grade: string | null; cur_status_text: string | null
  enrolled_on: string | null; date_is_estimate: boolean | null; erp_new: boolean | null
  declared_note: string | null; declared_at: string | null; origins: string[] | null
}
export type PanelRow = {
  grade_level_id: string; grade_name: string; sort_order: number; is_terminal: boolean
  base_prev_year: number; reenrolled: number; reenrolled_declared: number; pending: number; left_school: number
  new_students: number; returning_students: number; graduates: number; capacity: number | null; pre_enrolled: number
}
export type Head = {
  grade_level_id: string; grade_name: string; sort_order: number; studying: number; left_school: number; concluded: number
  prev_studying: number; prev_left: number; secretary_count: number | null
}
export type Info = { last_seen: string | null; sources: string[] | null; pre_counts: boolean }
export type Tab = 'geral' | 'alunos' | 'serie' | 'conferencia' | 'matriculas'
export type Period = 'all' | 'month' | 'last' | 'custom'
export type Group = 'todos' | 'matriculados' | 'pre' | 'faltam' | 'saiu' | 'concluinte'
export type Counts = {
  mat: number; pre: number; faltam: number; estimated: number
  matBy: Record<'rematricula' | 'novato' | 'ex_aluno', number>
  matOnly: Record<'rematricula' | 'novato' | 'ex_aluno', number>
  preOnly: Record<'rematricula' | 'novato' | 'ex_aluno', number>
}

export const ORIGIN_LABEL: Record<string, string> = { rematricula: 'Rematrícula', novato: 'Novato', ex_aluno: 'Ex-aluno que voltou' }
export const ORIGIN_COLOR: Record<string, string> = { rematricula: '#059669', novato: '#2563EB', ex_aluno: '#0EA5E9' }
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const fmtDate = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
export const waNumber = (p: string) => { const d = p.replace(/\D/g, ''); return d.length <= 11 ? '55' + d : d }
// 5583999990000 → (83) 99999-0000; o resto como veio
export function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return p
}

// Situação do aluno em uma palavra + cor (o mesmo texto em todas as telas e na planilha)
export function stateInfo(r: Row): { label: string; color: string } | null {
  if (r.state === 'pre_matriculado') return { label: 'Pré-matriculado', color: '#7C3AED' }
  if (r.state === 'matriculado') return { label: 'Matriculado', color: '#059669' }
  if (r.category === 'a_rematricular') return { label: 'Ainda falta', color: '#D97706' }
  if (r.category === 'rematriculado_declarado') return { label: 'Rematrícula confirmada', color: '#0D9488' }
  if (r.category === 'saiu') return { label: 'Saiu', color: '#DC2626' }
  if (r.category === 'concluinte') return { label: 'Concluinte', color: '#64748B' }
  return null
}
export const stateLabel = (r: Row) => {
  // a planilha mantém só os rótulos antigos (a confirmada pela escola ficava em branco)
  const s = stateInfo(r)
  return s && r.category !== 'rematriculado_declarado' ? s.label : ''
}

export function Badge({ color, children, style }: { color: string; children: ReactNode; style?: CSSProperties }) {
  return <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: color + '1A', color, whiteSpace: 'nowrap', ...style }}>{children}</span>
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{children}</div>
      {hint && <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  )
}

// Cartão branco do padrão (raio 18, borda #E3E8F0)
export const baseCard: CSSProperties = { background: '#fff', borderRadius: 18, border: `1px solid ${BRAND.line}`, padding: 16, boxShadow: '0 1px 2px rgba(26,43,74,.04)' }
export const baseInput: CSSProperties = { padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${BRAND.line}`, fontSize: 16, outline: 'none', color: BRAND.ink, boxSizing: 'border-box', fontFamily: 'inherit', background: '#fff', minHeight: 44 }

// Chip de filtro como em Leads: selecionado verde cheio, demais verde bem claro
export const chipStyle = (on: boolean): CSSProperties => ({
  flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
  border: on ? '1px solid #05907B' : `1px solid ${BRAND.softLine}`, background: on ? '#05907B' : '#F0FDFB', color: on ? '#fff' : BRAND.primaryDark,
})
