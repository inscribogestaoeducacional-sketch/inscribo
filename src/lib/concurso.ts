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

export type Contest = { id: string; institution_id: string; name: string; year: number; status: 'draft' | 'open' | 'closed' | 'published'; exam_date: string | null; grades: string[]; alternatives_count: 4 | 5; versions_count: number; has_essay: boolean }
export type Subject = { id: string; contest_id: string; name: string; position: number }
export type Teacher = { id: string; institution_id: string; user_id: string; full_name: string; email: string; phone: string | null; active: boolean }
export type Quota = { id: string; contest_id: string; teacher_id: string; subject_id: string; grade: string; quantity: number; due_date: string | null }
export type Alt = { text: string; image?: string | null }
export type Question = {
  id: string; contest_id: string; quota_id: string | null; subject_id: string; grade: string; author_teacher_id: string | null
  statement: string; statement_images: string[]; alternatives: Alt[]; correct_index: number | null
  difficulty: 'facil' | 'media' | 'dificil' | null; comment: string | null; no_shuffle: boolean
  status: 'draft' | 'sent' | 'returned' | 'approved'; review_note: string | null; updated_at: string
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
