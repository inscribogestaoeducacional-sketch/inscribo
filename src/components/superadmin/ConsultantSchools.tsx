// src/components/superadmin/ConsultantSchools.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { Building2, CheckCircle2, Circle, X, Plus } from 'lucide-react'

const CHECKLIST_STEPS = [
  { key: 'step_onboarding_done',        label: 'Onboarding realizado'       },
  { key: 'step_whatsapp_connected',     label: 'WhatsApp conectado'         },
  { key: 'step_campaign_configured',    label: 'Campanha configurada'       },
  { key: 'step_team_trained',           label: 'Time treinado'              },
  { key: 'step_first_lead',             label: 'Primeiro lead registrado'   },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Não iniciado', color: '#6b7280', bg: '#f3f4f6' },
  in_progress: { label: 'Em andamento', color: '#3b82f6', bg: '#eff6ff' },
  completed:   { label: 'Concluído',    color: '#22c55e', bg: '#f0fdf4' },
  stuck:       { label: 'Travado',      color: '#ef4444', bg: '#fef2f2' },
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

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
  const [institutions, setInstitutions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [editModal, setEditModal] = useState<any | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  // Edit form
  const [editForm, setEditForm] = useState<Record<string, unknown>>({})
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editHealth, setEditHealth] = useState(0)

  // Create access form
  const [newSchool, setNewSchool] = useState({ name: '', city: '', state: 'SP', email: '', full_name: '', institution_id: '' })
  const [createMode, setCreateMode] = useState<'new' | 'existing'>('new')

  useEffect(() => {
    const stored = localStorage.getItem('inscribo-user')
    if (stored) {
      const u = JSON.parse(stored)
      setUserId(u.id)
      loadData(u.id)
    }
  }, [])

  const loadData = async (uid: string) => {
    setLoading(true)
    const [iRes, instRes] = await Promise.all([
      supabase.from('school_implementations').select('*').eq('consultant_id', uid).order('created_at', { ascending: false }),
      supabase.from('institutions').select('id, name, city').order('name'),
    ])
    setImplementations(iRes.data || [])
    setInstitutions(instRes.data || [])
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

  const createAccess = async () => {
    if (!userId) return
    if (!newSchool.email || !newSchool.full_name) return
    setSaving(true)
    try {
      let institutionId = newSchool.institution_id

      if (createMode === 'new') {
        if (!newSchool.name) { setSaving(false); return }
        const { data: inst } = await supabase.from('institutions').insert({
          name: newSchool.name,
          city: newSchool.city || null,
          state: newSchool.state || null,
        }).select().single()
        institutionId = inst?.id
      }

      if (!institutionId) { setSaving(false); return }

      // Criar usuário na tabela users (será necessário convite de auth separado)
      await supabase.from('users').insert({
        email: newSchool.email,
        full_name: newSchool.full_name,
        role: 'admin',
        institution_id: institutionId,
        user_type: 'school_user',
        active: true,
      })

      // Criar implantação
      await supabase.from('school_implementations').insert({
        consultant_id: userId,
        institution_id: institutionId,
        school_name: newSchool.name || institutions.find(i => i.id === institutionId)?.name || 'Escola',
        status: 'not_started',
      })

      setSaving(false)
      setCreateModal(false)
      setNewSchool({ name: '', city: '', state: 'SP', email: '', full_name: '', institution_id: '' })
      showToast(`Acesso criado! ${newSchool.full_name} receberá o email de primeiro acesso.`)
      loadData(userId)
    } catch {
      setSaving(false)
    }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

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
      <div className="p-8">
        {/* Toast */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Minhas Escolas</h1>
            <p className="text-gray-500 mt-1">{implementations.length} escola{implementations.length !== 1 ? 's' : ''} em acompanhamento</p>
          </div>
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Criar acesso
          </button>
        </div>

        {implementations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhuma escola em acompanhamento</p>
            <p className="text-sm text-gray-400 mt-1">Feche uma oportunidade no pipeline ou crie um acesso manualmente</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {implementations.map(imp => {
              const done = CHECKLIST_STEPS.filter(s => imp[s.key]).length
              const pct = Math.round((done / 5) * 100)
              const sCfg = STATUS_CONFIG[imp.status] || STATUS_CONFIG.not_started
              const hColor = healthColor(imp.health_score || 0)

              return (
                <div key={imp.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900">{imp.school_name}</h3>
                    </div>
                    <span className="text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0" style={{ color: sCfg.color, background: sCfg.bg }}>
                      {sCfg.label}
                    </span>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2 mb-4">
                    {CHECKLIST_STEPS.map(step => (
                      <div key={step.key} className="flex items-center gap-2">
                        {imp[step.key]
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        }
                        <span className={`text-sm ${imp[step.key] ? 'text-gray-700' : 'text-gray-400'}`}>{step.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progresso</span>
                      <span>{done}/5 passos</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Health score */}
                  <div className="flex items-center justify-between p-3 rounded-xl mb-4" style={{ background: healthBg(imp.health_score || 0) }}>
                    <span className="text-sm font-medium" style={{ color: hColor }}>Health score</span>
                    <span className="text-lg font-bold" style={{ color: hColor }}>{imp.health_score || 0}%</span>
                  </div>

                  {imp.last_login_at && (
                    <p className="text-xs text-gray-400 mb-4">Último login: {new Date(imp.last_login_at).toLocaleDateString('pt-BR')}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(imp)}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 font-medium transition-all"
                    >
                      Atualizar
                    </button>
                    <button
                      onClick={() => { setCreateModal(true); setCreateMode('existing'); setNewSchool(f => ({ ...f, institution_id: imp.institution_id || '' })) }}
                      className="flex-1 py-2 bg-cyan-50 border border-cyan-200 text-cyan-700 text-sm rounded-xl hover:bg-cyan-100 font-medium transition-all"
                    >
                      Criar acesso
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editModal.school_name}</h2>
              <button onClick={() => setEditModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setEditStatus(key)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all ${editStatus === key ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checklist */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Checklist de implantação</label>
                <div className="space-y-2">
                  {CHECKLIST_STEPS.map(step => (
                    <label key={step.key} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={!!editForm[step.key]}
                        onChange={e => setEditForm(f => ({ ...f, [step.key]: e.target.checked }))}
                        className="accent-cyan-500 w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">{step.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Health score */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Health score: <span className="font-bold" style={{ color: healthColor(editHealth) }}>{editHealth}%</span></label>
                <input type="range" min={0} max={100} value={editHealth} onChange={e => setEditHealth(Number(e.target.value))} className="w-full accent-cyan-500" />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                <textarea className={inputCls} rows={3} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create access modal */}
      {createModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Criar acesso para escola</h2>
              <button onClick={() => setCreateModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Modo */}
              <div className="flex gap-2">
                {[{ k: 'new', l: 'Nova instituição' }, { k: 'existing', l: 'Já existe no sistema' }].map(opt => (
                  <button
                    key={opt.k}
                    onClick={() => setCreateMode(opt.k as 'new' | 'existing')}
                    className={`flex-1 py-2 text-sm rounded-xl border-2 font-semibold transition-all ${createMode === opt.k ? 'border-cyan-500 bg-cyan-50 text-cyan-700' : 'border-gray-200 text-gray-600'}`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>

              {createMode === 'new' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da escola *</label>
                    <input className={inputCls} value={newSchool.name} onChange={e => setNewSchool(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                      <input className={inputCls} value={newSchool.city} onChange={e => setNewSchool(f => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                      <select className={inputCls} value={newSchool.state} onChange={e => setNewSchool(f => ({ ...f, state: e.target.value }))}>
                        {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Selecionar instituição</label>
                  <select className={inputCls} value={newSchool.institution_id} onChange={e => setNewSchool(f => ({ ...f, institution_id: e.target.value }))}>
                    <option value="">Selecione...</option>
                    {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                </div>
              )}

              <hr className="border-gray-100" />
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário administrador</p>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome completo *</label>
                <input className={inputCls} value={newSchool.full_name} onChange={e => setNewSchool(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input type="email" className={inputCls} value={newSchool.email} onChange={e => setNewSchool(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setCreateModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button
                onClick={createAccess}
                disabled={saving || !newSchool.email || !newSchool.full_name || (createMode === 'new' && !newSchool.name) || (createMode === 'existing' && !newSchool.institution_id)}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'Criando...' : 'Criar acesso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
