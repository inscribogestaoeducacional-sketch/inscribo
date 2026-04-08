// src/components/superadmin/AdminSchools.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, Search, Megaphone, Edit2, AlertTriangle,
  CheckCircle2, X, Plus, RefreshCw, Eye, EyeOff,
  MapPin, Mail, Phone, User, Shield, ChevronRight
} from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

const months = [
  { v: 1, l: 'Jan' }, { v: 2, l: 'Fev' }, { v: 3, l: 'Mar' },
  { v: 4, l: 'Abr' }, { v: 5, l: 'Mai' }, { v: 6, l: 'Jun' },
  { v: 7, l: 'Jul' }, { v: 8, l: 'Ago' }, { v: 9, l: 'Set' },
  { v: 10, l: 'Out' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dez' },
]

const PLANS = [
  { value: 'trial', label: 'Trial (gratuito)', color: '#d97706', bg: '#fffbeb' },
  { value: 'escola', label: 'Escola — R$ 550/mês', color: '#0891b2', bg: '#ecfeff' },
  { value: 'rede', label: 'Rede', color: '#7c3aed', bg: '#f5f3ff' },
]

const PLAN_STATUS = [
  { value: 'active', label: 'Ativo', color: '#16a34a', bg: '#f0fdf4' },
  { value: 'suspended', label: 'Suspenso', color: '#dc2626', bg: '#fef2f2' },
  { value: 'cancelled', label: 'Cancelado', color: '#9ca3af', bg: '#f3f4f6' },
]

type Toast = { msg: string; ok: boolean }

function Toast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl text-sm font-medium transition-all
      ${toast.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
      {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      {toast.msg}
      <button onClick={onClose}><X className="w-4 h-4 opacity-70 hover:opacity-100" /></button>
    </div>
  )
}

export default function AdminSchools() {
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [toast, setToast] = useState<Toast | null>(null)

  // Modals
  const [releaseModal, setReleaseModal] = useState<any | null>(null)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [newSchoolModal, setNewSchoolModal] = useState(false)
  const [detailModal, setDetailModal] = useState<any | null>(null)

  // Release form
  const [startMonth, setStartMonth] = useState(8)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [releasing, setReleasing] = useState(false)

  // Edit form
  const [editForm, setEditForm] = useState({ plan: '', plan_status: '', consultant_id: '', name: '', city: '', state: '', phone: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // New school form
  const [newForm, setNewForm] = useState({
    name: '', cnpj: '', city: '', state: '', email: '',
    password: '', phone: '', plan: 'trial', consultantId: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [savingSchool, setSavingSchool] = useState(false)
  const [newFormErrors, setNewFormErrors] = useState<Record<string, string>>({})

  useEffect(() => { loadData() }, [])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }

  const loadData = async () => {
    setLoading(true)
    const [instRes, consultRes, cycleRes] = await Promise.all([
      supabase.from('institutions').select('*').order('name'),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
      supabase.from('campaign_cycles').select('institution_id, status, year, id').order('created_at', { ascending: false }),
    ])
    setInstitutions(instRes.data || [])
    setConsultants(consultRes.data || [])
    setCycles(cycleRes.data || [])
    setLoading(false)
  }

  // ── Helpers ──────────────────────────────────────────────────
  const getConsultantName = (id: string) =>
    consultants.find(c => c.id === id)?.full_name || '—'

  const getCycleBadge = (institutionId: string) => {
    const cycle = cycles.find(c => c.institution_id === institutionId)
    if (!cycle) return { label: 'Sem campanha', color: '#9ca3af', bg: '#f3f4f6' }
    if (cycle.status === 'active') return { label: 'Campanha ativa', color: '#16a34a', bg: '#f0fdf4' }
    if (cycle.status === 'released') return { label: 'Liberada', color: '#0891b2', bg: '#ecfeff' }
    return { label: 'Pré-campanha', color: '#d97706', bg: '#fffbeb' }
  }

  const getPlanBadge = (inst: any) => {
    if (inst.plan === 'trial') return { label: 'Trial', color: '#d97706', bg: '#fffbeb' }
    if (inst.plan_status === 'active') return { label: 'Ativo', color: '#16a34a', bg: '#f0fdf4' }
    if (inst.plan_status === 'suspended') return { label: 'Suspenso', color: '#dc2626', bg: '#fef2f2' }
    if (inst.plan_status === 'cancelled') return { label: 'Cancelado', color: '#9ca3af', bg: '#f3f4f6' }
    return { label: inst.plan || '—', color: '#6b7280', bg: '#f3f4f6' }
  }

  // ── Filters ───────────────────────────────────────────────────
  const filtered = institutions.filter(i => {
    const matchSearch =
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.city?.toLowerCase().includes(search.toLowerCase()) ||
      i.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && i.plan_status === 'active' && i.plan !== 'trial') ||
      (filterStatus === 'trial' && i.plan === 'trial') ||
      (filterStatus === 'suspended' && i.plan_status === 'suspended')
    return matchSearch && matchStatus
  })

  // ── Create School ─────────────────────────────────────────────
  const validateNewForm = () => {
    const errs: Record<string, string> = {}
    if (!newForm.name.trim()) errs.name = 'Nome é obrigatório'
    if (!newForm.city.trim()) errs.city = 'Cidade é obrigatória'
    if (!newForm.state.trim()) errs.state = 'Estado é obrigatório'
    if (!newForm.email.trim()) errs.email = 'E-mail é obrigatório'
    if (!newForm.password || newForm.password.length < 8) errs.password = 'Mínimo 8 caracteres'
    setNewFormErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleCreateSchool = async () => {
    if (!validateNewForm()) return
    setSavingSchool(true)
    try {
      // 1. Obtém session para passar o token para a Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Sessão expirada. Faça login novamente.')

      // 2. Cria a instituição primeiro
      const { data: institution, error: instErr } = await supabase
        .from('institutions')
        .insert({
          name: newForm.name.trim(),
          cnpj: newForm.cnpj.trim() || null,
          city: newForm.city.trim(),
          state: newForm.state.trim().toUpperCase(),
          phone: newForm.phone.trim() || null,
          email: newForm.email.trim().toLowerCase(),
          consultant_id: newForm.consultantId || null,
          plan: newForm.plan,
          plan_status: 'active',
        })
        .select()
        .single()

      if (instErr) throw new Error(instErr.message)

      // 3. Chama a Edge Function via fetch com anon key explícito
      const fnResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: newForm.email.trim().toLowerCase(),
            password: newForm.password,
            full_name: newForm.name.trim(),
            role: 'admin',
            user_type: 'school_user',
            institution_id: institution.id,
          }),
        }
      )

      const fnData = await fnResponse.json()

      if (!fnResponse.ok || fnData?.error) {
        // Rollback: remove a institution criada
        await supabase.from('institutions').delete().eq('id', institution.id)
        throw new Error(fnData?.error || 'Erro ao criar usuário')
      }

      showToast(`Escola "${newForm.name}" criada com sucesso! Gestor pode fazer login agora.`)
      setNewSchoolModal(false)
      setNewForm({ name: '', cnpj: '', city: '', state: '', email: '', password: '', phone: '', plan: 'trial', consultantId: '' })
      setNewFormErrors({})
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao criar escola.', false)
    } finally {
      setSavingSchool(false)
    }
  }

  // ── Edit School ───────────────────────────────────────────────
  const openEdit = (inst: any) => {
    setEditForm({
      plan: inst.plan || 'trial',
      plan_status: inst.plan_status || 'active',
      consultant_id: inst.consultant_id || '',
      name: inst.name || '',
      city: inst.city || '',
      state: inst.state || '',
      phone: inst.phone || '',
    })
    setEditModal(inst)
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('institutions')
        .update({
          name: editForm.name,
          city: editForm.city,
          state: editForm.state,
          phone: editForm.phone || null,
          plan: editForm.plan,
          plan_status: editForm.plan_status,
          consultant_id: editForm.consultant_id || null,
        })
        .eq('id', editModal.id)

      if (error) throw error
      showToast('Escola atualizada com sucesso!')
      setEditModal(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSavingEdit(false)
    }
  }

  // ── Release Campaign ──────────────────────────────────────────
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

      const existing = cycles.find(c =>
        c.institution_id === releaseModal.id &&
        ['setup', 'draft', 'released'].includes(c.status)
      )

      if (existing) {
        const { error } = await supabase.from('campaign_cycles').update(payload).eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('campaign_cycles').insert(payload)
        if (error) throw error
      }

      // Notifica gestor — ignora erro para não bloquear a liberação
      await supabase.from('system_notifications').insert({
        institution_id: releaseModal.id,
        title: `Campanha ${year} liberada!`,
        message: `Sua campanha de matrículas ${year} foi liberada. Acesse o sistema para configurar o setup e começar a captar alunos.`,
        type: 'info',
        read: false,
      }).then(({ error }) => {
        if (error) console.warn('Notificação não enviada:', error.message)
      })

      showToast(`Campanha ${year} liberada para ${releaseModal.name}! Gestor notificado.`)
      setReleaseModal(null)
      loadData()
    } catch (e: any) {
      showToast(`Erro ao liberar: ${e?.message || 'Tente novamente.'}`, false)
    } finally {
      setReleasing(false)
    }
  }

  // ── Suspend / Reactivate ──────────────────────────────────────
  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de "${inst.name}"?\n\nO gestor não conseguirá mais fazer login até ser reativado.`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    if (error) showToast('Erro ao suspender.', false)
    else { showToast(`${inst.name} suspenso. Gestor sem acesso.`); loadData() }
  }

  const handleReactivate = async (inst: any) => {
    if (!confirm(`Reativar acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', inst.id)
    if (error) showToast('Erro ao reativar.', false)
    else { showToast(`${inst.name} reativado! Gestor com acesso liberado.`); loadData() }
  }

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (inst: any) => {
    if (!confirm(`⚠️ EXCLUIR "${inst.name}"?\n\nEsta ação é IRREVERSÍVEL e removerá a instituição e todos os dados relacionados.`)) return
    const confirmName = window.prompt(`Para confirmar, digite o nome exato da escola:\n"${inst.name}"`)
    if (confirmName !== inst.name) {
      showToast('Nome incorreto. Exclusão cancelada.', false)
      return
    }
    try {
      await supabase.from('campaign_cycles').delete().eq('institution_id', inst.id)
      await supabase.from('system_notifications').delete().eq('institution_id', inst.id)
      await supabase.from('school_implementations').delete().eq('institution_id', inst.id)
      await supabase.from('users').update({ institution_id: null }).eq('institution_id', inst.id)
      const { error } = await supabase.from('institutions').delete().eq('id', inst.id)
      if (error) throw error
      showToast(`"${inst.name}" excluída permanentemente.`)
      loadData()
    } catch (e: any) {
      showToast(`Erro ao excluir: ${e?.message}`, false)
    }
  }

  // ── Stats ─────────────────────────────────────────────────────
  const stats = {
    total: institutions.length,
    active: institutions.filter(i => i.plan_status === 'active' && i.plan !== 'trial').length,
    trial: institutions.filter(i => i.plan === 'trial').length,
    suspended: institutions.filter(i => i.plan_status === 'suspended').length,
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Escolas</h1>
            <p className="text-gray-500 mt-1 text-sm">{institutions.length} instituição{institutions.length !== 1 ? 'ões' : ''} cadastrada{institutions.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setNewSchoolModal(true); setNewFormErrors({}) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Nova escola
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'from-gray-500 to-gray-600', filter: 'all' },
            { label: 'Ativas', value: stats.active, color: 'from-green-500 to-emerald-600', filter: 'active' },
            { label: 'Em trial', value: stats.trial, color: 'from-amber-500 to-orange-500', filter: 'trial' },
            { label: 'Suspensas', value: stats.suspended, color: 'from-red-500 to-rose-600', filter: 'suspended' },
          ].map(k => (
            <button
              key={k.filter}
              onClick={() => setFilterStatus(filterStatus === k.filter ? 'all' : k.filter)}
              className={`bg-white rounded-xl border p-5 text-left transition-all shadow-sm hover:shadow-md
                ${filterStatus === k.filter ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-gray-200'}`}
            >
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? '—' : k.value}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
            placeholder="Buscar por nome, cidade ou e-mail..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Escola</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Localização</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Consultor</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Plano</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Campanha</th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(6).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(6).fill(0).map((_, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton h="h-4" w="w-24" /></td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">
                        {search ? 'Nenhuma escola encontrada para essa busca' : 'Nenhuma escola cadastrada'}
                      </p>
                      {!search && (
                        <button
                          onClick={() => setNewSchoolModal(true)}
                          className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 font-semibold"
                        >
                          + Criar primeira escola
                        </button>
                      )}
                    </td>
                  </tr>
                ) : filtered.map(inst => {
                  const planBadge = getPlanBadge(inst)
                  const cycleBadge = getCycleBadge(inst.id)
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-cyan-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{inst.name}</p>
                            {inst.email && <p className="text-xs text-gray-400 mt-0.5">{inst.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          {inst.city && inst.state ? `${inst.city}, ${inst.state}` : inst.city || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          {getConsultantName(inst.consultant_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: planBadge.color, background: planBadge.bg }}>
                          {planBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ color: cycleBadge.color, background: cycleBadge.bg }}>
                          {cycleBadge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setDetailModal(inst)}
                            className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(inst)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              const yr = new Date().getFullYear()
                              setReleaseModal(inst)
                              setStartMonth(8)
                              setStartDate(`${yr}-08-01`)
                              setEndDate(`${yr + 1}-02-28`)
                            }}
                            className="flex items-center gap-1 text-xs px-2 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-medium transition-colors"
                            title="Liberar campanha"
                          >
                            <Megaphone className="w-3 h-3" /> Liberar
                          </button>
                          {inst.plan_status === 'suspended' ? (
                            <button
                              onClick={() => handleReactivate(inst)}
                              className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                              title="Reativar"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSuspend(inst)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Suspender"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(inst)}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir permanentemente"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 text-xs text-gray-400">
              Mostrando {filtered.length} de {institutions.length} escola{institutions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: Nova Escola ─────────────────────────────────── */}
      {newSchoolModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Nova escola</h2>
                <p className="text-xs text-gray-400 mt-0.5">Cria a instituição e o acesso do gestor</p>
              </div>
              <button onClick={() => setNewSchoolModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Dados da escola */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Dados da escola</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nome da escola *</label>
                    <input className={`${inputCls} ${newFormErrors.name ? 'border-red-400' : ''}`}
                      placeholder="Ex: Colégio São Francisco"
                      value={newForm.name}
                      onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} />
                    {newFormErrors.name && <p className="text-xs text-red-500 mt-1">{newFormErrors.name}</p>}
                  </div>

                  <div>
                    <label className={labelCls}>CNPJ</label>
                    <input className={inputCls} placeholder="00.000.000/0001-00"
                      value={newForm.cnpj}
                      onChange={e => setNewForm(f => ({ ...f, cnpj: e.target.value }))} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Cidade *</label>
                      <input className={`${inputCls} ${newFormErrors.city ? 'border-red-400' : ''}`}
                        placeholder="João Pessoa"
                        value={newForm.city}
                        onChange={e => setNewForm(f => ({ ...f, city: e.target.value }))} />
                      {newFormErrors.city && <p className="text-xs text-red-500 mt-1">{newFormErrors.city}</p>}
                    </div>
                    <div>
                      <label className={labelCls}>UF *</label>
                      <input className={`${inputCls} ${newFormErrors.state ? 'border-red-400' : ''}`}
                        placeholder="PB" maxLength={2}
                        value={newForm.state}
                        onChange={e => setNewForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Telefone</label>
                    <input className={inputCls} placeholder="(83) 99999-9999"
                      value={newForm.phone}
                      onChange={e => setNewForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Plano e consultor */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Plano e responsável</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Plano</label>
                    <select className={inputCls} value={newForm.plan}
                      onChange={e => setNewForm(f => ({ ...f, plan: e.target.value }))}>
                      {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Consultor responsável</label>
                    <select className={inputCls} value={newForm.consultantId}
                      onChange={e => setNewForm(f => ({ ...f, consultantId: e.target.value }))}>
                      <option value="">Sem consultor</option>
                      {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Acesso do gestor */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> Acesso do gestor
                </p>
                <div>
                  <label className={labelCls}>E-mail *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email"
                      className={`${inputCls} pl-9 ${newFormErrors.email ? 'border-red-400' : ''}`}
                      placeholder="gestor@escola.com.br"
                      value={newForm.email}
                      onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  {newFormErrors.email && <p className="text-xs text-red-500 mt-1">{newFormErrors.email}</p>}
                </div>
                <div>
                  <label className={labelCls}>Senha inicial *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className={`${inputCls} pr-10 ${newFormErrors.password ? 'border-red-400' : ''}`}
                      placeholder="Mínimo 8 caracteres"
                      value={newForm.password}
                      onChange={e => setNewForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newFormErrors.password && <p className="text-xs text-red-500 mt-1">{newFormErrors.password}</p>}
                  <p className="text-xs text-gray-400 mt-1">O gestor poderá alterar a senha após o primeiro acesso.</p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex gap-3 rounded-b-2xl">
              <button onClick={() => setNewSchoolModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleCreateSchool}
                disabled={savingSchool}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-blue-700"
              >
                {savingSchool
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                  : <><Plus className="w-4 h-4" /> Criar escola</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Editar Escola ───────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Editar escola</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editModal.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Nome da escola</label>
                <input className={inputCls} value={editForm.name}
                  onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Cidade</label>
                  <input className={inputCls} value={editForm.city}
                    onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>UF</label>
                  <input className={inputCls} maxLength={2} value={editForm.state}
                    onChange={e => setEditForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Telefone</label>
                <input className={inputCls} value={editForm.phone}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Plano</label>
                  <select className={inputCls} value={editForm.plan}
                    onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                    {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} value={editForm.plan_status}
                    onChange={e => setEditForm(f => ({ ...f, plan_status: e.target.value }))}>
                    {PLAN_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Consultor responsável</label>
                <select className={inputCls} value={editForm.consultant_id}
                  onChange={e => setEditForm(f => ({ ...f, consultant_id: e.target.value }))}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingEdit
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Liberar Campanha ────────────────────────────── */}
      {releaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Liberar campanha</h2>
                <p className="text-sm text-gray-500 mt-0.5">{releaseModal.name}</p>
              </div>
              <button onClick={() => setReleaseModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Mês de início das matrículas</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {months.map(m => (
                    <button key={m.v} onClick={() => {
                      setStartMonth(m.v)
                      setStartDate(`${new Date().getFullYear()}-${String(m.v).padStart(2, '0')}-01`)
                    }}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors
                        ${startMonth === m.v ? 'bg-cyan-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {m.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data de início</label>
                  <input type="date" className={inputCls} value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Data de fim</label>
                  <input type="date" className={inputCls} value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              <div className="bg-cyan-50 rounded-xl p-4 text-sm text-cyan-800 border border-cyan-100">
                <p className="font-semibold">Campanha {new Date().getFullYear() + 1}</p>
                <p className="mt-1 text-cyan-700 text-xs">
                  Início: {months.find(m => m.v === startMonth)?.l}/{new Date().getFullYear()} →
                  Fim: Fev/{new Date().getFullYear() + 1}
                </p>
                <p className="mt-2 text-xs text-cyan-600">
                  O gestor será notificado automaticamente no sistema.
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setReleaseModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button onClick={handleReleaseCampaign} disabled={releasing}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {releasing
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Liberando...</>
                  : <><Megaphone className="w-4 h-4" /> Liberar campanha</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Detalhes ────────────────────────────────────── */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Detalhes</h2>
              <button onClick={() => setDetailModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {[
                { label: 'Nome', value: detailModal.name },
                { label: 'CNPJ', value: detailModal.cnpj || '—' },
                { label: 'Cidade/UF', value: detailModal.city && detailModal.state ? `${detailModal.city}/${detailModal.state}` : '—' },
                { label: 'E-mail', value: detailModal.email || '—' },
                { label: 'Telefone', value: detailModal.phone || '—' },
                { label: 'Plano', value: detailModal.plan || '—' },
                { label: 'Status', value: detailModal.plan_status || '—' },
                { label: 'Consultor', value: getConsultantName(detailModal.consultant_id) },
                { label: 'Criado em', value: new Date(detailModal.created_at).toLocaleDateString('pt-BR') },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-2">
                  <span className="text-gray-400 font-medium">{row.label}</span>
                  <span className="text-gray-900 font-semibold text-right">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => { setDetailModal(null); openEdit(detailModal) }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-50"
              >
                Editar
              </button>
              <button onClick={() => setDetailModal(null)}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-semibold text-sm">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </SuperAdminLayout>
  )
}