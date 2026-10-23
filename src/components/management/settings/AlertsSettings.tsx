// Configurações > WhatsApp > Alertas: a escola escolhe quais avisos quer receber
// no sininho. Quem recebe: administrador e gestores da escola.
import { WifiOff, Radio, FileCheck2, MessageCircleWarning, Bell } from 'lucide-react'
import { BRAND } from '../../../lib/brand'
import { Card, Title, Switch, SaveButton, NowNote, input, hint } from './ui'

export type AlertsForm = {
  connection: boolean            // número do WhatsApp caiu
  silence: boolean               // não chega mensagem há horas de atendimento
  silence_hours: number
  template: boolean              // Meta aprovou ou recusou um modelo
  unanswered: boolean            // cliente esperando a equipe
  unanswered_minutes: number
}
export const ALERTS_DEFAULTS: AlertsForm = { connection: true, silence: true, silence_hours: 4, template: true, unanswered: false, unanswered_minutes: 30 }

type Row = { Icon: any; title: string; desc: string; key: keyof AlertsForm; extra?: React.ReactNode; isNew?: boolean }

export default function AlertsSettings({ value, onChange, onSave, saving, saved }: {
  value: AlertsForm; onChange: (v: AlertsForm) => void; onSave: () => void; saving?: boolean; saved?: boolean
}) {
  const set = (p: Partial<AlertsForm>) => onChange({ ...value, ...p })
  const rows: Row[] = [
    { Icon: WifiOff, key: 'connection', title: 'WhatsApp desconectou', desc: 'O número caiu na Meta e as mensagens pararam. Avisa na hora e some sozinho quando reconecta.' },
    { Icon: Radio, key: 'silence', title: 'WhatsApp sem receber mensagens', desc: 'Passou um tempo de atendimento sem chegar nenhuma mensagem, o que pode ser uma queda que a Meta não avisou.',
      extra: <div><label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Avisar depois de</label>
        <select style={{ ...input, width: 250 }} value={value.silence_hours} onChange={e => set({ silence_hours: parseInt(e.target.value) })}>
          {[2, 4, 6, 8].map(h => <option key={h} value={h}>{h} horas de atendimento</option>)}</select></div> },
    { Icon: FileCheck2, key: 'template', isNew: true, title: 'Modelo aprovado ou recusado', desc: 'A Meta respondeu sobre um modelo que a escola enviou. Se foi recusado, o aviso traz o motivo.' },
    { Icon: MessageCircleWarning, key: 'unanswered', isNew: true, title: 'Cliente esperando resposta', desc: 'Um cliente escreveu e a equipe não respondeu a tempo. Só conta no horário de atendimento.',
      extra: <div><label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Avisar depois de</label>
        <select style={{ ...input, width: 250 }} value={value.unanswered_minutes} onChange={e => set({ unanswered_minutes: parseInt(e.target.value) })}>
          {[15, 30, 60, 120].map(m => <option key={m} value={m}>{m < 60 ? `${m} minutos` : `${m / 60} ${m === 60 ? 'hora' : 'horas'}`} sem resposta</option>)}</select></div> },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <NowNote>Os avisos aparecem no sininho 🔔 do sistema, para o administrador e os gestores da escola.</NowNote>
      {rows.map(r => {
        const on = value[r.key] as boolean
        return (
          <Card key={r.key}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ width: 38, height: 38, borderRadius: 12, background: BRAND.soft, color: BRAND.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><r.Icon size={18} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: BRAND.ink }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: BRAND.muted, marginTop: 2, lineHeight: 1.45 }}>{r.desc}</div>
                {r.extra && <div style={{ marginTop: 12, opacity: on ? 1 : 0.5, pointerEvents: on ? 'auto' : 'none' }}>{r.extra}</div>}
              </div>
              <Switch on={on} onChange={v => set({ [r.key]: v } as Partial<AlertsForm>)} labelText={r.title} />
            </div>
          </Card>
        )
      })}
      <p style={{ ...hint, display: "flex", gap: 6, alignItems: "center" }}><Bell size={13} /> Quando o problema se resolve (o WhatsApp volta a receber, por exemplo), o aviso é encerrado sozinho.</p>
      <div><SaveButton text="Salvar alertas" saving={saving} saved={saved} onClick={onSave} /></div>
    </div>
  )
}
