// Plano de envio de campanha: dado o total de contatos, o ritmo por dia, os dias da
// semana e o horário, monta o cronograma dia a dia. O motor (claim_broadcast_recipients)
// confere os mesmos limites; aqui é só a previsão mostrada à escola.

export const TZ = 'America/Fortaleza'
export const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const
const MAX_DAYS_AHEAD = 120

export interface PlanInput {
  total: number
  startDate: string            // YYYY-MM-DD
  weekdays: boolean[]          // Seg..Dom
  winStart: string             // HH:MM
  winEnd: string
  cap: number                  // mensagens por dia pedidas
  hourlyLimit: number
  dailyLimit: number
}
export interface PlanDay { date: string; count: number }
export interface Plan {
  days: PlanDay[]
  capDay: number               // ritmo real por dia (cap limitado pelo horário e pelos limites)
  perHour: number
  hours: number
  warnings: string[]
  valid: boolean
}

export const todayLocal = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const addDays = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10)
}
const weekdayIdx = (iso: string) => (new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7   // 0 = Seg

export function buildPlan(i: PlanInput): Plan {
  const hours = (toMin(i.winEnd) - toMin(i.winStart)) / 60
  const empty: Plan = { days: [], capDay: 0, perHour: 0, hours: Math.max(0, hours), warnings: [], valid: false }
  if (i.total < 1 || !i.startDate || hours <= 0 || !i.weekdays.some(Boolean) || i.cap < 1) return empty

  const warnings: string[] = []
  const byWindow = Math.floor(i.hourlyLimit * hours)
  const capDay = Math.max(1, Math.min(i.cap, i.dailyLimit, byWindow))
  if (capDay < i.cap) {
    warnings.push(byWindow < Math.min(i.cap, i.dailyLimit)
      ? `O horário escolhido só comporta ${capDay} mensagens por dia (limite de ${i.hourlyLimit} por hora). Aumente o horário para enviar mais por dia.`
      : `O limite da escola é de ${i.dailyLimit} mensagens por dia.`)
  }

  const today = todayLocal()
  const days: PlanDay[] = []
  let left = i.total
  let d = i.startDate < today ? today : i.startDate
  for (let g = 0; left > 0 && g < 400; g++, d = addDays(d, 1)) {
    if (!i.weekdays[weekdayIdx(d)]) continue
    const n = Math.min(capDay, left)
    days.push({ date: d, count: n }); left -= n
  }
  const first = days[0]?.date
  const last = days[days.length - 1]?.date
  if (last && first && (new Date(last).getTime() - new Date(today).getTime()) / 864e5 > MAX_DAYS_AHEAD) {
    warnings.push(`O plano passa de ${MAX_DAYS_AHEAD} dias. Aumente as mensagens por dia ou inclua mais dias da semana.`)
  }
  return { days, capDay, perHour: capDay / hours, hours, warnings, valid: !!days.length && !warnings.some(w => w.includes('passa de')) }
}

export const fmtDay = (iso: string, long = false) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('pt-BR', {
    weekday: long ? 'long' : 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC',
  }).replace('.', '')

export const weekdaysToDb = (w: boolean[]): number[] => w.map((on, i) => (on ? i + 1 : 0)).filter(Boolean)
export const weekdaysFromDb = (a?: number[] | null): boolean[] =>
  a && a.length ? [1, 2, 3, 4, 5, 6, 7].map(n => a.includes(n)) : [true, true, true, true, true, true, false]
