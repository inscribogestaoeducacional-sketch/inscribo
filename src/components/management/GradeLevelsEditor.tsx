// Editor de séries/etapas de ensino (school_grade_levels), usado em Configurações > Escola > Séries.
import React, { useState, useEffect } from 'react'
import { Plus, Check, EyeOff, Pencil, ChevronUp, ChevronDown, Layers } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useGradeLevels, type GradeLevel } from '../../hooks/useGradeLevels'
import { Card, Title, input } from './settings/ui'
import { BRAND, GRAD } from '../../lib/brand'

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#05907B] focus:border-[#05907B] outline-none transition-all'

// ─── Item 4b — editor de séries/etapas de ensino (school_grade_levels) ─────────
// Antes hardcoded em ~10 arquivos com nomenclaturas divergentes entre si
// (ver useGradeLevels.ts) — agora configurável por escola, com seed
// automático no cadastro. Editar/reordenar aqui aciona useGradeLevels nos
// outros lugares (create-lead, filtros, etc.) via reload().
export default function GradeLevelsEditor({ institutionId, onToast }: { institutionId: string; onToast: (msg: string, ok?: boolean) => void }) {
  const { gradeLevels, loading, reload } = useGradeLevels(institutionId, { includeInactive: true })
  const [rows, setRows] = useState<GradeLevel[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setRows(gradeLevels) }, [gradeLevels])

  const persistOrder = async (ordered: GradeLevel[]) => {
    setSaving(true)
    try {
      await Promise.all(ordered.map((g, i) => supabase.from('school_grade_levels').update({ sort_order: i + 1 }).eq('id', g.id)))
      await reload()
    } catch { onToast('Erro ao reordenar séries', false) } finally { setSaving(false) }
  }

  const moveRow = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    setRows(next)
    persistOrder(next)
  }

  const startEdit = (g: GradeLevel) => { setEditingId(g.id); setEditingName(g.name) }

  const saveEdit = async () => {
    if (!editingId || !editingName.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('school_grade_levels').update({ name: editingName.trim() }).eq('id', editingId)
      if (error) throw error
      setEditingId(null)
      await reload()
      onToast('Série atualizada!')
    } catch { onToast('Erro ao salvar. Nome já existe?', false) } finally { setSaving(false) }
  }

  // Desativar em vez de apagar: apagar levaria junto os apelidos da importação (ActiveSoft/planilha)
  // e quebraria o vínculo com alunos. Desativada some dos formulários e filtros, e pode voltar.
  const setActive = async (g: GradeLevel, active: boolean) => {
    if (!active && !window.confirm(`Desativar "${g.name}"? Ela some dos formulários e filtros, mas leads, alunos e apelidos da importação continuam guardados. Você pode reativar quando quiser.`)) return
    setSaving(true)
    try {
      const { error } = await supabase.from('school_grade_levels').update({ active }).eq('id', g.id)
      if (error) throw error
      await reload()
      onToast(active ? 'Série reativada.' : 'Série desativada.')
    } catch { onToast('Erro ao atualizar série', false) } finally { setSaving(false) }
  }

  const addRow = async () => {
    if (!newName.trim() || !institutionId) return
    setSaving(true)
    try {
      const same = rows.find(r => r.name.trim().toLowerCase() === newName.trim().toLowerCase())
      if (same) {
        if (same.active === false) { await setActive(same, true); setNewName(''); return }
        onToast('Essa série já existe.', false); return
      }
      const nextOrder = (rows[rows.length - 1]?.sort_order ?? 0) + 1
      const { error } = await supabase.from('school_grade_levels').insert({ institution_id: institutionId, name: newName.trim(), sort_order: nextOrder })
      if (error) throw error
      setNewName('')
      await reload()
      onToast('Série adicionada!')
    } catch { onToast('Erro ao adicionar. Nome já existe?', false) } finally { setSaving(false) }
  }

  return (
    <Card style={{ maxWidth: 620 }}>
      <Title Icon={Layers} title="Séries e etapas de ensino" help="Os nomes usados nos formulários de lead, nos filtros e nos relatórios. Use as setas para mudar a ordem." />

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          {rows.map((g, i) => (
            <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 12, background: '#fff', border: `1px solid ${BRAND.line}` }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button disabled={i === 0 || saving} onClick={() => moveRow(i, -1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronUp size={13} color="#64748B" /></button>
                <button disabled={i === rows.length - 1 || saving} onClick={() => moveRow(i, 1)} style={{ width: 20, height: 16, border: 'none', background: 'none', cursor: i === rows.length - 1 ? 'default' : 'pointer', opacity: i === rows.length - 1 ? 0.3 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronDown size={13} color="#64748B" /></button>
              </div>
              {editingId === g.id ? (
                <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()}
                  style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: '1.5px solid #05907B', fontSize: 13, outline: 'none' }} />
              ) : (
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: g.active === false ? '#94A3B8' : '#1A2B4A' }}>{g.name}{g.active === false && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700 }}>desativada</span>}</span>
              )}
              {editingId === g.id ? (
                <button onClick={saveEdit} disabled={saving} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: '#E6F7F5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Check size={13} color="#05907B" /></button>
              ) : (
                <button onClick={() => startEdit(g)} style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Pencil size={13} color="#94A3B8" /></button>
              )}
              {g.active === false ? (
                <button onClick={() => setActive(g, true)} disabled={saving} title="Reativar" style={{ height: 28, padding: '0 10px', borderRadius: 8, border: 'none', background: '#E6F7F5', color: '#05907B', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>Reativar</button>
              ) : (
                <button onClick={() => setActive(g, false)} disabled={saving} title="Desativar" style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><EyeOff size={13} color="#94A3B8" /></button>
              )}
            </div>
          ))}
          {rows.length === 0 && <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: 12 }}>Nenhuma série cadastrada ainda.</p>}
        </div>
      )}

      <div className="cfg-stack" style={{ display: 'flex', gap: 8 }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRow()} placeholder="Nova série (ex: 1º Ano EF)" style={{ ...input, flex: 1 }} />
        <button onClick={addRow} disabled={saving || !newName.trim()} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, padding: '0 18px', borderRadius: 14, background: GRAD, color: '#fff', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', opacity: !newName.trim() ? 0.5 : 1 }}>
          <Plus size={14} />Adicionar
        </button>
      </div>
    </Card>
  )
}
