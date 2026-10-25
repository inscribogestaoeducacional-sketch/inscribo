// Configurações > Funil e leads > Motivos de perda.
import { useState } from 'react'
import { Plus, ChevronUp, ChevronDown, Lock, ThumbsDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LOST_REASONS, LOCKED_LOST_REASON, useLostReasons, notifyLostReasonsChanged, type LostReasonRow } from '../leads/lostReasons'
import { BRAND } from '../../lib/brand'
import { Card, Title, Switch, input, hint, NowNote } from './settings/ui'

type Item = { value: string; label: string; fator: string; active: boolean; sort_order: number; id: string | null }

export default function LostReasonsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { rows, configured, loading, reload } = useLostReasons(institutionId)
  const [label, setLabel] = useState('')
  const [fator, setFator] = useState<'Interno' | 'Externo'>('Externo')
  const [busy, setBusy] = useState(false)

  const list: Item[] = configured
    ? rows.map(r => ({ value: r.value, label: r.label, fator: r.fator, active: r.active, sort_order: r.sort_order, id: r.id }))
    : LOST_REASONS.map((r, i) => ({ value: r.value, label: r.label, fator: r.fator, active: true, sort_order: i, id: null }))

  // A primeira alteração grava a lista padrão inteira e só então aplica a mudança.
  const ensureSeeded = async (): Promise<LostReasonRow[] | null> => {
    if (configured) return rows
    const { data, error } = await supabase.from('lost_reason_options')
      .insert(LOST_REASONS.map((r, i) => ({ institution_id: institutionId, value: r.value, label: r.label, short: r.short, fator: r.fator, active: true, sort_order: i })))
      .select('id, value, label, short, fator, active, sort_order')
    if (error) { onToast('Erro ao salvar: ' + error.message, false); return null }
    return ((data as any[]).map(r => ({ ...r, subfator: null })) as LostReasonRow[]).sort((a, b) => a.sort_order - b.sort_order)
  }
  const done = async () => { notifyLostReasonsChanged(); await reload() }
  const find = (base: LostReasonRow[], value: string) => base.find(r => r.value === value)!

  const update = async (value: string, patch: { active?: boolean; fator?: string }) => {
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    const { error } = await supabase.from('lost_reason_options').update(patch).eq('id', find(base, value).id)
    if (error) onToast('Erro ao salvar: ' + error.message, false)
    await done(); setBusy(false)
  }
  const move = async (value: string, dir: -1 | 1) => {
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    const i = base.findIndex(r => r.value === value), j = i + dir
    if (j < 0 || j >= base.length) { setBusy(false); return }
    const a = base[i], b = base[j]
    const r1 = await supabase.from('lost_reason_options').update({ sort_order: b.sort_order }).eq('id', a.id)
    const r2 = await supabase.from('lost_reason_options').update({ sort_order: a.sort_order }).eq('id', b.id)
    if (r1.error || r2.error) onToast('Erro ao reordenar', false)
    await done(); setBusy(false)
  }
  const add = async () => {
    const text = label.trim().slice(0, 60)
    if (!text) return
    if (list.some(r => r.label.toLowerCase() === text.toLowerCase())) { onToast('Esse motivo já existe', false); return }
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    // Novo motivo entra antes de "Outro motivo", que fica por último.
    const outro = base.find(r => r.value === LOCKED_LOST_REASON)
    const pos = outro ? outro.sort_order : base.length
    if (outro) await supabase.from('lost_reason_options').update({ sort_order: pos + 1 }).eq('id', outro.id)
    const value = 'c_' + Math.random().toString(16).slice(2, 10)
    const { error } = await supabase.from('lost_reason_options').insert({ institution_id: institutionId, value, label: text, short: text.slice(0, 24), fator, active: true, sort_order: pos })
    if (error) onToast('Erro ao salvar: ' + error.message, false)
    else { setLabel(''); onToast('Motivo adicionado') }
    await done(); setBusy(false)
  }

  const sel: React.CSSProperties = { ...input, width: 'auto', padding: '5px 8px', fontSize: 12, borderRadius: 8 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Card>
        <Title Icon={ThumbsDown} title="Motivos de perda" help="A lista que aparece quando um lead é marcado como perdido. Ela alimenta os relatórios de recusa." />
        {loading ? <div style={{ color: BRAND.muted, fontSize: 13 }}>Carregando…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((r, i) => {
              const locked = r.value === LOCKED_LOST_REASON
              return (
                <div key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '8px 12px', background: r.active ? '#fff' : '#F8FAFC', opacity: r.active ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button type="button" aria-label={`Subir ${r.label}`} disabled={busy || i === 0 || locked} onClick={() => move(r.value, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: BRAND.muted, opacity: i === 0 || locked ? 0.3 : 1 }}><ChevronUp size={14} /></button>
                    <button type="button" aria-label={`Descer ${r.label}`} disabled={busy || i === list.length - 1 || locked || list[i + 1]?.value === LOCKED_LOST_REASON} onClick={() => move(r.value, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: BRAND.muted, opacity: i === list.length - 1 || locked || list[i + 1]?.value === LOCKED_LOST_REASON ? 0.3 : 1 }}><ChevronDown size={14} /></button>
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{r.label}</div>
                  <select aria-label={`Fator de ${r.label}`} style={sel} value={r.fator} disabled={busy} onChange={e => update(r.value, { fator: e.target.value })}>
                    <option value="Externo">Externo</option><option value="Interno">Interno</option>
                  </select>
                  {locked
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: BRAND.muted, minWidth: 92 }}><Lock size={12} /> sempre ligado</span>
                    : <Switch on={r.active} disabled={busy} onChange={v => update(r.value, { active: v })} labelText={`Usar ${r.label}`} />}
                </div>
              )
            })}
          </div>
        )}
        <div className="cfg-stack" style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: '1 1 220px' }} value={label} maxLength={60} placeholder="Novo motivo (ex.: Horário das aulas)" onChange={e => setLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <select aria-label="Fator do novo motivo" style={{ ...input, width: 'auto' }} value={fator} onChange={e => setFator(e.target.value as any)}>
            <option value="Externo">Externo</option><option value="Interno">Interno</option>
          </select>
          <button type="button" onClick={add} disabled={busy || !label.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', height: 40, borderRadius: 12, background: BRAND.primary, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !label.trim() ? 0.5 : 1, fontFamily: 'inherit' }}><Plus size={15} /> Adicionar</button>
        </div>
        <p style={hint}>Desligar um motivo só o tira da lista de novas perdas. Os leads que já foram perdidos por ele continuam com o motivo, e os relatórios seguem contando.</p>
      </Card>
      <NowNote><b>Interno</b>: algo que a escola pode melhorar (preço, vaga, atendimento). <b>Externo</b>: fora do alcance da escola (mudou de cidade, desistiu). É o que separa os dois quadros do relatório de recusas.</NowNote>
    </div>
  )
}
