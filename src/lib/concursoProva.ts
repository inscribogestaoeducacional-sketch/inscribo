// Montagem das versões da prova: embaralhamento reprodutível e gabarito por versão.
import { LETTERS, type Question } from './concurso'

export type VersionItem = { question_id: string; alt_order: number[] }
export type BuiltVersion = { version: string; items: VersionItem[]; answer_key: string[] }

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function shuffled<T>(arr: T[], r: () => number): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

// questions: já na ordem da prova (disciplinas agrupadas). Versão A mantém a ordem original; as demais embaralham
// as questões DENTRO de cada disciplina e as alternativas (exceto questões "não embaralhar").
export function buildVersions(questions: Question[], count: number, altCount: number, subjectOrder: string[], seedKey: string): BuiltVersion[] {
  const out: BuiltVersion[] = []
  for (let v = 0; v < count; v++) {
    const letter = String.fromCharCode(65 + v)
    const r = rng(hash(`${seedKey}:${letter}`))
    let ordered = questions
    if (v > 0) ordered = subjectOrder.flatMap(sid => shuffled(questions.filter(q => q.subject_id === sid), r))
    const items: VersionItem[] = []; const key: string[] = []
    for (const q of ordered) {
      const base = Array.from({ length: altCount }, (_, i) => i)
      const alt_order = v === 0 || q.no_shuffle ? base : shuffled(base, r)
      items.push({ question_id: q.id, alt_order })
      key.push(LETTERS[alt_order.indexOf(q.correct_index ?? 0)])
    }
    out.push({ version: letter, items, answer_key: key })
  }
  return out
}

export const versionFor = (candidateNumber: number, count: number) => String.fromCharCode(65 + ((candidateNumber - 1) % Math.max(1, count)))
export type ExamVersionRow = { id: string; contest_id: string; grade: string; version: string; items: VersionItem[]; answer_key: string[] }
