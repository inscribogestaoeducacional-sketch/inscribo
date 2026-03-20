// src/components/superadmin/ConsultantsOverview.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { UserCheck, X, Plus, TrendingUp, Building2, KanbanSquare } from 'lucide-react'

const STAGE_LABELS: Record<string, string> = {
  prospecting: 'Prosp.', contacted: 'Contato', demo_scheduled: 'Demo',
  demo_done: 'Demo ✓', proposal: 'Proposta', negotiation: 'Neg.', won: 'Fechado', lost: 'Perdido',
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

interface Consultant {
  id: string
  full_name: string
  email: string
  user_type: string
  active: boolean
}

export default function ConsultantsOverview() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [pipelineMap, setPipelineMap] = useState<Record<string, any[]>>({})
  const [implMap, setImplMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Consultant | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const { data: consultantData } = await supabase
      .from('users')
      .select('id, full_name, email, user_type, active')
      .eq('user_type', 'consultant')
      .order('full_name')

    const list = consultantData || []
    setConsultants(list)

    if (list.length > 0) {
      const ids = list.map(c => c.id)
      const [pRes, iRes] = await Promise.all([
        supabase.from('sales_pipeline').select('consultant_id, stage').in('consultant_id', ids),
        supabase.from('school_implementations').select('consultant_id').in('consultant_id', ids),
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
    }

    setLoading(false)
  }

  const addConsultant = async () => {
    if (!addForm.full_name || !addForm.email) return
    setSaving(true)
    const { error } = await supabase.from('users').insert({
      full_name: addForm.full_name,
      email: addForm.email,
      role: 'admin',
      user_type: 'consultant',
      active: true,
      institution_id: '00000000-0000-0000-0000-000000000000', // placeholder
    })
    setSaving(false)
    if (!error) {
      setShowAdd(false)
      setAddForm({ full_name: '', email: '' })
      showToast(`Consultor ${addForm.full_name} adicionado!`)
      loadData()
    }
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

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
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">{toast}</div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Consultores</h1>
            <p className="text-gray-500 mt-1">{consultants.length} consultor{consultants.length !== 1 ? 'es' : ''} ativos</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Adicionar consultor
          </button>
        </div>

        {consultants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">Nenhum consultor cadastrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            {consultants.map(c => {
              const pipeline = pipelineMap[c.id] || []
              const active = pipeline.filter(p => !['won','lost'].includes(p.stage))
              const won = pipeline.filter(p => p.stage === 'won')
              const convRate = pipeline.length > 0 ? Math.round((won.length / pipeline.length) * 100) : 0
              const impCount = implMap[c.id] || 0

              // Pipeline por stage
              const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
              const wonMonth = won.filter((p: any) => new Date(p.updated_at || p.created_at) >= startOfMonth)

              return (
                <div key={c.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {c.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{c.full_name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(c)}
                      className="text-xs text-cyan-600 hover:text-cyan-700 font-semibold border border-cyan-200 px-3 py-1.5 rounded-lg hover:bg-cyan-50 transition-all"
                    >
                      Ver detalhes
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Ativas', value: active.length, icon: KanbanSquare, color: 'text-blue-600' },
                      { label: 'Fechadas/mês', value: wonMonth.length, icon: TrendingUp, color: 'text-green-600' },
                      { label: 'Conversão', value: `${convRate}%`, icon: TrendingUp, color: 'text-purple-600' },
                      { label: 'Implantações', value: impCount, icon: Building2, color: 'text-orange-600' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Mini pipeline */}
                  {pipeline.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Pipeline por fase</p>
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
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{selected.full_name}</h2>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-500">{selected.email}</p>

              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline completo</p>
                <div className="space-y-2">
                  {(pipelineMap[selected.id] || []).map((opp: any) => (
                    <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <span className="text-sm text-gray-700 truncate">{opp.school_name || '—'}</span>
                      <span className="text-xs font-semibold text-gray-500 ml-2 flex-shrink-0">{STAGE_LABELS[opp.stage] || opp.stage}</span>
                    </div>
                  ))}
                  {!pipelineMap[selected.id]?.length && (
                    <p className="text-sm text-gray-400 text-center py-4">Sem oportunidades ainda</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Adicionar consultor</h2>
              <button onClick={() => setShowAdd(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nome completo *</label>
                <input className={inputCls} value={addForm.full_name} onChange={e => setAddForm(f => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email *</label>
                <input type="email" className={inputCls} value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <p className="text-xs text-gray-400">O consultor poderá acessar o sistema com email e senha definida pelo próprio.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">Cancelar</button>
              <button onClick={addConsultant} disabled={saving || !addForm.full_name || !addForm.email} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
                {saving ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
