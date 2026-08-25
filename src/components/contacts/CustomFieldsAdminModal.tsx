// src/components/contacts/CustomFieldsAdminModal.tsx
//
// Item 2.1 — tela de administração dos campos customizáveis de contato
// (contact_custom_fields). Só define os campos (nome, tipo, obrigatório,
// opções pra tipo lista) — os VALORES por contato são editados em
// ContactProfile.tsx (item 2.2), na seção "Campos Personalizados".
import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Loader2, Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface CustomField {
  id: string
  label: string
  type: 'text' | 'number' | 'date' | 'select'
  options: string[] | null
  required: boolean
}

interface Props {
  institutionId: string
  onClose: () => void
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 9, border: '1.5px solid #E2E8F0',
  fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box', color: '#1A2B4A',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#94A3B8',
  marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
}

const TYPE_LABELS: Record<CustomField['type'], string> = {
  text: 'Texto', number: 'Número', date: 'Data', select: 'Lista de opções',
}

export default function CustomFieldsAdminModal({ institutionId, onClose }: Props) {
  const [fields,  setFields]  = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const [form, setForm] = useState({ label: '', type: 'text' as CustomField['type'], optionsText: '', required: false })

  async function load() {
    setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('contact_custom_fields')
        .select('id, label, type, options, required')
        .eq('institution_id', institutionId)
        .order('created_at')
      if (err) throw err
      setFields((data || []) as CustomField[])
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar campos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [institutionId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    if (!form.label.trim()) { setError('Digite um nome para o campo.'); return }
    const options = form.type === 'select'
      ? form.optionsText.split(',').map(s => s.trim()).filter(Boolean)
      : null
    if (form.type === 'select' && (!options || options.length === 0)) {
      setError('Liste ao menos uma opção (separadas por vírgula).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('contact_custom_fields').insert({
        institution_id: institutionId,
        label: form.label.trim(),
        type: form.type,
        options,
        required: form.required,
      })
      if (err) throw err
      setForm({ label: '', type: 'text', optionsText: '', required: false })
      load()
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar campo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await supabase.from('contact_custom_fields').delete().eq('id', id)
      setFields(prev => prev.filter(f => f.id !== id))
      setConfirmDeleteId(null)
    } catch (e: any) {
      setError(e?.message || 'Erro ao excluir campo.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid #F1F5F9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings2 size={18} color="#3B82F6" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1A2B4A' }}>Campos personalizados</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={20} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <p style={{ margin: 0, fontSize: 12, color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '9px 12px' }}>{error}</p>
          )}

          {/* Lista de campos existentes */}
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Campos configurados</p>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={20} className="animate-spin" color="#94A3B8" /></div>
            ) : fields.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: '#CBD5E1' }}>Nenhum campo personalizado ainda.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fields.map(f => (
                  <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid #E2E8F0', borderRadius: 10, background: '#F8FAFC' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1A2B4A' }}>
                        {f.label} {f.required && <span style={{ color: '#DC2626' }}>*</span>}
                      </p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94A3B8' }}>
                        {TYPE_LABELS[f.type]}{f.type === 'select' && f.options?.length ? ` · ${f.options.join(', ')}` : ''}
                      </p>
                    </div>
                    {confirmDeleteId === f.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#DC2626' }}>Apaga os valores salvos também.</span>
                        <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}
                          style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, border: 'none', borderRadius: 7, background: '#DC2626', color: '#fff', cursor: 'pointer' }}>
                          {deletingId === f.id ? '...' : 'Confirmar'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ padding: '5px 10px', fontSize: 11, border: '1px solid #E2E8F0', borderRadius: 7, background: '#fff', color: '#64748B', cursor: 'pointer' }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(f.id)} title="Excluir campo"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Novo campo */}
          <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Novo campo</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={lbl}>Nome do campo</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} style={inp} placeholder="Ex: RA do aluno" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Tipo</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CustomField['type'] }))} style={inp}>
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="date">Data</option>
                    <option value="select">Lista de opções</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.required} onChange={e => setForm(f => ({ ...f, required: e.target.checked }))} />
                    Obrigatório
                  </label>
                </div>
              </div>
              {form.type === 'select' && (
                <div>
                  <label style={lbl}>Opções (separadas por vírgula)</label>
                  <input value={form.optionsText} onChange={e => setForm(f => ({ ...f, optionsText: e.target.value }))} style={inp} placeholder="Ex: Manhã, Tarde, Integral" />
                </div>
              )}
              <button onClick={handleAdd} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0', borderRadius: 9, border: 'none', background: '#00A896', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                {saving ? 'Salvando...' : 'Adicionar campo'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
