// Configurações > Funil e leads > Origens do lead.
import { useState } from 'react'
import { Plus, ChevronUp, ChevronDown, Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DEFAULT_SOURCES, RESERVED_SOURCES, useLeadSources, notifyLeadSourcesChanged, type LeadSourceRow } from '../../lib/leadSources'
import { BRAND } from '../../lib/brand'
import { Card, Title, Switch, input, hint, WarnNote } from './settings/ui'
import { Tag as TagIcon } from 'lucide-react'

export default function LeadSourcesEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { rows, configured, loading, reload } = useLeadSources(institutionId)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

  // Lista mostrada: gravada, ou a padrão (virtual) enquanto a escola não mexeu.
  const list: (LeadSourceRow | { id: null; name: string; active: boolean; sort_order: number })[] =
    configured ? rows : DEFAULT_SOURCES.map((name, i) => ({ id: null, name, active: true, sort_order: i }))

  // Primeira alteração grava a lista padrão inteira e só então aplica a mudança.
  const ensureSeeded = async (): Promise<LeadSourceRow[] | null> => {
    if (configured) return rows
    const { data, error } = await supabase.from('lead_source_options')
      .insert(DEFAULT_SOURCES.map((name, i) => ({ institution_id: institutionId, name, active: true, sort_order: i }))).select('id, institution_id, name, active, sort_order')
    if (error) { onToast('Erro ao salvar: ' + error.message, false); return null }
    return (data as LeadSourceRow[]).sort((a, b) => a.sort_order - b.sort_order)
  }
  const done = async () => { notifyLeadSourcesChanged(); await reload() }

  const toggle = async (name: string, active: boolean) => {
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    const row = base.find(r => r.name === name)
    const { error } = await supabase.from('lead_source_options').update({ active }).eq('id', row!.id)
    if (error) onToast('Erro ao salvar: ' + error.message, false)
    await done(); setBusy(false)
  }
  const move = async (name: string, dir: -1 | 1) => {
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    const i = base.findIndex(r => r.name === name), j = i + dir
    if (j < 0 || j >= base.length) { setBusy(false); return }
    const a = base[i], b = base[j]
    const r1 = await supabase.from('lead_source_options').update({ sort_order: b.sort_order }).eq('id', a.id)
    const r2 = await supabase.from('lead_source_options').update({ sort_order: a.sort_order }).eq('id', b.id)
    if (r1.error || r2.error) onToast('Erro ao reordenar', false)
    await done(); setBusy(false)
  }
  const add = async () => {
    const name = newName.trim().slice(0, 40)
    if (!name) return
    if (list.some(r => r.name.toLowerCase() === name.toLowerCase())) { onToast('Essa origem já existe', false); return }
    setBusy(true)
    const base = await ensureSeeded(); if (!base) { setBusy(false); return }
    // Nova origem entra antes de "Outros", que fica sempre por último.
    const outros = base.find(r => r.name === 'Outros')
    const pos = outros ? outros.sort_order : base.length
    if (outros) await supabase.from('lead_source_options').update({ sort_order: pos + 1 }).eq('id', outros.id)
    const { error } = await supabase.from('lead_source_options').insert({ institution_id: institutionId, name, active: true, sort_order: pos })
    if (error) onToast('Erro ao salvar: ' + error.message, false)
    else { setNewName(''); onToast('Origem adicionada') }
    await done(); setBusy(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
      <Card>
        <Title Icon={TagIcon} title="Origens do lead" help="De onde o contato veio. Aparece no cadastro do lead, nos filtros e nos relatórios." />
        {loading ? <div style={{ color: BRAND.muted, fontSize: 13 }}>Carregando…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((r, i) => {
              const locked = RESERVED_SOURCES.includes(r.name)
              return (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${BRAND.line}`, borderRadius: 12, padding: '8px 12px', background: r.active ? '#fff' : '#F8FAFC', opacity: r.active ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button type="button" aria-label={`Subir ${r.name}`} disabled={busy || i === 0 || r.name === 'Outros'} onClick={() => move(r.name, -1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: BRAND.muted, opacity: i === 0 ? 0.3 : 1 }}><ChevronUp size={14} /></button>
                    <button type="button" aria-label={`Descer ${r.name}`} disabled={busy || i === list.length - 1 || list[i + 1]?.name === 'Outros' || r.name === 'Outros'} onClick={() => move(r.name, 1)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: BRAND.muted, opacity: i === list.length - 1 ? 0.3 : 1 }}><ChevronDown size={14} /></button>
                  </div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{r.name}</div>
                  {locked
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: BRAND.muted }}><Lock size={12} /> usada pelo sistema</span>
                    : <Switch on={r.active} disabled={busy} onChange={v => toggle(r.name, v)} labelText={`Usar ${r.name}`} />}
                </div>
              )
            })}
          </div>
        )}
        <div className="cfg-stack" style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <input style={{ ...input, flex: 1 }} value={newName} maxLength={40} placeholder="Nova origem (ex.: Panfleto, Rádio, Evento)" onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button type="button" onClick={add} disabled={busy || !newName.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 12, background: BRAND.primary, color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1, fontFamily: 'inherit' }}><Plus size={15} /> Adicionar</button>
        </div>
        <p style={hint}>Desligar uma origem só a tira do cadastro e dos filtros. Os leads que já têm essa origem continuam com ela.</p>
      </Card>
      <WarnNote>"Outros" fica sempre por último. WhatsApp, Concurso de Bolsas e Vitrine o sistema preenche sozinho, por isso não saem.</WarnNote>
    </div>
  )
}
