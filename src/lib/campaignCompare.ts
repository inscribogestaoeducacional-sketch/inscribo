// Comparações da Campanha: meta ajustada (compensação) e anos anteriores alinhados mês a mês.
import type { HistYear, PlanMonth } from './campaignPlan'

export type Kind = 'novos' | 'rematriculas'
export const thisMonthSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)

export const realOf = (cur: HistYear | null, m: string, k: Kind) => cur?.monthly.find(x => x.m === m)?.[k] ?? 0

/**
 * Compensação: o que faltou (ou sobrou) nos meses já fechados é redistribuído, em proporção à meta,
 * entre o mês em curso e os meses seguintes. Mês em curso e futuros recebem a "meta ajustada".
 */
export function compensate(months: PlanMonth[], cur: HistYear | null, k: Kind, now = thisMonthSP()) {
  const plan = months.map(m => m[k])
  const real = months.map(m => (m.m <= now ? realOf(cur, m.m, k) : null))
  const closed = months.map(m => m.m < now)
  const deficit = months.reduce((s, m, i) => s + (closed[i] ? plan[i] - (real[i] ?? 0) : 0), 0)
  const openIdx = months.map((_, i) => i).filter(i => !closed[i])
  const openPlan = openIdx.reduce((s, i) => s + plan[i], 0)
  const adjusted: (number | null)[] = months.map(() => null)
  let given = 0
  openIdx.forEach((i, pos) => {
    const share = openPlan > 0 ? plan[i] / openPlan : 1 / openIdx.length
    const v = pos === openIdx.length - 1 ? Math.round(plan[i] + deficit - given) : Math.round(plan[i] + deficit * share)
    const val = Math.max(0, v)
    adjusted[i] = val
    given += Math.round(deficit * share)
  })
  return { plan, real, closed, adjusted, deficit }
}

/** Acumulados (plano, realizado até o mês atual) e dos anos anteriores alinhados aos meses da campanha. */
export function cumulative(months: PlanMonth[], cur: HistYear | null, years: HistYear[], targetYear: number, k: Kind, now = thisMonthSP()) {
  let p = 0, r = 0
  const plan = months.map(m => (p += m[k]))
  const real = months.map(m => (m.m <= now ? (r += realOf(cur, m.m, k)) : null))
  const prev = years.filter(y => y.monthly.some(x => x[k] > 0)).map(y => {
    const shift = targetYear - y.year
    let acc = 0
    const first = months[0]?.m ?? ''
    const early = y.monthly.filter(x => `${Number(x.m.slice(0, 4)) + shift}-${x.m.slice(5, 7)}` < first).reduce((s, x) => s + x[k], 0)
    acc = early
    const series = months.map(m => {
      const src = y.monthly.find(x => `${Number(x.m.slice(0, 4)) + shift}-${x.m.slice(5, 7)}` === m.m)
      acc += src?.[k] ?? 0
      return acc
    })
    return { year: y.year, series }
  })
  return { plan, real, prev }
}
