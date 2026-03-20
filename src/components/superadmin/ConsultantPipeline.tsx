// src/components/superadmin/ConsultantPipeline.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { Plus, X, ChevronRight, AlertCircle } from 'lucide-react'

const STAGES = [
  { key: 'prospecting',    label: 'Prospectando',    color: '#6b7280', header: 'bg-gray-100',    text: 'text-gray-700'   },
  { key: 'contacted',      label: 'Contato feito',   color: '#3b82f6', header: 'bg-blue-50',     text: 'text-blue-800'   },
  { key: 'demo_scheduled', label: 'Demo agendada',   color: '#f59e0b', header: 'bg-amber-50',    text: 'text-amber-800'  },
  { key: 'demo_done',      label: 'Demo realizada',  color: '#f97316', header: 'bg-orange-50',   text: 'text-orange-800' },
  { key: 'proposal',       label: 'Proposta',        color: '#8b5cf6', header: 'bg-purple-50',   text: 'text-purple-800' },
  { key: 'negotiation',    label: 'Negociação',      color: '#ec4899', header: 'bg-pink-50',     text: 'text-pink-800'   },
  { key: 'won',            label: 'Fechado',         color: '#22c55e', header: 'bg-green-50',    text: 'text-green-800'  },
  { key: 'lost',           label: 'Perdido',         color: '#ef4444', header: 'bg-red-50',      text: 'text-red-800'    },
]

const STAGE_KEYS = STAGES.map(s => s.key)

const LOST_REASONS = ['Preço', 'Concorrência', 'Sem interesse', 'Sem orçamento', 'Outro']

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

interface Opportunity {
  id: string
  consultant_id: string
  school_name: string
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  city?: string
  state?: string
  current_students?: number
  avg_monthly_fee?: number
  stage: string
  lost_reason?: string
  notes?: string
  next_action?: string
  next_action_date?: string
  estimated_value?: number
  created_at: string
  updated_at: string
}

