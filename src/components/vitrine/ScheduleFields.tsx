// Campos de agenda (Entrega 1): "a partir de" e "até", no horário do
// aparelho de quem edita. Usado no agendamento de bloco (janela) e no da
// página (Configurações). Vazio = sem limite daquele lado. O banco recusa
// "até" antes de "de" (vitrine_*_schedule_check); aqui o aviso vem antes.
import React from 'react'
import { X } from 'lucide-react'
import { toLocalInput, fromLocalInput, fmtWhen } from '../../lib/vitrine'
import { Field, TextInput, DS } from './ui'

interface Props {
  from: string | null
  until: string | null
  onChange: (v: { from: string | null; until: string | null }) => void
  fromLabel: string
  untilLabel: string
  fromHint?: string
  untilHint?: string
}

export function scheduleError(from: string | null, until: string | null): string | null {
  if (from && until && Date.parse(until) <= Date.parse(from)) return 'O fim precisa ser depois do início.'
  return null
}

export default function ScheduleFields({ from, until, onChange, fromLabel, untilLabel, fromHint, untilHint }: Props) {
  const err = scheduleError(from, until)
  const clearBtn = (onClick: () => void, label: string) => (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      style={{ flex: 'none', width: 40, height: 42, borderRadius: DS.r.md, border: `1px solid ${DS.border}`, background: '#fff', cursor: 'pointer', color: DS.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: DS.ease }}>
      <X size={15} />
    </button>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <Field label={fromLabel} hint={from ? fmtWhen(from) : fromHint}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput type="datetime-local" value={toLocalInput(from)} aria-label={fromLabel}
              onChange={e => onChange({ from: fromLocalInput(e.target.value), until })} />
            {from && clearBtn(() => onChange({ from: null, until }), `Limpar: ${fromLabel}`)}
          </div>
        </Field>
        <Field label={untilLabel} hint={until ? fmtWhen(until) : untilHint}>
          <div style={{ display: 'flex', gap: 6 }}>
            <TextInput type="datetime-local" value={toLocalInput(until)} aria-label={untilLabel}
              onChange={e => onChange({ from, until: fromLocalInput(e.target.value) })} />
            {until && clearBtn(() => onChange({ from, until: null }), `Limpar: ${untilLabel}`)}
          </div>
        </Field>
      </div>
      {err && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#BE123C' }}>{err}</p>}
    </div>
  )
}
