// src/components/superadmin/AdminSchools.tsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, WHATSAPP_PHONE_COLUMNS } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { fmtBRLOrDash } from './escolas/format'
import { Skeleton, ToastBar, type ToastT, inp, lbl } from './escolas/ui'
import { StageBadge } from './escolas/pipeline'
import { PLANS, PLAN_STATUS } from './escolas/constants'
import NewSchoolWizard from './escolas/NewSchoolWizard'
import { releaseCampaignCycle, cycleYear, suggestedDates } from './escolas/releaseCampaign'
import { fmtDate } from './escolas/format'
import {
  Building2,
  Search,
  Megaphone,
  Edit2,
  X,
  Plus,
  RefreshCw,
  Eye,
  MapPin,
  Lock,
  Unlock,
  Trash2,
  Phone,
  MessageCircle,
  MoreVertical
} from 'lucide-react'

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
export default function AdminSchools() {
  const navigate = useNavigate()
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [cycles, setCycles] = useState<any[]>([])
  const [pendingChangeCounts, setPendingChangeCounts] = useState<Record<string, number>>({})
  const [waNumbers, setWaNumbers]   = useState<Record<string, any>>({})
  const [waUsageMap, setWaUsageMap] = useState<Record<string, { initiated: number; limit: number }>>({})

  const [phaseMap, setPhaseMap] = useState<Record<string, string>>({})
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
  const [menuPos, setMenuPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlan, setFilterPlan] = useState('all')
  const [toast, setToast] = useState<ToastT | null>(null)

  const [showWizard, setShowWizard] = useState(false)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [releaseModal, setReleaseModal] = useState<any | null>(null)

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear() + 1)
  const [releasing, setReleasing] = useState(false)

  const [editForm, setEditForm] = useState({
    name: '', cnpj: '', city: '', state: '', phone: '',
    plan: '', plan_status: '', consultant_id: '',
    monthly_value: '', implementation_value: '',
    wa_phone_number_id: '', wa_phone_number: '',
    wa_display_name: '', wa_waba_id: '', wa_is_active: true,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const cancelledRef = useRef(false)
  const cacheRef = useRef<any[]>([])

  useEffect(() => {
    cancelledRef.current = false
    loadData()
    return () => { cancelledRef.current = true }
  }, [])

  useEffect(() => {
    if (!menuFor) return
    const close = () => setMenuFor(null)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); window.removeEventListener('scroll', close, true) }
  }, [menuFor])

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4500)
  }

  const loadData = async () => {
    setLoading(true)
    const monthYear = new Date().toISOString().slice(0, 7)
    const [instRes, consultRes, cycleRes, waRes, usageRes, changeReqRes, procRes] = await Promise.all([
      supabase.from('institutions').select('id, name, city, state, email, phone, plan, plan_status, monthly_value, consultant_id, created_at, address, cnpj').order('name'),
      supabase.from('users').select('id, full_name, email').eq('user_type', 'consultant'),
      supabase.from('campaign_cycles')
        .select('institution_id, status, year, target_school_year, id, start_date, end_date, campaign_start_month, label')
        .order('created_at', { ascending: false }),
      supabase.from('whatsapp_phone_numbers').select(WHATSAPP_PHONE_COLUMNS),
      supabase.from('whatsapp_conversation_usage')
        .select('institution_id, initiated_count, limit_count')
        .eq('month_year', monthYear),
      supabase.from('campaign_change_requests').select('institution_id').eq('status', 'pending'),
      supabase.from('onboarding_processes').select('institution_id, current_phase'),
    ])
    if (cancelledRef.current) return
    if (instRes.error) console.error('institutions error:', instRes.error)
    setInstitutions(instRes.data || cacheRef.current)
    if (instRes.data) cacheRef.current = instRes.data
    setConsultants(consultRes.data || [])
    setCycles(cycleRes.data || [])
    const waMap: Record<string, any> = {}
    for (const r of (waRes.data || [])) waMap[r.institution_id] = r
    setWaNumbers(waMap)
    const usageMap: Record<string, { initiated: number; limit: number }> = {}
    for (const r of (usageRes.data || [])) {
      usageMap[r.institution_id] = { initiated: r.initiated_count || 0, limit: r.limit_count || 1000 }
    }
    setWaUsageMap(usageMap)
    const phMap: Record<string, string> = {}
    for (const r of (procRes.data || [])) if (r.current_phase) phMap[r.institution_id] = r.current_phase
    setPhaseMap(phMap)
    const pendingMap: Record<string, number> = {}
    for (const r of (changeReqRes.data || [])) pendingMap[r.institution_id] = (pendingMap[r.institution_id] || 0) + 1
    setPendingChangeCounts(pendingMap)
    setLoading(false)
  }

  const getConsultantName = (id: string) => consultants.find(c => c.id === id)?.full_name || '—'

  const getCycleBadge = (institutionId: string) => {
    const cycle = cycles.find(c => c.institution_id === institutionId)
    if (!cycle) return { label: 'Sem campanha', color: '#9ca3af', bg: '#f3f4f6' }
    const map: Record<string, { label: string; color: string; bg: string }> = {
      active:    { label: 'Ativa',         color: '#16a34a', bg: '#f0fdf4' },
      released:  { label: 'Liberada',      color: '#0891b2', bg: '#ecfeff' },
      setup:     { label: 'A liberar',     color: '#d97706', bg: '#fffbeb' },
      draft:     { label: 'A liberar',     color: '#d97706', bg: '#fffbeb' },
      completed: { label: 'Concluída',     color: '#7c3aed', bg: '#f5f3ff' },
    }
    return map[cycle.status] || { label: 'Pré-campanha', color: '#d97706', bg: '#fffbeb' }
  }

  const getPlanBadge = (inst: any) => {
    if (inst.plan === 'gratuito') return { label: 'Gratuito', color: '#7c3aed', bg: '#f5f3ff' }
    if (inst.plan === 'trial')    return { label: 'Trial',    color: '#d97706', bg: '#fffbeb' }
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      active:           { label: 'Ativo',                  color: '#16a34a', bg: '#f0fdf4' },
      pending_contract: { label: 'Aguardando contrato',    color: '#6366f1', bg: '#eef2ff' },
      pending_payment:  { label: 'Aguardando pagamento',   color: '#f59e0b', bg: '#fffbeb' },
      suspended:        { label: 'Suspenso',               color: '#dc2626', bg: '#fef2f2' },
      cancelled:        { label: 'Cancelado',              color: '#9ca3af', bg: '#f3f4f6' },
    }
    return statusMap[inst.plan_status] || { label: inst.plan_status || '—', color: '#6b7280', bg: '#f3f4f6' }
  }

  const filtered = institutions.filter(i => {
    const matchSearch = !search ||
      i.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.city?.toLowerCase().includes(search.toLowerCase()) ||
      i.email?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && i.plan_status === 'active') ||
      (filterStatus === 'pending' && (i.plan_status === 'pending_contract' || i.plan_status === 'pending_payment')) ||
      (filterStatus === 'suspended' && i.plan_status === 'suspended') ||
      (filterStatus === 'free' && i.plan === 'gratuito')
    const matchPlan = filterPlan === 'all' || i.plan === filterPlan
    return matchSearch && matchStatus && matchPlan
  })

  const stats = {
    total:     institutions.length,
    active:    institutions.filter(i => i.plan_status === 'active').length,
    pending:   institutions.filter(i => ['pending_contract','pending_payment'].includes(i.plan_status)).length,
    suspended: institutions.filter(i => i.plan_status === 'suspended').length,
    free:      institutions.filter(i => i.plan === 'gratuito').length,
  }

  const openEdit = (inst: any) => {
    const wa = waNumbers[inst.id]
    setEditForm({
      name: inst.name || '', cnpj: inst.cnpj || '',
      city: inst.city || '', state: inst.state || '', phone: inst.phone || '',
      plan: inst.plan || 'escola', plan_status: inst.plan_status || 'active',
      consultant_id: inst.consultant_id || '',
      monthly_value: String(inst.monthly_value || 550),
      implementation_value: String(inst.implementation_value || 550),
      wa_phone_number_id: wa?.phone_number_id || '',
      wa_phone_number:    wa?.phone_number    || '',
      wa_display_name:    wa?.display_name    || '',
      wa_waba_id:         wa?.waba_id         || '',
      wa_is_active:       wa?.is_active       ?? true,
    })
    setEditModal(inst)
  }

  const handleSaveEdit = async () => {
    if (!editModal) return
    setSavingEdit(true)
    try {
      const { error } = await supabase.from('institutions').update({
        name: editForm.name, cnpj: editForm.cnpj || null,
        city: editForm.city, state: editForm.state, phone: editForm.phone || null,
        plan: editForm.plan, plan_status: editForm.plan_status,
        consultant_id: editForm.consultant_id || null,
        monthly_value: Number(editForm.monthly_value),
        implementation_value: Number(editForm.implementation_value),
      }).eq('id', editModal.id)
      if (error) throw error

      if (editForm.wa_phone_number_id.trim()) {
        const { error: waErr } = await supabase
          .from('whatsapp_phone_numbers')
          .upsert({
            institution_id:  editModal.id,
            phone_number_id: editForm.wa_phone_number_id.trim(),
            phone_number:    editForm.wa_phone_number.trim() || null,
            display_name:    editForm.wa_display_name.trim() || null,
            is_active:       editForm.wa_is_active,
            use_meta_api:    true,
          }, { onConflict: 'institution_id' })
        if (waErr) throw waErr
      }

      showToast('Escola atualizada com sucesso!')
      setEditModal(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    } finally {
      setSavingEdit(false)
    }
  }

  const getBestCycle = (id: string) => {
    const all = cycles.filter(c => c.institution_id === id && !['active','completed','archived'].includes(c.status))
    return all.find(c => c.status === 'setup') ?? all.find(c => c.status === 'draft') ?? all[0] ?? null
  }

  const handleReleaseCampaign = async () => {
    if (!releaseModal) return
    setReleasing(true)
    const existing = cycles.find(c => c.institution_id === releaseModal.id && cycleYear(c) === releaseYear && !['completed', 'archived'].includes(c.status))
    const { data: auth } = await supabase.auth.getUser()
    const res = await releaseCampaignCycle({ institutionId: releaseModal.id, year: releaseYear, existing, userId: auth?.user?.id })
    setReleasing(false)
    if (!res.ok) { showToast(res.error, false); return }
    showToast(`Campanha ${releaseYear} liberada para ${releaseModal.name}!`)
    setReleaseModal(null)
    loadData()
  }

  const handleSuspend = async (inst: any) => {
    if (!confirm(`Suspender acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'suspended' }).eq('id', inst.id)
    if (error) showToast('Erro ao suspender.', false)
    else { showToast(`${inst.name} suspenso.`); loadData() }
  }

  const handleReactivate = async (inst: any) => {
    if (!confirm(`Reativar acesso de "${inst.name}"?`)) return
    const { error } = await supabase.from('institutions').update({ plan_status: 'active' }).eq('id', inst.id)
    if (error) showToast('Erro ao reativar.', false)
    else { showToast(`${inst.name} reativado!`); loadData() }
  }

  const handleDelete = async (inst: any) => {
    if (!confirm(`⚠️ EXCLUIR "${inst.name}"?\n\nEsta ação é IRREVERSÍVEL.`)) return
    const confirmName = window.prompt(`Para confirmar, digite o nome exato:\n"${inst.name}"`)
    if (confirmName !== inst.name) { showToast('Nome incorreto. Cancelado.', false); return }
    try {
      await supabase.from('campaign_cycles').delete().eq('institution_id', inst.id)
      await supabase.from('system_notifications').delete().eq('institution_id', inst.id)
      await supabase.from('payments').delete().eq('institution_id', inst.id)
      await supabase.from('users').update({ institution_id: null }).eq('institution_id', inst.id)
      const { error } = await supabase.from('institutions').delete().eq('id', inst.id)
      if (error) throw error
      showToast(`"${inst.name}" excluída.`)
      loadData()
    } catch (e: any) {
      showToast(`Erro ao excluir: ${e?.message}`, false)
    }
  }

  const openRelease = (inst: any) => {
    const bestCycle = getBestCycle(inst.id)
    setReleaseModal(inst)
    setReleaseYear(bestCycle?.target_school_year ?? bestCycle?.year ?? new Date().getFullYear() + 1)
  }

  const actionsMenu = (inst: any) => (
    <button onClick={e => { e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const below = window.innerHeight - r.bottom > 260; setMenuPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 224), right: window.innerWidth - r.right }); setMenuFor(menuFor === inst.id ? null : inst.id) }}
      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Mais ações" aria-label="Mais ações">
      <MoreVertical className="w-4 h-4" />
    </button>
  )

  // Menu de ações: um só para a página. No celular é uma janela fixa na parte de baixo;
  // no computador abre ao lado do botão e fecha ao rolar (não fica solto).
  const menuInst = menuFor ? institutions.find(i => i.id === menuFor) : null
  const menuItem = 'w-full flex items-center gap-3 px-4 py-3 md:px-3.5 md:py-2 text-sm text-left'
  const menuPanel = menuInst && (
    <div className="fixed inset-0 z-[300]" onClick={() => setMenuFor(null)}>
      <div className="absolute inset-0 bg-black/40 md:bg-transparent" />
      <div onClick={e => e.stopPropagation()}
        style={isDesktop ? { top: menuPos.top, right: menuPos.right } : undefined}
        className="absolute bottom-0 left-0 right-0 md:bottom-auto md:left-auto md:right-auto md:w-52 bg-white rounded-t-2xl md:rounded-xl border border-gray-200 shadow-xl py-2 md:py-1.5">
        <p className="md:hidden px-4 pb-2 text-xs font-semibold text-gray-400 truncate">{menuInst.name}</p>
        <button onClick={() => { setMenuFor(null); openEdit(menuInst) }} className={`${menuItem} hover:bg-gray-50 text-gray-700`}><Edit2 className="w-4 h-4" /> Editar dados</button>
        <button onClick={() => { setMenuFor(null); openRelease(menuInst) }} className={`${menuItem} hover:bg-gray-50 text-gray-700`}><Megaphone className="w-4 h-4" /> Liberar campanha</button>
        {menuInst.plan_status === 'suspended' ? (
          <button onClick={() => { setMenuFor(null); handleReactivate(menuInst) }} className={`${menuItem} hover:bg-green-50 text-green-700`}><Unlock className="w-4 h-4" /> Reativar</button>
        ) : (
          <button onClick={() => { setMenuFor(null); handleSuspend(menuInst) }} className={`${menuItem} hover:bg-orange-50 text-orange-600`}><Lock className="w-4 h-4" /> Suspender</button>
        )}
        <div className="my-1 border-t border-gray-100" />
        <button onClick={() => { setMenuFor(null); handleDelete(menuInst) }} className={`${menuItem} hover:bg-red-50 text-red-600`}><Trash2 className="w-4 h-4" /> Excluir escola</button>
        <button onClick={() => setMenuFor(null)} className="md:hidden w-full px-4 py-3 mt-1 border-t border-gray-100 text-sm font-semibold text-gray-500">Cancelar</button>
      </div>
    </div>
  )

  return (
    <SuperAdminLayout>
      <div className="p-4 md:p-8 space-y-4 md:space-y-6">
        {toast && <ToastBar toast={toast} onClose={() => setToast(null)} />}

        {/* Header */}
        <div className="aion-band flex items-center justify-between gap-3">
          <div>
            <h1 className="aion-band-title">Escolas</h1>
            <p className="aion-band-sub">{institutions.length} {institutions.length !== 1 ? 'escolas cadastradas' : 'escola cadastrada'}</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setShowWizard(true)} className="flex items-center gap-2 px-4 py-2.5 whitespace-nowrap bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm shadow-sm hover:from-cyan-600 hover:to-blue-700">
              <Plus className="w-4 h-4" /> Nova escola
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="aion-snap grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total',      value: stats.total,     filter: 'all',       color: 'border-gray-200' },
            { label: 'Ativas',     value: stats.active,    filter: 'active',    color: 'border-green-200' },
            { label: 'Pendentes',  value: stats.pending,   filter: 'pending',   color: 'border-yellow-200' },
            { label: 'Suspensas',  value: stats.suspended, filter: 'suspended', color: 'border-red-200' },
            { label: 'Gratuitas',  value: stats.free,      filter: 'free',      color: 'border-purple-200' },
          ].map(k => (
            <button key={k.filter} onClick={() => setFilterStatus(filterStatus === k.filter ? 'all' : k.filter)}
              className={`bg-white rounded-xl border p-4 text-left transition-all shadow-sm hover:shadow-md
                ${filterStatus === k.filter ? `${k.color} ring-2 ring-offset-0` : 'border-gray-200'}`}>
              <p className="text-xs text-gray-500 font-medium">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : k.value}</p>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder="Buscar por nome, cidade ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none bg-white"
            value={filterPlan} onChange={e => setFilterPlan(e.target.value)}>
            <option value="all">Todos os planos</option>
            {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Escola","Consultor",'Plano','Etapa','Campanha','WhatsApp','Financeiro','Ações'].map(h => (
                    <th key={h} className="px-2.5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>{Array(8).fill(0).map((_, j) => <td key={j} className="px-5 py-4"><Skeleton h="h-4" w="w-20" /></td>)}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">{search ? 'Nenhuma escola encontrada' : 'Nenhuma escola cadastrada'}</p>
                      {!search && <button onClick={() => setShowWizard(true)} className="mt-2 text-sm text-cyan-600 font-semibold">+ Criar primeira escola</button>}
                    </td>
                  </tr>
                ) : filtered.map(inst => {
                  const planBadge = getPlanBadge(inst)
                  const cycleBadge = getCycleBadge(inst.id)
                  return (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2.5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-cyan-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{inst.name}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{inst.city && inst.state ? `${inst.city}, ${inst.state}` : '—'}</p>
                            {inst.email && <p className="text-xs text-gray-400">{inst.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-2.5 py-3.5 text-sm text-gray-600">
                        {getConsultantName(inst.consultant_id)}
                      </td>
                      <td className="px-2.5 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: planBadge.color, background: planBadge.bg }}>
                          {planBadge.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-3.5">
                        <StageBadge inst={inst} phase={phaseMap[inst.id]} />
                      </td>
                      <td className="px-2.5 py-3.5">
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: cycleBadge.color, background: cycleBadge.bg }}>
                          {cycleBadge.label}
                        </span>
                        {!!pendingChangeCounts[inst.id] && (
                          <span title="Ajuste de campanha pendente de aprovação" className="ml-1.5 text-xs font-semibold px-2 py-1 rounded-full text-amber-700 bg-amber-50 border border-amber-200">
                            ⏳ {pendingChangeCounts[inst.id]}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-3.5">
                        {waNumbers[inst.id]?.is_active
                          ? <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full" title={waNumbers[inst.id]?.phone_number || ''}>
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo
                              </span>
                              {waUsageMap[inst.id] && (
                                <span className="text-[10px] text-gray-400 pl-0.5">
                                  {waUsageMap[inst.id].initiated}/{waUsageMap[inst.id].limit} conv.
                                </span>
                              )}
                            </div>
                          : waNumbers[inst.id]
                            ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />Inativo
                              </span>
                            : <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />Pendente
                              </span>
                        }
                      </td>
                      <td className="px-2.5 py-3.5">
                        {inst.plan === 'gratuito' ? (
                          <span className="text-xs text-purple-600 font-semibold">Gratuito</span>
                        ) : (
                          <div className="text-xs text-gray-500">
                            <p className="font-semibold text-gray-700">{fmtBRLOrDash(inst.monthly_value)}/mês</p>
                            {inst.implementation_value > 0 && <p className="text-gray-400">Impl. {fmtBRLOrDash(inst.implementation_value)}</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(`/super-admin/schools/${inst.id}`)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg hover:bg-cyan-100 font-semibold">
                            <Eye className="w-3.5 h-3.5" /> Detalhes
                          </button>
                          {actionsMenu(inst)}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              Mostrando {filtered.length} de {institutions.length} escola{institutions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
        {/* Cards (celular) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            Array(3).fill(0).map((_, i) => <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4"><Skeleton h="h-4" w="w-40" /></div>)
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 py-12 text-center">
              <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">{search ? 'Nenhuma escola encontrada' : 'Nenhuma escola cadastrada'}</p>
            </div>
          ) : filtered.map(inst => {
            const planBadge = getPlanBadge(inst)
            const cycleBadge = getCycleBadge(inst.id)
            const wa = waNumbers[inst.id]
            return (
              <div key={inst.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => navigate(`/super-admin/schools/${inst.id}`)} className="flex items-start gap-3 min-w-0 text-left">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-cyan-600" /></div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm leading-snug">{inst.name}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{inst.city && inst.state ? `${inst.city}, ${inst.state}` : '—'}</p>
                    </div>
                  </button>
                  {actionsMenu(inst)}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: planBadge.color, background: planBadge.bg }}>{planBadge.label}</span>
                  <StageBadge inst={inst} phase={phaseMap[inst.id]} />
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: cycleBadge.color, background: cycleBadge.bg }}>{cycleBadge.label}</span>
                  {!!pendingChangeCounts[inst.id] && <span className="text-xs font-semibold px-2 py-1 rounded-full text-amber-700 bg-amber-50 border border-amber-200">⏳ {pendingChangeCounts[inst.id]}</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                  <div><p className="text-gray-400">WhatsApp</p><p className={`font-semibold ${wa?.is_active ? 'text-green-700' : wa ? 'text-yellow-700' : 'text-gray-400'}`}>{wa?.is_active ? 'Ativo' : wa ? 'Inativo' : 'Pendente'}</p>{wa?.is_active && waUsageMap[inst.id] && <p className="text-[10px] text-gray-400">{waUsageMap[inst.id].initiated}/{waUsageMap[inst.id].limit} conv.</p>}</div>
                  <div><p className="text-gray-400">Mensalidade</p><p className="font-semibold text-gray-700">{inst.plan === 'gratuito' ? 'Gratuito' : `${fmtBRLOrDash(inst.monthly_value)}/mês`}</p></div>
                  <div><p className="text-gray-400">Consultor</p><p className="font-semibold text-gray-700 truncate">{getConsultantName(inst.consultant_id)}</p></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {menuPanel}

      {/* ── WIZARD ─────────────────────────────────────────── */}
      {showWizard && (
        <NewSchoolWizard
          consultants={consultants}
          onClose={() => setShowWizard(false)}
          onSuccess={loadData}
        />
      )}

      {/* ── MODAL: Editar escola ────────────────────────────── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Editar escola</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editModal.name}</p>
              </div>
              <button onClick={() => setEditModal(null)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={lbl}>Nome da escola</label>
                <input className={inp} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={lbl}>CNPJ</label>
                <input className={inp} value={editForm.cnpj} onChange={e => setEditForm(f => ({ ...f, cnpj: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={lbl}>Cidade</label>
                  <input className={inp} value={editForm.city} onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>UF</label>
                  <input className={inp} maxLength={2} value={editForm.state} onChange={e => setEditForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Telefone</label>
                <input className={inp} value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Plano</label>
                  <select className={inp} value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))}>
                    {PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    <option value="trial">Trial</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Status</label>
                  <select className={inp} value={editForm.plan_status} onChange={e => setEditForm(f => ({ ...f, plan_status: e.target.value }))}>
                    {PLAN_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Implantação (R$)</label>
                  <input type="number" className={inp} value={editForm.implementation_value} onChange={e => setEditForm(f => ({ ...f, implementation_value: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>Mensalidade (R$)</label>
                  <input type="number" className={inp} value={editForm.monthly_value} onChange={e => setEditForm(f => ({ ...f, monthly_value: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Consultor responsável</label>
                <select className={inp} value={editForm.consultant_id} onChange={e => setEditForm(f => ({ ...f, consultant_id: e.target.value }))}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>

              {/* ── WhatsApp ── */}
              <div className="border-t border-dashed border-gray-200 pt-4 mt-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={lbl}>Phone Number ID (Meta)</label>
                    <input className={inp} placeholder="1007880222413531"
                      value={editForm.wa_phone_number_id}
                      onChange={e => setEditForm(f => ({ ...f, wa_phone_number_id: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Número de telefone</label>
                    <input className={inp} placeholder="5583999990001"
                      value={editForm.wa_phone_number}
                      onChange={e => setEditForm(f => ({ ...f, wa_phone_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className={lbl}>Nome de exibição no WhatsApp</label>
                    <input className={inp} placeholder="Colégio São João"
                      value={editForm.wa_display_name}
                      onChange={e => setEditForm(f => ({ ...f, wa_display_name: e.target.value }))} />
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">WhatsApp ativo</p>
                      <p className="text-xs text-gray-400">Habilita envio e recebimento de mensagens</p>
                    </div>
                    <button type="button"
                      onClick={() => setEditForm(f => ({ ...f, wa_is_active: !f.wa_is_active }))}
                      className={`relative w-11 h-6 rounded-full transition-colors ${editForm.wa_is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${editForm.wa_is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                  {!editForm.wa_phone_number_id && (
                    <p className="text-xs text-gray-400">Preencha o Phone Number ID para salvar a configuração WhatsApp.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingEdit ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Liberar campanha ─────────────────────────── */}
      {releaseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Liberar campanha</h2>
                <p className="text-sm text-gray-500 mt-0.5">{releaseModal.name}</p>
              </div>
              <button onClick={() => setReleaseModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className={lbl}>Ano letivo da campanha</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() + 2].map(y => (
                    <button key={y} onClick={() => setReleaseYear(y)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${releaseYear === y ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{y}</button>
                  ))}
                </div>
              </div>
              <div className="bg-cyan-50 border border-cyan-100 rounded-xl p-3 text-sm text-cyan-700">
                <p className="font-semibold">Campanha {releaseYear}</p>
                <p className="text-xs mt-1">Período sugerido: {fmtDate(suggestedDates(releaseYear).start)} a {fmtDate(suggestedDates(releaseYear).end)}. A escola recebe o aviso no sistema, confere a meta sugerida, acerta as datas e ativa.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setReleaseModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={handleReleaseCampaign} disabled={releasing} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {releasing ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Liberando...</> : <><Megaphone className="w-4 h-4" /> Liberar campanha</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </SuperAdminLayout>
  )
}