// src/components/superadmin/AdminContracts.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import { FileText, Plus, X, Copy, CheckCircle2, AlertTriangle, Clock, Send, ExternalLink } from 'lucide-react'

function Skeleton({ h = 'h-4', w = 'w-full', cls = '' }: { h?: string; w?: string; cls?: string }) {
  return <div className={`${h} ${w} ${cls} bg-gray-200 rounded animate-pulse`} />
}

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  draft:     { label: 'Rascunho', color: '#6b7280', bg: '#f3f4f6',  icon: Clock },
  sent:      { label: 'Enviado',  color: '#d97706', bg: '#fffbeb',  icon: Send },
  signed:    { label: 'Assinado', color: '#16a34a', bg: '#f0fdf4',  icon: CheckCircle2 },
  cancelled: { label: 'Cancelado',color: '#dc2626', bg: '#fef2f2',  icon: X },
  expired:   { label: 'Expirado', color: '#9ca3af', bg: '#f9fafb',  icon: AlertTriangle },
}

export default function AdminContracts() {
  const [contracts, setContracts] = useState<any[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants, setConsultants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [form, setForm] = useState({
    institution_id: '',
    consultant_id: '',
    plan: 'escola',
    monthly_value: 550,
    start_date: '',
    end_date: '',
    notes: '',
    signer_name: '',
    signer_email: '',
    signer_phone: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [cRes, iRes, consRes] = await Promise.all([
      supabase.from('contracts').select('*, institutions(name), users(full_name)').order('created_at', { ascending: false }),
      supabase.from('institutions').select('id, name').order('name'),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
    ])
    setContracts(cRes.data || [])
    setInstitutions(iRes.data || [])
    setConsultants(consRes.data || [])
    setLoading(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('Link copiado!'))
  }

  const handleCreate = async () => {
    if (!form.institution_id) { showToast('Selecione a escola'); return }
    setSaving(true)
    try {
      // 1. Create contract record as draft
      const { data: contract, error } = await supabase.from('contracts').insert({
        institution_id: form.institution_id,
        consultant_id: form.consultant_id || null,
        plan: form.plan,
        monthly_value: Number(form.monthly_value),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
        status: 'draft',
      }).select().single()

      if (error) throw error

      // 2. If signer data provided, call ZapSign edge function
      if (form.signer_email && form.signer_name) {
        const school = institutions.find(i => i.id === form.institution_id)
        const { data: zapRes, error: zapErr } = await supabase.functions.invoke('zapsign', {
          body: {
            contract_id: contract.id,
            school_name: school?.name || 'Escola',
            signer_name: form.signer_name,
            signer_email: form.signer_email,
            signer_phone: form.signer_phone,
          },
        })
        if (zapErr) {
          showToast('Contrato criado. Erro ao enviar via ZapSign — verifique a chave API.')
        } else {
          showToast('Contrato criado e enviado via ZapSign!')
        }
      } else {
        showToast('Contrato criado como rascunho.')
      }

      setShowNew(false)
      setForm({ institution_id: '', consultant_id: '', plan: 'escola', monthly_value: 550, start_date: '', end_date: '', notes: '', signer_name: '', signer_email: '', signer_phone: '' })
      loadData()
    } catch (e) {
      showToast('Erro ao criar contrato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SuperAdminLayout>
      <div className="p-8 space-y-6">

        {toast && (
          <div className="fixed top-6 right-6 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm font-medium">
            {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
            <p className="text-gray-500 mt-1">Gestão de contratos via ZapSign</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-600 hover:to-blue-700 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo contrato
          </button>
        </div>

        {/* Status summary */}
        {!loading && (
          <div className="grid grid-cols-5 gap-4">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = contracts.filter(c => c.status === key).length
              const Icon = cfg.icon
              return (
                <div key={key} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                    <span className="text-xs font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{count}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Contracts table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-6 py-4 text-left">Escola</th>
                  <th className="px-6 py-4 text-left">Consultor</th>
                  <th className="px-6 py-4 text-left">Plano</th>
                  <th className="px-6 py-4 text-right">Valor/mês</th>
                  <th className="px-6 py-4 text-left">Vigência</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-left">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(5).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(7).fill(0).map((_, j) => (
                        <td key={j} className="px-6 py-4"><Skeleton h="h-4" w="w-20" /></td>
                      ))}
                    </tr>
                  ))
                ) : contracts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-400">
                      <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">Nenhum contrato ainda</p>
                    </td>
                  </tr>
                ) : contracts.map(c => {
                  const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.draft
                  const Icon = st.icon
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900 text-sm">{c.institutions?.name || '—'}</p>
                        <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.users?.full_name || '—'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{c.plan || 'escola'}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold text-gray-700">
                        R$ {Number(c.monthly_value || 550).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {c.start_date ? new Date(c.start_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
                        {c.end_date ? ` → ${new Date(c.end_date + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ color: st.color, background: st.bg }}>
                          <Icon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {c.zapsign_sign_url && (
                            <>
                              <button
                                onClick={() => copyToClipboard(c.zapsign_sign_url)}
                                className="p-1.5 text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
                                title="Copiar link de assinatura"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <a
                                href={c.zapsign_sign_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Abrir link de assinatura"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          {c.pdf_url && (
                            <a
                              href={c.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Ver PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
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

      {/* New Contract Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Novo contrato</h2>
                <p className="text-sm text-gray-500 mt-0.5">Criação e envio via ZapSign</p>
              </div>
              <button onClick={() => setShowNew(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Escola */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Escola *</label>
                <select className={inputCls} value={form.institution_id} onChange={e => setForm(f => ({ ...f, institution_id: e.target.value }))}>
                  <option value="">Selecionar escola...</option>
                  {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>

              {/* Consultor */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Consultor responsável</label>
                <select className={inputCls} value={form.consultant_id} onChange={e => setForm(f => ({ ...f, consultant_id: e.target.value }))}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Plano */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Plano</label>
                  <select className={inputCls} value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                    <option value="escola">Escola</option>
                    <option value="rede">Rede</option>
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Valor mensal (R$)</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={form.monthly_value}
                    onChange={e => setForm(f => ({ ...f, monthly_value: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Início da vigência</label>
                  <input type="date" className={inputCls} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fim da vigência</label>
                  <input type="date" className={inputCls} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
              </div>

              {/* ZapSign divider */}
              <div className="border-t border-dashed border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Signatário ZapSign (opcional — deixe em branco para salvar como rascunho)
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nome do signatário</label>
                    <input className={inputCls} placeholder="Nome do diretor / responsável" value={form.signer_name} onChange={e => setForm(f => ({ ...f, signer_name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">E-mail</label>
                      <input type="email" className={inputCls} value={form.signer_email} onChange={e => setForm(f => ({ ...f, signer_email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp</label>
                      <input type="tel" className={inputCls} placeholder="5511999999999" value={form.signer_phone} onChange={e => setForm(f => ({ ...f, signer_phone: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Observações</label>
                <textarea
                  rows={2}
                  className={inputCls}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-100">
              <button onClick={() => setShowNew(false)} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.institution_id}
                className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Criando...</>
                ) : form.signer_email ? (
                  <><Send className="w-4 h-4" /> Criar e enviar via ZapSign</>
                ) : (
                  <><FileText className="w-4 h-4" /> Salvar rascunho</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  )
}
