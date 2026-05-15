// src/components/superadmin/AdminConsultants.tsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Users, Plus, Search, RefreshCw, Edit2, Trash2,
  Mail, Phone, Building2, X, CheckCircle2, AlertTriangle,
  Eye, EyeOff, Shield
} from 'lucide-react'

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

type Toast = { msg: string; ok: boolean }

export default function AdminConsultants() {
  const [consultants, setConsultants] = useState<any[]>([])
  const [schools, setSchools]         = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [toast, setToast]             = useState<Toast | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [editTarget, setEditTarget]   = useState<any | null>(null)
  const [showPw, setShowPw]           = useState(false)
  const [saving, setSaving]           = useState(false)

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', password: '',
  })

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    const [consRes, schRes] = await Promise.all([
      supabase.from('users')
        .select('id, full_name, email, phone, created_at, user_type')
        .eq('user_type', 'consultant')
        .order('full_name'),
      supabase.from('institutions')
        .select('id, name, consultant_id')
        .order('name'),
    ])
    setConsultants(consRes.data || [])
    setSchools(schRes.data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const schoolsOf = (id: string) => schools.filter(s => s.consultant_id === id)

  const openNew = () => {
    setEditTarget(null)
    setForm({ full_name: '', email: '', phone: '', password: '' })
    setShowModal(true)
  }

  const openEdit = (c: any) => {
    setEditTarget(c)
    setForm({ full_name: c.full_name || '', email: c.email || '', phone: c.phone || '', password: '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.full_name || !form.email) { showToast('Nome e e-mail são obrigatórios.', false); return }
    setSaving(true)
    try {
      if (editTarget) {
        // Atualiza dados
        const { error } = await supabase.from('users').update({
          full_name: form.full_name,
          phone: form.phone || null,
        }).eq('id', editTarget.id)
        if (error) throw error
        showToast('Consultor atualizado!')
      } else {
        // Cria via edge function (mesma usada para escola)
        if (!form.password || form.password.length < 8) {
          showToast('Senha mínima de 8 caracteres.', false); setSaving(false); return
        }
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              email: form.email.trim().toLowerCase(),
              password: form.password,
              full_name: form.full_name.trim(),
              role: 'consultant',
              user_type: 'consultant',
              phone: form.phone || null,
            }),
          }
        )
        const data = await res.json()
        if (!res.ok || data?.error) throw new Error(data?.error || 'Erro ao criar consultor')
        showToast('Consultor criado com sucesso!')
      }
      setShowModal(false)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (c: any) => {
    if (!confirm(`Desativar o consultor "${c.full_name}"?\nEle perderá acesso ao painel. As escolas vinculadas ficarão sem consultor.`)) return
    const { error } = await supabase.from('users').update({ active: false }).eq('id', c.id)
    if (error) { showToast('Erro ao desativar.', false); return }
    await supabase.from('institutions').update({ consultant_id: null }).eq('consultant_id', c.id)
    showToast('Consultor desativado.')
    loadData()
  }

  const filtered = consultants.filter(c =>
    !search ||
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-semibold
            ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.msg}
            <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-70" /></button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultores</h1>
            <p className="text-sm text-gray-500 mt-1">{consultants.length} consultor{consultants.length !== 1 ? 'es' : ''} cadastrado{consultants.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={openNew}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Novo consultor
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Buscar por nome ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">{search ? 'Nenhum consultor encontrado' : 'Nenhum consultor cadastrado'}</p>
            {!search && (
              <button onClick={openNew} className="mt-3 text-sm text-cyan-600 font-semibold">+ Criar primeiro consultor</button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => {
              const cSchools = schoolsOf(c.id)
              return (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {(c.full_name || 'C').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-tight">{c.full_name}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full mt-0.5">
                          <Shield className="w-2.5 h-2.5" /> Consultor
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{c.email}</span>
                    </div>
                    {c.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{c.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{cSchools.length} escola{cSchools.length !== 1 ? 's' : ''} vinculada{cSchools.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {cSchools.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="flex flex-wrap gap-1">
                        {cSchools.slice(0, 3).map(s => (
                          <span key={s.id} className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium truncate max-w-[120px]">
                            {s.name}
                          </span>
                        ))}
                        {cSchools.length > 3 && (
                          <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-medium">
                            +{cSchools.length - 3}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      Desde {new Date(c.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
                    </span>
                    <Link to={`/super-admin/consultants/${c.id}`}
                      className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 flex items-center gap-1">
                      Ver detalhes →
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editTarget ? 'Editar consultor' : 'Novo consultor'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {editTarget ? editTarget.email : 'Cria acesso ao painel de consultor'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={lbl}>Nome completo *</label>
                <input className={inp} placeholder="Nome do consultor" value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>E-mail *</label>
                <input type="email" className={inp} placeholder="consultor@aionedu.com.br"
                  value={form.email} disabled={!!editTarget}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  style={editTarget ? { opacity: 0.6, cursor: 'not-allowed' } : {}} />
                {editTarget && <p className="text-xs text-gray-400 mt-1">E-mail não pode ser alterado após criação.</p>}
              </div>
              <div>
                <label className={lbl}>Telefone / WhatsApp</label>
                <input className={inp} placeholder="(83) 99999-9999" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              {!editTarget && (
                <div>
                  <label className={lbl}>Senha inicial *</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} className={inp + ' pr-10'}
                      placeholder="Mínimo 8 caracteres" value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  : <><CheckCircle2 className="w-4 h-4" /> {editTarget ? 'Salvar' : 'Criar consultor'}</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}