// Configurações > Funil e leads > Etapas do funil.
// As 7 etapas originais só podem ser renomeadas (a lógica do funil depende delas).
// A escola também pode criar etapas extras logo depois de uma etapa original; extras nunca são apagadas, só desativadas.
import { useEffect, useState } from 'react'
import { Workflow, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { STAGE_KEYS, defaultStageLabel, fetchStageLabels, fetchCustomStages, applyStageLabels, applyCustomStages, notifyStageLabelsChanged, type CustomStage } from '../../lib/stageLabels'
import { BRAND } from '../../lib/brand'
import { Card, Title, GhostButton, SaveButton, NowNote, Switch, Pill, input } from './settings/ui'

const HELP: Record<string, string> = {
  new: 'Lead que acabou de chegar.', contact: 'A equipe já falou com a família.', scheduled: 'Tem visita marcada.',
  visit: 'A família já visitou a escola.', proposal: 'Recebeu proposta de matrícula.', enrolled: 'Matrícula fechada.', lost: 'Não vai matricular (pede o motivo).',
}
// depois destas etapas é possível criar extras (Matriculado e Perdido têm regras próprias)
const CAN_ADD_AFTER = ['new', 'contact', 'scheduled', 'visit', 'proposal']

interface Draft extends CustomStage { isNew?: boolean }

export default function StageLabelsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [extras, setExtras] = useState<Draft[]>([])
  const [savedExtras, setSavedExtras] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [rows, ex] = await Promise.all([fetchStageLabels(institutionId), fetchCustomStages(institutionId)])
      const m: Record<string, string> = {}
      rows.forEach(r => { if (r.label) m[r.stage] = r.label })
      const sorted = [...ex].sort((a, b) => a.position - b.position)
      setNames(m); setSaved(m); setExtras(sorted); setSavedExtras(sorted)
    } catch { onToast('Erro ao carregar as etapas', false) }
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const effective = (k: string, src = names) => (src[k] || '').trim() || defaultStageLabel(k)
  const extrasOf = (stage: string) => extras.filter(e => e.after_stage === stage)
  const sameExtra = (a: Draft, b?: Draft) => !!b && a.label.trim() === b.label.trim() && a.active === b.active && a.position === b.position
  const dirty = STAGE_KEYS.some(k => (names[k] || '').trim() !== (saved[k] || '').trim())
    || extras.some(e => e.isNew || !sameExtra(e, savedExtras.find(s => s.id === e.id)))

  const addExtra = (after: string) => {
    const pos = Math.max(0, ...extras.map(e => e.position)) + 1
    setExtras(list => [...list, { id: `new-${Date.now()}-${list.length}`, label: '', after_stage: after, position: pos, active: true, isNew: true }])
  }
  const patch = (id: string, p: Partial<Draft>) => setExtras(list => list.map(e => e.id === id ? { ...e, ...p } : e))
  const removeNew = (id: string) => setExtras(list => list.filter(e => e.id !== id))
  const move = (id: string, dir: -1 | 1) => {
    const e = extras.find(x => x.id === id)!
    const sibs = extrasOf(e.after_stage).sort((a, b) => a.position - b.position)
    const i = sibs.findIndex(x => x.id === id), j = i + dir
    if (j < 0 || j >= sibs.length) return
    const a = sibs[i], b = sibs[j]
    setExtras(list => list.map(x => x.id === a.id ? { ...x, position: b.position } : x.id === b.id ? { ...x, position: a.position } : x))
  }

  const save = async () => {
    // dois nomes iguais confundiriam quem usa o funil
    const seen = new Set<string>()
    const all = [...STAGE_KEYS.map(k => effective(k)), ...extras.map(e => e.label.trim())]
    if (extras.some(e => !e.label.trim())) { onToast('Dê um nome para cada etapa extra.', false); return }
    for (const n of all) {
      const key = n.toLowerCase()
      if (seen.has(key)) { onToast(`Dois estágios ficariam com o nome "${n}". Escolha nomes diferentes.`, false); return }
      seen.add(key)
    }
    setSaving(true)
    try {
      const payload = STAGE_KEYS
        .filter(k => (names[k] || '').trim() !== (saved[k] || '').trim())
        .map(k => ({ institution_id: institutionId, stage: k, label: (names[k] || '').trim() || null, updated_at: new Date().toISOString() }))
      if (payload.length) {
        const { error } = await supabase.from('lead_stage_labels').upsert(payload, { onConflict: 'institution_id,stage' })
        if (error) throw error
      }
      // posição = ordem dentro da lista da escola
      const ordered = [...extras].sort((a, b) => a.position - b.position).map((e, i) => ({ ...e, position: i + 1 }))
      // quem for desativado/trocado de nome primeiro; novas por último
      for (const e of ordered.filter(x => !x.isNew)) {
        const old = savedExtras.find(s => s.id === e.id)
        if (old && !sameExtra(e, old)) {
          const { error } = await supabase.from('lead_custom_stages').update({ label: e.label.trim(), active: e.active, position: e.position }).eq('id', e.id)
          if (error) throw error
        }
      }
      const fresh = ordered.filter(x => x.isNew).map(e => ({ institution_id: institutionId, label: e.label.trim(), after_stage: e.after_stage, position: e.position, active: true }))
      if (fresh.length) {
        const { error } = await supabase.from('lead_custom_stages').insert(fresh)
        if (error) throw error
      }
      applyStageLabels(STAGE_KEYS.map(k => ({ stage: k, label: (names[k] || '').trim() || null })))
      applyCustomStages(await fetchCustomStages(institutionId))
      notifyStageLabelsChanged()
      onToast('Etapas salvas.')
    } catch (err: any) {
      const msg = String(err?.message || err)
      onToast(msg.includes('unique') || msg.includes('duplicate') ? 'Já existe uma etapa com esse nome.' : 'Erro ao salvar: ' + msg, false)
    }
    setSaving(false)
    await load()
  }

  const addBtn = (after: string) => CAN_ADD_AFTER.includes(after) && (
    <button type="button" onClick={() => addExtra(after)}
      style={{ marginLeft: 28, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: `1.5px dashed ${BRAND.softLine}`, background: '#fff', color: BRAND.primaryDark, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
      <Plus size={14} /> Adicionar etapa depois desta
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
      <Card>
        <Title Icon={Workflow} title="Etapas do funil" help="Renomeie as 7 etapas originais e crie etapas extras entre elas. As originais não podem ser apagadas: a lógica do funil depende delas." />
        {loading ? <div style={{ color: BRAND.muted, fontSize: 13 }}>Carregando…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STAGE_KEYS.map(k => {
              const custom = (names[k] || '').trim() !== ''
              const list = extrasOf(k).sort((a, b) => a.position - b.position)
              return (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 12px' }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{defaultStageLabel(k)}</div>
                      <div style={{ fontSize: 12, color: BRAND.muted }}>{HELP[k]}</div>
                    </div>
                    <input aria-label={`Nome da etapa ${defaultStageLabel(k)}`} style={{ ...input, flex: '1 1 200px', maxWidth: 260 }} maxLength={30}
                      placeholder={defaultStageLabel(k)} value={names[k] || ''} onChange={e => setNames(n => ({ ...n, [k]: e.target.value }))} />
                    <GhostButton disabled={!custom} onClick={() => setNames(n => ({ ...n, [k]: '' }))}>Padrão</GhostButton>
                  </div>
                  {list.map((e, i) => (
                    <div key={e.id} style={{ marginLeft: 28, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: `1px solid ${BRAND.softLine}`, background: e.active ? BRAND.softer : '#F8FAFC', borderRadius: 14, padding: '10px 12px', opacity: e.active ? 1 : 0.8 }}>
                      <div style={{ flex: '1 1 150px', minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: BRAND.ink, display: 'flex', alignItems: 'center', gap: 6 }}>Etapa extra {!e.active && <Pill>Desativada</Pill>}</div>
                        <div style={{ fontSize: 12, color: BRAND.muted }}>Depois de “{effective(k)}”</div>
                      </div>
                      <input aria-label={`Nome da etapa extra ${i + 1} depois de ${defaultStageLabel(k)}`} style={{ ...input, flex: '1 1 180px', maxWidth: 240 }} maxLength={30}
                        placeholder="Ex.: Sem resposta" value={e.label} onChange={ev => patch(e.id, { label: ev.target.value })} />
                      <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => move(e.id, -1)} style={{ border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', color: BRAND.muted, opacity: i === 0 ? 0.3 : 1 }}><ArrowUp size={16} /></button>
                      <button type="button" aria-label="Descer" disabled={i === list.length - 1} onClick={() => move(e.id, 1)} style={{ border: 'none', background: 'none', cursor: i === list.length - 1 ? 'default' : 'pointer', color: BRAND.muted, opacity: i === list.length - 1 ? 0.3 : 1 }}><ArrowDown size={16} /></button>
                      {e.isNew
                        ? <GhostButton danger onClick={() => removeNew(e.id)}>Remover</GhostButton>
                        : <Switch on={e.active} onChange={v => patch(e.id, { active: v })} labelText={`${e.active ? 'Desativar' : 'Ativar'} a etapa ${e.label}`} />}
                    </div>
                  ))}
                  {addBtn(k)}
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 14 }}><SaveButton onClick={save} saving={saving} disabled={!dirty} text="Salvar etapas" /></div>
      </Card>
      <NowNote>Etapas extras aparecem como coluna própria no Kanban, logo depois da etapa original, e têm linha própria nos relatórios. O lead continua contando na etapa original para matrícula, perda e automações. Desativar uma extra devolve os leads dela para a etapa original.</NowNote>
    </div>
  )
}
