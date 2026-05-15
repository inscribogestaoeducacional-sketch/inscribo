// src/components/superadmin/AdminContracts.tsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import SuperAdminLayout from './SuperAdminLayout'
import {
  FileText, Plus, X, Copy, CheckCircle2, AlertTriangle,
  Clock, Send, ExternalLink, RefreshCw, Eye, Edit2,
  Building2, DollarSign, Search, Zap, AlertCircle
} from 'lucide-react'

type ContractStatus = 'draft' | 'sent' | 'signed' | 'cancelled' | 'expired'

interface Contract {
  id: string
  institution_id: string
  consultant_id?: string
  plan: string
  monthly_value: number
  start_date?: string
  end_date?: string
  notes?: string
  status: ContractStatus
  sign_url?: string
  autentique_document_id?: string
  signer_name?: string
  signer_email?: string
  created_at: string
  institutions?: { name: string }
}

const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition-all bg-white'
const lbl = 'block text-xs font-semibold text-gray-600 mb-1.5'

function fmtBRL(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}
function fmtDate(s?: string) {
  if (!s) return '—'
  return new Date(s + 'T12:00:00').toLocaleDateString('pt-BR')
}

const STATUS_CFG: Record<ContractStatus, { label: string; color: string; bg: string; icon: any }> = {
  draft:     { label: 'Rascunho',  color: '#6b7280', bg: '#f3f4f6', icon: Clock        },
  sent:      { label: 'Enviado',   color: '#d97706', bg: '#fffbeb', icon: Send         },
  signed:    { label: 'Assinado',  color: '#16a34a', bg: '#f0fdf4', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: '#dc2626', bg: '#fef2f2', icon: X            },
  expired:   { label: 'Expirado',  color: '#9ca3af', bg: '#f9fafb', icon: AlertTriangle },
}

