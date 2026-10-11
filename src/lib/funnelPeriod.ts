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