export default function ConsultantPipeline() {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [showNewModal, setShowNewModal] = useState(false)
  const [lostModal, setLostModal] = useState<{ opp: Opportunity; targetStage: string } | null>(null)
  const [implModal, setImplModal] = useState<Opportunity | null>(null)
  const [lostReason, setLostReason] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    school_name: '', contact_name: '', contact_phone: '', contact_email: '',
    city: '', state: 'SP', current_students: '', avg_monthly_fee: '',
    estimated_value: '', next_action: '', next_action_date: '', notes: ''
  })

  useEffect(() => {
    const stored = localStorage.getItem('inscribo-user')
    if (stored) {
      const u = JSON.parse(stored)
      setUserId(u.id)
      loadOpps(u.id)
    }
  }, [])

  const loadOpps = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('sales_pipeline')
      .select('*')
      .eq('consultant_id', uid)
      .order('updated_at', { ascending: false })
    setOpps(data || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!userId || !form.school_name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('sales_pipeline').insert({
      consultant_id: userId,
      school_name: form.school_name.trim(),
      contact_name: form.contact_name || null,
      contact_phone: form.contact_phone || null,
      contact_email: form.contact_email || null,
      city: form.city || null,
      state: form.state || null,
      current_students: form.current_students ? Number(form.current_students) : null,
      avg_monthly_fee: form.avg_monthly_fee ? Number(form.avg_monthly_fee) : null,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      next_action: form.next_action || null,
      next_action_date: form.next_action_date || null,
      notes: form.notes || null,
      stage: 'prospecting',
    })
    setSaving(false)
    if (!error) {
      setShowNewModal(false)
      setForm({ school_name: '', contact_name: '', contact_phone: '', contact_email: '', city: '', state: 'SP', current_students: '', avg_monthly_fee: '', estimated_value: '', next_action: '', next_action_date: '', notes: '' })
      loadOpps(userId)
    }
  }

  const moveStage = async (opp: Opportunity, direction: 1 | -1) => {
    const idx = STAGE_KEYS.indexOf(opp.stage)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= STAGE_KEYS.length) return
    const newStage = STAGE_KEYS[newIdx]
    if (newStage === 'lost') { setLostModal({ opp, targetStage: newStage }); return }
    if (newStage === 'won') { await doMoveStage(opp, newStage); setImplModal({ ...opp, stage: 'won' }); return }
    await doMoveStage(opp, newStage)
  }

  const doMoveStage = async (opp: Opportunity, stage: string, extra?: Record<string, unknown>) => {
    const { data } = await supabase
      .from('sales_pipeline')
      .update({ stage, updated_at: new Date().toISOString(), ...extra })
      .eq('id', opp.id)
      .select()
      .single()
    if (data) setOpps(prev => prev.map(o => o.id === opp.id ? data : o))
  }

  const confirmLost = async () => {
    if (!lostModal) return
    await doMoveStage(lostModal.opp, 'lost', { lost_reason: lostReason })
    setLostModal(null)
    setLostReason('')
  }

  const createImpl = async () => {
    if (!implModal || !userId) return
    await supabase.from('school_implementations').insert({
      consultant_id: userId,
      pipeline_id: implModal.id,
      school_name: implModal.school_name,
      status: 'not_started',
    })
    setImplModal(null)
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
      <div className="p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meu Pipeline</h1>
            <p className="text-gray-500 mt-1">{opps.filter(o => !['won','lost'].includes(o.stage)).length} oportunidades ativas</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> Nova oportunidade
          </button>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
          {STAGES.map(stage => {
            const stageOpps = opps.filter(o => o.stage === stage.key)
            return (
              <div key={stage.key} className="flex-shrink-0 w-64 flex flex-col">
                {/* Column header */}
                <div className={`${stage.header} rounded-xl px-4 py-3 mb-3 flex items-center justify-between`}>
                  <span className={`font-semibold text-sm ${stage.text}`}>{stage.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${stage.text}`} style={{ background: `${stage.color}22` }}>{stageOpps.length}</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-3 overflow-y-auto flex-1">
                  {stageOpps.map(opp => {
                    const idx = STAGE_KEYS.indexOf(opp.stage)
                    const canAdvance = idx < STAGE_KEYS.length - 1
                    const canGoBack = idx > 0
                    const today = new Date(); today.setHours(0,0,0,0)
                    const isOverdue = opp.next_action_date && new Date(opp.next_action_date + 'T12:00:00') < today && !['won','lost'].includes(opp.stage)

                    return (
                      <div key={opp.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{opp.school_name}</p>
                          {isOverdue && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                        </div>
                        {opp.city && <p className="text-xs text-gray-400 mb-2">{opp.city}{opp.state ? `, ${opp.state}` : ''}</p>}
                        {opp.estimated_value && (
                          <p className="text-xs font-semibold text-green-700 mb-2">R$ {opp.estimated_value.toLocaleString('pt-BR')}/mês</p>
                        )}
                        {opp.next_action && (
                          <p className={`text-xs mb-1 truncate ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>→ {opp.next_action}</p>
                        )}
                        {opp.next_action_date && (
                          <p className={`text-xs mb-3 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                            {new Date(opp.next_action_date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {canGoBack && (
                            <button
                              onClick={() => moveStage(opp, -1)}
                              className="flex-1 py-1.5 text-xs border border-gray-200 text-gray-500 rounded-lg hover:bg-gray-50 transition-all"
                            >
                              ← Voltar
                            </button>
                          )}
                          {canAdvance && (
                            <button
                              onClick={() => moveStage(opp, 1)}
                              className="flex-1 py-1.5 text-xs bg-cyan-50 border border-cyan-200 text-cyan-700 rounded-lg hover:bg-cyan-100 transition-all flex items-center justify-center gap-1"
                            >
                              Avançar <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal: Nova oportunidade */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nova oportunidade</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome da escola *</label>
                <input className={inputCls} value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do contato</label>
                  <input className={inputCls} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Telefone</label>
                  <input className={inputCls} value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email do contato</label>
                <input type="email" className={inputCls} value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Cidade</label>
                  <input className={inputCls} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estado</label>
                  <select className={inputCls} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                    {UFS.map(uf => <option key={uf}>{uf}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Alunos atuais</label>
                  <input type="number" className={inputCls} value={form.current_students} onChange={e => setForm(f => ({ ...f, current_students: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mensalidade média (R$)</label>
                  <input type="number" className={inputCls} value={form.avg_monthly_fee} onChange={e => setForm(f => ({ ...f, avg_monthly_fee: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Valor estimado do contrato (R$/mês)</label>
                <input type="number" className={inputCls} value={form.estimated_value} onChange={e => setForm(f => ({ ...f, estimated_value: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Próxima ação</label>
                  <input className={inputCls} value={form.next_action} onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Data da ação</label>
                  <input type="date" className={inputCls} value={form.next_action_date} onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notas</label>
                <textarea className={inputCls} rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowNewModal(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={handleCreate} disabled={saving || !form.school_name.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50">
                {saving ? 'Salvando...' : 'Criar oportunidade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Motivo de perda */}
      {lostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Motivo da perda</h2>
            <p className="text-sm text-gray-500 mb-4">Por que a oportunidade <strong>{lostModal.opp.school_name}</strong> foi perdida?</p>
            <div className="space-y-2 mb-6">
              {LOST_REASONS.map(r => (
                <label key={r} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="lost_reason" value={r} checked={lostReason === r} onChange={() => setLostReason(r)} className="accent-cyan-500" />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setLostModal(null); setLostReason('') }} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={confirmLost} disabled={!lostReason} className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 disabled:opacity-50">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Criar implantação */}
      {implModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Parabéns pelo fechamento!</h2>
            <p className="text-sm text-gray-500 mb-6">Deseja criar uma implantação para <strong>{implModal.school_name}</strong> e iniciar o processo pós-venda?</p>
            <div className="flex gap-3">
              <button onClick={() => setImplModal(null)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Agora não</button>
              <button onClick={createImpl} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm">Criar implantação</button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
