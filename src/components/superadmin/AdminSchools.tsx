// src/components/superadmin/AdminSchools.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Search, Megaphone, Eye, Edit2, AlertTriangle,
  CheckCircle2, X, ChevronDown, Plus
} from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

export default function AdminSchools() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [releaseModal, setReleaseModal] = useState<any | null>(null)
  const [startMonth, setStartMonth] = useState(8)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [releasing, setReleasing] = useState(false)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [newSchoolModal, setNewSchoolModal] = useState(false)
  const [newSchoolForm, setNewSchoolForm] = useState({
    name: '', cnpj: '', city: '', state: '', email: '', password: '',
    phone: '', plan: 'trial', consultantId: '',
  })
  const [savingSchool, setSavingSchool] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [instRes, consultRes, cycleRes] = await Promise.all([
      supabase.from('institutions').select('*').order('name'),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
      supabase.from('campaign_cycles').select('institution_id, status, year').order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setConsultants(consultRes.data || [])
    setCycles(cycleRes.data || [])
    setLoading(false)
  }

  const showToast = (msg: string, success = true) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const handleReleaseCampaign = async () => {
    if (!releaseModal) return
    setReleasing(true)
    try {
      const year = new Date().getFullYear() + 1
      const payload = {
        institution_id: releaseModal.id,
        status: 'released',
        campaign_start_month: startMonth,
        year,
        label: `Campanha ${year}`,
        start_date: startDate || `${new Date().getFullYear()}-${String(startMonth).padStart(2, '0')}-01`,
        end_date: endDate || `${year}-02-28`,
      }

      // Verifica se já existe ciclo em andamento para essa escola
      const { data: existing } = await supabase
        .from('campaign_cycles')
        .select('id, status')
        .eq('institution_id', releaseModal.id)
        .in('status', ['setup', 'draft', 'released'])
        .maybeSingle()

      if (existing) {
        await supabase.from('campaign_cycles').update(payload).eq('id', existing.id)
      } else {
        await supabase.from('campaign_cycles').insert(payload)
      }

      const { data: gestorUser } = await supabase
        .from('users')
        .select('email, full_name')
        .eq('institution_id', releaseModal.id)
        .eq('role', 'admin')
        .maybeSingle()

      const startMonthName = months.find(m => m.v === startMonth)?.l ?? ''

      if (gestorUser?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            type: 'campaign_ready',
            to: gestorUser.email,
            data: {
              school_name: releaseModal.name,
              year,
              start_month: startMonthName,
              gestor_name: gestorUser.full_name ?? '',
            },
          },
        })
      }

      showToast(`Campanha ${year} liberada para ${releaseModal.name}! Gestor notificado.`)
      setReleaseModal(null)
      loadData()
    } catch {
      showToast('Erro ao liberar campanha.', false)
    } finally {
      setReleasing(false)
    }
  }

  const handleCreateSchool = async () => {
    const f = newSchoolForm
    if (!f.name || !f.city || !f.state || !f.email || !f.password) return
    setSavingSchool(true)
    try {
      // 1. Cria usuário no Auth
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: f.email,
        password: f.password,
        email_confirm: true,
      })
      if (authErr) throw authErr

      // 2. Cria institution
      const { data: institution, error: instErr } = await supabase
        .from('institutions')
        .insert({
          name: f.name,
          cnpj: f.cnpj || null,
          city: f.city,
          state: f.state,
          phone: f.phone || null,
          consultant_id: f.consultantId || null,
          plan: f.plan,
          plan_status: 'active',
          email: f.email,
        })
        .select()
        .single()
      if (instErr) throw instErr

      // 3. Cria user vinculado
      await supabase.from('users').insert({
        id: authData.user.id,
        email: f.email,
        full_name: f.name,
        institution_id: institution.id,
        role: 'admin',
        user_type: 'school_user',
      })

      // 4. E-mail de boas-vindas
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          to: f.email,
          data: { school_name: f.name, year: new Date().getFullYear() + 1 },
        },
      })

      showToast(`Escola "${f.name}" criada! E-mail enviado para o gestor.`)
      setNewSchoolModal(false)
      setNewSchoolForm({ name: '', cnpj: '', city: '', state: '', email: '', password: '', phone: '', plan: 'trial', consultantId: '' })
      loadData()
    } catch (e: any) {
      showToast(`Erro: ${e?.message ?? 'Tente novamente.'}`, false)
    } finally {
      setSavingSchool(false)
    }
  }

  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de ${inst.name}?`)) return
    await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    showToast(`${inst.name} suspenso.`)
    loadData()
  }

  const filtered = institutions.filter(i =>
    i.name?.toLowerCase().includes(search.toLowerCase()) ||
    i.city?.toLowerCase().includes(search.toLowerCase())
  )

  const getConsultantName = (id: string) =>
    consultants.find(c => c.id === id)?.full_name || '—'

  const getCycleStatus = (institutionId: string) => {
    const cycle = cycles.find(c => c.institution_id === institutionId)
    if (!cycle) return { label: 'Sem setup', color: '#9ca3af', bg: '#f3f4f6' }
    if (cycle.status === 'active') return { label: 'Ativa', color: '#16a34a', bg: '#f0fdf4' }
    if (cycle.status === 'released') return { label: 'Liberada', color: '#0891b2', bg: '#ecfeff' }
    return { label: 'Pré-campanha', color: '#d97706', bg: '#fffbeb' }
  }

  const getPlanBadge = (inst: any) => {
    if (inst.plan === 'trial') return { label: 'Trial', color: '#d97706', bg: '#fffbeb' }
    if (inst.plan_status === 'active') return { label: 'Ativo', color: '#16a34a', bg: '#f0fdf4' }
    if (inst.plan_status === 'suspended') return { label: 'Suspenso', color: '#dc2626', bg: '#fef2f2' }
    return { label: inst.plan || '—', color: '#6b7280', bg: '#f3f4f6' }
  }

  const months = [
    { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
    { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
    { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
    { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
  ]

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium animate-fade-in">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escolas</h1>
            <p className="text-gray-500 mt-1">{institutions.length} escola{institutions.length !== 1 ? 's' : ''} cadastrada{institutions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none w-64"
                placeholder="Buscar escola ou cidade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setNewSchoolModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Nova escola
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-4 text-left">Escola</th>
                  <th className="px-6 py-4 text-left">Cidade</th>
                  <th className="px-6 py-4 text-left">Consultor</th>
                  <th className="px-6 py-4 text-left">Plano</th>
                  <th className="px-6 py-4 text-left">Campanha</th>
                  <th className="px-6 py-4 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(6).fill(0).map((_, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton h="h-4" w="w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center text-gray-400">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhuma escola encontrada</p>
                    </td>
                  </tr>
                ) : filtered.map(inst => {
                  const planBadge = getPlanBadge(inst)
                  const cycleBadge = getCycleStatus(inst.id)
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900 text-sm">{inst.name}</p>
                        {inst.email && <p className="text-xs text-gray-400">{inst.email}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{inst.city || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{getConsultantName(inst.consultant_id)}</td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: planBadge.color, background: planBadge.bg }}>
                          {planBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: cycleBadge.color, background: cycleBadge.bg }}>
                          {cycleBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const yr = new Date().getFullYear()
                              setReleaseModal(inst)
                              setStartMonth(8)
                              setStartDate(`${yr}-08-01`)
                              setEndDate(`${yr + 1}-02-28`)
                            }}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-medium transition-colors"
                            title="Liberar campanha"
                          >
                            <Megaphone className="w-3.5 h-3.5" /> Liberar
                          </button>
                          <button
                            onClick={() => setEditModal(inst)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {inst.plan_status !== 'suspended' && (
                            <button
                              onClick={() => handleSuspend(inst)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Suspender"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Release Campaign Modal */}
      {releaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Liberar campanha</h2>
                <p className="text-sm text-gray-500 mt-0.5">{releaseModal.name}</p>
              </div>
              <button onClick={() => setReleaseModal(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  Mês de início das matrículas
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {months.map(m => (
                    <button
                      key={m.v}
                      onClick={() => {
                        setStartMonth(m.v)
                        const yr = new Date().getFullYear()
                        setStartDate(`${yr}-${String(m.v).padStart(2, '0')}-01`)
                      }}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        startMonth === m.v
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {m.l}
                    </button>
                  ))}
                </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data de início</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data de fim</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className={inputCls} />
                </div>
              </div>
              </div>

              <div className="bg-cyan-50 rounded-xl p-4 text-sm text-cyan-800">
                <p className="font-semibold">Campanha {new Date().getFullYear() + 1}</p>
                <p className="mt-1 text-cyan-700">
                  Início: {months.find(m => m.v === startMonth)?.l}/{new Date().getFullYear()} —
                  Fim: Fev/{new Date().getFullYear() + 1}
                </p>
                <p className="mt-2 text-xs text-cyan-600">
                  O gestor da escola será notificado por e-mail automaticamente.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setReleaseModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleReleaseCampaign}
                disabled={releasing}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {releasing ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Liberando...</>
                ) : (
                  <><Megaphone className="w-4 h-4" /> Liberar campanha</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (simplified) */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Editar escola</h2>
              <button onClick={() => setEditModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Plano</label>
                <select
                  className={inputCls}
                  defaultValue={editModal.plan || 'trial'}
                  onChange={async e => {
                    await supabase.from('institutions').update({ plan: e.target.value }).eq('id', editModal.id)
                  }}
                >
                  <option value="trial">Trial</option>
                  <option value="escola">Escola (R$ 550/mês)</option>
                  <option value="rede">Rede</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  className={inputCls}
                  defaultValue={editModal.plan_status || 'active'}
                  onChange={async e => {
                    await supabase.from('institutions').update({ plan_status: e.target.value }).eq('id', editModal.id)
                  }}
                >
                  <option value="active">Ativo</option>
                  <option value="suspended">Suspenso</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Consultor responsável</label>
                <select
                  className={inputCls}
                  defaultValue={editModal.consultant_id || ''}
                  onChange={async e => {
                    await supabase.from('institutions').update({ consultant_id: e.target.value || null }).eq('id', editModal.id)
                  }}
                >
                  <option value="">Sem consultor</option>
                  {consultants.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => { showToast('Alterações salvas!'); setEditModal(null); loadData() }}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* New School Modal */}
      {newSchoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nova escola</h2>
                <p className="text-sm text-gray-400 mt-0.5">Cria a instituição e o acesso do gestor</p>
              </div>
              <button onClick={() => setNewSchoolModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da escola *</label>
                <input className={inputCls} placeholder="Ex: Colégio São Francisco" value={newSchoolForm.name}
                  onChange={e => setNewSchoolForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CNPJ</label>
                <input className={inputCls} placeholder="00.000.000/0001-00" value={newSchoolForm.cnpj}
                  onChange={e => setNewSchoolForm(f => ({ ...f, cnpj: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade *</label>
                  <input className={inputCls} placeholder="João Pessoa" value={newSchoolForm.city}
                    onChange={e => setNewSchoolForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estado *</label>
                  <input className={inputCls} placeholder="PB" maxLength={2} value={newSchoolForm.state}
                    onChange={e => setNewSchoolForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                <input className={inputCls} placeholder="(83) 99999-9999" value={newSchoolForm.phone}
                  onChange={e => setNewSchoolForm(f => ({ ...f, phone: e.target.value }))} />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Acesso do gestor</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">E-mail do gestor *</label>
                    <input type="email" className={inputCls} placeholder="gestor@escola.com.br" value={newSchoolForm.email}
                      onChange={e => setNewSchoolForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Senha inicial *</label>
                    <input type="password" className={inputCls} placeholder="Mínimo 8 caracteres" value={newSchoolForm.password}
                      onChange={e => setNewSchoolForm(f => ({ ...f, password: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plano</label>
                  <select className={inputCls} value={newSchoolForm.plan}
                    onChange={e => setNewSchoolForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="trial">Trial</option>
                    <option value="escola">Escola (R$ 550/mês)</option>
                    <option value="rede">Rede</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Consultor responsável</label>
                  <select className={inputCls} value={newSchoolForm.consultantId}
                    onChange={e => setNewSchoolForm(f => ({ ...f, consultantId: e.target.value }))}>
                    <option value="">Sem consultor</option>
                    {consultants.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setNewSchoolModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button
                onClick={handleCreateSchool}
                disabled={savingSchool || !newSchoolForm.name || !newSchoolForm.city || !newSchoolForm.state || !newSchoolForm.email || !newSchoolForm.password}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {savingSchool ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                ) : (
                  <><Plus className="w-4 h-4" /> Criar escola</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
