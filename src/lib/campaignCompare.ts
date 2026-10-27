// Comparações da Campanha: meta ajustada (compensação) e anos anteriores alinhados mês a mês.
import type { HistYear, PlanMonth } from './campaignPlan'

export type Kind = 'novos' | 'rematriculas'
export const thisMonthSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)

export const realOf = (cur: HistYear | null, m: string, k: Kind) => cur?.monthly.find(x => x.m === m)?.[k] ?? 0

/**
 * Meta cumulativa, mês a mês e em cadeia: o que faltou num mês soma na meta do mês seguinte; o que sobrou diminui
 * (e, se a sobra passa da meta do mês seguinte, segue adiante). `effective` é a meta de cada mês já com o que veio do
 * anterior; `adjusted` é a mesma meta só para o mês em curso e os futuros (null nos fechados); `carryIn` é o que entrou.
 */
export function compensate(months: PlanMonth[], cur: HistYear | null, k: Kind, now = thisMonthSP()) {
  const plan = months.map(m => m[k])
  const real = months.map(m => (m.m <= now ? realOf(cur, m.m, k) : null))
  const closed = months.map(m => m.m < now)
  const effective: number[] = [], carryIn: number[] = [], adjusted: (number | null)[] = []
  let carry = 0, deficit = 0, seenOpen = false
  months.forEach((_, i) => {
    carryIn.push(carry)
    const raw = plan[i] + carry
    effective.push(Math.max(0, raw))
    if (closed[i]) { carry = raw - (real[i] ?? 0); adjusted.push(null) }
    else {
      if (!seenOpen) { deficit = carry; seenOpen = true }
      adjusted.push(Math.max(0, Math.round(raw)))
      carry = Math.min(0, raw) // projeção: só a sobra que passou da meta segue adiante
    }
  })
  return { plan, real, closed, adjusted, effective: effective.map(Math.round), carryIn: carryIn.map(Math.round), deficit: Math.round(deficit) }
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
