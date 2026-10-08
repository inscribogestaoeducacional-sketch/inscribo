// src/components/management/LeadUnitFieldEditor.tsx
//
// Configurações → Escola → "Campo de unidade do lead". Liga/desliga o campo,
// edita o rótulo (Unidade, Campus, Polo...) e cadastra as opções. Opção em
// uso por algum lead não pode ser apagada (FK RESTRICT no banco), só
// desativada — desativada some dos formulários mas continua nos leads que já
// a têm. Gravação liberada só pra admin/gestor (RLS: lead_unit_user_can_manage).
//
// Nome "Campo de unidade do lead" de propósito: não confundir com a "unidade"
// de rede de escolas (school_groups).
import { useEffect, useState, type CSSProperties } from 'react'
import { Plus, Pencil, Check, Trash2, ChevronUp, ChevronDown, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useLeadUnits, notifyLeadUnitsChanged, DEFAULT_UNIT_LABEL, type LeadUnit } from '../../lib/leadUnits'

const inputStyle: CSSProperties = { padding: '9px 12px', borderRadius: 10, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', color: '#1A2B4A', boxSizing: 'border-box' }

export default function LeadUnitFieldEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { user } = useAuth()
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const cfg = useLeadUnits(institutionId)
  const [labelDraft, setLabelDraft] = useState(DEFAULT_UNIT_LABEL)
  const [rows, setRows] = useState<LeadUnit[]>([])
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setLabelDraft(cfg.label) }, [cfg.label])
  useEffect(() => { setRows(cfg.units) }, [cfg.units])

  // Quantos leads usam cada opção — decide entre "Apagar" e "só desativar".
  useEffect(() => {
    if (!cfg.units.length) { setUsage({}); return }
    let cancelled = false
    ;(async () => {
      const counts = await Promise.all(cfg.units.map(async u => {
        const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true })
          .eq('institution_id', institutionId).eq('unit_id', u.id)
        return [u.id, count ?? 0] as const
      }))
      if (!cancelled) setUsage(Object.fromEntries(counts))
    })()
    return () => { cancelled = true }
  }, [cfg.units, institutionId])

  const afterChange = async () => { await cfg.reload(); notifyLeadUnitsChanged() }

  const saveSettings = async (patch: { enabled?: boolean; label?: string }) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('lead_unit_settings').upsert({
        institution_id: institutionId,
        enabled: patch.enabled ?? cfg.enabled,
        label: (patch.label ?? cfg.label).trim() || DEFAULT_UNIT_LABEL,
        updated_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'institution_id' })
      if (error) throw error
      await afterChange()
      onToast(patch.enabled === undefined ? 'Rótulo salvo!' : patch.enabled ? 'Campo de unidade ligado' : 'Campo de unidade desligado')
    } catch { onToast('Erro ao salvar a configuração', false) } finally { setSaving(false) }
  }

  const persistOrder = async (ordered: LeadUnit[]) => {
    setSaving(true)
    try {
      await Promise.all(ordered.map((u, i) => supabase.from('lead_units').update({ sort_order: i }).eq('id', u.id)))
      await afterChange()
    } catch { onToast('Erro ao reordenar', false) } finally { setSaving(false) }
  }

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    persistOrder(next)
  }

  const saveName = async () => {
    if (!editingId || !editingName.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('lead_units').update({ name: editingName.trim() }).eq('id', editingId)
      if (error) throw error
      setEditingId(null)
      await afterChange()
      onToast('Nome atualizado!')
    } catch { onToast('Erro ao salvar. Nome já existe?', false) } finally { setSaving(false) }
  }

  const toggleActive = async (u: LeadUnit) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('lead_units').update({ active: !u.active }).eq('id', u.id)
      if (error) throw error
      await afterChange()
      onToast(u.active ? `"${u.name}" desativada — some dos formulários, continua nos leads que já a têm` : `"${u.name}" reativada`)
    } catch { onToast('Erro ao alterar', false) } finally { setSaving(false) }
  }

  const removeRow = async (u: LeadUnit) => {
    if (!window.confirm(`Apagar "${u.name}"?`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('lead_units').delete().eq('id', u.id)
      // 23503 = FK: algum lead passou a usar a opção depois da contagem.
      if (error?.code === '23503') { onToast(`"${u.name}" está em uso — desative em vez de apagar`, false); await afterChange(); return }
      if (error) throw error
      await afterChange()
      onToast('Opção apagada.')
    } catch { onToast('Erro ao apagar', false) } finally { setSaving(false) }
  }

  const addRow = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const nextOrder = rows.length ? Math.max(...rows.map(r => r.sort_order)) + 1 : 0
      const { error } = await supabase.from('lead_units').insert({ institution_id: institutionId, name: newName.trim(), sort_order: nextOrder })
      if (error) throw error
      setNewName('')
      await afterChange()
      onToast('Opção adicionada!')
    } catch { onToast('Erro ao adicionar. Nome já existe?', false) } finally { setSaving(false) }
  }

  const iconBtn: CSSProperties = { width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: 24, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 6 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2B4A', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <MapPin size={15} color="#4F46E5" /> Campo de unidade do lead
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: cfg.enabled ? '#00A896' : '#64748B', cursor: canManage ? 'pointer' : 'default', flexShrink: 0 }}>
          <input type="checkbox" checked={cfg.enabled} disabled={!canManage || saving || cfg.loading}
            onChange={e => saveSettings({ enabled: e.target.checked })} />
          {cfg.enabled ? 'Ligado' : 'Desligado'}
        </label>
      </div>
      <p style={{ fontSize: 13, color: '#64748B', marginBottom: 18, lineHeight: 1.6 }}>
        Campo opcional no cadastro do lead, para separar por unidade, campus ou polo. Só aparece nos formulários e filtros quando está ligado.
        Não tem relação com a rede de escolas.
      </p>
      {!canManage && (
        <p style={{ fontSize: 12, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
          Só administradores e gestores podem alterar esta configuração.
        </p>
      )}

      {cfg.loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Carregando...</div>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nome do campo</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <input value={labelDraft} maxLength={30} disabled={!canManage} onChange={e => setLabelDraft(e.target.value)}
              placeholder="Unidade, Campus, Polo..." style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => saveSettings({ label: labelDraft })} disabled={!canManage || saving || !labelDraft.trim() || labelDraft.trim() === cfg.label}
              style={{ padding: '0 16px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (!labelDraft.trim() || labelDraft.trim() === cfg.label) ? 0.5 : 1 }}>
              Salvar
            </button>
          </div>

          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>Opções</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {rows.map((u, i) => {
              const used = usage[u.id] ?? 0
              return (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: u.active ? '#F8FAFC' : '#F1F5F9', border: '1px solid #F1F5F9', opacity: u.active ? 1 : 0.75 }}>
                  {canManage && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <button disabled={i === 0 || saving} onClick={() => moveRow(i, -1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronUp size={13} color="#64748B" /></button>
                      <button disabled={i === rows.length - 1 || saving} onClick={() => moveRow(i, 1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === rows.length - 1 ? 'default' : 'pointer', opacity: i === rows.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronDown size={13} color="#64748B" /></button>
                    </div>
                  )}
                  {editingId === u.id ? (
                    <input autoFocus value={editingName} maxLength={60} onChange={e => setEditingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveName()}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #00A896', fontSize: 13, outline: 'none' }} />
                  ) : (
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#1A2B4A' }}>
                      {u.name}
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: '#94A3B8' }}>
                        {used === 1 ? '1 lead' : `${used} leads`}{u.active ? '' : ' · desativada'}
                      </span>
                    </span>
                  )}
                  {canManage && (
                    <>
                      {editingId === u.id ? (
                        <button onClick={saveName} disabled={saving} title="Salvar" style={{ ...iconBtn, background: '#E6F7F5' }}><Check size={13} color="#00A896" /></button>
                      ) : (
                        <button onClick={() => { setEditingId(u.id); setEditingName(u.name) }} title="Renomear" style={iconBtn}><Pencil size={13} color="#94A3B8" /></button>
                      )}
                      <button onClick={() => toggleActive(u)} disabled={saving}
                        style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 11, fontWeight: 600, color: u.active ? '#64748B' : '#00A896', cursor: 'pointer' }}>
                        {u.active ? 'Desativar' : 'Reativar'}
                      </button>
                      {used === 0 ? (
                        <button onClick={() => removeRow(u)} disabled={saving} title="Apagar" style={iconBtn}><Trash2 size={13} color="#EF4444" /></button>
                      ) : (
                        <span title="Em uso por leads: só pode ser desativada" style={{ ...iconBtn, cursor: 'default' }}><Trash2 size={13} color="#CBD5E1" /></span>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {rows.length === 0 && <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 12 }}>Nenhuma opção cadastrada ainda.</p>}
          </div>

          {canManage && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={newName} maxLength={60} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRow()}
                placeholder={`Nova opção (ex: ${cfg.label} Centro)`} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={addRow} disabled={saving || !newName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px', borderRadius: 10, background: '#00A896', color: '#fff', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1 }}>
                <Plus size={14} />Adicionar
              </button>
            </div>
          )}
          {cfg.enabled && cfg.activeUnits.length === 0 && (
            <p style={{ fontSize: 12, color: '#92400E', marginTop: 12 }}>O campo está ligado, mas sem nenhuma opção ativa: os formulários vão mostrar só "Sem {cfg.label.toLowerCase()}".</p>
          )}
        </>
      )}
    </div>
  )
}
