// src/components/superadmin/AdminShowcaseSchools.tsx
// Tela Admin "Escolas em Destaque" — CRUD das escolas-cliente exibidas como
// prova social na landing pública (logos + mapa do Brasil). Consumido sem
// login em src/pages/Landing.tsx via showcase_schools (RLS: SELECT público
// só de linhas is_active=true, escrita só super admin — ver migration
// 20260814000000_showcase_schools.sql).
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { UF_NAMES } from '../landing/BrazilStatesMap'
import {
  MapPinned, Plus, X, CheckCircle2, AlertTriangle, Pencil, Trash2,
  ArrowUp, ArrowDown, Image as ImageIcon, Eye, EyeOff,
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

const UF_OPTIONS = Object.entries(UF_NAMES).sort((a, b) => a[1].localeCompare(b[1]))

type ToastT = { msg: string; ok: boolean }
function ToastBar({ toast, onClose }: { toast: ToastT; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

interface ShowcaseSchool {
  id: string
  institution_id: string | null
  school_name: string
  city: string
  state: string
  logo_url: string
  display_order: number
  is_active: boolean
  created_at: string
}

interface InstitutionOpt { id: string; name: string; city: string | null }

const emptyForm = { school_name: '', city: '', state: '', logo_url: '', institution_id: '' }

async function uploadShowcaseLogo(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from('showcase-logos')
    .upload(path, file, { contentType: file.type || 'image/png', upsert: false })
  if (error) throw new Error(`Falha no upload: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from('showcase-logos').getPublicUrl(path)
  return publicUrl
}

export default function AdminShowcaseSchools() {
  const [items, setItems] = useState<ShowcaseSchool[]>([])
  const [institutions, setInstitutions] = useState<InstitutionOpt[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<ToastT | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  const load = async () => {
    setLoading(true)
    const [{ data: rows, error }, { data: insts }] = await Promise.all([
      supabase.from('showcase_schools').select('*').order('display_order', { ascending: true }),
      supabase.from('institutions').select('id, name, city').order('name'),
    ])
    if (error) showToast(error.message, false)
    setItems((rows as ShowcaseSchool[]) || [])
    setInstitutions((insts as InstitutionOpt[]) || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (item: ShowcaseSchool) => {
    setEditingId(item.id)
    setForm({
      school_name: item.school_name,
      city: item.city,
      state: item.state,
      logo_url: item.logo_url,
      institution_id: item.institution_id || '',
    })
    setShowModal(true)
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const url = await uploadShowcaseLogo(file)
      setForm(f => ({ ...f, logo_url: url }))
    } catch (e: any) {
      showToast(e.message || 'Erro no upload do logo.', false)
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!form.school_name.trim() || !form.city.trim() || !form.state || !form.logo_url) {
      showToast('Preencha nome, cidade, estado e o logo.', false)
      return
    }
    setSaving(true)
    const payload = {
      school_name: form.school_name.trim(),
      city: form.city.trim(),
      state: form.state,
      logo_url: form.logo_url,
      institution_id: form.institution_id || null,
    }
    const { error } = editingId
      ? await supabase.from('showcase_schools').update(payload).eq('id', editingId)
      : await supabase.from('showcase_schools').insert({ ...payload, display_order: items.length })
    setSaving(false)
    if (error) { showToast(error.message, false); return }
    setShowModal(false)
    showToast(editingId ? 'Escola atualizada!' : 'Escola adicionada!')
    load()
  }

  const remove = async (item: ShowcaseSchool) => {
    if (!confirm(`Remover "${item.school_name}" da vitrine da landing page?`)) return
    const { error } = await supabase.from('showcase_schools').delete().eq('id', item.id)
    if (error) { showToast(error.message, false); return }
    showToast('Escola removida.')
    load()
  }

  const toggleActive = async (item: ShowcaseSchool) => {
    const { error } = await supabase.from('showcase_schools').update({ is_active: !item.is_active }).eq('id', item.id)
    if (error) { showToast(error.message, false); return }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i))
  }

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const a = items[index]
    const b = items[target]
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('showcase_schools').update({ display_order: b.display_order }).eq('id', a.id),
      supabase.from('showcase_schools').update({ display_order: a.display_order }).eq('id', b.id),
    ])
    if (e1 || e2) { showToast((e1 || e2)!.message, false); return }
    load()
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escolas em Destaque</h1>
            <p className="text-sm text-gray-500 mt-1">Logos e mapa de presença exibidos como prova social na landing page pública</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
            <Plus className="w-4 h-4" /> Nova escola
          </button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Logo', 'Escola', 'Cidade/UF', 'Ordem', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">Carregando…</td></tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <MapPinned className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">Nenhuma escola cadastrada na vitrine ainda</p>
                      <button onClick={openNew} className="mt-2 text-sm text-cyan-600 font-semibold">+ Adicionar primeira escola</button>
                    </td>
                  </tr>
                ) : items.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="w-14 h-14 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                        {item.logo_url
                          ? <img src={item.logo_url} alt={item.school_name} className="max-w-full max-h-full object-contain" />
                          : <ImageIcon className="w-5 h-5 text-gray-300" />}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900 text-sm">{item.school_name}</p>
                      {item.institution_id && <p className="text-xs text-cyan-600 mt-0.5">Vinculada a uma institution</p>}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{item.city} — {item.state}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => move(i, -1)} disabled={i === 0}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed">
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-gray-400 w-5 text-center">{item.display_order}</span>
                        <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button onClick={() => toggleActive(item)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          item.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                        {item.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {item.is_active ? 'Ativa' : 'Oculta'}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(item)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-900 mb-4">{editingId ? 'Editar escola' : 'Nova escola em destaque'}</h2>

              <div className="space-y-3">
                <div>
                  <label className={lbl}>Logo *</label>
                  {form.logo_url ? (
                    <div className="flex items-center justify-between px-3 py-2.5 bg-cyan-50 border border-cyan-100 rounded-lg">
                      <div className="flex items-center gap-3">
                        <img src={form.logo_url} alt="" className="w-10 h-10 object-contain rounded bg-white border border-gray-100" />
                        <span className="text-xs text-cyan-700 font-semibold">Logo enviado ✓</span>
                      </div>
                      <button onClick={() => setForm(f => ({ ...f, logo_url: '' }))} className="text-gray-400 hover:text-red-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 cursor-pointer hover:border-cyan-400 hover:text-cyan-600 transition-colors">
                      {uploading ? 'Enviando…' : 'Selecionar arquivo (PNG, JPG, SVG ou WebP)'}
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" disabled={uploading}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                    </label>
                  )}
                </div>

                <div>
                  <label className={lbl}>Nome da escola</label>
                  <input className={inp} placeholder="Ex: Colégio Ágape" value={form.school_name}
                    onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Cidade</label>
                    <input className={inp} placeholder="Ex: Patos" value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Estado</label>
                    <select className={inp} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                      <option value="">UF…</option>
                      {UF_OPTIONS.map(([uf, name]) => <option key={uf} value={uf}>{uf} — {name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={lbl}>Vincular a uma institution existente (opcional)</label>
                  <select className={inp} value={form.institution_id} onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}>
                    <option value="">Nenhuma — só para marketing</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}{i.city ? ` — ${i.city}` : ''}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={save} disabled={saving || uploading}
                  className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-semibold hover:bg-cyan-700 disabled:opacity-50">
                  {saving ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  )
}
