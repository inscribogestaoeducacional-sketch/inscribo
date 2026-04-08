// src/components/superadmin/ConsultantSchools.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  Building2, CheckCircle2, Circle, X, Plus, Calendar,
  BookOpen, Clock, CheckCheck, AlertTriangle, ChevronDown,
  MapPin, Mail, Phone, User, Send
} from 'lucide-react'

const CHECKLIST_STEPS = [
  { key: 'step_onboarding_done',     label: 'Onboarding realizado'     },
  { key: 'step_whatsapp_connected',  label: 'WhatsApp conectado'       },
  { key: 'step_campaign_configured', label: 'Campanha configurada'     },
  { key: 'step_team_trained',        label: 'Time treinado'            },
  { key: 'step_first_lead',          label: 'Primeiro lead registrado' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Não iniciado', color: '#6b7280', bg: '#f3f4f6' },
  in_progress:  { label: 'Em andamento', color: '#3b82f6', bg: '#eff6ff' },
  completed:    { label: 'Concluído',    color: '#22c55e', bg: '#f0fdf4' },
  stuck:        { label: 'Travado',      color: '#ef4444', bg: '#fef2f2' },
}

const TRAINING_TYPES = [
  { value: 'initial',  label: 'Treinamento inicial',   icon: '🚀' },
  { value: 'followup', label: 'Acompanhamento',         icon: '🔄' },
  { value: 'advanced', label: 'Avançado',               icon: '⭐' },
  { value: 'custom',   label: 'Personalizado',          icon: '🎯' },
]

const TRAINING_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Agendado',  color: '#3b82f6', bg: '#eff6ff' },
  done:       { label: 'Realizado', color: '#22c55e', bg: '#f0fdf4' },
  cancelled:  { label: 'Cancelado', color: '#9ca3af', bg: '#f3f4f6' },
}

const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

function healthColor(score: number) {
  if (score >= 71) return '#22c55e'
  if (score >= 41) return '#f59e0b'
  return '#ef4444'
}

function healthBg(score: number) {
  if (score >= 71) return '#dcfce7'
  if (score >= 41) return '#fef9c3'
  return '#fee2e2'
}

