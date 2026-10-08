// api/_lib/workingHours.ts
//
// Variável {horario} nas mensagens automáticas do robô. A tela de
// Configurações sempre ofereceu "Use {horario} para inserir os horários
// configurados", mas o webhook nunca trocava — a família recebia o texto
// "{horario}" cru. Aceita também {horário}, {horarios} e espaços/maiúsculas.
//
// Formato: "segunda a sexta, das 07:00 às 17:30". Dias com horários
// diferentes viram grupos: "segunda a sexta, das 07:00 às 17:30; sábado, das
// 08:00 às 12:00". Hoje whatsapp_flows só tem um horário pra todos os dias
// (working_start/working_end); `byDay` já deixa pronto o horário por dia.

const DAY_ORDER = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const
const DAY_NAME: Record<string, string> = {
  MON: 'segunda', TUE: 'terça', WED: 'quarta', THU: 'quinta', FRI: 'sexta', SAT: 'sábado', SUN: 'domingo',
}
export const HORARIO_RE = /\{\s*hor[aá]rios?\s*\}/gi

export interface WorkingHoursConfig {
  working_days?: string[] | null
  working_start?: string | null
  working_end?: string | null
  // Futuro: horário próprio por dia (ex.: { SAT: { start: '08:00', end: '12:00' } }).
  byDay?: Record<string, { start: string; end: string }> | null
}

const hhmm = (t: string | null | undefined, fallback: string) => (t || fallback).slice(0, 5)

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}

// Dias consecutivos viram faixa ("segunda a sexta"); 2 seguidos ou soltos
// viram lista ("sábado e domingo", "segunda, quarta e sexta").
function describeDays(days: string[]): string {
  const idx = days.map(d => DAY_ORDER.indexOf(d as typeof DAY_ORDER[number])).filter(i => i >= 0).sort((a, b) => a - b)
  const parts: string[] = []
  let runStart = 0
  for (let i = 1; i <= idx.length; i++) {
    if (i === idx.length || idx[i] !== idx[i - 1] + 1) {
      const run = idx.slice(runStart, i).map(n => DAY_NAME[DAY_ORDER[n]])
      if (run.length >= 3) parts.push(`${run[0]} a ${run[run.length - 1]}`)
      else parts.push(...run)
      runStart = i
    }
  }
  return joinList(parts)
}

export function formatWorkingHours(cfg: WorkingHoursConfig): string {
  const days = (cfg.working_days ?? []).filter(d => DAY_NAME[d])
  if (!days.length) return 'horário comercial'
  const start = hhmm(cfg.working_start, '08:00')
  const end = hhmm(cfg.working_end, '18:00')

  // Agrupa os dias pelo mesmo horário, na ordem da semana.
  const groups = new Map<string, string[]>()
  for (const d of DAY_ORDER) {
    if (!days.includes(d)) continue
    const own = cfg.byDay?.[d]
    const key = own ? `${hhmm(own.start, start)}|${hhmm(own.end, end)}` : `${start}|${end}`
    groups.set(key, [...(groups.get(key) ?? []), d])
  }
  return [...groups.entries()]
    .map(([key, ds]) => { const [s, e] = key.split('|'); return `${describeDays(ds)}, das ${s} às ${e}` })
    .join('; ')
}

export function fillHorario(text: string, cfg: WorkingHoursConfig | null | undefined): string {
  if (!text || !cfg) return text
  HORARIO_RE.lastIndex = 0
  if (!HORARIO_RE.test(text)) return text
  HORARIO_RE.lastIndex = 0
  const value = formatWorkingHours(cfg)
  return text.replace(HORARIO_RE, value)
}
