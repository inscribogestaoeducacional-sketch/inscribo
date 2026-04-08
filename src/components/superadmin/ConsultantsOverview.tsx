// src/components/superadmin/ConsultantsOverview.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  UserCheck, X, Plus, TrendingUp, Building2, KanbanSquare,
  Search, Eye, EyeOff, Mail, Phone, MapPin, CheckCircle2,
  AlertTriangle, Clock, RefreshCw, Shield, Star
} from 'lucide-react'

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prosp.', contacted: 'Contato', demo_scheduled: 'Demo',
  demo_done: 'Demo ✓', proposal: 'Proposta', negotiation: 'Neg.',
  won: 'Fechado', lost: 'Perdido',
}

type Toast = { msg: string; ok: boolean }

function ToastBar({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70" /></button>
    </div>
  )
}

function Skeleton({ h = 'h-4', w = 'w-full' }: { h?: string; w?: string }) {
  return <div className={`${h} ${w} bg-gray-200 rounded animate-pulse`} />
}

interface Consultant {
  id: string
  full_name: string
  email: string
  user_type: string
  active: boolean
  phone?: string
  region?: string
}

export default function ConsultantsOverview() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [pipelineMap, setPipelineMap] = useState<Record<string, any[]>>({})
  const [implMap, setImplMap] = useState<Record<string, number>>({})
  const [schoolMap, setSchoolMap] = useState<Record<string, number>>({})
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Consultant | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const [activeTab, setActiveTab] = useState<'consultants' | 'suggestions'>('consultants')

  const [addForm, setAddForm] = useState({
    full_name: '', email: '', password: '', phone: '', region: ''
  })
  const [saving, setSaving] = useState(false)
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})

  useEffect(() => { loadData() }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    const { data: consultantData } = await supabase
      .from('users')
      .select('id, full_name, email, user_type, active, phone, region')
      .eq('user_type', 'consultant')
      .order('full_name')

    const list = consultantData || []
    setConsultants(list)

    const { data: suggData } = await supabase
      .from('school_suggestions')
      .select('*, users!consultant_id(full_name)')
      .order('created_at', { ascending: false })
    setSuggestions(suggData || [])

    if (list.length > 0) {
      const ids = list.map(c => c.id)
      const [pRes, iRes, sRes] = await Promise.all([
        supabase.from('sales_pipeline').select('consultant_id, stage, updated_at').in('consultant_id', ids),
        supabase.from('school_implementations').select('consultant_id').in('consultant_id', ids),
        supabase.from('institutions').select('consultant_id').in('consultant_id', ids),
      ])

      const pm: Record<string, any[]> = {}
      ;(pRes.data || []).forEach(p => {
        if (!pm[p.consultant_id]) pm[p.consultant_id] = []
        pm[p.consultant_id].push(p)
      })
      setPipelineMap(pm)

      const im: Record<string, number> = {}
      ;(iRes.data || []).forEach(i => { im[i.consultant_id] = (im[i.consultant_id] || 0) + 1 })
      setImplMap(im)

      const sm: Record<string, number> = {}
      ;(sRes.data || []).forEach(s => { if (s.consultant_id) sm[s.consultant_id] = (sm[s.consultant_id] || 0) + 1 })
      setSchoolMap(sm)
    }

    setLoading(false)
  }

  const validateAdd = () => {
    const errs: Record<string, string> = {}
    if (!addForm.full_name.trim()) errs.full_name = 'Nome é obrigatório'
    if (!addForm.email.trim()) errs.email = 'E-mail é obrigatório'
    if (!addForm.password || addForm.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    setAddErrors(errs)
    return Object.keys(errs).length === 0
  }

  const addConsultant = async () => {
    if (!validateAdd()) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: addForm.email.trim().toLowerCase(),
            password: addForm.password,
            full_name: addForm.full_name.trim(),
            role: 'admin',
            user_type: 'consultant',
          }),
        }
      )

      const fnData = await response.json()
      if (!response.ok || fnData?.error) throw new Error(fnData?.error || 'Erro ao criar usuário')

      // Atualiza phone e region se preenchidos
      if (addForm.phone || addForm.region) {
        await supabase.from('users').update({
          phone: addForm.phone || null,
          region: addForm.region || null,
        }).eq('id', fnData.user_id)
      }

      showToast(`Consultor "${addForm.full_name}" criado com sucesso!`)
      setShowAdd(false)
      setAddForm({ full_name: '', email: '', password: '', phone: '', region: '' })
      setAddErrors({})
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar consultor.', false)
    } finally {
      setSaving(false)
    }
  }

  const handleSuggestion = async (id: string, status: 'approved' | 'rejected') => {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('school_suggestions').update({
      status,
      reviewed_by: session?.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', id)

    if (status === 'approved') {
      const s = suggestions.find(s => s.id === id)
      if (s) {
        await supabase.from('institutions').insert({
          name: s.name,
          cnpj: s.cnpj || null,
          city: s.city || null,
          state: s.state || null,
          phone: s.phone || null,
          consultant_id: s.consultant_id,
          plan: 'trial',
          plan_status: 'active',
        })
      }
      showToast('Sugestão aprovada! Escola criada.')
    } else {
      showToast('Sugestão rejeitada.')
    }
    loadData()
  }

  const filtered = consultants.filter(c =>
    c.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.region?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length

  // Stats globais
  const totalPipeline = Object.values(pipelineMap).flat().length
  const totalWon = Object.values(pipelineMap).flat().filter(p => p.stage === 'won').length
  const totalSchools = Object.values(schoolMap).reduce((a, b) => a + b, 0)

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultores</h1>
            <p className="text-gray-500 mt-1 text-sm">{consultants.length} consultor{consultants.length !== 1 ? 'es' : ''} cadastrado{consultants.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Novo consultor
            </button>
          </div>
        </div>

        {/* KPIs globais */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Consultores', value: consultants.length, icon: UserCheck, color: 'from-cyan-500 to-blue-600' },
            { label: 'Escolas vinculadas', value: totalSchools, icon: Building2, color: 'from-green-500 to-emerald-600' },
            { label: 'Pipeline total', value: totalPipeline, icon: KanbanSquare, color: 'from-purple-500 to-violet-600' },
            { label: 'Fechamentos', value: totalWon, icon: Star, color: 'from-amber-500 to-orange-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">{k.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '—' : k.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${k.color} flex items-center justify-center flex-shrink-0`}>
                  <k.icon className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('consultants')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'consultants' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Consultores
          </button>
          <button
            onClick={() => setActiveTab('suggestions')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'suggestions' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Sugestões de escolas
            {pendingSuggestions > 0 && (
              <span className="w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {pendingSuggestions}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'consultants' && (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="Buscar por nome, e-mail ou região..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Consultants grid */}
            {loading ? (
              <div className="grid grid-cols-2 gap-6">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                    <Skeleton h="h-5" w="w-40" />
                    <Skeleton h="h-3" w="w-32" />
                    <div className="grid grid-cols-4 gap-3">
                      {Array(4).fill(0).map((_, j) => <Skeleton key={j} h="h-14" />)}
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">
                  {search ? 'Nenhum consultor encontrado' : 'Nenhum consultor cadastrado'}
                </p>
                {!search && (
                  <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-cyan-600 font-semibold">
                    + Cadastrar primeiro consultor
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map(c => {
                  const pipeline = pipelineMap[c.id] || []
                  const active = pipeline.filter(p => !['won', 'lost'].includes(p.stage))
                  const won = pipeline.filter(p => p.stage === 'won')
                  const convRate = pipeline.length > 0 ? Math.round((won.length / pipeline.length) * 100) : 0
                  const impCount = implMap[c.id] || 0
                  const schoolCount = schoolMap[c.id] || 0
                  const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0)
                  const wonMonth = won.filter((p: any) => new Date(p.updated_at || p.created_at) >= startOfMonth)

                  return (
                    <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                            {c.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{c.full_name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>
                            {c.region && (
                              <div className="flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-400">{c.region}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {c.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            onClick={() => setSelected(c)}
                            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* KPIs */}
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {[
                          { label: 'Escolas', value: schoolCount, color: 'text-blue-600' },
                          { label: 'Ativas', value: active.length, color: 'text-cyan-600' },
                          { label: 'Fechadas/mês', value: wonMonth.length, color: 'text-green-600' },
                          { label: 'Conversão', value: `${convRate}%`, color: 'text-purple-600' },
                        ].map(stat => (
                          <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                            <p className="text-xs text-gray-400 mt-0.5 leading-tight">{stat.label}</p>
                          </div>
                        ))}
                      </div>

                      {/* Pipeline mini */}
                      {pipeline.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">Pipeline por fase</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(STAGE_LABELS).map(([key, label]) => {
                              const count = pipeline.filter(p => p.stage === key).length
                              if (count === 0) return null
                              return (
                                <span key={key} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                  {label} ({count})
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {pipeline.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">Sem oportunidades no pipeline</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-4">
            {suggestions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Nenhuma sugestão ainda</p>
                <p className="text-xs text-gray-400 mt-1">Os consultores podem sugerir novas escolas pelo painel deles</p>
              </div>
            ) : suggestions.map(s => {
              const statusMap: Record<string, { label: string; color: string; bg: string }> = {
                pending: { label: 'Pendente', color: '#d97706', bg: '#fffbeb' },
                approved: { label: 'Aprovada', color: '#16a34a', bg: '#f0fdf4' },
                rejected: { label: 'Rejeitada', color: '#dc2626', bg: '#fef2f2' },
              }
              const st = statusMap[s.status] || statusMap.pending
              return (
                <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-bold text-gray-900">{s.name}</p>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
                          {st.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        {s.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.city}{s.state ? `, ${s.state}` : ''}</span>}
                        {s.contact_name && <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" />{s.contact_name}</span>}
                        {s.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.contact_email}</span>}
                        {s.estimated_students && <span>{s.estimated_students} alunos estimados</span>}
                      </div>
                      {s.notes && <p className="text-xs text-gray-400 mt-2 italic">"{s.notes}"</p>}
                      <p className="text-xs text-gray-400 mt-2">
                        Sugerido por <strong>{s.users?.full_name || '—'}</strong> • {new Date(s.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {s.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleSuggestion(s.id, 'rejected')}
                          className="px-3 py-2 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50"
                        >
                          Rejeitar
                        </button>
                        <button
                          onClick={() => handleSuggestion(s.id, 'approved')}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                        >
                          Aprovar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                  {selected.full_name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{selected.full_name}</h2>
                  <p className="text-xs text-gray-400">{selected.email}</p>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {selected.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {selected.phone}
                </div>
              )}
              {selected.region && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {selected.region}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline completo</p>
                <div className="space-y-2">
                  {(pipelineMap[selected.id] || []).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Sem oportunidades ainda</p>
                  ) : (pipelineMap[selected.id] || []).map((opp: any) => (
                    <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-sm text-gray-700 truncate">{opp.school_name || '—'}</span>
                      <span className="text-xs font-semibold text-gray-500 ml-2 flex-shrink-0">
                        {STAGE_LABELS[opp.stage] || opp.stage}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Novo consultor</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cria o acesso e o perfil no sistema</p>
              </div>
              <button onClick={() => { setShowAdd(false); setAddErrors({}) }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Nome completo *</label>
                <input className={`${inputCls} ${addErrors.full_name ? 'border-red-400' : ''}`}
                  placeholder="João Silva"
                  value={addForm.full_name}
                  onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} />
                {addErrors.full_name && <p className="text-xs text-red-500 mt-1">{addErrors.full_name}</p>}
              </div>

              <div>
                <label className={labelCls}>E-mail *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email"
                    className={`${inputCls} pl-9 ${addErrors.email ? 'border-red-400' : ''}`}
                    placeholder="consultor@aionedu.com.br"
                    value={addForm.email}
                    onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                {addErrors.email && <p className="text-xs text-red-500 mt-1">{addErrors.email}</p>}
              </div>

              <div>
                <label className={labelCls}>Senha inicial *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className={`${inputCls} pr-10 ${addErrors.password ? 'border-red-400' : ''}`}
                    placeholder="Mínimo 8 caracteres"
                    value={addForm.password}
                    onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {addErrors.password && <p className="text-xs text-red-500 mt-1">{addErrors.password}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefone</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputCls} pl-9`} placeholder="(83) 99999-9999"
                      value={addForm.phone}
                      onChange={e => setAddForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Região de atuação</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input className={`${inputCls} pl-9`} placeholder="Nordeste"
                      value={addForm.region}
                      onChange={e => setAddForm(f => ({ ...f, region: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                <Shield className="w-4 h-4 text-cyan-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-gray-500">O consultor poderá fazer login imediatamente e alterar a senha no primeiro acesso.</p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => { setShowAdd(false); setAddErrors({}) }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={addConsultant} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                  : <><Plus className="w-4 h-4" /> Criar consultor</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}