export default function ConsultantSchools() {
  const [implementations, setImplementations] = useState<any[]>([])
  const [trainings, setTrainings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'schools' | 'trainings' | 'suggest'>('schools')
  const [toast, setToast] = useState('')
  const [toastOk, setToastOk] = useState(true)

  // Edit modal
  const [editModal, setEditModal] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editHealth, setEditHealth] = useState(0)
  const [saving, setSaving] = useState(false)

  // Training modal
  const [trainingModal, setTrainingModal] = useState(false)
  const [trainingForm, setTrainingForm] = useState({
    institution_id: '', title: '', type: 'initial',
    scheduled_at: '', notes: '',
  })
  const [savingTraining, setSavingTraining] = useState(false)

  // Suggest modal
  const [suggestForm, setSuggestForm] = useState({
    name: '', cnpj: '', city: '', state: '', phone: '',
    contact_name: '', contact_email: '', estimated_students: '', notes: '',
  })
  const [savingSuggest, setSavingSuggest] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('inscribo-user')
    if (stored) {
      const u = JSON.parse(stored)
      setUserId(u.id)
      loadData(u.id)
    }
  }, [])

  const showToast = (msg: string, ok = true) => {
    setToast(msg); setToastOk(ok)
    setTimeout(() => setToast(''), 4000)
  }

  const loadData = async (uid: string) => {
    setLoading(true)
    const [iRes, tRes] = await Promise.all([
      supabase.from('school_implementations').select('*').eq('consultant_id', uid).order('created_at', { ascending: false }),
      supabase.from('trainings').select('*, institutions(name)').eq('consultant_id', uid).order('scheduled_at', { ascending: false }),
    ])
    setImplementations(iRes.data || [])
    setTrainings(tRes.data || [])
    setLoading(false)
  }

  const openEdit = (imp: any) => {
    setEditModal(imp)
    const steps: Record<string, boolean> = {}
    CHECKLIST_STEPS.forEach(s => { steps[s.key] = !!imp[s.key] })
    setEditForm(steps)
    setEditNotes(imp.notes || '')
    setEditStatus(imp.status)
    setEditHealth(imp.health_score || 0)
  }

  const saveEdit = async () => {
    if (!editModal || !userId) return
    setSaving(true)
    const { data } = await supabase
      .from('school_implementations')
      .update({ ...editForm, notes: editNotes, status: editStatus, health_score: editHealth, updated_at: new Date().toISOString() })
      .eq('id', editModal.id)
      .select().single()
    setSaving(false)
    if (data) {
      setImplementations(prev => prev.map(i => i.id === data.id ? data : i))
      setEditModal(null)
      showToast('Atualizado com sucesso!')
    }
  }

  const handleCreateTraining = async () => {
    if (!userId || !trainingForm.institution_id || !trainingForm.title || !trainingForm.scheduled_at) return
    setSavingTraining(true)
    const { error } = await supabase.from('trainings').insert({
      consultant_id: userId,
      institution_id: trainingForm.institution_id,
      title: trainingForm.title,
      type: trainingForm.type,
      status: 'scheduled',
      scheduled_at: trainingForm.scheduled_at,
      notes: trainingForm.notes || null,
    })
    setSavingTraining(false)
    if (!error) {
      showToast('Treinamento agendado!')
      setTrainingModal(false)
      setTrainingForm({ institution_id: '', title: '', type: 'initial', scheduled_at: '', notes: '' })
      loadData(userId)
    } else {
      showToast('Erro ao agendar treinamento.', false)
    }
  }

  const handleMarkTrainingDone = async (id: string) => {
    await supabase.from('trainings').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id)
    showToast('Treinamento marcado como realizado!')
    if (userId) loadData(userId)
  }

  const handleCancelTraining = async (id: string) => {
    await supabase.from('trainings').update({ status: 'cancelled' }).eq('id', id)
    showToast('Treinamento cancelado.')
    if (userId) loadData(userId)
  }

  const handleSuggest = async () => {
    if (!userId || !suggestForm.name) return
    setSavingSuggest(true)
    const { error } = await supabase.from('school_suggestions').insert({
      consultant_id: userId,
      name: suggestForm.name.trim(),
      cnpj: suggestForm.cnpj || null,
      city: suggestForm.city || null,
      state: suggestForm.state || null,
      phone: suggestForm.phone || null,
      contact_name: suggestForm.contact_name || null,
      contact_email: suggestForm.contact_email || null,
      estimated_students: suggestForm.estimated_students ? Number(suggestForm.estimated_students) : null,
      notes: suggestForm.notes || null,
      status: 'pending',
    })
    setSavingSuggest(false)
    if (!error) {
      showToast('Sugestão enviada para aprovação do admin!')
      setSuggestForm({ name: '', cnpj: '', city: '', state: '', phone: '', contact_name: '', contact_email: '', estimated_students: '', notes: '' })
    } else {
      showToast('Erro ao enviar sugestão.', false)
    }
  }

  // Institutions for training dropdown
  const institutionOptions = implementations.map(i => ({
    id: i.institution_id || i.id,
    name: i.school_name,
  }))

  const upcomingTrainings = trainings.filter(t => t.status === 'scheduled')
  const doneTrainings = trainings.filter(t => t.status === 'done')

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </SuperAdminLayout>
    )
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-sm font-medium text-white ${toastOk ? 'bg-green-600' : 'bg-red-600'}`}>
            {toastOk ? <CheckCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minhas Escolas</h1>
            <p className="text-gray-500 mt-1 text-sm">{implementations.length} escola{implementations.length !== 1 ? 's' : ''} em acompanhamento</p>
          </div>
          {activeTab === 'trainings' && (
            <button
              onClick={() => setTrainingModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
            >
              <Plus className="w-4 h-4" /> Agendar treinamento
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'schools', label: 'Escolas', count: implementations.length },
            { key: 'trainings', label: 'Treinamentos', count: upcomingTrainings.length },
            { key: 'suggest', label: 'Sugerir escola', count: null },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                ${activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="w-5 h-5 bg-cyan-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Escolas ── */}
        {activeTab === 'schools' && (
          <>
            {implementations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Nenhuma escola em acompanhamento</p>
                <p className="text-sm text-gray-400 mt-1">Feche uma oportunidade no pipeline para iniciar o acompanhamento</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {implementations.map(imp => {
                  const done = CHECKLIST_STEPS.filter(s => imp[s.key]).length
                  const pct = Math.round((done / 5) * 100)
                  const sCfg = STATUS_CONFIG[imp.status] || STATUS_CONFIG.not_started
                  const hColor = healthColor(imp.health_score || 0)
                  const schoolTrainings = trainings.filter(t => t.institution_id === imp.institution_id)

                  return (
                    <div key={imp.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <h3 className="font-bold text-gray-900">{imp.school_name}</h3>
                          {schoolTrainings.length > 0 && (
                            <p className="text-xs text-cyan-600 mt-0.5">
                              {schoolTrainings.filter(t => t.status === 'scheduled').length} treinamento{schoolTrainings.filter(t => t.status === 'scheduled').length !== 1 ? 's' : ''} agendado{schoolTrainings.filter(t => t.status === 'scheduled').length !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0"
                          style={{ color: sCfg.color, background: sCfg.bg }}>
                          {sCfg.label}
                        </span>
                      </div>

                      {/* Checklist */}
                      <div className="space-y-2 mb-4">
                        {CHECKLIST_STEPS.map(step => (
                          <div key={step.key} className="flex items-center gap-2">
                            {imp[step.key]
                              ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                              : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                            <span className={`text-sm ${imp[step.key] ? 'text-gray-700' : 'text-gray-400'}`}>{step.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progresso</span><span>{done}/5 passos</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Health */}
                      <div className="flex items-center justify-between p-3 rounded-xl mb-4"
                        style={{ background: healthBg(imp.health_score || 0) }}>
                        <span className="text-sm font-medium" style={{ color: hColor }}>Health score</span>
                        <span className="text-lg font-bold" style={{ color: hColor }}>{imp.health_score || 0}%</span>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => openEdit(imp)}
                          className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 font-medium">
                          Atualizar
                        </button>
                        <button
                          onClick={() => { setActiveTab('trainings'); setTrainingModal(true); setTrainingForm(f => ({ ...f, institution_id: imp.institution_id || '' })) }}
                          className="flex-1 py-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm rounded-xl hover:bg-cyan-100 font-medium flex items-center justify-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" /> Treinar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: Treinamentos ── */}
        {activeTab === 'trainings' && (
          <div className="space-y-6">
            {/* Agendados */}
            <div>
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Agendados ({upcomingTrainings.length})
              </h2>
              {upcomingTrainings.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-400">Nenhum treinamento agendado</p>
                  <button onClick={() => setTrainingModal(true)} className="mt-3 text-sm text-cyan-600 font-semibold">
                    + Agendar primeiro treinamento
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingTrainings.map(t => {
                    const typeInfo = TRAINING_TYPES.find(ty => ty.value === t.type)
                    const isOverdue = t.scheduled_at && new Date(t.scheduled_at) < new Date()
                    return (
                      <div key={t.id} className={`bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between gap-4 ${isOverdue ? 'border-amber-200 bg-amber-50/30' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-cyan-50 flex items-center justify-center text-xl flex-shrink-0">
                            {typeInfo?.icon || '📚'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm">{t.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{t.institutions?.name || '—'}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ color: '#3b82f6', background: '#eff6ff' }}>
                                {typeInfo?.label || t.type}
                              </span>
                              {isOverdue && (
                                <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" /> Atrasado
                                </span>
                              )}
                            </div>
                            {t.notes && <p className="text-xs text-gray-400 mt-1 italic truncate">"{t.notes}"</p>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => handleCancelTraining(t.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancelar">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleMarkTrainingDone(t.id)}
                            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                            <CheckCheck className="w-3.5 h-3.5" /> Realizado
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Realizados */}
            {doneTrainings.length > 0 && (
              <div>
                <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4 text-green-500" /> Realizados ({doneTrainings.length})
                </h2>
                <div className="space-y-2">
                  {doneTrainings.map(t => {
                    const typeInfo = TRAINING_TYPES.find(ty => ty.value === t.type)
                    return (
                      <div key={t.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 opacity-75">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-base flex-shrink-0">
                          {typeInfo?.icon || '📚'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 text-sm">{t.title}</p>
                          <p className="text-xs text-gray-400">{t.institutions?.name || '—'} • {t.done_at ? new Date(t.done_at).toLocaleDateString('pt-BR') : '—'}</p>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: '#22c55e', background: '#f0fdf4' }}>
                          Realizado
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Sugerir escola ── */}
        {activeTab === 'suggest' && (
          <div className="max-w-xl">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div>
                <h2 className="font-bold text-gray-900">Sugerir nova escola</h2>
                <p className="text-sm text-gray-400 mt-1">O super admin irá revisar e aprovar a criação da escola no sistema.</p>
              </div>

              <div>
                <label className={labelCls}>Nome da escola *</label>
                <input className={inputCls} placeholder="Ex: Colégio São Francisco"
                  value={suggestForm.name}
                  onChange={e => setSuggestForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>CNPJ</label>
                <input className={inputCls} placeholder="00.000.000/0001-00"
                  value={suggestForm.cnpj}
                  onChange={e => setSuggestForm(f => ({ ...f, cnpj: e.target.value }))} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Cidade</label>
                  <input className={inputCls} placeholder="João Pessoa"
                    value={suggestForm.city}
                    onChange={e => setSuggestForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>UF</label>
                  <input className={inputCls} placeholder="PB" maxLength={2}
                    value={suggestForm.state}
                    onChange={e => setSuggestForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input className={inputCls} placeholder="(83) 99999-9999"
                    value={suggestForm.phone}
                    onChange={e => setSuggestForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Alunos estimados</label>
                  <input type="number" className={inputCls} placeholder="500"
                    value={suggestForm.estimated_students}
                    onChange={e => setSuggestForm(f => ({ ...f, estimated_students: e.target.value }))} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Contato na escola</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nome do contato</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input className={`${inputCls} pl-9`} placeholder="Nome do diretor/responsável"
                        value={suggestForm.contact_name}
                        onChange={e => setSuggestForm(f => ({ ...f, contact_name: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>E-mail do contato</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="email" className={`${inputCls} pl-9`} placeholder="diretor@escola.com.br"
                        value={suggestForm.contact_email}
                        onChange={e => setSuggestForm(f => ({ ...f, contact_email: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea className={inputCls} rows={3}
                  placeholder="Informações adicionais sobre a escola..."
                  value={suggestForm.notes}
                  onChange={e => setSuggestForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <button
                onClick={handleSuggest}
                disabled={savingSuggest || !suggestForm.name}
                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2 hover:from-cyan-600 hover:to-blue-700"
              >
                {savingSuggest
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
                  : <><Send className="w-4 h-4" /> Enviar para aprovação</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ── */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editModal.school_name}</h2>
              <button onClick={() => setEditModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className={labelCls}>Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button key={key} onClick={() => setEditStatus(key)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all
                        ${editStatus === key ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Checklist de implantação</label>
                <div className="space-y-2">
                  {CHECKLIST_STEPS.map(step => (
                    <label key={step.key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={!!editForm[step.key]}
                        onChange={e => setEditForm(f => ({ ...f, [step.key]: e.target.checked }))}
                        className="accent-cyan-500 w-4 h-4" />
                      <span className="text-sm text-gray-700">{step.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Health score: <span className="font-bold" style={{ color: healthColor(editHealth) }}>{editHealth}%</span></label>
                <input type="range" min={0} max={100} value={editHealth}
                  onChange={e => setEditHealth(Number(e.target.value))}
                  className="w-full accent-cyan-500" />
              </div>

              <div>
                <label className={labelCls}>Notas</label>
                <textarea className={inputCls} rows={3} value={editNotes}
                  onChange={e => setEditNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Training Modal ── */}
      {trainingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Agendar treinamento</h2>
              <button onClick={() => setTrainingModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={labelCls}>Escola *</label>
                <select className={inputCls} value={trainingForm.institution_id}
                  onChange={e => setTrainingForm(f => ({ ...f, institution_id: e.target.value }))}>
                  <option value="">Selecione a escola...</option>
                  {institutionOptions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Título *</label>
                <input className={inputCls} placeholder="Ex: Treinamento de matrículas"
                  value={trainingForm.title}
                  onChange={e => setTrainingForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRAINING_TYPES.map(t => (
                    <button key={t.value} onClick={() => setTrainingForm(f => ({ ...f, type: t.value }))}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex items-center gap-2
                        ${trainingForm.type === t.value ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                      <span>{t.icon}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Data e hora *</label>
                <input type="datetime-local" className={inputCls}
                  value={trainingForm.scheduled_at}
                  onChange={e => setTrainingForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea className={inputCls} rows={2}
                  placeholder="Tópicos a cobrir, link da reunião..."
                  value={trainingForm.notes}
                  onChange={e => setTrainingForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button onClick={() => setTrainingModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button
                onClick={handleCreateTraining}
                disabled={savingTraining || !trainingForm.institution_id || !trainingForm.title || !trainingForm.scheduled_at}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                {savingTraining
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Agendando...</>
                  : <><Calendar className="w-4 h-4" /> Agendar</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </SuperAdminLayout>
  )
}