// Configurações > Funil e leads > Nomes das etapas. Só renomeia: as etapas e a lógica do funil não mudam.
import { useEffect, useState } from 'react'
import { Workflow } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { STAGE_KEYS, defaultStageLabel, fetchStageLabels, applyStageLabels, notifyStageLabelsChanged } from '../../lib/stageLabels'
import { BRAND } from '../../lib/brand'
import { Card, Title, GhostButton, SaveButton, NowNote, input } from './settings/ui'

const HELP: Record<string, string> = {
  new: 'Lead que acabou de chegar.', contact: 'A equipe já falou com a família.', scheduled: 'Tem visita marcada.',
  visit: 'A família já visitou a escola.', proposal: 'Recebeu proposta de matrícula.', enrolled: 'Matrícula fechada.', lost: 'Não vai matricular (pede o motivo).',
}

export default function StageLabelsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const rows = await fetchStageLabels(institutionId)
      const m: Record<string, string> = {}
      rows.forEach(r => { if (r.label) m[r.stage] = r.label })
      setNames(m); setSaved(m)
    } catch { onToast('Erro ao carregar os nomes das etapas', false) }
    setLoading(false)
  }
  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const effective = (k: string, src = names) => (src[k] || '').trim() || defaultStageLabel(k)
  const dirty = STAGE_KEYS.some(k => (names[k] || '').trim() !== (saved[k] || '').trim())

  const save = async () => {
    // dois nomes iguais confundiriam quem usa o funil
    const seen = new Set<string>()
    for (const k of STAGE_KEYS) {
      const n = effective(k).toLowerCase()
      if (seen.has(n)) { onToast(`Dois estágios ficariam com o nome "${effective(k)}". Escolha nomes diferentes.`, false); return }
      seen.add(n)
    }
    setSaving(true)
    const payload = STAGE_KEYS
      .filter(k => (names[k] || '').trim() !== (saved[k] || '').trim())
      .map(k => ({ institution_id: institutionId, stage: k, label: (names[k] || '').trim() || null, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('lead_stage_labels').upsert(payload, { onConflict: 'institution_id,stage' })
    setSaving(false)
    if (error) { onToast(error.message.includes('unique') ? 'Já existe uma etapa com esse nome.' : 'Erro ao salvar: ' + error.message, false); return }
    applyStageLabels(STAGE_KEYS.map(k => ({ stage: k, label: (names[k] || '').trim() || null })))
    notifyStageLabelsChanged()
    onToast('Nomes das etapas salvos.')
    await load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      <Card>
        <Title Icon={Workflow} title="Nomes das etapas" help="Mude só o nome que a equipe vê. A ordem e o funcionamento do funil continuam os mesmos." />
        {loading ? <div style={{ color: BRAND.muted, fontSize: 13 }}>Carregando…</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STAGE_KEYS.map(k => {
              const custom = (names[k] || '').trim() !== ''
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: '10px 12px' }}>
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: BRAND.ink }}>{defaultStageLabel(k)}</div>
                    <div style={{ fontSize: 12, color: BRAND.muted }}>{HELP[k]}</div>
                  </div>
                  <input aria-label={`Nome da etapa ${defaultStageLabel(k)}`} style={{ ...input, flex: '1 1 200px', maxWidth: 260 }} maxLength={30}
                    placeholder={defaultStageLabel(k)} value={names[k] || ''} onChange={e => setNames(n => ({ ...n, [k]: e.target.value }))} />
                  <GhostButton disabled={!custom} onClick={() => setNames(n => ({ ...n, [k]: '' }))}>Padrão</GhostButton>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 14 }}><SaveButton onClick={save} saving={saving} disabled={!dirty} text="Salvar nomes" /></div>
      </Card>
      <NowNote>Relatórios e histórico antigos passam a mostrar o nome novo também. Os nomes curtos do formulário usam as 10 primeiras letras.</NowNote>
    </div>
  )
}
