// Plano de envio: início, dias da semana, horário e mensagens por dia → cronograma.
import React, { useEffect, useMemo } from 'react'
import { CalendarClock } from 'lucide-react'
import { labelStyle, inputStyle, hintStyle } from './ui'
import { WEEKDAYS, buildPlan, fmtDay, todayLocal, type Plan } from '../../lib/broadcastPlan'

export interface PlanForm {
  startDate: string; weekdays: boolean[]; winStart: string; winEnd: string; cap: number; spread: boolean
}
export const DEFAULT_PLAN_FORM = (): PlanForm => ({
  startDate: todayLocal(), weekdays: [true, true, true, true, true, true, false],
  winStart: '07:00', winEnd: '20:00', cap: 100, spread: true,
})

export default function SendPlanBuilder({ form, onChange, total, limits, onPlan }: {
  form: PlanForm; onChange: (f: PlanForm) => void; total: number
  limits: { hourly: number; daily: number } | null; onPlan?: (p: Plan) => void
}) {
  const hourly = limits?.hourly ?? 50, daily = limits?.daily ?? 200
  const set = (p: Partial<PlanForm>) => onChange({ ...form, ...p })
  const plan = useMemo(() => buildPlan({
    total, startDate: form.startDate, weekdays: form.weekdays, winStart: form.winStart, winEnd: form.winEnd,
    cap: form.cap, hourlyLimit: hourly, dailyLimit: daily,
  }), [total, form, hourly, daily])
  useEffect(() => { onPlan?.(plan) }, [plan]) // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayLocal()
  const last = plan.days[plan.days.length - 1]
  const perHourTxt = (Math.round(plan.perHour * 10) / 10).toString().replace('.', ',')
  const everyMin = plan.perHour > 0 ? Math.max(1, Math.round(60 / plan.perHour)) : 0

  return (
    <div style={{ border: '1px solid #E2E8F0', borderRadius: 14, padding: 14, display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <div>
          <label style={labelStyle}>Começar em</label>
          <input type="date" style={inputStyle} min={today} value={form.startDate} onChange={e => set({ startDate: e.target.value })} />
        </div>
        <div>
          <label style={labelStyle}>Enviar entre</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="time" style={inputStyle} value={form.winStart} onChange={e => set({ winStart: e.target.value })} />
            <span style={{ fontSize: 13 }}>e</span>
            <input type="time" style={inputStyle} value={form.winEnd} onChange={e => set({ winEnd: e.target.value })} />
          </div>
          <p style={hintStyle}>Horário de Fortaleza.</p>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Dias da semana</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {WEEKDAYS.map((d, i) => (
            <button key={d} type="button" aria-pressed={form.weekdays[i]}
              onClick={() => set({ weekdays: form.weekdays.map((v, j) => (j === i ? !v : v)) })}
              style={{
                padding: '6px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${form.weekdays[i] ? '#05907B' : '#E2E8F0'}`, background: form.weekdays[i] ? '#E6F7F5' : '#fff', color: form.weekdays[i] ? '#00695F' : '#64748b',
              }}>{d}</button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Mensagens por dia: <b style={{ color: '#00695F' }}>{form.cap}</b></label>
        <input type="range" min={10} max={Math.max(10, daily)} step={10} value={Math.min(form.cap, daily)} style={{ width: '100%' }}
          onChange={e => set({ cap: Number(e.target.value) })} aria-label="Mensagens por dia" />
        <p style={hintStyle}>Limite da escola, definido pela Áion: até {daily.toLocaleString('pt-BR')} por dia e {hourly.toLocaleString('pt-BR')} por hora.</p>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.spread} onChange={e => set({ spread: e.target.checked })} />
          Espalhar ao longo do horário (em vez de enviar tudo de uma vez)
        </label>
      </div>

      {plan.valid && last ? (
        <div style={{ background: '#E6F7F5', border: '1px solid #99E0D7', borderRadius: 12, padding: '11px 13px', color: '#00695F', lineHeight: 1.6, fontSize: 13 }}>
          <b>{total.toLocaleString('pt-BR')} contatos</b> ÷ <b>{plan.capDay} por dia</b> = <b>{plan.days.length} dia{plan.days.length > 1 ? 's' : ''} de envio</b>.<br />
          De <b>{fmtDay(plan.days[0].date)}</b> até <b>{fmtDay(last.date)}</b>, entre <b>{form.winStart}</b> e <b>{form.winEnd}</b>
          {form.spread && <>, cerca de <b>{perHourTxt} mensagens por hora</b> (uma a cada ~{everyMin} min)</>}.
        </div>
      ) : (
        <div style={{ background: '#F1F5F9', borderRadius: 12, padding: '10px 13px', fontSize: 13, color: '#64748b' }}>
          Escolha o início, ao menos um dia da semana e um horário válido para ver o cronograma.
        </div>
      )}
      {plan.warnings.map(w => (
        <div key={w} style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 11px', color: '#92400E', fontSize: 12 }}>{w}</div>
      ))}

      {plan.days.length > 0 && (
        <div>
          <label style={labelStyle}><CalendarClock size={12} style={{ verticalAlign: -2 }} /> Cronograma dia a dia</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 6 }}>
            {plan.days.slice(0, 31).map((d, i) => (
              <div key={d.date} style={{ border: `1px solid ${i === plan.days.length - 1 ? '#FDE68A' : '#E3E8F0'}`, background: i === plan.days.length - 1 ? '#FEF3C7' : '#fff', borderRadius: 10, padding: '6px 8px', textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                {fmtDay(d.date)}<b style={{ display: 'block', fontSize: 15, color: '#1A2B4A' }}>{d.count}</b>{i === plan.days.length - 1 ? 'último dia' : 'mensagens'}
              </div>
            ))}
            {plan.days.length > 31 && <div style={{ padding: 8, fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>+{plan.days.length - 31} dias</div>}
          </div>
          <p style={hintStyle}>Fora desses dias e horários a campanha fica parada e retoma sozinha no próximo dia de envio. Você pode pausar a qualquer momento.</p>
        </div>
      )}
    </div>
  )
}