// ─── Modal Contrato ────────────────────────────────────────────────────────
function ContractModal({ contract, institutions, consultants, onClose, onSave }: {
  contract: Partial<Contract> | null
  institutions: any[]
  consultants: any[]
  onClose: () => void
  onSave: (form: any, sendAutentique: boolean) => Promise<void>
}) {
  const isNew = !contract?.id
  const [form, setForm] = useState({
    institution_id: contract?.institution_id || '',
    consultant_id:  contract?.consultant_id  || '',
    plan:           contract?.plan           || 'escola',
    monthly_value:  contract?.monthly_value  || 550,
    start_date:     contract?.start_date     || '',
    end_date:       contract?.end_date       || '',
    notes:          contract?.notes          || '',
    signer_name:    contract?.signer_name    || '',
    signer_email:   contract?.signer_email   || '',
    signer_phone:   '',
    status:         contract?.status         || 'draft',
  })
  const [sendAutentique, setSendAutentique] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [preview, setPreview] = useState(false)
  const [templateText, setTemplateText] = useState('')

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!form.institution_id) return
    const inst = institutions.find(i => i.id === form.institution_id)
    if (inst) {
      if (!form.signer_name) set('signer_name', inst.name)
      if (!form.signer_email && inst.email) set('signer_email', inst.email)
    }
  }, [form.institution_id])

  useEffect(() => {
    supabase.from('platform_settings').select('value').eq('key', 'contract_template_text').single()
      .then(({ data }) => { if (data?.value) setTemplateText(data.value) })
  }, [])

  const handleSave = async () => {
    if (!form.institution_id) return
    setSaving(true)
    await onSave({ ...form, id: contract?.id }, sendAutentique)
    setSaving(false)
  }

  const getPreviewText = () => {
    const inst = institutions.find(i => i.id === form.institution_id)
    const cons = consultants.find(c => c.id === form.consultant_id)
    const vars: Record<string, string> = {
      escola:             inst?.name           || '[Nome da escola]',
      cnpj:               inst?.cnpj           || '[CNPJ]',
      cidade_uf:          inst?.city && inst?.state ? `${inst.city}/${inst.state}` : '[Cidade/UF]',
      gestor:             form.signer_name     || '[Nome do gestor]',
      email_gestor:       form.signer_email    || '[E-mail do gestor]',
      valor_implantacao:  inst?.implementation_value ? fmtBRL(inst.implementation_value) : '[Valor implantação]',
      valor_mensal:       fmtBRL(form.monthly_value),
      dia_vencimento:     '10',
      data_inicio:        form.start_date ? fmtDate(form.start_date) : '[Data de início]',
      consultor:          cons?.full_name || 'Equipe Áion Edu',
      data_hoje:          new Date().toLocaleDateString('pt-BR'),
    }
    return templateText.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[94vh]">
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isNew ? 'Novo contrato' : 'Editar contrato'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{isNew ? 'Crie e envie via Autentique' : contract?.institutions?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            {templateText && (
              <button onClick={() => setPreview(!preview)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all
                  ${preview ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <Eye className="w-3.5 h-3.5" /> {preview ? 'Ocultar' : 'Preview'}
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {preview && templateText && (
            <div className="mb-5 bg-gray-50 border border-gray-200 rounded-xl p-5 max-h-64 overflow-y-auto">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Preview do contrato
              </p>
              <pre className="text-xs text-gray-700 font-sans leading-relaxed whitespace-pre-wrap">{getPreviewText()}</pre>
            </div>
          )}

          {!templateText && isNew && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Template não configurado</p>
                <p className="text-xs text-amber-700 mt-0.5">Acesse <strong>Configurações → Template do contrato</strong> antes de enviar.</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={lbl}>Escola *</label>
              <select className={inp} value={form.institution_id} onChange={e => set('institution_id', e.target.value)}>
                <option value="">Selecionar escola...</option>
                {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Consultor</label>
                <select className={inp} value={form.consultant_id} onChange={e => set('consultant_id', e.target.value)}>
                  <option value="">Sem consultor</option>
                  {consultants.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Plano</label>
                <select className={inp} value={form.plan} onChange={e => set('plan', e.target.value)}>
                  <option value="escola">Escola Padrão</option>
                  <option value="rede">Rede</option>
                  <option value="gratuito">Gratuito</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>Mensalidade (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" className={inp + ' pl-9'} value={form.monthly_value} onChange={e => set('monthly_value', Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className={lbl}>Início da vigência</label>
                <input type="date" className={inp} value={form.start_date} onChange={e => set('start_date', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Fim da vigência</label>
                <input type="date" className={inp} value={form.end_date} onChange={e => set('end_date', e.target.value)} />
              </div>
            </div>

            {!isNew && (
              <div>
                <label className={lbl}>Status</label>
                <div className="flex gap-2 flex-wrap">
                  {(Object.entries(STATUS_CFG) as [ContractStatus, any][]).map(([k, cfg]) => (
                    <button key={k} onClick={() => set('status', k)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all
                        ${form.status === k ? 'border-current' : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'}`}
                      style={form.status === k ? { color: cfg.color, background: cfg.bg, borderColor: cfg.color + '80' } : {}}>
                      <cfg.icon className="w-3 h-3" /> {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Autentique */}
            <div className="border-t border-dashed border-gray-200 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-bold text-gray-700">Enviar via Autentique</p>
                  <p className="text-xs text-gray-400">Assinatura digital com validade jurídica</p>
                </div>
                <button onClick={() => setSendAutentique(!sendAutentique)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${sendAutentique ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${sendAutentique ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {sendAutentique && (
                <div className="space-y-3 bg-indigo-50 rounded-xl p-4 border border-indigo-100">
                  <div>
                    <label className={lbl}>Nome do signatário *</label>
                    <input className={inp} placeholder="Diretor / Responsável legal" value={form.signer_name} onChange={e => set('signer_name', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>E-mail *</label>
                      <input type="email" className={inp} value={form.signer_email} onChange={e => set('signer_email', e.target.value)} />
                    </div>
                    <div>
                      <label className={lbl}>WhatsApp</label>
                      <input className={inp} placeholder="5583999999999" value={form.signer_phone} onChange={e => set('signer_phone', e.target.value)} />
                    </div>
                  </div>
                  {!templateText && (
                    <p className="text-xs text-amber-600 font-medium">⚠️ Configure o template do contrato em Configurações.</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className={lbl}>Observações internas</label>
              <textarea rows={2} className={inp + ' resize-none'} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Notas internas..." />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.institution_id}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60 bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:from-indigo-600 hover:to-violet-700">
            {saving
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
              : sendAutentique
              ? <><Send className="w-4 h-4" /> Criar e enviar via Autentique</>
              : <><FileText className="w-4 h-4" /> {isNew ? 'Salvar rascunho' : 'Salvar alterações'}</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function AdminContracts() {
  const [contracts,    setContracts]    = useState<Contract[]>([])
  const [institutions, setInstitutions] = useState<any[]>([])
  const [consultants,  setConsultants]  = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [filterStatus, setFilterStatus] = useState<ContractStatus | 'all'>('all')
  const [showModal,    setShowModal]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Partial<Contract> | null>(null)
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null)
  const [copied,       setCopied]       = useState<string | null>(null)

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [cRes, iRes, consRes] = await Promise.all([
      supabase.from('contracts').select('*, institutions(name, city, state, cnpj, email, implementation_value), users(full_name)').order('created_at', { ascending: false }),
      supabase.from('institutions').select('id, name, city, state, cnpj, email, implementation_value, monthly_value').not('plan_status', 'in', '("cancelled")').order('name'),
      supabase.from('users').select('id, full_name').eq('user_type', 'consultant').order('full_name'),
    ])
    setContracts(cRes.data || [])
    setInstitutions(iRes.data || [])
    setConsultants(consRes.data || [])
    setLoading(false)
  }

  const copyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2500)
    showToast('Link copiado!')
  }

  const handleSave = async (form: any, sendAutentique: boolean) => {
    try {
      let contractId = form.id

      if (contractId) {
        const { error } = await supabase.from('contracts').update({
          institution_id: form.institution_id, consultant_id: form.consultant_id || null,
          plan: form.plan, monthly_value: Number(form.monthly_value),
          start_date: form.start_date || null, end_date: form.end_date || null,
          notes: form.notes || null, status: form.status,
          signer_name: form.signer_name || null, signer_email: form.signer_email || null,
        }).eq('id', contractId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('contracts').insert({
          institution_id: form.institution_id, consultant_id: form.consultant_id || null,
          plan: form.plan, monthly_value: Number(form.monthly_value),
          start_date: form.start_date || null, end_date: form.end_date || null,
          notes: form.notes || null, status: 'draft',
          signer_name: form.signer_name || null, signer_email: form.signer_email || null,
        }).select().single()
        if (error) throw error
        contractId = data.id
      }

      if (sendAutentique && form.signer_email && form.signer_name) {
        try {
          const inst = institutions.find(i => i.id === form.institution_id)
          const { data: autData, error: autErr } = await supabase.functions.invoke('autentique', {
            body: {
              institution_id:       form.institution_id,
              contract_id:          contractId,
              school_name:          inst?.name,
              signer_name:          form.signer_name,
              signer_email:         form.signer_email,
              signer_phone:         form.signer_phone || null,
              monthly_value:        form.monthly_value,
              implementation_value: inst?.implementation_value,
              consultant_id:        form.consultant_id  || null,
              contract_start_date:  form.start_date     || null,
            },
          })
          if (autErr) throw new Error(autErr.message)


          showToast('Contrato enviado via Autentique!')
        } catch (e: any) {
          showToast(`Contrato salvo, mas erro na Autentique: ${e?.message}`, false)
        }
      } else {
        showToast(form.id ? 'Contrato atualizado!' : 'Rascunho salvo!')
      }

      setShowModal(false)
      setEditTarget(null)
      loadData()
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', false)
    }
  }

  const handleResendAutentique = async (contract: Contract) => {
    if (!contract.signer_email || !contract.signer_name) {
      showToast('Preencha o signatário primeiro.', false)
      setEditTarget(contract); setShowModal(true)
      return
    }
    try {
      const inst = institutions.find(i => i.id === contract.institution_id)
      const { data, error } = await supabase.functions.invoke('autentique', {
        body: {
          institution_id:       contract.institution_id,
          contract_id:          contract.id,
          school_name:          inst?.name || contract.institutions?.name,
          signer_name:          contract.signer_name,
          signer_email:         contract.signer_email,
          monthly_value:        contract.monthly_value,
          implementation_value: inst?.implementation_value,
        },
      })
      if (error) throw error
      showToast('Reenvio via Autentique solicitado!')
      loadData()
    } catch (e: any) {
      showToast(`Erro: ${e?.message}`, false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contrato?')) return
    await supabase.from('contracts').delete().eq('id', id)
    showToast('Contrato excluído.')
    loadData()
  }

  const filtered = contracts.filter(c => {
    const matchSearch = !search || c.institutions?.name?.toLowerCase().includes(search.toLowerCase()) || c.signer_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const kpis = {
    total:  contracts.length,
    draft:  contracts.filter(c => c.status === 'draft').length,
    sent:   contracts.filter(c => c.status === 'sent').length,
    signed: contracts.filter(c => c.status === 'signed').length,
    mrr:    contracts.filter(c => c.status === 'signed').reduce((s, c) => s + (c.monthly_value || 0), 0),
  }

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

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
            <p className="text-sm text-gray-500 mt-1">Assinatura digital via Autentique</p>
          </div>
          <div className="flex gap-3">
            <button onClick={loadData} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={() => { setEditTarget(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-semibold text-sm shadow-sm">
              <Plus className="w-4 h-4" /> Novo contrato
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total',         value: kpis.total,  color: 'text-gray-700',   bg: 'bg-gray-50'   },
            { label: 'Rascunhos',     value: kpis.draft,  color: 'text-gray-500',   bg: 'bg-gray-50'   },
            { label: 'Enviados',      value: kpis.sent,   color: 'text-amber-600',  bg: 'bg-amber-50'  },
            { label: 'Assinados',     value: kpis.signed, color: 'text-green-700',  bg: 'bg-green-50'  },
            { label: 'MRR contratos', value: kpis.mrr > 0 ? `R$ ${kpis.mrr.toLocaleString('pt-BR')}` : '—', color: 'text-indigo-700', bg: 'bg-indigo-50' },
          ].map(k => (
            <div key={k.label} className={`${k.bg} rounded-2xl border border-gray-200 p-4`}>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{loading ? '—' : k.value}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Buscar por escola ou signatário..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${filterStatus === 'all' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              Todos ({contracts.length})
            </button>
            {(Object.entries(STATUS_CFG) as [ContractStatus, any][]).map(([k, cfg]) => {
              const count = contracts.filter(c => c.status === k).length
              if (count === 0) return null
              return (
                <button key={k} onClick={() => setFilterStatus(k === filterStatus ? 'all' : k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all
                    ${filterStatus === k ? 'border-current' : 'border-transparent hover:border-gray-200'}`}
                  style={filterStatus === k ? { color: cfg.color, background: cfg.bg, borderColor: cfg.color + '60' } : { color: cfg.color, background: cfg.bg }}>
                  {cfg.label} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Escola','Signatário','Plano','Mensalidade','Vigência','Status','Ações'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                      <p className="text-sm text-gray-400 font-medium">{search ? 'Nenhum contrato encontrado' : 'Nenhum contrato ainda'}</p>
                      {!search && <button onClick={() => { setEditTarget(null); setShowModal(true) }} className="mt-3 text-sm text-indigo-600 font-semibold">+ Criar primeiro contrato</button>}
                    </td>
                  </tr>
                ) : filtered.map(c => {
                  const st = STATUS_CFG[c.status] || STATUS_CFG.draft
                  const StIcon = st.icon
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-indigo-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.institutions?.name || '—'}</p>
                            <p className="text-xs text-gray-400">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {c.signer_name
                          ? <div><p className="text-sm font-medium text-gray-800">{c.signer_name}</p>
                              {c.signer_email && <p className="text-xs text-gray-400 truncate max-w-[180px]">{c.signer_email}</p>}
                            </div>
                          : <span className="text-xs text-gray-400 italic">Não definido</span>}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600 capitalize">{c.plan || 'escola'}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-gray-700">{fmtBRL(c.monthly_value)}</td>
                      <td className="px-5 py-4 text-xs text-gray-500">
                        {c.start_date ? fmtDate(c.start_date) : '—'}{c.end_date ? ` → ${fmtDate(c.end_date)}` : ''}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full" style={{ color: st.color, background: st.bg }}>
                          <StIcon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          {c.sign_url && (
                            <>
                              <button onClick={() => copyLink(c.sign_url!, c.id)} title="Copiar link"
                                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                {copied === c.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              <a href={c.sign_url} target="_blank" rel="noopener noreferrer"
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}
                          {(c.status === 'draft' || c.status === 'sent') && (
                            <button onClick={() => handleResendAutentique(c)} title="Enviar/reenviar via Autentique"
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => { setEditTarget(c); setShowModal(true) }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg">
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
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
              Mostrando {filtered.length} de {contracts.length} contrato{contracts.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Info Autentique */}
        {!loading && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex items-start gap-4">
            <Zap className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-indigo-800 text-sm">Autentique — Assinatura digital</p>
              <p className="text-xs text-indigo-600 mt-1">
                Configure o token em <strong>Configurações → Autentique</strong> e o template em
                <strong> Configurações → Template do contrato</strong> para ativar o envio automático.
              </p>
            </div>
          </div>
        )}

      </div>

      {showModal && (
        <ContractModal
          contract={editTarget}
          institutions={institutions}
          consultants={consultants}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSave={handleSave}
        />
      )}

    </SuperAdminLayout>
  )
}