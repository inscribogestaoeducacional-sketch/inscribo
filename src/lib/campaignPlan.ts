// Conta da meta da Campanha de Matrículas — tudo aqui é sugestão a partir do histórico da escola;
// o gestor pode alterar qualquer número (meta total, rematrículas, novos, cada mês, taxas do funil).

export type HistMonth = { m: string; novos: number; rematriculas: number }
export type HistGrade = { grade_id: string; name: string; segment: string | null; sort_order: number; base: number; retained: number; pre?: number; secured?: number; lost: number; new_students: number }
export type HistClass = { class_id: string; name: string; grade_id: string | null; base: number; retained: number; pre?: number; secured?: number; lost: number }
export type HistYear = {
  year: number; base: number; retained: number; pre?: number; secured?: number; pre_counts?: boolean; lost: number; graduates: number; left_during_year: number
  new_students: number; total_students: number; monthly: HistMonth[]; by_grade: HistGrade[]; by_class: HistClass[]
}
export type History = { target_year: number; years: HistYear[]; current: HistYear | null; current_base: number; current_students: number }

export type FunnelRates = { registration_to_schedule: number; schedule_to_visit: number; visit_to_enrollment: number }
// Mesmas taxas padrão do gerador antigo; passam a vir do funil da escola quando houver histórico.
export const DEFAULT_FUNNEL: FunnelRates = { registration_to_schedule: 0.76, schedule_to_visit: 0.63, visit_to_enrollment: 0.4 }

// Curva típica de escola particular, usada só quando a escola não tem histórico (marcada como estimativa).
const DEFAULT_RE: Record<number, number> = { 8: 0.02, 9: 0.05, 10: 0.25, 11: 0.3, 12: 0.2, 1: 0.13, 2: 0.05 }
const DEFAULT_NEW: Record<number, number> = { 8: 0.05, 9: 0.08, 10: 0.12, 11: 0.12, 12: 0.18, 1: 0.3, 2: 0.15 }

export type PlanSource = 'activesoft' | 'planilha' | 'manual' | 'estimativa'

export function retention(years: HistYear[]): { rate: number | null; perYear: { year: number; rate: number }[] } {
  const ok = years.filter(y => y.base > 0)
  if (!ok.length) return { rate: null, perYear: [] }
  const rate = ok.reduce((s, y) => s + y.retained, 0) / ok.reduce((s, y) => s + y.base, 0)
  return { rate, perYear: ok.map(y => ({ year: y.year, rate: y.retained / y.base })) }
}

export const pad2 = (n: number) => String(n).padStart(2, '0')

/** Lista os meses ('YYYY-MM') entre duas datas ISO. */
export function monthsBetween(start: string, end: string): string[] {
  if (!start || !end) return []
  let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7))
  const ey = Number(end.slice(0, 4)), em = Number(end.slice(5, 7))
  const out: string[] = []
  while ((y < ey || (y === ey && m <= em)) && out.length < 24) {
    out.push(`${y}-${pad2(m)}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}

/** Reparte `total` em partes proporcionais a `weights`, somando exatamente `total`. */
export function spread(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0)
  if (total <= 0 || !weights.length) return weights.map(() => 0)
  const w = sum > 0 ? weights : weights.map(() => 1)
  const wsum = w.reduce((s, x) => s + x, 0)
  const raw = w.map(x => (total * x) / wsum)
  const out = raw.map(Math.floor)
  let rest = total - out.reduce((s, x) => s + x, 0)
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f)
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k].i]++
  return out
}

/**
 * Parte de cada mês da campanha no total do ano, pelo que a escola fez nos anos anteriores.
 * Matrículas antes do início entram no 1º mês; depois do fim, na parcela "depois".
 */
export function seasonality(years: HistYear[], targetYear: number, months: string[], kind: 'novos' | 'rematriculas'):
  { shares: number[]; after: number; source: 'historico' | 'padrao' } {
  const usable = years.filter(y => y.monthly.reduce((s, m) => s + m[kind], 0) >= 10)
  if (!usable.length || !months.length) {
    const dist = kind === 'novos' ? DEFAULT_NEW : DEFAULT_RE
    const raw = months.map(m => dist[Number(m.slice(5, 7))] ?? 0.02)
    const tot = raw.reduce((s, x) => s + x, 0) || 1
    return { shares: raw.map(x => x / tot), after: 0, source: 'padrao' }
  }
  const shares = months.map(() => 0); let after = 0
  for (const y of usable) {
    const shift = targetYear - y.year
    const tot = y.monthly.reduce((s, m) => s + m[kind], 0)
    const first = months[0], last = months[months.length - 1]
    for (const m of y.monthly) {
      const p = `${Number(m.m.slice(0, 4)) + shift}-${m.m.slice(5, 7)}`
      const part = m[kind] / tot / usable.length
      if (p > last) after += part
      else if (p < first) shares[0] += part
      else { const i = months.indexOf(p); if (i >= 0) shares[i] += part; else shares[shares.length - 1] += part }
    }
  }
  return { shares, after, source: 'historico' }
}

export type PlanMonth = { m: string; rematriculas: number; novos: number }
export type PlanGoals = { total: number; rematriculas: number; novos: number }

/** Sugere metas: rematrículas = base × retenção; novos = o que falta para a meta de alunos. */
export function suggestGoals(opts: { baseStudents: number; currentStudents: number; retentionRate: number; growthPct: number }): PlanGoals {
  const rematriculas = Math.round(opts.baseStudents * opts.retentionRate)
  const total = Math.round(opts.currentStudents * (1 + opts.growthPct / 100))
  return { total, rematriculas, novos: Math.max(0, total - rematriculas) }
}

export function suggestMonths(opts: { years: HistYear[]; targetYear: number; start: string; end: string; goals: PlanGoals }):
  { months: PlanMonth[]; after: { rematriculas: number; novos: number }; source: 'historico' | 'padrao' } {
  const list = monthsBetween(opts.start, opts.end)
  const re = seasonality(opts.years, opts.targetYear, list, 'rematriculas')
  const nw = seasonality(opts.years, opts.targetYear, list, 'novos')
  const reAll = spread(opts.goals.rematriculas, [...re.shares, re.after])
  const nwAll = spread(opts.goals.novos, [...nw.shares, nw.after])
  return {
    months: list.map((m, i) => ({ m, rematriculas: reAll[i], novos: nwAll[i] })),
    after: { rematriculas: reAll[list.length], novos: nwAll[list.length] },
    source: re.source === 'historico' || nw.source === 'historico' ? 'historico' : 'padrao',
  }
}

/** De matrículas novas para cadastros, agendamentos e visitas necessários. */
export function funnelNeeds(novos: number, r: FunnelRates) {
  const visits = novos > 0 ? Math.ceil(novos / Math.max(r.visit_to_enrollment, 0.01)) : 0
  const schedules = visits > 0 ? Math.ceil(visits / Math.max(r.schedule_to_visit, 0.01)) : 0
  const registrations = schedules > 0 ? Math.ceil(schedules / Math.max(r.registration_to_schedule, 0.01)) : 0
  return { registrations, schedules, visits }
}

export const MONTH_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
export const monthName = (m: string) => MONTH_FULL[Number(m.slice(5, 7)) - 1]

/** Qualidade do dado histórico: base para a etiqueta de confiança do plano. */
export function sourceFromSources(sources: string[] | null | undefined, years: HistYear[]): PlanSource {
  if (!years.length) return 'estimativa'
  if (sources?.includes('activesoft')) return 'activesoft'
  if (sources?.includes('planilha')) return 'planilha'
  return 'manual'
}
