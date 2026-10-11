// "Mês atual do funil" — escolhido por DATA, nunca por ordem alfabética.
//
// funnel_metrics.period tem linhas em formatos antigos ("Set/2027",
// "Outubro 2025") além de 'YYYY-MM'; ordenar com localeCompare punha
// "Set/2027" depois de "2027-03" e o Início lia uma linha lixo com 0 cadastros
// (alerta falso "Cadastros: 0 de 115" gravado todo dia na Ágape). Regra:
// só períodos 'YYYY-MM'; o do mês corrente (fuso de Brasília); se não houver,
// o mais recente ANTERIOR a ele — nunca um mês futuro (meta cheia, real 0).

const PERIOD_RE = /^\d{4}-\d{2}$/

export function currentPeriodBR(now: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7)
}

export function pickCurrentFunnelRow<T extends { period: string }>(rows: T[], now: Date = new Date()): T | null {
  const cur = currentPeriodBR(now)
  let best: T | null = null
  for (const r of rows) {
    if (!PERIOD_RE.test(r.period) || r.period > cur) continue
    if (!best || r.period > best.period) best = r
  }
  return best
}

// Fração do mês já decorrida (fuso de Brasília), contando o dia de hoje
// inteiro: 1º dia = 1/30, último dia = 1. Mês já encerrado = 1. Usada pra
// comparar o realizado ATÉ HOJE com a meta proporcional (decisão 11/10) — antes
// o alerta comparava o mês parcial com a meta do mês inteiro e disparava todo
// começo de mês.
export function monthElapsedFraction(period: string, now: Date = new Date()): number {
  const cur = currentPeriodBR(now)
  if (period < cur) return 1
  if (period > cur) return 0
  const day = Number(now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(8, 10))
  const [y, m] = period.split('-').map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  return Math.min(1, day / daysInMonth)
}

/** Meta esperada até hoje (proporcional aos dias corridos), arredondada pra cima. */
export function expectedSoFar(target: number, period: string, now: Date = new Date()): number {
  return Math.ceil((target || 0) * monthElapsedFraction(period, now))
}
